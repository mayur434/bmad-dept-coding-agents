/**
 * DCA Shared — SLA schema.
 * =========================
 * Types for Service Level Agreements: per-role × per-severity durations that
 * determine when a finding is OK, DUE-SOON, or OVERDUE.
 *
 * Zero external dependencies — types only.
 */

import type { RoleCode } from "../role";
import type { Severity } from "../core/types";

/**
 * A parsed SLA duration. `hours` is what math operates on; `humanized` is the
 * original input preserved for display in reports.
 */
export interface SLADuration {
  hours: number;
  humanized: string;
}

/** A full per-severity SLA matrix for one role or agent. */
export type SLAMatrix = Record<Severity, SLADuration>;

/**
 * A role-scoped override. `slas` is partial — missing entries inherit from
 * `DEFAULT_SLAS[role]`.
 */
export interface RoleSLAProfile {
  role: RoleCode | "generic";
  slas: Partial<SLAMatrix>;
  description?: string;
}

/** On-disk shape of `<projectRoot>/.bmad/sla.yaml`. */
export interface SLAsFile {
  version: 1;
  overrides?: RoleSLAProfile[];
  /** agent-code -> full matrix. */
  perAgentOverrides?: Record<string, SLAMatrix>;
}

export type SLAStatus = "ok" | "due-soon" | "overdue" | "unknown";

/** Per-finding SLA snapshot — one row of the SLA Status sheet. */
export interface FindingSLA {
  finding: { ruleId: string; file: string; line?: number; severity: Severity };
  /** ISO-8601 UTC — from findings cache history (oldest run containing this finding). */
  firstSeenAt: string;
  ageHours: number;
  slaHours: number;
  /** ISO-8601 UTC — firstSeenAt + slaHours. */
  dueAt: string;
  status: SLAStatus;
  role: RoleCode | "generic";
  agent: string;
}
