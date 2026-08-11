#!/usr/bin/env ts-node
/**
 * BMAD Requirements Agent — Dispatcher (Phase 2.1)
 * ================================================
 * Entry point for the requirements-authoring engine. Produces BRDs,
 * Epics, User Stories, and Acceptance Criteria for a natural-language
 * product description (or an existing BRD to enrich).
 *
 * This is the workstream 1 scaffold — engine bodies are stubs; content
 * (SKILL.md instructions, templates, per-stack vocabulary) lands in
 * workstream 2. The dispatcher, all standard flags, decisions/SLA gates,
 * install preflight, role adaptation, and standardized emit are fully
 * wired here.
 *
 * Usage:
 *   npx ts-node run.ts --path /project --product-description "..."
 *   npx ts-node run.ts --brd-in ./existing.docx --stories-count 20
 *   npx ts-node run.ts --list-engines
 */

import { resolve, join, basename } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
// Node-core-only + role/install (dep-free) + type-only imports are safe on
// first run. shared/output, shared/preflight, and the engine modules
// transitively require third-party packages (exceljs, fast-glob, mammoth)
// and MUST be loaded lazily via require() inside main() AFTER
// ensureDepsInstalled().
import type { Finding } from "../../shared/core/types";
import { resolveRole, parseRoleFlag } from "../../shared/role";
import { ensureDepsInstalled } from "../../shared/install";
import { resolveIntake, askAll, confirmRun, Question } from "../../shared/interactive";

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

interface Args {
  path: string;
  engine: string | null;
  output: string | null;
  interactive: boolean;
  technical: boolean;
  listEngines: boolean;
  createBranch: boolean;
  sourceBranch: string | null;
  preflight: boolean;
  noPreflight: boolean;
  role: string | undefined;
  yesInstall: boolean;
  noInstall: boolean;
  includeDecided: boolean;
  decisionsPath: string | null;
  ignoreDecisionExpiry: boolean;
  listDecisions: boolean;
  slaPath: string | null;
  noSla: boolean;
  failOnOverdue: boolean;
  // Requirements-specific
  brdIn: string | null;
  brdOut: string | null;
  productDescription: string | null;
  storiesCount: number;
  format: "docx" | "markdown" | "both";
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Args = {
    path: ".",
    engine: null,
    output: null,
    interactive: false,
    technical: false,
    listEngines: false,
    createBranch: false,
    sourceBranch: null,
    preflight: false,
    noPreflight: false,
    role: undefined,
    yesInstall: false,
    noInstall: false,
    includeDecided: false,
    decisionsPath: null,
    ignoreDecisionExpiry: false,
    listDecisions: false,
    slaPath: null,
    noSla: false,
    failOnOverdue: false,
    brdIn: null,
    brdOut: null,
    productDescription: null,
    storiesCount: 12,
    format: "markdown",
  };

  parsed.role = parseRoleFlag(args);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--role" && i + 1 < args.length && !args[i + 1].startsWith("--")) {
      i++;
      continue;
    }
    if (args[i].startsWith("--role=")) continue;
    switch (args[i]) {
      case "--path":
        parsed.path = args[++i];
        break;
      case "--engine":
        parsed.engine = args[++i];
        break;
      case "--output":
        parsed.output = args[++i];
        break;
      case "--interactive":
        parsed.interactive = true;
        break;
      case "--technical":
        parsed.technical = true;
        break;
      case "--list-engines":
        parsed.listEngines = true;
        break;
      case "--create-branch":
        parsed.createBranch = true;
        break;
      case "--source-branch":
        parsed.sourceBranch = args[++i];
        break;
      case "--preflight":
        parsed.preflight = true;
        break;
      case "--no-preflight":
        parsed.noPreflight = true;
        break;
      case "--yes-install":
        parsed.yesInstall = true;
        break;
      case "--no-install":
        parsed.noInstall = true;
        break;
      case "--include-decided":
        parsed.includeDecided = true;
        break;
      case "--decisions-path":
        parsed.decisionsPath = args[++i];
        break;
      case "--ignore-decision-expiry":
        parsed.ignoreDecisionExpiry = true;
        break;
      case "--list-decisions":
        parsed.listDecisions = true;
        break;
      case "--sla-path":
        parsed.slaPath = args[++i];
        break;
      case "--no-sla":
        parsed.noSla = true;
        break;
      case "--fail-on-overdue":
        parsed.failOnOverdue = true;
        break;
      case "--brd-in":
        parsed.brdIn = args[++i];
        break;
      case "--brd-out":
        parsed.brdOut = args[++i];
        break;
      case "--product-description":
        parsed.productDescription = args[++i];
        break;
      case "--stories-count": {
        const raw = args[++i];
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) parsed.storiesCount = Math.floor(n);
        break;
      }
      case "--format": {
        const raw = (args[++i] ?? "").toLowerCase();
        if (raw === "docx" || raw === "markdown" || raw === "both") {
          parsed.format = raw;
        }
        break;
      }
      case "--help":
        printHelp();
        process.exit(0);
    }
  }

  return parsed;
}

function printHelp(): void {
  console.log(`
BMAD Requirements Agent

Usage:
  npx ts-node run.ts [options]

Options:
  --path <dir>                     Path to project root (default: .)
  --engine <engine>                Platform engine (auto-detect if omitted)
                                   Accepts: aem | commerce-paas (alias: commerce) |
                                            commerce-saas | sling | spring |
                                            app-builder | eds | eds-commerce
                                   AEM aliases: aemcs, aemams
  --output <dir>                   Output directory for reports + BRD
                                   (default: <projectRoot>/requirements-reports/)
  --interactive                    Prompt step-by-step for missing intake inputs;
                                   persists choice to .bmad/intake.yaml.
  --technical                      Force technical mode; missing required inputs error out.
                                   Without either flag the CLI reads <project>/.bmad/intake.yaml
                                   (mode: interactive|technical), falling back to technical.
  --create-branch                  Cut standard branch dca/requirements-<stack>-<timestamp>
                                   before writing outputs
  --source-branch <name>           Source branch for --create-branch
                                   (default: production/main/master/develop)
  --preflight                      Print model/context + STATIC/LLM/HYBRID advisory and exit
  --no-preflight                   Suppress the preflight advisory
  --role <code>                    Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content
                                   (persisted at <project>/.bmad/role.yaml; --role wins for one run)
  --list-engines                   List available engines
  --help                           Show this help

Requirements authoring:
  --brd-in <path>                     Parse an existing BRD (.docx / .md / .txt) and enrich it.
  --brd-out <path>                    Where to write the generated BRD.
                                      Default: <output>/BRD.md
  --product-description <text>        One-shot natural-language product description.
                                      When omitted (and no --brd-in), the interactive
                                      prompter asks for it.
  --stories-count <n>                 Target user story count (default: 12).
  --format <docx|markdown|both>       Output format for the BRD (default: markdown).
                                      NOTE: docx output is planned for Phase 2.2 — the
                                      current scaffold writes markdown only; passing
                                      docx logs a warning and falls back.

Install control (first-run):
  --yes-install                    Install missing dependencies without confirmation.
  --no-install                     Error out if dependencies missing (do not install).
                                   Default: prompt for confirmation on first run.

Findings gate (Phase 1 enterprise features):
  --include-decided                   Show findings even when a decision exists in
                                      .bmad/decisions.yaml. Default: filter them out.
  --decisions-path <path>             Override decisions file location.
                                      Default: <projectRoot>/.bmad/decisions.yaml
  --ignore-decision-expiry            Keep suppressing findings even when the decision
                                      has expired.
  --list-decisions                    Print every decision in .bmad/decisions.yaml and exit.

SLA tracking (Phase 1 enterprise features):
  --sla-path <path>                   Override SLA file location.
                                      Default: <projectRoot>/.bmad/sla.yaml
  --no-sla                            Skip SLA computation + sheet.
  --fail-on-overdue                   Exit code 6 if any finding is OVERDUE per role SLA.

Engines:
  aem            AEM as a Cloud Service / AMS
  commerce-paas  Adobe Commerce / Magento 2 (PaaS)   (alias: commerce)
  commerce-saas  Adobe Commerce SaaS
  sling          Apache Sling / Shaft
  spring         Spring Boot
  app-builder    Adobe App Builder
  eds            Edge Delivery Services
  eds-commerce   EDS + Commerce Hybrid
`);
}

// ---------------------------------------------------------------------------
// BRD writer — headless CLI fallback (minimal Markdown only; the LLM path
// ---------------------------------------------------------------------------

function writeBrdMarkdown(
  brdPath: string,
  ctx: {
    productDescription: string | null;
    brdIn: string | null;
    engineName: string;
    storiesCount: number;
    findings: Finding[];
  },
): void {
  const lines: string[] = [];
  lines.push(`# Business Requirements Document`);
  lines.push("");
  lines.push(`_Generated by BMAD Requirements Agent — headless CLI fallback._`);
  lines.push(`_Stack: **${ctx.engineName}**. Target story count: ${ctx.storiesCount}._`);
  lines.push("");
  lines.push(`## Product description`);
  lines.push("");
  if (ctx.productDescription) {
    lines.push(ctx.productDescription);
  } else if (ctx.brdIn) {
    lines.push(`Enriched from existing BRD: \`${ctx.brdIn}\`.`);
  } else {
    lines.push("_(no product description provided — pass --product-description or --brd-in)_");
  }
  lines.push("");
  lines.push(`## Authoring findings`);
  lines.push("");
  if (ctx.findings.length === 0) {
    lines.push("_No findings produced by this run._");
  } else {
    for (const f of ctx.findings) {
      lines.push(`- **${f.severity}** — ${f.title}`);
      if (f.description) lines.push(`  - ${f.description}`);
    }
  }
  lines.push("");
  lines.push(`## Note`);
  lines.push("");
  lines.push(
    "This is the headless CLI fallback — it emits standardized reporting plumbing only. For the full BRD (Epics, Stories, Acceptance Criteria, stack-specific vocabulary), drive this agent conversationally from an AI coding tool: it reads `SKILL.md` and the `templates/`/`resources/` packs to author real content, then calls this same reporting layer.",
  );
  lines.push("");
  writeFileSync(brdPath, lines.join("\n"), "utf8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

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

  // First-run dependency check. Must run BEFORE heavy modules are require()'d
  // below — the engine registry, shared/output, and shared/preflight
  // transitively pull in exceljs / fast-glob / mammoth.
  // NOTE: shared/install/preflight.ts uses a closed `InstallAgentName` enum
  // that does not yet include "requirements". Piggyback on "test-coverage"
  // (identical shared deps) until the enum is extended in a shared/ PR.
  // Cast keeps the wiring compiling without touching shared/ in this
  // workstream.
  const bootstrap = await ensureDepsInstalled({
    agentName: "test-coverage" as any,
    yes: args.yesInstall,
    no: args.noInstall,
  });
  if (bootstrap.exitCode !== 0) process.exit(bootstrap.exitCode);

  // Lazy loads — safe now that node_modules is guaranteed present.
  const { getEngine, listEngines } = require("./engines/registry") as typeof import("./engines/registry");
  const { emitStandardOutputs, maybeCutStandardBranch } = require("../../shared/output") as typeof import("../../shared/output");
  const { runPreflight, renderPreflight } = require("../../shared/preflight") as typeof import("../../shared/preflight");
  const { applyDecisionsFilter, listDecisions: listDecisionsFn } =
    require("./decisions-gate") as typeof import("./decisions-gate");
  const { applySLA, maybeFailOnOverdue } = require("./sla-gate") as typeof import("./sla-gate");

  if (args.listEngines) {
    listEngines();
    return;
  }

  // --list-decisions short-circuits.
  if (args.listDecisions) {
    const root = args.path && args.path !== "." ? resolve(args.path) : process.cwd();
    listDecisionsFn(root, args.decisionsPath ?? undefined);
    return;
  }

  // Propagate findings-gate flags via env for downstream helpers.
  if (args.includeDecided) process.env.DCA_INCLUDE_DECIDED = "1";
  if (args.decisionsPath) process.env.DCA_DECISIONS_PATH = resolve(args.decisionsPath);
  if (args.ignoreDecisionExpiry) process.env.DCA_IGNORE_DECISION_EXPIRY = "1";
  // Propagate SLA gate flags via env.
  if (args.slaPath) process.env.DCA_SLA_PATH = resolve(args.slaPath);
  if (args.noSla) process.env.DCA_NO_SLA = "1";
  if (args.failOnOverdue) process.env.DCA_FAIL_ON_OVERDUE = "1";

  // ── Intake mode: --interactive prompts for missing inputs; --technical is
  //   the current (silent-error) default. Persisted at <project>/.bmad/intake.yaml.
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
        key: "product-description",
        prompt: "Short product description (skip if enriching an existing BRD)",
      },
      {
        key: "brd-in",
        prompt: "Path to existing BRD to enrich (blank = author from scratch)",
      },
      {
        key: "stories-count",
        prompt: "Target user story count",
        default: String(args.storiesCount),
      },
      {
        key: "format",
        prompt: "Output format",
        choices: ["markdown", "docx", "both"],
        default: args.format,
      },
      {
        key: "create-branch",
        prompt: "Cut a working branch from production?",
        choices: ["y", "n"],
        default: "n",
      },
    ];
    const existing: Record<string, string | undefined> = {
      path: args.path && args.path !== "." ? args.path : undefined,
      engine: args.engine ?? undefined,
      "product-description": args.productDescription ?? undefined,
      "brd-in": args.brdIn ?? undefined,
    };
    const answers = await askAll({ questions, existing });
    if (answers.path && (args.path === "." || !args.path)) args.path = answers.path;
    if (answers.engine && answers.engine !== "auto" && !args.engine) args.engine = answers.engine;
    if (answers["product-description"] && !args.productDescription) {
      args.productDescription = answers["product-description"];
    }
    if (answers["brd-in"] && !args.brdIn) args.brdIn = answers["brd-in"];
    if (answers["stories-count"]) {
      const n = Number(answers["stories-count"]);
      if (Number.isFinite(n) && n > 0) args.storiesCount = Math.floor(n);
    }
    if (answers.format === "markdown" || answers.format === "docx" || answers.format === "both") {
      args.format = answers.format;
    }
    if (answers["create-branch"] === "y") {
      args.createBranch = true;
      if (!process.argv.includes("--create-branch")) process.argv.push("--create-branch");
    }

    const summaryCmd = [
      "npx ts-node run.ts",
      args.path ? `--path ${args.path}` : "",
      args.engine ? `--engine ${args.engine}` : "",
      args.productDescription ? `--product-description "${args.productDescription.slice(0, 40)}..."` : "",
      args.brdIn ? `--brd-in ${args.brdIn}` : "",
      `--stories-count ${args.storiesCount}`,
      `--format ${args.format}`,
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
    console.error("   Tip: rerun with --interactive to be prompted step-by-step.");
    process.exit(1);
  }

  // ── Role resolution ─────────────────────────────────────────────────────
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
    process.stderr.write(`[dca-role] ${resolved.role.name} (source: ${resolved.source})\n`);
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }

  // ── Engine resolution: real registry lookup; if nothing detected we still
  //   proceed with a "generic" fallback so the dispatcher emit path is exercised.
  let engine = getEngine(args.engine, projectPath);
  let engineIdForOutputs = engine?.id ?? "generic";
  let engineNameForOutputs = engine?.name ?? "Generic (no stack detected)";
  let engineFindings: Finding[] = [];
  let stats = { epics: 0, stories: 0, acs: 0 };
  let brdOutPath: string | undefined;

  if (!args.noPreflight && !process.argv.includes("--no-preflight")) {
    console.log(renderPreflight(runPreflight(projectPath), { agent: "requirements" as any, stack: engineIdForOutputs }) + "\n");
    if (args.preflight || process.argv.includes("--preflight")) return;
  }

  console.log(`📋 BMAD Requirements Agent`);
  console.log(`   Path:   ${projectPath}`);
  console.log(`   Engine: ${engineNameForOutputs}`);
  if (args.brdIn) console.log(`   BRD in: ${args.brdIn}`);
  if (args.productDescription) console.log(`   Desc:   ${args.productDescription.slice(0, 80)}${args.productDescription.length > 80 ? "…" : ""}`);
  console.log(`   Stories target: ${args.storiesCount}`);
  console.log(`   Format: ${args.format}`);
  console.log("");

  if (args.format === "docx" || args.format === "both") {
    process.stderr.write(
      "[dca-requirements] WARN: docx output is planned for Phase 2.2; writing markdown only for now.\n",
    );
  }

  // Standard branch (output C).
  maybeCutStandardBranch(process.argv, {
    agent: "requirements" as any,
    stack: engineIdForOutputs,
    projectRoot: projectPath,
  });

  const outputDir = args.output ?? join(projectPath, "requirements-reports");
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch {
    /* non-fatal */
  }

  // ── Dispatch to engine.main() — non-fatal on engine errors ──────────────
  if (engine) {
    try {
      const result = await engine.main({
        projectRoot: projectPath,
        brdIn: args.brdIn ?? undefined,
        productDescription: args.productDescription ?? undefined,
        storiesCount: args.storiesCount,
        role: process.env.DCA_ROLE || "generic",
        outputDir,
      });
      engineFindings = result.findings;
      stats = result.stats;
      if (result.brdOutPath) brdOutPath = result.brdOutPath;
    } catch (err) {
      process.stderr.write(
        `[dca-requirements] WARN: engine ${engineIdForOutputs} failed: ${(err as Error).message}\n`,
      );
      engineFindings = [
        {
          title: `Engine ${engineIdForOutputs} failed at authoring time`,
          description: (err as Error).message,
          stack: engineIdForOutputs,
          category: "Authoring",
          severity: "HIGH",
          source: "scanner",
          recommendation: "Check the engine module for exceptions and rerun.",
        },
      ];
    }
  } else {
    // No engine detected and none specified.
    engineFindings = [
      {
        title: "No engine detected — requirements authoring needs a target stack",
        description:
          "The dispatcher could not auto-detect a supported stack in this project. Specify --engine <id> to author against a specific stack.",
        stack: engineIdForOutputs,
        category: "Authoring",
        severity: "INFO",
        source: "scanner",
        recommendation:
          "Run: npx ts-node run.ts --list-engines  — then pass --engine <id> (aem, commerce-paas, ...)",
      },
    ];
  }

  // Findings gate — decisions.yaml (non-fatal).
  const extra: Record<string, string | number> = {
    "Stories target": args.storiesCount,
    "Format": args.format,
    "Epics": stats.epics,
    "Stories": stats.stories,
    "Acceptance criteria": stats.acs,
  };
  if (args.brdIn) extra["BRD in"] = args.brdIn;
  if (args.productDescription) {
    extra["Product description (excerpt)"] = args.productDescription.slice(0, 120);
  }

  const gate = applyDecisionsFilter(engineFindings, projectPath, extra);
  const findings = gate.kept;
  if (gate.suppressed > 0) {
    console.log(`   🎯 Findings gate: suppressed ${gate.suppressed} finding(s) via .bmad/decisions.yaml`);
  }

  if (process.env.DCA_ROLE) {
    extra["Role"] = process.env.DCA_ROLE_NAME ?? process.env.DCA_ROLE;
    extra["Role code"] = process.env.DCA_ROLE;
    if (process.env.DCA_ROLE_FLAVOR) extra["Role output flavor"] = process.env.DCA_ROLE_FLAVOR;
    if (process.env.DCA_ROLE_SOURCE) extra["Role source"] = process.env.DCA_ROLE_SOURCE;
  }

  // SLA gate — non-fatal.
  const sla = applySLA({
    findings,
    projectRoot: projectPath,
    agent: "requirements",
    extra,
  });

  // Write the BRD (markdown scaffold). The engine may have already written
  // its own; if not, we emit a placeholder here so --brd-out is always honored.
  if (!brdOutPath) {
    const finalBrdPath = args.brdOut
      ? resolve(args.brdOut)
      : join(outputDir, "BRD.md");
    try {
      writeBrdMarkdown(finalBrdPath, {
        productDescription: args.productDescription,
        brdIn: args.brdIn,
        engineName: engineNameForOutputs,
        storiesCount: args.storiesCount,
        findings,
      });
      brdOutPath = finalBrdPath;
    } catch (err) {
      process.stderr.write(
        `[dca-requirements] WARN: could not write BRD: ${(err as Error).message}\n`,
      );
    }
  }
  if (brdOutPath) extra["BRD out"] = brdOutPath;

  const res = await emitStandardOutputs({
    agent: "requirements" as any,
    meta: {
      agent: "requirements" as any,
      engine: engineIdForOutputs,
      stack: engineIdForOutputs,
      projectName: basename(projectPath),
      projectRoot: projectPath,
      extra,
    },
    findings,
    outputDir,
    extraSheets: sla.extraSheet ? [sla.extraSheet] : undefined,
    changelogSummary: `Requirements authoring: ${stats.epics} epic(s), ${stats.stories} story(ies), ${stats.acs} AC(s); ${findings.length} finding(s).`,
  });

  console.log(`\n📊 Report:     ${res.xlsxPath}`);
  if (res.mdPath) console.log(`📄 Markdown:   ${res.mdPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG: ${res.changelogPath}`);
  if (brdOutPath) console.log(`📋 BRD:        ${brdOutPath}`);

  // --fail-on-overdue: after emit, exit 6 if any finding is OVERDUE per SLA.
  maybeFailOnOverdue(sla.summary);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
