/**
 * EDS Scanner — Security Scans
 * ===============================
 * Rules: EDS-SEC-001 through EDS-SEC-003
 */
import * as fs from "fs";
import * as path from "path";
import { EdsScannerContext } from "./context";

// ==================== EDS-SEC-001: Inline Event Handlers ====================

export function scanInlineHandlers(ctx: EdsScannerContext): void {
  const allJs = ctx.allJsFiles();

  const inlineHandlerPattern = /on(click|load|error|mouseover|submit|change|input|focus|blur|keydown|keyup)\s*=\s*["']/;
  const innerHtmlWithHandler = /\.innerHTML\s*[\+]?=.*\bon\w+\s*=/;

  for (const fp of allJs) {
    const mod = ctx.module(fp);

    for (const hit of ctx.grep(fp, inlineHandlerPattern)) {
      ctx.add(
        "Security", mod, fp, hit.lineNum,
        "Inline Event Handler",
        "Inline event handler violates CSP and enables XSS vectors",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Use element.addEventListener() instead of inline on* attributes.",
        "Low", "Requires unsafe-inline in CSP — defeats XSS protection"
      );
    }

    for (const hit of ctx.grep(fp, innerHtmlWithHandler)) {
      ctx.add(
        "Security", mod, fp, hit.lineNum,
        "innerHTML with Inline Handler",
        "innerHTML injection contains inline event handlers — XSS + CSP violation",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Build DOM programmatically with createElement + addEventListener.",
        "Low", "Double vulnerability: innerHTML + inline handler"
      );
    }
  }

  // Also check HTML files
  const headHtml = ctx.headHtml();
  if (headHtml) {
    for (const hit of ctx.grep(headHtml, inlineHandlerPattern)) {
      ctx.add(
        "Security", "head", headHtml, hit.lineNum,
        "Inline Event Handler in HTML",
        "Inline event handler in head.html violates CSP",
        ctx.context(headHtml, hit.lineNum), "HIGH",
        "Move event handling to JavaScript files using addEventListener.",
        "Low", "CSP violation"
      );
    }
  }
}

// ==================== EDS-SEC-002: innerHTML with Unsanitized Content ====================

export function scanInnerHtmlXss(ctx: EdsScannerContext): void {
  const allJs = ctx.allJsFiles();

  for (const fp of allJs) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // innerHTML with template literals containing variables (not static strings)
    for (const hit of ctx.grep(fp, /\.innerHTML\s*=\s*`[^`]*\$\{/)) {
      const line = hit.lineText;
      // Skip if it's purely static content from known safe sources
      if (line.includes("DOMPurify") || line.includes("sanitize")) continue;

      ctx.add(
        "Security", mod, fp, hit.lineNum,
        "innerHTML with Template Variable",
        "innerHTML set with template literal containing variables — potential XSS",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Use textContent for text, or build DOM with createElement. If HTML is needed, sanitize with DOMPurify.",
        "Low", "Variables may contain user/API content with injected HTML/JS"
      );
    }

    // innerHTML assigned from variable (not string literal)
    for (const hit of ctx.grep(fp, /\.innerHTML\s*=\s*(?!['"`<])[a-zA-Z_$]/)) {
      const line = hit.lineText;
      if (line.includes("DOMPurify") || line.includes("sanitize")) continue;

      ctx.add(
        "Security", mod, fp, hit.lineNum,
        "innerHTML from Variable",
        "innerHTML assigned from a variable — potential XSS if variable contains untrusted content",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Use textContent or sanitize input. Build DOM programmatically for dynamic content.",
        "Low", "If source is API/URL/user data, this is an XSS vulnerability"
      );
    }

    // innerHTML += (append) with non-static content
    for (const hit of ctx.grep(fp, /\.innerHTML\s*\+=\s*(?!['"`<])/)) {
      ctx.add(
        "Security", mod, fp, hit.lineNum,
        "innerHTML Append from Variable",
        "innerHTML += with variable content — XSS risk",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Use appendChild/append with createElement or DocumentFragment instead.",
        "Low", "Appending untrusted content via innerHTML enables XSS"
      );
    }

    // URL parameter reflected in innerHTML
    const hasUrlParam = /URLSearchParams|location\.(search|hash)|getParam/.test(content);
    const hasInnerHtml = /\.innerHTML\s*=/.test(content);
    if (hasUrlParam && hasInnerHtml) {
      ctx.add(
        "Security", mod, fp, 1,
        "Potential Reflected XSS",
        "File reads URL parameters and uses innerHTML — possible reflected XSS",
        "", "CRITICAL",
        "Never inject URL parameters into innerHTML. Use textContent or sanitize with DOMPurify.",
        "Low", "Reflected XSS allows attacker to craft malicious URLs",
        "Pattern",
        "URL parameters detected with innerHTML usage in same file"
      );
    }
  }
}

// ==================== EDS-SEC-003: Missing Content Security Policy ====================

export function scanCsp(ctx: EdsScannerContext): void {
  const headHtml = ctx.headHtml();
  if (!headHtml) {
    ctx.add(
      "Security", "project", path.join(ctx.root, "head.html"), 0,
      "Missing head.html",
      "No head.html found — cannot verify CSP or other security headers",
      "", "MEDIUM",
      "Create head.html with Content-Security-Policy meta tag.",
      "Low", "Missing security headers"
    );
    return;
  }

  const content = ctx.read(headHtml);

  // Check for CSP meta tag
  if (!content.includes("Content-Security-Policy")) {
    ctx.add(
      "Security", "head", headHtml, 1,
      "Missing Content Security Policy",
      "No Content-Security-Policy meta tag in head.html",
      "", "MEDIUM",
      'Add <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; ...">',
      "Low", "No XSS mitigation layer — injected scripts run unrestricted"
    );
    return;
  }

  // Check for overly permissive CSP
  if (/unsafe-eval/.test(content)) {
    ctx.add(
      "Security", "head", headHtml, 1,
      "CSP Allows unsafe-eval",
      "Content Security Policy includes 'unsafe-eval' — allows eval-based attacks",
      "", "HIGH",
      "Remove 'unsafe-eval' from CSP. Refactor code to avoid eval(), new Function(), etc.",
      "Medium", "eval-based XSS attacks bypass CSP"
    );
  }

  if (/script-src[^;]*\*/.test(content) || /default-src[^;]*\*/.test(content)) {
    ctx.add(
      "Security", "head", headHtml, 1,
      "CSP Too Permissive (Wildcard)",
      "Content Security Policy uses wildcard (*) in script-src or default-src",
      "", "HIGH",
      "Replace wildcard with specific allowed origins.",
      "Low", "Wildcard CSP provides no protection against script injection"
    );
  }
}
