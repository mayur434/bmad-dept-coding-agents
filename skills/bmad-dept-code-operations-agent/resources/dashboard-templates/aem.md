# Dashboard authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a dashboard for an AEM as a Cloud Service (AEMaaCS)
or AEM Managed Services (AMS) project. Combine with the appropriate
`templates/dashboard-<target>.{json,yml}` as the master skeleton.

## Purpose framing

An AEM dashboard is watched by dispatcher-admins, AEM tech leads, and the
Cloud Manager release manager. It must surface **tier-separated health**
(Author is a different concern from Publish, and Publish is a different
concern from Dispatcher), be **incident-first** (dispatcher hit-ratio
regression, Publish 5xx spike, replication clog — the top-3 outage shapes),
and expose the **quality-gate + deploy state** that Cloud Manager owns.
Editorial ops watch a different rollup than the on-call SRE — plan two
views, not one.

## Signal catalog for AEM

### Golden signals (RED / USE)

- **Latency** — Publish `p95` at the dispatcher edge (customer-visible surface).
- **Traffic** — Publish RPS + Author-request-per-editor QPS.
- **Errors** — Publish + dispatcher `5xx` rate, Sling exception log count,
  replication failure count.
- **Saturation** — Author JVM heap %, Publish connection-pool usage %,
  dispatcher CPU %, DAM asset-processing queue depth.

### Stack-native signals

- **Dispatcher hit-ratio** per farm — the single dominant success metric;
  a 5-point drop is a real incident.
- **Replication queue depth** per Publish subscriber — clog = customer-visible
  content freeze.
- **Content Fragment publication lag** — publication workflow bottleneck signal.
- **Sling job queue depth** per topic (async work backlog).
- **Cloud Manager execution / quality-gate status** — deploy freshness + regressions.
- **DAM upload success rate** + asset-processing queue depth.
- **GraphQL query error rate** + p95 (headless-consumer surface).
- **AEM bundle state histogram** (`ACTIVE` / `RESOLVED` / `INSTALLED` counts).

## Widget catalog for AEM

- **Dispatcher hit-ratio — last 24h** (timeseries)
  - Datadog: `avg:aem.dispatcher.hit_ratio{env:$env, farm:$farm}` <!-- verify -->
  - PromQL: `avg_over_time(aem_dispatcher_hit_ratio{env="prod"}[1h])` <!-- verify -->
  - NRQL: `SELECT average(dispatcherHitRatio) FROM AEMDispatcher WHERE env='prod' TIMESERIES`
  - Alert cross-ref: `resources/alert-rules/aem.md#dispatcher-hit-ratio-drop`
- **Publish 5xx rate** (timeseries with SLO marker at 1%)
  - Datadog: `100 * sum:aem.publish.http.5xx{env:$env}.as_count() / sum:aem.publish.http.total{env:$env}.as_count()`
- **Publish p95 latency at dispatcher edge** (timeseries)
  - PromQL: `histogram_quantile(0.95, sum(rate(aem_publish_request_duration_bucket[5m])) by (le))` <!-- verify -->
- **Author responsiveness — /system/console/healthcheck** (check_status)
  - Datadog: `http.can_connect{url:/system/console/healthcheck, tier:author}`
- **Replication queue depth per subscriber** (top-list)
  - Datadog: `top(avg:aem.replication.queue_depth{env:$env} by {subscriber}, 10, 'mean', 'desc')`
- **Sling job queue backlog per topic** (heatmap)
  - PromQL: `sum(aem_sling_job_queue_depth) by (topic)` <!-- verify -->
- **Content Fragment publication lag (p95)** (query_value)
  - Datadog: `avg:aem.cf.publish_lag_seconds.p95{env:$env}` <!-- verify -->
- **DAM asset-processing queue depth** (timeseries)
- **Cloud Manager execution status** (event_stream — deploy markers + quality-gate outcomes)
  - Datadog: `tags:source:cloud-manager env:$env`
- **Bundle state histogram** (distribution — count of `INSTALLED` should be 0 in steady state)
- **GraphQL persisted-query error rate** (timeseries) — critical for headless AEM consumers.
- **Top-N Sling exception classes (last 1h)** (top-list from log index)
  - Datadog: `logs('service:aem status:error env:$env').index('*').aggregate(count).groupBy(@exception.class).top(10)`

## Template variables for AEM

- Common: `env` (dev/stage/prod), `service`, `region`
- AEM-specific: `tier` (author/publish/dispatcher), `farm` (dispatcher farm name),
  `runmode` (author/publish + custom run modes), `program_id` (Cloud Manager),
  `pipeline_id`, `subscriber` (replication target).

## Dashboard layout for AEM

- **Row 1 — Health-at-a-glance:** four status widgets: Dispatcher hit-ratio ≥ 95%,
  Publish 5xx < 1%, Replication queues empty, Cloud Manager execution GREEN.
- **Row 2 — Golden signals timeseries (2×2):** Publish p95 latency, Publish 5xx
  rate, Publish RPS, Author JVM heap %.
- **Row 3 — AEM-native signals:** dispatcher hit-ratio per farm, replication
  queue depth per subscriber, Sling job queue depth per topic, DAM
  asset-processing queue depth.
- **Row 4 — Top-N tables:** top 10 slow persisted-GraphQL queries, top 10 Sling
  exception classes, top 10 dispatcher MISS paths (cache-key regression scent).
- **Row 5 — Release / on-call context:** last Cloud Manager execution ID + result,
  active dispatcher config commit SHA, current on-call handle, SLO error-budget
  burn (Publish availability t2 default).

## Per-platform preferences for AEM

- **New Relic** — Adobe Cloud AMS default (Adobe ships New Relic APM bundled);
  best out-of-box for JVM + Sling model telemetry.
- **Datadog** — best when the org runs a multi-cloud footprint (AEM alongside
  Commerce PaaS / Spring); log-search + APM + Watchdog anomaly detection.
- **Grafana + Prometheus** — for shops running AEMaaCS metrics scraped via
  Cloud Manager metric-forwarding into a self-hosted stack; strongest for
  custom OSGi / JMX metrics.
- **Splunk** — some Adobe internal orgs; strong for dispatcher log analytics.

## 2 worked dashboard examples for AEM

### Example: `publish-tier` (customer-facing edge)

- Master template: `templates/dashboard-datadog.json`
- Template vars: `env`, `tier=publish`, `farm=default`
- Widgets: Publish p95 at dispatcher edge, Publish 5xx rate, dispatcher hit-ratio
  per farm, replication queue depth per subscriber, top 10 dispatcher MISS paths,
  top 10 Sling exception classes, deploy markers (Cloud Manager), synthetic
  home→PDP→cart timing.
- Notify: `#aem-oncall` on any status-widget red-flip.

### Example: `author-tier` (editorial + workflow)

- Master template: `templates/dashboard-newrelic.json`
- Template vars: `env`, `tier=author`
- Widgets: Author `/system/console/healthcheck`, JVM heap % + G1 pauses, active
  JCR session count, workflow queue depth (`com.day.cq.wcm.workflow`), CF
  publication lag p95, DAM asset-processing queue depth, top-10 long-running
  JCR queries, Cloud Manager execution status.
- Notify: `#aem-editorial` on workflow backlog; `#aem-oncall` on health-red.

## Anti-patterns to avoid for AEM

- **Author + Publish on the same dashboard.** Different tiers, different failure
  modes, different on-call surfaces. Split them.
- **Skipping the dispatcher.** 80% of AEM perf incidents route through the
  dispatcher / CDN edge — a dashboard without hit-ratio + MISS-path top-N is
  blind to the common case.
- **Dashboarding `/system/console/*` on Publish in prod.** These endpoints are
  restricted by config in AEMaaCS — probes will 403; use `dispatcher/publish/health`
  or Cloud Manager health signals instead.
- **No Cloud Manager execution context.** Every AEM incident triage starts with
  "which execution ID?" — include it as a template variable + event_stream widget.
- **Metric-name drift across environments.** AEMaaCS metric-forwarding uses
  `aem.publish.*` but on-prem AMS may still emit `aem.dispatcher.*` under a
  different namespace; declare the metric prefix as a variable, not a literal.

---

Generate the full dashboard using the appropriate `templates/dashboard-<target>.json`
or `templates/dashboard-<target>.yml` as the master, populating placeholders
with stack-appropriate content from the guide above.
