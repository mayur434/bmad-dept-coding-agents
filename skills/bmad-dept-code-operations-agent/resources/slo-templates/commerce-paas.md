# SLO authoring guide — Adobe Commerce PaaS (Magento 2)

## Purpose framing

SLOs for Adobe Commerce PaaS establish **revenue-critical reliability
targets** — checkout, cart-total, PDP-add-to-cart, payment gateway — the
paths where a percentage-point of failure maps directly to lost orders.
They anchor the error-budget policy Cloud release manager consults
before deploying Composer patches, and they define the burn-rate
thresholds that page `@commerce-oncall`. Admin and reporting surfaces
get separate, looser SLOs — those are internal users, not revenue.

## SLI catalog for Commerce PaaS — what to measure

Each SLI is measured over a rolling 28-day window; `good_events / valid_events` formula.

- **Checkout success rate** — `(orders successfully placed) / (checkout attempts reaching `place-order`)`. Source: New Relic transaction trace + `sales_order` DB. Excludes user-abandoned carts.
- **Cart-total latency p95** — 95th-percentile duration for `POST /rest/V1/carts/mine/totals`. Source: New Relic APM.
- **Payment gateway availability** — `(payment authorizations succeeding) / (total payment authorization attempts)`. Excludes user-declined cards; includes gateway 5xx/timeouts.
- **Catalog page availability (PDP + PLP)** — `(2xx responses) / (total requests)` at Fastly edge for `/catalog/*` and `/*.html` product URLs.
- **Admin login latency p95** — 95th-percentile duration for `POST /admin/backend/index/login`. Internal user surface.
- **Search response availability** — `(2xx responses from Live Search / Elasticsearch queries) / (total search queries)`.
- **Indexer freshness** — `(indexers in `Ready` state) / (13 total indexers)` sampled every 5 minutes (from `bin/magento indexer:status`).

## SLO targets per tier for Commerce PaaS

| SLI | T1 target | T2 target | T3 target |
|-----|-----------|-----------|-----------|
| Availability | 99.9% | 99.5% | 99% |
| Checkout p95 | ≤ 1.5s | ≤ 3s | ≤ 5s |
| Cart-total p95 | ≤ 800ms | ≤ 1.5s | ≤ 3s |
| Payment gateway availability | 99.95% | 99.9% | 99.5% |
| Admin login p95 | ≤ 1s | ≤ 2s | ≤ 5s |
| Indexer freshness | 100% | 99% | 95% |

Checkout + payment default to T1 (revenue-critical). Catalog is typically T1 for high-traffic B2C, T2 for B2B. Admin and reporting are T3.

## Error-budget policy for Commerce PaaS

- **Budget window** — 28-day rolling; peak-season (BFCM) may use 7-day window with tightened targets, documented in `.bmad/conventions.yaml`.
- **Burn-rate thresholds** — fast burn (2%/1h → P1 page), slow burn (5%/6h → P2 ticket), catastrophic (10%/15min → P1 + auto-freeze).
- **Freeze policy** — when checkout availability budget < 25%, all non-reliability Composer patches frozen. Payment-gateway budget < 50% triggers exec review. BFCM code-freeze is separate + additive.
- **Rollback triggers** — cross-reference `release-plans/commerce-paas.md#rollback-triggers`. Fast-burn on checkout within 15min of a deploy auto-triggers the rollback playbook.
- **Escape hatches** — planned maintenance windows tagged `maintenance:true` excluded. Payment gateway partner outages (documented in vendor incident channel) drop from availability budget with SRE sign-off within 24h.
- **Governance** — SRE + payment-eng lead + product-owner sign-off on any target change; recorded in `.bmad/decisions.yaml`.

## Multi-window burn-rate alerts for Commerce PaaS

| SLO | Fast-burn (1h/2%) | Slow-burn (6h/5%) | Total-burn (24h/10%) |
|-----|-------------------|-------------------|---------------------|
| Checkout availability | P1 page `@commerce-oncall` | P2 ticket | P2 ticket |
| Cart-total p95 | P2 page | P2 ticket | P3 warn |
| Payment gateway availability | P1 page + payments-eng | P2 ticket | P2 ticket |
| Catalog availability | P2 page | P3 ticket | P3 warn |
| Admin login | P3 ticket | P3 warn | Info |

See `resources/alert-rules/commerce-paas.md` for underlying queries.

## SLI measurement per platform for Commerce PaaS

- **New Relic (Adobe Cloud default)** — checkout success: `SELECT percentage(count(*), WHERE name='OrderController_savePayment' AND httpResponseCode < 400) FROM Transaction SINCE 28 days ago`; cart p95: `SELECT percentile(duration, 95) FROM Transaction WHERE name LIKE '%cart%totals%'`.
- **Datadog** — availability: `sum:magento.orders.success.count.as_count() / sum:magento.orders.attempts.count.as_count()`; latency: `p95:magento.cart.totals.duration`. <!-- verify metric names -->
- **Prometheus** — via `magento_exporter`: `sum(rate(magento_checkout_success_total[28d])) / sum(rate(magento_checkout_attempts_total[28d]))`. <!-- verify: no first-party exporter -->
- **Fastly logs** — authoritative for catalog-page availability at edge; ship logs to Datadog / Splunk with `req.url ~ ^/(catalog|.*\.html)` filter.

## Stakeholder + review cadence for Commerce PaaS

- **Owner** — payment-eng team (checkout + payment); catalog-eng (PDP/PLP); commerce-platform team (admin + indexers).
- **Reviewer** — SRE / DevOps team; Adobe Cloud release manager.
- **Consumer** — product-owner (revenue), engineering-manager, VP of digital commerce.
- **Review cadence** — weekly SLO status; pre-BFCM tightened-target review (Sep); quarterly SLO review; annual policy review.

## 2 worked SLO examples for Commerce PaaS

### Example 1: `checkout-service` (T1 — revenue-critical)

- Tier: T1
- SLIs: Checkout success (99.9%), Checkout p95 (≤ 1.5s), Payment gateway availability (99.95%).
- SLOs: 99.9% / 43m budget / 28d; p95 ≤ 1.5s / 28d; payment availability ≥ 99.95%.
- Budget policy: fast-burn → page `@commerce-oncall` + `@payments-eng` + halt deploy.
- Current-state (baseline): 99.92% checkout success last 28d, budget 20% remaining (close to freeze), p95 1.4s, 1 P2 incident (Stripe timeouts).

### Example 2: `catalog-service` (T2 — high-traffic browse)

- Tier: T2
- SLIs: PDP + PLP availability (99.5% at edge), cart-total p95 (≤ 1.5s), search availability (99.5%).
- SLOs: 99.5% / 3.6h budget / 28d; cart p95 ≤ 1.5s; search availability ≥ 99.5%.
- Budget policy: slow-burn → ticket catalog-eng; freeze non-catalog changes when budget < 25%.
- Current-state: 99.7% edge availability, cart p95 1.2s, search availability 99.6%.

## Anti-patterns to avoid for Commerce PaaS

- **Coupling checkout SLO to payment-gateway SLO.** The gateway is a dependency; declare it as a separate SLI so its outages are attributed correctly and don't hide Magento's own issues.
- **Using edge-hit availability as the checkout SLO.** Checkout is dynamic; measure at the origin (`sales_order` DB row created) not at Fastly.
- **Single availability SLO across all admin + storefront.** Admin outages don't lose revenue; separate SLOs let admin-only regressions ship without blocking storefront.
- **Static SLO through BFCM.** Peak-season traffic 5-10× baseline; either tighten targets or move to 7-day window with a BFCM addendum.
- **SLO based on Magento cron success.** Cron jobs are internal orchestration; measure the user-facing symptom (indexer freshness, order-email delivery) not the mechanism.

---

Generate the full SLO document using `templates/slo.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `alert-rules/commerce-paas.md` for burn-rate alert wiring.
