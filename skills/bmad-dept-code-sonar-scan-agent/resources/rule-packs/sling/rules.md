# Sonar Rule Pack — Apache Sling / Shaft (sling-12)

Language: Java. Applies to: Apache Sling, Shaft (sling-12), and Felix/Oak-based custom middleware.
Severity mapping and rating model: see `../../shared/severity-and-rating-model.md`.

---

## Bug (Reliability)

### S2259 — Null Pointer Dereference
**Severity:** HIGH | **ruleId:** `S2259`

Sling `Resource`, `ValueMap`, or service references obtained via `@Reference` can be null in certain OSGi lifecycle states or when the resource path does not exist.

- ❌ Detect-Bad: `resolver.getResource(path).getValueMap().get("key", String.class)` — chained calls with no null guards
- ✅ Detect-Good: `Resource r = resolver.getResource(path); if (r == null) return null; ValueMap vm = r.getValueMap();`
- **Remediation:** Add null guards after every `getResource()`, `adaptTo()`, and `getService()`. Return a safe default rather than propagating null.

### S2095 — Unclosed ResourceResolver / Session
**Severity:** HIGH | **ruleId:** `S2095`

A `ResourceResolver` or JCR `Session` is obtained from a factory in a Sling Servlet or Scheduler but not closed, causing connection-pool exhaustion over time.

- ❌ Detect-Bad: `ResourceResolver rr = resolverFactory.getServiceResourceResolver(authInfo);` with no close path
- ✅ Detect-Good: `try (ResourceResolver rr = resolverFactory.getServiceResourceResolver(authInfo)) { ... }`
- **Remediation:** Wrap in try-with-resources at the identified line. If the resolver must outlive the try block, ensure `finally { if (rr != null && rr.isLive()) rr.close(); }`.

### S1854 — Dead Stores
**Severity:** LOW | **ruleId:** `S1854`

Assigned variable is never read before being overwritten or the method returns.

- **Remediation:** Remove the dead assignment at the identified line.

---

## Vulnerability (Security)

### S2068 — Hardcoded Credentials
**Severity:** CRITICAL | **ruleId:** `S2068`

Service user credentials, LDAP bind passwords, or API keys appear as string literals in Java source or OSGi configuration files committed to source control.

- ❌ Detect-Bad: `String bindPassword = "changeit";` or `@Property(value = "secret123")`
- ✅ Detect-Good: OSGi `@AttributeDefinition(type = AttributeType.PASSWORD)` reading from `secrets.xml` outside the repo, or `System.getenv("BIND_PASSWORD")`
- **Remediation:** Move the literal credential to an OSGi password property or environment variable. Remove from the source file and rotate the credential.

### S3649 — JCR-SQL2 / XPath Injection
**Severity:** CRITICAL | **ruleId:** `S3649`

User input concatenated into a JCR query string allows an attacker to read arbitrary repository content.

- ❌ Detect-Bad: `"SELECT * FROM [sling:Folder] WHERE [sling:resourceType] = '" + type + "'"`
- ✅ Detect-Good: Use JCR bind variables — `q.bindValue("type", factory.createValue(type));`
- **Remediation:** Refactor the query at the identified line to use bind variables. Cite the specific concatenation expression to replace.

### S5131 — Sling Servlet Response XSS
**Severity:** HIGH | **ruleId:** `S5131`

A Sling Servlet writes unsanitized request parameters or node content directly to a JSON or HTML response.

- ❌ Detect-Bad: `response.getWriter().write(request.getParameter("msg"));`
- ✅ Detect-Good: `response.getWriter().write(xssApi.encodeForHTML(request.getParameter("msg")));`
- **Remediation:** Wrap the output at the identified line with the appropriate XSSAPI encoding method (encodeForHTML / encodeForJSString / encodeForXML depending on context).

---

## Security Hotspot

### S4507 — Unrestricted Sling Servlets
**Severity:** MEDIUM | **ruleId:** `S4507`

A servlet registered with `@SlingServletResourceTypes` or `@SlingServletPaths` does not enforce authentication, potentially exposing internal data to unauthenticated requests.

- **Review:** Confirm the servlet has a `@SlingServletFilter` or OSGi `requiresAuthentication` config. If public access is intentional, document it clearly.

---

## Code Smell (Maintainability)

### S3776 — Cognitive Complexity
**Severity:** MEDIUM | **ruleId:** `S3776`

Service or Servlet method cognitive complexity exceeds 15. Common in connector bridging logic and multi-protocol handlers in Shaft.

- **Remediation:** Extract nested blocks into private helpers. State the method name, current complexity, and the names of extracted methods with their intended line ranges.

### S1192 — Duplicated String Literals
**Severity:** LOW | **ruleId:** `S1192`

JCR property names, path segments, or MIME type strings repeated as inline literals 5+ times.

- **Remediation:** Extract to a `private static final String` constant or a shared `Constants` class.

### S1066 — Collapsible If Statements
**Severity:** LOW | **ruleId:** `S1066`

Two consecutive `if` statements with no else can be merged into a single condition.

- ❌ Detect-Bad: `if (a != null) { if (a.isValid()) { ... } }`
- ✅ Detect-Good: `if (a != null && a.isValid()) { ... }`
- **Remediation:** Merge at the identified line pair.

---

## Duplication

### S1144 — Unused Private Methods
**Severity:** LOW | **ruleId:** `S1144`

Private utility methods that are never called. Common after refactors in connector and bridge classes.

- **Remediation:** Delete the dead method at the identified line.

---

## Complexity

### S138 — Methods with Too Many Lines
**Severity:** MEDIUM | **ruleId:** `S138`

Methods exceeding 80 lines in OSGi service implementations, especially `@Activate` or `processRequest()` methods.

- **Remediation:** Identify sub-sections (activation, validation, processing, error-handling) and extract each. Cite line ranges for each extracted block.
