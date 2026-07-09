/**
 * Spring Boot — Tier-1 AST + config Scanner
 * ==========================================
 * Generic Java rules (shared) + Spring-specific Java rules (over the tree-sitter
 * AST) + a config scan of application.properties / application.yml. Emits the
 * normalized Finding[] for the shared standardized report.
 *
 * Rule ids: SPRING-SEC-* (security), SPRING-QUAL-* (quality), SPRING-CFG-* (config).
 */

import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { Finding, Severity } from "../../../../shared/core/types";
import { JavaAstScanner, JavaRule, GENERIC_JAVA_RULES, descend } from "../../../../shared/java";

const SPRING_ID_MAP: Record<string, string> = {
  "GEN-SEC-001": "SPRING-SEC-010", // hardcoded secret in Java
  "GEN-SEC-002": "SPRING-SEC-011", // SQL injection
};

const CONFIG_SECRET =
  /^\s*[#-]?\s*([\w.-]*(password|secret|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?key|auth[_-]?token))\s*[:=]\s*(.+?)\s*$/i;

function annotationNames(node: import("web-tree-sitter").SyntaxNode): string[] {
  const anns = [...descend(node, "marker_annotation"), ...descend(node, "annotation")];
  return anns.map((a) => a.childForFieldName("name")?.text ?? "").filter(Boolean);
}

// ── Spring-specific Java rules ────────────────────────────────────────────────

const ruleFieldInjection: JavaRule = (ctx, add) => {
  for (const fd of descend(ctx.root, "field_declaration")) {
    const names = annotationNames(fd);
    if (names.includes("Autowired") || names.includes("Inject")) {
      add(fd, {
        ruleId: "SPRING-QUAL-001", title: "Field injection (@Autowired on a field)",
        category: "Maintainability", severity: "LOW",
        description: "Field injection hides dependencies and prevents immutability/testability.",
        recommendation: "Use constructor injection (final fields) instead.",
        impact: "Harder to test in isolation and to reason about required collaborators.",
        effort: "S",
      });
    }
  }
};

const ruleMissingValidation: JavaRule = (ctx, add) => {
  for (const fp of descend(ctx.root, "formal_parameter")) {
    const names = annotationNames(fp);
    if (names.includes("RequestBody") && !names.includes("Valid") && !names.includes("Validated")) {
      add(fp, {
        ruleId: "SPRING-SEC-002", title: "@RequestBody without @Valid",
        category: "Security", severity: "MEDIUM",
        description: "A request body is bound without bean validation.",
        recommendation: "Annotate the parameter with @Valid (and add constraints on the DTO).",
        impact: "Unvalidated input reaches business logic — injection, over-posting, bad-data bugs.",
        effort: "S",
      });
    }
  }
};

// line-based Spring rules
const LINE_RULES: Array<{ re: RegExp; spec: Omit<Parameters<typeof buildSpec>[0], never> }> = [
  {
    re: /\.csrf\s*\(\s*\)\s*\.disable\s*\(\s*\)|csrf\s*\(\s*(?:AbstractHttpConfigurer::disable|[a-zA-Z]+\s*->\s*[a-zA-Z]+\.disable\s*\(\s*\))/,
    spec: buildSpec({
      ruleId: "SPRING-SEC-004", title: "CSRF protection disabled", category: "Security", severity: "HIGH",
      description: "Spring Security CSRF protection is disabled.",
      recommendation: "Keep CSRF enabled for stateful/browser flows; only disable for stateless token APIs, deliberately.",
      impact: "Cross-site request forgery against authenticated browser sessions.",
    }),
  },
  {
    re: /anyRequest\s*\(\s*\)\s*\.permitAll\s*\(\s*\)/,
    spec: buildSpec({
      ruleId: "SPRING-SEC-005", title: "Security chain permits all requests", category: "Security", severity: "MEDIUM",
      description: "`anyRequest().permitAll()` leaves every endpoint unauthenticated.",
      recommendation: "Require authentication by default; permit only explicit public paths.",
      impact: "All endpoints exposed without authentication.",
    }),
  },
  {
    re: /@CrossOrigin\s*\(\s*(origins\s*=\s*)?["']\*["']|addAllowedOrigin\s*\(\s*["']\*["']\)|setAllowedOrigins\s*\([^)]*["']\*["']/,
    spec: buildSpec({
      ruleId: "SPRING-SEC-006", title: "CORS allows any origin (*)", category: "Security", severity: "MEDIUM",
      description: "CORS is configured to allow all origins.",
      recommendation: "Allow-list specific trusted origins; avoid `*`, especially with credentials.",
      impact: "Any site can call the API from a victim's browser.",
    }),
  },
];

function buildSpec(s: { ruleId: string; title: string; category: string; severity: Severity; description: string; recommendation: string; impact: string }) {
  return { ...s, effort: "M" as const };
}

const lineRules: JavaRule = (ctx, add) => {
  for (let i = 0; i < ctx.lines.length; i++) {
    for (const { re, spec } of LINE_RULES) {
      if (re.test(ctx.lines[i])) add(i + 1, spec);
    }
  }
};

const SPRING_JAVA_RULES: JavaRule[] = [ruleFieldInjection, ruleMissingValidation, lineRules];

export interface SpringScanResult {
  findings: Finding[];
  filesScanned: number;
  javaFiles: number;
  configFiles: number;
}

export class SpringScanner {
  constructor(private root: string) {}

  async scan(): Promise<SpringScanResult> {
    const java = new JavaAstScanner(this.root, [...GENERIC_JAVA_RULES, ...SPRING_JAVA_RULES], {
      stackId: "spring-boot",
      idMap: SPRING_ID_MAP,
    });
    const jr = await java.scan();
    const { findings: configFindings, configFiles } = this.scanConfig();
    return {
      findings: [...jr.findings, ...configFindings],
      filesScanned: jr.filesScanned + configFiles,
      javaFiles: jr.javaFiles,
      configFiles,
    };
  }

  private scanConfig(): { findings: Finding[]; configFiles: number } {
    const files = fg.sync(
      path.join(this.root, "**/application*.{properties,yml,yaml}").replace(/\\/g, "/"),
      { ignore: ["**/target/**", "**/build/**", "**/node_modules/**"] },
    );
    const findings: Finding[] = [];
    for (const file of files) {
      const rel = path.relative(this.root, file).replace(/\\/g, "/");
      let text = "";
      try {
        text = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const lines = text.split("\n");

      // Proximity checks — handle both flat .properties (`a.b.c=v`) and nested YAML.
      if (nearby(text, ["exposure", "include"], "\\*")) {
        findings.push(cfg(rel, lineOf(lines, /include/), {
          ruleId: "SPRING-SEC-003", title: "Actuator endpoints exposed (*)", severity: "HIGH",
          description: "All Actuator endpoints are exposed over the web.",
          recommendation: "Expose only needed endpoints (e.g. health, info) and secure the rest.",
          impact: "Sensitive endpoints (env, heapdump, threaddump, shutdown) become reachable.",
        }));
      }
      if (nearby(text, ["management", "security", "enabled"], "false")) {
        findings.push(cfg(rel, lineOf(lines, /management|security/), {
          ruleId: "SPRING-SEC-007", title: "Actuator security disabled", severity: "MEDIUM",
          description: "management.security.enabled=false disables Actuator auth.",
          recommendation: "Secure Actuator endpoints with Spring Security.",
          impact: "Operational/diagnostic endpoints exposed unauthenticated.",
        }));
      }
      if (nearby(text, ["h2", "console", "enabled"], "true")) {
        findings.push(cfg(rel, lineOf(lines, /h2|console/), {
          ruleId: "SPRING-SEC-008", title: "H2 console enabled", severity: "MEDIUM",
          description: "The H2 web console is enabled.",
          recommendation: "Disable the H2 console outside local dev; never enable in production.",
          impact: "Interactive DB console can be an RCE/data-exposure vector.",
        }));
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*#/.test(line)) continue;
        const m = CONFIG_SECRET.exec(line);
        if (m) {
          const value = m[3].trim();
          if (value && !/^(\$\{.*\}|ENC\(.*\)|<.*>|changeme|change_me|your[_-].*|example.*|)$/i.test(value)) {
            findings.push(cfg(rel, i + 1, {
              ruleId: "SPRING-CFG-001", title: "Secret hardcoded in configuration", severity: "CRITICAL",
              description: `Config key \`${m[1]}\` holds a literal secret value.`,
              recommendation: "Externalize via env var / secret manager; use ${ENV} placeholders or Spring Config Server/Vault.",
              impact: "Secret committed to VCS and shipped in the artifact.",
            }));
          }
        }
      }
    }
    return { findings, configFiles: files.length };
  }
}

/** Match ordered key parts within short gaps → works for flat props and nested YAML. */
function nearby(text: string, parts: string[], value: string): boolean {
  const re = new RegExp(parts.join("[\\s\\S]{0,40}") + "[\\s\\S]{0,15}" + value, "i");
  return re.test(text);
}

function lineOf(lines: string[], re: RegExp): number {
  const idx = lines.findIndex((l) => re.test(l));
  return idx >= 0 ? idx + 1 : 1;
}

function cfg(rel: string, line: number, s: { ruleId: string; title: string; severity: Severity; description: string; recommendation: string; impact: string }): Finding {
  return {
    title: s.title,
    description: s.description,
    stack: "spring-boot",
    category: s.ruleId.startsWith("SPRING-CFG") ? "Security" : "Security",
    file: rel,
    line,
    severity: s.severity,
    ruleId: s.ruleId,
    recommendation: s.recommendation,
    impact: s.impact,
    effort: "M",
    source: "scanner",
  };
}
