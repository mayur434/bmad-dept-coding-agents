# Design-pattern violation catalog — Adobe Commerce SaaS

## Purpose framing

This catalog is the exhaustive companion to
`resources/review-templates/commerce-saas.md`'s short "Design-pattern
checks" section — canonical storefront/drop-in integration anti-patterns
a senior developer would flag reading a diff, each with the fix and a
worked before/after. Code Review loads this file when `--artifacts
design-patterns` (or `all`) is requested against the `commerce-saas`
engine.

## Anti-pattern catalog for Commerce SaaS

### 1. Drop-in direct DOM manipulation outside its render cycle
- **What it looks like:** Code queries a drop-in's rendered output with
  `querySelector` and mutates it directly (`.style`, `.innerHTML`,
  attribute writes) after mount, instead of using the drop-in's
  documented prop/slot/config API.
- **Why it's a problem:** The drop-in owns its own re-render cycle; a
  direct DOM patch is silently reverted on the next internal re-render,
  and the mutation is invisible to the drop-in's own state management.
- **Canonical fix:** Use the documented slot/prop/config override; if
  the needed customization point doesn't exist, request it upstream
  rather than patching the DOM.
- **Severity if found:** MEDIUM.

### 2. Missing error boundary around Catalog Service calls
- **What it looks like:** A component calls the Catalog Service
  GraphQL client with no `try/catch`/error-boundary wrapper — an
  unhandled promise rejection or thrown error propagates unguarded.
- **Why it's a problem:** A single Catalog Service hiccup takes down
  the whole page/component tree instead of degrading one widget.
- **Canonical fix:** Wrap the call in an error boundary (or
  try/catch + fallback UI) scoped to the component, not the page.
- **Severity if found:** HIGH.

### 3. Hardcoded storefront config instead of the config service
- **What it looks like:** A literal Catalog Service URL, environment
  ID, or store-view code embedded in component code instead of read
  from the centralized commerce config module.
- **Why it's a problem:** Breaks promotion between environments
  (staging build silently hits prod data) and scatters the same value
  across files that now must be updated in lockstep.
- **Canonical fix:** Read exclusively from the shared config module;
  never a per-file literal.
- **Severity if found:** HIGH.

### 4. Duplicating Commerce SaaS SDK logic instead of extending it
- **What it looks like:** A hand-rolled reimplementation of something
  the `@adobe/magento-storefront-events-sdk` (or an equivalent SDK
  module) already provides — a custom event-collector, a custom
  IMS-token cache, a custom GraphQL client wrapper.
- **Why it's a problem:** Diverges from the SDK's behavior over time
  (different retry/cache semantics), doubles the surface that needs
  security/perf review, and loses SDK updates automatically.
- **Canonical fix:** Extend/configure the SDK's supported extension
  points; only hand-roll when the SDK genuinely has no equivalent.
- **Severity if found:** MEDIUM.

### 5. Vendored drop-in source edited in place
- **What it looks like:** A diff touching a file under
  `node_modules/@adobe/drop-in-*` directly instead of using the slot/
  override API.
- **Why it's a problem:** Lost on the next `npm install`/drop-in
  version bump; the single most common SaaS anti-pattern.
- **Canonical fix:** Use the documented `className`/slot/prop override
  mechanism from application code, never the vendored source.
- **Severity if found:** CRITICAL (guaranteed to regress silently on
  the next dependency update).

### 6. Business/pricing logic duplicated client-side
- **What it looks like:** A component computes a discount, tax
  estimate, or price display rule itself instead of trusting the value
  Catalog Service/Commerce already returned.
- **Why it's a problem:** Two sources of truth drift apart (rounding,
  promotion rules, currency handling) and the client-side copy misses
  server-side business-rule changes.
- **Canonical fix:** Render the value Commerce/Catalog Service returns;
  only format/display client-side, never recompute.
- **Severity if found:** MEDIUM.

### 7. Direct fetch calls scattered across components
- **What it looks like:** Multiple components each call
  `fetch(commerceEndpoint, ...)` independently instead of going through
  a single API-client module with shared auth/error/retry handling.
- **Why it's a problem:** Inconsistent error handling and auth-header
  logic across the codebase; a single endpoint change requires
  hunting every call site.
- **Canonical fix:** Centralize in one API-client module; components
  call the client, not `fetch` directly.
- **Severity if found:** MEDIUM.

### 8. IMS token handling with no cache/refresh discipline
- **What it looks like:** A new integration re-fetches an IMS token on
  every request instead of caching it until near-expiry.
- **Why it's a problem:** Unnecessary auth-service load and added
  per-request latency; at scale, risks rate-limiting on the token
  endpoint.
- **Canonical fix:** Cache the token with a near-expiry refresh window,
  ideally via the SDK's own token-cache utility.
- **Severity if found:** MEDIUM.

## Refactoring priority for Commerce SaaS

- **Blocker:** Editing vendored drop-in source directly (guaranteed
  silent regression), or a missing error boundary around a
  checkout-path Catalog Service call.
- **Follow-up:** Scattered `fetch()` calls, IMS token caching gaps on
  low-traffic integrations — real but not urgent; file and defer.

## Worked before/after examples for Commerce SaaS

**1. Vendored drop-in edit → override API**
```diff
- --- a/node_modules/@adobe/drop-in-cart/src/Cart.jsx
- +  return <div className="cart cart--custom">{items}</div>;
+ // application code
+ <DropInCart className="cart--custom" />
```
The customization now survives a drop-in version bump instead of being wiped by `npm install`.

**2. Hardcoded endpoint → config module**
```js
// Before
const CATALOG_URL = "https://prod-catalog.adobe.io/graphql";
// After
import { commerceConfig } from '../config/commerce.js';
const CATALOG_URL = commerceConfig.catalogServiceUrl;
```
Same code now works correctly across staging/prod without a code change.

**3. Missing error boundary → guarded fetch**
```js
// Before
const products = await catalogClient.query(PRODUCT_LIST_QUERY);
render(products);
// After
try {
  const products = await catalogClient.query(PRODUCT_LIST_QUERY);
  render(products);
} catch (e) {
  renderFallback();
  logger.warn('catalog query failed', e);
}
```
A Catalog Service outage now degrades one widget instead of crashing the page.

## Detection heuristics for Commerce SaaS

- Grep for `node_modules/@adobe/drop-in-` in the diff's file paths —
  any match is an automatic CRITICAL.
- `querySelector`/`querySelectorAll` immediately followed by a DOM
  mutation, targeting an element inside a known drop-in's rendered
  markup.
- `await` on a Catalog Service/GraphQL client call with no enclosing
  `try`/`catch` in the same function.
- String literal matching a URL pattern (`https://...adobe.io/...` or
  similar) anywhere outside the config module.
- Repeated `fetch(` calls to the same host across 3+ different
  component files — centralization candidate.
- Arithmetic on a `price`/`discount`/`tax` field inside a component
  file rather than a shared formatter/utility.

## Anti-patterns in THIS catalog itself (meta)

Not every direct DOM read is a violation — inspecting a drop-in's
rendered output for a test assertion is fine; the flag is for
*mutating* it outside the supported API. Judge intent, not just the
selector call.

Cross-reference `resources/review-templates/commerce-saas.md` for the
broader pre-merge review context. Reference this catalog when
`--artifacts design-patterns` is requested.
