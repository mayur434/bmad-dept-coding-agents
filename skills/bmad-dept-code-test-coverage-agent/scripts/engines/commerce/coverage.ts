/**
 * Commerce (Magento 2) — Test Coverage Engine
 * ==============================================
 * Comprehensive coverage analysis across all Magento 2 testing frameworks:
 *   - PHPUnit Unit Tests
 *   - PHPUnit Integration Tests
 *   - MFTF (Functional Testing Framework)
 *   - API Functional Tests (REST/GraphQL)
 *   - JavaScript Tests (Jasmine/Jest)
 *   - Static Analysis (PHPCS/PHPStan)
 *   - Performance Tests (JMeter/k6)
 *
 * Detection strategies: filename convention + namespace mapping + annotation scanning.
 * Priority scoring: complexity + revenue path + plugin/observer + public API + git churn + fan-in.
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import fg from "fast-glob";
import {
  BaseEngine,
  CoverageOptions,
  CoverageReport,
  CoverageGap,
  FrameworkSummary,
  TestFramework,
  DetectionStrategy,
} from "../../shared/base";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_FRAMEWORKS: TestFramework[] = [
  "unit", "integration", "mftf", "api-functional", "js", "static", "performance",
];

const REVENUE_PATHS = /Checkout|Cart|Payment|Order|Quote|Shipping|Tax|GiftCard|Reward|CustomerBalance/i;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class CommerceEngine extends BaseEngine {
  readonly name = "Adobe Commerce / Magento 2";
  readonly id = "commerce";

  async analyzeCoverage(projectPath: string, options: CoverageOptions): Promise<CoverageReport> {
    const frameworks = options.frameworks && options.frameworks.length > 0
      ? options.frameworks
      : ALL_FRAMEWORKS;
    const strategy: DetectionStrategy = options.strategy || "all";

    const allGaps: CoverageGap[] = [];
    const breakdowns: FrameworkSummary[] = [];

    // Git churn data (best effort — works only in git repos)
    const churnMap = this.buildChurnMap(projectPath);
    // Dependency fan-in data
    const fanInMap = this.buildFanInMap(projectPath, options.module);

    for (const fw of frameworks) {
      const result = this.analyzeFramework(projectPath, fw, strategy, options, churnMap, fanInMap);
      allGaps.push(...result.gaps);
      breakdowns.push(result.summary);
    }

    const totalSource = breakdowns.reduce((s, b) => s + b.totalFiles, 0);
    const totalTested = breakdowns.reduce((s, b) => s + b.testedFiles, 0);

    return {
      projectName: options.name || path.basename(projectPath),
      engine: this.id,
      totalSourceFiles: totalSource,
      testedFiles: totalTested,
      untestedFiles: totalSource - totalTested,
      coveragePercent: totalSource > 0 ? Math.round((totalTested / totalSource) * 100) : 0,
      gaps: allGaps
        .sort((a, b) => this.priorityWeight(a.priority) - this.priorityWeight(b.priority))
        .slice(0, 200),
      frameworkBreakdown: breakdowns,
    };
  }

  async generateTests(_projectPath: string, _options: CoverageOptions): Promise<string[]> {
    // Test generation is handled by LLM tier — return empty here
    return [];
  }

  // =========================================================================
  // Per-framework analysis
  // =========================================================================

  private analyzeFramework(
    projectPath: string,
    framework: TestFramework,
    strategy: DetectionStrategy,
    options: CoverageOptions,
    churnMap: Map<string, number>,
    fanInMap: Map<string, number>,
  ): { gaps: CoverageGap[]; summary: FrameworkSummary } {
    switch (framework) {
      case "unit": return this.analyzeUnit(projectPath, strategy, options, churnMap, fanInMap);
      case "integration": return this.analyzeIntegration(projectPath, strategy, options, churnMap, fanInMap);
      case "mftf": return this.analyzeMftf(projectPath, options);
      case "api-functional": return this.analyzeApiFunctional(projectPath, options, churnMap, fanInMap);
      case "js": return this.analyzeJavaScript(projectPath, options, churnMap);
      case "static": return this.analyzeStatic(projectPath, options);
      case "performance": return this.analyzePerformance(projectPath, options);
    }
  }

  // -------------------------------------------------------------------------
  // PHPUnit Unit Tests
  // -------------------------------------------------------------------------

  private analyzeUnit(
    projectPath: string,
    strategy: DetectionStrategy,
    options: CoverageOptions,
    churnMap: Map<string, number>,
    fanInMap: Map<string, number>,
  ): { gaps: CoverageGap[]; summary: FrameworkSummary } {
    const gaps: CoverageGap[] = [];
    const sourceFiles = this.discoverPhpSource(projectPath, options.module);

    // Gather all unit test files
    const unitTestPatterns = [
      options.module
        ? path.join(projectPath, `app/code/${options.module}/**/Test/Unit/**/*.php`)
        : path.join(projectPath, "app/code/**/Test/Unit/**/*.php"),
      path.join(projectPath, "dev/tests/unit/testsuite/**/*.php"),
    ].map((p) => p.replace(/\\/g, "/"));
    const testFiles = fg.sync(unitTestPatterns);

    const coveredClasses = this.buildCoveredSet(testFiles, strategy);

    let testedCount = 0;
    for (const fp of sourceFiles) {
      const className = path.basename(fp, ".php");
      const rel = path.relative(projectPath, fp);
      const ns = this.extractNamespace(fp);

      if (this.isCovered(className, ns, coveredClasses, strategy)) {
        testedCount++;
        continue;
      }

      const content = this.read(fp);
      if (this.isInterface(content) || this.isConstantsOnly(content)) continue;

      const complexity = this.estimateComplexity(content);
      const priority = this.computePriority(rel, content, complexity, churnMap, fanInMap);

      gaps.push({
        file: rel,
        className,
        method: null,
        complexity,
        priority,
        reason: this.reason(rel, content, "unit"),
        framework: "unit",
      });
    }

    return {
      gaps,
      summary: { framework: "unit", totalFiles: sourceFiles.length, testedFiles: testedCount, untestedFiles: sourceFiles.length - testedCount, coveragePercent: sourceFiles.length > 0 ? Math.round((testedCount / sourceFiles.length) * 100) : 0 },
    };
  }

  // -------------------------------------------------------------------------
  // PHPUnit Integration Tests
  // -------------------------------------------------------------------------

  private analyzeIntegration(
    projectPath: string,
    strategy: DetectionStrategy,
    options: CoverageOptions,
    churnMap: Map<string, number>,
    fanInMap: Map<string, number>,
  ): { gaps: CoverageGap[]; summary: FrameworkSummary } {
    const gaps: CoverageGap[] = [];
    const sourceFiles = this.discoverPhpSource(projectPath, options.module);

    const integrationPatterns = [
      options.module
        ? path.join(projectPath, `app/code/${options.module}/**/Test/Integration/**/*.php`)
        : path.join(projectPath, "app/code/**/Test/Integration/**/*.php"),
      path.join(projectPath, "dev/tests/integration/testsuite/**/*.php"),
    ].map((p) => p.replace(/\\/g, "/"));
    const testFiles = fg.sync(integrationPatterns);

    const coveredClasses = this.buildCoveredSet(testFiles, strategy);

    // For integration tests, focus on classes that NEED integration coverage
    // (DB access, service contracts, repositories, event dispatch)
    const integrationWorthy = sourceFiles.filter((fp) => {
      const content = this.read(fp);
      return /ResourceModel|Repository|Service|EventManager|MessageQueue|Consumer/i.test(path.basename(fp, ".php"))
        || content.includes("$this->resourceConnection")
        || content.includes("$this->eventManager")
        || content.includes("implements.*Interface/i");
    });

    let testedCount = 0;
    for (const fp of integrationWorthy) {
      const className = path.basename(fp, ".php");
      const rel = path.relative(projectPath, fp);
      const ns = this.extractNamespace(fp);

      if (this.isCovered(className, ns, coveredClasses, strategy)) {
        testedCount++;
        continue;
      }

      const content = this.read(fp);
      const complexity = this.estimateComplexity(content);
      const priority = this.computePriority(rel, content, complexity, churnMap, fanInMap);

      gaps.push({
        file: rel,
        className,
        method: null,
        complexity,
        priority,
        reason: this.reason(rel, content, "integration"),
        framework: "integration",
      });
    }

    return {
      gaps,
      summary: { framework: "integration", totalFiles: integrationWorthy.length, testedFiles: testedCount, untestedFiles: integrationWorthy.length - testedCount, coveragePercent: integrationWorthy.length > 0 ? Math.round((testedCount / integrationWorthy.length) * 100) : 0 },
    };
  }

  // -------------------------------------------------------------------------
  // MFTF — Controller Mapping + Page/Section Coverage
  // -------------------------------------------------------------------------

  private analyzeMftf(
    projectPath: string,
    options: CoverageOptions,
  ): { gaps: CoverageGap[]; summary: FrameworkSummary } {
    const gaps: CoverageGap[] = [];

    // 1. Discover controller actions (routes/user flows)
    const controllerPattern = options.module
      ? path.join(projectPath, `app/code/${options.module}/**/Controller/**/*.php`)
      : path.join(projectPath, "app/code/**/Controller/**/*.php");
    const controllers = fg.sync(controllerPattern.replace(/\\/g, "/"));

    // 2. Discover MFTF Test XMLs
    const mftfTestPattern = options.module
      ? path.join(projectPath, `app/code/${options.module}/**/Test/Mftf/Test/**/*.xml`)
      : path.join(projectPath, "app/code/**/Test/Mftf/Test/**/*.xml");
    const mftfTests = fg.sync(mftfTestPattern.replace(/\\/g, "/"));
    const mftfContent = mftfTests.map((f) => this.read(f)).join("\n");

    // 3. Discover MFTF Sections + Pages
    const sectionPattern = options.module
      ? path.join(projectPath, `app/code/${options.module}/**/Test/Mftf/Section/**/*.xml`)
      : path.join(projectPath, "app/code/**/Test/Mftf/Section/**/*.xml");
    const pagePattern = options.module
      ? path.join(projectPath, `app/code/${options.module}/**/Test/Mftf/Page/**/*.xml`)
      : path.join(projectPath, "app/code/**/Test/Mftf/Page/**/*.xml");
    const sections = fg.sync(sectionPattern.replace(/\\/g, "/"));
    const pages = fg.sync(pagePattern.replace(/\\/g, "/"));

    // 4. Discover layout XML handles (admin/frontend routes)
    const layoutPattern = options.module
      ? path.join(projectPath, `app/code/${options.module}/**/view/{adminhtml,frontend}/layout/*.xml`)
      : path.join(projectPath, "app/code/**/view/{adminhtml,frontend}/layout/*.xml");
    const layoutFiles = fg.sync(layoutPattern.replace(/\\/g, "/"));
    const layoutHandles = new Set(layoutFiles.map((f) => path.basename(f, ".xml")));

    // Check which controllers have MFTF coverage
    let testedCount = 0;
    for (const fp of controllers) {
      const className = path.basename(fp, ".php");
      const rel = path.relative(projectPath, fp);

      // Controller route detection: extract module_controller_action from path
      const routeKey = this.extractRouteKey(rel);
      const hasMftfTest = routeKey
        ? mftfContent.includes(routeKey) || mftfContent.toLowerCase().includes(className.toLowerCase())
        : mftfContent.toLowerCase().includes(className.toLowerCase());

      if (hasMftfTest) {
        testedCount++;
        continue;
      }

      const content = this.read(fp);
      const priority: CoverageGap["priority"] = REVENUE_PATHS.test(rel) ? "critical" : "high";

      gaps.push({
        file: rel,
        className,
        method: "execute",
        complexity: this.estimateComplexity(content),
        priority,
        reason: `Controller action without MFTF functional test — user flow untested`,
        framework: "mftf",
      });
    }

    // Check for layout handles without corresponding MFTF Page definitions
    const pageContent = pages.map((f) => this.read(f)).join("\n");
    for (const handle of layoutHandles) {
      if (!pageContent.includes(handle)) {
        gaps.push({
          file: `layout/${handle}.xml`,
          className: null,
          method: null,
          complexity: 1,
          priority: "medium",
          reason: `Layout handle "${handle}" has no MFTF Page definition — cannot be E2E tested`,
          framework: "mftf",
        });
      }
    }

    const total = controllers.length;
    return {
      gaps,
      summary: { framework: "mftf", totalFiles: total, testedFiles: testedCount, untestedFiles: total - testedCount, coveragePercent: total > 0 ? Math.round((testedCount / total) * 100) : 0 },
    };
  }

  // -------------------------------------------------------------------------
  // API Functional Tests (REST + GraphQL)
  // -------------------------------------------------------------------------

  private analyzeApiFunctional(
    projectPath: string,
    options: CoverageOptions,
    churnMap: Map<string, number>,
    fanInMap: Map<string, number>,
  ): { gaps: CoverageGap[]; summary: FrameworkSummary } {
    const gaps: CoverageGap[] = [];

    // Discover API interfaces (webapi.xml + @api annotations)
    const webapiPattern = options.module
      ? path.join(projectPath, `app/code/${options.module}/**/etc/webapi.xml`)
      : path.join(projectPath, "app/code/**/etc/webapi.xml");
    const webapiFiles = fg.sync(webapiPattern.replace(/\\/g, "/"));

    // Discover GraphQL schema files
    const graphqlPattern = options.module
      ? path.join(projectPath, `app/code/${options.module}/**/etc/schema.graphqls`)
      : path.join(projectPath, "app/code/**/etc/schema.graphqls");
    const graphqlFiles = fg.sync(graphqlPattern.replace(/\\/g, "/"));

    // Discover existing API tests
    const apiTestPatterns = [
      path.join(projectPath, "dev/tests/api-functional/testsuite/**/*.php"),
      options.module
        ? path.join(projectPath, `app/code/${options.module}/**/Test/Api/**/*.php`)
        : path.join(projectPath, "app/code/**/Test/Api/**/*.php"),
    ].map((p) => p.replace(/\\/g, "/"));
    const apiTestFiles = fg.sync(apiTestPatterns);
    const apiTestContent = apiTestFiles.map((f) => this.read(f)).join("\n");

    // Parse webapi.xml for REST endpoints
    let totalEndpoints = 0;
    let testedEndpoints = 0;
    for (const wf of webapiFiles) {
      const xml = this.read(wf);
      const routes = xml.match(/url="([^"]+)"/g) || [];
      for (const route of routes) {
        totalEndpoints++;
        const url = route.replace(/url="|"/g, "");
        if (apiTestContent.includes(url)) {
          testedEndpoints++;
        } else {
          const rel = path.relative(projectPath, wf);
          gaps.push({
            file: rel,
            className: null,
            method: url,
            complexity: 1,
            priority: REVENUE_PATHS.test(url) ? "critical" : "high",
            reason: `REST endpoint ${url} has no API functional test`,
            framework: "api-functional",
          });
        }
      }
    }

    // Parse GraphQL schemas for query/mutation coverage
    for (const gf of graphqlFiles) {
      const schema = this.read(gf);
      const operations = schema.match(/(?:type\s+(?:Query|Mutation)\s*\{[^}]*\})/gs) || [];
      for (const block of operations) {
        const fields = block.match(/^\s+(\w+)\s*[(:]/gm) || [];
        for (const field of fields) {
          totalEndpoints++;
          const name = field.trim().split(/[\s(:]/)[0];
          if (apiTestContent.includes(name)) {
            testedEndpoints++;
          } else {
            const rel = path.relative(projectPath, gf);
            gaps.push({
              file: rel,
              className: null,
              method: name,
              complexity: 1,
              priority: REVENUE_PATHS.test(name) ? "critical" : "high",
              reason: `GraphQL operation "${name}" has no API functional test`,
              framework: "api-functional",
            });
          }
        }
      }
    }

    return {
      gaps,
      summary: { framework: "api-functional", totalFiles: totalEndpoints, testedFiles: testedEndpoints, untestedFiles: totalEndpoints - testedEndpoints, coveragePercent: totalEndpoints > 0 ? Math.round((testedEndpoints / totalEndpoints) * 100) : 0 },
    };
  }

  // -------------------------------------------------------------------------
  // JavaScript Tests (RequireJS / KnockoutJS / jQuery UI widgets)
  // -------------------------------------------------------------------------

  private analyzeJavaScript(
    projectPath: string,
    options: CoverageOptions,
    churnMap: Map<string, number>,
  ): { gaps: CoverageGap[]; summary: FrameworkSummary } {
    const gaps: CoverageGap[] = [];

    const jsSourcePattern = options.module
      ? path.join(projectPath, `app/code/${options.module}/**/view/{frontend,adminhtml}/web/js/**/*.js`)
      : path.join(projectPath, "app/code/**/view/{frontend,adminhtml}/web/js/**/*.js");
    const sourceFiles = fg.sync(jsSourcePattern.replace(/\\/g, "/"), { ignore: ["**/*.min.js", "**/mixins/**"] });

    // JS test locations
    const jsTestPatterns = [
      path.join(projectPath, "dev/tests/js/jasmine/tests/**/*.js"),
      options.module
        ? path.join(projectPath, `app/code/${options.module}/**/Test/JsUnit/**/*.js`)
        : path.join(projectPath, "app/code/**/Test/JsUnit/**/*.js"),
    ].map((p) => p.replace(/\\/g, "/"));
    const testFiles = fg.sync(jsTestPatterns);
    const testedNames = new Set<string>();
    for (const tf of testFiles) {
      const name = path.basename(tf, ".js").replace(/[-_]test$|\.test$/i, "");
      testedNames.add(name);
    }
    // Also check test content for requirejs module references
    const testContent = testFiles.map((f) => this.read(f)).join("\n");

    let testedCount = 0;
    for (const fp of sourceFiles) {
      const fileName = path.basename(fp, ".js");
      const rel = path.relative(projectPath, fp);

      if (testedNames.has(fileName) || testContent.includes(fileName)) {
        testedCount++;
        continue;
      }

      const content = this.read(fp);
      const complexity = this.estimateJsComplexity(content);
      const isWidget = content.includes("$.widget") || content.includes("uiComponent");
      const priority: CoverageGap["priority"] = isWidget ? "high" : complexity > 5 ? "medium" : "low";

      gaps.push({
        file: rel,
        className: null,
        method: null,
        complexity,
        priority,
        reason: isWidget
          ? "UI widget/component — test user interactions and state changes"
          : "Frontend JS module — test public API and data transformations",
        framework: "js",
      });
    }

    return {
      gaps,
      summary: { framework: "js", totalFiles: sourceFiles.length, testedFiles: testedCount, untestedFiles: sourceFiles.length - testedCount, coveragePercent: sourceFiles.length > 0 ? Math.round((testedCount / sourceFiles.length) * 100) : 0 },
    };
  }

  // -------------------------------------------------------------------------
  // Static Analysis Coverage (PHPCS / PHPStan / PHPMD)
  // -------------------------------------------------------------------------

  private analyzeStatic(
    projectPath: string,
    options: CoverageOptions,
  ): { gaps: CoverageGap[]; summary: FrameworkSummary } {
    const gaps: CoverageGap[] = [];

    // Check for static analysis config presence
    const hasPhpcs = fs.existsSync(path.join(projectPath, "phpcs.xml"))
      || fs.existsSync(path.join(projectPath, "phpcs.xml.dist"));
    const hasPhpstan = fs.existsSync(path.join(projectPath, "phpstan.neon"))
      || fs.existsSync(path.join(projectPath, "phpstan.neon.dist"));
    const hasPhpmd = fs.existsSync(path.join(projectPath, "phpmd.xml"))
      || fs.existsSync(path.join(projectPath, "phpmd.xml.dist"));

    const configs = [
      { tool: "phpcs", present: hasPhpcs, reason: "PHPCS config missing — no coding standard enforcement" },
      { tool: "phpstan", present: hasPhpstan, reason: "PHPStan config missing — no static type checking" },
      { tool: "phpmd", present: hasPhpmd, reason: "PHPMD config missing — no mess detection rules" },
    ];

    let configured = 0;
    for (const cfg of configs) {
      if (cfg.present) {
        configured++;
      } else {
        gaps.push({
          file: `${cfg.tool}.xml(.dist)`,
          className: null,
          method: null,
          complexity: 0,
          priority: cfg.tool === "phpstan" ? "high" : "medium",
          reason: cfg.reason,
          framework: "static",
        });
      }
    }

    // If PHPStan exists, check its level
    if (hasPhpstan) {
      const neonFile = fs.existsSync(path.join(projectPath, "phpstan.neon"))
        ? path.join(projectPath, "phpstan.neon")
        : path.join(projectPath, "phpstan.neon.dist");
      const neonContent = this.read(neonFile);
      const levelMatch = neonContent.match(/level:\s*(\d+)/);
      if (levelMatch) {
        const level = parseInt(levelMatch[1], 10);
        if (level < 6) {
          gaps.push({
            file: path.relative(projectPath, neonFile),
            className: null,
            method: null,
            complexity: 0,
            priority: "medium",
            reason: `PHPStan level ${level} — recommend level 6+ for meaningful type coverage`,
            framework: "static",
          });
        }
      }
    }

    return {
      gaps,
      summary: { framework: "static", totalFiles: configs.length, testedFiles: configured, untestedFiles: configs.length - configured, coveragePercent: Math.round((configured / configs.length) * 100) },
    };
  }

  // -------------------------------------------------------------------------
  // Performance Tests (JMeter / Gatling / k6)
  // -------------------------------------------------------------------------

  private analyzePerformance(
    projectPath: string,
    options: CoverageOptions,
  ): { gaps: CoverageGap[]; summary: FrameworkSummary } {
    const gaps: CoverageGap[] = [];

    // Look for performance test artifacts
    const perfPatterns = [
      path.join(projectPath, "dev/tests/performance/**/*.{jmx,scala,js,ts}"),
      path.join(projectPath, "tests/performance/**/*.{jmx,scala,js,ts}"),
      path.join(projectPath, "perf/**/*.{jmx,scala,js,ts}"),
    ].map((p) => p.replace(/\\/g, "/"));
    const perfFiles = fg.sync(perfPatterns);

    // Critical flows that need performance testing
    const criticalFlows = [
      { name: "Catalog Browse", pattern: /catalog|category|product.list/i },
      { name: "Product Detail Page", pattern: /product.view|product.info/i },
      { name: "Add to Cart", pattern: /cart|checkout.cart/i },
      { name: "Checkout Flow", pattern: /checkout|payment|place.order/i },
      { name: "Search", pattern: /search|catalogsearch/i },
      { name: "Customer Login", pattern: /customer.*login|customer.*account/i },
    ];

    const perfContent = perfFiles.map((f) => this.read(f)).join("\n").toLowerCase();
    let testedCount = 0;

    for (const flow of criticalFlows) {
      if (perfContent.match(flow.pattern)) {
        testedCount++;
      } else {
        gaps.push({
          file: "performance-tests/",
          className: null,
          method: flow.name,
          complexity: 0,
          priority: "high",
          reason: `Critical revenue flow "${flow.name}" has no performance test — load/stress testing needed`,
          framework: "performance",
        });
      }
    }

    return {
      gaps,
      summary: { framework: "performance", totalFiles: criticalFlows.length, testedFiles: testedCount, untestedFiles: criticalFlows.length - testedCount, coveragePercent: criticalFlows.length > 0 ? Math.round((testedCount / criticalFlows.length) * 100) : 0 },
    };
  }

  // =========================================================================
  // Detection strategies
  // =========================================================================

  private buildCoveredSet(
    testFiles: string[],
    strategy: DetectionStrategy,
  ): { byName: Set<string>; byNamespace: Set<string>; byAnnotation: Set<string> } {
    const byName = new Set<string>();
    const byNamespace = new Set<string>();
    const byAnnotation = new Set<string>();

    for (const tf of testFiles) {
      // Filename convention
      const name = path.basename(tf, ".php").replace(/Test$|IntegrationTest$/, "");
      byName.add(name);

      // Namespace mapping (mirror src → test)
      const ns = this.extractNamespace(tf);
      if (ns) {
        const srcNs = ns.replace(/\\Test\\(Unit|Integration)\\?/, "\\");
        byNamespace.add(srcNs);
      }

      // Annotation scanning
      if (strategy === "annotation" || strategy === "all") {
        const content = this.read(tf);
        const covers = content.match(/@covers\s+([\w\\]+)/g) || [];
        const coversDefault = content.match(/@coversDefaultClass\s+([\w\\]+)/g) || [];
        for (const c of [...covers, ...coversDefault]) {
          const fqcn = c.replace(/@covers(DefaultClass)?\s+/, "").trim();
          byAnnotation.add(fqcn);
          // Also add short class name
          const short = fqcn.split("\\").pop();
          if (short) byAnnotation.add(short);
        }
      }
    }

    return { byName, byNamespace, byAnnotation };
  }

  private isCovered(
    className: string,
    namespace: string | null,
    covered: { byName: Set<string>; byNamespace: Set<string>; byAnnotation: Set<string> },
    strategy: DetectionStrategy,
  ): boolean {
    if (strategy === "filename") return covered.byName.has(className);
    if (strategy === "namespace") return namespace ? covered.byNamespace.has(namespace) : covered.byName.has(className);
    if (strategy === "annotation") return covered.byAnnotation.has(className) || (namespace ? covered.byAnnotation.has(namespace) : false);
    // "all" — any strategy matches
    return covered.byName.has(className)
      || (namespace ? covered.byNamespace.has(namespace) : false)
      || covered.byAnnotation.has(className)
      || (namespace ? covered.byAnnotation.has(namespace) : false);
  }

  // =========================================================================
  // Priority scoring (all 6 factors)
  // =========================================================================

  private computePriority(
    rel: string,
    content: string,
    complexity: number,
    churnMap: Map<string, number>,
    fanInMap: Map<string, number>,
  ): CoverageGap["priority"] {
    let score = 0;

    // Factor 1: Cyclomatic complexity
    if (complexity > 15) score += 4;
    else if (complexity > 10) score += 3;
    else if (complexity > 5) score += 2;

    // Factor 2: Revenue path
    if (REVENUE_PATHS.test(rel)) score += 4;

    // Factor 3: Plugin / Observer
    if (/Plugin|Interceptor/i.test(rel)) score += 4;
    if (/Observer|EventHandler/i.test(rel)) score += 3;

    // Factor 4: Public API
    if (/Api\//i.test(rel) || content.includes("@api")) score += 3;

    // Factor 5: Git churn (recent changes)
    const churn = churnMap.get(rel) || 0;
    if (churn >= 10) score += 3;
    else if (churn >= 5) score += 2;
    else if (churn >= 2) score += 1;

    // Factor 6: Dependency fan-in
    const className = path.basename(rel, ".php");
    const fanIn = fanInMap.get(className) || 0;
    if (fanIn >= 10) score += 3;
    else if (fanIn >= 5) score += 2;
    else if (fanIn >= 3) score += 1;

    if (score >= 8) return "critical";
    if (score >= 5) return "high";
    if (score >= 3) return "medium";
    return "low";
  }

  // =========================================================================
  // Utility methods
  // =========================================================================

  private discoverPhpSource(projectPath: string, module: string | null): string[] {
    const srcPattern = module
      ? path.join(projectPath, `app/code/${module}/**/*.php`)
      : path.join(projectPath, "app/code/**/*.php");
    return fg.sync(srcPattern.replace(/\\/g, "/"), { ignore: ["**/Test/**", "**/tests/**"] });
  }

  private extractNamespace(filePath: string): string | null {
    const content = this.read(filePath);
    const match = content.match(/^namespace\s+([\w\\]+);/m);
    return match ? `${match[1]}\\${path.basename(filePath, ".php")}` : null;
  }

  private extractRouteKey(rel: string): string | null {
    // app/code/Vendor/Module/Controller/Adminhtml/Order/View.php
    //  → adminhtml_order_view or module_order_view
    const parts = rel.replace(/\\/g, "/").split("/");
    const ctrlIdx = parts.indexOf("Controller");
    if (ctrlIdx < 0) return null;
    const after = parts.slice(ctrlIdx + 1).map((s) => s.replace(".php", "").toLowerCase());
    return after.join("_");
  }

  private buildChurnMap(projectPath: string): Map<string, number> {
    const churnMap = new Map<string, number>();
    try {
      const output = execSync("git log --since='30 days ago' --name-only --pretty=format:''", {
        cwd: projectPath,
        encoding: "utf-8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      for (const line of output.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && trimmed.endsWith(".php")) {
          churnMap.set(trimmed, (churnMap.get(trimmed) || 0) + 1);
        }
      }
    } catch {
      // Not a git repo or git not available — skip churn analysis
    }
    return churnMap;
  }

  private buildFanInMap(projectPath: string, module: string | null): Map<string, number> {
    const fanInMap = new Map<string, number>();
    const diPattern = module
      ? path.join(projectPath, `app/code/${module}/**/etc/di.xml`)
      : path.join(projectPath, "app/code/**/etc/di.xml");
    const diFiles = fg.sync(diPattern.replace(/\\/g, "/"));

    for (const df of diFiles) {
      const content = this.read(df);
      // Count class references in DI config
      const refs = content.match(/type="([^"]+)"|class="([^"]+)"/g) || [];
      for (const ref of refs) {
        const fqcn = ref.replace(/type="|class="|"/g, "");
        const short = fqcn.split("\\").pop() || fqcn;
        fanInMap.set(short, (fanInMap.get(short) || 0) + 1);
      }
    }
    return fanInMap;
  }

  private read(fp: string): string {
    try { return fs.readFileSync(fp, "utf-8"); } catch { return ""; }
  }

  private isInterface(content: string): boolean {
    return /\binterface\s+\w+/m.test(content) && !/\bclass\s+\w+/m.test(content);
  }

  private isConstantsOnly(content: string): boolean {
    return /\bclass\s+\w+Constants\b/.test(content);
  }

  private estimateComplexity(content: string): number {
    const branches = (content.match(/\bif\b|\belse\b|\bswitch\b|\bcase\b|\bcatch\b|\b\?\s*:/g) || []).length;
    return Math.min(branches + 1, 50);
  }

  private estimateJsComplexity(content: string): number {
    const branches = (content.match(/\bif\b|\belse\b|\bswitch\b|\bcase\b|\bcatch\b|\?\s*:/g) || []).length;
    const callbacks = (content.match(/function\s*\(|=>\s*\{/g) || []).length;
    return Math.min(branches + Math.floor(callbacks / 2) + 1, 50);
  }

  private reason(rel: string, content: string, framework: TestFramework): string {
    if (framework === "integration") {
      if (/ResourceModel/i.test(rel)) return "ResourceModel — test DB read/write with integration framework";
      if (/Repository/i.test(rel)) return "Repository — test service contract with real database";
      if (content.includes("eventManager")) return "Dispatches events — test full observer chain with integration framework";
      return "Requires Magento bootstrap — unit test insufficient, needs integration test";
    }
    // unit test reasons
    if (/Plugin/i.test(rel)) return "Plugin modifies core behavior — high regression risk without unit test";
    if (/Observer/i.test(rel)) return "Observer handles events — side effects need unit verification";
    if (/Api\//i.test(rel)) return "Public API contract — must verify interface compliance";
    if (/Repository/i.test(rel)) return "Repository manages data — CRUD operations need validation";
    if (content.includes("ObjectManager")) return "Uses ObjectManager — verify DI correctness";
    if (REVENUE_PATHS.test(rel)) return "Revenue-critical path — requires comprehensive test coverage";
    return "No test coverage found";
  }

  private priorityWeight(p: CoverageGap["priority"]): number {
    return { critical: 0, high: 1, medium: 2, low: 3 }[p];
  }
}
