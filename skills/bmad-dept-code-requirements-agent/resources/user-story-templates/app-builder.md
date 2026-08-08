# User-story authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **how to shape user stories** for
an Adobe App Builder BRD — I/O Runtime actions, Adobe I/O Events, API
Mesh, Commerce / AEM UI Extensibility. Combine with
`templates/user-story.md` as the master single-story skeleton.

## INVEST criteria (stack-specific interpretation)

- **Independent** — stories should not couple to a specific App Registry
  release version or a sandbox->prod promotion window. Each action ships
  independently via `aio app deploy`.
- **Negotiable** — leave room to swap a synchronous web action for an
  event-driven sequence if cold-start budgets are missed.
- **Valuable** — value expressed to an Extension Consumer (surface
  admin), Event Publisher, or API Mesh consumer — not "the runtime".
- **Estimable** — team can size once the action's IMS-auth requirement,
  activation limits, and secret storage pattern are agreed.
- **Small** — one action + one manifest entry + one event registration is
  fine; adding a mesh source as well is too big — split.
- **Testable** — every story is testable with Jest (action logic),
  `@adobe/aio-lib-test-helpers` (Runtime invocation), and a WireMock /
  MSW stub for Commerce / AEM downstreams.

## Stack-specific personas

- **Extension consumer (Adobe surface admin)** — installs from App
  Registry into Commerce Admin / AEM Assets shell.
- **Event publisher / consumer developer** — I/O Runtime actions
  subscribing to or publishing Adobe I/O Events.
- **API Mesh developer** — composes GraphQL resolvers across Commerce +
  AEM + third-party.
- **Ops / release engineer** — `aio app deploy`, App Registry
  promotion, secret rotation.

## Story shape

`As a {{PERSONA}}, I want {{CAPABILITY}}, so that {{BENEFIT}}`

Realistic titles per persona:

- Extension consumer — "see the custom-shipping tab in the Commerce
  Admin order view", "trigger a bulk asset re-tag from the Assets
  toolbar".
- Event developer — "consume `com.adobe.commerce.observer.sales_order_place`
  and write the order to NetSuite", "publish a custom `acme.pricing.updated`
  event from the pricing action".
- API Mesh developer — "expose a `product` GraphQL type that merges
  Commerce catalog + AEM content-fragment marketing copy", "add a
  transform stripping PII from the mesh response".
- Ops engineer — "promote v1.4.0 from stage to production workspace with
  zero downtime", "rotate the Commerce OAuth secret in `aio-lib-state`".

## Story splitting patterns for App Builder

- **Mesh source vs handler vs transform** — each API Mesh layer is
  separately deployable.
- **Action vs event-handler** — a synchronous web action is one story;
  the event-triggered non-web action that follows is another.
- **`uix-guest` slot vs `uix-host` API** — the guest UI is one story;
  the host contribution (menu entry, badge, event bus) is another.
- **Runtime action vs sequence** — a sub-action is one story; the
  sequence composing multiple sub-actions is another.
- **IMS auth wiring vs feature action** — auth wiring ships once as its
  own story; features reuse it.
- **Sandbox promotion** — sandbox->stage->production promotion is a
  release-engineering story separate from the feature.
- **Event registration vs handler** — the `registration.yaml` change
  ships separately from the handler when Adobe I/O approval is a
  bottleneck.

## Effort estimation guidance

- **S (~1 day)** — new web action returning a static JSON payload;
  add a single `aio-lib-state` key.
- **M (~2-3 days)** — event-consumer action with Jest tests + IMS
  auth + one downstream integration via WireMock.
- **L (~1 sprint)** — new `uix-guest` extension slot + host wiring +
  Commerce Admin promotion path.
- **XL (>1 sprint, split)** — full API Mesh composition with 3+ sources
  and cross-source transforms.

**Estimation anti-patterns**
- Underestimating cold-start cost of an infrequently-invoked action —
  budget cold-start monitoring from day one.
- Ignoring the 48MB action-size limit <!-- verify: current limit --> when
  adding a heavy npm dep.
- Missing at-least-once event-delivery semantics — consumer idempotency
  is not optional.

## Ready-for-dev checklist

- [ ] I/O Event provider + event-code registered
      (`registration.yaml`).
- [ ] Runtime action manifest reviewed (`app.config.yaml`: `web`, `auth`,
      `timeout`, `memorySize`).
- [ ] IMS auth requirement decided (`require-adobe-auth: true|false`).
- [ ] Secrets storage pattern chosen (`aio-lib-state`,
      workspace secrets, Secrets Manager).
- [ ] API Mesh source + resolver spec agreed with downstream owners.
- [ ] `uix-guest` slot + host contract signed off with Adobe surface team.
- [ ] Cold-start + warm-start latency budget declared in AC.
- [ ] Log retention and PII redaction plan in place.
- [ ] Sandbox->stage->production promotion path documented.

## Example user stories for App Builder

### STORY-001: Sync Commerce order to NetSuite via event

**As an** event developer
**I want** the action `sync-order` to consume `com.adobe.commerce.observer.sales_order_place_after`
and write to NetSuite
**So that** finance sees the order within 60s.

**Priority**: MUST | **Effort**: M | **Parent epic**: EPIC-1 ERP sync
**Dependencies**: NetSuite OAuth secret in `aio-lib-state`
**AC**:
- Given a Commerce order event fires, when the action activates, then a
  NetSuite `SalesOrder` record is created with matching `externalId`.
- Given NetSuite returns 5xx, then the action re-throws to trigger
  Adobe I/O redelivery.
- Given the same event is delivered twice, then the second delivery is a
  no-op (idempotent on `externalId`).

### STORY-002: Custom `shipping-tab` in Commerce Admin

**As an** extension consumer
**I want** a custom shipping tab in the Commerce Admin order view
**So that** CSRs can view live carrier-tracking without leaving Admin.

**Priority**: SHOULD | **Effort**: L | **Parent epic**: EPIC-2 UI Extensibility
**Dependencies**: carrier-tracking web action (STORY-003)
**AC**:
- Given the extension is installed, when an admin opens an order, then a
  "Shipping" tab appears with a table of tracking events.
- Given the carrier API is unreachable, then a placeholder message is
  shown; no console errors.

### STORY-003: API Mesh `product` type merging Commerce + AEM

**As an** API Mesh developer
**I want** a GraphQL `product` type combining Commerce catalog with AEM
content-fragment marketing copy
**So that** the storefront hydrates from one endpoint.

**Priority**: MUST | **Effort**: L | **Parent epic**: EPIC-3 Storefront BFF
**AC**:
- Given a `product(sku: "X")` query, when the mesh resolves, then Commerce
  fields (`name`, `price`) and AEM fields (`marketingCopy`, `heroImage`)
  are returned in one response.
- Given AEM is unreachable, then Commerce fields still return; AEM fields
  are `null` with a top-level `partialErrors` entry.

## Anti-patterns to avoid

- "As a developer, I want to bundle all actions into one" — defeats
  App Builder's independent-deploy model.
- "As an admin, I want the extension to work" — no test surface, no
  measurable AC.
- "As a consumer, I want a mesh" — no source list, no schema, no
  latency target.
- Bundling event registration + handler + `uix-guest` UI + IMS wiring
  into a single story.

## Story-title formulation

Good:
- "Sync Commerce order to NetSuite via event"
- "Custom `shipping-tab` in Commerce Admin"
- "API Mesh `product` type merging Commerce + AEM"

Bad:
- "App Builder work" — no scope, no surface.
- "Add action" — no trigger, no consumer.
- "Fix mesh" — no source, no failure mode.
