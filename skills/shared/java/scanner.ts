/**
 * DCA Shared — Java AST Scanner harness
 * ======================================
 * Reusable across every Java stack (Sling/Shaft, Spring Boot, AEM): discovers Java
 * sources, parses each with the shared tree-sitter layer, runs a supplied list of
 * rules, and de-duplicates into normalized Finding[]. Engines compose
 * GENERIC_JAVA_RULES (see ./generic-rules) with their own stack-specific rules.
 */

import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import type Parser from "web-tree-sitter";
import { astParser } from "../ast";
import { Finding, Severity } from "../core/types";

/** Per-file context handed to every rule. */
export interface JavaCtx {
  file: string;
  /** path relative to project root */
  rel: string;
  source: string;
  lines: string[];
  root: Parser.SyntaxNode;
  /** true when the file path looks like an external-connector integration */
  isConnector: boolean;
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

/** Rules emit findings by node (preferred, for accurate line) or explicit 1-based line. */
export type EmitFn = (loc: Parser.SyntaxNode | number, spec: RuleSpec) => void;
export type JavaRule = (ctx: JavaCtx, add: EmitFn) => void;

export interface JavaScanOptions {
  /** stack id stamped on findings (e.g. "sling-shaft", "spring-boot"). */
  stackId: string;
  /** file-path regex that marks a file as an external connector (raises secret/TLS impact). */
  connectorHint?: RegExp;
  /** extra ignore globs. */
  ignore?: string[];
  /** rebrand generic rule ids per stack, e.g. { "GEN-SEC-001": "SHAFT-SEC-001" }. */
  idMap?: Record<string, string>;
}

export interface JavaScanResult {
  findings: Finding[];
  filesScanned: number;
  javaFiles: number;
}

const DEFAULT_IGNORE = [
  "**/target/**", "**/build/**", "**/node_modules/**", "**/generated-sources/**",
  "**/test/**", "**/*Test.java", "**/*Tests.java", "**/*IT.java",
];

export class JavaAstScanner {
  private root: string;
  private rules: JavaRule[];
  private opts: JavaScanOptions;
  private findings: Finding[] = [];
  private seen = new Set<string>();

  constructor(root: string, rules: JavaRule[], opts: JavaScanOptions) {
    this.root = path.resolve(root);
    this.rules = rules;
    this.opts = opts;
  }

  async scan(): Promise<JavaScanResult> {
    const javaFiles = fg.sync(path.join(this.root, "**/*.java").replace(/\\/g, "/"), {
      ignore: [...DEFAULT_IGNORE, ...(this.opts.ignore ?? [])],
    });

    let scanned = 0;
    for (const file of javaFiles) {
      const source = safeRead(file);
      if (!source) continue;
      let tree: Parser.Tree;
      try {
        tree = await astParser.parse(source, "java");
      } catch {
        continue; // skip unparseable files rather than fail the whole run
      }
      const ctx: JavaCtx = {
        file,
        rel: path.relative(this.root, file).replace(/\\/g, "/"),
        source,
        lines: source.split("\n"),
        root: tree.rootNode,
        isConnector: this.opts.connectorHint ? this.opts.connectorHint.test(file) : false,
      };
      const add: EmitFn = (loc, spec) => this.push(ctx, loc, spec);
      for (const rule of this.rules) {
        try {
          rule(ctx, add);
        } catch {
          /* one faulty rule must never abort the scan */
        }
      }
      scanned++;
    }
    return { findings: this.findings, filesScanned: scanned, javaFiles: javaFiles.length };
  }

  private push(ctx: JavaCtx, loc: Parser.SyntaxNode | number, spec: RuleSpec): void {
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
      ruleId,
      recommendation: spec.recommendation,
      impact: spec.impact,
      effort: spec.effort ?? "M",
      source: "scanner",
    });
  }
}

// ── shared node helpers (used by rule modules) ────────────────────────────────

export function descend(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
  return node.descendantsOfType(type);
}

export function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "");
}

export function firstStringLiteral(node: Parser.SyntaxNode): string | null {
  const lits = node.descendantsOfType("string_literal");
  return lits.length ? lits[0].text : null;
}

function safeRead(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}
