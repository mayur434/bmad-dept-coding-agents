# Alert-rule authoring guide — Apache Sling / Shaft (sling-12)

## Purpose framing

A Sling / Shaft alert pages the OSGi platform on-call, MDM owner, or SAM
API team only when a **bundle state divergence, MDM CRUD latency
regression, or SAM API 5xx spike** breaks a customer-visible flow — not
on OSGi refresh churn during deploy. Every rule links to a runbook
symptom in `resources/runbook-templates/sling.md`. Tag every alert with
`bundle_symbolic_name`, `sling_topic`, or `feature_model_hash` for triage.

## Alert catalog for Sling — must-have rules

- **`sling.bundle.stuck_resolved`** — any bundle in `RESOLVED` (not `ACTIVE`) > 5 min post-deploy → **P2** → runbook `#bundle-stuck-resolved`
  - Datadog: `avg(last_5m):sum:sling.bundle.state{env:$env, state:resolved} > 0`
  - Prometheus: `sum(sling_bundle_state{state="RESOLVED"}) > 0`
  - New Relic: `SELECT count(*) FROM SlingBundleState WHERE state='RESOLVED' AND env='prod' SINCE 5 minutes ago`
- **`sling.bundle.installed_gt_zero`** — bundles in `INSTALLED` state (unresolved dependencies) > 0 for 5 min → **P1** → runbook `#bundle-install-failure`
- **`sling.mdm.crud.latency.high`** — MDM CRUD p95 > 500ms for 10 min → **P2** → runbook `#mdm-slowdown`
  - Datadog: `avg(last_10m):p95:sling.mdm.crud.duration{env:$env, op:!list} > 500`
  - Prometheus: `histogram_quantile(0.95, sum by (le, op) (rate(sling_mdm_crud_duration_seconds_bucket[10m]))) > 0.5`
- **`sling.sam.api.5xx.high`** — SAM API 5xx > 1% for 10 min → **P1** → runbook `#sam-api-5xx`
  - Prometheus: `100 * sum(rate(sling_sam_api_requests_total{code=~"5.."}[10m])) / sum(rate(sling_sam_api_requests_total[10m])) > 1`
- **`sling.job.queue.depth.high`** — Sling job queue depth > 500 per topic for 15 min → **P2** → runbook `#job-queue-backlog`
  - Datadog: `avg(last_15m):max:sling.job.queue_depth{env:$env} by {topic} > 500`
- **`sling.jcr.session.leak`** — active JCR sessions > 200 sustained 15 min → **P2** → runbook `#jcr-session-leak`
  - Prometheus: `max_over_time(sling_jcr_active_sessions[15m]) > 200`
- **`sling.feature_model.divergence`** — installed Feature Model hash != declared hash → **P1** → runbook `#feature-model-drift`
- **`sling.service.availability`** — service unavailability count > 0 for 5 min → **P2** (per `org.osgi.service.*`)
- **`sling.system.console.5xx`** — `/system/console/bundles` returns 5xx → **P2**
- **`sling.deploy.regressed`** — deploy_end + 10 min AND (bundle_stuck > 0 OR sam_5xx > 1%) → **P1**

## Alert severity mapping for Sling

- **P1:** bundles stuck `INSTALLED` (unresolved deps), SAM API 5xx, Feature
  Model divergence, deploy-triggered regression. Platform stability at risk.
- **P2:** bundles stuck `RESOLVED`, MDM CRUD latency, job queue backlog,
  JCR session leak, service unavailability, `/system/console` 5xx.
- **P3:** OSGi component refresh churn during quiet periods, cold-start
  activator delays, non-critical service warnings.

## Alert-noise guidance for Sling

- **All:** minimum 3-datapoint window; tag by `bundle_symbolic_name`.
- **Bundle-state alerts** should skip the first 90s post-deploy — normal
  OSGi refresh churn resolves within that window.
- **MDM CRUD latency** should exclude `list` / bulk ops (naturally slower);
  page on point-lookup + create + update p95 only.
- **SAM API 5xx** should exclude documented `429` throttling responses
  (client backpressure signal, not server fault).
- **JCR session leak** should skip scheduled bulk-import jobs (session
  count naturally spikes during import windows).
- **Job queue depth** should be tagged `topic` — one poison-message topic
  should not silence the rest.

## Composite / multi-signal alerts for Sling

- **`sling.platform.degraded`** — `bundle_stuck > 0 AND sam_5xx > 0.5%`
  for 10 min → P1. Rules out isolated bundle churn vs API-affecting outage.
- **`sling.mdm.stalled`** — `mdm_p95 > 500ms AND jcr_sessions > 200 AND job_queue > 500`
  for 15 min → P2. Confirms persistence-layer stall vs single slow query.
- **`sling.deploy.failed`** — `feature_model_divergence AND bundle_installed > 0`
  → P1. Deploy did not fully activate.

## Alert deduplication / grouping for Sling

- **Datadog:** group_by `env,bundle_symbolic_name,topic`; suppress
  duplicates within 5 min per `service:sling`.
- **Prometheus Alertmanager:** routes → `team-osgi-platform` for bundle /
  Feature Model; `team-mdm` for MDM CRUD; `team-sam` for SAM API.
  `group_wait: 30s`.
- **PagerDuty:** merge on `sling.bundle.*` prefix within 10 min; separate
  service for `sling.sam.*` (customer-facing API).

## On-call escalation policy per Sling

- **Primary (0 min):** OSGi platform on-call (`@sling-platform`).
- **Secondary (10 min):** MDM owner for `mdm.*`; SAM API team for `sam.*`;
  Feature Model owner for `feature_model.*`.
- **Tertiary (25 min):** Sling / Shaft tech lead → engineering manager.
- **Vendor (60 min):** Apache Sling community only for platform bugs; no
  vendor support tier — L3 owns fixes.

## Alerting cadence / silences for Sling

- **Silences during Feature Model deploys** — bundle-state alerts silenced
  from `deploy_start` to `deploy_start + 5m`; `sling.deploy.regressed`
  fires past that boundary.
- **Silences during scheduled MDM bulk-import** — MDM CRUD latency +
  JCR-session alerts paused (import cron windows read from
  `.bmad/conventions.yaml`).
- **After-hours reduction for P3** — refresh churn + cold-start delays
  delivery-only Slack overnight.

## 2 worked alert-rule examples for Sling

### Example 1 — Bundle stuck RESOLVED (Datadog)

```yaml
name: "[prod] sling — bundle {{bundle_symbolic_name}} stuck RESOLVED > 5 min"
type: query alert
query: 'avg(last_5m):sum:sling.bundle.state{env:prod, state:resolved} by {bundle_symbolic_name} > 0'
message: |
  Bundle {{bundle_symbolic_name.name}} in RESOLVED > 5 min post-deploy.
  Check /system/console/bundles for missing dependency or classpath issue.
  Runbook: RUNBOOK-sling.md#bundle-stuck-resolved
  @pagerduty-sling-platform
tags: [service:sling, env:prod, severity:sev2, bundle:{{bundle_symbolic_name}}]
priority: 2
monitor_thresholds: { critical: 0, warning: 0 }
```

### Example 2 — SAM API 5xx (Prometheus)

```yaml
- alert: SlingSamApi5xxSpike
  expr: 100 * sum(rate(sling_sam_api_requests_total{code=~"5.."}[10m])) / sum(rate(sling_sam_api_requests_total[10m])) > 1
  for: 10m
  labels: { severity: sev1, team: sam-api }
  annotations:
    summary: "SAM API 5xx > 1% for 10 min"
    runbook: "runbooks/sling.md#sam-api-5xx"
    dashboard: "grafana/sling-sam?var-env=prod"
```

## Anti-patterns to avoid for Sling

- **Alerting on every bundle-refresh event** — OSGi resolves and re-resolves
  during deploy; only page on sustained non-ACTIVE state.
- **Ignoring `feature_model_hash` in the alert message** — cannot correlate
  drift vs declared model without it.
- **Page on `/system/console/status-productinfo` slow response** — this
  endpoint scans the runtime and is inherently slow; use a synthetic health
  endpoint instead.
- **Static thresholds on JCR session count** — varies by workload; use
  % change from 7-day baseline.
- **No topic in job-queue alerts** — a single poison-message topic
  otherwise silences the whole platform.

---

Generate the full alert-rules file using the appropriate `templates/alerts-<target>.yaml` as the master, populating placeholders with stack-appropriate content from the guide above.
