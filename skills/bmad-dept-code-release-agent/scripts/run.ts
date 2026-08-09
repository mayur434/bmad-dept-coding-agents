#!/usr/bin/env ts-node
/**
 * BMAD Release Agent — Dispatcher (Phase 3.1)
 * ==========================================
 * Entry point for the release-authoring engine. Authors CI/CD pipelines
 * (Cloud Manager, GitHub Actions, GitLab CI, CircleCI, Jenkins, Azure DevOps),
 * release notes from commit history, deploy plans, rollback plans, env-diff
 * calculations, and stakeholder announcements per stack.
 *
 * This is the Phase 3.1 scaffold — engine bodies are stubs; content
 * (SKILL.md instructions, templates, per-stack vocabulary) lands in Phase
 * 3.2. The dispatcher, all standard flags, decisions/SLA gates, install
 * preflight, role adaptation, and standardized emit are fully wired here.
 *
 * Usage:
 *   npx ts-node run.ts --path /project --release-version 2.5.0
 *   npx ts-node run.ts --from-ref v2.4.0 --to-ref HEAD --artifacts release-notes
 *   npx ts-node run.ts --list-engines
 */

import { resolve, join, basename } from "path";
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "fs";
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
  | "pipeline"
  | "release-notes"
  | "deploy-plan"
  | "rollback-plan"
  | "env-diff"
  | "announcement";

const ALL_ARTIFACTS: Artifact[] = [
  "pipeline",
  "release-notes",
  "deploy-plan",
  "rollback-plan",
  "env-diff",
  "announcement",
];

const PIPELINE_TARGETS = [
  "cloudmanager",
  "github-actions",
  "gitlab-ci",
  "circleci",
  "jenkins",
  "azure-devops",
] as const;
type PipelineTarget = typeof PIPELINE_TARGETS[number];

const ROLLOUT_STRATEGIES = [
  "canary",
  "blue-green",
  "rolling",
  "feature-flag",
  "bigbang",
] as const;
type RolloutStrategy = typeof ROLLOUT_STRATEGIES[number];

const COMMIT_FORMATS = ["conventional", "keep-a-changelog", "narrative"] as const;
type CommitFormat = typeof COMMIT_FORMATS[number];

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
  // Release-specific
  pipeline: PipelineTarget | null;
  fromRef: string | null;
  toRef: string;
  env: string | null;
  toEnv: string | null;
  rollout: RolloutStrategy | null;
  releaseVersion: string | null;
  artifacts: string[];                 // resolved list of artifact keys (or ['all'])
  commitFormat: CommitFormat;
  format: "markdown" | "both";
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
    pipeline: null,
    fromRef: null,
    toRef: "HEAD",
    env: null,
    toEnv: null,
    rollout: null,
    releaseVersion: null,
    artifacts: [],
    commitFormat: "conventional",
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
      case "--pipeline": {
        const raw = (args[++i] ?? "").toLowerCase();
        if ((PIPELINE_TARGETS as readonly string[]).includes(raw)) {
          parsed.pipeline = raw as PipelineTarget;
        }
        break;
      }
      case "--from-ref":
        parsed.fromRef = args[++i];
        break;
      case "--to-ref":
        parsed.toRef = args[++i];
        break;
      case "--env":
        parsed.env = args[++i];
        break;
      case "--to-env":
        parsed.toEnv = args[++i];
        break;
      case "--rollout": {
        const raw = (args[++i] ?? "").toLowerCase();
        if ((ROLLOUT_STRATEGIES as readonly string[]).includes(raw)) {
          parsed.rollout = raw as RolloutStrategy;
        }
        break;
      }
      case "--release-version":
        parsed.releaseVersion = args[++i];
        break;
      case "--artifacts":
        parsed.artifacts = parseArtifacts(args[++i] ?? "");
        break;
      case "--commit-format": {
        const raw = (args[++i] ?? "").toLowerCase();
        if ((COMMIT_FORMATS as readonly string[]).includes(raw)) {
          parsed.commitFormat = raw as CommitFormat;
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
      case "--help":
        printHelp();
        process.exit(0);
    }
  }

  return parsed;
}

function printHelp(): void {
  console.log(`
BMAD Release Agent (Phase 3.1 scaffold)

Usage:
  npx ts-node run.ts [options]

Options:
  --path <dir>                     Path to project root (default: .)
  --engine <engine>                Platform engine (auto-detect if omitted)
                                   Accepts: aem | commerce-paas (alias: commerce) |
                                            commerce-saas | sling | spring |
                                            app-builder | eds | eds-commerce
                                   AEM aliases: aemcs, aemams
  --output <dir>                   Output directory for release reports + artifacts
                                   (default: <projectRoot>/release-reports/)
  --interactive                    Prompt step-by-step for missing intake inputs;
                                   persists choice to .bmad/intake.yaml.
  --technical                      Force technical mode; missing required inputs error out.
                                   Without either flag the CLI reads <project>/.bmad/intake.yaml
                                   (mode: interactive|technical), falling back to technical.
  --create-branch                  Cut standard branch dca/release-<stack>-<timestamp>
                                   before writing outputs
  --source-branch <name>           Source branch for --create-branch
                                   (default: production/main/master/develop)
  --preflight                      Print model/context + STATIC/LLM/HYBRID advisory and exit
  --no-preflight                   Suppress the preflight advisory
  --role <code>                    Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content
                                   (persisted at <project>/.bmad/role.yaml; --role wins for one run)
  --list-engines                   List available engines
  --help                           Show this help

Release authoring:
  --pipeline <target>              CI/CD platform. Values:
                                   cloudmanager | github-actions | gitlab-ci |
                                   circleci | jenkins | azure-devops
                                   (default: auto-detect from project files —
                                    Cloud Manager for AEM projects,
                                    GitHub Actions if .github/workflows/ present, etc.)
  --from-ref <ref>                 Start of release scope (git ref) — for release
                                   notes + env-diff.
  --to-ref <ref>                   End of release scope. Default: HEAD.
  --env <name>                     Source environment for env-diff (e.g. stage).
  --to-env <name>                  Target environment for env-diff (e.g. prod).
  --rollout <strategy>             Deploy strategy. Values:
                                   canary | blue-green | rolling |
                                   feature-flag | bigbang
                                   (default: role-driven — DevOps prefers canary,
                                    migration prefers blue-green).
  --release-version <tag>          Semantic version for the release (e.g. 2.5.0).
  --artifacts <csv>                Which artifacts to author (comma-separated). Values:
                                   pipeline, release-notes, deploy-plan,
                                   rollback-plan, env-diff, announcement, all.
                                   Default: all.
  --commit-format <style>          Release-notes commit style. Values:
                                   conventional | keep-a-changelog | narrative.
                                   Default: conventional.
  --format <markdown|both>         Output format. Default: markdown.
                                   NOTE: docx output is planned for a later phase — the
                                   current scaffold writes markdown only; passing 'both'
                                   still writes markdown for now.

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
// Role-driven default rollout — used when --rollout is not supplied.
// ---------------------------------------------------------------------------

function roleDefaultRollout(role: string): RolloutStrategy {
  switch (role) {
    case "devops":
      return "canary";
    case "migration":
      return "blue-green";
    case "security":
      return "canary";
    case "de":
    case "tl":
      return "rolling";
    case "pm":
    case "ea":
      return "feature-flag";
    default:
      return "rolling";
  }
}

// ---------------------------------------------------------------------------
// Pipeline auto-detection — walk the project root for CI/CD indicators.
// ---------------------------------------------------------------------------

function autoDetectPipeline(projectRoot: string): PipelineTarget | null {
  const candidates: PipelineTarget[] = [];
  try {
    if (existsSync(join(projectRoot, ".github", "workflows"))) {
      try {
        const entries = readdirSync(join(projectRoot, ".github", "workflows"));
        if (entries.some((e) => /\.ya?ml$/i.test(e))) candidates.push("github-actions");
      } catch {
        candidates.push("github-actions");
      }
    }
  } catch {
    /* non-fatal */
  }
  if (existsSync(join(projectRoot, ".gitlab-ci.yml"))) candidates.push("gitlab-ci");
  if (existsSync(join(projectRoot, ".circleci", "config.yml"))) candidates.push("circleci");
  if (existsSync(join(projectRoot, "Jenkinsfile"))) candidates.push("jenkins");
  if (existsSync(join(projectRoot, "azure-pipelines.yml"))) candidates.push("azure-devops");

  // AEM projects — infer Cloud Manager if pom.xml suggests AEM archetypes.
  if (existsSync(join(projectRoot, "pom.xml"))) {
    try {
      const pom = require("fs").readFileSync(join(projectRoot, "pom.xml"), "utf-8") as string;
      if (/com\.adobe\.aem|aem-sdk-api|uber-jar|cq-quickstart/i.test(pom)) {
        // If AEM stack has an explicit non-CM pipeline configured, prefer that.
        if (candidates.length > 0) return candidates[0]!;
        return "cloudmanager";
      }
    } catch {
      /* non-fatal */
    }
  }

  if (candidates.length === 0) return null;
  return candidates[0]!;
}

// ---------------------------------------------------------------------------
// Release index writer — Phase 3.1 minimal Markdown writer.
// The engine will emit its own artifact files in Phase 3.2; here we drop
// a single RELEASE-INDEX.md so --output is always exercised.
// ---------------------------------------------------------------------------

function writeReleaseIndex(
  indexPath: string,
  ctx: {
    releaseVersion: string | null;
    fromRef: string | null;
    toRef: string;
    env: string | null;
    toEnv: string | null;
    pipeline: string;
    rollout: string;
    engineName: string;
    artifacts: string[];
    commitFormat: string;
    findings: Finding[];
    writtenFiles: string[];
  },
): void {
  const lines: string[] = [];
  lines.push(`# Release Index`);
  lines.push("");
  lines.push(`_Generated by BMAD Release Agent — Phase 3.1 scaffold._`);
  lines.push(`_Stack: **${ctx.engineName}**._`);
  lines.push("");
  lines.push(`## Inputs`);
  lines.push("");
  if (ctx.releaseVersion) lines.push(`- **Release version:** ${ctx.releaseVersion}`);
  lines.push(`- **Pipeline target:** ${ctx.pipeline}`);
  lines.push(`- **Rollout strategy:** ${ctx.rollout}`);
  if (ctx.fromRef) lines.push(`- **From ref:** \`${ctx.fromRef}\``);
  lines.push(`- **To ref:** \`${ctx.toRef}\``);
  if (ctx.env) lines.push(`- **Source env:** ${ctx.env}`);
  if (ctx.toEnv) lines.push(`- **Target env:** ${ctx.toEnv}`);
  lines.push(`- **Commit format:** ${ctx.commitFormat}`);
  lines.push("");
  lines.push(`## Artifacts requested`);
  lines.push("");
  lines.push(`- **Artifacts:** ${ctx.artifacts.length ? ctx.artifacts.join(", ") : "(none)"}`);
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
    "Phase 3.2 populates real CI/CD pipeline / release-notes / deploy-plan / rollback-plan / env-diff / announcement content per stack.",
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
    agentName: "release",
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
        key: "release-version",
        prompt: "Release version (e.g. 2.5.0) — blank if not tagging yet",
      },
      {
        key: "pipeline",
        prompt: "CI/CD pipeline target",
        choices: ["auto", ...PIPELINE_TARGETS],
        default: "auto",
      },
      {
        key: "rollout",
        prompt: "Rollout strategy",
        choices: [...ROLLOUT_STRATEGIES],
        default: args.rollout ?? "rolling",
      },
      {
        key: "from-ref",
        prompt: "Start of release scope (git ref — e.g. v2.4.0) — blank if unbounded",
      },
      {
        key: "to-ref",
        prompt: "End of release scope (git ref)",
        default: args.toRef,
      },
      {
        key: "env",
        prompt: "Source environment (e.g. stage) — blank if not doing env-diff",
      },
      {
        key: "to-env",
        prompt: "Target environment (e.g. prod) — blank if not doing env-diff",
      },
      {
        key: "artifacts",
        prompt: "Which artifacts? (comma-separated: pipeline,release-notes,deploy-plan,rollback-plan,env-diff,announcement,all)",
        default: args.artifacts.length ? args.artifacts.join(",") : "all",
      },
      {
        key: "commit-format",
        prompt: "Commit format for release notes",
        choices: [...COMMIT_FORMATS],
        default: args.commitFormat,
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
      "release-version": args.releaseVersion ?? undefined,
      pipeline: args.pipeline ?? undefined,
      "from-ref": args.fromRef ?? undefined,
      env: args.env ?? undefined,
      "to-env": args.toEnv ?? undefined,
    };
    const answers = await askAll({ questions, existing });
    if (answers.path && (args.path === "." || !args.path)) args.path = answers.path;
    if (answers.engine && answers.engine !== "auto" && !args.engine) args.engine = answers.engine;
    if (answers["release-version"] && !args.releaseVersion) {
      args.releaseVersion = answers["release-version"];
    }
    if (answers.pipeline && answers.pipeline !== "auto" && !args.pipeline) {
      if ((PIPELINE_TARGETS as readonly string[]).includes(answers.pipeline)) {
        args.pipeline = answers.pipeline as PipelineTarget;
      }
    }
    if (answers.rollout && !args.rollout) {
      if ((ROLLOUT_STRATEGIES as readonly string[]).includes(answers.rollout)) {
        args.rollout = answers.rollout as RolloutStrategy;
      }
    }
    if (answers["from-ref"] && !args.fromRef) args.fromRef = answers["from-ref"];
    if (answers["to-ref"]) args.toRef = answers["to-ref"];
    if (answers.env && !args.env) args.env = answers.env;
    if (answers["to-env"] && !args.toEnv) args.toEnv = answers["to-env"];
    if (answers.artifacts) {
      const parsed = parseArtifacts(answers.artifacts);
      if (parsed.length) args.artifacts = parsed;
    }
    if (answers["commit-format"] && (COMMIT_FORMATS as readonly string[]).includes(answers["commit-format"])) {
      args.commitFormat = answers["commit-format"] as CommitFormat;
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
      args.releaseVersion ? `--release-version ${args.releaseVersion}` : "",
      args.pipeline ? `--pipeline ${args.pipeline}` : "",
      args.rollout ? `--rollout ${args.rollout}` : "",
      args.fromRef ? `--from-ref ${args.fromRef}` : "",
      `--to-ref ${args.toRef}`,
      args.env ? `--env ${args.env}` : "",
      args.toEnv ? `--to-env ${args.toEnv}` : "",
      args.artifacts.length ? `--artifacts ${args.artifacts.join(",")}` : "",
      `--commit-format ${args.commitFormat}`,
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

  // Resolve artifacts: explicit --artifacts wins; else default is all.
  const activeRole = process.env.DCA_ROLE || "generic";
  const resolvedArtifacts =
    args.artifacts.length > 0 ? args.artifacts : [...ALL_ARTIFACTS];

  // Resolve rollout: explicit wins; else role-driven default.
  const resolvedRollout: RolloutStrategy = args.rollout ?? roleDefaultRollout(activeRole);

  // ── Engine resolution: real registry lookup; if nothing detected we still
  //   proceed with a "generic" fallback so the dispatcher emit path is exercised.
  const engine = getEngine(args.engine, projectPath);
  const engineIdForOutputs = engine?.id ?? "generic";
  const engineNameForOutputs = engine?.name ?? "Generic (no stack detected)";
  let engineFindings: Finding[] = [];
  let stats = { pipelines: 0, releaseNotes: 0, plans: 0, diffs: 0 };
  let writtenFiles: string[] = [];

  // Pipeline auto-detection: only when --pipeline was not passed.
  let resolvedPipeline: PipelineTarget | null = args.pipeline;
  if (!resolvedPipeline) {
    resolvedPipeline = autoDetectPipeline(projectPath);
    if (resolvedPipeline) {
      process.stderr.write(
        `[dca-release] auto-detected pipeline target: ${resolvedPipeline}\n`,
      );
    }
  }

  if (!args.noPreflight && !process.argv.includes("--no-preflight")) {
    console.log(renderPreflight(runPreflight(projectPath), { agent: "release", stack: engineIdForOutputs }) + "\n");
    if (args.preflight || process.argv.includes("--preflight")) return;
  }

  console.log(`🚀 BMAD Release Agent`);
  console.log(`   Path:      ${projectPath}`);
  console.log(`   Engine:    ${engineNameForOutputs}`);
  console.log(`   Pipeline:  ${resolvedPipeline ?? "(unresolved — pass --pipeline)"}`);
  console.log(`   Rollout:   ${resolvedRollout}`);
  if (args.releaseVersion) console.log(`   Version:   ${args.releaseVersion}`);
  if (args.fromRef) console.log(`   From ref:  ${args.fromRef}`);
  console.log(`   To ref:    ${args.toRef}`);
  if (args.env) console.log(`   Source env:${args.env}`);
  if (args.toEnv) console.log(`   Target env:${args.toEnv}`);
  console.log(`   Artifacts: ${resolvedArtifacts.join(", ") || "(none)"}`);
  console.log(`   Commit fmt:${args.commitFormat}`);
  console.log(`   Format:    ${args.format}`);
  console.log("");

  if (args.format === "both") {
    process.stderr.write(
      "[dca-release] WARN: --format both — docx output is planned for a later phase; writing markdown only for now.\n",
    );
  }

  // Standard branch (output C).
  maybeCutStandardBranch(process.argv, {
    agent: "release",
    stack: engineIdForOutputs,
    projectRoot: projectPath,
  });

  const outputDir = args.output ?? join(projectPath, "release-reports");
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch {
    /* non-fatal */
  }

  // If pipeline is still unresolved, emit an INFO finding but continue.
  if (!resolvedPipeline) {
    engineFindings.push({
      title: "Pipeline target unresolved — pass --pipeline explicitly",
      description:
        `No CI/CD pipeline configuration was auto-detected in this project. ` +
        `Pass --pipeline with one of: ${PIPELINE_TARGETS.join(", ")}.`,
      stack: engineIdForOutputs,
      category: "Release",
      severity: "INFO",
      source: "scanner",
      recommendation:
        `Run: npx ts-node run.ts --pipeline <target> — accepted values: ${PIPELINE_TARGETS.join(", ")}`,
    });
  }

  // Auto-detect fallback: emit an INFO finding when no engine was matched.
  if (!engine) {
    process.stderr.write(
      "[dca-release] INFO: no stack auto-detected; using generic fallback. Pass --engine <id> for stack-native output.\n",
    );
    engineFindings.push({
      title: "No engine detected — release authoring falling back to generic",
      description:
        "The dispatcher could not auto-detect a supported stack in this project. The current run continues with a generic profile; specify --engine <id> for stack-native pipeline / release-notes / deploy-plan templates.",
      stack: engineIdForOutputs,
      category: "Release",
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
        pipeline: resolvedPipeline ?? "unresolved",
        fromRef: args.fromRef ?? undefined,
        toRef: args.toRef,
        env: args.env ?? undefined,
        toEnv: args.toEnv ?? undefined,
        rollout: resolvedRollout,
        releaseVersion: args.releaseVersion ?? undefined,
        artifacts: resolvedArtifacts,
        commitFormat: args.commitFormat,
        format: args.format,
        role: activeRole,
        outputDir,
      });
      engineFindings = engineFindings.concat(result.findings);
      stats = result.stats;
      writtenFiles = result.writtenFiles;
    } catch (err) {
      process.stderr.write(
        `[dca-release] WARN: engine ${engineIdForOutputs} failed: ${(err as Error).message}\n`,
      );
      engineFindings.push({
        title: `Engine ${engineIdForOutputs} failed at release time`,
        description: (err as Error).message,
        stack: engineIdForOutputs,
        category: "Release",
        severity: "HIGH",
        source: "scanner",
        recommendation: "Check the engine module for exceptions and rerun.",
      });
    }
  }

  // Findings gate — decisions.yaml (non-fatal).
  const extra: Record<string, string | number> = {
    "Artifacts": resolvedArtifacts.join(", ") || "(none)",
    "Pipeline": resolvedPipeline ?? "(unresolved)",
    "Rollout": resolvedRollout,
    "Commit format": args.commitFormat,
    "Format": args.format,
    "To ref": args.toRef,
    "Pipelines": stats.pipelines,
    "Release notes": stats.releaseNotes,
    "Plans": stats.plans,
    "Env diffs": stats.diffs,
  };
  if (args.releaseVersion) extra["Release version"] = args.releaseVersion;
  if (args.fromRef) extra["From ref"] = args.fromRef;
  if (args.env) extra["Source env"] = args.env;
  if (args.toEnv) extra["Target env"] = args.toEnv;

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
    agent: "release",
    extra,
  });

  // Write the RELEASE-INDEX.md (markdown scaffold). Always emit so the user
  // can see what was requested even when the engine wrote nothing.
  const indexPath = join(outputDir, "RELEASE-INDEX.md");
  try {
    writeReleaseIndex(indexPath, {
      releaseVersion: args.releaseVersion,
      fromRef: args.fromRef,
      toRef: args.toRef,
      env: args.env,
      toEnv: args.toEnv,
      pipeline: resolvedPipeline ?? "(unresolved)",
      rollout: resolvedRollout,
      engineName: engineNameForOutputs,
      artifacts: resolvedArtifacts,
      commitFormat: args.commitFormat,
      findings,
      writtenFiles,
    });
  } catch (err) {
    process.stderr.write(
      `[dca-release] WARN: could not write RELEASE-INDEX: ${(err as Error).message}\n`,
    );
  }
  extra["Release index"] = indexPath;
  if (writtenFiles.length > 0) {
    extra["Artifact files written"] = writtenFiles.length;
  }

  const res = await emitStandardOutputs({
    agent: "release",
    meta: {
      agent: "release",
      engine: engineIdForOutputs,
      stack: engineIdForOutputs,
      projectName: basename(projectPath),
      projectRoot: projectPath,
      extra,
    },
    findings,
    outputDir,
    extraSheets: sla.extraSheet ? [sla.extraSheet] : undefined,
    changelogSummary: `Release authoring: ${stats.pipelines} pipeline(s), ${stats.releaseNotes} notes, ${stats.plans} plan(s), ${stats.diffs} env-diff(s); ${findings.length} finding(s).`,
  });

  console.log(`\n📊 Report:      ${res.xlsxPath}`);
  if (res.mdPath) console.log(`📄 Markdown:    ${res.mdPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG:  ${res.changelogPath}`);
  console.log(`🚀 Release idx: ${indexPath}`);
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
