/**
 * Audit — shared emit-time helpers
 * =================================
 * Small utilities every engine calls right before / after `emitStandardOutputs`:
 *
 *   - `enforceConfidenceOnAll(findings, method)` — walks `Finding[]` and fills a
 *     default confidence label on any finding that lacks one, using the shared
 *     `enforceConfidence` scoring helper. Logs the count.
 *   - `emitAuditFindingsCache(opts)` — non-fatal wrapper around the shared
 *     findings cache writer. Called AFTER the standardized report is written so
 *     downstream agents (impact-analysis, sonar-scan, test-coverage) can
 *     cross-reference the run.
 *
 * These helpers are engine-scoped (audit only). They deliberately do not touch
 * `skills/shared/*` — they compose the shared primitives instead.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Finding } from "../../../shared/core/types";
import { enforceConfidence, type ConfidenceInputs } from "../../../shared/scoring";
import { emitFindingsCache } from "../../../shared/findings";
import { currentBranch } from "../../../shared/git";
import {
  decisionsFilePath,
  filterFindingsByDecisions,
  readDecisionsFile,
} from "../../../shared/decisions";
import type { RoleCode } from "../../../shared/role";
import type { ExtraSheet } from "../../../shared/report";
import {
  trackSLAsForFindings,
  summarizeSLA,
  buildSLASheet,
  readSLAsFile,
  type FindingSLA,
  type SLASummary,
  type SLAsFile,
} from "../../../shared/sla";

/**
 * Wrap every finding with `enforceConfidence`, filling in a default label when
 * missing. Returns a NEW array; input is not mutated. Also logs the number of
 * findings that received a default so the operator can see the effect.
 */
export function enforceConfidenceOnAll(
  findings: Finding[],
  detectionMethod: ConfidenceInputs["detectionMethod"] = "regex",
  extras?: Partial<Omit<ConfidenceInputs, "detectionMethod">>,
): Finding[] {
  let filled = 0;
  const out: Finding[] = new Array(findings.length);
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const hadConf =
      f && f.confidence !== undefined && f.confidence !== null && f.confidence !== "";
    if (hadConf) {
      out[i] = f;
      continue;
    }
    const method = inferMethod(f, detectionMethod);
    const inputs: ConfidenceInputs = {
      detectionMethod: method,
      supportingRefs: extras?.supportingRefs ?? 1,
      ruleMaturity: extras?.ruleMaturity ?? "stable",
      isCrossFile: extras?.isCrossFile ?? false,
    };
    out[i] = enforceConfidence(f, inputs);
    filled++;
  }
  if (filled > 0) {
    process.stderr.write(
      `[audit-confidence] enforced default confidence on ${filled} finding(s) that lacked it\n`,
    );
  }
  return out;
}

/** Prefer per-finding hints (source, ruleId) over the caller's default method. */
function inferMethod(
  f: Finding | undefined,
  fallback: ConfidenceInputs["detectionMethod"],
): ConfidenceInputs["detectionMethod"] {
  if (!f) return fallback;
  if (f.source === "llm") return "llm-inference";
  if (typeof f.ruleId === "string") {
    if (/(-AST-|AST[- ]|^AST)/i.test(f.ruleId)) return "ast";
    if (/^XML-|-XML-/i.test(f.ruleId)) return "regex"; // XML rules use regex fallback today
  }
  return fallback;
}

export interface EmitCacheOpts {
  projectRoot: string;
  stack: string;
  reportPath: string;
  findings: Finding[];
  timestamp: string;
  branch?: string;
  meta?: Record<string, string>;
}

/**
 * Persist findings to the shared cross-agent cache. Always non-fatal — any
 * failure inside `emitFindingsCache` already logs a WARN and returns "".
 */
export function emitAuditFindingsCache(opts: EmitCacheOpts): string {
  const branch = opts.branch ?? currentBranch(opts.projectRoot) ?? "nobranch";
  const relReport = path.isAbsolute(opts.reportPath)
    ? path.relative(opts.projectRoot, opts.reportPath) || opts.reportPath
    : opts.reportPath;
  const written = emitFindingsCache({
    projectRoot: opts.projectRoot,
    agent: "audit",
    stack: opts.stack,
    branch,
    timestamp: opts.timestamp,
    reportPath: relReport,
    findings: opts.findings,
    meta: opts.meta,
  });
  if (written) {
    process.stderr.write(`[audit-cache] wrote findings cache: ${written}\n`);
  }
  return written;
}

// ─── Findings gate: filter findings against .bmad/decisions.yaml ────────────
//
// Phase 1 feature. Non-fatal: any failure logs a WARN and returns the input
// findings unchanged. Wired into each engine right before `emitStandardOutputs`.

export interface DecisionsGateOpts {
  /** Env-supplied flag (DCA_INCLUDE_DECIDED=1). Disables the filter entirely. */
  includeDecided?: boolean;
  /** Env-supplied path override (DCA_DECISIONS_PATH). Non-default file location. */
  decisionsPath?: string | undefined;
  /** Env-supplied flag (DCA_IGNORE_DECISION_EXPIRY=1). Suppress via EXPIRED entries too. */
  ignoreExpiry?: boolean;
}

export function readDecisionsGateEnv(): DecisionsGateOpts {
  return {
    includeDecided:
      process.env.DCA_INCLUDE_DECIDED === "1" || process.env.DCA_INCLUDE_DECIDED === "true",
    decisionsPath: process.env.DCA_DECISIONS_PATH || undefined,
    ignoreExpiry:
      process.env.DCA_IGNORE_DECISION_EXPIRY === "1" ||
      process.env.DCA_IGNORE_DECISION_EXPIRY === "true",
  };
}

/**
 * Resolve the "project root" the shared filter should look at. When the user
 * provides a custom `--decisions-path`, we materialize a tiny tmp directory
 * that mirrors the default `<root>/.bmad/decisions.yaml` layout, so the shared
 * primitive can consume it unchanged.
 */
export function resolveDecisionsSearchRoot(
  projectRoot: string,
  decisionsPath: string | undefined,
): string {
  if (!decisionsPath) return projectRoot;
  const target = path.resolve(decisionsPath);
  if (!fs.existsSync(target)) {
    process.stderr.write(
      `[dca-decisions] WARN: --decisions-path not found: ${target}; falling back to default.\n`,
    );
    return projectRoot;
  }
  try {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dca-decisions-"));
    const bmadDir = path.join(tmpRoot, ".bmad");
    fs.mkdirSync(bmadDir, { recursive: true });
    const linkPath = path.join(bmadDir, "decisions.yaml");
    try {
      fs.symlinkSync(target, linkPath);
    } catch {
      fs.copyFileSync(target, linkPath);
    }
    return tmpRoot;
  } catch (err) {
    process.stderr.write(
      `[dca-decisions] WARN: unable to prepare override root: ${(err as Error).message}\n`,
    );
    return projectRoot;
  }
}

/**
 * Apply the findings gate. Non-fatal — on any error, returns input unchanged.
 * Mutates `extra` (when provided) with `suppressedByDecisions: N` so it lands
 * in the Run Info sheet.
 */
export function applyDecisionsFilter(
  findings: Finding[],
  projectRoot: string,
  extra?: Record<string, string | number>,
): { kept: Finding[]; suppressed: number } {
  const opts = readDecisionsGateEnv();
  if (opts.includeDecided) {
    process.stderr.write("[dca-decisions] --include-decided set; filter disabled\n");
    if (extra) extra["Suppressed By Decisions"] = 0;
    return { kept: findings, suppressed: 0 };
  }
  try {
    const searchRoot = resolveDecisionsSearchRoot(projectRoot, opts.decisionsPath);
    const file = readDecisionsFile(searchRoot);
    if (!file || file.decisions.length === 0) {
      if (extra) extra["Suppressed By Decisions"] = 0;
      return { kept: findings, suppressed: 0 };
    }
    const res = filterFindingsByDecisions(findings, {
      projectRoot: searchRoot,
      ignoreExpired: !opts.ignoreExpiry,
    });
    if (extra) extra["Suppressed By Decisions"] = res.suppressed.length;
    return { kept: res.kept, suppressed: res.suppressed.length };
  } catch (err) {
    process.stderr.write(
      `[dca-decisions] WARN: filter failed: ${(err as Error).message}; keeping all findings\n`,
    );
    if (extra) extra["Suppressed By Decisions"] = 0;
    return { kept: findings, suppressed: 0 };
  }
}

/**
 * Print a pretty summary of every decision in the file and return true on
 * success. Callers typically `process.exit(0)` afterward.
 */
export function listDecisions(projectRoot: string, decisionsPath?: string): boolean {
  const searchRoot = resolveDecisionsSearchRoot(projectRoot, decisionsPath);
  const filePath = decisionsPath
    ? path.resolve(decisionsPath)
    : decisionsFilePath(searchRoot);
  const file = readDecisionsFile(searchRoot);
  if (!file) {
    process.stdout.write(`[dca-decisions] no decisions file at ${filePath}\n`);
    return true;
  }
  process.stdout.write(
    `[dca-decisions] ${file.decisions.length} decision(s) in ${filePath}:\n`,
  );
  for (const d of file.decisions) {
    const where = d.file
      ? `${d.file}${d.line !== undefined ? ":" + d.line : ""}`
      : "(rule-wide)";
    const expires = d.expiresAt ? `expires ${d.expiresAt}` : "never";
    const rationaleLine = (d.rationale || "").split(/\r?\n/)[0]?.slice(0, 80) ?? "";
    process.stdout.write(
      `  ${d.id} · ${d.ruleId} · ${where} · ${d.status} · ${expires} · ${rationaleLine}\n`,
    );
  }
  return true;
}

// ─── SLA gate: track findings against .bmad/sla.yaml (or defaults) ─────────
//
// Phase 1.4 feature. Non-fatal: any SLA failure logs a WARN and skips the
// sheet + meta additions — never crashes the report. Callers pass the
// returned `extraSheet` (when present) to `emitStandardOutputs`.

export interface SLAGateEnv {
  /** DCA_NO_SLA=1 → skip the SLA pass entirely. */
  noSla: boolean;
  /** DCA_SLA_PATH=<path> → override the SLA file location. */
  slaPath: string | undefined;
  /** DCA_FAIL_ON_OVERDUE=1 → engine exits 6 when overdue count > 0. */
  failOnOverdue: boolean;
}

export function readSLAGateEnv(): SLAGateEnv {
  return {
    noSla: process.env.DCA_NO_SLA === "1" || process.env.DCA_NO_SLA === "true",
    slaPath: process.env.DCA_SLA_PATH || undefined,
    failOnOverdue:
      process.env.DCA_FAIL_ON_OVERDUE === "1" ||
      process.env.DCA_FAIL_ON_OVERDUE === "true",
  };
}

function loadSLAOverrides(
  projectRoot: string,
  slaPath: string | undefined,
): SLAsFile | null {
  if (!slaPath) return safeReadSLAs(projectRoot);
  const target = path.resolve(slaPath);
  if (!fs.existsSync(target)) {
    process.stderr.write(
      `[dca-sla] WARN: --sla-path not found: ${target}; falling back to default.\n`,
    );
    return safeReadSLAs(projectRoot);
  }
  try {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dca-sla-"));
    const bmadDir = path.join(tmpRoot, ".bmad");
    fs.mkdirSync(bmadDir, { recursive: true });
    const linkPath = path.join(bmadDir, "sla.yaml");
    try {
      fs.symlinkSync(target, linkPath);
    } catch {
      fs.copyFileSync(target, linkPath);
    }
    return safeReadSLAs(tmpRoot);
  } catch (err) {
    process.stderr.write(
      `[dca-sla] WARN: unable to prepare SLA override root: ${(err as Error).message}\n`,
    );
    return safeReadSLAs(projectRoot);
  }
}

function safeReadSLAs(projectRoot: string): SLAsFile | null {
  try {
    return readSLAsFile(projectRoot);
  } catch {
    return null;
  }
}

/**
 * Convert the SLA report spec (positional columns + row style) into a generic
 * ExtraSheet the shared StandardExcelReport can render.
 */
function toExtraSheet(items: FindingSLA[]): ExtraSheet {
  const spec = buildSLASheet(items);
  const DEFAULT_WIDTHS = [22, 42, 8, 12, 12, 26, 10, 10, 26, 12, 14];
  const columns = spec.columns.map((header, i) => ({
    header,
    key: `c${i}`,
    width: DEFAULT_WIDTHS[i] ?? 16,
  }));
  const rows = spec.rows.map((r) => {
    const values: Record<string, string | number> = {};
    for (let i = 0; i < columns.length; i++) {
      values[columns[i].key] = r.values[i] ?? "";
    }
    return {
      values,
      fillARGB: r.style.fillArgb,
      fontColorARGB: r.style.fontArgb,
    };
  });
  return {
    sheetName: spec.sheetName,
    columns,
    rows,
    description:
      "Per-finding SLA status. Row color = status (green ok, amber due-soon, red overdue, grey unknown).",
  };
}

export interface ApplySLAOpts {
  findings: Finding[];
  projectRoot: string;
  /** Agent code — one of the 5 (audit | sonar-scan | generation | impact-analysis | test-coverage). */
  agent: string;
  /** Optional Run Info `extra` block to append SLA counters to. */
  extra?: Record<string, string | number>;
}

export interface ApplySLAResult {
  /** ExtraSheet to pass into `emitStandardOutputs({ extraSheets: [sheet] })`. */
  extraSheet?: ExtraSheet;
  /** Summary counts (also written to `opts.extra` when supplied). */
  summary?: SLASummary;
  /** Per-finding SLA records (undefined when SLA was skipped or failed). */
  slas?: FindingSLA[];
  /** True when DCA_NO_SLA disabled this pass. */
  skipped: boolean;
  /** True when a non-fatal error prevented SLA from producing a sheet. */
  errored: boolean;
}

export function applySLA(opts: ApplySLAOpts): ApplySLAResult {
  const env = readSLAGateEnv();
  if (env.noSla) {
    process.stderr.write("[dca-sla] --no-sla set; skipping SLA tracking\n");
    return { skipped: true, errored: false };
  }
  try {
    const rawRole = (process.env.DCA_ROLE || "generic").trim();
    const role = (rawRole || "generic") as RoleCode | "generic";
    const overrides = loadSLAOverrides(opts.projectRoot, env.slaPath);
    const slas = trackSLAsForFindings({
      findings: opts.findings,
      role,
      agent: opts.agent,
      projectRoot: opts.projectRoot,
      overrides,
    });
    const summary = summarizeSLA(slas);
    process.stderr.write(
      `[dca-sla] ${summary.total} findings tracked (ok=${summary.ok}, due-soon=${summary.dueSoon}, overdue=${summary.overdue}, unknown=${summary.unknown})\n`,
    );
    if (summary.overdue > 0) {
      process.stderr.write(
        `[dca-sla] WARN: ${summary.overdue} finding(s) OVERDUE per role=${role}\n`,
      );
    }
    if (opts.extra) {
      opts.extra["SLA OK"] = summary.ok;
      opts.extra["SLA Due Soon"] = summary.dueSoon;
      opts.extra["SLA Overdue"] = summary.overdue;
      opts.extra["SLA Worst Overdue Hours"] = Math.round(summary.worstOverdueHours * 10) / 10;
    }
    return {
      extraSheet: toExtraSheet(slas),
      summary,
      slas,
      skipped: false,
      errored: false,
    };
  } catch (err) {
    process.stderr.write(
      `[dca-sla] WARN: SLA tracking failed: ${(err as Error).message}; skipping sheet\n`,
    );
    return { skipped: false, errored: true };
  }
}

/**
 * Post-emit `--fail-on-overdue` check. Callers invoke AFTER
 * `emitStandardOutputs` so the report is written before we exit.
 */
export function maybeFailOnOverdue(summary: SLASummary | undefined): void {
  if (!summary) return;
  if (!readSLAGateEnv().failOnOverdue) return;
  if (summary.overdue > 0) {
    process.stderr.write(
      `[dca-sla] --fail-on-overdue: ${summary.overdue} overdue finding(s); exiting 6.\n`,
    );
    process.exit(6);
  }
}
