/**
 * Sonar Scan — LLM → standardized report bridge
 * ================================================
 * Reads the LLM-authored sonar-findings.json, normalizes into Finding[],
 * computes ratings + quality gate, calls emitStandardOutputs(), then
 * post-processes the .xlsx to add a dedicated Vulnerabilities sheet.
 */

import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";
import { emitStandardOutputs, maybeCutStandardBranch } from "../../../shared/output";
import {
  Finding,
  normalizeSeverity,
  sortFindings,
  normalizeFinding,
} from "../../../shared/core/types";
import { StackProfile } from "../engines/profiles";
import { computeRatings, buildRatingRecommendations } from "./ratings";

// ── JSON → Finding mapping ───────────────────────────────────────────────────

interface RawFinding {
  title?: string;
  description?: string;
  stack?: string;
  category?: string;
  file?: string;
  line?: number | string;
  codeRef?: string;
  code?: string;
  severity?: string;
  confidence?: number | string;
  ruleId?: string;
  recommendation?: string;
  impact?: string;
  effort?: string;
  status?: string;
  owner?: string;
}

interface SonarFindingsJson {
  meta?: {
    project?: string;
    engine?: string;
    stack?: string;
    timestamp?: string;
  };
  findings: RawFinding[];
}

function mapFinding(raw: RawFinding, index: number): Finding {
  const line = raw.line != null ? Number(raw.line) : undefined;
  return {
    title: raw.title ?? `Finding ${index + 1}`,
    description: raw.description,
    stack: raw.stack,
    category: raw.category,
    file: raw.file,
    line: Number.isNaN(line) ? undefined : line,
    codeRef: raw.codeRef ?? (raw.file ? (line != null ? `${raw.file}:${line}` : raw.file) : undefined),
    code: raw.code,
    severity: normalizeSeverity(raw.severity),
    confidence: raw.confidence,
    ruleId: raw.ruleId,
    recommendation: raw.recommendation,
    impact: raw.impact,
    effort: raw.effort,
    status: raw.status ?? "Open",
    owner: raw.owner,
    source: "llm",
  };
}

// ── Severity color fills for the Vulnerabilities sheet ─────────────────────

const SEV_FILL: Record<string, ExcelJS.Fill> = {
  CRITICAL: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCCCC" } }, // light red
  HIGH:     { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE5CC" } }, // light orange
  MEDIUM:   { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF99" } }, // light yellow
  LOW:      { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCE5FF" } }, // light blue
  INFO:     { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } }, // light grey
};

const SEV_FONT_COLOR: Record<string, string> = {
  CRITICAL: "FF8B0000", // dark red
  HIGH:     "FF7B3F00", // dark orange
  MEDIUM:   "FF5C4A00", // dark yellow
  LOW:      "FF003E80", // dark blue
  INFO:     "FF444444", // dark grey
};

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
const BODY_FONT: Partial<ExcelJS.Font> = { name: "Calibri", size: 10 };

const VULN_COLS = [
  { header: "ID",                 key: "id",             width: 16 },
  { header: "Severity",           key: "severity",       width: 12 },
  { header: "Category",           key: "category",       width: 18 },
  { header: "Rule ID",            key: "ruleId",         width: 10 },
  { header: "Code Reference",     key: "codeRef",        width: 36 },
  { header: "Title",              key: "title",          width: 36 },
  { header: "Description",        key: "description",    width: 50 },
  { header: "Recommended Fix",    key: "recommendation", width: 60 },
  { header: "Confidence",         key: "confidence",     width: 12 },
  { header: "Effort",             key: "effort",         width: 10 },
  { header: "Owner",              key: "owner",          width: 18 },
  { header: "Status",             key: "status",         width: 12 },
];

async function addVulnerabilitiesSheet(xlsxPath: string, findings: Finding[]): Promise<void> {
  const vulns = sortFindings(
    findings.filter((f) => f.category === "Vulnerability" || f.category === "Security Hotspot"),
  );
  if (vulns.length === 0) return;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  const ws = wb.addWorksheet("Vulnerabilities", {
    properties: { tabColor: { argb: "FFFF0000" } },
  });

  ws.columns = VULN_COLS;

  // Header row
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });
  headerRow.height = 20;
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Data rows
  vulns.forEach((raw, i) => {
    const f = normalizeFinding(raw, i);
    const sev = normalizeSeverity(f.severity);
    const fill = SEV_FILL[sev] ?? SEV_FILL.INFO;
    const fontColor = SEV_FONT_COLOR[sev] ?? "FF000000";

    const row = ws.addRow({
      id: f.id,
      severity: sev,
      category: f.category ?? "—",
      ruleId: f.ruleId ?? "—",
      codeRef: f.codeRef ?? "—",
      title: f.title,
      description: f.description ?? "",
      recommendation: f.recommendation ?? "",
      confidence: f.confidence != null ? String(f.confidence) : "—",
      effort: f.effort ?? "—",
      owner: f.owner ?? "",
      status: f.status ?? "Open",
    });

    row.eachCell((cell) => {
      cell.fill = fill;
      cell.font = { ...BODY_FONT, color: { argb: fontColor } };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFCCCCCC" } },
        right:  { style: "hair", color: { argb: "FFCCCCCC" } },
      };
    });

    // Bold the severity cell
    const sevCell = row.getCell("severity");
    sevCell.font = { ...BODY_FONT, bold: true, color: { argb: fontColor } };

    // Highlight the Recommended Fix cell
    const fixCell = row.getCell("recommendation");
    fixCell.font = { ...BODY_FONT, color: { argb: fontColor } };

    row.height = 40;
  });

  // Auto-filter
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: vulns.length + 1, column: VULN_COLS.length } };

  await wb.xlsx.writeFile(xlsxPath);
}

// ── Main ingest entry point ──────────────────────────────────────────────────

export interface IngestOptions {
  jsonPath: string;
  projectRoot: string;
  profile: StackProfile;
  outputDir: string;
  argv: string[];
}

export async function ingest(opts: IngestOptions): Promise<void> {
  const { jsonPath, projectRoot, profile, outputDir, argv } = opts;

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Findings JSON not found: ${jsonPath}`);
    process.exit(1);
  }

  let parsed: SonarFindingsJson;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as SonarFindingsJson;
  } catch (e) {
    console.error(`❌ Could not parse findings JSON: ${(e as Error).message}`);
    process.exit(1);
  }

  if (!Array.isArray(parsed.findings)) {
    console.error(`❌ sonar-findings.json must have a top-level "findings" array`);
    process.exit(1);
  }

  const findings: Finding[] = parsed.findings.map((r, i) => mapFinding(r, i));
  const ratings = computeRatings(findings);
  const recommendations = buildRatingRecommendations(findings, ratings);

  const gateIcon = ratings.qualityGate === "PASS" ? "✅" : "❌";
  console.log(`\n🎯 Sonar Scan — ${profile.name}`);
  console.log(`   Project: ${path.basename(projectRoot)}`);
  console.log(`   Findings: ${findings.length}  (from ${jsonPath})`);
  console.log(`\n${gateIcon} Quality Gate: ${ratings.qualityGate}`);
  console.log(`   Reliability:      ${ratings.reliability}`);
  console.log(`   Security:         ${ratings.security}`);
  console.log(`   Maintainability:  ${ratings.maintainability}`);

  // Cut working branch if requested (before writing outputs)
  maybeCutStandardBranch(argv, { agent: "sonar-scan", stack: profile.id, projectRoot });

  const res = await emitStandardOutputs({
    agent: "sonar-scan",
    meta: {
      agent: "sonar-scan",
      engine: profile.id,
      stack: profile.name,
      projectName: parsed.meta?.project ?? path.basename(projectRoot),
      projectRoot,
      extra: {
        "Quality Gate": ratings.qualityGate,
        "Reliability Rating": ratings.reliability,
        "Security Rating": ratings.security,
        "Maintainability Rating": ratings.maintainability,
        "Findings Total": findings.length,
        "Vulnerabilities": findings.filter((f) => f.category === "Vulnerability" || f.category === "Security Hotspot").length,
      },
    },
    findings,
    outputDir,
    recommendations,
    changelogSummary: `Sonar scan: ${findings.length} finding(s) — Quality Gate ${ratings.qualityGate} (R:${ratings.reliability} S:${ratings.security} M:${ratings.maintainability}) — ${profile.name}.`,
  });

  // Post-process: add Vulnerabilities sheet with color-coded rows
  await addVulnerabilitiesSheet(res.xlsxPath, findings);

  console.log(`\n📊 Report:     ${res.xlsxPath}`);
  console.log(`              (Vulnerabilities sheet: ${findings.filter((f) => f.category === "Vulnerability" || f.category === "Security Hotspot").length} finding(s))`);
  if (res.mdPath) console.log(`📝 Markdown:   ${res.mdPath}`);
  if (res.changelogPath) console.log(`📋 CHANGE-LOG: ${res.changelogPath}`);
  console.log("\n" + "═".repeat(60));
  console.log(` ${gateIcon} Sonar scan complete — Quality Gate ${ratings.qualityGate}`);
  console.log("═".repeat(60));
}
