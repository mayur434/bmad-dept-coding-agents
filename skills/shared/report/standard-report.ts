/**
 * DCA Shared — Standardized Excel Report
 * =======================================
 * ONE report generator for all four agents. Given normalized `Finding[]` + `RunMeta`
 * it produces a workbook whose shape is DETERMINISTIC and IDENTICAL for the same
 * tech stack across every project the plugin runs in.
 *
 * Sheets (fixed order):
 *   1. Run Info            — agent/engine/stack/branches/timestamp/tool versions/counts
 *   2. Summary             — the required columns (see SUMMARY_COLUMNS), one row per finding
 *   3. Severity Breakdown  — counts + percentages per severity
 *   4. By Category         — counts per category x severity
 *   5. Recommendations     — optional, when supplied
 *   6. Traceability        — optional, only when findings carry inputRef (impact agent)
 *
 * The Summary sheet is the contract. Its column set is guaranteed and stable so the
 * same stack yields a byte-comparable header row everywhere.
 */

import ExcelJS from "exceljs";
import {
  Finding,
  RunMeta,
  RecommendationRow,
  SEVERITIES,
  computeCounts,
  groupByCategory,
  normalizeFinding,
  normalizeSeverity,
  sortFindings,
} from "../core/types";
import {
  TITLE_FONT, SUBTITLE_FONT, BODY_FONT, HEADER_FONT, HEADER_FILL, HEADER_BORDER,
  SUMMARY_LABEL_FONT, SUMMARY_VALUE_FONT, SECTION_FILL, CODE_FONT, CENTER_ALIGN,
  severityFill, severityFont, styleHeaderRow, applyZebraAndBorders, colorSeverityCol,
} from "./styles";

/**
 * The standardized Summary sheet columns. The first 8 are the user-mandated
 * minimum (Title, Description, Code Reference, Severity, Recommendation/Fix,
 * Impact Analysis, Dev Comments, Status); the rest add deterministic richness.
 * ORDER IS PART OF THE CONTRACT — do not reorder without a version bump.
 */
export const SUMMARY_COLUMNS = [
  "ID",
  "Title",
  "Description",
  "Tech Stack",
  "Category / Module",
  "Code Reference",
  "Severity",
  "Confidence",
  "Rule ID",
  "Recommendation / Fix",
  "Impact Analysis",
  "Effort",
  "Dev Comments",
  "Owner",
  "Status",
] as const;

const SUMMARY_WIDTHS = [14, 40, 60, 16, 26, 42, 12, 12, 18, 60, 55, 10, 30, 16, 14];

export interface StandardReportOptions {
  recommendations?: RecommendationRow[];
  /** Workbook title shown on the Run Info sheet (default derived from agent). */
  title?: string;
}

export class StandardExcelReport {
  private wb: ExcelJS.Workbook;
  private findings: Finding[];
  private meta: RunMeta;
  private opts: StandardReportOptions;

  constructor(findings: Finding[], meta: RunMeta, opts: StandardReportOptions = {}) {
    this.findings = sortFindings(findings);
    this.meta = meta;
    this.opts = opts;
    this.wb = new ExcelJS.Workbook();
    this.wb.creator = "BMAD DCA — DEPT Code Agent";
    this.wb.company = "BMAD DCA";
  }

  /** Generate and write the workbook. Returns the resolved absolute path. */
  async generate(outputPath: string): Promise<string> {
    this.sheetRunInfo();
    this.sheetSummary();
    this.sheetSeverityBreakdown();
    this.sheetByCategory();
    if (this.opts.recommendations && this.opts.recommendations.length > 0) {
      this.sheetRecommendations(this.opts.recommendations);
    }
    if (this.findings.some((f) => f.inputRef)) {
      this.sheetTraceability();
    }
    await this.wb.xlsx.writeFile(outputPath);
    return outputPath;
  }

  // ── 1. Run Info ─────────────────────────────────────────────────────────────
  private sheetRunInfo(): void {
    const ws = this.wb.addWorksheet("Run Info", { properties: { tabColor: { argb: "FF1F4E79" } } });
    const title = this.opts.title ?? `${labelForAgent(this.meta.agent)} — DCA Report`;
    ws.getCell("A1").value = title;
    ws.getCell("A1").font = TITLE_FONT;
    ws.getCell("A2").value = `Project: ${this.meta.projectName}`;
    ws.getCell("A2").font = SUBTITLE_FONT;

    const counts = computeCounts(this.findings);
    const rows: [string, string | number][] = [
      ["Agent", this.meta.agent],
      ["Engine", this.meta.engine ?? "—"],
      ["Tech Stack", this.meta.stack ?? this.meta.engine ?? "—"],
      ["Project Name", this.meta.projectName],
      ["Project Root", this.meta.projectRoot],
      ["Source Branch", this.meta.sourceBranch ?? "—"],
      ["Working Branch", this.meta.workingBranch ?? "—"],
      ["Timestamp", this.meta.timestamp ?? "—"],
      ["Total Findings", counts.total],
      ["Critical", counts.bySeverity.CRITICAL],
      ["High", counts.bySeverity.HIGH],
      ["Medium", counts.bySeverity.MEDIUM],
      ["Low", counts.bySeverity.LOW],
      ["Info", counts.bySeverity.INFO],
    ];
    for (const [k, v] of Object.entries(this.meta.toolVersions ?? {})) rows.push([`Tool: ${k}`, v]);
    for (const [k, v] of Object.entries(this.meta.extra ?? {})) rows.push([k, v]);

    let r = 4;
    for (const [label, value] of rows) {
      ws.getCell(r, 1).value = label;
      ws.getCell(r, 1).font = SUMMARY_LABEL_FONT;
      ws.getCell(r, 2).value = value;
      ws.getCell(r, 2).font = SUMMARY_VALUE_FONT;
      r++;
    }
    ws.getColumn(1).width = 24;
    ws.getColumn(2).width = 80;
  }

  // ── 2. Summary (the contract sheet) ─────────────────────────────────────────
  private sheetSummary(): void {
    const ws = this.wb.addWorksheet("Summary", { properties: { tabColor: { argb: "FFC00000" } } });
    const headers = [...SUMMARY_COLUMNS];
    for (let c = 0; c < headers.length; c++) {
      const cell = ws.getCell(1, c + 1);
      cell.value = headers[c];
      cell.font = HEADER_FONT;
      cell.fill = HEADER_FILL;
      cell.alignment = CENTER_ALIGN;
      cell.border = HEADER_BORDER;
    }
    ws.getRow(1).height = 28;
    ws.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

    for (let i = 0; i < this.findings.length; i++) {
      const f = normalizeFinding(this.findings[i], i);
      const r = i + 2;
      ws.getRow(r).height = 30;
      const values: (string | number)[] = [
        f.id,
        f.title,
        clip(f.description, 1000),
        f.stack ?? this.meta.stack ?? "—",
        f.category ?? "—",
        f.codeRef,
        f.severity,
        f.confidence != null ? String(f.confidence) : "—",
        f.ruleId ?? "—",
        clip(f.recommendation, 1000),
        clip(f.impact, 1000),
        f.effort ?? "—",
        f.devComments ?? "",
        f.owner ?? "",
        f.status,
      ];
      for (let c = 0; c < values.length; c++) {
        ws.getCell(r, c + 1).value = values[c];
      }
      ws.getCell(r, 6).font = CODE_FONT; // Code Reference in mono
    }

    const maxRow = this.findings.length + 1;
    colorSeverityCol(ws, 7, maxRow); // Severity column
    applyZebraAndBorders(ws, maxRow, headers.length, 2);
    for (let i = 0; i < SUMMARY_WIDTHS.length; i++) ws.getColumn(i + 1).width = SUMMARY_WIDTHS[i];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  }

  // ── 3. Severity Breakdown ───────────────────────────────────────────────────
  private sheetSeverityBreakdown(): void {
    const ws = this.wb.addWorksheet("Severity Breakdown", { properties: { tabColor: { argb: "FFFF6600" } } });
    const counts = computeCounts(this.findings);
    const headers = ["Severity", "Count", "Percentage"];
    for (let c = 0; c < headers.length; c++) {
      const cell = ws.getCell(1, c + 1);
      cell.value = headers[c];
      cell.font = HEADER_FONT;
      cell.fill = HEADER_FILL;
      cell.border = HEADER_BORDER;
    }
    let r = 2;
    for (const sev of SEVERITIES) {
      const count = counts.bySeverity[sev];
      const pct = counts.total > 0 ? ((count / counts.total) * 100).toFixed(1) + "%" : "0%";
      ws.getCell(r, 1).value = sev;
      ws.getCell(r, 1).fill = severityFill(sev);
      ws.getCell(r, 1).font = severityFont(sev);
      ws.getCell(r, 2).value = count;
      ws.getCell(r, 2).font = BODY_FONT;
      ws.getCell(r, 3).value = pct;
      ws.getCell(r, 3).font = BODY_FONT;
      ws.getRow(r).height = 20;
      r++;
    }
    ws.getCell(r, 1).value = "TOTAL";
    ws.getCell(r, 1).font = HEADER_FONT;
    ws.getCell(r, 1).fill = SECTION_FILL;
    ws.getCell(r, 2).value = counts.total;
    ws.getCell(r, 2).font = HEADER_FONT;
    ws.getColumn(1).width = 16;
    ws.getColumn(2).width = 12;
    ws.getColumn(3).width = 14;
  }

  // ── 4. By Category ──────────────────────────────────────────────────────────
  private sheetByCategory(): void {
    const ws = this.wb.addWorksheet("By Category", { properties: { tabColor: { argb: "FF8064A2" } } });
    const headers = ["Category / Module", "Total", ...SEVERITIES];
    for (let c = 0; c < headers.length; c++) {
      const cell = ws.getCell(1, c + 1);
      cell.value = headers[c];
      cell.font = HEADER_FONT;
      cell.fill = HEADER_FILL;
      cell.alignment = CENTER_ALIGN;
      cell.border = HEADER_BORDER;
    }
    ws.getRow(1).height = 24;

    const grouped = groupByCategory(this.findings);
    const rows = Object.entries(grouped)
      .map(([cat, items]) => ({ cat, items, count: items.length }))
      .sort((a, b) => b.count - a.count);

    let r = 2;
    for (const { cat, items } of rows) {
      ws.getCell(r, 1).value = cat;
      ws.getCell(r, 2).value = items.length;
      for (let si = 0; si < SEVERITIES.length; si++) {
        const sev = SEVERITIES[si];
        const n = items.filter((i) => normalizeSeverity(i.severity) === sev).length;
        const cell = ws.getCell(r, 3 + si);
        cell.value = n || "";
        if (n > 0) cell.font = severityFont(sev);
      }
      r++;
    }
    applyZebraAndBorders(ws, r - 1, headers.length, 2);
    ws.getColumn(1).width = 40;
    ws.getColumn(2).width = 10;
    for (let i = 0; i < SEVERITIES.length; i++) ws.getColumn(3 + i).width = 12;
  }

  // ── 5. Recommendations (optional) ───────────────────────────────────────────
  private sheetRecommendations(recs: RecommendationRow[]): void {
    const ws = this.wb.addWorksheet("Recommendations", { properties: { tabColor: { argb: "FF00B050" } } });
    const headers = ["#", "Area", "Recommendation", "Expected Impact", "Effort", "Priority", "Details"];
    for (let c = 0; c < headers.length; c++) ws.getCell(1, c + 1).value = headers[c];
    styleHeaderRow(ws, headers.length);
    for (let i = 0; i < recs.length; i++) {
      const r = i + 2;
      ws.getCell(r, 1).value = i + 1;
      ws.getCell(r, 2).value = recs[i].area;
      ws.getCell(r, 3).value = recs[i].recommendation;
      ws.getCell(r, 4).value = recs[i].expectedImpact;
      ws.getCell(r, 5).value = recs[i].effort;
      ws.getCell(r, 6).value = recs[i].priority;
      ws.getCell(r, 7).value = recs[i].details;
    }
    applyZebraAndBorders(ws, recs.length + 1, headers.length, 2);
    const widths = [6, 18, 55, 40, 10, 12, 70];
    for (let i = 0; i < widths.length; i++) ws.getColumn(i + 1).width = widths[i];
  }

  // ── 6. Traceability (impact agent — optional) ───────────────────────────────
  private sheetTraceability(): void {
    const ws = this.wb.addWorksheet("Input Traceability", { properties: { tabColor: { argb: "FF0070C0" } } });
    const headers = [
      "Input ID", "Input Type", "Input Title", "Finding ID", "Impacted Title",
      "Code Reference", "Severity", "Impact Analysis", "Recommendation / Fix", "Status",
    ];
    for (let c = 0; c < headers.length; c++) {
      const cell = ws.getCell(1, c + 1);
      cell.value = headers[c];
      cell.font = HEADER_FONT;
      cell.fill = HEADER_FILL;
      cell.alignment = CENTER_ALIGN;
      cell.border = HEADER_BORDER;
    }
    ws.getRow(1).height = 26;
    ws.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

    const traceable = this.findings.filter((f) => f.inputRef);
    let r = 2;
    for (let i = 0; i < traceable.length; i++) {
      const f = normalizeFinding(traceable[i], i);
      const ref = f.inputRef!;
      ws.getRow(r).height = 28;
      ws.getCell(r, 1).value = ref.id ?? "—";
      ws.getCell(r, 2).value = ref.type ?? "—";
      ws.getCell(r, 3).value = clip(ref.title, 200);
      ws.getCell(r, 4).value = f.id;
      ws.getCell(r, 5).value = f.title;
      ws.getCell(r, 6).value = f.codeRef;
      ws.getCell(r, 7).value = f.severity;
      ws.getCell(r, 8).value = clip(f.impact, 600);
      ws.getCell(r, 9).value = clip(f.recommendation, 600);
      ws.getCell(r, 10).value = f.status;
      r++;
    }
    colorSeverityCol(ws, 7, r - 1);
    applyZebraAndBorders(ws, r - 1, headers.length, 2);
    const widths = [14, 12, 40, 14, 40, 42, 12, 50, 50, 14];
    for (let i = 0; i < widths.length; i++) ws.getColumn(i + 1).width = widths[i];
  }
}

function clip(s: string | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function labelForAgent(agent: string): string {
  switch (agent) {
    case "audit": return "Code Audit";
    case "generation": return "Code Generation";
    case "impact": return "Impact Analysis";
    case "test-coverage": return "Test Coverage";
    default: return agent;
  }
}
