/**
 * AEM Audit Scanner — Orchestrator
 * ==================================
 * Runs all scan modules and returns combined FindingsMap
 */
import { FindingsMap } from "../../../../shared/base";
import { AemScannerContext } from "./context";

// Architecture scans
import { scanContentSeparation, scanClassicUi, scanCustomRunmodes, scanLibsOverlay, scanRepoinit } from "./scans-arch";
// Sling/OSGi scans
import { scanResolverLeak, scanDeprecatedSlingServlet, scanJcrSessionLeak, scanFelixScr, scanSlingModelValidation } from "./scans-sling";
// Performance scans
import { scanAsyncProcessing, scanUnboundedQueries, scanModelCaching, scanClientlibSize } from "./scans-perf";
// Security scans
import { scanHardcodedCredentials, scanDispatcherRules, scanHtlXss, scanServiceUserPermissions } from "./scans-security";
// Cloud Readiness scans
import { scanFilesystemAccess, scanInstallHooks, scanOakIndex, scanSchedulerLeader } from "./scans-cloud";

export class AemAuditScanner {
  private ctx: AemScannerContext;

  constructor(opts: { root: string }) {
    this.ctx = new AemScannerContext(opts.root);
  }

  scan(): FindingsMap {
    // === Architecture ===
    scanContentSeparation(this.ctx);
    scanClassicUi(this.ctx);
    scanCustomRunmodes(this.ctx);
    scanLibsOverlay(this.ctx);
    scanRepoinit(this.ctx);

    // === Sling/OSGi ===
    scanResolverLeak(this.ctx);
    scanDeprecatedSlingServlet(this.ctx);
    scanJcrSessionLeak(this.ctx);
    scanFelixScr(this.ctx);
    scanSlingModelValidation(this.ctx);

    // === Performance ===
    scanAsyncProcessing(this.ctx);
    scanUnboundedQueries(this.ctx);
    scanModelCaching(this.ctx);
    scanClientlibSize(this.ctx);

    // === Security ===
    scanHardcodedCredentials(this.ctx);
    scanDispatcherRules(this.ctx);
    scanHtlXss(this.ctx);
    scanServiceUserPermissions(this.ctx);

    // === Cloud Readiness ===
    scanFilesystemAccess(this.ctx);
    scanInstallHooks(this.ctx);
    scanOakIndex(this.ctx);
    scanSchedulerLeader(this.ctx);

    console.log(`[aem] Scan complete — ${JSON.stringify(this.ctx.stats)}`);
    return this.ctx.findings;
  }
}
