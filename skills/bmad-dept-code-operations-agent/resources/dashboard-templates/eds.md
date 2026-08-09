# Dashboard authoring guide — Edge Delivery Services (EDS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a dashboard for an Edge Delivery Services (EDS /
helix) project. Combine with the appropriate
`templates/dashboard-<target>.{json,yml}` as the master skeleton.

## Purpose framing

An EDS dashboard is watched by frontend leads, block authors, and the
on-call for helix-powered sites. Because EDS is CDN-first with no
customer-owned origin, the dashboard is dominated by **Core Web Vitals**
(LCP / CLS / INP p75 from RUM), **block-load success**, **edge cache
health**, and **content-source freshness** (Google Docs / SharePoint sync,
helix-preview vs helix-live, redirects.xlsx). Perf regressions are the
single largest incident class — the dashboard is the perf dashboard first,
health dashboard second.

## Signal catalog for EDS

### Golden signals (RED / USE)

- **Latency** — LCP `p75`, INP `p75`, TTFB `p95` at edge (all from RUM).
- **Traffic** — pageviews/min per path pattern, RUM sample count.
- **Errors** — block-load failure rate per block-name, 404 rate per path,
  JS error rate from RUM.
- **Saturation** — edge cache hit ratio (indirect saturation of origin),
  sitemap generation duration, RUM ingestion delay.

### Stack-native signals

- **Core Web Vitals p75** — LCP, CLS, INP; segmented by device (mobile /
  desktop) and connection (4g / wifi).
- **Block-load success rate per block-name** — custom block regression
  detector.
- **Edge cache hit ratio per path pattern** — CDN efficiency.
- **helix-preview vs helix-live diff count** — content sync freshness.
- **Sitemap generation duration** + last-successful timestamp.
- **redirects.xlsx sync status** — misconfigured redirects break SEO.
- **Content-source (Google Docs / SharePoint) auth token freshness**. <!-- verify -->
- **RUM sample rate** — declining sample rate = blind spots forming.

## Widget catalog for EDS

- **LCP p75 (mobile vs desktop)** (timeseries with SLO marker at 2500ms)
  - helix RUM: `SELECT PERCENTILE(lcp, 75) FROM rum WHERE domain='$domain' TIMESERIES BY device` <!-- verify RUM query syntax -->
  - Datadog RUM: `avg:rum.performance.lcp.p75{env:$env, device:$device}`
  - Alert cross-ref: `resources/alert-rules/eds.md#lcp-p75-breach`
- **INP p75** (timeseries)
  - Datadog RUM: `avg:rum.performance.inp.p75{env:$env}`
- **CLS p75** (timeseries with marker at 0.1)
- **Block-load success rate per block-name** (top-list — bottom 10)
  - Datadog: `top(100 * sum:eds.block.load_success{env:$env} by {block_name}.as_count() / sum:eds.block.load_total{env:$env} by {block_name}.as_count(), 10, 'sum', 'asc')` <!-- verify metric names -->
- **Edge cache hit ratio per path pattern** (timeseries)
  - Fastly / CDN metric: `100 * sum:cdn.hits{path_prefix:$path_prefix} / sum:cdn.requests{path_prefix:$path_prefix}`
- **JS error rate from RUM** (timeseries with top-list companion)
- **helix-preview vs helix-live diff count** (query_value)
- **Sitemap generation duration + last-successful timestamp** (query_value + timestamp widget)
- **redirects.xlsx sync status** (status widget — green / stale / broken)
- **Pageviews/min per path pattern** (timeseries — top-10 by path)
- **404 rate per path pattern** (top-list)
- **helix admin action stream** (event_stream — publish / preview events)

## Template variables for EDS

- Common: `env`, `service`, `region`
- EDS-specific: `edge_region` (CDN POP grouping), `path_prefix` (site section),
  `block_name` (block component), `device` (mobile/desktop),
  `connection` (4g/wifi/slow-3g), `domain`, `content_source` (gdocs/sharepoint).

## Dashboard layout for EDS

- **Row 1 — Health-at-a-glance:** LCP p75 ≤ 2500ms, CLS p75 ≤ 0.1, INP
  p75 ≤ 200ms, block-load success ≥ 99%, redirects.xlsx sync green.
- **Row 2 — Golden signals (2×2):** LCP p75 by device, INP p75, edge cache
  hit ratio, JS error rate.
- **Row 3 — EDS-native:** block-load success rate per block (bottom-10),
  helix-preview vs helix-live diff count, sitemap generation duration,
  pageviews per path pattern.
- **Row 4 — Top-N:** top-10 slowest paths by LCP, top-10 blocks by load
  failure, top-10 404 paths, top-10 JS errors.
- **Row 5 — Release / on-call:** last helix publish event, content-source
  auth token expiry, active on-call, SLO error-budget burn (LCP t2).

## Per-platform preferences for EDS

- **helix RUM** — **built-in and default**; free tier for all EDS sites; the
  authoritative source for Core Web Vitals. Always the primary panel source.
- **Datadog RUM** — most common secondary; used when the org wants
  cross-service correlation (EDS + backend services on Datadog).
- **SpeedCurve** — for perf-focused orgs; deep budgets + competitive perf
  benchmarking; often paired with helix RUM.
- **Google Analytics 4 + Search Console** — for SEO teams; complementary,
  not a health dashboard target.
- **New Relic Browser** — for orgs standardized on New Relic across web +
  API surfaces.

## 2 worked dashboard examples for EDS

### Example: `marketing-site` (content site RUM + edge)

- Master template: `templates/dashboard-datadog.json`
- Template vars: `env=prod`, `domain=www.brand.com`, `device=*`,
  `path_prefix=/blog`
- Widgets: LCP p75 by device, INP p75, CLS p75, edge cache hit ratio,
  pageviews per path pattern, block-load success per block (bottom-10), top-10
  slowest paths, helix publish event stream.
- Notify: `#eds-marketing` on LCP p75 > 2500ms for 15m.

### Example: `content-sync-health` (source freshness)

- Master template: `templates/dashboard-grafana.json`
- Template vars: `env=prod`, `content_source=gdocs`
- Widgets: helix-preview vs helix-live diff count, sitemap generation
  duration + last-successful timestamp, redirects.xlsx sync status,
  content-source auth token freshness, top-10 pages with stale live version,
  helix admin action stream.
- Notify: `#eds-content` on redirects.xlsx sync broken.

## Anti-patterns to avoid for EDS

- **No Core Web Vitals segmentation.** LCP averaged across mobile + desktop
  hides mobile regressions (where the customer actually is). Always segment
  by device.
- **Cache-busted URLs on the dashboard.** EDS deploy IDs cache-bust asset
  URLs — dashboarding a specific asset URL breaks on every deploy. Group by
  path pattern, not URL.
- **Ignoring block-load success.** Custom blocks are the app-layer of EDS —
  a block that fails to load silently degrades the page; must be per-block.
- **No content-sync freshness panel.** Google Docs / SharePoint sync
  failures cause silent stale content; a dashboard without it misses a
  common incident class.
- **RUM sample-rate not on the dashboard.** A declining sample rate = your
  metrics are wrong; it needs to be visible.

---

Generate the full dashboard using the appropriate `templates/dashboard-<target>.json`
or `templates/dashboard-<target>.yml` as the master, populating placeholders
with stack-appropriate content from the guide above.
