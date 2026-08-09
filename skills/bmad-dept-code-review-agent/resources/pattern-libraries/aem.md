# Design-pattern violation catalog — AEM (AEMaaCS / AMS)

## Purpose framing

This catalog is the exhaustive companion to `resources/review-templates/aem.md`'s
short "Design-pattern checks" section — it names the canonical
Sling-Model/HTL anti-patterns a senior AEM developer would flag on sight,
with the shape each one takes in a diff, why it costs the team later, and
the idiomatic fix. Code Review loads this file when `--artifacts
design-patterns` (or `all`) is requested against the `aem` engine.

## Anti-pattern catalog for AEM

### 1. God Sling Model
- **What it looks like:** A single `@Model`-annotated class injecting
  10+ unrelated `@ValueMapValue`/`@ChildResource`/`@OSGiService` fields,
  serving several unrelated HTL concerns (nav data, analytics config,
  personalization flags, rendering state) from one class.
- **Why it's a problem:** Every unrelated concern now recompiles/retests
  together; the class becomes the one file everyone touches, and merge
  conflicts pile up on components with no logical overlap.
- **Canonical fix:** Split by concern into cohesive Models (e.g.
  `NavigationModel`, `AnalyticsModel`), composed in HTL via multiple
  `data-sly-use` blocks or a thin composing Model.
- **Severity if found:** MEDIUM (HIGH if the God Model also owns
  security-relevant state, e.g. ACL checks mixed with rendering data).

### 2. Business logic in HTL
- **What it looks like:** HTL expressions doing conditional/aggregation
  work inline (`${item.price > 100 ? ... : ...}` chains, loops that
  filter/sum) instead of calling a single pre-computed Model property.
- **Why it's a problem:** Logic in the template layer is untestable
  outside a rendered page, invisible to unit tests, and duplicates across
  components that need the same computation.
- **Canonical fix:** Push the computation into the Sling Model's
  `@PostConstruct`/getter; HTL calls one property.
- **Severity if found:** MEDIUM.

### 3. Direct JCR API calls bypassing ResourceResolver
- **What it looks like:** New code calls `session.getNode(path)` /
  `Node.getProperty(...)` directly instead of
  `resourceResolver.getResource(path).adaptTo(...)`.
- **Why it's a problem:** Bypasses Sling's resource-resolution mapping
  (aliases, vanity paths, `sling:resourceSuperType` chains) and Oak's
  resource-level caching; breaks under resource-resolver-mapped content.
- **Canonical fix:** Always resolve through `ResourceResolver`; adapt to
  `Node`/`Session` only when an API genuinely has no resource-layer
  equivalent.
- **Severity if found:** HIGH.

### 4. Sling Model without an interface
- **What it looks like:** `@Model(adaptables = Resource.class)` declared
  directly on a concrete class with no backing interface, referenced by
  HTL and by any Java caller directly.
- **Why it's a problem:** Impossible to mock cleanly in unit tests
  (Mockito can proxy it, but it couples tests to the concrete
  implementation) and blocks a future `@Exporter`-friendly interface
  split.
- **Canonical fix:** Declare a `ComponentModel` interface, annotate the
  interface's `@Model` with `adapters = {ComponentModel.class}`, keep the
  implementation package-private.
- **Severity if found:** LOW (MEDIUM if the Model is already reused
  across 3+ components).

### 5. Overuse of `@Self`/`@ScriptVariable` request coupling
- **What it looks like:** A Model injects `@Self
  SlingHttpServletRequest` or `@ScriptVariable Resource currentPage` for
  data that could be passed as a plain constructor/method argument.
- **Why it's a problem:** Ties the Model's testability to a full mock
  request/page context; can't unit-test with a bare resource.
- **Canonical fix:** Inject only what's structurally needed
  (`Resource`); pass request-derived values as explicit parameters when
  the Model is invoked programmatically.
- **Severity if found:** LOW.

### 6. Component doing both content-fetch AND rendering-logic
- **What it looks like:** One Model method both queries/aggregates
  content (e.g. walks child resources, calls a service) and formats the
  display string (date formatting, truncation, markup assembly).
- **Why it's a problem:** Two reasons to change collapsed into one
  method; a formatting tweak risks the fetch logic and vice versa.
- **Canonical fix:** Separate fetch (`getItems()`) from presentation
  (`getFormattedDate()`); HTL composes them.
- **Severity if found:** MEDIUM.

### 7. Missing `@Exporter` for headless-capable components
- **What it looks like:** A new component clearly meant to also serve
  content-fragment/headless consumers has a Sling Model with no
  `@Exporter(name = "jackson", ...)` annotation, so it's HTL-only.
- **Why it's a problem:** Forces a parallel, duplicated
  API/GraphQL-shaped Model later instead of exposing the same Model as
  JSON now — double the maintenance surface.
- **Canonical fix:** Add `@Exporter` up front on any Model whose data
  shape is a plausible headless payload.
- **Severity if found:** LOW.

### 8. Hardcoded paths instead of `/conf`/Content Fragment references
- **What it looks like:** A literal `/content/dam/...` or
  `/apps/mysite/...` path string embedded in Java/HTL instead of a
  `/conf`-scoped config lookup or a Content Fragment Model reference.
- **Why it's a problem:** Breaks multi-tenant/multi-site reuse; the
  component silently misbehaves the moment it's used under a second
  site root.
- **Canonical fix:** Resolve via `ConfigurationBuilder`/`/conf` inheritance
  or a Content Fragment reference field, never a literal absolute path.
- **Severity if found:** MEDIUM.

### 9. Service Locator via `resourceResolver.adaptTo(...)` chains for services
- **What it looks like:** New code adapts a resolver to fetch an OSGi
  service (`resolver.adaptTo(SomeService.class)`) instead of `@Reference`
  injection into the calling Model/servlet.
- **Why it's a problem:** Hides the dependency from the OSGi component
  graph — `scr-plugin`/component descriptors won't show the real
  dependency, and the service reference isn't lifecycle-managed.
- **Canonical fix:** `@OSGiService`/`@Reference` injection at the point
  of use.
- **Severity if found:** MEDIUM.

## Refactoring priority for AEM

- **Blocker:** Direct JCR API bypass on security-relevant paths, or a
  God Sling Model that mixes ACL/permission logic with unrelated
  rendering concerns — both actively harm testability or data-integrity
  on CRITICAL-path code.
- **Follow-up:** Missing `@Exporter`, hardcoded `/conf` path on a
  low-traffic component, interface-less Model with no current reuse —
  real but not urgent; file and move on.

## Worked before/after examples for AEM

**1. God Sling Model → split by concern**
```java
// Before
@Model(adaptables = Resource.class)
public class PageModel {
    @ValueMapValue String navTitle;
    @ValueMapValue String analyticsId;
    @ValueMapValue Boolean personalizationEnabled;
    // ...7 more unrelated fields
}
// After
@Model(adaptables = Resource.class) public class NavigationModel { @ValueMapValue String navTitle; }
@Model(adaptables = Resource.class) public class AnalyticsModel { @ValueMapValue String analyticsId; }
```
Each Model now has one reason to change and can be unit-tested in isolation.

**2. Business logic in HTL → precomputed property**
```html
<!-- Before -->
<p data-sly-test="${item.price > 100}">Premium: ${item.price - (item.price * 0.1)}</p>
```
```java
// After — DiscountModel.java
public BigDecimal getDiscountedPremiumPrice() { return isPremium() ? price.multiply(NINETY_PCT) : null; }
```
HTL becomes `<p data-sly-test="${model.discountedPremiumPrice}">...`; the math is unit-testable.

**3. Direct JCR call → ResourceResolver**
```java
// Before
Node node = session.getNode("/content/mysite/en/products");
// After
Resource resource = resourceResolver.getResource("/content/mysite/en/products");
ProductListModel model = resource.adaptTo(ProductListModel.class);
```
Honors resource-resolver mapping (aliases, vanity URLs) that a raw `Session` lookup skips.

## Detection heuristics for AEM

- Constructor/field-injection block with 8+ `@ValueMapValue`/
  `@ChildResource`/`@OSGiService` annotations in one class → God Sling
  Model candidate.
- HTL file containing `${... ? ... : ...}` nested more than one level,
  or a `data-sly-repeat` loop with an inline aggregation expression.
- Grep for `session.getNode(`, `session.getProperty(`, `Session session`
  in a class that also has a `ResourceResolver` available — bypass
  candidate.
- `@Model` annotation directly on a `public class` with no matching
  `public interface` in the same package — missing-interface candidate.
- `@Self SlingHttpServletRequest` or `@ScriptVariable Resource
  currentPage` injected but only one field of it is ever read.
- Literal string matching `/content/` or `/apps/` inside a `.java` file
  (excluding test fixtures) — hardcoded-path candidate.
- `resolver.adaptTo(` where the target type name ends in `Service` or
  `Manager` — service-locator-via-resolver candidate.

## Anti-patterns in THIS catalog itself (meta)

Apply these with judgment, not dogma — a Model injecting 10 fields that
are all genuinely one cohesive "page shell" concern isn't a God Model
just because the count is high; the question is always cohesion, not a
raw field-count threshold.

Cross-reference `resources/review-templates/aem.md` for the broader
pre-merge review context. Reference this catalog when `--artifacts
design-patterns` is requested.
