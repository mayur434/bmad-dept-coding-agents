/**
 * DCA Shared — Confidence
 * ========================
 * Per-agent confidence today is ad-hoc: audit uses a 0..1 float,
 * sonar-scan uses a 0..1 float, generation uses a label. This module gives
 * everyone a single decision-tree helper that yields `'high' | 'medium' | 'low'`,
 * plus a `Finding`-aware helper that fills in a default when missing.
 *
 * Decision tree (documented in ./README.md):
 *
 *   detection method:  ast  →  ≥ 2 refs → high; else medium
 *                      regex→ ≥ 3 refs → high; ≥ 1 → medium; else low
 *                      llm  →  never higher than medium
 *                      heuristic → never higher than low
 *
 *   ruleMaturity:  experimental / preview → cap at medium
 *   isCrossFile:   ast + cross-file       → keep high, else demote high→medium
 */

import type { Finding } from "../core/types";

export type Confidence = "high" | "medium" | "low";

export interface ConfidenceInputs {
  detectionMethod: "ast" | "regex" | "llm-inference" | "heuristic";
  supportingRefs: number;
  ruleMaturity: "stable" | "experimental" | "preview";
  isCrossFile: boolean;
}

const RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

function min(a: Confidence, b: Confidence): Confidence {
  return RANK[a] <= RANK[b] ? a : b;
}

export function computeConfidence(inputs: ConfidenceInputs): Confidence {
  const refs = Math.max(0, Number(inputs?.supportingRefs) || 0);
  let base: Confidence;

  switch (inputs?.detectionMethod) {
    case "ast":
      base = refs >= 2 ? "high" : "medium";
      break;
    case "regex":
      base = refs >= 3 ? "high" : refs >= 1 ? "medium" : "low";
      break;
    case "llm-inference":
      // LLM inferences never exceed medium.
      base = refs >= 2 ? "medium" : "low";
      break;
    case "heuristic":
      base = "low";
      break;
    default:
      // Unknown method — safest is medium.
      base = "medium";
  }

  // Cross-file evidence keeps AST-level high; other methods stay put.
  if (base === "high" && inputs?.detectionMethod !== "ast" && !inputs?.isCrossFile) {
    base = "medium";
  }

  // Non-stable rules never exceed medium.
  if (inputs?.ruleMaturity === "experimental" || inputs?.ruleMaturity === "preview") {
    base = min(base, "medium");
  }

  return base;
}

/**
 * If the finding already carries a confidence value, keep it.
 * Otherwise compute one from `inputs`, or default 'medium' when inputs
 * are missing. Never mutates the input; returns a new object.
 */
export function enforceConfidence(finding: Finding, inputs?: ConfidenceInputs): Finding {
  if (finding == null) return finding;
  if (
    finding.confidence !== undefined &&
    finding.confidence !== null &&
    finding.confidence !== ""
  ) {
    return finding;
  }
  const conf: Confidence = inputs ? computeConfidence(inputs) : "medium";
  return { ...finding, confidence: conf };
}

/**
 * Map a 0..1 numeric confidence (audit-style) → label. Handy adapter for
 * engines that still emit floats.
 */
export function labelFromNumericConfidence(v: number): Confidence {
  const n = Number(v);
  if (!Number.isFinite(n)) return "medium";
  if (n >= 0.75) return "high";
  if (n >= 0.5) return "medium";
  return "low";
}
