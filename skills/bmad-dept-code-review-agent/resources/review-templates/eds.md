# Pre-merge review guide — Edge Delivery Services (EDS)

## What pre-merge review catches (vs Audit's deep scan)

EDS diffs are almost always a new or changed block — small, self-
contained JS/CSS files. Pre-merge review flags what's visible: a block
missing its lazy-load wiring, DOM work happening outside `decorate()`,
`innerHTML` used with unsanitized content. Audit's `eds` rule pack
(`EDS-ARCH-*`, `EDS-PERF-*`, `EDS-SEC-*`) runs the same checks
exhaustively across every block in `/blocks`, plus Core Web Vitals
budget checks that need real (or synthetic) page-load data a diff alone
can't provide.

## Common pre-merge red flags for EDS

1. **New block does DOM work at module scope, outside `decorate()`.**
   Diff adds code that runs at import time instead of inside the
   exported `decorate(block)` function. Breaks the lazy-loading
   contract and can run before the block is even in the viewport. Fix:
   move all DOM manipulation inside `decorate()`.
2. **New block missing the eager/lazy loading strategy entirely** — no
   `loading="lazy"` on below-the-fold images, no deferred script load
   for non-critical block behavior. LCP/CLS regression.
3. **`innerHTML` assigned with unsanitized, request- or
   content-derived data.** XSS risk. Fix: use `textContent` for plain
   text, or sanitize before assigning `innerHTML`.
4. **Inline event handler added to markup** (`onclick="..."` in a
   template string) instead of `addEventListener` in `decorate()`. CSP
   violation risk and harder to test.
5. **New block variant implemented via string-matching the block's
   class list ad hoc** instead of the established variant pattern
   (`block.classList.contains('variant-name')` checked consistently
   with how other blocks declare variants).
6. **New third-party script added render-blocking** (no `async`/
   `defer`, placed to load before first paint) — render-blocking
   third-party regression.
7. **New/changed image without explicit `width`/`height`** (or
   equivalent aspect-ratio reservation) — CLS risk from layout shift
   when the image loads.
8. **New block fetches data with no error handling** — an unhandled
   `fetch()` rejection breaks the block silently or throws to the
   console with no user-facing fallback.
9. **New global variable/function added to `window`** instead of
   module-scoped — global namespace pollution, collision risk with
   other blocks.
10. **New interactive element missing accessibility attributes** (no
    `aria-label` on an icon-only button, no `role` on a custom
    widget) — a11y regression.
11. **Metadata block changes that drop required SEO fields** (title,
    description) for a page template.
12. **Heading hierarchy broken in new block markup** (e.g. jumping from
    `h2` to `h4`, or multiple `h1`s introduced on a page template).

## Style-guide highlights for EDS

- Block JS exports a single `decorate(block)` function; no side effects
  at module load time.
- CSS scoped to the block's class name — no bleeding selectors that
  affect other blocks/global page styles.
- Block folder structure matches the established convention
  (`blocks/<name>/<name>.js`, `blocks/<name>/<name>.css`).
- Fetches use the project's existing helper (if one exists) rather than
  a one-off `fetch()` call with duplicated error handling.

## Breaking-change signals for EDS

- A block's config attribute (data attribute read from authored
  content, e.g. `data-variant`) renamed — orphans existing authored
  content using the old attribute name.
- A block's exported `decorate` function signature changed in a way
  that affects how `scripts.js`/`aem.js` invokes it.
- A shared utility function's signature changed while multiple blocks
  still call it with the old signature.
- `redirects.xlsx`-driven redirect behavior changed unexpectedly by a
  diff touching redirect-handling code.
- A metadata block's expected field names changed — breaks page
  templates authored against the old field names.

## Dependency-change signals for EDS

Watch `package.json` (build tooling) and any bundled third-party script
references in block code. A risky bump: a major-version jump on a
bundled charting/carousel/video-embed library used inside a block
(check its own breaking-change notes and the resulting bundle-size
delta), or a new third-party script tag added to a block that will load
on every page using that block (CSP and performance-budget impact).

## Design-pattern checks for EDS

- Direct DOM manipulation reaching outside the block's own root element
  (`block.parentElement.parentElement.style...`) instead of confining
  changes to the block's subtree.
- A new block duplicating logic that an existing shared block/utility
  already implements (e.g. reimplementing a carousel instead of reusing
  the existing carousel block's pattern).
- Business logic (data fetching, transformation) mixed directly into
  the render path instead of separated into a testable helper function.

Cross-ref `resources/pattern-libraries/eds.md` (forthcoming) for the
full anti-pattern catalog.

## Pre-merge checklist items specific to EDS

- [ ] All DOM work for the new/changed block happens inside `decorate()`.
- [ ] Below-the-fold images/scripts use lazy loading.
- [ ] No unsanitized `innerHTML` assignment.
- [ ] No inline event handlers in template strings.
- [ ] New images specify width/height (CLS-safe).
- [ ] New interactive elements have accessibility attributes.
- [ ] Heading hierarchy in new markup is valid.

## 2 worked review examples for EDS

**Example 1 — module-scope DOM work + unsanitized innerHTML.**
```js
// blocks/promo/promo.js (new file)
const banner = document.querySelector('.promo-banner');
banner.innerHTML = getPromoText();

export default function decorate(block) {
  block.classList.add('promo-block');
}
```
Review comments:
- 🔴 CRITICAL — `banner.innerHTML = getPromoText()` runs at module load
  time, outside `decorate()`, and before this element may even exist in
  the DOM — move into `decorate(block)`.
- 🟠 HIGH — `innerHTML` assignment with `getPromoText()` output not
  sanitized — if that text is content-author-controlled and can include
  markup, this is an XSS vector. Use `textContent` unless HTML is
  genuinely required (then sanitize).

**Example 2 — missing lazy-load + CLS risk.**
```js
export default function decorate(block) {
  const img = document.createElement('img');
  img.src = block.dataset.hero;
  block.append(img);
}
```
Review comments:
- 🟡 MEDIUM — no `width`/`height` set on the new `img` — will cause a
  layout shift when it loads; set explicit dimensions or an
  aspect-ratio CSS rule.
- 🔵 LOW — no `loading="lazy"` — fine if this is confirmed above-the-fold
  (hero image), otherwise add lazy loading.

## Anti-patterns to avoid IN THE REVIEW ITSELF

- Don't demand lazy-loading on a genuinely above-the-fold hero image —
  eager loading is correct there; only flag lazy-load omission for
  below-the-fold content.
- Don't block on CSS specificity/selector-naming preferences that don't
  cause actual style bleed.
- Don't insist every `fetch()` needs a full retry/backoff strategy —
  reasonable error handling (a caught rejection with a fallback UI
  state) is usually sufficient for a content block.

Generate the full review using `templates/review-comment.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
