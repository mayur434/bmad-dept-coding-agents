# Pre-merge review guide — Adobe Commerce PaaS (Magento 2)

## What pre-merge review catches (vs Audit's deep scan)

Pre-merge review flags what's visible in the diff — a new plugin's
`sortOrder`, a `di.xml` preference missing its scope, a query missing a
collection filter — the things a senior Magento developer would catch
reading the PR itself. It does not replay Audit's exhaustive
`COMM-DEPLOY-*` cloud-pipeline checks (Redis prefix collisions,
`db_schema_whitelist.json` drift, SCD locale/theme mismatches) — those
require environment and full-module context a diff alone doesn't carry.

## Common pre-merge red flags for Commerce PaaS

1. **New plugin (`di.xml` `<plugin>`) with a `sortOrder` that isn't
   checked against existing plugins on the same method.** Diff adds a
   plugin without checking `bin/magento dev:query:xml` output for
   conflicts. Fix: state the intended ordering relative to known
   plugins in the PR description.
2. **`around` plugin added where a `before`/`after` would suffice.**
   `around` plugins block full-page-cache eligibility and are harder to
   reason about. Fix: prefer `before`/`after` unless you genuinely need
   to short-circuit or wrap the call.
3. **New collection loaded without a filter, in a loop, or without
   `setPageSize`.** N+1 or full-table load. Fix: filter early, batch,
   or use a direct query for aggregate needs.
4. **Direct `ObjectManager::getInstance()` call added instead of
   constructor DI.** Breaks testability and DI container guarantees.
   Fix: inject via constructor.
5. **New admin controller without an `ADMIN_RESOURCE`/ACL check.**
   Privilege-escalation risk. Fix: declare `const ADMIN_RESOURCE` and
   confirm `acl.xml` entry exists.
6. **Raw SQL string concatenation added (`"WHERE id = " . $id`).** SQL
   injection. Fix: bound parameters via the `Zend_Db`/adapter API.
7. **New `.phtml` template with unescaped output** (`<?= $var ?>`
   instead of `$block->escapeHtml($var)`). XSS. Fix: escape per context
   (`escapeHtml`, `escapeUrl`, `escapeJs`).
8. **New GraphQL resolver doing a per-item DB call inside a loop** instead
   of a DataLoader/batch pattern. Storefront latency regression.
9. **New cron job with no lock/overlap guard.** Diff adds a
   `crontab.xml` entry without checking `cron_expr` for overlap risk on
   long-running jobs. Fix: add a lock (e.g. `LockManagerInterface`) or
   confirm the job is idempotent under overlap.
10. **New `catalog_product_entity`-adjacent schema change without a
    matching `db_schema_whitelist.json` entry.** Deployment will drop
    the column/table on the next `setup:upgrade` unless whitelisted.
11. **Missing `strict_types(1)` declaration on a new PHP file** in a
    codebase that otherwise enforces it — inconsistent type coercion
    behavior.
12. **Full page cache compatibility not considered for a new block**
    (no `getCacheKeyInfo()` override on customer/cart-specific content).

## Style-guide highlights for Commerce PaaS

- `strict_types(1)` at the top of new PHP files (per `COMM-STD-001`
  convention).
- Constructor property promotion / explicit typed properties over
  untyped `protected $foo`.
- Module naming: `Vendor_Module` PSR-4 namespace matches the directory
  under `app/code/Vendor/Module`.
- `di.xml` preferences and plugins scoped to the narrowest applicable
  `<type>` — avoid preferencing `\Magento\Framework\*` core types
  globally when a more specific type will do.
- Layout XML: block class references use fully-qualified names; no
  inline PHP logic in `.phtml` beyond simple `$block->` calls — logic
  belongs in the Block class.
- GraphQL schema changes follow the existing `schema.graphqls` naming
  and deprecate (don't silently remove) fields.

## Breaking-change signals for Commerce PaaS

- A `di.xml` `<preference>` removed or repointed to a different
  implementation — anything depending on the old implementation's
  concrete behavior breaks.
- A public interface method signature changed in a module other modules
  depend on (`COMM-COMPAT-001`).
- A GraphQL schema field removed or its type narrowed without a
  deprecation cycle.
- A REST/GraphQL endpoint's required-parameter set changed.
- An event name renamed/removed in `events.xml` — silently breaks any
  observer (including third-party extensions) listening for the old name.
- A `db_schema.xml` column type narrowed or a column removed without a
  data-migration/`data-patch`.

## Dependency-change signals for Commerce PaaS

Watch `composer.json`/`composer.lock`. A risky bump: a major-version
jump on `magento/framework` or `magento/module-*` packages (check the
target Commerce release compatibility matrix), a third-party package
added directly rather than declared as an explicit `require` (implicit
transitive reliance), or a missing `composer.lock` update alongside a
`composer.json` version bump (`COMM-DEPLOY-008`) — deployment will
resolve a different version than what was tested.

## Design-pattern checks for Commerce PaaS

- Business logic placed in a `.phtml` template instead of the Block/
  ViewModel class (`COMM-FRONT-001`/`COMM-BIZ-001`).
- Fat constructor — a new class taking 8+ constructor dependencies
  instead of a factory or a narrower interface (`COMM-METRICS-002`).
- God class growth — a new public method added to an already
  1000+-line class instead of extracting a collaborator.
- Direct `ObjectManager` usage anywhere outside a factory/proxy context.

Cross-ref `resources/pattern-libraries/commerce-paas.md` (forthcoming)
for the full anti-pattern catalog.

## Pre-merge checklist items specific to Commerce PaaS

- [ ] New plugins checked for `sortOrder` conflicts with existing plugins.
- [ ] New collections are filtered/paginated, not loaded unbounded.
- [ ] New admin controllers declare `ADMIN_RESOURCE` + matching `acl.xml`.
- [ ] New `.phtml` output is escaped per context.
- [ ] `composer.lock` committed alongside any `composer.json` change.
- [ ] Schema changes have a matching `db_schema_whitelist.json` entry.
- [ ] New cron jobs have an overlap/lock guard.

## 2 worked review examples for Commerce PaaS

**Example 1 — unfiltered collection in a loop.**
```php
// Model/PromotionApplier.php (+6 lines)
$products = $this->productCollectionFactory->create();
foreach ($products as $product) {
    $this->applyPromotion($product);
}
```
Review comments:
- 🔴 CRITICAL — no filter/page size on `$products` — loads the entire
  catalog into memory. Add `addFieldToFilter(...)` and page through
  results.
- 🟠 HIGH — `applyPromotion()` likely does a save per item inside the
  loop — check for N+1 writes; batch via `massAction` if available.

**Example 2 — around plugin blocking FPC.**
```xml
<!-- etc/di.xml (new plugin) -->
<type name="Magento\Checkout\Model\Cart">
    <plugin name="mysite_cart_around" type="Vendor\Module\Plugin\CartPlugin" sortOrder="10"/>
</type>
```
```php
public function aroundGetItems(Cart $subject, callable $proceed) {
    $items = $proceed();
    return $this->filterItems($items);
}
```
Review comments:
- 🟡 MEDIUM — `aroundGetItems` could be a simpler `afterGetItems` since
  `$proceed()` is always called unconditionally — switch to `after` for
  clarity and slightly less overhead.
- 🔵 LOW — no `sortOrder` conflict check documented; confirm against
  other `Cart` plugins.

## Anti-patterns to avoid IN THE REVIEW ITSELF

- Don't block on PSR-12 formatting nits — that's `phpcs`'s job.
- Don't demand a full data-patch for every schema tweak on a table with
  zero production rows yet (new feature, unreleased) — reviewer
  judgment applies.
- Don't insist every `around` plugin is wrong — some genuinely need to
  short-circuit; flag only when `before`/`after` would clearly suffice.
- Don't treat every `ObjectManager` reference as a violation without
  checking whether it's inside a factory/proxy class where it's the
  correct pattern.

Generate the full review using `templates/review-comment.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
