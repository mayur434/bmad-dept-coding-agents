/**
 * DCA Shared — Coverage report discovery
 * =======================================
 * Finds an existing coverage report in a project, most-reliable format first.
 */

import * as path from "path";
import fg from "fast-glob";
import { CoverageTool } from "./parse";

export interface DiscoveredReport { path: string; tool: CoverageTool; }

const PATTERNS: Array<{ glob: string; tool: CoverageTool }> = [
  { glob: "**/coverage/coverage-summary.json", tool: "istanbul" },
  { glob: "coverage-summary.json", tool: "istanbul" },
  { glob: "**/coverage/coverage-final.json", tool: "istanbul" },
  { glob: "**/coverage/lcov.info", tool: "lcov" },
  { glob: "**/lcov.info", tool: "lcov" },
  { glob: "**/target/site/jacoco/jacoco.xml", tool: "jacoco" },
  { glob: "**/build/reports/jacoco/**/*.xml", tool: "jacoco" },
  { glob: "**/jacoco.xml", tool: "jacoco" },
  { glob: "**/clover.xml", tool: "clover" },
];

const IGNORE = ["**/node_modules/**", "**/vendor/**"];

export function discoverReport(projectRoot: string): DiscoveredReport | null {
  for (const { glob, tool } of PATTERNS) {
    const hits = fg.sync(path.join(projectRoot, glob).replace(/\\/g, "/"), { ignore: IGNORE, absolute: true });
    if (hits.length) {
      // newest report wins if several
      hits.sort((a, b) => b.length - a.length);
      return { path: hits[0], tool };
    }
  }
  return null;
}
