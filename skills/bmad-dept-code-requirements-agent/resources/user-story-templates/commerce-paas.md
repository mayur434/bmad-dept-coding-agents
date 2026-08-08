# User-story authoring guide — Adobe Commerce (PaaS / Magento 2)

This guide tells the LLM authoring pass **how to shape user stories** for
an Adobe Commerce PaaS (Magento 2) BRD. Combine with
`templates/user-story.md` as the master single-story skeleton.

## INVEST criteria (stack-specific interpretation)

- **Independent** — stories should not couple to an external ERP release
  cadence, a payment-gateway config change, or a schema migration on
  another module. Wire integration contracts via the message queue so
  either side can ship independently.
- **Negotiable** — leave room for the DI decision (plugin vs preference
  vs observer) to shift based on the eventual upgrade path.
- **Valuable** — value expressed to a Shopper, Merchandiser, Admin, or
  Integrator — not "the developer".
- **Estimable** — the team can size only when `di.xml` layer,
  `db_schema.xml` deltas, and store-view / customer-group scope are
  agreed.
- **Small** — one GraphQL resolver + one plugin + one admin UI column is
  fine; adding a new indexer as well is too big — split the indexer.
- **Testable** — every story is testable with PHPUnit for the module,
  MFTF for functional end-to-end, GraphQL schema tests, and Cypress or
  Playwright for storefront smoke.

## Stack-specific personas

- **Shopper (B2C or B2B)** — browses catalog, adds to cart, checks out.
- **Merchant / merchandiser** — manages catalog, promotions, pricing.
- **Store admin / customer-service** — orders, refunds, RMA.
- **Third-party integrator** — ERP / OMS / tax / fraud / payment wiring.

## Story shape

`As a {{PERSONA}}, I want {{CAPABILITY}}, so that {{BENEFIT}}`

Realistic titles per persona:

- Shopper — "save my address for one-click checkout", "see stock status
  per size on the PDP", "pay in EUR when I'm on the DE store view".
- Merchandiser — "schedule a promo rule active only on the FR store
  view", "apply a tiered price to the gold customer group".
- Admin — "search orders by PO number", "issue a partial credit-memo
  from the order timeline".
- Integrator — "consume `sales_order_place_after` events on a Kafka
  bridge", "extend the GraphQL `products` schema with an ERP-sourced
  `leadTime` field".

## Story splitting patterns for Commerce PaaS

- **Store-view / website scope** — split by scope when translation +
  legal review differ across markets.
- **Customer-group scope** — one story for guest, one for B2B customer
  group when pricing / catalog visibility rules diverge.
- **DI graph layer** — split by frontend controller vs plugin vs
  observer vs cron; each has its own test surface.
- **GraphQL schema vs resolver** — schema addition + type is one story;
  resolver + data-fetch is another when the resolver depends on
  downstream integration.
- **Cart vs checkout** — mini-cart, cart page, checkout are separately
  testable — split by page-level feature.
- **Admin UI vs storefront** — the admin form is a separate story from
  the storefront rendering.
- **Sync vs async** — a synchronous validation is one story; the async
  message-queue consumer that follows is another.

## Effort estimation guidance

- **S (~1 day)** — add a custom attribute to `product` via
  `InstallData` / declarative schema; add a column to an admin listing.
- **M (~2-3 days)** — new plugin on a service contract with unit tests +
  a GraphQL schema addition surfacing it.
- **L (~1 sprint)** — new checkout step (JS + LayoutProcessor plugin +
  totals collector + payment-method filter + MFTF suite).
- **XL (>1 sprint, split)** — full custom module for PIM ingestion with
  message queue topology, custom indexers, and admin UI.

**Estimation anti-patterns**
- Underestimating `db_schema.xml` migration rollout time in production.
- Ignoring the cascading cost of an `around` plugin on a hot service
  method.
- Forgetting `indexer` re-index time on category-tree changes.

## Ready-for-dev checklist

- [ ] `di.xml` declaration reviewed (plugin vs preference vs virtual
      type).
- [ ] `db_schema.xml` patch reviewed if data-model changes; whitelist
      updated.
- [ ] `webapi.xml` route or GraphQL resolver spec agreed with API
      consumers.
- [ ] Store-view + customer-group scope confirmed.
- [ ] Indexer impact assessed (which `MView` subscriptions are dirtied).
- [ ] Message queue topics + consumers listed (`queue.xml` deltas).
- [ ] PCI scope impact reviewed for any change touching cart / checkout.
- [ ] i18n strings identified + added to `i18n/en_US.csv`.
- [ ] Admin ACL resource declared if new admin surface.
- [ ] MFTF test entities + fixtures identified.

## Example user stories for Commerce PaaS

### STORY-001: Save-my-address for one-click checkout

**As a** registered shopper
**I want** to save my shipping address after my first checkout
**So that** future checkouts complete in one click.

**Priority**: MUST | **Effort**: M | **Parent epic**: EPIC-1 Checkout UX
**Dependencies**: customer-address service contract, checkout `LayoutProcessor`.
**AC**:
- Given a logged-in shopper checks the "save address" box, when the order
  is placed, then the address is persisted to `customer_address` and
  visible in My Account.
- Given a returning shopper reaches shipping-step, when a saved address
  is on file, then it is pre-selected.

### STORY-002: DE-only EUR promo rule

**As a** merchandiser
**I want** a promo rule scoped to the DE store view charging EUR
**So that** German-market pricing stays isolated from US $USD promos.

**Priority**: SHOULD | **Effort**: S | **Parent epic**: EPIC-2 Promotions
**AC**:
- Given the DE store view is active, when a matching cart is priced, then
  the promo discount is applied in EUR at the configured rate.
- Given a shopper switches to US store view mid-session, then the promo
  is no longer applied.

### STORY-003: Kafka bridge for `sales_order_place_after`

**As an** integrator
**I want** `sales_order_place_after` published to Kafka `commerce.orders`
**So that** downstream ERP + fraud services consume asynchronously.

**Priority**: MUST | **Effort**: L | **Parent epic**: EPIC-3 Async ERP
**Dependencies**: Kafka broker provisioned; `queue_publisher.xml` extended.
**AC**:
- Given an order is placed, when the observer fires, then a JSON envelope
  matching schema `commerce.orders.v1` is published to Kafka within 5s.
- Given the Kafka producer times out, then the order still commits and a
  retry is enqueued via `queue.xml`.

## Anti-patterns to avoid

- "As a developer, I want to override `SalesRule\Model\RulesApplier`" —
  implementation, not user value.
- "As a shopper, I want the site to be fast" — no target, no store-view
  scope, no measurable AC.
- "As an admin, I want a report" — no report name, no columns, no
  frequency.
- Bundling checkout + cart + mini-cart + admin form into one story.

## Story-title formulation

Good:
- "Save-my-address for one-click checkout"
- "DE-only EUR promo rule"
- "Kafka bridge for `sales_order_place_after`"

Bad:
- "Checkout improvements" — vague, no owner.
- "Refactor sales module" — no shopper / admin value.
- "Fix pricing" — no scope, no store view, no test surface.
