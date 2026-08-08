# ADR authoring guide — Edge Delivery Services (EDS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an ADR for an EDS (Franklin/Helix) project.
Combine with `templates/ADR.md` as the master skeleton.

## Stack-specific decision categories

- **Block naming and discovery** — how blocks are organized under
  `blocks/<name>/<name>.js` + `<name>.css`; discovery via `decorateMain`
  or explicit registration.
- **Auto-block extraction strategy** — where to compose common structural
  blocks (`hero`, `columns`, `cards`) from Word/Google-Docs conventions
  vs marker syntax vs `<meta>` tags.
- **LCP-critical asset pattern** — which asset is elected LCP candidate,
  preload directives in `head.html`, `<link rel="preload">` for hero
  images, `loading="eager"` on critical `<img>`.
- **Consent-mode integration** — where consent state lives (localStorage
  vs cookie), when to load Launch, wall-off pattern for pre-consent
  telemetry.
- **Storefront-events adoption** for marketing tags — when EDS + Commerce
  are involved, do we adopt Storefront Events for consistency with the
  drop-in world or stick to the legacy `_paq` / GTM data-layer?
- **Content author surface** — Google Docs vs SharePoint vs GitHub markdown
  (with `helix-query.yaml`).
- **Extension via `head.html` / `scripts.js` / `styles.css`** — the
  three canonical extension surfaces.
- **`scripts.js` phase mapping** — what runs in load-eager vs load-lazy
  vs load-delayed; the LCP-preserving contract.

## Common constraints (stack-specific)

- **No build step for EDS core** — blocks and scripts ship as-is;
  optional bundling for shared libs only.
- **Edge-cached** by default; cache-busting via file rename or query
  param.
- **Core Web Vitals** budgets are hard: LCP <= 2.5s, CLS <= 0.1,
  INP <= 200ms, TBT <= 200ms, Lighthouse >= 95.
- **JS budget** — ~100KB critical (load-eager) is the working ceiling;
  anything more starves LCP.
- **Author-side** paradigm — Word/Google Docs mean tables and headings
  are the content model; there is no CMS with schemas.
- **`helix-query.yaml`** indexes are the sitemap and the search-driver;
  changes require rebuild.
- **Franklin/Helix rendering pipeline** — server-side markdown → HTML,
  client-side block decoration; nothing else runs server-side.
- **Third-party scripts** — must be `load-delayed` unless they own the
  LCP element (e.g. hero video player).

## Common alternatives (stack-specific)

### Block discovery
- **Convention-based `blocks/<name>/<name>.js`** — zero registration;
  default; matches Franklin standard.
- **Explicit registration in `scripts.js`** — bespoke; useful for shared
  blocks across brands.
- **Nested composition inside blocks** — one top-level block that
  delegates to sub-blocks.

### Auto-blocking
- **Marker-based** — first `<h1>` promotes to a `hero`; second `<p>` +
  image group promotes to `columns`.
- **Metadata-driven** — `<meta>` tags in doc-frontmatter drive template
  choice.
- **No auto-blocking** — all blocks explicit; more author burden.

### LCP-critical asset
- **Hero image `<link rel="preload">`** in `head.html` — fastest, but
  hard-codes the URL.
- **`loading="eager"` + `fetchpriority="high"`** on first `<img>` in
  `main` — simpler; no preload; slightly slower than preload.
- **Server-side hint** via `<meta>` — future direction; not yet
  universal.

### Consent-mode
- **Load Launch after consent** — pure; loses pre-consent telemetry.
- **Load Launch always; gate individual pixels on consent** — richer;
  requires Launch extension config.
- **Custom consent bus + selective loader** — heaviest; most flexible.

## Decision drivers for EDS

- **LCP p75** on top-N landing pages (< 2.5s hard target).
- **CLS p75** (< 0.1); layout jank from lazy-loaded assets is the usual
  culprit.
- **INP p75** (< 200ms); heavy blocks in `load-lazy` bite here.
- **Lighthouse mobile score** (>= 95 target).
- **Author autonomy** — how much design tokens vs freehand block
  authoring do authors need?
- **Multi-brand / multi-site reuse** — share blocks via GitHub source vs
  fork per brand.
- **Marketing-tag inventory** — how many pixels, all through Launch or
  some direct?
- **Commerce integration** presence (see `eds-commerce.md` for the
  hybrid case).
- **Consent-mode requirements** (GDPR / CCPA / CPRA).
- **Search** — `helix-query` covers most cases; fallback to Algolia if
  ML relevance needed.

## Worked ADR examples for EDS

**ADR-101 — Load-delayed for all analytics + tag manager.**
- **Context.** Marketing wants Launch + GTM + FB Pixel + LinkedIn
  Insight; Lighthouse mobile dropped from 96 to 78 after adding them
  eagerly.
- **Options.** (A) All load-eager, (B) All load-delayed (after LCP
  fires), (C) Launch load-lazy, others load-delayed.
- **Decision.** (B) All load-delayed. Rationale: LCP dominates
  Lighthouse; deferring all telemetry until after LCP restores score;
  Launch's own DTM extensions run fine on delayed load.
- **Consequences.** + Lighthouse recovers to 96, + LCP recovers to
  2.1s p75, – ~1s of pre-consent activity is unrecorded, – bounce-rate
  attribution on ultra-fast bounces (< 1s) is lost.

**ADR-102 — Metadata-driven page templates (not auto-blocking).**
- **Context.** Authors kept promoting the wrong `<h1>` to hero,
  producing inconsistent hero styles across pages.
- **Options.** (A) Marker-based auto-blocking, (B) `<meta>` templates,
  (C) Explicit block-first authoring guide.
- **Decision.** (B). Rationale: authors already understand doc
  frontmatter; template metadata (`template: landing`, `template:
  article`) drives block composition in `scripts.js`; predictable
  outcome.
- **Consequences.** + consistent styling, + author-visible template
  choice, – requires author training + template documentation, –
  fewer serendipitous author-driven layouts.

**ADR-103 — `helix-query.yaml` for search index (no Algolia).**
- **Context.** Site has ~500 pages, growing to 1500 in 12 months.
  Marketing wants type-ahead search on the news section.
- **Options.** (A) `helix-query.yaml` + client filter, (B) Algolia
  DocSearch, (C) Elastic on custom edge worker.
- **Decision.** (A). Rationale: 1500 pages is well within helix-query's
  comfort zone; type-ahead client filter over the indexed JSON is
  performant and free; no vendor dependency.
- **Consequences.** + zero cost + zero vendor, + turn-around on index
  changes is fast (rebuild on publish), – no ML ranking, – if catalog
  grows past ~5-10k rows, revisit.

## Anti-patterns to avoid for EDS

- **Loading a JS framework (React, Vue) as an EDS block** — dwarfs the
  100KB critical budget; use vanilla or use a Rendering.Layer approach.
- **Modifying `scripts.js` load-eager for a non-critical block** —
  every add here directly steals from LCP.
- **Missing CLS on lazy-loaded images** — always set `width` +
  `height` (or `aspect-ratio`).
- **Third-party font in load-eager without `font-display: swap`** —
  FOIT (Flash Of Invisible Text) tanks LCP.
- **Building a build step for the core `scripts.js`** — EDS's simplicity
  is the value; add build only for shared libs.
- **`fetchpriority="high"` on the wrong asset** — steals bandwidth from
  the real LCP; measure, don't guess.

---

Generate the full ADR using `templates/ADR.md` as the master, populating
placeholders with stack-appropriate content from the guide above.
