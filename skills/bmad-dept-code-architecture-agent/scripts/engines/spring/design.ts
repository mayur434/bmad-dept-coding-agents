/**
 * Spring Boot — Architecture Design Engine (Phase 2.4 stub)
 * =================================================================
 * Full design authoring content lands in Phase 2.5. This stub returns
 * a single INFO finding so the dispatcher end-to-end wiring is exercised.
 */
import type { DesignInput, DesignResult } from "../registry";
import type { Finding } from "../../../../shared/core/types";

const STACK = "spring";

export async function main(_input: DesignInput): Promise<DesignResult> {
  const findings: Finding[] = [
    {
      title: `Architecture authoring stub — ${STACK}`,
      description:
        "Phase 2.4 scaffold. Content agent fills this in Phase 2.5 (ADR templates, HLD/LLD generators, OpenAPI/GraphQL contracts, C4 + sequence diagrams, STRIDE threat models, and spring-native data models).",
      stack: STACK,
      category: "Architecture",
      severity: "INFO",
      source: "scanner",
      recommendation:
        "Run again once Phase 2.5 lands with SKILL.md instructions and stack-specific templates.",
    },
  ];
  return { findings, writtenFiles: [], stats: { adrs: 0, apis: 0, diagrams: 0, models: 0 } };
}
