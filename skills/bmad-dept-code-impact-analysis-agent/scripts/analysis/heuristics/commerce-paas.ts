/**
 * Adobe Commerce PaaS (Magento 2) heuristic — DI graph + wiring the generic
 * tracer misses:
 *   - `di.xml` type/preference/plugin refs
 *   - observer/event wiring in `events.xml`
 *   - EAV attribute usage (attribute_code="...")
 */

import { FileRef, HeuristicFn, ProjectContext } from "./types";

export const heuristicRefs: HeuristicFn = (filePath, symbolName, project) => {
  const out: FileRef[] = [];
  if (!symbolName || symbolName.length < 3) return out;
  const escSym = escape(symbolName);

  // Class refs inside DI/config XML — Magento uses \Vendor\Module\Foo strings.
  const classRe = new RegExp(`(name|type|instance|class|for|forClassName)\\s*=\\s*"[^"]*\\\\?${escSym}(?:\\\\|")`, "i");
  // Event/observer wiring.
  const eventRe = new RegExp(`<(event|observer)\\b[^>]*(name|instance)\\s*=\\s*"[^"]*${escSym}[^"]*"`, "i");
  // EAV / config attribute code.
  const attrRe = new RegExp(`attribute_code\\s*=\\s*"${escSym}"`, "i");

  for (const f of project.sources) {
    if (f.rel === filePath) continue;
    const rel = f.rel.toLowerCase();
    if (!rel.endsWith(".xml") && !rel.endsWith(".php")) continue;

    if (rel.endsWith("di.xml") && classRe.test(f.content)) {
      out.push({ file: f.rel, reason: "di.xml ref" });
      continue;
    }
    if (rel.endsWith("events.xml") && eventRe.test(f.content)) {
      out.push({ file: f.rel, reason: "events.xml wiring" });
      continue;
    }
    if (rel.endsWith(".xml") && attrRe.test(f.content)) {
      out.push({ file: f.rel, reason: "EAV attribute_code" });
    }
  }
  return out;
};

function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
