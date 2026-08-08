# BRD authoring guide — Adobe Commerce (PaaS / Magento 2)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a BRD for an Adobe Commerce PaaS (Magento 2)
project. Combine with `templates/BRD.md` as the master skeleton.

## Stack-specific personas

- **Shopper (B2C or B2B)** — browses catalog, adds to cart, checks out,
  tracks orders. Pain: slow catalog pages, checkout drop-off on payment
  step, out-of-sync stock.
- **Merchant / merchandiser** — manages catalog, categories, promotions,
  price rules via the Magento Admin. Pain: slow catalog re-index, missing
  attribute-set tooling, promo-rule regressions.
- **Store admin / customer-service** — manages orders, refunds, customer
  accounts, RMA. Pain: order-search latency, missing order-timeline
  granularity.
- **Third-party integrator** — wires ERP / OMS / tax / fraud / payment.
  Pain: undocumented event topology, breaking schema changes on Magento
  upgrades.

## Stack-specific in-scope patterns

- Catalog structure (categories, attribute sets, attribute groups, EAV
  attributes vs. flat tables).
- Cart / mini-cart / checkout flows (single-page checkout, multi-shipping).
- Order lifecycle (state / status machine, invoice, shipment, credit-memo).
- Custom module scaffolding under `app/code/<Vendor>/<Module>/`.
- `di.xml` wiring — `preference`, `plugin` (before/after/around), virtual
  types, argument injection.
- GraphQL schema extension (`schema.graphqls`, resolver classes).
- REST / SOAP web-API (`webapi.xml`, service contracts).
- Message queue topology (`queue.xml`, `communication.xml`,
  `queue_publisher.xml`, `queue_topology.xml`, `queue_consumer.xml`).
- Admin UI components (`ui_component/*.xml`, listing/form/columns).
- Store views + customer groups for segmented catalog / pricing / content.
- Payment / shipping methods via `Magento_Payment` / `Magento_Shipping`.

## Stack-specific out-of-scope patterns

- Direct `SELECT` / `UPDATE` against Magento tables — always use
  Repositories / Collections.
- Modifying `vendor/magento/*` — use `plugin` or `preference` in your
  custom module.
- Blocking the checkout thread with synchronous third-party calls — use
  the message queue.
- Hardcoded credentials in `env.php` — use environment variables +
  Magento Cloud secrets.
- Custom auth on GraphQL that bypasses Magento's customer token store.
- Extending `SalesRuleQuote` behavior via observer chains — prefer
  plugins on the `Magento\SalesRule\Model\RulesApplier`.

## Stack-specific NFRs

**Performance**
- Catalog category-listing page TTFB <= 200ms (Full Page Cache hit).
- Product page LCP p75 <= 2.5s.
- Add-to-cart p95 <= 500ms.
- Checkout step-transition p95 <= 800ms.
- GraphQL simple-query p95 <= 300ms; complex-query p95 <= 1500ms.
- Catalog re-index (single store view) <= 15 min on a warm database.
- Cache-warmup on deploy <= 10 min for the top-100 category pages.

**Availability**
- Storefront SLO 99.95% monthly (peak season).
- Admin SLO 99.5% monthly.
- Message-queue consumer lag <= 500 msgs on any topic during steady state.

**Security**
- **PCI-DSS scope**: SAQ-A when using redirect / iframe payment integration
  (Adobe Payment Services, Braintree Hosted Fields), SAQ-D-Merchant when
  card data touches the Commerce server.
- Admin RBAC + 2FA required (Magento_TwoFactorAuth module).
- Admin session cookie `HttpOnly` + `Secure` + `SameSite=Strict`.
- CSP header locked down; disallow inline `<script>` on storefront where
  possible.
- All secrets via env vars, never `env.php` in the repo.

**Data**
- Order write must be transactional across sales / inventory tables.
- Index freshness SLO: <= 5 min for schedule-based indexers.
- DB replication lag (primary -> read replica) <= 30s.

## Stack-specific integration points

| System | Direction | Notes |
|---|---|---|
| Payment gateway (Braintree / Adyen / Stripe / PayPal / Klarna) | outbound | via `Magento_Payment` |
| ERP (SAP / NetSuite / Dynamics / Oracle) | bidirectional | orders out, catalog + inventory in |
| OMS | bidirectional | order routing + fulfillment sync |
| Tax engine (Vertex / Avalara) | outbound | real-time quote + document commit |
| Fraud (Signifyd / Kount / Riskified) | outbound | pre-authorization risk score |
| Search backend (Elasticsearch / OpenSearch / Live Search) | outbound | catalog indexing |
| CRM (Salesforce / HubSpot / Dynamics) | bidirectional | customer sync |
| Marketing (Adobe Campaign / Marketo / Klaviyo) | outbound | order + cart events |
| PIM (Akeneo / Salsify) | inbound | catalog attribute source of truth |
| Adobe Commerce Cloud | inbound | hosting + build/deploy for Adobe Commerce Cloud tier |

## Stack-specific success KPIs

- Storefront conversion rate (delta vs. baseline).
- Cart abandonment rate at checkout.
- Median time-to-first-order for new registered customers.
- p95 checkout-completion latency.
- Message-queue consumer lag steady-state median.
- Admin catalog-update round-trip latency.

## Stack-specific risks

- **PCI scope creep** — a "quick" payment integration that starts touching
  card data and expands the SAQ.
- **Plugin cascade** — multiple `around` plugins on the same method causing
  N+1 wraps and unpredictable performance.
- **Indexer stall** — a bad `MView` subscription causing all downstream
  indexers to fall behind.
- **Message-queue backlog** — a consumer crash silently piling up async
  work (email, ERP sync).
- **Upgrade drift** — customizations in `vendor/magento/*` blocking a
  patch upgrade.

## Stack-specific compliance

- **PCI-DSS** — scope reduction via SAQ-A preferred (redirect / iframe
  payment). SAQ-D-Merchant only when necessary.
- **GDPR / CCPA** — customer data-export + right-to-be-forgotten flows;
  cookie consent surface.
- **PSD2 / SCA** — 3DS2 challenge flow via the payment gateway.
- **WCAG 2.2 AA** on storefront and — where applicable — on the customer
  My-Account surface.
- Adobe Commerce Cloud contractual SLA of 99.99% infrastructure
  availability. <!-- verify: current SLA for your tier -->

## Example BRD sections for Adobe Commerce PaaS

**Executive summary example.**
> The B2B storefront relaunch consolidates 4 legacy sites onto a single
> Adobe Commerce PaaS instance with per-store-view content, per-customer-
> group pricing, and shared inventory. Success is measured as: (1) cart-to-
> checkout completion +5pp vs. baseline, (2) checkout p95 <= 800ms measured
> at the storefront edge, (3) ERP order-write consumer lag steady-state
> <= 100 msgs.

**In-scope example.**
> Custom module `Acme_Checkout` extending the default single-page checkout
> with an inline PO-number capture, a customer-group-scoped payment-method
> filter, and a real-time tax quote via Vertex. Message queue topology
> extension for asynchronous ERP order dispatch (`acme.order.sync` topic).
> Admin UI listing for the new `sales_order` grid column showing PO status.

**NFR example.**
> **NFR-Perf-3** — GraphQL `products` query with 20 items and 4 filter
> facets MUST complete within 300ms p95 measured at the storefront edge.
> Parent BR: BR-2 (search latency). MoSCoW: MUST.

---

Generate the full BRD using `templates/BRD.md` as the master skeleton,
populating placeholders with stack-appropriate content from the guide above.
