#!/usr/bin/env node
/**
 * Sling-12 / Shaft — Audit Engine
 * ================================
 * The first DCA audit engine on the shared standardized report. Runs the
 * tree-sitter AST scanner and emits `<agent>-<branch>-<timestamp>-agent-report.xlsx`
 * + Markdown + CHANGE-LOG.md via the shared foundation. Optionally cuts the
 * standard working branch from the production/shared branch.
 */

import * as fs from "fs";
import * as path from "path";
import { emitStandardOutputs, ensureStandardBranch } from "../../../../shared/output";
import { computeCounts, Finding, RecommendationRow, SEVERITIES } from "../../../../shared/core/types";
import { SlingShaftScanner } from "./scanner";
import { isShaft } from "./detect";

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

function help(): void {
  console.log(`Sling-12 / Shaft Audit Engine

Usage:
  npx ts-node audit.ts --path /sling-or-shaft-project [options]

Options:
  --path <dir>            Project root (required)
  --name <name>           Project name (default: folder name)
  --output <dir>          Report output dir (default: <path>/audit-reports)
  --source-branch <name>  Production/shared branch to cut the standard branch from
  --create-branch         Create the standard working branch before writing outputs
  --help                  Show this help`);
}

function buildRecommendations(findings: Finding[]): RecommendationRow[] {
  const bySeverity = computeCounts(findings);
  const recs: RecommendationRow[] = [];
  if (bySeverity.bySeverity.CRITICAL > 0) {
    recs.push({
      area: "Security", priority: "P0",
      recommendation: "Remediate all CRITICAL findings (hardcoded secrets, SQL injection) before release.",
      expectedImpact: "Removes credential-leak and injection risk across connectors.",
      effort: "M", details: "Rotate any exposed secrets; parameterize all dynamic SQL.",
    });
  }
  if (findings.some((f) => f.category === "Security")) {
    recs.push({
      area: "Auth & TLS", priority: "P1",
      recommendation: "Verify JWT signatures (parseClaimsJws), enable TLS validation, replace weak crypto.",
      expectedImpact: "Closes auth-bypass and MITM vectors on connector traffic.",
      effort: "M", details: "Covers SHAFT-AUTH-001, SHAFT-SEC-004/005.",
    });
  }
  recs.push({
    area: "Sling hygiene", priority: "P2",
    recommendation: "Close ResourceResolvers (try-with-resources); replace admin logins with scoped service users.",
    expectedImpact: "Prevents session-pool exhaustion and reduces privilege blast radius.",
    effort: "S", details: "Covers SLING-RES-001, SLING-SEC-003.",
  });
  return recs;
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (args.help || !args.path) {
    help();
    if (!args.path) process.exit(1);
    return;
  }

  const projectRoot = path.resolve(args.path);
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    console.error(`❌ Project path does not exist: ${projectRoot}`);
    process.exit(1);
  }

  const shaft = isShaft(projectRoot);
  const projectName = args.name ?? path.basename(projectRoot);
  const outputDir = args.output ?? path.join(projectRoot, "audit-reports");

  console.log("═".repeat(60));
  console.log(` Sling-12 / Shaft Audit — ${shaft ? "Shaft (SAM + MDM) detected" : "Apache Sling"}`);
  console.log("═".repeat(60));
  console.log(`   Project: ${projectName}`);
  console.log(`   Path:    ${projectRoot}`);
  console.log("");
  console.log("🔍 Scanning Java sources (tree-sitter AST)...");

  const scanner = new SlingShaftScanner(projectRoot);
  const { findings, filesScanned, javaFiles } = await scanner.scan();

  const counts = computeCounts(findings);
  console.log(`   Java files: ${javaFiles} (scanned ${filesScanned})`);
  console.log(`   Findings:   ${counts.total}`);
  for (const sev of SEVERITIES) {
    const n = counts.bySeverity[sev];
    if (n > 0) console.log(`     ${sev.padEnd(9)} ${String(n).padStart(3)} ${"█".repeat(Math.min(40, n))}`);
  }
  console.log("");

  // Optional: cut the standard branch from production/shared.
  let sourceBranch = args.sourceBranch;
  if (args.createBranch) {
    const br = ensureStandardBranch({
      agent: "audit",
      stack: "sling-shaft",
      projectRoot,
      sourceCandidates: args.sourceBranch ? [args.sourceBranch] : undefined,
    });
    sourceBranch = br.sourceBranch ?? sourceBranch;
    console.log(br.ok ? `🌿 Standard branch: ${br.branch} (from ${br.sourceBranch})` : `⚠️  Branch: ${br.error}`);
  }

  const res = await emitStandardOutputs({
    agent: "audit",
    meta: {
      agent: "audit",
      engine: "sling-shaft",
      stack: shaft ? "Shaft (Sling-12)" : "Apache Sling",
      projectName,
      projectRoot,
      sourceBranch,
      toolVersions: { "tree-sitter": "web-tree-sitter", engine: "sling-1.0.0" },
      extra: { "Java Files": javaFiles, "Files Scanned": filesScanned },
    },
    findings,
    outputDir,
    recommendations: buildRecommendations(findings),
    changelogSummary: `Sling/Shaft audit: ${counts.total} finding(s) across ${filesScanned} Java file(s).`,
  });

  console.log(`📊 Report:     ${res.xlsxPath}`);
  if (res.mdPath) console.log(`📄 Markdown:   ${res.mdPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG: ${res.changelogPath}`);
  console.log("\n" + "═".repeat(60));
  console.log(" ✅ Sling/Shaft audit complete");
  console.log("═".repeat(60));
}

// Allow running the engine directly (dispatcher calls main()).
if (require.main === module) {
  main().catch((err) => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}
