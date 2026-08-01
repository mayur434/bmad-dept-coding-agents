/**
 * DCA Shared — findings cache consumer.
 * ======================================
 * Convenience reader for downstream agents that want to cross-reference the
 * most recent findings from another agent:
 *   impact-analysis reads audit findings, test-coverage reads audit findings,
 *   etc.
 *
 * Returns null when no cached run matches the filters — never throws.
 */

import type { Finding } from "../core/types";
import { normalizeSeverity } from "../core/types";
import { CachedRun, CachedRunAgent, readLatestRun } from "./cache";

export interface ConsumeOpts {
  projectRoot: string;
  fromAgent: CachedRunAgent;
  /** Ignore runs older than N hours. */
  maxAgeHours?: number;
  /** Ignore runs whose stack does not exactly match this id. */
  requireStack?: string;
}

export interface ConsumedFindings {
  run: CachedRun;
  findings: Finding[];
  bySeverity: Record<string, number>;
  /** Deduped, alphabetically sorted list of files with CRITICAL findings. */
  criticalFiles: string[];
  /** Findings grouped by their `file` value ('<no-file>' for missing). */
  fileToFindings: Record<string, Finding[]>;
}

/**
 * Read the latest cached run for `fromAgent`, apply optional filters, and
 * return a pre-aggregated view suitable for cross-agent consumption.
 */
export function consumeLatestFindings(
  opts: ConsumeOpts,
): ConsumedFindings | null {
  const run = readLatestRun(opts.projectRoot, opts.fromAgent);
  if (!run) return null;

  if (opts.requireStack !== undefined && run.stack !== opts.requireStack) {
    return null;
  }

  if (opts.maxAgeHours !== undefined && opts.maxAgeHours >= 0) {
    const runAtMs = Date.parse(run.runAt);
    if (Number.isNaN(runAtMs)) return null;
    const ageMs = Date.now() - runAtMs;
    if (ageMs > opts.maxAgeHours * 3600 * 1000) return null;
  }

  const findings = run.findings ?? [];
  const bySeverity: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  const fileToFindings: Record<string, Finding[]> = {};
  const criticalSet = new Set<string>();

  for (const f of findings) {
    const sev = normalizeSeverity(f.severity);
    bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;

    const key = f.file && f.file.length > 0 ? f.file : "<no-file>";
    (fileToFindings[key] ??= []).push(f);
    if (sev === "CRITICAL" && f.file && f.file.length > 0) {
      criticalSet.add(f.file);
    }
  }

  return {
    run,
    findings,
    bySeverity,
    criticalFiles: Array.from(criticalSet).sort(),
    fileToFindings,
  };
}
