/**
 * Apache Sling (Shaft) heuristic — OSGi component wiring + Sling ResourceType.
 * Looks for @Component / @Reference references and META-INF/*.xml descriptors.
 */

import { FileRef, HeuristicFn, ProjectContext } from "./types";

export const heuristicRefs: HeuristicFn = (filePath, symbolName, project) => {
  const out: FileRef[] = [];
  if (!symbolName || symbolName.length < 3) return out;
  const escSym = escape(symbolName);

  // OSGi @Reference / @Component wiring in Java sources.
  const osgiRe = new RegExp(`@(Reference|Component|Activate|Deactivate)\\b[\\s\\S]{0,200}\\b${escSym}\\b`);
  // Sling ResourceType strings.
  const resourceTypeRe = new RegExp(`resourceType\\s*=\\s*"[^"]*${escSym.toLowerCase()}(/|")`, "i");
  // OSGi component descriptor XML in META-INF.
  const scrRe = new RegExp(`(interface|implementation)\\b[^>]*=\\s*"[^"]*${escSym}"`);

  for (const f of project.sources) {
    if (f.rel === filePath) continue;
    const rel = f.rel.toLowerCase();
    if (rel.endsWith(".java") && osgiRe.test(f.content)) {
      out.push({ file: f.rel, reason: "@Reference/@Component wiring" });
      continue;
    }
    if (rel.endsWith(".xml") && (rel.includes("/meta-inf/") || rel.endsWith(".content.xml"))) {
      if (scrRe.test(f.content)) { out.push({ file: f.rel, reason: "OSGi SCR descriptor" }); continue; }
      if (resourceTypeRe.test(f.content)) { out.push({ file: f.rel, reason: "sling:resourceType" }); }
    }
  }
  return out;
};

function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
