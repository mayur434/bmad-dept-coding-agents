# Pre-merge review guide — Adobe App Builder

## What pre-merge review catches (vs Audit's deep scan)

App Builder diffs are almost always small, self-contained actions or
mesh resolvers — which makes pre-merge review unusually effective here:
most of what matters fits inside the diff itself. Pre-merge review flags
what's visible: a missing `require-adobe-auth` annotation, a hardcoded
credential, direct `process.env` access instead of the `params` object.
Audit's `app-builder` rule pack (`APPB-*`) runs the same checks
exhaustively across every action in the repo, including ones untouched
by the current diff.

## Common pre-merge red flags for App Builder

1. **New/changed action missing `require-adobe-auth: true`** in
   `manifest.yml` for an action that should require IMS authentication.
   Unauthenticated access to a privileged action. Fix: add the
   annotation, or justify why the action is intentionally public.
2. **`process.env.X` read directly inside an action** instead of via
   the `params` object App Builder injects. Breaks portability across
   environments and bypasses the documented parameter-resolution
   mechanism. Fix: read from `params`.
3. **Hardcoded credential/API key in source** (not `.env`, not
   `params`, literally in the action file). Fix: move to
   `.env`/protected params, never commit the literal value.
4. **CommonJS `require()` used in a new action file** in a codebase
   that's standardized on ES module syntax (`import`/`export`) for
   actions. Inconsistent module resolution behavior across the runtime.
5. **New action with no input validation on `params`** before using
   values in a downstream call (mesh resolver, external API, file
   path). Fix: validate required params exist and are the expected
   shape before use.
6. **New action logging `params` or the full request/response wholesale**
   — risk of logging tokens, PII, or other sensitive payload fields.
   Fix: log a redacted subset.
7. **New API Mesh source added with no authentication** on the
   upstream — anyone with mesh access can query the unauthenticated
   source directly.
8. **New GraphQL mesh field with no depth/complexity restriction** —
   unrestricted nested queries against a resolver that fans out to
   multiple upstreams.
9. **Action payload size not bounded** — a new action accepting
   arbitrary-size input (file upload, bulk payload) with no size check
   before processing; risk of exceeding the platform's payload limit or
   OOM.
10. **New action with no explicit timeout handling** around an
    outbound call — App Builder's own action timeout will kill it
    ungracefully; an explicit shorter timeout with a clean error
    response is better UX for the caller.
11. **`.env`/credentials file present in the diff** (not just
    referenced — actually added to version control).
12. **`manifest.yml` missing an explicit runtime version** for a new
    action package — implicit runtime resolution risks silent behavior
    changes on platform upgrades.

## Style-guide highlights for App Builder

- ES module syntax (`import`/`export`) consistently across action files
  — no mixed CommonJS/ESM in the same package.
- Actions read configuration exclusively from `params`, never
  `process.env` directly.
- One action per file, named to match its `manifest.yml` entry.
- Shared logic factored into a `lib/` or `actions/utils/` module rather
  than duplicated across action files.

## Breaking-change signals for App Builder

- An action's expected `params` shape changed (a required param
  renamed/removed) — breaks any caller (UI, another action, a webhook
  source) still sending the old shape.
- A mesh resolver's exposed GraphQL field type/shape changed.
- An action's HTTP response shape changed (status code semantics,
  response body fields) for a webhook consumer expecting the old shape.
- A `manifest.yml` action renamed or removed — breaks any hardcoded
  action URL/webhook registration pointing at the old name.
- A State SDK key namespace changed — orphans existing stored state
  under the old key.

## Dependency-change signals for App Builder

Watch `package.json`. A risky bump: a major-version jump on
`@adobe/aio-sdk` or `@adobe/aio-lib-*` packages (check the SDK's
changelog for breaking auth/State/Events API changes), or a new
dependency added to an action's `package.json` that increases the
bundled action size meaningfully (App Builder actions have a payload/
bundle-size ceiling — a large new dependency can push a previously-fine
action over it).

## Design-pattern checks for App Builder

- Business logic duplicated across multiple actions instead of factored
  into a shared `lib/` module.
- An action doing too much (fetching, transforming, and calling three
  downstream services) instead of being split into composable actions
  or delegating to a mesh resolver.
- Direct external-API calls scattered across actions instead of a
  single API-client wrapper with consistent auth/timeout/retry handling.

Cross-ref `resources/pattern-libraries/app-builder.md` (forthcoming) for
the full anti-pattern catalog.

## Pre-merge checklist items specific to App Builder

- [ ] New/changed actions requiring auth declare `require-adobe-auth`.
- [ ] No direct `process.env` access — reads go through `params`.
- [ ] No hardcoded credentials in source.
- [ ] New action validates required `params` before use.
- [ ] New mesh sources/resolvers are authenticated and depth-limited.
- [ ] `manifest.yml` declares an explicit runtime version for new actions.

## 2 worked review examples for App Builder

**Example 1 — missing auth annotation + hardcoded key.**
```yaml
# manifest.yml (new action)
packages:
  mysite:
    actions:
      syncInventory:
        function: actions/syncInventory/index.js
        web: 'yes'
```
```js
// actions/syncInventory/index.js (new file)
const API_KEY = "sk-live-abc123...";
async function main(params) {
  return callInventoryApi(API_KEY, params.sku);
}
```
Review comments:
- 🔴 CRITICAL — `manifest.yml` is missing `require-adobe-auth: true` —
  this action is `web: 'yes'` with no auth guard; anyone can invoke it.
- 🔴 CRITICAL — `API_KEY` hardcoded in source — move to `.env`/protected
  params immediately (treat as a leaked credential and rotate it).

**Example 2 — direct process.env + no input validation.**
```js
async function main(params) {
  const region = process.env.REGION;
  const order = await fetchOrder(params.orderId);
  return { status: "ok", region, order };
}
```
Review comments:
- 🟠 HIGH — `process.env.REGION` read directly — should come from
  `params.REGION` (or `params.__ow_headers`/mapped param) per the
  platform's parameter-resolution convention.
- 🟡 MEDIUM — `params.orderId` used without checking it's present/
  well-formed before calling `fetchOrder` — add a guard clause with a
  clear 400-equivalent response.

## Anti-patterns to avoid IN THE REVIEW ITSELF

- Don't block on action file naming preferences beyond what the
  existing `manifest.yml` convention requires.
- Don't demand a shared `lib/` extraction for a one-off action that's
  genuinely simple and unlikely to be duplicated.
- Don't insist every outbound call needs a custom retry policy — a
  reasonable default timeout is often sufficient for low-criticality
  actions.

Generate the full review using `templates/review-comment.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
