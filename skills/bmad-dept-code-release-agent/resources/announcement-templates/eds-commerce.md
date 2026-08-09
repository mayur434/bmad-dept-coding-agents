# Announcement authoring guide — EDS + Commerce (hybrid)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a multi-channel release announcement for a
hybrid Edge Delivery Services + Commerce SaaS project. Combine with
`templates/announcement.md` as the master skeleton.

## Purpose framing

EDS + Commerce announcements are the **most audience-fragmented** of
the eight stacks: a single release can touch content-editor authoring
(new blocks), merchandiser configuration (Catalog / Live Search),
drop-in bundle versions (developer-facing), and storefront-consumer
experience (public feature) — all at once. The announcement must
segment cleanly and route each concern to the audience that owns it
without leaking retail-strategy detail into the public channel or
dumping drop-in npm-version noise onto editors. What makes this stack
unique: the git-based EDS deploy and the drop-in package pins must
release in **coordinated lockstep** — if editor-visible sheet changes
depend on a new drop-in schema, the announcement has to make the
ordering explicit.

## Audience segmentation for EDS + Commerce

- **Content editors** *(EDS side)* — Sidekick block changes, Google
  Docs / SharePoint patterns, sheet-driven config.
- **Merchandisers** *(Commerce side)* — Catalog Service attribute
  changes, Live Search ranking rule changes, facet config.
- **Storefront developers** — drop-in bundle version matrix, block
  code that consumes drop-in components.
- **Storefront consumers** — visible PDP/PLP/cart/checkout changes,
  Web Vitals.
- **API Mesh / I/O owners** — resolver changes tying EDS blocks to
  Commerce backend.
- **SEO / Web-perf owners** — Web Vitals delta on commerce templates,
  structured data (product schema), redirects.

## Channel-by-channel guidance for EDS + Commerce

### Email announcement (long-form)

- **Subject line pattern:** `[EDS+Commerce] v{{version}} — {{block}} +
  drop-in {{bundle}}` (e.g. `[EDS+Commerce] v2.5.0 — Loyalty PDP
  block + @dropins/storefront-cart 3.1`).
- **Body sections:** what/why/when + editor-facing changes (blocks,
  Sidekick, sheet changes) + merchandiser-facing changes
  (Catalog/Live Search) + drop-in version matrix + storefront-visible
  changes + Web Vitals impact + coordinated deploy order (sheet →
  drop-in pin → merge) + preview URL + rollback via `git revert` +
  drop-in pin revert.
- **CC/To:** primary To = `eds-commerce-releases@` +
  `content-editors@` + `merchandising@`; CC = `storefront-devs@`,
  `seo-webperf@`, `api-mesh-ops@` when mesh changes.
- **Attachment/link conventions:** preview branch URL, drop-in
  version diff, Catalog changelog, Live Search rules changelog, PR
  link, storefront preview screenshot.

### Slack announcement (short-form)

- **Channel routing:** `#eds-commerce-releases` (primary) +
  `#content-editors` for block/sheet changes + `#merchandising` for
  Catalog / Live Search + `#storefront-devs` for drop-in bumps +
  `#web-perf` for Web Vitals + `#api-mesh-ops` for mesh + `#seo` for
  structured-data / redirects + `#incidents-eds-commerce`.
- **Emoji convention:** :package: block or drop-in release, :mag:
  Live Search change, :label: catalog change, :shopping_cart:
  storefront-visible, :writing_hand: Sidekick, :satellite: mesh,
  :hammer_and_wrench: breaking, :rotating_light: security.
- **Threading:** top message = one-line release + preview URL +
  coordinated-deploy note (e.g. "sheet at 09:00 UTC, drop-in pin at
  09:15, merge at 09:30"); drop the drop-in version matrix,
  Catalog/Live Search deltas, and mesh resolver diff in thread.
- **Pin:** pin release-day post through T+24h Web Vitals + conversion
  verification.

### Confluence page (documentation-first)

- **Space + location:** `EDS + Commerce` space → `Releases` →
  `v{{version}}`. <!-- verify: your team's Confluence structure -->
- **Long-form sections:** release scope, coordinated deploy timeline
  (sheet → drop-in pin → merge), editor-facing block guide with
  Google Docs example, merchandiser-facing Catalog/Live Search
  changelog with before/after search-result screenshots, drop-in
  version matrix, block code changes consuming drop-ins, mesh
  resolver changes, Web Vitals + conversion baseline vs target,
  rollback playbook.
- **Label conventions:** `eds-commerce`, `release`, `v{{version}}`,
  plus one of `block-launch` / `drop-in-bump` / `catalog-change` /
  `live-search-change` / `mixed`.

### Twitter / LinkedIn (external-facing)

- **Use when:** consumer-visible storefront feature (new PDP layout, new
  loyalty program on storefront, new checkout UX). Skip drop-in-internal,
  merchandising-config-only, or mesh-only changes.
- **Character budget:** Twitter ~280, LinkedIn 3000 with rich media
  (storefront preview screenshot).
- **Hashtag convention:** `#AdobeCommerce #EdgeDeliveryServices
  #Storefront #Headless`. Skip drop-in package names or internal
  taxonomy.

## Stakeholder-tone matrix for EDS + Commerce

| Audience | Email | Slack | Confluence | External |
|---|---|---|---|---|
| Content editors | Block section + Google Docs example | `#content-editors` :writing_hand: | Block authoring guide | — |
| Merchandisers | Catalog + Live Search rule changes | `#merchandising` :mag: :label: | Before/after search screenshots | — |
| Storefront devs | Drop-in matrix + block code deltas | `#storefront-devs` :package: | Version matrix + upgrade snippets | — |
| Storefront consumers | — | — | — | Public storefront-feature post |
| API Mesh ops | Resolver + IMS changes | `#api-mesh-ops` :satellite: | Mesh config changelog | — |
| SEO / Web-perf | Web Vitals + structured-data + redirects | `#web-perf` :chart_with_upwards_trend: | Web Vitals baseline + schema changelog | Rare milestone |

## What to skip / redact per EDS + Commerce

- All EDS redactions (sheet URLs, preview branch URLs, RUM keys).
- All Commerce SaaS redactions (Catalog schemas, Live Search rule
  internals, storefront-events schema, IMS client IDs, API Mesh
  endpoint URLs, mesh resolver source).
- Do NOT publish drop-in **tenant IDs**, IMS org IDs, or Commerce
  Cloud project IDs externally — ever.
- Do NOT publish coordinated deploy timing externally (reveals
  release-ops posture).
- Do NOT publish Catalog Service field names externally without
  merchandising sign-off (competitive taxonomy).
- Do NOT publish Live Search ranking rules externally (competitive
  merchandising strategy).

## Sensitivity classification for EDS + Commerce

- **Block/sheet change** → Editor-facing internal.
- **Catalog attribute add** → Merchandising-internal;
  storefront-visible outcome may be public.
- **Live Search rule change** → Merchandising-internal (competitive).
- **Drop-in bundle bump** → Storefront-dev-internal.
- **Storefront-events schema change** → Dev-restricted.
- **API Mesh resolver change** → Dev-internal.
- **Consumer-facing feature** → Public.
- **Security patch** → Restricted until CVE embargo elapses.

## 3 worked announcement examples for EDS + Commerce

1. **Major feature launch — Loyalty PDP + cart drop-in bump (v2.5.0).**
   Email `[EDS+Commerce] v2.5.0 — Loyalty PDP block + @dropins/storefront-cart
   3.1` to `eds-commerce-releases@` + `content-editors@` +
   `merchandising@` + `storefront-devs@`. Slack coordinated-deploy
   post in `#eds-commerce-releases` :package: pinned + `#content-editors`
   :writing_hand: block guide + `#merchandising` :label: with new
   loyalty tier attribute + `#storefront-devs` :package: version
   matrix + `#web-perf` Web Vitals baseline. Confluence long-form
   with coordinated deploy timeline. LinkedIn post from marketing on
   the loyalty campaign — storefront-facing only, no internal detail.

2. **Breaking change — drop-in schema v3 requiring sheet updates (v2.6.0).**
   Email `[EDS+Commerce] v2.6.0 — BREAKING: @dropins/storefront-pdp
   4.0 schema v3, sheet config updates required`. T-21d pre-notice
   email to `content-editors@` + `storefront-devs@` + T-7d pinned
   Slack in `#content-editors` + `#storefront-devs` +
   `#eds-commerce-releases` with coordinated migration checklist.
   Confluence migration guide with per-page sheet-change table +
   drop-in upgrade snippets. **No external post.**

3. **Hotfix / storefront security patch (v2.5.1).**
   Slack-first `#eds-commerce-releases` + `#storefront-devs`
   :rotating_light: with hotfix summary + drop-in pin bump +
   `git revert` fallback ready + rollback trigger. Email to
   `storefront-devs@` + `eds-commerce-releases@` under CVE-embargo
   language. No Confluence until post-mortem. **No external post.**

## Anti-patterns to avoid for EDS + Commerce

- Don't announce a block that consumes a new drop-in schema without
  the coordinated deploy timeline — editors and storefront-devs will
  race, and the storefront will break in the window.
- Don't announce drop-in bumps in `#content-editors` — they don't
  read version pins; cross-post the editor-facing block change
  instead.
- Don't announce Catalog changes only in `#merchandising` —
  storefront-devs and block owners need the field names too.
- Don't skip the preview URL — hybrid deploys are the highest-risk
  category and reviewers must verify.
- Don't dump both editor + storefront + merchandiser info into one
  email — segment by audience so each reader finds their section
  quickly.
- Don't announce a Web Vitals regression without a rollback plan for
  both git-revert AND drop-in pin revert; hybrid releases have two
  levers.

---

Generate the full announcement using `templates/announcement.md` as
the master, populating placeholders with stack-appropriate content
from the guide above.
