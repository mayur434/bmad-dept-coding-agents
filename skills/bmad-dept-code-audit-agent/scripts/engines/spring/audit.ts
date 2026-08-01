#!/usr/bin/env node
/**
 * Spring Boot — Audit Engine
 * ===========================
 * Runs the Spring Java-AST + config scanner and emits the shared standardized
 * report (xlsx + markdown + CHANGE-LOG). Optionally cuts the standard branch.
 */

import * as fs from "fs";
import * as path from "path";
import { emitStandardOutputs, ensureStandardBranch } from "../../../../shared/output";
import { computeCounts, Finding, RecommendationRow, SEVERITIES } from "../../../../shared/core/types";
import { SpringScanner } from "./scanner";
import { scanSpringXml } from "./xml-scan";
import { enforceConfidenceOnAll, emitAuditFindingsCache } from "../../shared/emit-helpers";
import { runDeltaMode } from "../../shared/delta";

interface Args {
  path: string;
  name?: string;
  output?: string;
  sourceBranch?: string;
  createBranch: boolean;
  help: boolean;
  since?: string;
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
      case "--since": a.since = argv[++i]; break;
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
      recommendation: "Remove hardcoded secrets from code and application config; rotate exposed values.",
      expectedImpact: "Eliminates credential leakage from the repo and artifact.",
      effort: "M", details: "Covers SPRING-CFG-001, SPRING-SEC-010.",
    });
  }
  if (findings.some((f) => f.category === "Security")) {
    recs.push({
      area: "Web security", priority: "P1",
      recommendation: "Re-enable CSRF where applicable, lock down Actuator exposure, allow-list CORS, validate request bodies.",
      expectedImpact: "Closes the common Spring Boot exposure surface.",
      effort: "M", details: "Covers SPRING-SEC-002/003/004/005/006/007/008.",
    });
  }
  recs.push({
    area: "Design", priority: "P2",
    recommendation: "Prefer constructor injection over field injection for testability and immutability.",
    expectedImpact: "Improves testability and clarity of dependencies.",
    effort: "S", details: "Covers SPRING-QUAL-001.",
  });
  return recs;
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (args.help || !args.path) {
    console.log(`Spring Boot Audit Engine

Usage:
  npx ts-node audit.ts --path /spring-project [--name N] [--output DIR]
                       [--source-branch B] [--create-branch]
                       [--since <ref|timestamp|last>]  Delta vs a prior cached audit run.`);
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
  console.log(" Spring Boot Audit");
  console.log("═".repeat(60));
  console.log(`   Project: ${projectName}`);
  console.log(`   Path:    ${projectRoot}`);
  console.log("\n🔍 Scanning Java sources (tree-sitter AST) + config...");

  const scanner = new SpringScanner(projectRoot);
  const scanRes = await scanner.scan();
  const { filesScanned, javaFiles, configFiles } = scanRes;
  let findings: Finding[] = scanRes.findings;

  // XML config scan — legacy applicationContext / spring / web.xml / security.xml.
  const xmlFindings = await scanSpringXml(projectRoot);
  findings = [...findings, ...xmlFindings];

  // Confidence enforcement — fill defaults for anything the scanners left blank.
  findings = enforceConfidenceOnAll(findings, "ast");

  const counts = computeCounts(findings);
  console.log(`   Java files: ${javaFiles}   Config files: ${configFiles}   (scanned ${filesScanned})`);
  console.log(`   Findings:   ${counts.total}`);
  for (const sev of SEVERITIES) {
    const n = counts.bySeverity[sev];
    if (n > 0) console.log(`     ${sev.padEnd(9)} ${String(n).padStart(3)} ${"█".repeat(Math.min(40, n))}`);
  }
  console.log("");

  let sourceBranch = args.sourceBranch;
  if (args.createBranch) {
    const br = ensureStandardBranch({
      agent: "audit", stack: "spring-boot", projectRoot,
      sourceCandidates: args.sourceBranch ? [args.sourceBranch] : undefined,
    });
    sourceBranch = br.sourceBranch ?? sourceBranch;
    console.log(br.ok ? `🌿 Standard branch: ${br.branch} (from ${br.sourceBranch})` : `⚠️  Branch: ${br.error}`);
  }

  const res = await emitStandardOutputs({
    agent: "audit",
    meta: {
      agent: "audit", engine: "spring-boot", stack: "Spring Boot",
      projectName, projectRoot, sourceBranch,
      toolVersions: { "tree-sitter": "web-tree-sitter", engine: "spring-1.0.0" },
      extra: { "Java Files": javaFiles, "Config Files": configFiles },
    },
    findings,
    outputDir,
    recommendations: buildRecommendations(findings),
    changelogSummary: `Spring Boot audit: ${counts.total} finding(s) across ${javaFiles} Java + ${configFiles} config file(s).`,
  });

  console.log(`📊 Report:     ${res.xlsxPath}`);
  if (res.mdPath) console.log(`📄 Markdown:   ${res.mdPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG: ${res.changelogPath}`);

  // Delta mode — compare against a prior cached run (opt-in via --since).
  // MUST run BEFORE writing this run's cache so "last" resolves to a truly
  // prior run rather than the one we're about to persist.
  if (args.since !== undefined) {
    await runDeltaMode({
      projectRoot,
      since: args.since,
      currentFindings: findings,
      xlsxPath: res.xlsxPath,
    });
  }

  // Findings cache — enable cross-agent consumption (impact-analysis, etc.).
  emitAuditFindingsCache({
    projectRoot,
    stack: "spring-boot",
    reportPath: res.xlsxPath,
    findings,
    timestamp: res.meta.timestamp ?? "",
    branch: res.meta.workingBranch,
    meta: {
      role: process.env.DCA_ROLE ?? "",
      roleFlavor: process.env.DCA_ROLE_FLAVOR ?? "",
    },
  });

  console.log("\n" + "═".repeat(60));
  console.log(" ✅ Spring Boot audit complete");
  console.log("═".repeat(60));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}
