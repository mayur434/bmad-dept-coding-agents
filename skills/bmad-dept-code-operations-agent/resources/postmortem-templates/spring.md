# Postmortem authoring guide — Spring Boot

## Purpose framing

A Spring Boot postmortem is a **blameless retrospective run after the
JVM / Kafka / DB / K8s incident is resolved** — it closes the loop from
`playbook-templates/spring.md` back into `runbook-templates/spring.md`
and `slo-templates/spring.md`. Every SEV1 gets one within 5 business
days; SEV2 by decision (mandatory on repeat); SEV3 optional. Focus:
what broke in the distributed-system boundary (service-discovery, DB
pool, message-bus, JVM), why the actuator / Prometheus signals didn't
catch it earlier, and what we're changing in code, config, or infra.

## Common failure modes for Spring

Recurring root-cause patterns, each with typical detection window:

- **DB migration deadlock (Flyway hanging)** — long-running `ALTER TABLE` on prod, blocks all writes. Detection: 2-10 min via write-latency spike.
- **Kafka consumer stuck on poison-pill message** — consumer offset never advances; lag grows. Detection: 5-30 min via consumer-lag alert.
- **JVM OOM from cache misconfiguration** — unbounded cache growth; heap exhausted. Detection: 30-120 min via heap-headroom alert (then pod crash).
- **Service-discovery cascade failure** — Eureka / Consul stale registry; requests routed to dead instances. Detection: 5-15 min via 5xx spike.
- **JWT signing-key rotation not propagated** — one service still trusts old key; 401 storm. Detection: immediate at rotation.
- **HikariCP pool exhaustion** — slow query held connection; pool saturated. Detection: 5-20 min via `pool_active == pool_max` alert.
- **G1 GC pause storm** — heap sized wrong for workload; long stop-the-world. Detection: 10-30 min via p99 latency spike.
- **K8s liveness probe misconfig** — probe hits `/health` before app ready; restart loop. Detection: at first deploy.
- **Thread-pool queue starvation** — bounded queue full, tasks rejected. Detection: 5-20 min via `RejectedExecutionException` count.
- **Circuit-breaker open on healthy dep** — Hystrix / Resilience4j misconfig false-open. Detection: 5-15 min via downstream 5xx paradox.

## Timeline capture patterns for Spring

- **Actuator `/httptrace`** — recent HTTP request/response trace with timestamps + status.
- **Actuator `/heapdump`** — captured at incident window for post-hoc analysis (attach path in timeline).
- **K8s events** — `kubectl get events --sort-by=.lastTimestamp -A` snapshot at incident window.
- **Prometheus alert-history** — Alertmanager silence + alert firing timeline.
- **Kafka consumer-group state history** — `kafka-consumer-groups.sh --describe` output at incident window; offset + lag per partition.
- **JVM GC log** — G1 pause log with timestamps + reason.
- **DB slow-query log** — MySQL / Postgres slow-log with query digest; correlate with connection-pool exhaustion.
- **Distributed trace (Jaeger / Zipkin / Tempo)** — trace ID for representative failed request; per-span latency.

Format: UTC timestamps, actor (person / system / K8s controller / Alertmanager), action, evidence link (Grafana panel URL, trace ID, heapdump path).

## Root-cause analysis methods for Spring

- **5-whys** — default for single-service incidents (config, code regression).
- **Fishbone (Ishikawa)** — for incidents spanning multiple services + platform + upstream deps.
- **Fault-tree** — **most common for Spring**: distributed-system incidents rarely have a single cause; each disjoint failure mode gets its own branch (Kafka + DB + service-discovery + cache).
- **Chaos replay** — for cascade / retry-storm incidents; reproduce in stage with chaos-mesh / Litmus.

Spring leans **fault-tree** — distributed systems fail in disjoint ways and the postmortem must walk each independently to avoid conflating causes.

## Contributing-factor taxonomy for Spring

- **Technical debt** — known-open backlog (e.g. `SPR-2231: HikariCP sizing review overdue`).
- **Process gap** — missing runbook, missing chaos-test coverage, missing DB-migration review gate for long-running DDL.
- **Human error** — engineer merged a `@Transactional(readOnly=false)` change without pool-impact review; framed blamelessly (PR template didn't require it).
- **External dependency** — upstream service outage, Kafka broker issue, cloud-provider AZ failure.
- **Config drift** — env divergence in `application-prod.yml`; cross-reference `env-diff-templates/spring.md`.

## What-went-well template for Spring

- Circuit-breaker on downstream call opened correctly and shed load.
- K8s liveness probe restarted the OOMing pod before human intervention.
- Prometheus alert fired 8 min before user-visible impact.
- Distributed trace pinpointed the offending span in < 2 min.
- Consumer-group lag alert fired at 5k backlog, well below the 50k pain threshold.
- Deploy pipeline auto-rolled back on canary p99 regression.
- Actuator heapdump captured cleanly for post-hoc analysis.

## Action-item taxonomy for Spring

- **Prevention** — root-cause fix in code (bounded cache), config (HikariCP sizing), or infra (K8s HPA policy).
- **Detection** — new Prometheus alert on `pool_active/pool_max > 0.9`, new dashboard tile for Kafka consumer lag, tighter SLO burn-rate window.
- **Response** — runbook update, playbook update, on-call training on kubectl / trace-hunting.
- **Communication** — comms template update, downstream-service notification matrix.

Per action item: owner + due-date + priority (P0 within week; P1 within month; P2 within quarter) + tracking-ticket-id.

## Blameless-language enforcement for Spring

- REJECT "the DBA ran the migration during peak" → REPLACE "the Flyway pipeline lacked a business-hours guard; the migration ran during peak without a second reviewer".
- REJECT "the developer wrote a bad query" → REPLACE "the query lacked an index; the code review didn't include an EXPLAIN check; adding it".
- REJECT "SRE misconfigured HPA" → REPLACE "the HPA policy was tuned for stateless workload; this service is stateful; adding workload-type gating in policy templates".

## Stakeholder review process for Spring

- **Author:** incident commander from the playbook run.
- **Reviewers:** SRE lead + service tech lead + platform-K8s lead (if platform involved).
- **Approvers:** engineering manager (SEV1: + director; SEV1 with data loss or PII: + legal + DPO).
- **Publication:** internal wiki + `#platform-oncall`; external status page + customer notice for customer-visible SEV1.
- **Cross-service:** notify downstream service owners with a summary + action-items relevant to their integration.

## 2 worked postmortem examples for Spring

### Example 1 — Payment-service Kafka consumer stuck (SEV1, 42 min)

Severity SEV1. Duration 42 min. Blast radius: 12k payment-completion emails delayed 42 min; 220 customers double-charged (recovered). Root cause (fault-tree branches): (1) consumer poison-pill (deserialization failure on new schema-registry version) — no DLQ configured; (2) auto-commit off, but manual commit missed on exception path; (3) alert only on lag > 50k, not on offset-stuck. Action items: (P0) DLQ on all Kafka consumers (owner @platform-lead, due +1w); (P0) offset-stuck alert (owner @sre-lead, due +1w); (P1) schema-registry compatibility test in CI (owner @dev-lead, due +2w); (P1) idempotent payment-completion handler (owner @payment-lead, due +1mo). Well: rollback of consumer version in < 4 min; trace pinpointed the offending offset.

### Example 2 — Auth-service JWT rotation 401 storm (SEV2, 18 min)

Severity SEV2. Duration 18 min. Blast radius: ~40k user sessions returned 401; ~8k re-logins. Root cause (5-whys): auth-service rotated JWT signing key → downstream verifiers cached the old JWKS → JWKS cache TTL was 1h — too long for rotation window → rotation runbook didn't call for cache-warm on downstream services → no pre-rotation signal broadcast. Action items: (P0) drop JWKS cache TTL to 5 min (owner @auth-lead, due +1w); (P0) rotation runbook: broadcast-then-rotate (owner @sre-lead, due +1w); (P1) JWKS cache-warm hook on rotation event (owner @auth-lead, due +2w). Well: circuit-breaker on auth calls kept downstream services responsive; K8s liveness didn't false-positive.

## Anti-patterns to avoid for Spring

- Don't skip UTC timestamps.
- Don't skip action-item owners.
- Don't blame individuals — blame the systems / tooling.
- Don't skip DB slow-query log analysis for latency incidents.
- Don't skip trace ID / span references — evidence must be reproducible.
- Don't leave K8s event timeline out for pod-restart incidents.
- Don't publish JWT / auth incident details externally without security review — attack recipe risk.
- Don't skip actuator `/heapdump` reference for OOM postmortems.

---

Generate the full postmortem using `templates/postmortem.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `playbook-templates/spring.md` for the response the postmortem retrospects on, and `runbook-templates/spring.md` for symptom-specific technical detail.
