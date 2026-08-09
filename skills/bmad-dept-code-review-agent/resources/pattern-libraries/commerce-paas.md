# Design-pattern violation catalog — Adobe Commerce PaaS (Magento 2)

## Purpose framing

This catalog is the exhaustive companion to
`resources/review-templates/commerce-paas.md`'s short "Design-pattern
checks" section — canonical Magento 2 anti-patterns a senior developer
would flag reading a diff, each with the fix and a worked before/after.
Code Review loads this file when `--artifacts design-patterns` (or
`all`) is requested against the `commerce-paas` engine.

## Anti-pattern catalog for Commerce PaaS

### 1. Fat Plugin
- **What it looks like:** One `Plugin` class implementing
  `before`/`after`/`around` for 3+ unrelated intercepted methods, or a
  single `around` method doing validation, logging, AND business
  mutation.
- **Why it's a problem:** Plugin execution order becomes hard to reason
  about; one plugin change risks regressing several unrelated
  interception points at once.
- **Canonical fix:** One plugin class per intercepted concern; split a
  multi-purpose `around` into focused `before`/`after` plugins.
- **Severity if found:** MEDIUM.

### 2. Service Locator via `ObjectManager::get()` in class bodies
- **What it looks like:** `ObjectManager::getInstance()->get(SomeClass::class)`
  called inside a regular (non-factory, non-proxy) class method instead
  of constructor DI.
- **Why it's a problem:** Hides the real dependency from `di.xml`
  compilation and from tests; breaks DI-container guarantees and makes
  the class untestable without bootstrapping the full container.
- **Canonical fix:** Inject via constructor; use a `Factory`/`Proxy` only
  when lazy instantiation is genuinely required.
- **Severity if found:** HIGH.

### 3. Business logic in Block classes
- **What it looks like:** A `Block` class method doing pricing/inventory
  calculation, DB reads beyond simple getters, or cross-cutting decision
  logic that belongs in a Model/Service.
- **Why it's a problem:** Blocks are re-instantiated per render and are
  the layer hardest to unit-test in isolation from layout XML — logic
  there is effectively untested.
- **Canonical fix:** Move computation into a Model/Service; the Block
  calls the service and exposes the result to the `.phtml`.
- **Severity if found:** MEDIUM.

### 4. Observer doing synchronous heavy work
- **What it looks like:** An `events.xml` observer performing an
  external API call, bulk collection save, or email dispatch inline
  during the triggering request.
- **Why it's a problem:** Blocks the triggering request's response time
  on work the user didn't ask to wait for; a slow/failing downstream
  call now fails the primary action too.
- **Canonical fix:** Publish to a message queue (`MessageQueue`
  publisher/consumer) or a cron-polled job; observer only enqueues.
- **Severity if found:** HIGH (perf-adjacent — checkout/cart-path
  observers especially).

### 5. Missing interface-based DI (concrete-class type hints)
- **What it looks like:** A constructor type-hints a concrete class
  (`\Vendor\Module\Model\Foo $foo`) instead of an interface
  (`FooInterface`), even though the module ships an interface.
- **Why it's a problem:** Blocks other modules/tests from swapping the
  implementation via `di.xml` preference — defeats the whole point of
  Magento's DI layer.
- **Canonical fix:** Type-hint the interface; declare the concrete
  binding in `di.xml`.
- **Severity if found:** MEDIUM.

### 6. Plugin chain order-dependency without explicit `sortOrder`
- **What it looks like:** A new plugin on a heavily-plugged-in method
  (`Cart::addProduct`, `Quote::collectTotals`) with no `sortOrder`, or a
  `sortOrder` chosen without checking neighboring plugins.
- **Why it's a problem:** Silent execution-order drift as other modules
  add plugins later — an `around` that assumed it ran last may not.
- **Canonical fix:** Set explicit `sortOrder`, document the intended
  position relative to known plugins in the PR description.
- **Severity if found:** MEDIUM.

### 7. Direct SQL instead of Resource Model / Collection
- **What it looks like:** A raw `$connection->query("SELECT ...")` or
  string-built SQL where a `ResourceModel`/`Collection` with proper
  filters would do the same job.
- **Why it's a problem:** Bypasses EAV/attribute-resolution logic,
  event dispatching, and cache-tag invalidation that the Collection
  layer provides; also injection risk if any input is concatenated.
- **Canonical fix:** Use the module's `Collection` with
  `addFieldToFilter`, or a proper `ResourceModel` method.
- **Severity if found:** HIGH (CRITICAL if the query includes
  unparameterized user input).

### 8. EAV attribute overuse for structured data
- **What it looks like:** A new EAV attribute added to
  `catalog_product_entity` to store what is actually structured/relational
  data (e.g. a list of tiered values) instead of a proper linked table.
- **Why it's a problem:** EAV attribute-count growth degrades indexing
  and flat-table rebuild time catalog-wide; the wrong tool for
  relational data.
- **Canonical fix:** Model genuinely relational data as its own table
  with a `ResourceModel`/Collection, not a shoehorned EAV attribute.
- **Severity if found:** MEDIUM.

### 9. God class growth via ad hoc method addition
- **What it looks like:** A new public method appended to an
  already-1000+-line class instead of extracting a collaborator.
- **Why it's a problem:** Compounds an existing testability/readability
  problem instead of arresting it.
- **Canonical fix:** Extract a focused collaborator class for the new
  responsibility; inject it.
- **Severity if found:** LOW (raise to MEDIUM if the class is on the
  checkout/payment critical path).

## Refactoring priority for Commerce PaaS

- **Blocker:** Direct SQL with unparameterized input (injection risk),
  or a synchronous-heavy observer on the checkout/payment path — both
  data-integrity/perf-critical.
- **Follow-up:** Fat Plugin, EAV overuse, God-class growth on a
  non-critical module — real debt, file and defer via
  `.bmad/decisions.yaml`.

## Worked before/after examples for Commerce PaaS

**1. ObjectManager service-locator → constructor DI**
```php
// Before
public function apply(Quote $quote) {
    $logger = \Magento\Framework\App\ObjectManager::getInstance()->get(LoggerInterface::class);
    $logger->info('applying promo');
}
// After
public function __construct(private LoggerInterface $logger) {}
public function apply(Quote $quote) { $this->logger->info('applying promo'); }
```
The dependency is now visible to `di.xml`, mockable in tests, and container-managed.

**2. Business logic in Block → Service**
```php
// Before — Block/PriceDisplay.php
public function getFinalPrice() { return $this->price * (1 - $this->discountRate); }
// After — Service/PriceCalculator.php
public function calculateFinalPrice(float $price, float $discountRate): float { return $price * (1 - $discountRate); }
```
`PriceCalculator` is unit-testable without instantiating a Block/layout context.

**3. Direct SQL → Collection**
```php
// Before
$rows = $connection->fetchAll("SELECT * FROM catalog_product_entity WHERE type_id = '" . $type . "'");
// After
$collection = $this->productCollectionFactory->create()->addFieldToFilter('type_id', $type);
```
Removes injection risk and restores EAV/cache-tag behavior the raw query skipped.

## Detection heuristics for Commerce PaaS

- Grep `ObjectManager::getInstance()->get(` or `ObjectManager::getInstance()->create(`
  inside any file that isn't a Factory/Proxy class name.
- Plugin class with 3+ `before*`/`after*`/`around*` methods targeting
  different subject methods.
- `di.xml` `<plugin>` entry with no `sortOrder` attribute on a
  well-known hot method (`Cart`, `Quote`, `Checkout` namespace).
- `Block` class file containing arithmetic operators (`*`, `/`, `-`) or
  a `foreach` with conditional logic beyond simple display formatting.
- Constructor parameter type-hinting a concrete `\Vendor\Module\Model\*`
  class where a matching `*Interface` exists in the same module.
- Raw `$connection->query(`/`fetchAll(`/`fetchRow(` calls with string
  concatenation nearby.
- Class file exceeding ~1000 lines with a diff adding a new public
  method to it.

## Anti-patterns in THIS catalog itself (meta)

Don't apply these as hard gates — an `around` plugin that genuinely
needs to short-circuit the call, or an EAV attribute that's truly
scalar and low-cardinality, are correct uses of the "anti-pattern"
shape; judge cohesion and intent, not just the syntax match.

Cross-reference `resources/review-templates/commerce-paas.md` for the
broader pre-merge review context. Reference this catalog when
`--artifacts design-patterns` is requested.
