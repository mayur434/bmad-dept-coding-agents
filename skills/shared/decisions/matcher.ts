/**
 * DCA Shared — findings-gate matcher.
 * ====================================
 * Filters a set of findings against the signed decisions recorded in
 * `.bmad/decisions.yaml`. Non-fatal: a missing or malformed decisions file
 * is treated as "no decisions" and every finding is kept.
 */

import type { Finding } from "../core/types";
import { readDecisionsFile } from "./persistence";
import { Decision, DecisionStatus } from "./schema";

export interface FilterOptions {
  projectRoot: string;
  /** Default true — expired decisions no longer suppress. */
  ignoreExpired?: boolean;
  /** Default ['accepted','deferred','wontfix']. `fixed` is historical/trend only. */
  includeStatuses?: DecisionStatus[];
}

export interface Suppressed {
  finding: Finding;
  decision: Decision;
  reason: string;
}

export interface FilterResult {
  kept: Finding[];
  suppressed: Suppressed[];
}

const DEFAULT_INCLUDE: DecisionStatus[] = ["accepted", "deferred", "wontfix"];

export function filterFindingsByDecisions(
  findings: Finding[],
  opts: FilterOptions,
): FilterResult {
  const ignoreExpired = opts.ignoreExpired !== false;
  const includeStatuses = opts.includeStatuses ?? DEFAULT_INCLUDE;
  const includeSet = new Set<DecisionStatus>(includeStatuses);

  const file = readDecisionsFile(opts.projectRoot);
  if (!file || file.decisions.length === 0) {
    return { kept: [...findings], suppressed: [] };
  }

  // Bucket eligible decisions for O(1) matching. A decision is "eligible" when
  // its status is in the includeSet AND (ignoreExpired is off OR it is not
  // expired).
  const nowMs = Date.now();
  const isExpired = (d: Decision): boolean => {
    if (!d.expiresAt) return false;
    const t = Date.parse(d.expiresAt);
    if (Number.isNaN(t)) return false;
    return t < nowMs;
  };

  const byExact = new Map<string, Decision>(); // ruleId|file|line
  const byRuleFile = new Map<string, Decision>(); // ruleId|file (line absent)
  const byRule = new Map<string, Decision>(); // ruleId (file+line both absent)

  for (const d of file.decisions) {
    if (!includeSet.has(d.status)) continue;
    if (ignoreExpired && isExpired(d)) continue;

    if (d.line !== undefined) {
      byExact.set(`${d.ruleId}|${d.file}|${d.line}`, d);
    } else if (d.file && d.file !== "") {
      byRuleFile.set(`${d.ruleId}|${d.file}`, d);
    } else {
      byRule.set(d.ruleId, d);
    }
  }

  const kept: Finding[] = [];
  const suppressed: Suppressed[] = [];

  for (const f of findings) {
    if (!f.ruleId) {
      kept.push(f);
      continue;
    }
    let hit: Decision | undefined;
    let reason = "";

    if (f.file && f.line !== undefined) {
      hit = byExact.get(`${f.ruleId}|${f.file}|${f.line}`);
      if (hit) reason = "exact rule+file+line match";
    }
    if (!hit && f.file) {
      hit = byRuleFile.get(`${f.ruleId}|${f.file}`);
      if (hit) reason = "file-wide rule+file match";
    }
    if (!hit) {
      hit = byRule.get(f.ruleId);
      if (hit) reason = "rule-wide match";
    }

    if (hit) {
      suppressed.push({ finding: f, decision: hit, reason });
    } else {
      kept.push(f);
    }
  }

  logSuppressionSummary(file.decisions, suppressed, {
    ignoreExpired,
    includeSet,
    nowMs,
    isExpired,
  });

  return { kept, suppressed };
}

interface LogCtx {
  ignoreExpired: boolean;
  includeSet: Set<DecisionStatus>;
  nowMs: number;
  isExpired: (d: Decision) => boolean;
}

function logSuppressionSummary(
  allDecisions: Decision[],
  suppressed: Suppressed[],
  ctx: LogCtx,
): void {
  if (suppressed.length === 0) return;

  const counts: Record<DecisionStatus, number> = {
    accepted: 0,
    deferred: 0,
    wontfix: 0,
    fixed: 0,
  };
  for (const s of suppressed) counts[s.decision.status]++;

  let expiredStillSuppressed = 0;
  if (!ctx.ignoreExpired) {
    for (const s of suppressed) if (ctx.isExpired(s.decision)) expiredStillSuppressed++;
  }
  void allDecisions;

  process.stderr.write(
    `[dca-decisions] suppressed ${suppressed.length} finding(s) via .bmad/decisions.yaml ` +
      `(accepted=${counts.accepted}, deferred=${counts.deferred}, wontfix=${counts.wontfix}, ` +
      `expired-still-suppressed=${expiredStillSuppressed})\n`,
  );
}
