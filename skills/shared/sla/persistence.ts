/**
 * DCA Shared — SLA persistence.
 * ==============================
 * Reads/writes <projectRoot>/.bmad/sla.yaml with a hand-rolled YAML
 * parser/serializer scoped to THIS file's schema only. Zero deps.
 *
 * File shape (writer output):
 *
 *   # BMAD DCA — Service Level Agreements per role and severity
 *   version: 1
 *   overrides:
 *     - role: security
 *       slas:
 *         CRITICAL: 12h
 *         HIGH: 48h
 *   per_agent_overrides:
 *     sonar-scan:
 *       CRITICAL: 24h
 *       HIGH: 48h
 *       MEDIUM: 1w
 *       LOW: 30d
 *       INFO: 90d
 *
 * Atomic writes via tmp + rename. Malformed input → returns null + WARN to
 * stderr; never throws to callers (matches decisions/role/findings posture).
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type { Severity } from "../core/types";
import { SEVERITIES } from "../core/types";
import { isValidRoleCode } from "../role";
import { parseSLADuration } from "./defaults";
import type {
  RoleSLAProfile,
  SLADuration,
  SLAMatrix,
  SLAsFile,
} from "./schema";

const WARN = "[dca-sla] WARN:";

export function slaFilePath(projectRoot: string): string {
  return path.join(projectRoot, ".bmad", "sla.yaml");
}

// ─── read ───────────────────────────────────────────────────────────────────

export function readSLAsFile(projectRoot: string): SLAsFile | null {
  const p = slaFilePath(projectRoot);
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
  try {
    const parsed = parseSLAsYaml(raw);
    if (!parsed) {
      process.stderr.write(
        `${WARN} ${p} is malformed or missing required fields; ignoring.\n`,
      );
      return null;
    }
    return parsed;
  } catch (err) {
    process.stderr.write(
      `${WARN} ${p} parse failed: ${(err as Error).message}\n`,
    );
    return null;
  }
}

// ─── write ──────────────────────────────────────────────────────────────────

export function writeSLAsFile(projectRoot: string, file: SLAsFile): void {
  const bmadDir = path.join(projectRoot, ".bmad");
  if (!fs.existsSync(bmadDir)) {
    fs.mkdirSync(bmadDir, { recursive: true });
  }
  const target = slaFilePath(projectRoot);
  const body = serializeSLAsYaml(file);
  const tmp = path.join(
    bmadDir,
    `.sla.yaml.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tmp, body, { encoding: "utf8", mode: 0o644 });
  fs.renameSync(tmp, target);
}

// ─── serialize ──────────────────────────────────────────────────────────────

function serializeSLAsYaml(f: SLAsFile): string {
  const lines: string[] = [];
  lines.push("# BMAD DCA — Service Level Agreements per role and severity");
  lines.push(
    "# Overrides skills/shared/sla/defaults.ts. Omitted fields fall back to defaults.",
  );
  lines.push(`version: ${f.version}`);

  const overrides = f.overrides ?? [];
  if (overrides.length === 0) {
    lines.push("overrides: []");
  } else {
    lines.push("overrides:");
    for (const o of overrides) {
      lines.push(`  - role: ${o.role}`);
      if (o.description !== undefined) {
        lines.push(`    description: ${scalar(o.description)}`);
      }
      const entries = severityOrdered(o.slas);
      if (entries.length === 0) {
        lines.push(`    slas: {}`);
      } else {
        lines.push(`    slas:`);
        for (const [sev, dur] of entries) {
          lines.push(`      ${sev}: ${dur.humanized}`);
        }
      }
    }
  }

  const per = f.perAgentOverrides ?? {};
  const perKeys = Object.keys(per).sort();
  if (perKeys.length === 0) {
    lines.push("per_agent_overrides: {}");
  } else {
    lines.push("per_agent_overrides:");
    for (const agent of perKeys) {
      lines.push(`  ${scalar(agent)}:`);
      const entries = severityOrdered(per[agent]!);
      for (const [sev, dur] of entries) {
        lines.push(`    ${sev}: ${dur.humanized}`);
      }
    }
  }

  return lines.join(os.EOL) + os.EOL;
}

function severityOrdered<T>(
  slas: Partial<Record<Severity, T>>,
): Array<[Severity, T]> {
  const out: Array<[Severity, T]> = [];
  for (const sev of SEVERITIES) {
    const v = slas[sev];
    if (v !== undefined) out.push([sev, v]);
  }
  return out;
}

function scalar(v: string): string {
  if (v === "") return '""';
  if (/^[A-Za-z0-9._\-@/:+]+$/.test(v)) return v;
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// ─── parse ──────────────────────────────────────────────────────────────────

interface Cursor {
  lines: string[];
  i: number;
}

function parseSLAsYaml(raw: string): SLAsFile | null {
  const cur: Cursor = { lines: raw.split(/\r?\n/), i: 0 };
  let version: number | undefined;
  let overrides: RoleSLAProfile[] | undefined;
  let perAgentOverrides: Record<string, SLAMatrix> | undefined;

  while (cur.i < cur.lines.length) {
    const line = cur.lines[cur.i] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      cur.i++;
      continue;
    }
    if (line.startsWith(" ") || line.startsWith("\t")) return null;

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
    if (key === "overrides") {
      if (value === "[]") {
        overrides = [];
        cur.i++;
        continue;
      }
      if (value !== "") return null;
      cur.i++;
      const parsed = parseOverridesList(cur);
      if (parsed === null) return null;
      overrides = parsed;
      continue;
    }
    if (key === "per_agent_overrides") {
      if (value === "{}") {
        perAgentOverrides = {};
        cur.i++;
        continue;
      }
      if (value !== "") return null;
      cur.i++;
      const parsed = parsePerAgentMap(cur);
      if (parsed === null) return null;
      perAgentOverrides = parsed;
      continue;
    }
    return null;
  }

  if (version !== 1) return null;
  const out: SLAsFile = { version: 1 };
  if (overrides !== undefined) out.overrides = overrides;
  if (perAgentOverrides !== undefined) out.perAgentOverrides = perAgentOverrides;
  return out;
}

function parseOverridesList(cur: Cursor): RoleSLAProfile[] | null {
  const out: RoleSLAProfile[] = [];
  while (cur.i < cur.lines.length) {
    const line = cur.lines[cur.i] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      cur.i++;
      continue;
    }
    if (!line.startsWith("  - ")) return out; // dedent

    // First key on the "- " line — must be `role: <code>`.
    const first = line.slice(4);
    const firstMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(first);
    if (!firstMatch) return null;
    if (firstMatch[1] !== "role") return null;
    const roleCode = firstMatch[2]!.trim();
    if (roleCode !== "generic" && !isValidRoleCode(roleCode)) return null;

    const item: RoleSLAProfile = {
      role: roleCode as RoleSLAProfile["role"],
      slas: {},
    };
    cur.i++;

    // Continuation lines at 4-space indent: description | slas
    while (cur.i < cur.lines.length) {
      const cont = cur.lines[cur.i] ?? "";
      const contTrim = cont.trim();
      if (contTrim === "" || contTrim.startsWith("#")) {
        cur.i++;
        continue;
      }
      if (cont.startsWith("  - ")) break; // next list item
      if (!/^ {4}[A-Za-z_]/.test(cont)) break; // dedent

      const contMatch = /^ {4}([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(cont);
      if (!contMatch) return null;
      const key = contMatch[1]!;
      const value = contMatch[2]!.trim();
      cur.i++;

      if (key === "description") {
        item.description = stripQuotes(value);
        continue;
      }
      if (key === "slas") {
        if (value === "{}") continue;
        if (value !== "") return null;
        const slas = parseSeverityMap(cur, 6);
        if (slas === null) return null;
        item.slas = slas;
        continue;
      }
      // Unknown key inside an override entry — strict.
      return null;
    }
    out.push(item);
  }
  return out;
}

function parsePerAgentMap(cur: Cursor): Record<string, SLAMatrix> | null {
  const out: Record<string, SLAMatrix> = {};
  while (cur.i < cur.lines.length) {
    const line = cur.lines[cur.i] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      cur.i++;
      continue;
    }
    // Agent entry at 2-space indent, followed by ":"
    if (!/^ {2}[^ \s-]/.test(line) && !/^ {2}"/.test(line)) return out;

    const m = /^ {2}(?:"([^"]+)"|([A-Za-z0-9._\-@/:+]+))\s*:\s*(.*)$/.exec(line);
    if (!m) return null;
    const agent = (m[1] ?? m[2])!;
    const value = m[3]!.trim();
    cur.i++;
    if (value !== "") {
      if (value === "{}") {
        // empty matrix disallowed for per-agent — needs to be full — treat as malformed
        return null;
      }
      return null;
    }
    const matrix = parseSeverityMap(cur, 4);
    if (matrix === null) return null;
    // per-agent overrides must be a complete matrix — enforce all 5 severities
    for (const sev of SEVERITIES) {
      if (!(sev in matrix)) return null;
    }
    out[agent] = matrix as SLAMatrix;
  }
  return out;
}

/**
 * Parse a map of `<indent>SEVERITY: <duration>` entries. Stops at the first
 * line whose indent is less than `indent`.
 */
function parseSeverityMap(
  cur: Cursor,
  indent: number,
): Partial<SLAMatrix> | null {
  const out: Partial<SLAMatrix> = {};
  const prefix = " ".repeat(indent);
  const re = new RegExp(
    `^ {${indent}}(CRITICAL|HIGH|MEDIUM|LOW|INFO)\\s*:\\s*(.+)$`,
  );
  while (cur.i < cur.lines.length) {
    const line = cur.lines[cur.i] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      cur.i++;
      continue;
    }
    if (!line.startsWith(prefix)) return out;
    // Reject deeper indent — this schema is flat inside a severity map.
    if (line.length > indent && line[indent] === " ") return out;
    const m = re.exec(line);
    if (!m) return null;
    const sev = m[1] as Severity;
    const durRaw = stripQuotes(m[2]!.trim());
    let dur: SLADuration;
    try {
      dur = parseSLADuration(durRaw);
    } catch {
      return null;
    }
    out[sev] = dur;
    cur.i++;
  }
  return out;
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
