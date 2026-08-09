# Dashboard authoring guide — Adobe Commerce SaaS

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a dashboard for Adobe Commerce SaaS (drop-in
storefront + Catalog Service + Live Search + Payment Services). Combine
with the appropriate `templates/dashboard-<target>.{json,yml}` as the
master skeleton.

## Purpose framing

Adobe Commerce SaaS puts the platform under Adobe's control — teams do
not run a Magento server, they consume APIs and embed drop-in bundles.
A dashboard therefore surfaces **consumer-side health** (drop-in load
success, storefront-events emit rate, bundle version drift) and
**API-side latency** (Catalog Service, Live Search, Payment Services,
API Mesh resolvers). It correlates browser-side RUM with backend API
timings so a `Cart Total` slowdown can be blamed on the resolver, the
mesh, or the client bundle in one glance.

## Signal catalog for Commerce SaaS

### Golden signals (RED / USE)

- **Latency** — Catalog Service query `p95`, Cart-Total round-trip `p95`,
  drop-in TTI `p75` (client-side).
- **Traffic** — drop-in-load RPS per bundle, storefront-events emit rate
  per event-type, mesh resolver QPS.
- **Errors** — drop-in bootstrap failure rate, mesh resolver 5xx, IMS
  token exchange failures, storefront-events schema-validation failures.
- **Saturation** — mesh worker concurrency headroom, IMS token cache hit
  ratio, drop-in CDN edge cache hit ratio.

### Stack-native signals

- **Drop-in bundle version served** per environment (dev/stage/prod version drift).
- **Live Search relevance metrics** — CTR, zero-result-rate, top-search-terms. <!-- verify: current LS telemetry -->
- **Storefront-events emit rate per event-type** (`pageView`, `addToCart`,
  `checkoutStart`, `orderPlaced`).
- **API Mesh resolver latency** per resolver.
- **Payment Services round-trip** per method + region.
- **IMS token roundtrip + cache miss rate**.
- **Bundle-load success rate** per storefront (client-side, from RUM).
- **Catalog Service GraphQL error rate** per operation. <!-- verify -->

## Widget catalog for Commerce SaaS

- **Catalog Service query p95** (timeseries with SLO marker at 500ms / t1)
  - Datadog: `avg:commerce.catalog_service.query.duration.p95{env:$env, operation:$operation}` <!-- verify -->
  - PromQL: `histogram_quantile(0.95, sum(rate(catalog_service_query_duration_bucket[5m])) by (le, operation))`
  - Alert cross-ref: `resources/alert-rules/commerce-saas.md#catalog-service-p95-breach`
- **Cart-Total round-trip p95** (timeseries — client-side observed)
  - Datadog RUM: `avg:rum.action.duration.p95{action:cart_total, env:$env}`
- **Drop-in TTI p75** (timeseries — Core Web Vitals for storefront bundle)
- **Drop-in bundle version served per env** (table — bundle SHA + version + env)
- **Storefront-events emit rate per event-type** (top-list / heatmap)
  - Datadog: `sum:commerce.storefront_events.emit{env:$env} by {event_type}.as_rate()`
- **API Mesh resolver latency (p95) top-list** (top-list)
  - Datadog: `top(avg:mesh.resolver.duration.p95{env:$env} by {resolver}, 10, 'mean', 'desc')`
- **Payment Services round-trip per method** (timeseries — grouped by method)
- **IMS token exchange error rate + cache miss rate** (timeseries dual axis)
- **Live Search zero-result-rate** (query_value — business SLI)
- **Bundle-load bootstrap failure rate** (query_value — client-side RUM)
- **Drop-in CDN cache hit ratio** (timeseries)
- **Deploy markers per environment** (event_stream — bundle version pin change events)

## Template variables for Commerce SaaS

- Common: `env`, `service`, `region`
- SaaS-specific: `store_view`, `bundle_name` (drop-in package),
  `bundle_version`, `event_type` (storefront-events), `resolver_name` (mesh),
  `payment_method`, `ims_org_id`.

## Dashboard layout for Commerce SaaS

- **Row 1 — Health-at-a-glance:** Catalog Service p95 ≤ 500ms, drop-in
  bootstrap failure rate < 0.5%, IMS token exchange error rate < 0.1%,
  bundle version pinned to expected SHA.
- **Row 2 — Golden signals (2×2):** Catalog Service query p95, drop-in TTI
  p75, mesh resolver 5xx rate, storefront-events emit rate.
- **Row 3 — SaaS-native:** drop-in bundle version drift table, resolver p95
  top-list, storefront-events per event-type heatmap, Live Search zero-result-rate.
- **Row 4 — Top-N:** top-10 slow resolvers, top-10 storefront-events schema
  failures, top-10 Payment Services error codes, top-10 IMS exchange failures.
- **Row 5 — Release / on-call:** current bundle version per env, last drop-in
  pin change (event_stream), active on-call, SLO burn (checkout t1).

## Per-platform preferences for Commerce SaaS

- **Splunk / Adobe internal telemetry** — Commerce SaaS emits into Adobe's
  own observability plane; consumer teams often mirror to their own APM.
- **Datadog** — most common consumer choice; strong drop-in RUM correlation
  + mesh APM support.
- **New Relic** — for orgs already New-Relic-native (AEM + PaaS shops migrating).
- **Grafana + Prometheus** — self-hosted stacks; requires an exporter for
  storefront-events and mesh telemetry (custom work).
- **Adobe Experience Cloud UI** — not a dashboard target per se, but the
  built-in Commerce SaaS Insights panel should be linked from row-5.

## 2 worked dashboard examples for Commerce SaaS

### Example: `storefront-dropin` (client-side + bundle health)

- Master template: `templates/dashboard-datadog.json`
- Template vars: `env=prod`, `bundle_name=checkout`, `store_view=us_en`
- Widgets: drop-in TTI p75, drop-in bootstrap failure rate, bundle version
  served (per env table), storefront-events emit rate per event-type, CDN
  cache hit ratio, Cart-Total round-trip p95, Payment Services error rate,
  bundle-pin change event stream.
- Notify: `#commerce-saas-frontend` on drop-in bootstrap failure > 0.5%.

### Example: `mesh-and-catalog` (backend API health)

- Master template: `templates/dashboard-newrelic.json`
- Template vars: `env=prod`, `resolver_name=*`
- Widgets: Catalog Service query p95, mesh resolver p95 top-list, resolver
  5xx rate, IMS token exchange failure rate, IMS cache hit ratio, Payment
  Services round-trip per method, storefront-events schema-validation errors,
  Live Search relevance metrics.
- Notify: `#commerce-saas-mesh` on resolver p95 > SLO for 5m.

## Anti-patterns to avoid for Commerce SaaS

- **No bundle-version-drift panel.** Drop-ins are versioned client-side; a
  stale pin in `stage` vs `prod` is a real incident and easy to miss.
- **Only backend metrics.** Commerce SaaS incidents often surface first in
  RUM (drop-in bootstrap fail, TTI regression) — leaving out client-side
  telemetry blinds the dashboard.
- **Dashboarding raw resolver names without a top-list rollup.** Mesh
  resolvers proliferate; a raw all-resolver timeseries is unreadable — use
  top-N.
- **Missing IMS token panel.** IMS is the single upstream that gates
  everything; if it's missing, on-call chases red herrings for 30 min.
- **Treating Live Search as backend-only.** Live Search feeds relevance into
  the drop-in — dashboard both the API latency and the RUM-observed
  browse-to-click funnel.

---

Generate the full dashboard using the appropriate `templates/dashboard-<target>.json`
or `templates/dashboard-<target>.yml` as the master, populating placeholders
with stack-appropriate content from the guide above.
