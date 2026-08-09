# Dashboard authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a dashboard for an Adobe App Builder project
(serverless actions on Adobe I/O Runtime + I/O Events + State/Files SDK).
Combine with the appropriate `templates/dashboard-<target>.{json,yml}`
as the master skeleton.

## Purpose framing

An App Builder dashboard is watched by extension owners and the on-call
for Adobe integrations. Because the runtime is serverless-hosted by
Adobe, teams do not run servers — the dashboard therefore surfaces
**action-level health** (activations/day, duration, failure rate),
**I/O Event delivery** (lag, retries, dead-letters), **namespace
quotas** (activations/day, concurrent, memory), and **cold-start
impact**. IMS token lifecycle and API Mesh resolver latency are the two
most-common cross-cutting incident surfaces.

## Signal catalog for App Builder

### Golden signals (RED / USE)

- **Latency** — action duration `p95` per action, mesh resolver `p95`.
- **Traffic** — action activation count per action, I/O Event delivery rate
  per event-type.
- **Errors** — action failure rate per action, I/O Event delivery retries +
  DLQ rate, IMS token exchange failures.
- **Saturation** — namespace activations/day vs quota, concurrent activations
  vs quota, action memory usage vs limit, State SDK read/write vs quota.

### Stack-native signals

- **Cold-start count per action** — signals action churn + memory pressure.
- **I/O Event delivery lag per event-type** — the async-integration SLI.
- **State SDK read/write count + latency**.
- **Files SDK operation count + latency**. <!-- verify: current Files SDK metric names -->
- **API Mesh resolver latency + 5xx per resolver**.
- **IMS token cache miss rate** (extensions typically cache IMS tokens per action).
- **Namespace quota headroom** — activations/day, concurrent, memory-GB-sec.
- **Action activation-by-trigger source** (HTTP / event / scheduled).

## Widget catalog for App Builder

- **Action duration p95 top-list** (top-list)
  - Datadog: `top(avg:appbuilder.action.duration.p95{env:$env, namespace:$namespace} by {action_name}, 10, 'mean', 'desc')` <!-- verify -->
  - CloudWatch equivalent: `AVG(action_duration_ms) BY action_name` <!-- verify -->
  - Alert cross-ref: `resources/alert-rules/app-builder.md#action-duration-breach`
- **Action failure rate per action** (top-list)
  - Datadog: `top(100 * sum:appbuilder.action.failures{env:$env} by {action_name}.as_count() / sum:appbuilder.action.activations{env:$env} by {action_name}.as_count(), 10, 'sum', 'desc')`
- **Action activations/day vs namespace quota** (query_value with quota marker)
- **Concurrent activations vs quota** (timeseries with quota marker)
- **I/O Event delivery lag per event-type** (heatmap)
  - Datadog: `avg:appbuilder.io_events.delivery_lag_seconds{env:$env} by {event_type}` <!-- verify -->
- **I/O Event DLQ rate** (timeseries — critical alert surface)
- **Cold-start count per action** (top-list)
  - Datadog: `top(sum:appbuilder.action.cold_starts{env:$env} by {action_name}.as_count(), 10, 'sum', 'desc')`
- **State SDK read/write rate + p95 latency** (timeseries dual axis)
- **API Mesh resolver p95 top-list** (top-list)
- **IMS token cache miss rate** (query_value)
- **Action activations by trigger source** (pie / distribution)
- **Deploy markers per namespace** (event_stream — `aio app deploy` events)

## Template variables for App Builder

- Common: `env`, `service`, `region`
- App-Builder-specific: `namespace` (Adobe I/O namespace), `action_name`,
  `workspace` (dev/stage/prod), `event_type` (I/O Events),
  `resolver_name` (API Mesh), `ims_org_id`.

## Dashboard layout for App Builder

- **Row 1 — Health-at-a-glance:** action failure rate < 1%, namespace
  quota headroom > 20%, I/O Event DLQ rate = 0, IMS token exchange
  success > 99.9%.
- **Row 2 — Golden signals (2×2):** action duration p95 top-list, action
  failure rate top-list, activation count per action, memory-GB-sec vs quota.
- **Row 3 — App-Builder-native:** I/O Event delivery lag heatmap, cold-start
  count per action, State SDK read/write, mesh resolver p95 top-list.
- **Row 4 — Top-N:** top-10 failing actions, top-10 slow actions, top-10
  I/O Event lag by event-type, top-10 mesh resolver 5xx.
- **Row 5 — Release / on-call:** last `aio app deploy` per namespace, active
  on-call, SLO error-budget burn (per-action), IMS token cache stats.

## Per-platform preferences for App Builder

- **Adobe I/O Runtime logs** — the native surface; every dashboard also
  needs a linked log-query panel to the Runtime log stream.
- **Datadog** — most common external APM choice; forward Runtime logs via
  Log Forwarding to Datadog Logs.
- **CloudWatch** — App Builder actions historically ran on AWS Lambda under
  the hood — some orgs forward metrics to CloudWatch; declining but present.
- **Splunk** — for orgs standardized on Splunk log analytics; Runtime log
  forwarding via HTTP Event Collector.
- **New Relic** — less common; used when the extension is embedded inside a
  New-Relic-monitored product surface.

## 2 worked dashboard examples for App Builder

### Example: `commerce-integration-actions` (extension-side actions)

- Master template: `templates/dashboard-datadog.json`
- Template vars: `env=prod`, `namespace=commerce-integrations`, `action_name=*`
- Widgets: action duration p95 top-10, action failure rate top-10, cold-start
  count per action, memory-GB-sec vs quota, mesh resolver p95, IMS token cache
  miss rate, deploy markers (`aio app deploy`), top-10 failing actions.
- Notify: `#appbuilder-oncall` on action failure > 1% for 5m.

### Example: `io-events-consumers` (event-driven workers)

- Master template: `templates/dashboard-cloudwatch.json`
- Template vars: `env=prod`, `namespace=events-consumers`, `event_type=*`
- Widgets: I/O Event delivery lag heatmap per event-type, DLQ rate, event
  processing p95 per event-type, State SDK read/write, retries per event-type,
  activation count per event trigger, cold-start count.
- Notify: `#appbuilder-events` on DLQ > 0 for any event-type.

## Anti-patterns to avoid for App Builder

- **Skipping namespace quotas.** Quotas are hard limits — hitting one blocks
  all activations, and it happens silently. Quota headroom belongs in row-1.
- **No I/O Event DLQ panel.** DLQ ≠ empty is a real incident (customer event
  not delivered) — leaving it off the dashboard means on-call finds out from
  the downstream team.
- **Aggregating actions without a `namespace` filter.** Multi-workspace
  installs mix dev/stage/prod telemetry — always filter by namespace.
- **No cold-start visualization.** Cold-start regressions are silent latency
  killers — needs a per-action panel, not a rolled-up average.
- **Dashboarding Runtime logs inline without a filter.** Runtime log volume
  is high; embed pre-filtered saved searches, not raw log streams.

---

Generate the full dashboard using the appropriate `templates/dashboard-<target>.json`
or `templates/dashboard-<target>.yml` as the master, populating placeholders
with stack-appropriate content from the guide above.
