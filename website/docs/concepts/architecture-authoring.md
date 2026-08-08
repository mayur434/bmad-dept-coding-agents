---
id: architecture-authoring
title: Architecture Authoring
sidebar_position: 12
description: How BMAD DCA authors ADRs, HLD/LLD, API contracts, C4 diagrams, STRIDE threat models, and data models across 8 Adobe/JVM stacks with per-stack knowledge packs.
keywords:
  - architecture authoring
  - adr
  - hld
  - lld
  - openapi
  - graphql
  - threat model
  - stride
  - c4
  - sequence
  - data model
  - system design
  - sdlc
---

The **Architecture Authoring** concept underpins the [Architecture agent](../agents/architecture) — the seventh agent of the BMAD DCA suite, added in Phase 2 as the second SDLC-alignment agent (after Requirements). This page explains the 9-artifact model, the per-stack knowledge packs, the two authoring modes, and how the output feeds the rest of the DCA workflow.

## Why an architecture-authoring agent

The first six agents cover SDLC phases 1 (Requirements) and 3–8 (build, test, harden, ship). That left **phase 2 (Design)** with no DCA coverage — and in practice, that's where the most expensive rework originates: features shipped without an ADR that can be traced to; APIs that skip contract-first design; STRIDE reviews that happen after deploy instead of at design time; brownfield HLDs that never get refreshed against current-stack idioms.

Architecture closes phase 2 downstream of Requirements and upstream of the five analysis agents. Concretely:

- **ADR discipline across teams** — one stack-native MADR 3.0 shape whether the decision lives in an AEM repo, a Commerce PaaS repo, or an EDS repo. Every alternative, driver, and consequence rendered the same way.
- **Contract-first APIs** — OpenAPI 3.1 / GraphQL SDL authored before any controller lands, with security schemes, error models, and `/health` examples baked in per stack default.
- **Threat models on every design** — STRIDE per component with residual-risk scoring, grounded in stack-specific attack surface (dispatcher misconfigs for AEM; RabbitMQ producer/consumer for Commerce PaaS; block-DOM injection for EDS).
- **Traceable design→code chain via findings cache** — every ADR / HLD-section / endpoint / diagram / threat / entity is an `ARCH-<n>` row in the standardized Summary sheet, consumed downstream via the [findings cache](./findings-cache) so Generation, Impact Analysis, Test Coverage, and Audit chain off the same row shape.
- **Enterprise gates** — participates in the shared [Findings Gate](./findings-gate) (`accepted` / `deferred` / `wontfix` per release; ADRs are frozen at Approved once accepted) and [SLA Tracking](./sla-tracking) (design-approval SLA per role — how long an ADR can sit `Proposed` before it becomes OVERDUE).

## The 9-artifact model

Architecture produces up to nine distinct artifact types per run. Each is a row category in the standardized Summary sheet AND a written file in `architecture-reports/`:

| Artifact | Format | File(s) | Primary consumer | Typical driving role |
|----------|--------|---------|------------------|----------------------|
| **ADR** | MADR 3.0 Markdown | `ADR-<n>.md` | Architecture review board / EA guild | `ea`, `tl`, `pm`, `security`, `devops` |
| **HLD** | Markdown + embedded C4 L1/L2 | `HLD.md` | EA / TL / stakeholders | `ea`, `tl`, `pm`, `ba`, `migration`, `content` |
| **LLD** | Markdown + embedded C4 L3 + class/module | `LLD.md` | TL / DE | `tl`, `de` |
| **OpenAPI** | OpenAPI 3.1 YAML | `openapi.yaml` | DE / QA / consumers | `tl`, `de`, `qa` |
| **GraphQL SDL** | SDL | `schema.graphql` | DE / QA / consumers | `tl`, `de` |
| **C4 diagrams** | Mermaid (default) / PlantUML | `c4-context.mermaid`, `c4-container.mermaid`, `c4-component.mermaid` | EA / TL / DevOps | `ea`, `tl`, `devops`, `generic` |
| **Sequence diagrams** | Mermaid / PlantUML | `sequence-<flow>.mermaid` (one per flow) | TL / DE / QA / Security | `tl`, `de`, `qa`, `security`, `devops` |
| **STRIDE threat model** | Markdown | `threat-model.md` | Security engineer / EA | `security`, `ea` |
| **Data model** | Markdown ER + DDL (stack default) | `data-model.md` | DE / BA / DBA | `de`, `ba`, `migration`, `content` |

Every row in the workbook conforms to the 15-column Summary contract with these key columns:

| Column | Value for an architecture row |
|--------|-------------------------------|
| `id` | `ARCH-<n>` (monotonic per run) |
| `title` | ADR title / HLD section / endpoint / diagram / threat / entity |
| `category` | `adr` \| `hld` \| `lld` \| `api` \| `c4` \| `sequence` \| `threat` \| `data-model` |
| `severity` | `decision` \| `risk` \| `constraint` \| `principle` (mapped from CRITICAL/HIGH/MEDIUM/LOW) |
| `confidence` | `high` (from parsed source) \| `medium` (LLM-authored, template-aligned) \| `low` (inferred / needs review) |
| `ruleId` | `ARCH-<stack>-<type>` (e.g. `ARCH-aem-adr-dispatcher`, `ARCH-spring-threat-tampering`) |
| `code-reference` | Emitted artifact path (e.g. `ADR-042.md`, `HLD.md#3.2-container`, `openapi.yaml#/paths/~1promotions/post`) |
| `status` | `draft` (default) \| `reviewed` \| `approved` — advances via the [decisions gate](./findings-gate) on subsequent runs |

Full row-shape spec on the [Standardized Outputs](./standardized-outputs) page.

## Per-stack knowledge packs

For each of the 8 stacks Architecture loads **up to four per-stack resource files** at authoring time — a 4-pack (analogous to the Requirements 3-pack). Together they keep the artifacts stack-native — an AEM HLD reads like an AEM HLD, not a generic doc with "AEM" sprinkled in:

| Pack | Path | Purpose |
|------|------|---------|
| **ADR patterns** | `resources/adr-templates/<stack>.md` | Common decision categories per stack (e.g. AEM: Cloud Manager vs Jenkins, Sling Model vs OSGi service, dispatcher farm split; Commerce PaaS: preference vs plugin vs observer, RabbitMQ topology, di.xml patch strategy). Includes drivers + real alternatives. |
| **HLD patterns** | `resources/hld-templates/<stack>.md` | Standard HLD sections + stack-specific NFR staples + stack-standard container-boundary conventions (Author/Publish/Dispatcher/CDN for AEM; pod+sidecar+DB+broker for Spring; edge worker + Google Docs for EDS). |
| **LLD patterns** | `resources/lld-templates/<stack>.md` | Component-level design shapes: Sling Model + HTL + dialog for AEM; controller + service + repository for Spring; drop-in composition for Commerce SaaS; block hierarchy for EDS. Includes class/module diagram idioms. |
| **STRIDE patterns** | `resources/threat-models/<stack>.md` | Stack-specific attack surface (dispatcher misconfigs, JCR ACL escape, di.xml override, `scripts.js` load-eager XSS, IMS token replay) + STRIDE prompts + residual-risk scoring guidance. |

These packs are analogous to the audit / sonar-scan **rule packs** in [`reference/rule-packs/*`](../reference/rule-packs/aem) — they are the stack knowledge the LLM references at authoring time. See the [Architecture agent page](../agents/architecture#per-stack-notes) for the full pack table and the [Architecture prompts catalog](../reference/prompts/architecture) for stack-specific prompt patterns.

**What each stack biases toward** — one line each; the full emphasis grid is in the source [`SKILL.md` § Per-stack authoring instructions](https://github.com/mayur434/coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/SKILL.md#per-stack-authoring-instructions):

- **AEM** — Sling/OSGi component decomposition, editable-template + policy alignment, dispatcher farms + invalidation agents, Cloud Manager pipeline shape, JCR/CF data model.
- **Commerce PaaS** — di.xml preferences vs plugins vs observers, cache-tag FPC invalidation, RabbitMQ topology, MySQL EAV vs flat, admin RBAC + 2FA.
- **Commerce SaaS** — drop-in composition, Catalog Service vs Live Search, Storefront Events SDK wiring, API Mesh vs direct GraphQL, PIM integration.
- **Sling** — bundle boundary split, Feature Model composition, JCR vs external DB, resource-resolver + service-user config, health-check topology.
- **Spring** — bean topology, Spring Cloud integration, MVC vs WebFlux, JPA/jOOQ/JDBC, Spring Security posture, Actuator + Micrometer vs OTEL SDK.
- **App Builder** — API Mesh resolver composition, I/O Events wiring, action design (single/sequence/stateful), State SDK vs external Cosmos, UI Extension via App Registry.
- **EDS** — block hierarchy, `scripts.js` load phases, auto-block extraction, LCP-critical asset patterns, consent-mode + Adobe Launch, RUM/CrUX telemetry.
- **EDS + Commerce** — all EDS + drop-in wiring, cart state persistence, IMS→Commerce token exchange, Storefront Events propagation, PII redaction.

## Two modes

Architecture has two orthogonal modes, selected by which input the user supplies:

### Author (default)

**Trigger:** `--design-question "…"` or `--adr "…"` on the CLI, or `"author ADR / design the API / threat model …"` in the prompt.

The LLM reads the stack's 4-pack + the design question and emits the requested subset of the 9 artifacts (or the role default) into `architecture-reports/`. Use this for **new decisions**, **new APIs**, **new-feature design packs**, and **STRIDE for a new flow**.

**Worked example:**

```text
author ADR: Kafka vs SQS for order events, as tl, cut a working branch
```

Resolves to `--adr "Kafka vs SQS for order events" --artifacts adr --role tl --create-branch`, produces `ADR-<n>.md` on a `dca/architecture-<stack>-<timestamp>` branch, and recommends generation as the follow-up.

### Parse & Enrich

**Trigger:** `--design-in <path>` or `--openapi-in <path>` on the CLI, or `"parse this HLD…"` / `"review this OpenAPI…"` in the prompt.

The dispatcher parses the source (`.md` natively; OpenAPI/GraphQL via `js-yaml`), extracts existing decisions / endpoints / components / diagrams as findings, and fills gaps against the stack template (missing NFRs on the HLD, missing security schemes on the OpenAPI, missing sequence flows for named endpoints, missing STRIDE analysis on newly-added components). The workbook grows a **Delta** sheet showing pre-existing vs added — so the enrichment is visible, not silent.

**Worked example:**

```text
review this OpenAPI at ./api.yaml and add missing security schemes
```

Resolves to `--openapi-in ./api.yaml --artifacts openapi`, parses the 18 endpoints, adds Bearer JWT + OAuth2 client-credentials to `components.securitySchemes`, tags 4 endpoints as `public`, and writes the enriched `openapi.yaml` beside the source without mutating it.

Both modes can be combined — pass `--design-in ./legacy-hld.md --design-question "we're moving to Kubernetes"` and the design question is layered on top of the parsed HLD as extra intent.

## Role-adaptation for architecture

Architecture adapts the **default artifact set**, the **output flavor**, and the **recommended follow-up** to the resolved role — same [role-adaptation](./role-adaptation) mechanism the other six agents use. The 11-role artifact matrix:

| Role | Typically requests |
|------|--------------------|
| `ea` — Enterprise Architect | ADR + HLD + C4 (Context + Container) + threat-model |
| `tl` — Tech Lead / Solution Architect | ADR + HLD + LLD + OpenAPI + C4 + sequence (the full solution pack) |
| `de` — Senior Delivery Engineer | LLD + OpenAPI + sequence (dev-facing, per-endpoint) |
| `qa` — QA / SDET | sequence + data-model (test-injection points + invariants) + contract tests |
| `devops` — DevOps / SRE | C4 + sequence (deployment topology + runbook flows) + infrastructure ADRs |
| `security` — Security Engineer | threat-model + sequence (STRIDE per component with trust boundaries) + auth ADR |
| `pm` — Product Manager | ADR + HLD (capability-flavored; no LLD; no diagrams beyond C4 Context) |
| `ba` — Business Analyst | data-model + HLD (data lineage + process flow) |
| `migration` — Migration Lead | ADR + HLD + data-model (before/after side by side; migration-strategy ADR) |
| `content` — Content/CMS Engineer | HLD + data-model (content-model + taxonomy + publish pipeline) |
| `generic` | ADR + HLD + C4 (balanced default) |

Full role matrix on the [Architecture agent page](../agents/architecture#cross-agent-chaining-hints-per-role) and in the source [`SKILL.md` § Role-aware behavior](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/SKILL.md#role-aware-behavior).

## Traceability

Every finding row is written to the standardized report **and** to a findings cache at `.bmad/cache/architecture-<hash>.json`. That cache is consumed by downstream analysis agents via the shared [findings-cache](./findings-cache) contract — Impact Analysis can trace `ARCH-<n>` rows to impacted files, Code Generation can scaffold from approved LLD components + OpenAPI endpoints, Test Coverage can generate contract tests from the OpenAPI + integration tests from sequence flows, Audit can check drift between the LLD and the actual code, Sonar Scan can vuln-scan exactly the components the STRIDE model flagged.

The recommended DCA fan-out from an Architecture run:

```
Requirements (author BRD from description)
    ↓
Architecture (--design-question or --design-in on the BRD)
    → ADRs + HLD + LLD + OpenAPI + C4 + sequences + STRIDE + data model
    ↓
Impact Analysis (--brd or --design-in)
    → trace impacted code across the estate
    ↓
Code Generation (--type <matches component in LLD>)
    → scaffold code from OpenAPI + approved LLD
    ↓
Test Coverage (--mode full)
    → contract tests from OpenAPI; integration tests from sequence flows
    ↓
Sonar Scan + Audit
    → baseline quality + vulnerabilities on the scaffolded surface
```

## Output artifacts

Every architecture run writes into `<project>/architecture-reports/` (override with `--output`):

- `architecture-<branch>-<timestamp>-agent-report.xlsx` — the standardized workbook.
- `architecture-<branch>-<timestamp>-agent-report.md` — the Markdown twin.
- `ADR-<n>.md` — one file per decision (MADR 3.0).
- `HLD.md` / `LLD.md` — high-level and low-level design documents.
- `openapi.yaml` / `schema.graphql` — API contract per `--api-style`.
- `c4-context.mermaid`, `c4-container.mermaid`, `c4-component.mermaid` — C4 L1/L2/L3 (or `.puml` with `--diagrams plantuml`).
- `sequence-<flow>.mermaid` — one file per named flow.
- `threat-model.md` — STRIDE per component.
- `data-model.md` — ER diagram + DDL (stack default).
- `DESIGN-INDEX.md` — always emitted; a manifest of inputs → artifacts.
- One `CHANGE-LOG.md` entry spliced into project root.

Optional `--format both` is currently **stubbed** — it logs a warning on stderr and falls back to markdown. The docx writer lands in a later phase.

## Design-decision-gate integration

The [Findings Gate](./findings-gate) applies to ADRs directly — the mapping is one-to-one:

| Decision status | Effect on the ADR |
|-----------------|-------------------|
| `accepted` | ADR file's `Status` field advances to `Approved`; frozen at current confidence; future reruns don't re-author it (still visible in Summary with Status=Approved). |
| `deferred` | Moves to the SLA sheet with a `next-review` date; suppressed from Summary until the review date passes. |
| `wontfix` | Rejected alternative; suppressed from Summary but the ADR file itself is retained in `architecture-reports/` for audit trail. |

Combine this with the design-approval **SLA per role** (see [SLA Tracking](./sla-tracking)) to gate CI on stale designs: `--fail-on-overdue` exits with code 6 when any ADR has sat `Proposed` past its role SLA. Default thresholds — for a `decision` (HIGH) severity: `tl` 3 days, `security` 3 days, `de` 2 days, `ea` 5 days.

## See also

- [Architecture agent](../agents/architecture) — the per-agent reference (flags, modes, CLI, per-stack notes).
- [Architecture prompts catalog](../reference/prompts/architecture) — 40+ copy-paste prompts across stacks, roles, and artifact types.
- [Requirements agent](../agents/requirements) — upstream partner; design is informed by the authored BRD.
- [Requirements Authoring concept](./requirements-authoring) — the 3-pack sibling model for requirements.
- [Code Generation agent](../agents/code-generation) — downstream scaffold from LLD + OpenAPI.
- [Role adaptation](./role-adaptation) — how default artifact set + emphasis + follow-up change per role.
- [Findings cache](./findings-cache) — how architecture output feeds downstream agents.
- [Findings gate](./findings-gate) — accept / defer / wontfix per release.
- [SLA tracking](./sla-tracking) — design-approval SLA per role.
- [One-shot mode](./one-shot-mode) — full precedence rules for silent end-to-end execution.
- [Standardized outputs](./standardized-outputs) — the shared 15-column Summary + fixed sheet order.
