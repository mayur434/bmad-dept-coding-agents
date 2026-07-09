/**
 * DCA Shared — AST language registry
 * ===================================
 * Maps language ids and file extensions to tree-sitter grammar wasm files
 * (from the `tree-sitter-wasms` package). Covers every language in the company
 * stack: Java (AEM/AMS/Sling/Shaft/Spring), PHP (Commerce PaaS), JS/TS
 * (App Builder / EDS / Commerce SaaS drop-ins), plus config formats.
 */

export type LangId =
  | "java"
  | "php"
  | "javascript"
  | "typescript"
  | "tsx"
  | "json"
  | "yaml"
  | "html"
  | "xml"
  | "css";

/** grammar id used in the tree-sitter-wasms file name (tree-sitter-<grammar>.wasm). */
export const GRAMMAR_FILE: Record<LangId, string> = {
  java: "java",
  php: "php",
  javascript: "javascript",
  typescript: "typescript",
  tsx: "tsx",
  json: "json",
  yaml: "yaml",
  html: "html",
  xml: "xml",
  css: "css",
};

const EXT_TO_LANG: Record<string, LangId> = {
  ".java": "java",
  ".php": "php",
  ".phtml": "php",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "tsx",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".html": "html",
  ".htm": "html",
  ".xml": "xml",
  ".css": "css",
};

export function langForExtension(ext: string): LangId | null {
  return EXT_TO_LANG[ext.toLowerCase()] ?? null;
}

export function langForPath(filePath: string): LangId | null {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return null;
  return langForExtension(filePath.slice(dot));
}
