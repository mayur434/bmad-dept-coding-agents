# SLO authoring guide — Spring Boot

## Purpose framing

SLOs for Spring Boot services establish **per-endpoint reliability
targets** driven by Micrometer instrumentation and Actuator health —
availability + latency at the HTTP contract boundary, plus background
work (Kafka consumers, scheduled jobs) that customers indirectly depend
on. They anchor the error-budget policy the release engineer consults
before promoting a deployable, and they define the burn-rate thresholds
that page `@spring-service-oncall`. JVM saturation (heap, GC pauses)
enters as a leading indicator, not the SLI itself.

## SLI catalog for Spring — what to measure

Each SLI is measured over a rolling 28-day window; `good_events / valid_events` formula.

- **REST endpoint availability (per critical endpoint)** — `(2xx + 3xx + user-caused 4xx responses) / (total responses)` per endpoint. Excludes 401/403 auth failures (user error) but includes 5xx and 429.
- **REST endpoint p99 latency (per critical endpoint)** — 99th-percentile duration from Micrometer `http.server.requests` timer, per `uri` tag.
- **Actuator readiness** — `(readiness probes returning UP) / (total probes)`. `/actuator/health/readiness`.
- **Background-job success rate** — `(scheduled + async jobs completing without error) / (total job runs)` per job name.
- **Kafka consumer processing latency p95** — 95th-percentile end-to-end time from message publish to commit, per consumer group.
- **Kafka consumer lag freshness** — `(minutes with consumer lag < 60s) / (total minutes)` per consumer group.
- **Circuit-breaker closed-rate** — `(minutes with breaker CLOSED) / (total minutes)` per downstream-dependency breaker (Resilience4j).

## SLO targets per tier for Spring

| SLI | T1 target | T2 target | T3 target |
|-----|-----------|-----------|-----------|
| REST endpoint availability | 99.9% | 99.5% | 99% |
| REST endpoint p99 | ≤ 300ms | ≤ 1s | ≤ 3s |
| Actuator readiness | 99.99% | 99.9% | 99% |
| Background-job success | 99.5% | 99% | 95% |
| Kafka consumer lag freshness | 99% | 95% | 90% |
| Circuit-breaker closed-rate | 99.5% | 99% | 95% |

Per-endpoint SLOs — the p99 target is the ceiling of the endpoint's SLO row; a service exposing 5 endpoints has 5 latency SLOs, tiered independently.

## Error-budget policy for Spring

- **Budget window** — 28-day rolling. Async job SLIs may use 7-day window if traffic is sparse (< 1000 runs / 28d).
- **Burn-rate thresholds** — fast burn (2%/1h → P1 page), slow burn (5%/6h → P2 ticket), catastrophic (10%/15min → P1 + auto-freeze).
- **Freeze policy** — when a T1 endpoint's budget < 25%, deployments touching that endpoint's controller / service layer frozen. Cross-service dependencies may deploy if isolated by circuit-breaker.
- **Rollback triggers** — cross-reference `release-plans/spring.md#rollback-triggers`. Fast-burn within 15 min of deploy triggers rollback to prior deployable via K8s / Nomad revision.
- **Escape hatches** — pod-rotation windows (rolling restarts) tagged `maintenance:true` excluded. Cold-start latency on first-request-after-scale excluded from p99 (JVM warm-up). Downstream-dependency outages tracked separately via circuit-breaker SLI.
- **Governance** — SRE + service tech-lead + product-owner sign-off on target changes; recorded in `.bmad/decisions.yaml`.

## Multi-window burn-rate alerts for Spring

| SLO | Fast-burn (1h/2%) | Slow-burn (6h/5%) | Total-burn (24h/10%) |
|-----|-------------------|-------------------|---------------------|
| Endpoint availability | P1 page `@spring-oncall` | P2 ticket | P2 ticket |
| Endpoint p99 latency | P2 page | P2 ticket | P3 warn |
| Actuator readiness | P1 page | P2 ticket | P2 ticket |
| Background-job success | P2 ticket | P3 warn | Info |
| Kafka consumer lag | P2 page | P2 ticket | P3 warn |
| Circuit-breaker open | P2 page | P3 ticket | Info |

See `resources/alert-rules/spring.md` for underlying Micrometer / Prometheus queries.

## SLI measurement per platform for Spring

- **Prometheus (via Micrometer prometheus registry)** — availability: `sum(rate(http_server_requests_seconds_count{status!~"5..",uri="$uri"}[28d])) / sum(rate(http_server_requests_seconds_count{uri="$uri"}[28d]))`; latency: `histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket{uri="$uri"}[5m])) by (le))`.
- **Datadog (via dd-trace Java agent)** — availability: `sum:trace.servlet.request.hits{http.status_code:2xx OR http.status_code:3xx, resource_name:$uri}.as_count() / sum:trace.servlet.request.hits{resource_name:$uri}.as_count()`; p99: `p99:trace.servlet.request{resource_name:$uri}`.
- **New Relic (via APM agent)** — `SELECT percentile(duration, 99) FROM Transaction WHERE name='WebTransaction/SpringController/$uri' SINCE 28 days ago`.
- **Kafka consumer lag** — via `kafka_consumergroup_lag` metric (Burrow, Kafka JMX exporter, or dd-trace Kafka integration).

## Stakeholder + review cadence for Spring

- **Owner** — service-owning team (per Spring service — e.g. `checkout-svc: payment-eng`, `catalog-svc: catalog-eng`).
- **Reviewer** — SRE / DevOps team; Spring platform tech-lead.
- **Consumer** — product-owner (business impact), engineering-manager, downstream-service teams.
- **Review cadence** — weekly SLO status per service; quarterly SLO review with cross-service dependency mapping; annual policy review.

## 2 worked SLO examples for Spring

### Example 1: `checkout-svc` (T1 — revenue-critical)

- Tier: T1
- SLIs: `POST /orders` availability (99.9%), `POST /orders` p99 (≤ 300ms), Kafka consumer `order-events` lag freshness (99%).
- SLOs: 99.9% / 43m budget / 28d; p99 ≤ 300ms; consumer lag freshness ≥ 99%.
- Budget policy: fast-burn → page `@payment-eng` + auto-rollback via K8s revision.
- Current-state (baseline): 99.94% last 28d, budget 55% remaining, p99 245ms, consumer lag 100% freshness.

### Example 2: `notification-svc` (T2 — async delivery)

- Tier: T2
- SLIs: `POST /notify` availability (99.5%), background email-dispatch job success (99%), Kafka consumer `notification-events` lag freshness (95%).
- SLOs: 99.5% / 3.6h budget / 28d; job success ≥ 99%; consumer lag freshness ≥ 95%.
- Budget policy: slow-burn → ticket notification-eng; freeze on any change touching dispatch logic when budget < 25%.
- Current-state: 99.7% availability, job success 99.3%, consumer lag 97%.

## Anti-patterns to avoid for Spring

- **Setting p99.9 without measurable data volume.** With fewer than ~10,000 requests / window, p99.9 is one bad request; use p99 or p95 instead.
- **One SLO for `/api/*` across all endpoints.** Different endpoints have different traffic patterns and criticality; the aggregate hides the important cases.
- **Coupling endpoint SLO to database-latency SLO.** Database is a shared dependency; separate SLIs let you attribute reliability correctly.
- **Ignoring circuit-breaker state as an SLI.** A breaker that's open protects the service but breaks the user — treat sustained open as an SLI violation.
- **Static p99 target through JVM warm-up.** Cold-start after scale-up spikes p99; exclude first-N-seconds-per-pod or use a warm-only histogram.

---

Generate the full SLO document using `templates/slo.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `alert-rules/spring.md` for burn-rate alert wiring.
