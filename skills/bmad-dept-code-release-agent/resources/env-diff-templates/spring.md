# Env-diff authoring guide — Spring Boot

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an env-diff for a Spring Boot service. Combine
with `templates/env-diff.md` as the master skeleton.

## Purpose framing

A Spring Boot env-diff catches profile-file drift
(`application-<profile>.yml`), ConfigMap and Secret gaps between K8s
namespaces, Spring Cloud Config Server repository divergence,
LaunchDarkly/Unleash flag deltas, and DB/Kafka credential rotation
gaps. It should also flag HPA sizing mismatches, JVM heap deltas that
will surface as GC pressure in prod, and actuator endpoint exposure
that was widened for debugging in Stage but never tightened before
promotion.

## Config-file diff scope for Spring

- **`application.yml`** (defaults) + **`application-<profile>.yml`**
  per active profile — resolve the effective merged config per env
  before diffing.
- **`application.properties`** if the project mixes formats.
- **K8s ConfigMaps** per namespace — env-injected as `configMapRef`
  or mounted as files under `/config`.
- **K8s Secrets** per namespace — env-injected as `secretKeyRef`.
- **Spring Cloud Config repo** contents per branch/label if the project
  uses Config Server.
- **Helm `values-<env>.yaml`** overlays.
- **Actuator security config** — `management.endpoints.web.exposure.include`
  per env, `management.endpoint.*.enabled`.
- **`logback-spring.xml` / `log4j2-spring.xml`** — logger levels per
  Spring profile.

## Env-var diff conventions for Spring

- Non-sensitive: `SPRING_PROFILES_ACTIVE`, `SERVER_PORT`,
  `MANAGEMENT_SERVER_PORT`, `JAVA_OPTS`, `SPRING_APPLICATION_NAME`,
  `MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS`.
- Sensitive (REDACTED): `SPRING_DATASOURCE_PASSWORD`,
  `SPRING_KAFKA_PROPERTIES_SASL_JAAS_CONFIG`,
  `SPRING_REDIS_PASSWORD`, JWT signing keys
  (`APP_JWT_SIGNING_KEY`), TLS keystore passwords.
- Spring relaxed-binding: `SPRING_DATASOURCE_URL` vs
  `spring.datasource.url` — normalize both forms before diffing so
  the diff doesn't fire on cosmetic naming.

## Feature-flag state comparison

- **LaunchDarkly / Unleash / Split** — export flag state per
  environment via SDK REST call; diff the flag key + variation +
  rollout percentage.
- **Spring `@ConditionalOnProperty`** flags — surfaced by scanning
  properties files for keys referenced by `@ConditionalOnProperty` and
  showing their per-env value.
- **`spring.cloud.discovery.enabled`**, **`spring.kafka.consumer.enabled`**,
  and other core-toggle properties.
- **Feature-flag configuration in `application-<profile>.yml`** —
  custom `app.features.<name>=true/false` keys.

Example `--env stage --to-env prod` presentation:

> `app.features.newPricingEngine` — Stage `true`, Prod `false`.
> Owner: pricing-team. Note: awaiting SLA confirmation before Prod
> rollout.

## Secret-rotation diff (redacted)

- **JWT signing key** — 30d SLA typical for signing, 90d for
  verification-only keys.
- **DB credentials** — 90d SLA.
- **Kafka SASL creds** — 90d SLA.
- **TLS certs** — track expiry date (not rotation date) — critical
  if <30d to expiry.
- **OAuth client secrets** for Spring Security downstream clients.
- **K8s Secret last-modified timestamp** (from
  `metadata.annotations.reloader.stakater.com/last-restart` or the
  Secret's own `resourceVersion` tracking).

Row shape:
`<REDACTED — last rotated 2026-08-01, SLA 90d, status fresh>` for
secrets. For TLS certs, include expiry date:
`<REDACTED — cert expires 2026-11-01, status warning-30d>`.

## Infrastructure diffs for Spring

- **K8s Deployment replicas** — min via HPA `minReplicas`, max via
  `maxReplicas`.
- **HPA target CPU %** and target memory %.
- **JVM heap** — from `JAVA_TOOL_OPTIONS` or Deployment env var;
  container memory limit vs `-Xmx` mismatch is a classic cause of
  OOMKilled.
- **DB connection pool** (`spring.datasource.hikari.maximum-pool-size`)
  per env.
- **Kafka consumer group parallelism** (partition count × consumer
  count).
- **Circuit breaker + retry config** — Resilience4j per-env overrides.

## Risk assessment per diff category

- Config diffs: MEDIUM (Spring reloads on restart; `@RefreshScope`
  hot-reloads a subset).
- Env-var diffs: LOW (non-secret) / HIGH (secret) / CRITICAL if
  actuator endpoints widened.
- Feature-flag diffs: HIGH (flag flip = behavior change without deploy).
- Secret rotation gaps: CRITICAL for JWT signing keys past 30d.
- Infrastructure diffs: HIGH (HPA min mismatches cause cold-start
  latency; heap mismatches cause OOMKilled).

## 2 worked env-diff examples for Spring

**Stage → Prod, v2.5.0 pricing engine cutover.** 4
`application-<profile>.yml` deltas (3 intended;
1 orphan: `logging.level.com.example=DEBUG` in Stage — must strip),
2 ConfigMap deltas (both intended), 1 actuator exposure delta
(`management.endpoints.web.exposure.include=*` in Stage vs
`health,info` in Prod — CRITICAL; must tighten before promoting),
1 secret gap (JWT signing key rotated in Stage 2026-07-15, Prod
2026-05-01 — 100d overdue against 30d SLA — CRITICAL), infrastructure:
Prod HPA 3-20, Stage 1-5 (intended); JVM heap 4Gi Prod vs 2Gi Stage
(intended). **Critical action:** rotate JWT signing key in Prod;
tighten Stage actuator exposure before ship; strip DEBUG logging.

**Stage → Prod, Kafka consumer parallelism tune.** 0 profile-file
deltas, 1 ConfigMap delta (`kafka.consumer.concurrency=8` in Stage
vs `4` in Prod — intended, target of the release), 0 secret deltas,
1 TLS cert expiry warning (Kafka broker cert expires in 21d — flag
warning). **Critical action:** schedule Kafka broker cert rotation
within 21d.

## Anti-patterns to avoid for Spring

- **Printing DB passwords, JWT keys, or Kafka SASL configs** — always
  REDACT.
- **Comparing raw property paths without profile resolution** — a
  `default` value and a `-prod`-overridden value are supposed to
  differ; show the resolved effective value per env.
- **Ignoring K8s Secret rotation timestamps** — Secret content
  rotations are invisible unless the pod restarts or reloader is
  wired; the diff should flag stale ResourceVersions.
- **Skipping the actuator exposure diff** — widening
  `management.endpoints.web.exposure.include` is the most common
  Stage-only footgun that leaks to Prod.
- **Diffing `META-INF/spring.factories` or build artifacts** — those
  should be identical on the same code deploy.

---

Generate the full env-diff report using `templates/env-diff.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
