/**
 * DCA Shared — First-run dependency install helper.
 * =================================================
 * Zero external dependencies (Node core only). Safe to import from every
 * agent's run.ts BEFORE the plugin's node_modules has been populated —
 * every other shared/ module transitively requires third-party packages
 * (exceljs, fast-glob, ...), so those imports MUST be deferred to lazy
 * require() calls that run AFTER ensureDepsInstalled() has returned.
 *
 * Mirrors the contract of skills/shared/bootstrap.sh so headless / CI
 * callers get identical behavior whether they invoke the shell script
 * directly or dispatch through an agent's run.ts:
 *
 *   Behavior
 *   --------
 *   - Both node_modules present         → silent no-op, exitCode 0
 *   - One or both missing, --yes        → install without prompt
 *   - One or both missing, --no         → do not install, exitCode 2
 *   - One or both missing, interactive  → prompt (Y/n); decline → exitCode 3
 *   - One or both missing, non-TTY, no  → treat as declined, exitCode 3
 *     --yes/--no flag
 *   - `npm install` non-zero            → exitCode 4
 *
 *   Exit codes (match bootstrap.sh):
 *     0 success  ·  2 missing (--no)  ·  3 declined  ·  4 install error
 */

import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import * as readline from "readline";

export type InstallAgentName =
  | "audit"
  | "sonar-scan"
  | "generation"
  | "impact-analysis"
  | "test-coverage"
  | "requirements"
  | "architecture";

/** Canonical skill directory names, keyed by agent short-name. */
const AGENT_DIRS: Record<InstallAgentName, string> = {
  "audit": "bmad-dept-code-audit-agent",
  "sonar-scan": "bmad-dept-code-sonar-scan-agent",
  "generation": "bmad-dept-code-generation-agent",
  "impact-analysis": "bmad-dept-code-impact-analysis-agent",
  "test-coverage": "bmad-dept-code-test-coverage-agent",
  "requirements": "bmad-dept-code-requirements-agent",
  "architecture": "bmad-dept-code-architecture-agent",
};

export interface EnsureDepsOpts {
  agentName: InstallAgentName;
  /** Skip confirmation; install missing deps unconditionally. */
  yes?: boolean;
  /** Do not install; return exitCode 2 if anything is missing. */
  no?: boolean;
  /**
   * Optional override for the skills/ root (the directory containing
   * `shared/` and every `bmad-dept-code-*-agent/`). Defaults to the
   * skills/ root inferred from this file's location.
   */
  skillsRoot?: string;
}

export interface EnsureDepsResult {
  action: "noop" | "installed" | "declined" | "missing" | "failed";
  installedShared: boolean;
  installedAgent: boolean;
  exitCode: 0 | 2 | 3 | 4;
}

function hasNodeModules(dir: string): boolean {
  try {
    return fs.statSync(path.join(dir, "node_modules")).isDirectory();
  } catch {
    return false;
  }
}

function findSkillsRoot(startDir: string): string | null {
  let cur = path.resolve(startDir);
  const root = path.parse(cur).root;
  for (let i = 0; i < 12; i++) {
    const shared = path.join(cur, "shared");
    let sharedIsDir = false;
    try {
      sharedIsDir = fs.statSync(shared).isDirectory();
    } catch {
      sharedIsDir = false;
    }
    if (sharedIsDir) {
      try {
        const names = fs.readdirSync(cur);
        if (
          names.some(
            (n) => n.startsWith("bmad-dept-code-") && n.endsWith("-agent"),
          )
        ) {
          return cur;
        }
      } catch {
        // ignore permission errors, walk further up
      }
    }
    if (cur === root) return null;
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
  return null;
}

function askYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });
    rl.question(question, (answer) => {
      rl.close();
      const a = (answer ?? "").trim().toLowerCase();
      // Default (empty) is Yes, matching the "(Y/n)" convention.
      resolve(a === "" || a === "y" || a === "yes");
    });
  });
}

function npmInstall(dir: string, label: string): boolean {
  process.stderr.write(
    `[dca-bootstrap] Installing ${label} (npm install in ${dir})...\n`,
  );
  const r = spawnSync(
    "npm",
    ["install", "--silent", "--no-audit", "--no-fund"],
    { cwd: dir, stdio: "inherit" },
  );
  return r.status === 0;
}

export async function ensureDepsInstalled(
  opts: EnsureDepsOpts,
): Promise<EnsureDepsResult> {
  const { agentName, yes = false, no = false } = opts;

  if (yes && no) {
    // Caller should have caught this; be defensive anyway.
    process.stderr.write(
      "[dca-bootstrap] --yes-install and --no-install are mutually exclusive.\n",
    );
    return {
      action: "failed",
      installedShared: false,
      installedAgent: false,
      exitCode: 4,
    };
  }

  // Locate the skills/ root. This file lives at skills/shared/install/
  // so ../.. from __dirname is the skills/ directory.
  const defaultRoot = path.resolve(__dirname, "..", "..");
  const skillsRoot =
    opts.skillsRoot ?? findSkillsRoot(defaultRoot) ?? defaultRoot;

  const sharedDir = path.join(skillsRoot, "shared");
  const agentScriptsDir = path.join(
    skillsRoot,
    AGENT_DIRS[agentName],
    "scripts",
  );

  const sharedMissing = !hasNodeModules(sharedDir);
  const agentMissing = !hasNodeModules(agentScriptsDir);

  if (!sharedMissing && !agentMissing) {
    return {
      action: "noop",
      installedShared: false,
      installedAgent: false,
      exitCode: 0,
    };
  }

  const missing: string[] = [];
  if (sharedMissing) missing.push("shared/");
  if (agentMissing) missing.push(`${agentName}/scripts/`);

  if (no) {
    process.stderr.write(
      `[dca-bootstrap] Dependencies missing (${missing.join(", ")}) and --no-install was passed.\n` +
        `[dca-bootstrap] Install manually: bash skills/shared/bootstrap.sh ${agentName} --yes\n`,
    );
    return {
      action: "missing",
      installedShared: false,
      installedAgent: false,
      exitCode: 2,
    };
  }

  if (!yes) {
    if (!process.stdin.isTTY) {
      process.stderr.write(
        `[dca-bootstrap] Dependencies missing (${missing.join(", ")}) and stdin is not a TTY.\n` +
          `[dca-bootstrap] Re-run with --yes-install (auto-install) or --no-install (skip).\n`,
      );
      return {
        action: "declined",
        installedShared: false,
        installedAgent: false,
        exitCode: 3,
      };
    }
    process.stderr.write(
      `[dca-bootstrap] First-run dependency install needed — ~80MB across shared/ and ${agentName}/ (~30–60s).\n`,
    );
    const proceed = await askYesNo(
      "[dca-bootstrap] Proceed? (Y/n) ",
    );
    if (!proceed) {
      process.stderr.write("[dca-bootstrap] Install declined.\n");
      return {
        action: "declined",
        installedShared: false,
        installedAgent: false,
        exitCode: 3,
      };
    }
  }

  let installedShared = false;
  let installedAgent = false;

  if (sharedMissing) {
    if (!npmInstall(sharedDir, "shared/")) {
      process.stderr.write(
        "[dca-bootstrap] Failed to install shared dependencies.\n",
      );
      return {
        action: "failed",
        installedShared: false,
        installedAgent: false,
        exitCode: 4,
      };
    }
    installedShared = true;
  }
  if (agentMissing) {
    if (!npmInstall(agentScriptsDir, `${agentName}/scripts/`)) {
      process.stderr.write(
        `[dca-bootstrap] Failed to install ${agentName} dependencies.\n`,
      );
      return {
        action: "failed",
        installedShared,
        installedAgent: false,
        exitCode: 4,
      };
    }
    installedAgent = true;
  }

  process.stderr.write("[dca-bootstrap] Dependencies ready.\n");
  return {
    action: "installed",
    installedShared,
    installedAgent,
    exitCode: 0,
  };
}
