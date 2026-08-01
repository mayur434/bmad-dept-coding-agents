/**
 * DCA Shared — XML tree-sitter harness
 * =====================================
 * WASM loader + walk helpers for XML sources — parallel to the Java/JS/PHP
 * harnesses. Backs future scanners for Adobe/JVM XML configs today's audit
 * scanners ignore (`di.xml`, `.content.xml`, `applicationContext.xml`,
 * dispatcher farm/vhost config).
 *
 *   const tree = await parseXml(source);
 *   findAll(tree.rootNode, (n) => n.type === "STag");
 *
 * NOTE ON WASM AVAILABILITY
 * -------------------------
 * The `tree-sitter-wasms@^0.1.11` package used across this repo does NOT ship
 * a `tree-sitter-xml.wasm` grammar. Rather than add a new npm dep, the loader
 * probes a small set of candidate paths and, if none exist, throws a clear
 * error so callers can degrade gracefully. Rules are written to work on raw
 * source text (regex over the string) so they remain useful even when the
 * AST is unavailable; the `tree` parameter is passed through for the day a
 * real WASM grammar is wired in.
 */

import * as fs from "fs";
import * as path from "path";
import Parser from "web-tree-sitter";

/** Candidate WASM search paths — first one that exists wins. */
const XML_WASM_CANDIDATES = [
  "tree-sitter-wasms/out/tree-sitter-xml.wasm",
  "tree-sitter-xml/tree-sitter-xml.wasm",
  "@tree-sitter-grammars/tree-sitter-xml/tree-sitter-xml.wasm",
];

let initPromise: Promise<void> | null = null;
let cachedParser: Parser | null = null;
let cachedLanguage: Parser.Language | null = null;
let wasmResolveError: string | null = null;

/** Initialise the tree-sitter WASM runtime exactly once. */
async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init({
      locateFile(name: string) {
        if (name.endsWith(".wasm")) {
          try {
            return require.resolve(`web-tree-sitter/${name}`);
          } catch {
            /* fall through */
          }
        }
        return name;
      },
    });
  }
  return initPromise;
}

/** Locate the XML grammar wasm on disk, or return null with a diagnostic reason. */
function resolveXmlWasm(): string | null {
  for (const candidate of XML_WASM_CANDIDATES) {
    try {
      const resolved = require.resolve(candidate);
      if (fs.existsSync(resolved)) return resolved;
    } catch {
      /* try next */
    }
  }
  wasmResolveError =
    `XML tree-sitter WASM not found — is tree-sitter-wasms installed? ` +
    `(tried: ${XML_WASM_CANDIDATES.join(", ")})`;
  return null;
}

/**
 * Load the shared XML parser (cached). Throws a clear error when no XML
 * grammar wasm is available on disk — callers should catch and either skip
 * AST-only work or fall back to source-based rules.
 */
export async function loadXmlParser(): Promise<Parser> {
  if (cachedParser && cachedLanguage) return cachedParser;
  await ensureInit();
  const wasmPath = resolveXmlWasm();
  if (!wasmPath) {
    throw new Error(wasmResolveError ?? "XML tree-sitter WASM not found");
  }
  cachedLanguage = await Parser.Language.load(wasmPath);
  cachedParser = new Parser();
  cachedParser.setLanguage(cachedLanguage);
  return cachedParser;
}

/** Parse an XML source string into a Tree. Throws if the WASM grammar is unavailable. */
export async function parseXml(source: string, _path?: string): Promise<Parser.Tree> {
  const parser = await loadXmlParser();
  return parser.parse(source);
}

/** True when the XML WASM grammar is available on disk. Never throws. */
export async function isXmlAstAvailable(): Promise<boolean> {
  try {
    await loadXmlParser();
    return true;
  } catch {
    return false;
  }
}

/** Diagnostic — most recent WASM resolution failure reason, if any. */
export function xmlAstUnavailableReason(): string | null {
  return wasmResolveError;
}

// ── walk helpers ─────────────────────────────────────────────────────────────

/** Depth-first walk over every node in the subtree rooted at `node`. */
export function walk(node: Parser.SyntaxNode, visit: (n: Parser.SyntaxNode) => void): void {
  const stack: Parser.SyntaxNode[] = [node];
  while (stack.length) {
    const current = stack.pop()!;
    visit(current);
    for (let i = current.namedChildCount - 1; i >= 0; i--) {
      const child = current.namedChild(i);
      if (child) stack.push(child);
    }
  }
}

/** Collect every descendant (and `node` itself) matching `predicate`. */
export function findAll(
  node: Parser.SyntaxNode,
  predicate: (n: Parser.SyntaxNode) => boolean,
): Parser.SyntaxNode[] {
  const out: Parser.SyntaxNode[] = [];
  walk(node, (n) => {
    if (predicate(n)) out.push(n);
  });
  return out;
}

/** Return the exact source text spanned by `node`. */
export function textOf(node: Parser.SyntaxNode, source: string): string {
  return source.slice(node.startIndex, node.endIndex);
}

/** Path helpers used by rules to decide which stack a file belongs to. */
export function basename(p: string): string {
  return path.basename(p);
}
