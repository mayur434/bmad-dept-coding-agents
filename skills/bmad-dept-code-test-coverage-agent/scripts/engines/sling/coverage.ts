/**
 * Sling-12 / Shaft — Test Coverage Engine
 * ========================================
 * JUnit + Apache Sling Mocks / OSGi Mocks coverage gaps for Sling/Shaft bundles.
 */
import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { BaseEngine, CoverageOptions, CoverageReport, CoverageGap } from "../../shared/base";

export class SlingEngine extends BaseEngine {
  readonly name = "Apache Sling / Shaft";
  readonly id = "sling";

  async analyzeCoverage(projectPath: string, _options: CoverageOptions): Promise<CoverageReport> {
    const gaps: CoverageGap[] = [];

    const sourceFiles = fg.sync(
      path.join(projectPath, "**/src/main/java/**/*.java").replace(/\\/g, "/"),
      { ignore: ["**/target/**", "**/generated-sources/**"] },
    );
    const testFiles = fg.sync(
      path.join(projectPath, "**/src/test/java/**/*.java").replace(/\\/g, "/"),
      { ignore: ["**/target/**"] },
    );

    const tested = new Set<string>();
    for (const tf of testFiles) tested.add(path.basename(tf, ".java").replace(/(Test|IT|ITCase|Tests)$/, ""));

    let testedCount = 0;
    for (const fp of sourceFiles) {
      const className = path.basename(fp, ".java");
      const rel = path.relative(projectPath, fp);
      if (tested.has(className)) { testedCount++; continue; }
      const content = read(fp);
      if (isInterface(content) || /\bclass\s+\w+Constants\b/.test(content)) continue;

      const complexity = estimateComplexity(content);
      gaps.push({
        file: rel, className, method: null, complexity,
        priority: prioritize(content, complexity), reason: reason(content), framework: "unit",
      });
    }

    const t="unit";
    const pct = sourceFiles.length > 0 ? Math.round((testedCount / sourceFiles.length) * 100) : 0;
    return {
      projectName: path.basename(projectPath),
      engine: this.id,
      totalSourceFiles: sourceFiles.length,
      testedFiles: testedCount,
      untestedFiles: sourceFiles.length - testedCount,
      coveragePercent: pct,
      gaps: gaps.sort((a, b) => weight(a.priority) - weight(b.priority)).slice(0, 100),
      frameworkBreakdown: [{ framework: t, totalFiles: sourceFiles.length, testedFiles: testedCount, untestedFiles: sourceFiles.length - testedCount, coveragePercent: pct }],
    };
  }

  async generateTests(): Promise<string[]> { return []; }
}

function read(fp: string): string { try { return fs.readFileSync(fp, "utf-8"); } catch { return ""; } }
function isInterface(c: string): boolean { return /\binterface\s+\w+/.test(c) && !/\bclass\s+\w+/.test(c); }
function estimateComplexity(c: string): number {
  return Math.min((c.match(/\bif\b|\belse\b|\bswitch\b|\bcase\b|\bcatch\b|\bfor\b|\bwhile\b/g) || []).length + 1, 50);
}
function prioritize(c: string, complexity: number): CoverageGap["priority"] {
  if (/getServiceResourceResolver|getAdministrativeResourceResolver|\bJwt|Authentication|Authorization/.test(c)) return "critical";
  if (/extends\s+Sling\w*Servlet|implements\s+Filter|@Component/.test(c)) return "high";
  if (/Connector|MDM|SAM|Payment/i.test(c)) return "high";
  if (complexity > 10) return "high";
  if (complexity > 5) return "medium";
  return "low";
}
function reason(c: string): string {
  if (/extends\s+Sling\w*Servlet/.test(c)) return "Sling Servlet — test with SlingContext (request/response, resolver mocks)";
  if (/implements\s+Filter/.test(c)) return "Servlet Filter — test XSS/Audit/Authorization chain behavior with SlingContext";
  if (/@Component/.test(c)) return "OSGi service — test with OsgiContext + Sling Mocks";
  if (/Connector/i.test(c)) return "Connector — test integration/error paths with mocked external client";
  if (/Jwt|Authentication/.test(c)) return "Auth logic — cover token verification/deny paths";
  return "No JUnit/Sling-Mocks test found";
}
function weight(p: CoverageGap["priority"]): number { return { critical: 0, high: 1, medium: 2, low: 3 }[p]; }
