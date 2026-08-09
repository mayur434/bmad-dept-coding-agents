# Pre-merge review guide — EDS + Commerce Hybrid

## What pre-merge review catches (vs Audit's deep scan)

EDS + Commerce hybrid diffs combine EDS block conventions with Commerce
drop-in integration — the failure modes compound: a block that also
talks to Catalog Service, a drop-in loaded eagerly on every page. Pre-
merge review flags what's visible: a dropin misused outside its
supported API, a hardcoded Commerce endpoint, a missing fallback when
Commerce is unavailable. Audit's `eds-commerce` rule pack (`EDSC-*`)
runs the same checks exhaustively, plus GraphQL-call-volume and
PCI-scope analysis that benefits from full-repo context.

## Common pre-merge red flags for EDS + Commerce

1. **Dropin component used outside its documented API surface** — the
   diff imports internals or reaches into the dropin's implementation
   rather than its public props/slots. Breaks on the next dropin
   version bump. Fix: use the supported integration API only.
2. **New commerce-aware block with no Commerce Context Provider**
   wrapping it — the block assumes commerce context (cart, customer,
   store) is available without confirming a provider is in the tree.
   Fix: wrap with the context provider or guard for its absence.
3. **Commerce endpoint hardcoded in a block** (Catalog Service URL,
   store view code) instead of read from the shared commerce config.
   Fix: externalize via the existing commerce config module.
4. **No fallback UI for a Commerce failure.** New block fetches product/
   cart data with no error boundary/fallback — a Commerce Service outage
   breaks the whole page instead of degrading gracefully.
5. **Multiple GraphQL calls fired on page load that could be batched
   into one query.** New block issues its own separate Catalog Service
   query instead of joining an existing page-level query or using a
   shared data-loader.
6. **Product data fetched fresh on every render with no caching** — a
   new block re-queries Catalog Service on each interaction instead of
   caching the response for the page lifecycle.
7. **All dropins loaded eagerly** instead of the ones actually needed
   above-the-fold — new page template imports every dropin unconditionally.
8. **Admin/commerce token or credential exposed in client-reachable
   code** — same class of issue as `commerce-saas`, compounded because
   EDS ships everything to the edge/CDN by default.
9. **Cart token used without validation** before trusting cart-mutation
   calls — session/cart hijack risk.
10. **Payment-adjacent data logged or stored client-side** — PCI scope
    creep; even debug `console.log` of a payment response object is a
    flag.
11. **New commerce block missing the event-driven integration pattern**
    — directly calling another block's internals instead of emitting/
    listening for the established custom event.
12. **Inconsistent price formatting** introduced by a new block that
    formats currency itself instead of using the shared price-formatting
    utility — locale/currency-symbol drift from the rest of the site.

## Style-guide highlights for EDS + Commerce

- Commerce config (endpoints, store view, environment) centralized in
  one module, imported by blocks — never duplicated per-block.
- Dropins consumed via their public API only; customization through the
  supported slot/prop mechanism, matching the `commerce-saas` guidance.
- Price/currency formatting always goes through the shared formatter
  utility.
- New commerce-aware blocks follow the same `decorate()`-scoped DOM
  discipline as plain EDS blocks (see `eds.md`).

## Breaking-change signals for EDS + Commerce

- A dropin's public prop/slot API changed (inherited breaking-change
  risk from `commerce-saas` — flag the same way).
- A commerce custom event's name or payload shape changed — breaks any
  other block listening for it.
- A Commerce Context Provider's exposed shape (cart, customer, store)
  changed — breaks every consuming block at once.
- A GraphQL query/fragment shared across multiple blocks changed its
  field set.
- A block config attribute that gates commerce behavior renamed
  (`data-catalog-source` → `data-source`, for example).

## Dependency-change signals for EDS + Commerce

Watch `package.json` for both EDS build tooling and `@adobe/drop-in-*` /
commerce SDK packages. A risky bump: a major-version jump on any
`@adobe/drop-in-*` package (breaking prop/slot changes, same as
`commerce-saas`), or a Catalog Service client library bump that changes
default query batching/caching behavior.

## Design-pattern checks for EDS + Commerce

- Direct cross-block internal calls instead of the event-driven
  communication pattern (`EDSC-INT-001`) — creates tight coupling
  between blocks that should be independent.
- Product-price/business logic duplicated in a block instead of
  delegated to Commerce/Catalog Service as the source of truth.
- A new block reimplementing dropin functionality instead of composing
  the existing dropin.

Cross-ref `resources/pattern-libraries/eds-commerce.md` (forthcoming)
for the full anti-pattern catalog.

## Pre-merge checklist items specific to EDS + Commerce

- [ ] Dropins used only via their supported API.
- [ ] New commerce blocks have a fallback for Commerce Service failure.
- [ ] GraphQL calls on the page batched/deduplicated where reasonable.
- [ ] Dropins loaded only where needed, not eagerly on every page.
- [ ] No cart/commerce tokens trusted without validation.
- [ ] No payment-adjacent data logged client-side.
- [ ] Price formatting goes through the shared formatter.

## 2 worked review examples for EDS + Commerce

**Example 1 — eager dropin load + no fallback.**
```js
// blocks/product-list/product-list.js (new file)
import '@adobe/drop-in-product-list';

export default function decorate(block) {
  const list = document.createElement('drop-in-product-list');
  list.setAttribute('catalog-url', 'https://prod.catalog.adobe.io/graphql');
  block.append(list);
}
```
Review comments:
- 🟠 HIGH — `catalog-url` hardcoded to prod — externalize via the
  shared commerce config so this works across environments.
- 🟡 MEDIUM — no fallback/error state if the dropin's underlying
  Catalog Service call fails — the block will show nothing (or a
  dropin-internal error) with no page-level graceful degradation.
- ⚪ INFO — confirm this dropin is only imported on templates that
  actually render a product list, not globally, to avoid loading it on
  every page.

**Example 2 — cross-block internal coupling instead of events.**
```js
// blocks/cart-badge/cart-badge.js
import { getCartCount } from '../mini-cart/mini-cart.js';

export default function decorate(block) {
  block.textContent = getCartCount();
}
```
Review comments:
- 🟠 HIGH — `cart-badge` imports an internal function from
  `mini-cart` directly — this couples two blocks that should communicate
  via the established cart-updated custom event instead. Emit/listen
  for `cart:updated` rather than importing across block boundaries.
- 🔵 LOW — `block.textContent = getCartCount()` sets a static value with
  no update path if the cart changes after initial render — confirm an
  event listener updates this later.

## Anti-patterns to avoid IN THE REVIEW ITSELF

- Don't block a dropin integration PR on styling customization that
  correctly uses the supported override mechanism.
- Don't demand query-batching for a page with only one commerce block —
  batching only matters once multiple blocks are competing for the same
  data.
- Don't flag every `console.log` as a PCI issue — only ones that could
  plausibly include payment/cardholder-adjacent fields.

Generate the full review using `templates/review-comment.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
