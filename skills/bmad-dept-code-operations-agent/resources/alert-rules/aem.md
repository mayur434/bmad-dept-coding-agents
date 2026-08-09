# Alert-rule authoring guide — AEM (AEMaaCS + AMS)

## Purpose framing

An AEM alert rule pages the dispatcher-admin, AEM tech lead, or Cloud
Manager release manager only when a **customer-visible surface has
regressed past a quantified threshold** — dispatcher hit-ratio, Publish
5xx rate, replication clog — never for a single-datapoint spike or a
metric without an owner. Every rule links to a runbook symptom in
`resources/runbook-templates/aem.md`; if there is no runbook, there is
no page. Tier-scope every rule (Author vs Publish vs Dispatcher) — a
Publish 5xx alert should not fire on Author noise.

## Alert catalog for AEM — must-have rules

- **`aem.dispatcher.hit_ratio.low`** — hit-ratio < 90% for 15 min → **P2** → runbook `#dispatcher-hit-ratio-drop`
  - Datadog: `avg(last_15m):avg:aem.dispatcher.hit_ratio{env:$env, tier:publish} < 0.90` <!-- verify metric name -->
  - Prometheus: `avg_over_time(aem_dispatcher_hit_ratio{env="prod"}[15m]) < 0.90`
  - New Relic: `SELECT average(dispatcherHitRatio) FROM AEMDispatcher WHERE env='prod' SINCE 15 minutes ago`
- **`aem.publish.5xx.high`** — Publish 5xx rate > 1% for 10 min → **P1** → runbook `#publish-5xx-spike`
  - Datadog: `sum(last_10m):100 * sum:aem.publish.http.5xx{env:$env}.as_count() / sum:aem.publish.http.total{env:$env}.as_count() > 1`
  - Prometheus: `100 * sum(rate(aem_publish_http_requests_total{code=~"5.."}[10m])) / sum(rate(aem_publish_http_requests_total[10m])) > 1`
  - New Relic: `SELECT percentage(count(*), WHERE httpResponseCode LIKE '5%') FROM Transaction WHERE appName='publish' SINCE 10 minutes ago`
- **`aem.author.unresponsive`** — Author p95 > 5s for 5 min → **P2** → runbook `#author-slowdown`
  - Datadog: `avg(last_5m):p95:aem.author.request.duration{env:$env} > 5000` <!-- verify unit ms vs s -->
- **`aem.replication.queue.depth.high`** — queue depth > 100 for 10 min → **P1** → runbook `#replication-queue-clog`
  - Datadog: `avg(last_10m):max:aem.replication.queue_depth{env:$env} by {subscriber} > 100`
  - Prometheus: `max_over_time(aem_replication_queue_depth[10m]) > 100`
- **`aem.cm.quality_gate.fail`** — Cloud Manager quality-gate status = FAIL → **P2** (pipeline-blocking, notification-only)
  - Datadog: event stream tag `source:cloud-manager status:FAIL`
- **`aem.cf.publication.lag`** — CF publication lag p95 > 2 min for 10 min → **P2** → runbook `#cf-publication-lag`
  - Datadog: `avg(last_10m):p95:aem.cf.publish_lag_seconds{env:$env} > 120`
- **`aem.bundle.installed.gt_zero`** — any bundle in `INSTALLED` state > 5 min post-deploy → **P2** → runbook `#publish-5xx-spike`
  - Prometheus: `sum(aem_bundle_state{state="INSTALLED"}) > 0`
- **`aem.graphql.error_rate.high`** — persisted-query error rate > 2% for 10 min → **P2**
  - Datadog: `sum(last_10m):sum:aem.graphql.errors{env:$env}.as_count() / sum:aem.graphql.requests{env:$env}.as_count() > 0.02`
- **`aem.sling.job.backlog.high`** — Sling job queue depth > 500 per topic for 15 min → **P3**
- **`aem.dam.upload.fail_rate`** — DAM upload failure > 5% for 15 min → **P2**

## Alert severity mapping for AEM

- **P1 (pages primary + secondary immediately):** `aem.publish.5xx.high`,
  `aem.replication.queue.depth.high` (customer-visible content freeze),
  `aem.dispatcher.origin_error_spike` after deploy. Revenue-blocking or
  data-freshness violation.
- **P2 (pages primary; secondary notified in-hours):** dispatcher hit-ratio,
  Author unresponsive, CF publication lag, GraphQL errors, bundle stuck
  `INSTALLED`, Cloud Manager quality-gate fail (pipeline-block).
- **P3 (notification-only, in-hours):** Sling job backlog, DAM asset-processing
  slow, JVM heap warning (< 90%).

## Alert-noise guidance for AEM

- **All:** minimum 3-datapoint sustained window; no single-spike alerts.
- **Dispatcher hit-ratio** should exclude bot traffic (filter by
  `user_agent:!bot`) — search crawlers hammer MISS paths and skew the ratio.
- **Author-slowdown** should exclude scheduled backup windows (silence via
  `.bmad/conventions.yaml` cron windows) — nightly snapshots peg the JVM.
- **Publish 5xx** should segment by URL path — a single `/loyalty/*`
  regression should not silence a broader storefront spike.
- **Cloud Manager quality-gate** alerts should skip `dev` + `stage` pipelines
  by default; only prod-tier pipeline failures should page.
- **Replication queue** alerts should skip planned publisher-instance
  maintenance windows.

## Composite / multi-signal alerts for AEM

- **`aem.publish.degraded`** — `dispatcher_hit_ratio < 90% AND publish_5xx > 0.5%`
  for 10 min → P1. Rules out an edge-only misconfig and pages only on a
  real origin regression.
- **`aem.author.starved`** — `author_p95 > 5s AND jcr_session_count > 200 AND jvm_heap > 85%`
  for 5 min → P2. Rules out cold-start or a single slow query.
- **`aem.deploy.regressed`** — `cloud_manager_execution=SUCCESS AND publish_5xx > 1%`
  within 15 min of deploy → P1. Confirms deploy-triggered regression before rollback.

## Alert deduplication / grouping for AEM

- **Datadog:** group_by `env,tier,farm`; suppress duplicates within 5 min per
  `service:aem` scope; multi-alert grouping under the `AEM` monitor folder.
- **Prometheus Alertmanager:** routes tree → per-tier team routing
  (`tier: publish → team-aem-publish`, `tier: author → team-aem-editorial`,
  `tier: dispatcher → team-dispatcher-admin`); `group_wait: 30s`,
  `group_interval: 5m`, `repeat_interval: 4h`.
- **PagerDuty:** incident merging on alert-key prefix `aem.publish.*` within
  15-min window; separate service for `aem.dispatcher.*`.

## On-call escalation policy per AEM

- **Primary (0 min):** on-call AEM engineer (`@aem-oncall`).
- **Secondary (10 min, no ack):** dispatcher-admin (`@dispatcher-admin`) for
  edge alerts; AEM tech lead for bundle / OSGi alerts.
- **Tertiary (25 min, no ack):** engineering manager (`@aem-em`).
- **Vendor (60 min or manual):** Adobe Customer Care P1 case with Cloud
  Manager program ID + execution ID for AEMaaCS platform issues.

## Alerting cadence / silences for AEM

- **Silences during Cloud Manager quality-gate runs** — `aem.publish.5xx.high`
  and `aem.dispatcher.hit_ratio.low` silenced from `deploy_start` to
  `deploy_start + 15m` on the target env (`cloud_manager.execution.state`
  webhook drives silence). <!-- verify: silence-webhook path -->
- **Silences during scheduled CF republish jobs** — CF publication-lag alerts
  paused during editorial bulk-publish windows.
- **After-hours reduction for P3** — Sling job backlog + DAM asset-processing
  alerts delivery-only (Slack), no page, between 20:00–08:00 local.

## 2 worked alert-rule examples for AEM

### Example 1 — Publish 5xx spike (Datadog)

```yaml
name: "[prod] aem-publish — 5xx rate > 1% for 10 min"
type: query alert
query: 'sum(last_10m):100 * sum:aem.publish.http.5xx{env:prod, tier:publish}.as_count() / sum:aem.publish.http.total{env:prod, tier:publish}.as_count() > 1'
message: |
  Publish 5xx > 1% for 10 min. Runbook: RUNBOOK-aem.md#publish-5xx-spike
  @pagerduty-aem-oncall
tags: [service:aem, env:prod, tier:publish, severity:sev1]
priority: 1
monitor_thresholds: { critical: 1, warning: 0.5 }
notify_no_data: false
```

### Example 2 — Replication clog (Prometheus)

```yaml
- alert: AemReplicationQueueClog
  expr: max_over_time(aem_replication_queue_depth{env="prod"}[10m]) > 100
  for: 10m
  labels: { severity: sev1, team: aem-publish, tier: publish }
  annotations:
    summary: "AEM replication queue > 100 for 10 min on {{ $labels.subscriber }}"
    runbook: "runbooks/aem.md#replication-queue-clog"
    dashboard: "grafana/aem-publish-tier?var-env=prod"
```

## Anti-patterns to avoid for AEM

- **Alerting on Author-tier metrics from Publish-tier queries** — different
  services, different pages, different owners.
- **Paging on dispatcher MISS-rate alone** — MISS is normal for personalized
  paths; page on hit-ratio composite with origin-error.
- **No Cloud Manager execution ID in the alert message** — Adobe support
  cannot correlate; always include `program_id` + `execution_id` tags.
- **Alerting on `/system/console/*` availability on Publish in prod** —
  these endpoints are locked in AEMaaCS; use `dispatcher/publish/health`.
- **Static thresholds on GraphQL error rate** — persisted-query rollouts
  spike briefly; use anomaly detection or 15-min window minimum.

---

Generate the full alert-rules file using the appropriate `templates/alerts-<target>.yaml` as the master, populating placeholders with stack-appropriate content from the guide above.
