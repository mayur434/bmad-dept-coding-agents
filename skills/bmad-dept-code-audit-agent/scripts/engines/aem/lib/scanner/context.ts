/**
 * AEM Scanner Context — file discovery and helpers for AEM as a Cloud Service projects
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

export class AemScannerContext {
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

  javaFiles(): string[] {
    const patterns = [
      path.join(this.root, "core/src/main/java/**/*.java"),
      path.join(this.root, "bundle/src/main/java/**/*.java"),
    ].map((p) => p.replace(/\\/g, "/"));
    return fg.sync(patterns);
  }

  htlFiles(): string[] {
    const patterns = [
      path.join(this.root, "ui.apps/src/main/content/jcr_root/apps/**/*.html"),
      path.join(this.root, "ui.apps/src/main/content/jcr_root/apps/**/*.htl"),
    ].map((p) => p.replace(/\\/g, "/"));
    return fg.sync(patterns);
  }

  xmlFiles(): string[] {
    const pattern = path.join(this.root, "**/*.xml").replace(/\\/g, "/");
    return fg.sync(pattern, { ignore: ["**/node_modules/**", "**/target/**", "**/.git/**"] });
  }

  contentXmlFiles(): string[] {
    const patterns = [
      path.join(this.root, "ui.apps/src/main/content/jcr_root/**/.content.xml"),
      path.join(this.root, "ui.content/src/main/content/jcr_root/**/.content.xml"),
    ].map((p) => p.replace(/\\/g, "/"));
    return fg.sync(patterns);
  }

  osgiConfigFiles(): string[] {
    const patterns = [
      path.join(this.root, "ui.config/src/main/content/jcr_root/apps/**/config*/**/*.cfg.json"),
      path.join(this.root, "ui.config/src/main/content/jcr_root/apps/**/config*/**/*.config"),
      path.join(this.root, "ui.apps/src/main/content/jcr_root/apps/**/config*/**/*.cfg.json"),
      path.join(this.root, "ui.apps/src/main/content/jcr_root/apps/**/config*/**/*.config"),
    ].map((p) => p.replace(/\\/g, "/"));
    return fg.sync(patterns);
  }

  dispatcherFiles(): string[] {
    const patterns = [
      path.join(this.root, "dispatcher/src/**/*.any"),
      path.join(this.root, "dispatcher/src/**/*.conf"),
    ].map((p) => p.replace(/\\/g, "/"));
    return fg.sync(patterns);
  }

  clientlibFiles(): string[] {
    const pattern = path.join(this.root, "ui.apps/src/main/content/jcr_root/apps/**/clientlibs/**").replace(/\\/g, "/");
    return fg.sync(pattern);
  }

  oakIndexFiles(): string[] {
    const patterns = [
      path.join(this.root, "ui.apps/src/main/content/jcr_root/_oak_index/**/.content.xml"),
      path.join(this.root, "ui.apps/src/main/content/jcr_root/oak:index/**/.content.xml"),
    ].map((p) => p.replace(/\\/g, "/"));
    return fg.sync(patterns);
  }

  vaultHooksDir(): string | null {
    const candidates = [
      path.join(this.root, "ui.apps/src/main/content/META-INF/vault/hooks"),
      path.join(this.root, "all/src/main/content/META-INF/vault/hooks"),
    ];
    for (const d of candidates) {
      if (fs.existsSync(d)) return d;
    }
    return null;
  }

  repoinitFiles(): string[] {
    const pattern = path.join(this.root, "**/org.apache.sling.jcr.repoinit.RepositoryInitializer*").replace(/\\/g, "/");
    return fg.sync(pattern, { ignore: ["**/node_modules/**", "**/target/**"] });
  }

  // ─── Path helpers ──────────────────────────────────────────────────

  rel(fp: string): string {
    return path.relative(this.root, fp).replace(/\\/g, "/");
  }

  module(fp: string): string {
    const rel = this.rel(fp);
    const parts = rel.split("/");
    // For Java: core/src/main/java/com/example/MyClass.java → com.example
    if (parts[0] === "core" && parts.includes("java") && parts.length > 5) {
      const javaIdx = parts.indexOf("java");
      const pkg = parts.slice(javaIdx + 1, -1).join(".");
      return pkg || "core";
    }
    if (parts[0] === "ui.apps" || parts[0] === "ui.content" || parts[0] === "ui.config") {
      return parts[0];
    }
    if (parts[0] === "dispatcher") return "dispatcher";
    return parts[0] || "project";
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
}
