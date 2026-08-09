# Announcement authoring guide — Adobe Commerce SaaS

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a multi-channel release announcement for an
Adobe Commerce SaaS project (Catalog Service, Live Search, storefront
drop-ins). Combine with `templates/announcement.md` as the master
skeleton.

## Purpose framing

Commerce SaaS announcements are shaped by the platform model: the
backend rolls forward on Adobe's cadence, and the customer team ships
the **edge and storefront** — drop-in bundle version pins, Catalog
Service field configurations, Live Search rankings, and API Mesh
resolver changes. That means announcements typically speak to
**drop-in-consumer developers** (what bundle version pins moved), the
**merchandising team** (Catalog/Live Search tuning knobs that changed),
and **storefront consumers** (what they'll see). What makes this stack
unique: there is no admin panel of the PaaS variety; merchandisers work
in Commerce Cloud UI + Live Search rules UI, so the announcement often
routes to product/merchandising rather than IT.

## Audience segmentation for Commerce SaaS

- **Drop-in developers** *(primary)* — bundle-version pin bumps,
  storefront-events schema deltas, API Mesh resolver changes.
- **Merchandising team** — Catalog Service attribute additions, Live
  Search ranking rule changes, facet configuration deltas.
- **Storefront consumers** — visible PDP/PLP/checkout changes.
- **Content editors (when EDS-fronted)** — sheet-config changes that
  land at the same time (see also `eds-commerce.md`).
- **Adobe I/O / integration owners** — IMS client rotations, API Mesh
  endpoint changes.

## Channel-by-channel guidance for Commerce SaaS

### Email announcement (long-form)

- **Subject line pattern:** `[Commerce SaaS] v{{version}} — Drop-in
  {{bundle}} + {{feature}}` (e.g. `[Commerce SaaS] v2.5.0 —
  @dropins/storefront-cart 3.1 + free-shipping banner`).
- **Body sections:** what/why/when + drop-in version matrix + Catalog
  Service field changes + Live Search rule changes + API Mesh resolver
  changes + storefront-visible behavior + rollback via version pin
  revert.
- **CC/To:** primary To = `commerce-saas-releases@`; CC =
  `merchandising@`, `storefront-devs@`, `api-mesh-ops@` when mesh
  changes.
- **Attachment/link conventions:** drop-in package version diff,
  storefront preview URL, Live Search rules changelog link, API Mesh
  config PR link.

### Slack announcement (short-form)

- **Channel routing:** `#commerce-saas-releases` (primary) +
  `#storefront-devs` for drop-in bumps + `#merchandising` for
  Catalog/Live Search changes + `#api-mesh-ops` for resolver changes.
- **Emoji convention:** :package: drop-in bump, :mag: Live Search
  ranking change, :label: catalog attribute change, :satellite: mesh
  resolver change, :hammer_and_wrench: breaking, :rotating_light:
  security.
- **Threading:** top message = drop-in version matrix + one-line
  headline; drop the API Mesh resolver diff, Live Search rule diff, and
  Catalog field diff into the thread.
- **Pin:** pin release-day post; keep pinned through T+24h storefront
  KPI verification.

### Confluence page (documentation-first)

- **Space + location:** `Commerce SaaS` space → `Releases` →
  `v{{version}}`. <!-- verify: your team's Confluence structure -->
- **Long-form sections:** release scope, drop-in version matrix
  (before/after per bundle), Catalog Service field changelog, Live
  Search ranking rule changelog with **before/after search-result
  screenshots**, API Mesh resolver changelog, storefront preview URL,
  observability signals (Web Vitals, conversion) to watch, rollback
  playbook (version-pin revert).
- **Label conventions:** `commerce-saas`, `release`, `v{{version}}`,
  plus one of `drop-in-bump` / `catalog-change` / `live-search-change`
  / `mesh-change` / `storefront-change`.

### Twitter / LinkedIn (external-facing)

- **Use when:** consumer-visible storefront feature (new checkout flow,
  new PDP UX, new search-result experience). Skip drop-in-internal or
  resolver-only changes.
- **Character budget:** Twitter ~280, LinkedIn 3000 with rich media
  (storefront preview screenshot).
- **Hashtag convention:** `#AdobeCommerce #Storefront #Headless`. Skip
  `#DropIns` — internal terminology.

## Stakeholder-tone matrix for Commerce SaaS

| Audience | Email | Slack | Confluence | External |
|---|---|---|---|---|
| Drop-in developers | Version matrix + breaking schema deltas | `#storefront-devs` :package: | Version matrix + upgrade code snippets | — |
| Merchandising | Catalog + Live Search rule changes | `#merchandising` :mag: :label: | Before/after search screenshots + facet changelog | — |
| Storefront consumers | — | — | — | Public storefront-feature post |
| API Mesh ops | Resolver + IMS client changes | `#api-mesh-ops` :satellite: | Mesh config changelog | — |
| Content editors (EDS) | Sheet-config sync notes | `#content-editors` cross-post | Sync runbook | — |

## What to skip / redact per Commerce SaaS

- Do NOT publish Catalog Service field names/schemas externally
  without merchandising sign-off — internal taxonomy leakage.
- Do NOT publish API Mesh endpoint URLs or resolver source externally.
- Do NOT publish IMS client IDs or technical-account emails externally.
- Do NOT publish Live Search ranking rule internals externally
  (competitive intelligence).
- Do NOT publish storefront-events schema internals externally without
  a versioned public-schema statement.
- Do NOT dump `@dropins/*` npm package internals — link to the bundle
  changelog instead.

## Sensitivity classification for Commerce SaaS

- **Drop-in bundle bump** → Storefront-dev-internal; consumer-visible
  outcome may be public.
- **Catalog attribute add** → Merchandising-internal; storefront-visible
  when surfaced in PDP.
- **Live Search rule change** → Merchandising-internal (competitive
  info); consumer-visible outcome is public.
- **Storefront-events schema change** → Dev-restricted (contract for
  analytics/CDP consumers).
- **API Mesh resolver change** → Dev-internal; never public.
- **Consumer-facing feature** → Public.

## 3 worked announcement examples for Commerce SaaS

1. **Major feature launch — Free-shipping banner + cart 3.1 (v2.5.0).**
   Email `[Commerce SaaS] v2.5.0 — @dropins/storefront-cart 3.1 +
   free-shipping banner live` to `commerce-saas-releases@` +
   `merchandising@` + `storefront-devs@`. Slack `#commerce-saas-releases`
   :package: pinned + `#merchandising` :label: with cart-rule
   walkthrough + `#storefront-devs` version-matrix thread. Confluence
   long-form with storefront preview screenshots. LinkedIn post from
   marketing on the free-shipping campaign.

2. **Breaking change — storefront-events schema v2 (v2.6.0).**
   Email `[Commerce SaaS] v2.6.0 — BREAKING: storefront-events schema
   v2, analytics consumers must update`. T-30d pre-notice email to
   `analytics-consumers@`, T-7d pinned Slack in `#storefront-devs` +
   `#analytics-eng`. Confluence migration guide with per-event field
   mapping table. **No external post.**

3. **Hotfix / drop-in patch (v2.5.1).**
   Slack-first `#commerce-saas-releases` + `#storefront-devs`
   :rotating_light: `@dropins/storefront-checkout 3.1.1 shipped —
   fixes tokenization intermittency, rollback via pin revert`. Email
   follow-up after storefront metrics confirm stable. **No Confluence
   unless post-mortem.** **No external post.**

## Anti-patterns to avoid for Commerce SaaS

- Don't announce a drop-in bump without the version matrix — devs need
  before/after per bundle to know what to pin.
- Don't announce Live Search changes to a dev-only channel —
  merchandising is the primary audience for search relevance.
- Don't announce Catalog Service field additions externally without
  merchandising approval — competitive taxonomy leakage.
- Don't skip the storefront preview URL — devs and merchandisers both
  want a live check before ship.
- Don't dump raw storefront-events schema externally — publish a
  versioned public schema doc instead.

---

Generate the full announcement using `templates/announcement.md` as
the master, populating placeholders with stack-appropriate content
from the guide above.
