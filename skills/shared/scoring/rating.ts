/**
 * DCA Shared — SonarQube-style A–E ratings
 * =========================================
 * Extracted from `bmad-dept-code-sonar-scan-agent` so audit / test-coverage
 * / impact-analysis can compute the same ratings without duplicating the
 * severity → rating math.
 *
 * Reliability   = worst severity among Bug findings
 * Security      = worst severity among Vulnerability + Security Hotspot
 * Maintainability = worst severity among Code Smell + Duplication + Complexity
 *
 * Rating from worst severity:
 *   CRITICAL → E, HIGH → D, MEDIUM → C, LOW → B, INFO or empty → A
 */

import type { Finding, Severity } from "../core/types";
import { normalizeSeverity } from "../core/types";

export type Rating = "A" | "B" | "C" | "D" | "E";

const RATING_FROM_SEV: Record<Severity, Rating> = {
  CRITICAL: "E",
  HIGH: "D",
  MEDIUM: "C",
  LOW: "B",
  INFO: "A",
};

const RATING_RANK: Record<Rating, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

/** Return the more-severe rating. */
export function worstRating(a: Rating, b: Rating): Rating {
  return RATING_RANK[a] >= RATING_RANK[b] ? a : b;
}

/** Rating from a set of findings (worst severity). Empty → 'A'. */
export function ratingFromFindings(findings: Finding[]): Rating {
  let worst: Rating = "A";
  for (const f of findings ?? []) {
    const r = RATING_FROM_SEV[normalizeSeverity(f?.severity)];
    worst = worstRating(worst, r);
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Category filters — matching the strings documented in
// bmad-dept-code-sonar-scan-agent/resources/shared/severity-and-rating-model.md
// ---------------------------------------------------------------------------

function categoryOf(f: Finding | undefined | null): string {
  return String(f?.category ?? "").trim().toLowerCase();
}

function matchesAny(finding: Finding, keys: string[]): boolean {
  const c = categoryOf(finding);
  return keys.some((k) => c === k);
}

/** Reliability rating: worst severity among Bug findings. */
export function reliabilityRating(findings: Finding[]): Rating {
  return ratingFromFindings(
    (findings ?? []).filter((f) => matchesAny(f, ["bug"])),
  );
}

/** Security rating: worst severity among Vulnerability + Security Hotspot. */
export function securityRating(findings: Finding[]): Rating {
  return ratingFromFindings(
    (findings ?? []).filter((f) =>
      matchesAny(f, ["vulnerability", "security hotspot", "security_hotspot", "security-hotspot"]),
    ),
  );
}

/** Maintainability rating: Code Smell + Duplication + Complexity. */
export function maintainabilityRating(findings: Finding[]): Rating {
  return ratingFromFindings(
    (findings ?? []).filter((f) =>
      matchesAny(f, [
        "code smell",
        "code_smell",
        "code-smell",
        "duplication",
        "complexity",
      ]),
    ),
  );
}

/**
 * Aggregate the three ratings and produce a PASS/FAIL Quality Gate verdict.
 * Gate PASSES only when Reliability=A AND Security=A AND Maintainability=A.
 */
export interface RatingBundle {
  reliability: Rating;
  security: Rating;
  maintainability: Rating;
  qualityGate: "PASS" | "FAIL";
}

export function computeRatingBundle(findings: Finding[]): RatingBundle {
  const reliability = reliabilityRating(findings);
  const security = securityRating(findings);
  const maintainability = maintainabilityRating(findings);
  const qualityGate: "PASS" | "FAIL" =
    reliability === "A" && security === "A" && maintainability === "A" ? "PASS" : "FAIL";
  return { reliability, security, maintainability, qualityGate };
}
