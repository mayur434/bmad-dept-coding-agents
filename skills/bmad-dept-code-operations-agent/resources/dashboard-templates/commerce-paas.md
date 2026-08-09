# Dashboard authoring guide — Adobe Commerce PaaS (Magento 2)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a dashboard for Adobe Commerce PaaS (Magento 2 on
Adobe Cloud). Combine with the appropriate `templates/dashboard-<target>.{json,yml}`
as the master skeleton.

## Purpose framing

An Adobe Commerce dashboard is watched by store-ops, the Commerce tech
lead, and the on-call SRE — often during a sale or promotion. It must
surface **revenue-critical paths first** (checkout + cart + PDP), expose
**indexer / consumer / cache state** (the three subsystems that most often
regress silently), and correlate **Fastly edge → Magento origin → MySQL /
Redis** so a single latency spike can be attributed in one glance. Admin
and storefront are different concerns — do not merge them onto one panel.

## Signal catalog for Commerce PaaS

### Golden signals (RED / USE)

- **Latency** — checkout `p95`, cart-total `p95`, PDP `p95` at Fastly edge.
- **Traffic** — storefront RPS, checkout completions/min, admin RPS.
- **Errors** — payment-gateway error rate, admin-auth failure rate,
  storefront `5xx`, PHP fatal-error log rate.
- **Saturation** — PHP-FPM active workers vs max, MySQL connection usage,
  Redis memory %, RabbitMQ queue depth per consumer.

### Stack-native signals

- **Fastly cache hit-ratio** per surface (PDP / category / static) — the
  dominant success metric; a 10-point drop shifts load to origin.
- **Indexer status** per index (product, price, stock, category, search) —
  `Reindex Required` in prod is a fire.
- **RabbitMQ consumer lag** per queue (`async.operations.all`, `sales.rule.*`).
- **Redis session-store latency** + `evicted_keys` count.
- **MySQL slow-query count** (>1s) + replica lag.
- **Cron heartbeat freshness** — stalled `cron_schedule` = downstream breakage.
- **New Relic Apdex** for `catalog/product/view` + `checkout/index`. <!-- verify: current NR transaction names -->
- **Order-placement success rate** (business SLI — orders/min vs baseline).

## Widget catalog for Commerce PaaS

- **Checkout p95 latency (Fastly edge)** (timeseries with SLO marker at 1s / t2)
  - Datadog: `avg:magento.checkout.duration.p95{env:$env, store_view:$store_view}` <!-- verify -->
  - NRQL: `SELECT percentile(duration, 95) FROM Transaction WHERE name='WebTransaction/Magento2/checkout/onepage/index' AND env='prod' TIMESERIES`
  - Alert cross-ref: `resources/alert-rules/commerce-paas.md#checkout-p95-breach`
- **Order-placement success rate** (query_value + SLO band)
  - NRQL: `SELECT count(*) FROM MagentoOrder WHERE status='complete' FACET env TIMESERIES` <!-- verify -->
- **Payment-gateway error rate per provider** (top-list)
  - Datadog: `top(sum:magento.payment.error{env:$env} by {provider}.as_count(), 10, 'sum', 'desc')`
- **Fastly cache hit-ratio per surface** (timeseries)
  - Datadog: `100 * sum:fastly.hits{service:$service, surface:$surface}.as_count() / sum:fastly.requests{service:$service, surface:$surface}.as_count()`
- **Indexer status per index** (table — text status per row)
  - Custom check emitting `magento.indexer.status{index=~"product|price|stock|category|search"}`
- **RabbitMQ consumer lag per queue** (heatmap / timeseries)
  - PromQL: `rabbitmq_queue_messages_ready{queue=~"async.*|sales.*"}`
- **Redis memory used + evicted keys** (timeseries — dual axis)
  - PromQL: `redis_memory_used_bytes` + `rate(redis_evicted_keys_total[5m])`
- **MySQL slow-query count (>1s)** (timeseries)
  - PromQL: `rate(mysql_global_status_slow_queries[5m])`
- **PHP-FPM active workers vs max** (timeseries with saturation marker at 80%)
- **Cron heartbeat freshness** (query_value — seconds since last `cron_schedule.executed_at`)
- **Admin login roundtrip p95** (timeseries — separate concern from storefront)
- **Deploy markers + last cloud-cli deploy status** (event_stream — from Adobe Cloud)

## Template variables for Commerce PaaS

- Common: `env`, `service`, `region`
- Commerce-specific: `store_view` (e.g. `default`, `us_en`), `website_scope`,
  `admin_scope` (yes/no), `indexer_name`, `queue_name`, `payment_provider`,
  `cloud_project_id`.

## Dashboard layout for Commerce PaaS

- **Row 1 — Health-at-a-glance:** checkout p95 ≤ 1s, order-placement rate
  within ±20% of baseline, Fastly hit-ratio ≥ 85%, all indexers `Ready`.
- **Row 2 — Golden signals (2×2):** checkout p95, storefront 5xx rate,
  storefront RPS, PHP-FPM saturation.
- **Row 3 — Commerce-native:** Fastly hit-ratio per surface, RabbitMQ
  consumer lag per queue, indexer status table, Redis memory + evictions.
- **Row 4 — Top-N:** top-10 payment errors by provider, top-10 slow MySQL
  queries, top-10 PHP fatal errors by class, top-10 slowest catalog SKUs.
- **Row 5 — Release / on-call:** last `magento-cloud deploy` timestamp + result,
  active on-call, current SLO error-budget burn (checkout t1).

## Per-platform preferences for Commerce PaaS

- **New Relic** — **default**; Adobe Cloud ships New Relic APM as part of the
  managed platform (transaction traces + `MagentoOrder` custom events out of the
  box).
- **Datadog** — second preference for multi-cloud or for orgs standardizing
  observability across Commerce + AEM + Spring.
- **Grafana + Prometheus** — self-managed on-prem / private-cloud Commerce
  installs; requires custom exporters for `bin/magento indexer:status`.
- **Fastly Real-time analytics** — always in play for edge metrics; embed
  via iframe or forward metrics to primary APM.

## 2 worked dashboard examples for Commerce PaaS

### Example: `checkout-cart` (revenue-critical path)

- Master template: `templates/dashboard-newrelic.json`
- Template vars: `env=prod`, `store_view=us_en`, `website_scope=base`
- Widgets: checkout p95 + SLO marker, cart-add p95, order-placement rate,
  payment errors per provider, Fastly hit-ratio on checkout surface, admin-
  auth failure rate, PHP-FPM saturation, deploy markers.
- Notify: `#commerce-oncall` on any red status widget.

### Example: `catalog-and-indexers` (content freshness)

- Master template: `templates/dashboard-datadog.json`
- Template vars: `env=prod`, `store_view=*`
- Widgets: indexer status table (all 5 indexers), reindex duration p95, Redis
  memory + evictions, RabbitMQ consumer lag (`async.operations.all`), catalog
  browse p95, PDP hit-ratio at Fastly, top-10 slow MySQL queries, cron
  heartbeat freshness.
- Notify: `#commerce-catalog` on indexer status ≠ `Ready`.

## Anti-patterns to avoid for Commerce PaaS

- **Skipping Fastly cache-hit widgets.** Edge hit-ratio is the dominant
  success metric — a Magento origin looks fine right up until Fastly stops
  absorbing traffic.
- **Dashboarding admin + storefront together.** Different SLOs, different
  audiences, different pageload profiles — split them.
- **Ignoring the indexer table.** A single `Reindex Required` silently makes
  catalog stale; it belongs in row-1 health-at-a-glance, not row-5.
- **Missing consumer-lag panel.** `async.operations.all` clogs cause silent
  cart / order regressions; if it's not on the dashboard, on-call finds it hours late.
- **Dashboards keyed to a single `store_view`.** Multi-site installs mask
  per-site regressions when averaged; expose `store_view` as a template variable.

---

Generate the full dashboard using the appropriate `templates/dashboard-<target>.json`
or `templates/dashboard-<target>.yml` as the master, populating placeholders
with stack-appropriate content from the guide above.
