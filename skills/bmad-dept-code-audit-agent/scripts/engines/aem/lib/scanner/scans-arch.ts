/**
 * AEM Scanner — Architecture Scans
 * ===================================
 * Rules: AEMCS-ARCH-001 through AEMCS-ARCH-005
 */
import * as fs from "fs";
import * as path from "path";
import { AemScannerContext } from "./context";

// ==================== AEMCS-ARCH-001: Mutable vs Immutable Content Separation ====================

export function scanContentSeparation(ctx: AemScannerContext): void {
  const uiAppsContent = path.join(ctx.root, "ui.apps/src/main/content/jcr_root/content");
  if (fs.existsSync(uiAppsContent)) {
    // Recursively find .content.xml under ui.apps/content/
    const contentXmls = ctx.contentXmlFiles().filter((fp) =>
      fp.includes("ui.apps") && fp.includes("/content/") && !fp.includes("/apps/")
    );

    for (const fp of contentXmls) {
      const content = ctx.read(fp);
      if (content.includes('jcr:primaryType="cq:Page"')) {
        ctx.add(
          "Architecture", "ui.apps", fp, 1,
          "Mutable Content in ui.apps",
          "Page content (cq:Page) found in ui.apps — should be in ui.content (mutable)",
          "", "CRITICAL",
          "Move page content to ui.content/src/main/content/jcr_root/content/. ui.apps is immutable.",
          "Low", "Cloud Service deployment fails with mutable content in immutable package"
        );
      }
    }
  }

  // Check for tags in ui.apps
  const tagsInApps = path.join(ctx.root, "ui.apps/src/main/content/jcr_root/content/cq:tags");
  if (fs.existsSync(tagsInApps)) {
    ctx.add(
      "Architecture", "ui.apps", tagsInApps, 1,
      "Tags in ui.apps",
      "Tag definitions found in ui.apps — tags are mutable content",
      "", "HIGH",
      "Move tags to ui.content/src/main/content/jcr_root/content/cq:tags/.",
      "Low", "Tags in immutable package cannot be edited at runtime"
    );
  }
}

// ==================== AEMCS-ARCH-002: No Classic UI Components ====================

export function scanClassicUi(ctx: AemScannerContext): void {
  const contentXmls = ctx.contentXmlFiles().filter((fp) => fp.includes("ui.apps"));

  for (const fp of contentXmls) {
    const content = ctx.read(fp);

    // Classic UI dialog (cq:Dialog)
    if (content.includes('jcr:primaryType="cq:Dialog"')) {
      ctx.add(
        "Architecture", ctx.module(fp), fp, 1,
        "Classic UI Dialog",
        "Classic UI dialog (cq:Dialog) found — unsupported in Cloud Service",
        "", "HIGH",
        "Migrate to Touch UI dialog: jcr:primaryType=\"nt:unstructured\" with sling:resourceType=\"cq/gui/components/authoring/dialog\".",
        "High", "Classic UI dialogs are non-functional in Cloud Service"
      );
    }

    // ExtJS xtype
    if (/xtype\s*=/.test(content)) {
      ctx.add(
        "Architecture", ctx.module(fp), fp, 1,
        "ExtJS xtype Reference",
        "ExtJS xtype property found — Classic UI/ExtJS unsupported in Cloud Service",
        "", "HIGH",
        "Replace with Granite/Coral UI resource types in Touch UI dialog.",
        "High", "ExtJS-based components don't render in Cloud Service"
      );
    }

    // Foundation components reference
    if (content.includes("/libs/foundation/components/")) {
      for (const hit of ctx.grep(fp, /\/libs\/foundation\/components\//)) {
        ctx.add(
          "Architecture", ctx.module(fp), fp, hit.lineNum,
          "Foundation Component Reference",
          "Reference to /libs/foundation/components/ — deprecated, use Core Components",
          ctx.context(fp, hit.lineNum), "HIGH",
          "Replace with Core Components: core/wcm/components/. Foundation components are removed in Cloud Service.",
          "Medium", "Foundation components are removed in Cloud Service"
        );
      }
    }
  }
}

// ==================== AEMCS-ARCH-003: No Custom Runmode Configs ====================

export function scanCustomRunmodes(ctx: AemScannerContext): void {
  const validRunmodes = new Set(["author", "publish", "dev", "stage", "prod"]);
  const configDirs = [
    path.join(ctx.root, "ui.config/src/main/content/jcr_root/apps"),
    path.join(ctx.root, "ui.apps/src/main/content/jcr_root/apps"),
  ];

  for (const baseDir of configDirs) {
    if (!fs.existsSync(baseDir)) continue;

    // Walk to find config.* directories
    const findConfigDirs = (dir: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch { return; }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;
        const fullPath = path.join(dir, name);

        if (name.startsWith("config.")) {
          const runmodes = name.substring(7).split(".");
          for (const rm of runmodes) {
            if (!validRunmodes.has(rm)) {
              ctx.add(
                "Architecture", ctx.module(fullPath), fullPath, 1,
                "Custom Runmode Config",
                `Directory '${name}' uses unsupported runmode '${rm}' — ignored in Cloud Service`,
                `Valid runmodes: author, publish, dev, stage, prod`,
                "HIGH",
                `Rename to use only supported runmodes: config.author, config.publish, config.dev, config.stage, config.prod, or combinations.`,
                "Low", "Configs in custom runmode directories are silently ignored"
              );
              break;
            }
          }
        }

        // Recurse one level
        if (name !== "config" && !name.startsWith("config.")) {
          findConfigDirs(fullPath);
        }
      }
    };

    findConfigDirs(baseDir);
  }
}

// ==================== AEMCS-ARCH-004: Forbidden /libs Overlay Depth ====================

export function scanLibsOverlay(ctx: AemScannerContext): void {
  const libsPath = path.join(ctx.root, "ui.apps/src/main/content/jcr_root/libs");
  if (fs.existsSync(libsPath)) {
    ctx.add(
      "Architecture", "ui.apps", libsPath, 1,
      "Direct /libs Modification",
      "Files directly placed under jcr_root/libs/ — Cloud Service updates /libs without notice",
      "", "HIGH",
      "Use /apps overlay or sling:resourceSuperType for component inheritance instead of modifying /libs.",
      "Medium", "Cloud Service SDK updates break direct /libs overlays"
    );
  }
}

// ==================== AEMCS-ARCH-005: Missing Repoinit Configuration ====================

export function scanRepoinit(ctx: AemScannerContext): void {
  const javaFiles = ctx.javaFiles();
  const repoinitFiles = ctx.repoinitFiles();

  // Check if project uses service resource resolvers
  let usesServiceResolver = false;
  for (const fp of javaFiles) {
    if (ctx.read(fp).includes("getServiceResourceResolver")) {
      usesServiceResolver = true;
      break;
    }
  }

  if (usesServiceResolver && repoinitFiles.length === 0) {
    ctx.add(
      "Architecture", "project", path.join(ctx.root, "ui.config"), 0,
      "Missing Repoinit Configuration",
      "Project uses service resource resolvers but has no repoinit scripts for service user provisioning",
      "", "MEDIUM",
      "Create org.apache.sling.jcr.repoinit.RepositoryInitializer-*.cfg.json with service user creation and ACLs.",
      "Medium", "Service users must be provisioned via repoinit in Cloud Service, not content packages"
    );
  }

  // Check for service users defined in content packages (bad)
  const contentXmls = ctx.contentXmlFiles();
  for (const fp of contentXmls) {
    if (fp.includes("/home/users/system/") && ctx.read(fp).includes('rep:SystemUser')) {
      ctx.add(
        "Architecture", ctx.module(fp), fp, 1,
        "Service User in Content Package",
        "Service user defined in content package — must use repoinit in Cloud Service",
        "", "HIGH",
        "Remove from content package. Define in repoinit script: create service user <name> with path system/<project>",
        "Medium", "Content-defined service users are unreliable in Cloud Service"
      );
    }
  }
}
