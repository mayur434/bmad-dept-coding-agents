# HLD authoring guide — Apache Sling / Shaft (sling-12)

## Purpose framing

A Sling HLD establishes the **OSGi bundle boundary**, the **Feature
Model composition** (Sling Starter vs bespoke feature file), the
**JCR-vs-external-DB persistence split**, the **servlet + Sling Model
surface for API endpoints**, and the **service-user / resource-resolver
posture**. Sling projects (including Shaft-based MDM services) live
outside AEM's Cloud Manager guardrails, so the HLD carries more infra
weight than an AEM HLD.

## Typical containers (C4 L2 elements) for Sling

- **OSGi container (Sling instance)** — Author-role and/or Publish-role
  runtime; often deployed as a Feature Model launcher.
- **JCR / Apache Oak** — content repository (Segment or Document
  MongoMK); Oak indexes for query performance.
- **Dispatcher (Apache + mod_dispatcher)** — externalized when Sling
  serves web traffic; optional for pure API workloads.
- **External DB** — Postgres/MySQL when JCR isn't the right shape
  (transactional MDM, reporting stores).
- **MDM service** — Shaft-based master-data service; typically Sling
  Models over external DB.
- **SAM (Sling API Manager) / API gateway** — rate limiting, key
  management, JWT validation ahead of Sling servlets.
- **Health-check + metrics scraper** — Prometheus/Grafana or Splunk
  agent tailing OSGi metrics via `felix.webconsole`.
- **Message broker** — ActiveMQ/RabbitMQ when Sling Jobs need
  cross-instance distribution beyond Oak clustered jobs.

## Stack-specific tech-choice table

| Container | Technology | Why |
|---|---|---|
| Runtime | Sling 12 Feature Launcher <!-- verify: current Sling 12 minor --> | Modular, replaces Sling Starter |
| Repo | Apache Oak 1.60+ (Segment for single-node; Document/Mongo for cluster) <!-- verify --> | Native JCR; scales differently per store |
| DB (aux) | PostgreSQL 15 | JDBC + HikariCP standard |
| Broker | RabbitMQ / ActiveMQ | Sling Jobs Distributed Queue module |
| Web tier | Apache 2.4 + mod_dispatcher (optional) | Same rules language as AEM |
| Auth | Sling AuthenticationHandler + JWT ext | Fine-grained control (unlike AEMaaCS) |
| Config | Sling OSGi Configurations via `.config` files | Feature Model config injection |
| Metrics | Sling Metrics + Micrometer bridge | Bring your own dashboard |

## Cross-cutting concerns for Sling

- **AuthN/AuthZ** — Sling `AuthenticationHandler` chain; JWT via
  `org.apache.sling.auth.core.jwt` or custom; JCR ACLs for content-scoped
  authz; service-user mappings via `ServiceUserMapper`.
- **Logging** — SLF4J → Logback; per-package appenders configured via
  `org.apache.sling.commons.log.LogManager` factory config.
- **Tracing** — OTEL Java agent (bytecode instrumentation) or manual
  spans via `io.opentelemetry.api`.
- **Config** — Feature Model `.config` files + run-mode conditionals
  (`osgi.installer:hint=runmode:publish`).
- **Secrets** — Vault via `org.apache.sling.crypto` or env-var
  substitution in Feature Model.
- **Feature flags** — Toggle Router (`org.apache.sling.feature.togglable`)
  or config-driven booleans.
- **i18n** — `org.apache.sling.i18n` resource bundles from JCR.

## Integration points typical to Sling

- **External DB** — JDBC datasource via HikariCP; Sling DataSource
  Provider.
- **Message broker** — Sling Jobs Distributed Queue over ActiveMQ.
- **REST clients** — Sling Commons HTTP or plain Apache HttpClient 5.
- **LDAP / AD** — via `org.apache.jackrabbit.oak.security.authentication.ldap`.
- **SAML / OIDC** — via `org.apache.sling.auth.saml2` or custom OIDC
  handler.
- **Search** — Solr via Sling Query, or SolrQueryEngine bridge; JCR
  Elastic index for repository-backed search.
- **MDM upstream sources** — SAP/Oracle via JDBC / SOAP; sync consumers
  as Sling Jobs.
- **Downstream consumers** — REST webhooks, event bus, ETL exports.

## NFR profile for Sling

- **OSGi startup** ≤ 60s cold; ≤ 20s hot (bundle-cache-warm).
- **MDM CRUD** ≤ 100ms p95 for single-record; ≤ 500ms p95 for
  aggregate.
- **JCR write** ≤ 200ms p95 for shallow node; ≤ 1s for deep tree.
- **Servlet render** ≤ 200ms p95.
- **Sling Job throughput** ≥ 50 jobs/s per instance <!-- verify: default
  Sling Jobs concurrency -->.
- **Availability** — 99.9% for API tier; DR-RTO ≤ 1h if Oak
  Document/Mongo is externalized.
- **Repo compaction** — nightly for Segment; monitored for Document
  garbage collection lag.

## Capacity planning shape

- **Single instance** — up to ~200 concurrent RPS for simple servlets
  <!-- verify: Sling servlet benchmark -->.
- **Cluster** — 2+ Oak Document nodes on MongoDB replica set; ~500 RPS
  aggregate.
- **JCR repo size** — Segment scales to ~100 GB before compaction pain;
  Document/Mongo scales further but pays latency cost.
- **Sling Jobs** — plan queue depth vs consumer count per instance.
- **Bundle count** — keep total <300 for reasonable startup; Feature
  Model helps prune.

## Deployment topology

Mermaid `flowchart` shape: `Client → Dispatcher (optional) → Sling
instance(s) → Oak → Mongo cluster (if Document)`. For MDM API:
`Client → SAM/Gateway → Sling instance → Postgres`. Sling Jobs cross
instances via Oak's distributed queue or external broker.

## Delivery / release approach for Sling

- **Feature Model release** — build `feature.json` per env; deploy via
  `sling-feature-launcher` or container image (Feature-based Docker).
- **Bundle install order** — Feature Model handles dependency order;
  never manual bundle install in prod.
- **Hot swap vs full restart** — most updates hot-deploy via bundle
  replace; JCR node-type or index changes need graceful restart.
- **DB migrations** — Flyway/Liquibase alongside; run as bootstrap OSGi
  activator or separate migration container.
- **Rollback** — redeploy previous `feature.json` image tag; JCR
  content rollback via package restore.

## 3 worked HLD outline examples for Sling

**HLD-01: Customer MDM Service (Shaft-based)**
- Containers: Sling instances (3x), Postgres (primary + replica),
  RabbitMQ, upstream SAP + Oracle EBS + Salesforce, downstream ETL.
- ADRs: ADR-JCR-vs-Postgres-for-golden-record; ADR-sync-strategy
  (CDC vs pull); ADR-idempotency-key-shape.
- Cross-cutting: OTEL agent, service-user mapping per source, JWT for
  downstream consumers.
- NFRs: MDM CRUD p95 ≤ 100ms, sync lag ≤ 5 min, availability 99.9%.
- Migration: dual-write from legacy → dual-read → cutover.

**HLD-02: Sling-based Marketing Content API**
- Containers: Sling Publish (5x) + JCR Segment + Dispatcher + CDN +
  Adobe Analytics.
- ADRs: ADR-content-model (CF-like vs custom node types);
  ADR-cache-invalidation.
- Cross-cutting: Sling Model exporters, JWT for partner APIs, i18n via
  Sling i18n.
- NFRs: p95 ≤ 200ms; hit ratio ≥ 90%; content publish lag ≤ 30s.
- Rollout: staged by content type.

**HLD-03: OSGi-based ETL Orchestrator**
- Containers: Sling instances (2x) + Oak (small repo, config only) +
  RabbitMQ + upstream/downstream systems.
- ADRs: ADR-job-topology (Sling Jobs vs Airflow); ADR-retry-policy.
- Cross-cutting: dead-letter queue, alerting on job failure spike.
- NFRs: job throughput 100/min; failure MTTR ≤ 15min.
- Rollout: per-pipeline enablement, feature-flag gated.

## Anti-patterns to avoid for Sling

- **Manual bundle install in production** — always via Feature Model;
  otherwise install order drift breaks reproducibility.
- **JCR for high-volume transactional data** — Oak isn't a Postgres
  replacement; use an external DB for OLTP.
- **Long-running work in Sling servlets** — offload to Sling Jobs;
  same pinning issue as AEM.
- **Skipping service-user mappings** — running as `admin` for
  convenience is a compliance failure.
- **Unbounded Sling Job queues** — always cap and DLQ; unbounded
  queues turn cluster hiccups into cascading outages.

---

Generate the full HLD using `templates/HLD.md` as the master, populating
placeholders with stack-appropriate content from the guide above. When
container/technology decisions are still open, produce an ADR alongside
(see `resources/adr-templates/sling.md`).
