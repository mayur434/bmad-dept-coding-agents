/**
 * EDS Scanner — Architecture Scans
 * ==================================
 * Rules: EDS-ARCH-001 through EDS-ARCH-004
 */
import * as fs from "fs";
import * as path from "path";
import { EdsScannerContext } from "./context";

// ==================== EDS-ARCH-001: Block Structure Violation ====================

export function scanBlockStructure(ctx: EdsScannerContext): void {
  const blocksDir = path.join(ctx.root, "blocks");
  if (!fs.existsSync(blocksDir)) return;

  const blockFolders = fs.readdirSync(blocksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const folder of blockFolders) {
    const folderPath = path.join(blocksDir, folder);
    const expectedJs = path.join(folderPath, `${folder}.js`);
    const jsFiles = fs.readdirSync(folderPath).filter((f) => f.endsWith(".js"));

    // Check if expected JS file exists
    if (jsFiles.length > 0 && !fs.existsSync(expectedJs)) {
      const actualJs = jsFiles[0];
      ctx.add(
        "Architecture", folder, path.join(folderPath, actualJs), 1,
        "Block File Naming Mismatch",
        `Block folder '${folder}' contains '${actualJs}' but EDS expects '${folder}.js'`,
        `Expected: blocks/${folder}/${folder}.js, Found: blocks/${folder}/${actualJs}`,
        "HIGH",
        `Rename '${actualJs}' to '${folder}.js' to match EDS block loading convention.`,
        "Low", "Block will not load — EDS auto-loads <foldername>.js"
      );
    }

    // Check for decorate export in JS files
    if (fs.existsSync(expectedJs)) {
      const content = ctx.read(expectedJs);
      const hasDecorateExport = /export\s+default\s+(async\s+)?function\s+decorate\s*\(/.test(content) ||
        /export\s+default\s+(async\s+)?\(\s*block\s*\)/.test(content) ||
        /export\s+default\s+decorate/.test(content);

      if (!hasDecorateExport) {
        // Check for CJS
        if (/module\.exports/.test(content)) {
          ctx.add(
            "Architecture", folder, expectedJs, 1,
            "CommonJS in Block",
            "Block uses module.exports (CJS) instead of ESM export default",
            "", "HIGH",
            "Convert to ESM: export default function decorate(block) { ... }",
            "Low", "EDS uses native ES modules — CJS won't load"
          );
        } else {
          ctx.add(
            "Architecture", folder, expectedJs, 1,
            "Missing Decorate Export",
            `Block '${folder}' does not export a default decorate(block) function`,
            "", "HIGH",
            "Add: export default function decorate(block) { ... }",
            "Low", "Block will not be decorated by EDS framework"
          );
        }
      }
    }
  }
}

// ==================== EDS-ARCH-002: DOM Scope Violations ====================

export function scanDomScope(ctx: EdsScannerContext): void {
  const blockJs = ctx.blockJsFiles();

  for (const fp of blockJs) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // Skip framework files
    const rel = ctx.rel(fp);
    if (rel.includes("scripts/scripts.js") || rel.includes("scripts/aem.js")) continue;

    // Check for global document queries (outside metadata/head patterns)
    const badPatterns: Array<{ pattern: RegExp; type: string; desc: string }> = [
      {
        pattern: /document\.querySelector\s*\(\s*['"](?!meta|link|head|html|body)/,
        type: "Global document.querySelector",
        desc: "Querying outside block scope with document.querySelector — may reach into other blocks",
      },
      {
        pattern: /document\.querySelectorAll\s*\(\s*['"](?!meta|link)/,
        type: "Global document.querySelectorAll",
        desc: "Querying all matching elements globally — should scope to block parameter",
      },
      {
        pattern: /document\.getElementById\s*\(/,
        type: "document.getElementById",
        desc: "Using getElementById creates coupling between blocks",
      },
      {
        pattern: /document\.getElementsByClassName\s*\(/,
        type: "document.getElementsByClassName",
        desc: "Global class query creates coupling — use block.querySelectorAll instead",
      },
    ];

    for (const { pattern, type, desc } of badPatterns) {
      for (const hit of ctx.grep(fp, pattern)) {
        // Skip if it's a metadata read or event dispatch
        if (hit.lineText.includes("meta[") || hit.lineText.includes("dispatchEvent")) continue;

        ctx.add(
          "Architecture", mod, fp, hit.lineNum,
          type, desc,
          ctx.context(fp, hit.lineNum), "MEDIUM",
          "Use block.querySelector() or block.querySelectorAll() to scope queries to the block element.",
          "Low", "Cross-block coupling causes race conditions and fragile behavior"
        );
      }
    }
  }
}

// ==================== EDS-ARCH-003: Missing Loading Strategy ====================

export function scanLoadingStrategy(ctx: EdsScannerContext): void {
  const headHtml = ctx.headHtml();

  // Check head.html for render-blocking third-party scripts
  if (headHtml) {
    const content = ctx.read(headHtml);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Script tags without async/defer from third-party
      if (/<script\s+src=["']https?:\/\//.test(line) &&
          !/(async|defer)/.test(line)) {
        ctx.add(
          "Architecture", "head", headHtml, i + 1,
          "Render-Blocking Script in head.html",
          "Third-party script without async/defer blocks critical rendering path",
          line.trim(), "CRITICAL",
          "Move to scripts/delayed.js or add async/defer attribute.",
          "Low", "Blocks LCP for all pages — biggest CWV impact"
        );
      }
    }
  }

  // Check scripts.js for missing phase separation
  const scriptsJs = path.join(ctx.root, "scripts", "scripts.js");
  if (fs.existsSync(scriptsJs)) {
    const content = ctx.read(scriptsJs);
    // Check if third-party CDN scripts are eagerly loaded
    for (const hit of ctx.grep(scriptsJs, /import\s+.*from\s+['"]https:\/\//)) {
      ctx.add(
        "Architecture", "scripts", scriptsJs, hit.lineNum,
        "Eager Third-Party Import",
        "Third-party script imported eagerly in scripts.js — should be in delayed phase",
        ctx.context(scriptsJs, hit.lineNum), "HIGH",
        "Move third-party imports to scripts/delayed.js for non-critical loading.",
        "Low", "Adds to critical path bundle size"
      );
    }
  }
}

// ==================== EDS-ARCH-004: Improper Block Variant Pattern ====================

export function scanBlockVariants(ctx: EdsScannerContext): void {
  const blocksDir = path.join(ctx.root, "blocks");
  if (!fs.existsSync(blocksDir)) return;

  const blockFolders = fs.readdirSync(blocksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  // Detect variant folders (e.g., hero-dark, hero-centered)
  const baseBlocks = new Set<string>();
  const variantBlocks: Array<{ base: string; variant: string; folder: string }> = [];

  for (const folder of blockFolders) {
    const dashIdx = folder.lastIndexOf("-");
    if (dashIdx > 0) {
      const potentialBase = folder.substring(0, dashIdx);
      if (blockFolders.includes(potentialBase)) {
        variantBlocks.push({ base: potentialBase, variant: folder.substring(dashIdx + 1), folder });
      }
    }
    baseBlocks.add(folder);
  }

  for (const { base, variant, folder } of variantBlocks) {
    const folderPath = path.join(blocksDir, folder);
    const jsFile = path.join(folderPath, `${folder}.js`);
    const target = fs.existsSync(jsFile) ? jsFile : folderPath;

    ctx.add(
      "Architecture", folder, target, 1,
      "Duplicate Block Variant",
      `'${folder}' appears to be a variant of '${base}' — use CSS class variant pattern instead`,
      `Found: blocks/${folder}/ (likely variant '${variant}' of blocks/${base}/)`,
      "MEDIUM",
      `Use a single '${base}' block with CSS class '.${base}.${variant}' applied via authoring table.`,
      "Medium", "Duplicate code, harder maintenance, inconsistent behavior"
    );
  }
}
