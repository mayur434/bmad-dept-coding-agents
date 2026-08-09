# Incident-response playbook authoring guide — Spring Boot services

## Purpose framing

A Spring playbook covers **incident classes** across a Spring Boot
microservices estate on Kubernetes — service-outage cascade, DB
migration failure, Kafka consumer stall, JWT compromise, OOM/memory
leak, public-endpoint DDoS. Symptom-scoped response belongs in
`resources/runbook-templates/spring.md`. Playbooks structure the
Incident Commander's decisions across services. Apply STRIDE for any
auth/secret/injection-adjacent incident: Spring services usually own
the auth boundary, so security-incident containment is often first.

## Incident-type catalog for Spring

- **Service-outage cascade** — one service failing takes downstream services with it (circuit-breaker misconfig).
- **DB migration failure** — Flyway/Liquibase migration crashed mid-flight; schema half-applied.
- **Kafka consumer stuck** — poison message or rebalancing loop blocking topic.
- **JWT compromise** — signing key leaked; unauthorized tokens minted.
- **Memory leak / OOM** — heap growth to OOMKilled; pod restart loop.
- **DDoS on public endpoint** — auth/graphql endpoint hammered; thread-pool saturation.
- **Secret compromise** — DB/API credential leaked in log or repo.
- **Deployment rollout stuck** — K8s rollout progressDeadline exceeded; partial version state.

## STRIDE structure for security incidents

- **Spoofing** — JWT compromise → rotate signing key (`jwt.signing.key`); force logout by revoking refresh tokens; audit token-issuance log last 72h.
- **Tampering** — SQL-injection via ORM misconfig → prepared-statement audit; WAF rule; snapshot DB.
- **Repudiation** — verify audit-log stream to SIEM intact; block config-management endpoint external access.
- **Information disclosure** — PII leak via unauthenticated `/actuator` endpoint → immediate actuator `management.endpoints.web.exposure.include=health` restrict.
- **Denial of service** — public-endpoint DDoS → Envoy/Istio rate-limit; scale up + circuit-breaker tighten.
- **Elevation of privilege** — role-claim bypass via JWT parsing bug → patch parser; invalidate all tokens.

## Roles + responsibilities per Spring

- **IC** — service-owner tech lead or SRE lead.
- **Comms Lead** — pairs with API-consumer support (internal or external).
- **Ops Lead** — service-owner engineer (per-service incidents), DBA (migration/DB incidents), platform-SRE (K8s/Istio/Kafka).
- **Scribe** — captures trace-IDs, pod-IDs, migration-versions, Kafka offsets, JWT `jti`s, timestamps UTC.
- **SMEs** — Kafka SRE, DBA on-call, security engineer.

## Initial-triage matrix for Spring

- **SEV1** — public API 5xx > 5%, DB migration corruption, JWT signing key compromise, cascade taking multiple services.
- **SEV2** — single-service degraded (5xx 1-5%), Kafka lag > 15 min, memory-leak OOMKill restart loop, deployment rollout stuck > 30 min.
- **SEV3** — single non-critical service degraded, single Kafka partition slow.

Decision flow: `alert fired → is public API impacted? → is DB integrity in play? → is auth/secret leaked? → SEV assignment`.

## Containment steps for Spring

- Scale-down affected service to 1 replica (isolate for forensics) or scale-up to shed queue.
- Disable auto-scaling (`kubectl patch hpa <svc> --patch '{"spec":{"minReplicas":<n>,"maxReplicas":<n>}}'`).
- Freeze DB migrations (Flyway `flyway:baseline` guard; disable CI migration stage).
- Disable outbound traffic to compromised dep via Istio `DestinationRule` block.
- Rotate JWT signing key (`kubectl rollout restart deployment/<svc>`) after key-manager rotation.
- Enable Envoy/Istio rate-limit on hot endpoint (`RateLimitService` policy).
- Snapshot DB via managed-DB snapshot API before any restore.
- Pause Kafka consumer group (`kafka-consumer-groups --pause`). <!-- verify subcommand -->

## Investigation steps per Spring

- **Log locations:** `kubectl logs`, centralized log store (Splunk/ELK/Datadog Logs), trace store (Datadog/Tempo/Jaeger).
- **JVM diagnostics:** `jmap -dump:live,format=b,file=/tmp/heap.hprof <pid>`; `jstack <pid> > /tmp/threads.txt`; actuator `/actuator/heapdump`, `/actuator/httptrace`.
- **DB:** slow-query log, `pg_stat_activity` / `SHOW PROCESSLIST`, migration table (`flyway_schema_history`).
- **Kafka:** `kafka-consumer-groups --describe`, `kafka-run-class kafka.tools.DumpLogSegments`.
- **Spoofing:** query token-issuance log for unusual `iss`/`aud`/`jti`; check refresh-token store.
- **Tampering:** query DB binlog last 24h for anomalous DML.
- **Info-disclosure:** enumerate `/actuator/*` endpoint exposure config; grep access log for `/actuator` from external ASNs.
- **DoS:** RPS histogram per endpoint; source-ASN top-N; thread-pool utilization.
- **EoP:** JWT claim audit; role-mapping diff.

## Eradication + recovery per Spring

- Rollback K8s deployment (`kubectl rollout undo deployment/<svc>`).
- Restore DB from managed-DB snapshot (schema-only preferred when data is intact).
- Rotate all secrets touched during incident window (Vault `secrets rotate`).
- Reset Kafka consumer offset to pre-poison-message (`kafka-consumer-groups --reset-offsets`).
- Purge JWT refresh tokens (blacklist store).
- Redeploy with fix; canary + gradual ramp.

## Communications plan for Spring

- **Internal:** `#<service>-oncall`, `#platform-oncall`, `#api-consumers` (internal API consumers).
- **External:** developer status page for public-API partners.
- **Regulatory:** PII/PCI leaks trigger jurisdictional notifications.
- **Vendor:** managed-DB (RDS/Cloud SQL) support; Kafka vendor (Confluent) support.

Sample lines: `[INCIDENT — SEV1] payments-api 5xx 8.4% since 03:22 UTC; blocking checkout upstream. IC @eve. Bridge <link>.`

## Stand-down criteria for Spring

- Public-API 5xx < 0.5% sustained 15 min (from `slo-templates/spring.md`).
- Public-API p95 within 10% of baseline sustained 30 min.
- Kafka consumer-group lag < baseline for 15 min.
- DB integrity check passed (row-count + checksum on impacted tables).
- No new alerts firing: SEV1 60 min, SEV2 30 min, SEV3 15 min.

## Postmortem trigger for Spring

- **SEV1** — always postmortem within 5 business days.
- **SEV2** — team-lead decision; required for repeat (3+ in 30 days) or > $10k downstream impact.
- **SEV3** — optional.

Cross-reference `resources/postmortem-templates/spring.md` (3.5c-iii).

## 2 worked playbook examples for Spring

### Example 1 — "OOM restart-loop on payments-api"

Type: availability + performance, SEV1. Symptom: `payments-api` pods OOMKilled every 8-12 min since v2.3.0 rollout at T-45min. Triage: revenue-critical → SEV1. Containment: scale to 1 replica for forensics; capture heap+thread dump; pause CD. Investigation: heap dump analysis shows leak in `CustomerCache` (unbounded). Eradication: rollback to v2.2.7 via `kubectl rollout undo`. Recovery: verify heap stable + p95 within baseline 30 min. Stand-down: no OOMKill for 60 min; ticket filed for cache-size fix.

### Example 2 — "JWT signing key found in a public gist"

Type: security (Spoofing), SEV1. Symptom: secret-scanner alert on `jwt-signing-key.pem` in a public GitHub gist; last-rotated 89 days ago. Triage: active exploit possible → SEV1. Containment: rotate signing key in key-manager; restart all services consuming the key; blacklist all outstanding tokens; force refresh-token rotation. Investigation: audit token-issuance log for the leaked-key window; enumerate suspicious `iss`/`aud` claims. Eradication: new key deployed + old key permanently revoked; add secret-scanning pre-commit hook. Recovery: monitor for auth-failure spike (expected during forced re-auth). Stand-down: auth-failure rate returned to baseline; security engineer sign-off.

## Anti-patterns to avoid for Spring

- Don't restart a pod before capturing heap + thread dump — you lose the evidence.
- Don't roll forward a DB migration mid-incident — half-migrated schema compounds the outage.
- Don't skip STRIDE for JWT/secret incidents — spoofing vs EoP dictates whether to rotate keys vs invalidate roles.
- Don't reset Kafka consumer offset without dumping the poison-message payload first — you lose the RCA.
- Don't skip scribe — trace-IDs + pod-IDs + migration-versions form the audit trail.

Generate the full playbook using `templates/playbook.md` as the master, populating placeholders with stack-appropriate content from the guide above.
