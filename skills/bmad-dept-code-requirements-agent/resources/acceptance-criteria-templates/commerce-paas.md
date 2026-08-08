# Acceptance-criteria authoring guide — Adobe Commerce (PaaS / Magento 2)

This guide tells the LLM authoring pass **how to shape acceptance criteria**
for user stories on an Adobe Commerce PaaS BRD. Combine with
`templates/ac-checklist.md`. Priority tags map MoSCoW -> the 15-column
Summary contract (`MUST` / `SHOULD` / `COULD` / `WONT`).

## Given / When / Then structure (Commerce idioms)

- **Given** typically fixes *customer + store-view + product state* (a
  logged-in customer on `default` store-view with a configurable product
  in-stock), *cart state* (empty / with items / with a coupon), or *admin
  state* (a store-admin with `Sales/Order` ACL).
- **When** covers a *storefront action* (add-to-cart, submit checkout, PDP
  render), an *admin action* (create order, edit product), or a *GraphQL
  mutation / REST call* (`POST /rest/V1/carts/mine/order`).
- **Then** targets an *observable outcome* (`sales_order` row created,
  page HTML rendered, GraphQL response payload, message in the RabbitMQ
  queue, index re-scheduled).

## Types of AC for Commerce PaaS

### Functional AC
- Given a guest shopper on `default` store-view, when they POST
  `mutation { createEmptyCart }`, then a masked cart-id is returned and a
  `quote` row exists with `is_active=1` and `customer_id=NULL`.
- Given a logged-in customer with a Vault token and a shippable address,
  when they place an order via `placeOrder`, then a `sales_order` row is
  created with `state=processing`, no card details are captured to logs,
  and the customer's Vault card is charged via Braintree/Adyen/Stripe.
- Given an admin edits a configurable product's SKU, when they save, then
  a full re-index of `catalog_product_price` and `catalogsearch_fulltext`
  is queued (not run synchronously in the admin request).
- Given a store-view `de_DE` exists, when a PDP renders for a translated
  product, then price is formatted per locale (`19,99 EUR`) and the
  `<html lang>` attribute is `de-DE`.
- Given a coupon `SPRING10` is active for customer group `Retail`, when a
  `Wholesale` customer applies it, then the response is a validation error
  and `sales_rule_coupon_usage.times_used` does not increment.

### Non-functional AC
- Storefront TTFB p95 <= 200ms for a cached PDP (Fastly HIT).
- `placeOrder` mutation p95 <= 800ms end-to-end (New Relic transaction).
- Catalog re-index SLA: partial index completes <= 5 minutes after admin
  save; full index <= 2 hours nightly. <!-- verify: customer's actual SLA -->
- PCI-DSS scope: SAQ-A retained (no card data ever touches the Magento
  application container; tokenized via gateway hosted-fields only).
- Admin RBAC: 2FA mandatory on every admin user; role permissions
  reviewed quarterly.

### Edge-case AC
- Given a product is out of stock mid-checkout, when the shopper clicks
  `Place Order`, then the checkout returns a stock-error, the cart is
  preserved, and no `sales_order` row is created.
- Given a shopper has both a cart-rule discount and a coupon, when both
  apply to overlapping line items, then discounts stack per the configured
  `stop_rules_processing` flag and the total is idempotent under refresh.
- Given the payment gateway times out after auth but before capture, when
  the retry job runs, then the order transitions to `state=payment_review`
  and no duplicate capture is attempted.
- Given a shopper's shipping ZIP has no configured rate, when they view
  the shipping step, then the UI shows "No shipping options" and blocks
  progression.

### Security AC (STRIDE-inspired)
- Given an unauthenticated request to `/rest/V1/customers/me`, when the
  API processes it, then it responds 401 with `WWW-Authenticate: Bearer`.
- Given a POST to `/admin/*` without a valid form-key, when Magento
  processes it, then the response is 403 (CSRF defense).
- Given a search string with SQL metacharacters, when the storefront
  runs the catalog search, then the query uses prepared statements
  (no string concatenation) and no error message leaks the SQL.
- Given a shopper attempts to view another customer's order via
  `/sales/order/view/order_id/<other>`, when the ACL evaluates, then it
  responds 404 (not 403 -- do not confirm existence).
- Given a payment method form loads, when the DOM is inspected, then
  card fields are served from the gateway's iframe/hosted-fields — no
  raw PAN input in the Magento DOM (keeps SAQ-A scope).
- Given a new admin extension is installed, when composer resolves it,
  then no bundle with a known CVE (Magento Security Scan) is present.

### Performance AC (measurable)
- `curl -sw '%{time_total}' https://<host>/catalog/product/view/id/123`
  <= 0.2s p95 on Fastly HIT; <= 0.8s p95 on Fastly MISS.
- GraphQL `placeOrder` p95 <= 800ms measured across 200 concurrent
  virtual users in Gatling.
- Fastly hit-ratio on catalog pages >= 85% over any 24h window.
- Index queue drain latency <= 60s p95 (Magento indexer + RabbitMQ).

### Testability guidance
- Unit: **PHPUnit** (`vendor/bin/phpunit -c dev/tests/unit`) for Blocks /
  Models / Helpers.
- Integration: **Magento Integration Tests** (`dev/tests/integration`)
  with a real DB for API and repository behavior.
- Functional: **MFTF (Magento Functional Testing Framework)** for
  storefront + admin flows.
- API: **REST-assured** or Postman/Newman collections in CI.
- Performance: **Gatling** or **k6** against staging; Fastly RUM for
  edge behavior.
- Reference `test-generation/commerce-paas.md` in the DCA suite.

## Negative AC (what MUST NOT happen)
- Cart total MUST NOT include tax before the ship-to address is entered
  (unless `tax/calculation/based_on = shipping_origin`).
- Order total MUST NOT change between the review step and the placed
  order (idempotency of `quote` -> `sales_order` conversion).
- Custom code MUST NOT write to `core_config_data` at runtime from a
  storefront controller.
- Custom modules MUST NOT bypass `catalogProductRepository` -- direct
  SQL against `catalog_product_entity` breaks index refresh.
- A custom payment method MUST NOT log raw PAN, CVV, or full track data
  under any log verbosity.

## Testability check per AC
- [ ] Testable — framework + assertion identified.
- [ ] Measurable — concrete pass/fail signal.
- [ ] Unambiguous — no interpretation gaps.
- [ ] Independent — no prerequisite AC unless declared.
- [ ] Small — one behavior per AC.

## Common AC anti-patterns for Commerce PaaS
- "Checkout should work" -> "Given a logged-in customer with Vault token,
  When they POST `placeOrder`, Then response=200 and `sales_order`
  row exists with `state=processing`".
- "The site should be secure" -> "Given a request without form-key to any
  `/admin/*` route, When Magento processes it, Then response=403".
- "Reindex should be fast" -> "Partial index for `catalog_product_price`
  completes <= 5 minutes after admin save (queue drain)".
- "PDP should render nicely on mobile" -> "PDP LCP <= 2.5s on Slow 3G
  throttle (Lighthouse mobile preset)".
