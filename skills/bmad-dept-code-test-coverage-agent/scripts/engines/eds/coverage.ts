/**
 * Edge Delivery Services — Test Coverage Engine
 * ================================================
 * Analyzes Mocha/Jest test coverage gaps for EDS block-based projects.
 */
import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { BaseEngine, CoverageOptions, CoverageReport, CoverageGap } from "../../shared/base";
import { applySharedPriority } from "../../priority/coverage-priority";

export class EdsEngine extends BaseEngine {
  readonly name = "Edge Delivery Services";
  readonly id = "eds";

  async analyzeCoverage(projectPath: string, _options: CoverageOptions): Promise<CoverageReport> {
    const gaps: CoverageGap[] = [];

    // Source files
    const blockFiles = fg.sync(path.join(projectPath, "blocks/**/*.js").replace(/\\/g, "/"));
    const scriptFiles = fg.sync(path.join(projectPath, "scripts/**/*.js").replace(/\\/g, "/"));
    const sourceFiles = [...blockFiles, ...scriptFiles];

    // Test files
    const testFiles = fg.sync(path.join(projectPath, "test/**/*.{test,spec}.{js,mjs}").replace(/\\/g, "/"));
    const testedNames = new Set<string>();
    for (const tf of testFiles) {
      const name = path.basename(tf).replace(/\.(test|spec)\.(js|mjs)$/, "");
      testedNames.add(name);
    }

    let testedCount = 0;
    for (const fp of sourceFiles) {
      const fileName = path.basename(fp, ".js");
      const rel = path.relative(projectPath, fp);

      if (testedNames.has(fileName)) {
        testedCount++;
        continue;
      }

      const content = this.read(fp);
      const complexity = this.estimateComplexity(content);
      const priority = this.prioritize(rel, content, complexity);

      gaps.push({
        file: rel,
        className: null,
        method: null,
        complexity,
        priority,
        reason: this.reason(rel, content),
        framework: "unit",
      });
    }

    await applySharedPriority(gaps, projectPath, this.id);
    return {
      projectName: path.basename(projectPath),
      engine: this.id,
      totalSourceFiles: sourceFiles.length,
      testedFiles: testedCount,
      untestedFiles: sourceFiles.length - testedCount,
      coveragePercent: sourceFiles.length > 0 ? Math.round((testedCount / sourceFiles.length) * 100) : 0,
      gaps,
      frameworkBreakdown: [{ framework: "unit", totalFiles: sourceFiles.length, testedFiles: testedCount, untestedFiles: sourceFiles.length - testedCount, coveragePercent: sourceFiles.length > 0 ? Math.round((testedCount / sourceFiles.length) * 100) : 0 }],
    };
  }

  async generateTests(_projectPath: string, _options: CoverageOptions): Promise<string[]> {
    return [];
  }

  private read(fp: string): string {
    try { return fs.readFileSync(fp, "utf-8"); } catch { return ""; }
  }

  private estimateComplexity(content: string): number {
    const branches = (content.match(/\bif\b|\belse\b|\bswitch\b|\bcase\b|\bcatch\b|\?\s*:/g) || []).length;
    return Math.min(branches + 1, 30);
  }

  private prioritize(rel: string, content: string, complexity: number): CoverageGap["priority"] {
    if (content.includes("async") && content.includes("fetch")) return "high";
    if (rel.includes("scripts/") && content.includes("export")) return "high";
    if (complexity > 8) return "high";
    if (complexity > 4) return "medium";
    return "low";
  }

  private reason(rel: string, content: string): string {
    if (rel.includes("blocks/")) return "Block decorator — test DOM transformation output";
    if (content.includes("fetch")) return "Contains fetch calls — mock responses and test error handling";
    if (content.includes("addEventListener")) return "Event handler — test event dispatch/handling";
    return "No test found for this source file";
  }

  private priorityWeight(p: CoverageGap["priority"]): number {
    return { critical: 0, high: 1, medium: 2, low: 3 }[p];
  }
}
