# BRD authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a BRD for an Adobe App Builder project — I/O
Runtime actions, Adobe I/O Events providers/consumers, API Mesh, Commerce
UI Extensibility, and AEM UI Extensibility. Combine with `templates/BRD.md`
as the master skeleton.

## Stack-specific personas

- **Extension consumer (Adobe surface admin)** — installs the extension
  from App Registry into their Commerce Admin or AEM Assets shell. Pain:
  broken uix-guest surface, sandbox-vs-prod configuration drift.
- **Event publisher / consumer developer** — writes I/O Runtime actions
  that subscribe to Adobe I/O Events (Commerce, AEM Assets, Analytics) or
  publish custom-provider events. Pain: cold-starts on infrequent actions,
  activation limits, difficult local reproduction of the event envelope.
- **API Mesh developer** — composes GraphQL resolvers across Commerce,
  AEM, and third-party sources via API Mesh. Pain: mesh-depth timeouts,
  schema-conflict resolution.
- **Ops / release engineer** — owns `aio app deploy`, App Registry
  promotion, secret rotation via `aio-lib-state` and `aio-lib-files`.

## Stack-specific in-scope patterns

- Adobe I/O Runtime action design (`web: yes` for HTTP-triggered,
  `web: no` for internal / event-triggered).
- Action manifest (`app.config.yaml`) with `runtime`, `actions`, `sequences`
  sections.
- Adobe I/O Events subscription (registration.yaml, event-metadata).
- API Mesh source composition and transform pipeline.
- `uix-guest` + `uix-host` wiring for Commerce Admin UI Extensibility.
- AEM UI Extensibility hooks (Assets, Content Fragments).
- `aio-lib-state` for tenant-scoped key/value.
- `aio-lib-files` for tenant-scoped blob storage.
- IMS auth via `@adobe/aio-lib-ims`.
- CI/CD via GitHub Actions + `aio app deploy` with per-env workspaces.

## Stack-specific out-of-scope patterns

- Long-running actions (>60s) — decompose into event-driven sequences.
- Global state via module-level variables — use `aio-lib-state`.
- Cross-tenant data access — every action must scope to the calling IMS
  org / project / workspace.
- Direct network calls to unlisted egress endpoints — declare all egress
  in the app config for review.
- Bundling `node_modules` above the 48MB action size limit.
  <!-- verify: current limit -->
- Storing secrets in `.env` committed to git — use `aio app deploy`
  environment secrets or Adobe Secrets Manager.

## Stack-specific NFRs

**Performance**
- Action cold-start p95 <= 3s for typical Node.js runtime.
- Action warm-start p95 <= 200ms.
- Sequence orchestration latency (fan-in of 3 sub-actions) p95 <= 5s.
- Event-consumer end-to-end (Commerce event -> Runtime action -> downstream
  write) p95 <= 10s.
- API Mesh query p95 <= 500ms for typical composition depth (<=3 sources).

**Activation limits**
- Actions <= 250 activations/minute per workspace (per Adobe defaults).
  <!-- verify: current runtime limits -->
- Concurrent activations per action <= 200. <!-- verify -->
- Action payload size <= 1MB request, <= 1MB response.

**Availability**
- Adobe I/O Runtime availability per Adobe SLA. <!-- verify -->
- App Registry promotion SLA sandbox -> production per workspace.
- Event-delivery at-least-once semantics; consumer idempotency required.

**Security**
- All actions require IMS token validation (`require-adobe-auth: true` for
  external-facing web actions).
- Secrets pulled from `aio-lib-state` (encrypted at rest) — never bundled
  in the action code.
- Rate-limiting per IMS org / project to prevent noisy-neighbor.
- Log retention per compliance requirement (default 30 days on Adobe I/O).
  <!-- verify -->

## Stack-specific integration points

| System | Direction | Notes |
|---|---|---|
| Adobe Commerce (PaaS or SaaS) | bidirectional | I/O Events consumer + Admin action publisher |
| AEM (AEMaaCS) | bidirectional | I/O Events for Assets + Content Fragments |
| Adobe Analytics | outbound | events -> Analytics ingest API |
| Adobe Target | outbound | audience updates + activity triggers |
| Adobe Journey Optimizer | outbound | event-driven journeys |
| External SaaS (Salesforce / Slack / Jira / ServiceNow) | bidirectional | via I/O Runtime action fetch |
| Adobe I/O Events custom provider | outbound | for internally-defined event types |
| Adobe IMS | inbound | auth + org resolution |
| API Mesh sources (REST / GraphQL / SOAP) | inbound | mesh resolver composition |

## Stack-specific success KPIs

- Action cold-start rate (% of activations) trending toward baseline.
- Event-consumer end-to-end latency percentile.
- App Registry install success rate.
- API Mesh query p95 vs. budget.
- Secret-rotation MTTR (mean time to rotate).

## Stack-specific risks

- **Cold-start regression** — a large dep added to `package.json` blowing
  the cold-start budget on infrequent actions.
- **Activation-limit throttling** — a burst pattern exceeding the workspace
  quota, resulting in dropped events.
- **Cross-workspace secret leak** — a hardcoded secret from sandbox
  making it into a production deploy.
- **Mesh dependency-hell** — a source-schema change cascading through
  resolvers.
- **App Registry rollback confusion** — a promoted version being
  auto-installed at customer sites, requiring extension-consumer manual
  action to roll back.

## Stack-specific compliance

- **SOC2 Type II** — Adobe I/O Runtime is SOC2 certified; the customer
  application inherits controls via workspace isolation.
- **GDPR** — I/O Events and Runtime data-processing addenda apply; per-
  region workspace selection where required. <!-- verify: region list -->
- **HIPAA** — not generally supported on I/O Runtime for PHI workloads.
  <!-- verify: current stance -->

## Example BRD sections for App Builder

**Executive summary example.**
> The order-orchestration extension wires Commerce (PaaS) events into an
> ERP write-back sequence via three I/O Runtime actions and a custom I/O
> Events provider. Success is measured as: (1) event-to-ERP p95 <= 10s,
> (2) action cold-start rate <= 5% of activations, (3) zero cross-tenant
> data leaks (validated via IMS-org assertion tests).

**In-scope example.**
> Three actions: `order-event-consumer` (I/O Events subscription,
> web:no), `erp-writeback` (private, sequence step), and `order-status-api`
> (public, IMS-authenticated). One custom event provider
> (`acme-order-orchestration`) with two event types (`order.received`,
> `order.acknowledged`). GitHub Actions pipeline promoting from sandbox
> -> stage -> production workspaces.

**NFR example.**
> **NFR-Perf-1** — Cold-start p95 for `order-event-consumer` MUST stay
> <= 3s across a rolling 7-day window. Regressions block deploy. Parent
> BR: BR-2 (order-freshness SLO). MoSCoW: MUST.

---

Generate the full BRD using `templates/BRD.md` as the master skeleton,
populating placeholders with stack-appropriate content from the guide above.
