/**
 * BMAD Test Coverage Agent — Engine Registry
 * =============================================
 * Auto-detects platform engine or resolves explicit engine ID.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { BaseEngine } from "../shared/base";

// ---------------------------------------------------------------------------
// Engine imports (add new engines here)
// ---------------------------------------------------------------------------

import { CommerceEngine } from "./commerce/coverage";
import { AemEngine } from "./aem/coverage";
import { EdsEngine } from "./eds/coverage";
import { EdsCommerceEngine } from "./eds-commerce/coverage";
import { SlingEngine } from "./sling/coverage";
import { SpringEngine } from "./spring/coverage";
import { AppBuilderEngine } from "./app-builder/coverage";
import { CommerceSaasEngine } from "./commerce-saas/coverage";

// ---------------------------------------------------------------------------
// Detection helpers for the new stacks
// ---------------------------------------------------------------------------

function readSafe(p: string): string {
  try { return readFileSync(p, "utf-8"); } catch { return ""; }
}
function looksLikeAem(p: string): boolean {
  return existsSync(join(p, "ui.apps")) || existsSync(join(p, "ui.content")) ||
    /com\.adobe\.aem|aem-sdk-api|uber-jar|cq-quickstart/i.test(readSafe(join(p, "pom.xml")));
}
function detectSpring(p: string): boolean {
  const build = readSafe(join(p, "pom.xml")) + readSafe(join(p, "build.gradle")) + readSafe(join(p, "build.gradle.kts"));
  return /spring-boot-starter|spring-boot-maven-plugin|org\.springframework\.boot/i.test(build);
}
function detectSling(p: string): boolean {
  if (looksLikeAem(p) || detectSpring(p)) return false;
  const build = readSafe(join(p, "pom.xml")) + readSafe(join(p, "bnd.bnd"));
  return /org\.apache\.sling|org\.apache\.felix|slingstart|jackrabbit/i.test(build) ||
    existsSync(join(p, "src", "main", "features")) || existsSync(join(p, "mdm")) || existsSync(join(p, "sam"));
}
function detectAppBuilder(p: string): boolean {
  return existsSync(join(p, "app.config.yaml")) || existsSync(join(p, "app.config.yml")) ||
    existsSync(join(p, ".aio")) || /@adobe\/(aio-sdk|aio-lib-|uix-guest)/.test(readSafe(join(p, "package.json")));
}
function detectCommerceSaas(p: string): boolean {
  if (existsSync(join(p, "app/code")) && existsSync(join(p, "composer.json"))) return false;
  const blob = readSafe(join(p, "package.json")) + readSafe(join(p, "config.json")) + readSafe(join(p, "commerce.env.json"));
  return /@adobe\/magento-storefront-event|Magento-Environment-Id|catalog-service\.adobe\.io|commerce\.adobe\.io|live-search/i.test(blob);
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

interface EngineEntry {
  id: string;
  name: string;
  detect: (projectPath: string) => boolean;
  create: () => BaseEngine;
}

const ENGINES: EngineEntry[] = [
  {
    id: "commerce",
    name: "Adobe Commerce / Magento 2",
    detect: (p) =>
      existsSync(join(p, "composer.json")) &&
      (existsSync(join(p, "app/etc/env.php")) || existsSync(join(p, "app/code"))),
    create: () => new CommerceEngine(),
  },
  {
    id: "commerce-saas",
    name: "Adobe Commerce SaaS",
    detect: detectCommerceSaas,
    create: () => new CommerceSaasEngine(),
  },
  {
    id: "app-builder",
    name: "Adobe App Builder",
    detect: detectAppBuilder,
    create: () => new AppBuilderEngine(),
  },
  {
    id: "spring",
    name: "Spring Boot",
    detect: detectSpring,
    create: () => new SpringEngine(),
  },
  {
    id: "sling",
    name: "Apache Sling / Shaft",
    detect: detectSling,
    create: () => new SlingEngine(),
  },
  {
    id: "aem",
    name: "AEM as a Cloud Service",
    detect: (p) =>
      existsSync(join(p, "pom.xml")) &&
      (existsSync(join(p, "ui.apps")) || existsSync(join(p, "core"))),
    create: () => new AemEngine(),
  },
  {
    id: "eds",
    name: "Edge Delivery Services",
    detect: (p) =>
      existsSync(join(p, "scripts")) &&
      existsSync(join(p, "blocks")) &&
      existsSync(join(p, "helix-query.yaml")),
    create: () => new EdsEngine(),
  },
  {
    id: "eds-commerce",
    name: "EDS + Commerce Hybrid",
    detect: (p) =>
      existsSync(join(p, "blocks")) &&
      (existsSync(join(p, "scripts/commerce.js")) || existsSync(join(p, "commerce"))),
    create: () => new EdsCommerceEngine(),
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Aliases: caller IDs that resolve to a registered engine.
const ENGINE_ALIASES: Record<string, string> = {
  "commerce-paas": "commerce",
};

export function getEngine(engineId: string | null, projectPath: string): BaseEngine | null {
  if (engineId) {
    const resolvedId = ENGINE_ALIASES[engineId] ?? engineId;
    const entry = ENGINES.find((e) => e.id === resolvedId);
    if (!entry) {
      console.error(`❌ Unknown engine: ${engineId}`);
      listEngines();
      return null;
    }
    return entry.create();
  }

  // Auto-detect
  for (const entry of ENGINES) {
    if (entry.detect(projectPath)) {
      console.log(`✓ Auto-detected engine: ${entry.name}`);
      return entry.create();
    }
  }

  return null;
}

export function listEngines(): void {
  console.log("Available test coverage engines:");
  console.log("");
  for (const entry of ENGINES) {
    console.log(`  ${entry.id.padEnd(15)} ${entry.name}`);
  }
}
