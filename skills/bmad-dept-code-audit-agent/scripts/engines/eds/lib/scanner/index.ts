/**
 * EDS Audit Scanner — Main entry point
 * ======================================
 * Orchestrates all EDS scan categories and produces FindingsMap.
 */
import { EdsScannerContext } from "./context";
import { FindingsMap } from "../../../../shared/base";
import { scanBlockStructure, scanDomScope, scanLoadingStrategy, scanBlockVariants } from "./scans-arch";
import { scanRenderBlockingScripts, scanUnoptimizedImages, scanLargeBundles, scanClsIssues, scanResourceHints } from "./scans-perf";
import { scanInlineHandlers, scanInnerHtmlXss, scanCsp } from "./scans-security";
import { scanMetadata, scanHeadingHierarchy, scanFetchErrorHandling, scanGlobalPollution, scanAccessibility } from "./scans-quality";

export interface EdsScannerOptions {
  root: string;
}

export class EdsAuditScanner {
  private ctx: EdsScannerContext;

  constructor(options: EdsScannerOptions) {
    this.ctx = new EdsScannerContext(options.root);
  }

  scan(): FindingsMap {
    const { ctx } = this;

    console.log(`[eds] Scanning: ${ctx.root}`);
    console.log(`[eds] Block JS files: ${ctx.blockJsFiles().length}`);
    console.log(`[eds] Script files: ${ctx.scriptFiles().length}`);
    console.log(`[eds] Block CSS files: ${ctx.blockCssFiles().length}`);

    // Architecture scans (EDS-ARCH-001 through 004)
    this.runSafe("Block Structure", () => scanBlockStructure(ctx));
    this.runSafe("DOM Scope", () => scanDomScope(ctx));
    this.runSafe("Loading Strategy", () => scanLoadingStrategy(ctx));
    this.runSafe("Block Variants", () => scanBlockVariants(ctx));

    // Performance scans (EDS-PERF-001 through 005)
    this.runSafe("Render-Blocking Scripts", () => scanRenderBlockingScripts(ctx));
    this.runSafe("Unoptimized Images", () => scanUnoptimizedImages(ctx));
    this.runSafe("Large Bundles", () => scanLargeBundles(ctx));
    this.runSafe("CLS Issues", () => scanClsIssues(ctx));
    this.runSafe("Resource Hints", () => scanResourceHints(ctx));

    // Security scans (EDS-SEC-001 through 003)
    this.runSafe("Inline Handlers", () => scanInlineHandlers(ctx));
    this.runSafe("innerHTML XSS", () => scanInnerHtmlXss(ctx));
    this.runSafe("CSP", () => scanCsp(ctx));

    // SEO + Quality scans (EDS-SEO-001/002, EDS-QUAL-001 through 003)
    this.runSafe("Metadata", () => scanMetadata(ctx));
    this.runSafe("Heading Hierarchy", () => scanHeadingHierarchy(ctx));
    this.runSafe("Fetch Error Handling", () => scanFetchErrorHandling(ctx));
    this.runSafe("Global Pollution", () => scanGlobalPollution(ctx));
    this.runSafe("Accessibility", () => scanAccessibility(ctx));

    const totalFindings = Object.values(ctx.findings).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[eds] Scan complete: ${totalFindings} findings in ${Object.keys(ctx.findings).length} categories`);

    return ctx.findings;
  }

  private runSafe(label: string, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.error(`[eds] Scan error in "${label}":`, err);
    }
  }
}
