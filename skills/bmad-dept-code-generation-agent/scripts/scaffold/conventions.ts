/**
 * DCA Generation — house-conventions loader + validator.
 * =======================================================
 * Reads `<projectRoot>/.bmad/conventions.yaml` (or an override path) and
 * enforces naming + package-prefix rules on scaffolded artifacts.
 *
 * Zero-dep: the YAML parser here handles the fixed schema below only.
 *
 *   naming:
 *     classes: PascalCase          # PascalCase | camelCase | snake_case
 *     files: kebab-case            # kebab-case | same-as-class | snake_case
 *     packages: lowercase-dotted   # com.acme.product
 *   packages:
 *     base: com.acme                # required prefix for all generated classes
 *     stack_map:                    # optional per-stack overrides
 *       aem: com.acme.aem
 *       commerce-paas: Acme_
 *   forbid:
 *     - "Test$"                     # regex — classes ending in Test
 *     - "^Impl"                     # classes starting with Impl
 *   require:
 *     - "^[A-Z]"                    # classes must start with capital
 *
 * All fields are optional; missing values fall back to permissive defaults
 * (no forbid / require rules; base package = stack default).
 */

import * as fs from "fs";
import * as path from "path";

export type ClassNamingStyle = "PascalCase" | "camelCase" | "snake_case";
export type FileNamingStyle = "kebab-case" | "same-as-class" | "snake_case";
export type PackageStyle = "lowercase-dotted";

export interface Conventions {
  naming: {
    classes?: ClassNamingStyle;
    files?: FileNamingStyle;
    packages?: PackageStyle;
  };
  packages: {
    base?: string;
    stack_map: Record<string, string>;
  };
  forbid: string[];
  require: string[];
  /** Absolute path this file was loaded from, or null when defaults were used. */
  loadedFrom: string | null;
}

export const PERMISSIVE_DEFAULT: Conventions = {
  naming: {},
  packages: { stack_map: {} },
  forbid: [],
  require: [],
  loadedFrom: null,
};

export function conventionsFilePath(projectRoot: string): string {
  return path.join(projectRoot, ".bmad", "conventions.yaml");
}

export function loadConventions(
  projectRoot: string,
  override?: string,
): Conventions {
  const p = override
    ? path.resolve(override)
    : conventionsFilePath(projectRoot);
  if (!fs.existsSync(p)) {
    return { ...PERMISSIVE_DEFAULT };
  }
  let raw: string;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch (err) {
    process.stderr.write(
      `[generation-conventions] WARN: unable to read ${p}: ${(err as Error).message} — using permissive defaults.\n`,
    );
    return { ...PERMISSIVE_DEFAULT };
  }
  try {
    const parsed = parseConventionsYaml(raw);
    parsed.loadedFrom = p;
    return parsed;
  } catch (err) {
    process.stderr.write(
      `[generation-conventions] WARN: ${p} malformed: ${(err as Error).message} — using permissive defaults.\n`,
    );
    return { ...PERMISSIVE_DEFAULT };
  }
}

// ── validation ──────────────────────────────────────────────────────────────

export type ValidateKind = "class" | "package";

export interface ValidateOk {
  ok: true;
}
export interface ValidateFail {
  ok: false;
  reason: string;
  suggestion?: string;
}
export type ValidateResult = ValidateOk | ValidateFail;

/** Validate that `name` conforms to the loaded conventions for `stack`/`kind`. */
export function validateName(
  name: string,
  stack: string,
  kind: ValidateKind,
  conv: Conventions = PERMISSIVE_DEFAULT,
): ValidateResult {
  if (!name || !name.trim()) {
    return { ok: false, reason: "name is empty" };
  }

  if (kind === "class") {
    const style = conv.naming.classes;
    if (style && !matchesClassStyle(name, style)) {
      return {
        ok: false,
        reason: `class name "${name}" does not match required style "${style}"`,
        suggestion: suggestClass(name, style),
      };
    }
  } else if (kind === "package") {
    const style = conv.naming.packages ?? "lowercase-dotted";
    if (!matchesPackageStyle(name, style)) {
      return {
        ok: false,
        reason: `package "${name}" does not match required style "${style}"`,
      };
    }
    // `forbid`/`require` per-schema apply to class names, not packages.
    return { ok: true };
  }

  for (const pat of conv.forbid) {
    let re: RegExp;
    try {
      re = new RegExp(pat);
    } catch {
      continue;
    }
    if (re.test(name)) {
      return {
        ok: false,
        reason: `name "${name}" matches forbid rule /${pat}/`,
      };
    }
  }
  for (const pat of conv.require) {
    let re: RegExp;
    try {
      re = new RegExp(pat);
    } catch {
      continue;
    }
    if (!re.test(name)) {
      return {
        ok: false,
        reason: `name "${name}" fails require rule /${pat}/`,
      };
    }
  }
  return { ok: true };
}

/**
 * Resolve the fully-qualified package for a scaffolded class in a given stack.
 * Precedence: stack_map override > base + stack-suffix > empty (caller uses
 * its own default).
 */
export function resolvePackage(
  name: string,
  stack: string,
  conv: Conventions = PERMISSIVE_DEFAULT,
): string {
  const mapped = conv.packages.stack_map[stack];
  if (mapped) return mapped;
  if (conv.packages.base) {
    // Suffix commerce-* base with vendor prefix style ("Acme_Foo").
    if (stack.startsWith("commerce") && !conv.packages.base.includes(".")) {
      return `${conv.packages.base}${pascal(name)}`;
    }
    return `${conv.packages.base}.${stackShort(stack)}`;
  }
  return "";
}

// ── helpers ─────────────────────────────────────────────────────────────────

function stackShort(stack: string): string {
  switch (stack) {
    case "aem":
      return "aem";
    case "sling":
      return "shaft";
    case "spring":
      return "app";
    case "app-builder":
      return "appbuilder";
    case "eds":
    case "eds-commerce":
      return "eds";
    case "commerce-paas":
    case "commerce-saas":
      return "commerce";
    default:
      return stack.replace(/[^a-z0-9]/gi, "").toLowerCase() || "app";
  }
}

function pascal(s: string): string {
  return (s.match(/[A-Za-z0-9]+/g) || [])
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function matchesClassStyle(name: string, style: ClassNamingStyle): boolean {
  switch (style) {
    case "PascalCase":
      return /^[A-Z][A-Za-z0-9]*$/.test(name);
    case "camelCase":
      return /^[a-z][A-Za-z0-9]*$/.test(name);
    case "snake_case":
      return /^[a-z][a-z0-9_]*$/.test(name);
    default:
      return true;
  }
}

function matchesPackageStyle(name: string, style: PackageStyle): boolean {
  if (style === "lowercase-dotted") {
    return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(name);
  }
  return true;
}

function suggestClass(name: string, style: ClassNamingStyle): string {
  const words = name.match(/[A-Za-z0-9]+/g) || [];
  switch (style) {
    case "PascalCase":
      return words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("");
    case "camelCase": {
      const p = words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("");
      return p ? p.charAt(0).toLowerCase() + p.slice(1) : name;
    }
    case "snake_case":
      return words.map((w) => w.toLowerCase()).join("_");
    default:
      return name;
  }
}

// ── minimal YAML parser (fixed schema) ──────────────────────────────────────

function parseConventionsYaml(raw: string): Conventions {
  const lines = raw.split(/\r?\n/);
  const out: Conventions = {
    naming: {},
    packages: { stack_map: {} },
    forbid: [],
    require: [],
    loadedFrom: null,
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }
    // Top-level key (no leading indent).
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*:/.test(line) && !/^\s/.test(line)) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line)!;
      const key = m[1]!;
      const rhs = (m[2] ?? "").trim();
      if (rhs && !rhs.startsWith("#")) {
        // Inline scalar at top level — currently no top-level scalars in schema;
        // ignore for forward compatibility.
        i++;
        continue;
      }
      // Collect indented block.
      const block: string[] = [];
      i++;
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        if (cur.trim() === "" || cur.startsWith(" ") || cur.startsWith("\t")) {
          block.push(cur);
          i++;
        } else {
          break;
        }
      }
      applyBlock(out, key, block);
      continue;
    }
    i++;
  }
  return out;
}

function applyBlock(out: Conventions, key: string, block: string[]): void {
  switch (key) {
    case "naming": {
      const map = parseFlatMap(block);
      if (map["classes"])
        out.naming.classes = map["classes"] as ClassNamingStyle;
      if (map["files"]) out.naming.files = map["files"] as FileNamingStyle;
      if (map["packages"])
        out.naming.packages = map["packages"] as PackageStyle;
      return;
    }
    case "packages": {
      // Two possible sub-keys: base (scalar) and stack_map (nested map).
      let sub = 0;
      while (sub < block.length) {
        const line = block[sub] ?? "";
        const trimmed = line.trim();
        if (trimmed === "" || trimmed.startsWith("#")) {
          sub++;
          continue;
        }
        const m = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
        if (!m) {
          sub++;
          continue;
        }
        const k = m[1]!;
        const v = (m[2] ?? "").trim();
        if (k === "base" && v) {
          out.packages.base = stripQuotes(v);
          sub++;
          continue;
        }
        if (k === "stack_map") {
          // Collect deeper-indented map entries.
          const inner: string[] = [];
          sub++;
          const baseIndent = leadingSpaces(line);
          while (sub < block.length) {
            const cur = block[sub] ?? "";
            if (cur.trim() === "") {
              sub++;
              continue;
            }
            if (leadingSpaces(cur) > baseIndent) {
              inner.push(cur);
              sub++;
            } else {
              break;
            }
          }
          const map = parseFlatMap(inner);
          for (const [ik, iv] of Object.entries(map)) {
            if (iv) out.packages.stack_map[ik] = iv;
          }
          continue;
        }
        sub++;
      }
      return;
    }
    case "forbid": {
      out.forbid = parseListBlock(block);
      return;
    }
    case "require": {
      out.require = parseListBlock(block);
      return;
    }
    default:
      return;
  }
}

function parseFlatMap(block: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_\-]*)\s*:\s*(.*)$/.exec(trimmed);
    if (!m) continue;
    const k = m[1]!;
    const v = stripQuotes((m[2] ?? "").trim());
    out[k] = v;
  }
  return out;
}

function parseListBlock(block: string[]): string[] {
  const out: string[] = [];
  for (const line of block) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("- ")) {
      out.push(stripQuotes(trimmed.slice(2).trim()));
    }
  }
  return out;
}

function leadingSpaces(s: string): number {
  const m = /^(\s*)/.exec(s);
  return m ? m[1]!.length : 0;
}

function stripQuotes(v: string): string {
  if (v.length >= 2) {
    const a = v[0];
    const b = v[v.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      return v.slice(1, -1);
    }
  }
  return v;
}
