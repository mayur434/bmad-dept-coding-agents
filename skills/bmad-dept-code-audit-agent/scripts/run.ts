#!/usr/bin/env npx ts-node
/**
 * BMAD DEPT Code Agent — Unified Dispatcher
 * ============================================
 * Single entry point for all platform-specific audit engines.
 *
 * Auto-detects project type or accepts explicit --engine flag.
 * Dispatches to the appropriate engine under engines/<platform>/audit.ts.
 *
 * Usage:
 *   npx ts-node run.ts --path /path/to/project                    # auto-detect platform
 *   npx ts-node run.ts --path /path/to/project --engine commerce  # explicit engine
 *   npx ts-node run.ts --list-engines                             # show available engines
 */

import * as fs from "fs";
import * as path from "path";
// Node-core-only imports above are safe on first run (before node_modules
// exists). shared/role and shared/install use no third-party packages;
// every other shared/* module transitively requires exceljs, fast-glob, etc.
// and MUST be loaded lazily via require() below AFTER ensureDepsInstalled().
import { resolveRole, parseRoleFlag } from "../../shared/role";
import { ensureDepsInstalled } from "../../shared/install";
import { resolveIntake, askAll, confirmRun, Question } from "../../shared/interactive";

interface AuditArgs {
  engine?: string;
  path?: string;
  format?: string;
  role?: string;
  listEngines: boolean;
  help: boolean;
  yesInstall: boolean;
  noInstall: boolean;
  interactive: boolean;
  technical: boolean;
  chainAll: boolean;
  chainStages?: string;
  chainStopOnFail: boolean;
  remaining: string[];
}

function parseArgs(argv: string[]): AuditArgs {
  const result: AuditArgs = { engine: undefined, path: undefined, format: undefined, role: undefined, listEngines: false, help: false, yesInstall: false, noInstall: false, interactive: false, technical: false, chainAll: false, chainStages: undefined, chainStopOnFail: false, remaining: [] };
  // --role=<code> and --role <code> are both handled by the shared helper.
  result.role = parseRoleFlag(argv);
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === "--engine" && i + 1 < argv.length) {
      result.engine = argv[++i];
    } else if (argv[i] === "--path" && i + 1 < argv.length) {
      result.path = argv[++i];
    } else if (argv[i] === "--format" && i + 1 < argv.length) {
      result.format = argv[++i];
    } else if (argv[i] === "--role" && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      // Consume value form; parseRoleFlag already captured it.
      i++;
    } else if (argv[i].startsWith("--role=")) {
      // parseRoleFlag already captured it — swallow the token.
    } else if (argv[i] === "--list-engines") {
      result.listEngines = true;
    } else if (argv[i] === "--yes-install") {
      result.yesInstall = true;
    } else if (argv[i] === "--no-install") {
      result.noInstall = true;
    } else if (argv[i] === "--interactive") {
      result.interactive = true;
    } else if (argv[i] === "--technical") {
      result.technical = true;
    } else if (argv[i] === "--chain-all") {
      result.chainAll = true;
    } else if (argv[i] === "--chain-stages" && i + 1 < argv.length) {
      result.chainStages = argv[++i];
    } else if (argv[i] === "--chain-stop-on-fail") {
      result.chainStopOnFail = true;
    } else if (argv[i] === "-h" || argv[i] === "--help") {
      result.help = true;
    } else {
      result.remaining.push(argv[i]);
    }
    i++;
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.yesInstall && args.noInstall) {
    console.error("❌ --yes-install and --no-install are mutually exclusive.");
    process.exit(1);
  }
  if (args.interactive && args.technical) {
    console.error("❌ --interactive and --technical are mutually exclusive.");
    process.exit(1);
  }

  if (args.help && !args.engine) {
    console.log("BMAD DEPT Code Agent — Unified Dispatcher\n");
    console.log("Usage:");
    console.log("  npx ts-node run.ts --path <project>              Auto-detect and audit");
    console.log("  npx ts-node run.ts --engine <name> --path <path> Explicit engine");
    console.log("  npx ts-node run.ts --format <type>               Output format: excel, md, pdf, all");
    console.log("  npx ts-node run.ts --role <code>                 Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content");
    console.log("                                                   (persisted at <project>/.bmad/role.yaml; --role wins for one run)");
    console.log("  npx ts-node run.ts --list-engines                Show available engines");
    console.log("  npx ts-node run.ts --since <ref|ts|last>         Regression / delta vs a prior cached audit run");
    console.log("                                                   (git ref, ISO-8601 timestamp, or 'last')");
    console.log("\nInstall control (first-run):");
    console.log("  --yes-install         Install missing dependencies without confirmation.");
    console.log("  --no-install          Error out if dependencies missing (do not install).");
    console.log("                        Default: prompt for confirmation on first run.");
    console.log("\nIntake mode:");
    console.log("  --interactive         Prompt step-by-step for missing inputs; persist choice to .bmad/intake.yaml.");
    console.log("  --technical           Force technical mode; missing required inputs error out (current default).");
    console.log("                        Without either flag the CLI reads <project>/.bmad/intake.yaml (mode: interactive|technical),");
    console.log("                        falling back to technical when the file is absent.");
    console.log("\nCross-agent chain:");
    console.log("  --chain-all                   Run audit → sonar-scan → test-coverage → impact-analysis in sequence,");
    console.log("                                chaining outputs via the shared findings cache and emitting a Markdown");
    console.log("                                roll-up at <project>/dca-chain-reports/.");
    console.log("  --chain-stages <csv>          Comma-separated subset of stages to run (default: all four).");
    console.log("  --chain-stop-on-fail          Abort the chain on the first stage failure (default: continue).");
    console.log("\nEngine-specific help: npx ts-node run.ts --engine <name> --help");
    return;
  }

  // First-run dependency check. Runs BEFORE the heavy shared/* modules are
  // require()'d below — they transitively need exceljs / fast-glob / etc.
  const bootstrap = await ensureDepsInstalled({
    agentName: "audit",
    yes: args.yesInstall,
    no: args.noInstall,
  });
  if (bootstrap.exitCode !== 0) process.exit(bootstrap.exitCode);

  // ── Cross-agent chain: run audit → sonar-scan → test-coverage → impact-analysis
  //    in sequence, chaining outputs via the shared findings cache. Emits a
  //    Markdown roll-up. All other behavior is bypassed when --chain-all is set.
  if (args.chainAll) {
    const chainRoot = args.path ? path.resolve(args.path) : process.cwd();
    if (!fs.existsSync(chainRoot) || !fs.statSync(chainRoot).isDirectory()) {
      console.error(`❌ Error: --chain-all requires a valid --path (got: ${chainRoot})`);
      process.exit(1);
    }
    const { runChain } = require("../../shared/orchestrator") as typeof import("../../shared/orchestrator");
    const stagesArg = args.chainStages
      ? args.chainStages
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : undefined;
    const validStages = new Set(["audit", "sonar-scan", "test-coverage", "impact-analysis"]);
    if (stagesArg) {
      const bad = stagesArg.filter((s: string) => !validStages.has(s));
      if (bad.length) {
        console.error(`❌ Unknown --chain-stages entries: ${bad.join(", ")}`);
        console.error(`   Valid: ${Array.from(validStages).join(", ")}`);
        process.exit(1);
      }
    }
    const result = await runChain({
      projectRoot: chainRoot,
      stages: stagesArg as any,
      role: args.role,
      yesInstall: args.yesInstall,
      noInstall: args.noInstall,
      stopOnFail: args.chainStopOnFail,
    });
    console.log("\n" + "=".repeat(60));
    console.log(` DCA Chain — ${result.runId}`);
    console.log("=".repeat(60));
    for (const s of result.stages) {
      const findings = s.findingsCount !== undefined ? ` (${s.findingsCount} findings)` : "";
      console.log(`  ${s.stage.padEnd(18)} ${s.status.padEnd(8)} exit=${s.exitCode}${findings}`);
    }
    console.log(`\n📝 Roll-up: ${result.rollupPath || "(not written)"}`);
    const anyFailed = result.stages.some((s) => s.status === "failed");
    process.exit(anyFailed ? 1 : 0);
  }

  // Lazy loads — safe now that node_modules is guaranteed present.
  const { detectPlatform, getEngine, listEngines } = require("./engines/registry") as typeof import("./engines/registry");
  const { runPreflight, renderPreflight } = require("../../shared/preflight") as typeof import("../../shared/preflight");
  const { maybeCutStandardBranch } = require("../../shared/output") as typeof import("../../shared/output");

  // ── Intake mode: --interactive prompts for missing inputs; --technical is
  // the current (silent-error) default. Persisted at <project>/.bmad/intake.yaml
  // so subsequent runs without a flag honor the same choice.
  const intakeRoot = args.path ? path.resolve(args.path) : process.cwd();
  const intake = resolveIntake({
    projectRoot: intakeRoot,
    cliFlag: args.interactive ? "interactive" : args.technical ? "technical" : undefined,
  });
  process.stderr.write(`[dca-interactive] intake mode: ${intake.mode} (source: ${intake.source})\n`);

  if (intake.mode === "interactive" && !args.listEngines && !args.help) {
    const questions: Question[] = [
      { key: "path", prompt: "What's the project path?", default: process.cwd() },
      {
        key: "engine",
        prompt: "Which stack?",
        choices: ["auto", "aem", "commerce", "commerce-saas", "sling", "spring", "app-builder", "eds", "eds-commerce"],
        default: "auto",
      },
      {
        key: "mode",
        prompt: "Full audit, scan-only (fast Tier-1), or deep-audit (LLM only)?",
        choices: ["full", "scan-only", "deep-audit"],
        default: "full",
      },
      { key: "brd", prompt: "BRD .docx path (Enter to skip)", optional: true },
      { key: "bugs", prompt: "Bug CSV path (Enter to skip)", optional: true },
      {
        key: "db",
        prompt: "DB .sql dump path (Enter to skip)",
        optional: true,
        when: (a) => (a.engine ?? "").toLowerCase() === "commerce",
      },
      {
        key: "create-branch",
        prompt: "Cut a working branch from production?",
        choices: ["y", "n"],
        default: "y",
      },
    ];
    const existing: Record<string, string | undefined> = {
      path: args.path,
      engine: args.engine,
    };
    const answers = await askAll({ questions, existing });
    if (answers.path && !args.path) args.path = answers.path;
    if (answers.engine && !args.engine && answers.engine !== "auto") args.engine = answers.engine;
    if (answers.mode) args.remaining.push("--mode", answers.mode);
    if (answers.brd) args.remaining.push("--brd", answers.brd);
    if (answers.bugs) args.remaining.push("--bugs", answers.bugs);
    if (answers.db) args.remaining.push("--db", answers.db);
    if (answers["create-branch"] === "y") args.remaining.push("--create-branch");

    const summaryCmd = [
      "npx ts-node run.ts",
      args.path ? `--path ${args.path}` : "",
      args.engine ? `--engine ${args.engine}` : "",
      ...args.remaining,
    ].filter(Boolean).join(" ");
    const proceed = await confirmRun(summaryCmd);
    if (!proceed) {
      console.log("[dca-interactive] Copy the command above to run manually. Exiting.");
      return;
    }
  }

  if (args.listEngines) {
    console.log("Available audit engines:");
    console.log("─".repeat(50));
    for (const [eid, desc] of listEngines()) {
      console.log(`  ${eid.padEnd(15)} ${desc}`);
    }
    console.log(`\nUsage: npx ts-node run.ts --engine <name> --path /project [engine-specific flags]`);
    return;
  }

  // Resolve project path
  let projectPath = args.path;
  if (projectPath) {
    projectPath = path.resolve(projectPath);
    if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
      console.error(`❌ Error: Project path does not exist: ${projectPath}`);
      process.exit(1);
    }
  }

  // Determine engine
  let engineId = args.engine;
  if (!engineId) {
    if (!projectPath) {
      console.error("❌ Error: Either --engine or --path is required.");
      console.error("   Use --list-engines to see available platforms.");
      console.error("   Tip: rerun with --interactive to be prompted step-by-step, or add 'mode: interactive' to .bmad/intake.yaml.");
      process.exit(1);
    }

    const detected = detectPlatform(projectPath);
    if (detected.length === 0) {
      console.error(`❌ Could not auto-detect project type at: ${projectPath}`);
      console.error("   Use --engine to specify explicitly. Available engines:");
      for (const [eid, desc] of listEngines()) {
        console.error(`     ${eid.padEnd(15)} ${desc}`);
      }
      process.exit(1);
    }

    if (detected.length > 1) {
      engineId = detected.includes("eds-commerce") ? "eds-commerce" : detected[0];
      console.log(`🔍 Multiple platforms detected: ${detected.join(", ")}`);
      console.log(`   Using: ${engineId} (override with --engine)`);
    } else {
      engineId = detected[0];
      console.log(`🔍 Detected platform: ${engineId}`);
    }
  }

  // Validate engine exists
  const engineCfg = getEngine(engineId);
  if (!engineCfg) {
    console.error(`❌ Unknown engine: ${engineId}`);
    console.error("   Available engines:");
    for (const [eid, desc] of listEngines()) {
      console.error(`     ${eid.padEnd(15)} ${desc}`);
    }
    process.exit(1);
  }

  // ── Role resolution (metadata for the report + downstream chaining) ──
  // Order: --role flag  >  <projectRoot>/.bmad/role.yaml  >  generic fallback.
  // We only log + set DCA_ROLE for engines; engine dispatch is unchanged.
  if (projectPath) {
    try {
      const resolved = resolveRole({
        projectRoot: projectPath,
        cliFlag: args.role,
        fallbackToGeneric: true,
      });
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
  }

  // ── Conversational preflight: current LLM + Static-vs-LLM recommendation ──
  if (projectPath && !process.argv.includes("--no-preflight")) {
    console.log(renderPreflight(runPreflight(projectPath), { agent: "audit", stack: engineId }));
    console.log("");
    if (process.argv.includes("--preflight")) return;
  }

  // ── Standard branch (output C): cut dca/audit-<stack>-<ts> from production/shared ──
  if (projectPath) maybeCutStandardBranch(process.argv, { agent: "audit", stack: engineId, projectRoot: projectPath });

  // Build forwarded argv for the engine (strip branch flags — the dispatcher already cut it)
  const engineArgv: string[] = [];
  if (projectPath) {
    engineArgv.push("--path", projectPath);
  }
  if (args.format) {
    engineArgv.push("--format", args.format);
  }
  for (let i = 0; i < args.remaining.length; i++) {
    if (args.remaining[i] === "--create-branch") continue;
    if (args.remaining[i] === "--source-branch") { i++; continue; }
    engineArgv.push(args.remaining[i]);
  }
  if (args.help) {
    engineArgv.push("--help");
  }

  // Dispatch to engine
  const engineDir = path.join(__dirname, "engines", engineId);

  if (!fs.existsSync(engineDir)) {
    console.error(`⚠️  Engine '${engineId}' is registered but not yet implemented.`);
    console.error(`   Expected directory: engines/${engineId}/`);
    console.error(`   Create engines/${engineId}/audit.ts to implement this engine.`);
    process.exit(1);
  }

  const engineEntry = path.join(engineDir, "audit.ts");
  if (!fs.existsSync(engineEntry)) {
    console.error(`⚠️  Engine '${engineId}' directory exists but audit.ts not found.`);
    console.error(`   Expected: ${engineEntry}`);
    process.exit(1);
  }

  // Override process.argv for the engine's arg parsing
  process.argv = ["ts-node", "audit.ts", ...engineArgv];

  console.log(`\n${"=".repeat(60)}`);
  console.log(` Dispatching to: ${engineCfg.description}`);
  console.log(`${"=".repeat(60)}\n`);

  // Import and run the engine
  const engine = await import(engineEntry);
  if (typeof engine.main === "function") {
    await engine.main();
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
