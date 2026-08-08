#!/usr/bin/env ts-node
/**
 * BMAD Architecture Agent — Dispatcher (Phase 2.4)
 * ================================================
 * Entry point for the architecture-design engine. Authors ADRs, HLD/LLD,
 * API contracts (OpenAPI / GraphQL SDL), C4 + sequence diagrams (Mermaid),
 * STRIDE threat models, and data models per stack from a natural-language
 * design question. Parses existing designs and enriches them.
 *
 * This is the Phase 2.4 scaffold — engine bodies are stubs; content
 * (SKILL.md instructions, templates, per-stack vocabulary) lands in Phase
 * 2.5. The dispatcher, all standard flags, decisions/SLA gates, install
 * preflight, role adaptation, and standardized emit are fully wired here.
 *
 * Usage:
 *   npx ts-node run.ts --path /project --design-question "Kafka vs SQS for order events?"
 *   npx ts-node run.ts --design-in ./existing-HLD.md --artifacts adr,openapi,c4
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

type Artifact =
  | "adr"
  | "hld"
  | "lld"
  | "openapi"
  | "graphql"
  | "c4"
  | "sequence"
  | "threat-model"
  | "data-model";

const ALL_ARTIFACTS: Artifact[] = [
  "adr",
  "hld",
  "lld",
  "openapi",
  "graphql",
  "c4",
  "sequence",
  "threat-model",
  "data-model",
];

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
  // Architecture-specific
  designQuestion: string | null;
  designIn: string | null;
  adrTopic: string | null;
  openapiIn: string | null;
  artifacts: string[];                 // resolved list of artifact keys (or ['all'])
  apiStyle: "rest" | "graphql" | "both";
  format: "markdown" | "both";
  diagrams: "mermaid" | "plantuml";
}

function parseArtifacts(raw: string): string[] {
  const items = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (items.includes("all")) return [...ALL_ARTIFACTS];
  const valid = new Set<string>(ALL_ARTIFACTS as string[]);
  return items.filter((s) => valid.has(s));
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
    designQuestion: null,
    designIn: null,
    adrTopic: null,
    openapiIn: null,
    artifacts: [],
    apiStyle: "rest",
    format: "markdown",
    diagrams: "mermaid",
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
      case "--design-question":
        parsed.designQuestion = args[++i];
        break;
      case "--design-in":
        parsed.designIn = args[++i];
        break;
      case "--adr":
        parsed.adrTopic = args[++i];
        break;
      case "--openapi-in":
        parsed.openapiIn = args[++i];
        break;
      case "--artifacts":
        parsed.artifacts = parseArtifacts(args[++i] ?? "");
        break;
      case "--api-style": {
        const raw = (args[++i] ?? "").toLowerCase();
        if (raw === "rest" || raw === "graphql" || raw === "both") {
          parsed.apiStyle = raw;
        }
        break;
      }
      case "--format": {
        const raw = (args[++i] ?? "").toLowerCase();
        if (raw === "markdown" || raw === "both") {
          parsed.format = raw;
        }
        break;
      }
      case "--diagrams": {
        const raw = (args[++i] ?? "").toLowerCase();
        if (raw === "mermaid" || raw === "plantuml") {
          parsed.diagrams = raw;
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
BMAD Architecture Agent (Phase 2.4 scaffold)

Usage:
  npx ts-node run.ts [options]

Options:
  --path <dir>                     Path to project root (default: .)
  --engine <engine>                Platform engine (auto-detect if omitted)
                                   Accepts: aem | commerce-paas (alias: commerce) |
                                            commerce-saas | sling | spring |
                                            app-builder | eds | eds-commerce
                                   AEM aliases: aemcs, aemams
  --output <dir>                   Output directory for reports + design artifacts
                                   (default: <projectRoot>/architecture-reports/)
  --interactive                    Prompt step-by-step for missing intake inputs;
                                   persists choice to .bmad/intake.yaml.
  --technical                      Force technical mode; missing required inputs error out.
                                   Without either flag the CLI reads <project>/.bmad/intake.yaml
                                   (mode: interactive|technical), falling back to technical.
  --create-branch                  Cut standard branch dca/architecture-<stack>-<timestamp>
                                   before writing outputs
  --source-branch <name>           Source branch for --create-branch
                                   (default: production/main/master/develop)
  --preflight                      Print model/context + STATIC/LLM/HYBRID advisory and exit
  --no-preflight                   Suppress the preflight advisory
  --role <code>                    Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content
                                   (persisted at <project>/.bmad/role.yaml; --role wins for one run)
  --list-engines                   List available engines
  --help                           Show this help

Architecture authoring:
  --design-question <text>            One-shot natural-language design question
                                      for an ADR (e.g. "Kafka vs SQS for order events?").
  --design-in <path>                  Parse an existing HLD/LLD/OpenAPI (.md / .yaml / .json)
                                      and enrich it.
  --adr <text>                        Inline ADR title/topic when authoring a single ADR.
  --openapi-in <path>                 Existing OpenAPI YAML/JSON to review or extend.
  --artifacts <csv>                   Which artifacts to author (comma-separated). Values:
                                      adr, hld, lld, openapi, graphql, c4, sequence,
                                      threat-model, data-model, all.
                                      Default: role-driven selection.
  --api-style <rest|graphql|both>     For API-contract artifacts. Default: rest.
  --format <markdown|both>            Output format. Default: markdown.
                                      NOTE: docx output is planned for a later phase — the
                                      current scaffold writes markdown only; passing 'both'
                                      still writes markdown for now.
  --diagrams <mermaid|plantuml>       Diagram format. Default: mermaid.

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
// Role-driven default artifact set — used when --artifacts is not supplied.
// ---------------------------------------------------------------------------

function roleDefaultArtifacts(role: string): string[] {
  switch (role) {
    case "ea":
      return ["adr", "hld", "c4", "threat-model"];
    case "tl":
      return ["adr", "hld", "lld", "openapi", "c4", "sequence"];
    case "de":
      return ["lld", "openapi", "sequence"];
    case "qa":
      return ["sequence", "data-model"];
    case "devops":
      return ["c4", "sequence"];
    case "security":
      return ["threat-model", "sequence"];
    case "pm":
      return ["adr", "hld"];
    case "ba":
      return ["hld", "data-model"];
    case "migration":
      return ["adr", "hld", "data-model"];
    case "content":
      return ["hld", "data-model"];
    default:
      // generic — a balanced small set
      return ["adr", "hld", "c4"];
  }
}

// ---------------------------------------------------------------------------
// Design index writer — Phase 2.4 minimal Markdown writer.
// The engine will emit its own artifact files in Phase 2.5; here we drop
// a single DESIGN-INDEX.md so --output is always exercised.
// ---------------------------------------------------------------------------

function writeDesignIndex(
  indexPath: string,
  ctx: {
    designQuestion: string | null;
    designIn: string | null;
    adrTopic: string | null;
    openapiIn: string | null;
    engineName: string;
    artifacts: string[];
    apiStyle: string;
    diagrams: string;
    findings: Finding[];
    writtenFiles: string[];
  },
): void {
  const lines: string[] = [];
  lines.push(`# Architecture Design Index`);
  lines.push("");
  lines.push(`_Generated by BMAD Architecture Agent — Phase 2.4 scaffold._`);
  lines.push(`_Stack: **${ctx.engineName}**._`);
  lines.push("");
  lines.push(`## Inputs`);
  lines.push("");
  if (ctx.designQuestion) lines.push(`- **Design question:** ${ctx.designQuestion}`);
  if (ctx.adrTopic) lines.push(`- **ADR topic:** ${ctx.adrTopic}`);
  if (ctx.designIn) lines.push(`- **Existing design:** \`${ctx.designIn}\``);
  if (ctx.openapiIn) lines.push(`- **Existing OpenAPI:** \`${ctx.openapiIn}\``);
  if (!ctx.designQuestion && !ctx.adrTopic && !ctx.designIn && !ctx.openapiIn) {
    lines.push("_(no design inputs provided — pass --design-question / --adr / --design-in / --openapi-in)_");
  }
  lines.push("");
  lines.push(`## Artifacts requested`);
  lines.push("");
  lines.push(`- **Artifacts:** ${ctx.artifacts.length ? ctx.artifacts.join(", ") : "(none — role default)"}`);
  lines.push(`- **API style:** ${ctx.apiStyle}`);
  lines.push(`- **Diagrams:** ${ctx.diagrams}`);
  lines.push("");
  lines.push(`## Written files`);
  lines.push("");
  if (ctx.writtenFiles.length === 0) {
    lines.push("_No artifact files written by this run (stub engine)._");
  } else {
    for (const f of ctx.writtenFiles) {
      lines.push(`- \`${f}\``);
    }
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
  lines.push(`## Next phase`);
  lines.push("");
  lines.push(
    "Phase 2.5 populates real ADR / HLD / LLD / API-contract / diagram / threat-model / data-model content per stack.",
  );
  lines.push("");
  writeFileSync(indexPath, lines.join("\n"), "utf8");
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
  const bootstrap = await ensureDepsInstalled({
    agentName: "architecture",
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
        key: "design-question",
        prompt: "Design question (e.g. 'Kafka vs SQS for order events?') — skip if enriching an existing design",
      },
      {
        key: "design-in",
        prompt: "Path to existing HLD/LLD/OpenAPI to enrich (blank = author from scratch)",
      },
      {
        key: "adr",
        prompt: "ADR title/topic (blank if not authoring a single ADR)",
      },
      {
        key: "artifacts",
        prompt: "Which artifacts? (comma-separated: adr,hld,lld,openapi,graphql,c4,sequence,threat-model,data-model,all)",
        default: args.artifacts.length ? args.artifacts.join(",") : "adr,hld,c4",
      },
      {
        key: "api-style",
        prompt: "API style",
        choices: ["rest", "graphql", "both"],
        default: args.apiStyle,
      },
      {
        key: "diagrams",
        prompt: "Diagram format",
        choices: ["mermaid", "plantuml"],
        default: args.diagrams,
      },
      {
        key: "format",
        prompt: "Output format",
        choices: ["markdown", "both"],
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
      "design-question": args.designQuestion ?? undefined,
      "design-in": args.designIn ?? undefined,
      adr: args.adrTopic ?? undefined,
    };
    const answers = await askAll({ questions, existing });
    if (answers.path && (args.path === "." || !args.path)) args.path = answers.path;
    if (answers.engine && answers.engine !== "auto" && !args.engine) args.engine = answers.engine;
    if (answers["design-question"] && !args.designQuestion) {
      args.designQuestion = answers["design-question"];
    }
    if (answers["design-in"] && !args.designIn) args.designIn = answers["design-in"];
    if (answers.adr && !args.adrTopic) args.adrTopic = answers.adr;
    if (answers.artifacts) {
      const parsed = parseArtifacts(answers.artifacts);
      if (parsed.length) args.artifacts = parsed;
    }
    if (answers["api-style"] === "rest" || answers["api-style"] === "graphql" || answers["api-style"] === "both") {
      args.apiStyle = answers["api-style"];
    }
    if (answers.diagrams === "mermaid" || answers.diagrams === "plantuml") {
      args.diagrams = answers.diagrams;
    }
    if (answers.format === "markdown" || answers.format === "both") {
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
      args.designQuestion ? `--design-question "${args.designQuestion.slice(0, 40)}..."` : "",
      args.designIn ? `--design-in ${args.designIn}` : "",
      args.adrTopic ? `--adr "${args.adrTopic.slice(0, 40)}..."` : "",
      args.artifacts.length ? `--artifacts ${args.artifacts.join(",")}` : "",
      `--api-style ${args.apiStyle}`,
      `--diagrams ${args.diagrams}`,
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

  // Resolve artifacts: explicit --artifacts wins; else role-driven default.
  const activeRole = process.env.DCA_ROLE || "generic";
  const resolvedArtifacts =
    args.artifacts.length > 0 ? args.artifacts : roleDefaultArtifacts(activeRole);

  // ── Engine resolution: real registry lookup; if nothing detected we still
  //   proceed with a "generic" fallback so the dispatcher emit path is exercised.
  const engine = getEngine(args.engine, projectPath);
  const engineIdForOutputs = engine?.id ?? "generic";
  const engineNameForOutputs = engine?.name ?? "Generic (no stack detected)";
  let engineFindings: Finding[] = [];
  let stats = { adrs: 0, apis: 0, diagrams: 0, models: 0 };
  let writtenFiles: string[] = [];

  if (!args.noPreflight && !process.argv.includes("--no-preflight")) {
    console.log(renderPreflight(runPreflight(projectPath), { agent: "architecture", stack: engineIdForOutputs }) + "\n");
    if (args.preflight || process.argv.includes("--preflight")) return;
  }

  console.log(`🏛️  BMAD Architecture Agent`);
  console.log(`   Path:      ${projectPath}`);
  console.log(`   Engine:    ${engineNameForOutputs}`);
  if (args.designQuestion) console.log(`   Question:  ${args.designQuestion.slice(0, 80)}${args.designQuestion.length > 80 ? "…" : ""}`);
  if (args.adrTopic) console.log(`   ADR:       ${args.adrTopic.slice(0, 80)}${args.adrTopic.length > 80 ? "…" : ""}`);
  if (args.designIn) console.log(`   Design in: ${args.designIn}`);
  if (args.openapiIn) console.log(`   OpenAPI:   ${args.openapiIn}`);
  console.log(`   Artifacts: ${resolvedArtifacts.join(", ") || "(none)"}`);
  console.log(`   API style: ${args.apiStyle}`);
  console.log(`   Diagrams:  ${args.diagrams}`);
  console.log(`   Format:    ${args.format}`);
  console.log("");

  if (args.format === "both") {
    process.stderr.write(
      "[dca-architecture] WARN: --format both — docx output is planned for a later phase; writing markdown only for now.\n",
    );
  }

  // Standard branch (output C).
  maybeCutStandardBranch(process.argv, {
    agent: "architecture",
    stack: engineIdForOutputs,
    projectRoot: projectPath,
  });

  const outputDir = args.output ?? join(projectPath, "architecture-reports");
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch {
    /* non-fatal */
  }

  // Auto-detect fallback: emit an INFO finding when no engine was matched.
  if (!engine) {
    process.stderr.write(
      "[dca-architecture] INFO: no stack auto-detected; using generic fallback. Pass --engine <id> for stack-native output.\n",
    );
    engineFindings.push({
      title: "No engine detected — architecture authoring falling back to generic",
      description:
        "The dispatcher could not auto-detect a supported stack in this project. The current run continues with a generic profile; specify --engine <id> for stack-native ADR / HLD / LLD templates.",
      stack: engineIdForOutputs,
      category: "Architecture",
      severity: "INFO",
      source: "scanner",
      recommendation:
        "Run: npx ts-node run.ts --list-engines  — then pass --engine <id> (aem, commerce-paas, ...)",
    });
  } else {
    // ── Dispatch to engine.main() — non-fatal on engine errors ──────────────
    try {
      const result = await engine.main({
        projectRoot: projectPath,
        designIn: args.designIn ?? undefined,
        designQuestion: args.designQuestion ?? undefined,
        adrTopic: args.adrTopic ?? undefined,
        openapiIn: args.openapiIn ?? undefined,
        artifacts: resolvedArtifacts,
        apiStyle: args.apiStyle,
        format: args.format,
        diagrams: args.diagrams,
        role: activeRole,
        outputDir,
      });
      engineFindings = result.findings;
      stats = result.stats;
      writtenFiles = result.writtenFiles;
    } catch (err) {
      process.stderr.write(
        `[dca-architecture] WARN: engine ${engineIdForOutputs} failed: ${(err as Error).message}\n`,
      );
      engineFindings = [
        {
          title: `Engine ${engineIdForOutputs} failed at design time`,
          description: (err as Error).message,
          stack: engineIdForOutputs,
          category: "Architecture",
          severity: "HIGH",
          source: "scanner",
          recommendation: "Check the engine module for exceptions and rerun.",
        },
      ];
    }
  }

  // Findings gate — decisions.yaml (non-fatal).
  const extra: Record<string, string | number> = {
    "Artifacts": resolvedArtifacts.join(", ") || "(none)",
    "API style": args.apiStyle,
    "Diagrams": args.diagrams,
    "Format": args.format,
    "ADRs": stats.adrs,
    "APIs": stats.apis,
    "Diagrams count": stats.diagrams,
    "Models": stats.models,
  };
  if (args.designIn) extra["Design in"] = args.designIn;
  if (args.openapiIn) extra["OpenAPI in"] = args.openapiIn;
  if (args.designQuestion) {
    extra["Design question (excerpt)"] = args.designQuestion.slice(0, 120);
  }
  if (args.adrTopic) {
    extra["ADR topic (excerpt)"] = args.adrTopic.slice(0, 120);
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
    agent: "architecture",
    extra,
  });

  // Write the DESIGN-INDEX.md (markdown scaffold). Always emit so the user
  // can see what was requested even when the engine wrote nothing.
  const indexPath = join(outputDir, "DESIGN-INDEX.md");
  try {
    writeDesignIndex(indexPath, {
      designQuestion: args.designQuestion,
      designIn: args.designIn,
      adrTopic: args.adrTopic,
      openapiIn: args.openapiIn,
      engineName: engineNameForOutputs,
      artifacts: resolvedArtifacts,
      apiStyle: args.apiStyle,
      diagrams: args.diagrams,
      findings,
      writtenFiles,
    });
  } catch (err) {
    process.stderr.write(
      `[dca-architecture] WARN: could not write DESIGN-INDEX: ${(err as Error).message}\n`,
    );
  }
  extra["Design index"] = indexPath;
  if (writtenFiles.length > 0) {
    extra["Artifact files written"] = writtenFiles.length;
  }

  const res = await emitStandardOutputs({
    agent: "architecture",
    meta: {
      agent: "architecture",
      engine: engineIdForOutputs,
      stack: engineIdForOutputs,
      projectName: basename(projectPath),
      projectRoot: projectPath,
      extra,
    },
    findings,
    outputDir,
    extraSheets: sla.extraSheet ? [sla.extraSheet] : undefined,
    changelogSummary: `Architecture design: ${stats.adrs} ADR(s), ${stats.apis} API(s), ${stats.diagrams} diagram(s), ${stats.models} model(s); ${findings.length} finding(s).`,
  });

  console.log(`\n📊 Report:      ${res.xlsxPath}`);
  if (res.mdPath) console.log(`📄 Markdown:    ${res.mdPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG:  ${res.changelogPath}`);
  console.log(`🏛️  Design idx:  ${indexPath}`);
  if (writtenFiles.length > 0) {
    console.log(`📚 Artifacts:   ${writtenFiles.length} file(s)`);
  }

  // --fail-on-overdue: after emit, exit 6 if any finding is OVERDUE per SLA.
  maybeFailOnOverdue(sla.summary);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
