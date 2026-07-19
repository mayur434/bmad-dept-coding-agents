# Sonar Rule Pack — EDS + Commerce

Language: JavaScript. Applies to: EDS + Commerce hybrid projects (drop-in components, commerce-enabled blocks).
Severity mapping and rating model: see `../../shared/severity-and-rating-model.md`.

This rule pack extends the EDS rules. Apply all rules from `../eds/rules.md` first, then add the Commerce-specific rules below.

---

## Bug (Reliability)

### S2259 — Commerce API Null Guards
**Severity:** HIGH | **ruleId:** `S2259`

Commerce Catalog Service / dropin API responses may be `null` when the product is out of stock, the SKU is invalid, or the storefront is not provisioned.

- ❌ Detect-Bad: `const price = (await getProductData(sku)).prices.final.amount;` — null if product not found
- ✅ Detect-Good: `const data = await getProductData(sku); if (!data) return renderOutOfStock(); const price = data.prices?.final?.amount ?? 0;`
- **Remediation:** Add a null guard at line {line} after the await, before chaining into response fields. Use optional chaining for nested commerce API response structures.

### S2589 — Gratuitous Boolean Expressions
**Severity:** LOW | **ruleId:** `S2589`

Redundant `typeof === 'undefined'` checks on commerce SDK result fields that are typed.

- **Remediation:** Simplify the condition at the identified line.

---

## Vulnerability (Security)

### S5131 — DOM XSS via Commerce Product HTML
**Severity:** CRITICAL | **ruleId:** `S5131`

Commerce product `description_html` or `short_description` set via `innerHTML` without sanitization. A merchant or attacker with catalog access can inject scripts into the storefront.

- ❌ Detect-Bad: `descriptionEl.innerHTML = product.description_html;`
- ✅ Detect-Good: `descriptionEl.innerHTML = DOMPurify.sanitize(product.description_html, { USE_PROFILES: { html: true } });`
- **Remediation:** At line {line}: add `DOMPurify.sanitize()` wrapping the `description_html` value before assigning to `innerHTML`. If DOMPurify is not yet a dependency, add `"dompurify": "^3.0.0"` to `package.json`.

### S2068 — Hardcoded Commerce API Key
**Severity:** CRITICAL | **ruleId:** `S2068`

Adobe Commerce or Catalog Service API keys hardcoded in drop-in config or block scripts.

- ❌ Detect-Bad: `const STORE_VIEW_CODE = 'default'; const API_KEY = 'abc123def456';`
- ✅ Detect-Good: Read from page metadata or drop-in config injected at build time: `const { apiKey, storeViewCode } = window.__experienceConfiguration ?? {};`
- **Remediation:** Remove the literal at line {line}. Use `window.__experienceConfiguration` (provisioned by the Commerce SDK init script) or a page metadata field.

### S4502 — Cart Mutation with Unvalidated SKU
**Severity:** HIGH | **ruleId:** `S4502`

A cart add/update mutation uses a SKU value taken from URL params or DOM attributes without validation, allowing an attacker to inject arbitrary SKUs.

- ❌ Detect-Bad: `const sku = new URLSearchParams(location.search).get('sku'); await addToCart({ sku, quantity: 1 });`
- ✅ Detect-Good: Validate the SKU format before using: `const sku = new URLSearchParams(location.search).get('sku'); if (!sku || !/^[A-Za-z0-9_-]+$/.test(sku)) return; await addToCart({ sku, quantity: 1 });`
- **Remediation:** Add a SKU format validation regex at line {line} before the cart mutation call. Cite the specific regex pattern and where the input originates.

---

## Security Hotspot

### S4507 — Storefront Event PII
**Severity:** MEDIUM | **ruleId:** `S4507`

Commerce storefront events may inadvertently capture PII (email, phone, address) in checkout step tracking before explicit user consent.

- **Review:** Confirm consent gating is in place before any PII-containing event dispatches. Check event payload shape against the `@adobe/magento-storefront-event-collector` schema.

---

## Code Smell (Maintainability)

### S3776 — Cognitive Complexity
**Severity:** MEDIUM | **ruleId:** `S3776`

Drop-in component or commerce block `decorate()` / `render()` function cognitive complexity exceeding 15. Checkout flows with multi-step state are frequent offenders.

- **Remediation:** Extract step-specific logic (address validation, payment method selection, order confirmation) into separate functions. State method name, file:line, current complexity, and extracted function names.

### S1192 — Duplicated String Literals
**Severity:** LOW | **ruleId:** `S1192`

Commerce GraphQL field names, event type strings, or config keys repeated inline 5+ times.

- **Remediation:** Extract to a `const` or a shared `commerce-constants.js`.

### S1481 — Unused Variables
**Severity:** LOW | **ruleId:** `S1481`

Unused destructured commerce API response fields.

- **Remediation:** Remove the unused variable at the identified line.

---

## Duplication

### S125 — Commented-out Code
**Severity:** LOW | **ruleId:** `S125`

Commented-out legacy fetch-based commerce calls replaced by drop-in components.

- **Remediation:** Delete the commented block at the identified line range.

---

## Complexity

### S138 — Functions with Too Many Lines
**Severity:** MEDIUM | **ruleId:** `S138`

Commerce-enabled block `decorate()` function exceeding 60 lines due to combined rendering and commerce API orchestration.

- **Remediation:** Extract `fetchProductData()`, `renderProductUI()`, and `bindCartActions()` into separate async functions. Cite line ranges.
