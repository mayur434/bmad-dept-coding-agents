#!/usr/bin/env ts-node
/**
 * BMAD Impact Analysis Agent — Dispatcher
 * ==========================================
 * Entry point for the impact analysis engine.
 *
 * Usage:
 *   npx ts-node run.ts --path /project --engine commerce
 *   npx ts-node run.ts --trace --path /project
 *   npx ts-node run.ts --upgrade-risk --from 2.4.6 --to 2.4.7
 *   npx ts-node run.ts --list-engines
 */

import { resolve, basename, join } from "path";
import { existsSync } from "fs";
import { emitStandardOutputs } from "../../shared/output";
import type { Finding, Severity } from "../../shared/core/types";
import type { AffectedItem } from "./shared/base";

interface Args {
  path: string;
  engine: string | null;
  mode: "analyze" | "trace" | "upgrade-risk";
  fromVersion: string | null;
  toVersion: string | null;
  target: string | null;
  output: string | null;
  listEngines: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Args = {
    path: ".",
    engine: null,
    mode: "analyze",
    fromVersion: null,
    toVersion: null,
    target: null,
    output: null,
    listEngines: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--path": parsed.path = args[++i]; break;
      case "--engine": parsed.engine = args[++i]; break;
      case "--trace": parsed.mode = "trace"; break;
      case "--upgrade-risk": parsed.mode = "upgrade-risk"; break;
      case "--from": parsed.fromVersion = args[++i]; break;
      case "--to": parsed.toVersion = args[++i]; break;
      case "--target": parsed.target = args[++i]; break;
      case "--output": parsed.output = args[++i]; break;
      case "--list-engines": parsed.listEngines = true; break;
      case "--help":
        console.log(`BMAD Impact Analysis Agent\n\nUsage:\n  npx ts-node run.ts [options]\n\nOptions:\n  --path <dir>         Project root (default: .)\n  --engine <id>        Platform engine (auto-detect if omitted)\n  --trace              Trace dependency chains for --target\n  --upgrade-risk       Assess upgrade risk (use --from / --to)\n  --from <version>     Source version for upgrade risk\n  --to <version>       Target version for upgrade risk\n  --target <class>     Class/module to trace\n  --list-engines       List available engines\n  --help               Show this help`);
        process.exit(0);
    }
  }
  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.listEngines) {
    console.log("Available impact analysis engines:");
    console.log("  commerce        Adobe Commerce / Magento 2");
    console.log("  aem             AEM as a Cloud Service");
    console.log("  eds             Edge Delivery Services");
    console.log("  eds-commerce    EDS + Commerce Hybrid");
    return;
  }

  const projectPath = resolve(args.path);
  if (!existsSync(projectPath)) {
    console.error(`❌ Project path not found: ${projectPath}`);
    process.exit(1);
  }

  console.log(`💥 BMAD Impact Analysis Agent`);
  console.log(`   Path:   ${projectPath}`);
  console.log(`   Engine: ${args.engine || "auto-detect"}`);
  console.log(`   Mode:   ${args.mode}`);
  if (args.target) console.log(`   Target: ${args.target}`);
  if (args.fromVersion) console.log(`   From:   ${args.fromVersion}`);
  if (args.toVersion) console.log(`   To:     ${args.toVersion}`);
  console.log("");

  // Phase 1: the standardized-output contract is wired. Per-stack engines and the
  // Proofhub-bug / BRD-document ingestion that populate `affectedItems` land in a
  // later phase; today the report is emitted as an inspectable, contract-conformant shell.
  const affectedItems: AffectedItem[] = [];
  const findings = affectedItemsToFindings(affectedItems);

  const outputDir = args.output ?? join(projectPath, "impact-reports");
  const res = await emitStandardOutputs({
    agent: "impact",
    meta: {
      agent: "impact",
      engine: args.engine ?? "auto",
      stack: args.engine ?? "auto",
      projectName: basename(projectPath),
      projectRoot: projectPath,
      extra: { Mode: args.mode },
    },
    findings,
    outputDir,
    changelogSummary: `Impact analysis (${args.mode}); ${findings.length} impacted item(s).`,
  });

  console.log(`📊 Report:     ${res.xlsxPath}`);
  if (res.mdPath) console.log(`📄 Markdown:   ${res.mdPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG: ${res.changelogPath}`);
  if (findings.length === 0) {
    console.log("\nℹ️  No impacted items yet — connect a Proofhub export or BRD document (upcoming phase) to populate the analysis.");
  }
}

const IMPACT_TO_SEVERITY: Record<string, Severity> = {
  breaking: "CRITICAL",
  behavioral: "HIGH",
  cosmetic: "LOW",
};

/** Map impact-analysis affected items into the shared normalized Finding model. */
function affectedItemsToFindings(items: AffectedItem[]): Finding[] {
  return items.map((it) => ({
    title: `${it.impact} change impact — ${it.symbol}`,
    description: it.reason,
    category: it.type,
    file: it.file,
    severity: IMPACT_TO_SEVERITY[it.impact] ?? "MEDIUM",
    confidence: it.confidence,
    impact: it.reason,
    recommendation: `Review ${it.symbol} (${it.type}) before merging; add regression coverage.`,
    source: "scanner",
  }));
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
