/**
 * DCA Shared — cross-agent findings cache.
 * =========================================
 * Zero-dep TS. Stores per-agent findings from a completed run at
 *   <projectRoot>/.bmad/cache/<agent>-<sha256-8chars-of-report-path>.json
 *
 * Files are append-only PER RUN — one JSON file per completed report. Callers
 * that want history should use readAllRuns; downstream agents that want the
 * most-recent snapshot should use readLatestRun.
 *
 * Non-fatal posture: malformed files are logged (stderr WARN) and skipped;
 * they must never crash the caller.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import type { Finding } from "../core/types";

export type CachedRunAgent =
  | "audit"
  | "sonar-scan"
  | "generation"
  | "impact-analysis"
  | "test-coverage";

const VALID_AGENTS: readonly CachedRunAgent[] = [
  "audit",
  "sonar-scan",
  "generation",
  "impact-analysis",
  "test-coverage",
];

export interface CachedRun {
  agent: CachedRunAgent;
  /** Engine ID at time of run (e.g. aemcs, spring-boot, eds). */
  stack: string;
  /** ISO-8601 (UTC) timestamp of when the cache entry was written. */
  runAt: string;
  /** Git branch (sanitized), 'nobranch' if not a repo. */
  branch: string;
  /** YYYYMMDD_HHMMSS — matches the standardized report filename. */
  timestamp: string;
  /** Report path, relative to project root when possible. */
  reportPath: string;
  /** Full set of findings from the run. */
  findings: Finding[];
  /** Free-form metadata: role, roleFlavor, roleSource, engine, etc. */
  meta?: Record<string, string>;
}

/** Return (creating if necessary) <projectRoot>/.bmad/cache. */
export function cacheDir(projectRoot: string): string {
  const dir = path.join(projectRoot, ".bmad", "cache");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Write a completed run's findings to cache. Returns the absolute path of the
 * written file. Filename: `<agent>-<sha256-8chars-of-reportPath>.json`.
 * Uses an atomic tmp+rename write so partial files can never be observed.
 */
export function writeCachedRun(projectRoot: string, run: CachedRun): string {
  if (!VALID_AGENTS.includes(run.agent)) {
    throw new Error(`writeCachedRun: invalid agent "${run.agent}"`);
  }
  const dir = cacheDir(projectRoot);
  const suffix = crypto
    .createHash("sha256")
    .update(run.reportPath)
    .digest("hex")
    .slice(0, 8);
  const target = path.join(dir, `${run.agent}-${suffix}.json`);

  const payload = JSON.stringify(run, null, 2);
  const tmp = path.join(dir, `.${run.agent}-${suffix}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, payload, { encoding: "utf8", mode: 0o644 });
  fs.renameSync(tmp, target);
  return target;
}

/**
 * Return the most recent cached run for `agent` (by `runAt`), or null when
 * no valid file matches. Malformed files are logged + skipped.
 */
export function readLatestRun(
  projectRoot: string,
  agent: CachedRunAgent,
): CachedRun | null {
  const runs = readAllRuns(projectRoot, { agent });
  return runs.length > 0 ? runs[0]! : null;
}

export interface ReadAllOptions {
  agent?: CachedRunAgent;
  /** Ignore runs whose `runAt` is older than this ISO-8601 timestamp. */
  sinceISO?: string;
}

/**
 * Read every cached run in the project, newest-first (by `runAt`).
 * Optional filters: agent, sinceISO.
 */
export function readAllRuns(
  projectRoot: string,
  opts: ReadAllOptions = {},
): CachedRun[] {
  const dir = path.join(projectRoot, ".bmad", "cache");
  if (!fs.existsSync(dir)) return [];

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    process.stderr.write(
      `[dca-findings] WARN: unable to read ${dir}: ${(err as Error).message}\n`,
    );
    return [];
  }

  const sinceMs =
    opts.sinceISO !== undefined ? Date.parse(opts.sinceISO) : Number.NaN;

  const runs: CachedRun[] = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    if (name.startsWith(".")) continue;
    if (opts.agent && !name.startsWith(`${opts.agent}-`)) continue;

    const full = path.join(dir, name);
    const parsed = readOne(full);
    if (!parsed) continue;
    if (opts.agent && parsed.agent !== opts.agent) continue;
    if (!Number.isNaN(sinceMs)) {
      const at = Date.parse(parsed.runAt);
      if (Number.isNaN(at) || at < sinceMs) continue;
    }
    runs.push(parsed);
  }

  runs.sort((a, b) => {
    const at = Date.parse(a.runAt) || 0;
    const bt = Date.parse(b.runAt) || 0;
    return bt - at;
  });
  return runs;
}

export interface PruneOptions {
  /** Keep the newest N runs per agent (default 10). */
  keepPerAgent?: number;
}

export interface PruneResult {
  removed: number;
}

/**
 * Housekeeping: keep the newest N runs per agent, delete the rest. Silent no-op
 * when the cache directory doesn't exist. Non-fatal — reports removal count.
 */
export function pruneOldRuns(
  projectRoot: string,
  opts: PruneOptions = {},
): PruneResult {
  const keep = Math.max(1, opts.keepPerAgent ?? 10);
  const dir = path.join(projectRoot, ".bmad", "cache");
  if (!fs.existsSync(dir)) return { removed: 0 };

  const all = readAllRuns(projectRoot);
  // group newest-first per agent (readAllRuns already sorted)
  const perAgent = new Map<CachedRunAgent, CachedRun[]>();
  for (const r of all) {
    const arr = perAgent.get(r.agent) ?? [];
    arr.push(r);
    perAgent.set(r.agent, arr);
  }

  let removed = 0;
  for (const [agent, arr] of perAgent) {
    if (arr.length <= keep) continue;
    for (const r of arr.slice(keep)) {
      const suffix = crypto
        .createHash("sha256")
        .update(r.reportPath)
        .digest("hex")
        .slice(0, 8);
      const target = path.join(dir, `${agent}-${suffix}.json`);
      try {
        fs.unlinkSync(target);
        removed += 1;
      } catch (err) {
        process.stderr.write(
          `[dca-findings] WARN: prune failed for ${target}: ${(err as Error).message}\n`,
        );
      }
    }
  }
  return { removed };
}

// ─── internals ──────────────────────────────────────────────────────────────

function readOne(fullPath: string): CachedRun | null {
  let raw: string;
  try {
    raw = fs.readFileSync(fullPath, "utf8");
  } catch (err) {
    process.stderr.write(
      `[dca-findings] WARN: unable to read ${fullPath}: ${(err as Error).message}\n`,
    );
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(
      `[dca-findings] WARN: ${fullPath} is not valid JSON: ${(err as Error).message}\n`,
    );
    return null;
  }
  if (!isCachedRun(parsed)) {
    process.stderr.write(
      `[dca-findings] WARN: ${fullPath} is missing required cache fields; ignoring.\n`,
    );
    return null;
  }
  return parsed;
}

function isCachedRun(v: unknown): v is CachedRun {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.agent !== "string") return false;
  if (!VALID_AGENTS.includes(o.agent as CachedRunAgent)) return false;
  if (typeof o.stack !== "string") return false;
  if (typeof o.runAt !== "string") return false;
  if (typeof o.branch !== "string") return false;
  if (typeof o.timestamp !== "string") return false;
  if (typeof o.reportPath !== "string") return false;
  if (!Array.isArray(o.findings)) return false;
  return true;
}
