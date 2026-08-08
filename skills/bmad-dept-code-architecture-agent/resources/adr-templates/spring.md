# ADR authoring guide — Spring Boot

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an ADR for a Spring Boot custom-middleware
project. Combine with `templates/ADR.md` as the master skeleton.

## Stack-specific decision categories

- **Web framework** — Spring MVC (servlet, blocking) vs Spring WebFlux
  (reactive, Netty-first).
- **Persistence** — Spring Data JPA vs jOOQ vs raw JDBC vs Spring Data
  R2DBC (reactive).
- **Broker** — Kafka vs RabbitMQ vs AWS SQS/SNS vs Google Pub/Sub;
  exactly-once vs at-least-once trade-offs.
- **Spring Cloud vs plain** — config server / discovery / gateway /
  circuit breaker as first-class Spring Cloud vs equivalents from the
  platform (Consul, Envoy, Istio).
- **Auth model** — Spring Security resource-server (JWT / opaque token)
  vs auth offloaded to an upstream gateway (Envoy JWT filter, Kong,
  Istio JWT).
- **Observability stack** — Micrometer + Prometheus vs OTEL SDK direct;
  Zipkin / Tempo / Datadog / New Relic.
- **DB sharding / replication** — single writer + read replicas vs
  logical sharding vs Vitess-style; Spring Data supports read-write
  split via `AbstractRoutingDataSource`.
- **Testing strategy** — Testcontainers for real DB + broker vs H2 +
  embedded broker; contract tests via Spring Cloud Contract or Pact.
- **Migrations** — Flyway vs Liquibase.
- **Native image** — Spring Boot 3+ AOT + GraalVM native vs plain JVM.

## Common constraints (stack-specific)

- **Java 17+ / 21** LTS baseline (Spring Boot 3.x).
- **Actuator** exposes `/actuator/health`, `/metrics`, `/info`; must be
  bound to a management port distinct from application port in prod.
- **@Transactional propagation** rules bite when combined with async
  event publishers; requires an event-outbox pattern for exactly-once.
- **Bean scope** — singleton default; `request` / `session` scopes need
  proxy configuration.
- **Component scan boundary** — package placement drives bean discovery;
  a rogue `@Configuration` outside the scan silently disables features.
- **DI cycle** — `BeanCurrentlyInCreationException` at startup; requires
  refactor, not `@Lazy`.
- **PII / GDPR** — application logs must scrub structured fields.
- **Kubernetes readiness vs liveness** — Actuator groups (`readiness`,
  `liveness`) must map to the platform probes.

## Common alternatives (stack-specific)

### Web framework
- **Spring MVC** — blocking; battle-tested; huge ecosystem; simpler
  mental model; Tomcat/Jetty embedded.
- **Spring WebFlux** — reactive; higher concurrency per thread; steeper
  learning curve; Reactor `Mono` / `Flux` propagate through every layer.
- **Hybrid** — MVC + WebClient (reactive HTTP client in MVC app);
  usually a stepping stone, not a destination.

### Persistence
- **Spring Data JPA (Hibernate)** — highest productivity; N+1 risk;
  entity graph management.
- **jOOQ** — type-safe SQL DSL; explicit control; less magic.
- **Spring Data JDBC** — lightweight aggregate mapping; no lazy loading;
  simpler mental model.
- **Raw JDBC + `JdbcTemplate`** — for perf-critical / bulk ops.
- **Spring Data R2DBC** — reactive; requires WebFlux; ecosystem still
  narrower than JPA.

### Broker
- **Kafka** — high throughput; ordered per-partition; exactly-once via
  transactions; ops-heavy.
- **RabbitMQ** — flexible routing (topic/direct/fanout); simpler ops;
  lower throughput ceiling than Kafka.
- **SQS + SNS** — managed; at-least-once; no ordering (unless FIFO
  queue); great for AWS-native.
- **Google Pub/Sub** — managed; ordering-key support; at-least-once.

### Observability
- **Micrometer + Prometheus + Grafana** — Spring-native metrics; separate
  tracing via Micrometer Tracing / Zipkin.
- **OTEL SDK direct** — vendor-neutral; more code; ties well to
  Datadog / Honeycomb / Tempo.
- **Datadog agent + APM** — turnkey; vendor-locked.

### Testing
- **Testcontainers** — real Postgres / Kafka / Redis; slower; catches
  more bugs.
- **H2 + embedded broker** — fast; hides dialect drift.
- **@DataJpaTest / @WebMvcTest slices** — narrow contexts; fast; useful
  for pure unit-ish tests.

## Decision drivers for Spring Boot

- **p95 / p99 latency** per endpoint and **throughput per pod**.
- **JVM heap + GC budget** — G1 vs ZGC vs native.
- **Cold-start budget** — matters on serverless / native image.
- **Team reactive skill** — WebFlux requires reactive fluency across the team.
- **Consistency model** — exactly-once vs at-least-once shapes broker
  choice + outbox pattern.
- **DB ownership** — single-writer vs multi-writer; sharding threshold.
- **Deployment target** — Kubernetes / OpenShift / AWS ECS / Cloud Run;
  drives Actuator probe wiring, secret injection, config source.
- **Existing vendor stack** — Datadog, Splunk, New Relic already in
  place → align observability.
- **Security posture** — gateway-offloaded vs in-app JWT validation.
- **Compliance** (PCI, HIPAA, SOC2) — audit log requirements, PII
  scrubbing, secret rotation cadence.
- **Migration cost** — moving from a legacy Spring 2.x / 4.x app;
  Boot 3 removes `javax.*` in favor of `jakarta.*`.

## Worked ADR examples for Spring Boot

**ADR-081 — Kafka over SQS for order-events (exactly-once required).**
- **Context.** Downstream billing service requires exactly-once semantics
  on order creation; current implementation uses SQS with dedupe key +
  application-level idempotency, but reconciliation still catches drift.
- **Options.** (A) Keep SQS + tighter idempotency, (B) Kafka with
  transactional producer + `read_committed` consumer, (C) RabbitMQ with
  publisher confirms + consumer acks.
- **Decision.** (B) Kafka. Rationale: exactly-once via transactions is
  first-class; the platform already runs Kafka for other domains; ops
  cost is amortized. Broker upgrade rated Medium (2 sprints).
- **Consequences.** + true exactly-once via Kafka transactions, +
  ordered per-partition delivery, – ops adds a topic ownership matrix,
  – consumer needs to handle transactional-marker offsets.

**ADR-082 — Spring MVC (not WebFlux) for the promotions service.**
- **Context.** Team of 6 backend engineers, 1 with reactive experience;
  service does ~500 RPS with blocking JDBC to Postgres; requires
  standard REST + admin UI.
- **Options.** (A) Spring MVC + JPA, (B) WebFlux + R2DBC, (C) Hybrid.
- **Decision.** (A). Rationale: throughput and latency targets easily
  met by MVC + JPA at current sizing; team ramp-up cost on reactive
  outweighs benefits; JPA ecosystem still richer than R2DBC.
- **Consequences.** + team ships fast, + widely-known ops model, – no
  headroom for a future 10x traffic burst without rework, – JPA N+1
  vigilance required.

**ADR-083 — Micrometer + OTEL bridge (not OTEL SDK direct).**
- **Context.** Vendor stack is Datadog APM; team wants Spring-idiomatic
  metrics API; needs to keep the door open for a vendor swap.
- **Options.** (A) OTEL SDK direct, (B) Micrometer + `micrometer-tracing`
  + OTEL exporter, (C) Datadog Java agent only.
- **Decision.** (B). Rationale: Micrometer is the Spring-native
  registry; OTEL export gives vendor portability; Datadog agent can
  ingest OTEL.
- **Consequences.** + Spring-native metric API, + vendor-swappable,
  – slight overhead from bridging, – requires alignment on trace
  propagation headers.

## Anti-patterns to avoid for Spring Boot

- **Choosing WebFlux to "get async" for a JDBC-only workload** — you
  block anyway; MVC + async controllers get 90% of the benefit.
- **`@Async` + `@Transactional` on the same method** — the transaction
  is not propagated to the async thread; refactor to a
  post-transaction event.
- **H2 in tests for a Postgres app** — dialect drift bites in
  production (JSON columns, arrays, timezone handling); prefer
  Testcontainers.
- **Deep circular DI** solved with `@Lazy` — signals a design smell;
  refactor the boundary.
- **Sharing an `EntityManager` across threads** — not thread-safe;
  causes intermittent state corruption.
- **Exposing Actuator on the application port in prod** — separate
  management port + auth, or you leak `/heapdump` / `/env`.

---

Generate the full ADR using `templates/ADR.md` as the master, populating
placeholders with stack-appropriate content from the guide above.
