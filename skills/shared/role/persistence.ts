/**
 * DCA Shared — role persistence.
 *
 * Reads/writes the project role selection at <projectRoot>/.bmad/role.yaml.
 * Zero deps — hand-written YAML for the fixed schema below.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { isValidRoleCode, RoleCode } from "./role";

export interface RoleFile {
  role: RoleCode;
  setAt: string;
  setBy: "interactive" | "--role-flag" | "config";
  notes?: string;
}

const VALID_SET_BY: readonly RoleFile["setBy"][] = [
  "interactive",
  "--role-flag",
  "config",
];

export function roleFilePath(projectRoot: string): string {
  return path.join(projectRoot, ".bmad", "role.yaml");
}

export function readRoleFile(projectRoot: string): RoleFile | null {
  const p = roleFilePath(projectRoot);
  if (!fs.existsSync(p)) return null;
  let raw: string;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch (err) {
    process.stderr.write(
      `[dca-role] WARN: unable to read ${p}: ${(err as Error).message}\n`,
    );
    return null;
  }

  const parsed = parseRoleYaml(raw);
  if (!parsed) {
    process.stderr.write(
      `[dca-role] WARN: ${p} is malformed or missing required fields; ignoring.\n`,
    );
    return null;
  }
  return parsed;
}

export function writeRoleFile(
  projectRoot: string,
  role: RoleCode,
  setBy: RoleFile["setBy"],
  notes?: string,
): void {
  if (!isValidRoleCode(role)) {
    throw new Error(`writeRoleFile: invalid role code "${role}"`);
  }
  if (!VALID_SET_BY.includes(setBy)) {
    throw new Error(`writeRoleFile: invalid setBy "${setBy}"`);
  }

  const bmadDir = path.join(projectRoot, ".bmad");
  if (!fs.existsSync(bmadDir)) {
    fs.mkdirSync(bmadDir, { recursive: true });
  }

  const target = roleFilePath(projectRoot);
  const body = serializeRoleYaml({
    role,
    setAt: new Date().toISOString(),
    setBy,
    notes,
  });

  const tmp = path.join(
    bmadDir,
    `.role.yaml.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tmp, body, { encoding: "utf8", mode: 0o644 });
  fs.renameSync(tmp, target);
}

function serializeRoleYaml(rf: RoleFile): string {
  const lines: string[] = [];
  lines.push("# BMAD DCA — role selection");
  lines.push(
    "# Set by the DCA agent suite on first activation; edit or delete to change.",
  );
  lines.push(`role: ${rf.role}`);
  lines.push(`set_at: ${rf.setAt}`);
  lines.push(`set_by: ${rf.setBy}`);
  if (rf.notes && rf.notes.length > 0) {
    lines.push("notes: |");
    for (const l of rf.notes.split(/\r?\n/)) {
      lines.push(`  ${l}`);
    }
  }
  return lines.join(os.EOL) + os.EOL;
}

function parseRoleYaml(raw: string): RoleFile | null {
  const lines = raw.split(/\r?\n/);
  let role: string | undefined;
  let setAt: string | undefined;
  let setBy: string | undefined;
  let notes: string | undefined;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) {
      i++;
      continue;
    }
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    if (trimmed === "notes: |") {
      const collected: string[] = [];
      i++;
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        if (cur === "" || cur.startsWith(" ") || cur.startsWith("\t")) {
          collected.push(cur.replace(/^\s\s?/, ""));
          i++;
        } else {
          break;
        }
      }
      while (collected.length > 0 && collected[collected.length - 1] === "") {
        collected.pop();
      }
      notes = collected.join("\n");
      continue;
    }

    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(trimmed);
    if (!m) return null;
    const key = m[1]!;
    const value = m[2]!.trim();
    switch (key) {
      case "role":
        role = stripQuotes(value);
        break;
      case "set_at":
        setAt = stripQuotes(value);
        break;
      case "set_by":
        setBy = stripQuotes(value);
        break;
      default:
        return null;
    }
    i++;
  }

  if (!role || !setAt || !setBy) return null;
  if (!isValidRoleCode(role)) return null;
  if (!VALID_SET_BY.includes(setBy as RoleFile["setBy"])) return null;

  const out: RoleFile = {
    role: role.toLowerCase() as RoleCode,
    setAt,
    setBy: setBy as RoleFile["setBy"],
  };
  if (notes !== undefined) out.notes = notes;
  return out;
}

function stripQuotes(v: string): string {
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return v.slice(1, -1);
    }
  }
  return v;
}
