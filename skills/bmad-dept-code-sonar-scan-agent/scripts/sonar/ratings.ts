/**
 * Sonar Scan — Ratings & Quality Gate
 * =====================================
 * Pure function: Finding[] → { reliability, security, maintainability, qualityGate }
 *
 * Rating ladder (A–E) driven by worst finding severity in the category group:
 *   A = no findings or INFO only
 *   B = at least one LOW
 *   C = at least one MEDIUM
 *   D = at least one HIGH
 *   E = at least one CRITICAL
 *
 * Quality Gate: PASS iff all three ratings = "A"
 */

import { Finding, normalizeSeverity, RecommendationRow } from "../../../shared/core/types";

export interface SonarRatings {
  reliability: string;
  security: string;
  maintainability: string;
  qualityGate: "PASS" | "FAIL";
}

const RATING_ORDER = ["A", "B", "C", "D", "E"] as const;
type Rating = typeof RATING_ORDER[number];

const SEVERITY_TO_RATING: Record<string, Rating> = {
  CRITICAL: "E",
  HIGH: "D",
  MEDIUM: "C",
  LOW: "B",
  INFO: "A",
};

const RELIABILITY_CATEGORIES = new Set(["Bug"]);
const SECURITY_CATEGORIES = new Set(["Vulnerability", "Security Hotspot"]);
const MAINTAINABILITY_CATEGORIES = new Set(["Code Smell", "Duplication", "Complexity"]);

function worstRating(findings: Finding[], filter: Set<string>): Rating {
  let worst: Rating = "A";
  for (const f of findings) {
    if (!filter.has(f.category ?? "")) continue;
    const r = SEVERITY_TO_RATING[normalizeSeverity(f.severity)] ?? "A";
    if (RATING_ORDER.indexOf(r) > RATING_ORDER.indexOf(worst)) worst = r;
  }
  return worst;
}

export function computeRatings(findings: Finding[]): SonarRatings {
  const reliability = worstRating(findings, RELIABILITY_CATEGORIES);
  const security = worstRating(findings, SECURITY_CATEGORIES);
  const maintainability = worstRating(findings, MAINTAINABILITY_CATEGORIES);
  const qualityGate = reliability === "A" && security === "A" && maintainability === "A" ? "PASS" : "FAIL";
  return { reliability, security, maintainability, qualityGate };
}

/** Build Recommendations sheet rows explaining why each non-A rating occurred. */
export function buildRatingRecommendations(findings: Finding[], ratings: SonarRatings): RecommendationRow[] {
  const rows: RecommendationRow[] = [];

  function worstFinding(filter: Set<string>): Finding | undefined {
    const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
    return findings
      .filter((f) => filter.has(f.category ?? ""))
      .sort((a, b) => (order[normalizeSeverity(a.severity)] ?? 4) - (order[normalizeSeverity(b.severity)] ?? 4))[0];
  }

  if (ratings.reliability !== "A") {
    const worst = worstFinding(RELIABILITY_CATEGORIES);
    rows.push({
      area: `Quality Gate — Reliability (${ratings.reliability})`,
      recommendation: `Fix ${worst?.severity ?? ""}  Bug finding(s) to improve Reliability rating to A.`,
      expectedImpact: "Eliminates known runtime defects.",
      effort: "M",
      priority: ratings.reliability === "E" || ratings.reliability === "D" ? "P0" : "P1",
      details: worst
        ? `Worst finding: "${worst.title}" at ${worst.codeRef ?? worst.file ?? "unknown"} (${worst.severity}). Rule: ${worst.ruleId ?? "—"}. Fix: ${worst.recommendation ?? "see Summary sheet."}`
        : "See Bug rows on Summary sheet.",
    });
  }

  if (ratings.security !== "A") {
    const worst = worstFinding(SECURITY_CATEGORIES);
    rows.push({
      area: `Quality Gate — Security (${ratings.security})`,
      recommendation: `Resolve ${worst?.severity ?? ""} Vulnerability/Security Hotspot finding(s) to improve Security rating to A.`,
      expectedImpact: "Closes exploitable security weaknesses.",
      effort: "M",
      priority: ratings.security === "E" || ratings.security === "D" ? "P0" : "P1",
      details: worst
        ? `Worst finding: "${worst.title}" at ${worst.codeRef ?? worst.file ?? "unknown"} (${worst.severity}). Rule: ${worst.ruleId ?? "—"}. Fix: ${worst.recommendation ?? "see Vulnerabilities sheet."}`
        : "See Vulnerability rows on Vulnerabilities sheet.",
    });
  }

  if (ratings.maintainability !== "A") {
    const worst = worstFinding(MAINTAINABILITY_CATEGORIES);
    rows.push({
      area: `Quality Gate — Maintainability (${ratings.maintainability})`,
      recommendation: `Address ${worst?.severity ?? ""} Code Smell/Duplication/Complexity finding(s) to improve Maintainability rating to A.`,
      expectedImpact: "Reduces technical debt and onboarding friction.",
      effort: "L",
      priority: ratings.maintainability === "E" || ratings.maintainability === "D" ? "P1" : "P2",
      details: worst
        ? `Worst finding: "${worst.title}" at ${worst.codeRef ?? worst.file ?? "unknown"} (${worst.severity}). Rule: ${worst.ruleId ?? "—"}.`
        : "See Code Smell / Duplication / Complexity rows on Summary sheet.",
    });
  }

  return rows;
}
