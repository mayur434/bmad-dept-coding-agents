/**
 * Adobe App Builder — Tier-1 AST + config Scanner
 * ================================================
 * Generic JS rules (shared) + App Builder-specific JS rules over the tree-sitter
 * AST + a config scan of app.config.yaml, .env/.gitignore, and API Mesh config.
 * Covers the Node surface: actions/middleware, API Mesh, I/O Events, UI apps.
 *
 * Rule ids: APPB-SEC-* (actions/security), APPB-MESH-* (API Mesh), JS-SEC-*.
 */

import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { Finding, Severity } from "../../../../shared/core/types";
import { JsAstScanner, JsRule, GENERIC_JS_RULES } from "../../../../shared/js";

const CONFIG_SECRET =
  /^\s*[#-]?\s*([\w.-]*(password|secret|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?key|auth[_-]?token|token))\s*[:=]\s*(.+?)\s*$/i;

// ── App Builder-specific JS rule: don't log auth headers/tokens ────────────────
const ruleLogSensitive: JsRule = (ctx, add) => {
  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (/(console\.(log|info|debug|error)|logger\.\w+)\s*\(/.test(line) &&
        /__ow_headers|authorization|params\.(apiKey|api_key|token|secret|password)/i.test(line)) {
      add(i + 1, {
        ruleId: "APPB-SEC-004", title: "Logging sensitive request data", category: "Security", severity: "MEDIUM",
        description: "An action logs `__ow_headers` / authorization / secret params.",
        recommendation: "Never log auth headers or secret inputs; redact before logging.",
        impact: "Secrets/PII land in Runtime activation logs.", effort: "S",
      });
    }
  }
};

const APPB_JS_RULES: JsRule[] = [ruleLogSensitive];

export interface AppBuilderScanResult {
  findings: Finding[];
  filesScanned: number;
  jsFiles: number;
  configFiles: number;
}

export class AppBuilderScanner {
  constructor(private root: string) {}

  async scan(): Promise<AppBuilderScanResult> {
    const js = new JsAstScanner(this.root, [...GENERIC_JS_RULES, ...APPB_JS_RULES], {
      stackId: "app-builder",
    });
    const jr = await js.scan();
    const { findings: cfgFindings, configFiles } = this.scanConfig();
    return {
      findings: [...jr.findings, ...cfgFindings],
      filesScanned: jr.filesScanned + configFiles,
      jsFiles: jr.jsFiles,
      configFiles,
    };
  }

  private scanConfig(): { findings: Finding[]; configFiles: number } {
    const findings: Finding[] = [];
    let configFiles = 0;

    // app.config.yaml — require-adobe-auth + literal secrets
    for (const rel of ["app.config.yaml", "app.config.yml"]) {
      const full = path.join(this.root, rel);
      if (!fs.existsSync(full)) continue;
      configFiles++;
      const lines = readLines(full);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/require-adobe-auth\s*:\s*false/i.test(line)) {
          findings.push(cfg(rel, i + 1, {
            ruleId: "APPB-SEC-001", title: "Action without Adobe auth (require-adobe-auth: false)", severity: "HIGH",
            description: "An action is exposed without Adobe IMS authentication.",
            recommendation: "Set `require-adobe-auth: true` unless the action is intentionally public and validates its own auth.",
            impact: "Unauthenticated callers can invoke the action directly.",
          }));
        }
        const m = CONFIG_SECRET.exec(line);
        if (m && isLiteralSecret(m[3])) {
          findings.push(cfg(rel, i + 1, {
            ruleId: "APPB-SEC-002", title: "Secret hardcoded in app.config.yaml", severity: "CRITICAL",
            description: `\`${m[1]}\` holds a literal secret instead of a $ENV reference.`,
            recommendation: "Reference secrets as `$ENV_VAR` and supply them via .env / secret store.",
            impact: "Secret committed to VCS and deployed with the app.",
          }));
        }
      }
    }

    // .env committed? (should be gitignored)
    const envPath = path.join(this.root, ".env");
    if (fs.existsSync(envPath)) {
      const gi = fs.existsSync(path.join(this.root, ".gitignore"))
        ? fs.readFileSync(path.join(this.root, ".gitignore"), "utf8")
        : "";
      if (!/(^|\n)\s*\.env\s*(\n|$)/.test(gi) && !/(^|\n)\s*\.env\*/.test(gi)) {
        configFiles++;
        findings.push(cfg(".env", 1, {
          ruleId: "APPB-SEC-005", title: ".env is not gitignored", severity: "HIGH",
          description: "A `.env` file holding secrets is present and not excluded by `.gitignore`.",
          recommendation: "Add `.env` to `.gitignore`; rotate any secret that was committed.",
          impact: "Runtime secrets risk being committed to the repository.",
        }));
      }
    }

    // API Mesh config — hardcoded auth + missing depth limiting
    const meshFiles = fg.sync(
      path.join(this.root, "**/{mesh.json,.mesh.json,*mesh*.json,mesh.config.js,mesh.config.json}").replace(/\\/g, "/"),
      { ignore: ["**/node_modules/**", "**/dist/**"] },
    );
    for (const full of meshFiles) {
      configFiles++;
      const rel = path.relative(this.root, full).replace(/\\/g, "/");
      const text = safeRead(full);
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (/(authorization|x-api-key|apikey|api_key)["'\s]*[:=]\s*["'][^"'${][^"']*["']/i.test(lines[i])) {
          findings.push(cfg(rel, i + 1, {
            ruleId: "APPB-MESH-001", title: "Hardcoded auth in API Mesh source", severity: "HIGH",
            description: "A mesh source embeds a literal Authorization / API key header.",
            recommendation: "Inject credentials via mesh `--secrets` / config, not literal headers.",
            impact: "Upstream credentials exposed in VCS and the deployed mesh.",
          }));
        }
      }
      if (/"?(sources|handler)"?\s*:/.test(text) && !/depthLimit|maxDepth|rateLimit|queryDepth/i.test(text)) {
        findings.push(cfg(rel, 1, {
          ruleId: "APPB-MESH-002", title: "API Mesh without query depth/rate limiting", severity: "MEDIUM",
          description: "The mesh config defines sources but no depth/complexity or rate limiting.",
          recommendation: "Add a depthLimit/complexity plugin and rate limiting to protect upstreams.",
          impact: "Deeply nested or high-volume queries can DoS upstream services.",
        }));
      }
    }

    return { findings, configFiles };
  }
}

function isLiteralSecret(value: string): boolean {
  const v = value.trim().replace(/^["']|["']$/g, "");
  return !!v && !/^(\$\{?\w+\}?|<.*>|changeme|change_me|your[_-].*|example.*|)$/i.test(v);
}

function cfg(rel: string, line: number, s: { ruleId: string; title: string; severity: Severity; description: string; recommendation: string; impact: string }): Finding {
  return {
    title: s.title, description: s.description, stack: "app-builder",
    category: s.ruleId.startsWith("APPB-MESH") ? "API Mesh" : "Security",
    file: rel, line, severity: s.severity, ruleId: s.ruleId,
    recommendation: s.recommendation, impact: s.impact, effort: "M", source: "scanner",
  };
}

function readLines(p: string): string[] {
  return safeRead(p).split("\n");
}

function safeRead(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}
