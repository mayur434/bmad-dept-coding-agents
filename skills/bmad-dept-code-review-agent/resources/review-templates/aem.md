# Pre-merge review guide — AEM (AEMaaCS / AMS)

## What pre-merge review catches (vs Audit's deep scan)

Pre-merge review reads only the changed lines and asks "would a senior
AEM developer block this PR reading it for two minutes." It catches
context-escaping in new HTL markup, obvious Sling Model injection
mistakes, and resource-leak patterns *introduced by the diff*. It does
**not** re-walk the whole `ui.apps`/`ui.content` tree for Oak-index
compat, dispatcher-rule completeness, or `/libs` overlay depth the way
Audit's `aemcs`/`aemams` rule packs do (`AEMCS-CLOUD-*`,
`AEMCS-ARCH-004`) — those need full-repo context a diff doesn't carry.

## Common pre-merge red flags for AEM

1. **`ResourceResolver`/`Session` opened without try-with-resources.** Diff
   shows `getServiceResourceResolver(...)` assigned to a local without a
   `try (...)` block or `finally { resolver.close(); }`. Instance
   instability under load. Fix: wrap in try-with-resources.
2. **New `@Model` with a `@PostConstruct` doing external calls or tree
   walks, no field-level cache.** Diff adds `init()`/`@PostConstruct`
   calling a service or `resourceResolver.getResource()` recursively
   without lazy-init/caching. Repeats per HTL include. Fix: lazy-init
   on the getter, not in `@PostConstruct`.
3. **`context='unsafe'` or `context='html'` on a diff-added HTL
   expression sourced from user/request input.** XSS. Fix: default
   `text` context, or `context='uri'` for authored links only.
4. **New OSGi `@Component`/Sling Model missing `@Reference`/injection
   annotation on a field that's clearly meant to be injected.** NPE at
   runtime. Fix: add the annotation or explain why it's intentionally
   unmanaged.
5. **New clientlib folder missing `allowProxy="{Boolean}true"`.**
   Diff adds a `.content.xml` with `jcr:primaryType="cq:ClientLibraryFolder"`
   under `/apps` with no `allowProxy`. Will 404 through Dispatcher in
   production even though it works on local SDK. Fix: add the property.
6. **New JCR-SQL2/QueryBuilder query with no `p.limit`/`LIMIT`.** Diff
   adds a query without a bound. Cloud Service traversal limits will kill
   it. Fix: add `p.limit`/pagination.
7. **New synchronous external-API call or bulk loop inside
   `doGet`/`doPost`.** Blocks Sling's thread pool. Fix: move to a Sling
   Job / async event handler.
8. **`e.printStackTrace()` or `System.out.println` added in new/changed
   code.** Not captured by Cloud Service log aggregation. Fix: SLF4J
   `LOG.error(...)`.
9. **New Sling Model's `adaptables` doesn't match how it's used** (e.g.
   `Resource.class` adaptable but the diff adds `@ScriptVariable`, which
   needs `SlingHttpServletRequest`). Null injections at runtime.
10. **Custom runmode config folder added** (`config.local`,
    `config.integration`, anything outside
    `author|publish|dev|stage|prod` combinations). Silently ignored by
    Cloud Service — config never loads.
11. **New scheduled `Runnable`/Sling Scheduler component without
    `scheduler.runOn=LEADER`.** Runs on every Cloud Service instance —
    duplicate execution.
12. **Inline `<style>`/`<script>` added to component HTL with dynamic
    values.** Not CDN-cacheable, forces `unsafe-inline` CSP. Fix: pass
    via `data-*` attributes, read in clientlib JS.

## Style-guide highlights for AEM

- Component `.content.xml`/dialogs use Touch UI (`cq:dialog`, lowercase,
  Granite UI resource types) — never `cq:Dialog`/ExtJS `xtype`.
- Sling Models: constructor/field injection via `@Inject`/`@ValueMapValue`,
  not manual `resource.adaptTo(ValueMap.class)` fetch-by-hand where a
  Model already exists for the resource type.
- HTL, not JSP, for new component markup — legacy JSP components in a
  diff are a review flag on their own.
- Package structure: `core` module for Java, `ui.apps` for
  code/component definitions only, `ui.content` for content —
  never mix new component code into `ui.content`.
- Logger naming: `LoggerFactory.getLogger(MyClass.class)` per class, not
  a shared static logger imported across unrelated classes.
- Client library categories scoped per-component, not appended to a
  single monolithic `mysite.all` bundle for a component-specific feature.

## Breaking-change signals for AEM

- A public method removed or its signature changed on a Sling Model
  interface, OSGi service interface, or exported Java API another
  bundle consumes.
- A `sling:resourceType` renamed or moved without a
  `sling:resourceSuperType`/resource-mapping shim — breaks existing
  content referencing the old type.
- A dialog field `name` (`./jcr:title`, `./customProperty`) renamed —
  orphans existing authored content until a migration script runs.
- An HTL template's exposed Use-API property removed while other
  components/templates still reference it via `data-sly-use`.
- A Content Fragment Model field removed/retyped — breaks GraphQL
  persisted queries and any headless consumer.
- A service user's ACL scope narrowed in a repoinit script — breaks
  code that relied on the broader (if overprivileged) access.

## Dependency-change signals for AEM

Watch `pom.xml` (Maven, per-module and parent) and
`ui.frontend/package.json` (if a webpack frontend module exists). A risky
bump looks like: a major-version jump on `uber-jar`/`aem-sdk-api`
(review against the target Cloud Service release notes), a new
third-party JAR added directly to `core` instead of resolved as an OSGi
bundle dependency, or a frontend dependency bump that changes bundle
output size materially (check against `AEMCS-PERF-004`-style budget —
100KB uncompressed JS per clientlib).

## Design-pattern checks for AEM

- Business logic in the HTL/Use-API layer instead of a Sling Model or
  service — HTL should be display-only.
- Direct `new` of a service class instead of `@Reference`/constructor
  injection — breaks OSGi lifecycle management and testability.
- Recursive resource-tree walking repeated in multiple Models instead
  of a shared, cached navigation service.
- Deep `/libs` overlay instead of `sling:resourceSuperType` extension.

Cross-ref `resources/pattern-libraries/aem.md` (forthcoming) for the
full anti-pattern catalog.

## Pre-merge checklist items specific to AEM

- [ ] No `ResourceResolver`/`Session` leak in new/changed code.
- [ ] New clientlibs declare `allowProxy` and stay under the size budget.
- [ ] New HTL expressions default to `text` context; no unexplained
      `context='unsafe'`.
- [ ] New queries carry an explicit limit.
- [ ] No custom runmode config folders introduced.
- [ ] Dialog field name changes cross-checked against existing authored
      content (migration note if any).
- [ ] New scheduled tasks declare `scheduler.runOn`.

## 2 worked review examples for AEM

**Example 1 — resource resolver leak.**
```java
// core/src/main/java/com/mysite/servlets/ExportServlet.java (+8 lines)
ResourceResolver resolver = resolverFactory.getServiceResourceResolver(authMap);
Resource res = resolver.getResource(path);
writeCsv(res, response);
resolver.close();
```
Review comments:
- 🔴 CRITICAL — `resolver.close()` on line 4 won't run if `writeCsv`
  throws; wrap in `try (ResourceResolver resolver = ...)`.
- 🟡 MEDIUM — no `catch (LoginException)` around
  `getServiceResourceResolver` — servlet will 500 with an unhandled
  exception on auth failure.
- ⚪ INFO — consider streaming the CSV instead of buffering the full
  resource tree in `writeCsv`.

**Example 2 — new clientlib missing allowProxy.**
```xml
<!-- ui.apps/.../clientlibs/mysite-carousel/.content.xml (new file) -->
<jcr:root jcr:primaryType="cq:ClientLibraryFolder"
    categories="[mysite.carousel]"/>
```
Review comments:
- 🔴 CRITICAL — missing `allowProxy="{Boolean}true"` — this clientlib
  will 404 through Dispatcher in production.
- 🔵 LOW — category `mysite.carousel` should be documented in the
  component's `.content.xml` `clientLibraries` policy, not hardcoded
  per-page.

## Anti-patterns to avoid IN THE REVIEW ITSELF

- Don't nitpick HTL indentation or brace style — that's ESLint/a
  formatter's job, not a review comment.
- Don't block a PR on a deep `/libs` overlay question that needs
  Audit's full-repo context to answer definitively — flag as
  `SHOULD-FLAG`/MEDIUM and let Audit's scheduled scan confirm.
- Don't demand a Sling Model for every three-line property read — small,
  page-scoped HTL logic is acceptable; only flag when it's genuinely
  business logic.
- Don't hold a PR hostage over a dialog i18n key naming preference that
  isn't in the team's documented style guide.

Generate the full review using `templates/review-comment.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
