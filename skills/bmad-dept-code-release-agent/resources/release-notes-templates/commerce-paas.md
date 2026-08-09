# Release-notes authoring guide — Adobe Commerce (PaaS / Magento 2)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating release notes for an Adobe Commerce PaaS
(Magento 2 / Magento Cloud) project. Combine with
`templates/release-notes.md` as the master skeleton.

## Purpose framing

Commerce release notes serve merchants, store managers, and platform
operators — anyone who cares whether checkout still works, whether
catalog re-indexing is required, and whether PCI scope has moved.
Any change touching `db_schema.xml`, `di.xml` at the store-scope, or a
payment/tax module must be prominent — these are the change classes
that cause store-front outages. Internal `setup:di:compile` warnings or
test-only Mftf refactors are not release-noteworthy for stakeholders.

## Change categories for Commerce PaaS

- **New extension modules** — vendor modules added under
  `app/code/Vendor/…` or via `composer require`.
- **Plugin changes** — `di.xml` interceptors added, changed, or removed
  (before/after/around); interception order shifts.
- **GraphQL schema additions** — new resolvers under `Magento_GraphQl`,
  new schema fragments in `etc/schema.graphqls`.
- **`db_schema.xml` patches** — column adds, index adds, foreign-key
  adds, and (breaking!) column drops or type narrowing.
- **Data patches** — `Setup/Patch/Data/*` classes run once via
  `setup:upgrade`.
- **Admin form / UI-component changes** — `adminhtml` layout, uiComponent
  XML, `sales_order_view.xml` overrides.
- **PIM / inventory sync changes** — MSI stock source changes, inventory
  reservation rule changes, connector schedule changes.
- **PCI-scope changes** — payment method module additions/removals,
  form-key handling, iframe redirect changes to hosted payment pages.
- **MFTF / integration test additions** — grouped under Testing (usually
  internal-only).
- **Fastly / Varnish config changes** — VCL snippet updates.

## Commit-format conventions for Commerce PaaS

- **Conventional Commits mapping:**
  - `feat(module|graphql|admin): …` → **New features**
  - `fix(checkout|catalog|payment): …` → **Fixes**
  - `perf(indexer|cache|fpc): …` → **Performance**
  - `refactor(di|plugin): …` → **Refactoring**
  - `build(composer|magento-cloud): …` → **CI / build changes**
  - `chore(mftf|test): …` → skip from stakeholder notes
- **Escalate as BREAKING when any commit touches:**
  - `db_schema.xml` with `dropColumn`, `dropTable`, or
    `<column ... nullable="false">` on an existing table
  - `etc/schema.graphqls` with a resolver field removal or type change
  - `di.xml` plugin `sortOrder` change affecting third-party interception
  - Payment / shipping method PID removal
  - `app/etc/env.php` key deletion or default change
  - Any `Setup/Patch/Data` that mutates PII or PCI-scope columns
- **Skip in customer-facing notes:** `test(mftf):` refactors,
  `chore(deps):` bumps that don't cross a major, internal
  `Magento_Backend` UI-tweak refactors.

## Breaking changes for Commerce PaaS

1. **`db_schema.xml` `dropColumn`.** Any consumer of the column breaks.
   *Mitigation:* two-release deprecation cycle + backfill script.
2. **GraphQL resolver removal or type change.** Storefront queries
   break. *Mitigation:* version the resolver, `@deprecated` first.
3. **Plugin sortOrder change.** Third-party interception order flips.
   *Mitigation:* publish the new order + coordinate with vendors.
4. **Payment method module removal.** Existing subscriptions fail.
   *Mitigation:* migration path per subscription + merchant email.
5. **`env.php` key removal.** Cloud env vars orphaned. *Mitigation:*
   `magento-cloud` variable cleanup + `.magento.env.yaml` update.
6. **MSI stock-source reassignment.** Reservations lost.
   *Mitigation:* pre-migration reservation reconciliation.
7. **Fastly VCL snippet with cache-key change.** Full-page-cache miss
   storm. *Mitigation:* warm-up crawl + phased VCL rollout.
8. **Composer `require` crossing a Magento minor.** Extension
   compatibility matrix shifts. *Mitigation:* extension-vendor sign-off.

## Upgrade notes for Commerce PaaS

Guidance on what upgrade notes should include:

- **Post-deploy command sequence** (Magento Cloud runs most of this via
  `ece-tools`; self-hosted must run manually):
  1. `bin/magento maintenance:enable`
  2. `bin/magento setup:upgrade`
  3. `bin/magento setup:di:compile`
  4. `bin/magento setup:static-content:deploy -f <locales>`
  5. `bin/magento cache:clean config block_html full_page`
  6. `bin/magento indexer:reindex` (or specific indexers)
  7. `bin/magento queue:consumers:restart`
  8. `bin/magento maintenance:disable`
- **Database backup** required before every `setup:upgrade` on
  production (Magento Cloud snapshot + logical dump).
- **Fastly cache purge** — `magento-cloud environment:redeploy` or
  targeted purge via Fastly API.
- **PHP version compatibility** — call out any PHP 8.1 → 8.2 → 8.3
  crossings. <!-- verify: current Commerce PHP support -->
- **`composer.lock` refresh** — required when a module version pin changes.
- **Payment gateway sandbox re-verification** — after any payment module change.

## Known issues for Commerce PaaS

Typical known-issues to disclose:

- `product_flat_1` reindex takes 12+ minutes on catalogs > 500k SKUs;
  schedule off-peak.
- Admin session timeout in the "Order Grid" mass-action can lose
  selection state (workaround: apply filters first).
- MFTF suite occasionally flakes on the checkout test due to a Fastly
  cache-warming race (retry logic in CI already covers).
- GraphQL `products` query slow (>3s) on categories with 10k+ SKUs when
  `useNaturalOrder` is off. <!-- verify: current perf profile -->
- Message-queue consumer restart post-deploy sometimes leaves
  `catalog_product_price` in a stalled state; `bin/magento
  queue:consumers:start catalog_product_price` recovers.

## Contributor + PR/ticket linking conventions

- **Jira project keys:** typically `MC-####` (Magento Commerce internal),
  `AC-####` (Adobe Commerce), or customer-specific (e.g. `SHOP-####`);
  surface via `Fixes: AC-1234` commit trailers.
- **PR links:** GitHub `owner/commerce#456`; magento.com issue tracker
  `magento/magento2#98765` for upstream tickets.
- **Magento Cloud deploy ID** — reference the environment + deploy hash
  (`environment: master, deploy: 3f9a2b1`).
- **Extension marketplace refs** — link the marketplace SKU for any
  new/updated vendor extension.

## 3 worked release-notes examples for Commerce PaaS

**v3.1.0 — Loyalty rewards module (2026-05-02).**
- **New:** `Vendor_Loyalty` module, admin config under Stores →
  Configuration → Loyalty, GraphQL resolvers `customer.loyaltyBalance`
  and `Mutation.redeemLoyaltyPoints`.
- **Fixed:** Checkout crash when shipping method free-shipping-plus and
  cart contains virtual item (Jira AC-2109).
- **Perf:** `catalog_product_price` reindex -40% via new composite index
  in `db_schema.xml`.
- **Upgrade:** `setup:upgrade` + `setup:di:compile` + full FPC clean.
  Composer `composer require vendor/loyalty:^1.0`.
- **Known issue:** GraphQL `redeemLoyaltyPoints` mutation returns 200
  even when balance insufficient (fix targeted v3.1.1).

**v3.1.1 — Checkout hotfix (2026-05-06).**
- **Fixed:** Loyalty redemption bypass on negative balances (AC-2131,
  MEDIUM severity, no financial exposure verified by Finance).
- **Breaking:** `Vendor_Loyalty` DI plugin `sortOrder` changed 10 → 30
  to run after tax calculation. Consumers using an earlier sortOrder
  must reorder.
- **Upgrade:** `setup:di:compile` + FPC purge.

**v3.2.0 — MSI reorganization (2026-06-11).**
- **Breaking:** MSI stock source `default` split into `default_us` and
  `default_eu`. All reservations reconciled via pre-deploy patch.
- **New:** `Sales/Patch/Data/ReconcileReservations.php` runs once via
  `setup:upgrade`.
- **Upgrade:** Full DB backup + Magento Cloud snapshot before deploy.
  Rolling deploy across the Cloud app-tier not supported — expect
  `maintenance:enable` window (~15 min).
- **Known issue:** Admin "Inventory → Sources" grid slow to sort on
  first load post-deploy; warms after 2-3 pageviews.

## Anti-patterns to avoid for Commerce PaaS

- **Buried `db_schema.xml` diffs.** Schema changes must lead the release
  notes; ops teams need to size the maintenance window from them.
- **Composer `require` without extension-compatibility matrix.** Third-party
  extensions break silently.
- **Skipping the reindex list.** Merchants need to know which indexers
  will re-run and how long.
- **Undocumented PCI-scope shifts.** Any payment / tokenization change
  must appear even if code diff is small — Security signs off on the
  release notes.
- **Listing MFTF refactors as features.** Merchants don't care;
  developer changelog is a separate artifact.

---

Generate the full release notes using `templates/release-notes.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
