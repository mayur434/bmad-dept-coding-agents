# Deploy-plan authoring guide — Spring Boot

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a deploy plan for a Spring Boot service
(typically on Kubernetes with Flyway/Liquibase migrations and
Micrometer observability). Combine with `templates/deploy-plan.md`
as the master skeleton.

## Purpose framing

A Spring Boot deploy plan orders the DB migration against the app
rollout, phases K8s pod replacement so `/actuator/health/readiness`
gates traffic per pod, and pins the observability signals the on-call
watches during the window. It must state whether the schema change
is backwards-compatible (safe to precede deploy) or coupled (requires
maintenance / flag), and how the pod-replacement strategy interacts
with the ingress traffic split.

## Pre-deploy checklist for Spring

- **DB migration** ready (Flyway/Liquibase) — classified as
  backwards-compatible (deploy first, safe) or coupled (feature-flag
  or maintenance).
- **Migration dry-run** executed on a stage snapshot; runtime
  estimated < window.
- **K8s replica plan** confirmed (`replicas`, `maxSurge`,
  `maxUnavailable`, PodDisruptionBudget); `HorizontalPodAutoscaler`
  reviewed for min/max.
- **Env vars added** to the config-server (Spring Cloud Config /
  ConfigMap) for any new `@Value` bindings.
- **Secrets rotation** done — DB creds, third-party API keys,
  message-bus credentials current in `Secret` and referenced.
- **`application-<profile>.yaml`** diff reviewed; no unintended
  profile activation.
- **Kafka / RabbitMQ consumer group** offsets snapshotted; consumer
  restart plan documented.
- **`spring-boot-actuator`** endpoints (`/actuator/health`,
  `/actuator/prometheus`) reachable from the K8s probe network.
- **Alerting silences** pre-scheduled for the deploy window on known
  flappy alerts.

## Deploy phases for Spring — rollout-specific

Phase against the resolved `--rollout`:

- **`canary` (K8s + Istio/Linkerd traffic split).** Phase 1 deploy
  v-next to canary Deployment (1 pod); Phase 2 shift 5% of ingress via
  `VirtualService` weighted routing; Phase 3 25% → 50%; Phase 4 100%
  and decommission old Deployment.
- **`blue-green` (two Deployments + Service selector cutover).**
  Phase 1 deploy blue; Phase 2 warm blue via internal probes + smoke;
  Phase 3 flip Service selector `version: blue`; Phase 4 drain
  green after soak.
- **`rolling` (default K8s RollingUpdate).** `maxSurge=25%`,
  `maxUnavailable=0` — pods replaced sequentially with readiness gate.
  Single phase; per-pod verification via readiness probe.
- **`feature-flag`.** Deploy dark; flip via config-server property or
  LaunchDarkly/Unleash flag. Phases: code deploy, flag on for %
  cohort, flag on full.
- **`bigbang` (`Recreate` strategy).** Terminate all pods, apply
  migration, deploy new pods. Reserved for coupled schema changes
  that cannot run alongside the prior version.

## Verification per Spring

- **`/actuator/health` UP** for all pods with all dependency probes
  green (DB, Kafka, Redis, downstream HTTP).
- **`/actuator/health/readiness` UP** on the new pods before ingress
  cutover.
- **p99 latency ≤ baseline + 10%** across the canary/new pods.
- **Error rate < 0.5%** sustained 5 min.
- **JPA connection-pool** utilisation < 80%; no `HikariCP` exhaustion
  warnings.
- **Kafka consumer lag ≤ 10s** (or per-topic SLO) across the group.
- **Flyway/Liquibase history** matches expected version on primary +
  replica.
- **Prometheus scrape** healthy; no stale metrics; new metric names
  from the release surfaced.

## Rollback triggers for Spring

- **p99 latency > 2× baseline** sustained 5 min.
- **Error rate > 1%** sustained 5 min.
- **K8s `CrashLoopBackOff`** on > 2 pods within 10 min.
- **DB connection-pool exhaustion** — `HikariCP` waiters > 0 sustained
  2 min.
- **Kafka consumer lag > 60s** and growing.
- **Migration verification fails** (checksum mismatch, expected
  columns missing).
- **Downstream dependency error rate > 5%** attributable to a client
  library upgrade in the release.
- **Manual call** from release manager or on-call.

## Communication plan for Spring

**Pre-deploy** (T-24h): announce in `#platform-releases` — service
name, version, migration classification, rollout strategy, deploy
window, downstream teams pinged.

**During deploy**: post at each phase gate — migration applied,
canary pod ready, traffic ramped 5/25/50/100, old Deployment drained.

**Post-deploy** (T+2h): all-clear with p99, error-rate, consumer-lag
snapshot vs baseline. Announcement distributed.

## Stakeholder RACI for Spring

| Role | Responsibility |
|---|---|
| Release manager | Owns deploy window + go/no-go at each phase gate. |
| Tech lead | Owns code + migration change set; on bridge for readiness. |
| DevOps / SRE | Executes K8s apply + ingress cutover; monitors probes. |
| DBA / Data platform | Signs off migration; monitors DB during window. |
| QA | Runs API smoke + regression subset against canary. |
| Security | Signs off on secret rotation + dependency upgrades. |
| On-call | Primary responder for latency / error-rate regressions. |

## 2 worked deploy-plan examples for Spring

**v2.5.0 — Loyalty API v2 + Flyway V42 (backwards-compatible),
canary, Prod.**
Pre-deploy: V42 migration dry-run 3.2s; canary Deployment scaled to
1; Istio VirtualService prepped.
- Phase 1: apply Flyway V42 (adds nullable column); no app change
  yet.
- Phase 2: deploy canary Deployment; verify readiness + 5% traffic
  weight; 15 min soak.
- Phase 3: ramp to 25%, 50%; monitor p99 + error-rate; 15 min per step.
- Phase 4: 100% + scale primary Deployment to zero; drain after 24h.
- Rollback: Istio weight back to 0% on canary; delete Deployment;
  V42 is backwards-compatible so no schema revert.

**v2.5.1 — Coupled schema change (column type migration), blue-green
+ maintenance, Prod.**
Pre-deploy: maintenance window 02:00–02:20 UTC; blue Deployment
provisioned; runtime prompt migration script ready.
- Phase 1: pause consumers + set app to read-only via config-server
  flag.
- Phase 2: run Flyway V43 (type migration + backfill); verify.
- Phase 3: flip Service selector to blue; verify readiness.
- Phase 4: resume consumers + clear read-only flag; monitor 15 min.
- Rollback: flip Service selector back; Flyway V43 rollback script
  prepared (see ROLLBACK_PLAN.md).

## Anti-patterns to avoid for Spring

- **Running DB migration in parallel with app rollout** for coupled
  changes — old pods hit new schema, `SQLException` cascade.
- **Skipping readiness probe** on new pods — ingress routes to
  half-warm pods, first requests 502.
- **Deploying with `HikariCP` sized to prior traffic** when the
  release ramps concurrency — pool exhaustion under peak.
- **Rolling migration + rolling deploy on a large table** — table
  lock contention stalls the deploy window.
- **Skipping `PodDisruptionBudget`** — a rolling deploy plus
  a node-drain event drops availability below quorum.

---

Generate the full deploy plan using `templates/deploy-plan.md` as the
master, populating placeholders with stack-appropriate content from
the guide above.
