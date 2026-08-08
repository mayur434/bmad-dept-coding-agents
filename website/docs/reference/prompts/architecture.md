---
id: architecture
title: Architecture — Prompts
sidebar_position: 7
description: Copy-paste prompts for the Architecture agent — ADRs, HLD/LLD, API contracts, C4 diagrams, STRIDE threat models, and design enrichment across 8 Adobe/JVM stacks.
keywords:
  - architecture prompts
  - adr prompts
  - hld prompts
  - openapi prompts
  - stride prompts
  - c4 prompts
---

Copy-paste prompts for the **Architecture agent** (`bmad-dept-code-architecture-agent`). Send a whole block or a single line — the agent parses natural language and resolves flags, stack, and role automatically.

**Modes:** `author` = LLM authors ADRs / HLD / LLD / OpenAPI / diagrams / STRIDE / data model from a `--design-question` or `--adr`. `parse` = LLM parses `--design-in <path>` or `--openapi-in <path>` and enriches gaps against the stack template.

Related: [Architecture agent](../../agents/architecture) · [Architecture Authoring concept](../../concepts/architecture-authoring) · [CLI Flags](../cli-flags) · [Role adaptation](../../concepts/role-adaptation).

---

## Quick starters

Send one of these first — the agent auto-detects the stack and role, and asks a single question only if there is no design input at all.

```text
author ADR for Kafka vs SQS for order events
design the API for our new promotions service
threat model our checkout flow
HLD for the loyalty extension
LLD for the promotions component
data model for the loyalty program
review this OpenAPI at ./api.yaml and add missing security schemes
parse ./legacy-hld.md and enrich with missing NFRs
```

```text
author full design pack for the promotions service
author ADR and go — one-shot, no questions
list architecture stacks
```

---

## Cross-cutting flag templates

One prompt per flag — reuse for any stack:

```text
design --engine aem --path /path/to/project
design --engine spring --path .
design --engine commerce-saas --path ./storefront
```

```text
design --create-branch
design --create-branch --source-branch production
design on a new branch from main
```

```text
design --preflight
design --no-preflight
design and skip preflight
```

```text
design --artifacts adr
design --artifacts openapi,c4,sequence
design --artifacts all
design --api-style rest
design --api-style graphql
design --api-style both
design --diagrams mermaid
design --diagrams plantuml
design --format markdown
```

---

## ADRs

Common decision categories per stack — grounded in the per-stack `adr-templates/*.md`.

### 1. AEM (AEMaaCS + AMS)

```text
author ADR: Cloud Manager vs Jenkins for release automation
author ADR: Sling Model vs OSGi service for the loyalty component
author ADR: dispatcher farm split for multi-tenant
```

### 2. Adobe Commerce (PaaS)

```text
author ADR: Preference vs Plugin for payment method override
author ADR: RabbitMQ vs direct call for cart-total lookup
author ADR: db_schema patch strategy for a new column on sales_order
```

### 3. Adobe Commerce SaaS

```text
author ADR: Catalog Service vs Live Search for PDP facets
author ADR: API Mesh vs direct Catalog Service call from drop-ins
author ADR: drop-in composition vs custom block for cart summary
```

### 4. Sling / Shaft

```text
author ADR: Feature Model vs Sling Starter composition
author ADR: bundle-boundary split for the tenant module
author ADR: JCR vs external Postgres for the MDM store
```

### 5. Spring Boot

```text
author ADR: Kafka vs SQS for order-event fan-out
author ADR: MVC vs WebFlux for the promotions service
author ADR: Flyway vs Liquibase for schema migrations
```

### 6. Adobe App Builder

```text
author ADR: API Mesh resolver vs middleware direct
author ADR: single-action vs sequence for the Salesforce sync
author ADR: State SDK vs external Cosmos for the cache layer
```

### 7. Edge Delivery Services (EDS)

```text
author ADR: load-eager vs load-lazy phase for the hero block
author ADR: auto-block extraction strategy for the article template
author ADR: Adobe Launch vs direct GTM for consent-mode wiring
```

### 8. EDS + Commerce

```text
author ADR: localStorage vs Commerce backend for cart persistence
author ADR: Product Recommendations vs Live Search on the PDP
author ADR: IMS → Commerce token exchange approach
```

---

## HLDs

Per-stack high-level design prompts — each authors `HLD.md` + embedded C4 L1/L2.

### AEM

```text
HLD for the AEM loyalty extension end-to-end
HLD for a multi-tenant AEM estate with shared dispatcher farm
```

### Commerce PaaS

```text
HLD for the Commerce catalog enrichment pipeline via RabbitMQ
HLD for a bulk-import admin flow with async processing
```

### Commerce SaaS

```text
HLD for the PDP with Catalog Service + Recommendations
HLD for headless checkout wiring to Payment Services
```

### Sling

```text
HLD for the health-check bundle + OSGi service readiness
HLD for a Sling filter routing to a green-blue backend
```

### Spring

```text
HLD for the promotions service with Kafka fan-out + Postgres
HLD for a Spring Cloud gateway offloading OAuth2 to a resource server
```

### App Builder

```text
HLD for an I/O Runtime action syncing Commerce orders to Salesforce
HLD for a Commerce UI Extensibility panel on the admin orders grid
```

### EDS

```text
HLD for a carousel block matching our design system
HLD for a Helix indexing rebuild on ~4k articles
```

### EDS + Commerce

```text
HLD for a PDP built with the Catalog drop-in + Product Recommendations
HLD for the configs.js contract governing per-environment drop-in config
```

---

## LLDs

Per-stack component-level design prompts — each authors `LLD.md` + embedded C4 L3.

### AEM

```text
LLD for the Sling servlet handling loyalty enrolment
LLD for an OSGi component wiring dispatcher invalidation on publish
```

### Commerce PaaS

```text
LLD for the plugin around Magento\Sales\Model\Order::place
LLD for the RabbitMQ consumer syncing orders to ERP
```

### Commerce SaaS

```text
LLD for a drop-in composition wiring Cart + Product Recs on PDP
LLD for a Storefront Events SDK subscription pushing to Adobe Analytics
```

### Sling

```text
LLD for the resource-resolver caching layer with per-tenant scoping
LLD for the OSGi bundle activation health-check
```

### Spring

```text
LLD for the Spring service consuming Kafka orders with idempotency keys
LLD for the JPA outbox pattern with a scheduled publisher
```

### App Builder

```text
LLD for the API Mesh resolver merging Catalog + Live Search
LLD for an I/O Events consumer action with retry + DLQ semantics
```

### EDS

```text
LLD for a hero block with LCP-critical image loading
LLD for a decorate-path refactor across blocks/hero + blocks/cards
```

### EDS + Commerce

```text
LLD for the cart drop-in with IMS token exchange
LLD for the PDP drop-in orchestrating Catalog + Recs + Cart
```

---

## API contracts

```text
OpenAPI for the promotions service
GraphQL SDL for the loyalty schema
review ./api.yaml and add STRIDE-informed security schemes
generate REST + GraphQL for the same schema
extract API contract from ./service-impl.ts (parse & enrich)
```

---

## Diagrams

```text
C4 context diagram for our current AEM estate
C4 container diagram for the promotions service
sequence diagram: happy-path checkout with Payment Services
sequence: dispatcher-cache invalidation flow
C4 dynamic view: order-event fan-out via Kafka
```

---

## STRIDE threat models

Per-stack — grounded in the per-stack `threat-models/*.md`.

### AEM

```text
threat model our AEM Publish tier
STRIDE the dispatcher farm + invalidation agents
```

### Commerce PaaS

```text
STRIDE analysis of Commerce checkout with Vault tokenization
threat model the admin RBAC + 2FA posture
```

### Commerce SaaS

```text
threat model our drop-in composition on the PDP (XSS surface)
STRIDE the Storefront Events SDK PII flow
```

### Sling

```text
threat model the Sling resource-resolver + service-user config
STRIDE the health-check public endpoints
```

### Spring

```text
threat model the promotions REST surface (Bearer JWT + OAuth2)
STRIDE the Kafka consumer with poison-pill handling
```

### App Builder

```text
threat model the I/O Runtime action + IMS token exchange
STRIDE the API Mesh handler with a public GraphQL surface
```

### EDS

```text
threat model our EDS block DOM injection surface
STRIDE the consent-mode + Adobe Launch integration
```

### EDS + Commerce

```text
threat model the EDS→Commerce checkout with Payment Services
STRIDE the drop-in event-schema propagation for PII redaction
```

---

## Parse & enrich existing designs

```text
parse ./legacy-hld.md and enrich with missing NFRs
review ./openapi.yaml and add missing error schemas
add STRIDE to ./existing-threat-model.md
parse ./docs/architecture.md and add missing sequence flows for named endpoints
review ./api.yaml and tag public endpoints without security schemes
```

---

## Chained SDLC passes

Architecture is the design entry point. Common one-shot chains:

```text
chain: architecture → requirements → generation
architecture → audit the existing code against LLD
ADR + impact-analyze the blast radius of the chosen option
design the API for X, then generate scaffolds from the OpenAPI
STRIDE the checkout, then sonar-scan the impacted files
```

---

## Role-flavored requests

Prefix any prompt with `"as <role>, ..."` for a per-run role override (no write to `.bmad/role.yaml`):

```text
as ea, HLD focused on portfolio-fit and NFRs
as tl, full design pack — ADR + HLD + LLD + OpenAPI + C4 + sequence
as de, LLD + OpenAPI + sequence for the promotions endpoints
as qa, sequence diagrams that expose contract-test boundaries
as devops, HLD with deployment topology + runbook links
as security, threat-model with data classification per component
as pm, ADR framed as cost/risk trade-off
as ba, data model + ER diagrams with business rules
```

---

## Enterprise gate patterns

Mark ADRs accepted / deferred / wontfix for a release so subsequent runs stop resurfacing them. See [Findings Gate](../../concepts/findings-gate) for the YAML shape.

```text
list decisions
author ADR --include-decided                    # bypass the decisions gate
author ADR --decisions-path ./compliance/decisions.yaml
author ADR --ignore-decision-expiry
author ADR --fail-on-overdue                    # CI: exit 6 if any ADR is OVERDUE per role SLA
```

---

## Troubleshooting

```text
why is my OpenAPI parse failing?
how do I change --artifacts to only ADR?
Mermaid diagram not rendering — help
list architecture stacks
how do I switch role to security?
switch intake to technical
```

---

## Follow-up prompts (post-run)

Reusable after any Architecture run:

```text
summarize the top-3 decisions from the last ADR set
impact-analyze the blast radius of adopting Kafka
generate scaffolding from the approved LLD
audit our current code against LLD.md
write the acceptance criteria for each artifact in the LLD
which ADRs are OVERDUE per SLA?
which decisions are already applied?
hand the OpenAPI to Generation for controller scaffolds
hand the sequence diagrams to Test Coverage for integration tests
sonar-scan the components flagged by the STRIDE model
```
