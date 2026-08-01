/**
 * DCA Shared — cross-agent findings cache barrel.
 * ================================================
 * Public surface:
 *   - writeCachedRun / readLatestRun / readAllRuns / pruneOldRuns / cacheDir
 *   - emitFindingsCache        (non-fatal write wrapper called from emit pipelines)
 *   - consumeLatestFindings    (pre-aggregated read for downstream cross-ref)
 */

export * from "./cache";
export * from "./emit";
export * from "./consume";
