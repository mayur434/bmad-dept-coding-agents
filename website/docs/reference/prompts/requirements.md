---
id: requirements
title: Requirements — Prompts
sidebar_position: 6
description: Copy-paste prompts for the Requirements agent — BRD authoring, story generation, AC enrichment, chained SDLC passes.
keywords:
  - requirements prompts
  - brd prompts
  - user story prompts
  - acceptance criteria
  - authoring
---

Copy-paste prompts for the **Requirements agent** (`bmad-dept-code-requirements-agent`). Send a whole block or a single line — the agent parses natural language and resolves flags, stack, and role automatically.

**Modes:** `author` = LLM authors a BRD + stories + AC from a `--product-description`. `parse` = LLM parses `--brd-in <path>` and enriches gaps against the stack template.

Related: [Requirements agent](../../agents/requirements) · [Requirements Authoring concept](../../concepts/requirements-authoring) · [CLI Flags](../cli-flags) · [Role adaptation](../../concepts/role-adaptation).

---

## Quick starters

Send one of these first — the agent auto-detects the stack and role, and asks a single question if it can't resolve one.

```text
author BRD for a new checkout flow
author user stories for the mobile redesign
write acceptance criteria for the checkout redesign
parse ./legacy-brd.docx and enrich
list requirements stacks
```

```text
author BRD for a new feature end-to-end, no questions
author 20 user stories, save BRD to ./docs/BRD.md
enrich our BRD at ./req.docx and target 15 stories
```

---

## Cross-cutting flag templates

One prompt per flag — reuse for any stack:

```text
author BRD --engine aem --path /path/to/project
author BRD --engine spring --path .
author BRD --engine commerce-saas --path ./storefront
```

```text
author BRD --create-branch
author BRD --create-branch --source-branch production
author BRD on a new branch from main
```

```text
author BRD --preflight
author BRD --no-preflight
author BRD and skip preflight
```

```text
author BRD --stories-count 8
author BRD --format markdown
author BRD --brd-out ./docs/BRD.md
```

---

## 1. AEM (AEMaaCS + AMS)

```text
author BRD for a new AEM Content Fragment model for author profiles
author user stories for an editable-template migration from static templates
write AC for the dispatcher-cache invalidation flow after a page publish
```

```text
author BRD for a new AEM article-list block with editorial curation
author user stories for a Sling Model that resolves multi-site tenants
write AC for a WCAG 2.2 AA compliance pass on the /careers section
```

---

## 2. Adobe Commerce (PaaS)

```text
author BRD for a new checkout flow supporting Apple Pay + saved cards
author user stories for a GraphQL customer-account extension
write AC for a di.xml preference swap on the shipping-method aggregator
```

```text
author BRD for a bulk-price import via CSV in admin
author user stories for a message-queue-driven order sync to ERP
write AC for a checkout-latency SLA of TTFB ≤ 200ms under 1000 rps
```

---

## 3. Adobe Commerce SaaS

```text
author BRD for a new drop-in composition on the PDP with product recommendations
author user stories for wiring Storefront Events SDK to Adobe Analytics
write AC for a Live Search fallback when Catalog Service is degraded
```

```text
author BRD for a headless checkout with Payment Services
author user stories for a bundle-size budget of ≤ 100KB per drop-in
write AC for edge-caching of catalog GraphQL under normal + failure modes
```

---

## 4. Sling / Shaft (sling-12)

```text
author BRD for a Sling filter that routes traffic to a green-blue backend
author user stories for a health-check bundle exposing OSGi service readiness
write AC for feature-model composition of a new tenant module
```

```text
author BRD for a JCR content-tree normalization migration
author user stories for a Sling resource resolver caching layer
write AC for OSGi bundle activation SLA under production load
```

---

## 5. Spring Boot

```text
author BRD for a new REST endpoint /v2/orders with idempotency keys
author user stories for a JPA-to-Kafka event outbox pattern
write AC for actuator readiness/liveness probes on a new pod
```

```text
author BRD for a Spring Security migration to spring-security-oauth2 resource-server
author user stories for a p99 latency budget of 250ms on /v1/checkout
write AC for a Redis-backed rate limiter on a public API
```

---

## 6. Adobe App Builder

```text
author BRD for a new I/O Runtime action that syncs Commerce orders to Salesforce
author user stories for an API Mesh resolver merging Catalog + Live Search
write AC for App Registry sandbox → production promotion SLA
```

```text
author BRD for a Commerce UI Extensibility panel on the admin orders grid
author user stories for aio-lib-state cache invalidation on a schema change
write AC for action cold-start ≤ 500ms under normal load
```

---

## 7. Edge Delivery Services (EDS)

```text
author BRD for a new "carousel" block matching our design system
author user stories for a decorate-path refactor across blocks/hero + blocks/cards
write AC for LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms on the /blog template
```

```text
author BRD for a Helix indexing rebuild on ~4k articles
author user stories for a Google-Docs authoring flow with peer review
write AC for a ≤ 100KB critical-JS budget on the home page
```

---

## 8. EDS + Commerce

```text
author BRD for a new PDP built with the Catalog drop-in and Product Recommendations
author user stories for wiring Payment Services into the EDS checkout flow
write AC for drop-in event-schema versioning across catalog + cart + checkout
```

```text
author BRD for the configs.js contract governing per-environment drop-in config
author user stories for a Live Search integration on the /search page
write AC for headless checkout PCI scope alignment
```

---

## Parse & enrich existing BRDs

```text
parse ./legacy-brd.docx and enrich against the stack template
parse ./docs/prd.md and add STRIDE AC per story
extract user stories from ./req.md and estimate effort
parse ./product-vision.docx, target 15 stories, save to ./docs/BRD-normalized.md
enrich our BRD at ./req.docx and add missing NFRs + integration points
```

---

## Chained SDLC passes

Requirements is the entry point when starting from product intent. Common one-shot chains:

```text
author BRD → impact-analyze → generate scaffold → coverage
author BRD for a new checkout flow, then impact-analyze the BRD we just wrote
impact-analyze the BRD we just authored
scaffold the top-5 stories from the BRD we just wrote
test-coverage the impacted files from the BRD we just authored
```

---

## Role-flavored requests

Prefix any prompt with `"as <role>, ..."` for a per-run role override (no write to `.bmad/role.yaml`):

```text
as pm, author BRD focused on measurable success KPIs
as security, author BRD with STRIDE threat model per persona
as ea, author BRD emphasizing NFRs and integration flows
as tl, author BRD with API contracts and sequence flows per story
as de, author BRD with small, atomically-testable stories and G/W/T AC
as qa, author BRD with explicit test types + boundary + negative AC per story
as devops, author BRD with rollout strategy + observability + rollback per epic
as ba, author BRD with traceability IDs back to interview / doc / ticket sources
```

---

## Enterprise gate patterns

Mark requirements accepted / deferred / wontfix for a release so subsequent runs stop resurfacing them. See [Findings Gate](../../concepts/findings-gate) for the YAML shape.

```text
list decisions
author BRD --include-decided
author BRD --decisions-path ./compliance/decisions.yaml
author BRD --ignore-decision-expiry
author BRD --fail-on-overdue        # CI: exit 6 if any draft is OVERDUE per role SLA
```

---

## Troubleshooting

```text
why is my BRD parse failing?
list requirements stacks
how do I change the stack from auto-detected?
switch role to security
switch intake to technical
```

---

## Follow-up prompts (post-run)

Reusable after any Requirements run:

```text
summarize the epics
summarize the MUST-severity requirements
which stories still need AC?
export user stories as a Jira-import CSV
map every AC to a test type (unit / integration / e2e / security-negative)
show me the delta from the source BRD (parse-mode runs)
which requirements are OVERDUE per SLA?
which requirements have decisions applied?
hand this off to impact-analysis
scaffold the first-sprint stories
```
