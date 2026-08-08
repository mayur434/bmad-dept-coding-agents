#!/usr/bin/env ts-node
/**
 * BMAD Sonar Scan Agent — Dispatcher
 * ====================================
 * Two-step flow:
 *   Step 1 (LLM, via SKILL.md): writes sonar-findings.json
 *   Step 2 (this script, --ingest): JSON → Finding[] → ratings → standardized xlsx
 *
 * Usage:
 *   npx ts-node run.ts --ingest sonar-findings.json --path /project
 *   npx ts-node run.ts --ingest sonar-findings.json --path /project --engine spring
 *   npx ts-node run.ts --ingest sonar-findings.json --path /project --role security
 *   npx ts-node run.ts --path /project --preflight
 *   npx ts-node run.ts --list-engines
 */

import { resolve, join, basename } from "path";
import { existsSync } from "fs";
// Node-core-only + role/install (dep-free) imports are safe on first run.
// Every other shared/* and local module that transitively requires
// third-party packages (exceljs, fast-glob, mammoth) is loaded lazily
// via require() inside main() AFTER ensureDepsInstalled().
import { resolveRole, parseRoleFlag } from "../../shared/role";
import { ensureDepsInstalled } from "../../shared/install";
import { resolveIntake, askAll, confirmRun, Question } from "../../shared/interactive";
import { PROFILES, profileById, detectProfile } from "./engines/profiles";

interface Args {
  path: string;
  engine: string | null;
  ingestJson: string | null;
  output: string | null;
  role: string | undefined;
  listEngines: boolean;
  preflight: boolean;
  noPreflight: boolean;
  createBranch: boolean;
  sourceBranch: string | null;
  yesInstall: boolean;
  noInstall: boolean;
  interactive: boolean;
  technical: boolean;
  /** csv of focus categories (bugs,vulnerabilities,hotspots,smells,duplications,complexity). */
  focus: string | null;
  /** --no-fail: never exit non-zero on Quality Gate FAIL (opt-out for CI configs with their own gate). */
  noFail: boolean;
  /** --auto-ingest: watch for sonar-findings.json to appear, then run Step 2. */
  autoIngest: boolean;
  /** --watch: alias for --auto-ingest. */
  watch: boolean;
  /** --findings-path <path>: where to look for sonar-findings.json (default ./sonar-findings.json). */
  findingsPath: string | null;
  /** --watch-timeout <seconds>: how long to poll before giving up (default 300 = 5min). */
  watchTimeoutSec: number;
  /** Findings gate — bypass filter, use custom path, or keep suppressing after expiry. */
  includeDecided: boolean;
  decisionsPath: string | null;
  ignoreDecisionExpiry: boolean;
  listDecisions: boolean;
  slaPath: string | null;
  noSla: boolean;
  failOnOverdue: boolean;
}

function parseArgs(): Args {
  const a: Args = {
    path: ".",
    engine: null,
    ingestJson: null,
    output: null,
    role: undefined,
    listEngines: false,
    preflight: false,
    noPreflight: false,
    createBranch: false,
    sourceBranch: null,
    yesInstall: false,
    noInstall: false,
    interactive: false,
    technical: false,
    focus: null,
    noFail: false,
    autoIngest: false,
    watch: false,
    findingsPath: null,
    watchTimeoutSec: 300,
    includeDecided: false,
    decisionsPath: null,
    ignoreDecisionExpiry: false,
    listDecisions: false,
    slaPath: null,
    noSla: false,
    failOnOverdue: false,
  };
  const argv = process.argv.slice(2);
  // --role=<code> and --role <code> are both handled by the shared helper.
  a.role = parseRoleFlag(argv);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    // Swallow --role tokens (already captured by parseRoleFlag) so the
    // switch below doesn't misinterpret them.
    if (arg === "--role" && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      i++;
      continue;
    }
    if (arg.startsWith("--role=")) {
      continue;
    }
    switch (arg) {
      case "--path": a.path = argv[++i]; break;
      case "--engine": a.engine = argv[++i]; break;
      case "--ingest": a.ingestJson = argv[++i]; break;
      case "--output": a.output = argv[++i]; break;
      case "--list-engines": a.listEngines = true; break;
      case "--preflight": a.preflight = true; break;
      case "--no-preflight": a.noPreflight = true; break;
      case "--create-branch": a.createBranch = true; break;
      case "--source-branch": a.sourceBranch = argv[++i]; break;
      case "--yes-install": a.yesInstall = true; break;
      case "--no-install": a.noInstall = true; break;
      case "--interactive": a.interactive = true; break;
      case "--technical": a.technical = true; break;
      case "--focus": a.focus = argv[++i]; break;
      case "--no-fail": a.noFail = true; break;
      case "--auto-ingest": a.autoIngest = true; break;
      case "--watch": a.watch = true; break;
      case "--findings-path": a.findingsPath = argv[++i]; break;
      case "--watch-timeout": {
        const raw = argv[++i];
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) {
          console.error(`❌ --watch-timeout expects seconds > 0 (got '${raw}')`);
          process.exit(1);
        }
        a.watchTimeoutSec = n;
        break;
      }
      case "--include-decided": a.includeDecided = true; break;
      case "--decisions-path": a.decisionsPath = argv[++i]; break;
      case "--ignore-decision-expiry": a.ignoreDecisionExpiry = true; break;
      case "--list-decisions": a.listDecisions = true; break;
      case "--sla-path": a.slaPath = argv[++i]; break;
      case "--no-sla": a.noSla = true; break;
      case "--fail-on-overdue": a.failOnOverdue = true; break;
      case "--help":
        console.log(`BMAD Sonar Scan Agent

Usage:
  npx ts-node run.ts --ingest <findings.json> --path <dir> [options]
  npx ts-node run.ts --path <dir> --preflight

Options:
  --ingest <json>        Path to sonar-findings.json (from the LLM scan step)
  --path <dir>           Project root (default: .)
  --engine <id>          Force a stack (auto-detected from findings JSON if omitted)
  --output <dir>         Report output dir (default: <path>/sonar-reports)
  --role <code>          Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content
                         Persisted at <path>/.bmad/role.yaml (see shared/role/ROLES.md).
                         Per-run flag wins over the file; if omitted, .bmad/role.yaml
                         is read; if that is absent, falls back to 'generic'.
                         On --ingest, this OVERRIDES the 'role' field recorded inside
                         sonar-findings.json (a WARN is logged when they differ).
                         Without --ingest (scan step), the role is only recorded/logged;
                         the LLM records the acting role in sonar-findings.json.
  --create-branch        Cut standard branch dca/sonar-scan-<stack>-<timestamp>
                         (takes effect only with --ingest)
  --source-branch <name> Source branch for --create-branch
  --preflight            Print LLM/context advisory and exit
  --no-preflight         Suppress the preflight advisory
  --list-engines         List available rule packs (one per stack)
  --help                 Show this help

Focus filter (Sonar categories):
  --focus <csv>          Restrict the ingest report + rating math to a subset of the
                         6 Sonar categories. Accepted tokens (comma-separated):
                           bugs, vulnerabilities, hotspots, smells, duplications, complexity
                         Examples:
                           --focus vulnerabilities,hotspots
                           --focus complexity
                         Default (flag omitted): all 6 categories (current behavior).
                         Step 1 (LLM scan): SKILL.md instructs the LLM to emit only the
                         requested categories when --focus is set; this CLI cannot enforce
                         that but WILL filter the ingest input to match.

CI Quality Gate:
  --no-fail              Never exit non-zero on Quality Gate FAIL (default behaviour prior
                         to v1.1). Opt-out for CI configs that use their own gate logic.
                         Default: on Quality Gate FAIL the process exits with code 1.

Two-step chaining:
  --auto-ingest          Wait for sonar-findings.json to appear in the CWD (or at
                         --findings-path), then automatically run Step 2 (ingest).
                         Step 1 (LLM scan) is LLM-driven — this dispatcher cannot invoke
                         it. Instead: run 'sonar scan my project at <path>' in the AI
                         chat, and this CLI will pick up the JSON as soon as it lands.
  --watch                Alias of --auto-ingest.
  --findings-path <path> Where to look for sonar-findings.json (default: ./sonar-findings.json).
  --watch-timeout <sec>  How long to poll before giving up (default: 300 seconds / 5 min).

Install control (first-run):
  --yes-install         Install missing dependencies without confirmation.
  --no-install          Error out if dependencies missing (do not install).
                        Default: prompt for confirmation on first run.

Intake mode:
  --interactive         Prompt step-by-step for missing inputs; persist choice to .bmad/intake.yaml.
  --technical           Force technical mode; missing required inputs error out (current default).
                        Without either flag the CLI reads <project>/.bmad/intake.yaml (mode: interactive|technical),
                        falling back to technical when the file is absent.

Findings gate (Phase 1 enterprise features):
  --include-decided                   Show findings even when a decision exists
                                      in .bmad/decisions.yaml (accepted /
                                      deferred / wontfix). Default: filter them out.
  --decisions-path <path>             Override decisions file location.
                                      Default: <projectRoot>/.bmad/decisions.yaml
  --ignore-decision-expiry            Keep suppressing findings even when the
                                      decision has expired. Rarely used.
  --list-decisions                    Print every decision in .bmad/decisions.yaml and exit.

SLA tracking (Phase 1 enterprise features):
  --sla-path <path>           Override SLA file location.
                              Default: <projectRoot>/.bmad/sla.yaml
  --no-sla                    Skip SLA computation + sheet.
  --fail-on-overdue           Exit code 6 if any finding is OVERDUE per role SLA.
                              For CI gates.`);
        process.exit(0);
    }
  }
  return a;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.yesInstall && args.noInstall) {
    console.error("❌ --yes-install and --no-install are mutually exclusive.");
    process.exit(1);
  }
  if (args.interactive && args.technical) {
    console.error("❌ --interactive and --technical are mutually exclusive.");
    process.exit(1);
  }

  if (args.listEngines) {
    console.log("Available sonar-scan rule packs:\n");
    for (const p of PROFILES) {
      console.log(`  ${p.id.padEnd(16)} ${p.name.padEnd(36)} [${p.language}]`);
    }
    console.log("  (aliases: aemcs, aemams → aem; commerce → commerce-paas)");
    return;
  }

  // --list-decisions short-circuits before anything else runs.
  if (args.listDecisions) {
    const root = args.path && args.path !== "." ? resolve(args.path) : process.cwd();
    const { listDecisions } = require("./decisions-gate") as typeof import("./decisions-gate");
    listDecisions(root, args.decisionsPath ?? undefined);
    return;
  }

  // Propagate the findings-gate flags to downstream ingest via env vars.
  if (args.includeDecided) process.env.DCA_INCLUDE_DECIDED = "1";
  if (args.decisionsPath) process.env.DCA_DECISIONS_PATH = resolve(args.decisionsPath);
  if (args.ignoreDecisionExpiry) process.env.DCA_IGNORE_DECISION_EXPIRY = "1";
  // Propagate SLA gate flags via env for downstream ingest.
  if (args.slaPath) process.env.DCA_SLA_PATH = resolve(args.slaPath);
  if (args.noSla) process.env.DCA_NO_SLA = "1";
  if (args.failOnOverdue) process.env.DCA_FAIL_ON_OVERDUE = "1";

  // First-run dependency check. Runs BEFORE the heavy modules are
  // require()'d below — sonar/ingest and shared/preflight transitively
  // need exceljs / fast-glob.
  const bootstrap = await ensureDepsInstalled({
    agentName: "sonar-scan",
    yes: args.yesInstall,
    no: args.noInstall,
  });
  if (bootstrap.exitCode !== 0) process.exit(bootstrap.exitCode);

  // Lazy loads — safe now that node_modules is guaranteed present.
  const { ingest } = require("./sonar/ingest") as typeof import("./sonar/ingest");
  const { runPreflight, renderPreflight } = require("../../shared/preflight") as typeof import("../../shared/preflight");

  // ── Intake mode: --interactive prompts for missing inputs; --technical is
  // the current (silent-error) default. Persisted at <project>/.bmad/intake.yaml.
  const intakeRoot = args.path && args.path !== "." ? resolve(args.path) : process.cwd();
  const intake = resolveIntake({
    projectRoot: intakeRoot,
    cliFlag: args.interactive ? "interactive" : args.technical ? "technical" : undefined,
  });
  process.stderr.write(`[dca-interactive] intake mode: ${intake.mode} (source: ${intake.source})\n`);

  if (intake.mode === "interactive") {
    const questions: Question[] = [
      { key: "path", prompt: "What's the project path?", default: process.cwd() },
      {
        key: "engine",
        prompt: "Which stack?",
        choices: ["auto", "aem", "commerce-paas", "commerce-saas", "sling", "spring", "app-builder", "eds", "eds-commerce"],
        default: "auto",
      },
      {
        key: "ingest-existing",
        prompt: "Do you already have a sonar-findings.json to ingest? (n runs Step 1 LLM scan; y ingests an existing file)",
        choices: ["y", "n"],
        default: "n",
      },
      {
        key: "ingest",
        prompt: "Path to sonar-findings.json",
        when: (a) => a["ingest-existing"] === "y",
      },
      {
        key: "create-branch",
        prompt: "Cut a working branch from production?",
        choices: ["y", "n"],
        default: "y",
      },
    ];
    const existing: Record<string, string | undefined> = {
      path: args.path && args.path !== "." ? args.path : undefined,
      engine: args.engine ?? undefined,
      ingest: args.ingestJson ?? undefined,
    };
    const answers = await askAll({ questions, existing });
    if (answers.path && (args.path === "." || !args.path)) args.path = answers.path;
    if (answers.engine && answers.engine !== "auto" && !args.engine) args.engine = answers.engine;
    if (answers.ingest && !args.ingestJson) args.ingestJson = answers.ingest;
    if (answers["ingest-existing"] === "n") {
      process.stderr.write(
        "[dca-interactive] Note: this is Step 1 of a 2-step run — the LLM scan writes sonar-findings.json (see SKILL.md), then re-run with --ingest to produce the report.\n",
      );
    }
    if (answers["create-branch"] === "y") process.argv.push("--create-branch");

    const summaryCmd = [
      "npx ts-node run.ts",
      args.path ? `--path ${args.path}` : "",
      args.engine ? `--engine ${args.engine}` : "",
      args.ingestJson ? `--ingest ${args.ingestJson}` : "",
      answers["create-branch"] === "y" ? "--create-branch" : "",
    ].filter(Boolean).join(" ");
    const proceed = await confirmRun(summaryCmd);
    if (!proceed) {
      console.log("[dca-interactive] Copy the command above to run manually. Exiting.");
      return;
    }
  }

  const projectPath = resolve(args.path);
  if (!existsSync(projectPath)) {
    console.error(`❌ Project path not found: ${projectPath}`);
    process.exit(1);
  }

  // ── Role resolution (metadata for the report + downstream chaining) ──
  // Order: --role flag  >  <projectRoot>/.bmad/role.yaml  >  generic fallback.
  // In the scan step (no --ingest) the role is only recorded/logged; the LLM
  // records the acting role into sonar-findings.json at Step 1.
  // In the ingest step the resolved role wins over the JSON's role field
  // (see ingest.ts for the WARN on mismatch).
  let resolvedRoleCode = "generic";
  try {
    const resolved = resolveRole({
      projectRoot: projectPath,
      cliFlag: args.role,
      fallbackToGeneric: true,
    });
    resolvedRoleCode = resolved.role.code;
    process.env.DCA_ROLE = resolved.role.code;
    process.env.DCA_ROLE_NAME = resolved.role.name;
    process.env.DCA_ROLE_FLAVOR = resolved.role.defaultOutputFlavor;
    process.env.DCA_ROLE_SOURCE = resolved.source;
    process.stderr.write(
      `[dca-role] ${resolved.role.name} (source: ${resolved.source})\n`,
    );
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }

  // Preflight (advisory only — prints but does not block)
  if (!args.noPreflight) {
    console.log("\n" + renderPreflight(runPreflight(projectPath), { agent: "sonar-scan" }));
    if (args.preflight) return;
  }

  // ── --auto-ingest / --watch: poll for sonar-findings.json ──────────────
  // Step 1 is LLM-driven and cannot be launched from here. Instead, we watch
  // the filesystem for the JSON the AI chat writes; once it appears we hand
  // off to the normal ingest path.
  const wantWatch = args.autoIngest || args.watch;
  if (wantWatch && !args.ingestJson) {
    const watchTarget = resolve(args.findingsPath ?? join(projectPath, "sonar-findings.json"));
    process.stderr.write(
      `[sonar-auto-ingest] Two-step mode: run 'sonar scan my project at ${projectPath}' in the AI chat to produce sonar-findings.json, then this dispatcher will auto-ingest.\n`,
    );
    process.stderr.write(
      `[sonar-auto-ingest] Watching for ${watchTarget} (timeout ${args.watchTimeoutSec}s, poll every 2s)…\n`,
    );
    const foundPath = await pollForFile(watchTarget, args.watchTimeoutSec * 1000, 2000);
    if (!foundPath) {
      console.error(
        `❌ [sonar-auto-ingest] Timed out after ${args.watchTimeoutSec}s waiting for ${watchTarget}. Rerun once the LLM scan has written it.`,
      );
      process.exit(1);
    }
    process.stderr.write(`[sonar-auto-ingest] Found ${foundPath} — proceeding to ingest.\n`);
    args.ingestJson = foundPath;
  }

  if (!args.ingestJson) {
    console.error("❌ --ingest <findings.json> is required for Step 2.");
    console.error("   Run the LLM scan step first (via BMAD skill workflow) to produce sonar-findings.json.");
    console.error("   Tip: rerun with --interactive to be prompted step-by-step, or add 'mode: interactive' to .bmad/intake.yaml.");
    console.error("   Tip: rerun with --auto-ingest (or --watch) to poll for the file automatically.");
    process.exit(1);
  }

  // Resolve stack profile
  const profile = args.engine
    ? profileById(args.engine)
    : detectProfile(projectPath);

  if (!profile) {
    console.error(`❌ Could not resolve a stack profile. Use --engine <id> (see --list-engines).`);
    process.exit(1);
  }

  const outputDir = args.output ?? join(projectPath, "sonar-reports");

  await ingest({
    jsonPath: resolve(args.ingestJson),
    projectRoot: projectPath,
    profile,
    outputDir,
    argv: process.argv,
    role: resolvedRoleCode,
    roleFromCli: args.role !== undefined && args.role !== "",
    focus: args.focus,
    noFail: args.noFail,
  });
}

/** Poll for `target` to exist. Returns absolute path on success, null on timeout. */
async function pollForFile(target: string, timeoutMs: number, intervalMs: number): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(target)) return target;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

main().catch((err) => {
  console.error("❌ Fatal error:", (err as Error).message);
  process.exit(1);
});
