/**
 * DCA Shared — findings cache emit helper.
 * =========================================
 * Thin wrapper called by each agent's emit pipeline after
 * `emitStandardOutputs` completes. Non-fatal on any failure — a cache write
 * failure MUST NEVER break the primary report emit, so all errors are logged
 * (stderr WARN) and the helper returns an empty string.
 */

import type { Finding } from "../core/types";
import { CachedRun, CachedRunAgent, writeCachedRun } from "./cache";

export interface EmitCacheOpts {
  projectRoot: string;
  agent: CachedRunAgent;
  stack: string;
  branch: string;
  timestamp: string;
  reportPath: string;
  findings: Finding[];
  meta?: Record<string, string>;
}

/**
 * Persist a completed run to the shared findings cache. Returns the absolute
 * path of the cache file on success, or an empty string on failure.
 */
export function emitFindingsCache(opts: EmitCacheOpts): string {
  try {
    const run: CachedRun = {
      agent: opts.agent,
      stack: opts.stack,
      runAt: new Date().toISOString(),
      branch: opts.branch,
      timestamp: opts.timestamp,
      reportPath: opts.reportPath,
      findings: opts.findings,
      ...(opts.meta ? { meta: opts.meta } : {}),
    };
    return writeCachedRun(opts.projectRoot, run);
  } catch (err) {
    process.stderr.write(
      `[dca-findings] WARN: findings cache emit failed: ${(err as Error).message}\n`,
    );
    return "";
  }
}
