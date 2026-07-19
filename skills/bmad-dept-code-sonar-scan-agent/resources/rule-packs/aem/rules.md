# Sonar Rule Pack — AEM (AEMaaCS + AEM AMS)

Language: Java. Applies to: AEM as a Cloud Service and AEM AMS projects.
Severity mapping and rating model: see `../../shared/severity-and-rating-model.md`.

---

## Bug (Reliability)

### S2259 — Null Pointer Dereference
**Severity:** HIGH | **ruleId:** `S2259`

A method return value or field is dereferenced without a null check. Common in Sling Model adaptions and resource resolution.

- ❌ Detect-Bad: `resource.adaptTo(MyModel.class).getData()` — `adaptTo` can return null
- ✅ Detect-Good: `MyModel model = resource.adaptTo(MyModel.class); if (model != null) { model.getData(); }`
- **Remediation:** Wrap every `adaptTo()`, `getChild()`, `getResource()`, and `getService()` call with a null guard or use Optional.

### S1854 — Dead Stores
**Severity:** LOW | **ruleId:** `S1854`

A value is assigned to a local variable that is never read before being overwritten or the method returns.

- ❌ Detect-Bad: `String title = resource.getValueMap().get("jcr:title", ""); title = properties.get("title", "");` — first assignment unused
- ✅ Detect-Good: `String title = properties.get("title", String.class);`
- **Remediation:** Remove the unused assignment on the identified line.

### S2095 — Resources Should Be Closed
**Severity:** HIGH | **ruleId:** `S2095`

A `ResourceResolver`, `Session`, `InputStream`, or similar closeable resource is opened but not closed in a finally block or try-with-resources, risking resource leaks.

- ❌ Detect-Bad: `ResourceResolver rr = factory.getAdministrativeResourceResolver(null); rr.getResource(path);` (no close)
- ✅ Detect-Good: `try (ResourceResolver rr = factory.getServiceResourceResolver(params)) { ... }`
- **Remediation:** Wrap in try-with-resources or add `finally { if (rr != null) rr.close(); }`.

---

## Vulnerability (Security)

### S3649 — SQL/JCR-SQL2 Injection
**Severity:** CRITICAL | **ruleId:** `S3649`

User-controlled input is concatenated directly into a JCR-SQL2 or XPath query string.

- ❌ Detect-Bad: `String q = "SELECT * FROM [nt:base] WHERE [jcr:title] = '" + userInput + "'";`
- ✅ Detect-Good: Use `session.getWorkspace().getQueryManager().createQuery()` with named bind variables or use Sling's `ResourceResolver.findResources()` with a parameterized map.
- **Remediation:** Replace the concatenation with JCR bind variables: `query = "... WHERE [jcr:title] = $title"; q.bindValue("title", valueFactory.createValue(userInput));`

### S2068 — Hardcoded Credentials
**Severity:** CRITICAL | **ruleId:** `S2068`

Service user passwords, API keys, or signing secrets appear as string literals in Java source.

- ❌ Detect-Bad: `String password = "admin123";` or `@Property(value = "changeit")`
- ✅ Detect-Good: Read from OSGi config or environment: `@Activate void activate(Config cfg) { password = cfg.password(); }`
- **Remediation:** Move the literal to an OSGi configuration property annotated with `@AttributeDefinition(type = AttributeType.PASSWORD)` and mark the field `@interface Config { char[] password(); }`.

### S5131 — XSS via Sling / HTL
**Severity:** HIGH | **ruleId:** `S5131`

User-provided or repository content is written into an HTTP response without encoding, or an HTL expression uses `@context='unsafe'`.

- ❌ Detect-Bad: `response.getWriter().write(request.getParameter("q"));` or `${properties.text @ context='unsafe'}`
- ✅ Detect-Good: `response.getWriter().write(StringEscapeUtils.escapeHtml4(request.getParameter("q")));` or `${properties.text}` (default HTL context)
- **Remediation:** Apply XSSAPI.encodeForHTML() for Servlet output; remove `context='unsafe'` from HTL and let HTL auto-escape.

---

## Security Hotspot

### S4507 — Delivering Code in Production Using Debug Features
**Severity:** MEDIUM | **ruleId:** `S4507`

Debug flags, verbose logging of sensitive data, or development-only Sling servlets (registered with `service.ranking=-1` or missing auth requirements) may expose internal state in production.

- Detect: Servlets with `@SlingServletResourceTypes` lacking `requiresAuthentication` or OSGi configs with `debug=true` without an environment guard.
- **Review:** Confirm each debug endpoint has a Sling authentication requirement and is disabled outside development runmodes.

---

## Code Smell (Maintainability)

### S3776 — Cognitive Complexity
**Severity:** MEDIUM | **ruleId:** `S3776`

A method's cognitive complexity exceeds 15 (SonarQube default threshold). Heavily nested if/switch/loop chains in Sling Models and WCM Use-classes are common offenders.

- ❌ Detect-Bad: `public String getItems() { if (...) { for (...) { if (...) { switch (...) { ... } } } } }`
- ✅ Detect-Good: Extract conditional blocks into private helper methods; each method covers one concern.
- **Remediation:** List the method name, its line range, its current complexity score, and the extracted-method names with their line targets.

### S1192 — Duplicated String Literals
**Severity:** LOW | **ruleId:** `S1192`

The same string literal (e.g. property names like `"jcr:content"`, `"cq:template"`) appears 5+ times across the class.

- ❌ Detect-Bad: repeated `"jcr:content"` in multiple getters
- ✅ Detect-Good: `private static final String JCR_CONTENT = "jcr:content";`
- **Remediation:** Extract to a `private static final String` or to a shared constants class.

---

## Duplication

### S1144 — Unused Private Methods
**Severity:** LOW | **ruleId:** `S1144`

Private methods that are never called constitute dead code and inflate the maintenance surface.

- ❌ Detect-Bad: `private String buildOldQuery() { ... }` — not called from any method
- ✅ Detect-Good: Method is either used or deleted.
- **Remediation:** Delete the unused method at the identified line.

---

## Complexity

### S138 — Methods with Too Many Lines
**Severity:** MEDIUM | **ruleId:** `S138`

Methods exceeding ~80 lines (SonarQube default 150, tighten to 80 for OSGi services) are difficult to test, understand, and modify safely.

- **Remediation:** Identify the logical sub-sections (e.g. validation, business logic, persistence) and extract each into a named private method. Cite the line ranges for each extracted block.
