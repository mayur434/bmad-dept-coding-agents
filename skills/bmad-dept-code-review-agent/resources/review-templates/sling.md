# Pre-merge review guide — Apache Sling / Shaft

## What pre-merge review catches (vs Audit's deep scan)

Shaft (the internal Sling/Felix/Oak-based middleware platform) diffs
tend to touch security-sensitive surfaces — auth filters, MDM/SAM APIs,
payment webhooks — more often than presentation code. Pre-merge review
flags what's visible in the diff: a resource resolver left open, an
authorization check missing on a new endpoint, a filter chain reordered.
Audit's `sling`/Shaft rule pack (`SHAFT-*`) runs the exhaustive version
of the same checks across the whole codebase, including filter-chain
completeness and OSGi component wiring that spans files outside any
single diff.

## Common pre-merge red flags for Sling

1. **New servlet/filter registered by raw path instead of
   `resourceType`.** Diff adds `@SlingServletPaths("/bin/...")` where a
   resource-type-based registration would be more Sling-idiomatic and
   avoids path-collision risk. Flag for reviewer judgment — sometimes a
   raw path is genuinely correct.
2. **New API endpoint with no authorization/authentication annotation
   or check.** Diff adds a servlet/JAX-RS resource without an auth
   filter guard. Fix: confirm it's covered by the XSS → Audit →
   Authorization filter chain, or add an explicit check.
3. **JWT verification skipped or weakened** — a new/changed code path
   parses a JWT without verifying its signature, or trusts an
   unverified claim.
4. **Partner/API token issued without scope or expiry.** New token-minting
   code that doesn't bound the token's lifetime or capability.
5. **New SQL/NoSQL query built via string concatenation** with
   request-derived input — injection risk (SQL and MongoDB alike).
6. **`ResourceResolver` obtained via `getServiceResourceResolver`
   without try-with-resources**, or an administrative login used where
   a scoped service user should be.
7. **New export/CSV endpoint with unsanitized filename or content
   fields.** CSV injection (formula injection) or path traversal risk.
8. **Rate limiting/throttling absent on a new distributed API** exposed
   to partner/external callers.
9. **API logging that writes request/response bodies wholesale** —
   risk of persisting secrets or PII in clear text logs.
10. **New message-queue producer/consumer with no retry/dead-letter
    handling** — message loss or infinite-retry storms on failure.
11. **`catch (Exception e) {}` (empty catch) or overly broad catch
    swallowing a security-relevant exception** (auth failure, signature
    mismatch) instead of failing closed.
12. **TLS validation disabled** (`setHostnameVerifier` no-op,
    `TrustManager` that accepts everything) added for "local testing"
    and left in the diff.

## Style-guide highlights for Sling

- OSGi components use current DS annotations
  (`org.osgi.service.component.annotations.*`), never the deprecated
  Felix SCR set.
- Service users are scoped per-integration, never the administrative
  login, for any new resource-resolver acquisition.
- Logging via SLF4J only — no `System.out`/`printStackTrace` in new code.
- New connectors/integration modules follow the existing
  package-per-integration layout (`com.company.shaft.<integration>.*`).

## Breaking-change signals for Sling

- A distributed API's response shape changed without a version bump —
  `SHAFT-SAM-002` calls out API versioning explicitly; a diff that
  changes a response field without touching the version is a breaking
  signal.
- An MDM/SAM API's required parameter set changed.
- A servlet's registered `resourceType`/path changed or removed —
  breaks any caller hardcoded to the old route.
- An OSGi service interface method removed/changed — breaks any bundle
  consuming it.
- An export-URL filter's scope widened (now returns more than before)
  — a behavior change that looks like a bug fix but is actually a
  contract change for consumers relying on the narrower scope.

## Dependency-change signals for Sling

Watch `pom.xml`/`bnd.bnd`. A risky bump: a major-version jump on a
crypto/JWT library (verify the new default algorithm set doesn't weaken
signature verification), a new dependency pulled into a bundle that
wasn't OSGi-friendly before (check `Import-Package`/`Export-Package`
manifest headers still resolve), or a message-queue client library bump
that changes default retry/ack semantics.

## Design-pattern checks for Sling

- Business/authorization logic embedded directly in a servlet instead
  of delegated to a dedicated authorization service — hard to reuse
  and test.
- A new integration connector duplicating retry/circuit-breaker logic
  instead of using the shared resilience utility already in the
  codebase.
- Direct instantiation of a crypto/random utility instead of the
  platform's vetted CSPRNG wrapper.

Cross-ref `resources/pattern-libraries/sling.md` (forthcoming) for the
full anti-pattern catalog.

## Pre-merge checklist items specific to Sling

- [ ] New endpoints covered by the authorization filter chain.
- [ ] JWTs verified (signature + claims) before any trust decision.
- [ ] No raw SQL/NoSQL string concatenation with request input.
- [ ] `ResourceResolver`/service-user usage scoped and closed correctly.
- [ ] New distributed APIs have rate limiting.
- [ ] API/audit logs don't persist secrets or PII in clear text.

## 2 worked review examples for Sling

**Example 1 — missing authorization check on a new endpoint.**
```java
// src/main/java/com/company/shaft/mdm/ExportServlet.java (new file)
@SlingServletPaths("/bin/mdm/export")
public class ExportServlet extends SlingAllMethodsServlet {
    @Override
    protected void doGet(SlingHttpServletRequest req, SlingHttpServletResponse resp) {
        exportRecords(req.getParameter("folderId"), resp);
    }
}
```
Review comments:
- 🔴 CRITICAL — no ACL/authorization check before `exportRecords` —
  confirm this path is covered by the platform auth filter chain, or
  add an explicit scope check on `folderId` against the caller's grants.
- 🟠 HIGH — `folderId` passed straight into `exportRecords` with no
  validation — confirm downstream code doesn't build a path/query from
  it unsanitized.

**Example 2 — resolver leak in a new integration connector.**
```java
ResourceResolver resolver = resolverFactory.getServiceResourceResolver(authMap);
Resource config = resolver.getResource(CONFIG_PATH);
return buildClient(config);
```
Review comments:
- 🔴 CRITICAL — `resolver` is never closed — wrap in
  try-with-resources; this leaks a JCR session per call.
- 🔵 LOW — `getServiceResourceResolver` uses `authMap` — confirm the
  named service user is scoped to `CONFIG_PATH` only, not an
  administrative login.

## Anti-patterns to avoid IN THE REVIEW ITSELF

- Don't demand rate-limiting on purely internal, already-authenticated
  service-to-service calls — reserve that flag for externally-reachable
  APIs.
- Don't block on logging-format preferences unrelated to secret/PII
  exposure.
- Don't insist every resource resolver acquisition needs a comment
  justifying the service user — only flag when the scope looks wrong
  or missing.

Generate the full review using `templates/review-comment.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
