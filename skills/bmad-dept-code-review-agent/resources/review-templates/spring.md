# Pre-merge review guide — Spring Boot

## What pre-merge review catches (vs Audit's deep scan)

Spring Boot diffs usually add or change a controller, a service method,
or a security config. Pre-merge review flags what's visible in the
diff: a missing `@Valid` on a new request body, a `permitAll()` added
where it shouldn't be, a transaction boundary in the wrong layer. Audit's
`spring` rule pack (`SPRING-SEC-*`, `SPRING-DATA-*`) runs the exhaustive
version across the whole codebase — CSRF/CORS/Actuator posture repo-wide,
N+1 detection across every repository method — which needs more context
than a single diff carries.

## Common pre-merge red flags for Spring

1. **New `@RequestBody` parameter with no `@Valid`/`@Validated`.**
   Unvalidated input reaches the service layer. Fix: add `@Valid` and a
   bean-validation-annotated DTO.
2. **New security rule `.permitAll()` added** where the endpoint clearly
   needs authentication — deny-by-default violated. Fix: default to
   `.authenticated()`/role-restricted, justify any `permitAll()` in the
   PR description.
3. **CORS config change widening `allowedOrigins` to `*`** (or an
   equivalent wildcard) on a diff touching `WebMvcConfigurer`/security
   config. Fix: enumerate explicit origins.
4. **CSRF protection disabled** (`csrf().disable()`) added to a
   browser-facing/stateful flow. Fix: keep CSRF enabled for
   session-based flows; only disable for genuinely stateless
   token-authenticated APIs, and say so explicitly.
5. **New Actuator endpoint exposed without security config** — check
   `management.endpoints.web.exposure.include` changes and whether the
   newly exposed endpoint needs auth.
6. **`@Transactional` placed on a public controller method** instead of
   the service-layer method it should wrap — transaction boundary too
   broad, includes non-DB work (HTTP calls, serialization) inside the
   transaction.
7. **New JPQL/native query built via string concatenation with a
   method parameter.** SQL injection. Fix: use parameter binding
   (`:param` / `?1`).
8. **New field-injection `@Autowired`** instead of constructor
   injection. Harder to test, allows partially-constructed beans. Fix:
   switch to constructor injection (works well with `final` fields).
9. **New external HTTP call (`RestTemplate`/`WebClient`/Feign) added
   with no timeout configured.** Default timeouts can be unbounded —
   thread-pool exhaustion risk under a slow/unresponsive dependency.
10. **New `@RequestMapping`/`@GetMapping` collection endpoint querying a
    `@OneToMany`/`@ManyToMany` relation inside a loop** — classic N+1;
    check for a missing `JOIN FETCH` or `@EntityGraph`.
11. **SpEL expression built from user input** (`@PreAuthorize`,
    `@Value`, or a manual `SpelExpressionParser` call) — expression
    injection risk.
12. **New deserialization of an untyped/polymorphic payload**
    (`ObjectMapper.readValue` with `enableDefaultTyping` or an
    attacker-controlled `@class` field) — unsafe deserialization.

## Style-guide highlights for Spring

- Constructor injection with `final` fields; no field-level
  `@Autowired` in new code.
- DTOs for request/response bodies, never entities exposed directly
  over the wire.
- Package-by-feature (`controller`/`service`/`repository` per feature
  package) consistent with the existing module layout — flag a new
  class added to a mismatched package.
- Bean-validation annotations (`@NotNull`, `@Size`, `@Email`) on DTO
  fields rather than manual null-checks scattered in the controller.
- Logging via SLF4J (`LoggerFactory.getLogger`), structured where the
  codebase already uses structured logging (MDC keys).

## Breaking-change signals for Spring

- `@RequestMapping`/`@GetMapping`/`@PostMapping` path changed on an
  existing endpoint.
- A DTO field removed or its type changed on a response body another
  service/consumer depends on.
- A required request parameter added to an existing endpoint without a
  default — old callers now 400.
- A `@Bean` definition's type or qualifier changed — breaks other beans
  wired to the old type.
- An exception type changed on a method whose callers catch the
  specific exception class.
- An Actuator/health-check endpoint's response shape changed — breaks
  monitoring/ops tooling parsing it (see the Operations agent's
  dashboard/alert definitions if cached).

## Dependency-change signals for Spring

Watch `pom.xml`/`build.gradle`/`build.gradle.kts`. A risky bump: a
Spring Boot parent-version major/minor jump (check the migration guide
for auto-configuration behavior changes), a Jackson `jackson-databind`
bump (historically CVE-prone — check whether the bump is itself a CVE
fix), or a new dependency that pulls in a second, conflicting version of
a library already on the classpath (check for a shading/exclusion
conflict).

## Design-pattern checks for Spring

- Business logic in the controller layer instead of delegated to a
  service — controllers should orchestrate, not implement.
- A new service class with 8+ constructor dependencies — fat
  constructor, likely doing too much; consider splitting.
- Direct `new` of a collaborator that should be a Spring-managed bean
  (breaks mockability in tests, breaks AOP/proxying if the collaborator
  is meant to be intercepted).
- Repository methods returning entities directly to the controller
  layer instead of mapping to a DTO at the service boundary.

Cross-ref `resources/pattern-libraries/spring.md` (forthcoming) for the
full anti-pattern catalog.

## Pre-merge checklist items specific to Spring

- [ ] New `@RequestBody` parameters carry `@Valid`.
- [ ] No new `permitAll()`/CSRF-disable without explicit justification.
- [ ] `@Transactional` placed on the service layer, not the controller.
- [ ] No new JPQL/native query built via string concatenation.
- [ ] New collection endpoints checked for N+1 (`JOIN FETCH`/`@EntityGraph`).
- [ ] New external HTTP calls have a configured timeout.
- [ ] Constructor injection used for new/changed beans.

## 2 worked review examples for Spring

**Example 1 — missing validation + wrong transaction boundary.**
```java
@PostMapping("/checkout")
@Transactional
public ResponseEntity<OrderDto> checkout(@RequestBody CheckoutRequest req) {
    Order order = orderService.place(req);
    return ResponseEntity.ok(mapper.toDto(order));
}
```
Review comments:
- 🔴 CRITICAL — `CheckoutRequest req` has no `@Valid` — unvalidated
  payload reaches `orderService.place`. Add `@Valid` and bean-validation
  annotations on the DTO.
- 🟠 HIGH — `@Transactional` on the controller method wraps the DTO
  mapping and response construction inside the DB transaction. Move
  `@Transactional` onto `orderService.place(...)` instead.

**Example 2 — N+1 on a new listing endpoint.**
```java
@GetMapping("/orders")
public List<OrderSummaryDto> listOrders() {
    return orderRepository.findAll().stream()
        .map(o -> new OrderSummaryDto(o.getId(), o.getItems().size()))
        .toList();
}
```
Review comments:
- 🔴 CRITICAL — `o.getItems()` on a lazy `@OneToMany` triggers one
  query per order — classic N+1. Use `@EntityGraph(attributePaths =
  "items")` or a `JOIN FETCH` query instead of `findAll()`.
- 🟡 MEDIUM — no pagination on `/orders` — will degrade as the table
  grows; add `Pageable`.

## Anti-patterns to avoid IN THE REVIEW ITSELF

- Don't flag every `@Autowired` on a test class — field injection is
  conventional and acceptable in Spring test configuration.
- Don't demand `@Transactional` justification on read-only query
  methods that are already fast and simple — reserve pushback for
  transaction-boundary placement that's actually wrong.
- Don't block on Lombok vs manual getters/setters preference unless the
  team's documented style guide picks one.
- Don't insist on `@EntityGraph` for every relation access — only flag
  when it's genuinely inside a loop or a hot listing path.

Generate the full review using `templates/review-comment.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
