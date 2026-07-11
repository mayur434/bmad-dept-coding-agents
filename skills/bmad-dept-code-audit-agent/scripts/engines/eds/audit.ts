/**
 * Edge Delivery Services — Audit Engine
 * =======================================
 * Implements the AuditEngine interface for EDS (Franklin) projects.
 * Uses the shared report generators (Excel + Markdown) with EDS-specific config.
 */

import * as fs from "fs";
import * as path from "path";
import { BaseAuditEngine, FindingsMap } from "../../shared/base";
import { AuditExcelReport, ReportStats } from "../../shared/report-excel";
import { AuditMarkdownReport } from "../../shared/report-markdown";
import { edsReportConfig } from "./config";
import { EdsAuditScanner } from "./lib/scanner/index";
import { emitStandardOutputs } from "../../../../shared/output";
import { fromLegacyFindingsMap } from "../../../../shared/core/types";
import { scanEdsAst } from "./ast-scan";

export class EdsAuditEngine extends BaseAuditEngine {
  readonly PLATFORM_ID = "eds";
  readonly PLATFORM_NAME = "Edge Delivery Services";

  detect(projectPath: string): boolean {
    const indicators = [
      fs.existsSync(path.join(projectPath, "blocks")),
      fs.existsSync(path.join(projectPath, "scripts")),
      fs.existsSync(path.join(projectPath, "fstab.yaml")),
      fs.existsSync(path.join(projectPath, "helix-query.yaml")),
      fs.existsSync(path.join(projectPath, "paths.json")),
    ];
    return indicators.filter(Boolean).length >= 2;
  }

  scan(): FindingsMap {
    const scanner = new EdsAuditScanner({ root: this.projectRoot });
    return scanner.scan();
  }

  async generateReport(findings: FindingsMap, outputPath: string): Promise<void> {
    const stats = this.computeStats(findings);
    const projectName = path.basename(this.projectRoot);

    // Generate Excel report
    const excelReport = new AuditExcelReport(findings, stats, projectName, this.projectRoot, edsReportConfig);
    const xlsxPath = await excelReport.generate(outputPath);
    console.log(`[${this.PLATFORM_ID}] Excel report: ${xlsxPath}`);

    // Generate Markdown report
    const mdReport = new AuditMarkdownReport(findings, stats, projectName, this.projectRoot, edsReportConfig);
    const mdPath = mdReport.generate(outputPath);
    console.log(`[${this.PLATFORM_ID}] Markdown report: ${mdPath}`);
  }

  private computeStats(findings: FindingsMap): ReportStats {
    let totalFindings = 0;
    const severityCounts: Record<string, number> = {};
    for (const items of Object.values(findings)) {
      totalFindings += items.length;
      for (const item of items) {
        severityCounts[item.severity] = (severityCounts[item.severity] || 0) + 1;
      }
    }
    return {
      totalFiles: 0,
      totalFindings,
      categories: Object.keys(findings).length,
      severityCounts,
      scanDuration: 0,
    };
  }
}

function argVal(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

export async function main(): Promise<void> {
  const projectPath = path.resolve(argVal("--path") ?? ".");
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    console.error(`❌ Project path does not exist: ${projectPath}`);
    process.exit(1);
  }
  const projectName = argVal("--name") ?? path.basename(projectPath);
  const outputDir = argVal("--output") ?? path.join(projectPath, "audit-reports");
  fs.mkdirSync(outputDir, { recursive: true });

  const engine = new EdsAuditEngine(projectPath);
  const findings = engine.scan();

  // AST precision pass (tree-sitter JS) — supersede regex duplicates.
  try {
    const astFindings = await scanEdsAst(projectPath);
    let added = 0, superseded = 0;
    for (const af of astFindings) {
      const cat = af.category || "Security";
      for (const [c, items] of Object.entries(findings)) {
        const arr = items as any[];
        const idx = arr.findIndex((it) => it.file === af.file && it.line === af.line && /secur|xss|inject|eval|secret|command|credential/i.test(it.type + " " + c));
        if (idx >= 0) { arr.splice(idx, 1); superseded++; }
      }
      ((findings as any)[cat] ||= []).push({
        module: "AST", file: af.file || "", line: af.line || 0, type: af.title,
        description: af.description || "", code: af.code || "", severity: af.severity,
        recommendation: af.recommendation || "", effort: af.effort || "M", impact: af.impact || "",
        confidence: "AST-verified", ruleId: af.ruleId, justification: `tree-sitter AST match (${af.ruleId})`,
      } as any);
      added++;
    }
    console.log(`🌳 AST precision pass: +${added} finding(s) (${superseded} regex duplicate(s) superseded)`);
  } catch (e: any) {
    console.log(`⚠️  AST pass skipped: ${e.message}`);
  }

  const total = Object.values(findings).reduce((n, a) => n + a.length, 0);
  console.log(`🔍 EDS scan: ${total} finding(s)`);

  // Legacy platform report (EDS-specific sheets) — non-fatal.
  try {
    await engine.generateReport(findings, outputDir);
  } catch (e) {
    console.log(`⚠️  Legacy report skipped: ${(e as Error).message}`);
  }

  // Standardized report + CHANGE-LOG — uniform across every DCA audit engine.
  const std = await emitStandardOutputs({
    agent: "audit",
    meta: { agent: "audit", engine: "eds", stack: "Edge Delivery Services", projectName, projectRoot: projectPath },
    findings: fromLegacyFindingsMap(findings as any, "eds"),
    outputDir,
    changelogSummary: `EDS audit: ${total} finding(s).`,
  });
  console.log(`📊 Standardized report: ${std.xlsxPath}`);
  if (std.changelogPath) console.log(`📝 CHANGE-LOG: ${std.changelogPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}
