# Sonar Rule Pack — Spring Boot

Language: Java. Applies to: Spring Boot custom middleware projects.
Severity mapping and rating model: see `../../shared/severity-and-rating-model.md`.

---

## Bug (Reliability)

### S2259 — Null Pointer Dereference
**Severity:** HIGH | **ruleId:** `S2259`

`Optional.get()` called without `isPresent()` check; repository methods that may return `null` without `@NonNull` annotation; `ResponseEntity.getBody()` called without null check.

- ❌ Detect-Bad: `userRepo.findById(id).get()` — throws NoSuchElementException when absent
- ✅ Detect-Good: `userRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("User not found: " + id))`
- **Remediation:** Replace `.get()` at the identified line with `.orElseThrow()` or `.orElse(defaultValue)`.

### S2095 — Streams and Connections Not Closed
**Severity:** HIGH | **ruleId:** `S2095`

`InputStream`, `OutputStream`, JDBC `Connection`, or `HttpClient` opened but not closed; unclosed connections exhaust thread pools in high-throughput services.

- ❌ Detect-Bad: `Connection conn = dataSource.getConnection(); stmt = conn.prepareStatement(...);` with no close
- ✅ Detect-Good: `try (Connection conn = dataSource.getConnection(); PreparedStatement stmt = conn.prepareStatement(...)) { ... }`
- **Remediation:** Wrap the resource at the identified line in try-with-resources.

### S1854 — Dead Stores
**Severity:** LOW | **ruleId:** `S1854`

Variable assigned but never read before reassignment or method exit. Common in controller methods after a refactor.

- **Remediation:** Remove the dead assignment at the identified line.

---

## Vulnerability (Security)

### S3649 — SQL Injection
**Severity:** CRITICAL | **ruleId:** `S3649`

User-controlled input concatenated into a JDBC or JPA native query string.

- ❌ Detect-Bad: `String q = "SELECT * FROM users WHERE username = '" + username + "'"; stmt = conn.createStatement().executeQuery(q);`
- ✅ Detect-Good: `PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users WHERE username = ?"); stmt.setString(1, username);`
- **Remediation:** At line {line}: replace the string-concatenated query with a PreparedStatement using positional parameters. Cite the exact query string and the `setString()`/`setLong()` calls needed.

### S2068 — Hardcoded Credentials
**Severity:** CRITICAL | **ruleId:** `S2068`

Database passwords, JWT signing secrets, or API keys appear as string literals in `@Value` defaults, `application.properties`, or Java source files committed to source control.

- ❌ Detect-Bad: `@Value("${jwt.secret:mySecretKey123}") private String jwtSecret;` — the default is a secret
- ✅ Detect-Good: `@Value("${jwt.secret}") private String jwtSecret;` — no default; inject from secrets manager
- **Remediation:** Remove the default value from the `@Value` annotation at the identified line. Inject the secret via Spring Cloud Config, AWS Secrets Manager, or HashiCorp Vault. Rotate the credential immediately.

### S5131 — Cross-Site Scripting (XSS)
**Severity:** HIGH | **ruleId:** `S5131`

Controller or RestController returns user-controlled content without HTML encoding, or `model.addAttribute()` accepts unsanitized request parameters.

- ❌ Detect-Bad: `return "Hello " + request.getParameter("name");` in a `@ResponseBody` method returning `text/html`
- ✅ Detect-Good: `return "Hello " + StringEscapeUtils.escapeHtml4(request.getParameter("name"));`
- **Remediation:** Apply `HtmlUtils.htmlEscape()` (Spring) or `StringEscapeUtils.escapeHtml4()` (Apache Commons) at the identified line. If the endpoint returns JSON, ensure the response Content-Type is `application/json` not `text/html`.

### S4719 — Spring Security Misconfiguration
**Severity:** HIGH | **ruleId:** `S4719`

CSRF protection disabled globally, permitting all requests to authenticated endpoints, or HTTP used instead of HTTPS in the security config.

- ❌ Detect-Bad: `.csrf().disable()` in a `WebSecurityConfigurerAdapter` with no explanation
- ✅ Detect-Good: CSRF enabled (default) for web apps; disabled only for pure API endpoints protected by stateless JWT/OAuth2.
- **Remediation:** Re-enable CSRF protection or document why it is disabled (REST API with stateless tokens). If disabled for a stateful session app, this is a CRITICAL finding.

---

## Security Hotspot

### S4507 — Debug Actuator Endpoints Exposed
**Severity:** MEDIUM | **ruleId:** `S4507`

Spring Boot Actuator endpoints (`/actuator/env`, `/actuator/heapdump`, `/actuator/threaddump`) are exposed without security restrictions, leaking internal state.

- **Review:** Confirm `management.endpoints.web.exposure.include` does not include sensitive endpoints in production, or that they are protected by `management.server.port` isolation or Spring Security.

---

## Code Smell (Maintainability)

### S3776 — Cognitive Complexity
**Severity:** MEDIUM | **ruleId:** `S3776`

Service method cognitive complexity exceeds 15. Common in business-logic orchestrators and multi-step validation methods.

- **Remediation:** State the method name, file:line, current complexity score. Extract nested blocks (validation, mapping, persistence) into private methods. Cite the new method names and their intended complexity after extraction.

### S1192 — Duplicated String Literals
**Severity:** LOW | **ruleId:** `S1192`

URL path segments, header names, or error message templates repeated as inline literals 5+ times.

- **Remediation:** Extract to a `private static final String` or a `@Component` constants class.

### S1066 — Collapsible If Statements
**Severity:** LOW | **ruleId:** `S1066`

Two consecutive `if` conditions that can be merged without changing semantics.

- **Remediation:** Merge the conditions at the identified line pair.

---

## Duplication

### S1144 — Unused Private Methods
**Severity:** LOW | **ruleId:** `S1144`

Dead private methods in service or mapper classes — common after Spring-managed dependency injection refactors.

- **Remediation:** Delete the method at the identified line.

---

## Complexity

### S138 — Methods with Too Many Lines
**Severity:** MEDIUM | **ruleId:** `S138`

Service or Controller methods exceeding 80 lines, making them untestable in isolation.

- **Remediation:** Extract logical sections (input validation, business rule evaluation, response mapping) into private methods or a dedicated mapper/validator class. Cite line ranges for each extraction.
