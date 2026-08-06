---
id: roadmap
title: Roadmap
sidebar_position: 91
description: Delivered features by phase, in-progress work, post-audit enhancements, explicitly-deferred items, and how to contribute.
---

Grounded in [IMPLEMENTATION-PLAN.md](https://github.com/mayur434/bmad-dept-code-agent/blob/main/IMPLEMENTATION-PLAN.md) §7 (phased roadmap) and the README's Roadmap Highlights section. All **45 delivered coverage cells** (5 agents × 9 in-scope stack variants) are ✅ complete — the items below are open enhancements, not blockers.

## Delivered — by phase

### Phase 0 — Decisions & spec ✅

Decisions locked: TypeScript-extend (no Python rewrite) · per-agent `resources/` packs · EDS in-scope · Commerce PaaS + SaaS both in-scope · foundation-first · true-AST-now. Summary schema + naming finalized.

### Phase 1 — Shared infra ✅

`skills/shared/{core,report,git,output,ast}` built and verified end-to-end. `StandardExcelReport` with the 15-column Summary contract, `CHANGE-LOG.md` writer, `<agent>-<branch>-<timestamp>` naming, `maybeCutStandardBranch`, tree-sitter AST harness. Wired into every agent through `emitStandardOutputs`.

### Phase 2 — Per-stack knowledge ✅

`resources/<stack>/` packs authored across agents: App Builder (mesh / middleware / eventing / apps + UI-extensibility), Spring Boot, Sling / Shaft (from the PPT KB), Commerce SaaS, plus the AEMaaCS / AMS / Commerce packs. Audit rule-packs exist for all stacks.

### Phase 3 — Audit → full stack ✅

All 8 audit engines produce the identical report shape. Legacy engines unified via `fromLegacyFindingsMap` (legacy rich reports preserved alongside). AST precision pass added to every legacy engine. App Builder eventing + Confidence on every finding. Commerce SaaS engine (JS AST + JSON/config scan) built from scratch and registered.

### Phase 4 — Impact Analysis ✅

Input subsystem (`scripts/inputs/`), generic tracer (`scripts/analysis/tracer.ts`), 8 stack profiles, unique **Input Traceability** sheet. At least one of `--bugs` / `--brd` required.

### Phase 5 — Test Coverage ✅

Gap analysis for all 8 stacks. Real coverage from JaCoCo XML / Istanbul JSON / Clover XML / LCOV (all 4 verified). Opt-in runner (`--run-coverage`). LLM test-generation packs authored for all 8 stack frameworks.

### Phase 6 — Generation ✅

Deterministic scaffolder with **24 types across all 8 stacks** + 5 new AEM IaC scaffolders (dispatcher-config, editable-template, cloud-manager-pipeline, content-fragment-model, experience-fragment). Zero-config MCP auto-provisioning (`--setup`). LLM/MCP Tier-2 path preserved.

### Phase 8 — Sonar Scan agent ✅

5th agent added. LLM-driven Sonar-style analysis across all 8 stacks. Standardized report + dedicated **Vulnerabilities** sheet + **Quality Gate** (pass/fail) + Reliability / Security / Maintainability ratings (A–E). CLI is 2-step (LLM scan → `--ingest sonar-findings.json`).

### Legacy engines → AST (precision) ✅

PHP AST harness (7 generic rules). Commerce engine AST-augmented (`engines/commerce/ast-scan.ts` + `ObjectManager` rule). AEM engine AST-augmented (generic Java rules + admin-resolver + resolver-leak). EDS + eds-commerce AST-augmented (generic JS rules + DOM-XSS from URL). All 4 legacy engines now run an AST precision pass; AST wins at overlapping `file:line`; regex is kept for breadth.

### Standard branch (output C) ✅

`maybeCutStandardBranch` wired into all 5 dispatchers. `--create-branch [--source-branch <name>]` cuts `dca/<agent>-<stack>-<timestamp>` from production/main/master/develop. Verified on a git fixture.

### Preflight advisor ✅

Detects LLM + context window, sizes the project, recommends STATIC / LLM / HYBRID. Wired into all 5 `run.ts`; prints on every path'd run unless `--no-preflight`.

## In progress 🟡

- **Shaft KB finalize (Phase 7).** Extend Shaft rule / gen / test packs from the PPT KB across all agents; confirm exact Sling / Felix / Oak versions + build system + whether SAM and MDM ship as separate bundles. End-to-end verify identical A/B/C outputs on real Shaft projects.
- **Registry-refresh spot-check.** The `module.yaml` agent-level description and remaining `SKILL.md` front-matter carry-over should be spot-checked so their prose matches the delivered 5-agent, 8-stack reality.
- **Depth enhancement — XML-config AST scanning.** `di.xml` / `.content.xml` / Spring XML now run through a shared AST rule pipeline for the 4 most common patterns; the remaining long-tail XML rules still fall back to regex.
- **Proofhub ColumnMap CLI flag.** The parser auto-detects Proofhub CSV headers by keyword; a `ColumnMap` override exists in code but is not yet wired to a CLI flag — a real exported sample would let us tune the mapping.
- **BRD source expansion.** Google Docs must currently be exported to `.docx` / `.txt` first (Docs API OAuth is out of scope). Confirmation from consumers that export is acceptable — or a lightweight OAuth path — would close this.

## Post-audit enhancements (from README Roadmap Highlights)

Possible future enhancements beyond the delivered plan, prioritised by the audit-completion review. Not currently scoped:

- **Automated integration tests across the fleet** — one CI job that runs the full chain on a fixture project of each stack and diffs the produced `.xlsx` sheet shapes.
- **MCP auto-provisioning for agents beyond Code Generation** — extend the `--setup` pattern (currently AEM-only in the Generation agent) to Audit, Sonar Scan, Test Coverage, and Impact Analysis where MCP endpoints exist.
- **Leveled logger + typed exit codes for cleaner CI wiring** — today several exit codes are documented but not enforced end-to-end; a single `Level` enum + a canonical exit-code table would let CI adapters drop bespoke parsing.
- **First-class SARIF exporter** — currently the DevOps-role Audit run advertises SARIF as a target flavor, and post-processing works. A native SARIF path would eliminate the post-processing step.
- **Chain-all roll-up de-duplication** — merge the four child CHANGE-LOG entries + roll-up entry into a single chain-level entry (see [chain-all — Known limitation](./workflows/chain-all#known-limitation)).
- **Additional Adobe enterprise stacks** — AEM Forms, AEP / RTCDP, if demand emerges.

## Explicitly deferred

- **Adobe / JVM domain-expert work** — several Sling / Shaft / Cloud Manager rules still live as TODO stubs pending domain-expert authorship. Marked in the source; not blocking the standardized report shape.
- **Data-flow graph (DFG) analysis** — the current cross-file analysis is heuristic (identifier + reverse-reference). A type-resolved DFG would improve precision, but is out of scope for the current phase.

## Contributing

PRs welcome. See the [Contributing section](https://github.com/mayur434/bmad-dept-code-agent/blob/main/README.md#getting-help--contributing) of the README for the entry points:

- **New engine** (new stack under an existing agent) — create `scripts/engines/<stack>/`, add an `audit.ts` with `main()`, register in `engines/registry.ts` with `detect()`, and emit via `emitStandardOutputs()`.
- **New rule pack** — drop a Markdown file under `resources/rule-packs/<stack>/`.
- **New scaffolder type** — add an entry to the `GENERATORS` map in `scripts/scaffold/generators.ts` and a template under `templates/`.

The pre-publish checklist and full authoring guide live in [MANUAL.md — Creating a New Module](https://github.com/mayur434/bmad-dept-code-agent/blob/main/MANUAL.md#creating-a-new-module).
