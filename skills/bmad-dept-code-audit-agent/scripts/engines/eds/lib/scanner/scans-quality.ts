/**
 * EDS Scanner — SEO & Code Quality Scans
 * =========================================
 * Rules: EDS-SEO-001, EDS-SEO-002, EDS-QUAL-001 through EDS-QUAL-003
 */
import * as fs from "fs";
import * as path from "path";
import { EdsScannerContext } from "./context";

// ==================== EDS-SEO-001: Missing Metadata Block ====================

export function scanMetadata(ctx: EdsScannerContext): void {
  const headHtml = ctx.headHtml();
  if (!headHtml) return;

  const content = ctx.read(headHtml);

  // Check for essential meta tags
  if (!content.includes("og:title") && !content.includes("og:description")) {
    ctx.add(
      "SEO", "head", headHtml, 1,
      "Missing Open Graph Metadata",
      "head.html lacks og:title and og:description meta tags for social sharing",
      "", "MEDIUM",
      'Add <meta property="og:title" content=""> and <meta property="og:description" content="">',
      "Low", "Pages won't show rich previews when shared on social media"
    );
  }

  if (!content.includes('name="description"')) {
    ctx.add(
      "SEO", "head", headHtml, 1,
      "Missing Meta Description",
      "head.html lacks meta description tag",
      "", "MEDIUM",
      'Add <meta name="description" content=""> (dynamically populated from page metadata).',
      "Low", "Search engines use meta description for result snippets"
    );
  }
}

// ==================== EDS-SEO-002: Invalid Heading Hierarchy ====================

export function scanHeadingHierarchy(ctx: EdsScannerContext): void {
  const blockJs = ctx.blockJsFiles();

  for (const fp of blockJs) {
    const mod = ctx.module(fp);

    // Blocks creating H1 elements (likely duplicate — page already has H1 from content)
    for (const hit of ctx.grep(fp, /createElement\s*\(\s*['"]h1['"]\s*\)/)) {
      ctx.add(
        "SEO", mod, fp, hit.lineNum,
        "Block Creates H1",
        "Block dynamically creates an H1 — pages should have exactly one H1 from content",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Use H2 or lower for block headings. The page H1 should come from authored content.",
        "Low", "Multiple H1 tags confuse search engines and screen readers"
      );
    }

    // innerHTML with H1
    for (const hit of ctx.grep(fp, /innerHTML\s*[\+]?=.*<h1[\s>]/)) {
      ctx.add(
        "SEO", mod, fp, hit.lineNum,
        "innerHTML Creates H1",
        "Block injects an H1 via innerHTML — risks duplicate H1 on page",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Use H2 or lower for block headings.",
        "Low", "Multiple H1 tags confuse search engines"
      );
    }
  }
}

// ==================== EDS-QUAL-001: Missing Error Handling in Fetch ====================

export function scanFetchErrorHandling(ctx: EdsScannerContext): void {
  const allJs = ctx.allJsFiles();

  for (const fp of allJs) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // Check for fetch without try/catch or .catch
    if (/await\s+fetch\s*\(/.test(content)) {
      // Simple heuristic: file uses await fetch but has no try/catch or .catch
      const hasTryCatch = /try\s*\{[\s\S]*?fetch[\s\S]*?\}\s*catch/.test(content);
      const hasDotCatch = /fetch[\s\S]*?\.catch\s*\(/.test(content);
      const checksOk = /response\.ok|response\.status/.test(content);

      if (!hasTryCatch && !hasDotCatch) {
        ctx.add(
          "Code Quality", mod, fp, 1,
          "Fetch Without Error Handling",
          "File uses await fetch() without try/catch — block breaks silently on network failure",
          "", "MEDIUM",
          "Wrap fetch calls in try/catch with user-friendly fallback UI on error.",
          "Low", "Network failures leave block in broken/empty state"
        );
      } else if (!checksOk) {
        // Has catch but doesn't check response.ok
        for (const hit of ctx.grep(fp, /await\s+fetch\s*\(/)) {
          ctx.add(
            "Code Quality", mod, fp, hit.lineNum,
            "Missing Response Status Check",
            "fetch() response not checked for .ok — non-200 responses proceed as success",
            ctx.context(fp, hit.lineNum), "LOW",
            "Check response.ok before calling response.json(); throw on HTTP errors.",
            "Low", "4xx/5xx responses may return unexpected content"
          );
          break; // One finding per file is sufficient
        }
      }
    }
  }
}

// ==================== EDS-QUAL-002: Global Variable Pollution ====================

export function scanGlobalPollution(ctx: EdsScannerContext): void {
  const allJs = ctx.allJsFiles();

  for (const fp of allJs) {
    const mod = ctx.module(fp);
    const rel = ctx.rel(fp);

    // Skip framework files where global state is expected
    if (rel === "scripts/scripts.js" || rel === "scripts/aem.js") continue;

    // window.X = assignments (excluding known patterns)
    for (const hit of ctx.grep(fp, /window\.(?!hlx|adobeDataLayer|__FEATURE)/)) {
      if (/window\.\w+\s*=/.test(hit.lineText)) {
        ctx.add(
          "Code Quality", mod, fp, hit.lineNum,
          "Global Variable Assignment",
          "Assigning to window.* creates global state — causes naming collisions between blocks",
          ctx.context(fp, hit.lineNum), "MEDIUM",
          "Use module-scoped variables (const/let) or CustomEvents for inter-block communication.",
          "Low", "Global state makes blocks fragile and untestable"
        );
      }
    }

    // var in module scope (not inside a function)
    for (const hit of ctx.grep(fp, /^var\s+\w+/)) {
      ctx.add(
        "Code Quality", mod, fp, hit.lineNum,
        "var Declaration in Module",
        "Using var at module scope — prefer const/let for block scoping",
        ctx.context(fp, hit.lineNum), "LOW",
        "Replace var with const (or let if reassigned).",
        "Low", "var hoists to function/global scope — less predictable"
      );
    }
  }
}

// ==================== EDS-QUAL-003: Missing Accessibility Attributes ====================

export function scanAccessibility(ctx: EdsScannerContext): void {
  const blockJs = ctx.blockJsFiles();

  for (const fp of blockJs) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // Div/span with click handler but missing role/tabindex/keyboard
    const hasClickOnDiv = /(?:div|span)[\s\S]*?addEventListener\s*\(\s*['"]click['"]/.test(content) ||
      /createElement\s*\(\s*['"](?:div|span)['"]\s*\)[\s\S]*?addEventListener\s*\(\s*['"]click['"]/.test(content);

    if (hasClickOnDiv) {
      const hasRole = /setAttribute\s*\(\s*['"]role['"]/.test(content) || /\.role\s*=/.test(content);
      const hasTabindex = /setAttribute\s*\(\s*['"]tabindex['"]/.test(content) || /tabindex/.test(content);
      const hasKeyboard = /addEventListener\s*\(\s*['"]key(down|up|press)['"]/.test(content);

      if (!hasRole || !hasTabindex || !hasKeyboard) {
        const missing: string[] = [];
        if (!hasRole) missing.push("role");
        if (!hasTabindex) missing.push("tabindex");
        if (!hasKeyboard) missing.push("keyboard handler");

        ctx.add(
          "Accessibility", mod, fp, 1,
          "Interactive Element Missing A11y",
          `Non-semantic element with click handler missing: ${missing.join(", ")}`,
          "", "MEDIUM",
          'Use <button> instead of <div>/<span>, or add role="button", tabindex="0", and keydown handler for Enter/Space.',
          "Low", "Excludes keyboard and screen reader users"
        );
      }
    }

    // Accordion/tab patterns without aria-expanded
    if ((content.includes("accordion") || content.includes("tabs")) &&
        !content.includes("aria-expanded") && !content.includes("aria-selected")) {
      ctx.add(
        "Accessibility", mod, fp, 1,
        "Missing ARIA State Attributes",
        "Accordion/tab pattern without aria-expanded or aria-selected",
        "", "MEDIUM",
        "Add aria-expanded for accordions, aria-selected for tabs, and aria-controls to link trigger to panel.",
        "Low", "Screen readers can't convey open/closed state to users"
      );
    }
  }
}
