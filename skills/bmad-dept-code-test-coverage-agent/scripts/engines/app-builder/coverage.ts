/**
 * Adobe App Builder — Test Coverage Engine
 * =========================================
 * Jest/Mocha coverage gaps for Runtime actions, mesh resolvers, and lib code.
 * Matches tests to sources by basename, action-folder name, and require/import
 * references (so `actions/<name>/index.js` is matched by `test/<name>.test.js`).
 */
import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { BaseEngine, CoverageOptions, CoverageReport, CoverageGap } from "../../shared/base";
import { applySharedPriority } from "../../priority/coverage-priority";

export class AppBuilderEngine extends BaseEngine {
  readonly name = "Adobe App Builder";
  readonly id = "app-builder";

  async analyzeCoverage(projectPath: string, _options: CoverageOptions): Promise<CoverageReport> {
    const gaps: CoverageGap[] = [];

    const sourceFiles = fg.sync(
      path.join(projectPath, "{actions,src,lib}/**/*.{js,mjs}").replace(/\\/g, "/"),
      { ignore: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/*.test.js", "**/*.spec.js", "**/test/**", "**/e2e/**"] },
    );
    const testFiles = fg.sync(
      path.join(projectPath, "**/*.{test,spec}.{js,mjs}").replace(/\\/g, "/"),
      { ignore: ["**/node_modules/**", "**/dist/**"] },
    ).concat(
      fg.sync(path.join(projectPath, "{test,e2e,__tests__}/**/*.{js,mjs}").replace(/\\/g, "/"), { ignore: ["**/node_modules/**"] }),
    );

    // Build tested identifier set: basenames, parent dirs, and required module basenames.
    const tested = new Set<string>();
    for (const tf of testFiles) {
      tested.add(base(tf));
      tested.add(path.basename(path.dirname(tf)));
      const content = read(tf);
      const reqs = content.match(/(?:require\(|from\s+)['"]([^'"]+)['"]/g) || [];
      for (const r of reqs) {
        const m = r.match(/['"]([^'"]+)['"]/);
        if (!m) continue;
        const spec = m[1];
        if (spec.startsWith(".")) {
          tested.add(base(spec));
          tested.add(path.basename(path.dirname(spec)));
        }
      }
    }

    let testedCount = 0;
    for (const fp of sourceFiles) {
      const rel = path.relative(projectPath, fp);
      const bn = base(fp);
      const parent = path.basename(path.dirname(fp));
      const candidate = bn === "index" ? parent : bn;
      if (tested.has(candidate) || tested.has(bn)) { testedCount++; continue; }

      const content = read(fp);
      const complexity = estimateComplexity(content);
      gaps.push({
        file: rel,
        className: bn === "index" ? parent : bn,
        method: /exports\.main|module\.exports\.main|async\s+function\s+main/.test(content) ? "main" : null,
        complexity,
        priority: prioritize(rel, content, complexity),
        reason: reason(rel, content),
        framework: "js",
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
      frameworkBreakdown: [{ framework: "js", totalFiles: sourceFiles.length, testedFiles: testedCount, untestedFiles: sourceFiles.length - testedCount, coveragePercent: pct }],
    };
  }

  async generateTests(): Promise<string[]> { return []; }
}

function read(fp: string): string { try { return fs.readFileSync(fp, "utf-8"); } catch { return ""; } }
function base(fp: string): string { return path.basename(fp).replace(/\.(test|spec)\.(js|mjs)$/, "").replace(/\.(js|mjs)$/, ""); }
function estimateComplexity(c: string): number {
  return Math.min((c.match(/\bif\b|\belse\b|\bswitch\b|\bcase\b|\bcatch\b|\bfor\b|\bwhile\b|&&|\|\|/g) || []).length + 1, 50);
}
function prioritize(rel: string, c: string, complexity: number): CoverageGap["priority"] {
  if (/exports\.main|async\s+function\s+main/.test(c) && rel.includes("actions")) return "critical";
  if (/resolvers?|handler/i.test(rel) || /resolve\s*:/.test(c)) return "high";
  if (complexity > 10) return "high";
  if (complexity > 5) return "medium";
  return "low";
}
function reason(rel: string, c: string): string {
  if (/exports\.main|async\s+function\s+main/.test(c) && rel.includes("actions")) return "Runtime action — Jest test main(params): auth, happy path, error/response shape";
  if (/resolvers?/i.test(rel)) return "Mesh resolver — Jest test resolve() with mocked context/sources";
  if (rel.includes("lib") || rel.includes("src")) return "Library module — unit test exported functions";
  return "No Jest/Mocha test found";
}
function weight(p: CoverageGap["priority"]): number { return { critical: 0, high: 1, medium: 2, low: 3 }[p]; }
