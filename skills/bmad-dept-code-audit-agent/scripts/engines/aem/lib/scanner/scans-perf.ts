/**
 * AEM Scanner — Performance Scans
 * =================================
 * Rules: AEMCS-PERF-001 through AEMCS-PERF-004
 */
import * as fs from "fs";
import * as path from "path";
import { AemScannerContext } from "./context";

// ==================== AEMCS-PERF-001: Missing Async Processing ====================

export function scanAsyncProcessing(ctx: AemScannerContext): void {
  for (const fp of ctx.javaFiles()) {
    const content = ctx.read(fp);

    // Check for heavy processing in servlets/event handlers without async patterns
    const isServlet = content.includes("extends SlingAllMethodsServlet") || content.includes("extends SlingSafeMethodsServlet");
    const isEventHandler = content.includes("EventHandler") || content.includes("@EventHandler");
    const isWorkflowProcess = content.includes("WorkflowProcess");

    if (!isServlet && !isEventHandler && !isWorkflowProcess) continue;

    // Look for blocking patterns inside request handling
    const blockingPatterns = [
      /Thread\.sleep\(/,
      /\.waitFor\(/,
      /\.get\(\)\s*;/,  // blocking future.get()
    ];

    for (const pattern of blockingPatterns) {
      const hits = ctx.grep(fp, pattern);
      for (const hit of hits) {
        ctx.add(
          "Performance", ctx.module(fp), fp, hit.lineNum,
          "Blocking Operation in Request Thread",
          "Blocking call detected in request/event handler — may cause thread starvation",
          ctx.context(fp, hit.lineNum), "HIGH",
          "Use Sling Jobs (JobManager.addJob()) or Apache Sling Commons Scheduler for async processing.",
          "High", "Blocking request threads causes cascading timeouts under load"
        );
      }
    }
  }
}

// ==================== AEMCS-PERF-002: Unbounded JCR Queries ====================

export function scanUnboundedQueries(ctx: AemScannerContext): void {
  for (const fp of ctx.javaFiles()) {
    const content = ctx.read(fp);
    if (!content.includes("createQuery") && !content.includes("findResources") && !content.includes("queryBuilder")) continue;

    // SQL2/XPath queries without LIMIT
    const queryHits = ctx.grep(fp, /createQuery\s*\(|findResources\s*\(/);
    for (const hit of queryHits) {
      // Check surrounding lines for limit/setLimit
      const ctxCode = ctx.context(fp, hit.lineNum, 8);
      if (!ctxCode.includes("setLimit") && !ctxCode.includes("LIMIT") && !ctxCode.includes("p.limit")) {
        ctx.add(
          "Performance", ctx.module(fp), fp, hit.lineNum,
          "Unbounded JCR Query",
          "Query without explicit limit — can return millions of nodes and cause OOM",
          ctx.context(fp, hit.lineNum), "HIGH",
          "Set p.limit for QueryBuilder or OPTION(LIMIT n) for SQL2 queries. Use guessTotal with pagination.",
          "Low", "Unbounded queries in Cloud Service trigger query governor timeouts"
        );
      }
    }

    // Check for node.getNodes() traversal
    const traversalHits = ctx.grep(fp, /\.getNodes\(\)|\.listChildren\(\)|\.getChildren\(\)/);
    for (const hit of traversalHits) {
      ctx.add(
        "Performance", ctx.module(fp), fp, hit.lineNum,
        "Unguarded Node Traversal",
        "Tree traversal without limit check — dangerous with flat hierarchies",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Use a counter with early break or prefer indexed queries over traversal.",
        "Low", "Traversal of flat structures (>1000 children) blocks the instance"
      );
    }
  }
}

// ==================== AEMCS-PERF-003: Sling Model Caching ====================

export function scanModelCaching(ctx: AemScannerContext): void {
  for (const fp of ctx.javaFiles()) {
    const content = ctx.read(fp);
    if (!content.includes("@Model")) continue;

    // Check for expensive operations in @PostConstruct
    const postConstructHits = ctx.grep(fp, /@PostConstruct/);
    for (const hit of postConstructHits) {
      const ctxCode = ctx.context(fp, hit.lineNum, 15);
      const expensive = /queryBuilder|createQuery|getServiceResourceResolver|HTTP|HttpClient|externalizer/i.test(ctxCode);
      if (expensive) {
        ctx.add(
          "Performance", ctx.module(fp), fp, hit.lineNum,
          "Expensive @PostConstruct in Sling Model",
          "Sling Model performs expensive operation in @PostConstruct — models are per-request",
          ctx.context(fp, hit.lineNum), "MEDIUM",
          "Cache results in OSGi service or use @Self with a service lookup. Consider lazy initialization.",
          "Medium", "Per-request expensive lookups multiply under load"
        );
      }
    }
  }
}

// ==================== AEMCS-PERF-004: Client Library Size ====================

export function scanClientlibSize(ctx: AemScannerContext): void {
  const clientlibFiles = ctx.clientlibFiles();
  const MAX_JS_SIZE = 250_000; // 250KB unminified threshold
  const MAX_CSS_SIZE = 150_000;

  for (const fp of clientlibFiles) {
    if (!fp.endsWith(".js") && !fp.endsWith(".css")) continue;

    let size: number;
    try {
      size = fs.statSync(fp).size;
    } catch { continue; }

    if (fp.endsWith(".js") && size > MAX_JS_SIZE) {
      ctx.add(
        "Performance", ctx.module(fp), fp, 1,
        "Large Client Library JS",
        `JavaScript file is ${Math.round(size / 1024)}KB (threshold: ${MAX_JS_SIZE / 1000}KB) — impacts page load`,
        "", "MEDIUM",
        "Split into category-specific clientlibs, use async loading, or code-split with webpack/vite.",
        "Medium", "Large JS blocks page rendering"
      );
    }

    if (fp.endsWith(".css") && size > MAX_CSS_SIZE) {
      ctx.add(
        "Performance", ctx.module(fp), fp, 1,
        "Large Client Library CSS",
        `CSS file is ${Math.round(size / 1024)}KB (threshold: ${MAX_CSS_SIZE / 1000}KB) — blocks rendering`,
        "", "MEDIUM",
        "Split into critical/non-critical CSS, consider per-component clientlibs.",
        "Low", "Large CSS blocks first contentful paint"
      );
    }
  }
}
