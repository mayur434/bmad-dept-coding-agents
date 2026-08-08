# Acceptance-criteria authoring guide — Edge Delivery Services (EDS)

This guide tells the LLM authoring pass **how to shape acceptance criteria**
for user stories on an Edge Delivery Services (Franklin / Helix) BRD.
Combine with `templates/ac-checklist.md`. Priority tags map MoSCoW ->
Summary contract (`MUST` / `SHOULD` / `COULD` / `WONT`).

## Given / When / Then structure (EDS idioms)

- **Given** typically fixes *authoring source state* (a Google Doc /
  SharePoint file exists with a block table `hero`), *published-URL state*
  (`https://main--repo--org.hlx.live/page` returns 200), or *network
  state* (Slow 3G throttle, mobile viewport).
- **When** covers *page load* (`window.load`), *`scripts.js` phase
  boundaries* (load-eager / load-lazy / load-delayed), or a *user
  interaction* (click, scroll).
- **Then** targets *rendered DOM* (block decorated, correct classes),
  *Web Vitals metrics* (LCP element, CLS score), *bundle size* (KB of
  critical JS), or *helix-query index side-effect*.

## Types of AC for EDS

### Functional AC
- Given a Google Doc with a `Hero` block table (image | title | CTA),
  when the doc is previewed via helix-admin, then the block renders
  with class `.hero` and the CTA link is preserved.
- Given a `.metadata` row in the doc, when the page renders, then the
  emitted `<meta>` tags include `og:title`, `og:image`, `twitter:card`
  matching the metadata values.
- Given `helix-query.yaml` defines an index `articles`, when the query
  worker rebuilds, then `/query-index.json` reflects new articles
  within one rebuild cycle.
- Given a page loads on mobile, when `scripts.js` finishes `loadLazy`,
  then all above-the-fold blocks are decorated and no CLS event
  exceeds 0.05 individually.
- Given a `loadDelayed` third-party script (Adobe Launch, Analytics),
  when the page has been interactive for 3s, then the script loads
  and does not block INP.

### Non-functional AC
- LCP <= 2.5s at p75 (Web Vitals RUM, 28-day trailing) on Slow 4G
  throttle Lighthouse mobile preset.
- CLS <= 0.1 at p75; individual layout shifts <= 0.05.
- INP <= 200ms at p75.
- TBT <= 200ms on Lighthouse mobile.
- Lighthouse Performance >= 95 on the landing page.
- Critical JS (load-eager + load-lazy, gzip) <= 100KB.
  <!-- verify: current AEM EDS budget -->
- CDN cache hit-ratio >= 95% on published content.

### Edge-case AC
- Given a block table is missing a required column, when `decorate()`
  runs, then the block emits a `data-error` attribute and a WARN in
  the console but does NOT throw.
- Given a page is loaded with `?martech=off`, when `loadDelayed` runs,
  then no Analytics or Launch scripts are loaded.
- Given the author is previewing an unpublished page, when the URL
  hits `--preview` (`main--repo--org.hlx.page`), then draft content
  renders — never leaks to `.hlx.live`.
- Given `scripts.js` runs on a page with 0 blocks, when `loadEager`
  completes, then the page still renders the `<main>` with valid
  semantics (no blank white screen).

### Security AC (STRIDE-inspired)
- Given a form block posts to a form-handler, when the request is
  sent, then a CAPTCHA / honeypot / rate-limit check runs before
  writing to storage (defense against spam bots).
- Given user-provided content is rendered in a block, when the block
  builds its DOM, then `textContent` (never `innerHTML`) is used for
  string values — no XSS surface.
- Given consent-mode is `denied`, when the page loads, then no
  third-party Analytics, Launch, or Recommendations scripts execute
  until consent is granted.
- Given `configs.js` references a public API endpoint, when the fetch
  runs, then the endpoint is on the allowlist in the CSP `connect-src`
  directive.
- Given a helix-admin token, when it is referenced by the app, then
  it is never embedded in `scripts.js` (would be public) — kept
  server-side only.

### Performance AC (measurable)
- **WebPageTest**: LCP <= 2.5s, CLS <= 0.1, TBT <= 200ms on the
  `Motorola Moto G4 - Chrome - 3GFast` preset.
- **Lighthouse CI**: Performance score >= 95 on the landing page.
- **Web Vitals RUM** (via `web-vitals` NPM package): LCP p75 <= 2.5s
  over 28-day trailing window (CrUX or self-collected).
- **Bundle analyzer**: critical-path JS <= 100KB gzip.
- **CDN log**: `x-cache` HIT ratio >= 95% on `/content/*`.

### Testability guidance
- Unit: **Vitest / Mocha + jsdom** for block `decorate()` and utility
  functions in `scripts.js`.
- E2E: **Playwright** against a preview URL for interaction + visual
  regression.
- Performance: **Lighthouse CI** (`lhci autorun`) + **WebPageTest**
  automated runs on PR.
- Accessibility: **axe-core** integrated with Playwright.
- Visual: **Percy** or **Playwright screenshot** diffs on the
  branch preview URL.
- Reference `test-generation/eds.md`.

## Negative AC (what MUST NOT happen)
- Blocks MUST NOT block the main thread for more than 50ms during
  `loadEager` or `loadLazy`.
- Third-party scripts MUST NOT load in `loadEager` or `loadLazy` —
  reserved for `loadDelayed` (post-interactivity).
- `document.write` MUST NOT appear anywhere in project code.
- CSS from a block MUST NOT reach into another block's DOM (block
  isolation).
- A block's `decorate()` MUST NOT re-run after user interaction
  (idempotency).
- Critical JS + CSS combined MUST NOT exceed the budget defined in
  `helix-query.yaml` / project standards.

## Testability check per AC
- [ ] Testable — framework + assertion.
- [ ] Measurable — concrete signal.
- [ ] Unambiguous — no interpretation gap.
- [ ] Independent — no undeclared prereq.
- [ ] Small — one behavior per AC.

## Common AC anti-patterns for EDS
- "The page should load fast" -> "LCP <= 2.5s p75 (Web Vitals RUM,
  28-day trailing)".
- "The block should look right" -> "Given a block table with columns
  X/Y/Z, When decorate() runs, Then the DOM matches the reference
  snapshot AND classes are `.block-x`".
- "No janky layout shifts" -> "CLS <= 0.1 p75; no individual shift
  event > 0.05".
- "Analytics should track everything" -> "Given consent granted, When
  `loadDelayed` fires, Then the Analytics `pageView` beacon reaches
  the collector with the expected `pageName` and `pagePath`".
