/**
 * DCA Shared — Generic XML rules
 * ===============================
 * Stack-agnostic XML security & config rules. Reusable across every XML-heavy
 * stack (Adobe Commerce `di.xml`, Sling/AEM `.content.xml`, Spring
 * `applicationContext.xml`, Apache/Dispatcher config). Each rule takes
 * `(source, path, tree)` and returns `Finding[]`.
 *
 * Because the tree-sitter XML grammar is not currently shipped by the
 * `tree-sitter-wasms` dep this repo pins, the rules operate on the raw source
 * string via regex — `tree` is accepted for the day a real WASM is wired in
 * (rules may then upgrade to AST-based detection without breaking callers).
 */

import type Parser from "web-tree-sitter";
import { Finding } from "../../core/types";

export type XmlRule = (
  source: string,
  path: string,
  tree: Parser.Tree | null,
) => Finding[];

/** Line number (1-based) of the character at `index` in `source`. */
function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** Trim + clip snippet for the Finding.code column. */
function snippet(source: string, index: number): string {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  const lineEnd = source.indexOf("\n", index);
  const end = lineEnd === -1 ? source.length : lineEnd;
  return source.slice(lineStart, end).trim().slice(0, 300);
}

const SECRET_NAME =
  /(pass(word|wd)?|secret|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|credential|auth[_-]?token|bearer)/i;
const PLACEHOLDER =
  /^(|\$\{.*\}|\{\{.*\}\}|%[A-Z_]+%|changeme|change_me|your[_-].*|example.*|placeholder|xxx+|todo|n\/?a|null|true|false|\d{1,3})$/i;
const XSS_ATTRS = /\b(href|src|action|formaction|xlink:href|onclick|onerror|onload|onmouseover)\b/i;
const TEMPLATE_REF = /(\{\{[^}]+\}\}|\$\{[^}]+\})/;

/**
 * XML-SEC-001 — hardcoded credential in an attribute value or element text.
 * Fires when a secret-like key holds a literal string longer than 8 chars that
 * isn't a placeholder / env-var reference.
 */
export const ruleHardcodedSecret: XmlRule = (source, _path, _tree) => {
  const findings: Finding[] = [];

  // Case A — direct attribute: <foo password="…"/>
  const attrRe = /([A-Za-z_:][\w:.-]*)\s*=\s*(["'])([^"']*)\2/g;
  for (let m; (m = attrRe.exec(source)); ) {
    const [, name, , value] = m;
    if (!SECRET_NAME.test(name)) continue;
    if (value.length <= 8) continue;
    if (PLACEHOLDER.test(value.trim())) continue;
    const line = lineAt(source, m.index);
    findings.push({
      title: "Hardcoded credential in XML attribute",
      description: `Attribute \`${name}\` holds a literal secret-like value in configuration.`,
      category: "Security",
      file: _path,
      line,
      code: snippet(source, m.index),
      severity: "CRITICAL",
      confidence: 0.85,
      ruleId: "XML-SEC-001",
      recommendation: "Move to a secret store / env var reference; never commit secrets in config.",
      impact: "Credentials in versioned XML config leak to anyone with repo/deploy access.",
      effort: "M",
      source: "scanner",
    });
  }

  // Case B — property/parameter pattern: <property name="password" value="…"/>
  // Widely used in Spring, Sling, Magento, log4j and dispatcher configs.
  const namedValueRe =
    /<([A-Za-z_:][\w:.-]*)\b[^>]*\bname\s*=\s*(["'])([^"']+)\2[^>]*\bvalue\s*=\s*(["'])([^"']*)\4/g;
  for (let m; (m = namedValueRe.exec(source)); ) {
    const [, , , name, , value] = m;
    if (!SECRET_NAME.test(name)) continue;
    if (value.length <= 8) continue;
    if (PLACEHOLDER.test(value.trim())) continue;
    const line = lineAt(source, m.index);
    findings.push({
      title: "Hardcoded credential in XML property",
      description: `Property \`${name}\` holds a literal secret-like value in configuration.`,
      category: "Security",
      file: _path,
      line,
      code: snippet(source, m.index),
      severity: "CRITICAL",
      confidence: 0.9,
      ruleId: "XML-SEC-001",
      recommendation: "Move to a secret store / env var reference; never commit secrets in config.",
      impact: "Credentials in versioned XML config leak to anyone with repo/deploy access.",
      effort: "M",
      source: "scanner",
    });
  }

  // Case C — element text: <password>secret</password>.
  const elemRe = /<([A-Za-z_:][\w:.-]*)\s*(?:[^>]*)>([^<]{9,})<\/\1>/g;
  for (let m; (m = elemRe.exec(source)); ) {
    const [, name, value] = m;
    if (!SECRET_NAME.test(name)) continue;
    const trimmed = value.trim();
    if (trimmed.length <= 8 || PLACEHOLDER.test(trimmed)) continue;
    const line = lineAt(source, m.index);
    findings.push({
      title: "Hardcoded credential in XML element",
      description: `Element \`<${name}>\` contains a literal secret-like value.`,
      category: "Security",
      file: _path,
      line,
      code: snippet(source, m.index),
      severity: "CRITICAL",
      confidence: 0.85,
      ruleId: "XML-SEC-001",
      recommendation: "Move to a secret store / env var reference; never commit secrets in config.",
      impact: "Credentials in versioned XML config leak to anyone with repo/deploy access.",
      effort: "M",
      source: "scanner",
    });
  }

  return findings;
};

/**
 * XML-SEC-002 — unescaped template reference (`{{...}}` or `${...}`) inside
 * an XSS-risky attribute (href/src/on*). Flags reflected-XSS smell in
 * server-rendered XML/XHTML fragments.
 */
export const ruleUnescapedTemplateRef: XmlRule = (source, _path, _tree) => {
  const findings: Finding[] = [];
  const attrRe = /([A-Za-z_:][\w:.-]*)\s*=\s*(["'])([^"']*)\2/g;
  for (let m; (m = attrRe.exec(source)); ) {
    const [, name, , value] = m;
    if (!XSS_ATTRS.test(name)) continue;
    if (!TEMPLATE_REF.test(value)) continue;
    const line = lineAt(source, m.index);
    findings.push({
      title: "Unescaped template reference in XSS-risky attribute",
      description: `Attribute \`${name}\` interpolates \`${value}\` without visible escaping.`,
      category: "Security",
      file: _path,
      line,
      code: snippet(source, m.index),
      severity: "HIGH",
      confidence: 0.7,
      ruleId: "XML-SEC-002",
      recommendation: "Escape the value at render (URL-encode for href/src, JS-escape for on* handlers).",
      impact: "Reflected cross-site scripting or open-redirect in the rendered page.",
      effort: "S",
      source: "scanner",
    });
  }
  return findings;
};

/**
 * XML-CFG-001 — `TODO` / `FIXME` / `XXX` inside a `<value>` element or attribute
 * value. Signals unfinished configuration that would ship as-is.
 */
export const ruleUnfinishedPlaceholder: XmlRule = (source, _path, _tree) => {
  const findings: Finding[] = [];
  const marker = /\b(TODO|FIXME|XXX)\b/;

  // <value>...TODO...</value>  (also <property value="…TODO…"/>).
  const elemRe = /<value\b[^>]*>([\s\S]*?)<\/value>/gi;
  for (let m; (m = elemRe.exec(source)); ) {
    if (!marker.test(m[1])) continue;
    const line = lineAt(source, m.index);
    findings.push({
      title: "Unfinished placeholder in <value>",
      description: `A <value> element contains a TODO/FIXME/XXX marker: \`${m[1].trim().slice(0, 80)}\`.`,
      category: "Configuration",
      file: _path,
      line,
      code: snippet(source, m.index),
      severity: "MEDIUM",
      confidence: 0.95,
      ruleId: "XML-CFG-001",
      recommendation: "Resolve the placeholder before merging; unfinished config leaks to production.",
      impact: "Runtime behaviour depends on a placeholder that was never filled in.",
      effort: "S",
      source: "scanner",
    });
  }

  const attrRe = /([A-Za-z_:][\w:.-]*)\s*=\s*(["'])([^"']*(?:TODO|FIXME|XXX)[^"']*)\2/g;
  for (let m; (m = attrRe.exec(source)); ) {
    const [, name] = m;
    const line = lineAt(source, m.index);
    findings.push({
      title: "Unfinished placeholder in attribute",
      description: `Attribute \`${name}\` still contains a TODO/FIXME/XXX marker.`,
      category: "Configuration",
      file: _path,
      line,
      code: snippet(source, m.index),
      severity: "MEDIUM",
      confidence: 0.95,
      ruleId: "XML-CFG-001",
      recommendation: "Resolve the placeholder before merging; unfinished config leaks to production.",
      impact: "Runtime behaviour depends on a placeholder that was never filled in.",
      effort: "S",
      source: "scanner",
    });
  }

  return findings;
};

/**
 * XML-CFG-002 — external DTD reference (`<!DOCTYPE ... SYSTEM "..."` or PUBLIC).
 * A classic XXE / entity-expansion risk when the parser resolves external
 * entities by default.
 */
export const ruleExternalDtd: XmlRule = (source, _path, _tree) => {
  const findings: Finding[] = [];
  const doctypeRe = /<!DOCTYPE\s+[^>]*\b(SYSTEM|PUBLIC)\b[^>]*>/gi;
  for (let m; (m = doctypeRe.exec(source)); ) {
    const line = lineAt(source, m.index);
    findings.push({
      title: "External DTD reference (XXE risk)",
      description: `DOCTYPE declares an external DTD via ${/SYSTEM/i.test(m[0]) ? "SYSTEM" : "PUBLIC"}.`,
      category: "Security",
      file: _path,
      line,
      code: snippet(source, m.index),
      severity: "HIGH",
      confidence: 0.9,
      ruleId: "XML-CFG-002",
      recommendation:
        "Remove the external DTD; disable external entity/DTD resolution on the parser (setFeature('http://apache.org/xml/features/disallow-doctype-decl', true)).",
      impact: "XML External Entity attacks — SSRF, arbitrary file read, DoS via entity expansion.",
      effort: "M",
      source: "scanner",
    });
  }
  return findings;
};

/**
 * XML-CFG-003 — a single XML comment that spans more than 10 lines. Almost
 * always dead configuration people forgot to delete.
 */
export const ruleLargeCommentBlock: XmlRule = (source, _path, _tree) => {
  const findings: Finding[] = [];
  const commentRe = /<!--([\s\S]*?)-->/g;
  for (let m; (m = commentRe.exec(source)); ) {
    const body = m[1];
    const nl = (body.match(/\n/g) || []).length;
    if (nl <= 10) continue;
    const line = lineAt(source, m.index);
    findings.push({
      title: "Large commented-out XML block",
      description: `Commented XML spans ${nl + 1} lines — almost certainly dead configuration.`,
      category: "Maintainability",
      file: _path,
      line,
      code: snippet(source, m.index),
      severity: "LOW",
      confidence: 0.8,
      ruleId: "XML-CFG-003",
      recommendation: "Delete dead config. If it must be preserved, move it to a docs/history file.",
      impact: "Stale config confuses readers and hides intent during audits.",
      effort: "S",
      source: "scanner",
    });
  }
  return findings;
};

/** All generic XML rules, in reporting order. */
export const GENERIC_XML_RULES: XmlRule[] = [
  ruleHardcodedSecret,
  ruleUnescapedTemplateRef,
  ruleUnfinishedPlaceholder,
  ruleExternalDtd,
  ruleLargeCommentBlock,
];
