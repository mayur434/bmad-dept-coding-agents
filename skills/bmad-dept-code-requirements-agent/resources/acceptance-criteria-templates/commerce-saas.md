# Acceptance-criteria authoring guide — Adobe Commerce SaaS

This guide tells the LLM authoring pass **how to shape acceptance criteria**
for user stories on an Adobe Commerce SaaS BRD (Catalog Service, Live
Search, drop-ins). Combine with `templates/ac-checklist.md`. Priority tags
map MoSCoW -> Summary contract (`MUST` / `SHOULD` / `COULD` / `WONT`).

## Given / When / Then structure (Commerce SaaS idioms)

- **Given** typically fixes *SaaS data-plane state* (a product exists in
  Catalog Service with SKU `X`, indexed in Live Search), *drop-in state*
  (`@dropins/storefront-cart` initialized with a `cartId`), or *event
  state* (a `product/click` event was previously dispatched).
- **When** covers a *storefront drop-in interaction* (click, add-to-cart),
  a *Storefront Events SDK dispatch*, or a *GraphQL query* against Catalog
  Service / Live Search.
- **Then** targets *rendered drop-in HTML*, *event payload received by
  Analytics/consumer*, or *GraphQL response shape* — never a `sales_order`
  row on a self-hosted DB (there is no self-hosted DB).

## Types of AC for Commerce SaaS

### Functional AC
- Given a product with SKU `24-MB01` is indexed by Catalog Service, when
  the PDP renders, then the price shown matches the Catalog Service
  `priceRange.minimum.final.amount.value` within 1s of first render.
- Given `@dropins/storefront-cart` is mounted, when the user clicks
  Add-to-cart, then a `cart/added` event is dispatched via Storefront
  Events SDK with `sku`, `quantity`, `cartId`, `unitPrice`.
- Given a Live Search query for "shoes", when the shopper submits, then
  results include facets (`color`, `size`) and the first 24 items load
  within one paint after the fetch resolves.
- Given Payment Services is configured, when the shopper enters card
  details in the hosted-fields iframe, then no card PAN reaches the
  storefront JS bundle.
- Given a `@dropins/storefront-account` drop-in is mounted, when the
  shopper logs in via Adobe IMS, then subsequent GraphQL calls carry a
  bearer token and the drop-in shows the customer's order history.

### Non-functional AC
- LCP <= 2.5s at p75 on the PDP (Web Vitals RUM, 28-day trailing).
- CLS <= 0.1 at p75 on category + PDP.
- Drop-in bundle size budget: individual drop-in <= 60KB gzip; combined
  storefront critical JS <= 150KB gzip. <!-- verify: current Adobe budgets -->
- Storefront Events SDK event delivery success rate >= 99.5% (Adobe
  Analytics ingestion).
- Live Search response p95 <= 300ms (GraphQL).

### Edge-case AC
- Given `@dropins/storefront-cart` is mounted before the Events SDK is
  loaded, when a `cart/added` event is dispatched, then it is buffered
  and re-emitted after the SDK subscribes.
- Given a product exists in Catalog but is not yet indexed by Live Search,
  when a shopper searches, then it does not appear (documented latency)
  and the missing-index is logged for the merchant.
- Given the shopper's cart drop-in loads offline (Service Worker), when
  connectivity returns, then the local cart reconciles with the server
  cart without duplicate items.
- Given a Catalog Service response omits an optional `image`, when the
  PDP renders, then a placeholder image is emitted (never a broken tag).

### Security AC (STRIDE-inspired)
- Given a GraphQL query includes a persisted-query hash unknown to the
  gateway, when the request is processed, then the response is 400 and
  no ad-hoc query is executed (persisted-query allowlist).
- Given the storefront loads a third-party script (recommendations widget),
  when the CSP evaluates, then only allowlisted origins are permitted
  (`script-src` includes explicit hosts, no `unsafe-inline`).
- Given a customer session token expires, when the drop-in retries a
  request, then it refreshes the IMS token silently before retry — never
  falls back to unauthenticated calls that leak customer-specific data.
- Given a shopper's session, when Analytics events fire, then no PII
  (email, phone, full name) is included in event payloads.
- Given consent-mode is `denied`, when the shopper browses, then no
  Analytics or Recommendations calls are made until consent is granted.

### Performance AC (measurable)
- Catalog Service PDP GraphQL p95 <= 250ms (measured from Adobe I/O
  observability).
- Live Search category browse p95 <= 300ms.
- Homepage LCP <= 2.5s at p75 on mobile via WebPageTest / CrUX.
- Drop-in hydration TTI <= 3s on Slow 3G Lighthouse throttle.

### Testability guidance
- Unit: **Vitest / Jest + jsdom** for drop-in wrappers and event helpers.
- Integration: **Playwright** against a preview environment with real
  Catalog Service / Live Search endpoints (or MSW-mocked GraphQL).
- E2E: **Playwright** with visual-regression snapshots per drop-in.
- Performance: **Lighthouse CI** + WebPageTest RUM.
- Events: **@adobe/magento-storefront-events-sdk** test doubles.
- Reference `test-generation/commerce-saas.md`.

## Negative AC (what MUST NOT happen)
- The storefront MUST NOT ship a copy of the Catalog GraphQL schema to
  the client (use persisted queries).
- Drop-ins MUST NOT be forked into the repo — extend via the published
  slot / event API only.
- The storefront bundle MUST NOT include `@adobe/magento-storefront-events-sdk`
  more than once (dedupe check in bundle analyzer).
- Storefront JS MUST NOT call self-hosted Magento admin APIs — SaaS mode
  has no admin surface.
- Analytics events MUST NOT be dispatched before consent is granted when
  consent-mode is enabled.

## Testability check per AC
- [ ] Testable — framework identified.
- [ ] Measurable — concrete signal.
- [ ] Unambiguous — no interpretation gap.
- [ ] Independent — no hidden AC dependency.
- [ ] Small — one behavior per AC.

## Common AC anti-patterns for Commerce SaaS
- "Search should be fast" -> "Live Search category browse p95 <= 300ms
  measured at the GraphQL edge".
- "Drop-ins should be responsive" -> "PDP CLS <= 0.1 at p75 (RUM)".
- "Analytics should track everything" -> "Given a `cart/added` event,
  When the SDK dispatches, Then Adobe Analytics receives payload with
  `sku`, `quantity`, `cartId`, `unitPrice` (Analytics debug console)".
- "Storefront should be secure" -> "Given CSP evaluation, When a script
  loads, Then `script-src` matches the allowlist and no `unsafe-inline`
  is permitted".
