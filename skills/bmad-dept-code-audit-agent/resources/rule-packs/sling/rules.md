# Sling-12 / Shaft Rules

> **Stack identity:** SHAFT (the company's "sling-12 / Sling Starter" custom middleware) is a
> **Java / Apache Sling** application — JVM (JDK 8+) → **Apache Felix (OSGi)** → **Apache Jackrabbit Oak (JCR)**
> → **Apache Sling** + Sling Security + Sling Datasource Pooling. It is the **same technology family as AEM**,
> so AEM Sling/OSGi rules transfer; the SHAFT-specific surface is its two platforms — **SAM** (API management:
> Query-to-API builder, channels, aggregation, distribution with B2B/B2C auth, versioning, throttling, partner
> management, orchestration/pipelines) and **MDM** (file/folder CRUD, ACL, CSV pre/post-processing, export-URL
> APIs, triggers) — plus its connectors (DB/S3/Azure/SFTP/payment gateways/notifications) and the request
> **filter chain (XSS → Audit → Authorization)**.
>
> **Tier-1 coverage:** rules tagged `[scanner: <ID>]` are already detected deterministically by the
> tree-sitter AST engine at `scripts/engines/sling/`. Rules without that tag are **Tier-2 (LLM) only** —
> apply them by reading the code semantically.

---

## Platform & Architecture Rules

---

### SHAFT-ARCH-001: Target the Sling/Felix/Oak platform correctly (JDK 8+)

- **Severity**: Medium
- **Description**: SHAFT runs on Apache Felix (OSGi) with Apache Sling on Jackrabbit Oak, JDK 8+. Bundles must be valid OSGi bundles (proper `Import-Package`/`Export-Package` via bnd), and code must not assume a servlet container or Spring context. Language features beyond Java 8 will not run on a JDK 8 deployment.

#### Detect — Files to Scan
```
**/pom.xml, **/bnd.bnd, **/*.bnd, src/main/features/**/*.json, **/*.java
```

#### Detect — Bad Pattern
- Java 9+ APIs/syntax (`var`, `List.of`, records, `HttpClient` from `java.net.http`) in a JDK-8 target
- Fat JARs / shaded dependencies instead of OSGi bundles
- Missing OSGi metadata (no `Bundle-SymbolicName`, no bnd instructions)

#### Detect — Good Pattern
- `maven-bundle-plugin` / bnd with explicit package imports/exports
- `@Component` (OSGi DS R7) services; `@Designate` + `@ObjectClassDefinition` for config
- Feature model (`.json`) or provisioning model wiring bundles

#### Remediation
Keep `maven.compiler.source/target` at the deployed JDK; package as OSGi bundles; declare DS components; validate the feature model launches.

---

### SHAFT-ARCH-002: OSGi component & configuration correctness

- **Severity**: Medium
- **Description**: Services must be declared as OSGi DS components with configuration via `@ObjectClassDefinition`. Avoid `immediate = true` unless the component must activate without being consumed. Never read secrets/config from hardcoded constants — use OSGi config (which maps to environment/secret providers).

#### Detect — Bad Pattern
- `@Component(immediate = true)` on a plain service with no `@Activate` side-effect
- Configuration values as `private static final String` constants
- `BundleContext` service lookups by hand instead of `@Reference`

#### Detect — Good Pattern
- `@Reference` for dependencies; `@Designate(ocd = Config.class)` for configuration
- Optional/greedy reference policies chosen deliberately

#### Remediation
Model configuration with `@ObjectClassDefinition`; inject with `@Reference`; source secrets from config, not constants (see SHAFT-SEC-001).

---

## Request Filter Chain Rules

---

### SHAFT-FILTER-001: XSS → Audit → Authorization filter chain must be intact and ordered

- **Severity**: Critical
- **Description**: SHAFT's request pipeline is a Sling servlet filter chain: **XSS Filter → Audit Filter → Authorization Filter**. New endpoints/servlets must pass through it. A servlet registered so that it bypasses the Authorization filter (wrong `sling.filter.scope`, wrong path, or a filter `service.ranking` that reorders Authorization before Audit) exposes unauthenticated/over-privileged access.

#### Detect — Files to Scan
```
**/*Filter.java, **/*Servlet.java, **/OSGI-INF/**, **/*.java (Sling filter/servlet registrations)
```

#### Detect — Bad Pattern
- A `Filter` with `sling.filter.scope=REQUEST` and a `service.ranking` that places Authorization **before** Audit or XSS
- A servlet registered on a raw path (`sling.servlet.paths`) outside the filtered resource tree
- Authorization decisions made inside the servlet instead of the Authorization filter, inconsistently

#### Detect — Good Pattern
- Filters ordered by `service.ranking` so XSS runs first, Authorization last, Audit between
- Endpoints registered by `sling.servlet.resourceTypes` within the governed tree
- Central Authorization filter enforces access for every request

#### Remediation
Verify each new endpoint traverses XSS → Audit → Authorization; set `service.ranking` explicitly; prefer `resourceTypes` over raw `paths`.

---

## Authentication & Authorization Rules

---

### SHAFT-AUTH-001: JWT signatures must be verified `[scanner: SHAFT-AUTH-001]`

- **Severity**: High
- **Description**: SHAFT auth supports SSO, JWT, Partner Token, 2FA, OAuth2, LDAP. Parsing a JWT without verifying its signature (`parseClaimsJwt` / plaintext parse) lets an attacker forge tokens. Always use the signed-JWS parse with the configured key.

#### Detect — Bad Pattern
- `Jwts.parser()....parseClaimsJwt(token)` (unsigned)
- Manual base64 decode of the JWT payload with no signature check
- Accepting `alg: none`

#### Detect — Good Pattern
- `parseClaimsJws(token)` with `setSigningKey(...)` / a resolved key
- Explicit algorithm allow-list; reject `none`

#### Remediation
Verify signatures with the configured key/JWKS; pin algorithms; validate `exp`/`iss`/`aud`.

---

### SHAFT-AUTH-002: Partner tokens must be scoped and time-bounded

- **Severity**: High
- **Description**: SAM API Distribution onboards partners with **short-term & long-term** access. Partner tokens must carry a scope (which APIs/versions) and an expiry, and must be revocable. Unscoped or non-expiring partner tokens grant standing access to the whole API surface.

#### Detect — Bad Pattern
- Partner token issued with no `scope`/`audience` and no `exp`
- Token validation that checks only presence, not scope vs the requested API/version
- Long-term tokens with no revocation list check

#### Detect — Good Pattern
- Token carries scope + expiry; validation checks scope against the target API and version
- Revocation/allow-list consulted on each call

#### Remediation
Attach and enforce scope + expiry on every partner token; support revocation; separate short-term vs long-term issuance.

---

### SHAFT-AUTH-003: Authorization not bypassable / not hardcoded

- **Severity**: Critical
- **Description**: Authorization/permission methods that unconditionally return `true`, are commented out, or are gated on a debug flag defeat the Authorization filter and MDM ACLs.

#### Detect — Bad Pattern
- `isAuthorized(...) { return true; }` / `hasPermission(...) { return true; }`
- `if (DEBUG) return true;` in an auth path
- Commented-out permission checks

#### Detect — Good Pattern
- Authorization resolves against the user/role/ACL and denies by default

#### Remediation
Deny by default; resolve permissions from roles/ACLs; remove debug bypasses before release.

---

### SHAFT-AUTH-004: LDAP/OAuth2/SSO input and redirect validation

- **Severity**: High
- **Description**: LDAP lookups built from unsanitized input allow LDAP injection; OAuth2/SSO flows without `state` (CSRF) or with open `redirect_uri` allow account takeover.

#### Detect — Bad Pattern
- LDAP filter string concatenated from user input
- OAuth2 flow without `state`; `redirect_uri` not allow-listed

#### Detect — Good Pattern
- Escaped LDAP filters (RFC 4515); `state` validated; redirect URIs allow-listed

#### Remediation
Escape LDAP filter values; enforce `state`; allow-list redirect URIs.

---

## Connector & Secret Rules

---

### SHAFT-SEC-001: No hardcoded connector credentials/secrets `[scanner: SHAFT-SEC-001]`

- **Severity**: Critical
- **Description**: SHAFT connectors integrate DB (MySQL/Oracle/SQL Server/PostgreSQL/MongoDB), S3, Azure Blob, SFTP/FTP, payment gateways (Razorpay/PayU/Cashfree/Pine Labs), and notification providers (WhatsApp/Email/SMS). Credentials for any of these hardcoded in source leak to everyone with repo/bundle access.

#### Detect — Bad Pattern
- `private String accessKey = "AKIA...";`, `password = "..."`, API keys/tokens as string literals
- Payment-gateway keys / SMTP passwords in code or committed properties

#### Detect — Good Pattern
- Secrets via OSGi configuration → environment/secret store; never in VCS

#### Remediation
Move to OSGi config/secret store; rotate any exposed secret; add secret scanning to CI.

---

### SHAFT-SEC-004: TLS validation must not be disabled `[scanner: SHAFT-SEC-004]`

- **Severity**: High
- **Description**: Connector traffic to payment gateways/external APIs must validate TLS certs and hostnames. Trust-all managers / no-op hostname verifiers enable MITM.

#### Detect — Bad Pattern
- `X509TrustManager` that accepts everything; `NoopHostnameVerifier`; `TrustAllStrategy`

#### Detect — Good Pattern
- Default JVM truststore; proper hostname verification

#### Remediation
Remove trust-all code; use the system truststore; pin where appropriate.

---

### SHAFT-SEC-005/006: Strong crypto and CSPRNG `[scanner: SHAFT-SEC-005, SHAFT-SEC-006]`

- **Severity**: High / Medium
- **Description**: Use SHA-256+ and AES/GCM; never MD5/SHA-1/DES/ECB. Use `SecureRandom` for tokens/OTP/salts/nonces, never `java.util.Random` (relevant to OTP Management + partner tokens).

#### Remediation
Replace weak algorithms; switch security-sensitive randomness to `SecureRandom`.

---

## Data-Access Rules

---

### SHAFT-DATA-001: No SQL injection via string building `[scanner: SHAFT-SEC-002]`

- **Severity**: Critical
- **Description**: DB Services and MDM export/query paths must use parameterized queries. SQL built by concatenating request/CSV input is injectable.

#### Detect — Bad Pattern
- `stmt.executeQuery("SELECT ... '" + input + "'")`; string-built JPA/native queries

#### Detect — Good Pattern
- `PreparedStatement` with `?`; named JPA parameters

#### Remediation
Parameterize all dynamic SQL; validate/allow-list identifiers that can't be parameters.

---

### SHAFT-DATA-002: No NoSQL/JSON injection in MongoDB connector

- **Severity**: High
- **Description**: The MongoDB connector must build queries from typed filters, not from concatenated JSON/`$where` strings containing user input.

#### Detect — Bad Pattern
- `$where` clauses or `Document.parse("{...user input...}")`

#### Detect — Good Pattern
- `Filters.eq(...)` / typed query builders; no `$where`

#### Remediation
Use the typed query API; never interpolate input into query JSON.

---

## SAM (API Management) Rules

---

### SHAFT-SAM-001: Distributed APIs must enforce throttling & rate limits

- **Severity**: High
- **Description**: API Distribution advertises **Throttling** and **API statistics**. Externally exposed (B2B/B2C) APIs without per-partner rate limiting are a DoS and abuse vector.

#### Detect — Bad Pattern
- Externally distributed API/endpoint with no throttle/quota per partner/key

#### Detect — Good Pattern
- Per-partner throttle/quota enforced; 429 on breach; usage recorded for statistics

#### Remediation
Attach throttling policy to every distributed API; meter per partner key.

---

### SHAFT-SAM-002: API versioning and backward compatibility

- **Severity**: Medium
- **Description**: Distribution supports **Versioning**. Breaking changes to a published API must be a new version; existing partner integrations must not break.

#### Detect — Bad Pattern
- Field removed/renamed or auth changed on an existing version in place

#### Detect — Good Pattern
- New version introduced; old version deprecated with a window

#### Remediation
Version breaking changes; keep prior versions during a deprecation window.

---

### SHAFT-SAM-003: Query-to-API builder & aggregation must not over-expose data

- **Severity**: High
- **Description**: "Create APIs from DB in minutes" and "API Aggregation" can inadvertently expose whole tables or joined data without column/row filtering or authorization. Generated/aggregated APIs must apply field allow-lists and per-caller row filters.

#### Detect — Bad Pattern
- Auto-generated API returns `SELECT *` with no column allow-list or row scoping
- Aggregated API merges sources without re-checking authorization on each source

#### Detect — Good Pattern
- Column allow-list + row-level filter tied to the caller; per-source auth on aggregation

#### Remediation
Constrain generated APIs to allowed columns/rows; enforce authorization on every aggregated source.

---

### SHAFT-SAM-004: API logging must not persist secrets/PII in clear

- **Severity**: High
- **Description**: "API Logging" that records full request/response bodies can capture passwords, tokens, card data (PCI), and PII.

#### Detect — Bad Pattern
- Logging full headers/bodies including `Authorization`, card numbers, credentials

#### Detect — Good Pattern
- Redaction/masking of sensitive fields; structured, minimal logging

#### Remediation
Mask secrets/PII before logging; never log auth headers or payment data.

---

## MDM Rules

---

### SHAFT-MDM-001: File/Folder APIs must enforce ACL and access tokens

- **Severity**: Critical
- **Description**: MDM exposes file/folder CRUD and **export-URL APIs**; access is controlled by **ACLs** and **file access tokens**. Any File/Folder operation or export URL that skips the ACL/token check exposes master data (IDOR).

#### Detect — Bad Pattern
- File/folder CRUD, download, bulk-edit, or export-URL handlers that don't validate the caller against the file/group ACL or the assigned access token
- Predictable/guessable export URLs with no token

#### Detect — Good Pattern
- Every operation checks ACL (CRUD(File)/CRUD(Group)) and, for File APIs, the access token
- Export URLs are unguessable and token-gated

#### Remediation
Enforce ACL + access-token on every MDM operation and export URL; deny by default.

---

### SHAFT-MDM-002: CSV pre/post-processing must be injection-safe

- **Severity**: High
- **Description**: MDM runs custom business logic to pre-process CSV before upload and post-process after. Untrusted CSV can carry formula injection (`=`, `+`, `-`, `@` leading cells) and can be used to build SQL/commands downstream.

#### Detect — Bad Pattern
- CSV cell values passed into SQL/shell/query building unsanitized
- Exported CSV cells not neutralized against spreadsheet formula injection

#### Detect — Good Pattern
- Cells validated/typed on ingest; leading formula characters neutralized on export; no cell interpolated into SQL/commands

#### Remediation
Validate/type CSV on ingest; escape formula-triggering characters on export; parameterize any downstream query built from CSV.

---

### SHAFT-MDM-003: Export-URL filters must scope to the caller

- **Severity**: High
- **Description**: Export URLs apply OOTB or custom filters/rules to expose filtered data. Filters must be bound to the caller's entitlement, not merely the URL parameters, or a caller can widen the filter to read more than allowed.

#### Detect — Bad Pattern
- Filter derived solely from client-supplied params, no server-side entitlement filter

#### Detect — Good Pattern
- Server enforces an entitlement filter in addition to client filters

#### Remediation
Combine client filters with a mandatory server-side row/column entitlement filter.

---

### SHAFT-MDM-004: Triggers (Email/SMS/WhatsApp) must validate and rate-limit

- **Severity**: Medium
- **Description**: File triggers can fire Email/SMS/WhatsApp actions. Unvalidated trigger targets or unbounded triggers enable spam/abuse and message-cost blowouts, and template injection can leak data.

#### Detect — Bad Pattern
- Trigger sends to a recipient taken from the file with no validation/allow-list; no rate limit
- Message templates interpolate untrusted fields unescaped

#### Detect — Good Pattern
- Recipient validated/allow-listed; per-trigger rate limits; templates escape untrusted data

#### Remediation
Validate recipients; rate-limit triggers; escape template inputs.

---

## Sling / OSGi Hygiene Rules

---

### SHAFT-SLING-001: Close ResourceResolvers `[scanner: SLING-RES-001]`

- **Severity**: Medium
- **Description**: ResourceResolvers opened via `getServiceResourceResolver`/`loginService` must be closed (finally / try-with-resources) or the login pool exhausts under load.

#### Remediation
Use try-with-resources or close in `finally`.

---

### SHAFT-SLING-002: No administrative login; use scoped service users `[scanner: SLING-SEC-003]`

- **Severity**: High
- **Description**: `getAdministrativeResourceResolver`/`loginAdministrative` are deprecated and over-privileged. Use `getServiceResourceResolver` with a mapped service user (repoinit) holding least-privilege ACLs.

#### Remediation
Define a service user + mapping; grant only required paths; replace admin logins.

---

### SHAFT-SLING-003: Avoid deprecated Sling APIs `[scanner: SLING-API-001]`

- **Severity**: Medium
- **Description**: `org.apache.sling.commons.json` (and other removed APIs) block platform upgrades of the feature model.

#### Remediation
Migrate to Johnzon/Jakarta JSON-P or Jackson.

---

### SHAFT-SLING-004: Servlet registration by resourceType, not raw path

- **Severity**: Medium
- **Description**: Servlets registered on raw `sling.servlet.paths` bypass resource-type resolution and can escape the governed (filtered) tree. Prefer `sling.servlet.resourceTypes` + method/selector/extension.

#### Detect — Bad Pattern
- `@SlingServletPaths` / `sling.servlet.paths=/bin/...` for data endpoints

#### Detect — Good Pattern
- `@SlingServletResourceTypes` within the governed tree

#### Remediation
Register by resourceType; reserve path-bound servlets for infra endpoints that are themselves access-controlled.

---

## Reliability & Quality Rules

---

### SHAFT-QUAL-001: No empty/over-broad catch, no printStackTrace/System.out `[scanner: JAVA-QUAL-001..004]`

- **Severity**: Low–Medium
- **Description**: Empty catches hide connector/queue failures; broad `catch (Exception|Throwable)` masks bugs; `printStackTrace()`/`System.out` bypass the logging pipeline that Audit relies on.

#### Remediation
Catch specific exceptions; log via SLF4J with context; never swallow silently.

---

### SHAFT-QUAL-002: Message Queue producers/consumers must be resilient

- **Severity**: Medium
- **Description**: SHAFT uses a Message Queue for async egress to external systems. Consumers must be idempotent and handle poison messages (DLQ/retry with backoff); producers must not block the request thread indefinitely.

#### Detect — Bad Pattern
- Consumer with no retry/DLQ; non-idempotent processing; unbounded synchronous publish on the request path

#### Detect — Good Pattern
- Idempotent consumers; bounded retries + DLQ; async publish with timeouts

#### Remediation
Add idempotency keys, DLQ, bounded retry/backoff, and publish timeouts.

---

### SHAFT-PAY-001: Payment gateway integrations — verify webhooks & idempotency

- **Severity**: High
- **Description**: Razorpay/PayU/Cashfree/Pine Labs webhooks must be signature-verified, and payment operations must be idempotent to avoid double-charge/replay.

#### Detect — Bad Pattern
- Webhook handler that trusts the payload without HMAC/signature verification
- Payment capture without an idempotency key

#### Detect — Good Pattern
- Verify gateway signature; use idempotency keys; reconcile via server-to-server status

#### Remediation
Verify webhook signatures; enforce idempotency; never trust client-reported payment status.

---

## Notes for the auditor

- Treat SHAFT as **AEM-family Sling/OSGi** for baseline rules (resolver lifecycle, service users, servlet
  registration, deprecated APIs, OSGi config) and layer the **SHAFT-specific** SAM/MDM/connector rules on top.
- The Tier-1 scanner (`scripts/engines/sling/`) deterministically covers the `[scanner: …]`-tagged rules over
  the Java AST. Everything else here is **semantic** — verify by reading the filter chain wiring, MDM ACL/token
  enforcement, SAM throttling/versioning/aggregation, connector secret handling, and payment/webhook flows.
- Confirm with the team (pending): exact Sling/Felix/Oak versions, the feature-model/build layout, and whether
  SAM and MDM are separate bundles — these refine detection and rule scoping.
