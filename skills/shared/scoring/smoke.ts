/**
 * Scoring module smoke test.
 * Usage: npx ts-node skills/shared/scoring/smoke.ts
 */

import type { Finding } from "../core/types";
import {
  bandFromScore,
  scoreFromBand,
  mergeSeverity,
  severityCounts,
  worstSeverity,
  computeConfidence,
  enforceConfidence,
  labelFromNumericConfidence,
  reliabilityRating,
  securityRating,
  maintainabilityRating,
  computeRatingBundle,
} from "./index";

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    process.exit(1);
  }
}

function main(): void {
  // --- 1. band <-> score roundtrip
  for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const) {
    const s = scoreFromBand(sev);
    const back = bandFromScore(s);
    assert(back === sev, `roundtrip ${sev} -> ${s} -> ${back}`);
  }
  assert(bandFromScore(-100) === "INFO", "clamped low");
  assert(bandFromScore(1000) === "CRITICAL", "clamped high");
  assert(bandFromScore(NaN) === "INFO", "NaN safe");

  // --- 2. mergeSeverity
  assert(mergeSeverity("LOW", "HIGH") === "HIGH", "merge low/high");
  assert(mergeSeverity("CRITICAL", "MEDIUM") === "CRITICAL", "merge crit/med");
  assert(mergeSeverity("INFO", "INFO") === "INFO", "merge info/info");

  // --- 3. severityCounts / worstSeverity
  const findings: Finding[] = [
    { title: "a", severity: "CRITICAL", category: "Bug" },
    { title: "b", severity: "HIGH", category: "Vulnerability" },
    { title: "c", severity: "MEDIUM", category: "Code Smell" },
    { title: "d", severity: "LOW", category: "Code Smell" },
    { title: "e", severity: "INFO", category: "Duplication" },
    { title: "f", severity: "HIGH", category: "Security Hotspot" },
  ];
  const counts = severityCounts(findings);
  assert(counts.CRITICAL === 1 && counts.HIGH === 2 && counts.MEDIUM === 1, "counts");
  assert(worstSeverity(findings) === "CRITICAL", "worst = CRITICAL");
  assert(worstSeverity([]) === "INFO", "worst of empty = INFO");

  // --- 4. confidence decision tree
  assert(
    computeConfidence({ detectionMethod: "ast", supportingRefs: 3, ruleMaturity: "stable", isCrossFile: true }) === "high",
    "ast+refs+cross = high",
  );
  assert(
    computeConfidence({ detectionMethod: "ast", supportingRefs: 1, ruleMaturity: "stable", isCrossFile: false }) === "medium",
    "ast solo = medium",
  );
  assert(
    computeConfidence({ detectionMethod: "regex", supportingRefs: 3, ruleMaturity: "stable", isCrossFile: true }) === "high",
    "regex 3 refs cross = high",
  );
  assert(
    computeConfidence({ detectionMethod: "regex", supportingRefs: 1, ruleMaturity: "stable", isCrossFile: false }) === "medium",
    "regex 1 ref = medium",
  );
  assert(
    computeConfidence({ detectionMethod: "regex", supportingRefs: 0, ruleMaturity: "stable", isCrossFile: false }) === "low",
    "regex 0 refs = low",
  );
  assert(
    computeConfidence({ detectionMethod: "llm-inference", supportingRefs: 5, ruleMaturity: "stable", isCrossFile: true }) === "medium",
    "llm capped at medium",
  );
  assert(
    computeConfidence({ detectionMethod: "heuristic", supportingRefs: 100, ruleMaturity: "stable", isCrossFile: true }) === "low",
    "heuristic always low",
  );
  assert(
    computeConfidence({ detectionMethod: "ast", supportingRefs: 5, ruleMaturity: "experimental", isCrossFile: true }) === "medium",
    "experimental caps at medium",
  );

  // --- 5. enforceConfidence
  const f1: Finding = { title: "t", severity: "MEDIUM" };
  const enforced = enforceConfidence(f1);
  assert(enforced.confidence === "medium", "default enforce = medium");
  const preserved = enforceConfidence({ title: "t", severity: "MEDIUM", confidence: 0.9 });
  assert(preserved.confidence === 0.9, "preserves existing");
  const fromInputs = enforceConfidence(f1, {
    detectionMethod: "ast",
    supportingRefs: 5,
    ruleMaturity: "stable",
    isCrossFile: true,
  });
  assert(fromInputs.confidence === "high", "computed from inputs = high");
  // Non-mutation
  assert(f1.confidence === undefined, "original not mutated");

  // --- 6. numeric label
  assert(labelFromNumericConfidence(0.9) === "high", "0.9 = high");
  assert(labelFromNumericConfidence(0.6) === "medium", "0.6 = medium");
  assert(labelFromNumericConfidence(0.2) === "low", "0.2 = low");
  assert(labelFromNumericConfidence(NaN) === "medium", "NaN = medium");

  // --- 7. ratings
  assert(reliabilityRating(findings) === "E", "reliability = E (has CRITICAL bug)");
  assert(securityRating(findings) === "D", "security = D (worst HIGH)");
  assert(maintainabilityRating(findings) === "C", "maintainability = C (worst MEDIUM)");

  const bundle = computeRatingBundle(findings);
  assert(bundle.qualityGate === "FAIL", "gate = FAIL");
  const clean: Finding[] = [{ title: "ok", severity: "INFO", category: "Bug" }];
  const cleanBundle = computeRatingBundle(clean);
  assert(cleanBundle.reliability === "A", "clean reliability = A");
  assert(cleanBundle.qualityGate === "PASS", "clean gate = PASS");

  // --- 8. non-fatal: empty / malformed
  const emptyBundle = computeRatingBundle([]);
  assert(emptyBundle.qualityGate === "PASS", "empty gate = PASS");

  process.stdout.write("OK\n");
}

main();
