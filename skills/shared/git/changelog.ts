/**
 * DCA Shared — CHANGE-LOG.md writer
 * ==================================
 * Appends a dated, structured entry per agent run. Most-recent-first, under a
 * stable header. Creates the file if absent. Keep-a-Changelog flavored.
 */

import * as fs from "fs";
import * as path from "path";
import { AgentName, FindingCounts, SEVERITIES } from "../core/types";

export interface ChangeLogEntry {
  agent: AgentName;
  stack?: string;
  engine?: string;
  projectName: string;
  workingBranch?: string;
  sourceBranch?: string;
  timestamp: string;
  /** One-line summary of what the run did. */
  summary: string;
  counts?: FindingCounts;
  /** Files created or modified by the run. */
  filesChanged?: string[];
  /** Bulleted detail lines. */
  details?: string[];
  /** Report file the run produced (name or path). */
  reportFile?: string;
}

const HEADER = [
  "# CHANGE-LOG",
  "",
  "> Auto-maintained by the BMAD DCA agents. Each run appends a dated entry (most recent first).",
  "",
].join("\n");

const MARKER = "<!-- dca:entries -->";

export function renderEntry(e: ChangeLogEntry): string {
  const lines: string[] = [];
  lines.push(`## ${e.timestamp} — \`${e.agent}\` — ${e.stack ?? e.engine ?? "—"} — ${e.projectName}`);
  lines.push("");
  const branchBits: string[] = [];
  if (e.workingBranch) branchBits.push(`branch \`${e.workingBranch}\``);
  if (e.sourceBranch) branchBits.push(`from \`${e.sourceBranch}\``);
  if (branchBits.length) lines.push(`- **Branch:** ${branchBits.join(" ")}`);
  lines.push(`- **Summary:** ${e.summary}`);
  if (e.counts) {
    const parts = SEVERITIES.map((s) => `${s} ${e.counts!.bySeverity[s]}`).join(", ");
    lines.push(`- **Findings:** ${e.counts.total} total (${parts})`);
  }
  if (e.reportFile) lines.push(`- **Report:** \`${e.reportFile}\``);
  if (e.filesChanged && e.filesChanged.length) {
    lines.push(`- **Files changed:**`);
    for (const f of e.filesChanged) lines.push(`  - \`${f}\``);
  }
  if (e.details && e.details.length) {
    lines.push(`- **Details:**`);
    for (const d of e.details) lines.push(`  - ${d}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Append an entry to CHANGE-LOG.md (created if missing). New entries are inserted
 * directly after the entries marker so the newest is first. Returns the path written.
 */
export function writeChangeLogEntry(changelogPath: string, entry: ChangeLogEntry): string {
  const resolved = path.resolve(changelogPath);
  let content: string;
  if (fs.existsSync(resolved)) {
    content = fs.readFileSync(resolved, "utf8");
    if (!content.includes(MARKER)) {
      // Older/foreign file: keep it, splice a marker after the first blank line.
      content = ensureMarker(content);
    }
  } else {
    content = `${HEADER}${MARKER}\n\n`;
  }
  const block = renderEntry(entry);
  const idx = content.indexOf(MARKER) + MARKER.length;
  const next = content.slice(0, idx) + "\n\n" + block + content.slice(idx).replace(/^\n+/, "\n");
  fs.writeFileSync(resolved, next, "utf8");
  return resolved;
}

function ensureMarker(content: string): string {
  const nl = content.indexOf("\n\n");
  if (nl === -1) return `${content}\n\n${MARKER}\n`;
  return content.slice(0, nl + 2) + MARKER + "\n" + content.slice(nl + 2);
}
