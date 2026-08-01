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

import * as path from "path";
import type { Finding } from "../../../shared/core/types";
import { enforceConfidence, type ConfidenceInputs } from "../../../shared/scoring";
import { emitFindingsCache } from "../../../shared/findings";
import { currentBranch } from "../../../shared/git";

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
