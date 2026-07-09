/**
 * Output pipeline smoke test — proves the three standardized outputs end-to-end
 * against a real temp git repo:
 *   - <agent>-<branch>-<timestamp>-agent-report.xlsx (+ .md)
 *   - CHANGE-LOG.md
 *   - standard branch cut from a production/shared branch
 * Verifies the Summary sheet header matches the SUMMARY_COLUMNS contract exactly.
 *
 * Run: npx ts-node output/smoke.ts <writableTmpDir>
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";
import ExcelJS from "exceljs";
import { Finding } from "../core/types";
import { SUMMARY_COLUMNS } from "../report/standard-report";
import { emitStandardOutputs, ensureStandardBranch } from "./emit";

function git(args: string[], cwd: string) {
  execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
}

async function main(): Promise<void> {
  const base = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "dca-smoke-"));
  const repo = path.join(base, "sample-repo");
  const outDir = path.join(repo, "audit-reports");
  fs.rmSync(repo, { recursive: true, force: true });
  fs.mkdirSync(repo, { recursive: true });

  // Real git repo with a `production` source branch.
  git(["init", "-q"], repo);
  git(["config", "user.email", "dca@example.com"], repo);
  git(["config", "user.name", "DCA"], repo);
  git(["checkout", "-q", "-b", "production"], repo);
  fs.writeFileSync(path.join(repo, "README.md"), "# sample\n");
  git(["add", "-A"], repo);
  git(["commit", "-q", "-m", "init"], repo);

  const findings: Finding[] = [
    {
      title: "Hardcoded connector credential",
      description: "AWS secret key hardcoded in a Shaft connector service.",
      stack: "sling-shaft",
      category: "Security",
      file: "core/src/main/java/com/acme/S3Connector.java",
      line: 42,
      severity: "CRITICAL",
      confidence: 0.95,
      ruleId: "SHAFT-SEC-001",
      recommendation: "Move to OSGi config / secret store.",
      impact: "Credential leak across all environments using this bundle.",
      effort: "M",
      source: "scanner",
    },
    {
      title: "Missing @WebMvcTest for controller",
      description: "OrderController has no slice test.",
      stack: "spring-boot",
      category: "Test Coverage",
      file: "src/main/java/com/acme/OrderController.java",
      line: 18,
      severity: "MEDIUM",
      recommendation: "Add @WebMvcTest(OrderController.class) with MockMvc.",
      impact: "Regressions in order API go undetected.",
      source: "scanner",
      inputRef: { id: "BUG-4521", type: "bug", title: "Orders API 500 on null coupon", source: "proofhub-export.csv" },
    },
    {
      title: "GraphQL query depth unbounded",
      description: "API Mesh source lacks depth limiting.",
      stack: "app-builder-mesh",
      category: "Performance",
      file: "mesh.config.js",
      line: 7,
      severity: "HIGH",
      recommendation: "Add depthLimit plugin.",
      impact: "DoS risk via deep nested queries.",
      source: "llm",
    },
  ];

  // Cut the standard branch from production, then emit outputs on it.
  const branchRes = ensureStandardBranch({ agent: "audit", stack: "sling-shaft", projectRoot: repo, sourceCandidates: ["production", "main"] });
  const res = await emitStandardOutputs({
    agent: "audit",
    meta: {
      agent: "audit",
      engine: "sling-shaft",
      stack: "Sling-12 / Shaft",
      projectName: "sample-repo",
      projectRoot: repo,
      sourceBranch: branchRes.sourceBranch ?? undefined,
      toolVersions: { "dca-shared": "1.0.0" },
    },
    findings,
    outputDir: outDir,
    changelogSummary: "Smoke audit of the sample repo.",
    changelogDetails: ["Scanned Java + JS", "3 findings across 3 stacks"],
    recommendations: [
      { area: "Secrets", recommendation: "Adopt OSGi secret store", expectedImpact: "Eliminates hardcoded creds", effort: "M", priority: "P0", details: "Applies to all connectors." },
    ],
  });

  // ── Assertions ──────────────────────────────────────────────────────────
  const problems: string[] = [];
  const fileName = path.basename(res.xlsxPath);

  if (!branchRes.ok) problems.push(`branch not created: ${branchRes.error}`);
  if (branchRes.sourceBranch !== "production") problems.push(`expected source 'production', got '${branchRes.sourceBranch}'`);
  if (!/^dca\/audit-sling-shaft-\d{8}_\d{6}$/.test(branchRes.branch)) problems.push(`bad standard branch name: ${branchRes.branch}`);

  if (!/^audit-dca-audit-sling-shaft-\d{8}_\d{6}-\d{8}_\d{6}-agent-report\.xlsx$/.test(fileName)) {
    problems.push(`report file name off-contract: ${fileName}`);
  }
  if (!fs.existsSync(res.xlsxPath)) problems.push("xlsx not written");
  if (!res.mdPath || !fs.existsSync(res.mdPath)) problems.push("markdown not written");
  if (!res.changelogPath || !fs.existsSync(res.changelogPath)) problems.push("CHANGE-LOG.md not written");

  // Verify Summary sheet header equals the contract exactly.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(res.xlsxPath);
  const summary = wb.getWorksheet("Summary");
  if (!summary) {
    problems.push("no Summary sheet");
  } else {
    const header: string[] = [];
    summary.getRow(1).eachCell((c) => header.push(String(c.value)));
    const expected = [...SUMMARY_COLUMNS];
    if (JSON.stringify(header) !== JSON.stringify(expected)) {
      problems.push(`Summary header mismatch:\n  got: ${JSON.stringify(header)}\n  exp: ${JSON.stringify(expected)}`);
    }
  }
  if (!wb.getWorksheet("Input Traceability")) problems.push("Traceability sheet missing (one finding had inputRef)");
  if (!wb.getWorksheet("Run Info")) problems.push("Run Info sheet missing");

  const changelog = fs.readFileSync(res.changelogPath!, "utf8");
  if (!changelog.includes("BUG-4521") === false) { /* not required in changelog */ }
  if (!changelog.includes("`audit`")) problems.push("CHANGE-LOG missing agent entry");
  if (!changelog.includes(fileName)) problems.push("CHANGE-LOG missing report reference");

  console.log("report file:   ", fileName);
  console.log("standard branch:", branchRes.branch, "(from", branchRes.sourceBranch + ")");
  console.log("sheets:        ", wb.worksheets.map((w) => w.name).join(", "));
  console.log("outputs dir:   ", outDir);

  if (problems.length) {
    console.error("\n❌ Output pipeline smoke test FAILED:");
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
  }
  console.log("\n✅ Output pipeline smoke test passed (report + markdown + CHANGE-LOG + standard branch).");
}

main().catch((err) => {
  console.error("❌ Output smoke test error:", err);
  process.exit(1);
});
