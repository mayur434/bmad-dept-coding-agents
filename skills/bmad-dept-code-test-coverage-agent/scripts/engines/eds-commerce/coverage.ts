/**
 * EDS + Commerce — Test Coverage Engine
 * ========================================
 * Extends EDS coverage with Commerce-specific gap analysis (dropin, GraphQL, cart flows).
 */
import * as path from "path";
import fg from "fast-glob";
import * as fs from "fs";
import { BaseEngine, CoverageOptions, CoverageReport, CoverageGap } from "../../shared/base";
import { EdsEngine } from "../eds/coverage";

export class EdsCommerceEngine extends BaseEngine {
  readonly name = "EDS + Commerce Hybrid";
  readonly id = "eds-commerce";

  private edsEngine = new EdsEngine();

  async analyzeCoverage(projectPath: string, options: CoverageOptions): Promise<CoverageReport> {
    const baseReport = await this.edsEngine.analyzeCoverage(projectPath, options);
    const additionalGaps: CoverageGap[] = [];

    // Find commerce-specific blocks that need extra testing
    const commerceBlocks = fg.sync(path.join(projectPath, "blocks/{commerce-*,product-*,cart-*,checkout-*}/**/*.js").replace(/\\/g, "/"));

    for (const fp of commerceBlocks) {
      const content = this.read(fp);
      const rel = path.relative(projectPath, fp);
      const fileName = path.basename(fp, ".js");

      // Check if already in base gaps
      if (baseReport.gaps.some((g) => g.file === rel)) continue;

      if (content.includes("@dropins/storefront") || content.includes("fetch")) {
        additionalGaps.push({
          file: rel,
          className: null,
          method: null,
          complexity: this.estimateComplexity(content),
          priority: "critical",
          reason: "Commerce dropin block — test API integration, error states, and cart mutations",
          framework: "unit",
        });
      }
    }

    return {
      ...baseReport,
      engine: this.id,
      gaps: [...additionalGaps, ...baseReport.gaps].slice(0, 100),
      frameworkBreakdown: baseReport.frameworkBreakdown,
    };
  }

  async generateTests(projectPath: string, options: CoverageOptions): Promise<string[]> {
    return [];
  }

  private read(fp: string): string {
    try { return fs.readFileSync(fp, "utf-8"); } catch { return ""; }
  }

  private estimateComplexity(content: string): number {
    const branches = (content.match(/\bif\b|\belse\b|\bswitch\b|\bcase\b|\bcatch\b|\?\s*:/g) || []).length;
    return Math.min(branches + 1, 30);
  }
}
