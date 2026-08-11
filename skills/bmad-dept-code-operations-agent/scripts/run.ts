#!/usr/bin/env ts-node
/**
 * BMAD Operations Agent — Dispatcher (Phase 3.4)
 * ==============================================
 * Entry point for the operations-authoring engine. Authors runbooks,
 * observability dashboards (Datadog, New Relic, Grafana, Prometheus,
 * Elastic, CloudWatch, Dynatrace), alert rules, SLO/SLI definitions,
 * on-call rotation configs, incident-response playbooks, and blameless
 * postmortems per stack.
 *
 * This is the Phase 3.4 scaffold — engine bodies are stubs; content
 * (SKILL.md instructions, templates, per-stack vocabulary) lands in Phase
 * 3.5. The dispatcher, all standard flags, decisions/SLA gates, install
 * preflight, role adaptation, and standardized emit are fully wired here.
 *
 * Usage:
 *   npx ts-node run.ts --path /project --service checkout-api --service-tier t1
 *   npx ts-node run.ts --observability datadog --artifacts dashboard,alerts
 *   npx ts-node run.ts --artifacts postmortem --incident "checkout latency spike after 2.5.0 deploy"
 *   npx ts-node run.ts --list-engines
 */

import { resolve, join, basename } from "path";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
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
  | "runbook"
  | "dashboard"
  | "alerts"
  | "slo"
  | "oncall-rotation"
  | "playbook"
  | "postmortem";

const ALL_ARTIFACTS: Artifact[] = [
  "runbook",
  "dashboard",
  "alerts",
  "slo",
  "oncall-rotation",
  "playbook",
  "postmortem",
];

const OBSERVABILITY_TARGETS = [
  "datadog",
  "newrelic",
  "grafana",
  "elastic",
  "prometheus",
  "cloudwatch",
  "dynatrace",
] as const;
type ObservabilityTarget = typeof OBSERVABILITY_TARGETS[number];

const SERVICE_TIERS = ["t1", "t2", "t3"] as const;
type ServiceTier = typeof SERVICE_TIERS[number];

const POSTMORTEM_SEVERITIES = ["sev1", "sev2", "sev3"] as const;
type PostmortemSeverity = typeof POSTMORTEM_SEVERITIES[number];

// Also accept the oncall alias used in customize.toml / help menu.
const ONCALL_ALIASES: Record<string, string> = {
  "oncall": "oncall-rotation",
  "on-call": "oncall-rotation",
};

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
  // Operations-specific
  observability: ObservabilityTarget | null;
  incident: string | null;
  incidentIn: string | null;
  service: string | null;
  serviceTier: ServiceTier | null;
  postmortemSeverity: PostmortemSeverity | null;
  artifacts: string[];                 // resolved list of artifact keys (or ['all'])
  format: "markdown" | "both";
}

function parseArtifacts(raw: string): string[] {
  const items = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .map((s) => ONCALL_ALIASES[s] ?? s)
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
    observability: null,
    incident: null,
    incidentIn: null,
    service: null,
    serviceTier: null,
    postmortemSeverity: null,
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
      case "--observability": {
        const raw = (args[++i] ?? "").toLowerCase();
        if ((OBSERVABILITY_TARGETS as readonly string[]).includes(raw)) {
          parsed.observability = raw as ObservabilityTarget;
        }
        break;
      }
      case "--incident":
        parsed.incident = args[++i];
        break;
      case "--incident-in":
        parsed.incidentIn = args[++i];
        break;
      case "--service":
        parsed.service = args[++i];
        break;
      case "--service-tier": {
        const raw = (args[++i] ?? "").toLowerCase();
        if ((SERVICE_TIERS as readonly string[]).includes(raw)) {
          parsed.serviceTier = raw as ServiceTier;
        }
        break;
      }
      case "--postmortem-severity": {
        const raw = (args[++i] ?? "").toLowerCase();
        if ((POSTMORTEM_SEVERITIES as readonly string[]).includes(raw)) {
          parsed.postmortemSeverity = raw as PostmortemSeverity;
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
BMAD Operations Agent

Usage:
  npx ts-node run.ts [options]

Options:
  --path <dir>                     Path to project root (default: .)
  --engine <engine>                Platform engine (auto-detect if omitted)
                                   Accepts: aem | commerce-paas (alias: commerce) |
                                            commerce-saas | sling | spring |
                                            app-builder | eds | eds-commerce
                                   AEM aliases: aemcs, aemams
  --output <dir>                   Output directory for ops reports + artifacts
                                   (default: <projectRoot>/operations-reports/)
  --interactive                    Prompt step-by-step for missing intake inputs;
                                   persists choice to .bmad/intake.yaml.
  --technical                      Force technical mode; missing required inputs error out.
                                   Without either flag the CLI reads <project>/.bmad/intake.yaml
                                   (mode: interactive|technical), falling back to technical.
  --create-branch                  Cut standard branch dca/operations-<stack>-<timestamp>
                                   before writing outputs
  --source-branch <name>           Source branch for --create-branch
                                   (default: production/main/master/develop)
  --preflight                      Print model/context + STATIC/LLM/HYBRID advisory and exit
  --no-preflight                   Suppress the preflight advisory
  --role <code>                    Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content
                                   (persisted at <project>/.bmad/role.yaml; --role wins for one run)
  --list-engines                   List available engines
  --help                           Show this help

Operations authoring:
  --observability <target>         Observability platform. Values:
                                   datadog | newrelic | grafana | elastic |
                                   prometheus | cloudwatch | dynatrace
                                   (default: auto-detect from project files —
                                    datadog-config.yaml → datadog, .github/workflows +
                                    prometheus.yml → prometheus, etc. If nothing is
                                    matched an INFO finding requests --observability
                                    explicitly.)
  --incident <text>                Natural-language incident description for
                                   runbook / playbook / postmortem authoring
                                   (e.g. "checkout latency spike after 2.5.0 deploy").
  --incident-in <path>             Existing incident log / timeline to enrich into
                                   a postmortem (.md / .txt / .json accepted).
  --service <name>                 Service name for SLO/SLI templates
                                   (e.g. checkout-api, catalog-service, author-tier).
  --service-tier <t1|t2|t3>        Service criticality tier for SLO defaults:
                                   t1 = 99.9% availability, t2 = 99.5%, t3 = 99%.
  --postmortem-severity <sev>      Postmortem template severity. Values: sev1|sev2|sev3.
  --artifacts <csv>                Which artifacts to author (comma-separated). Values:
                                   runbook, dashboard, alerts, slo, oncall-rotation
                                   (alias: oncall), playbook, postmortem, all.
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
// Observability auto-detection — walk the project root for platform config
// indicators. Order matters: first hit wins.
// ---------------------------------------------------------------------------

function autoDetectObservability(projectRoot: string): ObservabilityTarget | null {
  // Datadog
  if (
    existsSync(join(projectRoot, "datadog.yaml")) ||
    existsSync(join(projectRoot, ".datadog.yml")) ||
    existsSync(join(projectRoot, "datadog-agent.yaml")) ||
    existsSync(join(projectRoot, "datadog-config.yaml"))
  ) {
    return "datadog";
  }
  // New Relic
  if (
    existsSync(join(projectRoot, "newrelic.yml")) ||
    existsSync(join(projectRoot, "newrelic.js")) ||
    existsSync(join(projectRoot, "newrelic.ini"))
  ) {
    return "newrelic";
  }
  // Grafana (dashboards folder + provisioning)
  if (
    existsSync(join(projectRoot, "grafana", "dashboards")) ||
    existsSync(join(projectRoot, "provisioning", "dashboards")) ||
    existsSync(join(projectRoot, "grafana"))
  ) {
    // Only claim grafana when a *.json dashboard actually exists.
    try {
      const dashDirs = [
        join(projectRoot, "grafana", "dashboards"),
        join(projectRoot, "provisioning", "dashboards"),
      ].filter((d) => existsSync(d));
      for (const d of dashDirs) {
        try {
          const entries = readdirSync(d);
          if (entries.some((e) => /\.json$/i.test(e))) return "grafana";
        } catch {
          /* non-fatal */
        }
      }
    } catch {
      /* non-fatal */
    }
  }
  // Elastic
  if (
    existsSync(join(projectRoot, "filebeat.yml")) ||
    existsSync(join(projectRoot, "logstash.conf")) ||
    existsSync(join(projectRoot, ".elastic"))
  ) {
    return "elastic";
  }
  // Prometheus
  if (
    existsSync(join(projectRoot, "prometheus.yml")) ||
    existsSync(join(projectRoot, "prometheus", "rules.yml")) ||
    existsSync(join(projectRoot, "prometheus"))
  ) {
    return "prometheus";
  }
  // CloudWatch (CDK app or dedicated folder)
  if (existsSync(join(projectRoot, ".cloudwatch"))) return "cloudwatch";
  try {
    const cdkPath = join(projectRoot, "cdk.json");
    if (existsSync(cdkPath)) {
      const cdkRaw = require("fs").readFileSync(cdkPath, "utf-8") as string;
      if (/aws-cloudwatch|CloudWatch/i.test(cdkRaw)) return "cloudwatch";
    }
  } catch {
    /* non-fatal */
  }
  // Dynatrace
  if (existsSync(join(projectRoot, "dynatrace.yaml"))) return "dynatrace";

  return null;
}

// ---------------------------------------------------------------------------
// Operations index writer — Phase 3.4 minimal Markdown writer.
// The engine will emit its own artifact files in Phase 3.5; here we drop
// a single OPERATIONS-INDEX.md so --output is always exercised.
// ---------------------------------------------------------------------------

function writeOperationsIndex(
  indexPath: string,
  ctx: {
    observability: string;
    service: string | null;
    serviceTier: string | null;
    incident: string | null;
    incidentIn: string | null;
    postmortemSeverity: string | null;
    engineName: string;
    artifacts: string[];
    format: string;
    findings: Finding[];
    writtenFiles: string[];
  },
): void {
  const lines: string[] = [];
  lines.push(`# Operations Index`);
  lines.push("");
  lines.push(`_Generated by BMAD Operations Agent — headless CLI fallback._`);
  lines.push(`_Stack: **${ctx.engineName}**._`);
  lines.push("");
  lines.push(`## Inputs`);
  lines.push("");
  lines.push(`- **Observability platform:** ${ctx.observability}`);
  if (ctx.service) lines.push(`- **Service:** ${ctx.service}`);
  if (ctx.serviceTier) lines.push(`- **Service tier:** ${ctx.serviceTier}`);
  if (ctx.incident) lines.push(`- **Incident:** ${ctx.incident}`);
  if (ctx.incidentIn) lines.push(`- **Incident log:** \`${ctx.incidentIn}\``);
  if (ctx.postmortemSeverity) {
    lines.push(`- **Postmortem severity:** ${ctx.postmortemSeverity}`);
  }
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
    "This is the headless CLI fallback — it emits standardized reporting plumbing only. For real runbook / dashboard / alert / SLO / on-call / playbook / postmortem content, drive this agent conversationally from an AI coding tool: it reads `SKILL.md` and the `templates/`/`resources/` packs to author the artifacts, then calls this same reporting layer.",
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
    agentName: "operations",
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
        key: "observability",
        prompt: "Observability platform",
        choices: ["auto", ...OBSERVABILITY_TARGETS],
        default: "auto",
      },
      {
        key: "service",
        prompt: "Service name (e.g. checkout-api) — blank if not scoped to one",
      },
      {
        key: "service-tier",
        prompt: "Service criticality tier",
        choices: ["", ...SERVICE_TIERS],
        default: args.serviceTier ?? "",
      },
      {
        key: "incident",
        prompt: "Incident description (blank if no incident context)",
      },
      {
        key: "incident-in",
        prompt: "Existing incident log path — blank if none",
      },
      {
        key: "postmortem-severity",
        prompt: "Postmortem severity (blank if not writing a postmortem)",
        choices: ["", ...POSTMORTEM_SEVERITIES],
        default: args.postmortemSeverity ?? "",
      },
      {
        key: "artifacts",
        prompt: "Which artifacts? (comma-separated: runbook,dashboard,alerts,slo,oncall-rotation,playbook,postmortem,all)",
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
      observability: args.observability ?? undefined,
      service: args.service ?? undefined,
      "service-tier": args.serviceTier ?? undefined,
      incident: args.incident ?? undefined,
      "incident-in": args.incidentIn ?? undefined,
      "postmortem-severity": args.postmortemSeverity ?? undefined,
    };
    const answers = await askAll({ questions, existing });
    if (answers.path && (args.path === "." || !args.path)) args.path = answers.path;
    if (answers.engine && answers.engine !== "auto" && !args.engine) args.engine = answers.engine;
    if (answers.observability && answers.observability !== "auto" && !args.observability) {
      if ((OBSERVABILITY_TARGETS as readonly string[]).includes(answers.observability)) {
        args.observability = answers.observability as ObservabilityTarget;
      }
    }
    if (answers.service && !args.service) args.service = answers.service;
    if (answers["service-tier"] && !args.serviceTier &&
        (SERVICE_TIERS as readonly string[]).includes(answers["service-tier"])) {
      args.serviceTier = answers["service-tier"] as ServiceTier;
    }
    if (answers.incident && !args.incident) args.incident = answers.incident;
    if (answers["incident-in"] && !args.incidentIn) args.incidentIn = answers["incident-in"];
    if (answers["postmortem-severity"] && !args.postmortemSeverity &&
        (POSTMORTEM_SEVERITIES as readonly string[]).includes(answers["postmortem-severity"])) {
      args.postmortemSeverity = answers["postmortem-severity"] as PostmortemSeverity;
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
      args.observability ? `--observability ${args.observability}` : "",
      args.service ? `--service ${args.service}` : "",
      args.serviceTier ? `--service-tier ${args.serviceTier}` : "",
      args.incident ? `--incident "${args.incident}"` : "",
      args.incidentIn ? `--incident-in ${args.incidentIn}` : "",
      args.postmortemSeverity ? `--postmortem-severity ${args.postmortemSeverity}` : "",
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

  // ── Engine resolution: real registry lookup; if nothing detected we still
  //   proceed with a "generic" fallback so the dispatcher emit path is exercised.
  const engine = getEngine(args.engine, projectPath);
  const engineIdForOutputs = engine?.id ?? "generic";
  const engineNameForOutputs = engine?.name ?? "Generic (no stack detected)";
  let engineFindings: Finding[] = [];
  let stats = { runbooks: 0, dashboards: 0, alerts: 0, slos: 0, playbooks: 0 };
  let writtenFiles: string[] = [];

  // Observability auto-detection: only when --observability was not passed.
  let resolvedObservability: ObservabilityTarget | null = args.observability;
  if (!resolvedObservability) {
    resolvedObservability = autoDetectObservability(projectPath);
    if (resolvedObservability) {
      process.stderr.write(
        `[dca-operations] auto-detected observability platform: ${resolvedObservability}\n`,
      );
    }
  }

  if (!args.noPreflight && !process.argv.includes("--no-preflight")) {
    console.log(renderPreflight(runPreflight(projectPath), { agent: "operations", stack: engineIdForOutputs }) + "\n");
    if (args.preflight || process.argv.includes("--preflight")) return;
  }

  console.log(`📊 BMAD Operations Agent`);
  console.log(`   Path:          ${projectPath}`);
  console.log(`   Engine:        ${engineNameForOutputs}`);
  console.log(`   Observability: ${resolvedObservability ?? "(unresolved — pass --observability)"}`);
  if (args.service) console.log(`   Service:       ${args.service}`);
  if (args.serviceTier) console.log(`   Service tier:  ${args.serviceTier}`);
  if (args.incident) console.log(`   Incident:      ${args.incident}`);
  if (args.incidentIn) console.log(`   Incident log:  ${args.incidentIn}`);
  if (args.postmortemSeverity) console.log(`   PM severity:   ${args.postmortemSeverity}`);
  console.log(`   Artifacts:     ${resolvedArtifacts.join(", ") || "(none)"}`);
  console.log(`   Format:        ${args.format}`);
  console.log("");

  if (args.format === "both") {
    process.stderr.write(
      "[dca-operations] WARN: --format both — docx output is planned for a later phase; writing markdown only for now.\n",
    );
  }

  // Standard branch (output C).
  maybeCutStandardBranch(process.argv, {
    agent: "operations",
    stack: engineIdForOutputs,
    projectRoot: projectPath,
  });

  const outputDir = args.output ?? join(projectPath, "operations-reports");
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch {
    /* non-fatal */
  }

  // If observability platform is still unresolved, emit an INFO finding but continue.
  if (!resolvedObservability) {
    engineFindings.push({
      title: "Observability platform unresolved — pass --observability explicitly",
      description:
        `No observability configuration was auto-detected in this project. ` +
        `Pass --observability with one of: ${OBSERVABILITY_TARGETS.join(", ")}.`,
      stack: engineIdForOutputs,
      category: "Operations",
      severity: "INFO",
      source: "scanner",
      recommendation:
        `Run: npx ts-node run.ts --observability <target> — accepted values: ${OBSERVABILITY_TARGETS.join(", ")}`,
    });
  }

  // Auto-detect fallback: emit an INFO finding when no engine was matched.
  if (!engine) {
    process.stderr.write(
      "[dca-operations] INFO: no stack auto-detected; using generic fallback. Pass --engine <id> for stack-native output.\n",
    );
    engineFindings.push({
      title: "No engine detected — operations authoring falling back to generic",
      description:
        "The dispatcher could not auto-detect a supported stack in this project. The current run continues with a generic profile; specify --engine <id> for stack-native runbook / dashboard / alert / SLO templates.",
      stack: engineIdForOutputs,
      category: "Operations",
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
        observability: resolvedObservability ?? "unresolved",
        incident: args.incident ?? undefined,
        incidentIn: args.incidentIn ?? undefined,
        service: args.service ?? undefined,
        serviceTier: args.serviceTier ?? undefined,
        postmortemSeverity: args.postmortemSeverity ?? undefined,
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
        `[dca-operations] WARN: engine ${engineIdForOutputs} failed: ${(err as Error).message}\n`,
      );
      engineFindings.push({
        title: `Engine ${engineIdForOutputs} failed at ops-authoring time`,
        description: (err as Error).message,
        stack: engineIdForOutputs,
        category: "Operations",
        severity: "HIGH",
        source: "scanner",
        recommendation: "Check the engine module for exceptions and rerun.",
      });
    }
  }

  // Findings gate — decisions.yaml (non-fatal).
  const extra: Record<string, string | number> = {
    "Artifacts": resolvedArtifacts.join(", ") || "(none)",
    "Observability": resolvedObservability ?? "(unresolved)",
    "Format": args.format,
    "Runbooks": stats.runbooks,
    "Dashboards": stats.dashboards,
    "Alerts": stats.alerts,
    "SLOs": stats.slos,
    "Playbooks": stats.playbooks,
  };
  if (args.service) extra["Service"] = args.service;
  if (args.serviceTier) extra["Service tier"] = args.serviceTier;
  if (args.incident) extra["Incident"] = args.incident;
  if (args.incidentIn) extra["Incident log"] = args.incidentIn;
  if (args.postmortemSeverity) extra["Postmortem severity"] = args.postmortemSeverity;

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
    agent: "operations",
    extra,
  });

  // Write the OPERATIONS-INDEX.md (markdown scaffold). Always emit so the user
  // can see what was requested even when the engine wrote nothing.
  const indexPath = join(outputDir, "OPERATIONS-INDEX.md");
  try {
    writeOperationsIndex(indexPath, {
      observability: resolvedObservability ?? "(unresolved)",
      service: args.service,
      serviceTier: args.serviceTier,
      incident: args.incident,
      incidentIn: args.incidentIn,
      postmortemSeverity: args.postmortemSeverity,
      engineName: engineNameForOutputs,
      artifacts: resolvedArtifacts,
      format: args.format,
      findings,
      writtenFiles,
    });
  } catch (err) {
    process.stderr.write(
      `[dca-operations] WARN: could not write OPERATIONS-INDEX: ${(err as Error).message}\n`,
    );
  }
  extra["Operations index"] = indexPath;
  if (writtenFiles.length > 0) {
    extra["Artifact files written"] = writtenFiles.length;
  }

  const res = await emitStandardOutputs({
    agent: "operations",
    meta: {
      agent: "operations",
      engine: engineIdForOutputs,
      stack: engineIdForOutputs,
      projectName: basename(projectPath),
      projectRoot: projectPath,
      extra,
    },
    findings,
    outputDir,
    extraSheets: sla.extraSheet ? [sla.extraSheet] : undefined,
    changelogSummary: `Operations authoring: ${stats.runbooks} runbook(s), ${stats.dashboards} dashboard(s), ${stats.alerts} alert(s), ${stats.slos} SLO(s), ${stats.playbooks} playbook(s); ${findings.length} finding(s).`,
  });

  console.log(`\n📊 Report:      ${res.xlsxPath}`);
  if (res.mdPath) console.log(`📄 Markdown:    ${res.mdPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG:  ${res.changelogPath}`);
  console.log(`📊 Ops index:   ${indexPath}`);
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
