# User-story authoring guide — EDS + Commerce hybrid

This guide tells the LLM authoring pass **how to shape user stories** for
an EDS + Commerce hybrid BRD — Edge Delivery Services for content pages
composing Adobe Commerce SaaS drop-ins on product / cart / checkout /
account routes. Combine with `templates/user-story.md` as the master
single-story skeleton.

## INVEST criteria (stack-specific interpretation)

- **Independent** — each drop-in ships independently by design; EDS
  blocks that host them should too. A cart-drop-in extension should not
  force a checkout-block redeploy.
- **Negotiable** — leave room to swap an Adobe-provided drop-in for a
  headless React component on a given route if the TTI budget is
  missed.
- **Valuable** — value expressed to a Shopper, Content Editor, or
  Storefront Block Developer — not "the drop-in".
- **Estimable** — team can size once the EDS block boundary, drop-in
  extension pattern, and `configs.js` per-environment wiring are agreed.
- **Small** — one EDS block hosting one drop-in with a single
  Storefront-Events subscription is fine; adding a Live Search facet
  on top is another story.
- **Testable** — Jest + jsdom for block logic, Playwright for storefront
  smoke, drop-in extension-point contract tests, Storefront Events SDK
  payload assertions, Lighthouse CI for CWV + drop-in TTI budgets.

## Stack-specific personas

- **Storefront block developer** — writes decorate blocks that mount
  `@dropins/storefront-*` web components, wires Storefront Events SDK,
  balances EDS bundle discipline with drop-in TTI.
- **Merchandiser** — Catalog Service, Live Search rules, Product
  Recommendations. Same persona as commerce-saas.
- **Content editor** — authors non-commerce pages in Google Docs;
  publishes via Sidekick.
- **Consumer / shopper** — browses content + commerce interchangeably.
- **RUM / perf owner** — CWV separately for content-only and commerce
  routes.

## Story shape

`As a {{PERSONA}}, I want {{CAPABILITY}}, so that {{BENEFIT}}`

Realistic titles per persona:

- Block developer — "host the cart drop-in in the `cart-block` with
  Storefront Events subscribed", "wire the checkout drop-in
  `configs.js` per environment", "gate the drop-in load behind the
  consent banner".
- Merchandiser — "boost sale items on the PLP composed of Live Search
  facets", "surface Product Recommendations on the PDP block".
- Content editor — "author a landing page mixing content blocks and a
  Product Recommendations block".
- Shopper — "add to cart on the PDP without a page reload", "check
  out on `/checkout` under a 3.5s TTI on mid-tier mobile".
- RUM owner — "compare LCP p75 between content-only and commerce
  routes on the RUM dashboard".

## Story splitting patterns for EDS+Commerce

- **Per drop-in surface** — cart, checkout, PDP, account, order-history
  each in their own story with their own block.
- **Block vs drop-in extension** — the EDS block that hosts a drop-in
  is one story; extending the drop-in via a slot is another.
- **Storefront Events subscription vs handler** — subscribing to an
  event is one story; the analytics/tag/CRM handler is another.
- **`configs.js` per environment** — sandbox / stage / prod wiring
  splits from the feature story.
- **Consent-mode gating** — gating drop-in load behind consent is a
  cross-cutting story separate from the drop-in feature.
- **Live Search rule vs UI surfacing** — merchandising rule ships
  separately from the block that renders the facet.
- **Eager vs lazy phase move** — moving a drop-in from lazy to eager
  (or vice-versa) is its own performance-focused story.

## Effort estimation guidance

- **S (~1 day)** — add a Storefront Events subscription in an existing
  block; add a Live Search synonym.
- **M (~2-3 days)** — new EDS block hosting one drop-in with
  `configs.js` wiring + Jest tests.
- **L (~1 sprint)** — new checkout flow composing multiple drop-ins
  with cross-drop-in event choreography + consent-mode gating.
- **XL (>1 sprint, split)** — greenfield PLP composing Live Search
  facets + Catalog Service + Product Recommendations across multiple
  blocks.

**Estimation anti-patterns**
- Loading a drop-in in the eager phase — TTI budget missed and LCP
  regressed.
- Ignoring block-CSS vs drop-in shadow-DOM interactions.
- Underestimating consent-mode plumbing (events + tags + drop-in
  gates + per-market copy).

## Ready-for-dev checklist

- [ ] Drop-in wired via Storefront Events (never DOM polling).
- [ ] Cart / checkout event contract confirmed with drop-in owner.
- [ ] `configs.js` deltas per environment documented (endpoints,
      feature flags).
- [ ] SRI hash + `crossorigin="anonymous"` planned for any new
      `@dropins/*` script tag.
- [ ] Consent-mode gating decision made for the new route.
- [ ] Drop-in TTI budget declared in AC.
- [ ] Block CSS budget respected (drop-in shadow-DOM does not leak
      styles).
- [ ] LCP-critical images identified even on drop-in-heavy routes.
- [ ] helix-query / Catalog Service data source identified for any
      list block.
- [ ] Payment Services SRI + PCI-scope note included where checkout is
      touched.

## Example user stories for EDS+Commerce

### STORY-001: Cart block hosts cart drop-in with events

**As a** storefront block developer
**I want** an EDS `cart-block` that mounts `@dropins/storefront-cart`
and forwards Storefront Events to Adobe Analytics
**So that** the cart page ships on EDS with cart drop-in behavior and
funnel telemetry.

**Priority**: MUST | **Effort**: M | **Parent epic**: EPIC-1 Cart UX
**Dependencies**: `configs.js` for cart endpoint (STORY-004)
**AC**:
- Given `/cart` is loaded, when the block runs in the lazy phase, then
  the cart drop-in mounts within 500ms of block init.
- Given a shopper updates quantity, when the drop-in fires
  `cart-updated`, then Adobe Analytics receives a matching event with
  `sku`, `qty`, `subtotal`.
- Given the drop-in bundle >60KB gzipped, then CI fails the build.

### STORY-002: Checkout drop-in TTI <=3.5s on Moto-G-class

**As a** shopper
**I want** the `/checkout` page interactive within 3.5s on a mid-tier
mobile
**So that** I complete checkout without dropping off.

**Priority**: MUST | **Effort**: L | **Parent epic**: EPIC-2 Checkout perf
**AC**:
- Given a cold-load on emulated Moto-G-class, when Lighthouse runs,
  then TTI <=3.5s on `/checkout`.
- Given the checkout drop-in loads, then Payment Services scripts have
  SRI + `crossorigin="anonymous"`.
- Given consent is denied, then no analytics scripts fire on
  `/checkout`.

### STORY-003: Consent-mode gate for commerce routes

**As a** compliance owner
**I want** cart / checkout / account drop-ins gated behind consent-mode
**So that** EU shoppers do not have events fired before opt-in.

**Priority**: MUST | **Effort**: M | **Parent epic**: EPIC-3 Privacy
**AC**:
- Given a shopper visits `/cart` from an EU IP, when the consent banner
  is shown, then no `add-to-cart` / `cart-updated` events fire until
  consent is granted.
- Given consent is granted mid-session, then subsequent events fire
  normally.
- Given consent is withdrawn, then subsequent events are suppressed
  within one navigation.

## Anti-patterns to avoid

- "As a developer, I want to load drop-ins in the eager phase" —
  breaks LCP and TTI budgets.
- "As a shopper, I want the checkout to be smooth" — no target, no
  device, no route.
- "As a merchandiser, I want the storefront to convert better" —
  unmeasurable; specify facet / boost / rec-slot.
- "As a compliance owner, I want privacy" — no market, no consent
  vendor, no event list.
- Bundling drop-in mount + `configs.js` + Storefront Events +
  consent-mode + Live Search rule into one story.

## Story-title formulation

Good:
- "Cart block hosts cart drop-in with events"
- "Checkout drop-in TTI <=3.5s on Moto-G-class"
- "Consent-mode gate for commerce routes"

Bad:
- "Drop-in on EDS" — no route, no drop-in named, no phase.
- "Faster checkout" — no metric, no device.
- "Live Search work" — no facet, no boost, no route.
