#!/usr/bin/env ts-node
/**
 * BMAD Test Coverage Agent — Dispatcher
 * ========================================
 * Entry point for the test coverage analysis and generation engine.
 *
 * Usage:
 *   npx ts-node run.ts --mode analyze --path /project --engine commerce
 *   npx ts-node run.ts --mode analyze --path /project --frameworks unit,mftf,api-functional
 *   npx ts-node run.ts --interactive --path /project
 *   npx ts-node run.ts --list-engines
 */

import { resolve, basename, join } from "path";
import { existsSync } from "fs";
import * as readline from "readline";
// Node-core-only + role/install (dep-free) + type-only imports are safe on
// first run. shared/output, shared/preflight, shared/coverage, and the
// engine modules transitively require third-party packages (exceljs,
// fast-glob, ...) and MUST be loaded lazily via require() inside main()
// AFTER ensureDepsInstalled().
import type { TestFramework, DetectionStrategy, CoverageReport, CoverageGap } from "./shared/base";
import type { Finding, Severity } from "../../shared/core/types";
import type { CoverageResult } from "../../shared/coverage";
import { resolveRole, parseRoleFlag } from "../../shared/role";
import { ensureDepsInstalled } from "../../shared/install";
import { resolveIntake, askAll, confirmRun, Question } from "../../shared/interactive";
import { consumeLatestFindings, emitFindingsCache } from "../../shared/findings";
import { applyAuditChainBoost, scoreOf } from "./priority/coverage-priority";
import { mutationCommandFor, renderMutationHintsMarkdown, MutationHint } from "./mutation/hooks";
import { detectFrameworks, renderRunInfoLine, DetectedFramework } from "./detection/framework";

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

interface Args {
  mode: "analyze" | "generate" | "full";
  path: string;
  engine: string | null;
  name: string | null;
  module: string | null;
  output: string | null;
  frameworks: TestFramework[] | null;
  strategy: DetectionStrategy | null;
  interactive: boolean;
  technical: boolean;
  listEngines: boolean;
  coverageReport: string | null;
  runCoverage: boolean;
  createBranch: boolean;
  sourceBranch: string | null;
  preflight: boolean;
  noPreflight: boolean;
  role: string | undefined;
  yesInstall: boolean;
  noInstall: boolean;
  noAuditChain: boolean;
  auditMaxAgeHours: number;
  emitMutationHints: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Args = {
    mode: "analyze",
    path: ".",
    engine: null,
    name: null,
    module: null,
    output: null,
    frameworks: null,
    strategy: null,
    interactive: false,
    technical: false,
    listEngines: false,
    coverageReport: null,
    runCoverage: false,
    createBranch: false,
    sourceBranch: null,
    preflight: false,
    noPreflight: false,
    role: undefined,
    yesInstall: false,
    noInstall: false,
    noAuditChain: false,
    auditMaxAgeHours: 168,
    emitMutationHints: false,
  };

  // --role=<code> and --role <code> are both handled by the shared helper.
  parsed.role = parseRoleFlag(args);

  for (let i = 0; i < args.length; i++) {
    // Swallow --role tokens (already captured by parseRoleFlag) so the
    // switch below doesn't misinterpret them.
    if (args[i] === "--role" && i + 1 < args.length && !args[i + 1].startsWith("--")) {
      i++;
      continue;
    }
    if (args[i].startsWith("--role=")) {
      continue;
    }
    switch (args[i]) {
      case "--mode":
        parsed.mode = args[++i] as Args["mode"];
        break;
      case "--path":
        parsed.path = args[++i];
        break;
      case "--engine":
        parsed.engine = args[++i];
        break;
      case "--name":
        parsed.name = args[++i];
        break;
      case "--module":
        parsed.module = args[++i];
        break;
      case "--output":
        parsed.output = args[++i];
        break;
      case "--frameworks":
        parsed.frameworks = args[++i].split(",").map((s) => s.trim()) as TestFramework[];
        break;
      case "--strategy":
        parsed.strategy = args[++i] as DetectionStrategy;
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
      case "--coverage-report":
        parsed.coverageReport = args[++i];
        break;
      case "--run-coverage":
        parsed.runCoverage = true;
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
      case "--no-audit-chain":
        parsed.noAuditChain = true;
        break;
      case "--audit-max-age-hours": {
        const raw = args[++i];
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) parsed.auditMaxAgeHours = n;
        break;
      }
      case "--emit-mutation-hints":
        parsed.emitMutationHints = true;
        break;
      case "--help":
        printHelp();
        process.exit(0);
    }
  }

  return parsed;
}

function printHelp(): void {
  console.log(`
BMAD Test Coverage Agent

Usage:
  npx ts-node run.ts [options]

Options:
  --mode <analyze|generate|full>   Operation mode (default: analyze)
  --path <dir>                     Path to project root (default: .)
  --engine <engine>                Platform engine (auto-detect if omitted)
  --name <name>                    Report title
  --module <name>                  Scope to specific module/package
  --output <dir>                   Output directory for reports
  --frameworks <list>              Comma-separated: unit,integration,mftf,api-functional,js,static,performance
  --strategy <strategy>            Detection: filename, namespace, annotation, all (default: all)
  --interactive                    Prompt step-by-step for missing intake inputs + frameworks/strategy;
                                   persists choice to .bmad/intake.yaml.
  --technical                      Force technical mode; missing required inputs error out (current default).
                                   Without either flag the CLI reads <project>/.bmad/intake.yaml (mode: interactive|technical),
                                   falling back to technical when the file is absent.
  --coverage-report <file>         Parse a JaCoCo/Istanbul/LCOV/Clover report for real line/branch %
  --run-coverage                   Run the project's coverage tool first, then parse it
  --create-branch                  Cut standard branch dca/test-coverage-<stack>-<timestamp> before writing outputs
  --source-branch <name>           Source branch for --create-branch (default: production/main/master/develop)
  --preflight                      Print model/context + STATIC/LLM/HYBRID advisory and exit
  --no-preflight                   Suppress the preflight advisory that otherwise prints on every run
  --role <code>                    Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content
                                   (persisted at <project>/.bmad/role.yaml; --role wins for one run)
  --list-engines                   List available engines
  --help                           Show this help

Cross-agent chaining:
  --no-audit-chain                 Skip boosting priority for files that have
                                   prior CRITICAL/HIGH audit findings in the
                                   shared findings cache.
  --audit-max-age-hours <n>        Ignore audit findings older than N hours
                                   (default: 168 = 7 days).
  --emit-mutation-hints            Append a "Mutation Hints" section (Pitest /
                                   Stryker / Infection commands) to the
                                   Markdown report for uncovered files with
                                   priority >= 50 (medium+). Off by default —
                                   mutation testing is heavyweight.

Install control (first-run):
  --yes-install                    Install missing dependencies without confirmation.
  --no-install                     Error out if dependencies missing (do not install).
                                   Default: prompt for confirmation on first run.

Engines:
  aem           AEM as a Cloud Service / AMS
  commerce      Adobe Commerce / Magento 2 (PaaS)
  commerce-saas Adobe Commerce SaaS (storefront + drop-ins)
  sling         Apache Sling / Shaft (sling-12)
  spring        Spring Boot
  app-builder   Adobe App Builder
  eds           Edge Delivery Services
  eds-commerce  EDS + Commerce Hybrid

Frameworks (Commerce):
  unit            PHPUnit unit tests (app/code/**/Test/Unit/)
  integration     PHPUnit integration tests (dev/tests/integration/)
  mftf            Magento Functional Testing Framework (XML-based E2E)
  api-functional  REST & GraphQL endpoint tests (dev/tests/api-functional/)
  js              JavaScript tests — Jasmine/Jest (dev/tests/js/)
  static          PHPCS / PHPStan / PHPMD config presence
  performance     JMeter / Gatling / k6 load tests
`);
}

// ---------------------------------------------------------------------------
// Engine Registry — lazy-loaded from main() after ensureDepsInstalled()
// (engine modules transitively require third-party packages).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Interactive Prompt
// ---------------------------------------------------------------------------

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function promptUser(args: Args): Promise<{ frameworks: TestFramework[]; strategy: DetectionStrategy }> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│  BMAD Test Coverage — Interactive Configuration         │");
  console.log("└─────────────────────────────────────────────────────────┘\n");

  console.log("Available testing frameworks:");
  console.log("  1. unit            — PHPUnit Unit Tests");
  console.log("  2. integration     — PHPUnit Integration Tests (Magento bootstrap)");
  console.log("  3. mftf           — MFTF Functional Tests (XML-based E2E)");
  console.log("  4. api-functional  — REST & GraphQL endpoint tests");
  console.log("  5. js             — JavaScript tests (Jasmine/Jest)");
  console.log("  6. static         — Static analysis (PHPCS/PHPStan/PHPMD)");
  console.log("  7. performance    — Performance tests (JMeter/Gatling/k6)");
  console.log("  8. all            — All of the above\n");

  const fwAnswer = await ask(rl, "Which frameworks to analyze? (comma-separated numbers or names, default: all): ");
  let frameworks: TestFramework[];
  if (!fwAnswer.trim() || fwAnswer.trim() === "8" || fwAnswer.trim().toLowerCase() === "all") {
    frameworks = ["unit", "integration", "mftf", "api-functional", "js", "static", "performance"];
  } else {
    const map: Record<string, TestFramework> = {
      "1": "unit", "2": "integration", "3": "mftf", "4": "api-functional",
      "5": "js", "6": "static", "7": "performance",
      "unit": "unit", "integration": "integration", "mftf": "mftf",
      "api-functional": "api-functional", "js": "js", "static": "static", "performance": "performance",
    };
    frameworks = fwAnswer.split(",").map((s) => map[s.trim()]).filter(Boolean) as TestFramework[];
    if (frameworks.length === 0) frameworks = ["unit", "integration", "mftf", "api-functional", "js", "static", "performance"];
  }

  console.log("\nDetection strategies:");
  console.log("  1. filename    — Match FooClass.php → FooClassTest.php");
  console.log("  2. namespace   — Mirror src namespace → test namespace");
  console.log("  3. annotation  — Parse @covers/@coversDefaultClass annotations");
  console.log("  4. all         — Combine all strategies (recommended)\n");

  const stAnswer = await ask(rl, "Detection strategy? (number or name, default: all): ");
  const stMap: Record<string, DetectionStrategy> = {
    "1": "filename", "2": "namespace", "3": "annotation", "4": "all",
    "filename": "filename", "namespace": "namespace", "annotation": "annotation", "all": "all",
  };
  const strategy: DetectionStrategy = stMap[stAnswer.trim()] || "all";

  rl.close();
  console.log(`\n✓ Frameworks: ${frameworks.join(", ")}`);
  console.log(`✓ Strategy:   ${strategy}\n`);

  return { frameworks, strategy };
}

// ---------------------------------------------------------------------------
// Standardized output (shared foundation)
// ---------------------------------------------------------------------------

const PRIORITY_TO_SEVERITY: Record<string, Severity> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

/** Map coverage gaps into the shared normalized Finding model. */
function coverageToFindings(report: CoverageReport): Finding[] {
  return report.gaps.map((g) => ({
    title: `Missing ${g.framework} test — ${g.className ?? basename(g.file)}${g.method ? "::" + g.method : ""}`,
    description: g.reason,
    stack: report.engine,
    category: `Coverage: ${g.framework}`,
    file: g.file,
    severity: PRIORITY_TO_SEVERITY[g.priority] ?? "MEDIUM",
    recommendation: `Add a ${g.framework} test covering ${g.className ?? g.method ?? g.file}.`,
    impact: `Untested (cyclomatic complexity ~${g.complexity}). Regressions here ship undetected.`,
    effort: g.complexity > 10 ? "L" : g.complexity > 5 ? "M" : "S",
    source: "scanner",
  }));
}

interface EmitContext {
  detectedFrameworks: DetectedFramework[];
  auditChainApplied: boolean;
  mutationHintsEmitted: boolean;
}

/** Emit the three standardized outputs (report + markdown + CHANGE-LOG). */
async function emitCoverageOutputs(
  report: CoverageReport,
  projectPath: string,
  args: Args,
  ctx: EmitContext,
): Promise<void> {
  // Lazy require: shared/output pulls in exceljs; safe because this helper
  // is only called from main() AFTER ensureDepsInstalled() has succeeded.
  const { emitStandardOutputs } = require("../../shared/output") as typeof import("../../shared/output");
  const findings = coverageToFindings(report);
  const outputDir = args.output ?? join(projectPath, "test-coverage-reports");
  const extra: Record<string, string | number> = {
    "Coverage %": report.coveragePercent,
    "Coverage source": (report as any).coverageSource ?? "estimate (filename match)",
    "Tested Files": report.testedFiles,
    "Total Source Files": report.totalSourceFiles,
  };
  if (ctx.detectedFrameworks.length > 0) {
    extra["Detected Frameworks"] = renderRunInfoLine(ctx.detectedFrameworks);
  }
  if (process.env.DCA_ROLE) {
    extra["Role"] = process.env.DCA_ROLE_NAME ?? process.env.DCA_ROLE;
    extra["Role code"] = process.env.DCA_ROLE;
    if (process.env.DCA_ROLE_FLAVOR) extra["Role output flavor"] = process.env.DCA_ROLE_FLAVOR;
    if (process.env.DCA_ROLE_SOURCE) extra["Role source"] = process.env.DCA_ROLE_SOURCE;
  }
  const res = await emitStandardOutputs({
    agent: "test-coverage",
    meta: {
      agent: "test-coverage",
      engine: report.engine,
      stack: report.engine,
      projectName: report.projectName || args.name || basename(projectPath),
      projectRoot: projectPath,
      extra,
    },
    findings,
    outputDir,
    changelogSummary: `Coverage analysis: ${report.coveragePercent}% (${report.testedFiles}/${report.totalSourceFiles} files); ${findings.length} gap(s).`,
  });
  console.log(`\n📊 Report:     ${res.xlsxPath}`);
  if (res.mdPath) console.log(`📄 Markdown:   ${res.mdPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG: ${res.changelogPath}`);

  // ── Append the Mutation Hints section to the Markdown twin ────────────────
  if (args.emitMutationHints && res.mdPath) {
    const hints = collectMutationHints(report);
    if (hints.length > 0) {
      const section = renderMutationHintsMarkdown(hints);
      try {
        require("fs").appendFileSync(res.mdPath, section, "utf8");
      } catch (err) {
        process.stderr.write(`[coverage-mutation] WARN: could not append hints: ${(err as Error).message}\n`);
      }
      const dist: Record<string, number> = {};
      for (const h of hints) dist[h.hint.tool] = (dist[h.hint.tool] ?? 0) + 1;
      const distStr = Object.entries(dist).map(([k, v]) => `${k}=${v}`).join(", ");
      process.stderr.write(
        `[coverage-mutation] emitted ${hints.length} mutation-testing hints (tool distribution: ${distStr})\n`,
      );
      ctx.mutationHintsEmitted = true;
    } else {
      process.stderr.write(`[coverage-mutation] no eligible files (priority >= 50) for mutation hints\n`);
    }
  }

  // ── Persist to the shared findings cache for downstream cross-refs ────────
  try {
    const written = emitFindingsCache({
      projectRoot: projectPath,
      agent: "test-coverage",
      stack: report.engine,
      branch: res.meta.workingBranch ?? "nobranch",
      timestamp: res.meta.timestamp ?? "",
      reportPath: res.xlsxPath,
      findings,
      meta: {
        frameworksDetected: ctx.detectedFrameworks.map((f) => f.name).join(",") || "none",
        auditChain: String(ctx.auditChainApplied),
        mutationHints: String(ctx.mutationHintsEmitted),
      },
    });
    if (written) process.stderr.write(`[coverage-cache] wrote findings cache: ${written}\n`);
  } catch (err) {
    process.stderr.write(`[coverage-cache] WARN: cache emit failed: ${(err as Error).message}\n`);
  }
}

/** Collect mutation-testing commands for uncovered files with priority >= 50. */
function collectMutationHints(
  report: CoverageReport,
): Array<{ file: string; score: number; hint: MutationHint }> {
  const out: Array<{ file: string; score: number; hint: MutationHint }> = [];
  for (const g of report.gaps) {
    const score = scoreOf(g);
    // Threshold is numeric 50 (high+ band per shared/priority bandForScore).
    // Synthetic gaps missing a score still qualify when the engine already
    // labelled them critical/high (e.g. Commerce MFTF layout handles).
    const eligible =
      score >= 50 ||
      (score === 0 && (g.priority === "critical" || g.priority === "high"));
    if (!eligible) continue;
    const hint = mutationCommandFor(g.file, report.engine);
    if (!hint) continue;
    out.push({ file: g.file, score: score || bandFallbackScore(g.priority), hint });
  }
  return out;
}

function bandFallbackScore(p: CoverageGap["priority"]): number {
  return p === "critical" ? 90 : p === "high" ? 65 : p === "medium" ? 40 : 15;
}

// ---------------------------------------------------------------------------
// Real coverage (JaCoCo / Istanbul / Clover / LCOV) — overrides the estimate
// ---------------------------------------------------------------------------
function flagVal(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

/** Optionally run the tool, then discover + parse a real coverage report. */
function resolveRealCoverage(projectPath: string, engineId: string): CoverageResult | null {
  // Lazy require: shared/coverage pulls in fast-glob; safe because this helper
  // is only called from main() AFTER ensureDepsInstalled() has succeeded.
  const { discoverReport, parseReport, runCoverage } = require("../../shared/coverage") as typeof import("../../shared/coverage");
  const explicit = flagVal("--coverage-report");
  if (process.argv.includes("--run-coverage")) {
    console.log("   ⏱  Running the project's coverage tool (this builds/tests the project)...");
    const rr = runCoverage(projectPath, engineId);
    console.log(`      ${rr.message}`);
  }
  const reportPath = explicit ?? discoverReport(projectPath)?.path ?? null;
  return reportPath ? parseReport(reportPath) : null;
}

/** Replace the filename-estimate coverage with real per-file line/branch numbers. */
function applyRealCoverage(report: CoverageReport, cov: CoverageResult, projectPath: string): void {
  const rel = (f: string) =>
    f.startsWith(projectPath) ? f.slice(projectPath.length).replace(/^\/+/, "") : f.replace(/^.*\/((?:src|core|app|bundle|blocks|actions|scripts)\/.*)$/, "$1");
  report.coveragePercent = cov.overall.linesPct;
  report.totalSourceFiles = cov.files.length || report.totalSourceFiles;
  report.testedFiles = cov.files.filter((f) => f.lines.pct >= 100).length;
  report.untestedFiles = report.totalSourceFiles - report.testedFiles;
  const fw = (report.gaps[0] && report.gaps[0].framework) || "unit";
  report.gaps = cov.files
    .filter((f) => f.lines.pct < 100)
    .sort((a, b) => a.lines.pct - b.lines.pct)
    .slice(0, 300)
    .map((f) => ({
      file: rel(f.file),
      className: (f.file.split("/").pop() || "").replace(/\.[^.]+$/, ""),
      method: null,
      complexity: 0,
      priority: (f.lines.pct < 50 ? "critical" : f.lines.pct < 75 ? "high" : f.lines.pct < 90 ? "medium" : "low") as CoverageGap["priority"],
      reason: `Real coverage: ${f.lines.pct}% lines (${f.lines.covered}/${f.lines.total}), ${f.branches.pct}% branches — ${f.lines.total - f.lines.covered} uncovered line(s). Add tests for the uncovered paths.`,
      framework: fw,
    }));
  (report as any).coverageSource = `real (${cov.tool})`;
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

  // First-run dependency check. Runs BEFORE the heavy modules are
  // require()'d below — engines/registry, shared/output, shared/preflight,
  // and shared/coverage transitively need fast-glob / exceljs / ...
  const bootstrap = await ensureDepsInstalled({
    agentName: "test-coverage",
    yes: args.yesInstall,
    no: args.noInstall,
  });
  if (bootstrap.exitCode !== 0) process.exit(bootstrap.exitCode);

  // Lazy loads — safe now that node_modules is guaranteed present.
  // (emitCoverageOutputs and resolveRealCoverage lazy-require their own deps.)
  const { getEngine, listEngines } = require("./engines/registry") as typeof import("./engines/registry");
  const { maybeCutStandardBranch } = require("../../shared/output") as typeof import("../../shared/output");
  const { runPreflight, renderPreflight } = require("../../shared/preflight") as typeof import("../../shared/preflight");

  if (args.listEngines) {
    listEngines();
    return;
  }

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
        choices: ["auto", "aem", "commerce", "commerce-saas", "sling", "spring", "app-builder", "eds", "eds-commerce"],
        default: "auto",
      },
      {
        key: "mode",
        prompt: "Mode: analyze (find gaps), generate (LLM writes tests), or full (both)?",
        choices: ["analyze", "generate", "full"],
        default: "full",
      },
      {
        key: "coverage-source",
        prompt: "Coverage source: existing report / run project tool / filename estimate?",
        choices: ["report", "run", "estimate"],
        default: "estimate",
      },
      {
        key: "coverage-report",
        prompt: "Path to JaCoCo/Istanbul/LCOV/Clover report",
        when: (a) => a["coverage-source"] === "report",
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
      mode: args.mode,
      "coverage-report": args.coverageReport ?? undefined,
    };
    const answers = await askAll({ questions, existing });
    if (answers.path && (args.path === "." || !args.path)) args.path = answers.path;
    if (answers.engine && answers.engine !== "auto" && !args.engine) args.engine = answers.engine;
    if (answers.mode) args.mode = answers.mode as Args["mode"];
    if (answers["coverage-report"] && !args.coverageReport) args.coverageReport = answers["coverage-report"];
    if (answers["coverage-source"] === "run") {
      args.runCoverage = true;
      if (!process.argv.includes("--run-coverage")) process.argv.push("--run-coverage");
    }
    if (answers["create-branch"] === "y") {
      args.createBranch = true;
      if (!process.argv.includes("--create-branch")) process.argv.push("--create-branch");
    }

    const summaryCmd = [
      "npx ts-node run.ts",
      args.path ? `--path ${args.path}` : "",
      args.engine ? `--engine ${args.engine}` : "",
      `--mode ${args.mode}`,
      args.coverageReport ? `--coverage-report ${args.coverageReport}` : "",
      args.runCoverage ? "--run-coverage" : "",
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
    console.error("   Tip: rerun with --interactive to be prompted step-by-step, or add 'mode: interactive' to .bmad/intake.yaml.");
    process.exit(1);
  }

  // ── Role resolution (metadata for the report + downstream chaining) ──
  // Order: --role flag  >  <projectRoot>/.bmad/role.yaml  >  generic fallback.
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

  const engine = getEngine(args.engine, projectPath);
  if (!engine) {
    console.error("❌ Could not detect platform engine. Use --engine to specify.");
    process.exit(1);
  }

  if (!process.argv.includes("--no-preflight")) {
    console.log(renderPreflight(runPreflight(projectPath), { agent: "test-coverage", stack: engine.id }) + "\n");
    if (process.argv.includes("--preflight")) return;
  }

  // Interactive prompt if requested (or if no frameworks specified for Commerce)
  let frameworks = args.frameworks;
  let strategy = args.strategy;
  if (args.interactive || (!frameworks && engine.id === "commerce" && process.stdin.isTTY)) {
    const prompted = await promptUser(args);
    frameworks = prompted.frameworks;
    strategy = prompted.strategy;
  }

  console.log(`🧪 BMAD Test Coverage Agent`);
  console.log(`   Path:   ${projectPath}`);
  console.log(`   Engine: ${engine.name}`);
  console.log(`   Mode:   ${args.mode}`);
  if (args.module) console.log(`   Scope:  ${args.module}`);
  if (frameworks) console.log(`   Frameworks: ${frameworks.join(", ")}`);
  if (strategy) console.log(`   Strategy:   ${strategy}`);
  console.log("");

  // Standard branch (output C): cut dca/test-coverage-<stack>-<ts> from production/shared.
  maybeCutStandardBranch(process.argv, { agent: "test-coverage", stack: engine.id, projectRoot: projectPath });

  // ── Framework auto-detection ────────────────────────────────────────────
  const detectedFrameworks = detectFrameworks(projectPath, engine.id);
  if (detectedFrameworks.length > 0) {
    process.stderr.write(
      `[coverage-detect] frameworks: ${renderRunInfoLine(detectedFrameworks)} — target: ${detectedFrameworks[0].name}\n`,
    );
  } else {
    process.stderr.write(
      `[coverage-detect] no frameworks detected in manifests — falling back to engine defaults\n`,
    );
  }

  // ── Consume prior audit run (for CRITICAL-first prioritisation) ─────────
  const auditContext = args.noAuditChain
    ? null
    : consumeLatestFindings({
        projectRoot: projectPath,
        fromAgent: "audit",
        maxAgeHours: args.auditMaxAgeHours,
      });
  const criticalFileCounts = new Map<string, number>();
  const highFileCounts = new Map<string, number>();
  if (auditContext) {
    for (const [file, findings] of Object.entries(auditContext.fileToFindings)) {
      if (file === "<no-file>") continue;
      let c = 0, h = 0;
      for (const f of findings) {
        const sev = String(f.severity ?? "").toUpperCase();
        if (sev === "CRITICAL") c++;
        else if (sev === "HIGH") h++;
      }
      if (c > 0) criticalFileCounts.set(file, c);
      if (h > 0) highFileCounts.set(file, h);
    }
  }

  const coverageOpts = {
    name: args.name,
    module: args.module,
    output: args.output,
    frameworks: frameworks || null,
    strategy: strategy || null,
  };

  const emitCtx: EmitContext = {
    detectedFrameworks,
    auditChainApplied: false,
    mutationHintsEmitted: false,
  };

  const applyChainAndLog = (report: CoverageReport): void => {
    if (!auditContext) return;
    const res = applyAuditChainBoost(report.gaps, criticalFileCounts, highFileCounts);
    if (res.boosted > 0) {
      process.stderr.write(
        `[coverage-audit-chain] boosted priority for ${res.boosted} uncovered files with prior audit findings (${res.criticalHits} CRITICAL, ${res.highHits} HIGH)\n`,
      );
      emitCtx.auditChainApplied = true;
    } else {
      process.stderr.write(
        `[coverage-audit-chain] audit cache found but no file overlap — no priority changes\n`,
      );
    }
  };

  switch (args.mode) {
    case "analyze": {
      const report = await engine.analyzeCoverage(projectPath, coverageOpts);
      const cov = resolveRealCoverage(projectPath, engine.id);
      if (cov) { applyRealCoverage(report, cov, projectPath); console.log(`   📈 Real coverage (${cov.tool}): ${cov.overall.linesPct}% lines, ${cov.overall.branchesPct}% branches`); }
      else console.log(`   ℹ️  No coverage report found — filename-based estimate (use --run-coverage or --coverage-report <file>).`);
      applyChainAndLog(report);
      console.log(`\n✓ Analysis complete`);
      console.log(`  Overall: ${report.coveragePercent}% covered (${report.testedFiles}/${report.totalSourceFiles} files)`);
      console.log(`  Gaps found: ${report.gaps.length}`);
      if (report.frameworkBreakdown && report.frameworkBreakdown.length > 0) {
        console.log(`\n  Per-framework breakdown:`);
        for (const fb of report.frameworkBreakdown) {
          console.log(`    ${fb.framework.padEnd(16)} ${fb.coveragePercent}% (${fb.testedFiles}/${fb.totalFiles})`);
        }
      }
      await emitCoverageOutputs(report, projectPath, args, emitCtx);
      break;
    }
    case "generate":
      await engine.generateTests(projectPath, coverageOpts);
      break;
    case "full": {
      const report = await engine.analyzeCoverage(projectPath, coverageOpts);
      const cov = resolveRealCoverage(projectPath, engine.id);
      if (cov) { applyRealCoverage(report, cov, projectPath); console.log(`  📈 Real coverage (${cov.tool}): ${cov.overall.linesPct}% lines, ${cov.overall.branchesPct}% branches`); }
      applyChainAndLog(report);
      console.log(`  Coverage: ${report.coveragePercent}% — ${report.gaps.length} gaps found`);
      await engine.generateTests(projectPath, coverageOpts);
      await emitCoverageOutputs(report, projectPath, args, emitCtx);
      break;
    }
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
