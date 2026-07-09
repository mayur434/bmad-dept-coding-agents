/**
 * DCA Shared — tree-sitter AST layer
 * ===================================
 * A thin, lazy wrapper over `web-tree-sitter` (WASM — portable, no native build).
 * Grammars load on demand and are cached. This is the "true AST" foundation the
 * scanners build on (OSGi/Sling DI graphs, Spring bean wiring, Commerce plugins,
 * App Builder action shapes) instead of regex.
 *
 *   const p = new AstParser();
 *   const tree = await p.parse(javaSource, "java");
 *   const hits = await p.query("java",
 *     "(class_declaration name: (identifier) @name)", tree.rootNode);
 */

import * as fs from "fs";
import Parser from "web-tree-sitter";
import { GRAMMAR_FILE, LangId, langForPath } from "./languages";

let initPromise: Promise<void> | null = null;

/** Initialise the tree-sitter WASM runtime exactly once. */
async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init({
      locateFile(name: string) {
        // Resolve the core runtime wasm from the installed package.
        if (name.endsWith(".wasm")) {
          try {
            return require.resolve(`web-tree-sitter/${name}`);
          } catch {
            /* fall through to default */
          }
        }
        return name;
      },
    });
  }
  return initPromise;
}

function grammarWasmPath(lang: LangId): string {
  const grammar = GRAMMAR_FILE[lang];
  return require.resolve(`tree-sitter-wasms/out/tree-sitter-${grammar}.wasm`);
}

export interface Capture {
  name: string;
  text: string;
  startRow: number; // 0-based
  endRow: number;
  node: Parser.SyntaxNode;
}

export class AstParser {
  private parser: Parser | null = null;
  private languages = new Map<LangId, Parser.Language>();

  private async languageFor(lang: LangId): Promise<Parser.Language> {
    await ensureInit();
    let language = this.languages.get(lang);
    if (!language) {
      language = await Parser.Language.load(grammarWasmPath(lang));
      this.languages.set(lang, language);
    }
    return language;
  }

  private async parserFor(lang: LangId): Promise<Parser> {
    await ensureInit();
    if (!this.parser) this.parser = new Parser();
    this.parser.setLanguage(await this.languageFor(lang));
    return this.parser;
  }

  /** Parse source into a tree. Throws if the language grammar is unavailable. */
  async parse(source: string, lang: LangId): Promise<Parser.Tree> {
    const parser = await this.parserFor(lang);
    return parser.parse(source);
  }

  /** Parse a file by extension; returns null for unknown/unsupported extensions. */
  async parseFile(filePath: string): Promise<{ lang: LangId; tree: Parser.Tree } | null> {
    const lang = langForPath(filePath);
    if (!lang) return null;
    const source = fs.readFileSync(filePath, "utf8");
    const tree = await this.parse(source, lang);
    return { lang, tree };
  }

  /** Run a tree-sitter query and return flattened captures. */
  async query(lang: LangId, queryString: string, node: Parser.SyntaxNode): Promise<Capture[]> {
    const language = await this.languageFor(lang);
    const q = language.query(queryString);
    const captures = q.captures(node);
    return captures.map((c) => ({
      name: c.name,
      text: c.node.text,
      startRow: c.node.startPosition.row,
      endRow: c.node.endPosition.row,
      node: c.node,
    }));
  }

  /** True if the grammar for `lang` can be loaded. */
  async supports(lang: LangId): Promise<boolean> {
    try {
      await this.languageFor(lang);
      return true;
    } catch {
      return false;
    }
  }
}

/** Shared singleton for convenience. */
export const astParser = new AstParser();
