/**
 * DCA Shared — Priority Scorer
 * =============================
 * Normalises raw factor values (counts, booleans) into a 0..1 signal,
 * multiplies by the profile's weight, sums, and rescales to a 0..100 score.
 *
 * Missing factor values are treated as 0 — they contribute nothing to the
 * numerator but their weight is *not* counted in the denominator either
 * (so an engine that only supplies `complexity` still gets a normal 0-100
 * output rather than being penalised for the absent factors).
 *
 * Non-fatal posture: every helper here catches its own exceptions and falls
 * back to zero rather than throwing.
 */

import type { FactorKey, StackPriorityProfile } from "./factors";

export interface FileFactors {
  filePath: string;
  factors: Partial<Record<FactorKey, number | boolean>>;
}

export type ScoreBand = "critical" | "high" | "medium" | "low";

export interface ScoreBreakdownEntry {
  raw: number;
  weighted: number;
  weight: number;
}

export interface ScoredFile extends FileFactors {
  score: number; // 0..100
  band: ScoreBand;
  breakdown: Partial<Record<FactorKey, ScoreBreakdownEntry>>;
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/** Boolean → 0 or 1. Coerces truthy/falsy safely. */
export function normalizeBoolean(v: unknown): number {
  return v ? 1 : 0;
}

/**
 * Count → 0..1 curve with saturation at `cap`.
 * A file with 0 hits → 0. `cap` hits → 1. Linear in between.
 */
export function normalizeCount(v: unknown, cap = 10): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= cap) return 1;
  return n / cap;
}

/**
 * Churn normaliser — 90-day commit count.
 * Chosen bands (from Commerce engine): >=10 saturated, 5–9 high, 2–4 medium.
 */
export function normalizeChurn(v: unknown): number {
  return normalizeCount(v, 10);
}

/**
 * Complexity normaliser — cyclomatic complexity clamped at 30.
 * Commerce engine already caps at 50 internally; we normalise a bit tighter
 * so 20+ counts as "very high".
 */
export function normalizeComplexity(v: unknown): number {
  return normalizeCount(v, 25);
}

/**
 * Fan-in normaliser — number of reverse refs. Cap at 20.
 */
export function normalizeFanIn(v: unknown): number {
  return normalizeCount(v, 20);
}

/** Central dispatch — pick the right normaliser per factor. */
function normaliseFactor(key: FactorKey, raw: number | boolean | undefined): number {
  if (raw === undefined || raw === null) return 0;
  switch (key) {
    case "complexity":
      return normalizeComplexity(raw);
    case "churn":
      return normalizeChurn(raw);
    case "fan_in":
      return normalizeFanIn(raw);
    case "plugin":
    case "observer":
    case "api_annotated":
    case "revenue_path":
    case "security_touch":
    case "test_gap":
      // These may arrive as boolean (extractor) or numeric 0/1.
      return normalizeBoolean(raw);
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function bandForScore(score: number): ScoreBand {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

/** Score a single file against a stack profile. Never throws. */
export function scoreFile(
  file: FileFactors,
  profile: StackPriorityProfile,
): ScoredFile {
  const breakdown: Partial<Record<FactorKey, ScoreBreakdownEntry>> = {};
  let numerator = 0;
  let denominator = 0;

  try {
    const weights = profile.weights || {};
    for (const [rawKey, weight] of Object.entries(weights)) {
      const key = rawKey as FactorKey;
      const w = Number(weight);
      if (!Number.isFinite(w) || w <= 0) continue;

      const rawVal = file.factors ? file.factors[key] : undefined;
      const norm = normaliseFactor(key, rawVal);
      const weighted = norm * w;

      breakdown[key] = {
        raw: typeof rawVal === "boolean" ? (rawVal ? 1 : 0) : Number(rawVal ?? 0),
        weighted: Number(weighted.toFixed(4)),
        weight: w,
      };

      numerator += weighted;
      denominator += w;
    }
  } catch {
    // Defensive: never crash the caller.
  }

  const score = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
  const clamped = Math.max(0, Math.min(100, score));

  return {
    filePath: file.filePath,
    factors: file.factors ?? {},
    score: clamped,
    band: bandForScore(clamped),
    breakdown,
  };
}

/**
 * Score a batch and return sorted highest-first.
 * Ties broken by file path for deterministic output.
 */
export function scoreFiles(
  files: FileFactors[],
  profile: StackPriorityProfile,
): ScoredFile[] {
  const out: ScoredFile[] = [];
  for (const f of files ?? []) {
    try {
      out.push(scoreFile(f, profile));
    } catch {
      out.push({
        filePath: f?.filePath ?? "?",
        factors: {},
        score: 0,
        band: "low",
        breakdown: {},
      });
    }
  }
  return out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.filePath.localeCompare(b.filePath);
  });
}
