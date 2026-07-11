# Spring Boot — Test Generation (LLM, target 100% coverage)

Generate JUnit 5 + Spring Test suites from Spring Boot source so every controller endpoint, service branch, repository query, and `@RestControllerAdvice` handler is exercised — statuses, JSON bodies, validation 400s, and security 401/403 included.

## Framework & dependencies

Target **Spring Boot 3.3.x** (Java 17/21, `jakarta.*`). Versions below are managed transitively by `spring-boot-starter-parent` / the `spring-boot-dependencies` BOM — do not pin them unless the project already does.

- **JUnit 5 (Jupiter)** 5.10+ — test engine (`useJUnitPlatform()`).
- **Spring Test / spring-boot-test** — `@WebMvcTest`, `@DataJpaTest`, `@SpringBootTest`, `MockMvc`, `TestEntityManager`.
- **Mockito** 5.x + **mockito-junit-jupiter** — `@Mock`, `@InjectMocks`, `@MockBean`.
- **AssertJ** 3.25+ / **Hamcrest** — assertions. **JsonPath** — response-body assertions.
- **spring-security-test** — `@WithMockUser`, `csrf()`, security post-processors.
- **Testcontainers** (`junit-jupiter` + the DB module, e.g. `postgresql`) — real DB for `@DataJpaTest`.

All of the first four ship inside `spring-boot-starter-test`. Add the rest explicitly.

**Maven** (`spring-boot-starter-parent`):
```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-test</artifactId>   <!-- JUnit5, Mockito, AssertJ, Hamcrest, JsonPath, spring-test -->
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.springframework.security</groupId>
  <artifactId>spring-security-test</artifactId>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>junit-jupiter</artifactId>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>postgresql</artifactId>
  <scope>test</scope>
</dependency>
```
Surefire runs `*Test`; Failsafe runs `*IT`. Wire **JaCoCo** (`jacoco-maven-plugin`, `report` goal) for the coverage number.

**Gradle** (`org.springframework.boot` + `io.spring.dependency-management` plugins):
```groovy
testImplementation 'org.springframework.boot:spring-boot-starter-test'
testImplementation 'org.springframework.security:spring-security-test'
testImplementation 'org.testcontainers:junit-jupiter'
testImplementation 'org.testcontainers:postgresql'
test { useJUnitPlatform() }
```
Match the project's existing build tool; never introduce the other.

## Where tests go & naming

Tests mirror the source package under **`src/test/java`**:

```
src/main/java/com/acme/orders/web/OrderController.java
src/test/java/com/acme/orders/web/OrderControllerTest.java     ← same package
```

- **`<ClassName>Test`** — slice/unit tests (`@WebMvcTest`, `@DataJpaTest`, Mockito). Run by Surefire.
- **`<ClassName>IT`** — full-context integration (`@SpringBootTest`). Run by Failsafe, kept out of the fast unit loop.
- Test methods: `method_condition_expectedResult` (e.g. `create_invalidQuantity_returns400`), or a `@DisplayName("...")` sentence. One test class per source class.

## Test anatomy

**Controller — `@WebMvcTest` + `MockMvc`** (loads only the web layer; mock the service):
```java
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(OrderController.class)
@Import({ApiExceptionHandler.class, SecurityConfig.class})   // advice + your real security rules
class OrderControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean OrderService service;                          // collaborator replaced by a mock bean
}
```

**Service — pure Mockito unit test** (no Spring context — fastest, use for all business logic):
```java
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository repo;
    @Mock InventoryClient inventory;
    @InjectMocks OrderService service;      // constructor-injected mocks
}
```

**Repository — `@DataJpaTest` + `TestEntityManager` on a real DB** (Testcontainers, not H2):
```java
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)  // don't swap in H2
@Testcontainers
class OrderRepositoryTest {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired TestEntityManager em;
    @Autowired OrderRepository repo;
}
```

## Reaching 100%

Apply this checklist to **each source unit** (one test class per class, one `@Test` per public method, split by case):

1. **One test per public method.** Every `public`/package-private method reachable through a bean is a starting point. **Private methods are never tested directly — cover them by driving their public callers** down each path that reaches them.
2. **A case per branch/condition.** For every `if/else`, `switch`, ternary, `&&`/`||` short-circuit, `Optional.map/orElseThrow`, and loop-empty-vs-nonempty, add a test that forces that arm. Aim for each boolean sub-condition to be evaluated both true and false.
3. **Every thrown exception / error path.** Each `throw` and each domain exception must have a test that triggers it. For controllers, each **`@ExceptionHandler` in `@RestControllerAdvice`** gets its own test asserting the mapped status + error body — including the framework-thrown `MethodArgumentNotValidException` (validation) and `HttpMessageNotReadableException` (malformed JSON) if handled.
4. **Boundaries + null/empty.** Zero, negative, max, empty string/list, missing `Optional`, `null` inputs — one test each where the code distinguishes them.
5. **Controllers — status + body + validation.** Assert `status()` (200/201/204/404/…), assert the JSON with `jsonPath(...)` for every field the client relies on, and assert the **400** returned for an invalid `@Valid` body (each violated constraint → `jsonPath("$.fields.<name>").exists()`).
6. **Security-negative cases.** For every secured endpoint: **401** unauthenticated (no `@WithMockUser`), **403** authenticated-but-wrong-role (`@WithMockUser(roles = "...")`) and **403** for a state-changing request missing `csrf()`. Positive path uses the correct role.
7. **Services — verify collaborators.** After the assertion, `verify(mock).method(args)` the expected calls, and `verify(mock, never())` / `verifyNoInteractions(mock)` on branches that must short-circuit before touching a collaborator.
8. **Repositories — one query per method.** Seed via `TestEntityManager`, `em.flush()`/`em.clear()`, then assert the derived/`@Query` method returns exactly the matching rows (and empty when nothing matches).

## Mocking strategy

| Layer under test | Real | Mocked | How |
|---|---|---|---|
| Controller (`@WebMvcTest`) | web layer, `ObjectMapper`, validation, advice, security filter chain | services & any bean the controller/advice needs | `@MockBean` (real Spring bean replaced) |
| Service (Mockito unit) | the service class only | repositories, clients, other services | `@Mock` + `@InjectMocks`, no Spring context |
| Repository (`@DataJpaTest`) | JPA, entities, the **real DB** | nothing DB-side | Testcontainers `@ServiceConnection`; seed with `TestEntityManager` |
| Integration (`@SpringBootTest`) | full context | only true externals (HTTP, payment) | `@MockBean`; DB via Testcontainers |

Rules: mock at the boundary of the unit, never the unit itself. Use `@Mock`/`@InjectMocks` (fast, no context) for services; use `@MockBean` only inside a slice that already starts a context (`@WebMvcTest`/`@SpringBootTest`). Do not mock DTOs, value objects, or entities — construct them. Do not mock the repository in `@DataJpaTest` — that is the thing under test.

## Worked example

**Source** (`src/main/java/com/acme/orders/...`):
```java
// web/CreateOrderRequest.java
public record CreateOrderRequest(@NotBlank String sku, @Positive int quantity) {}

// web/OrderDto.java
public record OrderDto(Long id, String sku, int quantity, String status) {}

// service/OrderService.java
@Service
public class OrderService {
    private final OrderRepository repo;
    private final InventoryClient inventory;
    OrderService(OrderRepository repo, InventoryClient inventory) { this.repo = repo; this.inventory = inventory; }

    public OrderDto findById(long id) {
        return repo.findById(id).map(OrderService::toDto)
                   .orElseThrow(() -> new OrderNotFoundException(id));
    }

    @Transactional
    public OrderDto create(CreateOrderRequest req) {
        if (req.quantity() <= 0) throw new IllegalArgumentException("quantity must be positive"); // guard
        if (!inventory.isAvailable(req.sku(), req.quantity()))                                     // branch
            throw new OutOfStockException(req.sku());
        Order saved = repo.save(new Order(req.sku(), req.quantity()));                             // happy path
        return toDto(saved);
    }
    private static OrderDto toDto(Order o) { return new OrderDto(o.getId(), o.getSku(), o.getQuantity(), o.getStatus().name()); }
}

// web/OrderController.java
@RestController
@RequestMapping("/api/orders")
class OrderController {
    private final OrderService service;
    OrderController(OrderService service) { this.service = service; }

    @GetMapping("/{id}")
    OrderDto get(@PathVariable long id) { return service.findById(id); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    OrderDto create(@Valid @RequestBody CreateOrderRequest body) { return service.create(body); }
}

// web/ApiExceptionHandler.java
@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(OrderNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    ErrorResponse onNotFound(OrderNotFoundException e) { return new ErrorResponse("NOT_FOUND", e.getMessage(), Map.of()); }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ErrorResponse onInvalid(MethodArgumentNotValidException e) {
        var fields = e.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(FieldError::getField, f -> Objects.requireNonNullElse(f.getDefaultMessage(), "invalid"), (a, b) -> a));
        return new ErrorResponse("VALIDATION", "request invalid", fields);
    }
}
// record ErrorResponse(String code, String message, Map<String,String> fields) {}
```

**Generated service test** — every branch of `create` + both `findById` outcomes, collaborators verified:
```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository repo;
    @Mock InventoryClient inventory;
    @InjectMocks OrderService service;

    @Test
    void findById_found_returnsDto() {
        when(repo.findById(7L)).thenReturn(Optional.of(new Order(7L, "SKU-1", 3, OrderStatus.NEW)));
        OrderDto dto = service.findById(7L);
        assertThat(dto.id()).isEqualTo(7L);
        assertThat(dto.status()).isEqualTo("NEW");
    }

    @Test
    void findById_missing_throwsNotFound() {
        when(repo.findById(9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.findById(9L)).isInstanceOf(OrderNotFoundException.class);
    }

    @Test
    void create_nonPositiveQuantity_throwsAndTouchesNothing() {       // guard branch
        assertThatThrownBy(() -> service.create(new CreateOrderRequest("SKU-1", 0)))
            .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(inventory, repo);                        // short-circuits before collaborators
    }

    @Test
    void create_outOfStock_throwsBeforeSave() {                       // inventory branch = false
        when(inventory.isAvailable("SKU-1", 2)).thenReturn(false);
        assertThatThrownBy(() -> service.create(new CreateOrderRequest("SKU-1", 2)))
            .isInstanceOf(OutOfStockException.class);
        verify(repo, never()).save(any());
    }

    @Test
    void create_available_savesAndReturnsDto() {                      // happy path
        when(inventory.isAvailable("SKU-1", 2)).thenReturn(true);
        when(repo.save(any(Order.class))).thenReturn(new Order(1L, "SKU-1", 2, OrderStatus.NEW));
        OrderDto dto = service.create(new CreateOrderRequest("SKU-1", 2));
        assertThat(dto.id()).isEqualTo(1L);
        verify(inventory).isAvailable("SKU-1", 2);
        verify(repo).save(any(Order.class));
    }
}
```

**Generated controller test** — status, `jsonPath` body, 404 via advice, 400 validation via advice, 401/403 security:
```java
@WebMvcTest(OrderController.class)
@Import({ApiExceptionHandler.class, SecurityConfig.class})
class OrderControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean OrderService service;

    @Test @WithMockUser
    void get_found_returns200AndBody() throws Exception {
        when(service.findById(7L)).thenReturn(new OrderDto(7L, "SKU-1", 3, "NEW"));
        mvc.perform(get("/api/orders/7"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.id").value(7))
           .andExpect(jsonPath("$.sku").value("SKU-1"))
           .andExpect(jsonPath("$.status").value("NEW"));
    }

    @Test @WithMockUser
    void get_missing_returns404() throws Exception {                 // OrderNotFoundException handler
        when(service.findById(9L)).thenThrow(new OrderNotFoundException(9L));
        mvc.perform(get("/api/orders/9"))
           .andExpect(status().isNotFound())
           .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test @WithMockUser(roles = "ADMIN")
    void create_valid_returns201() throws Exception {
        when(service.create(any())).thenReturn(new OrderDto(1L, "SKU-1", 2, "NEW"));
        mvc.perform(post("/api/orders").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new CreateOrderRequest("SKU-1", 2))))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.id").value(1));
        verify(service).create(any(CreateOrderRequest.class));
    }

    @Test @WithMockUser(roles = "ADMIN")
    void create_invalidBody_returns400() throws Exception {          // MethodArgumentNotValidException handler
        mvc.perform(post("/api/orders").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new CreateOrderRequest("", 0)))) // @NotBlank + @Positive violated
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.code").value("VALIDATION"))
           .andExpect(jsonPath("$.fields.sku").exists())
           .andExpect(jsonPath("$.fields.quantity").exists());
        verifyNoInteractions(service);                               // never reached the service
    }

    @Test
    void create_unauthenticated_returns401() throws Exception {      // no @WithMockUser
        mvc.perform(post("/api/orders").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
           .andExpect(status().isUnauthorized());
    }

    @Test @WithMockUser(roles = "GUEST")
    void create_forbiddenRole_returns403() throws Exception {        // wrong authority
        mvc.perform(post("/api/orders").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
           .andExpect(status().isForbidden());
    }
}
```

The repository's `findById`/`save` are exercised for real in `OrderRepositoryTest` (`@DataJpaTest` per the anatomy) — seed with `em.persist(...); em.flush(); em.clear();` then assert query results. Together these three classes leave no untested branch, exception, or status.

## Pitfalls

1. **`@WebMvcTest` does not load your `SecurityFilterChain`.** Your `@Configuration` isn't a controller/advice, so it's excluded — the slice falls back to Boot's default (everything requires auth), and your 401/403 assertions won't reflect real rules. **`@Import(SecurityConfig.class)`** it. If that config wires a `JwtDecoder`/OAuth2 resource server, either `@MockBean JwtDecoder` or use `spring-security-test` post-processors (`jwt()`, `@WithMockUser`) so the slice starts.
2. **State-changing requests need `.with(csrf())`.** With CSRF enabled (the default), a `POST`/`PUT`/`DELETE` without the `csrf()` post-processor returns **403** and masks the real auth outcome you meant to assert. Add `csrf()` to every non-GET request in the positive/negative-role tests.
3. **`@DataJpaTest` silently swaps in H2.** Native SQL, Postgres-specific `@Query`, and identity/sequence behavior pass on H2 but break in production. Use **`@AutoConfigureTestDatabase(replace = NONE)` + Testcontainers `@ServiceConnection`**. It's also `@Transactional` (rolls back each test): call `em.flush()` to force the INSERT and `em.clear()` to detach before reading, or the persistence-context cache hides query bugs.
4. **Unstubbed `@MockBean`/`@Mock` return `null`.** Any method on the code path you didn't stub yields `null` → NPE (or an empty `Optional` you forgot to set). Conversely, `MockitoExtension` runs **strict stubs** — a stub no branch uses throws `UnnecessaryStubbingException`. Stub exactly the calls each test's path makes, and `verify(...)` the rest.
5. **Validation 400s depend on the advice, not just `@Valid`.** Without `spring-boot-starter-validation` on the classpath, `@Valid` is a no-op and the invalid body reaches your code. Without importing the advice, you get Boot's default error JSON (still 400, but no `$.code`/`$.fields`) and your `jsonPath` assertions fail. Ensure validation is present and `@Import` the `@RestControllerAdvice`.
6. **`jsonPath(...).value(...)` is type-strict.** Jackson serializes a `Long` id, but `jsonPath("$.id").value(7)` compares against an `Integer`; use `.value(7L)`, `.value(is(7))`, or assert as string. For exact-shape checks prefer `content().json("{...}")`; when a body assertion fails, add `.andDo(print())` to dump the actual response.
