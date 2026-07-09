# Spring Boot — Code Generation Patterns

> **Stack:** Spring Boot custom middleware (Java **17/21**, **Jakarta** EE, Maven **or** Gradle).
> Audit rules: `bmad-dept-code-audit-agent/resources/rule-packs/spring-boot/`.
>
> **Deterministic scaffolder:** `scripts/run.ts --scaffold --engine spring --type <t> --name <Name> [--package p]`
> generates: `rest-controller` (+DTO), `service`, `jpa-repository` (+entity). Use it for the common layers;
> use the patterns below for custom generation.

## Project structure (layered)

```
src/main/java/{base.package}/
├── {App}Application.java        → @SpringBootApplication
├── web/                         → @RestController + DTOs (+ @ControllerAdvice)
├── service/                     → @Service business logic
├── domain/                      → @Entity JPA models
├── repository/                  → Spring Data repositories
└── config/                      → @Configuration, SecurityFilterChain
src/main/resources/
├── application.yml              → externalized config (secrets via ${ENV} / Vault)
└── application-{profile}.yml    → profile overrides
src/test/java/...                → @WebMvcTest / @DataJpaTest / @SpringBootTest
```

Use `jakarta.*` (not `javax.*`) on Boot 3+. Constructor injection everywhere (final fields).

## Core patterns

### REST controller + validation + error handling
```java
@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderService service;                 // constructor injection
    OrderController(OrderService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<OrderDto> create(@Valid @RequestBody OrderDto body) {  // @Valid — always
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(body));
    }
}

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> onInvalid(MethodArgumentNotValidException e) { /* 400 + field errors */ }
}
```
DTO carries Bean Validation constraints (`@NotBlank`, `@Positive`, …). Never bind entities directly to requests.

### Service (business logic, testable)
```java
@Service
public class OrderService {
    private final OrderRepository repo;
    OrderService(OrderRepository repo) { this.repo = repo; }
    @Transactional public OrderDto create(OrderDto in) { /* … */ }   // public + called via bean (proxy AOP)
    @Transactional(readOnly = true) public List<OrderDto> list(Pageable p) { /* … */ }
}
```

### Repository (Spring Data JPA — bound parameters only)
```java
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByStatus(OrderStatus status);                        // derived query
    @Query("select o from Order o where o.customer.id = :cid")           // :named params, never concatenation
    Page<Order> byCustomer(@Param("cid") Long cid, Pageable page);
}
```

### Security config (deny-by-default)
```java
@Configuration @EnableMethodSecurity
public class SecurityConfig {
    @Bean SecurityFilterChain chain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health", "/api/public/**").permitAll()
                .anyRequest().authenticated())                            // deny by default
            .cors(c -> c.configurationSource(corsAllowlist()))            // allow-list origins, not "*"
            .oauth2ResourceServer(o -> o.jwt());                          // verify JWT
        // Keep CSRF for browser/stateful flows; disable ONLY for stateless token APIs, deliberately.
        return http.build();
    }
}
```

### Config & secrets
- Externalize every secret: `password: ${DB_PASSWORD}` / Spring Cloud Config / Vault / jasypt `ENC(...)`.
- Actuator: expose only `health,info,metrics,prometheus`; secure the rest; `management.endpoint.env.show-values=never`.
- Never enable the H2 console outside a `local`/`dev` profile.

### Messaging (Spring Cloud Stream / Kafka / RabbitMQ)
- Idempotent consumers; bounded retry + DLQ; producer timeouts. Don't block the request thread on publish.

## Testing (generate alongside)
```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {
    @Autowired MockMvc mvc; @MockBean OrderService service;
    @Test void createReturns201() throws Exception { mvc.perform(post("/api/orders")...).andExpect(status().isCreated()); }
}

@DataJpaTest class OrderRepositoryTest { /* @Autowired repo; Testcontainers for real DB */ }
```
- Controllers → `@WebMvcTest` + MockMvc (status, body, validation, auth). Services → Mockito unit tests.
  Repositories → `@DataJpaTest` (or Testcontainers). Integration → `@SpringBootTest`.

## Build
Support **Maven** (`spring-boot-maven-plugin`) and **Gradle** (`org.springframework.boot` plugin). Match the
project's existing build tool; don't introduce the other.
