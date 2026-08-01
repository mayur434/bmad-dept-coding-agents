/**
 * EDS + Commerce heuristic — dropin-block usage + Commerce SaaS drop-in refs.
 * Extends the plain EDS heuristic with drop-in specific paths (@dropins/…).
 */

import { FileRef, HeuristicFn, ProjectContext } from "./types";
import { heuristicRefs as edsRefs } from "./eds";

export const heuristicRefs: HeuristicFn = (filePath, symbolName, project) => {
  // Start with the plain EDS heuristic (all block-name based refs).
  const out = edsRefs(filePath, symbolName, project);
  if (!symbolName || symbolName.length < 3) return out;
  const escSym = escape(symbolName);
  const escLower = escape(symbolName.toLowerCase());

  // @dropins import: import { Foo } from '@dropins/storefront-.../foo';
  const dropinImportRe = new RegExp(`from\\s+['"\`]@dropins/[^'"\`]*${escLower}[^'"\`]*['"\`]`, "i");
  // Drop-in container render: render(FooDropin, ...)
  const renderRe = new RegExp(`(render|initialize|create)\\s*\\(\\s*${escSym}\\b`);
  // commerce drop-in scripts/commerce.js referencing the block.
  const commerceRe = new RegExp(`(cart|checkout|pdp|product|search)-[a-z0-9-]*${escLower}`, "i");

  const seen = new Set(out.map((r) => r.file));

  for (const f of project.sources) {
    if (f.rel === filePath || seen.has(f.rel)) continue;
    const rel = f.rel.toLowerCase();
    if (!/\.(js|mjs|jsx)$/.test(rel)) continue;
    if (dropinImportRe.test(f.content)) { out.push({ file: f.rel, reason: "@dropins import" }); continue; }
    if (renderRe.test(f.content)) { out.push({ file: f.rel, reason: "dropin render" }); continue; }
    if (rel.includes("commerce") && commerceRe.test(f.content)) {
      out.push({ file: f.rel, reason: "commerce dropin ref" });
    }
  }
  return out;
};

function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
