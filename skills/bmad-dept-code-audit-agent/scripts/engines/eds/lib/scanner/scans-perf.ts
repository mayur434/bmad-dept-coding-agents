/**
 * EDS Scanner — Performance Scans
 * ==================================
 * Rules: EDS-PERF-001 through EDS-PERF-005
 */
import * as fs from "fs";
import * as path from "path";
import { EdsScannerContext } from "./context";

// ==================== EDS-PERF-001: Render-Blocking Third-Party Scripts ====================

export function scanRenderBlockingScripts(ctx: EdsScannerContext): void {
  const blockJs = ctx.blockJsFiles();

  for (const fp of blockJs) {
    const mod = ctx.module(fp);

    // Check for synchronous loadScript calls without async option
    for (const hit of ctx.grep(fp, /loadScript\s*\(\s*['"]https:\/\/.*['"](?!\s*,\s*\{.*async)/)) {
      ctx.add(
        "Performance", mod, fp, hit.lineNum,
        "Synchronous Third-Party Script Load",
        "loadScript() without async option blocks rendering",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Add { async: true } option or move to delayed.js: loadScript(url, { async: true })",
        "Low", "Blocks rendering until script downloads and executes"
      );
    }
  }
}

// ==================== EDS-PERF-002: Unoptimized Images ====================

export function scanUnoptimizedImages(ctx: EdsScannerContext): void {
  const allJs = ctx.allJsFiles();

  for (const fp of allJs) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // createElement('img') without using createOptimizedPicture
    for (const hit of ctx.grep(fp, /createElement\s*\(\s*['"]img['"]\s*\)/)) {
      // Check if createOptimizedPicture is imported in the file
      if (!content.includes("createOptimizedPicture")) {
        ctx.add(
          "Performance", mod, fp, hit.lineNum,
          "Unoptimized Image Creation",
          "Creating img element without EDS image optimization utility",
          ctx.context(fp, hit.lineNum), "HIGH",
          "Use createOptimizedPicture() from scripts/aem.js for responsive WebP/AVIF with proper sizing.",
          "Low", "Serves full-size image to all devices — wastes bandwidth, hurts LCP"
        );
      }
    }

    // innerHTML with img tags without width/height
    for (const hit of ctx.grep(fp, /\.innerHTML\s*[\+]?=.*<img\s+(?!.*(?:width|height)=)/)) {
      ctx.add(
        "Performance", mod, fp, hit.lineNum,
        "Image Without Dimensions",
        "Image injected via innerHTML without width/height attributes",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Add explicit width and height attributes to prevent CLS, or use createOptimizedPicture().",
        "Low", "Missing dimensions cause Cumulative Layout Shift (CLS)"
      );
    }

    // Background images without optimization
    for (const hit of ctx.grep(fp, /\.style\.backgroundImage\s*=\s*`?url\(/)) {
      ctx.add(
        "Performance", mod, fp, hit.lineNum,
        "Unoptimized Background Image",
        "Background image set directly without size optimization",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Use ?width= parameter or serve responsive image via CSS media queries.",
        "Medium", "Background images bypass EDS image pipeline — full resolution served"
      );
    }
  }
}

// ==================== EDS-PERF-003: Large JavaScript Bundle ====================

export function scanLargeBundles(ctx: EdsScannerContext): void {
  const allJs = ctx.allJsFiles();

  const heavyLibraries: Array<{ pattern: RegExp; name: string; alternative: string }> = [
    { pattern: /import\s+.*from\s+['"]jquery['"]/, name: "jQuery", alternative: "native document.querySelector/addEventListener" },
    { pattern: /import\s+.*from\s+['"]lodash['"]/, name: "Lodash", alternative: "native Array/Object methods or tiny utilities" },
    { pattern: /import\s+_\s+from\s+['"]lodash/, name: "Lodash (full)", alternative: "lodash-es/{function} for tree-shaking or native" },
    { pattern: /import\s+.*from\s+['"]moment['"]/, name: "Moment.js", alternative: "native Intl.DateTimeFormat or date-fns/esm" },
    { pattern: /import\s+.*from\s+['"]react['"]/, name: "React", alternative: "native DOM APIs — EDS is vanilla JS by design" },
    { pattern: /import\s+.*from\s+['"]vue['"]/, name: "Vue", alternative: "native DOM APIs — EDS is vanilla JS by design" },
    { pattern: /import\s+.*from\s+['"]@angular/, name: "Angular", alternative: "native DOM APIs — EDS is vanilla JS by design" },
    { pattern: /require\s*\(\s*['"]jquery/, name: "jQuery (CJS)", alternative: "native DOM APIs" },
  ];

  for (const fp of allJs) {
    const mod = ctx.module(fp);

    for (const { pattern, name, alternative } of heavyLibraries) {
      for (const hit of ctx.grep(fp, pattern)) {
        ctx.add(
          "Performance", mod, fp, hit.lineNum,
          "Heavy Library Import",
          `Importing ${name} — destroys EDS lightweight architecture advantage`,
          ctx.context(fp, hit.lineNum), "HIGH",
          `Replace with ${alternative}.`,
          "Medium", `${name} adds 50-150KB+ to page weight`
        );
      }
    }

    // Check file size (>100 lines may indicate bloat for a block)
    const rel = ctx.rel(fp);
    if (rel.startsWith("blocks/")) {
      const lineCount = ctx.lineCount(fp);
      if (lineCount > 200) {
        ctx.add(
          "Performance", mod, fp, 1,
          "Large Block File",
          `Block JS file is ${lineCount} lines — consider splitting or lazy-loading heavy logic`,
          "", "MEDIUM",
          "Extract heavy logic into a separate module loaded dynamically via import().",
          "Medium", "Large blocks delay decoration and increase parse time"
        );
      }
    }
  }
}

// ==================== EDS-PERF-004: CLS-Causing Dynamic Content ====================

export function scanClsIssues(ctx: EdsScannerContext): void {
  const blockJs = ctx.blockJsFiles();

  for (const fp of blockJs) {
    const mod = ctx.module(fp);

    // Dynamic img creation without dimensions
    for (const hit of ctx.grep(fp, /createElement\s*\(\s*['"]img['"]\s*\)/)) {
      const content = ctx.read(fp);
      const lines = content.split("\n");
      // Check the next ~10 lines for width/height setting
      const start = hit.lineNum - 1;
      const end = Math.min(lines.length, start + 10);
      const surroundingCode = lines.slice(start, end).join("\n");

      if (!/(\.width\s*=|\.height\s*=|setAttribute\s*\(\s*['"]width|setAttribute\s*\(\s*['"]height|\.style\.aspectRatio)/.test(surroundingCode)) {
        ctx.add(
          "Performance", mod, fp, hit.lineNum,
          "Image Without Dimensions (CLS)",
          "Dynamically created image without width/height — causes layout shift on load",
          ctx.context(fp, hit.lineNum), "HIGH",
          "Set img.width, img.height, and/or img.style.aspectRatio to reserve space.",
          "Low", "CLS penalty in Core Web Vitals"
        );
      }
    }

    // fetch + innerHTML without reserved space
    const content = ctx.read(fp);
    if (/fetch\s*\(/.test(content) && /\.innerHTML\s*=/.test(content)) {
      // Check if container has min-height or aspect-ratio in corresponding CSS
      const cssFile = fp.replace(/\.js$/, ".css");
      const hasCssReserve = fs.existsSync(cssFile) &&
        /(min-height|aspect-ratio|contain:\s*layout)/.test(ctx.read(cssFile));

      if (!hasCssReserve) {
        ctx.add(
          "Performance", mod, fp, 1,
          "Dynamic Content Without Reserved Space",
          "Block fetches data and injects HTML without CSS space reservation",
          "", "MEDIUM",
          "Add min-height or aspect-ratio in CSS to reserve space before content loads.",
          "Low", "Content insertion causes layout shift when no space is reserved"
        );
      }
    }
  }
}

// ==================== EDS-PERF-005: Missing Resource Hints ====================

export function scanResourceHints(ctx: EdsScannerContext): void {
  const headHtml = ctx.headHtml();
  if (!headHtml) return;

  const headContent = ctx.read(headHtml);

  // Collect all third-party origins used in the project
  const allJs = ctx.allJsFiles();
  const thirdPartyOrigins = new Set<string>();

  for (const fp of allJs) {
    const content = ctx.read(fp);
    const urlMatches = content.matchAll(/['"`](https?:\/\/[^/'"` ]+)/g);
    for (const m of urlMatches) {
      try {
        const url = new URL(m[1]);
        if (!url.hostname.includes("hlx.") && !url.hostname.includes("aem.")) {
          thirdPartyOrigins.add(url.origin);
        }
      } catch { /* skip invalid */ }
    }
  }

  // Check for font imports without preconnect
  if (headContent.includes("fonts.googleapis.com") && !headContent.includes('rel="preconnect" href="https://fonts.gstatic.com"')) {
    ctx.add(
      "Performance", "head", headHtml, 1,
      "Missing Font Preconnect",
      "Google Fonts used without preconnect to fonts.gstatic.com",
      "", "MEDIUM",
      'Add: <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      "Low", "Saves 100-300ms on font loading (DNS + TCP + TLS)"
    );
  }

  // Check if significant third-party origins lack preconnect
  const preconnects = headContent.match(/rel="preconnect"\s+href="([^"]+)"/g) || [];
  const preconnectedOrigins = new Set(
    preconnects.map((p) => p.match(/href="([^"]+)"/)?.[1] || "")
  );

  for (const origin of thirdPartyOrigins) {
    if (!preconnectedOrigins.has(origin) && !headContent.includes(origin)) {
      // Only flag origins that appear in multiple files (likely critical)
      let usageCount = 0;
      for (const fp of allJs) {
        if (ctx.read(fp).includes(origin)) usageCount++;
      }
      if (usageCount >= 2) {
        ctx.add(
          "Performance", "head", headHtml, 1,
          "Missing Preconnect",
          `Origin '${origin}' used in ${usageCount} files but no preconnect in head.html`,
          "", "MEDIUM",
          `Add: <link rel="preconnect" href="${origin}">`,
          "Low", "Early connection saves 100-300ms per origin"
        );
      }
    }
  }
}
