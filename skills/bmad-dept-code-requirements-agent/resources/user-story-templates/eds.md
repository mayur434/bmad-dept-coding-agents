# User-story authoring guide — Edge Delivery Services (EDS / Franklin / Helix)

This guide tells the LLM authoring pass **how to shape user stories** for
an Edge Delivery Services BRD. Combine with `templates/user-story.md` as
the master single-story skeleton.

## INVEST criteria (stack-specific interpretation)

- **Independent** — stories should not couple to a specific
  `scripts.js` phase ordering across blocks. Each block ships
  independently.
- **Negotiable** — leave room to choose Google Docs vs SharePoint vs
  GitHub Markdown for a content source based on editor preference.
- **Valuable** — value expressed to a Content Editor, Consumer, or RUM
  Owner — not "the block".
- **Estimable** — team can size once the block's decorate path,
  eager/lazy/delayed phase, and helix-query index (if any) are agreed.
- **Small** — one block (JS + CSS + author doc example) is fine; a new
  helix-query index is a separate story.
- **Testable** — every story is testable with Jest + jsdom (block
  logic), Playwright (page render + interaction), axe-core
  (accessibility), Lighthouse CI (CWV budgets).

## Stack-specific personas

- **Block developer** — writes `blocks/<name>/<name>.js` + CSS,
  extends `scripts.js` phases, wires helix-query indexes.
- **Content editor** — authors in Google Docs / SharePoint / GitHub
  Markdown; publishes via the Sidekick.
- **Consumer / end user** — visits the site on a wide range of
  devices.
- **RUM / performance owner** — CrUX + RUM telemetry, chases CWV
  regressions.

## Story shape

`As a {{PERSONA}}, I want {{CAPABILITY}}, so that {{BENEFIT}}`

Realistic titles per persona:

- Block developer — "build the `product-teaser` block wired to a
  helix-query index", "extract the hero block's LCP image into a
  `<link rel=preload>` in eager phase", "auto-block plain tables into
  the `table` block".
- Content editor — "author a landing page in Google Docs using the
  `hero`, `columns`, and `cards` blocks", "preview a page draft via
  the Sidekick before publishing".
- Consumer — "load the homepage under 2.5s on a mid-tier phone",
  "navigate categories with keyboard only".
- RUM owner — "see LCP contribution breakdown per page template on
  the RUM dashboard".

## Story splitting patterns for EDS

- **Per block** — every block is its own story: `hero`, `cards`,
  `columns`, `fragment`, `product-teaser`.
- **Mobile-first vs desktop enhancement** — mobile-first render is one
  story; the desktop-specific enhancement (e.g. multi-column layout)
  is another.
- **Eager vs lazy vs delayed phase** — critical-path work in eager
  ships in one story; the delayed-phase telemetry ships in another.
- **helix-query index vs consumer block** — indexing a content type
  is a separate story from the block that reads it.
- **Auto-block extraction** — turning plain author markup into a block
  is separate from the block itself.
- **Content-source setup** — Google Docs / SharePoint / GitHub
  onboarding is a one-shot story separate from block work.
- **Sidekick customization** — new plugin buttons ship separately.

## Effort estimation guidance

- **S (~1 day)** — CSS-only tweak to an existing block; add a
  helix-query filter to an existing index.
- **M (~2-3 days)** — new block (JS + CSS + Jest tests + author doc
  example) matching an existing pattern.
- **L (~1 sprint)** — new page template (multiple blocks + section
  metadata + helix-query index + Sidekick plugin).
- **XL (>1 sprint, split)** — greenfield site (blocks, styles, scripts,
  Sidekick, helix-query, Google Docs onboarding, RUM setup).

**Estimation anti-patterns**
- Adding a heavy third-party script to the eager phase "just this
  once" — LCP regression is guaranteed.
- Ignoring block-CSS collisions until QA — namespace `.block-name`
  from the start.
- Underestimating helix-query re-indexing cost after a large content
  edit.

## Ready-for-dev checklist

- [ ] Block CSS budget confirmed (KB gzipped).
- [ ] Block JS budget confirmed (KB gzipped) — <=15KB target per block.
- [ ] LCP-critical images identified; preload strategy documented.
- [ ] Auto-block extraction rules reviewed if applicable.
- [ ] Author example (Google Doc / MD) attached to the story.
- [ ] helix-query index name + filter + selector defined (if needed).
- [ ] Section metadata + default metadata plan documented.
- [ ] Sidekick plugin need identified.
- [ ] axe-core CI check passes on the block.
- [ ] Lighthouse budget delta reviewed (must not regress median).

## Example user stories for EDS

### STORY-001: `product-teaser` block wired to helix-query

**As a** block developer
**I want** a `product-teaser` block that lists items from a
`/products.json` helix-query index
**So that** editors can drop product highlights onto marketing pages
without hand-authoring each teaser.

**Priority**: MUST | **Effort**: M | **Parent epic**: EPIC-1 Product marketing
**Dependencies**: helix-query index `products` (STORY-002)
**AC**:
- Given the block is on a page with `?category=shoes`, when it renders,
  then up to 6 items with `title`, `image`, `price`, `href` are shown.
- Given the block loads, then the block JS is <=15KB gzipped and runs
  in the lazy phase (never eager).
- Given no matching items, then the block renders an empty state with
  no console errors.

### STORY-002: helix-query `products` index

**As a** block developer
**I want** a helix-query index over `/products/*` pages
**So that** the `product-teaser` and search blocks can list products
without a runtime fetch.

**Priority**: MUST | **Effort**: S | **Parent epic**: EPIC-1
**AC**:
- Given the index refresh runs, when a new product page is published,
  then the entry appears in `/products.json` within 5 min.
- Given the index is queried with `?category=shoes`, then only shoe
  products are returned.

### STORY-003: Homepage LCP under 2.5s on mid-tier mobile

**As a** consumer
**I want** the homepage LCP under 2.5s on a Moto-G-class device
**So that** organic search rank stays green.

**Priority**: MUST | **Effort**: M | **Parent epic**: EPIC-2 Performance
**AC**:
- Given a cold-load on emulated Moto-G-class hardware, when Lighthouse
  runs, then LCP <=2.5s and Performance score >=95.
- Given the hero image is the LCP element, then a `<link rel=preload>`
  is emitted in `<head>` in the eager phase.
- Given consent is denied, then no third-party scripts fire.

## Anti-patterns to avoid

- "As a developer, I want to add React to EDS" — off-pattern; EDS is
  vanilla JS with progressive enhancement.
- "As an editor, I want to add a block" — no block named, no benefit,
  no author-doc example.
- "As a consumer, I want the site to be faster" — no metric, no page,
  no device profile.
- "As a RUM owner, I want better telemetry" — no dashboard, no metric.
- Bundling helix-query index + block + Sidekick plugin + Google Docs
  onboarding into one story.

## Story-title formulation

Good:
- "`product-teaser` block wired to helix-query"
- "helix-query `products` index"
- "Homepage LCP under 2.5s on mid-tier mobile"

Bad:
- "New block" — no name, no doc, no benefit.
- "Improve performance" — no metric, no page.
- "Add search" — no scope, no index, no autocomplete requirement.
