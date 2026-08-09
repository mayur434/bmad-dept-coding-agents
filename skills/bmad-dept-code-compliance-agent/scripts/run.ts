#!/usr/bin/env ts-node
/**
 * BMAD Compliance Agent — Dispatcher (Phase 4 scaffold)
 * =======================================================
 * Entry point for the governance/compliance-mapping engine — SDLC phase 8.
 * Maps findings from OTHER DCA agents' findings caches (audit, sonar-scan,
 * test-coverage, impact-analysis, code-review) against 8 compliance
 * frameworks: CWE, OWASP Top 10, CIS Controls, PCI-DSS, HIPAA, GDPR, SOX,
 * ISO 27001. Produces control-mapping reports, audit-trail exports,
 * auditor cover letters, remediation plans (with SLA), and sign-off
 * attestations.
 *
 * Design difference from every other DCA agent: Compliance's "engines" are
 * per-COMPLIANCE-FRAMEWORK (see scripts/engines/registry.ts), not per
 * tech-stack — this agent does not scan code itself. Its primary data
 * source is `consumeLatestFindings` reading other agents' findings caches
 * at `<projectRoot>/.bmad/cache/`.
 *
 * This is the Phase 4 scaffold — per-framework mapper bodies are stubs;
 * real control catalogs (SKILL.md instructions, resources, templates) land
 * in a later workstream. The dispatcher, all standard flags,
 * decisions/SLA gates, install preflight, role adaptation, and
 * standardized emit are fully wired here.
 *
 * Usage:
 *   npx ts-node run.ts --path /project --framework cwe,owasp
 *   npx ts-node run.ts --artifacts control-mapping --source-agent audit,sonar-scan
 *   npx ts-node run.ts --framework all --audit-trail --attestation-signer "Jane Doe, CISO"
 *   npx ts-node run.ts --list-frameworks
 */

import { resolve, join, basename } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
// Node-core-only + role/install (dep-free) + type-only imports are safe on
// first run. shared/output, shared/preflight, shared/findings, and the
// framework registry transitively require third-party packages (exceljs,
// fast-glob) and MUST be loaded lazily via require() inside main() AFTER
// ensureDepsInstalled().
import type { Finding } from "../../shared/core/types";
import { resolveRole, parseRoleFlag } from "../../shared/role";
import { ensureDepsInstalled } from "../../shared/install";
import { resolveIntake, askAll, confirmRun, Question } from "../../shared/interactive";

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

type Artifact =
  | "control-mapping"
  | "audit-trail"
  | "cover-letter"
  | "remediation-plan"
  | "attestation";

const ALL_ARTIFACTS: Artifact[] = [
  "control-mapping",
  "audit-trail",
  "cover-letter",
  "remediation-plan",
  "attestation",
];

const SOURCE_AGENTS = [
  "audit",
  "sonar-scan",
  "test-coverage",
  "impact-analysis",
  "code-review",
] as const;
type SourceAgent = typeof SOURCE_AGENTS[number];

// Role-driven --framework defaults (used when --framework is omitted and no
// explicit list resolves). Kept minimal here — the full role-behavior
// matrix (incl. stack-driven pci default, hipaa opt-in) lands with SKILL.md
// content in a later workstream.
const ROLE_FRAMEWORK_DEFAULTS: Record<string, string[]> = {
  security: ["cwe", "owasp"],
  migration: ["sox"],
};

interface Args {
  path: string;
  framework: string | null;
  output: string | null;
  interactive: boolean;
  technical: boolean;
  listFrameworks: boolean;
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
  // Compliance-specific
  sourceAgent: string[];          // resolved list of source-agent keys (or ['all'] pre-resolution)
  sourceMaxAgeHours: number;
  auditTrail: boolean;
  attestationSigner: string | null;
  artifacts: string[];            // resolved list of artifact keys
  remediationSla: boolean;
  format: "markdown" | "both";
}

function parseArtifacts(raw: string): string[] {
  const items = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (items.includes("all")) return [...ALL_ARTIFACTS];
  const valid = new Set<string>(ALL_ARTIFACTS as string[]);
  return items.filter((s) => valid.has(s));
}

function parseSourceAgents(raw: string): string[] {
  const items = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (items.includes("all")) return [...SOURCE_AGENTS];
  const valid = new Set<string>(SOURCE_AGENTS as readonly string[]);
  return items.filter((s) => valid.has(s));
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Args = {
    path: ".",
    framework: null,
    output: null,
    interactive: false,
    technical: false,
    listFrameworks: false,
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
    sourceAgent: [],
    sourceMaxAgeHours: 168,
    auditTrail: false,
    attestationSigner: null,
    artifacts: [],
    remediationSla: true,
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
      // --framework is the primary framework selector; --engine is kept as a
      // synonym for consistency with every other DCA dispatcher's --engine flag.
      case "--framework":
      case "--engine":
        parsed.framework = args[++i];
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
      case "--list-frameworks":
      case "--list-engines": // alias, in case a caller reaches for the familiar flag
        parsed.listFrameworks = true;
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
      case "--source-agent":
        parsed.sourceAgent = parseSourceAgents(args[++i] ?? "");
        break;
      case "--source-max-age-hours": {
        const raw = Number(args[++i]);
        if (Number.isFinite(raw) && raw >= 0) parsed.sourceMaxAgeHours = raw;
        break;
      }
      case "--audit-trail":
        parsed.auditTrail = true;
        break;
      case "--attestation-signer":
        parsed.attestationSigner = args[++i];
        break;
      case "--artifacts":
        parsed.artifacts = parseArtifacts(args[++i] ?? "");
        break;
      case "--remediation-sla":
        parsed.remediationSla = true;
        break;
      case "--no-remediation-sla":
        parsed.remediationSla = false;
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
BMAD Compliance Agent (Phase 4 scaffold)

Usage:
  npx ts-node run.ts [options]

Options:
  --path <dir>                     Path to project root (default: .)
  --output <dir>                   Output directory for compliance reports + artifacts
                                   (default: <projectRoot>/compliance-reports/)
  --interactive                    Prompt step-by-step for missing intake inputs;
                                   persists choice to .bmad/intake.yaml.
  --technical                      Force technical mode; missing required inputs error out.
                                   Without either flag the CLI reads <project>/.bmad/intake.yaml
                                   (mode: interactive|technical), falling back to technical.
  --create-branch                  Cut standard branch dca/compliance-<framework>-<timestamp>
                                   before writing outputs
  --source-branch <name>           Source branch for --create-branch
                                   (default: production/main/master/develop)
  --preflight                      Print model/context + STATIC/LLM/HYBRID advisory and exit
  --no-preflight                   Suppress the preflight advisory
  --role <code>                    Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content
                                   (persisted at <project>/.bmad/role.yaml; --role wins for one run)
  --list-frameworks                List available compliance frameworks
  --help                           Show this help

Compliance mapping:
  --framework <csv>                Comma-separated compliance frameworks to map against.
                                   Values: cwe | owasp | cis | pci | hipaa | gdpr | sox |
                                            iso27001 | all
                                   Default: role-driven (security -> cwe,owasp; migration ->
                                            sox); falls back to cwe,owasp when no role default
                                            resolves. Alias: --engine (kept for dispatcher-flag
                                            consistency with the other DCA agents).
  --source-agent <csv>             Which agents' findings-cache to pull from. Values:
                                   audit | sonar-scan | test-coverage | impact-analysis |
                                   code-review | all. Default: all.
  --source-max-age-hours <n>       How fresh the source findings must be, in hours.
                                   Default: 168 (7 days).
  --audit-trail                    Include CHANGE-LOG.md + findings-cache run history as
                                   part of the run (surfaced in COMPLIANCE-INDEX.md and
                                   passed to each framework mapper).
  --attestation-signer <name>      Free-text name/role for the sign-off block on the
                                   attestation artifact (e.g. "Jane Doe, CISO").
  --artifacts <csv>                Which artifacts to author (comma-separated). Values:
                                   control-mapping, audit-trail, cover-letter,
                                   remediation-plan, attestation, all. Default: all.
  --remediation-sla                Attach SLA deadlines to remediation items (default: on).
  --no-remediation-sla             Skip SLA deadlines on remediation items for this run.
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
  --no-sla                            Skip SLA computation + sheet entirely.
  --fail-on-overdue                   Exit code 6 if any finding is OVERDUE per role SLA.

Frameworks:
  cwe            CWE (Common Weakness Enumeration)
  owasp          OWASP Top 10
  cis            CIS Controls
  pci            PCI-DSS
  hipaa          HIPAA
  gdpr           GDPR
  sox            SOX
  iso27001       ISO 27001
`);
}

// ---------------------------------------------------------------------------
// Compliance index writer — Phase 4 minimal Markdown writer. Framework
// mappers emit their own artifact files once content lands; here we drop a
// single COMPLIANCE-INDEX.md so --output is always exercised.
// ---------------------------------------------------------------------------

function writeComplianceIndex(
  indexPath: string,
  ctx: {
    frameworks: string[];
    sourceAgents: string[];
    sourceHits: string[];
    sourceMaxAgeHours: number;
    artifacts: string[];
    auditTrail: boolean;
    auditTrailNote: string | null;
    attestationSigner: string | null;
    remediationSla: boolean;
    format: string;
    findingsMapped: number;
    controlsCovered: number;
    controlsGap: number;
    findings: Finding[];
    writtenFiles: string[];
  },
): void {
  const lines: string[] = [];
  lines.push(`# Compliance Index`);
  lines.push("");
  lines.push(`_Generated by BMAD Compliance Agent — Phase 4 scaffold._`);
  lines.push(`_Frameworks: **${ctx.frameworks.join(", ")}**._`);
  lines.push("");
  lines.push(`## Inputs`);
  lines.push("");
  lines.push(`- **Source agents requested:** ${ctx.sourceAgents.join(", ") || "(none)"}`);
  lines.push(`- **Source agents with cached findings:** ${ctx.sourceHits.join(", ") || "(none)"}`);
  lines.push(`- **Source max age:** ${ctx.sourceMaxAgeHours}h`);
  lines.push(`- **Artifacts requested:** ${ctx.artifacts.join(", ") || "(none)"}`);
  lines.push(`- **Remediation SLA:** ${ctx.remediationSla ? "on" : "off"}`);
  if (ctx.attestationSigner) lines.push(`- **Attestation signer:** ${ctx.attestationSigner}`);
  lines.push(`- **Audit trail:** ${ctx.auditTrail ? "requested" : "not requested"}`);
  if (ctx.auditTrail && ctx.auditTrailNote) lines.push(`  - ${ctx.auditTrailNote}`);
  lines.push(`- **Format:** ${ctx.format}`);
  lines.push("");
  lines.push(`## Mapping stats`);
  lines.push("");
  lines.push(`- **Findings mapped:** ${ctx.findingsMapped}`);
  lines.push(`- **Controls covered:** ${ctx.controlsCovered}`);
  lines.push(`- **Controls gap:** ${ctx.controlsGap}`);
  lines.push("");
  lines.push(`## Written files`);
  lines.push("");
  if (ctx.writtenFiles.length === 0) {
    lines.push("_No artifact files written by this run (stub framework mappers)._");
  } else {
    for (const f of ctx.writtenFiles) {
      lines.push(`- \`${f}\``);
    }
  }
  lines.push("");
  lines.push(`## Mapping findings`);
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
    "A later workstream populates real per-framework control catalogs, control-mapping " +
      "rows, audit-trail exports, cover letters, remediation plans, and attestation content.",
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
  // below — the framework registry, shared/output, shared/preflight, and
  // shared/findings transitively pull in exceljs / fast-glob.
  const bootstrap = await ensureDepsInstalled({
    agentName: "compliance",
    yes: args.yesInstall,
    no: args.noInstall,
  });
  if (bootstrap.exitCode !== 0) process.exit(bootstrap.exitCode);

  // Lazy loads — safe now that node_modules is guaranteed present.
  const { getFrameworkMapper, listFrameworks, resolveFrameworks, FRAMEWORKS } =
    require("./engines/registry") as typeof import("./engines/registry");
  const { emitStandardOutputs, maybeCutStandardBranch } = require("../../shared/output") as typeof import("../../shared/output");
  const { runPreflight, renderPreflight } = require("../../shared/preflight") as typeof import("../../shared/preflight");
  const { applyDecisionsFilter, listDecisions: listDecisionsFn } =
    require("./decisions-gate") as typeof import("./decisions-gate");
  const { applySLA, maybeFailOnOverdue } = require("./sla-gate") as typeof import("./sla-gate");
  const { consumeLatestFindings, emitFindingsCache, readAllRuns } =
    require("../../shared/findings") as typeof import("../../shared/findings");

  if (args.listFrameworks) {
    listFrameworks();
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
  // Propagate SLA gate flags via env. --no-remediation-sla behaves like
  // --no-sla for this run (the remediation-plan artifact is the only
  // consumer of SLA deadlines, but the shared gate applies suite-wide).
  if (args.slaPath) process.env.DCA_SLA_PATH = resolve(args.slaPath);
  if (args.noSla || !args.remediationSla) process.env.DCA_NO_SLA = "1";
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
        key: "framework",
        prompt: "Which compliance framework(s)? (comma-separated: cwe,owasp,cis,pci,hipaa,gdpr,sox,iso27001,all)",
        default: "auto",
      },
      {
        key: "source-agent",
        prompt: "Which agents' cached findings should be mapped? (comma-separated: audit,sonar-scan,test-coverage,impact-analysis,code-review,all)",
        default: args.sourceAgent.length ? args.sourceAgent.join(",") : "all",
      },
      {
        key: "artifacts",
        prompt: "Which artifacts? (comma-separated: control-mapping,audit-trail,cover-letter,remediation-plan,attestation,all)",
        default: args.artifacts.length ? args.artifacts.join(",") : "all",
      },
      {
        key: "audit-trail",
        prompt: "Include CHANGE-LOG.md + findings-cache history export?",
        choices: ["y", "n"],
        default: "n",
      },
      {
        key: "attestation-signer",
        prompt: "Attestation signer name/role (blank if not authoring an attestation)",
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
      framework: args.framework ?? undefined,
      "source-agent": args.sourceAgent.length ? args.sourceAgent.join(",") : undefined,
      "attestation-signer": args.attestationSigner ?? undefined,
    };
    const answers = await askAll({ questions, existing });
    if (answers.path && (args.path === "." || !args.path)) args.path = answers.path;
    if (answers.framework && answers.framework !== "auto" && !args.framework) {
      args.framework = answers.framework;
    }
    if (answers["source-agent"] && args.sourceAgent.length === 0) {
      const parsed = parseSourceAgents(answers["source-agent"]);
      if (parsed.length) args.sourceAgent = parsed;
    }
    if (answers.artifacts) {
      const parsed = parseArtifacts(answers.artifacts);
      if (parsed.length) args.artifacts = parsed;
    }
    if (answers["audit-trail"] === "y") args.auditTrail = true;
    if (answers["attestation-signer"] && !args.attestationSigner) {
      args.attestationSigner = answers["attestation-signer"];
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
      args.framework ? `--framework ${args.framework}` : "",
      args.sourceAgent.length ? `--source-agent ${args.sourceAgent.join(",")}` : "",
      args.artifacts.length ? `--artifacts ${args.artifacts.join(",")}` : "",
      args.auditTrail ? "--audit-trail" : "",
      args.attestationSigner ? `--attestation-signer "${args.attestationSigner}"` : "",
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

  const activeRole = process.env.DCA_ROLE || "generic";

  // ── Framework resolution — NOT stack auto-detection. Explicit --framework
  //   (or --engine alias) wins; else role default; else cwe,owasp fallback.
  const roleDefault = ROLE_FRAMEWORK_DEFAULTS[activeRole] ?? [];
  const resolvedFrameworks = resolveFrameworks(args.framework ?? undefined, roleDefault);

  // ── Source-agent resolution — default 'all' when omitted.
  const resolvedSourceAgents: SourceAgent[] =
    (args.sourceAgent.length > 0 ? args.sourceAgent : [...SOURCE_AGENTS]) as SourceAgent[];

  // ── Artifact resolution — default 'all' when omitted.
  const resolvedArtifacts = args.artifacts.length > 0 ? args.artifacts : [...ALL_ARTIFACTS];

  if (!args.noPreflight && !process.argv.includes("--no-preflight")) {
    console.log(
      renderPreflight(runPreflight(projectPath), { agent: "compliance", stack: resolvedFrameworks.join(",") }) + "\n",
    );
    if (args.preflight || process.argv.includes("--preflight")) return;
  }

  console.log(`⚖️  BMAD Compliance Agent`);
  console.log(`   Path:          ${projectPath}`);
  console.log(`   Frameworks:    ${resolvedFrameworks.join(", ")}`);
  console.log(`   Source agents: ${resolvedSourceAgents.join(", ")}`);
  console.log(`   Artifacts:     ${resolvedArtifacts.join(", ") || "(none)"}`);
  console.log(`   Format:        ${args.format}`);
  console.log("");

  if (args.format === "both") {
    process.stderr.write(
      "[dca-compliance] WARN: --format both — docx output is planned for a later phase; writing markdown only for now.\n",
    );
  }

  // Standard branch (output C).
  maybeCutStandardBranch(process.argv, {
    agent: "compliance",
    stack: resolvedFrameworks.join(","),
    projectRoot: projectPath,
  });

  const outputDir = args.output ?? join(projectPath, "compliance-reports");
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch {
    /* non-fatal */
  }

  // ── Consume other agents' findings caches — this agent's PRIMARY data
  //   source. Non-fatal per source agent: a missing cache is skipped with an
  //   INFO note, never a crash.
  const mergedFindings: Finding[] = [];
  const sourceHits: string[] = [];
  for (const agent of resolvedSourceAgents) {
    try {
      const consumed = consumeLatestFindings({
        projectRoot: projectPath,
        fromAgent: agent,
        maxAgeHours: args.sourceMaxAgeHours,
      });
      if (!consumed) {
        process.stderr.write(
          `[dca-compliance] INFO: no cached findings from '${agent}' within ${args.sourceMaxAgeHours}h — skipping.\n`,
        );
        continue;
      }
      sourceHits.push(agent);
      for (const f of consumed.findings) {
        mergedFindings.push({
          ...f,
          references: [...(f.references ?? []), `source-agent:${agent}`],
        });
      }
    } catch (err) {
      process.stderr.write(
        `[dca-compliance] WARN: consumeLatestFindings('${agent}') failed: ${(err as Error).message}\n`,
      );
    }
  }

  if (mergedFindings.length === 0) {
    process.stderr.write(
      `[dca-compliance] INFO: No cached findings from ${resolvedSourceAgents.join(", ")} — run audit/sonar-scan/test-coverage first, ` +
        `or this report will be a scaffold-only compliance framework reference.\n`,
    );
  } else {
    console.log(`   📥 Merged findings: ${mergedFindings.length} from [${sourceHits.join(", ") || "none"}]`);
  }

  // ── Optional audit-trail data — findings-cache run history + CHANGE-LOG
  //   presence. Non-fatal.
  let auditTrailNote: string | null = null;
  if (args.auditTrail) {
    try {
      const allRuns = readAllRuns(projectPath);
      const changelogPath = join(projectPath, "CHANGE-LOG.md");
      const hasChangelog = existsSync(changelogPath);
      auditTrailNote = `${allRuns.length} cached run(s) across the DCA suite` +
        `; CHANGE-LOG.md ${hasChangelog ? "present" : "absent"}.`;
      process.stderr.write(`[dca-compliance] audit-trail: ${auditTrailNote}\n`);
    } catch (err) {
      process.stderr.write(
        `[dca-compliance] WARN: audit-trail history lookup failed: ${(err as Error).message}\n`,
      );
    }
  }

  // ── Dispatch each resolved framework's mapper against the SAME merged
  //   findings set — non-fatal per framework.
  let allFindings: Finding[];
  let writtenFiles: string[] = [];
  let controlsCovered = 0;
  let controlsGap = 0;
  let findingsMapped = 0;
  const dispatchedFindings: Finding[] = [];

  for (const frameworkId of resolvedFrameworks) {
    const mapper = getFrameworkMapper(frameworkId);
    if (!mapper) {
      dispatchedFindings.push({
        title: `Unknown compliance framework: ${frameworkId}`,
        description: `--framework included '${frameworkId}', which is not a registered framework. Available: ${FRAMEWORKS.join(", ")}.`,
        stack: "compliance",
        category: "Compliance",
        severity: "MEDIUM",
        source: "scanner",
        recommendation: `Run --list-frameworks to see valid values.`,
      });
      continue;
    }
    try {
      const result = await mapper.main({
        projectRoot: projectPath,
        findings: mergedFindings,
        sourceAgents: sourceHits,
        artifacts: resolvedArtifacts,
        attestationSigner: args.attestationSigner ?? undefined,
        auditTrail: args.auditTrail,
        remediationSla: args.remediationSla,
        format: args.format,
        role: activeRole,
        outputDir,
      });
      dispatchedFindings.push(...result.findings);
      writtenFiles = writtenFiles.concat(result.writtenFiles);
      controlsCovered += result.stats.controlsCovered;
      controlsGap += result.stats.controlsGap;
      findingsMapped += result.stats.findingsMapped;
    } catch (err) {
      process.stderr.write(
        `[dca-compliance] WARN: framework mapper '${frameworkId}' failed: ${(err as Error).message}\n`,
      );
      dispatchedFindings.push({
        title: `Framework mapper ${frameworkId} failed at compliance-mapping time`,
        description: (err as Error).message,
        stack: "compliance",
        category: "Compliance",
        severity: "HIGH",
        source: "scanner",
        recommendation: "Check the framework mapper module for exceptions and rerun.",
      });
    }
  }
  allFindings = dispatchedFindings;

  // Findings gate — decisions.yaml (non-fatal).
  const extra: Record<string, string | number> = {
    "Frameworks": resolvedFrameworks.join(", "),
    "Source agents requested": resolvedSourceAgents.join(", "),
    "Source agents with cache hits": sourceHits.join(", ") || "(none)",
    "Source max age (h)": args.sourceMaxAgeHours,
    "Artifacts": resolvedArtifacts.join(", ") || "(none)",
    "Remediation SLA": args.remediationSla ? "on" : "off",
    "Format": args.format,
    "Findings merged": mergedFindings.length,
    "Findings mapped": findingsMapped,
    "Controls covered": controlsCovered,
    "Controls gap": controlsGap,
  };
  if (args.attestationSigner) extra["Attestation signer"] = args.attestationSigner;
  if (args.auditTrail) extra["Audit trail"] = auditTrailNote ?? "requested";

  const gate = applyDecisionsFilter(allFindings, projectPath, extra);
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

  // SLA gate — non-fatal. Skipped entirely when --no-sla or --no-remediation-sla.
  const sla = applySLA({
    findings,
    projectRoot: projectPath,
    agent: "compliance",
    extra,
  });

  // Write the COMPLIANCE-INDEX.md (markdown scaffold). Always emit so the
  // user can see what was requested even when the mappers wrote nothing.
  const indexPath = join(outputDir, "COMPLIANCE-INDEX.md");
  try {
    writeComplianceIndex(indexPath, {
      frameworks: resolvedFrameworks,
      sourceAgents: resolvedSourceAgents,
      sourceHits,
      sourceMaxAgeHours: args.sourceMaxAgeHours,
      artifacts: resolvedArtifacts,
      auditTrail: args.auditTrail,
      auditTrailNote,
      attestationSigner: args.attestationSigner,
      remediationSla: args.remediationSla,
      format: args.format,
      findingsMapped,
      controlsCovered,
      controlsGap,
      findings,
      writtenFiles,
    });
  } catch (err) {
    process.stderr.write(
      `[dca-compliance] WARN: could not write COMPLIANCE-INDEX: ${(err as Error).message}\n`,
    );
  }
  extra["Compliance index"] = indexPath;
  if (writtenFiles.length > 0) {
    extra["Artifact files written"] = writtenFiles.length;
  }

  const res = await emitStandardOutputs({
    agent: "compliance",
    meta: {
      agent: "compliance",
      engine: resolvedFrameworks.join(","),
      stack: resolvedFrameworks.join(","),
      projectName: basename(projectPath),
      projectRoot: projectPath,
      extra,
    },
    findings,
    outputDir,
    extraSheets: sla.extraSheet ? [sla.extraSheet] : undefined,
    changelogSummary: `Compliance mapping: ${resolvedFrameworks.join(", ")}; ${findingsMapped} finding(s) mapped, ${controlsCovered} control(s) covered, ${controlsGap} control(s) gap; ${findings.length} report finding(s).`,
  });

  // Persist to the shared findings cache for downstream cross-refs.
  try {
    emitFindingsCache({
      projectRoot: projectPath,
      agent: "compliance",
      stack: resolvedFrameworks.join(","),
      branch: res.meta.workingBranch ?? "nobranch",
      timestamp: res.meta.timestamp ?? "",
      reportPath: res.xlsxPath,
      findings,
      meta: {
        role: activeRole,
        frameworks: resolvedFrameworks.join(","),
        sourceAgents: sourceHits.join(","),
      },
    });
  } catch (err) {
    process.stderr.write(
      `[dca-compliance] WARN: findings cache write failed: ${(err as Error).message}\n`,
    );
  }

  console.log(`\n📊 Report:      ${res.xlsxPath}`);
  if (res.mdPath) console.log(`📄 Markdown:    ${res.mdPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG:  ${res.changelogPath}`);
  console.log(`⚖️  Compliance index: ${indexPath}`);
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
