/**
 * Test Coverage — findings-gate helper (Phase 1).
 * =============================================
 * Composes the shared `skills/shared/decisions/*` primitives with the
 * agent CLI flags (via env vars). Non-fatal — any error keeps the input
 * findings unchanged. Kept local per-agent to avoid cross-agent coupling.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Finding } from "../../shared/core/types";
import {
  decisionsFilePath,
  filterFindingsByDecisions,
  readDecisionsFile,
} from "../../shared/decisions";

export interface DecisionsGateEnv {
  includeDecided: boolean;
  decisionsPath: string | undefined;
  ignoreExpiry: boolean;
}

export function readDecisionsGateEnv(): DecisionsGateEnv {
  return {
    includeDecided:
      process.env.DCA_INCLUDE_DECIDED === "1" || process.env.DCA_INCLUDE_DECIDED === "true",
    decisionsPath: process.env.DCA_DECISIONS_PATH || undefined,
    ignoreExpiry:
      process.env.DCA_IGNORE_DECISION_EXPIRY === "1" ||
      process.env.DCA_IGNORE_DECISION_EXPIRY === "true",
  };
}

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

/** Filter `findings` against `.bmad/decisions.yaml`. Non-fatal on any error. */
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

/** Pretty-print all decisions to stdout. Returns true on completion. */
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
