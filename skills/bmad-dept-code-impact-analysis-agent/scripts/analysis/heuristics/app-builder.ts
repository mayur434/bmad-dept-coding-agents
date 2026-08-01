/**
 * Adobe App Builder heuristic — mesh source refs + action → action invocations
 * the generic tracer misses.
 */

import { FileRef, HeuristicFn, ProjectContext } from "./types";

export const heuristicRefs: HeuristicFn = (filePath, symbolName, project) => {
  const out: FileRef[] = [];
  if (!symbolName || symbolName.length < 3) return out;
  const escSym = escape(symbolName);

  // Mesh source: sources: [{ name: 'foo', handler: {...} }]
  const meshSourceRe = new RegExp(`(name|handler|source)\\s*:\\s*['"\`][^'"\`]*${escSym}[^'"\`]*['"\`]`);
  // Action → action invocation: invokeAction('pkg/actionName')
  const invokeRe = new RegExp(`(invoke(?:Action)?|openwhisk\\.actions\\.invoke|aioLibState)\\s*\\(\\s*['"\`][^'"\`]*${escSym.toLowerCase()}[^'"\`]*['"\`]`, "i");
  // app.config.yaml action reference.
  const yamlRe = new RegExp(`^\\s*(function|include)\\s*:\\s*['"\`]?[^\\n]*${escSym}`, "im");

  for (const f of project.sources) {
    if (f.rel === filePath) continue;
    const rel = f.rel.toLowerCase();
    if ((rel.includes("mesh") && /\.(json|js)$/.test(rel)) && meshSourceRe.test(f.content)) {
      out.push({ file: f.rel, reason: "mesh source ref" });
      continue;
    }
    if (/\.(js|mjs|jsx)$/.test(rel) && invokeRe.test(f.content)) {
      out.push({ file: f.rel, reason: "action invocation" });
      continue;
    }
    if (rel.endsWith("app.config.yaml") || rel.endsWith("app.config.yml")) {
      if (yamlRe.test(f.content)) out.push({ file: f.rel, reason: "app.config.yaml action ref" });
    }
  }
  return out;
};

function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
