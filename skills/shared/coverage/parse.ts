/**
 * DCA Shared — Real coverage-report parsers
 * ==========================================
 * Parses the standard coverage-tool outputs into a normalized model:
 *   - JaCoCo  jacoco.xml            (Java: Maven/Gradle)
 *   - Istanbul coverage-summary.json / coverage-final.json  (JS: Jest / nyc / c8)
 *   - LCOV     lcov.info            (JS)
 *   - Clover   clover.xml           (PHP: PHPUnit --coverage-clover)
 *
 * Machine-generated, regular formats — parsed with targeted regex (no XML dep).
 */

import * as fs from "fs";
import * as path from "path";

export type CoverageTool = "jacoco" | "istanbul" | "lcov" | "clover";

export interface FileCoverage {
  file: string;
  lines: { covered: number; total: number; pct: number };
  branches: { covered: number; total: number; pct: number };
}

export interface CoverageResult {
  tool: CoverageTool;
  reportPath: string;
  files: FileCoverage[];
  overall: { linesPct: number; branchesPct: number; linesCovered: number; linesTotal: number };
}

function pct(covered: number, total: number): number {
  return total > 0 ? Math.round((covered / total) * 1000) / 10 : 100;
}
function finalize(tool: CoverageTool, reportPath: string, files: FileCoverage[]): CoverageResult {
  let lc = 0, lt = 0, bc = 0, bt = 0;
  for (const f of files) { lc += f.lines.covered; lt += f.lines.total; bc += f.branches.covered; bt += f.branches.total; }
  return { tool, reportPath, files, overall: { linesPct: pct(lc, lt), branchesPct: pct(bc, bt), linesCovered: lc, linesTotal: lt } };
}

// ── JaCoCo (jacoco.xml) ───────────────────────────────────────────────────────
export function parseJacoco(xml: string, reportPath = "jacoco.xml"): CoverageResult {
  const files: FileCoverage[] = [];
  const pkgRe = /<package\s+name="([^"]+)">([\s\S]*?)<\/package>/g;
  let pkg: RegExpExecArray | null;
  while ((pkg = pkgRe.exec(xml)) !== null) {
    const pkgName = pkg[1];
    const sfRe = /<sourcefile\s+name="([^"]+)">([\s\S]*?)<\/sourcefile>/g;
    let sf: RegExpExecArray | null;
    while ((sf = sfRe.exec(pkg[2])) !== null) {
      const file = `${pkgName}/${sf[1]}`;
      const line = counter(sf[2], "LINE");
      const br = counter(sf[2], "BRANCH");
      files.push({
        file,
        lines: { covered: line.covered, total: line.covered + line.missed, pct: pct(line.covered, line.covered + line.missed) },
        branches: { covered: br.covered, total: br.covered + br.missed, pct: pct(br.covered, br.covered + br.missed) },
      });
    }
  }
  return finalize("jacoco", reportPath, files);
}
function counter(block: string, type: string): { missed: number; covered: number } {
  const m = new RegExp(`<counter\\s+type="${type}"\\s+missed="(\\d+)"\\s+covered="(\\d+)"`).exec(block);
  return m ? { missed: +m[1], covered: +m[2] } : { missed: 0, covered: 0 };
}

// ── Clover (clover.xml — PHPUnit) ──────────────────────────────────────────────
export function parseClover(xml: string, reportPath = "clover.xml"): CoverageResult {
  const files: FileCoverage[] = [];
  const fileRe = /<file\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/file>/g;
  let f: RegExpExecArray | null;
  while ((f = fileRe.exec(xml)) !== null) {
    const metrics = /<metrics\b([^>]*)\/?>/.exec(f[2]);
    if (!metrics) continue;
    const a = metrics[1];
    const stmts = attr(a, "statements"), cstmts = attr(a, "coveredstatements");
    const conds = attr(a, "conditionals"), cconds = attr(a, "coveredconditionals");
    files.push({
      file: f[1],
      lines: { covered: cstmts, total: stmts, pct: pct(cstmts, stmts) },
      branches: { covered: cconds, total: conds, pct: pct(cconds, conds) },
    });
  }
  return finalize("clover", reportPath, files);
}
function attr(s: string, name: string): number {
  const m = new RegExp(`\\b${name}="(\\d+)"`).exec(s);
  return m ? +m[1] : 0;
}

// ── Istanbul (coverage-summary.json OR coverage-final.json) ────────────────────
export function parseIstanbul(json: string, reportPath = "coverage.json"): CoverageResult {
  const data = JSON.parse(json);
  const files: FileCoverage[] = [];
  // coverage-summary.json: { total:{}, "<file>": { lines:{pct,covered,total}, branches:{...} } }
  const isSummary = data.total && data.total.lines && typeof data.total.lines.pct === "number";
  if (isSummary) {
    for (const [file, v] of Object.entries<any>(data)) {
      if (file === "total") continue;
      files.push({
        file,
        lines: { covered: v.lines.covered ?? 0, total: v.lines.total ?? 0, pct: v.lines.pct ?? 0 },
        branches: { covered: v.branches?.covered ?? 0, total: v.branches?.total ?? 0, pct: v.branches?.pct ?? 100 },
      });
    }
    return finalize("istanbul", reportPath, files);
  }
  // coverage-final.json: { "<file>": { statementMap, s, branchMap, b } }
  for (const [file, v] of Object.entries<any>(data)) {
    if (!v || !v.s) continue;
    const sVals = Object.values<number>(v.s);
    const linesTotal = sVals.length, linesCov = sVals.filter((n) => n > 0).length;
    const bVals = Object.values<number[]>(v.b || {}).flat();
    const brTotal = bVals.length, brCov = bVals.filter((n) => n > 0).length;
    files.push({
      file: v.path || file,
      lines: { covered: linesCov, total: linesTotal, pct: pct(linesCov, linesTotal) },
      branches: { covered: brCov, total: brTotal, pct: pct(brCov, brTotal) },
    });
  }
  return finalize("istanbul", reportPath, files);
}

// ── LCOV (lcov.info) ───────────────────────────────────────────────────────────
export function parseLcov(text: string, reportPath = "lcov.info"): CoverageResult {
  const files: FileCoverage[] = [];
  let cur: { file: string; lf: number; lh: number; brf: number; brh: number } | null = null;
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (l.startsWith("SF:")) cur = { file: l.slice(3), lf: 0, lh: 0, brf: 0, brh: 0 };
    else if (!cur) continue;
    else if (l.startsWith("LF:")) cur.lf = +l.slice(3);
    else if (l.startsWith("LH:")) cur.lh = +l.slice(3);
    else if (l.startsWith("BRF:")) cur.brf = +l.slice(4);
    else if (l.startsWith("BRH:")) cur.brh = +l.slice(4);
    else if (l === "end_of_record") {
      files.push({
        file: cur.file,
        lines: { covered: cur.lh, total: cur.lf, pct: pct(cur.lh, cur.lf) },
        branches: { covered: cur.brh, total: cur.brf, pct: pct(cur.brh, cur.brf) },
      });
      cur = null;
    }
  }
  return finalize("lcov", reportPath, files);
}

/** Dispatch by content/extension. */
export function parseReport(reportPath: string): CoverageResult | null {
  let content: string;
  try { content = fs.readFileSync(reportPath, "utf8"); } catch { return null; }
  const base = path.basename(reportPath).toLowerCase();
  try {
    if (base.endsWith(".json")) return parseIstanbul(content, reportPath);
    if (base === "lcov.info" || base.endsWith(".lcov")) return parseLcov(content, reportPath);
    if (content.includes("<coverage") && content.includes("clover")) return parseClover(content, reportPath);
    if (content.includes("<report") && content.includes("jacoco") || content.includes("<sourcefile")) return parseJacoco(content, reportPath);
    if (content.includes("<coverage")) return parseClover(content, reportPath);
    return null;
  } catch {
    return null;
  }
}
