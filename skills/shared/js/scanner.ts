/**
 * DCA Shared — JS/TS AST Scanner harness
 * =======================================
 * The Node-stack counterpart to skills/shared/java. Discovers JS/TS sources,
 * parses each with the shared tree-sitter layer (javascript / tsx grammars),
 * runs supplied rules, and de-duplicates into normalized Finding[]. Used by the
 * App Builder engine (actions / API Mesh / eventing / apps) and EDS/Commerce-SaaS
 * (JS) engines.
 */

import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import type Parser from "web-tree-sitter";
import { astParser } from "../ast";
import { langForPath, LangId } from "../ast/languages";
import { Finding, Severity } from "../core/types";

export interface JsCtx {
  file: string;
  rel: string;
  source: string;
  lines: string[];
  root: Parser.SyntaxNode;
  lang: LangId;
}

export interface RuleSpec {
  ruleId: string;
  title: string;
  category: string;
  severity: Severity;
  description: string;
  recommendation: string;
  impact: string;
  effort?: string;
}

export type EmitFn = (loc: Parser.SyntaxNode | number, spec: RuleSpec) => void;
export type JsRule = (ctx: JsCtx, add: EmitFn) => void;

export interface JsScanOptions {
  stackId: string;
  ignore?: string[];
  idMap?: Record<string, string>;
  /** default glob is JS/TS sources under the root. */
  include?: string;
}

export interface JsScanResult {
  findings: Finding[];
  filesScanned: number;
  jsFiles: number;
}

const DEFAULT_IGNORE = [
  "**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**", "**/coverage/**",
  "**/*.min.js", "**/*.test.js", "**/*.spec.js", "**/*.test.ts", "**/*.spec.ts", "**/test/**",
];

export class JsAstScanner {
  private root: string;
  private rules: JsRule[];
  private opts: JsScanOptions;
  private findings: Finding[] = [];
  private seen = new Set<string>();

  constructor(root: string, rules: JsRule[], opts: JsScanOptions) {
    this.root = path.resolve(root);
    this.rules = rules;
    this.opts = opts;
  }

  async scan(): Promise<JsScanResult> {
    const glob = this.opts.include ?? "**/*.{js,mjs,cjs,jsx,ts,tsx}";
    const files = fg.sync(path.join(this.root, glob).replace(/\\/g, "/"), {
      ignore: [...DEFAULT_IGNORE, ...(this.opts.ignore ?? [])],
    });

    let scanned = 0;
    for (const file of files) {
      const lang = langForPath(file);
      if (!lang) continue;
      const source = safeRead(file);
      if (!source) continue;
      let tree: Parser.Tree;
      try {
        tree = await astParser.parse(source, lang);
      } catch {
        continue;
      }
      const ctx: JsCtx = {
        file,
        rel: path.relative(this.root, file).replace(/\\/g, "/"),
        source,
        lines: source.split("\n"),
        root: tree.rootNode,
        lang,
      };
      const add: EmitFn = (loc, spec) => this.push(ctx, loc, spec);
      for (const rule of this.rules) {
        try {
          rule(ctx, add);
        } catch {
          /* never let one rule abort the scan */
        }
      }
      scanned++;
    }
    return { findings: this.findings, filesScanned: scanned, jsFiles: files.length };
  }

  private push(ctx: JsCtx, loc: Parser.SyntaxNode | number, spec: RuleSpec): void {
    const line = typeof loc === "number" ? loc : loc.startPosition.row + 1;
    const ruleId = this.opts.idMap?.[spec.ruleId] ?? spec.ruleId;
    const key = `${ruleId}|${ctx.rel}|${line}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.findings.push({
      title: spec.title,
      description: spec.description,
      stack: this.opts.stackId,
      category: spec.category,
      file: ctx.rel,
      line,
      code: (ctx.lines[line - 1] ?? "").trim().slice(0, 300),
      severity: spec.severity,
      confidence: 0.9,
      ruleId,
      recommendation: spec.recommendation,
      impact: spec.impact,
      effort: spec.effort ?? "M",
      source: "scanner",
    });
  }
}

// ── shared node helpers ───────────────────────────────────────────────────────

export function descend(node: Parser.SyntaxNode, type: string | string[]): Parser.SyntaxNode[] {
  return node.descendantsOfType(type as string);
}

export function calleeText(call: Parser.SyntaxNode): string {
  return call.childForFieldName("function")?.text ?? "";
}

export function argsText(call: Parser.SyntaxNode): string {
  return call.childForFieldName("arguments")?.text ?? "";
}

/** JS/TS string node text minus quotes/backticks. */
export function unquote(s: string): string {
  return s.replace(/^[`"']|[`"']$/g, "");
}

function safeRead(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}
