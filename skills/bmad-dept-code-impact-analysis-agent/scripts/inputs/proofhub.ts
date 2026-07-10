/**
 * Impact Analysis — Proofhub bug-export reader
 * =============================================
 * Reads a Proofhub task/bug CSV export into InputItem[]. Column names vary across
 * Proofhub exports, so headers are matched by keyword with sensible defaults; a
 * caller can override via ColumnMap. Real exports refine the mapping — this does
 * NOT hard-code one schema.
 */

import * as fs from "fs";
import * as path from "path";
import { InputItem, ColumnMap } from "./types";

/** Minimal RFC-4180-ish CSV parser (quoted fields, embedded commas/newlines, "" escapes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Default header→field keyword rules (first header that CONTAINS the keyword wins). */
const DEFAULT_RULES: Record<keyof ColumnMap, string[]> = {
  id: ["task id", "bug id", "id", "#", "key", "ticket"],
  title: ["title", "subject", "task name", "task", "name", "summary"],
  description: ["description", "details", "detail", "notes", "comment"],
  module: ["module", "component", "label", "category", "tag", "area", "feature"],
  priority: ["priority", "severity"],
  status: ["status", "state"],
};

function resolveColumns(headers: string[], override?: ColumnMap): Record<keyof ColumnMap, number> {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const out = {} as Record<keyof ColumnMap, number>;
  for (const field of Object.keys(DEFAULT_RULES) as (keyof ColumnMap)[]) {
    // explicit override by exact header name
    if (override?.[field]) {
      const idx = lower.indexOf(override[field]!.toLowerCase());
      if (idx >= 0) { out[field] = idx; continue; }
    }
    let found = -1;
    for (const kw of DEFAULT_RULES[field]) {
      const idx = lower.findIndex((h) => h === kw) >= 0 ? lower.findIndex((h) => h === kw)
        : lower.findIndex((h) => h.includes(kw));
      if (idx >= 0) { found = idx; break; }
    }
    out[field] = found;
  }
  return out;
}

export function readProofhubCsv(filePath: string, override?: ColumnMap): InputItem[] {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const col = resolveColumns(headers, override);
  const source = path.basename(filePath);
  const items: InputItem[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (f: keyof ColumnMap) => (col[f] >= 0 ? (r[col[f]] ?? "").trim() : "");
    const title = get("title");
    const description = get("description");
    if (!title && !description) continue;
    items.push({
      id: get("id") || `BUG-${i}`,
      kind: "bug",
      title: title || `(row ${i})`,
      description,
      module: get("module") || undefined,
      priority: get("priority") || undefined,
      status: get("status") || undefined,
      source,
    });
  }
  return items;
}

/** Describe how the columns were resolved (for the run log / transparency). */
export function describeMapping(filePath: string, override?: ColumnMap): string {
  const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  if (!rows.length) return "empty file";
  const headers = rows[0];
  const col = resolveColumns(headers, override);
  return (Object.keys(col) as (keyof ColumnMap)[])
    .map((f) => `${f}=${col[f] >= 0 ? headers[col[f]] : "—"}`)
    .join(", ");
}
