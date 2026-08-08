/**
 * Test coverage — SLA gate helper (Phase 1.4).
 * ==========================================
 * Composes the shared `skills/shared/sla/*` primitives with the agent CLI
 * flags (via env vars). Non-fatal — any error skips the SLA sheet + meta
 * additions and leaves the report unchanged. Kept local per-agent to avoid
 * cross-agent coupling; mirrors `decisions-gate.ts`.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Finding } from "../../shared/core/types";
import type { RoleCode } from "../../shared/role";
import type { ExtraSheet } from "../../shared/report";
import {
  trackSLAsForFindings,
  summarizeSLA,
  buildSLASheet,
  readSLAsFile,
  type FindingSLA,
  type SLASummary,
  type SLAsFile,
} from "../../shared/sla";

export interface SLAGateEnv {
  noSla: boolean;
  slaPath: string | undefined;
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
  agent: string;
  extra?: Record<string, string | number>;
}

export interface ApplySLAResult {
  extraSheet?: ExtraSheet;
  summary?: SLASummary;
  slas?: FindingSLA[];
  skipped: boolean;
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
