/**
 * Impact Analysis — PR-diff input
 * ================================
 * Produces InputItems from a git diff — the most common real input for impact
 * analysis. Supported forms:
 *
 *   --pr <a>..<b>       diff between two refs (git diff --name-only a..b)
 *   --pr <sha>          diff <sha> against the first existing default branch
 *                       (main | master | develop | production)
 *   --diff              uncommitted working-tree changes (git diff --name-only HEAD)
 *
 * Doc/config paths (README.md, package.json, docs/*, etc.) are filtered out so
 * the tracer only spends its budget on source code.
 */

import { execFileSync } from "child_process";
import * as path from "path";
import { InputItem } from "./types";
import { resolveSourceBranch } from "../../../shared/git";

const DEFAULT_BASE_CANDIDATES = ["main", "master", "develop", "production"];

const SKIP_EXTENSIONS = new Set([
  ".md", ".txt", ".lock", ".yml", ".yaml", ".json", ".toml", ".gitignore", ".gitattributes",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".pdf",
]);

const SKIP_DIR_PREFIXES = ["docs/", "documentation/", ".github/", "node_modules/"];
const SKIP_BASENAMES = new Set([
  "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "composer.lock",
  "README", "README.md", "CHANGELOG", "CHANGELOG.md", "LICENSE",
]);

export interface PrDiffOptions {
  projectRoot: string;
  /** Either "a..b" or a single ref (treated as PR head). Mutually exclusive with `useWorkingTree`. */
  pr?: string;
  /** Uncommitted working-tree changes (git diff HEAD). */
  useWorkingTree?: boolean;
}

export interface PrDiffResult {
  items: InputItem[];
  /** The command that produced the file list — useful for logs. */
  spec: string;
  changedFiles: string[];
}

export function readPrDiff(opts: PrDiffOptions): PrDiffResult {
  const cwd = opts.projectRoot;

  let args: string[];
  let spec: string;
  if (opts.useWorkingTree) {
    args = ["diff", "--name-only", "HEAD"];
    spec = "working tree vs HEAD";
  } else if (opts.pr && opts.pr.length > 0) {
    const range = normalizeRange(cwd, opts.pr);
    args = ["diff", "--name-only", range];
    spec = range;
  } else {
    throw new Error("readPrDiff: pass either --pr <ref[..ref]> or --diff");
  }

  let out: string;
  try {
    out = execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (err) {
    const e = err as { stderr?: Buffer; message?: string };
    throw new Error(`git ${args.join(" ")} failed: ${(e.stderr?.toString() || e.message || "").trim()}`);
  }

  const raw = out.length === 0 ? [] : out.split("\n").map((l) => l.trim()).filter(Boolean);
  const changedFiles = raw.filter(isSourceFile);
  const items = changedFiles.map((f, i) => toItem(f, i, spec));
  return { items, spec, changedFiles };
}

/** Normalize `--pr` argument into a `git diff` range. */
function normalizeRange(cwd: string, pr: string): string {
  if (pr.includes("..")) return pr;
  // Single ref: treat as PR head, diff against the first existing default base.
  const base = resolveSourceBranch(cwd, DEFAULT_BASE_CANDIDATES);
  if (!base) {
    throw new Error(
      `--pr <sha> needs a base branch (tried ${DEFAULT_BASE_CANDIDATES.join(", ")}); pass --pr <base>..<head> instead`,
    );
  }
  return `${base}..${pr}`;
}

function toItem(file: string, index: number, spec: string): InputItem {
  const base = path.basename(file);
  const dir = path.dirname(file);
  return {
    id: `PR-${String(index + 1).padStart(3, "0")}`,
    kind: "pr",
    title: `PR change: ${file}`,
    description: `File ${file} changed in ${spec}. Trace reverse-dependency blast radius.`,
    module: dir && dir !== "." ? dir : base,
    source: spec,
  };
}

function isSourceFile(file: string): boolean {
  if (SKIP_BASENAMES.has(path.basename(file))) return false;
  const lower = file.toLowerCase();
  for (const p of SKIP_DIR_PREFIXES) if (lower.startsWith(p)) return false;
  const ext = path.extname(file).toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return false;
  return true;
}
