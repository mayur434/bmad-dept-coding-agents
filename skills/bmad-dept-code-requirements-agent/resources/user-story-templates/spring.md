# User-story authoring guide — Spring Boot middleware

This guide tells the LLM authoring pass **how to shape user stories** for
a Spring Boot middleware BRD — typically a REST or GraphQL service
sitting between an Adobe front-end and downstream systems. Combine with
`templates/user-story.md` as the master single-story skeleton.

## INVEST criteria (stack-specific interpretation)

- **Independent** — stories should not couple to a specific DB migration
  window or a Kafka topic rename. Use `spring-boot-starter-flyway` /
  `-liquibase` migrations shipped as their own story.
- **Negotiable** — leave room to swap `spring-data-jpa` for `spring-data-r2dbc`
  where reactive back-pressure is needed.
- **Valuable** — value expressed to an API Consumer (upstream engineer),
  SRE, or Security Engineer — not "the Spring service".
- **Estimable** — team can size once the OpenAPI contract, JPA entity
  shape, and downstream integration idempotency guarantees are agreed.
- **Small** — one endpoint + one service + one repository + one
  integration test is fine; adding a new Kafka consumer as well is too
  big — split the consumer.
- **Testable** — every story is testable with JUnit + `@WebMvcTest` for
  controllers, `@DataJpaTest` for repositories, `MockMvc` end-to-end,
  Testcontainers for real Postgres / Kafka / Redis, and WireMock for
  downstream stubs.

## Stack-specific personas

- **API consumer (upstream engineer)** — a front-end / partner team
  calling the service.
- **Service owner (backend engineer)** — writes controllers, services,
  repositories, wiring.
- **Ops / SRE engineer** — Kubernetes, liveness/readiness, HPA,
  alerting.
- **Security engineer** — OAuth2 / OIDC posture, vulnerability
  scanning, secrets rotation.

## Story shape

`As a {{PERSONA}}, I want {{CAPABILITY}}, so that {{BENEFIT}}`

Realistic titles per persona:

- API consumer — "receive product-availability in the `/orders` response
  without a second call", "get a `Retry-After` header on 429 responses",
  "consume the OpenAPI 3 spec at `/v3/api-docs`".
- Service owner — "add a `product-lookup` service backed by a Redis
  cache", "publish an idempotent `OrderPlaced` event to Kafka".
- SRE — "expose GC pause p99 on `/actuator/prometheus`", "drain
  in-flight requests within 30s on `SIGTERM`".
- Security — "reject requests missing the `Authorization: Bearer`
  header", "rotate the JWT signing key via Kubernetes secrets".

## Story splitting patterns for Spring

- **Controller vs service vs repository** — each layer is separately
  testable and can ship in its own story when the API contract or DB
  schema needs a phased rollout.
- **Sync vs async** — HTTP-triggered flow is one story; the `@Async` /
  Kafka consumer flow that follows is another.
- **DB migration** — Flyway / Liquibase migration ships as its own story
  ahead of the feature story that reads the new column.
- **OpenAPI vs implementation** — publish the contract first; implement
  behind a feature flag.
- **Downstream integration** — WireMock-backed integration test lands
  before the real downstream call to unblock the client story.
- **Security posture** — SecurityFilterChain change ships in its own
  story separate from the feature it protects.
- **Observability** — new metric / trace span / log field ships in its
  own story.

## Effort estimation guidance

- **S (~1 day)** — add a new field to an existing DTO + surface via
  MapStruct + one test.
- **M (~2-3 days)** — new REST endpoint + service + repository + JPA
  entity + Testcontainers integration test.
- **L (~1 sprint)** — new Kafka consumer topology (idempotent producer,
  consumer group, DLQ, retry policy).
- **XL (>1 sprint, split)** — new bounded context with its own schema,
  API surface, and cross-service saga.

**Estimation anti-patterns**
- Ignoring the N+1 cost of a lazy JPA association surfaced in a REST
  response.
- Underestimating `@Transactional` boundary work — proxy semantics,
  self-invocation gotchas.
- Missing the observability tail: log correlation, trace propagation,
  metric cardinality budget.

## Ready-for-dev checklist

- [ ] REST contract signed off in OpenAPI 3 (paths, verbs, status codes,
      error envelope).
- [ ] JPA entity + Flyway / Liquibase migration reviewed for
      forward-compatibility.
- [ ] DTO mapping strategy chosen (MapStruct vs explicit).
- [ ] `SecurityFilterChain` change scoped (scopes, roles, method
      security).
- [ ] Kafka topic + payload schema + consumer group + retry / DLQ
      declared.
- [ ] Actuator health-check contribution planned (`readiness` group
      binding).
- [ ] Metric names + labels reviewed for cardinality budget.
- [ ] Distributed tracing spans reviewed (Micrometer Tracing).
- [ ] Testcontainers image + version pinned.

## Example user stories for Spring

### STORY-001: `GET /orders/{id}` with product-availability inline

**As an** API consumer
**I want** the order response to include product-availability inline
**So that** I do not make a second call per order line.

**Priority**: MUST | **Effort**: M | **Parent epic**: EPIC-1 Order API
**Dependencies**: `ProductLookupService` (STORY-002)
**AC**:
- Given a valid order id, when I call `GET /orders/{id}`, then each line
  contains `availability: IN_STOCK | LOW | OUT`.
- Given the downstream inventory call times out, then the endpoint still
  returns `200` with `availability: UNKNOWN` and logs a warning.

### STORY-002: Redis-cached `product-lookup` service

**As a** service owner
**I want** product lookups cached in Redis with a 30s TTL
**So that** downstream inventory load stays under 1 QPS per SKU per pod.

**Priority**: MUST | **Effort**: M | **Parent epic**: EPIC-1 Order API
**AC**:
- Given a cache miss, when the service is called, then the downstream is
  hit exactly once and the response is cached with TTL 30s.
- Given a cache hit within the TTL, then no downstream call is made.
- Given Redis is unreachable, then the service falls back to the
  downstream and emits a `cache_unavailable` counter.

### STORY-003: SIGTERM graceful shutdown

**As an** SRE
**I want** the service to drain in-flight requests within 30s of SIGTERM
**So that** rolling restarts do not drop client requests.

**Priority**: MUST | **Effort**: S | **Parent epic**: EPIC-2 Rollout
**AC**:
- Given the container receives SIGTERM, when in-flight requests exist,
  then the server stops accepting new requests but completes existing
  ones for up to 30s.
- Given all requests complete before 30s, then the process exits `0`.

## Anti-patterns to avoid

- "As a developer, I want to refactor the Order service" — implementation,
  no consumer value.
- "As an SRE, I want the service to be reliable" — no probe, no SLO, no
  test.
- "As a consumer, I want faster responses" — no endpoint, no p95 target.
- Bundling schema migration + endpoint + Kafka consumer + observability
  into one story.

## Story-title formulation

Good:
- "`GET /orders/{id}` with product-availability inline"
- "Redis-cached `product-lookup` service"
- "SIGTERM graceful shutdown"

Bad:
- "Order improvements" — vague, no consumer.
- "Add caching" — no key, no TTL, no scope.
- "Fix errors" — no endpoint, no error class, no target.
