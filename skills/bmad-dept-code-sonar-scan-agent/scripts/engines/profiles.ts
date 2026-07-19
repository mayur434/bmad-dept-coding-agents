/**
 * Sonar Scan — Stack profiles
 * ============================
 * Detection heuristics for all 8 in-scope stacks. Adapted from
 * bmad-dept-code-impact-analysis-agent/scripts/engines/profiles.ts —
 * same detection logic, separate copy per-agent (existing convention).
 */

import * as fs from "fs";
import * as path from "path";

export interface StackProfile {
  id: string;
  name: string;
  language: string;
  rulePack: string;
  detect: (projectPath: string) => boolean;
}

function has(p: string, rel: string): boolean { return fs.existsSync(path.join(p, rel)); }
function read(abs: string): string { try { return fs.readFileSync(abs, "utf8"); } catch { return ""; } }
function readPom(p: string): string { return read(path.join(p, "pom.xml")); }
function readPkg(p: string): string { return read(path.join(p, "package.json")); }

export const PROFILES: StackProfile[] = [
  {
    id: "commerce-paas",
    name: "Adobe Commerce PaaS (Magento 2)",
    language: "PHP",
    rulePack: "commerce-paas",
    detect: (p) => has(p, "composer.json") && (has(p, "app/code") || has(p, "app/etc/env.php")),
  },
  {
    id: "commerce-saas",
    name: "Adobe Commerce SaaS",
    language: "JavaScript",
    rulePack: "commerce-saas",
    detect: (p) =>
      !(has(p, "app/code") && has(p, "composer.json")) &&
      (/@adobe\/magento-storefront-event|Magento-Environment-Id|catalog-service\.adobe\.io|live-search/i.test(
        readPkg(p) + read(path.join(p, "config.json")) + read(path.join(p, "commerce.env.json")),
      )),
  },
  {
    id: "app-builder",
    name: "Adobe App Builder",
    language: "JavaScript/Node.js",
    rulePack: "app-builder",
    detect: (p) =>
      has(p, "app.config.yaml") ||
      has(p, "app.config.yml") ||
      has(p, ".aio") ||
      /@adobe\/(aio-sdk|aio-lib-|uix-guest)/.test(readPkg(p)),
  },
  {
    id: "spring",
    name: "Spring Boot",
    language: "Java",
    rulePack: "spring",
    detect: (p) =>
      /spring-boot-starter|org\.springframework\.boot/i.test(readPom(p) + readPkg(p)) ||
      fileTreeHas(p, /@SpringBootApplication/),
  },
  {
    id: "sling",
    name: "Apache Sling / Shaft (sling-12)",
    language: "Java",
    rulePack: "sling",
    detect: (p) =>
      !aemLike(p) &&
      (/org\.apache\.sling|org\.apache\.felix|jackrabbit/i.test(readPom(p)) ||
        has(p, "mdm") ||
        has(p, "sam") ||
        has(p, "src/main/features")),
  },
  {
    id: "aem",
    name: "AEM (AEMaaCS + AMS)",
    language: "Java",
    rulePack: "aem",
    detect: (p) => aemLike(p),
  },
  {
    id: "eds-commerce",
    name: "EDS + Commerce",
    language: "JavaScript",
    rulePack: "eds-commerce",
    detect: (p) =>
      has(p, "blocks") &&
      (has(p, "scripts/commerce.js") || has(p, "commerce") || hasCommerceDropin(p)),
  },
  {
    id: "eds",
    name: "Adobe Edge Delivery Services",
    language: "JavaScript",
    rulePack: "eds",
    detect: (p) =>
      has(p, "blocks") &&
      (has(p, "helix-query.yaml") || has(p, "fstab.yaml") || has(p, "scripts")),
  },
];

/** Resolve a profile by id (accepts aemcs/aemams → aem; commerce → commerce-paas). */
export function profileById(id: string): StackProfile | null {
  const norm = id === "aemcs" || id === "aemams" ? "aem" : id === "commerce" ? "commerce-paas" : id;
  return PROFILES.find((p) => p.id === norm) ?? null;
}

/** Auto-detect: first matching profile wins. */
export function detectProfile(projectPath: string): StackProfile | null {
  for (const p of PROFILES) {
    try { if (p.detect(projectPath)) return p; } catch { /* keep scanning */ }
  }
  return null;
}

// ── Detection helpers ────────────────────────────────────────────────────────

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
      if (e.isDirectory()) {
        if (e.name === "target" || e.name === "build") continue;
        if (walk(full)) return true;
      } else if (e.name.endsWith(".java")) {
        try { if (re.test(fs.readFileSync(full, "utf8"))) return true; } catch { /* skip */ }
      }
    }
    return false;
  };
  return walk(dir);
}
