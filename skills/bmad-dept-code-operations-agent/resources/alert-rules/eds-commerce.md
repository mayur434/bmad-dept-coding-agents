# Alert-rule authoring guide — EDS + Commerce hybrid

## Purpose framing

An EDS + Commerce alert pages the storefront on-call, drop-in owner, or
Catalog Service liaison only when a **customer-visible commerce flow
degrades at the edge** — drop-in TTI, cart-persist errors, consent
toggle failure, Catalog Service latency piped through EDS blocks — not
on content-only regressions (which the EDS pack already covers). Every
rule links to a runbook symptom in `resources/runbook-templates/eds-commerce.md`.
Tag every alert with `bundle_version` and `env` — drop-in bundle drift
is the primary root-cause vector.

## Alert catalog for EDS + Commerce — must-have rules

Inherits all EDS alerts (LCP/INP/CLS, JS error, sitemap, Helix admin)
plus the following commerce-hybrid-specific rules:

- **`edsc.dropin.load_error`** — drop-in load error rate > 1% for 15 min → **P1** → runbook `#dropin-load-failure`
  - Datadog RUM: `sum(last_15m):sum:rum.dropin.error{env:$env, bundle:$bundle_version}.as_count() / sum:rum.dropin.load{env:$env}.as_count() > 0.01` <!-- verify RUM emit -->
  - Prometheus (RUM beacon): `sum(rate(edsc_dropin_error_total[15m])) / sum(rate(edsc_dropin_load_total[15m])) > 0.01`
- **`edsc.dropin.tti.high`** — drop-in TTI p75 > 3.5s for 30 min → **P2** → runbook `#dropin-tti`
- **`edsc.cart.persist.error`** — cart-persist error rate > 0.5% for 10 min → **P1** → runbook `#cart-persist-error`
- **`edsc.cart.total.p95.high`** — cart-total (Catalog Service) p95 > 1.5s for 10 min → **P2** → runbook `#cart-total-slow`
- **`edsc.consent.toggle.fail`** — consent-toggle apply failure > 1% for 15 min → **P2** → runbook `#consent-fail`
- **`edsc.catalog_service.5xx`** — Catalog Service 5xx observed edge-side > 1% for 10 min → **P1**
- **`edsc.payment.roundtrip.p95`** — Payment Services round-trip p95 > 2s edge-side for 10 min → **P2**
- **`edsc.storefront_events.schema_drift`** — schema-drift detector emits `WARN` → **P3** → runbook `#events-schema-drift`
- **`edsc.dropin.version.drift`** — bundle version drift between `stage` and `prod` after prod deploy → **P3** (informational)
- **`edsc.checkout.success_rate.low`** — checkout success < 95% for 15 min → **P1**
- **`edsc.pdp.dropin.error`** — PDP drop-in error rate > 1% for 15 min → **P1** (SKU-visibility broken)

## Alert severity mapping for EDS + Commerce

- **P1:** drop-in load error, cart-persist error, checkout success,
  Catalog Service 5xx, PDP drop-in error. Revenue-blocking flow break.
- **P2:** drop-in TTI, cart-total latency, consent-toggle failure,
  Payment Services p95, CWV regressions from base EDS pack.
- **P3:** bundle version drift, storefront-events schema drift, RUM
  sample-rate warnings.

## Alert-noise guidance for EDS + Commerce

- **All EDS anti-noise rules apply** (bot filter, device segmentation,
  30-min RUM windows).
- **Drop-in errors** should segment by `dropin_slug` (cart vs PDP vs
  checkout) — a single failing drop-in is different from all failing.
- **Cart-persist errors** should exclude first-load LocalStorage-init
  errors (expected on incognito / first-visit).
- **Consent-toggle failure** should skip `dnt=1` browsers (Do-Not-Track
  intentionally blocks the flow).
- **Catalog Service latency** at the edge should segment by `resolver` /
  `sku_pattern` — one slow category should not silence others.
- **PDP drop-in errors** should skip low-inventory SKUs (out-of-stock
  intentionally returns an error).

## Composite / multi-signal alerts for EDS + Commerce

- **`edsc.storefront.broken`** — `dropin_error > 1% AND cart_persist_error > 0.5% AND catalog_service_5xx > 0.5%`
  for 10 min → P1. Multi-signal confirms real commerce-flow outage.
- **`edsc.checkout.degraded`** — `payment_roundtrip_p95 > 2s AND checkout_success < 97%`
  for 10 min → P1. Confirms checkout-tier degradation vs upstream cart.
- **`edsc.deploy.regressed`** — `deploy_end + 15min AND (dropin_error > 1% OR cart_persist_error > 0.5%)`
  → P1. Roll back bundle.

## Alert deduplication / grouping for EDS + Commerce

- **Datadog:** group_by `env,bundle_version,dropin_slug,device_type`;
  suppress duplicates within 15 min (RUM lag).
- **Prometheus Alertmanager:** routes → `team-storefront` for drop-in
  errors; `team-checkout` for cart / payment; `team-content-ops` for
  base EDS alerts; `team-catalog` for Catalog Service edge alerts.
- **PagerDuty:** merge on `edsc.dropin.*` prefix within 15 min; separate
  service for `edsc.checkout.*` and `edsc.catalog_service.*`.

## On-call escalation policy per EDS + Commerce

- **Primary (0 min):** storefront on-call (`@storefront-oncall`).
- **Secondary (15 min):** drop-in owner for `dropin.*`; checkout eng
  for `cart.*` / `checkout.*`; Catalog Service liaison for
  `catalog_service.*`; content-eng for base EDS alerts.
- **Tertiary (30 min):** EDS+Commerce tech lead → engineering manager.
- **Vendor:** Adobe EDS support for Helix; Adobe Commerce SaaS support
  for Catalog / Payment Services; page both with `bundle_version` +
  `correlation_id`.

## Alerting cadence / silences for EDS + Commerce

- **Silences during drop-in bundle rollout** — drop-in-error + TTI alerts
  silenced from `deploy_start` to `deploy_start + 15m`.
- **Silences during declared Adobe Commerce SaaS maintenance** —
  Catalog / Payment Services edge alerts suppressed automatically.
- **Silences during sheet-config bulk-updates** — base EDS sitemap /
  redirects alerts paused during editorial bulk edits.
- **After-hours reduction for P3** — bundle-drift + schema-drift +
  RUM-sample delivery-only Slack overnight.

## 2 worked alert-rule examples for EDS + Commerce

### Example 1 — Cart-persist error (Datadog RUM)

```yaml
name: "[prod] eds-commerce — cart-persist error > 0.5% for 10 min (bundle {{bundle_version}})"
type: rum alert
query: 'rum("@type:action @action.name:cart.persist env:prod @error.type:*").rollup("count").last("10m") / rum("@type:action @action.name:cart.persist env:prod").rollup("count").last("10m") > 0.005'
message: |
  Cart-persist error > 0.5% on prod (bundle {{bundle_version.value}}).
  Runbook: RUNBOOK-eds-commerce.md#cart-persist-error
  @pagerduty-storefront-oncall @slack-eds-checkout
tags: [service:eds-commerce, env:prod, severity:sev1, bundle:{{bundle_version}}]
priority: 1
monitor_thresholds: { critical: 0.005, warning: 0.002 }
```

### Example 2 — Catalog Service edge-side 5xx (Prometheus)

```yaml
- alert: EdscCatalogServiceEdge5xx
  expr: 100 * sum(rate(edsc_catalog_edge_requests_total{code=~"5.."}[10m])) / sum(rate(edsc_catalog_edge_requests_total[10m])) > 1
  for: 10m
  labels: { severity: sev1, team: catalog }
  annotations:
    summary: "Catalog Service 5xx > 1% observed edge-side for 10 min"
    runbook: "runbooks/eds-commerce.md#catalog-service-down"
    action: "Correlate status.adobe.com before L2 escalation"
```

## Anti-patterns to avoid for EDS + Commerce

- **Alerting on drop-in errors without `bundle_version` tag** — cannot
  triage which rollout broke it.
- **Paging on cart-persist errors from incognito browsers** — LocalStorage
  init failures are expected in incognito; filter.
- **Static thresholds on Catalog Service edge latency** — CDN cache-hit
  ratio dominates; segment by `edge_cache:hit|miss`.
- **Ignoring `dropin_slug` in the alert** — one drop-in failing looks
  like a full outage otherwise.
- **Alerting on schema drift with `INFO` severity** — schema drift is a
  breaking-change signal; P3 minimum, page in-hours.

---

Generate the full alert-rules file using the appropriate `templates/alerts-<target>.yaml` as the master, populating placeholders with stack-appropriate content from the guide above.
