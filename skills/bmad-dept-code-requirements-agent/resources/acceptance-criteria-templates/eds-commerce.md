# Acceptance-criteria authoring guide — EDS + Commerce (hybrid)

This guide tells the LLM authoring pass **how to shape acceptance criteria**
for user stories on an EDS + Commerce hybrid BRD — Franklin/Helix blocks
composing Adobe Commerce drop-ins (`@dropins/storefront-*`) with the
Storefront Events SDK. Combine with `templates/ac-checklist.md`. Priority
tags map MoSCoW -> Summary contract (`MUST` / `SHOULD` / `COULD` / `WONT`).

## Given / When / Then structure (EDS + Commerce idioms)

- **Given** typically fixes *authoring state* (a Google Doc / SharePoint
  page contains a `Product` block table with a SKU), *SaaS backend state*
  (the SKU is indexed by Catalog Service and Live Search), *drop-in state*
  (`@dropins/storefront-pdp` is registered on `.pdp` block), or *events
  state* (Storefront Events SDK has subscribed).
- **When** covers *page load with drop-in hydration*, a *drop-in
  interaction* (Add-to-Cart), a *Storefront Events dispatch*, or a
  *GraphQL call to Catalog Service / Live Search*.
- **Then** targets *rendered DOM + hydrated drop-in state*, *Web Vitals
  metrics*, *event payload received by Analytics/Recommendations*, or
  *cart persistence in Adobe Commerce backend*.

## Types of AC for EDS + Commerce

### Functional AC
- Given a `Product` block table with a SKU column, when the page
  renders, then `@dropins/storefront-pdp` is initialized inside the
  block and populated from Catalog Service within one paint after
  fetch resolution.
- Given a shopper clicks Add-to-Cart on the PDP drop-in, when the
  request completes, then the cart drop-in in the mini-cart updates,
  a `cart/added` event is dispatched via Storefront Events SDK, and
  the cart persists via the Adobe Commerce cart API.
- Given a Live Search block with a query input, when the shopper
  submits a term, then the results block renders up to 24 results
  with facets (color, size) within 500ms of network response.
- Given `configs.js` provides `commerce-endpoint` + `commerce-store-view-code`,
  when a drop-in makes a GraphQL call, then the call carries the
  correct `Store` and `Content-Type` headers.
- Given a guest shopper completes checkout via the Adobe Payment
  Services drop-in, when payment succeeds, then an order is created
  in Adobe Commerce and a `checkout/purchased` event is dispatched.

### Non-functional AC
- LCP <= 2.5s at p75 on PDP with a hydrated drop-in (Web Vitals RUM).
- CLS <= 0.1 at p75; drop-in mount MUST reserve its layout box.
- Critical JS (load-eager + load-lazy + drop-in critical, gzip)
  <= 150KB. <!-- verify: hybrid-project budget -->
- Catalog Service GraphQL p95 <= 250ms (Adobe I/O observability).
- Storefront Events SDK event delivery success rate >= 99.5%.
- PCI-DSS scope: SAQ-A (all card data handled by Payment Services
  hosted fields — no PAN in the EDS bundle).

### Edge-case AC
- Given a SKU exists in Catalog but not yet indexed by Live Search,
  when the shopper searches, then no result appears (documented
  latency) and the miss is logged for the merchant.
- Given a drop-in mounts before the Storefront Events SDK is loaded,
  when an event is dispatched, then the SDK buffers and replays it
  after subscription.
- Given the shopper's cart contains an item that is now out-of-stock,
  when they open the cart drop-in, then the item shows an OOS badge
  and cannot progress to checkout.
- Given a Google Doc edit deletes a block cell, when the page
  publishes, then the drop-in falls back to a "content unavailable"
  state — never a JS error.
- Given the shopper is offline (Service Worker), when connectivity
  returns, then the local cart reconciles with the server cart
  without duplicating items.

### Security AC (STRIDE-inspired)
- Given a shopper opens the checkout drop-in, when card fields
  render, then they come from the Payment Services hosted-fields
  iframe — no PAN input in the EDS bundle DOM (keeps SAQ-A scope).
- Given consent-mode is `denied`, when the page loads, then no
  Analytics, Launch, or Recommendations calls fire until consent
  is granted.
- Given a GraphQL request from a drop-in, when the gateway inspects
  it, then it matches a persisted-query hash on the allowlist —
  no ad-hoc queries are executed.
- Given the storefront CSP evaluates, when scripts load, then
  `script-src` restricts to allowlisted origins (Commerce SaaS
  endpoints, Payment Services, Analytics collector, Launch).
- Given a shopper session token expires, when the drop-in retries a
  request, then it silently refreshes via IMS — never falls back
  to unauthenticated calls that leak customer data.

### Performance AC (measurable)
- **Lighthouse CI**: Performance >= 90 on the PDP; Best Practices
  >= 95.
- **Web Vitals RUM**: LCP p75 <= 2.5s, CLS p75 <= 0.1, INP p75
  <= 200ms on PDP + Cart + Checkout URLs over 28-day trailing.
- **Bundle analyzer**: total critical JS <= 150KB gzip; individual
  drop-in <= 60KB gzip.
- **Storefront Events SDK dashboard**: event delivery success
  >= 99.5%; latency p95 <= 2s.

### Testability guidance
- Unit: **Vitest / Jest + jsdom** for block `decorate()` + drop-in
  slot wiring.
- Integration: **Playwright** against a preview URL with real
  Catalog Service / Live Search endpoints (or MSW-mocked GraphQL).
- E2E: **Playwright** for full flows — browse -> PDP -> add-to-cart
  -> checkout — with visual snapshots per drop-in.
- Events: **@adobe/magento-storefront-events-sdk** test doubles;
  assert payload shape in an Analytics debug endpoint.
- Performance: **Lighthouse CI** + **WebPageTest** on PR preview.
- Reference `test-generation/eds-commerce.md`.

## Negative AC (what MUST NOT happen)
- Drop-ins MUST NOT be forked into the repo — extend via slot / event
  API only.
- The storefront JS bundle MUST NOT include a copy of the Catalog
  GraphQL schema (use persisted queries).
- Drop-ins MUST NOT be initialized in `loadEager` — they belong in
  `loadLazy` (post-LCP) unless they own the LCP element (rare).
- Storefront Events SDK MUST NOT dispatch events containing PII
  (email, phone, full name) — only structured commerce data.
- Card PAN MUST NEVER traverse the EDS bundle DOM (SAQ-A boundary).

## Testability check per AC
- [ ] Testable — framework + assertion.
- [ ] Measurable — concrete signal.
- [ ] Unambiguous — no interpretation gap.
- [ ] Independent — no undeclared prereq.
- [ ] Small — one behavior per AC.

## Common AC anti-patterns for EDS + Commerce
- "PDP should be fast" -> "PDP LCP p75 <= 2.5s (RUM, 28-day trailing)
  AND Catalog Service GraphQL p95 <= 250ms".
- "Add-to-cart should work" -> "Given a shopper clicks Add-to-Cart,
  When the request completes, Then mini-cart updates AND a
  `cart/added` event carries `sku`, `quantity`, `cartId`, `unitPrice`
  AND cart persists via Commerce cart API".
- "Search should be relevant" -> "Given a query `shoes`, When Live
  Search returns, Then top-24 include facets for `color` and `size`
  and response p95 <= 300ms".
- "Checkout should be secure" -> "Given the checkout drop-in loads,
  When card fields render, Then they come from Payment Services
  hosted-fields iframe and no PAN input exists in the EDS DOM".
