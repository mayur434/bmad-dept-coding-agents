# Alert-rule authoring guide — Adobe Commerce SaaS

## Purpose framing

A Commerce SaaS alert pages the storefront on-call, drop-in owner, or
Catalog Service team only when a **drop-in bundle regression, Catalog
Service degradation, or Payment Services outage** breaks customer flow —
you do not own the platform metrics, so page on the edge/customer-visible
signals the tenant *can* see. Every rule links to a runbook symptom in
`resources/runbook-templates/commerce-saas.md`. Tag every alert with the
active **drop-in bundle version** for regression correlation across
environments.

## Alert catalog for Commerce SaaS — must-have rules

- **`commerce_saas.dropin.load_error`** — drop-in load error rate > 1% for 15 min → **P1** → runbook `#dropin-load-failure`
  - Datadog: `avg(last_15m):sum:commerce_saas.dropin.error{env:$env, bundle:$bundle_version}.as_count() / sum:commerce_saas.dropin.load{env:$env}.as_count() > 0.01` <!-- verify metric shape -->
  - Prometheus: `sum(rate(commerce_saas_dropin_error_total[15m])) / sum(rate(commerce_saas_dropin_load_total[15m])) > 0.01`
- **`commerce_saas.catalog_service.5xx`** — Catalog Service 5xx > 1% for 10 min → **P1** → runbook `#catalog-service-down`
  - Datadog: `sum(last_10m):sum:commerce_saas.catalog.http.5xx.as_count() / sum:commerce_saas.catalog.http.total.as_count() > 0.01`
- **`commerce_saas.catalog_service.p95.high`** — Catalog Service p95 > 800ms for 10 min → **P2** → runbook `#catalog-slowdown`
  - New Relic: `SELECT percentile(duration, 95) FROM ExternalCall WHERE host LIKE '%catalog-service%' SINCE 10 minutes ago`
- **`commerce_saas.payment_services.error`** — Payment Services round-trip error > 2% for 5 min → **P1**
- **`commerce_saas.storefront_events.emit_drop`** — events emit rate drops > 50% vs 24h baseline for 15 min → **P2** → runbook `#events-drop`
- **`commerce_saas.api_mesh.resolver.p95.high`** — API Mesh resolver p95 > 1s for 10 min → **P2**
  - Prometheus: `histogram_quantile(0.95, sum by (le, resolver) (rate(api_mesh_resolver_duration_seconds_bucket[10m]))) > 1`
- **`commerce_saas.ims.token.fail`** — IMS token roundtrip failure > 1% for 10 min → **P2** → runbook `#ims-token-failure`
- **`commerce_saas.dropin.version_drift`** — drop-in bundle version drift between `stage` and `prod` after prod deploy → **P3** (informational)
- **`commerce_saas.cart.p95.high`** — cart-total p95 > 1.5s for 10 min → **P2**
- **`commerce_saas.checkout.success_rate.low`** — checkout success < 95% for 15 min → **P1**

## Alert severity mapping for Commerce SaaS

- **P1:** drop-in load error, Catalog Service 5xx, Payment Services error,
  checkout success. Revenue-blocking + directly visible to tenant.
- **P2:** Catalog Service latency, API Mesh resolver latency, IMS token
  failures, events emit drop, cart p95.
- **P3:** bundle version drift, RUM sample-rate drops, non-critical
  storefront-events schema warnings.

## Alert-noise guidance for Commerce SaaS

- **All:** minimum 3-datapoint window; tag every rule with `bundle_version`
  and `env` for correlation.
- **Drop-in load error** should segment by `bundle_slug` (cart vs PDP vs
  checkout drop-in) — a single drop-in failing is different from all failing.
- **Catalog Service 5xx** — SaaS API is vendor-owned; correlate with
  Adobe status page (`status.adobe.com`) before paging past L2 escalation.
- **IMS token failures** should skip the first 60s of app startup (initial
  token acquisition can retry cleanly).
- **Storefront-events emit drop** should exclude scheduled tenant maintenance
  and low-traffic windows (guard with baseline traffic > threshold).
- **API Mesh resolver p95** should exclude `dev` mesh + tag by `resolver_name`
  so one slow federated source does not silence others.

## Composite / multi-signal alerts for Commerce SaaS

- **`commerce_saas.storefront.degraded`** — `dropin_error > 0.5% AND catalog_p95 > 500ms`
  for 10 min → P1. Rules out client-side vs API degradation.
- **`commerce_saas.checkout.degraded`** — `payment_error > 1% AND checkout_success < 97%`
  for 10 min → P1.
- **`commerce_saas.data.stale`** — `events_emit_drop > 50% AND catalog_service_p95 > 800ms AND api_mesh_p95 > 1s`
  for 15 min → P2. Multi-signal confirms platform-wide degradation.

## Alert deduplication / grouping for Commerce SaaS

- **Datadog:** group_by `env,bundle_version,resolver`; suppress duplicates
  within 5 min per `service:commerce-saas` scope.
- **Prometheus Alertmanager:** routes → `team-storefront` for drop-in;
  `team-catalog` for Catalog Service; `team-integrations` for API Mesh + IMS.
- **PagerDuty:** merge on `commerce_saas.dropin.*` prefix within 10 min;
  separate service for `commerce_saas.payment.*`.

## On-call escalation policy per Commerce SaaS

- **Primary (0 min):** storefront on-call (`@storefront-oncall`).
- **Secondary (10 min):** drop-in owner for `dropin.*`; Catalog Service
  liaison for `catalog_service.*`; integrations lead for `api_mesh.*` /
  `ims.*`.
- **Tertiary (25 min):** Commerce SaaS tech lead → engineering manager.
- **Vendor (30 min for platform):** Adobe Commerce SaaS support with
  `tenant_id` + `bundle_version` + correlation ID; escalate directly for
  Catalog Service / Payment Services outages (customer-owned code cannot fix).

## Alerting cadence / silences for Commerce SaaS

- **Silences during drop-in bundle rollout** — drop-in-error alerts silenced
  from `deploy_start` to `deploy_start + 10m`; `bundle_version` tag ensures
  post-window alerts correctly attribute to new bundle.
- **Silences during Adobe declared maintenance** — auto-suppress alerts tagged
  as vendor-owned when Adobe status API reports maintenance on Catalog /
  Payment Services.
- **After-hours reduction** for P3 (version-drift, RUM sample warnings) —
  delivery-only Slack, no page.

## 2 worked alert-rule examples for Commerce SaaS

### Example 1 — Drop-in load error (Datadog)

```yaml
name: "[prod] commerce-saas — drop-in load error > 1% (bundle {{bundle_version}})"
type: query alert
query: 'avg(last_15m):sum:commerce_saas.dropin.error{env:prod, bundle:$bundle_version.value}.as_count() / sum:commerce_saas.dropin.load{env:prod}.as_count() > 0.01'
message: |
  Drop-in load error > 1% on prod, bundle {{bundle_version.value}}.
  Correlate with last drop-in rollout window.
  Runbook: RUNBOOK-commerce-saas.md#dropin-load-failure
  @pagerduty-storefront-oncall
tags: [service:commerce-saas, env:prod, severity:sev1, bundle:{{bundle_version}}]
priority: 1
monitor_thresholds: { critical: 0.01, warning: 0.005 }
```

### Example 2 — Catalog Service 5xx (Prometheus)

```yaml
- alert: CommerceSaasCatalogService5xx
  expr: sum(rate(commerce_saas_catalog_http_requests_total{code=~"5.."}[10m])) / sum(rate(commerce_saas_catalog_http_requests_total[10m])) > 0.01
  for: 10m
  labels: { severity: sev1, team: catalog }
  annotations:
    summary: "Catalog Service 5xx > 1% for 10 min (vendor-owned)"
    runbook: "runbooks/commerce-saas.md#catalog-service-down"
    action: "Correlate status.adobe.com before escalating past L2"
```

## Anti-patterns to avoid for Commerce SaaS

- **Alerting on internal Catalog Service latency without vendor-status check** —
  Adobe-owned; page L2 with correlation, do not attempt in-tenant fixes.
- **Missing `bundle_version` tag** — you cannot correlate drop-in regressions
  across environments without it.
- **Static thresholds on API Mesh resolver p95** — resolvers vary widely by
  federated source; use per-resolver anomaly detection.
- **Paging on Payment Services 4xx** — client-input errors (invalid card)
  are expected; only page on 5xx / gateway-error patterns.
- **No page for IMS token failures during business hours** — auth failure
  cascades into every drop-in.

---

Generate the full alert-rules file using the appropriate `templates/alerts-<target>.yaml` as the master, populating placeholders with stack-appropriate content from the guide above.
