/**
 * DCA Shared — Adobe / JVM XML rules
 * ===================================
 * Stack-flavored rules for Adobe (AEM Sling, Commerce/Magento) and JVM
 * (Spring) XML configuration. These match on file path + element shape so a
 * single scanner pass over a repo picks up the right stack. Starter set —
 * engines are expected to extend.
 */

import { Finding } from "../../core/types";
import type { XmlRule } from "./generic-rules";

/** Line number (1-based) of the character at `index` in `source`. */
function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) line++;
  }
  return line;
}

function snippet(source: string, index: number): string {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  const lineEnd = source.indexOf("\n", index);
  const end = lineEnd === -1 ? source.length : lineEnd;
  return source.slice(lineStart, end).trim().slice(0, 300);
}

function basename(p: string): string {
  const slash = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return slash === -1 ? p : p.slice(slash + 1);
}

/** True when `p` looks like a Sling/AEM `.content.xml` or a `di.xml`. */
function isSlingContent(p: string): boolean {
  return basename(p).toLowerCase() === ".content.xml";
}
function isDiXml(p: string): boolean {
  return basename(p).toLowerCase() === "di.xml";
}
function isDispatcherConfig(p: string): boolean {
  return /(^|\/)(farm|vhost)s?\b|dispatcher\.any$|\.vhost$/i.test(p);
}
function isWebapiXml(p: string): boolean {
  return basename(p).toLowerCase() === "webapi.xml";
}
function isApplicationContext(p: string): boolean {
  return /applicationContext[^/]*\.xml$/i.test(p);
}
function isSpringSecurity(p: string): boolean {
  return /(spring-)?security[^/]*\.xml$/i.test(p);
}

// ───────────────────────────────────────────────────────────────────────────────
// AEM-XML-001 — unbounded <argument xsi:type="array"> (> 50 entries) — perf smell.
// ───────────────────────────────────────────────────────────────────────────────
export const ruleUnboundedArrayArgument: XmlRule = (source, path, _tree) => {
  if (!isDiXml(path) && !isSlingContent(path)) return [];
  const findings: Finding[] = [];
  const argRe = /<argument\b[^>]*xsi:type\s*=\s*["']array["'][^>]*>([\s\S]*?)<\/argument>/gi;
  for (let m; (m = argRe.exec(source)); ) {
    const body = m[1];
    const itemCount = (body.match(/<item\b/gi) || []).length;
    if (itemCount <= 50) continue;
    const line = lineAt(source, m.index);
    findings.push({
      title: "Unbounded <argument> array in DI config",
      description: `<argument xsi:type="array"> has ${itemCount} entries — large inline lists slow container boot and DI resolution.`,
      category: "Performance",
      file: path,
      line,
      code: snippet(source, m.index),
      severity: "MEDIUM",
      confidence: 0.85,
      ruleId: "AEM-XML-001",
      recommendation: "Move the list to a dedicated config / repository provider; keep inline arrays small.",
      impact: "Slow container boot and DI resolution; brittle merges when lists change.",
      effort: "M",
      source: "scanner",
    });
  }
  return findings;
};

// ───────────────────────────────────────────────────────────────────────────────
// AEM-XML-002 — dispatcher farm/vhost allowing all methods (or `/clientheaders "*"`).
// ───────────────────────────────────────────────────────────────────────────────
export const ruleDispatcherAllowAll: XmlRule = (source, path, _tree) => {
  if (!isDispatcherConfig(path)) return [];
  const findings: Finding[] = [];
  const patterns: Array<[RegExp, string]> = [
    [/\/method\s+"?\*"?/g, `/method "*" allows every HTTP verb`],
    [/\/clientheaders\s+"?\*"?/g, `/clientheaders "*" forwards every request header`],
    [/\/allow(?:AuthorizedRequests)?\s+"?1"?\s*\/allow\s+"?\*"?/g, "/allow \"*\" opens all requests"],
  ];
  for (const [re, why] of patterns) {
    for (let m; (m = re.exec(source)); ) {
      const line = lineAt(source, m.index);
      findings.push({
        title: "Dispatcher config allows all methods/headers",
        description: `Dispatcher farm/vhost has ${why}.`,
        category: "Security",
        file: path,
        line,
        code: snippet(source, m.index),
        severity: "HIGH",
        confidence: 0.9,
        ruleId: "AEM-XML-002",
        recommendation: "Restrict to the exact verbs/headers your app needs (GET, HEAD, POST + safelist).",
        impact: "Enables verb tampering, header smuggling, and unintended origin exposure at the CDN edge.",
        effort: "S",
        source: "scanner",
      });
    }
  }
  return findings;
};

// ───────────────────────────────────────────────────────────────────────────────
// COMMERCE-XML-001 — di.xml circular <preference> (A→B where B→A already exists).
// ───────────────────────────────────────────────────────────────────────────────
export const ruleCircularPreference: XmlRule = (source, path, _tree) => {
  if (!isDiXml(path)) return [];
  const findings: Finding[] = [];
  type Pref = { for: string; type: string; index: number };
  const prefs: Pref[] = [];
  const prefRe = /<preference\b[^>]*\bfor\s*=\s*["']([^"']+)["'][^>]*\btype\s*=\s*["']([^"']+)["'][^>]*\/?>/g;
  for (let m; (m = prefRe.exec(source)); ) {
    prefs.push({ for: m[1], type: m[2], index: m.index });
  }
  for (const p of prefs) {
    const inverse = prefs.find((q) => q.for === p.type && q.type === p.for);
    if (!inverse || inverse.index === p.index) continue;
    const line = lineAt(source, p.index);
    findings.push({
      title: "Circular <preference> in di.xml",
      description: `\`${p.for}\` prefers \`${p.type}\`, but a reverse preference (\`${inverse.for}\` → \`${inverse.type}\`) is also declared.`,
      category: "Configuration",
      file: path,
      line,
      code: snippet(source, p.index),
      severity: "HIGH",
      confidence: 0.95,
      ruleId: "COMMERCE-XML-001",
      recommendation: "Choose a single winning preference; the loser must be removed or scoped to a specific module/area.",
      impact: "DI resolution becomes order-dependent — behaviour flips per deploy and is impossible to reason about.",
      effort: "M",
      source: "scanner",
    });
  }
  return findings;
};

// ───────────────────────────────────────────────────────────────────────────────
// COMMERCE-XML-002 — webapi.xml <route> without <resource ref> — auth bypass.
// ───────────────────────────────────────────────────────────────────────────────
export const ruleWebapiRouteMissingResource: XmlRule = (source, path, _tree) => {
  if (!isWebapiXml(path)) return [];
  const findings: Finding[] = [];
  const routeRe = /<route\b[^>]*>([\s\S]*?)<\/route>/gi;
  for (let m; (m = routeRe.exec(source)); ) {
    const body = m[1];
    if (/<resource\b[^>]*\bref\s*=/.test(body)) continue;
    const line = lineAt(source, m.index);
    findings.push({
      title: "webapi.xml <route> without <resource ref>",
      description: "REST route declared without an ACL <resource ref=…/> — the endpoint has no auth requirement.",
      category: "Security",
      file: path,
      line,
      code: snippet(source, m.index),
      severity: "CRITICAL",
      confidence: 0.9,
      ruleId: "COMMERCE-XML-002",
      recommendation: "Add a <resources><resource ref=\"…\"/></resources> block with the appropriate ACL (anonymous only when truly public).",
      impact: "Unauthenticated access to a REST endpoint — data disclosure or unauthorized mutation.",
      effort: "S",
      source: "scanner",
    });
  }
  return findings;
};

// ───────────────────────────────────────────────────────────────────────────────
// SPRING-XML-001 — <bean> without scope (defaults to singleton) — shared-state risk.
// ───────────────────────────────────────────────────────────────────────────────
export const ruleSpringBeanNoScope: XmlRule = (source, path, _tree) => {
  if (!isApplicationContext(path)) return [];
  const findings: Finding[] = [];
  // Only opening <bean …> (or self-closing) — ignore </bean>.
  const beanRe = /<bean\b([^>]*)\/?>/g;
  for (let m; (m = beanRe.exec(source)); ) {
    const attrs = m[1];
    if (/\bscope\s*=/.test(attrs)) continue;
    // Only flag beans that declare a class or id — skip parent-only stubs.
    if (!/\b(class|id)\s*=/.test(attrs)) continue;
    const line = lineAt(source, m.index);
    findings.push({
      title: "<bean> without explicit scope",
      description: "Bean defaults to singleton scope — mutable fields become shared state across requests.",
      category: "Reliability",
      file: path,
      line,
      code: snippet(source, m.index),
      severity: "MEDIUM",
      confidence: 0.65,
      ruleId: "SPRING-XML-001",
      recommendation: "Declare scope explicitly (`scope=\"prototype\"` for stateful beans, `\"singleton\"` for stateless).",
      impact: "Concurrency bugs, request-bleed of user data, and hard-to-repro production incidents.",
      effort: "S",
      source: "scanner",
    });
  }
  return findings;
};

// ───────────────────────────────────────────────────────────────────────────────
// SPRING-XML-002 — <http auto-config="true"> — deprecated Spring Security pattern.
// ───────────────────────────────────────────────────────────────────────────────
export const ruleSpringSecurityAutoConfig: XmlRule = (source, path, _tree) => {
  if (!isSpringSecurity(path) && !isApplicationContext(path)) return [];
  const findings: Finding[] = [];
  const re = /<http\b[^>]*\bauto-config\s*=\s*["']true["'][^>]*>/gi;
  for (let m; (m = re.exec(source)); ) {
    const line = lineAt(source, m.index);
    findings.push({
      title: "Deprecated <http auto-config=\"true\">",
      description: "`auto-config=\"true\"` enables form login + BASIC + logout implicitly — deprecated and opaque.",
      category: "Security",
      file: path,
      line,
      code: snippet(source, m.index),
      severity: "MEDIUM",
      confidence: 0.9,
      ruleId: "SPRING-XML-002",
      recommendation: "Configure the security filter chain explicitly with <form-login>, <http-basic>, <logout> as needed.",
      impact: "Hidden defaults (BASIC auth enabled) surprise operators and complicate security review.",
      effort: "M",
      source: "scanner",
    });
  }
  return findings;
};

/** All Adobe/JVM XML rules, in reporting order. */
export const ADOBE_XML_RULES: XmlRule[] = [
  ruleUnboundedArrayArgument,
  ruleDispatcherAllowAll,
  ruleCircularPreference,
  ruleWebapiRouteMissingResource,
  ruleSpringBeanNoScope,
  ruleSpringSecurityAutoConfig,
];

// Re-export XmlRule so callers importing the adobe module don't have to reach
// into generic-rules.ts for the rule signature.
export type { XmlRule };
