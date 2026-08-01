/**
 * EDS-Commerce Scanner — Integration Scans
 * ==========================================
 * Rules: EDSC-INT-001, EDSC-INT-002
 */
import * as path from "path";
import { EdsCommerceScannerContext } from "./context";

// ==================== EDSC-INT-001: Missing Event-Driven Communication ====================

export function scanEventCommunication(ctx: EdsCommerceScannerContext): void {
  const blockJs = ctx.blockJsFiles();

  for (const fp of blockJs) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // Cross-block imports (importing from sibling block folder)
    for (const hit of ctx.grep(fp, /import\s+.*from\s+['"]\.\.\/(?!scripts|lib|utils)\w+\//)) {
      // Skip imports from scripts/ or shared utilities
      const importPath = hit.lineText.match(/from\s+['"]([^'"]+)['"]/)?.[1] || "";
      if (importPath.includes("scripts/") || importPath.includes("lib/") || importPath.includes("utils")) continue;

      ctx.add(
        "Integration", mod, fp, hit.lineNum,
        "Cross-Block Import",
        "Direct import from another block — creates tight coupling between blocks",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Use CustomEvents or dropin events for inter-block communication. Import from scripts/ for shared utilities.",
        "Medium", "Block fails if the imported block is removed from page"
      );
    }

    // Direct manipulation of other blocks
    for (const hit of ctx.grep(fp, /document\.querySelector\s*\(\s*['"]\.(?!block)[^'"]*block/)) {
      ctx.add(
        "Integration", mod, fp, hit.lineNum,
        "Direct Block Manipulation",
        "Querying another block's DOM directly — creates fragile coupling",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Use document.dispatchEvent(new CustomEvent('commerce:*', { detail })) for cross-block communication.",
        "Low", "Target block may not exist on all pages"
      );
    }
  }
}

// ==================== EDSC-INT-002: Inconsistent Price Formatting ====================

export function scanPriceFormatting(ctx: EdsCommerceScannerContext): void {
  const allJs = ctx.allJsFiles();

  for (const fp of allJs) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // Hardcoded dollar sign with toFixed
    for (const hit of ctx.grep(fp, /[`'"]\$\$?\{.*\.toFixed\s*\(\s*2\s*\)/)) {
      ctx.add(
        "Integration", mod, fp, hit.lineNum,
        "Hardcoded Currency Format",
        "Price formatted with hardcoded $ and toFixed(2) — wrong for non-USD stores",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Use Intl.NumberFormat(locale, { style: 'currency', currency }) from Commerce config.",
        "Low", "Wrong currency symbol, wrong decimal format for international stores"
      );
    }

    // Manual toFixed without Intl
    for (const hit of ctx.grep(fp, /price.*\.toFixed\s*\(\s*2\s*\)|\.toFixed\s*\(\s*2\s*\).*price/)) {
      if (content.includes("Intl.NumberFormat")) continue; // Already using proper formatting

      ctx.add(
        "Integration", mod, fp, hit.lineNum,
        "Manual Price Formatting",
        "Using .toFixed(2) for price display — doesn't handle locale-specific formatting",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Use Intl.NumberFormat with locale and currency from Commerce configuration.",
        "Low", "JPY has 0 decimals, some locales use comma as decimal separator"
      );
    }

    // Hardcoded currency code
    for (const hit of ctx.grep(fp, /['"]USD['"](?!.*getConfig|.*getMetadata|.*config)/)) {
      if (hit.lineText.includes("//") || hit.lineText.includes("default")) continue;

      ctx.add(
        "Integration", mod, fp, hit.lineNum,
        "Hardcoded Currency Code",
        "Currency code 'USD' hardcoded — should come from Commerce configuration",
        ctx.context(fp, hit.lineNum), "LOW",
        "Use getConfig('commerce-currency') or read from product.price.currency field.",
        "Low", "Breaks for multi-store with different currencies"
      );
    }
  }
}
