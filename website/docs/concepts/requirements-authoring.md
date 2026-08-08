---
id: requirements-authoring
title: Requirements Authoring
sidebar_position: 11
description: How BMAD DCA authors BRDs + user stories + acceptance criteria across 8 Adobe / JVM stacks with per-stack knowledge packs, role adaptation, and traceability.
keywords:
  - requirements authoring
  - brd
  - user stories
  - acceptance criteria
  - moscow
  - traceability
  - sdlc
  - discovery
---

The **Requirements Authoring** concept underpins the [Requirements agent](../agents/requirements) — the sixth agent of the BMAD DCA suite, added in Phase 2 to close SDLC phase 1 (Discovery / Requirements). This page explains the 3-artifact model, the per-stack knowledge packs, the two authoring modes, and how the output feeds the rest of the DCA workflow.

## Why an authoring agent

The other five DCA agents ([Audit](../agents/audit), [Sonar Scan](../agents/sonar-scan), [Impact Analysis](../agents/impact-analysis), [Code Generation](../agents/code-generation), [Test Coverage](../agents/test-coverage)) all **analyze code that already exists**. They cover SDLC phases 3–8 — build, test, harden, ship. That leaves phases 1–2 (Requirements, Architecture) with no DCA coverage — and in practice, that's where the most expensive rework originates: BRDs that skip NFRs, stories that skip AC, features that ship without a spec Test Coverage can trace against.

Requirements closes phase 1 upstream of everything else. Concretely:

- **Consistent BRD shape across teams** — one PM / one EA / one QA all read the same stack-native structure regardless of who authored the doc.
- **Role-adapted framing** — the same product description emits a KPI-heavy executive shape for `pm`, an integration-heavy shape for `ea`, and dev-oriented small-story AC for `de`.
- **Traceable Epic → Story → AC matrix** — every requirement is a `REQ-<n>` row in the standardized Summary sheet, keyed by MoSCoW severity, so downstream agents can consume the same rows via the [findings cache](./findings-cache).
- **Enterprise gates** — participates in the shared [Findings Gate](./findings-gate) (`accepted` / `deferred` / `wontfix` per release) and [SLA Tracking](./sla-tracking) (requirement-approval SLA per role).

## The 3-artifact model

Requirements produces an **Epic → User Story → Acceptance Criteria** hierarchy where every node is a row in the standardized Summary sheet:

- **Epic** — a coherent slice of product intent (e.g. "guest checkout with Apple Pay"). `category=epic`. Aggregates a set of stories.
- **User Story** — an INVEST-shaped unit of delivery, `"As a … I want … so that …"`. `category=story`. Owned by a single sprint.
- **Acceptance Criterion (AC)** — a testable Given/When/Then behavior under a story. `category=ac`. What Test Coverage will trace against.

Complementing the hierarchy, the Summary sheet also carries requirement-level rows the BRD needs but that don't fit under a single story:

- **Business Requirement (BR)** — `category=br`. What the business needs.
- **Functional Requirement (FR)** — `category=fr`. What the system does.
- **Non-Functional Requirement (NFR)** — `category=nfr`. Constraints on how it does it — performance, security, compliance, accessibility.

Every row conforms to the 15-column Summary contract with these key columns:

| Column | Value for a story / AC |
|--------|------------------------|
| `id` | `REQ-<n>` (monotonic per run) |
| `title` | One-sentence requirement / story / AC title |
| `description` | Paragraph for BR/FR/NFR, `"As a … I want …"` for stories, `"Given … When … Then …"` for AC |
| `category` | `br` \| `fr` \| `nfr` \| `epic` \| `story` \| `ac` |
| `severity` | MoSCoW — `MUST` \| `SHOULD` \| `COULD` \| `WONT` (mapped from the Phase-1 CRITICAL/HIGH/MEDIUM/LOW vocabulary) |
| `ruleId` | `REQ-<stack>-<type>` (e.g. `REQ-aem-nfr-cwv`, `REQ-eds-ac-lcp`, `REQ-commerce-paas-fr-checkout`) |
| `effort` | T-shirt: `S` \| `M` \| `L` \| `XL` (stack-specific) |
| `status` | `draft` (default) \| `reviewed` \| `approved` — advances via the [decisions gate](./findings-gate) on subsequent runs |

Full row-shape spec on the [Standardized Outputs](./standardized-outputs) page.

## Per-stack knowledge packs

For each of the 8 stacks Requirements loads **three per-stack resource files** at authoring time — a 3-pack. This is what keeps the BRD stack-native (an AEM BRD reads like an AEM BRD, not a generic doc with the word "AEM" sprinkled in):

| Pack | Path | Purpose |
|------|------|---------|
| **BRD template** | `resources/brd-templates/<stack>.md` | Business framing — sections, NFR staples, integration staples, glossary anchors specific to the stack. |
| **User-story pack** | `resources/user-story-templates/<stack>.md` | INVEST checklist + splitting patterns + stack-native example stories (e.g. "component + dialog + policy" for AEM, "controller + service + repository" for Spring). |
| **AC pack** | `resources/acceptance-criteria-templates/<stack>.md` | Given/When/Then + testability guidance + STRIDE prompts + stack-native negative-path patterns. |

These packs are analogous to the audit / sonar-scan **rule packs** in [`reference/rule-packs/*`](../reference/rule-packs/aem) — they are the stack knowledge the LLM references at authoring time.

**What each stack biases toward** — one line each; the [Requirements agent page](../agents/requirements#per-stack-notes) has the full table:

- **AEM** — editable-template alignment, dispatcher cache-strategy, Core Web Vitals, WCAG 2.2 AA.
- **Commerce PaaS** — di.xml wiring, GraphQL schema surface, PCI scope, checkout latency budgets.
- **Commerce SaaS** — drop-in composition, Storefront Events SDK, bundle-size budgets.
- **Sling** — OSGi service topology, JCR shape, health checks.
- **Spring** — REST/GraphQL contracts, JPA patterns, p95/p99 per endpoint.
- **App Builder** — I/O Runtime actions, Adobe I/O Events, App Registry promotion.
- **EDS** — block decorate paths, `scripts.js` phases, ≤ 100KB critical JS.
- **EDS + Commerce** — all EDS + drop-ins + Payment Services + headless catalog/cart/checkout.

## Two modes

Requirements has two orthogonal modes, selected by which input the user supplies:

### Author (default)

**Trigger:** `--product-description "…"` on the CLI, or `"author BRD for …"` in the prompt.

The LLM reads the stack's 3-pack + the product description and emits `BRD.md`, `user-stories.md`, `acceptance-criteria.md`, and the standardized workbook. Use this for **new-feature discovery**, **story-splitting workshops**, and **retrospective requirement documentation**.

### Parse & Enrich

**Trigger:** `--brd-in <path>` on the CLI, or `"parse this BRD …"` in the prompt.

The dispatcher parses the source BRD (`.docx` via `mammoth`; `.md` / `.txt` natively), extracts existing epics / stories / AC as findings, and fills gaps against the stack template (missing NFRs, missing AC on stated stories, missing integration points). The workbook grows a **Delta** sheet showing pre-existing vs added — so the enrichment is visible, not silent. Use this for **brownfield BRD refresh** and **normalizing legacy PRDs** to the DCA contract.

Both modes can be combined — pass `--brd-in <path> --product-description "additional context"` and the description is layered on top of the parsed BRD as extra intent.

## Role-adaptation for authoring

Requirements adapts the **default emphasis**, the **AC style**, and the **recommended follow-up** to the resolved role — same [role-adaptation](./role-adaptation) mechanism the other agents use. Concrete flavors:

- **Enterprise Architect (`ea`)** — NFR-heavy BRD, integration diagrams called out per epic, compliance mapping (PCI / GDPR / WCAG / SOC2), portfolio-level "how this fits the estate" note per epic. AC style: G/W/T + upstream/downstream integration contracts.
- **Senior Delivery Engineer (`de`)** — Small, atomically-testable stories, ready-for-dev checklist per story. AC style: G/W/T with one behavior per AC.
- **Security Engineer (`security`)** — Threat-model note per user flow, CIA (Confidentiality / Integrity / Availability) rated per story, STRIDE prompts baked into every AC pack. AC style: G/W/T + security-negative AC first-class (auth bypass, injection, data exfil, replay).
- **QA / SDET (`qa`)** — Every story lists explicit test types (unit / integration / e2e / security-negative), boundary values, negative paths.
- **Product Manager (`pm`)** — KPIs / OKRs / success criteria section elevated, executive summary front-loaded, business-outcome AC.

Full role matrix on the [Requirements agent page](../agents/requirements#cross-agent-chaining-hints-per-role) and in the source [`SKILL.md` § Role-aware behavior](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-requirements-agent/SKILL.md#role-aware-behavior).

## Traceability

Every finding row is written to the standardized report **and** to a findings cache at `.bmad/cache/requirements-<hash>.json`. That cache is consumed by the downstream analysis agents via the shared [findings-cache](./findings-cache) contract — Impact Analysis can trace `REQ-<n>` rows to impacted files, Code Generation can scaffold from approved stories, Test Coverage can measure coverage against AC.

The recommended DCA fan-out from a Requirements run:

```
Requirements (author BRD from description)
    ↓
Impact Analysis (--brd requirements-reports/BRD.md)
    → trace impacted code across the estate
    ↓
Code Generation (--type <matches story>)
    → scaffold code for approved stories
    ↓
Test Coverage (--mode full)
    → write tests aligned to AC
    ↓
Sonar Scan + Audit
    → baseline quality + vulnerabilities before merge
```

## Output artifacts

Every requirements run writes into `<project>/requirements-reports/` (override with `--output`):

- `requirements-<branch>-<timestamp>-agent-report.xlsx` — the standardized workbook.
- `requirements-<branch>-<timestamp>-agent-report.md` — the Markdown twin.
- `BRD.md` — the primary written deliverable (or `--brd-out <path>`).
- `user-stories.md` — one section per story.
- `acceptance-criteria.md` — one G/W/T block per AC.
- One `CHANGE-LOG.md` entry spliced into project root.

Optional `--format docx` is currently **stubbed** — it logs a warning and falls back to markdown. The docx writer lands in Phase 2.2.

## See also

- [Requirements agent](../agents/requirements) — the per-agent reference (flags, modes, CLI, per-stack notes).
- [Requirements prompts catalog](../reference/prompts/requirements) — 30+ copy-paste prompts.
- [Role adaptation](./role-adaptation) — how default emphasis, AC style, and follow-up change per role.
- [Findings cache](./findings-cache) — how requirements output feeds downstream agents.
- [Findings gate](./findings-gate) — accept / defer / wontfix per release.
- [SLA tracking](./sla-tracking) — requirement-approval SLA per role.
- [One-shot mode](./one-shot-mode) — full precedence rules for silent end-to-end execution.
- [Standardized outputs](./standardized-outputs) — the shared 15-column Summary + fixed sheet order.
