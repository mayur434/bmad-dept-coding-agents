---
id: requirements
title: Requirements
sidebar_position: 6
description: Author BRDs, user stories, and acceptance criteria from a natural-language product description — across 8 Adobe / JVM stacks with role-aware framing.
keywords:
  - requirements
  - brd
  - user stories
  - acceptance criteria
  - epic
  - product requirements
  - prd
  - discovery
  - authoring
---

## Purpose

The **Requirements Authoring Specialist** (📋) turns product intent into engineering-ready artifacts across the same 8 stacks as the rest of the DCA suite. It authors **BRDs**, **epics**, **user stories**, and **acceptance criteria** from a natural-language product description; parses and enriches existing BRDs (`.docx` / `.md` / `.txt`); and emits an **Epic → Story → AC traceability matrix** as the standardized [DCA workbook](../concepts/standardized-outputs) plus Markdown twin plus a rendered `BRD.md`. It is the **first agent added in the Phase 2 SDLC-alignment expansion** — the sixth agent of the suite, closing the Discovery / Requirements phase upstream of the existing five analysis agents.

:::note Requirements is an authoring specialist, not a stakeholder-elicitation tool
It cannot invent product intent — you feed it either a `--product-description` or an existing BRD via `--brd-in`. See the [Constraints / non-goals](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-requirements-agent/SKILL.md#constraints--non-goals) section in the source SKILL for the full boundary.
:::

## When to use

- **New-feature discovery** — turn a paragraph of product intent into a stack-native BRD + stories + AC before any code lands.
- **Brownfield BRD refresh** — parse a legacy `.docx` PRD and enrich it against the current stack template (missing NFRs, missing AC on stated stories, missing integration points).
- **Story-splitting workshop** — decompose an epic into INVEST-shaped stories with AC per story.
- **Discovery-phase stakeholder alignment** — a common Markdown BRD that PM / EA / TL / QA all see the same way, role-adapted at generation time.
- **Retrospective requirement documentation** — reverse-engineer a BRD for an undocumented feature so downstream agents (Impact, Coverage) have a spec to trace against.

## What it produces

Every requirements run emits the standardized DCA outputs into `<project>/requirements-reports/` (override with `--output`):

| Artifact | Where | Notes |
|----------|-------|-------|
| `requirements-<branch>-<timestamp>-agent-report.xlsx` | `requirements-reports/` | Standardized 15-column Summary contract; each row is a BR / FR / NFR / Epic / Story / AC keyed as `REQ-<n>` with MoSCoW severity (`MUST` / `SHOULD` / `COULD` / `WONT`). |
| `requirements-<branch>-<timestamp>-agent-report.md` | `requirements-reports/` | Git-diffable Markdown twin. |
| `BRD.md` | `requirements-reports/` (or `--brd-out <path>`) | Primary written deliverable — the stack-native BRD. |
| `user-stories.md` | `requirements-reports/` | One section per user story. |
| `acceptance-criteria.md` | `requirements-reports/` | One Given/When/Then block per AC. |
| One `CHANGE-LOG.md` entry | project root | e.g. `Requirements authoring: 3 epic(s), 12 story(ies), 47 AC(s); 62 finding(s).` |
| Optional working branch | git | `dca/requirements-<stack>-<timestamp>` when `--create-branch` is passed. |
| Optional **Delta sheet** | appended to the xlsx | Only in Parse & Enrich mode — pre-existing vs added rows from the source BRD. |

The report follows the [standardized outputs contract](../concepts/standardized-outputs): **Run Info** · **Summary** · **Input Traceability** · **Delta** (parse mode only) · **SLA** (unless `--no-sla`). The 15-column Summary maps `id → REQ-<n>` and `severity → MoSCoW` (`MUST` ≈ CRITICAL, `SHOULD` ≈ HIGH, `COULD` ≈ MEDIUM, `WONT` ≈ LOW).

## Modes

Two orthogonal modes, selected by which input the user supplies:

| Mode | Trigger | What it does | Best for |
|------|---------|--------------|----------|
| **Author** (default) | `--product-description "…"` or `"author BRD for …"` | LLM authors a stack-native BRD, epics, stories, AC from the product intent + stack templates. | New features; discovery-phase alignment; story-splitting. |
| **Parse & Enrich** | `--brd-in <path>` or `"parse this BRD …"` | Parses the source (`.docx` via `mammoth`; `.md`/`.txt` natively); extracts existing epics / stories / AC; fills gaps against the stack template; emits a **Delta** sheet. | Brownfield BRD refresh; normalizing legacy PRDs to the DCA contract. |

Both modes can be combined — pass `--brd-in <path> --product-description "additional context"` and the description is layered on top of the parsed BRD as extra intent.

## Trigger phrases

Paste any of these into the agent chat — the agent auto-detects the stack and routes.

```text
author BRD for a new checkout flow
write requirements for our AEM article-list block
author 20 user stories for the mobile redesign
parse ./legacy-brd.docx and enrich
enrich our BRD at ./req.docx and target 15 stories
author BRD as pm, focus on measurable success criteria
author BRD, save it to ./docs/BRD.md
requirements for the impact of these bugs at ./bugs.csv
list requirements stacks
```

The full copy-paste catalog is in the [Requirements prompts reference](../reference/prompts/requirements).

## CLI usage (technical mode)

The canonical invocation:

```bash
npx ts-node .claude/skills/bmad-dept-code-requirements-agent/scripts/run.ts \
  --path . \
  --product-description "a new checkout flow supporting Apple Pay + saved cards"
```

**Author mode — explicit stack + story target:**

```bash
npx ts-node .claude/skills/bmad-dept-code-requirements-agent/scripts/run.ts \
  --path /path/to/aem-project \
  --engine aem \
  --product-description "our AEM article-list block" \
  --stories-count 8
```

**Parse & Enrich mode — legacy PRD refresh:**

```bash
npx ts-node .claude/skills/bmad-dept-code-requirements-agent/scripts/run.ts \
  --path . \
  --brd-in ./docs/legacy-brd.docx \
  --stories-count 15 \
  --brd-out ./docs/BRD-normalized.md
```

The Preflight advisory prints on every run — see [The Agents](../concepts/the-agents) for how STATIC / LLM / HYBRID is decided (Requirements is LLM-heavy — the LLM does most of the authoring work), and [Auto-install](../concepts/auto-install) for the first-run dependency bootstrap.

## Flags reference

Every flag listed here is wired in `scripts/run.ts` for Phase 2.1.

### Requirements-specific

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--product-description <text>` | string | — | Natural-language product intent — primary input for **Author** mode. |
| `--brd-in <path>` | file | — | Existing BRD (`.docx` / `.md` / `.txt`) — primary input for **Parse & Enrich** mode. `.docx` extracted via `mammoth`. |
| `--brd-out <path>` | file | `<output>/BRD.md` | Where to write the generated BRD. |
| `--stories-count <n>` | int | `12` | Target user-story count. The LLM may drift ±2 based on natural story boundaries. |
| `--format <docx\|markdown\|both>` | enum | `markdown` | BRD output format. `docx` is planned for Phase 2.2 — currently logs a warning and falls back to markdown. |

### Standard (shared with every DCA agent)

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--path <dir>` | string | `.` | Project root — used for stack auto-detection and as the output base. |
| `--engine <id>` | enum | auto | One of `aem`, `commerce-paas` (alias `commerce`), `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`. AEM aliases: `aemcs`, `aemams`. |
| `--output <dir>` | dir | `<project>/requirements-reports/` | Override the report directory. |
| `--role <code>` | enum | `.bmad/role.yaml` | Role adaptation: `ea` \| `tl` \| `de` \| `qa` \| `devops` \| `security` \| `pm` \| `ba` \| `migration` \| `content`. Wins for one run. |
| `--interactive` | bool | false | Force interactive intake (step-by-step questions). Persists to `.bmad/intake.yaml`. |
| `--technical` | bool | false | Force technical intake mode. |
| `--create-branch` | bool | false | Cut `dca/requirements-<stack>-<timestamp>` before writing outputs. |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. Cascade: `production → main → master → develop`. |
| `--preflight` | bool | false | Print the LLM / context-window advisory and exit. |
| `--no-preflight` | bool | false | Suppress the preflight advisory that otherwise prints on every run. |
| `--yes-install` | bool | false | First-run dependency install without confirmation. |
| `--no-install` | bool | false | Error out if deps are missing (exit `2`). |
| `--list-engines` | bool | false | Print the 8 stacks and exit. |
| `--help` | bool | false | Show help. |

### Findings gate (Enterprise Phase 1)

Shared with every DCA agent. See [Findings Gate](../concepts/findings-gate) for the full mechanics — for Requirements, decisions mark specific requirements as **accepted** / **deferred** / **wontfix** so subsequent runs stop resurfacing them.

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--include-decided` | bool | false | Bypass the findings gate — show items already decided in `.bmad/decisions.yaml`. |
| `--decisions-path <path>` | string | `<projectRoot>/.bmad/decisions.yaml` | Override the decisions file. |
| `--ignore-decision-expiry` | bool | false | Treat expired decisions as still active for this run. |
| `--list-decisions` | bool | false | Print all decisions and exit. |

### SLA tracking (Enterprise Phase 1)

Shared with every DCA agent. See [SLA Tracking](../concepts/sla-tracking) — for Requirements, the SLA is a **requirement-approval SLA**: how long a `draft` requirement can sit unapproved per role before it becomes OVERDUE.

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--sla-path <path>` | string | `<projectRoot>/.bmad/sla.yaml` | Override the SLA file. |
| `--no-sla` | bool | false | Skip the SLA sheet and computation. |
| `--fail-on-overdue` | bool | false | Exit code 6 if any surviving requirement is OVERDUE per role SLA. Ideal for CI gates that block a release when the backlog goes stale. |

## What's new in Phase 2

Requirements is the **6th agent** in the DCA suite and closes SDLC phase 1 (Requirements / Discovery). Together with the existing five analysis agents:

- **Requirements** (this agent) — authors the spec upstream of any code.
- **Audit** + **Sonar Scan** — analyze existing code quality / vulnerabilities.
- **Impact Analysis** — traces change blast-radius across code.
- **Code Generation** — scaffolds from a spec.
- **Test Coverage** — measures coverage against AC.

The natural fan-out from a Requirements run is `impact-analysis --brd requirements-reports/BRD.md` (trace the impacted code) → `generation` (scaffold approved stories) → `test-coverage` (measure AC coverage) → `sonar-scan` + `audit` (baseline quality + vulnerabilities before merge).

## Example workflow — author → impact → generate → coverage

Author a BRD for a new AEM feature, then run the downstream SDLC pass:

**Chat trigger:**

```text
author BRD for a new AEM article-list block with editorial curation,
target 10 user stories, as de, cut a working branch from production
```

**Resolved CLI:**

```bash
npx ts-node .claude/skills/bmad-dept-code-requirements-agent/scripts/run.ts \
  --path . \
  --engine aem \
  --product-description "a new AEM article-list block with editorial curation" \
  --stories-count 10 \
  --role de \
  --create-branch --source-branch production
```

**Outputs:**

```
dca/requirements-aem-20260808_120000                                    ← new working branch
requirements-reports/
├── requirements-dca-requirements-aem-20260808_120000-agent-report.xlsx
├── requirements-dca-requirements-aem-20260808_120000-agent-report.md
├── BRD.md
├── user-stories.md
└── acceptance-criteria.md
CHANGE-LOG.md                                                            ← one new entry spliced in
```

**Follow up in chat:**

```text
impact-analyze the BRD we just authored
generate scaffolds for the top-5 stories
test-coverage the impacted files
```

## Cross-agent chaining hints per role

The Requirements agent adapts its recommended follow-up to the resolved [role](../concepts/role-adaptation):

| Role | Requirements emphasis | Next agent | Why |
|------|-----------------------|-----------|-----|
| `ea` | Heavy NFR section, integration diagrams called out, compliance mapping (PCI/GDPR/WCAG/SOC2) | [Impact Analysis](./impact-analysis) | Trace integration points from the new BRD across the estate. |
| `tl` | API contracts on each user-facing story, sequence flows for cross-service work, per-story effort | [Code Generation](./code-generation) | Scaffold the top-priority stories. |
| `de` | Small, atomically-testable stories, ready-for-dev checklist, one behavior per AC | [Code Generation](./code-generation) | Generate code + test scaffold for the first sprint of stories. |
| `qa` | Test types per story (unit / integration / e2e / security-negative), boundary + negative AC | [Test Coverage](./test-coverage) | Measure AC coverage on the impacted files. |
| `devops` | Rollout strategy per epic (blue-green / canary / feature-flag), observability, on-call runbook stubs | [Sonar Scan](./sonar-scan) | Baseline quality on the impacted files before rollout. |
| `security` | Threat-model per user flow, CIA rated per story, security-negative AC first-class (STRIDE) | [Sonar Scan](./sonar-scan) | Baseline vulnerability posture before the story lands. |
| `pm` | KPIs / OKRs / success criteria elevated, executive summary front-loaded | (stay in requirements) | Summarize BRD for release notes / status. |
| `ba` | Traceability-heavy — requirement source (interview / doc / ticket), business-rule links | [Impact Analysis](./impact-analysis) | Map requirements to system behavior. |
| `migration` | Before/after state per story, cutover criteria per epic, deprecated-behavior enumeration | [Impact Analysis](./impact-analysis) + [Test Coverage](./test-coverage) | Cross-version impact + coverage delta on the migration surface. |
| `content` | Content-model — fields per content type, taxonomy, publishing workflow, translation | [Code Generation](./code-generation) | Emit content-fragment / block scaffold. |
| `generic` | Balanced default — mix of business and technical AC | [Impact Analysis](./impact-analysis) | Trace impact of new requirements before committing to scope. |

The resolved role is exposed to child engines via `process.env.DCA_ROLE`, recorded on the **Run Info** sheet, and printed to stderr on every run.

## Per-stack notes

The agent loads three per-stack resource files at authoring time — **BRD template** + **user-story pack** + **AC pack** — so the emitted BRD reads stack-native, not generic. See the [Requirements Authoring concept](../concepts/requirements-authoring) for the full 3-pack model.

| Stack | Engine ID | Emphasis (BRD / stories / AC lean toward…) |
|-------|-----------|--------------------------------------------|
| AEM (AEMaaCS + AMS) | `aem` | editable-template alignment, dispatcher cache-strategy, Core Web Vitals, Cloud Manager pipeline, WCAG 2.2 AA |
| Adobe Commerce (PaaS) | `commerce-paas` / `commerce` | di.xml wiring, GraphQL schema surface, checkout latency budgets, PCI-DSS scope, admin RBAC/2FA |
| Adobe Commerce SaaS | `commerce-saas` | Catalog Service / Live Search, drop-in composition, Storefront Events SDK, bundle-size budgets |
| Sling / Shaft | `sling` | OSGi service topology, feature-model composition, health-check endpoints, JCR shape |
| Spring Boot | `spring` | REST/GraphQL endpoint contracts, JPA access patterns, actuator + observability, p95/p99 latency |
| Adobe App Builder | `app-builder` | I/O Runtime action design, Adobe I/O Events wiring, API Mesh resolvers, App Registry promotion SLA |
| Edge Delivery Services | `eds` | block-oriented decorate paths, `scripts.js` phases, LCP ≤ 2.5s / CLS ≤ 0.1, ≤ 100KB critical JS |
| EDS + Commerce | `eds-commerce` | all EDS emphasis + drop-in composition, Payment Services, headless catalog/cart/checkout |

## See also

- [Requirements prompts catalog](../reference/prompts/requirements) — 30+ copy-paste prompts across stacks and roles.
- [Requirements Authoring concept](../concepts/requirements-authoring) — the 3-artifact model, per-stack knowledge packs, traceability.
- [CLI Flags reference](../reference/cli-flags) — including the Enterprise Phase 1 flags shared across all agents.
- [Impact Analysis agent](./impact-analysis) — the natural next-agent handoff from an authored BRD.
- [Code Generation agent](./code-generation) — scaffold from approved stories.
- [Standardized outputs contract](../concepts/standardized-outputs) — 15-column Summary + fixed sheet order.
- [Role adaptation](../concepts/role-adaptation) — how default emphasis, AC style, and follow-up change per role.
