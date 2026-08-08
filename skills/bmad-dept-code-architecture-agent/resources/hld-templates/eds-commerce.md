# HLD authoring guide — EDS + Commerce hybrid

## Purpose framing

An EDS + Commerce HLD establishes **all the EDS design decisions** plus
the **drop-in wiring pattern** for storefront commerce blocks, the
**cart state persistence contract** (client-side vs server-side sync),
the **IMS → Commerce token exchange**, the **Storefront Events SDK
propagation**, and the **product-picker approach** (Live Search vs
Catalog Service). The design must reconcile EDS's no-build-step
constraint with the drop-ins' npm packaging.

## Typical containers (C4 L2 elements) for EDS + Commerce

- **EDS edge** — helix runtime + CDN (as in `eds.md`).
- **`@dropins/storefront-*` bundle** — Adobe drop-ins for PDP / cart /
  checkout / account, loaded via block-scoped ES modules.
- **Catalog Service** — Adobe SaaS product data GraphQL.
- **Live Search** — Adobe SaaS search + facets.
- **Payment Services** — Adobe-managed PSP (Adyen-backed).
- **Storefront Events SDK** — client event bus feeding Adobe Analytics /
  Target / RTCDP.
- **API Mesh** (optional) — GraphQL composition for merging Catalog +
  custom + third-party sources.
- **IMS** — customer auth token issuance; exchanged for Commerce session
  token by the drop-in.
- **Consent management** — OneTrust or Cookiebot; gates Storefront
  Events emission.
- **Marketing tag layer** — Adobe Launch (preferred), loaded delayed.

## Stack-specific tech-choice table

| Container | Technology | Why |
|---|---|---|
| Storefront | EDS helix + drop-ins v1.x <!-- verify current --> | Adobe-recommended hybrid |
| Drop-ins | `@dropins/storefront-pdp`, `-cart`, `-checkout`, `-account` | Pre-built; Adobe-owned upgrade path |
| Catalog | Catalog Service GraphQL | SaaS-managed catalog reads |
| Search | Live Search GraphQL | Merch rules from Admin UI |
| Payment | Adobe Commerce Payment Services | SAQ-A PCI scope |
| Events | `@adobe/magento-storefront-events-sdk` | XDM-mappable schema |
| Auth | IMS + Adobe Commerce session token | Drop-in-managed exchange |
| Composition | API Mesh (optional) | When drop-ins can't consume raw sources |

## Cross-cutting concerns for EDS + Commerce

- **AuthN/AuthZ** — guest browsing default; sign-in → IMS → Commerce
  session cookie; account drop-in owns the UX.
- **Logging** — client telemetry via Storefront Events + RUM; API Mesh
  logs when composed; no origin server logs.
- **Tracing** — instrument drop-in boundary; correlation-id from IMS
  session; Storefront Events for user-journey.
- **Config** — drop-in mount config (JSON init) in block JS; storefront
  config in `sharepoint`/gdocs; merch rules in Admin.
- **Secrets** — no server secrets in storefront; API Mesh
  `--param-file` for backend credentials.
- **Feature flags** — sheet-driven or Adobe Target audiences.
- **i18n** — path-based locale + drop-in `locale` prop + Live Search
  locale scope.

## Integration points typical to EDS + Commerce

- **Commerce SaaS core** — Catalog / Live Search / Payment Services via
  GraphQL.
- **PIM** — Salsify / Akeneo / inRiver → Catalog Service via SaaS Data
  Connector.
- **OMS** — Fluent / Kibo / IBM Sterling via order webhooks.
- **ERP** — SAP / NetSuite via API Mesh custom source.
- **Adobe Launch / Analytics / Target** — Storefront Events → Web SDK.
- **RTCDP** — real-time profile + audience decisioning.
- **Consent** — OneTrust events drive Storefront Events opt-in flag.
- **Reviews** — Yotpo, Bazaarvoice; deferred load in `load-delayed`.
- **Chat** — LivePerson, Zendesk; deferred load.
- **Search** — Live Search default; Coveo/Algolia when Adobe search
  falls short.

## NFR profile for EDS + Commerce

- **All EDS NFRs** — LCP ≤ 2.5s / INP ≤ 200ms / CLS ≤ 0.1 on p75.
- **Drop-in TTI** ≤ 3s p75 for PDP; ≤ 2s for cart mini.
- **Cart-total call** ≤ 400ms p95.
- **Add-to-cart round trip** ≤ 800ms p95.
- **Catalog Service p95** — Adobe SLA <!-- verify -->.
- **Live Search p95** — Adobe SLA <!-- verify -->.
- **Payment authorize** ≤ 3s p95.
- **Availability** — CDN 99.99% + Commerce SaaS SLA (composed)
  <!-- verify current SaaS SLA -->.
- **PCI scope** — SAQ-A via Payment Services boundary.

## Capacity planning shape

- **No infra to size** — Adobe scales storefront edge + Commerce SaaS.
- **What you plan**: drop-in bundle size on critical path (aim <150KB gz
  for PDP), Catalog Service query cost (limit facet cardinality), event
  volume vs Storefront Events quota <!-- verify -->, image pipeline
  budget (Cloudinary/EDS media).
- **Cart volume** — plan for peak cart-writes/sec; Commerce SaaS scales
  but budget the drop-in retry backoff.
- **Search traffic** — Live Search charges by query volume
  <!-- verify pricing model -->.

## Deployment topology

Mermaid `flowchart` shape: `Client → EDS Edge → drop-in bundle → Adobe
Commerce SaaS (Catalog + Live Search + Payment) → Storefront Events →
AEP`. API Mesh optional between drop-ins and Catalog for composition
scenarios. IMS session cookie flows client-side; no origin server.

## Delivery / release approach for EDS + Commerce

- **Storefront** — git-based EDS deploy (`main` = production);
  block-level changes go through preview.
- **Drop-in versioning** — pinned via git-tracked import (no npm
  install at build) — drop-in bundles either loaded from CDN (Adobe-
  hosted) or vendored in repo.
- **Merch rules** — Live Search + Catalog rules published from Admin
  UI; export snapshot to git for review.
- **API Mesh** — `aio api-mesh:update` per env when composition is
  used.
- **Data-model changes** — PIM-driven catalog updates flow via SaaS
  Data Connector cadence.
- **Rollback** — git revert (storefront), Admin rule revert, Mesh
  redeploy prior version.

## 3 worked HLD outline examples for EDS + Commerce

**HLD-01: New DTC Beauty Brand on EDS + Commerce SaaS**
- Containers: EDS + drop-ins (PDP/cart/checkout/account) + Catalog +
  Live Search + Payment + Salsify PIM + Adobe Launch + OneTrust.
- ADRs: ADR-drop-in-vs-custom-PDP; ADR-consent-mode; ADR-Storefront-
  Events-to-XDM.
- Cross-cutting: consent-gated events, IMS/Commerce session bridge,
  per-locale drop-in config.
- NFRs: LCP ≤ 2.2s, cart-total ≤ 300ms, Payment authorize ≤ 2.5s.
- Rollout: single-country GA, then EU/US.

**HLD-02: Retail Media Site Adds Commerce for Product Detail**
- Containers: existing EDS marketing + new PDP drop-in + Catalog
  Service + Add-to-cart mini-cart.
- ADRs: ADR-cart-persistence (localStorage vs server); ADR-guest-vs-auth-
  cart; ADR-legacy-CMS-coexistence.
- Cross-cutting: sitemap merge, redirect table, SSO with existing IMS.
- NFRs: existing LCP budget preserved; PDP TTI ≤ 3s p75.
- Rollout: category-by-category migration.

**HLD-03: B2B Portal with Quote Workflow on EDS + Commerce**
- Containers: EDS + drop-ins + custom quote-request block + API Mesh
  (Commerce + ERP) + Salesforce CRM.
- ADRs: ADR-drop-in-vs-bespoke-quote; ADR-API-Mesh-vs-direct-ERP;
  ADR-consent-B2B.
- Cross-cutting: B2B customer-group scoping, punchout compatibility,
  ERP pricing overlay.
- NFRs: quote render ≤ 3s, ERP price ≤ 1s p95 via mesh cache.
- Rollout: pilot buyer group → full GA.

## Anti-patterns to avoid for EDS + Commerce

- **Adding a bundler for the drop-ins** — breaks EDS's no-build
  contract; consume drop-ins as ES modules from CDN.
- **Storing cart entirely client-side** — loses cart across devices;
  Commerce SaaS is the source of truth.
- **Skipping consent gating on Storefront Events** — PII leaks to
  Analytics/Target; consent-mode required by GDPR/CCPA.
- **Direct Catalog GraphQL from every block** — creates request
  fan-out; compose via API Mesh or share client.
- **Bypassing the drop-in for checkout** — Payment Services PCI SAQ-A
  scope is only certified against the drop-in surface.

---

Generate the full HLD using `templates/HLD.md` as the master, populating
placeholders with stack-appropriate content from the guide above. When
container/technology decisions are still open, produce an ADR alongside
(see `resources/adr-templates/eds-commerce.md`).
