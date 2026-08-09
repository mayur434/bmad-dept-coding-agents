# Release-notes authoring guide — Adobe Commerce SaaS

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating release notes for an Adobe Commerce SaaS
project (Catalog Service / Live Search / Payment Services / storefront
drop-ins). Combine with `templates/release-notes.md` as the master
skeleton.

## Purpose framing

Commerce SaaS release notes describe *storefront-side* changes — the
drop-in bundles, edge-side integration code, and Adobe-managed service
configurations that the merchant team controls. The backend platform
(Catalog Service, Live Search, Payment Services) is Adobe-operated and
versions independently; call out any drop-in bundle bump that requires
a matching backend schema version. Store managers care most about
which storefront features change; PIM/merchandising cares which
Catalog Service field is now queryable; on-call cares which drop-in
version is deployed edge-side.

## Change categories for Commerce SaaS

- **Drop-in version bumps** — `@dropins/storefront-cart`,
  `@dropins/storefront-checkout`, `@dropins/storefront-account`, etc.
  in `package.json`.
- **Catalog Service field additions / mappings** — new PIM-side
  attributes indexed into Catalog Service and consumed on storefront.
- **Storefront-events schema changes** — event names, payload shape,
  consent gating rules.
- **Live Search config changes** — facet definitions, ranking rules,
  synonyms, redirects.
- **Payment Services changes** — new payment methods surfaced, order
  metadata changes, 3DS challenge flow tweaks.
- **API Mesh resolver changes** — new mesh sources, resolver overrides,
  auth-header changes.
- **Storefront (EDS) block or template changes** — added/updated
  Commerce blocks in the EDS repo.
- **Feature-flag additions** — new dark-launched features gated behind
  a config flag or targeted rollout cohort.

## Commit-format conventions for Commerce SaaS

- **Conventional Commits mapping:**
  - `feat(dropin|catalog|live-search): …` → **New features**
  - `fix(checkout|events|payment): …` → **Fixes**
  - `perf(dropin|mesh): …` → **Performance**
  - `refactor(mesh|resolver): …` → **Refactoring**
  - `build(package|edge): …` → **CI / build changes**
  - `chore(config|flag): …` → grouped as CI when internal
- **Escalate as BREAKING when any commit touches:**
  - Drop-in bundle major version bump (`^1.x` → `^2.x`)
  - Storefront-events payload field removal or rename
  - Catalog Service field removal from the indexed schema
  - Live Search facet removal (bookmarked SRP URLs break)
  - Payment Services `paymentIntentId` shape change
  - API Mesh resolver source removal
- **Skip in customer-facing notes:** internal mesh-resolver logging
  additions, `chore(deps):` drop-in patch bumps without observable
  behavior change, `test:` visual-regression snapshot refreshes.

## Breaking changes for Commerce SaaS

1. **Drop-in bundle major bump.** Public API of the drop-in shifts.
   *Mitigation:* pin-and-migrate window; changelog link from vendor.
2. **Storefront-event field removal.** Downstream event consumers
   (Adobe Experience Platform, GA4, LaunchDarkly) break silently.
   *Mitigation:* dual-emit for one release cycle.
3. **Catalog Service field removal.** Storefront queries return null.
   *Mitigation:* one-release deprecation notice + PIM migration.
4. **Live Search facet removal.** URLs with `?color=red&size=M`
   filters 404 or return empty. *Mitigation:* 301 rules + SEO warning.
5. **Payment Services method disabled.** Saved-payment tokens orphaned.
   *Mitigation:* customer email + graceful UI fallback.
6. **API Mesh source URL change.** Storefront requests routed away.
   *Mitigation:* mesh redeploy sequenced before storefront deploy.
7. **Consent-mode default change.** Previously-tracked events now
   suppressed. *Mitigation:* CMP re-consent flow + analytics baseline
   reset.
8. **IMS client ID rotation.** Storefront auth fails. *Mitigation:*
   pre-deploy rotation + secret propagation via edge config.

## Upgrade notes for Commerce SaaS

Guidance on what upgrade notes should include:

- **Drop-in bundle deploy sequence** — bump `package.json`, `npm run
  build`, verify storefront `preview` URL, then merge to `main` for
  edge deploy.
- **API Mesh redeploy** ordering — mesh redeploys BEFORE storefront
  when the release adds a new resolver; AFTER when it deprecates one.
- **Catalog Service reindex** — if a new field is added, trigger PIM
  publish + verify indexing complete before storefront deploy.
- **Feature-flag flip** — call out any flag that must be flipped ON
  after Catalog Service is ready.
- **CMP / consent-mode reload** required after storefront-events
  schema changes.
- **`aio api-mesh update` command** to redeploy the mesh, plus any
  `aio app config set` for workspace secrets.
- **Storefront edge cache purge** — helix cache warm command post-deploy.
- **Payment sandbox re-verification** for any Payment Services change.

## Known issues for Commerce SaaS

Typical known-issues to disclose:

- Drop-in cart hydration flash on slow 3G — Adobe tracking as
  `dropin-cart#123`. <!-- verify: current tracker -->
- Live Search facet count off-by-one when a synonym rule intersects
  multiple attributes.
- Storefront-events buffered up to 500ms during PLP → PDP navigation
  (analytics team notified).
- Catalog Service PIM publish → storefront-visible latency ~2 min
  during peak indexing hours.
- Payment Services 3DS challenge occasionally fails on Safari 17.2
  with strict-tracking enabled (fallback to redirect flow).

## Contributor + PR/ticket linking conventions

- **Jira project keys:** typically `AC-####` (Adobe Commerce),
  `SFCC-####` for storefront customer-composed features, or
  customer-specific.
- **PR links:** GitHub `owner/commerce-storefront#456` for the EDS repo;
  drop-in vendor issues link out to `adobe/dropins-storefront#789`.
- **Adobe I/O App Builder deployment ID** — reference the workspace +
  action-set hash (`workspace: prod, actions: 3f2a1b`).
- **API Mesh mesh ID** — surface the mesh ID + updated resolver list.
- **Catalog Service publish reference** — PIM publish job ID that
  populated any new indexed field.

## 3 worked release-notes examples for Commerce SaaS

**v1.4.0 — Product bundles for storefront (2026-04-18).**
- **New:** Bundle-product support in `@dropins/storefront-pdp@1.5.0`;
  Catalog Service new indexed fields `bundleOptions`,
  `bundlePricingType`; Live Search facet "Bundle type".
- **Fixed:** Cart drop-in double-fetches on route change (Jira AC-3021).
- **Perf:** API Mesh `productBySku` resolver p95 -180ms via mesh-side
  caching.
- **Upgrade:** `npm install` to pull `@dropins/storefront-pdp@1.5.0`;
  PIM publish for new attributes; `aio api-mesh update` mesh redeploy
  BEFORE storefront merge.
- **Known issue:** Bundle price display flickers once on hydration.

**v1.4.1 — Storefront-events schema patch (2026-04-24).**
- **Breaking:** `add_to_cart` event `product.price` field renamed to
  `product.priceUnit`. Analytics + AEP pipelines updated.
- **Fixed:** Consent gating race that emitted `page_view` before CMP
  loaded on cold cache.
- **Upgrade:** CMP consent-mode reload; re-baseline GA4 conversion
  reports; verify AEP inlet in Data Prep.

**v1.5.0 — Payment Services Klarna (2026-05-15).**
- **New:** Klarna surfaced in checkout via Payment Services;
  post-purchase order metadata `klarnaSessionId` in event payload.
- **Fixed:** Live Search redirect rule collision when two rules match
  same query string.
- **Upgrade:** Payment sandbox re-verification (Klarna sandbox creds
  rotated in workspace); feature-flag `payment.klarna.enabled` flipped
  ON post-deploy per market.
- **Known issue:** Klarna widget loads late on Safari 17.2 iOS
  (workaround: force widget preload script).

## Anti-patterns to avoid for Commerce SaaS

- **Missing drop-in version pin.** Auto-upgrade of a drop-in in `^1.x`
  range can silently change behavior; pin exact for stakeholder-visible
  releases.
- **Undocumented storefront-events changes.** Analytics teams operate
  downstream; a rename with no notice breaks funnels.
- **API Mesh deploy ordering unstated.** Storefront deploy without
  matching mesh update returns 500s.
- **Consent-mode changes without a CMP reload note.** Trust and Safety
  team needs to know.
- **PIM-side changes not surfaced in release notes.** Merchandising
  discovers via missing facet on the SRP.

---

Generate the full release notes using `templates/release-notes.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
