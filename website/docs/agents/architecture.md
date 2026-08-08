---
id: architecture
title: Architecture
sidebar_position: 7
description: Author ADRs, HLD/LLD, API contracts, C4 + sequence diagrams, STRIDE threat models, and data models — grounded in per-stack Adobe/JVM idioms across all 8 supported stacks.
keywords:
  - architecture
  - adr
  - design
  - hld
  - lld
  - openapi
  - graphql
  - threat model
  - stride
  - c4
  - sequence diagram
  - data model
  - system design
---

## Purpose

The **Architecture Design Specialist** (🏛️) turns a natural-language design question into engineering-ready design artifacts across the same 8 stacks as the rest of the DCA suite. It authors **ADRs** (MADR 3.0), **HLD/LLD**, **API contracts** (OpenAPI 3.1 / GraphQL SDL), **C4 + sequence diagrams** (Mermaid or PlantUML), **STRIDE threat models**, and **data models** from a `--design-question` or `--adr` topic; parses and enriches existing designs (`--design-in` for `.md`, `--openapi-in` for `.yaml` / `.json`); and emits every artifact as the standardized [DCA workbook](../concepts/standardized-outputs) plus Markdown twin plus the written artifact files. It is the **seventh agent** of the suite and the **second added in the Phase 2 SDLC-alignment expansion** — closing SDLC **phase 2 (Design)** downstream of Requirements (phase 1) and upstream of the existing five analysis agents (phases 3–8).

:::note Architecture is a design-authoring specialist, not a design executor
It does not run a PoC, execute migrations, or validate the design against live systems — that's what Generation, Audit, and Test Coverage do downstream. See the [Constraints / non-goals](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/SKILL.md#constraints--non-goals) section in the source SKILL for the full boundary.
:::

## When to use

- **ADR-driven decision-making** — surface 3–5 alternatives, decision drivers, and consequences for a specific technical choice (e.g. Kafka vs SQS, di.xml preference vs plugin, Sling Model vs OSGi service).
- **Contract-first API design** — author an OpenAPI 3.1 spec or GraphQL SDL that includes security schemes, error models, and stack-idiomatic paths before any controller lands.
- **Threat modeling for security review** — STRIDE per component with per-flow sequence diagrams and residual-risk scoring, grounded in stack-specific attack surface.
- **Brownfield design documentation** — parse a legacy HLD or OpenAPI, extract what's there, and fill gaps against the stack template (NFRs, security schemes, integration points, sequence flows for named endpoints).
- **New-feature architecture kickoff** — one command produces the full design pack (ADR + HLD + LLD + API + C4 + sequences + STRIDE + data model) so the downstream SDLC has one traceable source of truth.

## What it produces

Every architecture run emits the standardized DCA outputs into `<project>/architecture-reports/` (override with `--output`):

| Artifact | Where | Notes |
|----------|-------|-------|
| `architecture-<branch>-<timestamp>-agent-report.xlsx` | `architecture-reports/` | Standardized 15-column Summary contract; one row per ADR / HLD-section / LLD-section / API endpoint / diagram / threat / data-entity, keyed as `ARCH-<n>`. |
| `architecture-<branch>-<timestamp>-agent-report.md` | `architecture-reports/` | Git-diffable Markdown twin. |
| `ADR-<n>.md` | `architecture-reports/` | One MADR 3.0 file per decision. |
| `HLD.md` / `LLD.md` | `architecture-reports/` | High-level and low-level design documents. |
| `openapi.yaml` / `schema.graphql` | `architecture-reports/` | API contract per `--api-style`. |
| `c4-context.mermaid`, `c4-container.mermaid`, `c4-component.mermaid` | `architecture-reports/` | C4 L1/L2/L3 diagrams (or PlantUML with `--diagrams plantuml`). |
| `sequence-<flow>.mermaid` | `architecture-reports/` | One file per named flow. |
| `threat-model.md` | `architecture-reports/` | STRIDE per component + attack trees + residual-risk scoring. |
| `data-model.md` | `architecture-reports/` | ER diagram + DDL (Spring→Postgres, Commerce PaaS→MySQL, AEM→JCR/CF, App Builder→State SDK, etc.). |
| `DESIGN-INDEX.md` | `architecture-reports/` | Manifest linking inputs to authored artifacts. |
| One `CHANGE-LOG.md` entry | project root | e.g. `Architecture design: 3 ADR(s), 1 API(s), 5 diagram(s), 1 model(s); 24 finding(s).` |
| Optional working branch | git | `dca/architecture-<stack>-<timestamp>` when `--create-branch` is passed. |
| Optional **Delta sheet** | appended to the xlsx | Only in Parse & Enrich mode — pre-existing vs added rows from the source design. |

The report follows the [standardized outputs contract](../concepts/standardized-outputs): **Run Info** · **Summary** · **Severity Breakdown** · **By Category** · **Recommendations** · **SLA Status** (unless `--no-sla`) · **Delta** (parse mode only). The 15-column Summary maps `id → ARCH-<n>`, `severity → {decision, risk, constraint, principle}`, and `category → {adr, hld, lld, api, c4, sequence, threat, data-model}`.

## Modes

Two orthogonal modes, selected by which input the user supplies:

| Mode | Trigger | What it does | Best for |
|------|---------|--------------|----------|
| **Author** (default) | `--design-question "…"` or `--adr "…"` or `"author ADR / design the API / threat model …"` | LLM authors the requested artifacts from the design question + stack templates. | New decisions; new APIs; new-feature design packs; STRIDE for a new flow. |
| **Parse & Enrich** | `--design-in <path>` or `--openapi-in <path>` or `"parse this HLD…"` / `"review this OpenAPI…"` | Parses the source (markdown natively; OpenAPI/GraphQL via `js-yaml`); extracts existing decisions / endpoints / components; fills gaps against the stack template; emits a **Delta** sheet. | Brownfield HLD refresh; adding security schemes to a legacy OpenAPI; normalizing a design doc to the DCA contract. |

Both modes can be combined — pass `--design-in ./legacy-hld.md --design-question "additional context: we're moving to Kubernetes"` and the design question is layered on top of the parsed HLD as extra intent.

## Artifact catalog

`--artifacts` accepts a comma-separated list. `all` expands to every artifact. When `--artifacts` is omitted, the [role-driven default](#cross-agent-chaining-hints-per-role) is used.

| Artifact key | Written file(s) | Master template | Per-stack guide |
|---|---|---|---|
| `adr` | `ADR-<n>.md` (one per decision) | `templates/ADR.md` | [`resources/adr-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-architecture-agent/resources/adr-templates) |
| `hld` | `HLD.md` | `templates/HLD.md` | [`resources/hld-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-architecture-agent/resources/hld-templates) |
| `lld` | `LLD.md` | `templates/LLD.md` | [`resources/lld-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-architecture-agent/resources/lld-templates) |
| `openapi` | `openapi.yaml` | `templates/openapi-scaffold.yaml` | stack default |
| `graphql` | `schema.graphql` | inline in engine | stack default |
| `c4` | `c4-context.mermaid`, `c4-container.mermaid`, `c4-component.mermaid` | inline in engine | stack default |
| `sequence` | `sequence-<flow>.mermaid` (one per flow) | inline in engine | stack default |
| `threat-model` | `threat-model.md` | `templates/threat-model-stride.md` | [`resources/threat-models/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-architecture-agent/resources/threat-models) |
| `data-model` | `data-model.md` (ER diagram + DDL) | inline in engine | stack default (Postgres / MySQL / JCR / State SDK) |
| `all` | Every artifact resolvable given other flags. | — | — |

## Trigger phrases

Paste any of these into the agent chat — the agent auto-detects the stack and routes.

```text
should we use Kafka or SQS for order events?
author ADR: Kafka vs SQS for order events
design the API for our new promotions service
OpenAPI for the loyalty endpoints
GraphQL schema for the storefront
threat model our checkout flow
STRIDE the payment integration
C4 context diagram for our current AEM estate
sequence diagram for the checkout happy path
data model for the new loyalty program
review this OpenAPI at ./api.yaml and add missing security schemes
parse ./legacy-hld.md and enrich with missing NFRs
author full design pack for the promotions service
list architecture stacks
```

The full copy-paste catalog is in the [Architecture prompts reference](../reference/prompts/architecture).

## CLI usage (technical mode)

The canonical invocation:

```bash
npx ts-node .claude/skills/bmad-dept-code-architecture-agent/scripts/run.ts \
  --path . --design-question "should we use Kafka or SQS for order events?"
```

**Author mode — full design pack for a new service:**

```bash
npx ts-node .claude/skills/bmad-dept-code-architecture-agent/scripts/run.ts \
  --path . \
  --engine spring \
  --design-question "the promotions service API" \
  --artifacts openapi,c4,sequence,threat-model \
  --api-style rest \
  --diagrams mermaid \
  --create-branch
```

**Parse & Enrich mode — legacy HLD refresh:**

```bash
npx ts-node .claude/skills/bmad-dept-code-architecture-agent/scripts/run.ts \
  --path . \
  --design-in ./docs/legacy-hld.md \
  --artifacts hld,threat-model
```

**Single-ADR mode — one focused decision:**

```bash
npx ts-node .claude/skills/bmad-dept-code-architecture-agent/scripts/run.ts \
  --path . \
  --adr "Kafka vs SQS for order events" \
  --artifacts adr
```

The Preflight advisory prints on every run — see [The Agents](../concepts/the-agents) for how STATIC / LLM / HYBRID is decided (Architecture is LLM-heavy — the LLM does most of the design work), and [Auto-install](../concepts/auto-install) for the first-run dependency bootstrap.

## Flags reference

Every flag listed here is wired in `scripts/run.ts` (Phase 2.4).

### Architecture-specific

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--design-question <text>` | string | — | Natural-language design intent — primary input for **Author** mode. |
| `--adr <text>` | string | — | ADR title / topic for a single-decision author run (e.g. `"Kafka vs SQS for order events"`). |
| `--design-in <path>` | file | — | Existing HLD/LLD (`.md`) to parse and enrich. |
| `--openapi-in <path>` | file | — | Existing OpenAPI (`.yaml` / `.json`) to review or extend. |
| `--artifacts <csv>` | csv | role default | Artifacts to author. Values: `adr`, `hld`, `lld`, `openapi`, `graphql`, `c4`, `sequence`, `threat-model`, `data-model`, `all`. |
| `--api-style <rest\|graphql\|both>` | enum | `rest` | API-contract style. |
| `--diagrams <mermaid\|plantuml>` | enum | `mermaid` | Diagram source format for C4 + sequence. |
| `--format <markdown\|both>` | enum | `markdown` | Output format. `both` currently emits markdown only (docx planned) with a warning. |

### Standard (shared with every DCA agent)

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--path <dir>` | string | `.` | Project root — used for stack auto-detection and as the output base. |
| `--engine <id>` | enum | auto | One of `aem`, `commerce-paas` (alias `commerce`), `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`. |
| `--output <dir>` | dir | `<project>/architecture-reports/` | Override the report directory. |
| `--role <code>` | enum | `.bmad/role.yaml` | Role adaptation: `ea` \| `tl` \| `de` \| `qa` \| `devops` \| `security` \| `pm` \| `ba` \| `migration` \| `content` \| `generic`. Wins for one run. |
| `--interactive` | bool | false | Force interactive intake (step-by-step questions). Persists to `.bmad/intake.yaml`. |
| `--technical` | bool | false | Force technical intake mode. |
| `--create-branch` | bool | false | Cut `dca/architecture-<stack>-<timestamp>` before writing outputs. |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. Cascade: `production → main → master → develop`. |
| `--preflight` | bool | false | Print the LLM / context-window advisory and exit. |
| `--no-preflight` | bool | false | Suppress the preflight advisory that otherwise prints on every run. |
| `--yes-install` | bool | false | First-run dependency install without confirmation. |
| `--no-install` | bool | false | Error out if deps are missing (exit `2`). |
| `--list-engines` | bool | false | Print the 8 stacks and exit. |
| `--help` | bool | false | Show help. |

### Findings gate (Enterprise Phase 1)

Shared with every DCA agent. See [Findings Gate](../concepts/findings-gate) for the full mechanics — for Architecture, decisions mark specific ADRs as **accepted** (Status=Approved, frozen for the release) / **deferred** (moves to SLA sheet with a `next-review` date) / **wontfix** (rejected alternative, suppressed from Summary but the ADR file itself is retained).

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--include-decided` | bool | false | Bypass the findings gate — show items already decided in `.bmad/decisions.yaml`. |
| `--decisions-path <path>` | string | `<projectRoot>/.bmad/decisions.yaml` | Override the decisions file. |
| `--ignore-decision-expiry` | bool | false | Treat expired decisions as still active for this run. |
| `--list-decisions` | bool | false | Print all decisions and exit. |

### SLA tracking (Enterprise Phase 1)

Shared with every DCA agent. See [SLA Tracking](../concepts/sla-tracking) — for Architecture, the SLA is a **design-approval SLA**: how long an ADR can sit in `Proposed` (or a finding in `draft`) per role before it becomes OVERDUE.

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--sla-path <path>` | string | `<projectRoot>/.bmad/sla.yaml` | Override the SLA file. |
| `--no-sla` | bool | false | Skip the SLA sheet and computation. |
| `--fail-on-overdue` | bool | false | Exit code 6 if any surviving ADR / finding is OVERDUE per role SLA. Ideal for CI gates that block a release when a Proposed ADR has sat too long. |

## What's new in Phase 2

Architecture is the **7th agent** in the DCA suite and closes SDLC phase 2 (Design). Together with the existing agents:

- **Requirements** (Phase 2 — 6th agent) — authors BRD + user stories + AC upstream of any design.
- **Architecture** (this agent — 7th agent) — turns the "what" into the "how" via ADR + HLD + LLD + API + diagrams + STRIDE + data model.
- **Audit** + **Sonar Scan** — analyze existing code quality / vulnerabilities.
- **Impact Analysis** — traces change blast-radius across code.
- **Code Generation** — scaffolds from a spec / LLD.
- **Test Coverage** — measures coverage against AC + generates contract tests from OpenAPI.

The natural fan-out from an Architecture run: **`architecture → impact-analysis`** (blast-radius of the proposed ADR) → **`generation`** (scaffold from OpenAPI + LLD) → **`test-coverage`** (contract tests from OpenAPI; sequence-driven integration tests) → **`sonar-scan` + `audit`** (baseline quality + vulns on the scaffolded surface).

## Example workflow — design → requirements → generate → threat-model

Author a full design pack for a new AEM feature, then run the downstream SDLC pass:

**Chat trigger 1 — the ADR:**

```text
author ADR: Kafka vs SQS for order events
```

**Chat trigger 2 — the full API design:**

```text
design the promotions API — OpenAPI + C4 + sequence
```

**Resolved CLI for the API design:**

```bash
npx ts-node .claude/skills/bmad-dept-code-architecture-agent/scripts/run.ts \
  --path . \
  --design-question "the promotions API" \
  --artifacts openapi,c4,sequence
```

**Chained SDLC pass — design-drives-code:**

```text
chain: architecture → requirements → generation
```

The chain runs three commands: (1) architecture authors ADR + HLD + OpenAPI; (2) requirements parses the HLD as product intent to backfill BR/FR/AC; (3) generation scaffolds code from the OpenAPI + top-priority stories.

**Chat trigger 4 — the STRIDE model:**

```text
threat-model our checkout with STRIDE
```

**Outputs (composite):**

```
architecture-reports/
├── architecture-main-20260808_120000-agent-report.xlsx
├── architecture-main-20260808_120000-agent-report.md
├── ADR-0042.md                        ← Kafka vs SQS
├── HLD.md
├── openapi.yaml
├── c4-context.mermaid
├── c4-container.mermaid
├── c4-component.mermaid
├── sequence-create-promotion.mermaid
├── sequence-apply-promotion.mermaid
├── threat-model.md                    ← STRIDE for checkout
├── data-model.md
└── DESIGN-INDEX.md
CHANGE-LOG.md                          ← one new entry per run
```

## Cross-agent chaining hints per role

The Architecture agent adapts its **default artifact set**, **output flavor**, and **recommended follow-up** to the resolved [role](../concepts/role-adaptation):

| Role | Default artifact set | Emphasis | Next agent |
|------|----------------------|----------|-----------|
| `ea` | `adr, hld, c4, threat-model` | Portfolio-level HLD + C4 Context+Container; strategic ADRs (build-vs-buy, platform strategy); portfolio-level threat model (data classification, cross-domain data flow). | [Impact Analysis](./impact-analysis) — trace integration boundaries. |
| `tl` | `adr, hld, lld, openapi, c4, sequence` | Solution-level HLD + LLD + component + sequence diagrams; team-level ADRs (framework, integration, library); full-stack API contracts. | [Code Generation](./code-generation) — scaffold from OpenAPI + LLD. |
| `de` | `lld, openapi, sequence` | Dev-focused API contracts (OpenAPI 3.1 / GraphQL SDL), class/method-level LLD, one sequence per endpoint. | [Code Generation](./code-generation) — controller + service skeleton. |
| `qa` | `sequence, data-model` | Sequence diagrams surface test-injection points (mocks, stubs, contract-test boundaries); data-model invariants become negative-path tests; contract tests from OpenAPI. | [Test Coverage](./test-coverage) — contract tests + sequence-driven integration tests. |
| `devops` | `c4, sequence` | Deployment topology (C4 Container with pod / VM / lambda / worker boundaries); runbook-linked sequences (deploy, rollback, incident); infrastructure ADRs (Kubernetes vs OCP, OTEL vs Datadog). | [Audit](./audit) — impacted files for missing observability. |
| `security` | `threat-model, sequence` | STRIDE per component + sequence diagrams that show trust boundaries and data-flows crossing them; security-scoped ADRs (auth flow, secrets, key rotation, PCI scope). | [Sonar Scan](./sonar-scan) — vulns matching the threat model. |
| `pm` | `adr, hld` | HLD focused on capabilities + business outcomes; ADRs framed as decision trade-offs with cost/risk/timeline. No LLD, no diagrams beyond C4 Context. | [Impact Analysis](./impact-analysis) — top-3 capabilities vs estate. |
| `ba` | `hld, data-model` | Data model + ER diagrams (entities, attributes, cardinality, business rules); HLD focused on process flow + data lineage. | [Requirements](./requirements) — turn the data model into BR/FR/AC. |
| `migration` | `adr, hld, data-model` | Before/after HLDs side by side; migration-strategy ADR (big-bang / strangler-fig / branch-by-abstraction / coexistence); source→target data-model mapping. | [Impact Analysis](./impact-analysis) + [Test Coverage](./test-coverage) — cross-version impact + coverage delta. |
| `content` | `hld, data-model` | Content-model design (AEM CF models / EDS block hierarchy / Commerce catalog attributes); taxonomy diagrams; HLD focused on authoring workflow + publish pipeline. | [Code Generation](./code-generation) — content-fragment / block scaffold. |
| `generic` | `adr, hld, c4` | Balanced default — decision + shape + context. | [Impact Analysis](./impact-analysis) — trace impact of the design before committing to scope. |

The resolved role is exposed to child engines via `process.env.DCA_ROLE`, recorded on the **Run Info** sheet, and printed to stderr on every run.

## Per-stack notes

The agent loads up to four per-stack resource files at authoring time — **ADR patterns** + **HLD patterns** + **LLD patterns** + **STRIDE patterns** — so every artifact reads stack-native. See the [Architecture Authoring concept](../concepts/architecture-authoring) for the full 4-pack model.

| Stack | Engine ID | ADR patterns | HLD patterns | LLD patterns | STRIDE patterns |
|-------|-----------|--------------|--------------|--------------|-----------------|
| AEM (AEMaaCS + AMS) | `aem` | [`adr-templates/aem.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/adr-templates/aem.md) | [`hld-templates/aem.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/hld-templates/aem.md) | [`lld-templates/aem.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/lld-templates/aem.md) | [`threat-models/aem.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/threat-models/aem.md) |
| Adobe Commerce (PaaS) | `commerce-paas` / `commerce` | [`adr-templates/commerce-paas.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/adr-templates/commerce-paas.md) | [`hld-templates/commerce-paas.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/hld-templates/commerce-paas.md) | [`lld-templates/commerce-paas.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/lld-templates/commerce-paas.md) | [`threat-models/commerce-paas.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/threat-models/commerce-paas.md) |
| Adobe Commerce SaaS | `commerce-saas` | [`adr-templates/commerce-saas.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/adr-templates/commerce-saas.md) | [`hld-templates/commerce-saas.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/hld-templates/commerce-saas.md) | [`lld-templates/commerce-saas.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/lld-templates/commerce-saas.md) | [`threat-models/commerce-saas.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/threat-models/commerce-saas.md) |
| Sling / Shaft | `sling` | [`adr-templates/sling.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/adr-templates/sling.md) | [`hld-templates/sling.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/hld-templates/sling.md) | [`lld-templates/sling.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/lld-templates/sling.md) | [`threat-models/sling.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/threat-models/sling.md) |
| Spring Boot | `spring` | [`adr-templates/spring.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/adr-templates/spring.md) | [`hld-templates/spring.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/hld-templates/spring.md) | [`lld-templates/spring.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/lld-templates/spring.md) | [`threat-models/spring.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/threat-models/spring.md) |
| Adobe App Builder | `app-builder` | [`adr-templates/app-builder.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/adr-templates/app-builder.md) | [`hld-templates/app-builder.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/hld-templates/app-builder.md) | [`lld-templates/app-builder.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/lld-templates/app-builder.md) | [`threat-models/app-builder.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/threat-models/app-builder.md) |
| Edge Delivery Services | `eds` | [`adr-templates/eds.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/adr-templates/eds.md) | [`hld-templates/eds.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/hld-templates/eds.md) | [`lld-templates/eds.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/lld-templates/eds.md) | [`threat-models/eds.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/threat-models/eds.md) |
| EDS + Commerce | `eds-commerce` | [`adr-templates/eds-commerce.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/adr-templates/eds-commerce.md) | [`hld-templates/eds-commerce.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/hld-templates/eds-commerce.md) | [`lld-templates/eds-commerce.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/lld-templates/eds-commerce.md) | [`threat-models/eds-commerce.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-architecture-agent/resources/threat-models/eds-commerce.md) |

## See also

- [Architecture prompts catalog](../reference/prompts/architecture) — 40+ copy-paste prompts across stacks, roles, and artifact types.
- [Architecture Authoring concept](../concepts/architecture-authoring) — the 9-artifact model, per-stack knowledge packs, traceability chain.
- [CLI Flags reference](../reference/cli-flags) — including the Enterprise Phase 1 flags shared across all agents.
- [Requirements agent](./requirements) — upstream partner; design is informed by the authored BRD.
- [Code Generation agent](./code-generation) — scaffold from the approved LLD + OpenAPI.
- [Impact Analysis agent](./impact-analysis) — blast-radius of a proposed ADR before it lands.
- [Audit agent](./audit) — audit code against the LLD to make drift visible.
- [Standardized outputs contract](../concepts/standardized-outputs) — 15-column Summary + fixed sheet order.
- [Role adaptation](../concepts/role-adaptation) — how default artifact set + output flavor + follow-up change per role.
