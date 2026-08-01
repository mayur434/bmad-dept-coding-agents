/**
 * Adobe Commerce SaaS heuristic — GraphQL fragment usage + storefront-event
 * wiring the generic tracer misses.
 */

import { FileRef, HeuristicFn, ProjectContext } from "./types";

export const heuristicRefs: HeuristicFn = (filePath, symbolName, project) => {
  const out: FileRef[] = [];
  if (!symbolName || symbolName.length < 3) return out;
  const escSym = escape(symbolName);

  // GraphQL fragment reuse: `...FragmentName` inside .js/.mjs/.graphql/.gql.
  const fragmentRe = new RegExp(`\\.\\.\\.${escSym}\\b`);
  // Storefront-event publish/subscribe: events.emit('cart-updated'), etc.
  const eventRe = new RegExp(`(events\\.(on|emit|publish|subscribe)|dispatchEvent)\\s*\\(\\s*['"\`][^'"\`]*${escSym.toLowerCase()}[^'"\`]*['"\`]`, "i");
  // GraphQL query-name reference in useQuery / gql tag.
  const queryRe = new RegExp(`(useQuery|useMutation|gql\`)[^\`]*\\b${escSym}\\b`);

  for (const f of project.sources) {
    if (f.rel === filePath) continue;
    const rel = f.rel.toLowerCase();
    if (!/\.(js|mjs|jsx|ts|tsx|graphql|gql)$/.test(rel)) continue;

    if (fragmentRe.test(f.content)) { out.push({ file: f.rel, reason: "graphql fragment reuse" }); continue; }
    if (eventRe.test(f.content)) { out.push({ file: f.rel, reason: "storefront event" }); continue; }
    if (queryRe.test(f.content)) { out.push({ file: f.rel, reason: "graphql query ref" }); }
  }
  return out;
};

function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
