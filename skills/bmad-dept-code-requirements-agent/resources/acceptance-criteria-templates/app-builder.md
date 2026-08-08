# Acceptance-criteria authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **how to shape acceptance criteria**
for user stories on an Adobe App Builder BRD (I/O Runtime actions,
API Mesh, I/O Events, UI Extensibility). Combine with
`templates/ac-checklist.md`. Priority tags map MoSCoW -> Summary contract
(`MUST` / `SHOULD` / `COULD` / `WONT`).

## Given / When / Then structure (App Builder idioms)

- **Given** typically fixes *action state* (an I/O Runtime action deployed
  in workspace `stage`), *event provider state* (a provider `commerce-1`
  registered with I/O Events), *IMS token state* (a service-account JWT
  exchanged for an access token), or *state store state* (a value set in
  `aio-lib-state`).
- **When** covers an *action invocation* (`aio rt action invoke`, or a
  synchronous HTTP call to the action URL), an *event delivery* (Commerce
  emits `observer.checkout_submit_all_after`), or a *UI extension render*
  (the ExtensionRegistration renders inside the host).
- **Then** targets the *action response payload*, the *state store side
  effect*, the *downstream call* observable in logs / metrics, or the
  *ExtensionRegistration slot render* in Commerce Admin / AEM UI.

## Types of AC for App Builder

### Functional AC
- Given an I/O Runtime action `sync-order` is deployed with a valid
  `.env`, when it is invoked with a valid `orderId`, then it returns
  `{ statusCode: 200, body: { synced: true } }` and no `error` key.
- Given an I/O Events provider is registered for
  `observer.checkout_submit_all_after`, when Commerce emits the event,
  then the subscribed webhook receives the CloudEvent within 30s and
  the payload contains `order.increment_id`. <!-- verify: SLA -->
- Given the API Mesh has a resolver for `enrichedProduct`, when a
  GraphQL query hits the mesh endpoint, then the resolver fans out to
  Catalog Service + a third-party API and returns a merged payload.
- Given a Commerce UI Extension registered on the `product.details`
  extension point, when an admin opens a product page, then the
  extension's iframe renders inside the host and receives the product
  context via `uix-guest`.
- Given a value stored in `aio-lib-state` under key `last-run-timestamp`,
  when the sync action runs, then it reads the key, filters new records
  since that timestamp, and writes the current timestamp on success.

### Non-functional AC
- Action p95 duration (warm) <= 500ms; cold-start p95 <= 3s.
  <!-- verify: current Runtime cold-start SLO -->
- Action activation success rate >= 99.5% over any 24h window.
- Event delivery latency (Commerce emit -> App Builder receive) p95
  <= 30s.
- State store (`aio-lib-state`) read/write p95 <= 200ms.
- Log retention >= 30 days (Adobe I/O Runtime standard).

### Edge-case AC
- Given two events for the same order arrive out-of-order, when the
  consumer processes them, then a version/timestamp check ensures the
  older event is discarded and the state store reflects the newer one.
- Given the action's cold start on the first invocation of the day,
  when the action runs, then it initializes SDK clients once (module
  scope) and reuses them for the container's warm lifetime.
- Given an IMS token is about to expire mid-action, when the SDK
  detects the expiry, then it refreshes the token silently before the
  downstream call — no request fails from `401 expired_token`.
- Given the event provider is unregistered during a promotion window,
  when Commerce attempts to emit, then the emit call surfaces a 404
  and the failure is captured in the admin event-log for triage.

### Security AC (STRIDE-inspired)
- Given a webhook endpoint on an action, when a request lacks the
  Adobe I/O Events signature header, then the action responds 401 and
  no downstream work occurs.
- Given a secret in `.env` at deploy time, when the action logs, then
  the secret value NEVER appears (Runtime redacts declared secrets;
  verify no plaintext echo via `console.log`).
- Given a UI Extension iframe loads, when it posts messages to the
  host, then `uix-guest` validates the message origin — no arbitrary
  cross-origin messages are trusted.
- Given the action calls Commerce with a service-account JWT, when
  the token is issued, then it has the minimum required scopes
  (principle of least privilege) and the metadata records the scope
  set.
- Given an IMS access token, when it is stored, then it is stored only
  in-memory (never in `aio-lib-state` where retention is 30 days).

### Performance AC (measurable)
- Action `sync-order` warm-invocation p95 <= 500ms measured across
  100 invocations via `aio rt activation get`.
- API Mesh `enrichedProduct` query p95 <= 700ms (Mesh dashboard
  observability).
- Cold-start containers per action <= 5% of total activations over
  a 24h window (warm-pool efficiency).
- I/O Events end-to-end delivery p95 <= 30s.

### Testability guidance
- Unit: **Jest** (`aio app test` scaffolds Jest) for action handlers.
- Integration: **`aio app dev`** + local action invocation for the
  request/response contract.
- Event: **Adobe I/O Events debug tool** in the developer console
  + a canary consumer webhook.
- UI Extension: **@adobe/uix-guest** in a local host harness; final
  verification in a Commerce Admin sandbox.
- Contract: **JSON Schema** validation on action inputs + event
  payloads.
- Reference `test-generation/app-builder.md`.

## Negative AC (what MUST NOT happen)
- Actions MUST NOT store secrets in `aio-lib-state` (30-day retention
  is longer than any secret rotation cadence).
- Actions MUST NOT `console.log` a full IMS token, PAN, or PII.
- An event consumer MUST NOT process the same event twice without an
  idempotency key check.
- A UI Extension MUST NOT be granted a Commerce admin scope broader
  than the extension point it renders in requires.
- API Mesh resolvers MUST NOT be defined without a per-source timeout
  and per-source retry budget (defends against upstream tail latency).

## Testability check per AC
- [ ] Testable — framework + assertion identified.
- [ ] Measurable — concrete pass/fail.
- [ ] Unambiguous — no interpretation gap.
- [ ] Independent — no undeclared prereq.
- [ ] Small — one behavior per AC.

## Common AC anti-patterns for App Builder
- "Action should run fast" -> "Warm-invocation p95 <= 500ms measured
  via `aio rt activation get` over 100 invocations".
- "Events should arrive reliably" -> "Emit -> consumer receive p95
  <= 30s over any 24h window (I/O Events dashboard)".
- "Mesh should be resilient" -> "Given upstream A returns 500, When
  the resolver runs, Then it returns partial data with an `errors`
  entry and no 5xx propagates to the mesh client".
- "UI extension should feel native" -> "Given a Commerce admin opens
  the extension point, When the iframe loads, Then TTI <= 1.5s and
  the extension inherits the host's theme via `uix-guest`".
