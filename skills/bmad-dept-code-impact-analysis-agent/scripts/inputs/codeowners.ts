/**
 * Impact Analysis — CODEOWNERS parser
 * ====================================
 * Locates the project's CODEOWNERS file (`.github/CODEOWNERS`, `docs/CODEOWNERS`,
 * or `CODEOWNERS`) and returns owner-resolution for any file path relative to
 * the project root. Follows GitHub CODEOWNERS semantics:
 *   - `#` starts a comment,
 *   - each non-empty line is `<pattern>  @owner1 @owner2 ...`,
 *   - the LAST matching pattern in the file wins,
 *   - patterns support `*`, `**`, and `?` glob syntax.
 *
 * Zero deps — the glob → regex translator is inline.
 */

import * as fs from "fs";
import * as path from "path";

const CODEOWNERS_CANDIDATES = [
  ".github/CODEOWNERS",
  "docs/CODEOWNERS",
  "CODEOWNERS",
];

interface Rule {
  pattern: string;
  re: RegExp;
  owners: string[];
}

export interface CodeownersIndex {
  /** Path (absolute) to the CODEOWNERS file that was loaded, or null. */
  source: string | null;
  /** Compiled rules in file order. */
  rules: Rule[];
  /** Project root the index was built for; used for relativizing lookups. */
  projectRoot: string;
}

/**
 * Try to load a CODEOWNERS file from the standard locations. Returns an empty
 * index (source: null) when none exists — resolveOwners then returns [].
 */
export function loadCodeowners(projectRoot: string): CodeownersIndex {
  for (const rel of CODEOWNERS_CANDIDATES) {
    const abs = path.join(projectRoot, rel);
    if (!fs.existsSync(abs)) continue;
    let text: string;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    return { source: abs, rules: parseCodeowners(text), projectRoot };
  }
  return { source: null, rules: [], projectRoot };
}

/** Return the owners for `filePath` (accepts an absolute or relative path). */
export function resolveOwners(index: CodeownersIndex, filePath: string): string[] {
  if (index.rules.length === 0) return [];
  const rel = toRelative(index.projectRoot, filePath);
  // Last matching rule wins (GitHub semantics).
  for (let i = index.rules.length - 1; i >= 0; i--) {
    if (index.rules[i]!.re.test(rel)) return index.rules[i]!.owners.slice();
  }
  return [];
}

// ── internals ────────────────────────────────────────────────────────────────

export function parseCodeowners(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;
    const tokens = line.split(/\s+/);
    if (tokens.length < 2) continue;
    const pattern = tokens[0]!;
    const owners = tokens.slice(1).filter((t) => t.startsWith("@") || t.includes("@"));
    if (owners.length === 0) continue;
    rules.push({ pattern, re: globToRegex(pattern), owners });
  }
  return rules;
}

function stripComment(line: string): string {
  // A `#` only starts a comment when preceded by whitespace or at line start
  // (GitHub allows `#` in patterns only when escaped; we treat plain `#` as
  // comment start — good enough for realistic files).
  const i = line.indexOf("#");
  if (i < 0) return line;
  if (i === 0) return "";
  if (/\s/.test(line[i - 1]!)) return line.slice(0, i);
  return line;
}

/**
 * Translate a CODEOWNERS glob to a regex anchored against a POSIX relative path.
 *
 * Rules distilled from GitHub docs:
 *   - `/` at the start anchors to the repo root (`/foo` → only top-level `foo`).
 *   - No leading `/` matches at any depth (`foo` → matches any `foo`).
 *   - Trailing `/` matches a directory and everything inside.
 *   - `**` matches zero-or-more path segments.
 *   - `*` matches within a single segment.
 *   - `?` matches a single non-`/` character.
 */
export function globToRegex(pattern: string): RegExp {
  const trailingSlash = pattern.endsWith("/");
  let p = pattern;
  if (trailingSlash) p = p.slice(0, -1);

  const anchored = p.startsWith("/");
  if (anchored) p = p.slice(1);

  // Escape regex metachars except our glob wildcards.
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const ch = p[i]!;
    if (ch === "*") {
      if (p[i + 1] === "*") {
        // `**` — zero-or-more path segments.
        re += ".*";
        i++;
        // consume an optional trailing `/` after `**` so `foo/**/bar` matches `foo/bar`
        if (p[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (ch === "?") {
      re += "[^/]";
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      re += "\\" + ch;
    } else {
      re += ch;
    }
  }

  const prefix = anchored ? "^" : "(^|.*/)";
  const suffix = trailingSlash ? "(/.*)?$" : "$";
  return new RegExp(prefix + re + suffix);
}

function toRelative(root: string, filePath: string): string {
  const rel = path.isAbsolute(filePath) ? path.relative(root, filePath) : filePath;
  return rel.split(path.sep).join("/");
}
