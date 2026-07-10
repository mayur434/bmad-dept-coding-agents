/**
 * Impact Analysis — Stack profiles
 * =================================
 * Per-stack configuration the generic tracer uses to know where code lives, what
 * a "code entity" looks like, and how modules are named. Covers all 8 in-scope
 * stacks (AEMaaCS + AMS share one 'aem' profile, as in the audit agent).
 */

import * as fs from "fs";
import * as path from "path";

export interface StackProfile {
  id: string;
  name: string;
  detect: (projectPath: string) => boolean;
  /** globs (relative to project root) for source that can be impacted. */
  sourceGlobs: string[];
  ignore: string[];
  /** class/name suffixes that strongly indicate a code entity for this stack. */
  entitySuffixes: string[];
  /** optional module-name pattern (e.g. Commerce Vendor_Module / Vendor\Module). */
  modulePattern?: RegExp;
}

function has(p: string, rel: string): boolean { return fs.existsSync(path.join(p, rel)); }
function readPom(p: string): string { try { return fs.readFileSync(path.join(p, "pom.xml"), "utf8"); } catch { return ""; } }
function readPkg(p: string): string { try { return fs.readFileSync(path.join(p, "package.json"), "utf8"); } catch { return ""; } }

const IGNORE = ["**/target/**", "**/build/**", "**/node_modules/**", "**/vendor/**", "**/generated-sources/**", "**/dist/**"];

export const PROFILES: StackProfile[] = [
  {
    id: "commerce-paas",
    name: "Adobe Commerce PaaS (Magento 2)",
    detect: (p) => has(p, "composer.json") && (has(p, "app/code") || has(p, "app/etc/env.php")),
    sourceGlobs: ["app/code/**/*.php", "app/code/**/*.xml", "app/design/**/*.phtml", "**/*.php"],
    ignore: IGNORE,
    entitySuffixes: ["Plugin", "Observer", "Resolver", "Repository", "Model", "Block", "ViewModel", "Controller", "Command", "Cron"],
    modulePattern: /\b[A-Z][A-Za-z0-9]+[_\\][A-Z][A-Za-z0-9]+\b/g,
  },
  {
    id: "app-builder",
    name: "Adobe App Builder",
    detect: (p) => has(p, "app.config.yaml") || has(p, "app.config.yml") || has(p, ".aio") || /@adobe\/(aio-sdk|aio-lib-|uix-guest)/.test(readPkg(p)),
    sourceGlobs: ["actions/**/*.{js,mjs}", "src/**/*.{js,mjs}", "web-src/**/*.{js,jsx}", "**/*mesh*.{json,js}", "**/*.{js,mjs}"],
    ignore: [...IGNORE, "**/test/**", "**/*.test.js"],
    entitySuffixes: ["Action", "Handler", "Resolver", "Worker"],
  },
  {
    id: "spring",
    name: "Spring Boot",
    detect: (p) => /spring-boot-starter|org\.springframework\.boot/i.test(readPom(p) + readPkg(p)) || fileTreeHas(p, /@SpringBootApplication/),
    sourceGlobs: ["src/main/java/**/*.java", "**/src/main/java/**/*.java", "src/main/resources/**/*.{yml,yaml,xml,properties}"],
    ignore: IGNORE,
    entitySuffixes: ["Controller", "Service", "ServiceImpl", "Repository", "Component", "Configuration", "Entity", "Dto", "Handler", "Mapper"],
  },
  {
    id: "sling",
    name: "Apache Sling / Shaft (sling-12)",
    detect: (p) => !aemLike(p) && (/org\.apache\.sling|org\.apache\.felix|jackrabbit/i.test(readPom(p)) || has(p, "mdm") || has(p, "sam") || has(p, "src/main/features")),
    sourceGlobs: ["**/src/main/java/**/*.java", "core/**/*.java", "bundle/**/*.java", "**/src/main/resources/**/*.{json,xml}"],
    ignore: IGNORE,
    entitySuffixes: ["Service", "ServiceImpl", "Servlet", "Filter", "Impl", "Connector", "Model", "Processor", "Handler"],
  },
  {
    id: "aem",
    name: "AEM (AEMaaCS + AMS)",
    detect: (p) => aemLike(p),
    sourceGlobs: ["core/**/*.java", "bundle/**/*.java", "**/src/main/java/**/*.java", "ui.apps/**/*.{html,xml}", "**/*.content.xml", "ui.frontend/src/**/*.{js,ts}"],
    ignore: IGNORE,
    entitySuffixes: ["Service", "ServiceImpl", "Servlet", "Model", "Filter", "Impl", "WorkflowProcess", "Scheduler", "Component"],
  },
  {
    id: "eds",
    name: "Adobe Edge Delivery Services",
    detect: (p) => has(p, "blocks") && (has(p, "helix-query.yaml") || has(p, "fstab.yaml") || has(p, "scripts")),
    sourceGlobs: ["blocks/**/*.{js,css}", "scripts/**/*.js", "styles/**/*.css", "**/*.js"],
    ignore: [...IGNORE, "**/*.test.js"],
    entitySuffixes: ["Block"],
  },
  {
    id: "eds-commerce",
    name: "EDS + Commerce",
    detect: (p) => has(p, "blocks") && (has(p, "scripts/commerce.js") || has(p, "commerce") || hasCommerceDropin(p)),
    sourceGlobs: ["blocks/**/*.{js,css}", "scripts/**/*.js", "**/*.js"],
    ignore: [...IGNORE, "**/*.test.js"],
    entitySuffixes: ["Block", "Dropin"],
  },
];

/** Resolve a profile by explicit id (accepts aemcs/aemams aliases → aem). */
export function profileById(id: string): StackProfile | null {
  const alias = id === "aemcs" || id === "aemams" ? "aem" : id === "commerce" ? "commerce-paas" : id;
  return PROFILES.find((p) => p.id === alias) ?? null;
}

/** Auto-detect: first matching profile (Sling before AEM handled by aemLike guard). */
export function detectProfile(projectPath: string): StackProfile | null {
  for (const p of PROFILES) {
    try { if (p.detect(projectPath)) return p; } catch { /* keep scanning */ }
  }
  return null;
}

// ── detection helpers ─────────────────────────────────────────────────────────
function aemLike(p: string): boolean {
  if (has(p, "ui.apps") || has(p, "ui.content")) return true;
  return /com\.adobe\.aem|aem-sdk-api|uber-jar|cq-quickstart|granite/i.test(readPom(p));
}
function hasCommerceDropin(p: string): boolean {
  return /@dropins\/|commerce-/.test(readPkg(p));
}
function fileTreeHas(root: string, re: RegExp): boolean {
  const dir = path.join(root, "src");
  if (!fs.existsSync(dir)) return false;
  let budget = 60;
  const walk = (d: string): boolean => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return false; }
    for (const e of entries) {
      if (budget-- <= 0) return false;
      const full = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name === "target" || e.name === "build") continue; if (walk(full)) return true; }
      else if (e.name.endsWith(".java")) { try { if (re.test(fs.readFileSync(full, "utf8"))) return true; } catch { /* skip */ } }
    }
    return false;
  };
  return walk(dir);
}
