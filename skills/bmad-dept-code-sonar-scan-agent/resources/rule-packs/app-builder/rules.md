# Sonar Rule Pack — Adobe App Builder

Language: JavaScript / Node.js. Applies to: Adobe App Builder (I/O Runtime actions, API Mesh, Commerce/AEM UI extensions).
Severity mapping and rating model: see `../../shared/severity-and-rating-model.md`.

---

## Bug (Reliability)

### S2259 — Unhandled Promise Rejection / Null Response
**Severity:** HIGH | **ruleId:** `S2259`

I/O Runtime action responses and API Mesh resolver results can be `null` or `undefined` when upstream services are unavailable. Unhandled rejections cause cold-start timeouts.

- ❌ Detect-Bad: `const response = await fetch(url); const data = await response.json();` — no status check before `.json()`
- ✅ Detect-Good: `const response = await fetch(url); if (!response.ok) throw new Error(\`Upstream ${response.status}\`); const data = await response.json();`
- **Remediation:** Add an `if (!response.ok)` guard at line {line} before calling `.json()` or `.text()`. Return a standardized App Builder error response: `{ error: { statusCode: 502, body: { error: 'Upstream failure' } } }`.

### S1854 — Dead Stores
**Severity:** LOW | **ruleId:** `S1854`

A variable is assigned inside an async function but the value is never `await`ed or returned.

- **Remediation:** Remove or use the assignment at the identified line.

---

## Vulnerability (Security)

### S5131 — Server-Side Request Forgery (SSRF) via User Input
**Severity:** CRITICAL | **ruleId:** `S5131`

A URL constructed from user-supplied input (request params, event payload fields) is fetched server-side without allowlist validation. In App Builder, this runs under a trusted Adobe IO token.

- ❌ Detect-Bad: `const result = await fetch(params.targetUrl);` — `targetUrl` from the action params
- ✅ Detect-Good: Validate against an allowlist: `const ALLOWED = ['https://api.commerce.adobe.io', 'https://events.adobe.io']; if (!ALLOWED.some(p => params.targetUrl.startsWith(p))) return { statusCode: 400, body: 'Disallowed URL' };`
- **Remediation:** Add allowlist validation at line {line} before the `fetch()` call. Cite the specific param name and allowlist values.

### S2068 — Hardcoded Adobe IO / Commerce Credentials
**Severity:** CRITICAL | **ruleId:** `S2068`

Adobe IO client secrets, Commerce admin tokens, or IMS access tokens appear as string literals in action source files rather than being read from `params.__ow_headers` or `process.env`.

- ❌ Detect-Bad: `const token = 'Bearer eyJhbGciOiJSUzI1NiJ9...';`
- ✅ Detect-Good: `const token = params.authorization || process.env.COMMERCE_ADMIN_TOKEN;`
- **Remediation:** Remove the literal at line {line}. Pass credentials via App Builder's encrypted params or read from `params` (set in `app.config.yaml` under `inputs`). Rotate any exposed credential immediately.

### S4502 — Injection via Unvalidated Event Payload
**Severity:** HIGH | **ruleId:** `S4502`

Adobe I/O Events payload fields used directly in downstream API calls or Commerce mutations without shape validation. An attacker who can craft I/O Events can inject arbitrary data.

- ❌ Detect-Bad: `await commerceClient.query(ORDER_MUTATION, { orderId: event.data.orderId });` — no schema validation on `event.data`
- ✅ Detect-Good: Validate the event payload shape (JSON Schema or Zod) before using fields in API calls.
- **Remediation:** Add payload validation at line {line}. Cite the specific field (`event.data.orderId`) and the validation rule (must be a numeric string matching `/^\d+$/`).

---

## Security Hotspot

### S4507 — Unrestricted Action Access
**Severity:** MEDIUM | **ruleId:** `S4507`

An App Builder action configured with `require-adobe-auth: false` in `app.config.yaml` is accessible without an IMS token, potentially exposing internal data or triggers.

- **Review:** Confirm that public-facing actions (`require-adobe-auth: false`) perform their own input validation and do not expose privileged operations. Consider adding IP allowlisting via CDN rules.

---

## Code Smell (Maintainability)

### S3776 — Cognitive Complexity
**Severity:** MEDIUM | **ruleId:** `S3776`

Action handler function cognitive complexity exceeding 15. Common in multi-step orchestration actions that fan out to Commerce API + AEM API.

- **Remediation:** Split the action into sub-functions (e.g. `fetchCommerceData()`, `transformPayload()`, `callAemApi()`). Cite function name, file:line, current complexity, and new function names.

### S1192 — Duplicated String Literals
**Severity:** LOW | **ruleId:** `S1192`

GraphQL query strings, Adobe API endpoint URLs, or event type strings repeated inline 5+ times.

- **Remediation:** Extract to a `const` in a shared `constants.js` or `endpoints.js` module.

### S1481 — Unused Variables
**Severity:** LOW | **ruleId:** `S1481`

Destructured action params or imported functions that are never used in the action body.

- **Remediation:** Remove the unused variable or import at the identified line.

---

## Duplication

### S125 — Commented-out Code
**Severity:** LOW | **ruleId:** `S125`

Large blocks of commented-out action logic from previous iterations.

- **Remediation:** Delete the commented block at the identified line range.

---

## Complexity

### S138 — Action Functions with Too Many Lines
**Severity:** MEDIUM | **ruleId:** `S138`

App Builder action `main()` or handler function exceeding 60 lines, mixing input parsing, business logic, and response formatting.

- **Remediation:** Extract `parseInput()`, `execute()`, and `formatResponse()` as separate async functions. Cite line ranges for each extraction.
