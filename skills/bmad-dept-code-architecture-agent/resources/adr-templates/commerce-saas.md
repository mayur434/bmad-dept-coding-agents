# ADR authoring guide — Adobe Commerce SaaS

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an ADR for an Adobe Commerce SaaS project
(Catalog Service / Live Search / Payment Services + storefront drop-ins).
Combine with `templates/ADR.md` as the master skeleton.

## Stack-specific decision categories

- **Drop-in vs Custom block** — extend the Adobe drop-in
  (`@dropins/storefront-*`) via slots and CSS, or replace with a bespoke
  block driven by the same GraphQL surface.
- **Catalog Service vs Live Search for facets and filtering** — Catalog
  Service is the source of truth for structured queries; Live Search is
  the ranked-search + faceting layer with ML relevance.
- **Storefront-events wiring** — direct drop-in emit consumed by Launch
  vs a custom event bus vs Storefront Events SDK forwarding to Adobe
  Experience Platform.
- **API Mesh vs direct GraphQL** — API Mesh composes multiple sources
  (Catalog Service, Live Search, PIM, ERP) into one GraphQL endpoint;
  direct calls keep latency low but push composition to the client.
- **PIM integration** — CS-native Data Connect from PIM vs middleware
  transform via API Mesh vs direct feed.
- **Auth model** — anonymous storefront, IMS-authenticated backoffice,
  session-token exchange to Payment Services.
- **Consent-mode integration** — where consent state lives, how it's
  propagated to Storefront Events + Launch + Ads pixels.
- **Middleware placement** — API Mesh handler vs App Builder action vs
  external service for business logic drop-ins can't handle.

## Common constraints (stack-specific)

- **No `app/code`** — cannot modify Catalog Service, Live Search, or
  Payment Services; only the storefront and any middleware built on API
  Mesh / App Builder are yours.
- **Drop-ins are extension-only** — public API of `@dropins/storefront-*`
  is stable; deep customization requires forking, which loses upgrades.
- **Event-schema versioning** — Storefront Events SDK payloads follow a
  contract; downstream consumers (Launch, custom analytics) must handle
  version bumps.
- **Edge caching** — content behind the CDN; cache-key composition drives
  hit ratio.
- **Core Web Vitals** budget same as EDS (LCP <= 2.5s, INP <= 200ms,
  CLS <= 0.1) — drop-in JS budget is critical.
- **PII / GDPR** boundary — Storefront Events must redact PII before
  forwarding.
- **Multi-region** deployment implicit — Catalog Service is
  Adobe-operated; middleware you add must respect region.
- **Rate limits** on Catalog Service / Live Search GraphQL. <!-- verify:
  current published limits -->

## Common alternatives (stack-specific)

### Drop-in extension
- **Drop-in slot + CSS-only** — safest; Adobe upgrades ship transparently.
- **Drop-in slot + custom component in slot** — moderate risk; Adobe API
  changes may require rewire.
- **Fork the drop-in** — full control; forfeits Adobe updates.
- **Bespoke block on the same GraphQL surface** — highest control;
  duplicate work every time Adobe extends the drop-in.

### Facet + search
- **Live Search** — ML-ranked search + facets; managed relevance; ships
  storefront widget.
- **Catalog Service** — precise structured queries; no ML ranking; useful
  for PLP with strict filter fidelity.
- **Hybrid** — Live Search for search-bar / auto-complete; Catalog Service
  for category PLPs.
- **Third-party (Algolia / Klevu)** — vendor lock-in; may not integrate
  with Payment Services / drop-ins natively.

### Composition (API Mesh vs direct)
- **API Mesh** — single GraphQL endpoint; server-side composition; adds
  one hop of latency; centralized auth.
- **Direct drop-in → Catalog Service** — lowest latency; client
  composition; multiple round-trips for cross-source queries.
- **API Mesh + App Builder middleware** — for business logic beyond
  composition (pricing overrides, entitlement checks).

### Storefront-events integration
- **Storefront Events SDK → Launch data layer** — turnkey; Launch
  extensions consume.
- **Storefront Events SDK → custom bus → Analytics** — bypasses Launch;
  useful when Launch not adopted.
- **Storefront Events SDK → Experience Platform (AEP)** — for real-time
  segmentation; needs AEP subscription.

## Decision drivers for Commerce SaaS

- **LCP p75** on top-N landing pages and PDPs.
- **Drop-in bundle size** budget — the total JS on the critical path.
- **Time-to-market** — SaaS pushes you to the standard drop-ins for
  fastest launch.
- **Catalog Service / Live Search rate limits** vs peak QPS.
- **PII / GDPR** consent posture — Storefront Events wiring and Launch
  extension approval.
- **Adobe upgrade cadence** for the drop-ins — every custom override
  becomes an upgrade tax.
- **Multi-region** and cross-market pricing.
- **PIM integration** cadence (real-time vs batch) — drives Data Connect
  vs middleware choice.
- **B2B needs** — Company / Quote / Requisition-List are still evolving
  on SaaS <!-- verify: SaaS B2B feature parity -->.
- **Team JS depth** — modern React/Vite/Vanilla-JS skew.
- **Payment Services** capability set (Apple Pay / Google Pay / Klarna).

## Worked ADR examples for Commerce SaaS

**ADR-061 — Extend `@dropins/storefront-pdp` via slots only; no forking.**
- **Context.** Merchandising needs a swatch preview + a size-guide
  drawer on the PDP; both are visual customizations, not domain logic.
- **Options.** (A) Slot + custom slot component, (B) Fork the drop-in,
  (C) Bespoke PDP block.
- **Decision.** (A). The PDP drop-in already exposes `PurchaseOptions`
  and `AttributeGuide` slots; both features fit. Rationale: keeps Adobe
  upgrades free; team ships in one sprint.
- **Consequences.** + upgrades stay transparent, – any future feature
  outside slot boundaries needs a new ADR, – slot API may add
  breaking changes across major versions.

**ADR-062 — API Mesh in front of Catalog Service + PIM.**
- **Context.** The storefront needs product data with PIM-managed
  editorial content (rich descriptions, spec tables, campaign copy) merged
  into one query; drop-ins expect a single GraphQL source.
- **Options.** (A) Client composes (drop-in fetches Catalog + PIM
  separately), (B) API Mesh handler stitches, (C) Middleware service on
  App Builder returning GraphQL.
- **Decision.** (B) API Mesh. Handler composes `productSearch` (Catalog
  Service) + PIM REST via mesh-handler-openapi. Rationale: single
  endpoint for drop-ins; server-side composition = one client round-trip;
  auth stays in mesh.
- **Consequences.** + drop-ins unchanged, + composition centralized,
  – +50ms server-side stitching, – PIM API budget consumed via mesh.

**ADR-063 — Storefront Events SDK → Launch data layer for analytics.**
- **Context.** Analytics team standardized on Launch; drop-ins emit
  `data-layer:*` events via the Storefront Events SDK.
- **Options.** (A) Launch extension consumes SDK events, (B) Custom bus
  → Analytics directly, (C) SDK → AEP.
- **Decision.** (A) Launch extension. Rationale: aligns with enterprise
  Launch strategy; the Adobe-provided Storefront Events Launch extension
  covers the standard event set with no bespoke code.
- **Consequences.** + zero custom mapping code, + consent-mode
  compatible via Launch, – locked to Launch's event schema, – AEP
  ingestion (if needed later) requires a second wire.

## Anti-patterns to avoid for Commerce SaaS

- **Forking a drop-in for a slot-shaped requirement** — loses Adobe
  updates; slot the customization instead.
- **Direct client calls to both Catalog Service and Live Search from the
  same page** — leads to duplicate product data and inconsistent facets;
  compose in mesh or pick one per page.
- **Wiring Storefront Events directly to third-party pixels** — bypasses
  consent-mode; every pixel becomes a compliance surface.
- **Assuming SaaS features track PaaS 1:1** — feature parity gaps exist
  (B2B, some payment flows); confirm before designing on them.
- **Forgetting PII redaction in Storefront Events consumers** — GDPR
  liability; redact in the SDK config or in the API Mesh handler.

---

Generate the full ADR using `templates/ADR.md` as the master, populating
placeholders with stack-appropriate content from the guide above.
