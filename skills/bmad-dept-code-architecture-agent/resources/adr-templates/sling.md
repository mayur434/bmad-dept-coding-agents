# ADR authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an ADR for an Apache Sling / Shaft project
(sling-12 baseline). Combine with `templates/ADR.md` as the master
skeleton.

## Stack-specific decision categories

- **Bundle boundary split** — one uber-bundle vs cohesive per-domain
  bundles vs API/impl split (`bundle-api` + `bundle-impl`); DS component
  activation ordering follows.
- **Feature Model composition** — Sling Feature Model (`.json` features
  composed via `slingfeature-maven-plugin`) vs Sling Starter fat launcher
  vs custom Karaf-style composition.
- **JCR vs external DB** — content in JCR (Oak) vs relational DB with a
  Sling data-source adapter; hybrid write-through cache.
- **MDM (master-data-management) approach** — Sling as MDM authority vs
  Sling as read-side projection of external MDM.
- **Query API design** — JCR XPath vs SQL2 vs QueryBuilder (AEM-derived)
  vs custom Sling Model.
- **Throttling / rate limiting** — Sling `RequestFilter` +
  bucket-based limiter vs upstream gateway (Envoy / Nginx) vs OSGi
  service.
- **Resource resolver mapping** — vanity paths, mapping.jsp, or
  external URL rewrite.
- **Health-check topology** — Sling Health Checks per subsystem vs a
  single aggregated `/system/health` endpoint.
- **Sling Jobs** — persistent-queue vs ordered-queue vs topic
  configuration; consumer scaling.

## Common constraints (stack-specific)

- **Java 11+ / 17** target (sling-12 baseline). <!-- verify: sling-12
  minimum Java version -->
- **OSGi R7+** — declarative services (`@Component`), config admin,
  metatype for admin surfacing.
- **Oak repository** limits: index-cost model, ordered-node performance,
  full-text indexes.
- **Bundle activation** ordering by `@Reference` cardinality; missing
  service = component stays SATISFIED but not ACTIVE.
- **Feature Model** must resolve without unsatisfied capabilities; a
  missing bundle breaks composition at build time.
- **Sling Servlet resolver** — `sling.servlet.resourceTypes` +
  `sling.servlet.methods` + `sling.servlet.selectors` combine to route
  requests; overlap causes non-deterministic dispatch.
- **Content-package layout** — `/apps` (immutable code), `/etc` (config,
  deprecated), `/conf` (contextual config), `/var` (runtime state).
- **Sling Distribution** — inbound/outbound replication has its own
  transport + queue semantics.

## Common alternatives (stack-specific)

### Bundle boundary
- **Uber-bundle** — simplest; harder to test in isolation; large
  activation surface.
- **Per-domain bundles** — cohesive; more `META-INF/MANIFEST.MF`
  bookkeeping; clearer failure isolation.
- **API + impl split** — clean interfaces; consumers depend on API only;
  best for shared libraries.

### Composition
- **Feature Model + `slingfeature-maven-plugin`** — declarative; supports
  composition of features; well-suited to multi-tenancy.
- **Sling Starter** — quickstart fat-JAR; ideal for local dev; heavier
  in prod.
- **Karaf** — full OSGi container; more operational surface; overkill for
  most Sling-first projects.

### Storage
- **JCR-only (Oak)** — content, config, and often ephemeral state; simple
  ops; performance ceilings on large graphs.
- **JCR + external RDBMS** — RDBMS for high-write / query-heavy data
  (e.g. transactional records); JCR for content.
- **JCR + external NoSQL** (Mongo, Cassandra) — write-heavy or
  region-sharded scenarios.

### Query
- **JCR XPath** — familiar; performance can be surprising on large
  repositories.
- **SQL2** — expressive; better for complex joins; still bound by Oak
  index availability.
- **QueryBuilder (Granite/AEM-derived)** — high-level; easy for
  developers; sometimes exports as XPath.
- **Sling Models with explicit resolver** — for known-shape reads;
  bypasses query for path-based access.

### Throttling
- **Sling `RequestFilter` + bucket** — cheap; per-node state; needs
  sticky routing for correctness.
- **Upstream gateway** — Envoy / Nginx / Apache with `mod_qos`;
  centralized; adds a hop.
- **OSGi service pattern** — for internal service-to-service throttling.

## Decision drivers for Sling / Shaft

- **Request throughput** (RPS per node) and **p95 latency**.
- **Bundle activation time** (target < 30s startup for hot deploy).
- **Oak repository size** and **query cost**.
- **Team OSGi depth** — DS, `@Reference`, config admin.
- **Content-vs-data split** — where JCR helps, where it hurts.
- **Migration path from AEM AMS** (Shaft integrations) — shared
  content-package + bundle taxonomy.
- **Multi-tenant** requirements — one instance vs one per tenant.
- **Operational complexity budget** — a Karaf-composed system needs
  ops that know Karaf.
- **Compliance** (audit logs, retention) drives Sling Auditor / event
  sink configuration.

## Worked ADR examples for Sling / Shaft

**ADR-071 — Feature Model composition over Sling Starter for production.**
- **Context.** Team is standing up sling-12 for a new content-first
  service; Sling Starter is being used in dev. Production needs
  reproducible, composable artifacts and multi-region deploys.
- **Options.** (A) Continue with Sling Starter fat-JAR, (B) Sling Feature
  Model, (C) Karaf.
- **Decision.** (B) Feature Model. Rationale: declarative, testable
  compositions; the CI produces per-region feature artifacts; local dev
  can still use Starter.
- **Consequences.** + reproducible builds, + multi-region composition,
  – developers learn Feature Model, – build times slightly longer.

**ADR-072 — JCR for content; external Postgres for transactional records.**
- **Context.** The service manages editorial content (JCR-native) plus
  a subscription ledger (append-only, queried by date range, ~1M rows/mo).
- **Options.** (A) All-JCR, (B) JCR + Postgres for ledger, (C) JCR +
  Cassandra.
- **Decision.** (B). Ledger writes via a Sling DataSource + JPA-lite
  adapter; JCR handles content. Rationale: Postgres cheaper to run,
  better indexed range-queries, ops familiarity.
- **Consequences.** + query performance, + ops familiarity,
  – dual-store consistency requires application-side transactions,
  – schema migration tool (Flyway) added to the stack.

**ADR-073 — Bundle boundary: per-domain bundles with API+impl split for shared libs.**
- **Context.** Codebase has grown to ~200 classes across auth, content,
  workflow, notification, and query domains; developers report
  circular-ref issues at build time.
- **Options.** (A) Keep uber-bundle, (B) Per-domain bundles, (C)
  Per-class bundles (fine-grained).
- **Decision.** (B) with shared libs split into api + impl. Rationale:
  clean domain boundaries; easier isolation testing; DS activation
  surface smaller.
- **Consequences.** + faster unit builds, + clearer ownership,
  – increases MANIFEST maintenance, – needs a bundle-dependency ADR
  going forward.

## Anti-patterns to avoid for Sling / Shaft

- **Ordered nodes for high-volume writes** — hits Oak's ordered-node
  ceiling; prefer unordered + explicit sort in query.
- **Sling Servlet without `sling.servlet.methods` set** — matches all
  HTTP methods; will collide with future extensions.
- **Direct JCR API from HTL** — always go through Sling Models to keep
  templates rendering-only.
- **Config admin `.cfg` (properties)** — deprecated for new configs;
  use `.cfg.json` or OSGi Metatype.
- **Long synchronous work in a `RequestFilter`** — pins request threads;
  offload to Sling Jobs.
- **Depending on AEM-only APIs** (WCM, `com.day.cq.*`) in a
  vanilla Sling deployment — breaks portability.

---

Generate the full ADR using `templates/ADR.md` as the master, populating
placeholders with stack-appropriate content from the guide above.
