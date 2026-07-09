/**
 * DCA Shared — Standardized Markdown Report
 * ==========================================
 * A Markdown twin of the Excel Summary — same data, git-diffable. Written next to
 * the .xlsx so findings are reviewable in a PR without opening a spreadsheet.
 */

import {
  Finding,
  RunMeta,
  SEVERITIES,
  computeCounts,
  groupByCategory,
  normalizeFinding,
  normalizeSeverity,
  sortFindings,
} from "../core/types";

export function renderMarkdownReport(findings: Finding[], meta: RunMeta): string {
  const sorted = sortFindings(findings);
  const counts = computeCounts(sorted);
  const lines: string[] = [];

  lines.push(`# ${labelForAgent(meta.agent)} Report — ${meta.projectName}`);
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Agent | \`${meta.agent}\` |`);
  lines.push(`| Engine / Stack | ${meta.stack ?? meta.engine ?? "—"} |`);
  lines.push(`| Working Branch | ${meta.workingBranch ?? "—"} |`);
  lines.push(`| Source Branch | ${meta.sourceBranch ?? "—"} |`);
  lines.push(`| Timestamp | ${meta.timestamp ?? "—"} |`);
  lines.push(`| Total Findings | ${counts.total} |`);
  lines.push("");

  lines.push(`## Severity Breakdown`);
  lines.push("");
  lines.push(`| Severity | Count | % |`);
  lines.push(`|---|---|---|`);
  for (const sev of SEVERITIES) {
    const n = counts.bySeverity[sev];
    const pct = counts.total > 0 ? ((n / counts.total) * 100).toFixed(1) + "%" : "0%";
    lines.push(`| ${sev} | ${n} | ${pct} |`);
  }
  lines.push("");

  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| ID | Title | Stack | Category | Code Reference | Severity | Recommendation / Fix | Impact | Status |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|`);
  sorted.forEach((raw, i) => {
    const f = normalizeFinding(raw, i);
    lines.push(
      `| ${f.id} | ${mdCell(f.title)} | ${f.stack ?? meta.stack ?? "—"} | ${mdCell(f.category ?? "—")} | ${mdCell(f.codeRef)} | ${f.severity} | ${mdCell(f.recommendation)} | ${mdCell(f.impact)} | ${f.status} |`,
    );
  });
  lines.push("");

  const grouped = groupByCategory(sorted);
  lines.push(`## By Category`);
  lines.push("");
  lines.push(`| Category | Total | ${SEVERITIES.join(" | ")} |`);
  lines.push(`|---|---|${SEVERITIES.map(() => "---").join("|")}|`);
  for (const [cat, items] of Object.entries(grouped)) {
    const cells = SEVERITIES.map((sev) => items.filter((i) => normalizeSeverity(i.severity) === sev).length);
    lines.push(`| ${mdCell(cat)} | ${items.length} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  return lines.join("\n");
}

function mdCell(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function labelForAgent(agent: string): string {
  switch (agent) {
    case "audit": return "Code Audit";
    case "generation": return "Code Generation";
    case "impact": return "Impact Analysis";
    case "test-coverage": return "Test Coverage";
    default: return agent;
  }
}
