# Sonar Rule Pack — Adobe Edge Delivery Services (EDS)

Language: JavaScript. Applies to: EDS (Franklin/Helix) projects — blocks, scripts, and styles.
Severity mapping and rating model: see `../../shared/severity-and-rating-model.md`.

---

## Bug (Reliability)

### S2259 — Unchecked DOM Query Results
**Severity:** HIGH | **ruleId:** `S2259`

`querySelector()` and `querySelectorAll()` return `null` / empty `NodeList` when the expected element is absent. Calling methods on null results causes uncaught TypeErrors that silently break blocks.

- ❌ Detect-Bad: `block.querySelector('.hero-image').src = src;` — null if `.hero-image` is absent
- ✅ Detect-Good: `const img = block.querySelector('.hero-image'); if (img) img.src = src;`
- **Remediation:** Add a null guard at line {line} before accessing properties of the query result.

### S2589 — Gratuitous Boolean Expressions
**Severity:** LOW | **ruleId:** `S2589`

Redundant type checks (`typeof x !== 'undefined'` when `x` is already known to be defined).

- **Remediation:** Simplify the condition at the identified line.

### S1854 — Dead Stores
**Severity:** LOW | **ruleId:** `S1854`

Variable assigned but overwritten before being read, typically in block `decorate()` refactors.

- **Remediation:** Remove the unused assignment at the identified line.

---

## Vulnerability (Security)

### S5131 — DOM XSS via innerHTML
**Severity:** CRITICAL | **ruleId:** `S5131`

Block decorator sets `innerHTML` from a CMS-authored string, sheet data, or query index response without sanitization. Content authors or a compromised SharePoint/Google Drive can inject scripts.

- ❌ Detect-Bad: `block.innerHTML = await fetchBlockContent(path);`
- ✅ Detect-Good: Parse the content as DOM using `DOMParser` and clone nodes, or sanitize: `block.innerHTML = DOMPurify.sanitize(await fetchBlockContent(path));`
- **Remediation:** Replace `innerHTML` assignment at line {line}: if the source is trusted CMS markup, use `block.insertAdjacentHTML('afterbegin', DOMPurify.sanitize(html))`. If the source is plain text, use `block.textContent = text` instead.

### S2068 — Hardcoded API Endpoints / Keys
**Severity:** HIGH | **ruleId:** `S2068`

Internal API URLs or bearer tokens hardcoded in block scripts rather than read from page metadata or a config sheet.

- ❌ Detect-Bad: `const DATA_URL = 'https://admin.adobe.com/internal/api?key=abc123';`
- ✅ Detect-Good: Read from page metadata: `const dataUrl = getMetadata('data-url');` or from a `?sheet=config` query.
- **Remediation:** Remove the hardcoded URL/key at line {line}. Use `getMetadata()` or a config sheet fetch. Document which metadata field or sheet column provides the value.

---

## Security Hotspot

### S4507 — Unvalidated Fetch from Dynamic URLs
**Severity:** MEDIUM | **ruleId:** `S4507`

Block fetches data from a URL constructed partially from user-visible inputs (URL params, hash fragments) without validation.

- **Review:** Confirm that the constructed URL is restricted to known origins (e.g. the same `window.location.origin` or an allowlist). Add an origin check before fetching.

---

## Code Smell (Maintainability)

### S3776 — Cognitive Complexity
**Severity:** MEDIUM | **ruleId:** `S3776`

Block `decorate()` function cognitive complexity exceeding 15. Common in hero, carousel, and product-listing blocks with multiple conditional rendering paths.

- **Remediation:** State function name, file:line, current complexity. Extract conditional rendering paths into named helper functions (e.g. `renderDesktop()`, `renderMobile()`, `handleLazyLoad()`).

### S1192 — Duplicated String Literals
**Severity:** LOW | **ruleId:** `S1192`

CSS class names or block variant strings repeated inline 5+ times.

- **Remediation:** Extract to a `const` at the top of the module.

### S1481 — Unused Local Variables
**Severity:** LOW | **ruleId:** `S1481`

Destructured block cell values that are never used in the `decorate()` function.

- **Remediation:** Remove the unused destructured variable at the identified line.

---

## Duplication

### S125 — Commented-out Code
**Severity:** LOW | **ruleId:** `S125`

Commented-out variant implementations or prototype block logic.

- **Remediation:** Delete the commented block at the identified line range. Preserve in git history if needed.

---

## Complexity

### S138 — Functions with Too Many Lines
**Severity:** MEDIUM | **ruleId:** `S138`

`decorate()` or `loadBlock()` functions exceeding 60 lines.

- **Remediation:** Extract DOM setup, data fetching, and event binding into separate named functions. Cite line ranges for each extraction.
