/**
 * Adobe Commerce SaaS — Test Coverage Engine
 * ===========================================
 * Jest coverage gaps for the SaaS storefront (drop-in blocks) + integration JS
 * (Catalog Service / Live Search queries, Data Connection handlers).
 */
import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { BaseEngine, CoverageOptions, CoverageReport, CoverageGap } from "../../shared/base";

export class CommerceSaasEngine extends BaseEngine {
  readonly name = "Adobe Commerce SaaS";
  readonly id = "commerce-saas";

  async analyzeCoverage(projectPath: string, _options: CoverageOptions): Promise<CoverageReport> {
    const gaps: CoverageGap[] = [];
    const sourceFiles = fg.sync(
      path.join(projectPath, "{blocks,src,scripts,actions,lib}/**/*.{js,mjs}").replace(/\\/g, "/"),
      { ignore: ["**/node_modules/**", "**/dist/**", "**/*.test.js", "**/*.spec.js", "**/test/**", "**/e2e/**"] },
    );
    const testFiles = fg.sync(path.join(projectPath, "**/*.{test,spec}.{js,mjs}").replace(/\\/g, "/"), { ignore: ["**/node_modules/**"] })
      .concat(fg.sync(path.join(projectPath, "{test,__tests__}/**/*.{js,mjs}").replace(/\\/g, "/"), { ignore: ["**/node_modules/**"] }));

    const tested = new Set<string>();
    for (const tf of testFiles) {
      tested.add(base(tf));
      tested.add(path.basename(path.dirname(tf)));
      const content = read(tf);
      for (const r of content.match(/(?:require\(|from\s+)['"]([^'"]+)['"]/g) || []) {
        const m = r.match(/['"]([^'"]+)['"]/);
        if (m && m[1].startsWith(".")) { tested.add(base(m[1])); tested.add(path.basename(path.dirname(m[1]))); }
      }
    }

    let testedCount = 0;
    for (const fp of sourceFiles) {
      const rel = path.relative(projectPath, fp);
      const bn = base(fp), parent = path.basename(path.dirname(fp));
      const candidate = bn === "index" ? parent : bn;
      if (tested.has(candidate) || tested.has(bn)) { testedCount++; continue; }
      const content = read(fp);
      gaps.push({
        file: rel, className: candidate, method: /export\s+default\s+function\s+decorate/.test(content) ? "decorate" : null,
        complexity: complexity(content), priority: prioritize(rel, content), reason: reason(rel, content), framework: "js",
      });
    }

    const pct = sourceFiles.length ? Math.round((testedCount / sourceFiles.length) * 100) : 0;
    return {
      projectName: path.basename(projectPath), engine: this.id,
      totalSourceFiles: sourceFiles.length, testedFiles: testedCount, untestedFiles: sourceFiles.length - testedCount,
      coveragePercent: pct,
      gaps: gaps.sort((a, b) => weight(a.priority) - weight(b.priority)).slice(0, 100),
      frameworkBreakdown: [{ framework: "js", totalFiles: sourceFiles.length, testedFiles: testedCount, untestedFiles: sourceFiles.length - testedCount, coveragePercent: pct }],
    };
  }

  async generateTests(): Promise<string[]> { return []; }
}

function read(fp: string): string { try { return fs.readFileSync(fp, "utf-8"); } catch { return ""; } }
function base(fp: string): string { return path.basename(fp).replace(/\.(test|spec)\.(js|mjs)$/, "").replace(/\.(js|mjs)$/, ""); }
function complexity(c: string): number { return Math.min((c.match(/\bif\b|\belse\b|\bswitch\b|\bcase\b|\bcatch\b|\bfor\b|\bwhile\b|&&|\|\|/g) || []).length + 1, 50); }
function prioritize(rel: string, c: string): CoverageGap["priority"] {
  if (/catalog|live-?search|checkout|cart|payment/i.test(rel + c)) return "high";
  if (/decorate|resolver|handler/i.test(c)) return "high";
  if (complexity(c) > 8) return "medium";
  return "low";
}
function reason(rel: string, c: string): string {
  if (/decorate/.test(c)) return "Storefront drop-in block — Jest test decorate() with mocked drop-in/GraphQL";
  if (/catalog|live-?search/i.test(rel + c)) return "Catalog Service / Live Search query — test mapping + error handling with a mocked client";
  return "No Jest/Mocha test found";
}
function weight(p: CoverageGap["priority"]): number { return { critical: 0, high: 1, medium: 2, low: 3 }[p]; }
