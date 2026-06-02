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

import { resolve } from "path";
import { existsSync } from "fs";
import * as readline from "readline";
import { TestFramework, DetectionStrategy } from "./shared/base";
import { TokenBudgetManager } from "../../shared/token-budget";

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
  listEngines: boolean;
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
    listEngines: false,
  };

  for (let i = 0; i < args.length; i++) {
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
      case "--list-engines":
        parsed.listEngines = true;
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
  --interactive                    Prompt which frameworks/strategy to use
  --list-engines                   List available engines
  --help                           Show this help

Engines:
  commerce      Adobe Commerce / Magento 2
  aem           AEM as a Cloud Service
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
// Engine Registry
// ---------------------------------------------------------------------------

import { getEngine, listEngines } from "./engines/registry";

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
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.listEngines) {
    listEngines();
    return;
  }

  const projectPath = resolve(args.path);
  if (!existsSync(projectPath)) {
    console.error(`❌ Project path not found: ${projectPath}`);
    process.exit(1);
  }

  const engine = getEngine(args.engine, projectPath);
  if (!engine) {
    console.error("❌ Could not detect platform engine. Use --engine to specify.");
    process.exit(1);
  }

  // Interactive prompt if requested (or if no frameworks specified for Commerce)
  let frameworks = args.frameworks;
  let strategy = args.strategy;
  if (args.interactive || (!frameworks && engine.id === "commerce" && process.stdin.isTTY)) {
    const prompted = await promptUser(args);
    frameworks = prompted.frameworks;
    strategy = prompted.strategy;
  }

  // ── Token Budget ──
  const budget = new TokenBudgetManager("coverage");
  budget.showPreExecution();

  console.log(`🧪 BMAD Test Coverage Agent`);
  console.log(`   Path:   ${projectPath}`);
  console.log(`   Engine: ${engine.name}`);
  console.log(`   Mode:   ${args.mode}`);
  if (args.module) console.log(`   Scope:  ${args.module}`);
  if (frameworks) console.log(`   Frameworks: ${frameworks.join(", ")}`);
  if (strategy) console.log(`   Strategy:   ${strategy}`);
  console.log("");

  const coverageOpts = {
    name: args.name,
    module: args.module,
    output: args.output,
    frameworks: frameworks || null,
    strategy: strategy || null,
  };

  switch (args.mode) {
    case "analyze": {
      const report = await engine.analyzeCoverage(projectPath, coverageOpts);
      console.log(`\n✓ Analysis complete`);
      console.log(`  Overall: ${report.coveragePercent}% covered (${report.testedFiles}/${report.totalSourceFiles} files)`);
      console.log(`  Gaps found: ${report.gaps.length}`);
      if (report.frameworkBreakdown && report.frameworkBreakdown.length > 0) {
        console.log(`\n  Per-framework breakdown:`);
        for (const fb of report.frameworkBreakdown) {
          console.log(`    ${fb.framework.padEnd(16)} ${fb.coveragePercent}% (${fb.testedFiles}/${fb.totalFiles})`);
        }
      }
      break;
    }
    case "generate":
      await engine.generateTests(projectPath, coverageOpts);
      break;
    case "full": {
      const report = await engine.analyzeCoverage(projectPath, coverageOpts);
      console.log(`  Coverage: ${report.coveragePercent}% — ${report.gaps.length} gaps found`);
      await engine.generateTests(projectPath, coverageOpts);
      break;
    }
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
