/**
 * EDS + Commerce Hybrid — Audit Engine
 * ======================================
 * Implements the AuditEngine interface for EDS projects with Commerce integration.
 * Uses the shared report generators (Excel + Markdown) with EDS-Commerce config.
 */

import * as fs from "fs";
import * as path from "path";
import { BaseAuditEngine, FindingsMap } from "../../shared/base";
import { AuditExcelReport, ReportStats } from "../../shared/report-excel";
import { AuditMarkdownReport } from "../../shared/report-markdown";
import { edsCommerceReportConfig } from "./config";
import { EdsCommerceAuditScanner } from "./lib/scanner/index";
import { emitStandardOutputs } from "../../../../shared/output";
import { fromLegacyFindingsMap } from "../../../../shared/core/types";

export class EdsCommerceAuditEngine extends BaseAuditEngine {
  readonly PLATFORM_ID = "eds-commerce";
  readonly PLATFORM_NAME = "Edge Delivery Services + Commerce";

  detect(projectPath: string): boolean {
    // Must be EDS first
    const edsIndicators = [
      fs.existsSync(path.join(projectPath, "blocks")),
      fs.existsSync(path.join(projectPath, "scripts")),
      fs.existsSync(path.join(projectPath, "fstab.yaml")),
      fs.existsSync(path.join(projectPath, "helix-query.yaml")),
      fs.existsSync(path.join(projectPath, "paths.json")),
    ];
    if (edsIndicators.filter(Boolean).length < 2) return false;

    // Check for Commerce-specific blocks/patterns
    const blocksDir = path.join(projectPath, "blocks");
    if (fs.existsSync(blocksDir)) {
      const items = fs.readdirSync(blocksDir);
      for (const item of items) {
        if (item.startsWith("commerce-") || item.startsWith("product-")) {
          return true;
        }
      }
    }
    return false;
  }

  scan(): FindingsMap {
    const scanner = new EdsCommerceAuditScanner({ root: this.projectRoot });
    return scanner.scan();
  }

  async generateReport(findings: FindingsMap, outputPath: string): Promise<void> {
    const stats = this.computeStats(findings);
    const projectName = path.basename(this.projectRoot);

    // Generate Excel report
    const excelReport = new AuditExcelReport(findings, stats, projectName, this.projectRoot, edsCommerceReportConfig);
    const xlsxPath = await excelReport.generate(outputPath);
    console.log(`[${this.PLATFORM_ID}] Excel report: ${xlsxPath}`);

    // Generate Markdown report
    const mdReport = new AuditMarkdownReport(findings, stats, projectName, this.projectRoot, edsCommerceReportConfig);
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

  const engine = new EdsCommerceAuditEngine(projectPath);
  const findings = engine.scan();
  const total = Object.values(findings).reduce((n, a) => n + a.length, 0);
  console.log(`🔍 EDS+Commerce scan: ${total} finding(s)`);

  // Legacy platform report (EDS-Commerce-specific sheets) — non-fatal.
  try {
    await engine.generateReport(findings, outputDir);
  } catch (e) {
    console.log(`⚠️  Legacy report skipped: ${(e as Error).message}`);
  }

  // Standardized report + CHANGE-LOG — uniform across every DCA audit engine.
  const std = await emitStandardOutputs({
    agent: "audit",
    meta: { agent: "audit", engine: "eds-commerce", stack: "EDS + Commerce", projectName, projectRoot: projectPath },
    findings: fromLegacyFindingsMap(findings as any, "eds-commerce"),
    outputDir,
    changelogSummary: `EDS+Commerce audit: ${total} finding(s).`,
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
