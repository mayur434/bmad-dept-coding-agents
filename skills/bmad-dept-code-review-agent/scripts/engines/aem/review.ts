/**
 * aem — Code Review Engine (scaffold stub)
 * ==========================================================
 * Full code review authoring content lands in a later workstream. This stub
 * returns a single INFO finding so the dispatcher end-to-end wiring is
 * exercised.
 */
import type { ReviewInput, ReviewResult } from "../registry";
import type { Finding } from "../../../../shared/core/types";

const STACK = "aem";

export async function main(_input: ReviewInput): Promise<ReviewResult> {
  const findings: Finding[] = [
    {
      title: `Code review authoring stub — ${STACK}`,
      description:
        "Code review authoring stub — content agent fills this in a later workstream (per-stack style-guide rules, breaking-change detection, dependency-review heuristics, design-pattern checks, and role-adapted merge checklists).",
      stack: STACK,
      category: "Code Review",
      severity: "INFO",
      source: "scanner",
      recommendation:
        "Run again once the content workstream lands with SKILL.md instructions and stack-specific review resources.",
    },
  ];
  return {
    findings,
    writtenFiles: [],
    stats: { filesReviewed: 0, comments: 0, breakingChanges: 0, patternViolations: 0 },
  };
}
