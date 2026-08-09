# Alert-rule authoring guide — Spring Boot

## Purpose framing

A Spring Boot alert pages the service SRE, platform on-call, or Kafka
consumer team only when a **service SLO regression, JVM saturation, or
downstream-dep failure** actually degrades the service — not on K8s
pod cold-start noise or a single request outlier. Every rule links to a
runbook symptom in `resources/runbook-templates/spring.md`. Prefer
Micrometer-emitted `http.server.requests` + `jvm.*` + `hikaricp.*`
metrics; every alert should tag `service` + `env` + `instance`.

## Alert catalog for Spring — must-have rules

- **`spring.actuator.health.down`** — `/actuator/health` returns `DOWN` for any dep > 3 min → **P1** → runbook `#actuator-health-down`
  - Datadog: `avg(last_3m):min:spring.actuator.health{service:$service, env:$env, component:*} < 1` <!-- verify: 1=UP mapping -->
  - Prometheus: `min_over_time(spring_boot_actuator_health{service="$service"}[3m]) == 0`
  - New Relic: `SELECT latest(status) FROM SpringActuatorHealth WHERE service='$service' FACET component`
- **`spring.rest.p99.high`** — HTTP p99 > 2s sustained 5 min → **P2** → runbook `#latency-spike`
  - Datadog: `avg(last_5m):p99:http.server.requests{service:$service, env:$env, uri:!/actuator/*} > 2s`
  - Prometheus: `histogram_quantile(0.99, sum by (le, uri) (rate(http_server_requests_seconds_bucket{service="$service"}[5m]))) > 2`
- **`spring.rest.error_rate.high`** — 5xx > 1% for 10 min → **P1** → runbook `#5xx-spike`
- **`spring.k8s.crashloop`** — CrashLoopBackoff on ≥ 2 pods → **P1** → runbook `#pod-crashloop`
  - Prometheus: `sum by (deployment) (kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff", deployment="$service"}) >= 2`
- **`spring.kafka.consumer.lag.high`** — consumer lag > 10s (or > 1000 msgs) for 15 min → **P2** → runbook `#kafka-consumer-lag`
  - Datadog: `avg(last_15m):max:kafka.consumer.lag{consumer_group:$group, env:$env} by {partition} > 1000`
- **`spring.jvm.heap.high`** — JVM heap used > 90% for 10 min → **P2** → runbook `#heap-pressure`
  - Prometheus: `(jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"}) > 0.9`
- **`spring.hikari.saturation`** — HikariCP active/max > 90% for 10 min → **P2** → runbook `#db-pool-exhausted`
  - Prometheus: `(hikaricp_connections_active / hikaricp_connections_max) > 0.9`
- **`spring.gc.pause.high`** — G1 pause p99 > 500ms for 10 min → **P2**
- **`spring.thread_pool.queue.deep`** — thread-pool queue depth > 100 for 10 min → **P3**
- **`spring.db.slow_query.spike`** — DB slow queries > 50/min for 10 min → **P2**
- **`spring.deploy.regressed`** — deploy_end + 10 min AND (5xx > 1% OR p99 > 2s) → **P1**

## Alert severity mapping for Spring

- **P1:** actuator health DOWN, 5xx spike, CrashLoopBackoff, deploy
  regression. Service-availability at risk.
- **P2:** p99 latency, Kafka consumer lag, JVM heap, HikariCP saturation,
  G1 pauses, DB slow-query spike.
- **P3:** thread-pool queue depth, log-error rate on non-critical routes,
  cold-start count warnings.

## Alert-noise guidance for Spring

- **All:** minimum 3-datapoint window; exclude `/actuator/*` from
  latency + error alerts.
- **p99 alerts** should exclude K8s pod cold-start (first 30s after
  `pod_ready`) — JIT warmup causes false positives.
- **Kafka consumer lag** should skip partition rebalance windows (first
  60s after `consumer_rebalance` event); use per-partition query so one
  rebalancing partition does not silence a real stall.
- **Actuator health DOWN** should not page during liveness-probe grace
  window (K8s handles restart); page only on readiness `DOWN` sustained.
- **JVM heap** alerts should skip planned GC-tuning experiments (tagged
  windows via `.bmad/conventions.yaml`).
- **HikariCP saturation** should exclude batch-job pods (naturally saturate);
  filter by `role:web`.

## Composite / multi-signal alerts for Spring

- **`spring.overload`** — `p99 > 1s AND kafka_lag > 5s AND hikari > 90%`
  for 5 min → P1. Real service overload — rules out single-metric spike.
- **`spring.dep.degraded`** — `actuator_health=DOWN AND downstream_p99 > 1s`
  for 5 min → P2. Confirms it is downstream, not local.
- **`spring.jvm.stalled`** — `heap > 90% AND gc_pause > 500ms AND req_rate < 50%_baseline`
  for 5 min → P1. GC death spiral, restart the pod.

## Alert deduplication / grouping for Spring

- **Datadog:** group_by `service,env,instance,deployment`; suppress
  duplicates within 5 min per `service:$service` scope.
- **Prometheus Alertmanager:** routes → per-service team based on
  `service` label (`team-checkout`, `team-catalog`, `team-orders`).
  `group_wait: 30s`, `group_interval: 5m`, `repeat_interval: 4h`.
- **PagerDuty:** merge on `spring.$service.*` prefix within 15 min;
  separate services per team.

## On-call escalation policy per Spring

- **Primary (0 min):** on-call SRE for the owning team (`@team-$service`).
- **Secondary (10 min):** service-owner engineer (from `CODEOWNERS`) for
  business-logic / API alerts; platform-SRE for JVM / K8s / Hikari alerts.
- **Tertiary (25 min):** platform-lead → engineering manager.
- **Vendor (60 min):** Confluent for managed Kafka; RDS / Aurora support
  for managed DB; K8s platform team for cluster-level issues.

## Alerting cadence / silences for Spring

- **Silences during DB migration windows** — HikariCP + DB slow-query
  alerts silenced from `migration_start` to `migration_start + T` (T from
  Liquibase / Flyway job runtime).
- **Silences during rolling deploys** — actuator + 5xx alerts silenced
  from `deploy_start` to `deploy_start + 10m`; `spring.deploy.regressed`
  fires past that boundary.
- **After-hours reduction for P3** — thread-pool queue + log-error
  alerts delivery-only Slack between 20:00–08:00 local.

## 2 worked alert-rule examples for Spring

### Example 1 — 5xx spike (Datadog)

```yaml
name: "[prod] {{service}} — 5xx rate > 1% for 10 min"
type: query alert
query: 'sum(last_10m):100 * sum:http.server.requests.count{service:$service, env:prod, status:5xx}.as_count() / sum:http.server.requests.count{service:$service, env:prod}.as_count() > 1'
message: |
  {{service.name}} 5xx > 1% for 10 min.
  Runbook: RUNBOOK-spring.md#5xx-spike
  @pagerduty-{{service.name}}-oncall
tags: [service:{{service}}, env:prod, severity:sev1]
priority: 1
monitor_thresholds: { critical: 1, warning: 0.5 }
```

### Example 2 — Kafka consumer lag (Prometheus)

```yaml
- alert: SpringKafkaConsumerLag
  expr: max_over_time(kafka_consumergroup_lag{consumergroup="$group"}[15m]) > 1000
  for: 15m
  labels: { severity: sev2, team: "{{ $labels.team }}" }
  annotations:
    summary: "Kafka consumer {{ $labels.consumergroup }} lag > 1000 for 15 min"
    runbook: "runbooks/spring.md#kafka-consumer-lag"
    dashboard: "grafana/spring-kafka?var-group={{ $labels.consumergroup }}"
```

## Anti-patterns to avoid for Spring

- **Alerting on `/actuator/health` liveness before readiness** — K8s
  handles liveness via probe restart; page on readiness sustained DOWN only.
- **Static p99 threshold across all endpoints** — long-tail admin endpoints
  will always trigger; scope by `uri` group or per-endpoint SLO.
- **No `instance` label in the alert** — cannot triage per-pod without it;
  hot-pod scenarios go invisible in aggregates.
- **Paging on cold-start JVM p99** — first 30s of a pod is always slow;
  exclude window.
- **Alerting on Kafka lag without partition breakdown** — one rebalancing
  partition otherwise looks like a stall.

---

Generate the full alert-rules file using the appropriate `templates/alerts-<target>.yaml` as the master, populating placeholders with stack-appropriate content from the guide above.
