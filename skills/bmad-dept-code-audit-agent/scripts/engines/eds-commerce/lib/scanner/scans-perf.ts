/**
 * EDS-Commerce Scanner — Performance Scans
 * ===========================================
 * Rules: EDSC-PERF-001 through EDSC-PERF-004
 */
import * as fs from "fs";
import * as path from "path";
import { EdsCommerceScannerContext } from "./context";

// ==================== EDSC-PERF-001: Excessive GraphQL Calls ====================

export function scanExcessiveGraphql(ctx: EdsCommerceScannerContext): void {
  const allJs = ctx.allJsFiles();

  for (const fp of allJs) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // Count sequential await fetch to graphql
    const lines = content.split("\n");
    let sequentialFetches = 0;
    let firstFetchLine = 0;

    for (let i = 0; i < lines.length; i++) {
      if (/await\s+(fetch|.*\.query)\s*\(/.test(lines[i]) &&
          (lines[i].includes("graphql") || content.includes("graphql"))) {
        sequentialFetches++;
        if (sequentialFetches === 1) firstFetchLine = i + 1;
      } else if (/^[\s]*$/.test(lines[i]) || /\/\//.test(lines[i])) {
        // Skip blank lines and comments
      } else if (sequentialFetches > 0 && !/await/.test(lines[i])) {
        // Non-await line breaks the sequence
        if (sequentialFetches >= 3) {
          ctx.add(
            "Performance", mod, fp, firstFetchLine,
            "Sequential GraphQL Waterfall",
            `${sequentialFetches} sequential await fetch/query calls — creates request waterfall`,
            ctx.context(fp, firstFetchLine), "HIGH",
            "Use Promise.all() for independent queries or batch into a single GraphQL request.",
            "Medium", `${sequentialFetches} round trips × latency = slow page load`
          );
        }
        sequentialFetches = 0;
      }
    }

    // Also check for Promise.all missing when multiple fetches exist
    const fetchCount = (content.match(/await\s+fetch\s*\(/g) || []).length;
    if (fetchCount >= 3 && !content.includes("Promise.all") && !content.includes("Promise.allSettled")) {
      ctx.add(
        "Performance", mod, fp, 1,
        "Missing Request Parallelization",
        `${fetchCount} fetch calls without Promise.all() — likely sequential waterfall`,
        "", "MEDIUM",
        "Parallelize independent requests with Promise.all([fetch(...), fetch(...), ...]).",
        "Low", "Sequential requests add cumulative latency"
      );
    }
  }
}

// ==================== EDSC-PERF-002: Missing Product Data Caching ====================

export function scanMissingCaching(ctx: EdsCommerceScannerContext): void {
  const commerceBlocks = ctx.commerceBlockFiles();

  for (const fp of commerceBlocks) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // Has fetch calls but no caching
    if (/fetch\s*\(/.test(content)) {
      const hasCache = /sessionStorage|localStorage|cache|Cache/.test(content);
      if (!hasCache) {
        ctx.add(
          "Performance", mod, fp, 1,
          "Missing Commerce Data Caching",
          "Commerce block fetches data on every load without client-side caching",
          "", "MEDIUM",
          "Cache product/category data in sessionStorage with TTL. Avoid caching cart/price data.",
          "Low", "Re-fetches same data on page revisits — unnecessary API load"
        );
      }
    }
  }
}

// ==================== EDSC-PERF-003: Loading All Dropins Eagerly ====================

export function scanEagerDropinLoading(ctx: EdsCommerceScannerContext): void {
  const allJs = ctx.allJsFiles();

  // Check scripts.js / commerce.js for static dropin imports
  for (const fp of allJs) {
    const rel = ctx.rel(fp);
    if (!rel.startsWith("scripts/")) continue;

    const mod = ctx.module(fp);

    // Static imports of dropins in script files (loaded on all pages)
    for (const hit of ctx.grep(fp, /^import\s+.*from\s+['"]@dropins\/storefront-/)) {
      ctx.add(
        "Performance", mod, fp, hit.lineNum,
        "Eager Dropin Import",
        "Static import of Commerce dropin in scripts/ — loads on ALL pages regardless of need",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Use dynamic import() inside the block that needs it: const { X } = await import('@dropins/...')",
        "Low", "Each dropin is 50-150KB — loading all on every page destroys performance"
      );
    }
  }

  // Count how many different dropin packages are imported in a single block
  for (const fp of ctx.blockJsFiles()) {
    const content = ctx.read(fp);
    const dropinImports = content.match(/@dropins\/storefront-\w+/g) || [];
    const uniqueDropins = new Set(dropinImports);

    if (uniqueDropins.size >= 3) {
      ctx.add(
        "Performance", ctx.module(fp), fp, 1,
        "Too Many Dropins in Single Block",
        `Block imports ${uniqueDropins.size} different dropin packages — likely over-coupled`,
        `Packages: ${[...uniqueDropins].join(", ")}`,
        "MEDIUM",
        "Split into separate blocks, each loading only the dropin it needs.",
        "Medium", "Large combined bundle size for a single block"
      );
    }
  }
}

// ==================== EDSC-PERF-004: Unoptimized Product Images ====================

export function scanProductImages(ctx: EdsCommerceScannerContext): void {
  const allJs = ctx.allJsFiles();

  for (const fp of allJs) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // Product image URL used without optimization
    for (const hit of ctx.grep(fp, /\.image\.url(?!.*\?width|.*resize|.*createOptimizedPicture)/)) {
      ctx.add(
        "Performance", mod, fp, hit.lineNum,
        "Unoptimized Product Image",
        "Product image URL used without size optimization",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Pass product.image.url through createOptimizedPicture() or append ?width= parameter.",
        "Low", "Full catalog images (2000×2000) served to all devices"
      );
    }

    // Direct img.src with media/catalog
    for (const hit of ctx.grep(fp, /\.src\s*=.*media\/catalog(?!.*width)/)) {
      ctx.add(
        "Performance", mod, fp, hit.lineNum,
        "Unresized Catalog Image",
        "Catalog image set directly without resize parameters",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Use Commerce resize URL pattern or createOptimizedPicture() with responsive breakpoints.",
        "Low", "Large images waste bandwidth on mobile"
      );
    }
  }
}
