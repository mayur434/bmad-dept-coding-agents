/**
 * DCA Shared — Git helpers
 * =========================
 * Thin, safe wrappers over git for: detecting the working branch (feeds the
 * report file name) and creating the standard working branch from the
 * production/shared branch (standard output "C"). All calls are best-effort and
 * degrade gracefully outside a git repo.
 */

import { execFileSync } from "child_process";

export interface GitResult {
  ok: boolean;
  stdout: string;
  error?: string;
}

function git(args: string[], cwd: string): GitResult {
  try {
    const stdout = execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stdout: stdout.trim() };
  } catch (err) {
    const e = err as { stderr?: Buffer; message?: string };
    return { ok: false, stdout: "", error: (e.stderr?.toString() || e.message || "git error").trim() };
  }
}

export function isGitRepo(cwd: string): boolean {
  return git(["rev-parse", "--is-inside-work-tree"], cwd).stdout === "true";
}

export function repoRoot(cwd: string): string | null {
  const r = git(["rev-parse", "--show-toplevel"], cwd);
  return r.ok ? r.stdout : null;
}

/** Current branch name, or null (detached HEAD / not a repo). */
export function currentBranch(cwd: string): string | null {
  const r = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  if (!r.ok || r.stdout === "HEAD") return null;
  return r.stdout;
}

/** True if the branch exists locally. */
export function branchExists(cwd: string, branch: string): boolean {
  return git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], cwd).ok;
}

/** Resolve the best available source branch from a candidate list (first that exists). */
export function resolveSourceBranch(cwd: string, candidates: string[]): string | null {
  for (const c of candidates) {
    if (branchExists(cwd, c)) return c;
    // also accept remote-tracking form
    if (git(["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${c}`], cwd).ok) return c;
  }
  return null;
}

export interface CreateBranchOptions {
  cwd: string;
  /** The branch to create. */
  newBranch: string;
  /** Production/shared branch to cut from. */
  sourceBranch: string;
  /** Check out the new branch after creating it (default true). */
  checkout?: boolean;
}

export interface CreateBranchResult extends GitResult {
  created: boolean;
  newBranch: string;
  sourceBranch: string;
  alreadyExisted: boolean;
}

/**
 * Create the standard working branch from the production/shared branch.
 * MUTATES git state — call only when the agent is explicitly asked to.
 * Idempotent: if the branch already exists it is not recreated.
 */
export function createStandardBranch(opts: CreateBranchOptions): CreateBranchResult {
  const { cwd, newBranch, sourceBranch, checkout = true } = opts;
  const base: CreateBranchResult = {
    ok: false, stdout: "", created: false, newBranch, sourceBranch, alreadyExisted: false,
  };

  if (!isGitRepo(cwd)) return { ...base, error: "not a git repository" };

  if (branchExists(cwd, newBranch)) {
    const co = checkout ? git(["checkout", newBranch], cwd) : { ok: true, stdout: "" };
    return { ...base, ok: co.ok, alreadyExisted: true, error: co.ok ? undefined : co.error };
  }

  // Verify source exists (local or remote).
  const src = resolveSourceBranch(cwd, [sourceBranch]);
  if (!src) return { ...base, error: `source branch not found: ${sourceBranch}` };

  const args = checkout
    ? ["checkout", "-b", newBranch, sourceBranch]
    : ["branch", newBranch, sourceBranch];
  const r = git(args, cwd);
  return { ...base, ok: r.ok, created: r.ok, stdout: r.stdout, error: r.ok ? undefined : r.error };
}
