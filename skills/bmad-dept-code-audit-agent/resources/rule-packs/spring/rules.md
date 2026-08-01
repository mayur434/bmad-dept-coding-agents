# Spring Boot Rules

> **Stack identity:** Spring Boot is the company's custom middleware **where a Spring stack is used**
> (Java 17/21, Jakarta EE, Maven **or** Gradle). Auto-configuration, `@RestController`/`@Service`/`@Repository`,
> Spring Data JPA, Spring Security, Actuator, and Spring Cloud Stream (Kafka/RabbitMQ) are the surface.
>
> **Tier-1 coverage:** rules tagged `[scanner: <ID>]` are detected deterministically by the tree-sitter
> AST + config engine at `scripts/engines/spring/`. Untagged rules are **Tier-2 (LLM) only** — verify by
> reading the security config, data access, and Actuator/observability wiring.

---

## Security Configuration Rules

---

### SPRING-SEC-004: CSRF protection must not be disabled for browser/stateful flows `[scanner: SPRING-SEC-004]`

- **Severity**: High
- **Description**: `http.csrf().disable()` (or `csrf(AbstractHttpConfigurer::disable)`) removes CSRF protection. It is only acceptable for stateless token-authenticated APIs with no cookie session — and even then should be a deliberate, documented choice.

#### Detect — Bad Pattern
- `http.csrf().disable()` on a filter chain that also uses form login / session cookies

#### Detect — Good Pattern
- CSRF left enabled for browser flows; disabled only on clearly stateless JWT/API chains

#### Remediation
Keep CSRF for stateful flows; scope any disable to stateless API chains via `securityMatcher`.

---

### SPRING-SEC-005: Deny by default, not `permitAll()` `[scanner: SPRING-SEC-005]`

- **Severity**: Medium (High if the app handles sensitive data)
- **Description**: `anyRequest().permitAll()` opens every endpoint. Authorization should be default-deny with explicit public paths.

#### Detect — Bad Pattern
- `authorizeHttpRequests().anyRequest().permitAll()`

#### Detect — Good Pattern
- `anyRequest().authenticated()` with explicit `permitAll()` only for `/actuator/health`, login, static assets

#### Remediation
Require authentication by default; enumerate public endpoints.

---

### SPRING-SEC-006: CORS must not allow all origins `[scanner: SPRING-SEC-006]`

- **Severity**: Medium (High with credentials)
- **Description**: `@CrossOrigin("*")` / `addAllowedOrigin("*")` allows any site to call the API. Combined with `allowCredentials(true)` it is an account-takeover vector (and browsers reject `*`+credentials, causing outages).

#### Detect — Bad Pattern
- `@CrossOrigin(origins = "*")`, `addAllowedOrigin("*")`, `setAllowedOrigins(List.of("*"))`

#### Detect — Good Pattern
- Explicit allow-list of trusted origins; `allowedOriginPatterns` used carefully

#### Remediation
Allow-list origins; never combine `*` with credentials.

---

### SPRING-SEC-012: Method security for service-layer authorization

- **Severity**: Medium
- **Description**: Sensitive service methods should be guarded with `@PreAuthorize`/`@PostAuthorize` (method security enabled) rather than relying solely on URL rules, which miss internal call paths.

#### Detect — Bad Pattern
- Sensitive `@Service` methods with no method-level authorization and only coarse URL rules

#### Remediation
Enable `@EnableMethodSecurity`; annotate sensitive methods with SpEL authorization.

---

## Actuator & Observability Rules

---

### SPRING-SEC-003: Do not expose all Actuator endpoints `[scanner: SPRING-SEC-003]`

- **Severity**: High
- **Description**: `management.endpoints.web.exposure.include=*` exposes `env`, `beans`, `heapdump`, `threaddump`, `configprops`, and (if present) `shutdown` — leaking secrets/config and enabling abuse.

#### Detect — Files to Scan
```
**/application*.properties, **/application*.yml, **/application*.yaml
```

#### Detect — Bad Pattern
- `management.endpoints.web.exposure.include=*` (flat or nested YAML)

#### Detect — Good Pattern
- Expose only `health,info,metrics,prometheus`; secure the rest behind Spring Security; consider a separate management port

#### Remediation
Restrict `exposure.include`; require auth for non-health endpoints; sanitize `/actuator/env` (`management.endpoint.env.show-values=never`).

---

### SPRING-SEC-007: Actuator/management security not disabled `[scanner: SPRING-SEC-007]`

- **Severity**: Medium
- **Description**: `management.security.enabled=false` (legacy) or unsecured management endpoints expose operational data unauthenticated.

#### Remediation
Secure management endpoints with Spring Security; never disable.

---

### SPRING-SEC-008: H2 console disabled outside local dev `[scanner: SPRING-SEC-008]`

- **Severity**: Medium
- **Description**: `spring.h2.console.enabled=true` exposes an interactive SQL console; a known data-exposure / RCE surface if reachable in non-dev.

#### Remediation
Enable only under a `local`/`dev` profile; never in production configs.

---

## Injection & Input Rules

---

### SPRING-SEC-011: No SQL/JPA injection via string building `[scanner: SPRING-SEC-011]`

- **Severity**: Critical
- **Description**: `entityManager.createQuery/createNativeQuery` or `@Query(value = "..." + input)` built by concatenation is injectable. Spring Data derived queries and named parameters are safe.

#### Detect — Bad Pattern
- `createNativeQuery("SELECT ... " + userInput)`; `@Query("... " + ...)`

#### Detect — Good Pattern
- `:named` / `?1` parameters; derived query methods; `@Param`

#### Remediation
Use bound parameters everywhere; never concatenate input into JPQL/SQL.

---

### SPRING-SEC-002: Validate request bodies (`@Valid`) `[scanner: SPRING-SEC-002]`

- **Severity**: Medium
- **Description**: A `@RequestBody` DTO bound without `@Valid`/`@Validated` (and Bean Validation constraints) lets malformed/over-posted data reach business logic.

#### Detect — Bad Pattern
- `create(@RequestBody OrderDto dto)` with no `@Valid`

#### Detect — Good Pattern
- `create(@Valid @RequestBody OrderDto dto)` + constraints on the DTO; `@ControllerAdvice` handles `MethodArgumentNotValidException`

#### Remediation
Add `@Valid` + constraints; centralize validation error handling.

---

### SPRING-SEC-013: SpEL / expression injection

- **Severity**: High
- **Description**: Building SpEL from untrusted input (`ExpressionParser.parseExpression(userInput)`) or interpolating input into `@PreAuthorize`/`@Query` SpEL enables expression injection → RCE.

#### Detect — Bad Pattern
- `parser.parseExpression(request-derived string)`

#### Remediation
Never evaluate untrusted SpEL; use a fixed expression with bound variables.

---

### SPRING-SEC-014: Unsafe deserialization

- **Severity**: High
- **Description**: Jackson polymorphic typing with `enableDefaultTyping()` / `@JsonTypeInfo(use = Id.CLASS)` on untrusted input, or Java native `ObjectInputStream` on untrusted data, enables gadget-chain RCE.

#### Remediation
Disable default typing; use allow-listed subtypes; never native-deserialize untrusted data.

---

## Secrets & Config Rules

---

### SPRING-CFG-001: No hardcoded secrets in configuration `[scanner: SPRING-CFG-001]`

- **Severity**: Critical
- **Description**: `spring.datasource.password`, API keys, client secrets, tokens with literal values in `application*.properties/yml` ship in VCS and the artifact.

#### Detect — Bad Pattern
- `spring.datasource.password=SuperSecret...`; `*.api-key: abc123`

#### Detect — Good Pattern
- `${DB_PASSWORD}` placeholders; Spring Cloud Config Server / Vault; jasypt `ENC(...)`

#### Remediation
Externalize to env/secret manager; use placeholders; rotate exposed values.

---

### SPRING-SEC-010: No hardcoded secrets in Java `[scanner: SPRING-SEC-010]`

- **Severity**: Critical
- **Description**: Secret-like fields assigned string literals in `@Service`/`@Component`/`@Configuration` classes. (Generic Java rule, rebranded for Spring.)

#### Remediation
Inject via `@Value("${...}")` from externalized config; never inline.

---

## Data Access & Reliability Rules

---

### SPRING-DATA-001: Transaction boundaries correct

- **Severity**: Medium
- **Description**: `@Transactional` on a `private`/`final` method or invoked via `this.method()` (self-invocation) is silently ignored (proxy-based AOP). Read-only queries should be `@Transactional(readOnly = true)`.

#### Detect — Bad Pattern
- `@Transactional private void ...`; self-invocation of a `@Transactional` method

#### Remediation
Make transactional methods `public` and call them through the injected bean; mark read paths `readOnly`.

---

### SPRING-DATA-002: Avoid N+1 and unbounded fetches

- **Severity**: Medium
- **Description**: `FetchType.EAGER` associations and lazy-loading in loops cause N+1 queries; repository methods returning unbounded `List` without pagination exhaust memory.

#### Remediation
Prefer `LAZY` + `@EntityGraph`/`join fetch`; return `Page<T>` with `Pageable`.

---

### SPRING-QUAL-001: Prefer constructor injection over field injection `[scanner: SPRING-QUAL-001]`

- **Severity**: Low
- **Description**: `@Autowired` on fields hides dependencies and blocks immutability/unit testing.

#### Remediation
Use constructor injection with `final` fields.

---

### SPRING-REL-001: Resilient external calls & messaging

- **Severity**: Medium
- **Description**: Outbound HTTP (RestTemplate/WebClient) without timeouts, and Kafka/RabbitMQ consumers without idempotency/DLQ/retry, cause cascading failures and message loss/duplication.

#### Detect — Bad Pattern
- `RestTemplate`/`WebClient` with no connect/read timeout; listeners with no error handler/DLQ

#### Remediation
Set client timeouts; add retry + DLQ + idempotency for Spring Cloud Stream/Kafka/Rabbit consumers.

---

## Generic Java (also applied) `[scanner: JAVA-QUAL-001..004, SPRING-SEC-010/011, GEN-SEC-004..006]`

Empty/over-broad catch, `printStackTrace()`/`System.out`, disabled TLS, weak crypto, and insecure `Random`
are covered by the shared generic Java rules; see `resources/rule-packs/sling/rules.md` for the same
checks in Sling terms.

---

## Notes for the auditor

- Detection accepts **Maven and Gradle** (`spring-boot-starter*`, `org.springframework.boot`, or
  `@SpringBootApplication`). Config rules read `application*.{properties,yml,yaml}` and understand both flat
  and nested YAML.
- Verify the Spring Security `SecurityFilterChain`, Actuator exposure/security, JPA query construction,
  transaction boundaries, and outbound-call/messaging resilience by reading the code — these are the
  Tier-2-only rules.
