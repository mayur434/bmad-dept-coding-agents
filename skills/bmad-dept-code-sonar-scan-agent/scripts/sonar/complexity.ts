/**
 * Sonar Scan — AST-based Cyclomatic Complexity
 * ==============================================
 * Replaces the regex-based complexity heuristic with a proper per-function
 * cyclomatic count driven by the shared tree-sitter grammars (Java, JS/TS,
 * PHP). Reuses skills/shared/ast so no grammar loading is re-implemented.
 *
 * Decision points (each adds +1 to the base of 1):
 *   if, else-if, case, catch, ?:, &&, ||, while, for/foreach, do-while
 *
 * Threshold → sonar Finding:
 *   cc > 15  → HIGH  "Code Smell" (category "Complexity")
 *   cc > 25  → CRITICAL
 */
import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import type Parser from "web-tree-sitter";
import { astParser } from "../../../shared/ast";
import type { LangId } from "../../../shared/ast/languages";
import { Finding } from "../../../shared/core/types";
import { StackProfile } from "../engines/profiles";

export interface FunctionComplexity {
  /** Human-readable function signature (best-effort). */
  signature: string;
  /** File path relative to project root. */
  file: string;
  /** 1-based line of the function declaration. */
  line: number;
  complexity: number;
}

export interface ComplexityResult {
  filesScanned: number;
  functionsCounted: number;
  perFunction: FunctionComplexity[];
  findings: Finding[];
}

// ── Language routing per engine ─────────────────────────────────────────────

const JAVA_ENGINES = new Set(["aem", "commerce", "spring", "sling"]);
const JS_ENGINES = new Set([
  "app-builder",
  "commerce-saas",
  "eds",
  "eds-commerce",
]);
const PHP_ENGINES = new Set(["commerce-paas"]);

function languagesForEngine(engineId: string): LangId[] {
  if (JAVA_ENGINES.has(engineId)) return ["java"];
  if (JS_ENGINES.has(engineId)) return ["javascript", "typescript", "tsx"];
  if (PHP_ENGINES.has(engineId)) return ["php"];
  return [];
}

function globForLangs(langs: LangId[]): { include: string; ignore: string[] } {
  const hasJava = langs.includes("java");
  const hasJs = langs.some((l) => l === "javascript" || l === "typescript" || l === "tsx");
  const hasPhp = langs.includes("php");

  if (hasJava) {
    return {
      include: "**/*.java",
      ignore: [
        "**/target/**", "**/build/**", "**/node_modules/**",
        "**/generated-sources/**", "**/test/**",
        "**/*Test.java", "**/*Tests.java", "**/*IT.java",
      ],
    };
  }
  if (hasJs) {
    return {
      include: "**/*.{js,mjs,cjs,jsx,ts,tsx}",
      ignore: [
        "**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**",
        "**/coverage/**", "**/*.min.js",
        "**/*.test.js", "**/*.spec.js", "**/*.test.ts", "**/*.spec.ts", "**/test/**",
      ],
    };
  }
  if (hasPhp) {
    return {
      include: "**/*.{php,phtml}",
      ignore: [
        "**/vendor/**", "**/node_modules/**", "**/generated/**",
        "**/var/**", "**/pub/static/**", "**/dev/tests/**", "**/Test/**",
      ],
    };
  }
  return { include: "**/*", ignore: [] };
}

// ── Function detection & signature per language ─────────────────────────────

const JAVA_FN_TYPES = new Set(["method_declaration", "constructor_declaration"]);
const JS_FN_TYPES = new Set([
  "function_declaration",
  "function_expression",
  "arrow_function",
  "method_definition",
  "generator_function",
  "generator_function_declaration",
]);
const PHP_FN_TYPES = new Set([
  "function_definition",
  "method_declaration",
]);

function fnTypesFor(lang: LangId): Set<string> {
  if (lang === "java") return JAVA_FN_TYPES;
  if (lang === "php") return PHP_FN_TYPES;
  return JS_FN_TYPES;
}

function functionSignature(node: Parser.SyntaxNode, rel: string, lang: LangId): string {
  const nameNode = node.childForFieldName("name");
  if (nameNode) return `${rel}::${nameNode.text}`;
  // arrow_function / anonymous — fall back to parent variable declarator
  if (lang !== "java" && lang !== "php") {
    const parent = node.parent;
    if (parent && parent.type === "variable_declarator") {
      const parentName = parent.childForFieldName("name");
      if (parentName) return `${rel}::${parentName.text}`;
    }
    if (parent && parent.type === "pair") {
      const key = parent.childForFieldName("key");
      if (key) return `${rel}::${key.text}`;
    }
  }
  return `${rel}::<anon@${node.startPosition.row + 1}>`;
}

// ── Decision-point counting ─────────────────────────────────────────────────

/** Node types that always contribute +1 (branch / loop / catch / case). */
const BRANCH_TYPES = new Set([
  // Java
  "if_statement",
  "while_statement",
  "for_statement",
  "enhanced_for_statement",
  "do_statement",
  "catch_clause",
  "ternary_expression",
  "switch_label", // Java case / default label
  // JS/TS
  "for_in_statement",
  "for_of_statement",
  "switch_case",
  "switch_default",
  "conditional_expression",
  // PHP
  "foreach_statement",
  "case_statement",
  "default_statement",
  "match_arm", // php match arm
]);

function isShortCircuitOperator(op: string): boolean {
  return op === "&&" || op === "||" || op === "??";
}

/**
 * Walk a function body and count decision points. We start at 1 and add 1 for
 * every branch/case/loop/catch, plus 1 for each short-circuit && / || in
 * binary expressions.
 *
 * Nested functions inside this function are NOT included — their complexity
 * belongs to their own signature. When we encounter another function-type
 * node we stop descending into it.
 */
function countComplexity(fnNode: Parser.SyntaxNode, lang: LangId): number {
  const fnTypes = fnTypesFor(lang);
  let cc = 1;

  const visit = (node: Parser.SyntaxNode, isRoot: boolean): void => {
    // Do not double-count nested functions.
    if (!isRoot && fnTypes.has(node.type)) return;

    if (BRANCH_TYPES.has(node.type)) cc++;

    if (node.type === "binary_expression") {
      // Find the operator child text.
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (!child) continue;
        const op = child.text;
        if (isShortCircuitOperator(op)) {
          cc++;
          break; // one operator per binary_expression
        }
      }
    }

    // Handle `else if` explicitly for Java/JS — an `else` clause whose body is
    // an `if_statement` shouldn't double-count (the inner if_statement itself
    // will be picked up by BRANCH_TYPES). No extra work needed.

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) visit(child, false);
    }
  };

  // Recurse into the function body only. If we can't isolate a body node,
  // walk the whole function; the fn-type dedupe above protects us.
  const body = fnNode.childForFieldName("body") ?? fnNode;
  visit(body, true);
  return cc;
}

// ── Main entry ──────────────────────────────────────────────────────────────

export interface ComputeComplexityOptions {
  projectRoot: string;
  profile: StackProfile;
  /** Optional cap on files scanned (per-run guard). */
  maxFiles?: number;
}

export async function computeComplexity(opts: ComputeComplexityOptions): Promise<ComplexityResult> {
  const langs = languagesForEngine(opts.profile.id);
  if (langs.length === 0) {
    return { filesScanned: 0, functionsCounted: 0, perFunction: [], findings: [] };
  }
  const { include, ignore } = globForLangs(langs);
  const root = path.resolve(opts.projectRoot);
  const globPattern = path.join(root, include).replace(/\\/g, "/");
  const files = fg.sync(globPattern, { ignore });
  const cap = opts.maxFiles ?? 3000;
  const capped = files.slice(0, cap);

  const perFunction: FunctionComplexity[] = [];
  let filesScanned = 0;

  for (const file of capped) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const lang = extToLang(file);
    if (!lang || !langs.includes(lang)) continue;
    const src = safeRead(file);
    if (!src) continue;
    let tree: Parser.Tree;
    try {
      tree = await astParser.parse(src, lang);
    } catch {
      continue;
    }
    filesScanned++;
    const fnTypes = fnTypesFor(lang);
    const fnNodes: Parser.SyntaxNode[] = [];
    for (const t of fnTypes) {
      fnNodes.push(...tree.rootNode.descendantsOfType(t));
    }
    for (const fn of fnNodes) {
      const cc = countComplexity(fn, lang);
      perFunction.push({
        signature: functionSignature(fn, rel, lang),
        file: rel,
        line: fn.startPosition.row + 1,
        complexity: cc,
      });
    }
  }

  const findings: Finding[] = [];
  for (const f of perFunction) {
    if (f.complexity <= 15) continue;
    const critical = f.complexity > 25;
    findings.push({
      title: `High cyclomatic complexity in ${f.signature.split("::").pop()} (cc=${f.complexity})`,
      description:
        `Function ${f.signature} has a cyclomatic complexity of ${f.complexity}. ` +
        `SonarQube thresholds: > 15 warrants refactoring, > 25 is critical. ` +
        `Consider extracting helper methods, replacing chained conditionals with polymorphism / lookup tables, or splitting the responsibility.`,
      stack: opts.profile.id,
      category: "Complexity",
      file: f.file,
      line: f.line,
      codeRef: `${f.file}:${f.line}`,
      severity: critical ? "CRITICAL" : "HIGH",
      confidence: 0.95,
      ruleId: critical ? "S3776-CRIT" : "S3776",
      recommendation:
        `Refactor ${f.signature.split("::").pop()} to reduce cyclomatic complexity below 15 ` +
        `(currently ${f.complexity}). Extract 2–3 helper functions from the largest branch, ` +
        `or replace the branch tree with a strategy map / early returns.`,
      impact: critical
        ? "Very high — untestable branch space, high defect density risk."
        : "High — hard to maintain and unit-test comprehensively.",
      effort: critical ? "L" : "M",
      source: "scanner",
    });
  }

  return {
    filesScanned,
    functionsCounted: perFunction.length,
    perFunction,
    findings,
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function extToLang(file: string): LangId | null {
  const lower = file.toLowerCase();
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".php") || lower.endsWith(".phtml")) return "php";
  if (lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".tsx") || lower.endsWith(".jsx")) return "tsx";
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "javascript";
  return null;
}

function safeRead(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

/** Small helper for logging — top-N functions by complexity. */
export function topByComplexity(result: ComplexityResult, n = 3): FunctionComplexity[] {
  return [...result.perFunction]
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, n);
}
