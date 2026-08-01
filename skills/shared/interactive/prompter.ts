/**
 * DCA Shared — Interactive prompter + intake-file persistence.
 * ============================================================
 * Zero external dependencies (Node core only). Safe to import from every
 * agent's run.ts BEFORE the plugin's node_modules has been populated —
 * every other shared/* module transitively requires third-party packages
 * (exceljs, fast-glob, ...), so this module MUST stay dependency-free.
 *
 * Purpose:
 *   - Ask a series of Q&A questions on stdin to fill in required inputs
 *     when the user launches an agent with `--interactive`.
 *   - Persist the intake-mode preference at `<projectRoot>/.bmad/intake.yaml`
 *     (adjacent to `.bmad/role.yaml`) so subsequent runs can honor it.
 *
 * Contract mirrors the `Intake mode` section landed in every SKILL.md.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";

// ─────────────────────────────────────────────────────────────────────────────
// Interactive prompter
// ─────────────────────────────────────────────────────────────────────────────

export interface Question {
  /** Arg name — the key set on the returned answers map (e.g. 'path', 'engine'). */
  key: string;
  /** Human-readable prompt text. */
  prompt: string;
  /** Default value shown in brackets when nonempty; used on Enter. */
  default?: string;
  /** If set, offer as (a)|(b)|(c) picker and validate against these values. */
  choices?: string[];
  /** Enter without a default skips the question and leaves it undefined. */
  optional?: boolean;
  /** Conditional: only ask when this returns true given prior answers. */
  when?: (answers: Record<string, string>) => boolean;
}

export interface AskOpts {
  questions: Question[];
  /** Values already provided via CLI flags — matching keys skip their question. */
  existing?: Record<string, string | undefined>;
  /** Override TTY detection (defaults to `process.stdin.isTTY`). */
  hasTTY?: boolean;
}

const PROMPT_PREFIX = "[dca-interactive]";

/**
 * Prompt for each question in order, honoring `existing`, `when`, `default`,
 * `choices`, and `optional`. Returns the collected answers (does NOT include
 * unanswered optional keys).
 *
 * On headless (no TTY) the function throws a clear error naming every
 * unresolved required question so callers can print it and exit.
 */
export async function askAll(opts: AskOpts): Promise<Record<string, string>> {
  const existing = opts.existing ?? {};
  const answers: Record<string, string> = {};
  // Seed the answers map with anything the caller already resolved via CLI
  // flags, so `when()` predicates can see them.
  for (const [k, v] of Object.entries(existing)) {
    if (v !== undefined && v !== "") answers[k] = v;
  }

  const hasTTY =
    typeof opts.hasTTY === "boolean" ? opts.hasTTY : Boolean(process.stdin.isTTY);

  // Pre-flight: if no TTY, fail early with the full list of unresolved
  // required questions rather than getting stuck on readline.
  if (!hasTTY) {
    const unresolved: string[] = [];
    for (const q of opts.questions) {
      if (answers[q.key] !== undefined) continue;
      if (q.when && !q.when(answers)) continue;
      if (q.optional) continue;
      if (q.default !== undefined && q.default !== "") continue;
      unresolved.push(`--${q.key}  (${q.prompt})`);
    }
    if (unresolved.length > 0) {
      throw new Error(
        `${PROMPT_PREFIX} --interactive requires a TTY, and the following required inputs are missing:\n` +
          unresolved.map((u) => `  - ${u}`).join("\n") +
          `\n${PROMPT_PREFIX} Re-run in a terminal, or pass the missing flags directly.`,
      );
    }
    // Everything can be filled from defaults / optional-skip. Fill in silently
    // without touching stdin (which would block waiting for EOF).
    for (const q of opts.questions) {
      if (answers[q.key] !== undefined) continue;
      if (q.when && !q.when(answers)) continue;
      if (q.default !== undefined && q.default !== "") answers[q.key] = q.default;
    }
    return answers;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: hasTTY,
  });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, (a) => resolve(a ?? "")));

  try {
    for (const q of opts.questions) {
      if (answers[q.key] !== undefined) continue;
      if (q.when && !q.when(answers)) continue;

      const hasDefault = q.default !== undefined && q.default !== "";
      let promptText = `${PROMPT_PREFIX} ${q.prompt}`;
      if (q.choices && q.choices.length > 0) {
        promptText += ` [${q.choices.join("|")}]`;
      }
      if (hasDefault) {
        promptText += ` [${q.default}]`;
      } else if (q.optional) {
        promptText += ` [Enter to skip]`;
      }
      promptText += "? ";

      // Loop until we get a valid response.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const raw = (await ask(promptText)).trim();
        if (raw === "") {
          if (hasDefault) {
            answers[q.key] = q.default as string;
            break;
          }
          if (q.optional) {
            // Leave unset.
            break;
          }
          process.stderr.write(
            `${PROMPT_PREFIX} A value is required for --${q.key}.\n`,
          );
          continue;
        }
        if (q.choices && q.choices.length > 0) {
          if (!q.choices.includes(raw)) {
            process.stderr.write(
              `${PROMPT_PREFIX} Invalid choice "${raw}". Expected one of: ${q.choices.join(", ")}.\n`,
            );
            continue;
          }
        }
        answers[q.key] = raw;
        break;
      }
    }
  } finally {
    rl.close();
  }

  return answers;
}

/**
 * After collection, print a shell-friendly resolved command and ask whether
 * to run it now. Returns true if the user confirmed (Enter or Y); false if
 * declined (n).
 *
 * On non-TTY, prints the command and returns true (no interactive prompt).
 */
export async function confirmRun(
  cmd: string,
  hasTTYOverride?: boolean,
): Promise<boolean> {
  const hasTTY =
    typeof hasTTYOverride === "boolean"
      ? hasTTYOverride
      : Boolean(process.stdin.isTTY);
  process.stderr.write(`\n${PROMPT_PREFIX} Resolved command:\n  ${cmd}\n\n`);
  if (!hasTTY) return true;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: true,
  });
  try {
    const answer: string = await new Promise((resolve) =>
      rl.question(`${PROMPT_PREFIX} Run this now? (Y/n) `, (a) => resolve(a ?? "")),
    );
    const a = answer.trim().toLowerCase();
    return a === "" || a === "y" || a === "yes";
  } finally {
    rl.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Intake-mode file persistence  (<projectRoot>/.bmad/intake.yaml)
// ─────────────────────────────────────────────────────────────────────────────

export type IntakeMode = "interactive" | "technical";

export interface IntakeFile {
  mode: IntakeMode;
  /** ISO-8601 timestamp of when the preference was saved. */
  setAt: string;
}

export function intakeFilePath(projectRoot: string): string {
  return path.join(projectRoot, ".bmad", "intake.yaml");
}

export function readIntakeFile(projectRoot: string): IntakeFile | null {
  const p = intakeFilePath(projectRoot);
  if (!fs.existsSync(p)) return null;
  let raw: string;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch (err) {
    process.stderr.write(
      `[dca-interactive] WARN: unable to read ${p}: ${(err as Error).message}\n`,
    );
    return null;
  }
  const parsed = parseIntakeYaml(raw);
  if (!parsed) {
    process.stderr.write(
      `[dca-interactive] WARN: ${p} is malformed or missing required fields; ignoring.\n`,
    );
    return null;
  }
  return parsed;
}

export function writeIntakeFile(
  projectRoot: string,
  mode: IntakeMode,
): void {
  if (mode !== "interactive" && mode !== "technical") {
    throw new Error(`writeIntakeFile: invalid mode "${mode}"`);
  }
  const bmadDir = path.join(projectRoot, ".bmad");
  if (!fs.existsSync(bmadDir)) fs.mkdirSync(bmadDir, { recursive: true });
  const body = serializeIntakeYaml({ mode, setAt: new Date().toISOString() });
  const tmp = path.join(
    bmadDir,
    `.intake.yaml.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tmp, body, { encoding: "utf8", mode: 0o644 });
  fs.renameSync(tmp, intakeFilePath(projectRoot));
}

function serializeIntakeYaml(f: IntakeFile): string {
  const lines: string[] = [];
  lines.push("# BMAD DCA — intake mode preference");
  lines.push(
    "# Set by an agent's --interactive/--technical flag or by asking the LLM to switch modes.",
  );
  lines.push(`mode: ${f.mode}`);
  lines.push(`set_at: ${f.setAt}`);
  return lines.join(os.EOL) + os.EOL;
}

function parseIntakeYaml(raw: string): IntakeFile | null {
  const lines = raw.split(/\r?\n/);
  let mode: string | undefined;
  let setAt: string | undefined;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(trimmed);
    if (!m) return null;
    const key = m[1]!;
    const value = stripQuotes(m[2]!.trim());
    switch (key) {
      case "mode":
        mode = value;
        break;
      case "set_at":
        setAt = value;
        break;
      default:
        // Unknown key — treat as malformed to avoid silently ignoring drift.
        return null;
    }
  }
  if (!mode || !setAt) return null;
  if (mode !== "interactive" && mode !== "technical") return null;
  return { mode, setAt };
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

// ─────────────────────────────────────────────────────────────────────────────
// Intake-mode resolver — combines CLI flag > intake-file > default 'technical'
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolveIntakeOpts {
  projectRoot: string;
  /** --interactive or --technical (undefined if neither was passed). */
  cliFlag?: IntakeMode;
}

export interface ResolvedIntake {
  mode: IntakeMode;
  source: "cli-flag" | "intake-file" | "default";
}

/**
 * Resolution order:
 *   1. CLI flag (`--interactive` / `--technical`)          → source: cli-flag
 *   2. `<projectRoot>/.bmad/intake.yaml`                   → source: intake-file
 *   3. default `technical`  (backward compat — no prompt)  → source: default
 *
 * When the CLI flag is present, this function ALSO persists the preference
 * so the next run without a flag honors the same choice.
 */
export function resolveIntake(opts: ResolveIntakeOpts): ResolvedIntake {
  if (opts.cliFlag === "interactive" || opts.cliFlag === "technical") {
    try {
      writeIntakeFile(opts.projectRoot, opts.cliFlag);
    } catch (err) {
      // Persistence failure is non-fatal — surface a warning and continue.
      process.stderr.write(
        `[dca-interactive] WARN: could not persist intake preference: ${(err as Error).message}\n`,
      );
    }
    return { mode: opts.cliFlag, source: "cli-flag" };
  }
  const file = readIntakeFile(opts.projectRoot);
  if (file) return { mode: file.mode, source: "intake-file" };
  return { mode: "technical", source: "default" };
}
