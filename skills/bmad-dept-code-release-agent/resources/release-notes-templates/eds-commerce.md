# Release-notes authoring guide — EDS + Commerce (hybrid)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating release notes for an Edge Delivery Services
(EDS) storefront integrated with Adobe Commerce SaaS drop-ins.
Combine with `templates/release-notes.md` as the master skeleton.

## Purpose framing

EDS+Commerce release notes must speak to *three* audiences at once —
editorial (block/content changes), storefront developers (drop-in
version compatibility), and merchandising / PIM (Catalog Service +
Live Search behavior). Every release must name (a) which drop-in
versions are pinned, (b) whether API Mesh and Catalog Service require
sequenced updates, and (c) which git commits deployed to edge via the
standard EDS merge-to-main flow. Compatibility is the through-line —
a drop-in bump that ships ahead of its matching Catalog Service field
breaks silently.

## Change categories for EDS+Commerce

- **Drop-in bundle upgrades** — `@dropins/storefront-cart`,
  `@dropins/storefront-checkout`, `@dropins/storefront-pdp`,
  `@dropins/storefront-account` version bumps in `package.json`.
- **Commerce block additions / updates** — `blocks/product-details`,
  `blocks/cart`, `blocks/checkout` and other blocks that host drop-ins.
- **Cart / checkout event schema changes** — `add_to_cart`,
  `begin_checkout`, `purchase` event payload shape.
- **API Mesh source changes** — mesh sources feeding storefront
  queries; resolver overrides.
- **Catalog Service field additions** — new PIM-side attributes
  surfaced storefront-side.
- **Live Search config changes** — facets, ranking rules, synonyms,
  redirects.
- **Payment Services surface changes** — new payment methods rendered
  by the checkout drop-in.
- **Consent / privacy config changes** — CMP integration, consent-mode
  gating on Commerce events.
- **EDS-side edge config** — `paths.json`, `redirects.xlsx`,
  `head.html`, `helix-query.yaml` (same rules as pure EDS).

## Commit-format conventions for EDS+Commerce

- **Conventional Commits mapping:**
  - `feat(dropin|block|checkout|catalog): …` → **New features**
  - `fix(cart|checkout|payment|events): …` → **Fixes**
  - `perf(dropin|mesh|head): …` → **Performance**
  - `refactor(block|mesh): …` → **Refactoring**
  - `build(package|edge): …` → **CI / build changes**
  - `chore(deps|consent-config): …` → grouped depending on impact
- **Escalate as BREAKING when any commit touches:**
  - Drop-in bundle major version bump (`^1.x` → `^2.x`)
  - `add_to_cart` / `purchase` event schema field removal or rename
  - API Mesh resolver removal used by a Commerce block
  - Catalog Service field removal that a block reads
  - Live Search facet removal (SRP URLs 404)
  - Checkout block extension-point rename (payment methods orphaned)
  - Consent-mode default change that suppresses Commerce events
- **Skip in customer-facing notes:** `chore(fmt):`, `chore(deps):`
  drop-in patch bumps with unchanged public API, internal analytics-tag
  reformats.

## Breaking changes for EDS+Commerce

1. **Drop-in bundle major bump.** Public API of the drop-in shifts;
   block-side glue code likely needs updates. *Mitigation:* pin +
   migrate on a branch preview first.
2. **`purchase` event field removal.** GA4 / AEP conversion pipelines
   break. *Mitigation:* dual-emit for one release cycle.
3. **Catalog Service field removal.** PDP block renders empty
   attribute rows. *Mitigation:* one-release deprecation; migrate to
   new field first.
4. **Live Search facet removal.** SRP bookmarked filter URLs 404.
   *Mitigation:* 301s + SEO team notice.
5. **API Mesh resolver removal.** Storefront query fails.
   *Mitigation:* mesh deploy sequenced before storefront branch merge.
6. **Consent-mode default change.** Commerce events suppressed; funnel
   metrics distort. *Mitigation:* CMP reload + baseline reset.
7. **Payment Services method removal.** Saved-payment tokens orphaned.
   *Mitigation:* customer email + graceful UI fallback.
8. **Drop-in / Catalog Service version mismatch.** Silent crash inside
   drop-in on missing field. *Mitigation:* explicit compatibility
   matrix in release notes.

## Upgrade notes for EDS+Commerce

Guidance on what upgrade notes should include:

- **Deploy sequence:**
  1. Rotate secrets in App Builder workspace (if changed).
  2. `aio api-mesh update` mesh redeploy (BEFORE storefront when new
     resolver; AFTER when deprecating one).
  3. Trigger PIM publish for new Catalog Service fields.
  4. Verify Catalog Service field is indexed (check via mesh query).
  5. Merge storefront branch to `main` → EDS auto-deploys.
  6. `hlx purge` targeted for Commerce routes that changed.
  7. Flip feature-flags per-market.
- **Drop-in compatibility matrix** — pin exact drop-in versions and
  cite the matching backend service versions (Catalog Service /
  Payment Services / Live Search) verified against.
- **Consent-mode reload** required after event schema changes.
- **Preview URL** for QA on the branch.
- **Payment sandbox re-verification** on any Payment Services change.
- **Instant rollback** via `git revert` for EDS-side; drop-in version
  pinning rolls back independently.

## Known issues for EDS+Commerce

Typical known-issues to disclose:

- Drop-in cart hydration flash on slow 3G (Adobe tracking).
- PIM publish → storefront-visible latency ~2 min on peak indexing.
- Payment Services 3DS challenge occasional fail on Safari 17.2 +
  strict-tracking (fallback to redirect).
- Live Search facet count off-by-one on synonym cross-attribute matches.
- Cart drop-in localStorage occasionally out-of-sync with mesh cart
  on cross-tab navigation (workaround: session-sync poll).
- EDS-side LCP regression window ~2s post-deploy on cold-cache Commerce
  routes.

## Contributor + PR/ticket linking conventions

- **Jira project keys:** typically `AC-####` (Commerce),
  `EDS-####` (edge), or a shared program key like `SHOP-####`.
- **PR links:** GitHub `owner/eds-commerce-site#456`.
- **Preview URL:** always include the preview URL
  (`https://<branch>--<repo>--<owner>.hlx.page/…`) for QA.
- **Drop-in versions:** cite each drop-in + version pinned by the
  release (`@dropins/storefront-cart@1.4.2`).
- **API Mesh mesh ID + workspace** — cite the redeploy identifiers.
- **PIM publish reference** — job ID that populated any new indexed
  field.

## 3 worked release-notes examples for EDS+Commerce

**v1.6.0 — Product bundles storefront (2026-04-22).**
- **New:** `blocks/product-details` upgraded to
  `@dropins/storefront-pdp@1.5.0` with bundle support; Live Search
  facet "Bundle type"; Catalog Service fields `bundleOptions`,
  `bundlePricingType`.
- **Fixed:** Cart drop-in localStorage race on cross-tab (Jira AC-3120).
- **Perf:** `blocks/cart` p95 -180ms via mesh-side caching.
- **Upgrade:** rotate `MESH_API_KEY` in App Builder prod workspace;
  `aio api-mesh update` mesh redeploy; PIM publish for new attributes;
  merge storefront to `main`; `hlx purge /products/**`.
- **Compat:** `@dropins/storefront-pdp@1.5.0` verified against
  Catalog Service `bundleOptions` schema v3.
- **Known issue:** bundle price display flickers once on hydration.

**v1.6.1 — Cart event patch (2026-04-28).**
- **Breaking:** `add_to_cart` event `product.price` renamed to
  `product.priceUnit` for consistency across drop-ins. GA4 + AEP
  pipelines updated in advance.
- **Fixed:** Consent-gating race that emitted `page_view` before CMP
  loaded on cold cache (EDS-905).
- **Upgrade:** CMP consent-mode reload; re-baseline GA4 conversion
  reports; verify AEP inlet.
- **Compat:** drop-ins unchanged from v1.6.0.

**v2.0.0 — Klarna checkout + Node 20 (2026-05-30).**
- **Breaking:** App Builder actions on Node 20; secrets rotated;
  App Builder workspace re-deployed.
- **New:** Klarna surfaced in `blocks/checkout` via
  `@dropins/storefront-checkout@2.1.0`; new event field
  `paymentMethod.klarnaSessionId`.
- **Fixed:** Live Search redirect-rule collision when two rules match
  the same query string.
- **Upgrade:** payment sandbox re-verify; `aio app deploy --workspace
  prod`; feature-flag `payment.klarna.enabled` flipped per-market
  AFTER storefront deploy; `hlx purge /checkout/**`.
- **Compat:** `@dropins/storefront-checkout@2.1.0` verified against
  Payment Services v4 Klarna adapter.
- **Known issue:** Klarna widget loads late on Safari 17.2 iOS.

## Anti-patterns to avoid for EDS+Commerce

- **Drop-in bump without a compatibility matrix.** Silent runtime crash
  inside the drop-in when a backend field is missing.
- **Missing mesh-vs-storefront deploy ordering.** Storefront 500s
  during the window between merges.
- **PIM-side field changes not surfaced.** Merchandising discovers via
  missing PDP attribute.
- **Consent-mode change without a CMP reload note.** Analytics teams
  discover from broken funnels.
- **Listing block-only refactors as customer-visible.** Editorial and
  merchandising skim past irrelevant lines; hide these under an
  "internal" grouping or omit.

---

Generate the full release notes using `templates/release-notes.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
