# AEMaaCS / AEM AMS — Test Generation (LLM, target 100% coverage)

Generate JUnit 5 + wcm.io AEM Mocks (`AemContext`) + Mockito tests that exercise every Sling Model, OSGi service, Sling Servlet, WorkflowProcess, and Scheduler in `core/`, hitting every branch and error path.

## Framework & dependencies

Adobe AEM Project Archetype defaults. Add nothing new — generate against what the `core/pom.xml` already ships. Pin versions by stack:

| Library | AEMaaCS (Java 11/17) | AEM AMS 6.5 (Java 8/11) |
|---|---|---|
| Platform API (compile, `provided`) | `com.adobe.aem:aem-sdk-api` | `com.adobe.aem:uber-jar` (classifier `apis`), `6.5.x` |
| `org.junit.jupiter:junit-jupiter` | `5.10.2` | `5.10.2` |
| `io.wcm:io.wcm.testing.aem-mock.junit5` | `5.6.6` | `5.6.6` (or `4.1.x`) |
| `org.mockito:mockito-core` + `mockito-junit-jupiter` | `5.11.0` | `4.11.0` (last Java 8 line) |
| Servlet API | `javax.servlet` | `javax.servlet` |
| DI annotations in models | `javax.inject` | `javax.inject` |

Maven test wiring (`core/pom.xml`):

```xml
<dependencies>
  <dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>5.10.2</version>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>io.wcm</groupId>
    <artifactId>io.wcm.testing.aem-mock.junit5</artifactId>
    <version>5.6.6</version>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.mockito</groupId>
    <artifactId>mockito-junit-jupiter</artifactId>
    <version>5.11.0</version>
    <scope>test</scope>
  </dependency>
</dependencies>

<build><plugins>
  <plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <version>3.2.5</version>
  </plugin>
  <plugin>                          <!-- coverage gate: run tests, verify 100% -->
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.12</version>
    <executions>
      <execution><goals><goal>prepare-agent</goal></goals></execution>
      <execution><id>report</id><phase>test</phase><goals><goal>report</goal></goals></execution>
    </executions>
  </plugin>
</plugins></build>
```

Run: `mvn -pl core test` — JaCoCo report lands at `core/target/site/jacoco/index.html`.

## Where tests go & naming

- **Location:** `core/src/test/java/<same package as source>/`. The test class **must share the source package** — it is how `protected doGet`/`doPost` and package-private methods stay reachable without reflection.
- **Test class:** `<ClassUnderTest>Test.java` (e.g. `HeroModel` → `HeroModelTest`).
- **Test methods:** `unitOfWork_expectedResult_whenCondition` (e.g. `doGet_returns400_whenSkuMissing`). One method per branch/case, not per source method.
- **Content & config fixtures (JSON):** `core/src/test/resources/<package path>/<name>.json`. Load with `context.load().json("/com/example/core/models/hero.json", "/content/hero")`.

```
core/src/
├── main/java/com/example/core/servlets/ProductLookupServlet.java
└── test/
    ├── java/com/example/core/servlets/ProductLookupServletTest.java
    └── resources/com/example/core/servlets/product.json
```

## Test anatomy

Every test class: `@ExtendWith(AemContextExtension.class)` + a **fresh** `AemContext` field (the extension resets it per test method).

```java
package com.example.core.servlets;

import io.wcm.testing.mock.aem.junit5.AemContext;
import io.wcm.testing.mock.aem.junit5.AemContextExtension;
import org.apache.sling.testing.mock.sling.ResourceResolverType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(AemContextExtension.class)
class ExampleTest {

    // JCR_MOCK (default) = full nt-hierarchy; RESOURCERESOLVER_MOCK = faster, flat, no JCR semantics
    private final AemContext context = new AemContext(ResourceResolverType.JCR_MOCK);

    @BeforeEach
    void setUp() {
        context.load().json("/com/example/core/servlets/product.json", "/content/site");
    }
}
```

Minimal driver per source-unit type (generate the one matching the unit):

```java
// 1. Sling Model — Resource-adaptable
context.addModelsForClasses(HeroModel.class);            // REQUIRED or adaptTo() == null
Resource r = context.currentResource("/content/site/jcr:content/hero");
HeroModel model = r.adaptTo(HeroModel.class);

// 1b. Sling Model — Request-adaptable
context.addModelsForClasses(HeroModel.class);
context.currentResource("/content/site/jcr:content/hero");
HeroModel model = context.request().adaptTo(HeroModel.class);

// 2. OSGi service — activation + config injection in one call
context.registerService(ExternalApi.class, mock(ExternalApi.class));      // satisfy @Reference FIRST
PricingService svc = context.registerInjectActivateService(
        new PricingService(), java.util.Map.of("enabled", true, "rate", 5));

// 3. Sling Servlet
ProductLookupServlet servlet = context.registerInjectActivateService(new ProductLookupServlet());
servlet.doGet(context.request(), context.response());
assertEquals(200, context.response().getStatus());
String body = context.response().getOutputAsString();

// 4. WorkflowProcess — mock the workflow API, bridge session to the real mock resolver
WorkflowSession wfSession = mock(WorkflowSession.class);
WorkItem item = mock(WorkItem.class);
WorkflowData data = mock(WorkflowData.class);
when(item.getWorkflowData()).thenReturn(data);
when(data.getPayloadType()).thenReturn("JCR_PATH");
when(data.getPayload()).thenReturn("/content/site/page");
when(wfSession.adaptTo(ResourceResolver.class)).thenReturn(context.resourceResolver());
new TagPayloadProcess().execute(item, wfSession, new SimpleMetaDataMap());

// 5. Scheduler (Runnable) — activate with config, then invoke run()
CacheWarmJob job = context.registerInjectActivateService(
        new CacheWarmJob(), java.util.Map.of("scheduler.expression", "0 0 * * * ?"));
job.run();
```

## Reaching 100%

Apply to **every source unit**. Private/package-private methods are covered **transitively** via their public/protected callers — never test them directly, but ensure the public cases you write drive each private branch.

- **One test per public/protected method** (`doGet`, `doPost`, each getter with logic, `execute`, `run`, `@Activate`).
- **One case per branch/condition:** each `if`/`else`, `switch` arm, ternary, `&&`/`||` short-circuit, loop-empty vs loop-populated, and each `Optional`/null-guard outcome. A method with N conditions needs enough cases to flip every decision both ways.
- **Every thrown/caught exception & error path:** stub a collaborator with `thenThrow(...)` and assert the recovery (500 status, empty result, logged-and-continue). Cover both the `try` success and every `catch`.
- **Boundary + null/empty inputs:** missing request param, blank/whitespace string, empty `ValueMap`, empty child-resource list, absent JCR node, `0`/negative/max numeric config, empty query result.
- **Security-negative cases (where the unit accepts external input):** reject path traversal, XSS/injection payloads, oversized input, and unauthenticated/wrong-resourceType access — assert the request is refused (400/403) and the downstream service is **never** called (`verifyNoInteractions`).
- **AEM-construct coverage:** `@Reference` present vs absent (optional refs), each `@Activate` config value that changes behavior, servlet selector/extension routing, workflow payload-type mismatch (`getPayloadType()` != `"JCR_PATH"`) hitting the error branch, model `DefaultInjectionStrategy.OPTIONAL` field left unset.
- **Verify with JaCoCo:** any red line/branch in the report is a missing case — add it before declaring done.

## Mocking strategy

Prefer the **real mock runtime** over Mockito; reach for Mockito only at the system's true edges.

**Use real (via `AemContext`):**
- The resource tree — build it with `context.load().json(...)` and `context.create.resource(path, props)`; never mock `Resource`/`ValueMap`/`ResourceResolver`.
- The unit under test — Sling Models, servlets, and services are **constructed and OSGi-activated** by `registerInjectActivateService`, so real injection/lifecycle runs.
- `context.request()` / `context.response()` — real `MockSlingHttpServletRequest`/`Response`; set params, selectors, method, resource on them.

**Mock (Mockito):**
- Out-of-container collaborators the unit depends on via `@Reference` — create with `mock(Iface.class)`, then `context.registerService(Iface.class, theMock)` **before** `registerInjectActivateService` so the container injects it.
- The Workflow API (`WorkflowSession`, `WorkItem`, `WorkflowData`, `WorkflowModel`) — no mock impl exists; stub it and bridge `adaptTo(ResourceResolver.class)` to `context.resourceResolver()`.
- Anything crossing the network/JCR-query boundary the mocks don't model: HTTP clients, `QueryBuilder`/SQL2 result sets, external SDKs.

**Never:** PowerMock, `mockStatic` on Sling/JCR types, mocking the class under test, or setting `@Reference`/`@ValueMapValue` fields by reflection — register the dependency into the container and let injection run.

## Worked example

**Source** — `core/src/main/java/com/example/core/servlets/ProductLookupServlet.java`:

```java
package com.example.core.servlets;

import com.example.core.dto.Product;
import com.example.core.services.ProductService;
import com.example.core.services.ProductServiceException;
import org.apache.commons.lang3.StringUtils;
import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.api.SlingHttpServletResponse;
import org.apache.sling.api.servlets.SlingSafeMethodsServlet;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;

import javax.servlet.Servlet;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.regex.Pattern;

@Component(service = Servlet.class, property = {
        "sling.servlet.resourceTypes=myproject/components/product-endpoint",
        "sling.servlet.methods=GET",
        "sling.servlet.extensions=json"
})
public class ProductLookupServlet extends SlingSafeMethodsServlet {

    private static final long serialVersionUID = 1L;
    private static final Pattern SKU_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{1,32}$");

    @Reference
    private transient ProductService productService;

    @Override
    protected void doGet(SlingHttpServletRequest request, SlingHttpServletResponse response)
            throws IOException {
        response.setContentType("application/json");
        String sku = request.getParameter("sku");

        if (StringUtils.isBlank(sku)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().write("{\"error\":\"sku is required\"}");
            return;
        }
        if (!isValidSku(sku)) {                                    // security guard
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().write("{\"error\":\"invalid sku\"}");
            return;
        }
        try {
            Product product = productService.findBySku(sku);
            if (product == null) {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                response.getWriter().write("{\"error\":\"not found\"}");
                return;
            }
            response.setStatus(HttpServletResponse.SC_OK);
            response.getWriter().write(
                String.format("{\"sku\":\"%s\",\"name\":\"%s\"}", product.getSku(), product.getName()));
        } catch (ProductServiceException e) {                      // error path
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write("{\"error\":\"lookup failed\"}");
        }
    }

    private boolean isValidSku(String sku) {                       // covered via doGet
        return SKU_PATTERN.matcher(sku).matches();
    }
}
```

**Generated test** — `core/src/test/java/com/example/core/servlets/ProductLookupServletTest.java`. Seven cases = every branch (found / not-found / blank / illegal / too-long / service-throws) plus content-type, achieving 100% line & branch:

```java
package com.example.core.servlets;

import com.example.core.dto.Product;
import com.example.core.services.ProductService;
import com.example.core.services.ProductServiceException;
import io.wcm.testing.mock.aem.junit5.AemContext;
import io.wcm.testing.mock.aem.junit5.AemContextExtension;
import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(AemContextExtension.class)
class ProductLookupServletTest {

    private final AemContext context = new AemContext();

    private ProductService productService;
    private ProductLookupServlet servlet;

    @BeforeEach
    void setUp() {
        productService = mock(ProductService.class);
        context.registerService(ProductService.class, productService);          // satisfy @Reference
        servlet = context.registerInjectActivateService(new ProductLookupServlet());
    }

    private void param(String sku) {
        Map<String, Object> params = new HashMap<>();   // MockSlingHttpServletRequest wants Map<String,Object>
        params.put("sku", sku);
        context.request().setParameterMap(params);
    }

    @Test
    void doGet_returnsProductAndJsonContentType_whenSkuFound() throws Exception {
        Product product = mock(Product.class);
        when(product.getSku()).thenReturn("ABC-123");
        when(product.getName()).thenReturn("Widget");
        when(productService.findBySku("ABC-123")).thenReturn(product);
        param("ABC-123");

        servlet.doGet(context.request(), context.response());

        assertEquals(HttpServletResponse.SC_OK, context.response().getStatus());
        assertEquals("application/json", context.response().getContentType());
        assertTrue(context.response().getOutputAsString().contains("\"sku\":\"ABC-123\""));
    }

    @Test
    void doGet_returns404_whenSkuNotFound() throws Exception {
        when(productService.findBySku("ABC-123")).thenReturn(null);
        param("ABC-123");

        servlet.doGet(context.request(), context.response());

        assertEquals(HttpServletResponse.SC_NOT_FOUND, context.response().getStatus());
    }

    @Test
    void doGet_returns400_whenSkuMissing() throws Exception {     // null / empty input
        servlet.doGet(context.request(), context.response());

        assertEquals(HttpServletResponse.SC_BAD_REQUEST, context.response().getStatus());
        assertTrue(context.response().getOutputAsString().contains("required"));
        verifyNoInteractions(productService);
    }

    @Test
    void doGet_returns400_whenSkuBlank() throws Exception {       // whitespace boundary
        param("   ");
        servlet.doGet(context.request(), context.response());

        assertEquals(HttpServletResponse.SC_BAD_REQUEST, context.response().getStatus());
    }

    @Test
    void doGet_returns400_whenSkuHasIllegalChars() throws Exception {   // security-negative
        param("../../etc/passwd");
        servlet.doGet(context.request(), context.response());

        assertEquals(HttpServletResponse.SC_BAD_REQUEST, context.response().getStatus());
        assertTrue(context.response().getOutputAsString().contains("invalid"));
        verifyNoInteractions(productService);
    }

    @Test
    void doGet_returns400_whenSkuExceedsMaxLength() throws Exception {  // upper boundary (33 > 32)
        param(StringUtils.repeat("A", 33));
        servlet.doGet(context.request(), context.response());

        assertEquals(HttpServletResponse.SC_BAD_REQUEST, context.response().getStatus());
        verifyNoInteractions(productService);
    }

    @Test
    void doGet_returns500_whenServiceThrows() throws Exception {  // exception path
        when(productService.findBySku("ABC-123")).thenThrow(new ProductServiceException("boom"));
        param("ABC-123");

        servlet.doGet(context.request(), context.response());

        assertEquals(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, context.response().getStatus());
        assertTrue(context.response().getOutputAsString().contains("lookup failed"));
    }
}
```

## Pitfalls

1. **`adaptTo(...)` returns `null`.** You forgot `context.addModelsForClasses(MyModel.class)` (or `addModelsForPackage`), or the `@Model(adaptables = ...)` doesn't match what you adapt (adapting a `Resource` when the model is `SlingHttpServletRequest.class`), or a `REQUIRED`-strategy `@Inject` field is unset so construction aborts. Register the model, match the adaptable, seed the field.
2. **`@Reference` is `null` / activation fails.** `registerService(Iface.class, mock)` must run **before** `registerInjectActivateService(...)`. A mandatory (non-optional) reference left unregistered makes the component unsatisfied and `registerInjectActivateService` throws.
3. **`setParameterMap` won't compile / silently no-ops.** Its parameter is `Map<String, Object>`; passing `Map.of("sku","x")` (inferred `Map<String, String>`) fails the generic check. Build a `HashMap<String, Object>` (or use `context.request().setQueryString(...)`).
4. **Reading response output the wrong way.** Mixing `getWriter()` (source) with `getOutputStream()` throws `IllegalStateException`; assert with `context.response().getOutputAsString()`. Also set/read status via the mock — `getStatus()` reflects `setStatus/sendError`, defaulting to `200` if the servlet never sets it.
5. **Workflow NPEs.** `WorkItem`/`WorkflowSession`/`WorkflowData` have no mock impl — stub them, stub `data.getPayloadType()` to `"JCR_PATH"`, and bridge `when(wfSession.adaptTo(ResourceResolver.class)).thenReturn(context.resourceResolver())` so the process reads the real mock tree. Cover the payload-type-mismatch branch too.
6. **Stack/version drift.** AMS on Java 8 requires Mockito `4.11.0` (5.x is Java-11+) and compiles against `uber-jar`; AEMaaCS uses `aem-sdk-api`. Keep servlet/DI imports on `javax.servlet` / `javax.inject` (not `jakarta.*`) — a wrong import compiles nowhere. `JCR_MOCK` vs `RESOURCERESOLVER_MOCK` also differ: JCR SQL2/QueryBuilder isn't supported by either, so mock the query layer rather than expecting live search results.