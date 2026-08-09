# Env-diff authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an env-diff for an Apache Sling / Shaft
(sling-12) project. Combine with `templates/env-diff.md` as the master
skeleton.

## Purpose framing

A Sling env-diff catches OSGi config drift between run-mode overlays,
Feature Model composition gaps between build outputs, JCR bootstrap
content that landed only in one env, and `sling.properties` deltas
that change service-user resolution or servlet resolution behavior.
It should flag JCR credential material found in env vars (a
misconfiguration — credentials belong in Sling service-user mappings,
not env) and instance-count / heap sizing mismatches that surface as
job-queue backlog in production.

## Config-file diff scope for Sling

- **OSGi `.config` files** under `src/main/resources/config.<mode>/`
  and `src/main/resources/config/` — one diff block per PID, resolved
  by run mode.
- **Feature Model `.json`** per env overlay
  (`src/main/features/feature-<env>.json`) — bundle set,
  configurations, extensions, framework-properties.
- **`sling.properties`** — framework properties, launchpad startup
  levels, `sling.home` overrides.
- **JCR bootstrap content** under `src/main/resources/SLING-INF/content/`
  — env-scoped initial content (nodes, service-user mappings).
- **`src/main/composum/*` or `src/main/webresources/*`** overlays for
  Sling starter customizations.
- **Servlet resolution overrides** under `sling:servletResolver`
  factory configs.
- **Sling Jobs config** — `org.apache.sling.event.jobs.*` factory
  configs; queue topology per env.

## Env-var diff conventions for Sling

- Non-sensitive: `SLING_HOME`, `SLING_OPTS`, `SLING_PORT`,
  `JAVA_OPTS`, `SLING_RUN_MODES`.
- Sensitive that MUST NOT appear in env (flag if found): JCR admin
  credentials, service-user passwords — these belong in
  service-user mapping configs, not env vars. If the diff spots a
  `JCR_ADMIN_PASSWORD` or similar in the env-var scan, mark as
  CRITICAL misconfiguration.
- Sensitive that legitimately appears in env: TLS keystore passwords
  (`javax.net.ssl.keyStorePassword`), external integration API keys
  loaded by OSGi Config-Admin.

## Feature-flag state comparison

Sling projects typically use OSGi service properties or Config Admin
values as flag mechanisms:

- **OSGi service-property-based flags** — `enabled=true/false` on the
  target component's PID; diff resolves the effective per-env value.
- **Feature Model conditional bundles** — a feature that only appears
  in `feature-prod.json` acts as a hard flag.
- **JCR-content-based flags** — nodes under `/apps/<project>/config`
  whose properties gate downstream servlets.
- **`org.osgi.framework.startlevel.beginning`** — flag-shaped when a
  bundle set is deliberately not started in one env.

Example `--env stage --to-env prod` presentation:

> `com.example.experimental.NewSearchIndex` — Stage `enabled=true`
> (via `.config`), Prod `enabled=false`. Owner: search-team. Note:
> awaiting index-warm-up validation.

## Secret-rotation diff (redacted)

- **TLS keystore passwords** — 90d SLA typical.
- **Service-user credentials** issued via
  `org.apache.sling.serviceusermapping.impl.ServiceUserMapperImpl.amended`
  — rotation via password change in JCR.
- **External integration API keys** loaded by OSGi Config-Admin
  factories (e.g. downstream REST clients).
- **Sling Jobs queue credentials** if the queue is externalized
  (rare — JCR-backed by default).

Row shape: `<REDACTED — last rotated 2026-08-01, SLA 90d, status fresh>`.

## Infrastructure diffs for Sling

- **OSGi container instance count** — how many Sling instances in the
  pool per env.
- **JCR replication topology** — number of subscribers, replication
  agent count per publisher.
- **Sling Jobs consumer parallelism** — thread-pool size per queue
  factory.
- **JVM heap** per instance (from `SLING_OPTS`).
- **JCR datastore backend** — file / S3 / MongoDB per env (should be
  intentional; flag mismatches loudly).
- **HTTP whiteboard port + connector config** per env.

## Risk assessment per diff category

- Config diffs: MEDIUM (OSGi hot-reload for most, restart for a few).
- Env-var diffs: LOW (non-secret) / HIGH (secret) / CRITICAL if JCR
  credentials found in env.
- Feature-flag diffs: HIGH (service property flip is a behavior change).
- Secret rotation gaps: CRITICAL for TLS or service-user past SLA.
- Infrastructure diffs: MEDIUM-HIGH (job-queue parallelism directly
  affects async processing throughput).

## 2 worked env-diff examples for Sling

**Stage → Prod, v2.5.0 search-index rollout.** 6 OSGi `.config`
deltas (5 intended for release; 1 orphan:
`org.apache.sling.commons.log.LogManager.factory.config-verbose`
enabled in Stage only — must strip), 1 Feature Model delta
(`feature-search.json` bundles added to Prod feature only — intended),
0 env-var deltas, 1 secret gap (TLS keystore password rotated in
Stage 2026-06-01, Prod 2026-01-01 — 220d overdue against 90d SLA),
infrastructure: identical heap, Prod instance count = 6, Stage = 2
(intended). **Critical action:** rotate TLS keystore in Prod and
strip verbose logging config before promoting.

**Stage → Prod, service-user permission fix.** 0 config deltas at
the OSGi factory level, but 1 JCR bootstrap content delta
(`/apps/<project>/config/rep:policy` updated in Stage only — must
promote), 0 env-var deltas, 1 misconfiguration flagged
(`JCR_ADMIN_PASSWORD` env var found on Stage instance — CRITICAL;
credentials belong in service-user mapping, not env). **Critical
action:** promote the JCR policy delta and remove `JCR_ADMIN_PASSWORD`
from Stage env immediately.

## Anti-patterns to avoid for Sling

- **Printing service-user passwords or TLS keystore passwords** — always
  REDACT.
- **Diffing `SLING-INF/nodetypes` .cnd files** — should be identical
  across envs on the same code deploy; drift here indicates a build
  contamination.
- **Ignoring Feature Model composition ordering** — bundle install
  order matters; a re-ordering across envs is a real drift.
- **Comparing raw `.config` file names across run modes** — always
  resolve the effective config per env before diffing.
- **Skipping the `sling.properties` diff** — start-level and framework
  property drift is a common cause of servlet-resolution surprises.

---

Generate the full env-diff report using `templates/env-diff.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
