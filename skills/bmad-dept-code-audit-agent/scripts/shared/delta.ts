/**
 * Audit — regression / delta mode
 * ================================
 * Compares the current run's `Finding[]` against a baseline from a previous
 * cached run and emits a "Delta" sheet appended to the standardized workbook.
 *
 * Baseline resolution (`--since` value):
 *   - "last" or "": most recent prior cached audit run.
 *   - ISO-8601 timestamp: newest cached audit run at or before the timestamp.
 *   - git ref (branch/tag/SHA): resolves the ref's committer timestamp via
 *     `git show -s --format=%cI <ref>`, then falls back to the ISO path.
 *
 * When no baseline is found the helper logs a WARN and returns null — callers
 * must NOT abort the run.
 *
 * Buckets:
 *   - new        : in current, not in baseline
 *   - fixed      : in baseline, not in current
 *   - persisting : in both (matched by ruleId + file + line)
 *
 * All work is post-process (loads the just-written xlsx, adds a sheet, saves
 * it back). Zero new npm deps.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import ExcelJS from "exceljs";
import type { Finding } from "../../../shared/core/types";
import { normalizeSeverity, SEVERITIES } from "../../../shared/core/types";
import { readAllRuns, type CachedRun } from "../../../shared/findings";

export interface DeltaBucket {
  new: Finding[];
  fixed: Finding[];
  persisting: Finding[];
}

export interface DeltaResult {
  baseline: CachedRun;
  bucket: DeltaBucket;
}

/** Key used to match a finding across runs. */
function keyOf(f: Finding): string {
  const rule = f.ruleId ?? f.category ?? f.title ?? "?";
  const file = f.file ?? "?";
  const line = f.line ?? 0;
  return `${rule}|${file}|${line}`;
}

/** Resolve `since` to an ISO cut-off. Returns null when it looks like "last". */
function resolveSinceIso(projectRoot: string, since: string): string | null {
  const value = (since ?? "").trim();
  if (value === "" || value.toLowerCase() === "last") return null;

  // ISO-8601 timestamp?
  const iso = Date.parse(value);
  if (!Number.isNaN(iso)) return new Date(iso).toISOString();

  // Try to resolve as a git ref → committer date.
  try {
    const out = execSync(`git show -s --format=%cI ${JSON.stringify(value)}`, {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    })
      .toString()
      .trim();
    if (out) {
      const t = Date.parse(out);
      if (!Number.isNaN(t)) return new Date(t).toISOString();
    }
  } catch {
    /* fall through — treated as unknown ref */
  }
  return null;
}

/** Pick the baseline run from the cache. Returns null when nothing matches. */
export function resolveBaseline(
  projectRoot: string,
  since: string,
): CachedRun | null {
  const iso = resolveSinceIso(projectRoot, since);
  const runs = readAllRuns(projectRoot, { agent: "audit" });
  if (runs.length === 0) return null;

  if (iso === null) {
    // "last" — most recent prior run.
    return runs[0] ?? null;
  }
  const cutMs = Date.parse(iso);
  for (const r of runs) {
    const at = Date.parse(r.runAt);
    if (Number.isFinite(at) && at <= cutMs) return r;
  }
  return null;
}

/** Compute the three-bucket delta from `baseline` → `current`. */
export function computeDelta(baseline: Finding[], current: Finding[]): DeltaBucket {
  const baseIndex = new Map<string, Finding>();
  for (const f of baseline) baseIndex.set(keyOf(f), f);

  const currIndex = new Map<string, Finding>();
  for (const f of current) currIndex.set(keyOf(f), f);

  const bucket: DeltaBucket = { new: [], fixed: [], persisting: [] };
  for (const [k, f] of currIndex) {
    if (baseIndex.has(k)) bucket.persisting.push(f);
    else bucket.new.push(f);
  }
  for (const [k, f] of baseIndex) {
    if (!currIndex.has(k)) bucket.fixed.push(f);
  }
  return bucket;
}

function severityCountsOf(list: Finding[]): Record<string, number> {
  const out: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of list) {
    const s = normalizeSeverity(f.severity);
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

function baselineLabel(run: CachedRun): string {
  const branch = run.branch && run.branch !== "nobranch" ? run.branch : "unknown";
  return `audit-${branch}-${run.timestamp}`;
}

/** Print a one-line delta summary to stderr. */
export function logDeltaSummary(res: DeltaResult): void {
  const nCounts = severityCountsOf(res.bucket.new);
  process.stderr.write(
    `[audit-delta] baseline: ${baselineLabel(res.baseline)} — ` +
      `+${res.bucket.new.length} new (${nCounts.CRITICAL} CRITICAL) · ` +
      `-${res.bucket.fixed.length} fixed · ` +
      `${res.bucket.persisting.length} persisting\n`,
  );
}

/**
 * Append a "Delta" worksheet to an existing xlsx. Loads the workbook, adds
 * the sheet, writes it back. Non-fatal.
 */
export async function appendDeltaSheet(
  xlsxPath: string,
  res: DeltaResult,
): Promise<void> {
  if (!fs.existsSync(xlsxPath)) return;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  // Drop any pre-existing "Delta" sheet so re-runs don't stack duplicates.
  const existing = wb.getWorksheet("Delta");
  if (existing) wb.removeWorksheet(existing.id);

  const ws = wb.addWorksheet("Delta", { properties: { tabColor: { argb: "FF808080" } } });
  ws.getCell("A1").value = `Delta vs baseline: ${baselineLabel(res.baseline)}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = `Baseline run at: ${res.baseline.runAt}`;
  ws.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF666666" } };

  const bucketNames: Array<[keyof DeltaBucket, string]> = [
    ["new", "NEW findings (in current, not in baseline)"],
    ["fixed", "FIXED findings (in baseline, not in current)"],
    ["persisting", "PERSISTING findings (in both)"],
  ];

  let row = 4;
  const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1F4E79" } };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" } };
  const totalFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEEEEEE" } };

  for (const [key, title] of bucketNames) {
    const items = res.bucket[key];
    ws.getCell(row, 1).value = title;
    ws.getCell(row, 1).font = { bold: true, size: 12 };
    ws.getCell(row, 1).fill = totalFill;
    row++;

    // Counts row
    const counts = severityCountsOf(items);
    ws.getCell(row, 1).value = "Total";
    ws.getCell(row, 2).value = items.length;
    for (let s = 0; s < SEVERITIES.length; s++) {
      ws.getCell(row, 3 + s).value = counts[SEVERITIES[s]] ?? 0;
    }
    row++;
    ws.getCell(row, 1).value = "Severity";
    ws.getCell(row, 2).value = "Count";
    for (let s = 0; s < SEVERITIES.length; s++) ws.getCell(row, 3 + s).value = SEVERITIES[s];
    for (let c = 1; c <= 2 + SEVERITIES.length; c++) {
      ws.getCell(row, c).fill = headerFill;
      ws.getCell(row, c).font = headerFont;
    }
    row++;

    // Table
    const cols = ["Rule ID", "Title", "Severity", "File", "Line", "Category"];
    for (let c = 0; c < cols.length; c++) {
      const cell = ws.getCell(row, c + 1);
      cell.value = cols[c];
      cell.fill = headerFill;
      cell.font = headerFont;
    }
    row++;
    for (const f of items) {
      ws.getCell(row, 1).value = f.ruleId ?? "—";
      ws.getCell(row, 2).value = f.title ?? "";
      ws.getCell(row, 3).value = normalizeSeverity(f.severity);
      ws.getCell(row, 4).value = f.file ?? "";
      ws.getCell(row, 5).value = f.line ?? "";
      ws.getCell(row, 6).value = f.category ?? "";
      row++;
    }
    row += 1; // spacer
  }

  const widths = [22, 60, 12, 60, 8, 24];
  for (let i = 0; i < widths.length; i++) ws.getColumn(i + 1).width = widths[i];

  await wb.xlsx.writeFile(xlsxPath);
}

export interface RunDeltaOptions {
  projectRoot: string;
  since: string;
  currentFindings: Finding[];
  xlsxPath: string;
}

/**
 * End-to-end helper called by each engine's audit.ts:
 *   - resolves baseline
 *   - computes delta
 *   - appends the sheet
 *   - logs the summary
 *
 * Returns the DeltaResult when applied, or null when skipped (no baseline).
 */
export async function runDeltaMode(
  opts: RunDeltaOptions,
): Promise<DeltaResult | null> {
  const baseline = resolveBaseline(opts.projectRoot, opts.since);
  if (!baseline) {
    process.stderr.write(
      `[audit-delta] no baseline found for --since "${opts.since}" — skipping delta emission\n`,
    );
    return null;
  }
  const bucket = computeDelta(baseline.findings ?? [], opts.currentFindings);
  const res: DeltaResult = { baseline, bucket };
  try {
    await appendDeltaSheet(opts.xlsxPath, res);
  } catch (err) {
    process.stderr.write(
      `[audit-delta] WARN: could not append Delta sheet: ${(err as Error).message}\n`,
    );
  }
  logDeltaSummary(res);
  return res;
}

/** Suppress ExcelJS "path" import when tsc trims it. */
export const _path = path;
