# HLD authoring guide — Spring Boot middleware

## Purpose framing

A Spring HLD establishes the **service boundary** (bounded context per
Spring Boot app), the **persistence + broker choice**, the **Kubernetes
topology** (namespace, ingress, service, deployment, HPA), the
**Spring Security posture** (resource-server vs gateway offload), and
the **observability stack** (Actuator + Micrometer + OTEL). Where AEM
and Commerce come with strong opinions, Spring gives the architect
choices — the HLD's job is to pin them so the LLD can be unambiguous.

## Typical containers (C4 L2 elements) for Spring

- **App tier (Spring Boot)** — one or more Spring Boot 3.x services;
  MVC or WebFlux; running on OpenJDK 21 in K8s.
- **DB tier** — PostgreSQL primary + replica; managed (RDS/Cloud SQL) or
  in-cluster (StatefulSet).
- **Cache tier** — Redis (managed or Bitnami chart) for session/cache
  aside; optional Caffeine local.
- **Message broker** — Apache Kafka (Confluent/MSK/Strimzi) or RabbitMQ;
  event backbone.
- **Config server** — Spring Cloud Config over git, or K8s
  ConfigMaps/Secrets when the estate is small.
- **Service registry** — Eureka/Consul in on-prem clusters; K8s DNS + service
  mesh (Istio/Linkerd) in cloud-native estates.
- **API gateway** — Spring Cloud Gateway or Kong/Ambassador for shared
  concerns (auth offload, rate-limit).
- **Observability sidecar** — OTEL Collector + Prometheus + Loki, or
  Datadog/New Relic agent.
- **Secrets store** — HashiCorp Vault or cloud-native (AWS Secrets
  Manager, GCP Secret Manager).

## Stack-specific tech-choice table

| Container | Technology | Why |
|---|---|---|
| Framework | Spring Boot 3.3.x on Java 21 <!-- verify: current LTS pairing --> | LTS + virtual threads |
| Web stack | Spring MVC (default) or WebFlux (streaming/high-fanout) | Match blocking-vs-reactive workload |
| Persistence | Spring Data JPA + Hibernate 6 / or jOOQ for complex SQL | JPA for CRUD; jOOQ for reporting |
| Migrations | Flyway 10.x | Versioned + Java-based migrations |
| DB | PostgreSQL 15 | JSONB, LISTEN/NOTIFY, extension ecosystem |
| Broker | Kafka 3.6 (Strimzi K8s operator) | Exactly-once + partition scaling |
| Cache | Redis 7.2 | Cluster mode + Streams |
| Gateway | Spring Cloud Gateway | Reactive; native Boot integration |
| Auth | Spring Security 6.x resource-server (JWT) | OAuth2/OIDC standard |
| Observability | Actuator + Micrometer + OTEL Java Agent | Vendor-neutral export |

## Cross-cutting concerns for Spring

- **AuthN/AuthZ** — Spring Security resource-server (JWT bearer);
  gateway offload for edge validation; method-security with
  `@PreAuthorize`; ABAC via custom `PermissionEvaluator`.
- **Logging** — SLF4J + Logback JSON encoder; correlation-id filter for
  request tracing.
- **Tracing** — Micrometer Tracing (Brave or OTel bridge); traceparent
  propagation via `RestClient`/`WebClient` interceptors.
- **Config** — `application.yml` per profile + Spring Cloud Config or
  K8s ConfigMap; `@ConfigurationProperties` for typed binding.
- **Secrets** — never in `application.yml`; env vars from Vault via
  spring-cloud-vault, or K8s Secret volume.
- **Feature flags** — Togglz, Unleash, or LaunchDarkly SDK.
- **i18n** — `MessageSource` + `LocaleContextHolder`.

## Integration points typical to Spring

- **Downstream APIs** — `RestClient` (5.0+) or `WebClient`; circuit
  breaker via Resilience4j.
- **Kafka** — Spring Kafka + Avro/Protobuf + Schema Registry.
- **Databases** — Postgres primary; read-replica routing via
  `AbstractRoutingDataSource`.
- **Legacy SOAP** — Spring WS or CXF client for older enterprise
  systems.
- **CRM/ERP** — Salesforce (Bulk API + PubSub), SAP (JCo or OData).
- **Payments** — Stripe/Adyen/Braintree SDKs.
- **Search** — Elastic/OpenSearch via `spring-data-elasticsearch`.
- **Adobe products** — via Adobe I/O Runtime action or direct REST +
  IMS bearer.

## NFR profile for Spring

- **p99 REST latency** ≤ 300ms; p95 ≤ 150ms for simple GET.
- **Kafka consumer lag** ≤ 10s p95; alert at 60s.
- **JVM heap headroom** ≥ 25% after GC; avoid > 4GB heap unless justified.
- **Startup** ≤ 30s; ≤ 5s if AOT/native-image (Spring AOT).
- **Availability** — 99.95% for production APIs; multi-AZ K8s.
- **DB connection pool** — HikariCP 20 default per instance; tuned per
  workload.
- **Deployment rollout** — zero-downtime rolling; readiness probe
  gated.
- **Backpressure** — WebFlux `Flux` backpressure or Kafka
  `max.poll.records` tuning.

## Capacity planning shape

- **Pods per service** — min 3 for HA; HPA target CPU 65%; max scale
  10x.
- **Memory** — 512Mi baseline; 2Gi typical; JVM `-XX:MaxRAMPercentage=75`.
- **DB connections** — pool_size × replica_count ≤ Postgres max
  (typically 200 for RDS medium).
- **Kafka partitions** — set to max expected consumer parallelism × 2;
  don't scale partitions without repartition tooling.
- **Redis** — 2GB typical; cluster mode above 10GB.

## Deployment topology

Mermaid `flowchart` shape: `Client → Ingress (nginx) → Gateway →
Service (K8s Deployment × N) → Postgres + Redis + Kafka`. Namespaces
per env; each service its own Helm chart; ArgoCD for GitOps.

## Delivery / release approach for Spring

- **Build** — Gradle or Maven; Jib or Spring Boot Buildpack for OCI
  image.
- **Rolling deploy** — default K8s rolling update; blue/green for
  breaking API changes via Argo Rollouts.
- **DB migration** — Flyway runs on startup or as pre-deploy Job;
  order matters — expand → migrate → contract pattern for zero-downtime
  schema changes.
- **Feature flag rollout** — deploy dark, flag on for 1% → 25% → 100%.
- **Rollback** — Helm `helm rollback` or Argo `argo rollout undo`;
  ensure Flyway forward-compatible.

## 3 worked HLD outline examples for Spring

**HLD-01: Loyalty Points Ledger Service**
- Containers: Spring Boot loyalty-api, loyalty-worker (Kafka
  consumer), Postgres, Kafka, Redis; upstream Commerce SaaS; downstream
  Adobe Journey Optimizer.
- ADRs: ADR-Kafka-vs-SQS (exactly-once needed); ADR-JPA-vs-jOOQ (mixed
  workload); ADR-consumer-group-topology.
- Cross-cutting: OTEL, JWT resource-server, Flyway, Togglz.
- NFRs: earn-event lag ≤ 10s, ledger read p95 ≤ 150ms, availability
  99.95%.
- Rollout: dark consumer → shadow-writes → primary source of truth.

**HLD-02: Order Orchestration Middleware**
- Containers: Spring Boot orchestrator, Postgres, Kafka, downstream OMS,
  ERP, WMS, payment gateway.
- ADRs: ADR-saga-vs-orchestrator; ADR-idempotency-key-shape;
  ADR-DLQ-strategy.
- Cross-cutting: distributed tracing via traceparent, Resilience4j
  circuit breakers.
- NFRs: order-place p95 ≤ 800ms end-to-end; DLQ MTTR ≤ 30min.
- Rollout: by order channel (web → app → B2B).

**HLD-03: Content Personalization Gateway**
- Containers: WebFlux gateway, Redis cache, upstream AEM + RTCDP + Target.
- ADRs: ADR-MVC-vs-WebFlux (backpressure); ADR-caching-shape (edge-vs-
  service); ADR-token-exchange (IMS).
- Cross-cutting: rate-limit per client, correlation-id, PII redaction
  in logs.
- NFRs: p99 ≤ 100ms; cache hit ≥ 85%; 99.99% availability.
- Rollout: shadow → canary → GA.

## Anti-patterns to avoid for Spring

- **Crossing bounded contexts via direct DB reads** — always via API
  or event; DB coupling defeats the microservice boundary.
- **Skipping the migration expand/contract for schema changes** —
  breaks zero-downtime; every schema change becomes a maintenance
  window.
- **Actuator exposed without auth on prod** — `/actuator/env` leaks
  secrets; always secure with `management.endpoints.web.exposure`
  and separate management port.
- **Unbounded Kafka consumer** — no `max.poll.records` cap → GC pauses
  → rebalance storms.
- **Startup-time DB connection acquisition** — pool init on request
  path spikes p99; warm the pool at boot.

---

Generate the full HLD using `templates/HLD.md` as the master, populating
placeholders with stack-appropriate content from the guide above. When
container/technology decisions are still open, produce an ADR alongside
(see `resources/adr-templates/spring.md`).
