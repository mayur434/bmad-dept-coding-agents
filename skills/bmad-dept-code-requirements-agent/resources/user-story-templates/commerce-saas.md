# User-story authoring guide — Adobe Commerce SaaS (ACCS + drop-ins)

This guide tells the LLM authoring pass **how to shape user stories** for
an Adobe Commerce SaaS (ACCS / Catalog Service / Live Search / drop-ins)
BRD. Combine with `templates/user-story.md` as the master single-story
skeleton.

## INVEST criteria (stack-specific interpretation)

- **Independent** — drop-ins ship independently by design; stories should
  respect that. A cart-drop-in change should not force a checkout-drop-in
  redeploy.
- **Negotiable** — leave room to choose between the Adobe-provided drop-in
  and a headless React equivalent for a given surface.
- **Valuable** — value expressed to a Shopper, Merchandiser, or Drop-in
  Developer — never "the platform".
- **Estimable** — team can size only when Catalog Service field mapping,
  Live Search rule scope, and drop-in extension point are agreed.
- **Small** — one drop-in slot + one `configs.js` change + one Storefront
  Events subscription is fine; adding a Live Search facet on top is a
  separate story.
- **Testable** — Jest for logic, Playwright for storefront smoke, drop-in
  extension-point contract tests, Storefront Events SDK payload
  assertions.

## Stack-specific personas

- **Storefront consumer (shopper)** — browses drop-in storefront,
  searches via Live Search.
- **Drop-in developer** — composes storefronts from
  `@dropins/storefront-*`; wires Storefront Events SDK.
- **Merchandiser** — Live Search rules, synonyms, boosts; Catalog
  Service through the Admin.
- **Integrator / architect** — headless topology, Payment Services vs
  third-party checkout.

## Story shape

`As a {{PERSONA}}, I want {{CAPABILITY}}, so that {{BENEFIT}}`

Realistic titles per persona:

- Shopper — "add to cart without a full page reload", "see stock
  availability per size in the PDP drop-in", "check out via Apple Pay in
  the Payment Services drop-in".
- Drop-in developer — "extend the cart drop-in with a PO-number field",
  "wire Storefront Events `add-to-cart` to Adobe Analytics", "consume
  `configs.js` for the Payment Services endpoint per environment".
- Merchandiser — "boost sale items to top of a Live Search category",
  "add `sneaker` synonym for `trainer` in Live Search".
- Integrator — "compose Live Search facets into a headless PLP", "gate
  the checkout drop-in behind consent-mode for GDPR markets".

## Story splitting patterns for Commerce SaaS

- **Per drop-in surface** — cart, checkout, PDP, account, order-history
  are each independently deployable and independently testable.
- **Extension point vs slot** — extending an existing drop-in slot is one
  story; adding a Storefront Events subscription is another.
- **Live Search rule vs UI surfacing** — the rule (boost / synonym /
  redirect) is one story; the UI change that exposes the facet is
  another.
- **Catalog Service field vs display** — a new custom attribute is one
  story; the drop-in template change that renders it is another.
- **`configs.js` per environment** — sandbox / stage / prod wiring can be
  split from the feature story.
- **Consent-mode integration** — gating events behind consent is a
  cross-cutting story separate from the underlying event addition.
- **Fastly edge cache rule vs application-level cache** — split by cache
  tier.

## Effort estimation guidance

- **S (~1 day)** — add a Storefront Events subscription with a single
  handler; add a Live Search synonym.
- **M (~2-3 days)** — extend a drop-in slot with a custom field +
  Jest tests + Storybook story.
- **L (~1 sprint)** — new checkout surface composing multiple drop-ins
  with cross-drop-in event choreography.
- **XL (>1 sprint, split)** — greenfield PLP with Live Search facets +
  Catalog Service integration + Product Recommendations placement.

**Estimation anti-patterns**
- Ignoring the drop-in independent-update contract when adding shared
  code — leads to coupling.
- Underestimating consent-mode plumbing (events + tags + drop-in gates).
- Missing PCI-scope impact when swapping Payment Services for a custom
  hosted checkout.

## Ready-for-dev checklist

- [ ] Catalog Service field mapping confirmed (source attribute,
      transform, destination surface).
- [ ] Live Search facet / synonym / boost impact reviewed with merch.
- [ ] Drop-in extension pattern chosen (slot vs event vs configs.js).
- [ ] Storefront Events SDK event name + payload schema versioned.
- [ ] `configs.js` deltas per environment documented.
- [ ] Consent-mode gating decided for the new surface.
- [ ] SRI hash + `crossorigin="anonymous"` planned for any new
      `@dropins/*` script tag.
- [ ] Fastly edge-cache rule impact reviewed.
- [ ] Analytics / RUM validation plan for the new event.

## Example user stories for Commerce SaaS

### STORY-001: PO-number field on the cart drop-in

**As a** B2B shopper
**I want** to enter a purchase-order number in the cart drop-in
**So that** my company can reconcile the order to the PO.

**Priority**: MUST | **Effort**: M | **Parent epic**: EPIC-1 B2B checkout
**Dependencies**: cart drop-in >= v1.3.0 (has the `additional-fields` slot).
**AC**:
- Given the cart drop-in is mounted, when I open the `additional-fields`
  slot, then a labeled PO-number input is rendered.
- Given a PO number is entered, when I proceed to checkout, then the
  value is persisted through the checkout drop-in and lands on the order.

### STORY-002: Live Search boost for sale items

**As a** merchandiser
**I want** items with `is_sale=true` boosted to the top of Live Search
category pages
**So that** promotional items get preferential visibility.

**Priority**: SHOULD | **Effort**: S | **Parent epic**: EPIC-2 Merchandising
**AC**:
- Given a category page loads, when Live Search returns results, then
  items with `is_sale=true` appear before non-sale items of the same
  relevance bucket.

### STORY-003: Storefront Events `add-to-cart` -> Analytics

**As a** drop-in developer
**I want** the `add-to-cart` Storefront Event forwarded to Adobe
Analytics
**So that** funnel reporting reflects real cart activity.

**Priority**: MUST | **Effort**: S | **Parent epic**: EPIC-3 Telemetry
**Dependencies**: Adobe Launch property published; consent-mode wired.
**AC**:
- Given consent is granted, when a shopper adds a product to the cart,
  then an `add-to-cart` event fires to Analytics with `sku`, `qty`,
  `price` within 300ms.
- Given consent is denied, then no event is emitted.

## Anti-patterns to avoid

- "As a developer, I want to fork the checkout drop-in" — forks lose the
  upgrade path; use extension points.
- "As a shopper, I want the storefront to feel fast" — no measurable
  budget; add TTI or LCP.
- "As a merchandiser, I want better search" — vague; specify facet /
  synonym / boost / redirect.
- Bundling `configs.js` wiring + drop-in extension + Live Search rule
  into one story.

## Story-title formulation

Good:
- "PO-number field on the cart drop-in"
- "Live Search boost for sale items"
- "Storefront Events `add-to-cart` -> Analytics"

Bad:
- "Drop-in improvements" — no scope, no persona.
- "Refactor Catalog Service" — no shopper / merch value.
- "Fix checkout" — no drop-in named, no failure mode described.
