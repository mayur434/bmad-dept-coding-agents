#!/usr/bin/env ts-node
/**
 * BMAD Impact Analysis Agent — Dispatcher
 * ==========================================
 * INPUT : a Proofhub bug export (CSV) and/or a BRD document (.docx / .md / .txt)
 * OUTPUT: the standardized impact report — each bug/requirement traced to impacted
 *         code with blast radius + risk, on the Input-Traceability sheet + CHANGE-LOG.
 *
 * Usage:
 *   npx ts-node run.ts --path /project --bugs proofhub-export.csv
 *   npx ts-node run.ts --path /project --brd requirements.docx --engine spring
 *   npx ts-node run.ts --path /project --bugs bugs.csv --brd brd.md
 *   npx ts-node run.ts --list-engines
 */

import { resolve, basename, join } from "path";
import { existsSync } from "fs";
// Node-core-only + role/install (dep-free) imports are safe on first run.
// Every other module below transitively requires third-party packages
// (exceljs, fast-glob, mammoth, ...) and MUST be loaded lazily via
// require() inside main() AFTER ensureDepsInstalled().
import { computeCounts, RecommendationRow, SEVERITIES } from "../../shared/core/types";
import type { InputItem } from "./inputs/types";
import { readProofhubCsv, describeMapping } from "./inputs/proofhub";
import { PROFILES, profileById, detectProfile } from "./engines/profiles";
import { resolveRole, parseRoleFlag } from "../../shared/role";
import { ensureDepsInstalled } from "../../shared/install";
import { resolveIntake, askAll, confirmRun, Question } from "../../shared/interactive";

interface Args {
  path: string;
  engine: string | null;
  bugs: string | null;
  brd: string | null;
  output: string | null;
  role: string | undefined;
  listEngines: boolean;
  createBranch: boolean;
  sourceBranch: string | null;
  preflight: boolean;
  noPreflight: boolean;
  yesInstall: boolean;
  noInstall: boolean;
  interactive: boolean;
  technical: boolean;
  analysis: string | null;
}

function parseArgs(): Args {
  const a: Args = {
    path: ".", engine: null, bugs: null, brd: null, output: null, role: undefined,
    listEngines: false,
    createBranch: false, sourceBranch: null, preflight: false, noPreflight: false,
    yesInstall: false, noInstall: false,
    interactive: false, technical: false, analysis: null,
  };
  const argv = process.argv.slice(2);
  // --role=<code> and --role <code> are both handled by the shared helper.
  a.role = parseRoleFlag(argv);
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--path": a.path = argv[++i]; break;
      case "--engine": a.engine = argv[++i]; break;
      case "--bugs": a.bugs = argv[++i]; break;
      case "--brd": a.brd = argv[++i]; break;
      case "--output": a.output = argv[++i]; break;
      case "--role":
        // parseRoleFlag already captured the value; swallow the value token if present so it isn't misread later.
        if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) i++;
        break;
      case "--list-engines": a.listEngines = true; break;
      case "--create-branch": a.createBranch = true; break;
      case "--source-branch": a.sourceBranch = argv[++i]; break;
      case "--preflight": a.preflight = true; break;
      case "--no-preflight": a.noPreflight = true; break;
      case "--yes-install": a.yesInstall = true; break;
      case "--no-install": a.noInstall = true; break;
      case "--interactive": a.interactive = true; break;
      case "--technical": a.technical = true; break;
      case "--analysis": a.analysis = argv[++i]; break;
      case "--help":
        console.log(`BMAD Impact Analysis Agent

Usage:
  npx ts-node run.ts --path <dir> [--bugs export.csv] [--brd doc.docx] [options]

Options:
  --path <dir>            Project root (default: .)
  --bugs <csv>            Proofhub bug/task CSV export
  --brd <doc>             BRD document (.docx / .md / .txt)
  --engine <id>           Stack engine (auto-detect if omitted)
  --output <dir>          Report output dir (default: <path>/impact-reports)
  --role <code>           Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content
                          (persisted at <project>/.bmad/role.yaml; --role wins for one run)
  --list-engines          List available stack engines
  --create-branch         Cut standard working branch dca/impact-<stack>-<ts> before writing outputs
  --source-branch <name>  Base branch for --create-branch (default: production/main/master/develop)
  --preflight             Print preflight advisory (model + project fit) and exit
  --no-preflight          Skip the preflight advisory on a normal run
  --help                  Show this help

Install control (first-run):
  --yes-install           Install missing dependencies without confirmation.
  --no-install            Error out if dependencies missing (do not install).
                          Default: prompt for confirmation on first run.

Intake mode:
  --interactive           Prompt step-by-step for missing inputs; persist choice to .bmad/intake.yaml.
  --technical             Force technical mode; missing required inputs error out (current default).
                          Without either flag the CLI reads <project>/.bmad/intake.yaml (mode: interactive|technical),
                          falling back to technical when the file is absent.`);
        process.exit(0);
      default:
        // swallow --role=<value> here so it isn't logged as unknown
        if (argv[i].startsWith("--role=")) break;
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
    console.log("Available impact-analysis engines:\n");
    for (const p of PROFILES) console.log(`  ${p.id.padEnd(16)} ${p.name}`);
    console.log("  (aliases: aemcs, aemams → aem; commerce → commerce-paas)");
    return;
  }

  // First-run dependency check. Runs BEFORE the heavy modules are
  // require()'d below — analysis/tracer, inputs/brd, shared/output,
  // and shared/preflight transitively need fast-glob / exceljs / mammoth.
  const bootstrap = await ensureDepsInstalled({
    agentName: "impact-analysis",
    yes: args.yesInstall,
    no: args.noInstall,
  });
  if (bootstrap.exitCode !== 0) process.exit(bootstrap.exitCode);

  // Lazy loads — safe now that node_modules is guaranteed present.
  const { readBrd } = require("./inputs/brd") as typeof import("./inputs/brd");
  const { traceImpact } = require("./analysis/tracer") as typeof import("./analysis/tracer");
  const { emitStandardOutputs, maybeCutStandardBranch } = require("../../shared/output") as typeof import("../../shared/output");
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
        key: "input-type",
        prompt: "Input type?",
        choices: ["bugs", "brd", "both"],
      },
      {
        key: "bugs",
        prompt: "Path to Proofhub bug CSV",
        when: (a) => a["input-type"] === "bugs" || a["input-type"] === "both",
      },
      {
        key: "brd",
        prompt: "Path to BRD (.docx/.md/.txt)",
        when: (a) => a["input-type"] === "brd" || a["input-type"] === "both",
      },
      {
        key: "analysis",
        prompt: "What's connected (map touchpoints, deterministic) or what could break (LLM blast radius)?",
        choices: ["connected", "breakage"],
        default: "breakage",
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
      bugs: args.bugs ?? undefined,
      brd: args.brd ?? undefined,
      analysis: args.analysis ?? undefined,
    };
    const answers = await askAll({ questions, existing });
    if (answers.path && (args.path === "." || !args.path)) args.path = answers.path;
    if (answers.engine && answers.engine !== "auto" && !args.engine) args.engine = answers.engine;
    if (answers.bugs && !args.bugs) args.bugs = answers.bugs;
    if (answers.brd && !args.brd) args.brd = answers.brd;
    if (answers.analysis && !args.analysis) args.analysis = answers.analysis;
    if (answers["create-branch"] === "y") {
      args.createBranch = true;
      process.argv.push("--create-branch");
    }
    // Record analysis choice on process.env for downstream (tracer/report).
    if (args.analysis) process.env.DCA_IMPACT_ANALYSIS = args.analysis;

    const summaryCmd = [
      "npx ts-node run.ts",
      args.path ? `--path ${args.path}` : "",
      args.engine ? `--engine ${args.engine}` : "",
      args.bugs ? `--bugs ${args.bugs}` : "",
      args.brd ? `--brd ${args.brd}` : "",
      args.analysis ? `--analysis ${args.analysis}` : "",
      answers["create-branch"] === "y" ? "--create-branch" : "",
    ].filter(Boolean).join(" ");
    const proceed = await confirmRun(summaryCmd);
    if (!proceed) {
      console.log("[dca-interactive] Copy the command above to run manually. Exiting.");
      return;
    }
  }

  const projectPath = resolve(args.path);
  if (!existsSync(projectPath)) { console.error(`❌ Project path not found: ${projectPath}`); process.exit(1); }

  // ── Role resolution (metadata for the report + downstream chaining) ──
  // Order: --role flag  >  <projectRoot>/.bmad/role.yaml  >  generic fallback.
  let resolvedRoleCode = "generic";
  let resolvedRoleName = "Generic";
  let resolvedRoleFlavor = "default";
  let resolvedRoleSource = "generic-fallback";
  try {
    const resolved = resolveRole({
      projectRoot: projectPath,
      cliFlag: args.role,
      fallbackToGeneric: true,
    });
    resolvedRoleCode = resolved.role.code;
    resolvedRoleName = resolved.role.name;
    resolvedRoleFlavor = resolved.role.defaultOutputFlavor;
    resolvedRoleSource = resolved.source;
    process.env.DCA_ROLE = resolvedRoleCode;
    process.env.DCA_ROLE_NAME = resolvedRoleName;
    process.env.DCA_ROLE_FLAVOR = resolvedRoleFlavor;
    process.env.DCA_ROLE_SOURCE = resolvedRoleSource;
    process.stderr.write(
      `[dca-role] ${resolvedRoleName} (source: ${resolvedRoleSource})\n`,
    );
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }

  if (!args.bugs && !args.brd) {
    console.error("❌ Provide at least one input: --bugs <proofhub.csv> and/or --brd <document>");
    console.error("   Tip: rerun with --interactive to be prompted step-by-step, or add 'mode: interactive' to .bmad/intake.yaml.");
    process.exit(1);
  }

  // ── ingest inputs ──
  const items: InputItem[] = [];
  if (args.bugs) {
    if (!existsSync(args.bugs)) { console.error(`❌ Bugs file not found: ${args.bugs}`); process.exit(1); }
    const bugs = readProofhubCsv(args.bugs);
    console.log(`🐞 Proofhub: ${bugs.length} bug(s)  [columns: ${describeMapping(args.bugs)}]`);
    items.push(...bugs);
  }
  if (args.brd) {
    if (!existsSync(args.brd)) { console.error(`❌ BRD file not found: ${args.brd}`); process.exit(1); }
    const reqs = await readBrd(args.brd);
    console.log(`📄 BRD: ${reqs.length} requirement(s)`);
    items.push(...reqs);
  }

  // ── resolve stack ──
  const profile = args.engine ? profileById(args.engine) : detectProfile(projectPath);
  if (!profile) {
    console.error(`❌ Could not resolve a stack engine. Use --engine <id> (see --list-engines).`);
    process.exit(1);
  }
  console.log(`💥 Impact Analysis — ${profile.name}`);
  console.log(`   Project: ${basename(projectPath)}   Inputs: ${items.length}`);
  if (!process.argv.includes("--no-preflight")) {
    console.log("\n" + renderPreflight(runPreflight(projectPath), { agent: "impact", stack: profile.id }));
    if (process.argv.includes("--preflight")) return;
  }
  // Standard branch (output C): cut dca/impact-<stack>-<ts> from production/shared.
  maybeCutStandardBranch(process.argv, { agent: "impact", stack: profile.id, projectRoot: projectPath });

  console.log("\n🔎 Tracing impacted code...");

  const { findings, sourceCount, matchedItems } = traceImpact(projectPath, items, profile);
  const counts = computeCounts(findings);
  console.log(`   Source files scanned: ${sourceCount}`);
  console.log(`   Inputs matched to code: ${matchedItems}/${items.length}`);
  console.log(`   Impact findings: ${counts.total}`);
  for (const s of SEVERITIES) if (counts.bySeverity[s]) console.log(`     ${s.padEnd(9)} ${counts.bySeverity[s]}`);

  const recommendations = buildRecommendations(items.length, matchedItems, counts.bySeverity);
  const outputDir = args.output ?? join(projectPath, "impact-reports");

  const res = await emitStandardOutputs({
    agent: "impact",
    meta: {
      agent: "impact", engine: profile.id, stack: profile.name,
      projectName: basename(projectPath), projectRoot: projectPath,
      extra: {
        Inputs: items.length,
        "Matched to code": matchedItems,
        "Source files": sourceCount,
        Role: `${resolvedRoleName} (${resolvedRoleCode})`,
        "Role Source": resolvedRoleSource,
        "Role Flavor": resolvedRoleFlavor,
      },
    },
    findings,
    outputDir,
    recommendations,
    changelogSummary: `Impact analysis: ${items.length} input(s) → ${counts.total} impacted finding(s) across ${profile.name}.`,
  });

  console.log(`\n📊 Report:     ${res.xlsxPath}   (see 'Input Traceability' sheet)`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG: ${res.changelogPath}`);
  console.log("\n" + "═".repeat(60));
  console.log(" ✅ Impact analysis complete");
  console.log("═".repeat(60));
}

function buildRecommendations(total: number, matched: number, bySev: Record<string, number>): RecommendationRow[] {
  const recs: RecommendationRow[] = [];
  const hot = (bySev.CRITICAL ?? 0) + (bySev.HIGH ?? 0);
  if (hot > 0) recs.push({
    area: "High-risk items", priority: "P0",
    recommendation: `Review the ${hot} CRITICAL/HIGH impacted file(s) (wide blast radius or high-priority input) before merging.`,
    expectedImpact: "Prevents regressions in heavily-referenced code.", effort: "M",
    details: "See the Input Traceability sheet, sorted by severity.",
  });
  if (matched < total) recs.push({
    area: "Unmatched inputs", priority: "P2",
    recommendation: `${total - matched} input(s) had no direct code match — scope them manually or enrich with module/file hints.`,
    expectedImpact: "Closes traceability gaps.", effort: "S",
    details: "Rows marked 'Needs manual review'.",
  });
  recs.push({
    area: "Regression coverage", priority: "P1",
    recommendation: "Add/adjust tests for each impacted file before implementing the fix/requirement.",
    expectedImpact: "Locks in behavior across the traced blast radius.", effort: "M",
    details: "Pair with the Test-Coverage agent for gap analysis.",
  });
  return recs;
}

main().catch((err) => { console.error("❌ Fatal error:", err.message); process.exit(1); });
