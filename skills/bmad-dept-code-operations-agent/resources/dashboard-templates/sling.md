# Dashboard authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a dashboard for an Apache Sling / Shaft project.
Combine with the appropriate `templates/dashboard-<target>.{json,yml}`
as the master skeleton.

## Purpose framing

A Sling / Shaft dashboard is watched by OSGi platform engineers, MDM /
SAM API owners, and the on-call SRE. It must expose **OSGi bundle
lifecycle state** (a bundle in `INSTALLED` or `RESOLVED` in prod is a
latent outage), **MDM CRUD latency** (the resource-side business
surface), **SAM API health** (the HTTP surface), and **JCR / Feature
Model integrity**. The dashboard's job is to catch bundle-activation
regressions before they surface as a 5xx spike.

## Signal catalog for Sling

### Golden signals (RED / USE)

- **Latency** — SAM API `p95` per endpoint, MDM CRUD `p95` per resource.
- **Traffic** — SAM API RPS per endpoint, JCR write ops/min.
- **Errors** — SAM API `5xx` rate, JCR persistence failures, OSGi
  service-availability drops, Sling servlet resolution failures.
- **Saturation** — OSGi service registry churn, JVM heap %, Sling job
  queue depth per topic, JCR active session count.

### Stack-native signals

- **OSGi bundle state histogram** (`ACTIVE` vs `RESOLVED` vs `INSTALLED`
  vs `STARTING`) — count of anything other than `ACTIVE` should be 0.
- **Sling job queue depth per topic** — async work backlog.
- **Feature Model install divergence** — expected features vs installed features.
- **JCR session leak count** (sessions open > 60s).
- **Sling servlet resolution failure rate** (`/system/console/servletresolver`). <!-- verify -->
- **Sling health-check registry status** (`/system/console/healthcheck`).
- **MDM resource CRUD latency** per resource type.
- **Config Admin change events** (event stream — surprising config changes).

## Widget catalog for Sling

- **OSGi bundle state histogram** (distribution)
  - Datadog: `sum:sling.osgi.bundle_count{env:$env} by {state}` <!-- verify -->
  - PromQL: `sum(osgi_bundle_state{env="prod"}) by (state)`
  - Alert cross-ref: `resources/alert-rules/sling.md#bundle-not-active`
- **SAM API p95 per endpoint** (top-list)
  - Datadog: `top(avg:sling.sam.request.duration.p95{env:$env} by {endpoint}, 10, 'mean', 'desc')`
- **SAM API 5xx rate per endpoint** (top-list with alert marker)
  - PromQL: `100 * sum(rate(sam_http_5xx_total[5m])) by (endpoint) / sum(rate(sam_http_total[5m])) by (endpoint)`
- **MDM CRUD latency per resource** (heatmap)
  - Datadog: `avg:sling.mdm.crud.duration.p95{env:$env} by {resource, operation}`
- **Sling job queue depth per topic** (timeseries)
  - PromQL: `sling_job_queue_depth{env="prod"}` <!-- verify -->
- **JCR session leak count** (query_value)
  - Datadog: `avg:sling.jcr.session.open_over_60s{env:$env}`
- **Feature Model install divergence** (query_value — count of missing / extra features)
- **Sling health-check registry status** (table — per-check status)
- **Config Admin change events (last 24h)** (event_stream)
- **JVM heap % + G1 pause count** (timeseries)
- **Top-10 slow Sling servlets** (top-list from APM traces)
- **Deploy markers** (event_stream — Feature Model release apply events)

## Template variables for Sling

- Common: `env`, `service`, `region`
- Sling-specific: `bundle_symbolic_name`, `feature_model` (release name),
  `topic` (Sling job topic), `endpoint` (SAM API path), `resource_type` (MDM),
  `instance_id` (per-node in a cluster).

## Dashboard layout for Sling

- **Row 1 — Health-at-a-glance:** all bundles `ACTIVE`, SAM API 5xx < 1%,
  all Sling health-checks green, Feature Model divergence = 0.
- **Row 2 — Golden signals (2×2):** SAM API p95, SAM API 5xx rate,
  SAM API RPS, JVM heap %.
- **Row 3 — Sling-native:** OSGi bundle state histogram, Sling job queue
  depth per topic, JCR session leak count, Feature Model install divergence.
- **Row 4 — Top-N:** top-10 slow SAM endpoints, top-10 slow MDM resources,
  top-10 servlet resolution failures, top-10 log-error signatures.
- **Row 5 — Release / on-call:** last Feature Model apply event, active
  on-call handle, SLO burn (SAM API t2 default), current node count in cluster.

## Per-platform preferences for Sling

- **Grafana + Prometheus** — most common for Sling shops (JMX exporter for
  OSGi metrics + custom exporters for Sling job queues + MDM CRUD).
- **Datadog** — for teams standardizing on Datadog across a JVM fleet;
  strong JMX + APM integration.
- **New Relic** — for shops migrating from AEM (same JVM APM lineage).
- **Dynatrace** — enterprise Sling shops; OneAgent auto-discovers OSGi
  services with minimal instrumentation.
- **Elastic / Kibana** — for log-heavy Sling observability (Sling event
  admin logs, servlet resolution failures).

## 2 worked dashboard examples for Sling

### Example: `sam-api` (HTTP surface)

- Master template: `templates/dashboard-grafana.json`
- Template vars: `env=prod`, `endpoint=*`, `instance_id=*`
- Widgets: SAM API p95 per endpoint (top-10), SAM API 5xx rate per endpoint,
  RPS per endpoint, JVM heap %, G1 pause count, Sling servlet resolution
  failures, top-10 slow servlets, deploy markers (Feature Model apply).
- Notify: `#sling-oncall` on SAM API 5xx > 1% for 5m.

### Example: `osgi-platform-health` (bundle lifecycle + jobs)

- Master template: `templates/dashboard-prometheus.yml`
- Template vars: `env=prod`, `bundle_symbolic_name=*`, `topic=*`
- Widgets: OSGi bundle state histogram, count of non-`ACTIVE` bundles per
  node, Sling job queue depth per topic, job-processing rate, JCR session
  leak count, Feature Model install divergence, Sling health-check registry
  status table, Config Admin change event stream.
- Notify: `#sling-platform` on any bundle stuck in `INSTALLED` > 5m post-deploy.

## Anti-patterns to avoid for Sling

- **No bundle-state widget.** OSGi is bundle-centric; a Sling dashboard
  without bundle state is missing the primary lifecycle signal.
- **HTTP-only view.** SAM API health is a lagging indicator — bundle state
  and Sling job queues lead HTTP regressions by minutes.
- **Aggregating across cluster nodes.** OSGi state is per-node; averaging
  masks the node with the failed bundle. Always expose `instance_id`.
- **Dashboarding `/system/console/*` in prod without auth context.** These
  endpoints are protected; either use a service token or scrape internal-
  network probes only.
- **Ignoring the Feature Model divergence metric.** A silent drift between
  expected and installed features is how "worked in stage, broken in prod"
  happens.

---

Generate the full dashboard using the appropriate `templates/dashboard-<target>.json`
or `templates/dashboard-<target>.yml` as the master, populating placeholders
with stack-appropriate content from the guide above.
