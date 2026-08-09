# Alert-rule authoring guide — Adobe App Builder

## Purpose framing

An App Builder alert pages the runtime on-call, integrations owner, or
event-consumer team only when an **action error rate spike, I/O Event
delivery lag, or namespace quota exhaustion** breaks a downstream
consumer flow — not on cold-start noise or a single retry. Every rule
links to a runbook symptom in `resources/runbook-templates/app-builder.md`.
Tag every alert with `namespace`, `action`, `event_type` for triage —
multi-workspace / multi-namespace deployments must not aggregate blindly.

## Alert catalog for App Builder — must-have rules

- **`appbuilder.action.error_rate.high`** — action error rate > 5% for 10 min → **P1** → runbook `#action-error-spike`
  - Datadog: `sum(last_10m):sum:appbuilder.action.error{namespace:$ns, action:$action}.as_count() / sum:appbuilder.action.invocation{namespace:$ns, action:$action}.as_count() > 0.05`
  - CloudWatch: `SUM(errors) / SUM(invocations) OVER 10m > 0.05` per action metric filter
  - Prometheus: `sum(rate(openwhisk_action_error_total{namespace="$ns", action="$action"}[10m])) / sum(rate(openwhisk_action_invocation_total{namespace="$ns", action="$action"}[10m])) > 0.05` <!-- verify: metric names via Runtime forwarding -->
- **`appbuilder.action.p95.high`** — action p95 duration > 30s for 15 min → **P2** → runbook `#action-slow`
  - CloudWatch: `PERCENTILE(duration, 95) > 30000 OVER 15m` per action
- **`appbuilder.event.delivery.lag`** — I/O Event delivery lag > 5 min for 15 min → **P2** → runbook `#event-lag`
  - New Relic: `SELECT max(deliveryLagSeconds) FROM AdobeIoEventDelivery WHERE providerId='$pid' SINCE 15 minutes ago`
- **`appbuilder.event.dead_letter`** — dead-letter queue depth > 0 for 5 min → **P1** → runbook `#event-dlq`
- **`appbuilder.namespace.quota.high`** — namespace usage > 80% of activations/day OR concurrent-invocation quota → **P3** → runbook `#quota-headroom`
  - Datadog: `avg(last_1h):avg:appbuilder.namespace.activations_used_pct{namespace:$ns} > 80`
- **`appbuilder.ims.token.fail`** — IMS token fetch failure > 1% for 10 min → **P2** → runbook `#ims-auth-failure`
- **`appbuilder.state.error_rate`** — State SDK error rate > 2% for 10 min → **P2**
- **`appbuilder.mesh.resolver.p95.high`** — API Mesh resolver p95 > 1s for 10 min → **P2** (when Mesh is deployed via App Builder)
- **`appbuilder.cold_start.rate`** — cold-start rate > 20% for 30 min → **P3** (headroom / warmup signal)
- **`appbuilder.deploy.regressed`** — deploy_end + 10 min AND action_error_rate > 5% → **P1**

## Alert severity mapping for App Builder

- **P1:** action error rate spike, dead-letter queue depth > 0, deploy
  regression, IMS auth cascade. Downstream consumers broken.
- **P2:** action p95 duration, event delivery lag, State SDK errors, API
  Mesh resolver latency, IMS token failure rate.
- **P3:** namespace quota headroom warnings, cold-start rate, log-error
  spikes on non-critical actions.

## Alert-noise guidance for App Builder

- **All:** minimum 3-datapoint window; tag by `namespace` and `action`.
- **Action p95** should exclude first 60s post-deploy (cold-start on new
  action version is expected).
- **Cold-start rate** alerts should skip low-traffic periods (< 10
  invocations/min) — cold-start ratio is meaningless without volume.
- **Event delivery lag** should tag by `event_provider_id` — one slow
  provider should not silence others.
- **IMS token failures** should skip the first 60s of an action's lifetime
  (initial token acquisition normally retries).
- **Namespace quota** should be evaluated per-workspace — dev/stage/prod
  usage patterns differ dramatically.

## Composite / multi-signal alerts for App Builder

- **`appbuilder.integration.stalled`** — `event_lag > 5min AND action_error > 2% AND dlq_depth > 0`
  for 10 min → P1. Confirms integration-pipeline stall vs single-action fault.
- **`appbuilder.auth.cascade`** — `ims_fail > 1% AND action_error > 5%`
  for 5 min → P1. IMS outage cascading — page immediately.
- **`appbuilder.deploy.broken`** — `deploy_success AND action_error > 5% within 10min`
  → P1. Roll back the deploy.

## Alert deduplication / grouping for App Builder

- **Datadog:** group_by `namespace,action,workspace`; suppress duplicates
  within 5 min per `service:appbuilder`.
- **CloudWatch:** composite alarms per namespace-action combo; SNS-fanout
  to PagerDuty topics.
- **PagerDuty:** merge on `appbuilder.$namespace.action.*` prefix within
  10 min; separate service for `appbuilder.$namespace.event.*` (consumer team).

## On-call escalation policy per App Builder

- **Primary (0 min):** runtime on-call (`@appbuilder-oncall`).
- **Secondary (10 min):** action owner (from action manifest metadata) for
  `action.*`; event-consumer team for `event.*`; integrations lead for
  `mesh.*` / `ims.*`.
- **Tertiary (25 min):** App Builder tech lead → engineering manager.
- **Vendor (30 min for runtime):** Adobe App Builder support with
  `namespace` + `activationId` + `correlation_id`; escalate directly for
  Runtime platform / I/O Events outages.

## Alerting cadence / silences for App Builder

- **Silences during action deploys** — action-error + p95 alerts silenced
  from `deploy_start` to `deploy_start + 5m`; `appbuilder.deploy.regressed`
  fires past.
- **Silences during scheduled event backfill** — DLQ + event-lag alerts
  paused during declared backfill windows.
- **Quota-warning cadence** — P3 quota alerts fire once per hour per
  namespace (avoid pager fatigue on slow-burn quota consumption).
- **After-hours reduction** for P3 — cold-start + quota warnings
  delivery-only Slack overnight.

## 2 worked alert-rule examples for App Builder

### Example 1 — Action error rate spike (Datadog)

```yaml
name: "[prod] appbuilder — {{action}} error rate > 5% for 10 min"
type: query alert
query: 'sum(last_10m):sum:appbuilder.action.error{namespace:prod-consumer, action:$action}.as_count() / sum:appbuilder.action.invocation{namespace:prod-consumer, action:$action}.as_count() > 0.05'
message: |
  Action {{action.name}} error rate > 5% for 10 min in prod-consumer.
  Include activationId in triage: aio rt:activation:list --limit 20 --skip 0
  Runbook: RUNBOOK-app-builder.md#action-error-spike
  @pagerduty-appbuilder-oncall
tags: [service:appbuilder, namespace:prod-consumer, action:{{action}}, severity:sev1]
priority: 1
monitor_thresholds: { critical: 0.05, warning: 0.02 }
```

### Example 2 — I/O Event dead-letter (Prometheus, via CloudWatch exporter)

```yaml
- alert: AppBuilderEventDLQ
  expr: adobe_io_event_dlq_depth{provider_id="$pid"} > 0
  for: 5m
  labels: { severity: sev1, team: integrations }
  annotations:
    summary: "I/O Event DLQ non-empty for provider {{ $labels.provider_id }}"
    runbook: "runbooks/app-builder.md#event-dlq"
    action: "Inspect DLQ payloads before replaying; aio event:consumer:list"
```

## Anti-patterns to avoid for App Builder

- **Alerting on action cold-starts without volume gate** — cold-start ratio
  is noise below ~10 invocations/min.
- **Missing `activationId` in the alert message** — you cannot correlate
  to Runtime logs without it.
- **Paging on `429` throttle responses** — throttling is expected under
  burst; page on quota-headroom trending down instead.
- **No `namespace` tag** — multi-workspace deployments otherwise merge
  dev noise into prod pages.
- **Alerting on API Mesh resolver p95 without `resolver` tag** — one slow
  federated source silences the rest.

---

Generate the full alert-rules file using the appropriate `templates/alerts-<target>.yaml` as the master, populating placeholders with stack-appropriate content from the guide above.
