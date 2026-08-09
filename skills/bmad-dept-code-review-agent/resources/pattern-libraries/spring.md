# Design-pattern violation catalog — Spring Boot

## Purpose framing

This catalog is the exhaustive companion to
`resources/review-templates/spring.md`'s short "Design-pattern checks"
section — canonical Spring anti-patterns a senior developer would flag
reading a diff, each with the fix and a worked before/after. Code Review
loads this file when `--artifacts design-patterns` (or `all`) is
requested against the `spring` engine.

## Anti-pattern catalog for Spring

### 1. Anemic Domain Model
- **What it looks like:** An `@Entity` class is pure getters/setters
  with zero behavior; every operation on it lives in a `Service` class
  that reads fields and mutates them externally.
- **Why it's a problem:** Business invariants end up scattered across
  every Service that touches the entity instead of being enforced in
  one place — easy to violate an invariant by calling the setters
  directly from a new code path.
- **Canonical fix:** Move behavior that enforces an invariant onto the
  entity itself (e.g. `order.cancel()` validates state internally)
  while keeping orchestration/persistence in the Service.
- **Severity if found:** MEDIUM.

### 2. Service Locator via `ApplicationContext.getBean()`
- **What it looks like:** A class calls
  `applicationContext.getBean(SomeService.class)` at the point of use
  instead of having it constructor-injected.
- **Why it's a problem:** Hides the real dependency from Spring's
  wiring graph and from anyone reading the constructor; breaks clean
  unit-testing without a full application context.
- **Canonical fix:** Constructor injection; reserve
  `ApplicationContext` lookups for genuinely dynamic bean resolution
  with a documented reason.
- **Severity if found:** HIGH.

### 3. Fat Controller
- **What it looks like:** A `@RestController` method containing
  validation logic beyond `@Valid`, business rules, or direct
  repository calls instead of delegating to a service.
- **Why it's a problem:** Controllers are the layer most coupled to
  HTTP concerns (status codes, serialization) — business logic there is
  hard to unit-test without spinning up MVC infrastructure.
- **Canonical fix:** Controller parses/validates the request and
  delegates to a service method that returns a domain result; the
  controller maps that result to an HTTP response.
- **Severity if found:** MEDIUM.

### 4. Missing or wrong `@Transactional` boundary
- **What it looks like:** `@Transactional` placed on a
  `@RestController` method (wrapping HTTP/serialization work inside the
  DB transaction), or entirely absent on a service method performing
  multiple related writes.
- **Why it's a problem:** Too-broad boundary holds DB connections open
  during non-DB work under load; missing boundary risks partial writes
  on failure mid-sequence.
- **Canonical fix:** `@Transactional` on the service-layer method that
  owns the unit of work — never the controller.
- **Severity if found:** HIGH (perf/data-integrity-adjacent).

### 5. Circular bean dependencies
- **What it looks like:** Bean A's constructor depends on Bean B, and
  Bean B's constructor depends on Bean A — resolved only via field
  injection or `@Lazy` to sidestep the cycle.
- **Why it's a problem:** Masks a real design problem (the two
  responsibilities are entangled) behind a Spring workaround instead of
  fixing the coupling.
- **Canonical fix:** Extract the shared behavior both beans need into a
  third collaborator both depend on, breaking the cycle.
- **Severity if found:** MEDIUM.

### 6. Repository leaking JPA entities directly to API responses
- **What it looks like:** A controller/service returns a
  `@Entity`-annotated object (or a `List<Entity>`) directly as the
  response body instead of mapping to a DTO.
- **Why it's a problem:** Couples the wire contract to the persistence
  schema — a column rename becomes a breaking API change; also risks
  lazy-loading exceptions or leaking internal fields never meant for
  clients.
- **Canonical fix:** Map to a response DTO at the service boundary;
  entities never cross the controller layer outward.
- **Severity if found:** HIGH.

### 7. God Service class
- **What it looks like:** A single `@Service` class with 10+ unrelated
  public methods spanning multiple bounded concerns (order processing,
  notification, reporting all in one `OrderService`).
- **Why it's a problem:** Every unrelated change recompiles/retests
  together; the class becomes an unavoidable merge hotspot.
- **Canonical fix:** Split by bounded concern into focused services
  composed by a thin orchestrator when a workflow genuinely spans them.
- **Severity if found:** MEDIUM.

### 8. Field-injection `@Autowired` in application code
- **What it looks like:** `@Autowired private SomeService service;`
  instead of a constructor parameter, in non-test application code.
- **Why it's a problem:** Allows a partially-constructed bean to exist
  before injection completes, can't be `final`, and is harder to
  instantiate directly in a unit test without reflection or a full
  context.
- **Canonical fix:** Constructor injection with `final` fields (field
  injection remains acceptable/conventional in test configuration
  classes).
- **Severity if found:** LOW.

## Refactoring priority for Spring

- **Blocker:** `@Transactional` on a controller wrapping non-DB work
  under load, or an entity leaked directly into an API response on a
  public-facing endpoint — both risk data-integrity or an unintended
  breaking contract.
- **Follow-up:** Anemic Domain Model, God Service on a low-traffic
  module, field injection in application code — real but not urgent.

## Worked before/after examples for Spring

**1. Service Locator → constructor injection**
```java
// Before
public void process() {
    PricingService pricing = applicationContext.getBean(PricingService.class);
    pricing.apply();
}
// After
public OrderProcessor(PricingService pricing) { this.pricing = pricing; }
public void process() { pricing.apply(); }
```
The dependency is now visible in the constructor and trivially mockable in a unit test.

**2. `@Transactional` on controller → service layer**
```java
// Before
@PostMapping("/checkout") @Transactional
public ResponseEntity<OrderDto> checkout(@RequestBody CheckoutRequest req) { ... }
// After
@PostMapping("/checkout")
public ResponseEntity<OrderDto> checkout(@RequestBody @Valid CheckoutRequest req) {
    return ResponseEntity.ok(mapper.toDto(orderService.place(req)));
}
// OrderService.java
@Transactional
public Order place(CheckoutRequest req) { ... }
```
The DB transaction no longer holds the connection open across DTO mapping/response construction.

**3. Entity leaked to API → DTO mapping**
```java
// Before
@GetMapping("/orders/{id}")
public Order getOrder(@PathVariable Long id) { return orderRepository.findById(id).orElseThrow(); }
// After
public OrderDto getOrder(@PathVariable Long id) {
    return mapper.toDto(orderRepository.findById(id).orElseThrow());
}
```
The wire contract is now decoupled from the persistence schema.

## Detection heuristics for Spring

- `applicationContext.getBean(` or `context.getBean(` anywhere outside
  a `@Configuration`/factory class.
- `@Transactional` annotation on a class/method also annotated
  `@RestController`/`@Controller`.
- A method return type or parameter type that is the same class
  annotated `@Entity`, on a method in a `@RestController`.
- Two beans whose constructors reference each other's type — grep both
  directions of a suspected pair.
- `@Service` class exceeding roughly 300–400 lines or 10+ public
  methods spanning nouns that don't share a bounded context.
- `@Autowired` directly above a field declaration (not a constructor
  parameter) in a non-test source file.

## Anti-patterns in THIS catalog itself (meta)

A "God Service" in a genuinely cohesive bounded context (e.g. a small
`OrderService` that legitimately owns the full order lifecycle) isn't
automatically wrong just because it has many methods — judge cohesion
of the responsibility, not method count alone.

Cross-reference `resources/review-templates/spring.md` for the broader
pre-merge review context. Reference this catalog when `--artifacts
design-patterns` is requested.
