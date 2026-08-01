/**
 * AEM heuristic — patterns that the generic word-regex tracer misses:
 *   - Sling ResourceType strings (`sling:resourceType="my/site/components/hero"`)
 *   - Content-fragment refs (`cf:` prefix inside .content.xml)
 *   - CSS selector matches for `.cq-<component>` / `.<component>` classes
 */

import { FileRef, HeuristicFn, ProjectContext } from "./types";

export const heuristicRefs: HeuristicFn = (filePath, symbolName, project) => {
  const out: FileRef[] = [];
  if (!symbolName || symbolName.length < 3) return out;
  const symLower = symbolName.toLowerCase();

  // Sling ResourceType: look for the component's containing folder name in
  // resourceType="..." strings across ui.apps/*.content.xml + .html files.
  const resourceTypeRe = new RegExp(`(sling:)?resourceType\\s*=\\s*"[^"]*/${escape(symLower)}(/|")`, "i");
  // Content-fragment refs: cf:<name> or fragmentPath endings.
  const cfRe = new RegExp(`(cf:|fragmentPath\\s*=\\s*"[^"]*)${escape(symLower)}\\b`, "i");
  // CSS class match for components (.cq-hero, .hero__inner, etc.).
  const cssRe = new RegExp(`\\.(cq-)?${escape(symLower)}\\b`, "i");

  for (const f of project.sources) {
    if (f.rel === filePath) continue;
    const rel = f.rel.toLowerCase();
    if (rel.endsWith(".content.xml") || rel.endsWith(".html") || rel.endsWith(".xml")) {
      if (resourceTypeRe.test(f.content)) { out.push({ file: f.rel, reason: "sling:resourceType" }); continue; }
      if (cfRe.test(f.content)) { out.push({ file: f.rel, reason: "content-fragment ref" }); continue; }
    }
    if (rel.endsWith(".css") || rel.endsWith(".scss") || rel.endsWith(".less")) {
      if (cssRe.test(f.content)) out.push({ file: f.rel, reason: "css selector" });
    }
  }
  return out;
};

function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
