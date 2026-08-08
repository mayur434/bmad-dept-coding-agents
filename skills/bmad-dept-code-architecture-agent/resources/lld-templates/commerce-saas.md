# LLD authoring guide — Adobe Commerce SaaS (ACCS / Catalog Service + Drop-ins)

## Purpose framing

An Adobe Commerce SaaS LLD establishes **storefront-block internals** and
**drop-in extension internals**: Catalog Service query shape, drop-in
slot registration, event-bus subscription, and any App Builder
extension that composes with the drop-in on the storefront. It pins the
**data-source contract** (Catalog / Live Search / Product Recs), the
**rendering-target** (server vs client), and the **PCI/PII posture**
(no card data — payment SDKs render iframes).

## Typical component types + when to LLD each

- **Storefront block** — EDS-style block or React component; consumes
  drop-in APIs; owns DOM + CSS scope; lazy-loaded by block loader.
- **Drop-in extension** — slot-based override (`slots` config); custom
  UI insertions via `Slot.add()`; state subscription via `initializers`.
- **Drop-in initializer** — bootstraps drop-in on the page; wires
  `event-bus`; injects config via `<meta>` tags.
- **Catalog Service query** — GraphQL query against
  `https://catalog-service.adobe.io/graphql`; batched via drop-in cache.
- **Live Search query** — search + facets via Live Search GraphQL; scoped
  by view.
- **App Builder Runtime extension** — external service composed via
  Commerce API Mesh (see `app-builder.md` LLD).
- **Event subscription** — Adobe I/O Events (`com.adobe.commerce.observer.*`)
  handler in App Builder.

## Class / module diagram shape for Commerce SaaS

JS module dep graph (Mermaid `flowchart`) showing ES module `import`
edges: block → drop-in package (`@dropins/storefront-cart`) → event-bus.
Highlight boundary between customer-owned code (block) and Adobe-owned
drop-in (versioned via npm).

```mermaid
flowchart LR
  Block[blocks/loyalty.js] -->|import| Cart[@dropins/storefront-cart]
  Block -->|import| Bus[@dropins/tools/event-bus]
  Block -->|initializer| Cart
  Cart -->|GraphQL| CatalogSvc[Catalog Service]
```

## API surface template for Commerce SaaS

- **Block** — exported `decorate(block, config)`; DOM contract; CSS
  classes it owns.
- **Drop-in extension** — table columns: `Slot name | Position (before/
  after/replace) | Handler | Props contract`.
- **GraphQL** — table columns: `Query | Args | Cache TTL | Depth |
  Complexity budget`.

## Data-model shape per Commerce SaaS

- **Catalog Service fields** — reference schema in
  `commerce-services/catalog-service` docs; identify used fields per
  block (SKU, price, image, custom attributes).
- **Product custom attribute** — via Commerce Admin (`admin/catalog/product_attribute`);
  propagates to Catalog Service via sync connector.
- **Client-side state** — drop-in `event-bus` topics
  (`cart/updated`, `checkout/complete`); no direct DOM state sharing.
- **No owned persistent data** — SaaS storefront is stateless; state
  belongs to Commerce backend or drop-in-local IndexedDB.

## Sequence-diagram conventions

Participants: `Browser`, `EDS Edge`, `Drop-in`, `CatalogService`,
`CommerceAdmin`, `PaymentSDK`. Show:

- **Happy path — PDP render** — browser → edge (HTML) → drop-in
  initializer → Catalog Service GraphQL → render.
- **Error 1 — catalog miss (SKU not in index)** — GraphQL returns null
  → drop-in emits `product/not-found` → block renders 404 state.
- **Error 2 — checkout tokenization failure** — payment SDK returns
  error → drop-in surfaces field-level message → no order created.

## Error handling patterns per Commerce SaaS

- Drop-ins expose `errorHandler` in initializer config; log + telemetry
  event; **never** display raw GraphQL errors to shopper.
- GraphQL partial failure (`data + errors`): render available fields,
  log missing.
- Fail-open on recommendations block; fail-closed on price
  (never display stale price).
- Payment tokenization errors: surface field-level; never retry
  automatically (customer intent).
- Client-side retry with `p-retry` for transient network only (5xx);
  never on 4xx.

## Observability per Commerce SaaS

- **RUM** — Adobe Commerce Storefront RUM (helix-rum-enhancer if EDS
  hybrid); Core Web Vitals per block.
- **Client logs** — drop-in `@dropins/tools/logger`; ship to Adobe
  Analytics or Splunk via Launch tag.
- **Server-side** — Catalog Service + Live Search have Adobe-managed
  observability; customer sees availability dashboards only.
- **Alerts** — LCP regression, cart-error rate > 0.5%, checkout abandon
  rate spike.

## Test approach per Commerce SaaS

- **Unit** — Vitest / Jest with jsdom for block logic + drop-in mocks.
- **Drop-in test harness** — `@dropins/testing` (mock event-bus,
  initializer). <!-- verify: package name -->
- **Integration** — Playwright E2E; test with sandbox Catalog Service.
- **Contract** — Mock Service Worker (MSW) for GraphQL responses.
- Coverage target: 70% on block code; drop-ins tested by Adobe.

## Configuration + feature flags per Commerce SaaS

- **Storefront config** — `<meta>` tags in EDS document / block config
  attributes; loaded by initializer.
- **Environment** — `commerce-endpoint`, `commerce-view-code`,
  `commerce-store-code` meta tags per env.
- **Feature flags** — LaunchDarkly / Split.io client SDK; block-level
  gating via config attributes.
- **Drop-in version pin** — package.json exact version; upgrade via PR.

## Deployment considerations per Commerce SaaS

- **EDS hybrid** — git-based publish; instant rollback via revert.
- **Drop-in upgrade** — semver bump in package.json; regression sweep in
  preview env; version-lock in prod for 24h soak.
- **Catalog sync** — indexer runs in Commerce backend; changes take
  minutes to appear in Catalog Service.
- **Zero-downtime** — SaaS is always-on; block changes deploy per branch.

## 2 worked LLD outline examples for Commerce SaaS

**LLD-CSAAS-01: LoyaltyBadgeBlock (PDP badge)**
- Type: EDS block, decorates PDP hero.
- Contract: reads SKU from URL, calls Catalog Service for `loyalty_tier`
  attribute.
- API: `decorate(block, {sku})`; emits `loyalty/badge/shown` event.
- Errors: attr missing → hide badge; network fail → hide + log.
- Tests: Vitest with mocked GraphQL, Playwright PDP.

**LLD-CSAAS-02: CartLoyaltyDropinExtension**
- Type: drop-in extension on `@dropins/storefront-cart`.
- Slot: `Cart.Summary`, position `after`.
- Contract: subscribes `cart/updated`, computes points, renders row.
- Errors: compute fail → hide row silently, log.
- Tests: `@dropins/testing` harness; snapshot cart states.

## Anti-patterns to avoid for Commerce SaaS

- Forking a drop-in instead of extending via slots — breaks upgrade path.
- Direct fetch to Commerce Admin GraphQL from storefront — bypasses
  Catalog Service caching; brittle.
- Storing PII in localStorage — GDPR issue; use secure Commerce session.
- Blocking main thread in `decorate()` — hurts LCP; defer non-critical.
- Rendering price from stale Live Search doc — always confirm at cart.

---

Generate the full LLD using `templates/LLD.md` as master, populating
placeholders with stack-appropriate content from the guide above.
Cross-reference the HLD (`resources/hld-templates/commerce-saas.md`) for
parent-context.
