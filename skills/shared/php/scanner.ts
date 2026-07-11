/**
 * DCA Shared — PHP AST Scanner harness
 * =====================================
 * The PHP counterpart to skills/shared/java and skills/shared/js. Discovers
 * .php/.phtml sources, parses each with the shared tree-sitter PHP grammar, runs
 * supplied rules, and de-duplicates into normalized Finding[]. Backs the Commerce
 * (Magento 2) engine's move from regex to true AST.
 */

import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import type Parser from "web-tree-sitter";
import { astParser } from "../ast";
import { Finding, Severity } from "../core/types";

export interface PhpCtx {
  file: string;
  rel: string;
  source: string;
  lines: string[];
  root: Parser.SyntaxNode;
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
export type PhpRule = (ctx: PhpCtx, add: EmitFn) => void;

export interface PhpScanOptions {
  stackId: string;
  ignore?: string[];
  idMap?: Record<string, string>;
  /** Override the default php/phtml glob. */
  include?: string;
}

export interface PhpScanResult {
  findings: Finding[];
  filesScanned: number;
  phpFiles: number;
}

const DEFAULT_IGNORE = ["**/vendor/**", "**/node_modules/**", "**/generated/**", "**/var/**", "**/pub/static/**", "**/dev/tests/**", "**/Test/**"];

export class PhpAstScanner {
  private root: string;
  private rules: PhpRule[];
  private opts: PhpScanOptions;
  private findings: Finding[] = [];
  private seen = new Set<string>();

  constructor(root: string, rules: PhpRule[], opts: PhpScanOptions) {
    this.root = path.resolve(root);
    this.rules = rules;
    this.opts = opts;
  }

  async scan(): Promise<PhpScanResult> {
    const glob = this.opts.include ?? "**/*.{php,phtml}";
    const files = fg.sync(path.join(this.root, glob).replace(/\\/g, "/"), {
      ignore: [...DEFAULT_IGNORE, ...(this.opts.ignore ?? [])],
    });
    let scanned = 0;
    for (const file of files) {
      const source = safeRead(file);
      if (!source) continue;
      let tree: Parser.Tree;
      try {
        tree = await astParser.parse(source, "php");
      } catch {
        continue;
      }
      const ctx: PhpCtx = {
        file,
        rel: path.relative(this.root, file).replace(/\\/g, "/"),
        source,
        lines: source.split("\n"),
        root: tree.rootNode,
      };
      const add: EmitFn = (loc, spec) => this.push(ctx, loc, spec);
      for (const rule of this.rules) {
        try { rule(ctx, add); } catch { /* never let one rule abort the scan */ }
      }
      scanned++;
    }
    return { findings: this.findings, filesScanned: scanned, phpFiles: files.length };
  }

  private push(ctx: PhpCtx, loc: Parser.SyntaxNode | number, spec: RuleSpec): void {
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
      confidence: 0.92,
      ruleId,
      recommendation: spec.recommendation,
      impact: spec.impact,
      effort: spec.effort ?? "M",
      source: "scanner",
    });
  }
}

// ── shared helpers ────────────────────────────────────────────────────────────
export function descend(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
  return node.descendantsOfType(type);
}
export function callName(call: Parser.SyntaxNode): string {
  // function_call_expression: field "function"; member_call/scoped_call: field "name"
  return (call.childForFieldName("function") ?? call.childForFieldName("name"))?.text ?? "";
}
export function argsNode(call: Parser.SyntaxNode): Parser.SyntaxNode | null {
  return call.childForFieldName("arguments");
}
export function stripQuotes(s: string): string {
  return s.replace(/^[`"']|[`"']$/g, "");
}
function safeRead(p: string): string {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}
