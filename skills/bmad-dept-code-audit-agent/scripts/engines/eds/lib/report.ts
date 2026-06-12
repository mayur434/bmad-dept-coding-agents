/**
 * EDS Audit Report Generator — creates a styled Excel workbook with enterprise formatting.
 */
import ExcelJS from 'exceljs';
import * as path from 'path';
import { AuditResult, CategoryResult, Finding, PageSpeedSummary, FileScoreSummary } from './types';
import {
  TITLE_FONT, BODY_FONT, CODE_FONT, SCORE_FONT,
  styleHeaderRow, applyZebraAndBorders, colorSeverityCol,
  HEADER_FILL, HEADER_FONT, CENTER_ALIGN, WRAP_ALIGN,
  THIN_BORDER, HEADER_BORDER, severityFill, severityFont,
} from './styles';

export async function generateReport(result: AuditResult, outputPath: string): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BMAD EDS Audit Engine';
  wb.created = new Date();

  // Summary sheet first
  addSummarySheet(wb, result);

  // PageSpeed Scores sheet (if available)
  if (result.pageSpeedResults && result.pageSpeedResults.length > 0) {
    addPageSpeedSheet(wb, result.pageSpeedResults);
  }

  // Low Score Files sheet (if available)
  if (result.lowScoreFiles && result.lowScoreFiles.length > 0) {
    addLowScoreFilesSheet(wb, result.lowScoreFiles);
  }

  // Category sheets
  for (const cat of result.categories) {
    addCategorySheet(wb, cat);
  }

  const filePath = path.resolve(outputPath);
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

function addSummarySheet(wb: ExcelJS.Workbook, result: AuditResult): void {
  const ws = wb.addWorksheet('Summary');

  // ─── Style constants ─────────────────────────────────────────────────
  const NAVY: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  const LIGHT_BLUE: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
  const WHITE: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  const SECTION_FONT: Partial<ExcelJS.Font> = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF1F4E79' } };
  const LABEL_FONT: Partial<ExcelJS.Font> = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF333333' } };
  const VALUE_FONT: Partial<ExcelJS.Font> = { name: 'Calibri', size: 10, color: { argb: 'FF333333' } };

  const SEV_COLORS: Record<string, string> = {
    CRITICAL: 'FFFF0000', HIGH: 'FFFF6600', MEDIUM: 'FFFFCC00', LOW: 'FF92D050', INFO: 'FF4472C4',
  };
  const SEV_DESC: Record<string, string> = {
    CRITICAL: 'Must fix immediately — security, data loss, production failures',
    HIGH: 'Fix within 2 weeks — performance, reliability, architecture',
    MEDIUM: 'Fix within 1 month — best practices, maintainability, deprecations',
    LOW: 'Backlog — code style, conventions, minor optimizations',
  };

  // ─── TITLE ───────────────────────────────────────────────────────────
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${result.projectName} — EDS CODE AUDIT REPORT`;
  titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: 'FF1F4E79' } };
  titleCell.border = { bottom: { style: 'medium', color: { argb: 'FF1F4E79' } } };
  ws.getRow(1).height = 32;

  // ─── METADATA TABLE ──────────────────────────────────────────────────
  const meta: [string, string][] = [
    ['Generated:', result.timestamp],
    ['Project Root:', result.source],
    ['Tool:', 'EDS Code Audit Engine v1.0 — Enterprise'],
    ['Total Findings:', String(result.totalFindings)],
  ];
  let r = 3;
  for (const [label, value] of meta) {
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = LABEL_FONT;
    ws.getCell(r, 1).fill = LIGHT_BLUE;
    ws.getCell(r, 1).border = THIN_BORDER;
    ws.mergeCells(r, 2, r, 4);
    ws.getCell(r, 2).value = value;
    ws.getCell(r, 2).font = VALUE_FONT;
    ws.getCell(r, 2).fill = LIGHT_BLUE;
    ws.getCell(r, 2).border = THIN_BORDER;
    r++;
  }

  // ─── SEVERITY BREAKDOWN ──────────────────────────────────────────────
  r += 2;
  ws.getCell(r, 1).value = 'SEVERITY BREAKDOWN';
  ws.getCell(r, 1).font = SECTION_FONT;
  r += 1;

  // Header row
  const sevHeaders = ['Severity', 'Count', 'Description'];
  for (let c = 0; c < sevHeaders.length; c++) {
    const cell = ws.getCell(r, c + 1);
    cell.value = sevHeaders[c];
    cell.font = LABEL_FONT;
    cell.fill = LIGHT_BLUE;
    cell.border = THIN_BORDER;
    cell.alignment = CENTER_ALIGN;
  }
  r++;

  const sevData: { key: string; count: number }[] = [
    { key: 'CRITICAL', count: result.severityBreakdown.CRITICAL },
    { key: 'HIGH', count: result.severityBreakdown.HIGH },
    { key: 'MEDIUM', count: result.severityBreakdown.MEDIUM },
    { key: 'LOW', count: result.severityBreakdown.LOW },
  ];

  for (const sev of sevData) {
    const sevCell = ws.getCell(r, 1);
    sevCell.value = sev.key;
    sevCell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: sev.key === 'MEDIUM' || sev.key === 'LOW' ? 'FF000000' : 'FFFFFFFF' } };
    sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEV_COLORS[sev.key] } };
    sevCell.alignment = CENTER_ALIGN;
    sevCell.border = THIN_BORDER;

    ws.getCell(r, 2).value = sev.count;
    ws.getCell(r, 2).font = { name: 'Calibri', bold: true, size: 11 };
    ws.getCell(r, 2).alignment = CENTER_ALIGN;
    ws.getCell(r, 2).border = THIN_BORDER;

    ws.mergeCells(r, 3, r, 7);
    ws.getCell(r, 3).value = SEV_DESC[sev.key];
    ws.getCell(r, 3).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF555555' } };
    ws.getCell(r, 3).border = THIN_BORDER;
    r++;
  }

  // ─── CATEGORY BREAKDOWN ──────────────────────────────────────────────
  r += 2;
  ws.getCell(r, 1).value = 'CATEGORY BREAKDOWN';
  ws.getCell(r, 1).font = SECTION_FONT;
  r += 1;

  const catHeaders = ['Category', 'Total', 'Critical', '', 'High', 'Medium', 'Low'];
  for (let c = 0; c < catHeaders.length; c++) {
    const cell = ws.getCell(r, c + 1);
    cell.value = catHeaders[c];
    cell.font = LABEL_FONT;
    cell.fill = LIGHT_BLUE;
    cell.border = THIN_BORDER;
    cell.alignment = CENTER_ALIGN;
  }
  r++;

  const maxCritical = Math.max(...result.categories.map((c) =>
    c.findings.filter((f) => f.severity === 'CRITICAL').length), 1);
  const maxTotal = Math.max(...result.categories.map((c) => c.findings.length), 1);

  const catStartRow = r;
  for (const cat of result.categories) {
    const critCount = cat.findings.filter((f) => f.severity === 'CRITICAL').length;
    const highCount = cat.findings.filter((f) => f.severity === 'HIGH').length;
    const medCount = cat.findings.filter((f) => f.severity === 'MEDIUM').length;
    const lowCount = cat.findings.filter((f) => f.severity === 'LOW').length;
    const total = cat.findings.length;

    // Zebra fill for this row
    const isOdd = (r - catStartRow) % 2 === 1;
    const rowFill: ExcelJS.Fill = isOdd
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F7FB' } }
      : WHITE;

    // Category name
    ws.getCell(r, 1).value = cat.category;
    ws.getCell(r, 1).font = BODY_FONT;
    ws.getCell(r, 1).border = THIN_BORDER;
    ws.getCell(r, 1).fill = rowFill;

    // Total
    ws.getCell(r, 2).value = total;
    ws.getCell(r, 2).alignment = CENTER_ALIGN;
    ws.getCell(r, 2).border = THIN_BORDER;
    ws.getCell(r, 2).fill = rowFill;

    // Critical count — red fill proportional to severity
    ws.getCell(r, 3).value = critCount;
    ws.getCell(r, 3).alignment = CENTER_ALIGN;
    ws.getCell(r, 3).border = THIN_BORDER;
    if (critCount > 0) {
      ws.getCell(r, 3).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      ws.getCell(r, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    } else {
      ws.getCell(r, 3).value = 0;
      ws.getCell(r, 3).fill = rowFill;
    }

    // Bar chart column — proportional red bar
    const barCell = ws.getCell(r, 4);
    barCell.border = THIN_BORDER;
    if (critCount > 0) {
      barCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      barCell.value = '';
    } else {
      barCell.fill = rowFill;
      barCell.value = '';
    }

    // High — orange
    const highCell = ws.getCell(r, 5);
    highCell.value = highCount;
    highCell.alignment = CENTER_ALIGN;
    highCell.border = THIN_BORDER;
    if (highCount > 0) {
      highCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6600' } };
      highCell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    } else {
      highCell.fill = rowFill;
    }

    // Medium — yellow
    const medCell = ws.getCell(r, 6);
    medCell.value = medCount;
    medCell.alignment = CENTER_ALIGN;
    medCell.border = THIN_BORDER;
    if (medCount > 0) {
      medCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
      medCell.font = { name: 'Calibri', bold: true, size: 10 };
    } else {
      medCell.fill = rowFill;
    }

    // Low — green
    const lowCell = ws.getCell(r, 7);
    lowCell.value = lowCount;
    lowCell.alignment = CENTER_ALIGN;
    lowCell.border = THIN_BORDER;
    if (lowCount > 0) {
      lowCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
      lowCell.font = { name: 'Calibri', bold: true, size: 10 };
    } else {
      lowCell.fill = rowFill;
    }

    r++;
  }

  // ─── TOP RISK FILES ──────────────────────────────────────────────────
  r += 2;
  ws.getCell(r, 1).value = 'TOP RISK FILES';
  ws.getCell(r, 1).font = SECTION_FONT;
  r += 1;

  const riskHeaders = ['File / Block', 'Total', 'Critical', 'Risk'];
  for (let c = 0; c < riskHeaders.length; c++) {
    const cell = ws.getCell(r, c + 1);
    cell.value = riskHeaders[c];
    cell.font = LABEL_FONT;
    cell.fill = LIGHT_BLUE;
    cell.border = THIN_BORDER;
    cell.alignment = CENTER_ALIGN;
  }
  r++;

  // Aggregate findings per file
  const fileMap = new Map<string, { total: number; critical: number }>();
  for (const cat of result.categories) {
    for (const f of cat.findings) {
      if (!f.file) continue;
      const existing = fileMap.get(f.file) || { total: 0, critical: 0 };
      existing.total++;
      if (f.severity === 'CRITICAL') existing.critical++;
      fileMap.set(f.file, existing);
    }
  }

  const topFiles = [...fileMap.entries()]
    .sort((a, b) => b[1].critical - a[1].critical || b[1].total - a[1].total)
    .slice(0, 5);

  for (const [filePath, counts] of topFiles) {
    ws.getCell(r, 1).value = filePath;
    ws.getCell(r, 1).font = BODY_FONT;
    ws.getCell(r, 1).border = THIN_BORDER;

    ws.getCell(r, 2).value = counts.total;
    ws.getCell(r, 2).alignment = CENTER_ALIGN;
    ws.getCell(r, 2).border = THIN_BORDER;

    ws.getCell(r, 3).value = counts.critical;
    ws.getCell(r, 3).alignment = CENTER_ALIGN;
    ws.getCell(r, 3).border = THIN_BORDER;
    if (counts.critical > 0) {
      ws.getCell(r, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      ws.getCell(r, 3).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    }

    const riskLevel = counts.critical >= 5 ? 'Critical' : counts.critical >= 2 ? 'High' : counts.total >= 10 ? 'Medium' : 'Low';
    const riskCell = ws.getCell(r, 4);
    riskCell.value = riskLevel;
    riskCell.alignment = CENTER_ALIGN;
    riskCell.border = THIN_BORDER;
    const riskColor = riskLevel === 'Critical' ? 'FFFF0000' : riskLevel === 'High' ? 'FFFF6600' : riskLevel === 'Medium' ? 'FFCC9900' : 'FF333333';
    riskCell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: riskColor } };
    r++;
  }

  // ─── OVERALL SCORE ───────────────────────────────────────────────────
  r += 2;
  ws.mergeCells(r, 1, r, 2);
  ws.getCell(r, 1).value = 'OVERALL HEALTH SCORE';
  ws.getCell(r, 1).font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  const scoreColor = result.overallScore >= 90 ? 'FF006600' : result.overallScore >= 70 ? 'FFCC6600' : 'FFCC0000';
  ws.getCell(r, 3).value = `${result.overallScore} / 100`;
  ws.getCell(r, 3).font = { name: 'Calibri', bold: true, size: 18, color: { argb: scoreColor } };
  ws.getRow(r).height = 28;

  r++;
  const grade = result.overallScore >= 90 ? 'A — Production Ready'
    : result.overallScore >= 80 ? 'B — Good'
    : result.overallScore >= 70 ? 'C — Acceptable'
    : result.overallScore >= 60 ? 'D — Below Standard'
    : 'F — Critical Issues';
  ws.getCell(r, 3).value = `Grade: ${grade}`;
  ws.getCell(r, 3).font = { name: 'Calibri', bold: true, size: 11, color: { argb: scoreColor } };

  // ─── TOKENS USED (Audit Processing Metrics) ─────────────────────────
  if (result.metrics) {
    r += 2;
    ws.mergeCells(r, 1, r, 2);
    ws.getCell(r, 1).value = 'TOKENS USED';
    ws.getCell(r, 1).font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF1F4E79' } };
    ws.getRow(r).height = 24;

    r++;
    ws.getCell(r, 1).value = 'Files Scanned';
    ws.getCell(r, 1).font = BODY_FONT;
    ws.getCell(r, 2).value = result.filesScanned.toLocaleString();
    ws.getCell(r, 2).font = { ...BODY_FONT, bold: true };

    r++;
    ws.getCell(r, 1).value = 'Lines of Code';
    ws.getCell(r, 1).font = BODY_FONT;
    ws.getCell(r, 2).value = result.metrics.totalLinesOfCode.toLocaleString();
    ws.getCell(r, 2).font = { ...BODY_FONT, bold: true };

    r++;
    ws.getCell(r, 1).value = 'Rule Checks Performed';
    ws.getCell(r, 1).font = BODY_FONT;
    ws.getCell(r, 2).value = result.metrics.totalRuleChecks.toLocaleString();
    ws.getCell(r, 2).font = { ...BODY_FONT, bold: true };

    r++;
    ws.getCell(r, 1).value = 'Audit Duration';
    ws.getCell(r, 1).font = BODY_FONT;
    const durationSec = (result.metrics.auditDurationMs / 1000).toFixed(1);
    ws.getCell(r, 2).value = `${durationSec}s`;
    ws.getCell(r, 2).font = { ...BODY_FONT, bold: true };
  }

  // ─── Column widths ───────────────────────────────────────────────────
  ws.columns = [
    { width: 28 }, { width: 12 }, { width: 12 }, { width: 18 },
    { width: 10 }, { width: 10 }, { width: 10 },
  ];
}

function addCategorySheet(wb: ExcelJS.Workbook, cat: CategoryResult): void {
  // Truncate sheet name to 31 chars (Excel limit)
  const sheetName = cat.category.substring(0, 31);
  const ws = wb.addWorksheet(sheetName);

  // --- Row 1: Title banner with total findings + severity breakdown ---
  const sev = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of cat.findings) {
    if (f.severity in sev) sev[f.severity as keyof typeof sev]++;
  }
  const total = cat.findings.length;
  const bannerText = `${cat.category}  —  ${total} findings  |  ${sev.CRITICAL} Critical  |  ${sev.HIGH} High  |  ${sev.MEDIUM} Medium  |  ${sev.LOW} Low`;

  const headers = ['#', 'Rule ID', 'Severity', 'File', 'Line #', 'Issue Type', 'Description', 'Code Evidence', 'Recommendation', 'Score'];

  ws.mergeCells(1, 1, 1, headers.length);
  const bannerCell = ws.getCell(1, 1);
  bannerCell.value = bannerText;
  bannerCell.font = { name: 'Calibri', bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC0000' } };
  bannerCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 28;

  // --- Row 2: Column headers ---
  headers.forEach((h, idx) => {
    const cell = ws.getCell(2, idx + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = CENTER_ALIGN;
    cell.border = HEADER_BORDER;
  });
  ws.getRow(2).height = 20;

  // --- Row 3+: Data rows ---
  let row = 3;
  let seq = 1;
  for (const finding of cat.findings) {
    ws.getCell(row, 1).value = seq++;
    ws.getCell(row, 2).value = finding.rule;
    ws.getCell(row, 3).value = finding.severity;
    ws.getCell(row, 4).value = finding.file || '';
    ws.getCell(row, 5).value = finding.line || '';
    ws.getCell(row, 6).value = finding.category || cat.category;
    ws.getCell(row, 7).value = finding.description;
    ws.getCell(row, 7).alignment = WRAP_ALIGN;
    ws.getCell(row, 8).value = finding.code || '';
    ws.getCell(row, 8).font = CODE_FONT;
    ws.getCell(row, 8).alignment = WRAP_ALIGN;
    ws.getCell(row, 9).value = finding.recommendation;
    ws.getCell(row, 9).alignment = WRAP_ALIGN;
    ws.getCell(row, 10).value = finding.score;
    row++;
  }

  // If no findings, add a "pass" row
  if (cat.findings.length === 0) {
    ws.getCell(3, 1).value = '—';
    ws.getCell(3, 7).value = 'All checks passed. No issues found.';
    ws.getCell(3, 7).font = { name: 'Calibri', size: 10, color: { argb: 'FF006600' } };
    row = 4;
  }

  colorSeverityCol(ws, 3, row - 1, 3);
  applyZebraAndBorders(ws, row - 1, headers.length, 3);

  // Column widths
  ws.columns = [
    { width: 6 }, { width: 14 }, { width: 10 }, { width: 32 }, { width: 8 },
    { width: 22 }, { width: 45 }, { width: 40 }, { width: 50 }, { width: 6 },
  ];
}

function addPageSpeedSheet(wb: ExcelJS.Workbook, results: PageSpeedSummary[]): void {
  const ws = wb.addWorksheet('PageSpeed Scores');

  // Title
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'PageSpeed Insights — Per-Page Scores';
  titleCell.font = { name: 'Calibri', bold: true, size: 14 };
  ws.getRow(1).height = 25;

  const headers = ['Page URL', 'Strategy', 'Score', 'LCP (s)', 'CLS', 'INP (ms)', 'FCP (s)', 'TTFB (ms)', 'TBT (ms)', 'Top Opportunity', 'Status'];
  const headerRow = 3;
  headers.forEach((h, idx) => {
    const cell = ws.getCell(headerRow, idx + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = CENTER_ALIGN;
    cell.border = HEADER_BORDER;
  });

  let row = headerRow + 1;
  for (const r of results) {
    ws.getCell(row, 1).value = r.url;
    ws.getCell(row, 2).value = r.strategy;
    ws.getCell(row, 3).value = r.score;
    ws.getCell(row, 4).value = (r.lcp / 1000).toFixed(1);
    ws.getCell(row, 5).value = r.cls.toFixed(3);
    ws.getCell(row, 6).value = r.inp;
    ws.getCell(row, 7).value = (r.fcp / 1000).toFixed(1);
    ws.getCell(row, 8).value = r.ttfb;
    ws.getCell(row, 9).value = r.tbt;
    ws.getCell(row, 10).value = r.topOpportunity;
    ws.getCell(row, 11).value = r.status;

    // Color-code the score cell
    const scoreCell = ws.getCell(row, 3);
    if (r.score >= 90) {
      scoreCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF006600' } };
    } else if (r.score >= 50) {
      scoreCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFCC6600' } };
    } else {
      scoreCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFCC0000' } };
    }

    // Color-code the status cell
    const statusCell = ws.getCell(row, 11);
    if (r.status === 'PASS') {
      statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF006600' } };
    } else if (r.status === 'NEEDS_WORK') {
      statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFCC6600' } };
    } else {
      statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFCC0000' } };
    }

    row++;
  }

  applyZebraAndBorders(ws, row - 1, headers.length);

  // Thresholds reference
  row += 2;
  ws.getCell(row, 1).value = 'Core Web Vitals Thresholds:';
  ws.getCell(row, 1).font = { name: 'Calibri', bold: true, size: 10 };
  row++;
  ws.getCell(row, 1).value = '  LCP < 2.5s | CLS < 0.1 | INP < 200ms | FCP < 1.8s | TTFB < 800ms | TBT < 200ms';
  ws.getCell(row, 1).font = { name: 'Consolas', size: 9 };

  ws.columns = [
    { width: 45 }, { width: 10 }, { width: 7 }, { width: 8 },
    { width: 7 }, { width: 9 }, { width: 8 }, { width: 10 },
    { width: 9 }, { width: 35 }, { width: 12 },
  ];
}

function addLowScoreFilesSheet(wb: ExcelJS.Workbook, files: FileScoreSummary[]): void {
  const ws = wb.addWorksheet('Low Score Files');

  // Title
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Files Scoring Below 90 — Priority Fix List';
  titleCell.font = { name: 'Calibri', bold: true, size: 14 };
  ws.getRow(1).height = 25;

  const headers = ['File', 'Score', 'Critical', 'High', 'Medium', 'Low', 'Top Issue', 'Recommendation'];
  const headerRow = 3;
  headers.forEach((h, idx) => {
    const cell = ws.getCell(headerRow, idx + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = CENTER_ALIGN;
    cell.border = HEADER_BORDER;
  });

  let row = headerRow + 1;
  for (const f of files) {
    ws.getCell(row, 1).value = f.file;
    ws.getCell(row, 2).value = f.score;
    ws.getCell(row, 3).value = f.critical;
    ws.getCell(row, 4).value = f.high;
    ws.getCell(row, 5).value = f.medium;
    ws.getCell(row, 6).value = f.low;
    ws.getCell(row, 7).value = f.topIssue;
    ws.getCell(row, 7).alignment = WRAP_ALIGN;
    ws.getCell(row, 8).value = f.recommendation;
    ws.getCell(row, 8).alignment = WRAP_ALIGN;

    // Color-code score
    const scoreCell = ws.getCell(row, 2);
    if (f.score < 50) {
      scoreCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFCC0000' } };
    } else if (f.score < 75) {
      scoreCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFCC6600' } };
    } else {
      scoreCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF996600' } };
    }

    row++;
  }

  applyZebraAndBorders(ws, row - 1, headers.length);

  ws.columns = [
    { width: 38 }, { width: 7 }, { width: 8 }, { width: 6 },
    { width: 8 }, { width: 5 }, { width: 50 }, { width: 55 },
  ];
}
