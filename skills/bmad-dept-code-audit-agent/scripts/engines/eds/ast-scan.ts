/**
 * EDS — AST scan pass (regex → tree-sitter precision)
 * ====================================================
 * Shared generic JS rules + an EDS-specific DOM-XSS rule over the block/script
 * JS. High-precision structural findings that supersede the noisier regex checks.
 */

import { Finding } from "../../../../shared/core/types";
import { JsAstScanner, JsRule, GENERIC_JS_RULES } from "../../../../shared/js";

// EDS: DOM-based XSS — assigning URL/location-derived data into innerHTML/outerHTML.
const ruleDomXss: JsRule = (ctx, add) => {
  for (let i = 0; i < ctx.lines.length; i++) {
    if (/\.(innerHTML|outerHTML)\s*=\s*[^;]*(location|document\.URL|document\.referrer|window\.name|URLSearchParams|\.search\b|\.hash\b)/.test(ctx.lines[i]) ||
        /insertAdjacentHTML\s*\([^)]*(location|\.hash\b|\.search\b|URLSearchParams)/.test(ctx.lines[i])) {
      add(i + 1, {
        ruleId: "EDS-AST-SEC-001", title: "DOM-based XSS (URL data into innerHTML)", category: "Security", severity: "HIGH",
        description: "URL/location-derived data is written into innerHTML/outerHTML without sanitization.",
        recommendation: "Use textContent, or sanitize (DOMPurify) before inserting HTML; never trust location/URL params.",
        impact: "Reflected/DOM XSS from a crafted URL.", effort: "S",
      });
    }
  }
};

const EDS_AST_RULES: JsRule[] = [...GENERIC_JS_RULES, ruleDomXss];

/** Run the AST pass over EDS block/script JS. */
export async function scanEdsAst(projectPath: string): Promise<Finding[]> {
  const scanner = new JsAstScanner(projectPath, EDS_AST_RULES, {
    stackId: "eds",
    include: "{blocks,scripts,styles,tools}/**/*.{js,mjs}",
  });
  const { findings } = await scanner.scan();
  return findings;
}
