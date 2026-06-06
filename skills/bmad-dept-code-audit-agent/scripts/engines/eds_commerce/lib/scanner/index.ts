/**
 * EDS-Commerce Audit Scanner — Main entry point
 * ================================================
 * Orchestrates EDS base scans + Commerce-specific scans.
 */
import { EdsCommerceScannerContext } from "./context";
import { FindingsMap } from "../../../../shared/base";

// EDS base scans (reused)
import { scanBlockStructure, scanDomScope, scanLoadingStrategy, scanBlockVariants } from "../../../eds/lib/scanner/scans-arch";
import { scanRenderBlockingScripts, scanUnoptimizedImages, scanLargeBundles, scanClsIssues, scanResourceHints } from "../../../eds/lib/scanner/scans-perf";
import { scanInlineHandlers, scanInnerHtmlXss, scanCsp } from "../../../eds/lib/scanner/scans-security";
import { scanMetadata, scanHeadingHierarchy, scanFetchErrorHandling, scanGlobalPollution, scanAccessibility } from "../../../eds/lib/scanner/scans-quality";

// Commerce-specific scans
import { scanDropinMisuse, scanCommerceContext, scanHardcodedEndpoints, scanCommerceFallback } from "./scans-arch";
import { scanExcessiveGraphql, scanMissingCaching, scanEagerDropinLoading, scanProductImages } from "./scans-perf";
import { scanExposedTokens, scanCartValidation, scanPciCompliance } from "./scans-security";
import { scanEventCommunication, scanPriceFormatting } from "./scans-integration";

export interface EdsCommerceScannerOptions {
  root: string;
}

export class EdsCommerceAuditScanner {
  private ctx: EdsCommerceScannerContext;

  constructor(options: EdsCommerceScannerOptions) {
    this.ctx = new EdsCommerceScannerContext(options.root);
  }

  scan(): FindingsMap {
    const { ctx } = this;

    console.log(`[eds-commerce] Scanning: ${ctx.root}`);
    console.log(`[eds-commerce] Block JS files: ${ctx.blockJsFiles().length}`);
    console.log(`[eds-commerce] Commerce blocks: ${ctx.commerceBlockFiles().length}`);
    console.log(`[eds-commerce] Script files: ${ctx.scriptFiles().length}`);

    // ─── EDS Base Scans (inherited) ────────────────────────────────

    // Architecture
    this.runSafe("Block Structure", () => scanBlockStructure(ctx));
    this.runSafe("DOM Scope", () => scanDomScope(ctx));
    this.runSafe("Loading Strategy", () => scanLoadingStrategy(ctx));
    this.runSafe("Block Variants", () => scanBlockVariants(ctx));

    // Performance
    this.runSafe("Render-Blocking Scripts", () => scanRenderBlockingScripts(ctx));
    this.runSafe("Unoptimized Images", () => scanUnoptimizedImages(ctx));
    this.runSafe("Large Bundles", () => scanLargeBundles(ctx));
    this.runSafe("CLS Issues", () => scanClsIssues(ctx));
    this.runSafe("Resource Hints", () => scanResourceHints(ctx));

    // Security
    this.runSafe("Inline Handlers", () => scanInlineHandlers(ctx));
    this.runSafe("innerHTML XSS", () => scanInnerHtmlXss(ctx));
    this.runSafe("CSP", () => scanCsp(ctx));

    // Quality
    this.runSafe("Metadata", () => scanMetadata(ctx));
    this.runSafe("Heading Hierarchy", () => scanHeadingHierarchy(ctx));
    this.runSafe("Fetch Error Handling", () => scanFetchErrorHandling(ctx));
    this.runSafe("Global Pollution", () => scanGlobalPollution(ctx));
    this.runSafe("Accessibility", () => scanAccessibility(ctx));

    // ─── Commerce-Specific Scans ───────────────────────────────────

    // Architecture (EDSC-ARCH-001 through 004)
    this.runSafe("Dropin Misuse", () => scanDropinMisuse(ctx));
    this.runSafe("Commerce Context", () => scanCommerceContext(ctx));
    this.runSafe("Hardcoded Endpoints", () => scanHardcodedEndpoints(ctx));
    this.runSafe("Commerce Fallback", () => scanCommerceFallback(ctx));

    // Performance (EDSC-PERF-001 through 004)
    this.runSafe("Excessive GraphQL", () => scanExcessiveGraphql(ctx));
    this.runSafe("Missing Caching", () => scanMissingCaching(ctx));
    this.runSafe("Eager Dropin Loading", () => scanEagerDropinLoading(ctx));
    this.runSafe("Product Images", () => scanProductImages(ctx));

    // Security (EDSC-SEC-001 through 003)
    this.runSafe("Exposed Tokens", () => scanExposedTokens(ctx));
    this.runSafe("Cart Validation", () => scanCartValidation(ctx));
    this.runSafe("PCI Compliance", () => scanPciCompliance(ctx));

    // Integration (EDSC-INT-001, 002)
    this.runSafe("Event Communication", () => scanEventCommunication(ctx));
    this.runSafe("Price Formatting", () => scanPriceFormatting(ctx));

    const totalFindings = Object.values(ctx.findings).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[eds-commerce] Scan complete: ${totalFindings} findings in ${Object.keys(ctx.findings).length} categories`);

    return ctx.findings;
  }

  private runSafe(label: string, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.error(`[eds-commerce] Scan error in "${label}":`, err);
    }
  }
}
