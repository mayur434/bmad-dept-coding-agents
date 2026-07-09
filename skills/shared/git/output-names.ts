/**
 * DCA Shared — deterministic output naming
 * =========================================
 * The required report file name is `<agent>-<branch>-<timestamp>-agent-report.xlsx`.
 * These helpers produce that name identically everywhere.
 */

import { AgentName } from "../core/types";

/** Compact timestamp: YYYYMMDD_HHMMSS (local time). */
export function timestamp(d: Date = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/** Sanitize a branch (or any) name for use in a file name. */
export function sanitizeForFilename(name: string): string {
  return (name || "nobranch")
    .replace(/[\\/]+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "nobranch";
}

export interface ReportNameParts {
  agent: AgentName;
  branch: string;
  timestamp: string;
}

/**
 * Base file name (no extension): `<agent>-<branch>-<timestamp>-agent-report`.
 * Caller appends `.xlsx` / `.md`.
 */
export function reportBaseName(parts: ReportNameParts): string {
  const branch = sanitizeForFilename(parts.branch);
  return `${parts.agent}-${branch}-${parts.timestamp}-agent-report`;
}

export function reportXlsxName(parts: ReportNameParts): string {
  return `${reportBaseName(parts)}.xlsx`;
}

export function reportMarkdownName(parts: ReportNameParts): string {
  return `${reportBaseName(parts)}.md`;
}

/**
 * Standard working-branch name cut from production/shared:
 *   dca/<agent>-<stack>-<timestamp>
 */
export function standardBranchName(agent: AgentName, stack: string | undefined, ts: string): string {
  const s = sanitizeForFilename(stack ?? "all");
  return `dca/${agent}-${s}-${ts}`;
}
