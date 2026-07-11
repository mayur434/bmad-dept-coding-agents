# Sling-12 / Shaft — Test Generation (LLM, target 100% coverage)

Generate JUnit 5 + Apache Sling/OSGi Mocks (wcm.io family, plain Sling — no AEM APIs) tests that drive every branch, error path, and security-deny path of each OSGi component, servlet, filter, connector, and auth unit to full coverage.

## Framework & dependencies

Stack is **JDK 8+** (JVM → Felix → Oak → Sling), so version pinning matters: `sling-mock` 4.x and `mockito` 5.x require JDK 11 — pin the **3.x / 4.x** lines below or the build won't run on 8.

| Library | Artifact | Version | Purpose |
|---|---|---|---|
| JUnit 5 (Jupiter) | `org.junit:junit-bom` (BOM) | `5.10.2` | test engine / API |
| Sling Mocks (JUnit5) | `org.apache.sling.testing.sling-mock.junit5` | `3.4.14` | `SlingContext`, mock request/response, ResourceResolver; transitively pulls osgi-mock + jcr-mock + resourceresolver-mock |
| OSGi Mocks (JUnit5) | `org.apache.sling.testing.osgi-mock.junit5` | `3.3.6` | `OsgiContext` for pure-DS component tests |
| Mockito | `org.mockito:mockito-core` | `4.11.0` | mock external clients / collaborators |
| Mockito JUnit5 | `org.mockito:mockito-junit-jupiter` | `4.11.0` | `@Mock` / `MockitoExtension` |
| JJWT (only if unit does JWT) | `io.jsonwebtoken:jjwt-api` (+`jjwt-impl`,`jjwt-jackson`) | `0.11.5` | real token forge/expiry tests |

**Maven wiring** (tests live in the bundle module, usually `core`):

```xml
<dependencyManagement><dependencies>
  <dependency><groupId>org.junit</groupId><artifactId>junit-bom</artifactId>
    <version>5.10.2</version><type>pom</type><scope>import</scope></dependency>
</dependencies></dependencyManagement>

<dependencies>
  <dependency><groupId>org.junit.jupiter</groupId><artifactId>junit-jupiter</artifactId><scope>test</scope></dependency>
  <dependency><groupId>org.apache.sling</groupId>
    <artifactId>org.apache.sling.testing.sling-mock.junit5</artifactId><version>3.4.14</version><scope>test</scope></dependency>
  <dependency><groupId>org.mockito</groupId><artifactId>mockito-core</artifactId><version>4.11.0</version><scope>test</scope></dependency>
  <dependency><groupId>org.mockito</groupId><artifactId>mockito-junit-jupiter</artifactId><version>4.11.0</version><scope>test</scope></dependency>
</dependencies>

<build><plugins>
  <plugin><artifactId>maven-surefire-plugin</artifactId><version>3.2.5</version></plugin>
  <plugin><groupId>org.jacoco</groupId><artifactId>jacoco-maven-plugin</artifactId><version>0.8.11</version>
    <executions>
      <execution><goals><goal>prepare-agent</goal></goals></execution>
      <execution><id>check</id><goals><goal>report</goal><goal>check</goal></goals>
        <configuration><rules><rule><element>BUNDLE</element>
          <limits><limit><counter>LINE</counter><value>COVEREDRATIO</value><minimum>1.00</minimum></limit></limits>
        </rule></rules></configuration></execution>
    </executions></plugin>
</plugins></build>
```

Run: `mvn -pl core test` (unit) / `mvn -pl core verify` (enforces the JaCoCo 100% gate). Gradle equivalent: `testImplementation` the same coordinates, `useJUnitPlatform()`, `jacocoTestCoverageVerification`.

## Where tests go & naming

- Directory: **`core/src/test/java/`** (or the bundle module's `src/test/java`), **mirroring the source package exactly**. `com.acme.shaft.mdm.filters.AuthorizationFilter` → `core/src/test/java/com/acme/shaft/mdm/filters/AuthorizationFilterTest.java`.
- Naming: one test class per source class, `<ClassName>Test.java`. Server-side integration tests (real Oak, separate `it.tests` module) use `<ClassName>IT.java` and run under `maven-failsafe-plugin`.
- Fixtures (content JSON, CSV samples, keystores) go in **`core/src/test/resources/`**, loaded via `context.load().json("/fixtures/tree.json", "/content")` or classpath streams.

## Test anatomy

Two context types from the **same wcm.io mock family**: `OsgiContext` for pure DS components; `SlingContext` (superset — adds mock request/response + ResourceResolver) for anything touching a request, resource, or servlet/filter. Register the extension, declare the context as a field.

```java
package com.acme.shaft.mdm.export;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.apache.sling.testing.mock.osgi.junit5.OsgiContext;
import org.apache.sling.testing.mock.osgi.junit5.OsgiContextExtension;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

@ExtendWith(OsgiContextExtension.class)
class ExportUrlServiceImplTest {

    private final OsgiContext context = new OsgiContext();      // real OSGi/DS mock container

    @Test
    void buildsSignedUrlFromConfig() {
        // DS activate with an @ObjectClassDefinition config map (keys = OCD method names)
        ExportUrlService svc = context.registerInjectActivateService(
                new ExportUrlServiceImpl(),
                "baseUrl", "https://cdn.acme.io",
                "ttlSeconds", 300);

        String url = svc.export("file-42");
        assertTrue(url.startsWith("https://cdn.acme.io/export/file-42?exp="));
    }
}
```

Sling Servlet (register/select by **resourceType**, call `doGet`/`doPost` directly):

```java
@ExtendWith(SlingContextExtension.class)
class FileListServletTest {
    private final SlingContext context = new SlingContext();     // default RESOURCERESOLVER_MOCK
    private final FileListServlet servlet = new FileListServlet();

    @Test
    void writesJsonForResource() throws Exception {
        context.create().resource("/content/mdm/files", "sling:resourceType", "acme/mdm/filelist");
        context.currentResource("/content/mdm/files");
        context.request().setMethod("GET");

        servlet.doGet(context.request(), context.response());

        assertEquals(200, context.response().getStatus());
        assertEquals("application/json", context.response().getContentType());
        assertTrue(context.response().getOutputAsString().contains("\"files\""));
    }
}
```

Connector (mock the external client, register it so `@Reference` resolves, assert the error path is wrapped):

```java
@Test
void surfacesGatewayFailureAsConnectorException() throws Exception {
    RazorpayClient client = mock(RazorpayClient.class);
    context.registerService(RazorpayClient.class, client);                        // satisfies @Reference
    PaymentConnector connector = context.registerInjectActivateService(new PaymentConnectorImpl());
    when(client.charge(any())).thenThrow(new IOException("gateway 503"));

    assertThrows(ConnectorException.class, () -> connector.charge(new ChargeRequest("order-1", 1000)));
    verify(client).charge(any());
}
```

## Reaching 100%

Apply this checklist to **each source unit** (public class), generating one `*Test` class per source class:

1. **One test per public method** (`doGet`, `doPost`, `doFilter`, `activate` side-effects, every service method). Constructors/getters with logic count.
2. **A case per branch/condition** — each `if`/`else`, `switch` arm, ternary, and short-circuit half of `&&`/`||`. A method with N branches needs ≥ N tests that each land on a distinct branch. Aim for JaCoCo **BRANCH** = 100%, not just LINE.
3. **Every thrown-exception / error path** — assert with `assertThrows(...)`; for connectors/JDBC/HTTP, stub the client to `thenThrow` and assert the wrapper exception and that side-effects did **not** happen.
4. **Boundary + null/empty inputs** — null header, blank/whitespace token, empty ValueMap, missing config (defaults), empty collection, and off-by-one boundaries (TTL = 0, list size 0/1).
5. **Security-negative cases (mandatory for this stack)** — for **filters**: assert the response status (401/403) **and** `verify(chain, never()).doFilter(...)` on every deny path, and `verify(chain).doFilter(...)` on the allow path. For **JWT**: forged signature, expired, malformed, and `alg=none` tokens all rejected. For **MDM ACL**: denied principal → operation aborts and never reaches the storage client. For **connectors**: never assert secrets leak into logs/URLs.
6. **Private/helper methods are covered transitively** through their public callers — do **not** reflectively invoke privates. If a private branch is unreachable from any public path, that is dead code to flag, not to test.
7. **DS config permutations** — re-run `registerInjectActivateService` with different config maps to hit each config-driven branch (feature flag on/off, protected vs unprotected prefix).

## Mocking strategy

**Use the real mock-framework objects (do NOT Mockito-mock these):** `SlingContext`/`OsgiContext`, `context.request()`/`context.response()`, `context.resourceResolver()`, `ResourceResolver`/`Resource`/`ValueMap` built via `context.create()`, and **the unit under test itself** — always instantiate it through `context.registerInjectActivateService(...)` so `@Activate`, `@ObjectClassDefinition` config, and `@Reference` injection actually run. Never mock value objects (`ValueMap`, `Resource`). Never use PowerMock.

**Mockito-mock these:** anything crossing a process boundary or that you don't want to exercise — the external **connector clients** (HTTP client, JDBC `DataSource`/`Connection`, S3/Azure Blob/SFTP client, payment SDK, message-queue producer), the **`FilterChain`** (always), and collaborator services when the unit under test is something else. Wire a mock into a `@Reference` by registering it as an OSGi service **before** `registerInjectActivateService`:

```java
JwtService jwt = mock(JwtService.class);
context.registerService(JwtService.class, jwt);      // MUST precede registerInjectActivateService
```

**JWT — prefer real crypto when the unit *is* the JwtService** (forging is only meaningful against a real verifier). Mock `JwtService` only when it's a collaborator (as in the filter example below).

```java
private static final SecretKey KEY =
        Keys.hmacShaKeyFor("0123456789ABCDEF0123456789ABCDEF".getBytes(StandardCharsets.UTF_8));
private final JwtService jwt = new JwtServiceImpl(KEY);

@Test void rejectsForgedSignature() {
    SecretKey attacker = Keys.hmacShaKeyFor("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".getBytes(StandardCharsets.UTF_8));
    String forged = Jwts.builder().setSubject("admin")
            .claim("roles", Collections.singletonList("mdm-admin")).signWith(attacker).compact();
    assertFalse(jwt.verify(forged).isPresent());     // signature mismatch → rejected
}
@Test void rejectsExpiredToken() {
    String expired = Jwts.builder().setSubject("u")
            .setExpiration(Date.from(Instant.now().minusSeconds(60))).signWith(KEY).compact();
    assertFalse(jwt.verify(expired).isPresent());
}
```

**MDM ACL** — the default `RESOURCERESOLVER_MOCK` has no real `AccessControlManager`, so mock the ACL collaborator and assert the op short-circuits:

```java
when(aclService.canWrite(resolver, "/mdm/secure/report.csv", principal)).thenReturn(false);
assertThrows(AccessDeniedException.class, () -> fileService.write(path, bytes, principal));
verify(storageClient, never()).put(any(), any());   // denied op never reached backend
```

If a unit genuinely needs JCR queries or a real `AccessControlManager`, construct the context with `new SlingContext(ResourceResolverType.JCR_OAK)` (slower) instead of mocking.

## Worked example

A SHAFT MDM **Authorization filter** — the last link of the `XSS → Audit → Authorization` chain. It combines DS config, a `@Reference` collaborator, JWT-based deny paths, and chain short-circuiting.

**Source** — `core/src/main/java/com/acme/shaft/mdm/filters/AuthorizationFilter.java`:

```java
package com.acme.shaft.mdm.filters;

import java.io.IOException;
import java.util.Optional;
import javax.servlet.*;
import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.api.SlingHttpServletResponse;
import org.apache.sling.engine.EngineConstants;
import org.osgi.framework.Constants;
import org.osgi.service.component.annotations.*;
import org.osgi.service.metatype.annotations.*;
import com.acme.shaft.security.JwtPrincipal;
import com.acme.shaft.security.JwtService;

@Component(service = Filter.class, property = {
        EngineConstants.SLING_FILTER_SCOPE + "=" + EngineConstants.FILTER_SCOPE_REQUEST,
        Constants.SERVICE_RANKING + ":Integer=-700" })   // runs last, after XSS + Audit
@Designate(ocd = AuthorizationFilter.Config.class)
public class AuthorizationFilter implements Filter {

    @ObjectClassDefinition(name = "SHAFT MDM Authorization Filter")
    public @interface Config {
        @AttributeDefinition(name = "Protected path prefix") String protectedPathPrefix() default "/mdm";
        @AttributeDefinition(name = "Required role")         String requiredRole()        default "mdm-user";
    }

    private static final String BEARER = "Bearer ";

    @Reference private JwtService jwtService;
    private String protectedPathPrefix;
    private String requiredRole;

    @Activate
    protected void activate(Config config) {
        this.protectedPathPrefix = config.protectedPathPrefix();
        this.requiredRole = config.requiredRole();
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        SlingHttpServletRequest req = (SlingHttpServletRequest) request;
        SlingHttpServletResponse res = (SlingHttpServletResponse) response;

        String path = req.getPathInfo();
        if (path == null || !path.startsWith(protectedPathPrefix)) {
            chain.doFilter(request, response);                       // (1) unprotected → pass through
            return;
        }
        String header = req.getHeader("Authorization");
        if (header == null || !header.startsWith(BEARER)) {
            res.sendError(SlingHttpServletResponse.SC_UNAUTHORIZED, "Missing bearer token");
            return;                                                  // (2) short-circuit
        }
        String token = header.substring(BEARER.length()).trim();
        Optional<JwtPrincipal> principal = jwtService.verify(token);
        if (!principal.isPresent()) {
            res.sendError(SlingHttpServletResponse.SC_UNAUTHORIZED, "Invalid token");
            return;                                                  // (3) forged/expired → 401
        }
        if (!principal.get().getRoles().contains(requiredRole)) {
            res.sendError(SlingHttpServletResponse.SC_FORBIDDEN, "Insufficient role");
            return;                                                  // (4) authenticated but unauthorized
        }
        req.setAttribute("shaft.principal", principal.get());
        chain.doFilter(request, response);                           // (5) authorized → continue
    }

    @Override public void init(FilterConfig filterConfig) { /* no-op */ }
    @Override public void destroy() { /* no-op */ }
}
```

**Complete generated test** — `core/src/test/java/com/acme/shaft/mdm/filters/AuthorizationFilterTest.java` (covers all 5 branches + null path + non-bearer header + `init`/`destroy`; every deny path asserts status **and** that the chain was not invoked):

```java
package com.acme.shaft.mdm.filters;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.http.HttpServletResponse;

import org.apache.sling.testing.mock.sling.junit5.SlingContext;
import org.apache.sling.testing.mock.sling.junit5.SlingContextExtension;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import com.acme.shaft.security.JwtPrincipal;
import com.acme.shaft.security.JwtService;

@ExtendWith(SlingContextExtension.class)
class AuthorizationFilterTest {

    private final SlingContext context = new SlingContext();
    private JwtService jwtService;
    private AuthorizationFilter filter;

    @BeforeEach
    void setUp() {
        jwtService = mock(JwtService.class);
        context.registerService(JwtService.class, jwtService);       // satisfies @Reference
        filter = context.registerInjectActivateService(
                new AuthorizationFilter(),
                "protectedPathPrefix", "/mdm",
                "requiredRole", "mdm-user");                         // @ObjectClassDefinition config map
    }

    private JwtPrincipal principalWith(String... roles) {
        Set<String> set = new HashSet<>(Arrays.asList(roles));
        JwtPrincipal p = mock(JwtPrincipal.class);
        when(p.getRoles()).thenReturn(set);
        return p;
    }

    @Test  // branch (1) — null path
    void passesThroughWhenPathIsNull() throws Exception {
        context.request().setPathInfo(null);
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(context.request(), context.response(), chain);

        verify(chain).doFilter(context.request(), context.response());
        verify(jwtService, never()).verify(anyString());
    }

    @Test  // branch (1) — unprotected prefix
    void passesThroughWhenPathNotProtected() throws Exception {
        context.request().setPathInfo("/public/home");
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(context.request(), context.response(), chain);

        verify(chain).doFilter(context.request(), context.response());
        verify(jwtService, never()).verify(anyString());
    }

    @Test  // branch (2) — missing header (null)
    void rejectsWhenAuthorizationHeaderMissing() throws Exception {
        context.request().setPathInfo("/mdm/files");
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(context.request(), context.response(), chain);

        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, context.response().getStatus());
        verify(chain, never()).doFilter(any(), any());
    }

    @Test  // branch (2) — wrong scheme
    void rejectsWhenHeaderIsNotBearer() throws Exception {
        context.request().setPathInfo("/mdm/files");
        context.request().addHeader("Authorization", "Basic dXNlcjpwYXNz");
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(context.request(), context.response(), chain);

        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, context.response().getStatus());
        verify(chain, never()).doFilter(any(), any());
        verify(jwtService, never()).verify(anyString());
    }

    @Test  // branch (3) — security-negative: forged / expired token rejected
    void rejectsForgedOrExpiredToken() throws Exception {
        context.request().setPathInfo("/mdm/files");
        context.request().addHeader("Authorization", "Bearer forged.jwt.token");
        when(jwtService.verify("forged.jwt.token")).thenReturn(Optional.empty());
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(context.request(), context.response(), chain);

        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, context.response().getStatus());
        verify(chain, never()).doFilter(any(), any());
    }

    @Test  // branch (4) — authenticated but lacking role
    void forbidsAuthenticatedUserLackingRole() throws Exception {
        context.request().setPathInfo("/mdm/files");
        context.request().addHeader("Authorization", "Bearer good.token");
        when(jwtService.verify("good.token")).thenReturn(Optional.of(principalWith("guest")));
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(context.request(), context.response(), chain);

        assertEquals(HttpServletResponse.SC_FORBIDDEN, context.response().getStatus());
        verify(chain, never()).doFilter(any(), any());
    }

    @Test  // branch (5) — authorized happy path
    void allowsAuthorizedRequestAndSetsPrincipal() throws Exception {
        context.request().setPathInfo("/mdm/files");
        context.request().addHeader("Authorization", "Bearer good.token");
        JwtPrincipal principal = principalWith("mdm-user");
        when(jwtService.verify("good.token")).thenReturn(Optional.of(principal));
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(context.request(), context.response(), chain);

        verify(chain).doFilter(context.request(), context.response());
        assertSame(principal, context.request().getAttribute("shaft.principal"));
        assertEquals(HttpServletResponse.SC_OK, context.response().getStatus());   // never sendError → 200
    }

    @Test  // lifecycle no-ops, for line coverage
    void initAndDestroyAreNoOps() throws Exception {
        filter.init(mock(FilterConfig.class));
        filter.destroy();
    }
}
```

## Pitfalls

1. **JDK-8 version traps.** `sling-mock` 4.x and `mockito` 5.x need JDK 11 — on an 8 toolchain they fail to load; pin `sling-mock.junit5` 3.x + `mockito` 4.x. Equally, do **not** emit Java 9+ syntax in generated tests (`var`, `List.of(...)`, text blocks, records) — it won't compile against `<source>8</source>`. Build role sets with `new HashSet<>(Arrays.asList(...))`, not `Set.of(...)`.
2. **Unsatisfied `@Reference` blows up activation.** `registerInjectActivateService` throws (or leaves the field null) if a mandatory reference isn't a registered OSGi service. Always `context.registerService(Iface.class, mock)` **before** activating the component. For multi-cardinality/greedy references, register the matching number of services.
3. **Config keys are the OCD *method* names, not the labels.** `@AttributeDefinition(name="Protected path prefix") String protectedPathPrefix()` → the map key is `"protectedPathPrefix"`. A misspelled key silently falls back to the `default`, so you test the wrong branch and still pass. (If your `osgi-mock` version lacks the key-value varargs overload, pass a `Map<String,Object>` instead.)
4. **Filter short-circuit needs a two-part assertion.** Passing `context.request()`/`context.response()` (the Sling types) is required so the `(SlingHttpServletRequest)` cast succeeds. On deny paths assert **both** `context.response().getStatus()` **and** `verify(chain, never()).doFilter(...)` — status alone doesn't prove the chain stopped. `sendError` commits the response; a second write throws `IllegalStateException`.
5. **`RESOURCERESOLVER_MOCK` has no JCR query engine or `AccessControlManager`.** MDM units that run real queries or check real ACLs return empty/throw under the default resolver. Either mock the ACL collaborator (preferred, fast) or switch to `new SlingContext(ResourceResolverType.JCR_OAK)`. Servlets are selected by calling `doGet`/`doPost` directly — the mock does not run Sling's real resourceType/path servlet resolver.
6. **Mockito strict-stubbing.** Under `STRICT_STUBS`, a stub that a given branch never reaches throws `UnnecessaryStubbingException` — stub only what each test's branch consumes (that's why each test above stubs `verify(...)` for its own token), or wrap incidental stubs in `lenient()`. Never stub the SlingContext-provided objects (request/response/resolver) — they are real, not mocks.