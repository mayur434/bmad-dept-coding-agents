/**
 * BMAD Test Coverage — Shared 6-Factor Priority Adapter
 * =======================================================
 * Thin wrapper around `skills/shared/priority` that rescores an engine's
 * `CoverageGap[]` using the 6-factor stack profile. Called from each engine's
 * `analyzeCoverage()` right before the report is returned, so every stack
 * (aem, sling, spring, app-builder, eds, eds-commerce, commerce-saas,
 * commerce) shares one deterministic scoring pipeline.
 *
 * Design notes:
 *   - Extractors are the shared `defaultExtractors(stackId)` MINUS the
 *     expensive per-file `churn`/`fan_in` execSync calls (git log + grep per
 *     file becomes O(n) shell fork; disabled to keep scoring fast). Engines
 *     that already compute churn / fan-in in bulk (Commerce) can inject them
 *     via `factorHintsByFile`.
 *   - Never throws. Any per-file extractor failure returns 0 for that factor.
 *   - Sort order after this call: highest score first; ties broken by file.
 *
 * Log line format (stderr):
 *   [coverage-priority] scored N files (top-5: <file>@<score>, ...)
 */

import * as path from "path";
import type { CoverageGap } from "../shared/base";
import {
  bandForScore,
  defaultExtractors,
  extractFactorsFor,
  FactorExtractors,
  FactorKey,
  FileFactors,
  getStackProfile,
  scoreFiles,
} from "../../../shared/priority";

export interface ScoreResult {
  totalScored: number;
  top5: { file: string; score: number }[];
  byBand: { critical: number; high: number; medium: number; low: number };
}

export interface ApplySharedPriorityOpts {
  /** Optional per-file factor overrides (e.g. Commerce pre-computed churn/fan_in maps). */
  factorHintsByFile?: Map<string, Partial<Record<FactorKey, number | boolean>>>;
  /** Set to false to skip the [coverage-priority] log line (used from unit tests). */
  quiet?: boolean;
}

/**
 * Rescore an engine's gaps in-place using the shared 6-factor priority model.
 * Returns a small summary the caller can propagate to Run Info / logs.
 */
export async function applySharedPriority(
  gaps: CoverageGap[],
  projectPath: string,
  stackId: string,
  opts: ApplySharedPriorityOpts = {},
): Promise<ScoreResult> {
  if (!gaps || gaps.length === 0) {
    return { totalScored: 0, top5: [], byBand: { critical: 0, high: 0, medium: 0, low: 0 } };
  }

  const profile = getStackProfile(stackId);
  const extractors = fastExtractors(stackId);

  // Resolve every gap's absolute path so extractors can read the file.
  const absFiles: string[] = gaps.map((g) =>
    path.isAbsolute(g.file) ? g.file : path.join(projectPath, g.file),
  );

  let factors: FileFactors[];
  try {
    factors = await extractFactorsFor(absFiles, extractors);
  } catch {
    factors = absFiles.map((fp) => ({ filePath: fp, factors: {} }));
  }

  // Merge in caller-supplied hints (Commerce pre-computed maps live here).
  if (opts.factorHintsByFile && opts.factorHintsByFile.size > 0) {
    for (let i = 0; i < factors.length; i++) {
      const hint =
        opts.factorHintsByFile.get(gaps[i].file) ??
        opts.factorHintsByFile.get(absFiles[i]);
      if (hint) factors[i] = { ...factors[i], factors: { ...factors[i].factors, ...hint } };
    }
  }

  const scored = scoreFiles(factors, profile);
  const byPath = new Map(scored.map((s) => [s.filePath, s]));

  const byBand = { critical: 0, high: 0, medium: 0, low: 0 };
  for (let i = 0; i < gaps.length; i++) {
    const s = byPath.get(absFiles[i]);
    if (!s) continue;
    (gaps[i] as unknown as { _score: number })._score = s.score;
    gaps[i].priority = s.band as CoverageGap["priority"];
    byBand[s.band] += 1;
  }

  // Highest score first; ties broken by file path (deterministic).
  gaps.sort((a, b) => {
    const sa = (a as unknown as { _score?: number })._score ?? 0;
    const sb = (b as unknown as { _score?: number })._score ?? 0;
    if (sb !== sa) return sb - sa;
    return a.file.localeCompare(b.file);
  });

  const top5 = gaps.slice(0, 5).map((g) => ({
    file: g.file,
    score: (g as unknown as { _score?: number })._score ?? 0,
  }));

  if (!opts.quiet) {
    const top5Str = top5.map((t) => `${t.file}@${t.score}`).join(", ");
    process.stderr.write(
      `[coverage-priority] scored ${gaps.length} files (top-5: ${top5Str || "—"})\n`,
    );
  }

  return { totalScored: gaps.length, top5, byBand };
}

/**
 * Apply audit-chain boosts to already-scored gaps.
 *
 * For each gap whose file matches a CRITICAL audit finding, add +20 to its
 * score (capped at 100). For HIGH, add +10. Update the gap's priority band and
 * prepend a marker to `gap.reason` so it surfaces on the standardized report's
 * Summary sheet ("Priority Backlog" in the plugin taxonomy).
 */
export function applyAuditChainBoost(
  gaps: CoverageGap[],
  criticalFileCounts: Map<string, number>,
  highFileCounts: Map<string, number>,
): { boosted: number; criticalHits: number; highHits: number } {
  if (!gaps || gaps.length === 0) return { boosted: 0, criticalHits: 0, highHits: 0 };
  let boosted = 0;
  let criticalHits = 0;
  let highHits = 0;

  for (const g of gaps) {
    const rel = g.file;
    const critN = criticalFileCounts.get(rel) ?? 0;
    const highN = highFileCounts.get(rel) ?? 0;

    if (critN > 0) {
      const prev = (g as unknown as { _score?: number })._score ?? 0;
      const boostedScore = Math.min(100, prev + 20);
      (g as unknown as { _score: number })._score = boostedScore;
      g.priority = bandForScore(boostedScore) as CoverageGap["priority"];
      g.reason = `⚠️ Audit: ${critN} CRITICAL finding(s) — ${g.reason}`;
      boosted++;
      criticalHits++;
    } else if (highN > 0) {
      const prev = (g as unknown as { _score?: number })._score ?? 0;
      const boostedScore = Math.min(100, prev + 10);
      (g as unknown as { _score: number })._score = boostedScore;
      g.priority = bandForScore(boostedScore) as CoverageGap["priority"];
      g.reason = `⚠️ Audit: ${highN} HIGH finding(s) — ${g.reason}`;
      boosted++;
      highHits++;
    }
  }

  // Re-sort after mutating scores.
  gaps.sort((a, b) => {
    const sa = (a as unknown as { _score?: number })._score ?? 0;
    const sb = (b as unknown as { _score?: number })._score ?? 0;
    if (sb !== sa) return sb - sa;
    return a.file.localeCompare(b.file);
  });

  return { boosted, criticalHits, highHits };
}

/** Get the score attached by `applySharedPriority`, or 0 if unscored. */
export function scoreOf(gap: CoverageGap): number {
  return (gap as unknown as { _score?: number })._score ?? 0;
}

// ---------------------------------------------------------------------------
// Fast extractors — same as shared defaults minus per-file execSync calls.
// ---------------------------------------------------------------------------

function fastExtractors(stackId: string): FactorExtractors {
  const base = defaultExtractors(stackId);
  // Drop churn + fan_in: `git log` / `grep -rF` per file becomes O(n) shell
  // forks and dominates runtime on projects with hundreds of gaps. Engines
  // that pre-compute these in bulk can inject them via factorHintsByFile.
  return {
    complexity: base.complexity,
    revenue_path: base.revenue_path,
    plugin: base.plugin,
    observer: base.observer,
    api_annotated: base.api_annotated,
    security_touch: base.security_touch,
    test_gap: base.test_gap,
  };
}
