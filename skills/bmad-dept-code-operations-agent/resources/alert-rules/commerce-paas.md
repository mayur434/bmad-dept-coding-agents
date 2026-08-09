# Alert-rule authoring guide — Adobe Commerce (PaaS / Magento 2)

## Purpose framing

A Commerce PaaS alert rule pages the Commerce SRE, payment-ops engineer,
or merchant-support lead only when a **revenue-critical surface has
regressed past a quantified threshold** — checkout success, payment
gateway error rate, indexer health, admin availability — never for
single-datapoint noise on catalog re-index or cache warmup. Every rule
links to a runbook symptom in `resources/runbook-templates/commerce-paas.md`.
Segment by `store_view` and `website` — multi-store PaaS deployments
produce false positives when aggregated blindly.

## Alert catalog for Commerce PaaS — must-have rules

- **`commerce.checkout.success_rate.low`** — checkout success < 95% for 15 min → **P1** → runbook `#checkout-failure-spike`
  - Datadog: `avg(last_15m):100 * sum:magento.checkout.success{env:$env}.as_count() / sum:magento.checkout.attempt{env:$env}.as_count() < 95`
  - Prometheus: `100 * sum(rate(magento_checkout_success_total[15m])) / sum(rate(magento_checkout_attempt_total[15m])) < 95`
  - New Relic: `SELECT percentage(count(*), WHERE eventType='checkoutSuccess') FROM CheckoutEvent WHERE env='prod' SINCE 15 minutes ago`
- **`commerce.cart.p95.high`** — cart-page p95 > 2s for 10 min → **P2** → runbook `#cart-slowdown`
  - Datadog: `avg(last_10m):p95:magento.request.duration{route:checkout/cart, env:$env} > 2000`
  - Prometheus: `histogram_quantile(0.95, sum by (le) (rate(magento_request_duration_seconds_bucket{route="checkout/cart"}[10m]))) > 2`
- **`commerce.payment.gateway.error_rate.high`** — payment gateway error > 2% for 5 min → **P1** → runbook `#payment-gateway-errors`
  - Datadog: `sum(last_5m):100 * sum:magento.payment.error{env:$env}.as_count() / sum:magento.payment.attempt{env:$env}.as_count() > 2`
  - Prometheus: `100 * sum(rate(magento_payment_error_total[5m])) / sum(rate(magento_payment_attempt_total[5m])) > 2`
- **`commerce.indexer.stuck`** — any indexer status != `valid` for 30 min → **P2** → runbook `#indexer-stuck`
  - Datadog: `min(last_30m):magento.indexer.status{env:$env} by {indexer} < 1` (1 = valid, 0 = invalid) <!-- verify enum mapping -->
- **`commerce.admin.5xx.high`** — admin 5xx > 5% for 10 min → **P2** → runbook `#admin-outage`
- **`commerce.rabbitmq.consumer.lag.high`** — consumer lag > 5 min for 15 min → **P2** → runbook `#queue-lag`
  - Prometheus: `max_over_time(rabbitmq_queue_messages_unacked{queue=~".*commerce.*"}[15m]) > 1000`
- **`commerce.redis.frag_ratio.high`** — Redis fragmentation ratio > 1.5 for 30 min → **P3**
- **`commerce.mysql.slow_query.spike`** — slow-query count > 100/min for 10 min → **P2**
  - Datadog: `sum(last_10m):sum:mysql.performance.slow_queries{env:$env}.as_rate() > 100`
- **`commerce.fastly.hit_ratio.low`** — Fastly hit-ratio < 90% for 15 min → **P2**
- **`commerce.cron.overdue`** — any cron job > 15 min past schedule → **P2** → runbook `#cron-overdue`
  - New Relic: `SELECT latest(cronDelayMinutes) FROM CronMonitor WHERE env='prod' FACET jobCode`
- **`commerce.deploy.regressed`** — deploy_end + 10 min AND checkout_success < 95% → **P1**

## Alert severity mapping for Commerce PaaS

- **P1:** checkout success, payment gateway errors, deploy-triggered
  regression, order-placement 5xx. Revenue-blocking.
- **P2:** cart p95, admin 5xx, indexer stuck, RabbitMQ consumer lag, cron
  overdue, MySQL slow-query spike, Fastly hit-ratio.
- **P3:** Redis fragmentation, cache-warmer duration, log-error spikes on
  non-checkout routes.

## Alert-noise guidance for Commerce PaaS

- **All:** minimum 3-datapoint sustained window; no single-spike alerts.
- **Checkout success rate** should segment by `website_id` — a single
  regional store failing should not silence a broader outage; conversely,
  aggregated success rate hides per-store failures.
- **Catalog re-index alerts** should skip planned re-index windows (nightly
  full-reindex cron at 02:00 local by default).
- **Payment gateway errors** should exclude 3DS challenge redirects
  (which log as `error` but are expected auth flow).
- **Admin 5xx** should exclude bot / vuln-scan traffic (filter by
  `user_agent:!nikto|nmap`).
- **RabbitMQ consumer lag** should skip queue rebalance windows after
  deploy (first 5 min post-deploy).

## Composite / multi-signal alerts for Commerce PaaS

- **`commerce.checkout.degraded`** — `checkout_success < 95% AND payment_error > 1%`
  for 10 min → P1. Distinguishes payment outage from broader checkout regression.
- **`commerce.storefront.slow`** — `cart_p95 > 2s AND fpc_hit_ratio < 85% AND redis_latency > 50ms`
  for 10 min → P2. Rules out single-layer cache miss.
- **`commerce.write.stalled`** — `rabbitmq_lag > 5min AND mysql_write_qps < 50%_baseline`
  for 15 min → P1. Confirms write-path stall vs read-only outage.

## Alert deduplication / grouping for Commerce PaaS

- **Datadog:** group_by `env,website,store_view`; suppress duplicates within
  5 min per `service:commerce` scope.
- **Prometheus Alertmanager:** routes → `team-commerce-checkout` for
  checkout/payment; `team-commerce-catalog` for indexer/search;
  `team-commerce-platform` for infra (RabbitMQ, Redis, MySQL). `group_wait: 30s`.
- **PagerDuty:** merge on alert-key prefix `commerce.checkout.*` within
  15 min; separate services for `commerce.payment.*` (payment-ops) and
  `commerce.admin.*` (merchant-support).

## On-call escalation policy per Commerce PaaS

- **Primary (0 min):** on-call Commerce SRE (`@commerce-oncall`).
- **Secondary (10 min):** payment-ops for `payment.*`; merchant-support for
  `admin.*`; catalog-ops for `indexer.*`.
- **Tertiary (25 min):** Commerce tech lead → engineering manager.
- **Vendor (60 min):** Adobe Commerce support (Adobe Cloud infra issues) +
  payment gateway support (Stripe / Adyen / Braintree) with correlation ID.

## Alerting cadence / silences for Commerce PaaS

- **Silences during scheduled catalog re-index** — indexer alerts paused
  from 02:00–04:00 local (default cron); read from `.bmad/conventions.yaml`.
- **Silences during Fastly edge maintenance** — Fastly hit-ratio alerts
  paused during declared vendor maintenance windows.
- **Deploy-window silence** — checkout success + payment error alerts
  silenced from `deploy_start` to `deploy_start + 10m`; `commerce.deploy.regressed`
  fires past that boundary.
- **After-hours reduction for P3** — Redis frag, cache-warmer alerts
  delivery-only (Slack) between 20:00–08:00 local.

## 2 worked alert-rule examples for Commerce PaaS

### Example 1 — Checkout success regression (Datadog)

```yaml
name: "[prod] commerce — checkout success < 95% for 15 min"
type: query alert
query: 'avg(last_15m):100 * sum:magento.checkout.success{env:prod}.as_count() / sum:magento.checkout.attempt{env:prod}.as_count() < 95'
message: |
  Checkout success dropped below 95% for 15 min.
  Runbook: RUNBOOK-commerce-paas.md#checkout-failure-spike
  @pagerduty-commerce-oncall @slack-commerce-checkout
tags: [service:commerce, env:prod, tier:frontend, severity:sev1]
priority: 1
monitor_thresholds: { critical: 95, warning: 97 }
notify_no_data: true
no_data_timeframe: 10
```

### Example 2 — RabbitMQ consumer lag (Prometheus)

```yaml
- alert: CommerceRabbitConsumerLag
  expr: max_over_time(rabbitmq_queue_messages_unacked{queue=~".*commerce.*"}[15m]) > 1000
  for: 15m
  labels: { severity: sev2, team: commerce-platform }
  annotations:
    summary: "RabbitMQ queue {{ $labels.queue }} > 1000 unacked messages"
    runbook: "runbooks/commerce-paas.md#queue-lag"
```

## Anti-patterns to avoid for Commerce PaaS

- **Paging on cache-miss alone** — page on cache-miss AND origin-error
  composite (Fastly + origin 5xx).
- **Alerting on aggregated multi-store success rate** — a single failing
  store view can drag down the number without a real outage; segment.
- **Static thresholds on catalog re-index duration** — full-reindex time
  scales with catalog size; use % change from 7-day baseline.
- **Paging on `bin/magento maintenance:enable`** — planned maintenance
  should silence, not fire.
- **No `x-request-id` or `correlation-id` in the alert message** — Commerce
  supports request-tracing; include it for payment / order correlation.

---

Generate the full alert-rules file using the appropriate `templates/alerts-<target>.yaml` as the master, populating placeholders with stack-appropriate content from the guide above.
