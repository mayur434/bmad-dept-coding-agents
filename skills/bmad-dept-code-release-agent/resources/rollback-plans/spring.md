# Rollback-plan authoring guide — Spring Boot

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a rollback plan for a Spring Boot (Java 17+ /
Kubernetes) middleware service. Combine with `templates/rollback-plan.md`
as the master skeleton.

## Purpose framing

A Spring Boot rollback plan establishes the Actuator + Micrometer +
RED-metric signals that force the call, the on-call authority who owns
the `kubectl rollout undo`, the exact revert path (K8s rollout undo for
code; Flyway `undo` migration or backup restore for schema; ConfigMap /
Secret revert for config), and the API-consumer + downstream-service
comms that must fire before consumer error budgets burn. Every trigger
must be a number sourced from Prometheus / Datadog; every step names
the exact `kubectl` command; every non-reversible Flyway migration
must be pre-flagged so `rollout undo` doesn't wedge the DB.

## Rollback triggers for Spring — specific + quantified

- **p99 REST latency > 2s** sustained 5 min (per-endpoint or aggregate).
- **HTTP 5xx rate > 1%** sustained 5 min at the ingress.
- **K8s `CrashLoopBackoff`** on ≥ 2 pods within the ReplicaSet — bad
  image or startup-time regression.
- **K8s `ImagePullBackoff`** — release image missing from registry
  (indicates a build/publish gap).
- **Flyway migration verification FAILS** on startup — schema drift.
- **Actuator `/actuator/health` reports DOWN** > 3 min on ≥ 25% of pods.
- **Actuator `/actuator/health/readiness` FAIL** on new pods for 5 min
  — new pods never join Service.
- **JVM heap > 90%** or full-GC storm > 10 GCs/min for 10 min.
- **Kafka consumer lag > 60 000 messages** with no drain for 10 min.
- **DB connection pool exhaustion** — HikariCP `pool.usage.active` at
  max for 5 min.

## Decision authority for Spring

- **Primary:** on-call SRE watching Prometheus + K8s dashboards.
- **Approver for prod revert:** tech lead OR platform lead — a `rollout
  undo` on a customer-facing service should have a second pair of eyes.
- **Auto-rollback** — K8s auto-aborts a rolling deploy if
  `progressDeadlineSeconds` is exceeded (default 600s) OR readiness
  probes fail during the roll — this is the primary safety net.
- **Escalation** — backup on-call paged after 5 min if primary
  unreachable; if the DB path is involved, DBA on-call paged in
  parallel.
- **CAB engagement required** for destructive Flyway migrations
  (`V___drop_column.sql`, `V___drop_table.sql`), Kafka topic deletion,
  or JPA `@Column` removal.

## Rollback steps for Spring — numbered + timed

1. **Announce rollback** — `[ROLLBACK IN PROGRESS]` in
   `#platform-releases` + page consumer service on-calls.
2. **Kubernetes rollout undo** — `kubectl -n <ns> rollout undo
   deployment/<svc>` (2–5 min for the new ReplicaSet to spin down and
   old ReplicaSet to scale back).
3. **Verify rollout status** — `kubectl -n <ns> rollout status
   deployment/<svc>` — must report `successfully rolled out`.
4. **Revert Flyway migration** (if applicable):
   - **Reversible migration** (Flyway `undo`, only if Flyway Teams / Enterprise
     licensed) — `flyway undo` (2–10 min depending on schema size). <!-- verify: OSS Flyway lacks undo -->
   - **Irreversible migration** (dropped column / dropped table / data
     mutation) — DB restore from pre-deploy snapshot (route via DBA
     on-call).
5. **Revert ConfigMap / Secret** (if the release changed either) —
   `kubectl apply -f <previous>.yaml` + `kubectl rollout restart
   deployment/<svc>` (2–5 min).
6. **Revert Spring Cloud Config Server / Consul KV** (if externalized)
   — restore previous config revision; consumers refresh via
   `@RefreshScope` or restart.
7. **Verify actuator endpoints** — `curl -sf http://<svc>/actuator/health`
   → UP; `/actuator/info` → previous version.
8. **Verify RED metrics** for 10 min post-rollback — p99 latency,
   5xx rate, throughput back to baseline.
9. **Kafka consumer lag drain** — confirm consumer catches up; if lag
   was accumulated during the failed window, allocate time.
10. **All-clear announcement**.

## Data reversibility flags for Spring

Which changes CANNOT be safely rolled back — must be flagged in the plan:

- **Destructive Flyway migrations** (`V___drop_column.sql`,
  `V___drop_table.sql`, `V___alter_type.sql` narrowing a type) — no
  auto-revert; DB backup restore required.
- **JPA `@Column` removal or renaming** — hibernate schema-validate
  fails on revert if column no longer exists.
- **Kafka topic deletion** — deleted topics do not auto-recreate on
  revert; messages published to the missing topic are dropped.
- **Kafka partition count changes** — partition count can only
  increase; reverted service may be misconfigured.
- **Redis / cache key-space schema changes** — cached values under
  the new schema are unparseable by the reverted service.
- **Feature-flag defaults changed for a released cohort** — the flag
  state persists; a code revert does not restore the previous default.
- **Auth token / signing key rotations** — previous tokens are
  invalidated once new signing keys are issued.

**Guidance:** any destructive schema, Kafka DDL, or auth-key rotation
→ CAB approval + full DB snapshot pre-deploy; do NOT auto-revert;
walk backup-restore or forward-fix explicitly.

## Stakeholder comms during rollback for Spring

**Pre (moment of decision):** `#platform-releases` + upstream/downstream
service channels — `[ROLLBACK IN PROGRESS] {{svc}} v{{version}} →
v{{previous}} — trigger: {{trigger}} — ETA {{eta}}`.

**During:** rollout status every 2 min while `kubectl rollout status`
runs; Prometheus RED-metric recovery.

**API consumers:** paged so they can dampen retries and prepare to
degrade gracefully.

**Customer-facing:** status page updated if 5xx was customer-observable;
otherwise internal-only.

**Post (all-clear):** `[ROLLBACK COMPLETE] {{svc}} v{{previous_version}}
live — p99 {{value}}ms — 5xx {{rate}}% — Kafka lag {{lag}}`.

## Post-rollback for Spring

- **RCA within 24h**, blameless.
- **Audit-log integrity** — sample audit records written during the
  failed release window; confirm no orphan or malformed entries under
  the reverted schema.
- **Kafka message replay decision** — messages published during the
  window with a new-schema shape may be undeliverable to the reverted
  consumer; decide replay vs skip.
- **DB consistency verification** — sample tables touched during the
  window; confirm no split-brain or partial-transaction state.
- **Feature-flag state** — confirm all flags set for the release are
  in the intended pre-release state.
- **HikariCP + JVM baseline** — confirm heap, GC frequency, connection
  pool usage back to pre-release baseline.
- **Lessons-learned template** — see `templates/rollback-plan.md`
  §Lessons learned; fill during RCA.

## 2 worked rollback-plan examples for Spring

**v5.3.0 — Payment service, p99 regression.** Trigger: p99 climbed
from 340ms to 2.1s at T+7 min post-deploy. Decision: on-call SRE +
tech lead on bridge, revert called at T+9 min. Steps: `kubectl rollout
undo deployment/payment-svc` at T+10, rollout complete at T+13, p99
back to 380ms at T+15. Recovery: 6 min. Post: RCA identified a
missing DB index for a new query pattern; forward-fix v5.3.1 shipped
next day with the index migration + query.

**v5.4.0 — Loyalty service with dropColumn migration, DB restore
path.** Trigger: `hibernate schema validation` failed on new pods at
T+2 min (Flyway `V57__drop_legacy_id.sql` succeeded, but reverted
image expects the column). Decision: on-call SRE + DBA on bridge —
`rollout undo` would leave code expecting missing column, so DB
restore path taken. Steps: rollout paused at T+4, backup restore from
pre-deploy snapshot at T+9 (34 min for 72GB), `rollout undo` at T+45,
new pods READY at T+51. Recovery: 49 min. 3 write requests during
window replayed from Kafka DLQ. Post: process gap flagged — Flyway
`V___drop_*` migrations added to CAB checklist; two-release
deprecation pattern documented (v5.4 stops writing, v5.5 drops
column).

## Anti-patterns to avoid for Spring

- **Rolling back code without checking Flyway migration reversibility**
  — reverted app fails hibernate schema-validate on startup and enters
  CrashLoop.
- **Skipping the pod-drain / connection-drain step** — active
  in-flight requests get 502s during rollout.
- **Rolling back without checking Kafka consumer offset state** —
  reverted consumer may re-process messages or skip new-schema
  messages it can't parse.
- **Forcing `--force` on `kubectl apply`** during rollback — bypasses
  the ReplicaSet history that `rollout undo` relies on.
- **Rolling back ConfigMap without restarting pods** — Spring `@Value`
  bindings resolved at startup don't hot-reload.

---

Generate the full rollback plan using `templates/rollback-plan.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
