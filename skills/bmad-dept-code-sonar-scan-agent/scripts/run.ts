#!/usr/bin/env ts-node
/**
 * BMAD Sonar Scan Agent — Dispatcher
 * ====================================
 * Two-step flow:
 *   Step 1 (LLM, via SKILL.md): writes sonar-findings.json
 *   Step 2 (this script, --ingest): JSON → Finding[] → ratings → standardized xlsx
 *
 * Usage:
 *   npx ts-node run.ts --ingest sonar-findings.json --path /project
 *   npx ts-node run.ts --ingest sonar-findings.json --path /project --engine spring
 *   npx ts-node run.ts --path /project --preflight
 *   npx ts-node run.ts --list-engines
 */

import { resolve, join, basename } from "path";
import { existsSync } from "fs";
import { PROFILES, profileById, detectProfile } from "./engines/profiles";
import { ingest } from "./sonar/ingest";
import { runPreflight, renderPreflight } from "../../shared/preflight";

interface Args {
  path: string;
  engine: string | null;
  ingestJson: string | null;
  output: string | null;
  listEngines: boolean;
  preflight: boolean;
  noPreflight: boolean;
  createBranch: boolean;
  sourceBranch: string | null;
}

function parseArgs(): Args {
  const a: Args = {
    path: ".",
    engine: null,
    ingestJson: null,
    output: null,
    listEngines: false,
    preflight: false,
    noPreflight: false,
    createBranch: false,
    sourceBranch: null,
  };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--path": a.path = argv[++i]; break;
      case "--engine": a.engine = argv[++i]; break;
      case "--ingest": a.ingestJson = argv[++i]; break;
      case "--output": a.output = argv[++i]; break;
      case "--list-engines": a.listEngines = true; break;
      case "--preflight": a.preflight = true; break;
      case "--no-preflight": a.noPreflight = true; break;
      case "--create-branch": a.createBranch = true; break;
      case "--source-branch": a.sourceBranch = argv[++i]; break;
      case "--help":
        console.log(`BMAD Sonar Scan Agent

Usage:
  npx ts-node run.ts --ingest <findings.json> --path <dir> [options]

Options:
  --ingest <json>        Path to sonar-findings.json (from the LLM scan step)
  --path <dir>           Project root (default: .)
  --engine <id>          Force a stack (auto-detected from findings JSON if omitted)
  --output <dir>         Report output dir (default: <path>/sonar-reports)
  --create-branch        Cut standard branch dca/sonar-scan-<stack>-<timestamp>
                         (takes effect only with --ingest)
  --source-branch <name> Source branch for --create-branch
  --preflight            Print LLM/context advisory and exit
  --no-preflight         Suppress the preflight advisory
  --list-engines         List available rule packs (one per stack)
  --help                 Show this help`);
        process.exit(0);
    }
  }
  return a;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.listEngines) {
    console.log("Available sonar-scan rule packs:\n");
    for (const p of PROFILES) {
      console.log(`  ${p.id.padEnd(16)} ${p.name.padEnd(36)} [${p.language}]`);
    }
    console.log("  (aliases: aemcs, aemams → aem; commerce → commerce-paas)");
    return;
  }

  const projectPath = resolve(args.path);
  if (!existsSync(projectPath)) {
    console.error(`❌ Project path not found: ${projectPath}`);
    process.exit(1);
  }

  // Preflight (advisory only — prints but does not block)
  if (!args.noPreflight) {
    console.log("\n" + renderPreflight(runPreflight(projectPath), { agent: "sonar-scan" }));
    if (args.preflight) return;
  }

  if (!args.ingestJson) {
    console.error("❌ --ingest <findings.json> is required for Step 2.");
    console.error("   Run the LLM scan step first (via BMAD skill workflow) to produce sonar-findings.json.");
    process.exit(1);
  }

  // Resolve stack profile
  const profile = args.engine
    ? profileById(args.engine)
    : detectProfile(projectPath);

  if (!profile) {
    console.error(`❌ Could not resolve a stack profile. Use --engine <id> (see --list-engines).`);
    process.exit(1);
  }

  const outputDir = args.output ?? join(projectPath, "sonar-reports");

  await ingest({
    jsonPath: resolve(args.ingestJson),
    projectRoot: projectPath,
    profile,
    outputDir,
    argv: process.argv,
  });
}

main().catch((err) => {
  console.error("❌ Fatal error:", (err as Error).message);
  process.exit(1);
});
