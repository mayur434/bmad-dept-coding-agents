# Sonar Rule Pack — Adobe Commerce SaaS

Language: JavaScript. Applies to: Adobe Commerce SaaS projects (Catalog Service, Live Search, storefront drop-ins).
Severity mapping and rating model: see `../../shared/severity-and-rating-model.md`.

---

## Bug (Reliability)

### S2259 — Unchecked Null / Undefined
**Severity:** HIGH | **ruleId:** `S2259`

Commerce API responses and dropin props can be `null` or `undefined` when the commerce backend is unavailable or the product is not found. Chained property access without optional chaining causes runtime exceptions.

- ❌ Detect-Bad: `const price = product.priceRange.minimum.finalPrice.amount.value;`
- ✅ Detect-Good: `const price = product?.priceRange?.minimum?.finalPrice?.amount?.value ?? 0;`
- **Remediation:** Replace the property chain at line {line} with optional chaining (`?.`) and a nullish coalescing default (`?? 0` or `?? ''`).

### S2589 — Gratuitous Boolean Expressions
**Severity:** LOW | **ruleId:** `S2589`

A boolean comparison is always true or always false due to the type or value already being known at that point.

- ❌ Detect-Bad: `if (typeof items !== 'undefined' && items !== undefined)` — redundant double-check
- ✅ Detect-Good: `if (items != null)`
- **Remediation:** Simplify the condition at the identified line to the minimal non-redundant check.

---

## Vulnerability (Security)

### S5131 — DOM XSS via innerHTML
**Severity:** CRITICAL | **ruleId:** `S5131`

User-supplied or commerce-API-returned content (e.g. product HTML descriptions) set via `innerHTML` without sanitization allows script injection.

- ❌ Detect-Bad: `container.innerHTML = product.description;`
- ✅ Detect-Good: `container.textContent = product.description;` (for plain text) or use DOMPurify: `container.innerHTML = DOMPurify.sanitize(product.description);`
- **Remediation:** Replace `innerHTML` at line {line} with `textContent` for plain text, or add `DOMPurify.sanitize()` before assigning to `innerHTML` for rich HTML descriptions.

### S2068 — Hardcoded API Keys / Tokens
**Severity:** CRITICAL | **ruleId:** `S2068`

Commerce API keys, Adobe IMS client IDs, or bearer tokens appear as string literals in JavaScript source files.

- ❌ Detect-Bad: `const apiKey = 'eyJhbGciOiJSUzI1...';` or `const CLIENT_ID = 'my-commerce-client-id';`
- ✅ Detect-Good: Read from commerce dropin config: `const { config } = await getProductsByIds([sku]);` where credentials are injected via `@adobe/commerce-events-sdk`.
- **Remediation:** Remove the literal at line {line}. Use the commerce SDK's built-in config/auth mechanism or environment variables injected at build time via `process.env.COMMERCE_API_KEY`.

### S4502 — Prototype Pollution via Object.assign
**Severity:** HIGH | **ruleId:** `S4502`

User-supplied JSON (from URL params or API responses) merged into an object via `Object.assign` or spread without validation can pollute the prototype chain.

- ❌ Detect-Bad: `const config = Object.assign({}, defaultConfig, JSON.parse(userInput));`
- ✅ Detect-Good: Validate `userInput` shape with a schema validator before merging, or use `Object.create(null)` for the target.
- **Remediation:** Add input validation at line {line} before the `Object.assign`. Cite the specific user-controlled parameter.

---

## Security Hotspot

### S4507 — Analytics Data Exposure
**Severity:** LOW | **ruleId:** `S4507`

Commerce Storefront Events may inadvertently capture PII (email addresses, shipping addresses) in event payloads before consent is given.

- **Review:** Confirm that `@adobe/magento-storefront-event-collector` event payloads are filtered to exclude PII before dispatch, or that consent gating is in place via `dataLayer.consent`.

---

## Code Smell (Maintainability)

### S3776 — Cognitive Complexity
**Severity:** MEDIUM | **ruleId:** `S3776`

JavaScript function cognitive complexity exceeding 15. Common in cart state reducers and multi-step checkout flows.

- **Remediation:** State function name, file:line, current complexity. Extract nested condition blocks into named helper functions.

### S1192 — Duplicated String Literals
**Severity:** LOW | **ruleId:** `S1192`

Commerce event names, config keys, or GraphQL query fragments repeated inline 5+ times.

- **Remediation:** Extract to a `const` at the module level or to a shared `constants.js`.

### S1481 — Unused Local Variables
**Severity:** LOW | **ruleId:** `S1481`

Variables declared but never read in a function body.

- ❌ Detect-Bad: `const { items, total, unused } = cartData;` — `unused` never referenced
- ✅ Detect-Good: Destructure only what is needed or prefix with `_` to indicate intentional discard.
- **Remediation:** Remove the unused destructured variable at the identified line.

---

## Duplication

### S125 — Commented-out Code
**Severity:** LOW | **ruleId:** `S125`

Large blocks of commented-out code — typically old fetch logic or prototype iterations — clutter the module and confuse reviewers.

- **Remediation:** Delete the commented block at the identified line range. If the code is needed for reference, preserve it in git history rather than as inline comments.

---

## Complexity

### S138 — Functions with Too Many Lines
**Severity:** MEDIUM | **ruleId:** `S138`

JavaScript functions exceeding 60 lines (tighter threshold for JS than Java). Common in monolithic dropin render functions.

- **Remediation:** Split the render function into sub-renders (e.g. `renderHeader()`, `renderProductList()`, `renderFooter()`). Cite line ranges for each extracted function.
