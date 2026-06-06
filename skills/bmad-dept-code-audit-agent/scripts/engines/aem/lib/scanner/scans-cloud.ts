/**
 * AEM Scanner — Cloud Readiness Scans
 * =====================================
 * Rules: AEMCS-CLOUD-001 through AEMCS-CLOUD-004
 */
import * as fs from "fs";
import * as path from "path";
import { AemScannerContext } from "./context";

// ==================== AEMCS-CLOUD-001: Filesystem Access ====================

export function scanFilesystemAccess(ctx: AemScannerContext): void {
  const javaFiles = ctx.javaFiles();

  const fsPatterns = [
    { pattern: /new\s+File\s*\(\s*["'][^"']*["']\s*\)/, type: "Direct File System Access" },
    { pattern: /new\s+FileOutputStream|new\s+FileInputStream|new\s+FileWriter|new\s+FileReader/, type: "Java File I/O" },
    { pattern: /Files\.(write|createFile|createDirectory|newOutputStream)\s*\(/, type: "NIO Files Write" },
    { pattern: /System\.getProperty\s*\(\s*["'](java\.io\.tmpdir|user\.dir)["']\s*\)/, type: "Temp/Working Directory" },
  ];

  for (const fp of javaFiles) {
    const content = ctx.read(fp);
    // Skip test files
    if (fp.includes("/test/")) continue;

    for (const { pattern, type } of fsPatterns) {
      const hits = ctx.grep(fp, pattern);
      for (const hit of hits) {
        // Skip import statements
        if (hit.lineText.trimStart().startsWith("import ")) continue;

        ctx.add(
          "Cloud Readiness", ctx.module(fp), fp, hit.lineNum,
          type,
          "Direct filesystem access — not available in Cloud Service (read-only FS, ephemeral instances)",
          ctx.context(fp, hit.lineNum), "CRITICAL",
          "Use JCR/AEM Assets DAM API for persistence, or /tmp (max 6GB, non-shared) for transient processing only.",
          "High", "Filesystem is read-only and non-shared across instances in Cloud Service"
        );
      }
    }
  }
}

// ==================== AEMCS-CLOUD-002: Install Hooks ====================

export function scanInstallHooks(ctx: AemScannerContext): void {
  const hooksDir = ctx.vaultHooksDir();
  if (hooksDir) {
    let entries: string[];
    try {
      entries = fs.readdirSync(hooksDir);
    } catch { entries = []; }

    if (entries.length > 0) {
      ctx.add(
        "Cloud Readiness", "vault", hooksDir, 1,
        "Install Hooks Detected",
        `Found ${entries.length} install hook(s) in vault/hooks/ — forbidden in Cloud Service`,
        `Files: ${entries.join(", ")}`, "CRITICAL",
        "Remove install hooks. Use Sling Content Distribution, repoinit scripts, or Sling Pipes for post-install logic.",
        "High", "Install hooks are blocked by Cloud Manager validation"
      );
    }
  }

  // Also check for hooks declared in filter.xml or properties.xml
  const propFiles = [
    path.join(ctx.root, "ui.apps/src/main/content/META-INF/vault/properties.xml"),
    path.join(ctx.root, "all/src/main/content/META-INF/vault/properties.xml"),
  ];

  for (const fp of propFiles) {
    if (!fs.existsSync(fp)) continue;
    const hits = ctx.grep(fp, /installhook|InstallHook/i);
    for (const hit of hits) {
      ctx.add(
        "Cloud Readiness", ctx.module(fp), fp, hit.lineNum,
        "Install Hook Reference in properties.xml",
        "Install hook reference in vault properties — forbidden in Cloud Service",
        ctx.context(fp, hit.lineNum), "CRITICAL",
        "Remove installhook entries from properties.xml.",
        "Low", "Install hooks are blocked by Cloud Manager"
      );
    }
  }
}

// ==================== AEMCS-CLOUD-003: Custom Oak Index Definitions ====================

export function scanOakIndex(ctx: AemScannerContext): void {
  const oakFiles = ctx.oakIndexFiles();

  for (const fp of oakFiles) {
    const content = ctx.read(fp);

    // Check for type=lucene (allowed) vs type=property (deprecated for custom)
    if (content.includes('"type"') || content.includes("type=")) {
      // Lucene indexes are fine but need async
      if (content.includes("lucene")) {
        if (!content.includes("async")) {
          ctx.add(
            "Cloud Readiness", "oak-index", fp, 1,
            "Synchronous Lucene Index",
            "Lucene index without async flag — synchronous indexes block writes",
            "", "HIGH",
            "Add async=\"async\" property to lucene index definition.",
            "Low", "Synchronous lucene indexes block content write operations"
          );
        }
      }

      // Check for property indexes (need migration)
      if (content.includes("property") && !content.includes("lucene")) {
        ctx.add(
          "Cloud Readiness", "oak-index", fp, 1,
          "Property Index",
          "Custom property index detected — ensure it's migrated to lucene for Cloud Service",
          "", "MEDIUM",
          "Migrate property indexes to lucene indexes. Follow Cloud Service indexing documentation.",
          "Medium", "Property indexes have limited scalability in Cloud Service"
        );
      }
    }
  }
}

// ==================== AEMCS-CLOUD-004: Scheduler Without Cluster Leader ====================

export function scanSchedulerLeader(ctx: AemScannerContext): void {
  for (const fp of ctx.javaFiles()) {
    const content = ctx.read(fp);

    // Look for Scheduler annotations or Runnable pattern
    const hasScheduler = content.includes("@Scheduled") ||
      content.includes("scheduler.schedule") ||
      content.includes("Scheduler.AT") ||
      content.includes("@Designate") && content.includes("scheduler");

    if (!hasScheduler) continue;

    // Check for cluster leader awareness
    const hasLeaderCheck = content.includes("TopologyView") ||
      content.includes("isLeader") ||
      content.includes("isSingleInstance") ||
      content.includes("runOn.LEADER") ||
      content.includes("LEADER_OR_SINGLE");

    if (!hasLeaderCheck) {
      const hit = ctx.grep(fp, /@Scheduled|scheduler\.schedule|Scheduler\.AT/) [0];
      if (hit) {
        ctx.add(
          "Cloud Readiness", ctx.module(fp), fp, hit.lineNum,
          "Scheduler Without Leader Election",
          "Scheduler runs on all cluster nodes — will execute multiple times in Cloud Service",
          ctx.context(fp, hit.lineNum), "HIGH",
          "Add leader election: use Sling Discovery API TopologyView.getLocalInstance().isLeader() or Granite JobManager.",
          "Medium", "Cloud Service runs multiple publish instances — scheduler fires on each"
        );
      }
    }
  }
}
