# Dashboard authoring guide — EDS + Commerce hybrid

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a dashboard for an EDS + Commerce hybrid project
(helix-hosted storefront embedding Commerce SaaS drop-ins). Combine with
the appropriate `templates/dashboard-<target>.{json,yml}` as the master
skeleton.

## Purpose framing

An EDS + Commerce dashboard is watched by frontend leads, drop-in
integrators, and the on-call for combined content + commerce sites. It
merges **EDS content-site perf** (Core Web Vitals, block-load,
edge-cache) with **Commerce SaaS surfaces** (Cart Total round-trip,
Catalog Service p95, drop-in TTI, storefront-events, Payment Services).
Failure attribution is the hard problem: is a slow PDP the content
layer, the Catalog Service resolver, or the drop-in bundle? The
dashboard's job is to answer that in one glance.

## Signal catalog for EDS + Commerce

### Golden signals (RED / USE)

- **Latency** — LCP `p75` (content), Cart-Total round-trip `p95` (commerce),
  Catalog Service query `p95` (backend), drop-in TTI `p75` (client bundle).
- **Traffic** — pageviews/min per path pattern, add-to-cart rate,
  checkout-start rate, orders/min.
- **Errors** — block-load failure rate, drop-in bootstrap failure rate,
  Cart-Total 5xx, Payment Services error rate, storefront-events schema
  failures.
- **Saturation** — edge cache hit ratio, IMS token cache hit ratio, API
  Mesh worker concurrency headroom.

### Stack-native signals

- **EDS Core Web Vitals** (LCP / CLS / INP p75) segmented by device.
- **Drop-in TTI p75** per bundle (checkout / cart / PDP).
- **Cart-Total round-trip p95** (client-observed).
- **Catalog Service query p95** per operation.
- **Storefront-events emit rate per event-type**.
- **Drop-in bundle version served** per env (pin drift detector).
- **Payment Services round-trip per method + region**.
- **API Mesh resolver p95** per resolver.
- **Order-placement success rate** (business SLI).

## Widget catalog for EDS + Commerce

- **LCP p75 on commerce pages** (timeseries — filtered to `/products/*` + `/checkout/*`)
  - Datadog RUM: `avg:rum.performance.lcp.p75{env:$env, path_prefix:/products}`
  - Alert cross-ref: `resources/alert-rules/eds-commerce.md#lcp-commerce-breach`
- **Drop-in TTI p75 per bundle** (top-list — bottom-10 by TTI)
- **Cart-Total round-trip p95 (client-observed)** (timeseries with SLO marker)
  - Datadog RUM: `avg:rum.action.duration.p95{action:cart_total, env:$env}`
- **Catalog Service query p95 per operation** (top-list)
  - Datadog: `top(avg:commerce.catalog_service.query.duration.p95{env:$env} by {operation}, 10, 'mean', 'desc')` <!-- verify -->
- **Add-to-cart → order-placement funnel** (funnel widget)
  - Datadog: `funnel(rum.action{action:add_to_cart} -> rum.action{action:checkout_start} -> rum.action{action:order_placed})`
- **Storefront-events emit rate per event-type** (heatmap)
- **Payment Services round-trip per method** (timeseries — grouped)
- **API Mesh resolver p95 top-list** (top-list)
- **Drop-in bundle version served per env** (table — bundle SHA + version + env)
- **Block-load success per block (bottom-10)** (top-list)
- **Edge cache hit ratio on commerce paths** (timeseries)
- **Deploy markers — helix publish + drop-in pin change** (event_stream — dual source)

## Template variables for EDS + Commerce

- Common: `env`, `service`, `region`
- Hybrid-specific: `domain`, `path_prefix` (site section), `block_name`,
  `bundle_name` (drop-in), `bundle_version`, `device`, `resolver_name` (mesh),
  `payment_method`, `event_type` (storefront-events), `store_view`.

## Dashboard layout for EDS + Commerce

- **Row 1 — Health-at-a-glance:** LCP p75 ≤ 2500ms on commerce paths,
  Cart-Total p95 ≤ SLO, drop-in bootstrap failure < 0.5%, Catalog Service
  p95 within SLO, order-placement rate within ±20% of baseline.
- **Row 2 — Golden signals (2×2):** LCP p75 on commerce paths, Cart-Total
  round-trip p95, Catalog Service query p95, drop-in TTI p75.
- **Row 3 — Hybrid-native:** add-to-cart → checkout → order funnel,
  storefront-events per event-type, mesh resolver p95, drop-in bundle
  version drift.
- **Row 4 — Top-N:** top-10 slow resolvers, top-10 failing blocks, top-10
  Payment Services errors, top-10 slow paths by LCP.
- **Row 5 — Release / on-call:** last helix publish, last drop-in pin
  change, active on-call, SLO burn (order-placement t1).

## Per-platform preferences for EDS + Commerce

- **helix RUM + Datadog** — **default** combined pairing; helix RUM for
  content-side Core Web Vitals, Datadog for backend (mesh + Payment Services)
  and drop-in RUM correlation.
- **helix RUM + New Relic** — for orgs already on New Relic across their
  Commerce backend; Browser agent for drop-in RUM.
- **Splunk (Adobe internal telemetry) + Datadog** — surfaces internal
  Commerce SaaS state alongside customer-consumed telemetry.
- **Grafana + Prometheus** — rarely primary here (RUM support is limited);
  common as a secondary panel for backend Prometheus scrapes.
- **Adobe Experience Cloud Insights** — always link from row-5; it is the
  authoritative source for drop-in bundle state.

## 2 worked dashboard examples for EDS + Commerce

### Example: `hybrid-storefront-overview` (executive rollup)

- Master template: `templates/dashboard-datadog.json`
- Template vars: `env=prod`, `domain=www.brand.com`, `path_prefix=/products`,
  `device=*`
- Widgets: LCP p75 on commerce paths, Cart-Total round-trip p95, Catalog
  Service p95, drop-in TTI p75, add-to-cart→order funnel, order-placement
  rate, edge cache hit ratio, drop-in bundle version served (per env).
- Notify: `#hybrid-storefront-oncall` on any health-widget red-flip.

### Example: `commerce-drop-in-deep-dive` (drop-in + mesh troubleshooting)

- Master template: `templates/dashboard-newrelic.json`
- Template vars: `env=prod`, `bundle_name=*`, `resolver_name=*`
- Widgets: drop-in TTI p75 per bundle (bottom-10), drop-in bootstrap failure
  rate, mesh resolver p95 top-list, resolver 5xx rate, storefront-events
  per event-type, IMS token cache miss rate, Payment Services round-trip per
  method, bundle-pin change event stream.
- Notify: `#commerce-dropin-oncall` on resolver p95 breach for 5m.

## Anti-patterns to avoid for EDS + Commerce

- **Content-only dashboard on a commerce site.** Missing Cart-Total /
  Catalog Service / Payment Services means content perf looks fine while
  revenue is bleeding.
- **Commerce-only dashboard on a hybrid site.** Missing LCP / block-load
  hides content regressions that customers actually feel first.
- **No add-to-cart→order funnel.** The funnel is the single best incident
  detector — a drop between stages localizes the failure surface.
- **Averaging LCP across path patterns.** Content pages and PDPs have
  different LCP profiles; averaging hides PDP regressions.
- **Skipping drop-in bundle version drift.** Content deploys and drop-in
  pin updates are independent — mismatched versions are a real class of
  hybrid incident.

---

Generate the full dashboard using the appropriate `templates/dashboard-<target>.json`
or `templates/dashboard-<target>.yml` as the master, populating placeholders
with stack-appropriate content from the guide above.
