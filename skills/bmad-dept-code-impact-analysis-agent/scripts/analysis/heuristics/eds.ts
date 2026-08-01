/**
 * Edge Delivery Services heuristic — block name usage across blocks/, styles/,
 * scripts/, and CSS class references. The generic tracer only word-matches on
 * PascalCase class names, so hyphenated block names slip through.
 */

import { FileRef, HeuristicFn, ProjectContext } from "./types";

export const heuristicRefs: HeuristicFn = (filePath, symbolName, project) => {
  const out: FileRef[] = [];
  if (!symbolName || symbolName.length < 3) return out;
  // EDS block names are hyphenated lowercase (e.g. "hero", "product-card").
  const blockName = toKebab(symbolName);
  if (blockName.length < 3) return out;
  const escBlock = escape(blockName);

  // decorateBlock / loadBlock('blockName') and buildBlock('blockName').
  const jsBlockRe = new RegExp(`(loadBlock|decorateBlock|buildBlock|createBlock)\\s*\\(\\s*['"\`]${escBlock}['"\`]`, "i");
  // CSS class reference (.<block>, .<block>__elem).
  const cssRe = new RegExp(`\\.${escBlock}(__[a-z0-9-]+)?\\b`);
  // scripts/*.js referencing the block via string.
  const stringRe = new RegExp(`['"\`]${escBlock}['"\`]`);

  for (const f of project.sources) {
    if (f.rel === filePath) continue;
    const rel = f.rel.toLowerCase();
    if (rel.startsWith("blocks/") && jsBlockRe.test(f.content)) {
      out.push({ file: f.rel, reason: "loadBlock/decorateBlock ref" });
      continue;
    }
    if (rel.startsWith("styles/") && rel.endsWith(".css") && cssRe.test(f.content)) {
      out.push({ file: f.rel, reason: "css block class" });
      continue;
    }
    if (rel.startsWith("scripts/") && rel.endsWith(".js") && stringRe.test(f.content)) {
      out.push({ file: f.rel, reason: "scripts/* block string" });
    }
  }
  return out;
};

function toKebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[_\s]+/g, "-").toLowerCase();
}
function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
