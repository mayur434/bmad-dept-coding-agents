/**
 * AEM — AST scan pass (regex → tree-sitter precision)
 * ====================================================
 * Shared generic Java rules + AEM/Sling-specific AST rules over the project's Java
 * sources. High-precision structural findings that supersede the noisier regex
 * equivalents in the AEM engine. Returned as the normalized Finding model.
 */

import { Finding } from "../../../../shared/core/types";
import { JavaAstScanner, JavaRule, GENERIC_JAVA_RULES, descend } from "../../../../shared/java";

// AEM/Sling: administrative login is deprecated + over-privileged.
const ruleAdminResolver: JavaRule = (ctx, add) => {
  for (const mi of descend(ctx.root, "method_invocation")) {
    const name = mi.childForFieldName("name")?.text ?? "";
    if (name === "getAdministrativeResourceResolver" || name === "loginAdministrative") {
      add(mi, {
        ruleId: "AEM-AST-SEC-001", title: "Administrative Sling login (deprecated + over-privileged)",
        category: "Security", severity: "HIGH",
        description: `\`${name}(...)\` grants admin rights and is deprecated in AEMaaCS.`,
        recommendation: "Use getServiceResourceResolver() with a mapped service user (repoinit) and least privilege.",
        impact: "Over-privileged access widens the blast radius of any bug/injection in this path.", effort: "M",
      });
    }
  }
};

// AEM/Sling: ResourceResolver opened but not closed in the method (session leak).
const ruleResourceResolverLeak: JavaRule = (ctx, add) => {
  const GET = /(getServiceResourceResolver|getResourceResolver|loginService|getAdministrativeResourceResolver)\s*\(/;
  for (const md of descend(ctx.root, "method_declaration")) {
    const body = md.childForFieldName("body");
    if (!body || !GET.test(body.text)) continue;
    if (!/\.close\s*\(\s*\)/.test(body.text) && !/try\s*\([^)]*ResourceResolver/.test(body.text)) {
      add(md.childForFieldName("name") ?? md, {
        ruleId: "AEM-AST-REL-001", title: "ResourceResolver not closed (session leak)",
        category: "Reliability", severity: "MEDIUM",
        description: "A ResourceResolver is opened but never closed in this method.",
        recommendation: "Close it in finally / use try-with-resources.",
        impact: "Leaked resolvers exhaust the login/session pool under load.", effort: "S",
      });
    }
  }
};

const AEM_AST_RULES: JavaRule[] = [...GENERIC_JAVA_RULES, ruleAdminResolver, ruleResourceResolverLeak];

/** Run the AST pass over AEM Java sources. */
export async function scanAemAst(projectPath: string): Promise<Finding[]> {
  const scanner = new JavaAstScanner(projectPath, AEM_AST_RULES, {
    stackId: "aem",
    connectorHint: /connector|service|integration/i,
  });
  const { findings } = await scanner.scan();
  return findings;
}
