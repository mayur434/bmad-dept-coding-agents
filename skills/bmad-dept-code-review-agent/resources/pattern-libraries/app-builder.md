# Design-pattern violation catalog — Adobe App Builder

## Purpose framing

This catalog is the exhaustive companion to
`resources/review-templates/app-builder.md`'s short "Design-pattern
checks" section — canonical App Builder action/mesh anti-patterns a
senior developer would flag reading a diff, each with the fix and a
worked before/after. Code Review loads this file when `--artifacts
design-patterns` (or `all`) is requested against the `app-builder`
engine.

## Anti-pattern catalog for App Builder

### 1. Action doing multiple unrelated jobs
- **What it looks like:** One `main(params)` function fetches data,
  transforms it, calls two unrelated downstream services, and writes to
  State — all in a single action instead of being split into composable
  actions or a mesh resolver.
- **Why it's a problem:** Any one downstream failure fails the whole
  action; the action's timeout budget is shared across unrelated work,
  and testing requires mocking every dependency at once.
- **Canonical fix:** Split into focused actions chained via sequences,
  or delegate the fan-out to a mesh resolver.
- **Severity if found:** MEDIUM.

### 2. Missing idempotency check in an event handler
- **What it looks like:** An action registered as an Events consumer
  processes the event payload and performs a side effect (write,
  charge, notification) with no check for whether that event ID was
  already processed.
- **Why it's a problem:** Adobe I/O Events delivery is at-least-once —
  a redelivered event without an idempotency check double-processes the
  side effect.
- **Canonical fix:** Record processed event IDs (State SDK or a
  downstream idempotency key) and short-circuit on replay.
- **Severity if found:** HIGH (data-integrity-adjacent).

### 3. State SDK used as a database
- **What it looks like:** State SDK keys accumulate with no TTL, and
  the action reads/writes complex relational-shaped data through State
  instead of a proper datastore.
- **Why it's a problem:** State SDK is a key-value cache tier with size/
  TTL expectations, not a system of record — unbounded growth risks
  hitting platform limits and losing data with no query capability.
- **Canonical fix:** Set an explicit TTL on every State write; move
  anything relational/queryable to a real datastore behind an API.
- **Severity if found:** MEDIUM.

### 4. Direct external-API calls without retry/circuit-breaker
- **What it looks like:** An action calls an external API with a bare
  `fetch`/HTTP client call and no retry, backoff, or timeout handling.
- **Why it's a problem:** A transient downstream blip fails the action
  outright instead of recovering; no circuit-breaker means a
  struggling downstream gets hammered by every retriggered invocation.
- **Canonical fix:** Wrap external calls in a shared retry/timeout
  utility (exponential backoff, bounded retries); short-circuit after
  repeated failures.
- **Severity if found:** MEDIUM.

### 5. Secrets read from `params` and logged accidentally
- **What it looks like:** An action reads a credential from `params`
  correctly, but a later `console.log(params)`/`logger.info(JSON.stringify(params))`
  call for debugging captures the whole params object, secret included.
- **Why it's a problem:** Secrets land in centralized logs, often with
  broader read access than the credential store itself.
- **Canonical fix:** Log a redacted subset explicitly; never log the
  full `params` object.
- **Severity if found:** CRITICAL (secret exposure).

### 6. Business logic duplicated across multiple actions
- **What it looks like:** The same validation/transformation code
  copy-pasted into two or more action files instead of factored into a
  shared `lib/` module.
- **Why it's a problem:** A bugfix applied to one copy silently misses
  the other; behavior drifts between actions that should be identical.
- **Canonical fix:** Extract to `lib/`/`actions/utils/`, imported by
  every action that needs it.
- **Severity if found:** LOW.

### 7. API-client logic scattered across actions
- **What it looks like:** Multiple actions each build their own HTTP
  client/headers/auth logic for the same downstream API instead of a
  single wrapper.
- **Why it's a problem:** Inconsistent auth/timeout/retry handling per
  action; an API contract change requires hunting every call site.
- **Canonical fix:** One API-client wrapper module with consistent
  auth/timeout/retry, imported by every action calling that API.
- **Severity if found:** MEDIUM.

### 8. Mesh resolver with unrestricted nested-query fan-out
- **What it looks like:** A new GraphQL mesh field resolves by fanning
  out to multiple upstream sources with no depth/complexity limit
  applied to the exposed field.
- **Why it's a problem:** A single malicious or careless nested query
  can trigger a multiplicative number of upstream calls.
- **Canonical fix:** Apply depth-limiting middleware or restrict the
  resolved shape to a bounded, known query pattern.
- **Severity if found:** HIGH (perf/availability-adjacent).

## Refactoring priority for App Builder

- **Blocker:** Secrets logged from `params`, or a missing idempotency
  check on an event handler with a real side effect (charge,
  notification, write) — data-integrity/security risk.
- **Follow-up:** Duplicated business logic across actions, State SDK
  used without TTL on a low-volume key — real debt, defer.

## Worked before/after examples for App Builder

**1. Multi-job action → split into composable actions**
```js
// Before — one action
async function main(params) {
  const data = await fetchInventory(params);
  const transformed = transform(data);
  await notifySlack(transformed);
  await writeState(transformed);
  return { status: 'ok' };
}
// After — chained sequence
// fetchInventoryAction -> transformAction -> notifyAction (each independently testable/retryable)
```
Each step now has its own timeout budget and can be retried independently on failure.

**2. Missing idempotency → event-ID guard**
```js
// Before
async function main(params) { await chargeCustomer(params.orderId); return { ok: true }; }
// After
async function main(params) {
  const state = await stateLib.init();
  if (await state.get(params.eventId)) return { ok: true, skipped: true };
  await chargeCustomer(params.orderId);
  await state.put(params.eventId, true, { ttl: 86400 });
  return { ok: true };
}
```
A redelivered event no longer double-charges the customer.

**3. Secrets logged → redacted logging**
```js
// Before
logger.info('invoking with params', params);
// After
logger.info('invoking with params', { orderId: params.orderId, sku: params.sku });
```
The credential field never reaches the log aggregator.

## Detection heuristics for App Builder

- `main(params)` function body exceeding ~40-50 lines and calling 3+
  distinct downstream services/APIs.
- Event-consumer action (check `manifest.yml` for an `events`
  binding) with no `state.get`/`state.put` pair guarding the side
  effect.
- Grep `stateLib.put(`/`state.put(` calls with no `{ ttl:` option.
- `fetch(`/`axios.` call with no surrounding `try`/`catch` and no
  reference to a shared retry utility.
- `console.log(params)` or `logger.*(params)` where `params` is passed
  whole rather than destructured.
- Identical or near-identical function bodies (validation/transform
  helpers) appearing in two or more files under `actions/`.
- A GraphQL mesh source/resolver definition with no `depth`/
  `complexity` config key.

## Anti-patterns in THIS catalog itself (meta)

A single-purpose action calling two downstream services isn't
automatically a "does too much" violation if both calls are genuinely
one atomic unit of work (e.g. debit then credit in the same
transaction) — judge cohesion, not call count.

Cross-reference `resources/review-templates/app-builder.md` for the
broader pre-merge review context. Reference this catalog when
`--artifacts design-patterns` is requested.
