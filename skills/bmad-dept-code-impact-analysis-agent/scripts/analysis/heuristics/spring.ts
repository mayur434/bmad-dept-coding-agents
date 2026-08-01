/**
 * Spring Boot heuristic — bean wiring (@Autowired grep + applicationContext.xml)
 * plus request-mapping path collisions.
 */

import { FileRef, HeuristicFn, ProjectContext } from "./types";

export const heuristicRefs: HeuristicFn = (filePath, symbolName, project) => {
  const out: FileRef[] = [];
  if (!symbolName || symbolName.length < 3) return out;
  const escSym = escape(symbolName);

  // @Autowired / constructor injection of a bean of this type.
  const autowiredRe = new RegExp(`@(Autowired|Inject|Resource|Qualifier)\\b[\\s\\S]{0,200}\\b${escSym}\\b`);
  // applicationContext.xml <bean class="..." id="..."/>
  const beanRe = new RegExp(`<bean\\b[^>]*(class|id)\\s*=\\s*"[^"]*${escSym}[^"]*"`);
  // Request-mapping path — foo/bar/{symbolName}.
  const mappingRe = new RegExp(`@(Get|Post|Put|Delete|Patch|Request)Mapping\\s*\\(\\s*"[^"]*${escSym.toLowerCase()}[^"]*"`, "i");

  for (const f of project.sources) {
    if (f.rel === filePath) continue;
    const rel = f.rel.toLowerCase();
    if (rel.endsWith(".java") && (autowiredRe.test(f.content) || mappingRe.test(f.content))) {
      out.push({ file: f.rel, reason: "bean injection / request mapping" });
      continue;
    }
    if ((rel.endsWith(".xml") && rel.includes("context")) || rel.endsWith("applicationcontext.xml")) {
      if (beanRe.test(f.content)) out.push({ file: f.rel, reason: "applicationContext.xml bean" });
    }
  }
  return out;
};

function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
