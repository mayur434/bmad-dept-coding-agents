/**
 * DCA Shared — SLA tracker.
 * ==========================
 * Compute per-finding SLA snapshots (`FindingSLA[]`) by pairing each finding
 * with the OLDEST cached run that already contains the same
 * `ruleId + file + line` triple. That run's `runAt` is the `firstSeenAt`;
 * age flows from there.
 *
 * Non-fatal: cache read failures collapse to "unknown" status; the tracker
 * never crashes callers.
 */

import type { Finding, Severity } from "../core/types";
import { normalizeSeverity } from "../core/types";
import type { RoleCode } from "../role";
import { readAllRuns } from "../findings/cache";
import { readSLAsFile } from "./persistence";
import { resolveSLA } from "./resolver";
import type { FindingSLA, SLAStatus, SLAsFile } from "./schema";

export interface TrackOpts {
  findings: Finding[];
  role: RoleCode | "generic";
  agent: string;
  projectRoot: string;
  /** Testable clock — defaults to `new Date()`. */
  now?: Date;
  /** Preloaded overrides — bypass disk read for batch runs. */
  overrides?: SLAsFile | null;
}

export function trackSLAsForFindings(opts: TrackOpts): FindingSLA[] {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();

  // Load overrides once for the batch.
  const overrides =
    opts.overrides !== undefined
      ? opts.overrides
      : safeReadOverrides(opts.projectRoot);

  // Walk all cached runs newest-first, then find the OLDEST run containing each
  // finding by iterating runs oldest-first and short-circuiting.
  const runs = safeReadRuns(opts.projectRoot);
  const runsOldestFirst = [...runs].sort((a, b) => {
    const at = Date.parse(a.runAt) || 0;
    const bt = Date.parse(b.runAt) || 0;
    return at - bt;
  });

  const out: FindingSLA[] = [];
  for (const f of opts.findings) {
    const severity: Severity = normalizeSeverity(f.severity);
    const ruleId = f.ruleId ?? "";
    const file = f.file ?? "";
    const line = f.line;

    const firstSeenAt = findFirstSeen(runsOldestFirst, ruleId, file, line) ?? nowIso;
    const firstSeenMs = Date.parse(firstSeenAt);

    const sla = resolveSLA({
      role: opts.role,
      severity,
      agent: opts.agent,
      overrides,
    });
    const slaHours = sla.hours;
    const dueAtMs = firstSeenMs + slaHours * 3_600_000;
    const dueAt = new Date(dueAtMs).toISOString();

    let ageHours: number;
    let status: SLAStatus;
    if (!Number.isFinite(firstSeenMs)) {
      ageHours = 0;
      status = "unknown";
    } else {
      ageHours = Math.max(0, (nowMs - firstSeenMs) / 3_600_000);
      if (ageHours >= slaHours) status = "overdue";
      else if (ageHours >= slaHours * 0.8) status = "due-soon";
      else status = "ok";
    }

    out.push({
      finding: { ruleId, file, line, severity },
      firstSeenAt,
      ageHours,
      slaHours,
      dueAt,
      status,
      role: opts.role,
      agent: opts.agent,
    });
  }
  return out;
}

export interface SLASummary {
  total: number;
  ok: number;
  dueSoon: number;
  overdue: number;
  unknown: number;
  /** Largest (ageHours - slaHours) across overdue items; 0 if none. */
  worstOverdueHours: number;
}

export function summarizeSLA(items: FindingSLA[]): SLASummary {
  let ok = 0;
  let dueSoon = 0;
  let overdue = 0;
  let unknown = 0;
  let worst = 0;
  for (const it of items) {
    switch (it.status) {
      case "ok":
        ok += 1;
        break;
      case "due-soon":
        dueSoon += 1;
        break;
      case "overdue":
        overdue += 1;
        {
          const past = it.ageHours - it.slaHours;
          if (past > worst) worst = past;
        }
        break;
      case "unknown":
        unknown += 1;
        break;
    }
  }
  return {
    total: items.length,
    ok,
    dueSoon,
    overdue,
    unknown,
    worstOverdueHours: worst,
  };
}

// ─── internals ──────────────────────────────────────────────────────────────

function findFirstSeen(
  runsOldestFirst: ReturnType<typeof readAllRuns>,
  ruleId: string,
  file: string,
  line: number | undefined,
): string | null {
  for (const run of runsOldestFirst) {
    for (const rf of run.findings) {
      if ((rf.ruleId ?? "") !== ruleId) continue;
      if ((rf.file ?? "") !== file) continue;
      if ((rf.line ?? undefined) !== line) continue;
      return run.runAt;
    }
  }
  return null;
}

function safeReadRuns(projectRoot: string): ReturnType<typeof readAllRuns> {
  try {
    return readAllRuns(projectRoot);
  } catch (err) {
    process.stderr.write(
      `[dca-sla] WARN: readAllRuns failed: ${(err as Error).message}\n`,
    );
    return [];
  }
}

function safeReadOverrides(projectRoot: string): SLAsFile | null {
  try {
    return readSLAsFile(projectRoot);
  } catch {
    return null;
  }
}
