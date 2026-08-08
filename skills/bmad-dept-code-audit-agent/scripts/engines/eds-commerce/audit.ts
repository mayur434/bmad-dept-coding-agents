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
import { scanEdsAst } from "../eds/ast-scan";
import { enforceConfidenceOnAll, emitAuditFindingsCache, applyDecisionsFilter, applySLA, maybeFailOnOverdue } from "../../shared/emit-helpers";
import { runDeltaMode } from "../../shared/delta";
import { appendLegacySheets } from "../../shared/legacy-merge";

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

  // AST precision pass (tree-sitter JS) — supersede regex duplicates.
  try {
    const astFindings = await scanEdsAst(projectPath, "eds-commerce");
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
  console.log(`🔍 EDS+Commerce scan: ${total} finding(s)`);

  // Standardized report + CHANGE-LOG — uniform across every DCA audit engine.
  // Rich EDS+Commerce sheets appended AFTER standardized ones in the SAME xlsx.
  let stdFindings = fromLegacyFindingsMap(findings as any, "eds-commerce");
  stdFindings = enforceConfidenceOnAll(stdFindings, "regex");

  const since = argVal("--since");

  // Findings gate — filter against .bmad/decisions.yaml before emit.
  const decisionsExtra: Record<string, string | number> = {};
  const gate = applyDecisionsFilter(stdFindings, projectPath, decisionsExtra);
  stdFindings = gate.kept;
  if (gate.suppressed > 0) {
    console.log(`   🎯 Findings gate: suppressed ${gate.suppressed} finding(s) via .bmad/decisions.yaml`);
  }

  // SLA gate — compute per-finding SLA + build the SLA Status sheet (non-fatal).
  const sla = applySLA({ findings: stdFindings, projectRoot: projectPath, agent: "audit", extra: decisionsExtra });

  const std = await emitStandardOutputs({
    agent: "audit",
    meta: { agent: "audit", engine: "eds-commerce", stack: "EDS + Commerce", projectName, projectRoot: projectPath, extra: decisionsExtra },
    findings: stdFindings,
    outputDir,
    extraSheets: sla.extraSheet ? [sla.extraSheet] : undefined,
    changelogSummary: `EDS+Commerce audit: ${total} finding(s).`,
  });
  console.log(`📊 Standardized report: ${std.xlsxPath}`);
  if (std.changelogPath) console.log(`📝 CHANGE-LOG: ${std.changelogPath}`);

  try {
    const { AuditExcelReport } = await import("../../shared/report-excel");
    const { edsCommerceReportConfig } = await import("./config");
    const stats = {
      totalFiles: 0,
      totalFindings: total,
      categories: Object.keys(findings).length,
      severityCounts: Object.values(findings).flat().reduce<Record<string, number>>((acc, it: any) => {
        acc[it.severity] = (acc[it.severity] || 0) + 1; return acc;
      }, {}),
      scanDuration: 0,
    };
    const rich = new AuditExcelReport(findings, stats, projectName, projectPath, edsCommerceReportConfig);
    await appendLegacySheets(std.xlsxPath, (wb) => rich.populate(wb));
  } catch (e) {
    console.log(`⚠️  Legacy sheet merge skipped: ${(e as Error).message}`);
  }

  // Delta mode — run BEFORE writing the current cache.
  if (since !== undefined) {
    await runDeltaMode({
      projectRoot: projectPath,
      since,
      currentFindings: stdFindings,
      xlsxPath: std.xlsxPath,
    });
  }

  emitAuditFindingsCache({
    projectRoot: projectPath,
    stack: "eds-commerce",
    reportPath: std.xlsxPath,
    findings: stdFindings,
    timestamp: std.meta.timestamp ?? "",
    branch: std.meta.workingBranch,
    meta: {
      role: process.env.DCA_ROLE ?? "",
      roleFlavor: process.env.DCA_ROLE_FLAVOR ?? "",
    },
  });

  // --fail-on-overdue: after emit, exit 6 if any finding is OVERDUE per SLA.
  maybeFailOnOverdue(sla.summary);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}
