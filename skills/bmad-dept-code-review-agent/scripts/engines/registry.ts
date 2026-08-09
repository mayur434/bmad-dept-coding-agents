/**
 * BMAD Code Review Agent — Engine Registry
 * =========================================
 * Auto-detects platform engine or resolves explicit engine ID.
 * Each engine module exports a `main(input)` that produces review "findings"
 * (style / breaking-change / dependency-review / design-pattern / checklist
 * rows) plus the list of files written.
 *
 * Content lands in a later workstream — every engine here is a stub that
 * returns a single INFO finding so the dispatcher end-to-end wiring is
 * exercised.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Finding } from "../../../shared/core/types";

// ---------------------------------------------------------------------------
// Public review contract every engine implements
// ---------------------------------------------------------------------------

export interface ReviewInput {
  projectRoot: string;
  diffRange: { fromRef: string; toRef: string } | null; // resolved from --pr/--diff/--from-ref+--to-ref
  styleGuide?: string;               // path to custom style guide
  reviewDepth: "quick" | "standard" | "deep";
  commentFormat: "github" | "gitlab" | "inline-markdown";
  artifacts: string[];               // resolved list of artifact keys (or ['all'])
  format: "markdown" | "both";
  role: string;
  outputDir: string;
}

export interface ReviewResult {
  findings: Finding[];               // review findings = style/breaking-change/dependency/pattern rows
  writtenFiles: string[];            // paths of files written
  stats: {
    filesReviewed: number;
    comments: number;
    breakingChanges: number;
    patternViolations: number;
  };
}

export interface ReviewEngine {
  id: string;
  name: string;
  main: (input: ReviewInput) => Promise<ReviewResult>;
}

// ---------------------------------------------------------------------------
// Engine imports (scaffold stubs — a later workstream replaces bodies with
// real stack-specific review authoring logic).
// ---------------------------------------------------------------------------

import { main as aemMain } from "./aem/review";
import { main as commercePaasMain } from "./commerce-paas/review";
import { main as commerceSaasMain } from "./commerce-saas/review";
import { main as slingMain } from "./sling/review";
import { main as springMain } from "./spring/review";
import { main as appBuilderMain } from "./app-builder/review";
import { main as edsMain } from "./eds/review";
import { main as edsCommerceMain } from "./eds-commerce/review";

// ---------------------------------------------------------------------------
// Detection helpers — mirror the other agents' auto-detect logic
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

interface EngineEntry extends ReviewEngine {
  detect: (projectPath: string) => boolean;
}

const ENGINES: EngineEntry[] = [
  {
    id: "commerce-paas",
    name: "Adobe Commerce / Magento 2 (PaaS)",
    detect: (p) =>
      existsSync(join(p, "composer.json")) &&
      (existsSync(join(p, "app/etc/env.php")) || existsSync(join(p, "app/code"))),
    main: commercePaasMain,
  },
  {
    id: "commerce-saas",
    name: "Adobe Commerce SaaS",
    detect: detectCommerceSaas,
    main: commerceSaasMain,
  },
  {
    id: "app-builder",
    name: "Adobe App Builder",
    detect: detectAppBuilder,
    main: appBuilderMain,
  },
  {
    id: "spring",
    name: "Spring Boot",
    detect: detectSpring,
    main: springMain,
  },
  {
    id: "sling",
    name: "Apache Sling / Shaft",
    detect: detectSling,
    main: slingMain,
  },
  {
    id: "aem",
    name: "AEM as a Cloud Service / AMS",
    detect: (p) =>
      existsSync(join(p, "pom.xml")) &&
      (existsSync(join(p, "ui.apps")) || existsSync(join(p, "core"))),
    main: aemMain,
  },
  {
    id: "eds",
    name: "Edge Delivery Services",
    detect: (p) =>
      existsSync(join(p, "scripts")) &&
      existsSync(join(p, "blocks")) &&
      existsSync(join(p, "helix-query.yaml")),
    main: edsMain,
  },
  {
    id: "eds-commerce",
    name: "EDS + Commerce Hybrid",
    detect: (p) =>
      existsSync(join(p, "blocks")) &&
      (existsSync(join(p, "scripts/commerce.js")) || existsSync(join(p, "commerce"))),
    main: edsCommerceMain,
  },
];

// Aliases: caller IDs that resolve to a registered engine.
const ENGINE_ALIASES: Record<string, string> = {
  "commerce": "commerce-paas",
  "aemcs": "aem",
  "aemams": "aem",
};

export function getEngine(engineId: string | null, projectPath: string): ReviewEngine | null {
  if (engineId) {
    const resolvedId = ENGINE_ALIASES[engineId] ?? engineId;
    const entry = ENGINES.find((e) => e.id === resolvedId);
    if (!entry) {
      console.error(`❌ Unknown engine: ${engineId}`);
      listEngines();
      return null;
    }
    return entry;
  }

  // Auto-detect
  for (const entry of ENGINES) {
    if (entry.detect(projectPath)) {
      console.log(`✓ Auto-detected engine: ${entry.name}`);
      return entry;
    }
  }

  return null;
}

export function listEngines(): void {
  console.log("Available code-review engines:");
  console.log("");
  for (const entry of ENGINES) {
    console.log(`  ${entry.id.padEnd(18)} ${entry.name}`);
  }
}
