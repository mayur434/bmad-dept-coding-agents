# HLD authoring guide — Adobe Commerce SaaS (ACCS + drop-ins)

## Purpose framing

A Commerce SaaS HLD establishes the **drop-in vs custom-block split**,
the **Catalog Service / Live Search / Payment Services integration**,
the **Storefront Events SDK wiring** for marketing/analytics, and the
**PIM/OMS boundary** — since Adobe owns the storefront and commerce
core, the design is about **composition**, not about `app/code` code
you own.

## Typical containers (C4 L2 elements) for Commerce SaaS

- **Storefront (Edge)** — usually EDS or a JAMstack host serving the
  drop-in bundle; Adobe does not ship an opinionated storefront
  container.
- **`@dropins/storefront-*` bundles** — pre-built product/cart/checkout
  blocks from Adobe; consumed as npm packages, embedded via EDS blocks
  or SPA slots.
- **Catalog Service** — Adobe SaaS product data API (GraphQL); replaces
  Magento_Catalog reads.
- **Live Search** — Adobe SaaS search + faceting service; replaces
  OpenSearch.
- **Payment Services** — Adobe-managed PSP (Adyen-backed); reduces
  PCI scope to SAQ-A.
- **Storefront Events SDK** — client-side event bus; feeds Adobe
  Analytics / Target / RTCDP.
- **API Mesh** — optional GraphQL composition layer for merging
  Catalog/Live-Search/custom sources.
- **Admin PWA** — Adobe-hosted admin surface (Commerce SaaS console).
- **PIM/OMS** — external, integrated via SaaS Data Connector or direct
  webhook.

## Stack-specific tech-choice table

| Container | Technology | Why |
|---|---|---|
| Storefront host | EDS (helix) / Vercel / Netlify | Adobe-recommended edge; SEO-friendly |
| Drop-ins | `@dropins/storefront-cart`, `-checkout`, `-pdp` v1.x <!-- verify --> | Adobe-owned; upgrade path guaranteed |
| Catalog | Catalog Service GraphQL | Adobe-managed; global CDN |
| Search | Live Search GraphQL | Merchandising rules in Admin |
| Payment | Adobe Commerce Payment Services (Adyen) | SAQ-A scope, tokenized |
| Events | `@adobe/magento-storefront-events-sdk` | Standard Adobe schema |
| Composition | API Mesh (Adobe I/O) | Merge Adobe + third-party GraphQL |
| Auth | IMS (customer) + Adobe SaaS session tokens | Managed by drop-ins |

## Cross-cutting concerns for Commerce SaaS

- **AuthN/AuthZ** — customer auth via drop-in's IMS/Commerce token
  exchange; admin via IMS + Adobe org role.
- **Logging** — client-side telemetry via Storefront Events;
  server-side via API Mesh handler logs (Adobe I/O Runtime).
- **Tracing** — sparse; instrument at drop-in boundary + API Mesh
  spans; no origin server logs to correlate against.
- **Config** — drop-in mount-point config (JSON initialization);
  storefront config in EDS `sharepoint`/gdocs; Admin UI for
  merchandising.
- **Secrets** — API Mesh `--param-file` at deploy; never in
  drop-in bundle (client-side).
- **Feature flags** — Adobe Target audiences drive drop-in variants; or
  storefront-events-driven flags.
- **i18n** — Adobe Commerce SaaS locale scope + drop-in i18n prop.

## Integration points typical to Commerce SaaS

- **PIM** — Salsify / inRiver / Akeneo → Catalog Service via SaaS Data
  Connector.
- **OMS** — Fluent / Kibo / ChannelAdvisor via order webhooks.
- **ERP** — via API Mesh custom source (SAP OData, NetSuite REST).
- **Adobe Analytics** — Storefront Events SDK → XDM → Analytics.
- **Adobe Target** — drop-in slots exposed as Target locations.
- **RTCDP** — Web SDK (`alloy.js`) side-by-side with drop-ins.
- **Consent** — OneTrust / TrustArc; drives Storefront Events opt-in.
- **CDP/CRM** — Salesforce / HubSpot via API Mesh.
- **Marketing tags** — Adobe Launch preferred; direct GTM allowed with
  consent gating.

## NFR profile for Commerce SaaS

- **Storefront LCP** ≤ 2.5s p75 (EDS baseline).
- **Catalog Service p95** — Adobe SLA <!-- verify: current published
  latency budget for Catalog Service -->.
- **Live Search p95** — Adobe SLA <!-- verify -->.
- **Payment authorize** ≤ 3s p95 (Adyen dependent).
- **Cart-total call** ≤ 400ms p95.
- **Drop-in TTI** ≤ 3s.
- **Availability** — Adobe Commerce SaaS SLA <!-- verify: current
  published SLA (was 99.9% at GA) -->.
- **PCI scope** — SAQ-A only, enforced by Payment Services.

## Capacity planning shape

- **No infra to size** — Adobe scales Catalog / Live Search / Payment.
- **What you plan**: storefront edge cost (EDS is per-request/free tier
  generous), API Mesh action minutes, PIM sync throughput, event volume
  quota <!-- verify: Storefront Events daily quota -->.
- **Storefront traffic** — plan for CDN egress + drop-in bundle size
  budget (<= 150KB gz on critical path).
- **Data volumes** — SKU count in Catalog Service directly; no local
  mirror.

## Deployment topology

Mermaid `flowchart` shape: `Client → EDS Edge → drop-in bundle → Adobe
Commerce SaaS (Catalog Service + Live Search + Payment Services) →
Storefront Events → Adobe Experience Platform`. API Mesh optional in
front of Catalog for composition. Multi-region managed by Adobe.

## Delivery / release approach for Commerce SaaS

- **Storefront** — git-based EDS deploy (`main` = production); rollback
  via git revert.
- **Drop-ins** — pin npm versions in EDS repo; upgrade via PR + soak in
  preview branch.
- **API Mesh** — `aio api-mesh:update` per env; namespace-scoped
  deploys (dev / stage / prod).
- **Admin merch rules** — Live Search rules published from Admin UI;
  version-track via export.
- **Data-model changes** — PIM-driven; publish to Catalog Service via
  SaaS Data Connector cadence.
- **Rollback** — git revert (storefront), Mesh redeploy prior version,
  Admin rule revert.

## 3 worked HLD outline examples for Commerce SaaS

**HLD-01: New Fashion Brand Launch on Commerce SaaS**
- Containers: EDS storefront + drop-ins (PDP/cart/checkout) + Catalog
  Service + Live Search + Payment Services + Salsify PIM.
- ADRs: ADR-drop-in-vs-custom-block-for-PDP; ADR-API-Mesh-yes-no;
  ADR-consent-mode.
- Cross-cutting: Adobe Launch, Storefront Events → Analytics, OneTrust.
- NFRs: LCP ≤ 2.2s, Live Search p95 ≤ 200ms, Payment authorize ≤ 2.5s.
- Rollout: single-region GA; migrate PIM → Catalog Service in dry-run
  before cutover.

**HLD-02: Migration from Adobe Commerce PaaS to SaaS**
- Containers: current PaaS estate + new SaaS estate + coexistence
  dispatcher/router.
- ADRs: ADR-migration-strategy (big-bang vs coexistence);
  ADR-catalog-shape-mapping; ADR-checkout-continuity.
- Cross-cutting: SEO redirects, order-history bridging, coupon parity.
- NFRs: SEO-safe cutover, zero-cart-loss guarantee.
- Migration: strangler-fig by category tree; DNS split by URL path.

**HLD-03: Storefront Events for RTCDP Personalization**
- Containers: drop-ins + Storefront Events SDK + Web SDK + RTCDP +
  Target.
- ADRs: ADR-event-schema-mapping (Adobe schema vs custom XDM);
  ADR-consent-fallback.
- Cross-cutting: consent-aware event emission; PII redaction at edge.
- NFRs: event delivery ≤ 5s p95; consent decision ≤ 100ms.
- Rollout: category-page audience test → cart audience test → GA.

## Anti-patterns to avoid for Commerce SaaS

- **Building a bespoke checkout when the Adobe drop-in fits** —
  Payment Services + PCI SAQ-A only certified against the drop-in
  boundary.
- **Bypassing Catalog Service for reads** — hitting a legacy Magento or
  PIM directly at storefront breaks the SaaS scaling model.
- **Business logic in the browser** — pricing rules, entitlement, tax
  belong behind Catalog Service or in API Mesh, not in the client.
- **Ignoring Storefront Events** — Adobe Analytics / Target / RTCDP all
  key off it; skipping means rebuilding the taxonomy later.
- **Direct GTM without consent gating** — Commerce SaaS defaults assume
  Adobe Launch + consent; direct tags leak PII.

---

Generate the full HLD using `templates/HLD.md` as the master, populating
placeholders with stack-appropriate content from the guide above. When
container/technology decisions are still open, produce an ADR alongside
(see `resources/adr-templates/commerce-saas.md`).
