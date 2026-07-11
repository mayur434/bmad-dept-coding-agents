/**
 * Commerce — AST scan pass (regex → tree-sitter precision)
 * =========================================================
 * Runs the shared generic PHP rules + Commerce-specific AST rules over the
 * project. These are high-precision structural findings that supersede the noisy
 * regex equivalents (ignore comments/log strings, catch structural variants).
 * Returned as the normalized Finding model; the engine merges them into its output.
 */

import { Finding } from "../../../../shared/core/types";
import { PhpAstScanner, PhpRule, GENERIC_PHP_RULES, descend } from "../../../../shared/php";

// Commerce-specific: direct ObjectManager use bypasses dependency injection.
const ruleObjectManager: PhpRule = (ctx, add) => {
  for (const sc of descend(ctx.root, "scoped_call_expression")) {
    if (/\bObjectManager\b/.test(sc.text) && /getInstance/.test(sc.text)) {
      add(sc, {
        ruleId: "COMMERCE-AST-001", title: "ObjectManager::getInstance() anti-pattern",
        category: "Architecture", severity: "MEDIUM",
        description: "Direct ObjectManager use bypasses Magento's dependency injection.",
        recommendation: "Inject the dependency via the constructor; reserve ObjectManager for factories/static contexts.",
        impact: "Hidden dependencies, harder testing, DI-compiler bypass.", effort: "M",
      });
    }
  }
};

const COMMERCE_AST_RULES: PhpRule[] = [...GENERIC_PHP_RULES, ruleObjectManager];

/** Run the AST pass. Returns normalized Findings (source: scanner, AST-verified). */
export async function scanCommerceAst(projectPath: string): Promise<Finding[]> {
  const scanner = new PhpAstScanner(projectPath, COMMERCE_AST_RULES, {
    stackId: "commerce-paas",
    ignore: ["**/app/code/**/Test/**", "**/dev/**"],
  });
  const { findings } = await scanner.scan();
  return findings;
}
