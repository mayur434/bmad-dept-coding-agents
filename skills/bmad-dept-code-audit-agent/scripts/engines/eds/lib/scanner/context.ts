/**
 * EDS Scanner Context — file discovery and helpers for Edge Delivery Services projects
 */
import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { AuditFinding, FindingsMap } from "../../../../shared/base";

export interface GrepResult {
  lineNum: number;
  lineText: string;
  match: RegExpExecArray;
}

export class EdsScannerContext {
  root: string;
  findings: FindingsMap;
  stats: Record<string, number>;
  private fileCache: Map<string, string> = new Map();

  constructor(root: string) {
    this.root = root;
    this.findings = {};
    this.stats = {};
  }

  // ─── File collection helpers ───────────────────────────────────────

  blockJsFiles(): string[] {
    const pattern = path.join(this.root, "blocks/**/*.js").replace(/\\/g, "/");
    return fg.sync(pattern);
  }

  blockCssFiles(): string[] {
    const pattern = path.join(this.root, "blocks/**/*.css").replace(/\\/g, "/");
    return fg.sync(pattern);
  }

  scriptFiles(): string[] {
    const pattern = path.join(this.root, "scripts/**/*.js").replace(/\\/g, "/");
    return fg.sync(pattern);
  }

  allJsFiles(): string[] {
    return [...this.blockJsFiles(), ...this.scriptFiles()];
  }

  headHtml(): string | null {
    const fp = path.join(this.root, "head.html");
    return fs.existsSync(fp) ? fp : null;
  }

  stylesDir(): string[] {
    const pattern = path.join(this.root, "styles/**/*.css").replace(/\\/g, "/");
    return fg.sync(pattern);
  }

  // ─── Path helpers ──────────────────────────────────────────────────

  rel(fp: string): string {
    return path.relative(this.root, fp).replace(/\\/g, "/");
  }

  module(fp: string): string {
    const rel = this.rel(fp);
    const parts = rel.split("/");
    if (parts[0] === "blocks" && parts.length >= 2) return parts[1];
    if (parts[0] === "scripts") return "scripts";
    if (parts[0] === "styles") return "styles";
    return path.basename(fp, path.extname(fp));
  }

  // ─── File reading ──────────────────────────────────────────────────

  read(fp: string): string {
    if (!this.fileCache.has(fp)) {
      try {
        this.fileCache.set(fp, fs.readFileSync(fp, "utf-8"));
      } catch {
        this.fileCache.set(fp, "");
      }
    }
    return this.fileCache.get(fp)!;
  }

  // ─── Grep helper ──────────────────────────────────────────────────

  grep(fp: string, pattern: RegExp): GrepResult[] {
    const results: GrepResult[] = [];
    const content = this.read(fp);
    if (!content) return results;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = pattern.exec(lines[i]);
      if (m) {
        results.push({ lineNum: i + 1, lineText: lines[i].trim(), match: m });
        pattern.lastIndex = 0;
      }
    }
    return results;
  }

  // ─── Context around a line ─────────────────────────────────────────

  context(fp: string, lineNum: number, window = 2): string {
    const lines: string[] = [];
    const content = this.read(fp);
    if (!content) return "";
    const allLines = content.split("\n");
    const start = Math.max(0, lineNum - window - 1);
    const end = Math.min(allLines.length, lineNum + window);
    for (let i = start; i < end; i++) {
      const prefix = i === lineNum - 1 ? ">>>" : "   ";
      lines.push(`${prefix} L${i + 1}: ${allLines[i]}`);
    }
    return lines.join("\n");
  }

  // ─── Add finding ──────────────────────────────────────────────────

  add(
    category: string,
    mod: string,
    fp: string,
    line: number,
    issueType: string,
    desc: string,
    code: string,
    severity: string,
    rec: string,
    effort = "Medium",
    impact = "",
    confidence = "Verified",
    justification = ""
  ): void {
    if (!this.findings[category]) {
      this.findings[category] = [];
    }
    this.findings[category].push({
      module: mod,
      file: this.rel(fp),
      line,
      type: issueType,
      description: desc,
      code: code ? code.substring(0, 600) : "",
      severity,
      recommendation: rec,
      effort,
      impact,
      confidence,
      justification,
    });
    this.stats[severity] = (this.stats[severity] || 0) + 1;
  }

  // ─── File size in bytes ────────────────────────────────────────────

  fileSize(fp: string): number {
    try {
      return fs.statSync(fp).size;
    } catch {
      return 0;
    }
  }

  lineCount(fp: string): number {
    const content = this.read(fp);
    return content ? content.split("\n").length : 0;
  }
}
