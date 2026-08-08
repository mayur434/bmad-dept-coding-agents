# ADR authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an ADR for an Adobe App Builder project (I/O
Runtime, API Mesh, Commerce/AEM UI Extensibility). Combine with
`templates/ADR.md` as the master skeleton.

## Stack-specific decision categories

- **API Mesh vs middleware direct** — where does composition of Commerce
  / AEM / third-party APIs live: API Mesh handlers, standalone I/O
  Runtime actions, or an external service?
- **I/O Events vs webhooks** — event-driven from Adobe products (Commerce
  events, AEM asset events) via Adobe I/O Events subscription vs polling
  vs direct webhook.
- **State backend** — `@adobe/aio-lib-files` (blob) vs
  `@adobe/aio-lib-state` (key-value, TTL-bound) vs external Cosmos /
  DynamoDB / Redis.
- **Action orchestration** — single action vs sequence (OpenWhisk
  composition) vs stateful workflow (external orchestrator like Step
  Functions, Temporal).
- **UI Extension pattern** — App Registry with `uix-guest` +
  `uix-host` for embedded UI vs standalone SPA vs headless UI-only
  extension.
- **Auth model** — IMS S2S (server-to-server) tokens vs OAuth JWT
  (deprecated for new integrations) vs user tokens via IMS.
- **Deployment topology** — single workspace per environment vs
  workspace-per-branch vs shared workspace with `.env`-driven config.
- **Region selection** — App Builder region choice for data residency
  (currently AMER / EMEA / APAC <!-- verify: current supported regions -->).

## Common constraints (stack-specific)

- **Action cold-start budget** — non-warm invocation adds latency; keep
  package light; avoid heavy `require`s at load.
- **Activation limits** — per-namespace concurrency + rate quotas;
  bursty workloads must handle 429s.
- **Action timeout** — max 60s per synchronous invocation <!-- verify:
  current max -->; long jobs must chunk or move to sequence /
  external workflow.
- **State SDK** — max key/value sizes and TTL bounded (~24h class);
  don't treat as durable store.
- **Files SDK** — 100MB per object <!-- verify -->; not a general
  filesystem.
- **API Mesh handler** — cold-start + rate limits; handler build must
  fit the mesh publish limit.
- **IMS tokens** rotate; caching + refresh required on every action /
  handler.
- **Package size** — deployed bundle size cap <!-- verify: current
  package-size limit --> constrains dependencies (esp. AWS SDK, mongoose).
- **Region pinning** — cross-region calls add latency; align region to
  data-residency requirement.

## Common alternatives (stack-specific)

### Composition
- **API Mesh** — GraphQL front to multiple back-ends; sources
  (openapi/json-schema/graphql/soap); resolvers chain calls in one
  round-trip.
- **Standalone I/O Runtime action** — bespoke composition logic; more
  code; more control.
- **External middleware** (Lambda, Cloud Run, Kubernetes) — heaviest;
  full control; lives outside Adobe's platform.

### Eventing
- **I/O Events** — Adobe-managed pub/sub; Commerce / AEM emit; consumers
  are runtime actions or third-party HTTP endpoints; supports journaling.
- **Direct webhook** (from Commerce admin webhook, AEM Adobe Sensei
  webhook) — simpler; no journaling; requires exposed HTTP endpoint.
- **Polling** — pull-based from Commerce REST / AEM API; least real-time;
  easiest to reason about.

### State
- **State SDK** — small, short-lived, cache-shaped.
- **Files SDK** — blobs and JSON snapshots.
- **External Cosmos / DynamoDB / Redis** — durable, unbounded, higher
  ops cost.

### Orchestration
- **Single action** — call-per-request.
- **OpenWhisk sequence** — chained actions, atomic to caller;
  no branching.
- **Stateful workflow (external)** — Step Functions / Temporal;
  branching + retries + long-running.

### UI Extension pattern
- **App Registry `uix-guest` + `uix-host`** — embedded UI inside Commerce
  Admin / AEM Author; postMessage-bridged.
- **Standalone SPA** — deployed as its own App Builder SPA; auth via IMS.
- **Headless extension** — no UI; backend-only capability contributions.

## Decision drivers for App Builder

- **Cold-start budget** and **p95 warm-invocation latency**.
- **Activation concurrency** limits.
- **Event volume** and burstiness.
- **Data residency** requirement drives region + external store choice.
- **Team JS depth** — Node 20 runtime + modern JS + Adobe SDKs.
- **Adobe roadmap** alignment (API Mesh feature parity, State SDK
  durability class).
- **Cost model** — I/O Runtime activations bill per invocation +
  duration; long workflows add up.
- **Integration surface** — how many upstream systems (Commerce, AEM,
  ERP, PIM); more sources argue for API Mesh.
- **Observability** — I/O Runtime logs to `aio rt logs`; production
  observability often needs export to Splunk / Datadog.
- **Security posture** — IMS S2S vs user tokens; secret storage in
  `.env` vs `aio-lib-state` (avoid secrets in State).
- **UI Extensibility contract** — Commerce Admin exposes specific
  extension points that evolve; align to current supported set.

## Worked ADR examples for App Builder

**ADR-091 — API Mesh handler for Commerce + PIM composition (not a bespoke action).**
- **Context.** Storefront needs product data merged with PIM editorial;
  same shape needed by three UI extensions; team debates API Mesh vs a
  bespoke Runtime action.
- **Options.** (A) API Mesh handler stitching Commerce GraphQL + PIM REST,
  (B) Runtime action doing the composition, (C) External middleware.
- **Decision.** (A). Rationale: mesh is purpose-built for composition;
  built-in caching + auth; single URL for all consumers; no bespoke code
  path to maintain.
- **Consequences.** + centralized composition + auth, + built-in
  caching, – mesh publish cadence adds a deploy step, – deep custom
  logic still requires an action.

**ADR-092 — I/O Events (not webhook) for Commerce order events.**
- **Context.** Downstream loyalty service needs order events; volume ~50
  events/min avg, 500/min peak on flash sales.
- **Options.** (A) Adobe I/O Events subscription + Runtime consumer,
  (B) Commerce Admin webhook → external endpoint, (C) Polling via
  `orders` REST.
- **Decision.** (A). Rationale: journaled (replayable), Adobe-native
  auth, back-pressure handled by the platform; matches team's other
  Adobe integrations.
- **Consequences.** + replayable via journal, + no exposed webhook
  URL, – event schema version drift is Adobe-owned, – Runtime action
  cold-start latency ~200-500ms on bursts.

**ADR-093 — External DynamoDB for durable state (not State SDK).**
- **Context.** Loyalty membership persistence: unbounded rows, queryable
  by user-id and by earned-date, ~90d retention grew to unbounded.
- **Options.** (A) `aio-lib-state`, (B) DynamoDB in same region as
  workspace, (C) Cosmos DB.
- **Decision.** (B). Rationale: State SDK not sized for unbounded data;
  DynamoDB region-collocated with the workspace; on-demand billing fits
  bursty workload.
- **Consequences.** + unbounded rows + secondary indexes, + region
  co-location = low latency, – AWS ops surface added, – secret
  rotation for IAM keys via `.env`.

## Anti-patterns to avoid for App Builder

- **Long-running sync work in an action** — hits the 60s timeout;
  chunk + sequence, or externalize.
- **Secrets in `aio-lib-state`** — State is not encrypted at rest to
  the level `.env` + workspace-scoped IMS keys are; keep secrets in
  `.env` via `AIO_*` vars.
- **Heavy dependency (`aws-sdk` v2, `mongoose`)** — inflates bundle;
  cold-start rockets past acceptable; use v3 modular imports or
  externalize.
- **Direct webhook from Commerce admin webhook to a public URL** —
  bypasses I/O Events' journaling and Adobe auth; harder to trace and
  replay.
- **Region-crossing calls** — App Builder in AMER calling Commerce SaaS
  in EMEA adds 100+ms; align workspace region to primary data source.
- **Skipping IMS token cache** — every action fetches a new token;
  hammers IMS + adds latency; cache in memory (per-container) with a
  refresh window.

---

Generate the full ADR using `templates/ADR.md` as the master, populating
placeholders with stack-appropriate content from the guide above.
