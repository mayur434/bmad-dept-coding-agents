#!/usr/bin/env node
/**
 * Adobe Commerce SaaS — Audit Engine
 * ===================================
 * Scans the SaaS storefront/integration JS + config and emits the standardized report.
 */

import * as fs from "fs";
import * as path from "path";
import { emitStandardOutputs, ensureStandardBranch } from "../../../../shared/output";
import { computeCounts, Finding, RecommendationRow, SEVERITIES } from "../../../../shared/core/types";
import { CommerceSaasScanner } from "./scanner";
import { applyDecisionsFilter, applySLA, maybeFailOnOverdue } from "../../shared/emit-helpers";

interface Args { path: string; name?: string; output?: string; sourceBranch?: string; createBranch: boolean; help: boolean; }

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
  const c = computeCounts(findings);
  const recs: RecommendationRow[] = [];
  if (c.bySeverity.CRITICAL > 0) recs.push({
    area: "Credentials", priority: "P0",
    recommendation: "Move private/admin Commerce tokens out of storefront code + config; keep only the public Catalog/Live-Search key client-side.",
    expectedImpact: "Removes privileged-credential exposure.", effort: "M", details: "CSAAS-SEC-001, CSAAS-CFG-001.",
  });
  recs.push({
    area: "SaaS integration", priority: "P1",
    recommendation: "Externalize environment ids/endpoints to config; verify Data Connection/eventing webhook signatures.",
    expectedImpact: "Clean stage promotion + forgery-resistant eventing.", effort: "M", details: "CSAAS-CFG-002, CSAAS-SEC-003.",
  });
  return recs;
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (args.help || !args.path) {
    console.log(`Adobe Commerce SaaS Audit Engine\n\nUsage:\n  npx ts-node audit.ts --path /project [--name N] [--output DIR] [--source-branch B] [--create-branch]`);
    if (!args.path) process.exit(1);
    return;
  }
  const projectRoot = path.resolve(args.path);
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) { console.error(`❌ Project path does not exist: ${projectRoot}`); process.exit(1); }

  const projectName = args.name ?? path.basename(projectRoot);
  const outputDir = args.output ?? path.join(projectRoot, "audit-reports");
  console.log("═".repeat(60));
  console.log(" Adobe Commerce SaaS Audit");
  console.log("═".repeat(60));
  console.log(`   Project: ${projectName}\n   Path:    ${projectRoot}`);
  console.log("\n🔍 Scanning storefront/integration JS (tree-sitter AST) + config...");

  const { findings, filesScanned, jsFiles, configFiles } = await new CommerceSaasScanner(projectRoot).scan();
  const counts = computeCounts(findings);
  console.log(`   JS files: ${jsFiles}   Config files: ${configFiles}   (scanned ${filesScanned})`);
  console.log(`   Findings: ${counts.total}`);
  for (const s of SEVERITIES) if (counts.bySeverity[s]) console.log(`     ${s.padEnd(9)} ${counts.bySeverity[s]}`);

  let sourceBranch = args.sourceBranch;
  if (args.createBranch) {
    const br = ensureStandardBranch({ agent: "audit", stack: "commerce-saas", projectRoot, sourceCandidates: args.sourceBranch ? [args.sourceBranch] : undefined });
    sourceBranch = br.sourceBranch ?? sourceBranch;
    console.log(br.ok ? `🌿 Standard branch: ${br.branch} (from ${br.sourceBranch})` : `⚠️  Branch: ${br.error}`);
  }

  // Findings gate — filter against .bmad/decisions.yaml before emit.
  const decisionsExtra: Record<string, string | number> = { "JS Files": jsFiles, "Config Files": configFiles };
  const gate = applyDecisionsFilter(findings, projectRoot, decisionsExtra);
  const gatedFindings = gate.kept;
  if (gate.suppressed > 0) {
    console.log(`   🎯 Findings gate: suppressed ${gate.suppressed} finding(s) via .bmad/decisions.yaml`);
  }

  // SLA gate — compute per-finding SLA + build the SLA Status sheet (non-fatal).
  const sla = applySLA({ findings: gatedFindings, projectRoot, agent: "audit", extra: decisionsExtra });

  const res = await emitStandardOutputs({
    agent: "audit",
    meta: { agent: "audit", engine: "commerce-saas", stack: "Adobe Commerce SaaS", projectName, projectRoot, sourceBranch, toolVersions: { "tree-sitter": "web-tree-sitter", engine: "commerce-saas-1.0.0" }, extra: decisionsExtra },
    findings: gatedFindings, outputDir, recommendations: buildRecommendations(gatedFindings),
    extraSheets: sla.extraSheet ? [sla.extraSheet] : undefined,
    changelogSummary: `Commerce SaaS audit: ${counts.total} finding(s) across ${jsFiles} JS + ${configFiles} config file(s).`,
  });
  console.log(`📊 Report:     ${res.xlsxPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG: ${res.changelogPath}`);
  console.log("\n" + "═".repeat(60) + "\n ✅ Commerce SaaS audit complete\n" + "═".repeat(60));
  maybeFailOnOverdue(sla.summary);
}

if (require.main === module) {
  main().catch((err) => { console.error(`❌ Fatal error: ${err.message}`); process.exit(1); });
}
