# Sling-12 / Shaft — Code Generation Patterns

> **Stack:** SHAFT (the company's "sling-12 / Sling Starter" middleware) is a **Java / Apache Sling**
> application — JVM (**JDK 8+**) → Apache Felix (OSGi) → Apache Jackrabbit Oak (JCR) → Apache Sling. Same
> family as AEM, so AEM Sling/OSGi generation transfers; layer SHAFT's SAM (API management) + MDM (master
> data) + connector modules on top. Audit rules for this stack: `bmad-dept-code-audit-agent/resources/rule-packs/sling-shaft/`.
>
> **Deterministic scaffolder:** `scripts/run.ts --scaffold --engine sling --type <t> --name <Name> [--package p]`
> generates: `osgi-service`, `sling-servlet`, `sling-filter`, `sling-model`. Use it for the common cases;
> use the patterns below for custom/business generation.

## Project structure (Sling bundle)

```
├── core/ (or bundle/)                → OSGi bundle: Java source
│   └── src/main/java/{base.package}/
│       ├── {Name}Service.java         → service interface
│       ├── impl/{Name}ServiceImpl.java→ @Component implementation
│       ├── servlets/                  → Sling servlets
│       ├── filters/                   → request filters (XSS/Audit/Authorization)
│       ├── models/                    → Sling Models
│       └── connectors/                → external-system connectors (DB/S3/SFTP/payment/…)
│   └── src/main/java/.../package-info.java  → @Version for exported packages
│   └── pom.xml / bnd.bnd               → OSGi metadata (Import/Export-Package)
├── src/main/features/*.json (or launcher/) → feature model wiring bundles
└── ui/ (optional)                      → JCR content (apps, config)
```

- **JDK 8+**: do not emit Java 9+ APIs/syntax (`var`, `List.of`, records, `java.net.http.HttpClient`).
- Package as an **OSGi bundle** (maven-bundle-plugin / bnd), never a fat JAR.

## Core patterns

### OSGi service (DS R7) + configuration
```java
@Component(service = FooService.class)
@Designate(ocd = FooServiceImpl.Config.class)
public class FooServiceImpl implements FooService {
    @ObjectClassDefinition(name = "Foo Service")
    public @interface Config { @AttributeDefinition(name = "Endpoint") String endpoint(); }
    @Reference private BarService bar;          // constructor/field @Reference, not manual lookup
    @Activate protected void activate(Config c) { /* read config; never hardcode secrets */ }
}
```
- Secrets/config come from OSGi config (mapped to env/secret provider), never constants.
- Prefer `immediate = false` unless activation has a required side-effect.

### Sling Servlet — register by resourceType, not raw path
```java
@Component(service = Servlet.class, property = {
    "sling.servlet.resourceTypes=acme/components/foo",   // governed tree (goes through the filter chain)
    "sling.servlet.methods=GET" })
public class FooServlet extends SlingSafeMethodsServlet { /* validate input; use ResourceResolver from request */ }
```
Avoid `sling.servlet.paths=/bin/...` for data endpoints — it can bypass the filter chain.

### Request filter — respect the SHAFT chain order (XSS → Audit → Authorization)
```java
@Component(service = Filter.class, property = {
    EngineConstants.SLING_FILTER_SCOPE + "=" + EngineConstants.FILTER_SCOPE_REQUEST,
    Constants.SERVICE_RANKING + ":Integer=100" })   // tune ranking so Authorization stays last
public class AuditFilter implements Filter { /* … */ }
```

### ResourceResolver lifecycle + service users
```java
try (ResourceResolver resolver = factory.getServiceResourceResolver(AUTH_INFO)) {   // scoped service user (repoinit)
    // …                                                                            // never getAdministrativeResourceResolver
}   // try-with-resources → no leak
```

### Sling Model
```java
@Model(adaptables = Resource.class, defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL)
public class FooModel { @ValueMapValue private String title; public String getTitle() { return title; } }
```

## SHAFT-specific generation

- **SAM (API management):** generate Query-to-API definitions and channels with column/row allow-lists,
  per-partner **throttling**, **versioning** (new version for breaking changes), partner-token scope+expiry,
  and API logging that **redacts** secrets/PII.
- **MDM:** file/folder operations must enforce **ACL + access token** on every op and export URL; CSV
  pre/post-processors must validate/type input and neutralize spreadsheet formula characters on export;
  triggers (Email/SMS/WhatsApp) validate recipients + rate-limit.
- **Connectors:** never hardcode credentials (OSGi config/secret store); validate TLS; use SecureRandom for
  tokens/OTP; parameterize SQL (`PreparedStatement`), typed Mongo filters (no `$where`); verify JWT with
  `parseClaimsJws`; verify payment-gateway webhook signatures + idempotency.

## Testing (generate alongside)
```java
@ExtendWith(SlingContextExtension.class)
class FooServiceImplTest {
    private final SlingContext ctx = new SlingContext();   // wcm.io Sling/OSGi Mocks
    @Test void process() { ctx.registerInjectActivateService(new FooServiceImpl()); /* … */ }
}
```
JUnit 5 + Apache Sling Mocks / OSGi Mocks; cover the filter chain, auth deny paths, connector error paths,
MDM ACL enforcement, and CSV processing. **JDK 8+ toolchain.**

## Confirm with the team (pending)
Exact Sling/Felix/Oak versions + the "sling-12" release mapping, the feature-model/build layout, and whether
SAM and MDM are separate reactor bundles — these refine package layout and the bnd instructions.
