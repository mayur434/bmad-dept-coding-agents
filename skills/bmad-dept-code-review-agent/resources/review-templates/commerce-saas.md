# Pre-merge review guide — Adobe Commerce SaaS

## What pre-merge review catches (vs Audit's deep scan)

Adobe Commerce SaaS diffs are mostly storefront/integration code —
drop-in component customizations, API Mesh resolvers, storefront-events
wiring — rather than platform code you own end-to-end. Pre-merge review
flags what's visible in the diff: a hardcoded SaaS endpoint, an exposed
credential, a missing webhook-signature check. Audit's `commerce-saas`
rule pack is deliberately thin today (`CSAAS-SEC-001`, `CSAAS-CFG-001`,
`CSAAS-CFG-002`, `CSAAS-SEC-003`) — this stack's deep-scan coverage is
still maturing, which makes the pre-merge pass proportionally more
important here than for AEM/Commerce PaaS. <!-- verify: current SaaS rule-pack maturity -->

## Common pre-merge red flags for Commerce SaaS

1. **Admin/private API credentials referenced from storefront-facing
   code.** Diff adds a token/secret to a file bundled into the client.
   Fix: keep private credentials server-side only (API Mesh resolver,
   edge function) — never in code that ships to the browser.
2. **A SaaS endpoint hardcoded** (Catalog Service URL, Commerce instance
   host, environment ID) instead of read from environment/config. Breaks
   promotion between environments. Fix: externalize via env config.
3. **A new Data Connection / eventing webhook handler with no signature
   verification.** Forgeable webhook calls. Fix: verify the provided
   signature/HMAC before trusting the payload.
4. **Drop-in component customized by editing the vendored source
   directly** instead of the supported extension/override mechanism.
   Breaks on the next drop-in version bump. Fix: use the documented
   customization API (slots, config, wrapper components).
5. **New API Mesh resolver with no depth/complexity limit** on a
   GraphQL field it exposes — unrestricted nested queries. Fix: add
   depth-limiting middleware or restrict the resolved shape.
6. **New Catalog Service query executed per-item in a loop** on a
   product listing instead of batched — storefront latency regression.
7. **IMS token handling added without cache/refresh logic** — re-fetches
   a token on every request instead of caching until near-expiry.
8. **Storefront-events emitted with a payload shape that doesn't match
   the documented schema** — breaks downstream consumers (analytics,
   personalization) silently since events aren't type-checked at
   compile time.
9. **New drop-in version pinned inconsistently across environments**
   (e.g. `^1.2.0` in one config, exact `1.1.0` in another) — version
   drift between environments.
10. **Payment Services integration code logging response payloads**
    that may include cardholder-adjacent data — PCI scope creep.

## Style-guide highlights for Commerce SaaS

- Environment/config values (endpoints, environment ID, store view)
  centralized in one config module, not scattered `process.env.X`
  reads across files.
- Drop-in customizations go through the documented slot/override API,
  never a forked copy of the vendored component.
- GraphQL queries co-located with the component that uses them, named
  descriptively (`GetProductListingQuery`, not `query1`).
- Storefront-events payloads validated against the published schema
  before emit (even a lightweight runtime shape check).

## Breaking-change signals for Commerce SaaS

- A GraphQL query/fragment field removed that another component still
  references.
- A drop-in component's public prop/slot API changed without a
  corresponding version bump communicated to consumers.
- A storefront-event's payload shape changed (field renamed/removed) —
  breaks any downstream listener (analytics, personalization,
  third-party integrations) without a compile-time signal.
- An API Mesh resolver's response shape changed for a field other
  parts of the storefront depend on.
- An environment-config key renamed without a fallback — deployment to
  an environment still using the old key silently loses the value.

## Dependency-change signals for Commerce SaaS

Watch `package.json`/`package-lock.json`. A risky bump: a major-version
jump on `@adobe/magento-storefront-event-collector`,
`@adobe/magento-storefront-events-sdk`, or any `@adobe/*` drop-in
package (check the drop-in's own changelog for breaking prop/slot
changes), or a new third-party analytics/tag-manager script added to a
component that ships to every storefront page (bundle-size and
CSP-scope impact).

## Design-pattern checks for Commerce SaaS

- Vendored drop-in source edited in place instead of using the
  extension mechanism (the single most common SaaS anti-pattern).
- Business/pricing logic duplicated client-side instead of trusting
  Catalog Service / Commerce as the source of truth.
- Direct fetch calls to Commerce SaaS endpoints scattered across
  components instead of a single API-client module.

Cross-ref `resources/pattern-libraries/commerce-saas.md` (forthcoming)
for the full anti-pattern catalog.

## Pre-merge checklist items specific to Commerce SaaS

- [ ] No admin/private credentials reachable from client-bundled code.
- [ ] SaaS endpoints/environment IDs externalized, not hardcoded.
- [ ] New webhook handlers verify signatures.
- [ ] Drop-in customizations use the supported extension API.
- [ ] Drop-in versions consistent across environment configs.

## 2 worked review examples for Commerce SaaS

**Example 1 — hardcoded endpoint + missing webhook verification.**
```js
// integrations/dataConnectionHandler.js (+10 lines)
const CATALOG_URL = "https://prod-catalog.adobe.io/graphql";
export async function handleWebhook(req, res) {
  const payload = req.body;
  await processEvent(payload);
  res.sendStatus(200);
}
```
Review comments:
- 🔴 CRITICAL — no signature/HMAC verification on `handleWebhook` —
  anyone who finds the endpoint can forge events.
- 🟠 HIGH — `CATALOG_URL` hardcoded to prod — will call production
  Catalog Service even from staging/dev deployments. Externalize.

**Example 2 — vendored drop-in edited directly.**
```diff
--- a/node_modules/@adobe/drop-in-cart/src/Cart.jsx
+++ b/node_modules/@adobe/drop-in-cart/src/Cart.jsx
@@
-  return <div className="cart">{items}</div>;
+  return <div className="cart cart--custom">{items}</div>;
```
Review comments:
- 🔴 CRITICAL — editing inside `node_modules` — this change is lost on
  the next `npm install`/drop-in version bump. Use the drop-in's
  documented `className`/slot override instead.

## Anti-patterns to avoid IN THE REVIEW ITSELF

- Don't flag every `process.env.X` read as a violation — only when the
  same value should clearly be centralized (repeated across files) or
  when it's a credential that shouldn't reach the client bundle.
- Don't block on drop-in styling preferences that are cosmetic and use
  the supported override mechanism correctly.
- Don't demand exhaustive GraphQL depth-limiting on every resolver —
  focus on resolvers exposed to less-trusted callers (public storefront
  vs internal tooling).

Generate the full review using `templates/review-comment.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
