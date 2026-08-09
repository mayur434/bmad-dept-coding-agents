# Design-pattern violation catalog — Apache Sling / Shaft

## Purpose framing

This catalog is the exhaustive companion to
`resources/review-templates/sling.md`'s short "Design-pattern checks"
section — canonical OSGi/Sling anti-patterns a senior developer would
flag reading a diff, each with the fix and a worked before/after. Code
Review loads this file when `--artifacts design-patterns` (or `all`) is
requested against the `sling` engine.

## Anti-pattern catalog for Sling

### 1. OSGi service with no interface
- **What it looks like:** A `@Component`-annotated class registered
  directly as a service with no backing interface (`service =
  MyServiceImpl.class` instead of `service = MyService.class`).
- **Why it's a problem:** Can't be mocked or swapped for a test double
  or an alternate implementation via OSGi's own `<preference>`-style
  ranking; couples every consumer to the concrete class.
- **Canonical fix:** Declare an interface, register the component
  against it, keep the implementation package-private.
- **Severity if found:** MEDIUM.

### 2. Overly broad OSGi service scope holding request-state
- **What it looks like:** A singleton `@Component` service storing a
  per-request or per-user field (e.g. `private String currentUserId`)
  set by one method and read by another.
- **Why it's a problem:** Singleton services are shared across
  concurrent requests — this is a race condition / data-leak between
  users waiting to happen.
- **Canonical fix:** Never hold request-scoped state on a singleton;
  pass it as a method parameter or store it on a request-scoped object.
- **Severity if found:** CRITICAL (security-adjacent — cross-request
  data leak).

### 3. Direct instantiation instead of `@Reference` injection
- **What it looks like:** `new SomeCollaborator()` inside a component
  method where `SomeCollaborator` is itself an OSGi service.
- **Why it's a problem:** Bypasses OSGi lifecycle management
  (activation order, config binding) and makes the collaborator
  unmockable in the component's own tests.
- **Canonical fix:** `@Reference` field/constructor injection.
- **Severity if found:** MEDIUM.

### 4. Servlet doing both API and page-rendering duties
- **What it looks like:** One servlet class branches on `Accept`
  header or a query param to either return JSON (API) or render an HTL
  page fragment.
- **Why it's a problem:** Two different consumer contracts (API
  clients vs. page renderers) coupled to one class's lifecycle; a
  change for one risks breaking the other.
- **Canonical fix:** Split into a dedicated API servlet/JAX-RS resource
  and a separate rendering path.
- **Severity if found:** MEDIUM.

### 5. Missing `@Designate` for typed OSGi config
- **What it looks like:** A component reads config values via untyped
  `context.getProperties().get("someKey")` instead of a
  `@Designate(ocd = Config.class)`-annotated typed config interface.
- **Why it's a problem:** No compile-time safety on config keys/types;
  typos in the key string fail silently at runtime with a null/default.
- **Canonical fix:** Define an `@ObjectClassDefinition` config
  interface, bind via `@Designate` + `@Activate` method parameter.
- **Severity if found:** LOW.

### 6. Business/authorization logic embedded directly in a servlet
- **What it looks like:** A servlet's `doGet`/`doPost` inline-computes
  an authorization decision (role checks, scope comparisons) instead of
  delegating to a dedicated authorization service.
- **Why it's a problem:** Duplicated/drifting auth logic across
  servlets; a fix to the authorization rule has to be hunted down
  file-by-file.
- **Canonical fix:** Extract a shared `AuthorizationService`, injected
  via `@Reference`, called from every servlet needing the check.
- **Severity if found:** HIGH (security-adjacent).

### 7. Integration connector duplicating retry/circuit-breaker logic
- **What it looks like:** A new integration module hand-rolls its own
  retry loop/backoff instead of using the platform's shared resilience
  utility that other connectors already use.
- **Why it's a problem:** Inconsistent retry/backoff behavior across
  integrations; the hand-rolled version usually misses jitter or a
  circuit-breaker, risking a retry storm against a struggling
  downstream.
- **Canonical fix:** Use the shared resilience wrapper; only diverge
  with a documented reason.
- **Severity if found:** MEDIUM.

### 8. Direct instantiation of crypto/random utilities
- **What it looks like:** `new Random()` or `MessageDigest.getInstance("MD5")`
  called directly instead of the platform's vetted CSPRNG/crypto
  wrapper.
- **Why it's a problem:** `Random` isn't cryptographically secure, and
  hand-picked digest algorithms drift from the org's approved
  algorithm list without review.
- **Canonical fix:** Use the platform's provided CSPRNG/crypto wrapper
  exclusively.
- **Severity if found:** HIGH (security-adjacent).

### 9. Service Locator via `bundleContext.getServiceReference(...)`
- **What it looks like:** Manual `BundleContext.getServiceReference()`/
  `getService()` calls inside application logic instead of declarative
  `@Reference` injection.
- **Why it's a problem:** Sidesteps OSGi's declarative dependency
  graph — the real dependency is invisible to component descriptors and
  to anyone reading the class's field list.
- **Canonical fix:** Declarative `@Reference` injection; reserve manual
  service lookups for genuinely dynamic/optional scenarios with
  documented justification.
- **Severity if found:** MEDIUM.

## Refactoring priority for Sling

- **Blocker:** Request-state on a singleton service, or business/auth
  logic embedded in a servlet with no shared authorization service —
  both are security/data-integrity risks on CRITICAL-path code.
- **Follow-up:** Missing `@Designate` typed config, interface-less
  service with no current test/mocking need — real debt, defer.

## Worked before/after examples for Sling

**1. Request-state on a singleton → per-call parameter**
```java
// Before — @Component service
private String currentUserId; // set in one method, read in another
// After
public Result process(String userId, Request req) { /* userId passed explicitly */ }
```
Removes the cross-request race condition entirely.

**2. Direct instantiation → `@Reference`**
```java
// Before
AuthorizationService auth = new AuthorizationServiceImpl();
// After
@Reference private AuthorizationService auth;
```
Lifecycle-managed, mockable, and honors any OSGi-level override.

**3. Business auth logic in servlet → shared service**
```java
// Before — inline in doGet
if (!req.getUserPrincipal().getName().equals(ownerId)) { resp.sendError(403); return; }
// After
if (!authorizationService.canAccess(req, resourceId)) { resp.sendError(403); return; }
```
One rule, one place to fix, reused by every servlet that needs it.

## Detection heuristics for Sling

- `@Component` annotation with `service = XxxImpl.class` (concrete
  class, not an interface) in the `service` attribute.
- A field on a `@Component` class that is written in one method and
  read in another, with no synchronization/thread-local wrapping —
  request-state-on-singleton candidate.
- Grep `new ` followed by a class name that also appears with
  `@Reference` elsewhere in the codebase — direct-instantiation
  candidate.
- `getServiceReference(` / `bundleContext.getService(` inside
  non-framework application code.
- `context.getProperties().get(` instead of a `@Designate`-bound config
  object.
- `new Random()`, `MessageDigest.getInstance(` grepped directly in
  application code outside the platform's crypto-wrapper module.

## Anti-patterns in THIS catalog itself (meta)

A manual service lookup via `BundleContext` is occasionally the correct
tool for genuinely dynamic, optional service binding — don't flag it
reflexively when the code already documents why declarative
`@Reference` won't work there.

Cross-reference `resources/review-templates/sling.md` for the broader
pre-merge review context. Reference this catalog when `--artifacts
design-patterns` is requested.
