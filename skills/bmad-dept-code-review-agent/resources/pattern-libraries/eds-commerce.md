# Design-pattern violation catalog — EDS + Commerce Hybrid

## Purpose framing

This catalog is the exhaustive companion to
`resources/review-templates/eds-commerce.md`'s short "Design-pattern
checks" section — canonical anti-patterns where EDS block conventions
meet Commerce drop-in integration, each with the fix and a worked
before/after. Code Review loads this file when `--artifacts
design-patterns` (or `all`) is requested against the `eds-commerce`
engine. Cross-reference `eds.md` and `commerce-saas.md` for the two
lenses this hybrid catalog combines.

## Anti-pattern catalog for EDS + Commerce

### 1. Drop-in block bypassing the storefront-events pub/sub pattern
- **What it looks like:** A block directly mutates another block's
  rendered DOM (e.g. writes a cart count into `mini-cart`'s markup)
  instead of emitting/listening for the established storefront custom
  event (`cart:updated` or equivalent).
- **Why it's a problem:** Creates tight coupling between blocks that
  should be independent; the direct-DOM path silently breaks the
  moment either block's internal markup changes.
- **Canonical fix:** Emit a custom event on state change; the
  consuming block listens and updates itself.
- **Severity if found:** HIGH.

### 2. Missing loading-state handling for async cart/catalog calls
- **What it looks like:** A commerce-aware block fires a Catalog
  Service/cart mutation call and renders the "after" state immediately,
  with no loading/pending UI while the call is in flight.
- **Why it's a problem:** Users see a flash of stale or empty state,
  or can double-trigger the action (double-add-to-cart) before the
  first call resolves.
- **Canonical fix:** Render a pending state and disable the trigger
  until the call resolves.
- **Severity if found:** MEDIUM.

### 3. Hardcoded Commerce SaaS endpoint instead of config-driven
- **What it looks like:** A block hardcodes a Catalog Service URL or
  store-view code instead of reading it from the shared commerce config
  module (same class of issue as `commerce-saas.md` #3, compounded
  because EDS ships to the edge/CDN by default).
- **Why it's a problem:** Breaks environment promotion, and because
  EDS content is edge-cached, a hardcoded prod endpoint can leak into a
  cached response served across environments.
- **Canonical fix:** Read exclusively from the shared commerce config
  module.
- **Severity if found:** HIGH.

### 4. Dropin used outside its documented API surface
- **What it looks like:** A block imports a dropin's internal
  module/component rather than its public prop/slot API.
- **Why it's a problem:** Breaks on the next dropin version bump —
  internals aren't a stable contract.
- **Canonical fix:** Use only the documented public API; request a new
  extension point upstream if the internal isn't exposed.
- **Severity if found:** HIGH.

### 5. No fallback UI for a Commerce Service failure
- **What it looks like:** A commerce-aware block fetches product/cart
  data with no error boundary — a Catalog Service outage breaks the
  whole page section instead of degrading gracefully.
- **Why it's a problem:** A downstream Commerce outage becomes a
  full-page outage for an EDS site that would otherwise still serve
  its static content fine.
- **Canonical fix:** Wrap the commerce call in a fallback/error state
  scoped to the block, matching `eds.md`'s missing-error-handling flag.
- **Severity if found:** HIGH.

### 6. Multiple GraphQL calls fired on page load that could be batched
- **What it looks like:** Several commerce-aware blocks on the same
  page each issue their own separate Catalog Service query instead of
  joining a shared page-level query/data-loader.
- **Why it's a problem:** Multiplies round-trips and Catalog Service
  load proportional to block count instead of page count.
- **Canonical fix:** Use a shared data-loader/page-level query that
  blocks subscribe to, batching requests.
- **Severity if found:** MEDIUM.

### 7. All dropins loaded eagerly regardless of page need
- **What it looks like:** A page template imports every available
  dropin unconditionally instead of only the ones actually rendered
  above-the-fold or on that template.
- **Why it's a problem:** Bloats bundle size and blocks paint budget
  for pages that never render most of the imported dropins.
- **Canonical fix:** Import dropins per-template/per-block, only where
  actually used.
- **Severity if found:** MEDIUM.

### 8. Product-price/business logic duplicated in a block
- **What it looks like:** A block computes its own price/discount
  display instead of using Commerce/Catalog Service's returned value
  and the shared price-formatting utility.
- **Why it's a problem:** Same drift risk as `commerce-saas.md` #6 —
  currency/locale/rounding rules diverge from the source of truth.
- **Canonical fix:** Render Commerce's returned value; format only via
  the shared formatter.
- **Severity if found:** MEDIUM.

## Refactoring priority for EDS + Commerce

- **Blocker:** No fallback for a Commerce Service failure on a
  checkout/cart-adjacent block, or a dropin used outside its
  documented API — both risk a full outage or a guaranteed break on
  the next version bump.
- **Follow-up:** Eager dropin loading on a low-traffic template,
  unbatched GraphQL calls on a page with only one commerce block —
  real but not urgent.

## Worked before/after examples for EDS + Commerce

**1. Direct cross-block coupling → event-driven pattern**
```js
// Before — blocks/cart-badge/cart-badge.js
import { getCartCount } from '../mini-cart/mini-cart.js';
export default function decorate(block) { block.textContent = getCartCount(); }
// After
export default function decorate(block) {
  block.textContent = window.commerceStore.cartCount;
  window.addEventListener('cart:updated', (e) => { block.textContent = e.detail.count; });
}
```
`cart-badge` no longer imports `mini-cart` internals — both blocks stay independently replaceable.

**2. Hardcoded endpoint → shared commerce config**
```js
// Before
list.setAttribute('catalog-url', 'https://prod.catalog.adobe.io/graphql');
// After
import { commerceConfig } from '../../scripts/commerce-config.js';
list.setAttribute('catalog-url', commerceConfig.catalogServiceUrl);
```
Works correctly across environments and avoids leaking a prod URL into an edge-cached response.

**3. No fallback → guarded render with fallback UI**
```js
// Before
const products = await fetchProducts();
render(products);
// After
try {
  const products = await fetchProducts();
  render(products);
} catch (e) {
  block.innerHTML = '<p class="product-list-error">Products unavailable right now.</p>';
}
```
A Catalog Service outage now degrades one block instead of the page section.

## Detection heuristics for EDS + Commerce

- One block's `.js` file importing a named export from another block's
  file path (`../<other-block>/`) — cross-block internal coupling.
- Commerce/cart mutation call (`addToCart`, `updateCart`, GraphQL
  mutation) with no accompanying disabled/pending state toggle nearby.
- String literal matching a Catalog Service/commerce host pattern
  inside a block file rather than an import from a config module.
- `import '@adobe/drop-in-*/internal` or a path reaching past the
  package's documented entry point.
- `await` on a commerce fetch/query with no `try`/`catch` in a block
  file (same heuristic as `eds.md`, applied to commerce calls
  specifically).
- 3+ blocks on the same page template each independently calling a
  Catalog Service client — batching candidate.
- A page template file importing more than the dropins it actually
  renders (cross-check against blocks present on that template).

## Anti-patterns in THIS catalog itself (meta)

A single commerce block calling its own Catalog Service query isn't a
batching violation when it's the only commerce block on the page —
the flag applies once multiple blocks are competing for overlapping
data, not to every standalone query.

Cross-reference `resources/review-templates/eds-commerce.md` for the
broader pre-merge review context. Reference this catalog when
`--artifacts design-patterns` is requested.
