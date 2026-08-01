/**
 * AEM as a Cloud Service — Test Coverage Engine
 * ================================================
 * Analyzes JUnit/Sling Mock test coverage gaps for AEM projects.
 */
import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { BaseEngine, CoverageOptions, CoverageReport, CoverageGap } from "../../shared/base";
import { applySharedPriority } from "../../priority/coverage-priority";

export class AemEngine extends BaseEngine {
  readonly name = "AEM as a Cloud Service";
  readonly id = "aem";

  async analyzeCoverage(projectPath: string, options: CoverageOptions): Promise<CoverageReport> {
    const gaps: CoverageGap[] = [];

    // Discover Java source files
    const srcPatterns = [
      path.join(projectPath, "core/src/main/java/**/*.java"),
      path.join(projectPath, "bundle/src/main/java/**/*.java"),
    ].map((p) => p.replace(/\\/g, "/"));
    const sourceFiles = fg.sync(srcPatterns);

    // Discover test files
    const testPatterns = [
      path.join(projectPath, "core/src/test/java/**/*Test.java"),
      path.join(projectPath, "core/src/test/java/**/*IT.java"),
      path.join(projectPath, "it.tests/src/test/java/**/*.java"),
    ].map((p) => p.replace(/\\/g, "/"));
    const testFiles = fg.sync(testPatterns);

    // Build tested class set
    const testedClasses = new Set<string>();
    for (const tf of testFiles) {
      const name = path.basename(tf, ".java").replace(/Test$|IT$/, "");
      testedClasses.add(name);
    }

    let testedCount = 0;
    for (const fp of sourceFiles) {
      const className = path.basename(fp, ".java");
      const rel = path.relative(projectPath, fp);

      if (testedClasses.has(className)) {
        testedCount++;
        continue;
      }

      const content = this.read(fp);
      if (this.isInterface(content) || this.isConstantsOnly(content)) continue;

      const complexity = this.estimateComplexity(content);
      const priority = this.prioritize(rel, content, complexity);

      gaps.push({
        file: rel,
        className,
        method: null,
        complexity,
        priority,
        reason: this.reason(rel, content),
        framework: "unit",
      });
    }

    // Shared 6-factor priority: mutates gap.priority in-place, resorts highest-first.
    await applySharedPriority(gaps, projectPath, this.id);

    return {
      projectName: path.basename(projectPath),
      engine: this.id,
      totalSourceFiles: sourceFiles.length,
      testedFiles: testedCount,
      untestedFiles: sourceFiles.length - testedCount,
      coveragePercent: sourceFiles.length > 0 ? Math.round((testedCount / sourceFiles.length) * 100) : 0,
      gaps: gaps.slice(0, 100),
      frameworkBreakdown: [{ framework: "unit", totalFiles: sourceFiles.length, testedFiles: testedCount, untestedFiles: sourceFiles.length - testedCount, coveragePercent: sourceFiles.length > 0 ? Math.round((testedCount / sourceFiles.length) * 100) : 0 }],
    };
  }

  async generateTests(_projectPath: string, _options: CoverageOptions): Promise<string[]> {
    return [];
  }

  private read(fp: string): string {
    try { return fs.readFileSync(fp, "utf-8"); } catch { return ""; }
  }

  private isInterface(content: string): boolean {
    return /\binterface\s+\w+/.test(content) && !/\bclass\s+\w+/.test(content);
  }

  private isConstantsOnly(content: string): boolean {
    return /\bclass\s+\w+Constants\b/.test(content);
  }

  private estimateComplexity(content: string): number {
    const branches = (content.match(/\bif\b|\belse\b|\bswitch\b|\bcase\b|\bcatch\b|\b\?\s*:/g) || []).length;
    return Math.min(branches + 1, 50);
  }

  private prioritize(rel: string, content: string, complexity: number): CoverageGap["priority"] {
    if (content.includes("@Model") && content.includes("@PostConstruct")) return "critical";
    if (content.includes("extends SlingAllMethodsServlet") || content.includes("extends SlingSafeMethodsServlet")) return "critical";
    if (content.includes("WorkflowProcess")) return "high";
    if (content.includes("EventHandler") || content.includes("@Component")) return "high";
    if (complexity > 10) return "high";
    if (complexity > 5) return "medium";
    return "low";
  }

  private reason(rel: string, content: string): string {
    if (content.includes("@Model")) return "Sling Model — test with AemContext and mock resources";
    if (content.includes("Servlet")) return "Servlet — test request/response handling";
    if (content.includes("WorkflowProcess")) return "Workflow step — test process() with mock WorkItem";
    if (content.includes("Scheduler") || content.includes("@Scheduled")) return "Scheduler — test run() logic";
    if (content.includes("@Component")) return "OSGi Service — test with OsgiContext";
    return "No test coverage found";
  }

  private priorityWeight(p: CoverageGap["priority"]): number {
    return { critical: 0, high: 1, medium: 2, low: 3 }[p];
  }
}
