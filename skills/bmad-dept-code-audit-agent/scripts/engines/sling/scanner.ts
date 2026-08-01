/**
 * Sling-12 / Shaft — Tier-1 AST Scanner
 * ======================================
 * Composes the shared generic Java rules with Sling/Shaft-specific rules over the
 * shared tree-sitter Java harness. Generic rule ids are rebranded to SHAFT-* so
 * they line up with resources/rule-packs/sling/rules.md.
 */

import { Finding } from "../../../../shared/core/types";
import {
  JavaAstScanner, JavaRule, GENERIC_JAVA_RULES, descend,
} from "../../../../shared/java";
import { isShaft } from "./detect";

const CONNECTOR_HINT =
  /(connector|s3|sftp|ftp|payment|razorpay|payu|cashfree|pinelabs|mongo|jdbc|datasource|smtp|whatsapp|digilocker)/i;

const SHAFT_ID_MAP: Record<string, string> = {
  "GEN-SEC-001": "SHAFT-SEC-001",
  "GEN-SEC-002": "SHAFT-SEC-002",
  "GEN-SEC-004": "SHAFT-SEC-004",
  "GEN-SEC-005": "SHAFT-SEC-005",
  "GEN-SEC-006": "SHAFT-SEC-006",
};

// ── Sling/Shaft-specific rules ────────────────────────────────────────────────

const ruleAdminResolver: JavaRule = (ctx, add) => {
  for (const mi of descend(ctx.root, "method_invocation")) {
    const name = mi.childForFieldName("name")?.text ?? "";
    if (name === "getAdministrativeResourceResolver" || name === "loginAdministrative") {
      add(mi, {
        ruleId: "SLING-SEC-003", title: "Administrative Sling login (deprecated + over-privileged)",
        category: "Security", severity: "HIGH",
        description: `\`${name}(...)\` grants admin rights and is deprecated in modern Sling.`,
        recommendation: "Use getServiceResourceResolver() with a scoped service user (repoinit) and least privilege.",
        impact: "Over-privileged access widens the blast radius of any bug or injection in this code path.",
        effort: "M",
      });
    }
  }
};

const ruleResourceResolverLeak: JavaRule = (ctx, add) => {
  const GET = /(getServiceResourceResolver|getResourceResolver|loginService|getAdministrativeResourceResolver)\s*\(/;
  for (const md of descend(ctx.root, "method_declaration")) {
    const body = md.childForFieldName("body");
    if (!body || !GET.test(body.text)) continue;
    const closes = /\.close\s*\(\s*\)/.test(body.text);
    const tryWithResources = /try\s*\([^)]*ResourceResolver/.test(body.text);
    if (!closes && !tryWithResources) {
      add(md.childForFieldName("name") ?? md, {
        ruleId: "SLING-RES-001", title: "ResourceResolver not closed (leak)",
        category: "Reliability", severity: "MEDIUM",
        description: "A ResourceResolver is opened but never closed in this method (no .close() or try-with-resources).",
        recommendation: "Close the resolver in a finally block or use try-with-resources.",
        impact: "Leaked resolvers exhaust the login/session pool under load, degrading or halting the service.",
        effort: "S",
      });
    }
  }
};

const ruleUnverifiedJwt: JavaRule = (ctx, add) => {
  for (const mi of descend(ctx.root, "method_invocation")) {
    const name = mi.childForFieldName("name")?.text ?? "";
    if (name === "parseClaimsJwt" || name === "parsePlaintextJwt") {
      add(mi, {
        ruleId: "SHAFT-AUTH-001", title: "JWT parsed without signature verification",
        category: "Security", severity: "HIGH",
        description: `\`${name}(...)\` parses an *unsigned* JWT — the signature is not verified.`,
        recommendation: "Use parseClaimsJws(...) with the configured signing key so forged tokens are rejected.",
        impact: "Attackers can forge tokens and impersonate any user/partner (auth bypass).",
        effort: "S",
      });
    }
  }
};

const ruleDeprecatedSlingJson: JavaRule = (ctx, add) => {
  for (const imp of descend(ctx.root, "import_declaration")) {
    if (/org\.apache\.sling\.commons\.json/.test(imp.text)) {
      add(imp, {
        ruleId: "SLING-API-001", title: "Deprecated org.apache.sling.commons.json",
        category: "Maintainability", severity: "MEDIUM",
        description: "sling.commons.json is deprecated/removed in newer Sling.",
        recommendation: "Migrate to org.apache.johnzon / Jakarta JSON-P or Jackson.",
        impact: "Blocks upgrades of the Sling/feature-model platform.",
        effort: "M",
      });
    }
  }
};

const SLING_RULES: JavaRule[] = [
  ruleAdminResolver,
  ruleResourceResolverLeak,
  ruleUnverifiedJwt,
  ruleDeprecatedSlingJson,
];

export interface SlingScanResult {
  findings: Finding[];
  filesScanned: number;
  javaFiles: number;
  isShaft: boolean;
}

export class SlingShaftScanner {
  constructor(private root: string) {}

  async scan(): Promise<SlingScanResult> {
    const scanner = new JavaAstScanner(this.root, [...GENERIC_JAVA_RULES, ...SLING_RULES], {
      stackId: "sling-shaft",
      connectorHint: CONNECTOR_HINT,
      idMap: SHAFT_ID_MAP,
    });
    const { findings, filesScanned, javaFiles } = await scanner.scan();
    return { findings, filesScanned, javaFiles, isShaft: isShaft(this.root) };
  }
}
