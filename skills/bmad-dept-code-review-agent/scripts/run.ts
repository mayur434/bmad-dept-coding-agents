#!/usr/bin/env ts-node
/**
 * BMAD Code Review Agent — Dispatcher
 * =====================================
 * Entry point for the pre-merge code-review engine. Reviews a PR/diff range
 * (or uncommitted working-tree changes, or the full repo when no diff scope
 * is given) for style-guide violations, breaking API/schema/contract changes,
 * dependency-change risk, design-pattern violations, and produces a
 * role-adapted merge checklist plus GitHub/GitLab/inline-markdown-ready
 * review comments per stack. Complements the Audit agent's post-hoc deep
 * scan — this agent runs pre-merge.
 *
 * This is a scaffold — engine bodies are stubs; content (SKILL.md
 * instructions, templates, per-stack vocabulary) lands in a later
 * workstream. The dispatcher, all standard flags, decisions/SLA gates,
 * install preflight, role adaptation, and standardized emit are fully
 * wired here.
 *
 * Usage:
 *   npx ts-node run.ts --path /project --pr main..feature/checkout
 *   npx ts-node run.ts --path /project --diff --review-depth deep
 *   npx ts-node run.ts --path /project --from-ref origin/main --to-ref HEAD
 *   npx ts-node run.ts --path /project --artifacts style-check,checklist
 *   npx ts-node run.ts --list-engines
 */

import { resolve, join, basename } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
// Node-core-only + role/install (dep-free) + git (dep-free) + type-only
// imports are safe on first run. shared/output, shared/preflight, and the
// engine modules transitively require third-party packages (exceljs,
// fast-glob) and MUST be loaded lazily via require() inside main() AFTER
// ensureDepsInstalled().
import type { Finding, Severity } from "../../shared/core/types";
import { SEVERITY_RANK } from "../../shared/core/types";
import { resolveRole, parseRoleFlag } from "../../shared/role";
import { ensureDepsInstalled } from "../../shared/install";
import { resolveIntake, askAll, confirmRun, Question } from "../../shared/interactive";
import { resolveSourceBranch } from "../../shared/git";

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

type Artifact =
  | "review"
  | "style-check"
  | "breaking-changes"
  | "dependency-review"
  | "design-patterns"
  | "checklist";

const ALL_ARTIFACTS: Artifact[] = [
  "review",
  "style-check",
  "breaking-changes",
  "dependency-review",
  "design-patterns",
  "checklist",
];

const REVIEW_DEPTHS = ["quick", "standard", "deep"] as const;
type ReviewDepth = typeof REVIEW_DEPTHS[number];

const COMMENT_FORMATS = ["github", "gitlab", "inline-markdown"] as const;
type CommentFormat = typeof COMMENT_FORMATS[number];

const SEVERITIES_FOR_GATE = ["critical", "high", "medium", "low"] as const;
type SeverityGate = typeof SEVERITIES_FOR_GATE[number];

const DEFAULT_BASE_CANDIDATES = ["main", "master", "develop", "production"];

interface DiffRange {
  fromRef: string;
  toRef: string;
}

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
  // Code-Review-specific
  pr: string | null;
  diff: boolean;
  fromRef: string | null;
  toRef: string | null;
  styleGuide: string | null;
  reviewDepth: ReviewDepth | null;
  commentFormat: CommentFormat;
  failOnSeverity: SeverityGate | null;
  artifacts: string[];                 // resolved list of artifact keys (or ['all'])
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
    pr: null,
    diff: false,
    fromRef: null,
    toRef: null,
    styleGuide: null,
    reviewDepth: null,
    commentFormat: "inline-markdown",
    failOnSeverity: null,
    artifacts: [],
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
      case "--pr":
        parsed.pr = args[++i];
        break;
      case "--diff":
        parsed.diff = true;
        break;
      case "--from-ref":
        parsed.fromRef = args[++i];
        break;
      case "--to-ref":
        parsed.toRef = args[++i];
        break;
      case "--style-guide":
        parsed.styleGuide = args[++i];
        break;
      case "--review-depth": {
        const raw = (args[++i] ?? "").toLowerCase();
        if ((REVIEW_DEPTHS as readonly string[]).includes(raw)) {
          parsed.reviewDepth = raw as ReviewDepth;
        }
        break;
      }
      case "--comment-format": {
        const raw = (args[++i] ?? "").toLowerCase();
        if ((COMMENT_FORMATS as readonly string[]).includes(raw)) {
          parsed.commentFormat = raw as CommentFormat;
        }
        break;
      }
      case "--fail-on-severity": {
        const raw = (args[++i] ?? "").toLowerCase();
        if ((SEVERITIES_FOR_GATE as readonly string[]).includes(raw)) {
          parsed.failOnSeverity = raw as SeverityGate;
        }
        break;
      }
      case "--artifacts":
        parsed.artifacts = parseArtifacts(args[++i] ?? "");
        break;
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
BMAD Code Review Agent (scaffold)

Usage:
  npx ts-node run.ts [options]

Options:
  --path <dir>                     Path to project root (default: .)
  --engine <engine>                Platform engine (auto-detect if omitted)
                                   Accepts: aem | commerce-paas (alias: commerce) |
                                            commerce-saas | sling | spring |
                                            app-builder | eds | eds-commerce
                                   AEM aliases: aemcs, aemams
  --output <dir>                   Output directory for review reports + artifacts
                                   (default: <projectRoot>/code-review-reports/)
  --interactive                    Prompt step-by-step for missing intake inputs;
                                   persists choice to .bmad/intake.yaml.
  --technical                      Force technical mode; missing required inputs error out.
                                   Without either flag the CLI reads <project>/.bmad/intake.yaml
                                   (mode: interactive|technical), falling back to technical.
  --create-branch                  Cut standard branch dca/code-review-<stack>-<timestamp>
                                   before writing outputs
  --source-branch <name>           Source branch for --create-branch
                                   (default: production/main/master/develop)
  --preflight                      Print model/context + STATIC/LLM/HYBRID advisory and exit
  --no-preflight                   Suppress the preflight advisory
  --role <code>                    Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content
                                   (persisted at <project>/.bmad/role.yaml; --role wins for one run)
  --list-engines                   List available engines
  --help                           Show this help

Code review authoring:
  --pr <a>..<b>                    Diff range to review (git diff --name-only a..b).
                                   A single ref is treated as the PR head, diffed
                                   against the first existing main/master/develop/
                                   production branch. Mutually exclusive with
                                   --diff and --from-ref/--to-ref.
  --diff                           Review uncommitted working-tree changes
                                   (git diff HEAD). Mutually exclusive with --pr
                                   and --from-ref/--to-ref.
  --from-ref <ref>                 Explicit diff start ref — pair with --to-ref
                                   as an alternative to --pr.
  --to-ref <ref>                   Explicit diff end ref — pair with --from-ref.
  --style-guide <path>             Optional path to a custom style-guide doc to
                                   enforce alongside the built-in per-stack guide.
  --review-depth <depth>           quick | standard | deep. Default is role-driven:
                                   DE defaults to quick, TL/Security default to
                                   deep, everyone else defaults to standard.
                                     quick    = lint-level checks only
                                     standard = + design-pattern checks
                                     deep     = + cross-file semantic reasoning
  --comment-format <fmt>           Shape of the review-comment artifact. Values:
                                   github | gitlab | inline-markdown.
                                   Default: inline-markdown.
  --fail-on-severity <sev>         Exit code 7 if any finding at/above this
                                   severity exists. Values: critical | high |
                                   medium | low. Distinct from --fail-on-overdue
                                   (SLA-based, exit code 6).
  --artifacts <csv>                Which artifacts to author (comma-separated). Values:
                                   review, style-check, breaking-changes,
                                   dependency-review, design-patterns, checklist, all.
                                   Default: all.
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
// Diff-range resolution — --pr / --diff / --from-ref+--to-ref. None given is
// a valid fallback (full-repo review).
// ---------------------------------------------------------------------------

function resolveDiffRange(projectRoot: string, args: Args): DiffRange | null {
  if (args.fromRef && args.toRef) {
    return { fromRef: args.fromRef, toRef: args.toRef };
  }
  if (args.pr && args.pr.length > 0) {
    if (args.pr.includes("..")) {
      const [fromRef, toRef] = args.pr.split("..");
      return { fromRef, toRef };
    }
    const base = resolveSourceBranch(projectRoot, DEFAULT_BASE_CANDIDATES);
    if (!base) {
      throw new Error(
        `--pr <sha> needs a base branch (tried ${DEFAULT_BASE_CANDIDATES.join(", ")}); pass --pr <base>..<head> instead`,
      );
    }
    return { fromRef: base, toRef: args.pr };
  }
  if (args.diff) {
    return { fromRef: "HEAD", toRef: "(working tree)" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Review-depth default — role-driven when --review-depth is omitted.
// ---------------------------------------------------------------------------

function defaultReviewDepth(role: string): ReviewDepth {
  if (role === "de") return "quick";
  if (role === "tl" || role === "security") return "deep";
  return "standard";
}

// ---------------------------------------------------------------------------
// Code Review index writer — minimal Markdown writer so --output is always
// exercised even when the engine writes nothing (scaffold stub).
// ---------------------------------------------------------------------------

function writeCodeReviewIndex(
  indexPath: string,
  ctx: {
    diffRange: DiffRange | null;
    styleGuide: string | null;
    reviewDepth: string;
    commentFormat: string;
    engineName: string;
    artifacts: string[];
    format: string;
    findings: Finding[];
    writtenFiles: string[];
  },
): void {
  const lines: string[] = [];
  lines.push(`# Code Review Index`);
  lines.push("");
  lines.push(`_Generated by BMAD Code Review Agent — scaffold._`);
  lines.push(`_Stack: **${ctx.engineName}**._`);
  lines.push("");
  lines.push(`## Inputs`);
  lines.push("");
  lines.push(
    `- **Diff scope:** ${ctx.diffRange ? `${ctx.diffRange.fromRef} .. ${ctx.diffRange.toRef}` : "(full repo — no PR/diff scope given)"}`,
  );
  if (ctx.styleGuide) lines.push(`- **Custom style guide:** \`${ctx.styleGuide}\``);
  lines.push(`- **Review depth:** ${ctx.reviewDepth}`);
  lines.push(`- **Comment format:** ${ctx.commentFormat}`);
  lines.push(`- **Format:** ${ctx.format}`);
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
  lines.push(`## Review findings`);
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
    "A later workstream populates real style-check / breaking-change / dependency-review / design-pattern / checklist content per stack.",
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
  const diffSourcesGiven = [
    Boolean(args.pr),
    Boolean(args.diff),
    Boolean(args.fromRef || args.toRef),
  ].filter(Boolean).length;
  if (diffSourcesGiven > 1) {
    console.error("❌ --pr, --diff, and --from-ref/--to-ref are mutually exclusive.");
    process.exit(1);
  }
  if ((args.fromRef && !args.toRef) || (!args.fromRef && args.toRef)) {
    console.error("❌ --from-ref and --to-ref must be passed together.");
    process.exit(1);
  }

  // First-run dependency check. Must run BEFORE heavy modules are require()'d
  // below — the engine registry, shared/output, and shared/preflight
  // transitively pull in exceljs / fast-glob.
  const bootstrap = await ensureDepsInstalled({
    agentName: "code-review",
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
        key: "diff-source",
        prompt: "Review scope — full repo, a PR/diff range, or uncommitted changes?",
        choices: ["full-repo", "pr", "diff"],
        default: "full-repo",
      },
      {
        key: "pr",
        prompt: "PR/diff range (e.g. main..feature/checkout, or a single ref to diff against the default base)",
        when: (a) => a["diff-source"] === "pr",
      },
      {
        key: "style-guide",
        prompt: "Path to a custom style-guide doc — blank to use the built-in per-stack guide",
      },
      {
        key: "review-depth",
        prompt: "Review depth",
        choices: ["", "quick", "standard", "deep"],
        default: args.reviewDepth ?? "",
      },
      {
        key: "comment-format",
        prompt: "Review-comment artifact format",
        choices: ["github", "gitlab", "inline-markdown"],
        default: args.commentFormat,
      },
      {
        key: "artifacts",
        prompt: "Which artifacts? (comma-separated: review,style-check,breaking-changes,dependency-review,design-patterns,checklist,all)",
        default: args.artifacts.length ? args.artifacts.join(",") : "all",
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
      pr: args.pr ?? undefined,
      "style-guide": args.styleGuide ?? undefined,
      "review-depth": args.reviewDepth ?? undefined,
      "comment-format": args.commentFormat,
    };
    const answers = await askAll({ questions, existing });
    if (answers.path && (args.path === "." || !args.path)) args.path = answers.path;
    if (answers.engine && answers.engine !== "auto" && !args.engine) args.engine = answers.engine;
    if (answers["diff-source"] === "pr" && answers.pr && !args.pr) args.pr = answers.pr;
    if (answers["diff-source"] === "diff" && !args.diff) args.diff = true;
    if (answers["style-guide"] && !args.styleGuide) args.styleGuide = answers["style-guide"];
    if (answers["review-depth"] && !args.reviewDepth &&
        (REVIEW_DEPTHS as readonly string[]).includes(answers["review-depth"])) {
      args.reviewDepth = answers["review-depth"] as ReviewDepth;
    }
    if (answers["comment-format"] &&
        (COMMENT_FORMATS as readonly string[]).includes(answers["comment-format"])) {
      args.commentFormat = answers["comment-format"] as CommentFormat;
    }
    if (answers.artifacts) {
      const parsed = parseArtifacts(answers.artifacts);
      if (parsed.length) args.artifacts = parsed;
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
      args.pr ? `--pr ${args.pr}` : "",
      args.diff ? "--diff" : "",
      args.styleGuide ? `--style-guide ${args.styleGuide}` : "",
      args.reviewDepth ? `--review-depth ${args.reviewDepth}` : "",
      `--comment-format ${args.commentFormat}`,
      args.artifacts.length ? `--artifacts ${args.artifacts.join(",")}` : "",
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
  const resolvedReviewDepth: ReviewDepth = args.reviewDepth ?? defaultReviewDepth(activeRole);

  // ── Diff-range resolution: --pr / --diff / --from-ref+--to-ref. None given
  //   is a valid fallback (full-repo review).
  let diffRange: DiffRange | null;
  try {
    diffRange = resolveDiffRange(projectPath, args);
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }

  // ── Engine resolution: real registry lookup; if nothing detected we still
  //   proceed with a "generic" fallback so the dispatcher emit path is exercised.
  const engine = getEngine(args.engine, projectPath);
  const engineIdForOutputs = engine?.id ?? "generic";
  const engineNameForOutputs = engine?.name ?? "Generic (no stack detected)";
  let engineFindings: Finding[] = [];
  let stats = { filesReviewed: 0, comments: 0, breakingChanges: 0, patternViolations: 0 };
  let writtenFiles: string[] = [];

  if (!args.noPreflight && !process.argv.includes("--no-preflight")) {
    console.log(renderPreflight(runPreflight(projectPath), { agent: "code-review", stack: engineIdForOutputs }) + "\n");
    if (args.preflight || process.argv.includes("--preflight")) return;
  }

  console.log(`📝 BMAD Code Review Agent`);
  console.log(`   Path:          ${projectPath}`);
  console.log(`   Engine:        ${engineNameForOutputs}`);
  console.log(`   Diff scope:    ${diffRange ? `${diffRange.fromRef} .. ${diffRange.toRef}` : "(full repo)"}`);
  if (args.styleGuide) console.log(`   Style guide:   ${args.styleGuide}`);
  console.log(`   Review depth:  ${resolvedReviewDepth}`);
  console.log(`   Comment fmt:   ${args.commentFormat}`);
  console.log(`   Artifacts:     ${resolvedArtifacts.join(", ") || "(none)"}`);
  console.log(`   Format:        ${args.format}`);
  console.log("");

  if (args.format === "both") {
    process.stderr.write(
      "[dca-code-review] WARN: --format both — docx output is planned for a later phase; writing markdown only for now.\n",
    );
  }

  // Standard branch (output C).
  maybeCutStandardBranch(process.argv, {
    agent: "code-review",
    stack: engineIdForOutputs,
    projectRoot: projectPath,
  });

  const outputDir = args.output ?? join(projectPath, "code-review-reports");
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch {
    /* non-fatal */
  }

  // Auto-detect fallback: emit an INFO finding when no engine was matched.
  if (!engine) {
    process.stderr.write(
      "[dca-code-review] INFO: no stack auto-detected; using generic fallback. Pass --engine <id> for stack-native output.\n",
    );
    engineFindings.push({
      title: "No engine detected — code review falling back to generic",
      description:
        "The dispatcher could not auto-detect a supported stack in this project. The current run continues with a generic profile; specify --engine <id> for stack-native style-guide / breaking-change / dependency-review / design-pattern checks.",
      stack: engineIdForOutputs,
      category: "Code Review",
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
        diffRange,
        styleGuide: args.styleGuide ?? undefined,
        reviewDepth: resolvedReviewDepth,
        commentFormat: args.commentFormat,
        artifacts: resolvedArtifacts,
        format: args.format,
        role: activeRole,
        outputDir,
      });
      engineFindings = engineFindings.concat(result.findings);
      stats = result.stats;
      writtenFiles = result.writtenFiles;
    } catch (err) {
      process.stderr.write(
        `[dca-code-review] WARN: engine ${engineIdForOutputs} failed: ${(err as Error).message}\n`,
      );
      engineFindings.push({
        title: `Engine ${engineIdForOutputs} failed at review time`,
        description: (err as Error).message,
        stack: engineIdForOutputs,
        category: "Code Review",
        severity: "HIGH",
        source: "scanner",
        recommendation: "Check the engine module for exceptions and rerun.",
      });
    }
  }

  // Findings gate — decisions.yaml (non-fatal).
  const extra: Record<string, string | number> = {
    "Artifacts": resolvedArtifacts.join(", ") || "(none)",
    "Diff scope": diffRange ? `${diffRange.fromRef}..${diffRange.toRef}` : "(full repo)",
    "Review depth": resolvedReviewDepth,
    "Comment format": args.commentFormat,
    "Format": args.format,
    "Files reviewed": stats.filesReviewed,
    "Comments": stats.comments,
    "Breaking changes": stats.breakingChanges,
    "Pattern violations": stats.patternViolations,
  };
  if (args.styleGuide) extra["Style guide"] = args.styleGuide;

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
    agent: "code-review",
    extra,
  });

  // Write the CODE-REVIEW-INDEX.md (markdown scaffold). Always emit so the
  // user can see what was requested even when the engine wrote nothing.
  const indexPath = join(outputDir, "CODE-REVIEW-INDEX.md");
  try {
    writeCodeReviewIndex(indexPath, {
      diffRange,
      styleGuide: args.styleGuide,
      reviewDepth: resolvedReviewDepth,
      commentFormat: args.commentFormat,
      engineName: engineNameForOutputs,
      artifacts: resolvedArtifacts,
      format: args.format,
      findings,
      writtenFiles,
    });
  } catch (err) {
    process.stderr.write(
      `[dca-code-review] WARN: could not write CODE-REVIEW-INDEX: ${(err as Error).message}\n`,
    );
  }
  extra["Code review index"] = indexPath;
  if (writtenFiles.length > 0) {
    extra["Artifact files written"] = writtenFiles.length;
  }

  const res = await emitStandardOutputs({
    agent: "code-review",
    meta: {
      agent: "code-review",
      engine: engineIdForOutputs,
      stack: engineIdForOutputs,
      projectName: basename(projectPath),
      projectRoot: projectPath,
      extra,
    },
    findings,
    outputDir,
    extraSheets: sla.extraSheet ? [sla.extraSheet] : undefined,
    changelogSummary: `Code review: ${stats.filesReviewed} file(s) reviewed, ${stats.comments} comment(s), ${stats.breakingChanges} breaking change(s), ${stats.patternViolations} pattern violation(s); ${findings.length} finding(s).`,
  });

  console.log(`\n📊 Report:      ${res.xlsxPath}`);
  if (res.mdPath) console.log(`📄 Markdown:    ${res.mdPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG:  ${res.changelogPath}`);
  console.log(`📝 Review index: ${indexPath}`);
  if (writtenFiles.length > 0) {
    console.log(`📚 Artifacts:   ${writtenFiles.length} file(s)`);
  }

  // --fail-on-overdue: after emit, exit 6 if any finding is OVERDUE per SLA.
  maybeFailOnOverdue(sla.summary);

  // --fail-on-severity: after emit, exit 7 if any finding is at/above the
  // requested severity threshold. Distinct from --fail-on-overdue (SLA-based,
  // exit code 6).
  if (args.failOnSeverity) {
    const thresholdRank = SEVERITY_RANK[args.failOnSeverity.toUpperCase() as Severity];
    const offenders = findings.filter((f) => SEVERITY_RANK[f.severity] <= thresholdRank);
    if (offenders.length > 0) {
      process.stderr.write(
        `[dca-code-review] --fail-on-severity ${args.failOnSeverity}: ${offenders.length} finding(s) at/above threshold; exiting 7.\n`,
      );
      process.exit(7);
    }
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
