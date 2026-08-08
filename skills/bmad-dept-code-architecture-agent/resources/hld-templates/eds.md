# HLD authoring guide — Edge Delivery Services (EDS)

## Purpose framing

An EDS HLD establishes the **block hierarchy** and **`scripts.js`
loading phases** (load-eager / load-lazy / load-delayed), the
**content-source layout** (Google Docs / SharePoint), the **helix admin
+ helix pages preview flow**, the **RUM/CrUX telemetry wiring**, and
the **consent + Adobe Launch integration**. EDS has a hard
**no-build-step** constraint — the HLD should reflect that everything
ships as plain JS/CSS/HTML from git.

## Typical containers (C4 L2 elements) for EDS

- **Edge (helix worker)** — CDN edge (Cloudflare + Fastly hybrid)
  running the helix runtime; serves pages from the content bus.
- **Content bus** — repository of pre-rendered HTML shards keyed off
  `main` branch of the git repo.
- **Origin store (Google Drive / SharePoint / OneDrive)** — authoring
  surface; `.docx` / `.xlsx` / `.md` promoted through helix admin.
- **helix admin** — Adobe-managed control plane; `helix-admin.hlx.page`
  routes preview + publish requests.
- **Storefront-events / RUM** — client-side telemetry to Adobe RUM
  (`rum.hlx.page`) or Web SDK.
- **External content APIs** — JSON endpoints the blocks fetch (e.g.
  product data, event listings) via `fetch`.
- **Third-party marketing tags** — Adobe Launch (preferred),
  OneTrust consent, GTM if approved.
- **Preview branch** — separate CDN origin for `preview` env; DNS
  routed via helix routing rules.

## Stack-specific tech-choice table

| Container | Technology | Why |
|---|---|---|
| Runtime | helix / Franklin project (`aem.live`) | Adobe-managed edge |
| Content source | Google Drive or SharePoint <!-- verify: current supported list --> | Author-first surface |
| Repo | GitHub or GitLab (helix-configured) | Git = source of truth |
| Consent | OneTrust preferred; Adobe Launch driver | Adobe reference stack |
| Analytics | Adobe Web SDK (`alloy.js`) | XDM-native |
| RUM | Adobe RUM (built-in) | CrUX-aligned telemetry |
| Perf budget | 100KB critical-path JS <!-- verify: current EDS budget --> | LCP p75 ≤ 2.5s |
| Auth (gated) | IMS via Adobe Passport or SSI cookies | Rare — EDS is public-mostly |

## Cross-cutting concerns for EDS

- **AuthN/AuthZ** — EDS is public-first; gated pages via helix-configured
  origin auth or IMS.
- **Logging** — Adobe RUM handles client telemetry; server logs are
  Adobe-managed (edge logs available via helix admin).
- **Tracing** — no traditional APM; RUM provides Web Vitals + custom
  events.
- **Config** — `helix-config.json` in repo; site metadata via
  `metadata` sheet; block-level config via block-attribute syntax.
- **Secrets** — no server code, no secrets; API keys for public APIs
  only (proxy via edge worker if secret needed).
- **Feature flags** — sheet-driven config (per-page metadata) or Adobe
  Target for content variants.
- **i18n** — path-based (`/en/`, `/de/`) with per-locale sheet or
  Google Docs.

## Integration points typical to EDS

- **Adobe Launch** — tag manager; loaded async in `load-delayed` phase.
- **Adobe Analytics** — via Web SDK; XDM schema mapped in Launch.
- **Adobe Target** — Web SDK + on-page decision scope; VEC as author
  fallback.
- **RTCDP** — Web SDK real-time profile + audiences.
- **Consent** — OneTrust or Cookiebot; gating for load-delayed tags.
- **External content APIs** — JSON `fetch` in blocks; CORS-configured
  on the origin.
- **Commerce data** — via drop-ins (see `eds-commerce.md`) or direct
  Catalog Service `fetch`.
- **Third-party marketing** — chat, reviews, personalization scripts;
  all deferred to `load-delayed`.
- **Search** — Coveo, Algolia, or Adobe Search via client-side widget
  in a block.

## NFR profile for EDS

- **LCP** ≤ 2.5s on p75 mobile (mobile-first).
- **INP** ≤ 200ms on p75.
- **CLS** ≤ 0.1 on p75.
- **TTFB** ≤ 200ms (edge cache hit); ≤ 800ms cold.
- **Critical-path JS** ≤ 100KB gz for `load-eager` phase
  <!-- verify: current EDS-team budget -->.
- **Lighthouse mobile** ≥ 95 Performance / 95 A11y / 100 SEO / 100 BP
  <!-- verify: current EDS target -->.
- **Availability** — CDN-tier 99.99%; helix admin 99.9%
  <!-- verify: current EDS SLAs -->.
- **Publish → live** ≤ 60s from preview publish.

## Capacity planning shape

- **No infra to size** — Adobe runs the edge.
- **What you plan**: content sheet size (large sheets slow publish),
  block count per page (each block adds JS/CSS), image budget (LCP
  candidate optimized to WebP/AVIF).
- **Traffic** — CDN scales globally; no origin RPS to model.
- **Publish cadence** — bulk publishing (e.g. product catalog sheet
  update) can throttle helix admin; batch or shard sheets.
- **Content volume** — 10k+ pages per repo works; beyond that consider
  sub-repos or shards.

## Deployment topology

Mermaid `flowchart` shape: `Author (Google Docs / SharePoint) → helix
admin → git repo → helix runtime → CDN (Cloudflare + Fastly)`.
Preview at `<branch>-<repo>-<owner>.hlx.page`; live at
`<repo>-<owner>.hlx.live` and mapped domain.

## Delivery / release approach for EDS

- **Git = deploy** — merge to `main` publishes; PR to `preview` branch
  previews.
- **Instant rollback** — `git revert` + push; edge propagation <60s.
- **No build step** — CSS/JS ship as authored; enforce via linting
  and manual code review.
- **Content release** — helix admin `POST /publish/<path>` from Google
  Docs "Send to Franklin" plugin.
- **Preview** — every PR gets `preview.hlx.page`; author reviews
  before merge.
- **A/B** — Adobe Target integration or per-URL variants.

## 3 worked HLD outline examples for EDS

**HLD-01: Corporate Marketing Site Rebuild on EDS**
- Containers: EDS edge, Google Docs authoring, Adobe Launch, Adobe
  Analytics, OneTrust, Coveo search block.
- ADRs: ADR-content-source (Google-vs-SharePoint); ADR-block-vs-auto-
  block; ADR-consent-mode-per-region.
- Cross-cutting: RUM telemetry, Launch loaded delayed, per-locale sheet.
- NFRs: LCP ≤ 2s p75; Lighthouse Perf ≥ 95; publish ≤ 60s.
- Rollout: page-by-page migration from legacy WCM; DNS split by path.

**HLD-02: EDS Site with Personalization via Target**
- Containers: EDS + Web SDK + Adobe Target + RTCDP.
- ADRs: ADR-client-vs-edge-personalization; ADR-consent-fallback.
- Cross-cutting: pre-hiding class to avoid FoOC (flash of original
  content); consent-aware Target load.
- NFRs: pre-hide budget ≤ 300ms; audience decision ≤ 100ms.
- Rollout: single audience test → global.

**HLD-03: Multi-Brand EDS Portfolio**
- Containers: shared block library (git submodule) + per-brand repos +
  helix admin per-brand.
- ADRs: ADR-shared-vs-forked-blocks; ADR-tokens-source-of-truth.
- Cross-cutting: brand theming via CSS variables, per-brand OneTrust
  templates.
- NFRs: shared block updates propagate ≤ 24h; per-brand LCP budget.
- Rollout: brand-by-brand onboarding.

## Anti-patterns to avoid for EDS

- **Adding a build step** — breaks the git-as-deploy contract; use
  the block model to compose behavior, not bundlers.
- **Server-side rendering** — EDS is edge-only; no SSR container to
  design against.
- **Heavy load-eager JS** — anything not needed for LCP goes to
  load-lazy or load-delayed.
- **Blocking scripts without defer** — third-party tags always in
  load-delayed; never in `<head>` synchronous.
- **Ignoring RUM** — Adobe RUM is the source of truth for Web Vitals
  regression; skipping it means Lighthouse-only which is synthetic.

---

Generate the full HLD using `templates/HLD.md` as the master, populating
placeholders with stack-appropriate content from the guide above. When
container/technology decisions are still open, produce an ADR alongside
(see `resources/adr-templates/eds.md`).
