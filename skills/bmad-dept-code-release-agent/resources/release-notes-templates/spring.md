# Release-notes authoring guide — Spring Boot

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating release notes for a Spring Boot middleware
service. Combine with `templates/release-notes.md` as the master
skeleton.

## Purpose framing

Spring Boot release notes speak to API consumers, DevOps / SRE, and
downstream service teams. Any change that touches an API contract, a
JPA schema, a Kafka topic, or a Spring Security config must be
prominent — these are the classes of change that cause upstream and
downstream teams to coordinate a deploy window. Notes should distinguish
*contract* changes (OpenAPI schema, Kafka topic schema) from *runtime*
changes (config, dependencies) and always name the rolling-restart
sequence.

## Change categories for Spring

- **API contract changes** — OpenAPI schema diffs, new/removed
  endpoints, response body shape shifts, HTTP status code changes.
- **JPA / DB schema changes** — Flyway/Liquibase migration additions;
  breaking column drops or type narrowing.
- **Kafka topic contract changes** — new topics, schema registry
  version bumps, consumer-group renames, partition-count changes.
- **Spring Security config changes** — new authz filters,
  `HttpSecurity` matcher changes, JWT issuer/audience changes.
- **Actuator endpoint additions** — new `/actuator/*` exposures, health
  indicator additions, Micrometer metric additions.
- **Spring Boot version bump** — starter version crossings; auto-config
  behavior changes.
- **Dependency major bumps** — Hibernate, Jackson, Netty, or transitive
  CVE fixes.
- **Feature-flag additions** — dark-launch flag additions, LaunchDarkly
  targeting rules.

## Commit-format conventions for Spring

- **Conventional Commits mapping:**
  - `feat(api|kafka|service): …` → **New features**
  - `fix(controller|repo|security): …` → **Fixes**
  - `perf(jpa|cache|netty): …` → **Performance**
  - `refactor(service|config): …` → **Refactoring**
  - `build(gradle|maven|dockerfile): …` → **CI / build changes**
  - `chore(deps): …` → skip unless CVE or major
- **Escalate as BREAKING when any commit touches:**
  - OpenAPI schema removal or type change on a shipped endpoint
  - Flyway migration with `DROP COLUMN`, `DROP TABLE`, or type narrowing
  - Kafka topic schema field removal or type change (schema-registry
    incompatible mode)
  - Consumer group ID rename (offsets reset)
  - `HttpSecurity` matcher tightening on an existing path
  - JWT issuer / audience change
  - `application-<profile>.yaml` key rename or removal with no default
- **Skip in customer-facing notes:** `test:` unit-test refactors,
  `chore(deps):` patch bumps with no CVE, internal Micrometer tag
  renames.

## Breaking changes for Spring

1. **OpenAPI response-shape change.** Downstream clients deserialize
   partially or crash. *Mitigation:* version the endpoint (`/v2/…`),
   dual-serve for one release.
2. **Flyway `DROP COLUMN`.** Rolling deploy with two versions live
   crashes the older instance. *Mitigation:* expand-contract pattern
   over two releases.
3. **Kafka schema removal.** Consumers deserialize null. *Mitigation:*
   schema-registry `BACKWARD_TRANSITIVE` + deprecation cycle.
4. **Kafka consumer-group rename.** Offsets reset — replay from
   earliest or explicit committed offset. *Mitigation:* pre-deploy
   offset export + re-import script.
5. **Security matcher tightening.** Callers previously permitted
   receive 403. *Mitigation:* audit callers, coordinate a deploy
   window.
6. **JWT issuer change.** All tokens invalidated. *Mitigation:*
   dual-issuer acceptance for one rollout window.
7. **`application.yaml` key rename.** Config binding fails on startup.
   *Mitigation:* support both keys via `@ConfigurationProperties` alias
   for one release.
8. **Spring Boot major crossing** (e.g. 2.7 → 3.x). Jakarta EE 9+
   package renames break all `javax.*` imports. *Mitigation:*
   `jakarta.*` migration, run `openrewrite` scripts. <!-- verify: current SB LTS -->

## Upgrade notes for Spring

Guidance on what upgrade notes should include:

- **DB migration ordering** — Flyway/Liquibase runs on app startup by
  default; for rolling deploys, run the migration manually before
  starting new instances (expand-contract).
- **Env-var additions** — list new required env vars + default
  fallbacks; call out which are secrets vs config.
- **Rolling-restart sequence** — canary-first if using traffic-split;
  otherwise `RollingUpdate` with `maxUnavailable: 0`, `maxSurge: 1`.
- **Kafka rebalance window** — expect consumer rebalance if group ID
  or topic partitions changed; typical duration 30-60s.
- **Feature-flag flip order** — flags flipped after all pods on new
  version.
- **Actuator readiness/liveness contract** — `/actuator/health/readiness`
  gates deploy; `/actuator/health/liveness` gates restart.
- **Helm chart / K8s manifest changes** — call out any ConfigMap /
  Secret / Deployment spec change.
- **JVM flags** — G1 vs ZGC choice, heap sizing hints, container-awareness flags.

## Known issues for Spring

Typical known-issues to disclose:

- Startup time p95 up 8s under `spring-cloud-config` cold cache — warm
  via startup probe delay.
- Micrometer `http.server.requests` tag cardinality warning under Java
  17 + Boot 3.1.x on high-URI-diversity endpoints.
- Kafka consumer occasional `OffsetOutOfRangeException` on partition
  reassignment when broker version < 3.5. <!-- verify: current broker floor -->
- Hikari pool exhaustion warning on cold cache — increase
  `maximum-pool-size` to 20 or preload.
- Spring Security 6 `AuthorizationDecision` audit-log format changed —
  SIEM parsers may need re-training.

## Contributor + PR/ticket linking conventions

- **Jira project keys:** typically `SVC-####`, `API-####`, `PLAT-####`,
  or customer-specific; surface via commit trailers `Ticket: SVC-1234`.
- **PR links:** GitHub `owner/service#456`, GitLab `!456`.
- **CI build ID** — reference the pipeline run
  (`github.com/owner/repo/actions/runs/12345`) for reproducibility.
- **Container image tag** — publish the digest
  (`ghcr.io/owner/service@sha256:abc…`) for the release.
- **Deployment ID** — Helm release name + revision, or ArgoCD app +
  sync ID.

## 3 worked release-notes examples for Spring

**v2.5.0 — Loyalty balance API (2026-03-14).**
- **New:** `GET /v1/loyalty/{customerId}/balance`, `POST
  /v1/loyalty/{customerId}/redeem`; Kafka topic
  `loyalty.redemption.v1` (3 partitions, schema-registry ID 42).
- **Fixed:** N+1 in `OrderRepository.findWithItems` (SVC-2010) —
  p99 -220ms.
- **Perf:** Hikari pool bumped 10 → 20; startup warmup preload cuts
  cold-cache p99 by 60%.
- **Upgrade:** Flyway `V2.5.0__loyalty_balance.sql` applied
  automatically on startup; verify `loyalty_balance` table present.
  Env var `LOYALTY_SCHEMA_REGISTRY_URL` required.
- **Known issue:** Micrometer cardinality warning on
  `http.server.requests` (planned tag whitelist in v2.5.1).

**v2.5.1 — Security hotfix (2026-03-19).**
- **Fixed:** `HttpSecurity` matcher on `/v1/loyalty/**` was permitting
  anonymous access due to matcher order bug (CVE-scored MEDIUM;
  Ticket SVC-2031).
- **Breaking:** `/v1/loyalty/**` now requires `SCOPE_loyalty:read` or
  `SCOPE_loyalty:write`. Downstream teams must add scopes to their
  service-account tokens.
- **Upgrade:** Rolling restart; verify all callers holding new scopes
  BEFORE cutover (list published in release ticket).

**v3.0.0 — Spring Boot 3 crossing (2026-05-02).**
- **Breaking:** Spring Boot 2.7 → 3.2; all `javax.*` → `jakarta.*`.
  All downstream libraries pinned to Jakarta EE 9+.
- **Breaking:** Actuator `/actuator/prometheus` endpoint path
  unchanged but metric name `http_server_requests_seconds_count`
  cardinality reduced (tag `outcome` dropped).
- **Upgrade:** Blue-green preferred; run `openrewrite` migration on
  any co-deployed library; verify Prometheus dashboards.
- **Known issue:** Spring Security 6 audit-log format changed — SIEM
  parser retraining required.

## Anti-patterns to avoid for Spring

- **`DROP COLUMN` without expand-contract.** Rolling deploys with two
  versions live crash the old one.
- **Undocumented Kafka consumer-group rename.** Offsets reset silently
  — potential double-processing or lost events.
- **Missing OpenAPI version pin.** Consumers can't reproduce the
  release-time contract.
- **Buried Spring Boot major crossing.** Jakarta migration is a project,
  not a release note — but the release notes must call out that the
  crossing has landed.
- **Skipping the actuator readiness/liveness note.** Ops needs to know
  when to trust the health signal during rolling deploy.

---

Generate the full release notes using `templates/release-notes.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
