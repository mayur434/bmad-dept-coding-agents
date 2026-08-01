/**
 * Impact Analysis — Per-stack heuristic contract
 * ================================================
 * The generic tracer computes candidate symbols + reverse-references via a
 * project-wide word-regex scan. It misses stack-specific wiring: Sling
 * ResourceType strings, Magento DI XML, Spring `applicationContext.xml`, AEM
 * content-fragment references, EDS block names in `styles/`, etc.
 *
 * Each stack file under `heuristics/` exports:
 *   heuristicRefs(filePath, symbolName, project): FileRef[]
 * returning additional reverse-refs the generic tracer would miss. The tracer
 * merges these into the blast-radius set for the impacted file.
 *
 * The starter set is intentionally small (< 80 LOC per stack) — each can grow
 * later as we mine real projects.
 */

export interface SourceFile {
  /** Path relative to project root, POSIX separators. */
  rel: string;
  /** Base filename without extension. */
  base: string;
  content: string;
}

export interface ProjectContext {
  projectRoot: string;
  /** All source files the tracer already loaded (respecting stack sourceGlobs). */
  sources: SourceFile[];
}

export interface FileRef {
  /** Path relative to project root, POSIX separators. */
  file: string;
  /** Short reason string — flows into logs, not into the sheet. */
  reason: string;
}

export type HeuristicFn = (
  filePath: string,
  symbolName: string,
  project: ProjectContext,
) => FileRef[];
