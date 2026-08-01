/**
 * BMAD Test Coverage — Mutation-Testing Hooks
 * =============================================
 * The coverage agent does not run mutation tests itself. It emits per-file,
 * copy-paste-ready commands so a human (or a downstream job) can run the
 * appropriate mutation tool for each uncovered high-priority file.
 *
 * Per-stack tool mapping:
 *   Java    (aem, sling, spring)         → Pitest (Maven plugin)
 *   JS      (app-builder, commerce-saas, → Stryker
 *            eds, eds-commerce)
 *   PHP     (commerce)                    → Infection
 *
 * Adding a new stack? Add its case below and a docs URL. Do not perform any
 * process spawning — this module only formats commands.
 */

import * as path from "path";

export interface MutationHint {
  /** The tool the command invokes. */
  tool: "pitest" | "stryker" | "infection";
  /** Copy-paste-ready shell command. */
  command: string;
  /** Public documentation for the tool. */
  docsUrl: string;
}

const JAVA_STACKS = new Set(["aem", "sling", "spring"]);
const JS_STACKS = new Set(["app-builder", "commerce-saas", "eds", "eds-commerce"]);
const PHP_STACKS = new Set(["commerce", "commerce-paas"]);

/**
 * Return a mutation-testing command for `filePath` on `stack`, or null if the
 * stack has no configured tool (unknown stack) or the file shape doesn't map
 * to a testable target (e.g. XML config files on Commerce).
 */
export function mutationCommandFor(
  filePath: string,
  stack: string,
): MutationHint | null {
  const s = (stack ?? "").toLowerCase().trim();

  if (JAVA_STACKS.has(s)) {
    const cls = javaFqcn(filePath);
    if (!cls) return null;
    return {
      tool: "pitest",
      command: `mvn org.pitest:pitest-maven:mutationCoverage -DtargetClasses=${cls} -DtargetTests=${cls}Test`,
      docsUrl: "https://pitest.org/quickstart/maven/",
    };
  }

  if (JS_STACKS.has(s)) {
    if (!/\.(js|mjs|cjs|ts|tsx)$/i.test(filePath)) return null;
    return {
      tool: "stryker",
      command: `npx stryker run --mutate "${filePath}"`,
      docsUrl: "https://stryker-mutator.io/docs/stryker-js/introduction/",
    };
  }

  if (PHP_STACKS.has(s)) {
    if (!/\.php$/i.test(filePath)) return null;
    return {
      tool: "infection",
      command: `vendor/bin/infection --filter="${filePath}"`,
      docsUrl: "https://infection.github.io/guide/",
    };
  }

  return null;
}

/**
 * Extract a Java fully-qualified class name from a source path.
 *   .../src/main/java/com/adobe/foo/Bar.java  →  com.adobe.foo.Bar
 * Falls back to the bare class name when the `src/main/java` marker is
 * missing, so a stray file still gets a runnable command.
 */
function javaFqcn(filePath: string): string | null {
  const norm = filePath.replace(/\\/g, "/");
  if (!/\.java$/i.test(norm)) return null;
  const marker = "/src/main/java/";
  const i = norm.lastIndexOf(marker);
  if (i >= 0) {
    const rel = norm.slice(i + marker.length).replace(/\.java$/i, "");
    return rel.split("/").join(".");
  }
  return path.basename(norm, ".java");
}

/** Convenience: format a Markdown "Mutation Hints" section for a report. */
export function renderMutationHintsMarkdown(
  hints: Array<{ file: string; score: number; hint: MutationHint }>,
): string {
  if (hints.length === 0) return "";
  const lines: string[] = [];
  lines.push("", "## Mutation Hints", "");
  lines.push(
    "One command per uncovered file with priority ≥ 50. Copy, run, and use the",
    "mutation report to identify weak assertions.",
    "",
  );
  lines.push("| File | Priority | Tool | Command |");
  lines.push("|------|----------|------|---------|");
  for (const h of hints) {
    const safeCmd = h.hint.command.replace(/\|/g, "\\|");
    lines.push(`| \`${h.file}\` | ${h.score} | ${h.hint.tool} | \`${safeCmd}\` |`);
  }
  lines.push("", "Docs:");
  const toolDocs = new Map<string, string>();
  for (const h of hints) toolDocs.set(h.hint.tool, h.hint.docsUrl);
  for (const [tool, url] of toolDocs) lines.push(`- **${tool}** — ${url}`);
  lines.push("");
  return lines.join("\n");
}
