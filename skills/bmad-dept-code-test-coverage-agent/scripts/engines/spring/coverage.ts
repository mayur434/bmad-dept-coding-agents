/**
 * Spring Boot — Test Coverage Engine
 * ===================================
 * JUnit 5 + Spring Test (@WebMvcTest / @DataJpaTest / @SpringBootTest, MockMvc)
 * coverage gaps. Prioritizes controllers/services/repositories.
 */
import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { BaseEngine, CoverageOptions, CoverageReport, CoverageGap } from "../../shared/base";
import { applySharedPriority } from "../../priority/coverage-priority";

export class SpringEngine extends BaseEngine {
  readonly name = "Spring Boot";
  readonly id = "spring";

  async analyzeCoverage(projectPath: string, _options: CoverageOptions): Promise<CoverageReport> {
    const gaps: CoverageGap[] = [];

    const sourceFiles = fg.sync(
      path.join(projectPath, "**/src/main/java/**/*.java").replace(/\\/g, "/"),
      { ignore: ["**/target/**", "**/build/**", "**/generated-sources/**"] },
    );
    const testFiles = fg.sync(
      path.join(projectPath, "**/src/test/java/**/*.java").replace(/\\/g, "/"),
      { ignore: ["**/target/**", "**/build/**"] },
    );

    const tested = new Set<string>();
    for (const tf of testFiles) tested.add(path.basename(tf, ".java").replace(/(Test|Tests|IT|ITCase)$/, ""));

    let testedCount = 0;
    for (const fp of sourceFiles) {
      const className = path.basename(fp, ".java");
      const rel = path.relative(projectPath, fp);
      if (tested.has(className)) { testedCount++; continue; }
      const content = read(fp);
      // Skip pure config/DTO/entity-only classes with no logic and interfaces.
      if (isInterface(content)) continue;
      if (/@SpringBootApplication/.test(content)) { testedCount += 0; /* app class: low value */ }

      const complexity = estimateComplexity(content);
      gaps.push({
        file: rel, className, method: null, complexity,
        priority: prioritize(content, complexity), reason: reason(content), framework: "unit",
      });
    }

    const pct = sourceFiles.length > 0 ? Math.round((testedCount / sourceFiles.length) * 100) : 0;
    await applySharedPriority(gaps, projectPath, this.id);
    return {
      projectName: path.basename(projectPath),
      engine: this.id,
      totalSourceFiles: sourceFiles.length,
      testedFiles: testedCount,
      untestedFiles: sourceFiles.length - testedCount,
      coveragePercent: pct,
      gaps: gaps.slice(0, 100),
      frameworkBreakdown: [{ framework: "unit", totalFiles: sourceFiles.length, testedFiles: testedCount, untestedFiles: sourceFiles.length - testedCount, coveragePercent: pct }],
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
  if (/@RestController|@Controller/.test(c)) return "critical";
  if (/@Service|@Component/.test(c)) return "high";
  if (/@Repository/.test(c)) return "medium";
  if (complexity > 10) return "high";
  if (complexity > 5) return "medium";
  return "low";
}
function reason(c: string): string {
  if (/@RestController|@Controller/.test(c)) return "Controller — @WebMvcTest + MockMvc for each endpoint (status, body, validation)";
  if (/@Service/.test(c)) return "Service — unit test business logic with mocked collaborators (Mockito)";
  if (/@Repository|extends\s+JpaRepository/.test(c)) return "Repository — @DataJpaTest (or Testcontainers) for queries";
  if (/@Component/.test(c)) return "Spring bean — unit test its logic";
  if (/@Configuration/.test(c)) return "Configuration — verify bean wiring where it carries logic";
  return "No JUnit/Spring-Test coverage found";
}
function weight(p: CoverageGap["priority"]): number { return { critical: 0, high: 1, medium: 2, low: 3 }[p]; }
