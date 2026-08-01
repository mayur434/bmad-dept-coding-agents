/**
 * DCA Shared — Severity helpers
 * ==============================
 * The `Severity` enum + `SEVERITIES` array live in `../core/types`.
 * This module adds cross-agent helpers: band-from-score, band-to-score,
 * severity-merging (max), and severity-count aggregation.
 *
 * All helpers are non-throwing; unknown inputs collapse to `INFO`.
 */

import type { Finding, Severity } from "../core/types";
import { normalizeSeverity, SEVERITIES } from "../core/types";

// Numeric anchor for each severity band. Scores are clamped 0..100.
// Bands are chosen to match the audit severity-model buckets:
//   CRITICAL 90-100, HIGH 70-89, MEDIUM 40-69, LOW 10-39, INFO 0-9
const BAND_ANCHOR: Record<Severity, number> = {
  CRITICAL: 95,
  HIGH: 80,
  MEDIUM: 55,
  LOW: 25,
  INFO: 5,
};

/**
 * 0..100 → severity band.
 *   90+ CRITICAL, 70+ HIGH, 40+ MEDIUM, 10+ LOW, else INFO.
 */
export function bandFromScore(score: number): Severity {
  const s = Number(score);
  if (!Number.isFinite(s)) return "INFO";
  const clamped = Math.max(0, Math.min(100, s));
  if (clamped >= 90) return "CRITICAL";
  if (clamped >= 70) return "HIGH";
  if (clamped >= 40) return "MEDIUM";
  if (clamped >= 10) return "LOW";
  return "INFO";
}

/** Severity band → representative 0..100 score. */
export function scoreFromBand(band: Severity): number {
  return BAND_ANCHOR[normalizeSeverity(band)];
}

/** Return the more-severe of two severities. */
export function mergeSeverity(a: Severity, b: Severity): Severity {
  const na = normalizeSeverity(a);
  const nb = normalizeSeverity(b);
  const rankA = SEVERITIES.indexOf(na); // CRITICAL=0 … INFO=4
  const rankB = SEVERITIES.indexOf(nb);
  return rankA <= rankB ? na : nb;
}

/**
 * Count findings per severity bucket. Missing buckets are 0.
 * Never throws — malformed severities collapse to INFO.
 */
export function severityCounts(findings: Finding[]): Record<Severity, number> {
  const out: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  for (const f of findings ?? []) {
    try {
      out[normalizeSeverity(f?.severity)] += 1;
    } catch {
      out.INFO += 1;
    }
  }
  return out;
}

/**
 * Convenience: worst severity in a batch. Empty batch → INFO.
 */
export function worstSeverity(findings: Finding[]): Severity {
  let worst: Severity = "INFO";
  for (const f of findings ?? []) {
    worst = mergeSeverity(worst, normalizeSeverity(f?.severity));
  }
  return worst;
}
