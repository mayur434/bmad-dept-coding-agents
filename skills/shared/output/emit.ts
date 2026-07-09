/**
 * DCA Shared — Standard Output Orchestrator
 * ==========================================
 * The single entry point every agent calls to emit the three required outputs:
 *   A. CHANGE-LOG.md          (appended)
 *   B. <agent>-<branch>-<timestamp>-agent-report.xlsx  (+ .md twin)
 *   C. (optionally) a standard working branch cut from production/shared
 *
 * Usage from an agent:
 *
 *   const res = await emitStandardOutputs({
 *     agent: "audit",
 *     meta: { agent: "audit", engine: "aemcs", stack: "AEMaaCS",
 *             projectName, projectRoot },
 *     findings,
 *     outputDir,
 *   });
 *   console.log(res.xlsxPath);
 */

import * as fs from "fs";
import * as path from "path";
import { AgentName, Finding, RecommendationRow, RunMeta, computeCounts } from "../core/types";
import { StandardExcelReport } from "../report/standard-report";
import { renderMarkdownReport } from "../report/markdown-report";
import {
  reportXlsxName, reportMarkdownName, timestamp as makeTimestamp,
  standardBranchName, createStandardBranch, currentBranch, resolveSourceBranch,
  writeChangeLogEntry, ChangeLogEntry,
} from "../git";

export interface EmitOptions {
  agent: AgentName;
  meta: RunMeta;
  findings: Finding[];
  /** Directory to write the .xlsx / .md into. Created if missing. */
  outputDir: string;
  /** Also write the markdown twin (default true). */
  writeMarkdown?: boolean;
  /** Append a CHANGE-LOG.md entry (default true). */
  writeChangelog?: boolean;
  /** CHANGE-LOG.md location (default <projectRoot>/CHANGE-LOG.md). */
  changelogPath?: string;
  /** One-line summary for the CHANGE-LOG entry. */
  changelogSummary?: string;
  /** Extra bullet detail lines for the CHANGE-LOG entry. */
  changelogDetails?: string[];
  /** Files created/modified, for the CHANGE-LOG entry. */
  filesChanged?: string[];
  /** Recommendations sheet rows. */
  recommendations?: RecommendationRow[];
  /** Workbook title override. */
  reportTitle?: string;
}

export interface EmitResult {
  fileName: string;
  xlsxPath: string;
  mdPath?: string;
  changelogPath?: string;
  meta: RunMeta;
}

export async function emitStandardOutputs(opts: EmitOptions): Promise<EmitResult> {
  const projectRoot = opts.meta.projectRoot;
  const ts = opts.meta.timestamp ?? makeTimestamp();
  const workingBranch =
    opts.meta.workingBranch ?? currentBranch(projectRoot) ?? "nobranch";

  const meta: RunMeta = { ...opts.meta, timestamp: ts, workingBranch };

  fs.mkdirSync(opts.outputDir, { recursive: true });

  const fileName = reportXlsxName({ agent: opts.agent, branch: workingBranch, timestamp: ts });
  const xlsxPath = path.join(opts.outputDir, fileName);

  const report = new StandardExcelReport(opts.findings, meta, {
    recommendations: opts.recommendations,
    title: opts.reportTitle,
  });
  await report.generate(xlsxPath);

  let mdPath: string | undefined;
  if (opts.writeMarkdown !== false) {
    mdPath = path.join(opts.outputDir, reportMarkdownName({ agent: opts.agent, branch: workingBranch, timestamp: ts }));
    fs.writeFileSync(mdPath, renderMarkdownReport(opts.findings, meta), "utf8");
  }

  let changelogPath: string | undefined;
  if (opts.writeChangelog !== false) {
    const clPath = opts.changelogPath ?? path.join(projectRoot, "CHANGE-LOG.md");
    const counts = computeCounts(opts.findings);
    const entry: ChangeLogEntry = {
      agent: opts.agent,
      stack: meta.stack,
      engine: meta.engine,
      projectName: meta.projectName,
      workingBranch,
      sourceBranch: meta.sourceBranch,
      timestamp: ts,
      summary: opts.changelogSummary ?? defaultSummary(opts.agent, counts.total),
      counts,
      filesChanged: opts.filesChanged,
      details: opts.changelogDetails,
      reportFile: fileName,
    };
    changelogPath = writeChangeLogEntry(clPath, entry);
  }

  return { fileName, xlsxPath, mdPath, changelogPath, meta };
}

export interface EnsureBranchOptions {
  agent: AgentName;
  stack?: string;
  projectRoot: string;
  /** Candidate production/shared source branches, tried in order. */
  sourceCandidates?: string[];
  timestamp?: string;
  checkout?: boolean;
}

export interface EnsureBranchResult {
  ok: boolean;
  branch: string;
  sourceBranch: string | null;
  created: boolean;
  alreadyExisted: boolean;
  error?: string;
}

/**
 * Create (or reuse) the standard working branch cut from the production/shared
 * branch. Opt-in — call before the agent writes changes. Non-fatal on failure.
 */
export function ensureStandardBranch(opts: EnsureBranchOptions): EnsureBranchResult {
  const ts = opts.timestamp ?? makeTimestamp();
  const branch = standardBranchName(opts.agent, opts.stack, ts);
  const candidates = opts.sourceCandidates ?? ["production", "main", "master", "develop"];
  const source = resolveSourceBranch(opts.projectRoot, candidates);
  if (!source) {
    return { ok: false, branch, sourceBranch: null, created: false, alreadyExisted: false, error: `no source branch among: ${candidates.join(", ")}` };
  }
  const r = createStandardBranch({
    cwd: opts.projectRoot,
    newBranch: branch,
    sourceBranch: source,
    checkout: opts.checkout ?? true,
  });
  return {
    ok: r.ok,
    branch,
    sourceBranch: source,
    created: r.created,
    alreadyExisted: r.alreadyExisted,
    error: r.error,
  };
}

function defaultSummary(agent: AgentName, total: number): string {
  switch (agent) {
    case "audit": return `Audit produced ${total} finding(s).`;
    case "impact": return `Impact analysis produced ${total} impacted item(s).`;
    case "test-coverage": return `Coverage analysis produced ${total} gap(s).`;
    case "generation": return `Generation run produced ${total} artifact record(s).`;
    default: return `${total} item(s).`;
  }
}
