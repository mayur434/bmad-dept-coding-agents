#!/usr/bin/env ts-node
/**
 * BMAD Impact Analysis Agent — Dispatcher
 * ==========================================
 * INPUT : a Proofhub bug export (CSV) and/or a BRD document (.docx / .md / .txt)
 * OUTPUT: the standardized impact report — each bug/requirement traced to impacted
 *         code with blast radius + risk, on the Input-Traceability sheet + CHANGE-LOG.
 *
 * Usage:
 *   npx ts-node run.ts --path /project --bugs proofhub-export.csv
 *   npx ts-node run.ts --path /project --brd requirements.docx --engine spring
 *   npx ts-node run.ts --path /project --bugs bugs.csv --brd brd.md
 *   npx ts-node run.ts --list-engines
 */

import { resolve, basename, join } from "path";
import { existsSync } from "fs";
import { emitStandardOutputs } from "../../shared/output";
import { computeCounts, RecommendationRow, SEVERITIES } from "../../shared/core/types";
import { InputItem } from "./inputs/types";
import { readProofhubCsv, describeMapping } from "./inputs/proofhub";
import { readBrd } from "./inputs/brd";
import { traceImpact } from "./analysis/tracer";
import { PROFILES, profileById, detectProfile } from "./engines/profiles";
import { runPreflight, renderPreflight } from "../../shared/preflight";

interface Args {
  path: string;
  engine: string | null;
  bugs: string | null;
  brd: string | null;
  output: string | null;
  listEngines: boolean;
}

function parseArgs(): Args {
  const a: Args = { path: ".", engine: null, bugs: null, brd: null, output: null, listEngines: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--path": a.path = argv[++i]; break;
      case "--engine": a.engine = argv[++i]; break;
      case "--bugs": a.bugs = argv[++i]; break;
      case "--brd": a.brd = argv[++i]; break;
      case "--output": a.output = argv[++i]; break;
      case "--list-engines": a.listEngines = true; break;
      case "--help":
        console.log(`BMAD Impact Analysis Agent

Usage:
  npx ts-node run.ts --path <dir> [--bugs export.csv] [--brd doc.docx] [options]

Options:
  --path <dir>       Project root (default: .)
  --bugs <csv>       Proofhub bug/task CSV export
  --brd <doc>        BRD document (.docx / .md / .txt)
  --engine <id>      Stack engine (auto-detect if omitted)
  --output <dir>     Report output dir (default: <path>/impact-reports)
  --list-engines     List available stack engines
  --help             Show this help`);
        process.exit(0);
    }
  }
  return a;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.listEngines) {
    console.log("Available impact-analysis engines:\n");
    for (const p of PROFILES) console.log(`  ${p.id.padEnd(16)} ${p.name}`);
    console.log("  (aliases: aemcs, aemams → aem; commerce → commerce-paas)");
    return;
  }

  const projectPath = resolve(args.path);
  if (!existsSync(projectPath)) { console.error(`❌ Project path not found: ${projectPath}`); process.exit(1); }

  if (!args.bugs && !args.brd) {
    console.error("❌ Provide at least one input: --bugs <proofhub.csv> and/or --brd <document>");
    process.exit(1);
  }

  // ── ingest inputs ──
  const items: InputItem[] = [];
  if (args.bugs) {
    if (!existsSync(args.bugs)) { console.error(`❌ Bugs file not found: ${args.bugs}`); process.exit(1); }
    const bugs = readProofhubCsv(args.bugs);
    console.log(`🐞 Proofhub: ${bugs.length} bug(s)  [columns: ${describeMapping(args.bugs)}]`);
    items.push(...bugs);
  }
  if (args.brd) {
    if (!existsSync(args.brd)) { console.error(`❌ BRD file not found: ${args.brd}`); process.exit(1); }
    const reqs = await readBrd(args.brd);
    console.log(`📄 BRD: ${reqs.length} requirement(s)`);
    items.push(...reqs);
  }

  // ── resolve stack ──
  const profile = args.engine ? profileById(args.engine) : detectProfile(projectPath);
  if (!profile) {
    console.error(`❌ Could not resolve a stack engine. Use --engine <id> (see --list-engines).`);
    process.exit(1);
  }
  console.log(`💥 Impact Analysis — ${profile.name}`);
  console.log(`   Project: ${basename(projectPath)}   Inputs: ${items.length}`);
  if (!process.argv.includes("--no-preflight")) {
    console.log("\n" + renderPreflight(runPreflight(projectPath), { agent: "impact", stack: profile.id }));
    if (process.argv.includes("--preflight")) return;
  }
  console.log("\n🔎 Tracing impacted code...");

  const { findings, sourceCount, matchedItems } = traceImpact(projectPath, items, profile);
  const counts = computeCounts(findings);
  console.log(`   Source files scanned: ${sourceCount}`);
  console.log(`   Inputs matched to code: ${matchedItems}/${items.length}`);
  console.log(`   Impact findings: ${counts.total}`);
  for (const s of SEVERITIES) if (counts.bySeverity[s]) console.log(`     ${s.padEnd(9)} ${counts.bySeverity[s]}`);

  const recommendations = buildRecommendations(items.length, matchedItems, counts.bySeverity);
  const outputDir = args.output ?? join(projectPath, "impact-reports");

  const res = await emitStandardOutputs({
    agent: "impact",
    meta: {
      agent: "impact", engine: profile.id, stack: profile.name,
      projectName: basename(projectPath), projectRoot: projectPath,
      extra: { Inputs: items.length, "Matched to code": matchedItems, "Source files": sourceCount },
    },
    findings,
    outputDir,
    recommendations,
    changelogSummary: `Impact analysis: ${items.length} input(s) → ${counts.total} impacted finding(s) across ${profile.name}.`,
  });

  console.log(`\n📊 Report:     ${res.xlsxPath}   (see 'Input Traceability' sheet)`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG: ${res.changelogPath}`);
  console.log("\n" + "═".repeat(60));
  console.log(" ✅ Impact analysis complete");
  console.log("═".repeat(60));
}

function buildRecommendations(total: number, matched: number, bySev: Record<string, number>): RecommendationRow[] {
  const recs: RecommendationRow[] = [];
  const hot = (bySev.CRITICAL ?? 0) + (bySev.HIGH ?? 0);
  if (hot > 0) recs.push({
    area: "High-risk items", priority: "P0",
    recommendation: `Review the ${hot} CRITICAL/HIGH impacted file(s) (wide blast radius or high-priority input) before merging.`,
    expectedImpact: "Prevents regressions in heavily-referenced code.", effort: "M",
    details: "See the Input Traceability sheet, sorted by severity.",
  });
  if (matched < total) recs.push({
    area: "Unmatched inputs", priority: "P2",
    recommendation: `${total - matched} input(s) had no direct code match — scope them manually or enrich with module/file hints.`,
    expectedImpact: "Closes traceability gaps.", effort: "S",
    details: "Rows marked 'Needs manual review'.",
  });
  recs.push({
    area: "Regression coverage", priority: "P1",
    recommendation: "Add/adjust tests for each impacted file before implementing the fix/requirement.",
    expectedImpact: "Locks in behavior across the traced blast radius.", effort: "M",
    details: "Pair with the Test-Coverage agent for gap analysis.",
  });
  return recs;
}

main().catch((err) => { console.error("❌ Fatal error:", err.message); process.exit(1); });
