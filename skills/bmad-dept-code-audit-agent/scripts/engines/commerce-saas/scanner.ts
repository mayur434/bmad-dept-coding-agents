/**
 * Adobe Commerce SaaS — Tier-1 AST + config Scanner
 * ==================================================
 * Generic JS rules (shared) + Commerce-SaaS-specific rules over the storefront /
 * integration JS and config: private-credential exposure, hardcoded service
 * endpoints/env-ids, Data Connection webhook signature, GraphQL depth.
 *
 * Rule ids: CSAAS-SEC-* (security), CSAAS-CFG-* (config), CSAAS-PERF-*.
 */

import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { Finding, Severity } from "../../../../shared/core/types";
import { JsAstScanner, JsRule, GENERIC_JS_RULES } from "../../../../shared/js";

// Global (works for both line-based .env and single/multi-line JSON config).
const CONFIG_SECRET =
  /["']?([\w.-]*(password|secret|private[_-]?key|client[_-]?secret|integration[_-]?token|admin[_-]?token|access[_-]?token))["']?\s*[:=]\s*["']?([^"'${,}\s][^"',}\n]{5,})["']?/gi;

// CSAAS-SEC-001: a private/admin/integration token or Authorization bearer literal
// in storefront JS (only the PUBLIC Catalog/Live-Search api-key belongs client-side).
const rulePrivateTokenClientSide: JsRule = (ctx, add) => {
  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (/(Authorization|Bearer|integration[_-]?token|admin[_-]?token|access[_-]?token)\s*[:=]\s*["'][^"'${][^"']{6,}["']/i.test(line)) {
      add(i + 1, {
        ruleId: "CSAAS-SEC-001", title: "Private/admin credential in storefront code", category: "Security", severity: "CRITICAL",
        description: "An Authorization / integration / admin token literal appears in client-side storefront code.",
        recommendation: "Only the public Catalog Service / Live Search api-key belongs client-side; keep private tokens server-side (App Builder action) and inject via config.",
        impact: "Exposes a privileged Commerce credential to every visitor.", effort: "M",
      });
    }
  }
};

// CSAAS-CFG-002: hardcoded SaaS endpoint / environment id in JS (should be config).
const ruleHardcodedSaasConfig: JsRule = (ctx, add) => {
  for (let i = 0; i < ctx.lines.length; i++) {
    if (/(catalog-service\.adobe\.io|commerce\.adobe\.io)/i.test(ctx.lines[i]) ||
        /Magento-Environment-Id\s*[:=]\s*["'][0-9a-f-]{8,}["']/i.test(ctx.lines[i])) {
      add(i + 1, {
        ruleId: "CSAAS-CFG-002", title: "Hardcoded SaaS endpoint / environment id", category: "Maintainability", severity: "MEDIUM",
        description: "A Commerce SaaS endpoint or environment id is hardcoded rather than read from configuration.",
        recommendation: "Source environmentId / endpoints from the storefront config so dev/stage/prod differ by config, not code.",
        impact: "Environment bleed and painful promotion between stages.", effort: "S",
      });
    }
  }
};

// CSAAS-SEC-003: Data Connection / webhook consumer without signature verification.
const ruleDataConnectionSignature: JsRule = (ctx, add) => {
  const isWebhook = /\/(events?|webhook|data-connection|consumer)[-/]/i.test(ctx.rel) || /__ow_body|data[_-]?connection|params\.data\b/i.test(ctx.source);
  if (!isWebhook) return;
  if (!/createHmac|timingSafeEqual|verifySignature|x-adobe-signature|aio-lib-events/i.test(ctx.source)) {
    add(1, {
      ruleId: "CSAAS-SEC-003", title: "Commerce eventing/webhook without signature verification", category: "Security", severity: "HIGH",
      description: "A Commerce (Data Connection / eventing) webhook is handled without verifying the provider signature.",
      recommendation: "Verify the HMAC signature before acting on the event.",
      impact: "Forged commerce events can drive downstream side effects.", effort: "M",
    });
  }
};

const CSAAS_JS_RULES: JsRule[] = [rulePrivateTokenClientSide, ruleHardcodedSaasConfig, ruleDataConnectionSignature];

export interface CommerceSaasScanResult {
  findings: Finding[];
  filesScanned: number;
  jsFiles: number;
  configFiles: number;
}

export class CommerceSaasScanner {
  constructor(private root: string) {}

  async scan(): Promise<CommerceSaasScanResult> {
    const js = new JsAstScanner(this.root, [...GENERIC_JS_RULES, ...CSAAS_JS_RULES], { stackId: "commerce-saas" });
    const jr = await js.scan();
    const { findings: cfg, configFiles } = this.scanConfig();
    return { findings: [...jr.findings, ...cfg], filesScanned: jr.filesScanned + configFiles, jsFiles: jr.jsFiles, configFiles };
  }

  private scanConfig(): { findings: Finding[]; configFiles: number } {
    const files = fg.sync(
      path.join(this.root, "{commerce.env.json,config.json,configs.json,.env,**/config.json}").replace(/\\/g, "/"),
      { ignore: ["**/node_modules/**", "**/dist/**"] },
    );
    const findings: Finding[] = [];
    for (const full of files) {
      const rel = path.relative(this.root, full).replace(/\\/g, "/");
      const text = safeRead(full);
      CONFIG_SECRET.lastIndex = 0;
      let m: RegExpExecArray | null;
      const seen = new Set<number>();
      while ((m = CONFIG_SECRET.exec(text)) !== null) {
        const v = m[3].trim();
        if (!v || /^(\$\{?\w+\}?|<.*>|changeme|example.*)$/i.test(v)) continue;
        const line = text.slice(0, m.index).split("\n").length;
        if (seen.has(line)) continue;
        seen.add(line);
        findings.push(mk(rel, line, {
          ruleId: "CSAAS-CFG-001", title: "Private Commerce secret hardcoded in config", severity: "CRITICAL",
          description: `Config key \`${m[1]}\` holds a literal private secret.`,
          recommendation: "Externalize private secrets (App Builder secrets / env); commit only public storefront keys.",
          impact: "Privileged Commerce credential committed to VCS.",
        }));
      }
    }
    return { findings, configFiles: files.length };
  }
}

function mk(rel: string, line: number, s: { ruleId: string; title: string; severity: Severity; description: string; recommendation: string; impact: string }): Finding {
  return { title: s.title, description: s.description, stack: "commerce-saas", category: "Security", file: rel, line, severity: s.severity, ruleId: s.ruleId, confidence: 0.9, recommendation: s.recommendation, impact: s.impact, effort: "M", source: "scanner" };
}
function safeRead(p: string): string { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } }
