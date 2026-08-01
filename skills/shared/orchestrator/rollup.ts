/**
 * DCA Shared — Chain roll-up (Markdown).
 * =======================================
 * Emits `<projectRoot>/dca-chain-reports/dca-chain-<branch>-<ts>-rollup.md`
 * summarizing all stage outcomes plus cross-agent insights computed by
 * intersecting the per-stage findings caches. Also appends ONE CHANGE-LOG
 * entry summarizing the chain run.
 *
 * Zero external deps. Failures inside this module are non-fatal to the
 * caller — runner catches and logs.
 */

import * as fs from "fs";
import * as path from "path";

import { readLatestRun } from "../findings/cache";
import { writeChangeLogEntry } from "../git/changelog";
import type { Finding } from "../core/types";
import { normalizeSeverity } from "../core/types";
import type { ChainResult, StageResult, StageId } from "./runner";

const CACHE_AGENT: Record<StageId, "audit" | "sonar-scan" | "test-coverage" | "impact-analysis"> = {
  audit: "audit",
  "sonar-scan": "sonar-scan",
  "test-coverage": "test-coverage",
  "impact-analysis": "impact-analysis",
};

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = (s - m * 60).toFixed(1);
  return `${m}m${rem}s`;
}

function branchSlug(b: string): string {
  return b.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function tsForFilename(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

interface StageSummary {
  findings: Finding[];
  criticalFiles: Set<string>;
  bySev: Record<string, number>;
}

function summarize(findings: Finding[]): StageSummary {
  const bySev: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  const criticalFiles = new Set<string>();
  for (const f of findings) {
    const sev = normalizeSeverity(f.severity);
    bySev[sev] = (bySev[sev] ?? 0) + 1;
    if (sev === "CRITICAL" && f.file) criticalFiles.add(f.file);
  }
  return { findings, criticalFiles, bySev };
}

/** Very light coverage extractor — looks for a percent in the finding's description/title. */
function coverageFilesUnder(pct: number, findings: Finding[]): Set<string> {
  const under = new Set<string>();
  for (const f of findings) {
    if (!f.file) continue;
    // Look at title + description + code for something like "42%" or "42.5%".
    const hay = `${f.title ?? ""} ${f.description ?? ""} ${f.code ?? ""}`;
    const m = hay.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
    if (!m) continue;
    const covered = parseFloat(m[1]);
    if (!Number.isNaN(covered) && covered < pct) under.add(f.file);
  }
  return under;
}

/** Sonar quality-gate heuristic — look for a PASS/FAIL string in any finding. */
function detectQualityGate(findings: Finding[]): "PASS" | "FAIL" | "UNKNOWN" {
  for (const f of findings) {
    const hay = `${f.title ?? ""} ${f.description ?? ""}`.toUpperCase();
    if (hay.includes("QUALITY GATE") || hay.includes("QUALITYGATE") || hay.includes("QG:")) {
      if (hay.includes("FAIL")) return "FAIL";
      if (hay.includes("PASS")) return "PASS";
    }
  }
  return "UNKNOWN";
}

function findingsByFile(fs2: Finding[]): Map<string, Finding[]> {
  const map = new Map<string, Finding[]>();
  for (const f of fs2) {
    if (!f.file) continue;
    const arr = map.get(f.file) ?? [];
    arr.push(f);
    map.set(f.file, arr);
  }
  return map;
}

interface Insights {
  releaseBlockers: Array<{ file: string; criticals: number; underCov: boolean; impacted: boolean; impactRefs: string[] }>;
  qualityGate: "PASS" | "FAIL" | "UNKNOWN";
}

function buildInsights(projectRoot: string, stages: StageResult[]): Insights {
  const insights: Insights = { releaseBlockers: [], qualityGate: "UNKNOWN" };
  const has = (s: StageId) => stages.some((r) => r.stage === s && r.status === "ok");

  const auditFindings = has("audit") ? (readLatestRun(projectRoot, "audit")?.findings ?? []) : [];
  const sonarFindings = has("sonar-scan") ? (readLatestRun(projectRoot, "sonar-scan")?.findings ?? []) : [];
  const coverageFindings = has("test-coverage") ? (readLatestRun(projectRoot, "test-coverage")?.findings ?? []) : [];
  const impactFindings = has("impact-analysis") ? (readLatestRun(projectRoot, "impact-analysis")?.findings ?? []) : [];

  const auditSummary = summarize(auditFindings);
  const impactFilesToFindings = findingsByFile(impactFindings);
  const impactFiles = new Set(impactFilesToFindings.keys());
  const coverageUnder50 = coverageFilesUnder(50, coverageFindings);
  const auditByFile = findingsByFile(auditFindings);

  const candidates = new Map<string, { criticals: number; underCov: boolean; impacted: boolean; impactRefs: string[] }>();
  for (const file of auditSummary.criticalFiles) {
    const entry = candidates.get(file) ?? { criticals: 0, underCov: false, impacted: false, impactRefs: [] };
    entry.criticals = (auditByFile.get(file) ?? []).filter((f) => normalizeSeverity(f.severity) === "CRITICAL").length;
    if (coverageUnder50.has(file)) entry.underCov = true;
    if (impactFiles.has(file)) {
      entry.impacted = true;
      const refs = (impactFilesToFindings.get(file) ?? [])
        .map((f) => f.inputRef?.id)
        .filter((v): v is string => !!v);
      entry.impactRefs = Array.from(new Set(refs)).slice(0, 5);
    }
    candidates.set(file, entry);
  }
  const scored = Array.from(candidates.entries()).map(([file, e]) => ({
    file,
    ...e,
    score: e.criticals + (e.underCov ? 2 : 0) + (e.impacted ? 2 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  insights.releaseBlockers = scored.slice(0, 10);
  insights.qualityGate = detectQualityGate(sonarFindings);
  return insights;
}

export function writeRollup(result: ChainResult, projectRoot: string): string {
  const dir = path.join(projectRoot, "dca-chain-reports");
  fs.mkdirSync(dir, { recursive: true });
  const filename = `dca-chain-${branchSlug(result.branch)}-${tsForFilename(result.timestamp)}-rollup.md`;
  const outPath = path.join(dir, filename);

  const totalMs = result.stages.reduce((a, s) => a + s.durationMs, 0);
  const okCount = result.stages.filter((s) => s.status === "ok").length;
  const failedCount = result.stages.filter((s) => s.status === "failed").length;
  const skippedCount = result.stages.filter((s) => s.status === "skipped").length;

  const insights = buildInsights(projectRoot, result.stages);

  const lines: string[] = [];
  lines.push(`# DCA Chain Run — ${result.runId}`);
  lines.push("");
  lines.push(`- **Timestamp**: ${result.timestamp}`);
  lines.push(`- **Branch**: ${result.branch}`);
  lines.push(`- **Role**: ${result.role}`);
  lines.push(`- **Total duration**: ${fmtDuration(totalMs)}`);
  lines.push(`- **Stages run**: ${okCount} ok / ${failedCount} failed / ${skippedCount} skipped`);
  lines.push("");
  lines.push("## Stage results");
  lines.push("");
  lines.push("| Stage | Status | Duration | Findings | Report |");
  lines.push("|---|---|---|---|---|");
  for (const s of result.stages) {
    const findings = s.findingsCount !== undefined ? `${s.findingsCount}` : "—";
    const report = s.reportPath ? path.basename(s.reportPath) : "—";
    lines.push(`| ${s.stage} | ${s.status} | ${fmtDuration(s.durationMs)} | ${findings} | ${report} |`);
  }
  lines.push("");
  lines.push("## Cross-agent insights");
  lines.push("");
  lines.push(`- **Quality gate (sonar-scan)**: ${insights.qualityGate}`);
  if (insights.releaseBlockers.length === 0) {
    lines.push(`- **Release blockers**: none identified (files with CRITICAL findings + low coverage + impacted).`);
  } else {
    lines.push(`- **Release blockers** (top ${insights.releaseBlockers.length}):`);
    for (const rb of insights.releaseBlockers) {
      const bits: string[] = [`${rb.criticals} CRITICAL`];
      if (rb.underCov) bits.push("<50% covered");
      if (rb.impacted) {
        const refs = rb.impactRefs.length ? ` [${rb.impactRefs.join(", ")}]` : "";
        bits.push(`impacted${refs}`);
      }
      lines.push(`  - \`${rb.file}\` — ${bits.join(" · ")}`);
    }
  }
  lines.push("");

  const failures = result.stages.filter((s) => s.status === "failed");
  if (failures.length > 0) {
    lines.push("## Failures");
    lines.push("");
    for (const f of failures) {
      lines.push(`### ${f.stage}`);
      lines.push("");
      lines.push(`Exit code: ${f.exitCode}. stderr tail:`);
      lines.push("");
      lines.push("```");
      lines.push(f.stderrTail || "(empty)");
      lines.push("```");
      lines.push("");
      lines.push(`Fix and rerun: \`bash .claude/skills/shared/bootstrap.sh ${f.stage}\` then retry the chain.`);
      lines.push("");
    }
  }

  lines.push("## Individual reports");
  lines.push("");
  for (const s of result.stages) {
    lines.push(`- **${s.stage}**: ${s.reportPath ?? "(none)"}`);
  }
  lines.push("");

  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  // Append a single CHANGE-LOG entry — non-fatal on failure.
  try {
    const clPath = path.join(projectRoot, "CHANGE-LOG.md");
    writeChangeLogEntry(clPath, {
      agent: "audit", // orchestrator lives under audit-agent scope
      stack: "orchestrator",
      projectName: path.basename(projectRoot),
      workingBranch: result.branch,
      timestamp: result.timestamp,
      summary: `Chain run ${result.runId} — ${okCount}/${result.stages.length} stages ok, ${failedCount} failed, ${skippedCount} skipped.`,
      reportFile: path.relative(projectRoot, outPath),
      details: result.stages.map(
        (s) => `${s.stage}: ${s.status}${s.findingsCount !== undefined ? ` — ${s.findingsCount} finding(s)` : ""}`,
      ),
    });
  } catch (err) {
    process.stderr.write(
      `[dca-chain-all] WARN: CHANGE-LOG append failed: ${(err as Error).message}\n`,
    );
  }

  return outPath;
}
