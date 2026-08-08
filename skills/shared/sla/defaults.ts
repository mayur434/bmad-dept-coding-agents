/**
 * DCA Shared — SLA defaults.
 * ===========================
 * Per-role × per-severity default durations. Grounded in industry norms
 * (Sec CRITICAL ~24h, HIGH ~3d) and the DCA 10-role catalog. Overridable
 * via `<projectRoot>/.bmad/sla.yaml` — see `./persistence.ts`.
 *
 * Zero external dependencies.
 */

import type { RoleCode } from "../role";
import type { SLADuration, SLAMatrix } from "./schema";

export const DEFAULT_SLAS: Record<RoleCode | "generic", SLAMatrix> = {
  security: {
    CRITICAL: { hours: 24, humanized: "24h" },
    HIGH:     { hours: 72, humanized: "3d" },
    MEDIUM:   { hours: 168, humanized: "1w" },
    LOW:      { hours: 720, humanized: "30d" },
    INFO:     { hours: 2160, humanized: "90d" },
  },
  devops: {
    CRITICAL: { hours: 48, humanized: "2d" },
    HIGH:     { hours: 120, humanized: "5d" },
    MEDIUM:   { hours: 336, humanized: "2w" },
    LOW:      { hours: 720, humanized: "30d" },
    INFO:     { hours: 2160, humanized: "90d" },
  },
  qa: {
    CRITICAL: { hours: 72, humanized: "3d" },
    HIGH:     { hours: 168, humanized: "1w" },
    MEDIUM:   { hours: 336, humanized: "2w" },
    LOW:      { hours: 720, humanized: "30d" },
    INFO:     { hours: 2160, humanized: "90d" },
  },
  ea: {
    CRITICAL: { hours: 168, humanized: "1w" },
    HIGH:     { hours: 720, humanized: "30d" },
    MEDIUM:   { hours: 1440, humanized: "60d" },
    LOW:      { hours: 2160, humanized: "90d" },
    INFO:     { hours: 4320, humanized: "180d" },
  },
  tl: {
    CRITICAL: { hours: 48, humanized: "2d" },
    HIGH:     { hours: 168, humanized: "1w" },
    MEDIUM:   { hours: 336, humanized: "2w" },
    LOW:      { hours: 720, humanized: "30d" },
    INFO:     { hours: 2160, humanized: "90d" },
  },
  de: {
    CRITICAL: { hours: 48, humanized: "2d" },
    HIGH:     { hours: 120, humanized: "5d" },
    MEDIUM:   { hours: 336, humanized: "2w" },
    LOW:      { hours: 720, humanized: "30d" },
    INFO:     { hours: 2160, humanized: "90d" },
  },
  pm: {
    CRITICAL: { hours: 168, humanized: "1w" },
    HIGH:     { hours: 336, humanized: "2w" },
    MEDIUM:   { hours: 720, humanized: "30d" },
    LOW:      { hours: 1440, humanized: "60d" },
    INFO:     { hours: 4320, humanized: "180d" },
  },
  ba: {
    CRITICAL: { hours: 168, humanized: "1w" },
    HIGH:     { hours: 336, humanized: "2w" },
    MEDIUM:   { hours: 720, humanized: "30d" },
    LOW:      { hours: 1440, humanized: "60d" },
    INFO:     { hours: 4320, humanized: "180d" },
  },
  migration: {
    CRITICAL: { hours: 24, humanized: "24h" },
    HIGH:     { hours: 72, humanized: "3d" },
    MEDIUM:   { hours: 168, humanized: "1w" },
    LOW:      { hours: 336, humanized: "2w" },
    INFO:     { hours: 720, humanized: "30d" },
  },
  content: {
    CRITICAL: { hours: 72, humanized: "3d" },
    HIGH:     { hours: 168, humanized: "1w" },
    MEDIUM:   { hours: 336, humanized: "2w" },
    LOW:      { hours: 720, humanized: "30d" },
    INFO:     { hours: 2160, humanized: "90d" },
  },
  generic: {
    CRITICAL: { hours: 72, humanized: "3d" },
    HIGH:     { hours: 168, humanized: "1w" },
    MEDIUM:   { hours: 336, humanized: "2w" },
    LOW:      { hours: 720, humanized: "30d" },
    INFO:     { hours: 2160, humanized: "90d" },
  },
};

// ─── parser ──────────────────────────────────────────────────────────────────

const UNIT_HOURS: Record<string, number> = {
  h: 1,
  hr: 1,
  hrs: 1,
  hour: 1,
  hours: 1,
  d: 24,
  day: 24,
  days: 24,
  w: 168,
  wk: 168,
  wks: 168,
  week: 168,
  weeks: 168,
  m: 720, // month ~= 30d
  mo: 720,
  mos: 720,
  month: 720,
  months: 720,
  y: 8760, // year = 365d
  yr: 8760,
  yrs: 8760,
  year: 8760,
  years: 8760,
};

/**
 * Parse a duration string like '24h', '5d', '2w', '30 days', '1 week'.
 * Whitespace between number and unit is optional. Returns { hours, humanized }.
 * Throws on malformed input — persistence-layer parsers should catch and
 * report a WARN, never propagate the throw to callers.
 */
export function parseSLADuration(input: string): SLADuration {
  if (typeof input !== "string") {
    throw new Error(`parseSLADuration: expected string, got ${typeof input}`);
  }
  const raw = input.trim();
  if (raw === "") throw new Error("parseSLADuration: empty input");
  const m = /^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/.exec(raw);
  if (!m) throw new Error(`parseSLADuration: cannot parse "${input}"`);
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`parseSLADuration: invalid number in "${input}"`);
  }
  const unit = m[2]!.toLowerCase();
  const mult = UNIT_HOURS[unit];
  if (mult === undefined) {
    throw new Error(`parseSLADuration: unknown unit "${unit}" in "${input}"`);
  }
  return { hours: n * mult, humanized: humanize(n, unit) };
}

/** Normalize the surface form: strip whitespace, keep original unit letter(s). */
function humanize(n: number, unit: string): string {
  const clean = Number.isInteger(n) ? String(n) : String(n);
  return `${clean}${unit}`;
}
