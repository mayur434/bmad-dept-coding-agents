/**
 * DCA Shared — decisions schema (findings-gate foundation).
 * ==========================================================
 * A "decision" is a signed disposition on a finding: accepted, deferred,
 * wontfix, or fixed. Persisted to `<projectRoot>/.bmad/decisions.yaml` and
 * consumed by the findings-gate matcher to suppress previously-triaged
 * findings in downstream agent runs.
 *
 * Zero external dependencies — types only.
 */

export type DecisionStatus = "accepted" | "deferred" | "wontfix" | "fixed";

export const DECISION_STATUSES: readonly DecisionStatus[] = [
  "accepted",
  "deferred",
  "wontfix",
  "fixed",
];

export interface Decision {
  /** Stable identifier — see `decisionIdFor` for deterministic derivation. */
  id: string;
  /** Rule identifier the decision applies to (e.g. `COMMERCE-SEC-001`). */
  ruleId: string;
  /**
   * Project-root-relative file path. Optional at the matcher level
   * (rule-wide decisions), required at the persistence level for readability
   * — decisions.yaml entries always carry a file. Omitted only at construction
   * time for rare rule-wide overrides.
   */
  file: string;
  /** 1-based line number. When absent, the decision is file-wide. */
  line?: number;
  status: DecisionStatus;
  /** Required — auditor needs to know WHY. */
  rationale: string;
  /** User identity — free text (email, GitHub handle, "team-lead"). */
  signedBy: string;
  /** ISO-8601 UTC — when the decision was signed. */
  signedAt: string;
  /** ISO-8601 UTC — after this the decision no longer suppresses. */
  expiresAt?: string;
  /** Free-form labels — e.g. ['sox-approved', 'q4-release']. */
  tags?: string[];
}

export interface DecisionsFile {
  version: 1;
  decisions: Decision[];
  /** ISO-8601 UTC. */
  lastModified: string;
}

export function isValidDecisionStatus(s: string): s is DecisionStatus {
  return (DECISION_STATUSES as readonly string[]).includes(s);
}
