# Acceptance-criteria authoring guide — Spring Boot

This guide tells the LLM authoring pass **how to shape acceptance criteria**
for user stories on a Spring Boot BRD. Combine with
`templates/ac-checklist.md`. Priority tags map MoSCoW -> Summary contract
(`MUST` / `SHOULD` / `COULD` / `WONT`).

## Given / When / Then structure (Spring idioms)

- **Given** typically fixes *DB state* (seed rows via Flyway/Liquibase or
  `@Sql`), *Spring context state* (a profile is active — `test`, `prod`),
  *auth state* (a JWT with scopes `orders:read`), or *dependency state*
  (a downstream mocked with WireMock).
- **When** covers a *REST call* (`MockMvc.perform(get("/api/orders"))`),
  a *Kafka event* (a message on topic `orders.created`), or a *scheduled
  job invocation* (`@Scheduled` bean's method called).
- **Then** targets the *HTTP response* (status, body, headers), a *DB
  mutation* (row exists / does not exist), a *Kafka out-topic message*,
  or an *actuator observable* (Micrometer counter incremented).

## Types of AC for Spring

### Functional AC
- Given the DB has a customer `c-42` with 3 orders, when a client GETs
  `/api/customers/c-42/orders?page=0&size=10`, then the response is 200
  and body contains 3 `OrderDto` items sorted by `createdAt` desc.
- Given a valid JWT with scope `orders:write`, when a client POSTs
  `/api/orders` with a valid payload, then response is 201, `Location`
  header points to `/api/orders/{id}`, and a row exists in `orders` with
  `status=NEW`.
- Given a Kafka message on `orders.created`, when the `OrderProjector`
  consumer processes it, then a row exists in the read-model table
  within one poll interval and the consumer commits the offset.
- Given a `@Scheduled(cron="0 0 * * * *")` bean, when the cron fires,
  then the batch runs to completion and emits a Micrometer counter
  `batch.orders.processed` matching the row count.

### Non-functional AC
- REST p95 latency <= 300ms and p99 <= 800ms per endpoint under 500 RPS
  (Gatling steady-state, 10-minute run).
- Actuator `/actuator/health` returns 200 with every component `UP`
  within 30s of pod start (readiness probe threshold).
- JVM heap: G1GC average pause < 100ms; old-gen occupancy < 70% at
  steady state. <!-- verify: customer's heap sizing -->
- Kafka consumer lag on any partition <= 1000 messages under normal
  load; alert at 5000.
- Startup time (Spring `ApplicationReadyEvent`) <= 30s in prod profile.

### Edge-case AC
- Given the DB is unreachable, when the request hits a controller that
  needs the DB, then the response is 503 with a JSON error body and
  `Retry-After: 10` — never a stack trace.
- Given a Kafka consumer receives a poison message, when deserialization
  fails, then the message is routed to a DLQ (`orders.created.dlq`) and
  the consumer continues processing subsequent messages.
- Given a Redis cache node fails mid-request, when the fallback path
  runs, then the request completes from the primary store (higher
  latency logged) and the circuit-breaker opens after N failures.
- Given a request body exceeds `spring.servlet.multipart.max-file-size`,
  when the endpoint processes it, then the response is 413 with a
  descriptive JSON error (no raw exception).

### Security AC (STRIDE-inspired)
- Given no `Authorization` header, when a client hits `/api/orders`,
  then response is 401 with `WWW-Authenticate: Bearer realm="..."`.
- Given a JWT signed by an untrusted issuer, when the resource server
  validates it, then response is 401 and no route handler executes.
- Given `@PreAuthorize("hasAuthority('SCOPE_orders:write')")` on a
  controller method, when a token lacks that scope, then response is
  403 and no DB mutation occurs.
- Given JPA specifications built from user input, when the query is
  built, then it uses parameter binding — no user input is concatenated
  into JPQL/SQL.
- Given a response error body, when an exception occurs, then it never
  includes stack trace, DB name, class-path, or internal IP addresses.
- Given a dependency check runs, when it inspects `pom.xml`/`build.gradle`,
  then no dependency with a known CVE > 7.0 (Snyk / OWASP DC) is
  present without a documented `.bmad/decisions.yaml` exception.

### Performance AC (measurable)
- Gatling `GET /api/orders/{id}` reports p95 <= 300ms and p99 <= 800ms
  at 500 concurrent users, 10-min steady state.
- Actuator `http.server.requests` histogram shows p99 < 800ms on the
  slowest endpoint in production over any 5-minute window.
- Cold-start (pod schedule -> readiness=UP) <= 45s.
- Micrometer JVM metrics: `jvm.gc.pause` p99 <= 100ms.

### Testability guidance
- Unit: **JUnit 5 + Mockito** for services; **AssertJ** for assertions.
- Slice: **`@WebMvcTest`** for controllers, **`@DataJpaTest`** for
  repositories, **`@JsonTest`** for serialization.
- Integration: **`@SpringBootTest` + Testcontainers** (Postgres, Kafka,
  Redis) for full-stack behavior against real infra.
- Contract: **Spring Cloud Contract** or **Pact** for consumer/provider.
- Performance: **Gatling** or **k6** against staging.
- Reference `test-generation/spring.md`.

## Negative AC (what MUST NOT happen)
- No controller MUST reach the DB directly — go through a `@Service` /
  `@Repository` layer.
- `application.properties` MUST NOT contain plaintext secrets — use
  Spring Cloud Config Vault or Kubernetes secrets via `spring.config.import`.
- No endpoint MUST return `Access-Control-Allow-Origin: *` in production.
- No `RestTemplate` / `WebClient` bean MUST be created without a
  configured connect + read timeout.
- Actuator `/actuator/env` MUST NOT be exposed on any network-reachable
  port in prod (unless behind mTLS + role-gated).

## Testability check per AC
- [ ] Testable — framework + assertion.
- [ ] Measurable — concrete signal.
- [ ] Unambiguous — no interpretation.
- [ ] Independent — no undeclared prereq.
- [ ] Small — one behavior per AC.

## Common AC anti-patterns for Spring
- "API should be secure" -> "Given no `Authorization` header, When GET
  /api/orders, Then response 401 with `WWW-Authenticate: Bearer`".
- "Should scale" -> "Under 500 RPS Gatling steady state, p95 <= 300ms
  and error-rate < 0.1%".
- "Handle errors gracefully" -> "Given the DB is down, When the endpoint
  is called, Then response is 503 with JSON body and no stack trace".
- "Cache should help" -> "Given a warm cache, When the request hits, Then
  Micrometer `cache.gets{result=hit}` counter increments and DB is not
  called (verified via `@SpyBean` on the repository)".
