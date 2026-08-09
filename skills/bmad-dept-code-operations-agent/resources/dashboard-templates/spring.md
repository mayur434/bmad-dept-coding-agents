# Dashboard authoring guide — Spring Boot

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a dashboard for a Spring Boot service (Micrometer
+ Actuator, typically K8s-hosted). Combine with the appropriate
`templates/dashboard-<target>.{json,yml}` as the master skeleton.

## Purpose framing

A Spring Boot dashboard is watched by service owners, platform SREs, and
the K8s cluster operator. It must expose the **Actuator health matrix**
(readiness + liveness + per-dependency), **Micrometer golden signals**
(HTTP p99, JVM heap, HikariCP saturation), and **downstream
integration health** (Kafka consumer lag, DB connection pool, outbound
circuit breakers). It is the reference "12-factor microservice"
dashboard — golden signals per endpoint, per pod, per namespace.

## Signal catalog for Spring

### Golden signals (RED / USE)

- **Latency** — HTTP `p99` per endpoint (Micrometer `http.server.requests`).
- **Traffic** — HTTP RPS per endpoint, Kafka messages consumed/sec per topic.
- **Errors** — HTTP `5xx` rate per endpoint, Kafka consumer failures per
  group, unhandled-exception count.
- **Saturation** — JVM heap % (used / max), HikariCP active vs max
  connections, Tomcat thread-pool busy count, JVM GC pause p99.

### Stack-native signals

- **Actuator `/health` matrix** — liveness, readiness, per-dependency
  (`db`, `redis`, `kafka`, `discoveryComposite`).
- **HikariCP metrics** — active, idle, pending, wait time p99.
- **Kafka consumer lag per partition per group** — the primary async SLI.
- **Circuit-breaker state per outbound call** (Resilience4j / Hystrix).
- **JVM GC pause count + duration** (G1 or ZGC).
- **Micrometer distribution summary** for critical business ops.
- **Thread-pool queue depth** per named executor.
- **DB slow-query count** + connection acquisition wait p99.

## Widget catalog for Spring

- **HTTP p99 per endpoint (top-list)** (top-list)
  - PromQL: `histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket{env="prod"}[5m])) by (le, uri))`
  - Datadog: `top(avg:spring.http.server.requests.duration.p99{env:$env} by {uri}, 10, 'mean', 'desc')`
  - Alert cross-ref: `resources/alert-rules/spring.md#http-p99-breach`
- **HTTP 5xx rate per endpoint** (timeseries — grouped by uri)
  - PromQL: `100 * sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m])) by (uri) / sum(rate(http_server_requests_seconds_count[5m])) by (uri)`
- **JVM heap % (used / max)** (timeseries with saturation marker at 85%)
  - PromQL: `100 * sum(jvm_memory_used_bytes{area="heap"}) by (pod) / sum(jvm_memory_max_bytes{area="heap"}) by (pod)`
- **HikariCP active vs max** (timeseries — dual line, per pool)
  - PromQL: `hikaricp_connections_active` + `hikaricp_connections_max`
- **Kafka consumer lag per group + partition** (heatmap)
  - PromQL: `kafka_consumer_fetch_manager_records_lag{group=~"$group"}` <!-- verify: exact metric depends on client -->
- **Actuator health matrix** (table — status per component)
  - Custom probe emitting `actuator.health.component.status{component=~"db|redis|kafka"}`
- **Circuit-breaker state per outbound call** (query_value — count OPEN + HALF_OPEN)
  - PromQL: `resilience4j_circuitbreaker_state{state=~"open|half_open"}`
- **JVM GC pause p99 + count** (timeseries — dual axis)
  - PromQL: `histogram_quantile(0.99, sum(rate(jvm_gc_pause_seconds_bucket[5m])) by (le))`
- **Thread-pool queue depth per executor** (timeseries)
- **DB connection acquisition wait p99** (timeseries)
- **Top-10 slow DB queries** (top-list from APM traces)
- **Deploy markers per pod** (event_stream — K8s rollout events)

## Template variables for Spring

- Common: `env`, `service`, `region`
- Spring-specific: `k8s_namespace`, `pod_name`, `deployment`,
  `endpoint` (URI), `kafka_group`, `kafka_topic`, `db_pool_name`,
  `circuit_breaker_name`, `application_version`.

## Dashboard layout for Spring

- **Row 1 — Health-at-a-glance:** Actuator readiness green across pods,
  HTTP p99 ≤ SLO, HTTP 5xx < 0.5%, no OPEN circuit breakers.
- **Row 2 — Golden signals (2×2):** HTTP p99 per endpoint, HTTP 5xx rate,
  HTTP RPS, JVM heap %.
- **Row 3 — Spring-native:** HikariCP active vs max, Kafka consumer lag
  per group, circuit-breaker state, GC pause p99.
- **Row 4 — Top-N:** top-10 slow endpoints, top-10 slow DB queries, top-10
  exception classes, top-10 Kafka topics by lag.
- **Row 5 — Release / on-call:** current `application_version` per pod, last
  deploy timestamp, active on-call, SLO error-budget burn.

## Per-platform preferences for Spring

- **Prometheus + Grafana** — **default** for K8s-hosted Spring; Micrometer
  ships a `PrometheusMeterRegistry` out of the box; Actuator
  `/actuator/prometheus` scrape is standard.
- **Datadog** — for SaaS-first orgs; auto-discovers Spring via `dd-java-agent`
  with strong Micrometer integration.
- **New Relic** — for orgs standardized on New Relic across a mixed JVM fleet.
- **Dynatrace** — enterprise Spring shops with OneAgent auto-discovery.
- **Elastic APM** — for ELK-native shops correlating APM with Logstash logs.

## 2 worked dashboard examples for Spring

### Example: `checkout-api` (revenue-critical REST service)

- Master template: `templates/dashboard-prometheus.yml`
- Template vars: `env=prod`, `k8s_namespace=checkout`, `deployment=checkout-api`,
  `endpoint=*`
- Widgets: HTTP p99 per endpoint (top-10), HTTP 5xx rate per endpoint, RPS
  per endpoint, JVM heap %, HikariCP active vs max, circuit-breaker state
  (payment-gateway), Kafka consumer lag (`orders.completed`), deploy markers.
- Notify: `#checkout-oncall` on p99 breach for 5m.

### Example: `event-consumer` (Kafka-first worker)

- Master template: `templates/dashboard-grafana.json`
- Template vars: `env=prod`, `k8s_namespace=events`, `kafka_group=order-projector`
- Widgets: Kafka consumer lag per partition (heatmap), messages consumed/sec
  per topic, processing p99 per topic, DLQ publish rate, JVM heap %, GC pause
  p99, thread-pool queue depth (`kafka-listener`), unhandled-exception count.
- Notify: `#events-oncall` on consumer lag > 10k for 5m per partition.

## Anti-patterns to avoid for Spring

- **Averaging across pods.** Per-pod outliers (a single OOMing pod)
  disappear in averages — always support `pod_name` as a template variable.
- **Dashboarding `/actuator/env` or `/actuator/beans`.** They expose config
  and are not health signals — and `/actuator/env` leaks secrets. Never surface.
- **Skipping HikariCP metrics.** Connection-pool exhaustion is the most
  common cause of Spring latency incidents; without it, on-call debugs
  blind.
- **Kafka lag averaged across partitions.** A single stuck partition is
  invisible in a group-level average; expose per-partition heatmaps.
- **No circuit-breaker state widget.** An OPEN circuit is a silent
  degradation — customers see fallbacks, on-call doesn't know.

---

Generate the full dashboard using the appropriate `templates/dashboard-<target>.json`
or `templates/dashboard-<target>.yml` as the master, populating placeholders
with stack-appropriate content from the guide above.
