# Design-pattern violation catalog — Edge Delivery Services (EDS)

## Purpose framing

This catalog is the exhaustive companion to
`resources/review-templates/eds.md`'s short "Design-pattern checks"
section — canonical block-authoring anti-patterns a senior developer
would flag reading a diff, each with the fix and a worked before/after.
Code Review loads this file when `--artifacts design-patterns` (or
`all`) is requested against the `eds` engine.

## Anti-pattern catalog for EDS

### 1. Block doing DOM work outside `decorate()`
- **What it looks like:** Module-scope code that queries/mutates the
  DOM at import time, before the exported `decorate(block)` function
  ever runs.
- **Why it's a problem:** Runs before the block may even exist in the
  DOM, breaks the lazy-loading contract, and can execute for blocks
  never actually rendered on the page.
- **Canonical fix:** Move all DOM work inside `decorate(block)`; module
  scope should only define functions/constants.
- **Severity if found:** HIGH.

### 2. Missing lazy-load pattern for below-fold content
- **What it looks like:** A new block loads images/scripts eagerly
  with no `loading="lazy"` (or deferred script load) despite typically
  rendering below the fold.
- **Why it's a problem:** Directly regresses LCP/CLS budgets for pages
  where the block isn't the hero content.
- **Canonical fix:** `loading="lazy"` on below-fold images; defer
  non-critical script execution until the block is in/near viewport.
- **Severity if found:** MEDIUM.

### 3. Direct fetch() without error handling in blocks
- **What it looks like:** `fetch(url).then(r => r.json()).then(render)`
  with no `.catch`/error path.
- **Why it's a problem:** An unhandled rejection breaks the block
  silently (or throws to console) with no user-facing fallback.
- **Canonical fix:** Catch the rejection, render a fallback state, and
  log for diagnostics.
- **Severity if found:** MEDIUM.

### 4. Block tightly coupled to a specific page's DOM structure
- **What it looks like:** Block JS reaches outside its own root
  (`block.parentElement.parentElement...`) to read/mutate sibling
  sections, assuming a specific page layout.
- **Why it's a problem:** Breaks the moment the block is placed on a
  differently-structured page or reordered within the same page; not
  actually reusable despite living in `/blocks`.
- **Canonical fix:** Confine all reads/writes to the block's own
  subtree; use a custom event if cross-block communication is genuinely
  needed.
- **Severity if found:** MEDIUM.

### 5. CSS with overly broad selectors leaking outside block scope
- **What it looks like:** A block's CSS file uses an unscoped selector
  (`h2 { ... }`, `.button { ... }`) instead of scoping under the
  block's own class (`.promo h2`).
- **Why it's a problem:** Silently restyles unrelated content anywhere
  else on the page that happens to share the tag/class name.
- **Canonical fix:** Scope every selector under the block's root class.
- **Severity if found:** MEDIUM.

### 6. New block duplicating an existing shared block's logic
- **What it looks like:** A new carousel/accordion/tab block
  reimplements behavior an existing block in `/blocks` already provides,
  instead of reusing or extending it.
- **Why it's a problem:** Two implementations now drift — a bugfix or
  a11y improvement applied to one is silently missing from the other.
- **Canonical fix:** Extend/compose the existing block; only add a new
  one when the behavior is genuinely distinct.
- **Severity if found:** LOW.

### 7. Business logic mixed into the render path
- **What it looks like:** Data fetching and transformation (parsing,
  filtering, sorting) happen inline inside `decorate()` interleaved
  with DOM-building calls, instead of separated into a testable helper.
- **Why it's a problem:** Can't unit-test the transformation without a
  DOM environment; a rendering tweak risks the data logic and vice
  versa.
- **Canonical fix:** Extract fetch/transform into a plain function;
  `decorate()` calls it and only handles DOM assembly.
- **Severity if found:** LOW.

### 8. Global namespace pollution
- **What it looks like:** A new variable/function attached directly to
  `window` instead of staying module-scoped.
- **Why it's a problem:** Collision risk with other blocks/third-party
  scripts sharing the same global namespace; hard to trace ownership.
- **Canonical fix:** Keep everything module-scoped; export only through
  the block's standard `decorate` entry point.
- **Severity if found:** LOW.

## Refactoring priority for EDS

- **Blocker:** DOM work at module scope on a block that ships to
  every page using it (breaks the lazy-load contract broadly), or an
  unscoped CSS selector that visibly bleeds into unrelated content.
- **Follow-up:** Missing lazy-load on a low-traffic block, minor
  render-path/logic mixing — real but not urgent.

## Worked before/after examples for EDS

**1. Module-scope DOM work → inside `decorate()`**
```js
// Before
const banner = document.querySelector('.promo-banner');
banner.innerHTML = getPromoText();
export default function decorate(block) { block.classList.add('promo-block'); }
// After
export default function decorate(block) {
  const banner = block.querySelector('.promo-banner');
  banner.textContent = getPromoText();
}
```
DOM work now runs only when the block actually decorates, scoped to its own subtree.

**2. Unscoped CSS → block-scoped selector**
```css
/* Before */
h2 { margin-bottom: 0; }
/* After */
.promo h2 { margin-bottom: 0; }
```
No longer restyles every `h2` on the page.

**3. Inline fetch + transform → extracted helper**
```js
// Before
export default async function decorate(block) {
  const res = await fetch('/data.json');
  const items = (await res.json()).data.filter(i => i.active).sort((a,b)=>a.rank-b.rank);
  items.forEach(i => block.append(renderItem(i)));
}
// After
async function loadActiveItems() {
  const res = await fetch('/data.json');
  return (await res.json()).data.filter(i => i.active).sort((a,b)=>a.rank-b.rank);
}
export default async function decorate(block) {
  const items = await loadActiveItems();
  items.forEach(i => block.append(renderItem(i)));
}
```
`loadActiveItems()` is now unit-testable without a DOM.

## Detection heuristics for EDS

- Top-level (non-function-scoped) statements in a block `.js` file
  that call `document.querySelector`/`fetch`/DOM mutation methods
  before the `export default function decorate` line.
- `<img` element added in block code with no `loading=` attribute.
- `fetch(` call in a block file with no adjacent `.catch`/`try`.
- Grep `block.parentElement.parentElement` or similar multi-hop
  ancestor traversal.
- CSS rule with a bare tag or generic class selector (`h1`, `h2`,
  `.button`, `.title`) not prefixed by the block's own class.
- `window.` assignment inside a block `.js` file.
- `decorate()` function body mixing `fetch`/`.filter`/`.sort` calls
  directly with `document.createElement`/`append` calls in the same
  statements.

## Anti-patterns in THIS catalog itself (meta)

Don't demand extraction of a two-line inline filter into its own
function purely on principle — the transformation-in-render-path flag
is for logic complex enough to warrant its own test, not any use of
`.filter()` inside `decorate()`.

Cross-reference `resources/review-templates/eds.md` for the broader
pre-merge review context. Reference this catalog when `--artifacts
design-patterns` is requested.
