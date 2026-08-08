# BRD authoring guide — Spring Boot middleware

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a BRD for a Spring Boot service — typically a REST
or GraphQL middleware sitting between an Adobe front-end (AEM / EDS /
Commerce SaaS) and downstream systems. Combine with `templates/BRD.md` as
the master skeleton.

## Stack-specific personas

- **API consumer (upstream engineer)** — a front-end or partner team
  calling the service. Pain: undocumented breaking changes, opaque error
  responses, unpredictable p99 latency.
- **Service owner (backend engineer)** — writes controllers, services,
  repositories, and integration wiring. Pain: N+1 in `@Repository` queries,
  bean-lifecycle surprises, missing observability on downstream calls.
- **Ops / SRE engineer** — runs the service in Kubernetes, owns liveness
  / readiness probes, HPA, alerting. Pain: JVM heap-pressure without
  visibility, slow rollout rollbacks, correlated Kafka consumer lag.
- **Security engineer** — owns OAuth2 / OIDC resource-server posture,
  vulnerability scanning, secrets rotation.

## Stack-specific in-scope patterns

- REST controllers via `@RestController` + `@RequestMapping` + `@Valid`.
- Optional GraphQL server via `spring-graphql`.
- Service-layer decomposition (`@Service` + `@Transactional`).
- Repository layer via Spring Data JPA (`JpaRepository`) or Spring Data
  R2DBC for reactive.
- DTO mapping via MapStruct or explicit mapper classes (never expose JPA
  entities in the API surface).
- Spring Security `SecurityFilterChain` with OAuth2 resource-server
  (`spring-boot-starter-oauth2-resource-server`).
- Actuator endpoints (`/actuator/health`, `/actuator/prometheus`,
  `/actuator/info`, `/actuator/loggers`).
- Distributed tracing via Micrometer Tracing + OpenTelemetry exporter.
- Kafka producer / consumer via `spring-kafka` with idempotent producer.
- Async work via `@Async` (with a bounded `ThreadPoolTaskExecutor`).
- Testcontainers for DB / Kafka / Redis integration tests.

## Stack-specific out-of-scope patterns

- Field injection (`@Autowired` on fields) — prefer constructor injection.
- Static holders for `ApplicationContext` — inject dependencies.
- `Thread.sleep()` inside a request thread — use `@Async` or reactive.
- Custom thread pools without bounded queues — use
  `ThreadPoolTaskExecutor` with an explicit `queueCapacity`.
- `@Transactional` on private methods (Spring proxy won't apply).
- Exposing JPA entities directly in `@RestController` return types.
- Reading `application.properties` via `Environment` in random places —
  bind via `@ConfigurationProperties`.
- Writing directly to `System.out` — use SLF4J.

## Stack-specific NFRs

**Performance**
- p95 request latency per endpoint <= budget in BRD § 7.1 table (typical
  read: 150ms, typical write: 300ms).
- p99 request latency per endpoint <= 2x p95.
- Throughput per pod (RPS) documented for capacity planning.
- Downstream call p95 tracked separately from own-latency (via tracing
  span breakdown).

**JVM / resource**
- JVM heap steady-state <= 70% of container `-Xmx`.
- GC pause p99 <= 200ms (G1) or per-generation budget (ZGC).
- Container CPU steady-state <= 70% of request; peak <= 90%.
- Thread-pool queue depth alerted at >80% of `queueCapacity`.

**Availability**
- Service SLO 99.9% monthly (or per contract).
- Liveness probe: `/actuator/health/liveness` <= 1s.
- Readiness probe: `/actuator/health/readiness` <= 2s.
- Graceful shutdown drains in-flight requests within 30s.

**Messaging**
- Kafka consumer lag <= 1000 msgs on any topic during steady state.
- Producer idempotence enabled; exactly-once semantics where required.

**Security**
- OAuth2 resource-server with issuer-URI validation.
- All secrets via env vars / Kubernetes Secrets / Vault — never in
  `application.properties`.
- Dependency vulnerability scan (OWASP / Snyk / Dependency-Check) on
  every build.
- Rate-limiting per-client via Bucket4j or Spring Cloud Gateway upstream.

## Stack-specific integration points

| System | Direction | Notes |
|---|---|---|
| Relational DB (PostgreSQL / MySQL / Oracle) | outbound | Spring Data JPA / R2DBC |
| Message broker (Kafka / RabbitMQ / SQS) | bidirectional | spring-kafka / spring-amqp / spring-cloud-aws |
| Cache (Redis / Hazelcast / Caffeine) | outbound | spring-data-redis / cache abstraction |
| External REST APIs | outbound | WebClient (reactive) or RestClient (Spring 6.1+) |
| Identity provider (Keycloak / Auth0 / IMS) | inbound | OAuth2 resource-server |
| Secrets manager (Vault / KMS / AWS SM) | outbound | spring-cloud-vault / spring-cloud-aws-secrets-manager |
| Metrics + tracing (Prometheus / Jaeger / Datadog) | outbound | Micrometer + OpenTelemetry |
| Log aggregation (ELK / Splunk / Datadog Logs) | outbound | logback JSON encoder |

## Stack-specific success KPIs

- Endpoint p95 latency at target for the top-10 endpoints by traffic.
- Kafka consumer lag steady-state median <= 100 msgs.
- Deploy frequency + change-failure rate (DORA).
- p99 GC-pause distribution.
- Downstream-call success rate per external dependency.

## Stack-specific risks

- **N+1 query cascades** — a `@OneToMany` collection loaded per parent row.
- **Bean-cycle deadlocks** — mutual constructor dependencies at startup.
- **Missing timeouts on WebClient** — a slow downstream service exhausting
  the event-loop.
- **Kafka rebalance storms** — a slow-committing consumer causing repeated
  rebalances.
- **Actuator info leak** — an unauthenticated `/actuator/env` exposing
  secrets.
- **Migration drift** — Flyway or Liquibase scripts diverging across
  environments.

## Stack-specific compliance

- **SOC2** — audit-log emission on privileged actions.
- **GDPR** — PII columns tagged, right-to-be-forgotten job wired.
- **PCI-DSS** — if the service touches card data, scope reduction via
  tokenization gateway.
- **OWASP Top 10** — dependency scanning + input validation baseline on
  every controller.
- **Data-residency** — DB and cache regions match customer contract.

## Example BRD sections for Spring Boot

**Executive summary example.**
> The Loyalty middleware exposes a REST + GraphQL surface for the AEM
> storefront and Commerce checkout, brokering points balance, tier status,
> and reward redemption between the loyalty vendor and Adobe systems.
> Success is measured as: (1) `/graphql` p95 <= 300ms, (2) Kafka consumer
> lag on the `loyalty.tx.credit` topic steady-state median <= 50 msgs,
> (3) 99.9% monthly availability.

**In-scope example.**
> Controllers: `AccountsController`, `RewardsController`,
> `RedemptionsController`. Service layer with `@Transactional` boundaries
> aligned to business use-cases. Spring Data JPA repositories against
> PostgreSQL 15. `spring-kafka` producer + consumer for loyalty-events
> topic. Micrometer Tracing with OTLP exporter to the shared Jaeger
> collector.

**NFR example.**
> **NFR-Perf-1** — `POST /rewards/{id}/redeem` MUST complete within 400ms
> p95, including the downstream loyalty-vendor call. If the vendor exceeds
> 250ms, the response MUST still return within 400ms with a queued-async
> ack. Parent BR: BR-3 (checkout redemption latency). MoSCoW: MUST.

---

Generate the full BRD using `templates/BRD.md` as the master skeleton,
populating placeholders with stack-appropriate content from the guide above.
