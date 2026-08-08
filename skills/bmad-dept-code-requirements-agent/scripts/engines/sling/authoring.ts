/**
 * sling — Requirements Authoring Engine (Phase 2.1 stub)
 * ====================================================================
 * Full authoring content lands in Phase 2.2. This stub returns a single
 * INFO finding so the dispatcher end-to-end wiring is exercised.
 */
import type { AuthoringInput, AuthoringResult } from "../registry";
import type { Finding } from "../../../../shared/core/types";

const STACK = "sling";

export async function main(input: AuthoringInput): Promise<AuthoringResult> {
  const findings: Finding[] = [
    {
      title: `Requirements authoring stub — ${STACK}`,
      description:
        "Phase 2.1 scaffold. Content agent fills in Phase 2.2 (BRD template, Epic/Story/AC generators, stack-specific vocabulary).",
      stack: STACK,
      category: "Authoring",
      severity: "INFO",
      source: "scanner",
      recommendation:
        "Run again once Phase 2.2 lands with SKILL.md instructions and stack-specific templates.",
    },
  ];
  return { findings, stats: { epics: 0, stories: 0, acs: 0 } };
}
