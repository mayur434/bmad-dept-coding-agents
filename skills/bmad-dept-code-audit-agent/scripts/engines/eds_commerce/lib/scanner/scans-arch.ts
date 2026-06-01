/**
 * EDS-Commerce Scanner — Architecture Scans
 * ============================================
 * Rules: EDSC-ARCH-001 through EDSC-ARCH-004
 */
import * as fs from "fs";
import * as path from "path";
import { EdsCommerceScannerContext } from "./context";

// ==================== EDSC-ARCH-001: Dropin Component Misuse ====================

export function scanDropinMisuse(ctx: EdsCommerceScannerContext): void {
  const allJs = ctx.allJsFiles();

  for (const fp of allJs) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // Only check files that interact with dropins
    if (!content.includes("dropin") && !content.includes("@dropins")) continue;

    // Direct DOM manipulation of dropin internals
    const badPatterns: Array<{ pattern: RegExp; type: string; desc: string }> = [
      {
        pattern: /querySelector\s*\(\s*['"]\.dropin-/,
        type: "Dropin Internal DOM Query",
        desc: "Querying dropin internal DOM elements — breaks on version updates",
      },
      {
        pattern: /querySelector\s*\(\s*['"]\.commerce-/,
        type: "Commerce Dropin DOM Query",
        desc: "Directly querying commerce dropin classes — use dropin API instead",
      },
      {
        pattern: /dropin.*\.innerHTML\s*=/,
        type: "Dropin innerHTML Override",
        desc: "Setting innerHTML on dropin elements — bypasses dropin state management",
      },
      {
        pattern: /dropin.*\.style\./,
        type: "Dropin Inline Style",
        desc: "Directly styling dropin internals — breaks on CSS updates",
      },
    ];

    for (const { pattern, type, desc } of badPatterns) {
      for (const hit of ctx.grep(fp, pattern)) {
        ctx.add(
          "Architecture", mod, fp, hit.lineNum,
          type, desc,
          ctx.context(fp, hit.lineNum), "HIGH",
          "Use dropin's official API: render() with slots, .api methods, and .events for customization.",
          "Medium", "Dropin version updates will break direct DOM manipulation"
        );
      }
    }
  }
}

// ==================== EDSC-ARCH-002: Missing Commerce Context Provider ====================

export function scanCommerceContext(ctx: EdsCommerceScannerContext): void {
  const commerceJs = ctx.commerceScriptFile();
  const allJs = ctx.allJsFiles();

  // Check if any block uses dropin imports
  const dropinBlocks: string[] = [];
  for (const fp of allJs) {
    if (ctx.hasDropinImport(fp) && ctx.rel(fp).startsWith("blocks/")) {
      dropinBlocks.push(fp);
    }
  }

  if (dropinBlocks.length === 0) return; // No commerce dropins used

  // Check for centralized initialization
  if (!commerceJs) {
    ctx.add(
      "Architecture", "scripts", path.join(ctx.root, "scripts", "commerce.js"), 0,
      "Missing Commerce Initialization",
      "Project uses Commerce dropins but has no scripts/commerce.js for centralized initialization",
      `${dropinBlocks.length} block(s) import from @dropins but no commerce.js found`,
      "HIGH",
      "Create scripts/commerce.js with initializeDropin() — all dropin blocks should await this.",
      "Medium", "Dropins may fail silently without proper context initialization"
    );
  } else {
    const commerceContent = ctx.read(commerceJs);

    // Check if initializeDropin is called
    if (!commerceContent.includes("initializeDropin")) {
      ctx.add(
        "Architecture", "scripts", commerceJs, 1,
        "Missing initializeDropin",
        "Commerce script exists but doesn't call initializeDropin()",
        "", "HIGH",
        "Add initializeDropin() call with environmentId, endpoint, storeCode configuration.",
        "Medium", "Dropins render empty without proper initialization"
      );
    }
  }

  // Check for duplicate initialization in blocks
  for (const fp of dropinBlocks) {
    const content = ctx.read(fp);
    if (content.includes("initializeDropin")) {
      ctx.add(
        "Architecture", ctx.module(fp), fp, 1,
        "Duplicate Commerce Initialization",
        "Block calls initializeDropin() — should be done once in scripts/commerce.js",
        "", "HIGH",
        "Remove initializeDropin() from block. Import the ready promise from scripts/commerce.js instead.",
        "Low", "Multiple initializations cause race conditions and conflicting config"
      );
    }
  }
}

// ==================== EDSC-ARCH-003: Hardcoded Commerce Endpoints ====================

export function scanHardcodedEndpoints(ctx: EdsCommerceScannerContext): void {
  const allJs = ctx.allJsFiles();

  const hardcodedPatterns: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /['"]https?:\/\/[^'"]*\/(graphql)['"]/, type: "Hardcoded GraphQL Endpoint" },
    { pattern: /['"]https?:\/\/[^'"]*\/rest\/V\d['"]/, type: "Hardcoded REST Endpoint" },
    { pattern: /['"]https?:\/\/[^'"]*\/media\/catalog['"]/, type: "Hardcoded Media URL" },
    { pattern: /['"]https?:\/\/[^'"]*magento[^'"]*['"]/, type: "Hardcoded Magento URL" },
    { pattern: /['"]https?:\/\/[^'"]*commerce[^'"]*\.adobe[^'"]*['"]/, type: "Hardcoded Commerce URL" },
  ];

  for (const fp of allJs) {
    const mod = ctx.module(fp);
    const rel = ctx.rel(fp);

    // Skip dropin internals
    if (rel.includes("__dropins")) continue;

    for (const { pattern, type } of hardcodedPatterns) {
      for (const hit of ctx.grep(fp, pattern)) {
        // Skip if it's using config/metadata
        if (hit.lineText.includes("getConfig") || hit.lineText.includes("getMetadata")) continue;

        ctx.add(
          "Architecture", mod, fp, hit.lineNum,
          type,
          "Commerce endpoint hardcoded — breaks across environments (dev/stage/prod)",
          ctx.context(fp, hit.lineNum), "CRITICAL",
          "Use getConfig('commerce-endpoint') or getMetadata() for environment-specific URLs.",
          "Low", "Will fail when deployed to different environment"
        );
      }
    }
  }
}

// ==================== EDSC-ARCH-004: Missing Fallback for Commerce Failures ====================

export function scanCommerceFallback(ctx: EdsCommerceScannerContext): void {
  const commerceBlocks = ctx.commerceBlockFiles();

  for (const fp of commerceBlocks) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // Block uses fetch or dropin render but no error handling
    const hasFetch = /await\s+fetch\s*\(/.test(content) || /\.render\s*\(/.test(content);
    if (!hasFetch) continue;

    const hasTryCatch = /try\s*\{/.test(content);
    const hasCatch = /\.catch\s*\(/.test(content);
    const hasFallback = /fallback|error|skeleton|loading/.test(content.toLowerCase());

    if (!hasTryCatch && !hasCatch) {
      ctx.add(
        "Architecture", mod, fp, 1,
        "Missing Commerce Error Handling",
        "Commerce block has no try/catch around API/dropin calls — breaks silently on failure",
        "", "HIGH",
        "Wrap in try/catch with fallback UI. Show skeleton while loading, error message on failure.",
        "Low", "API downtime leaves block empty — bad UX and SEO"
      );
    } else if (!hasFallback) {
      ctx.add(
        "Architecture", mod, fp, 1,
        "Missing Fallback UI",
        "Commerce block catches errors but shows no fallback UI to users",
        "", "MEDIUM",
        "Add fallback rendering (cached data, static message, or skeleton) in catch block.",
        "Low", "Silent error handling still leaves block broken for users"
      );
    }
  }
}
