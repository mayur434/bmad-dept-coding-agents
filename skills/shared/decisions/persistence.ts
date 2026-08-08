/**
 * DCA Shared — decisions persistence.
 * ====================================
 * Reads/writes <projectRoot>/.bmad/decisions.yaml with a hand-rolled YAML
 * parser/serializer scoped to THIS file's schema only. Zero deps.
 *
 * File shape (writer output — parser is lenient about column count on
 * comments/blank lines but strict about indent for list items):
 *
 *   # BMAD DCA — findings decisions
 *   version: 1
 *   last_modified: 2026-08-06T12:00:00Z
 *   decisions:
 *     - id: dec-abc123
 *       rule_id: COMMERCE-SEC-001
 *       file: app/code/Vendor/Module/Model/Foo.php
 *       line: 42
 *       status: accepted
 *       rationale: |
 *         Legacy code from acquired product.
 *         Refactor scheduled for Q1 2027.
 *       signed_by: architect@company.com
 *       signed_at: 2026-08-06T12:00:00Z
 *       expires_at: 2027-01-31T23:59:59Z
 *       tags: [q4-release, tech-debt]
 *
 * Atomic writes via tmp + rename. Malformed input → returns null + WARN to
 * stderr; never throws to callers (matches the role/intake/findings posture).
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  Decision,
  DecisionsFile,
  isValidDecisionStatus,
} from "./schema";

const WARN = "[dca-decisions] WARN:";

export function decisionsFilePath(projectRoot: string): string {
  return path.join(projectRoot, ".bmad", "decisions.yaml");
}

// ─── read ───────────────────────────────────────────────────────────────────

export function readDecisionsFile(projectRoot: string): DecisionsFile | null {
  const p = decisionsFilePath(projectRoot);
  if (!fs.existsSync(p)) return null;
  let raw: string;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch (err) {
    process.stderr.write(
      `${WARN} unable to read ${p}: ${(err as Error).message}\n`,
    );
    return null;
  }
  const parsed = parseDecisionsYaml(raw);
  if (!parsed) {
    process.stderr.write(
      `${WARN} ${p} is malformed or missing required fields; ignoring.\n`,
    );
    return null;
  }
  return parsed;
}

// ─── write ──────────────────────────────────────────────────────────────────

export function writeDecisionsFile(
  projectRoot: string,
  file: DecisionsFile,
): void {
  const bmadDir = path.join(projectRoot, ".bmad");
  if (!fs.existsSync(bmadDir)) {
    fs.mkdirSync(bmadDir, { recursive: true });
  }
  const target = decisionsFilePath(projectRoot);
  const body = serializeDecisionsYaml(file);
  const tmp = path.join(
    bmadDir,
    `.decisions.yaml.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tmp, body, { encoding: "utf8", mode: 0o644 });
  fs.renameSync(tmp, target);
}

// ─── upsert / remove ────────────────────────────────────────────────────────

export function upsertDecision(
  projectRoot: string,
  decision: Decision,
): DecisionsFile {
  const existing =
    readDecisionsFile(projectRoot) ??
    ({ version: 1, decisions: [], lastModified: new Date().toISOString() } as DecisionsFile);
  const next = existing.decisions.filter((d) => d.id !== decision.id);
  next.push(decision);
  const out: DecisionsFile = {
    version: 1,
    decisions: next,
    lastModified: new Date().toISOString(),
  };
  writeDecisionsFile(projectRoot, out);
  return out;
}

export function removeDecision(
  projectRoot: string,
  id: string,
): DecisionsFile | null {
  const existing = readDecisionsFile(projectRoot);
  if (!existing) return null;
  const before = existing.decisions.length;
  const next = existing.decisions.filter((d) => d.id !== id);
  if (next.length === before) {
    // no-op — return current file unchanged (still refresh lastModified? no,
    // keep it stable so callers can detect a real change).
    return existing;
  }
  const out: DecisionsFile = {
    version: 1,
    decisions: next,
    lastModified: new Date().toISOString(),
  };
  writeDecisionsFile(projectRoot, out);
  return out;
}

// ─── serialize ──────────────────────────────────────────────────────────────

function serializeDecisionsYaml(f: DecisionsFile): string {
  const lines: string[] = [];
  lines.push(
    "# BMAD DCA — findings decisions (accepted / deferred / wontfix / fixed)",
  );
  lines.push(
    "# See https://mayur434.github.io/bmad-dept-coding-agents/concepts/findings-gate",
  );
  lines.push(`version: ${f.version}`);
  lines.push(`last_modified: ${f.lastModified}`);
  if (f.decisions.length === 0) {
    lines.push("decisions: []");
    return lines.join(os.EOL) + os.EOL;
  }
  lines.push("decisions:");
  for (const d of f.decisions) {
    lines.push(`  - id: ${scalar(d.id)}`);
    lines.push(`    rule_id: ${scalar(d.ruleId)}`);
    lines.push(`    file: ${scalar(d.file)}`);
    if (d.line !== undefined) {
      lines.push(`    line: ${d.line}`);
    }
    lines.push(`    status: ${d.status}`);
    // rationale — always emitted as block scalar for readability, even single line.
    lines.push(`    rationale: |`);
    const rlines = d.rationale.split(/\r?\n/);
    // Trim single trailing blank line to keep output stable.
    while (rlines.length > 0 && rlines[rlines.length - 1] === "") rlines.pop();
    for (const l of rlines) lines.push(`      ${l}`);
    lines.push(`    signed_by: ${scalar(d.signedBy)}`);
    lines.push(`    signed_at: ${d.signedAt}`);
    if (d.expiresAt !== undefined) {
      lines.push(`    expires_at: ${d.expiresAt}`);
    }
    if (d.tags && d.tags.length > 0) {
      lines.push(`    tags: [${d.tags.map(scalar).join(", ")}]`);
    }
  }
  return lines.join(os.EOL) + os.EOL;
}

/** Quote scalars that contain characters likely to confuse the parser. */
function scalar(v: string): string {
  if (v === "") return '""';
  if (/^[A-Za-z0-9._\-@/:+]+$/.test(v)) return v;
  // Escape backslash and double-quote.
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// ─── parse ──────────────────────────────────────────────────────────────────

interface Cursor {
  lines: string[];
  i: number;
}

function parseDecisionsYaml(raw: string): DecisionsFile | null {
  const cur: Cursor = { lines: raw.split(/\r?\n/), i: 0 };
  let version: number | undefined;
  let lastModified: string | undefined;
  let decisions: Decision[] | undefined;

  while (cur.i < cur.lines.length) {
    const line = cur.lines[cur.i] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      cur.i++;
      continue;
    }

    // Must be at column 0 for top-level keys.
    if (line.startsWith(" ") || line.startsWith("\t")) {
      // Unexpected indent at top level — malformed.
      return null;
    }

    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(trimmed);
    if (!m) return null;
    const key = m[1]!;
    const value = m[2]!.trim();

    if (key === "version") {
      const n = Number(value);
      if (!Number.isInteger(n)) return null;
      version = n;
      cur.i++;
      continue;
    }
    if (key === "last_modified") {
      lastModified = stripQuotes(value);
      cur.i++;
      continue;
    }
    if (key === "decisions") {
      if (value === "[]") {
        decisions = [];
        cur.i++;
        continue;
      }
      if (value !== "") return null; // expected empty or []
      cur.i++;
      const parsed = parseDecisionList(cur);
      if (parsed === null) return null;
      decisions = parsed;
      continue;
    }
    // Unknown top-level key → be strict, malformed.
    return null;
  }

  if (version !== 1) return null;
  if (!lastModified) return null;
  if (!decisions) decisions = [];

  return { version: 1, decisions, lastModified };
}

/** Parse a list of decisions. Cursor sits on the first candidate line. */
function parseDecisionList(cur: Cursor): Decision[] | null {
  const out: Decision[] = [];
  while (cur.i < cur.lines.length) {
    const line = cur.lines[cur.i] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      cur.i++;
      continue;
    }
    // A list item starts with "  - key: value" (2 spaces + dash + space).
    if (!line.startsWith("  - ")) {
      // dedent — end of list.
      return out;
    }
    // Parse the first key on the "- " line.
    const first = line.slice(4); // after "  - "
    const firstMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(first);
    if (!firstMatch) return null;
    const item: Record<string, unknown> = {};
    cur.i++;
    if (
      !consumeKeyValue(
        cur,
        item,
        firstMatch[1]!,
        firstMatch[2]!,
        /* blockIndent */ 6,
      )
    ) {
      return null;
    }
    // Continuation lines: "    key: value" (4-space indent).
    while (cur.i < cur.lines.length) {
      const cont = cur.lines[cur.i] ?? "";
      const contTrim = cont.trim();
      if (contTrim === "" || contTrim.startsWith("#")) {
        cur.i++;
        continue;
      }
      // Next list item?
      if (cont.startsWith("  - ")) break;
      // Continuation must start with exactly 4 spaces then non-space.
      if (!/^ {4}[^\s-]/.test(cont) && !/^ {4}[A-Za-z_]/.test(cont)) {
        // Dedent or unexpected — end of item.
        break;
      }
      const contMatch = /^ {4}([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(cont);
      if (!contMatch) return null;
      cur.i++;
      if (
        !consumeKeyValue(
          cur,
          item,
          contMatch[1]!,
          contMatch[2]!,
          /* blockIndent */ 6,
        )
      ) {
        return null;
      }
    }
    const decision = buildDecision(item);
    if (!decision) return null;
    out.push(decision);
  }
  return out;
}

/**
 * Populate `dst[key]` from a scalar or (for `key === "rationale"`) a `|` block
 * scalar. `cur` is positioned on the line AFTER the "key: value" line.
 * Returns false when the value is malformed.
 */
function consumeKeyValue(
  cur: Cursor,
  dst: Record<string, unknown>,
  key: string,
  value: string,
  blockIndent: number,
): boolean {
  const v = value.trim();
  if (v === "|") {
    // Block scalar — consume subsequent lines indented at >= blockIndent.
    const collected: string[] = [];
    const prefix = " ".repeat(blockIndent);
    while (cur.i < cur.lines.length) {
      const cur1 = cur.lines[cur.i] ?? "";
      if (cur1 === "") {
        collected.push("");
        cur.i++;
        continue;
      }
      if (cur1.startsWith(prefix)) {
        collected.push(cur1.slice(blockIndent));
        cur.i++;
        continue;
      }
      break;
    }
    while (collected.length > 0 && collected[collected.length - 1] === "") {
      collected.pop();
    }
    dst[key] = collected.join("\n");
    return true;
  }
  // Inline array: [a, b, c]
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (inner === "") {
      dst[key] = [];
      return true;
    }
    const parts = splitCsvRespectingQuotes(inner);
    dst[key] = parts.map((p) => stripQuotes(p.trim()));
    return true;
  }
  // Simple scalar (may be numeric).
  const stripped = stripQuotes(v);
  if (/^-?\d+$/.test(stripped)) {
    dst[key] = Number(stripped);
  } else {
    dst[key] = stripped;
  }
  return true;
}

function splitCsvRespectingQuotes(s: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQ: '"' | "'" | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inQ) {
      if (c === "\\" && i + 1 < s.length) {
        buf += c + s[i + 1];
        i++;
        continue;
      }
      if (c === inQ) {
        inQ = null;
      }
      buf += c;
      continue;
    }
    if (c === '"' || c === "'") {
      inQ = c;
      buf += c;
      continue;
    }
    if (c === ",") {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.length > 0) out.push(buf);
  return out;
}

function buildDecision(raw: Record<string, unknown>): Decision | null {
  const id = strField(raw, "id");
  const ruleId = strField(raw, "rule_id");
  // `file` may be an empty string (rule-wide decisions); require present + string.
  const fileRaw = raw["file"];
  const file = typeof fileRaw === "string" ? fileRaw : null;
  const status = strField(raw, "status");
  const rationale = strField(raw, "rationale");
  const signedBy = strField(raw, "signed_by");
  const signedAt = strField(raw, "signed_at");
  if (
    !id ||
    !ruleId ||
    file === null ||
    !status ||
    !rationale ||
    !signedBy ||
    !signedAt
  ) {
    return null;
  }
  if (!isValidDecisionStatus(status)) return null;

  const out: Decision = {
    id,
    ruleId,
    file,
    status,
    rationale,
    signedBy,
    signedAt,
  };

  const line = raw["line"];
  if (line !== undefined) {
    if (typeof line !== "number" || !Number.isInteger(line)) return null;
    out.line = line;
  }
  const expiresAt = raw["expires_at"];
  if (expiresAt !== undefined) {
    if (typeof expiresAt !== "string") return null;
    out.expiresAt = expiresAt;
  }
  const tags = raw["tags"];
  if (tags !== undefined) {
    if (!Array.isArray(tags)) return null;
    const asStrings: string[] = [];
    for (const t of tags) {
      if (typeof t !== "string") return null;
      asStrings.push(t);
    }
    if (asStrings.length > 0) out.tags = asStrings;
  }
  return out;
}

function strField(raw: Record<string, unknown>, key: string): string | null {
  const v = raw[key];
  if (typeof v !== "string" || v === "") return null;
  return v;
}

function stripQuotes(v: string): string {
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }
  return v;
}
