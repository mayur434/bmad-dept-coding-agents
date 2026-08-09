# Runbook authoring guide — Spring Boot

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a runbook for a Spring Boot service.
Combine with `templates/runbook.md` as the master skeleton.

## Purpose framing

A Spring Boot runbook is written for a JVM SRE at 3 AM. The vocabulary is
**Actuator endpoints**, **Micrometer metrics**, **HikariCP pool**,
**Kafka consumer lag**, **JVM heap/GC**, **thread-pool queue depth**.
Runbooks focus on: liveness/readiness, JVM heap headroom, connection-pool
saturation, consumer lag, thread starvation, and DB slow queries. K8s
rolling restart is a first-class mitigation.

## Common incident symptoms for Spring

- Actuator `/health/liveness` red on N pods
- Actuator `/health/readiness` red — pod not receiving traffic
- p99 latency > SLO (thread starvation, DB slow query, GC storm)
- JVM heap usage > 90% (memory leak, cache misconfig)
- G1 GC pause count > 10/min OR pause p99 > 500ms
- HikariCP pool exhausted (`hikaricp.connections.active` == `.max`)
- Kafka consumer lag > 10k messages per group
- HTTP 5xx > 2% (downstream failure, business exception cascade)
- Thread-pool queue depth > 1000 (executor starvation)
- DB slow-query count > 100/min

## Quick-diagnosis commands (per common symptom)

- **Liveness red:** `kubectl get pods -l app={{SERVICE}} -o wide`;
  `curl -sf http://<pod>:8080/actuator/health/liveness`;
  `kubectl logs <pod> --tail=200 --previous`.
- **Readiness red:** `curl -sf http://<pod>:8080/actuator/health/readiness`;
  check `/actuator/health` component detail for the failing indicator.
- **p99 latency:** `/actuator/metrics/http.server.requests?tag=uri:{path}`;
  `/actuator/threaddump | jq '.threads[] | select(.threadState=="BLOCKED")'`;
  `/actuator/metrics/jvm.gc.pause`.
- **Heap:** `/actuator/metrics/jvm.memory.used?tag=area:heap`;
  `/actuator/heapdump > heap.hprof` (last resort — pauses the JVM).
- **GC storm:** `/actuator/metrics/jvm.gc.pause`;
  `/actuator/metrics/jvm.gc.memory.promoted`.
- **HikariCP:** `/actuator/metrics/hikaricp.connections.active`;
  `.max`; `.pending`; `.acquire`.
- **Kafka lag:** `kafka-consumer-groups.sh --bootstrap-server <> --describe --group <>`;
  `/actuator/metrics/kafka.consumer.records.lag`.
- **DB slow queries:** `SELECT * FROM pg_stat_activity WHERE state='active' ORDER BY query_start`;
  slow-query log; `EXPLAIN ANALYZE`.

## Likely causes (per common symptom)

- **Liveness red:** OOM (heap or metaspace); deadlock in shutdown hook;
  Actuator itself blocked (thread starvation cascade).
- **Readiness red:** downstream dependency (DB / Kafka / IMS) unavailable;
  warmup incomplete; readiness probe stricter than needed.
- **p99 latency:** DB slow query (missing index); GC storm; thread-pool
  starvation; downstream service p99 leaked in.
- **Heap:** cache without max-size (Caffeine); connection leak; class
  loader leak; large scheduled job holding references.
- **HikariCP exhausted:** transaction leak (missing `@Transactional`
  close); DB itself slow; pool sized below load.
- **Kafka lag:** consumer thread blocked (DB write); poison message;
  partition rebalance storm; consumer replicas reduced.

## Mitigation steps (per common symptom)

- **Liveness red:** `kubectl delete pod <name>` (K8s replaces);
  check auto-scaling; if root cause is OOM → bump `Xmx`, redeploy.
- **Readiness red:** re-check upstream dependencies; if warmup is the
  cause, increase `initialDelaySeconds`; if config drift, redeploy.
- **p99 latency:** identify slow endpoint via `/actuator/metrics`; if DB
  slow query, engage DBA + add missing index; if GC storm, tune heap /
  GC algorithm; if downstream, circuit-break.
- **Heap:** rolling restart to buy time; capture heap dump for RCA;
  identify leak owner and roll forward with a fix.
- **HikariCP exhausted:** rolling restart to reset pool; bump `maximum-pool-size`
  as short-term relief; fix leak (transaction not closed) for real fix.
- **Kafka lag:** scale consumer replicas; if poison message, seek past
  it (`kafka-consumer-groups.sh --reset-offsets`); check DB write path.

## Rollback triggers for Spring

Cross-reference `rollback-plans/spring.md` from the Release agent:

- Liveness red on > 25% of pods for 5 min.
- p99 latency > 2× baseline for 10 min.
- Error rate > 2% for 5 min.
- HikariCP saturation > 90% for 10 min.
- Kafka consumer lag > 100k messages.
- Any circuit-breaker fully open for 5 min.
- Manual call from JVM SRE or tech lead.

## Escalation matrix for Spring

- **L1** — on-call SRE, service owner (dev).
- **L2** — Spring tech lead, DBA (for DB-side issues), platform team
  (K8s / infra).
- **L3** — Engineering manager, JVM specialist (GC / memory RCA).
- **Vendor** — Spring / vendor support (rare — usually community-supported);
  cloud provider (K8s node issues).

## Verification steps for Spring

- `/health/liveness` green on all pods.
- `/health/readiness` green on all pods.
- p99 latency ≤ SLO (see `SLO-<service>.md`).
- Error rate ≤ 0.5%.
- HikariCP `.active` < 70% of `.max`.
- Kafka consumer lag < 100 messages per group per partition.
- JVM heap used ≤ 70% of max (post-GC).
- No thread in BLOCKED for > 5 s.

## Comms templates for Spring

**Channels:** `#platform-deploys`, `#{{service}}-oncall`, `#platform-status`.

**Stakeholders:** service owner, JVM SRE, DBA (DB issues), platform team
(K8s / infra), on-call architect for cross-service impact.

## 2 worked runbook examples for Spring

### Example 1 — "HikariCP pool saturated on checkout-api"

- **Symptom:** `hikaricp.connections.active == hikaricp.connections.max == 20` for 12 min; `.pending` climbing; endpoint p99 > 3s.
- **Quick diagnosis:**
  1. `/actuator/metrics/hikaricp.connections.pending`.
  2. `/actuator/threaddump` — count threads BLOCKED on `HikariDataSource#getConnection`.
  3. DB side: `pg_stat_activity` — count active queries; longest-running query.
  4. Application log: are transactions being closed? Any `TransactionSystemException`?
  5. Check recent deploy for a new endpoint that opens a transaction without `@Transactional`.
- **Mitigation:** rolling restart via `kubectl rollout restart deploy/checkout-api`;
  short-term: bump `maximum-pool-size` to 30 (verify DB can handle); long-term:
  find and fix the leak.
- **Rollback trigger:** saturation returns within 10 min of restart → rollback last deploy.
- **Escalation:** L1 SRE → L2 tech lead + DBA if DB-side slow queries are the root cause.

### Example 2 — "Kafka consumer lag > 50k on order-events"

- **Symptom:** `kafka.consumer.records.lag` = 62k on `order-events-consumer` group, growing.
- **Quick diagnosis:**
  1. `kafka-consumer-groups.sh --describe --group order-events-consumer`.
  2. `/actuator/threaddump` — is the consumer thread BLOCKED (e.g. on DB)?
  3. `/actuator/metrics/spring.kafka.listener` — polls per second.
  4. Check downstream DB write path — slow query? Deadlock?
  5. Any recent poison message? Check DLQ.
- **Mitigation:** scale consumer replicas
  (`kubectl scale deploy/order-consumer --replicas=6`); if DB-bottlenecked,
  escalate DBA to add index / batch inserts; if poison message, seek offset past it.
- **Rollback trigger:** lag > 100k or growing after scaling.
- **Escalation:** L1 SRE → L2 tech lead + DBA.

## Anti-patterns for Spring

- **Runbook says "restart the JVM"** without a rolling strategy — causes
  a synchronized restart cascade under K8s.
- **No `/health/readiness` distinction from `/liveness`** — the two probes
  fail for different reasons and imply different mitigations.
- **Diagnosis skips `/actuator/threaddump`** — thread-state analysis is
  the fastest way to narrow BLOCKED vs GC vs true slow.
- **Missing DB-side check** — 40% of Spring perf incidents originate in
  the DB; a runbook without `pg_stat_activity` misses the common case.
- **Verification uses `/health` only** — `/health` composes multiple
  indicators; if one is misconfigured, `/health` green does not mean
  the service is truly healthy.

---

Generate the full runbook using `templates/runbook.md` as the master,
populating placeholders with stack-appropriate content from the guide above.
