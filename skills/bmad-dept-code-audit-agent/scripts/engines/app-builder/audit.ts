#!/usr/bin/env node
/**
 * Adobe App Builder — Audit Engine
 * =================================
 * Runs the JS-AST + config scanner (actions / API Mesh / eventing / apps) and
 * emits the shared standardized report (xlsx + markdown + CHANGE-LOG).
 */

import * as fs from "fs";
import * as path from "path";
import { emitStandardOutputs, ensureStandardBranch } from "../../../../shared/output";
import { computeCounts, Finding, RecommendationRow, SEVERITIES } from "../../../../shared/core/types";
import { AppBuilderScanner } from "./scanner";

interface Args {
  path: string;
  name?: string;
  output?: string;
  sourceBranch?: string;
  createBranch: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { path: "", createBranch: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--path": a.path = argv[++i]; break;
      case "--name": a.name = argv[++i]; break;
      case "--output": a.output = argv[++i]; break;
      case "--source-branch": a.sourceBranch = argv[++i]; break;
      case "--create-branch": a.createBranch = true; break;
      case "-h": case "--help": a.help = true; break;
    }
  }
  return a;
}

function buildRecommendations(findings: Finding[]): RecommendationRow[] {
  const counts = computeCounts(findings);
  const recs: RecommendationRow[] = [];
  if (counts.bySeverity.CRITICAL > 0) {
    recs.push({
      area: "Secrets", priority: "P0",
      recommendation: "Move hardcoded secrets to .env / secret store; rotate exposed values.",
      expectedImpact: "Removes credential leakage from actions, mesh, and config.",
      effort: "M", details: "Covers JS-SEC-001, APPB-SEC-002, APPB-MESH-001.",
    });
  }
  if (findings.some((f) => f.ruleId?.startsWith("APPB-SEC"))) {
    recs.push({
      area: "Action auth", priority: "P1",
      recommendation: "Require Adobe IMS auth on actions, don't log sensitive data, keep .env gitignored.",
      expectedImpact: "Closes unauthenticated-invoke and secret-leak vectors.",
      effort: "M", details: "Covers APPB-SEC-001/004/005.",
    });
  }
  if (findings.some((f) => f.ruleId?.startsWith("APPB-MESH"))) {
    recs.push({
      area: "API Mesh", priority: "P1",
      recommendation: "Add query depth/complexity + rate limiting; inject upstream creds via secrets.",
      expectedImpact: "Protects upstreams from DoS and credential exposure.",
      effort: "M", details: "Covers APPB-MESH-001/002.",
    });
  }
  return recs;
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (args.help || !args.path) {
    console.log(`Adobe App Builder Audit Engine

Usage:
  npx ts-node audit.ts --path /app-builder-project [--name N] [--output DIR]
                       [--source-branch B] [--create-branch]`);
    if (!args.path) process.exit(1);
    return;
  }

  const projectRoot = path.resolve(args.path);
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    console.error(`❌ Project path does not exist: ${projectRoot}`);
    process.exit(1);
  }

  const projectName = args.name ?? path.basename(projectRoot);
  const outputDir = args.output ?? path.join(projectRoot, "audit-reports");

  console.log("═".repeat(60));
  console.log(" Adobe App Builder Audit");
  console.log("═".repeat(60));
  console.log(`   Project: ${projectName}`);
  console.log(`   Path:    ${projectRoot}`);
  console.log("\n🔍 Scanning JS/TS sources (tree-sitter AST) + config...");

  const scanner = new AppBuilderScanner(projectRoot);
  const { findings, filesScanned, jsFiles, configFiles } = await scanner.scan();

  const counts = computeCounts(findings);
  console.log(`   JS files: ${jsFiles}   Config files: ${configFiles}   (scanned ${filesScanned})`);
  console.log(`   Findings: ${counts.total}`);
  for (const sev of SEVERITIES) {
    const n = counts.bySeverity[sev];
    if (n > 0) console.log(`     ${sev.padEnd(9)} ${String(n).padStart(3)} ${"█".repeat(Math.min(40, n))}`);
  }
  console.log("");

  let sourceBranch = args.sourceBranch;
  if (args.createBranch) {
    const br = ensureStandardBranch({
      agent: "audit", stack: "app-builder", projectRoot,
      sourceCandidates: args.sourceBranch ? [args.sourceBranch] : undefined,
    });
    sourceBranch = br.sourceBranch ?? sourceBranch;
    console.log(br.ok ? `🌿 Standard branch: ${br.branch} (from ${br.sourceBranch})` : `⚠️  Branch: ${br.error}`);
  }

  const res = await emitStandardOutputs({
    agent: "audit",
    meta: {
      agent: "audit", engine: "app-builder", stack: "Adobe App Builder",
      projectName, projectRoot, sourceBranch,
      toolVersions: { "tree-sitter": "web-tree-sitter", engine: "app-builder-1.0.0" },
      extra: { "JS Files": jsFiles, "Config Files": configFiles },
    },
    findings,
    outputDir,
    recommendations: buildRecommendations(findings),
    changelogSummary: `App Builder audit: ${counts.total} finding(s) across ${jsFiles} JS + ${configFiles} config file(s).`,
  });

  console.log(`📊 Report:     ${res.xlsxPath}`);
  if (res.mdPath) console.log(`📄 Markdown:   ${res.mdPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG: ${res.changelogPath}`);
  console.log("\n" + "═".repeat(60));
  console.log(" ✅ App Builder audit complete");
  console.log("═".repeat(60));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}
