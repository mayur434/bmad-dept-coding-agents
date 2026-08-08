# BRD authoring guide — Edge Delivery Services (EDS / Franklin / Helix)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a BRD for an Edge Delivery Services project.
Combine with `templates/BRD.md` as the master skeleton.

## Stack-specific personas

- **Block developer** — writes decorate blocks (`blocks/<name>/<name>.js`
  + `<name>.css`), extends `scripts.js` phases, wires helix-query indexes.
  Pain: JS-bundle bloat regressing LCP, cross-block CSS collisions.
- **Content editor** — authors pages in Google Docs or SharePoint (or edits
  Markdown in GitHub), publishes via the Sidekick. Pain: preview parity
  between Docs and live, missing block-usage examples.
- **Consumer / end user** — visits the site on a wide range of devices.
  Cares about a fast, accessible, correctly-cached page.
- **RUM / performance owner** — watches CrUX + RUM telemetry, chases
  Core Web Vitals regressions. Pain: opaque LCP contributors, delayed
  observability from third-party scripts.

## Stack-specific in-scope patterns

- Block-oriented decorate paths (`decorate(block)` in each
  `blocks/<name>/<name>.js`).
- `scripts.js` phases: `loadEager()` (critical, blocks LCP),
  `loadLazy()` (post-LCP), `loadDelayed()` (>= 3s after load).
- `styles.css` critical CSS strategy — only above-the-fold.
- Helix-query indexes for content listings (blog, catalog, docs).
- Fragment blocks for content reuse across pages.
- Section and default metadata for per-page overrides.
- SPAs kept off the critical path — all interactivity is progressive
  enhancement.
- Content source in Google Docs / SharePoint / GitHub Markdown.
- Sidekick + preview / publish flow via `admin.hlx.page`.
- Custom bulk publish + purge via `helix-admin` API.

## Stack-specific out-of-scope patterns

- Heavy front-end frameworks (React / Vue / Svelte / Angular) on the
  critical path — EDS is vanilla JS with progressive enhancement.
- Server-side rendering — EDS content is authored, indexed, and served
  from the edge; no server runtime.
- Blocking `<script src>` in the `<head>` — everything defers.
- CSS-in-JS on the critical path — write plain CSS in `blocks/*.css` and
  `styles/styles.css`.
- Any critical-path fetch to a third-party origin without a preconnect +
  timeout escape hatch.
- Custom bundlers with tree-shaking assumptions — EDS ships raw ES
  modules; keep files small instead.

## Stack-specific NFRs

**Core Web Vitals (non-negotiable)**
- LCP p75 <= 2.5s (mobile + desktop).
- INP p75 <= 200ms.
- CLS p75 <= 0.1.
- TBT (Lab) <= 200ms on mid-tier mobile.
- Lighthouse Performance >= 95 on the top-20 pages.

**Bundle discipline**
- Critical-path JS (loadEager phase) <= 30KB gzipped.
- Total blocking JS on first paint <= 100KB gzipped.
- Per-block JS <= 15KB gzipped where reasonable.
- Zero blocking third-party scripts before `loadLazy()`.

**Availability**
- Edge availability per Adobe / Cloudflare edge SLA. <!-- verify -->
- Publish latency (Docs edit -> live) p95 <= 60s.
- helix-query index refresh <= 5 min.

**Accessibility**
- WCAG 2.2 AA on all published pages.
- Keyboard-navigation and focus-visible baseline on every block.
- Automated axe-core CI check on preview environment.

## Stack-specific integration points

| System | Direction | Notes |
|---|---|---|
| Author source (Google Docs / SharePoint / GitHub) | inbound | content source of truth |
| Edge (Cloudflare / Fastly / helix-run) | outbound | rendered pages served |
| Adobe Analytics | outbound | tag-manager on delayed phase |
| Adobe Target | outbound | tag-manager on delayed phase |
| Adobe RUM / CrUX | outbound | perf telemetry |
| External content APIs | outbound | fetched by blocks on lazy phase |
| Sidekick + `admin.hlx.page` | bidirectional | preview / publish / index refresh |

## Stack-specific success KPIs

- CWV pass rate on top-N pages (LCP + INP + CLS all green).
- Lighthouse Performance median across the top-20 pages.
- Bundle-size trend release-over-release (should not grow).
- Publish-to-live latency p95.
- Editor content-velocity (pages published per author per week).

## Stack-specific risks

- **Block-CSS collision** — two blocks using the same class name and
  clobbering each other's styles.
- **Delayed-script cascade** — a tag-manager rule loading a
  render-blocking pixel that pushes LCP over budget.
- **helix-query index drift** — a new content type not indexed, breaking
  a listing page.
- **Sidekick auth gap** — an editor losing publish access mid-launch.
- **Author source outage** — Google Docs or SharePoint down blocking
  content edits.

## Stack-specific compliance

- **WCAG 2.2 AA** — enforced in CI via axe-core.
- **GDPR** — cookie-consent surface implemented as a delayed-phase block;
  no third-party cookies fire until consent is captured.
- **AODA / EN-301-549** for regulated markets. <!-- verify -->
- Content-security-policy header locked at the edge (no `unsafe-inline`
  where practical).

## Example BRD sections for EDS

**Executive summary example.**
> The corporate marketing site migrates from AEM Sites to Edge Delivery
> Services to unlock Google-Docs-based authoring, edge-native performance
> (LCP p75 <= 2.5s target), and continuous content deployment. Success is
> measured as: (1) all 350 pages migrated with LCP p75 in the green,
> (2) publish-to-live p95 <= 60s, (3) Lighthouse Performance median >= 95
> on the top-20 pages.

**In-scope example.**
> 12 blocks: hero, columns, cards, fragment, embed, form, header, footer,
> quote, table, video, and a custom `product-teaser` block wired to a
> helix-query index. `scripts.js` phases tuned for LCP: hero image
> preloaded in eager phase, all analytics/personalization on delayed phase.
> Content source: Google Docs on a shared Drive with Sidekick preview.

**NFR example.**
> **NFR-Perf-1** — LCP p75 on the top-20 landing pages MUST be <= 2.5s
> measured via CrUX (28-day rolling window), separately validated in
> lab via Lighthouse on emulated Moto-G-class hardware. Parent BR: BR-1
> (organic search rank). MoSCoW: MUST.

---

Generate the full BRD using `templates/BRD.md` as the master skeleton,
populating placeholders with stack-appropriate content from the guide above.
