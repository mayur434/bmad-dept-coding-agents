/**
 * BMAD Impact Analysis Agent — Engine Registry (compatibility shim)
 * =================================================================
 * Impact analysis is input-driven (Proofhub/BRD → tracer), so stack resolution
 * lives in ./profiles as StackProfile objects. This module re-exports thin
 * helpers for `--list-engines` and detection parity with the other agents.
 */

import { PROFILES, detectProfile, profileById, StackProfile } from "./profiles";

export { PROFILES, detectProfile, profileById };
export type { StackProfile };

export function listEngines(): void {
  console.log("Available impact-analysis engines:\n");
  for (const p of PROFILES) console.log(`  ${p.id.padEnd(16)} ${p.name}`);
  console.log("  (aliases: aemcs, aemams → aem; commerce → commerce-paas)");
}

export function detectPlatform(projectPath: string): string | null {
  return detectProfile(projectPath)?.id ?? null;
}
