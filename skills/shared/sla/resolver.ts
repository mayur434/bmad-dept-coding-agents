/**
 * DCA Shared — SLA resolver.
 * ===========================
 * Resolve the effective SLA duration for a (role, severity, agent) triple.
 *
 * Resolution order:
 *   1. per_agent_overrides[agent][severity]        (if agent + override exist)
 *   2. overrides[role].slas[severity]              (if role override exists)
 *   3. DEFAULT_SLAS[role][severity]
 *   4. DEFAULT_SLAS.generic[severity]              (safety net)
 *
 * Non-fatal — any missing/malformed override falls through to defaults.
 */

import type { Severity } from "../core/types";
import type { RoleCode } from "../role";
import { DEFAULT_SLAS } from "./defaults";
import { readSLAsFile } from "./persistence";
import type { SLADuration, SLAsFile } from "./schema";

export interface ResolveSLAOpts {
  role: RoleCode | "generic";
  severity: Severity;
  agent?: string;
  /** If provided, reads .bmad/sla.yaml overrides. */
  projectRoot?: string;
  /** Preloaded overrides — bypasses disk read (used by trackers to batch). */
  overrides?: SLAsFile | null;
}

export function resolveSLA(opts: ResolveSLAOpts): SLADuration {
  const sev = opts.severity;
  const role = opts.role;
  const agent = opts.agent;
  const file =
    opts.overrides !== undefined
      ? opts.overrides
      : opts.projectRoot
        ? readSLAsFile(opts.projectRoot)
        : null;

  // 1. per-agent override
  if (agent && file?.perAgentOverrides) {
    const m = file.perAgentOverrides[agent];
    if (m && m[sev]) return m[sev];
  }
  // 2. per-role override
  if (file?.overrides) {
    for (const o of file.overrides) {
      if (o.role !== role) continue;
      const v = o.slas[sev];
      if (v) return v;
      break;
    }
  }
  // 3. default for role
  const roleDefaults = DEFAULT_SLAS[role];
  if (roleDefaults && roleDefaults[sev]) return roleDefaults[sev];
  // 4. safety net
  return DEFAULT_SLAS.generic[sev];
}
