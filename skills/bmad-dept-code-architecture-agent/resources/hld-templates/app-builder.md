# HLD authoring guide — Adobe App Builder

## Purpose framing

An App Builder HLD establishes the **I/O Runtime action topology**
(single action vs sequence vs stateful), the **API Mesh composition**
(when to compose vs when to go direct), the **I/O Events
provider/consumer wiring**, the **state persistence choice** (State SDK,
Files SDK, external Cosmos), and the **UI Extension pattern** (App
Registry, uix-guest). It also pins the **IMS token exchange** posture
and the **namespace-per-environment** layout.

## Typical containers (C4 L2 elements) for App Builder

- **I/O Runtime actions** — serverless functions (OpenWhisk-based);
  Node.js 20 runtime; scoped to a namespace.
- **API Mesh** — GraphQL composition layer (Adobe I/O); resolvers stitch
  Adobe + third-party sources.
- **State SDK** — key/value store (Cosmos-backed) for short-lived
  action state, ~24h TTL default <!-- verify -->.
- **Files SDK** — Azure Blob-backed object store for larger artifacts;
  presigned URL support.
- **I/O Events provider** — emits Adobe org events (Analytics, Commerce,
  Target) into I/O Events; consumers via webhooks or runtime actions.
- **UI Extensions** — React (Spectrum + uix-guest) surfaces embedded in
  Commerce Admin / AEM / Workfront hosts.
- **App Registry** — Adobe SaaS registry that maps extension points to
  UI extensions.
- **Upstream Adobe services** — AEM, Commerce (SaaS/PaaS), Target,
  Analytics, RTCDP, Workfront — consumed via IMS bearer.

## Stack-specific tech-choice table

| Container | Technology | Why |
|---|---|---|
| Runtime | Adobe I/O Runtime (OpenWhisk) Node.js 20 <!-- verify --> | Adobe-managed serverless |
| Composition | API Mesh (Adobe I/O) | GraphQL stitching + caching |
| State | `@adobe/aio-lib-state` (Cosmos-backed) | Short-lived + namespace-scoped |
| Files | `@adobe/aio-lib-files` (Azure Blob-backed) | Larger artifacts + presigned URLs |
| Events | `@adobe/aio-lib-events` + I/O Events console | Adobe org event backbone |
| UI Ext | React 18 + `@adobe/uix-sdk` + `@adobe/react-spectrum` | Adobe UX consistency |
| Auth | IMS JWT via `@adobe/aio-lib-ims` | Adobe org / IMS integration |
| Config | `.env` + `--param-file` at deploy | Namespace-scoped values |

## Cross-cutting concerns for App Builder

- **AuthN/AuthZ** — actions inherit IMS org context; use JWT service
  token for server-to-server; verify org membership for user tokens.
- **Logging** — `console.log` → Adobe I/O Runtime logs, viewable via
  `aio rt activation logs`; forwardable to Splunk via Adobe Log
  Forwarder.
- **Tracing** — no native OTEL yet <!-- verify: OTel support in I/O
  Runtime -->; emit span-like events to Adobe Log Forwarder or a
  custom sink.
- **Config** — non-secrets via `app.config.yaml`; secrets via
  `--param-file` (git-ignored) or I/O Runtime bound params
  (`aio rt package update <pkg> -p`).
- **Secrets** — never commit; use `--param-file` at deploy or
  `aio-lib-state` for rotated secrets.
- **Feature flags** — namespace-scoped params (`STAGE_FLAG=true`) or
  Adobe Target for user-facing UI.
- **i18n** — React Intl on UI extensions; JSON dictionaries per locale.

## Integration points typical to App Builder

- **Adobe Commerce SaaS** — GraphQL over Catalog / Live Search /
  Payment Services via IMS.
- **Adobe Commerce PaaS** — REST `/rest/V1/*` via Integration token.
- **AEM** — Sling Model exporter / GraphQL / servlet with IMS bearer.
- **Adobe Analytics** — 2.0 Reporting API, Data Insertion API.
- **Adobe Target** — Delivery API (server-side decisioning).
- **RTCDP** — Data Ingestion, Real-Time Customer Profile.
- **Workfront** — REST v15 + Fusion webhooks.
- **Third-party** — HTTPS REST/GraphQL via `node-fetch`/`got`;
  no long-lived connections in serverless.
- **Webhooks** — external systems POST to runtime actions;
  signature-verified.

## NFR profile for App Builder

- **Runtime cold-start** ≤ 1s (Node.js 20 warm); ≤ 3s cold worst-case
  <!-- verify: Adobe published cold-start figures -->.
- **Action p95** ≤ 500ms for simple; ≤ 2s for composed (fanout).
- **API Mesh p95** ≤ 400ms for cached; ≤ 2s for uncached fan-out.
- **Event delivery** ≤ 30s p95 provider → consumer (Adobe I/O Events).
- **Action timeout** — max 60s (adjustable); max memory 512 MB
  <!-- verify: current I/O Runtime limits -->.
- **Namespace quotas** — per-org concurrent activations
  <!-- verify: current quota -->; plan for the org limit, not the
  namespace.
- **Availability** — Adobe I/O Runtime SLA <!-- verify --> — no
  primary/DR to design.

## Capacity planning shape

- **Actions** — plan by activations/day × concurrent-at-peak; Adobe
  scales per org.
- **State SDK** — sized by daily key volume × avg key size; TTL
  aggressive (< 24h).
- **Files SDK** — object count + retention window; presigned-URL
  budget.
- **API Mesh** — request/sec budget; cache TTL per source.
- **Event volume** — provider events/day × consumer count.
- **UI extensions** — bundle size (< 500KB gz recommended for load
  in host).

## Deployment topology

Mermaid `flowchart` shape: `Client / Adobe Host → UI Extension →
`aio-uix` postMessage → Action → API Mesh / Adobe SaaS`. Per-env
namespaces (`dev-<initials>` / `stage-<team>` / `prod-<team>`).
No VPC — all Adobe-managed edge.

## Delivery / release approach for App Builder

- **`aio app deploy`** — packages + deploys to current-namespace;
  `--no-actions` / `--no-web-assets` for partial deploys.
- **Namespaces per env** — `aio console workspace select` switches
  target; namespace = deployment boundary.
- **Feature flag pattern** — action bound-param toggle for server; Adobe
  Target for UI extension.
- **Rollback** — redeploy previous git tag; state/files persist across
  redeploys (design for backward-compat).
- **Registration** — extension-point registration via `aio app add
  extension`; App Registry propagation delay <!-- verify: typical
  propagation window -->.

## 3 worked HLD outline examples for App Builder

**HLD-01: Commerce Admin UI Extension for Product Bulk Actions**
- Containers: UI Extension (React/Spectrum) + Commerce Admin host +
  runtime action (bulk-update) + State SDK (progress) + Commerce
  GraphQL.
- ADRs: ADR-single-action-vs-sequence; ADR-progress-storage
  (State-vs-Files); ADR-permission-model.
- Cross-cutting: IMS token from host, correlation-id in action logs,
  rate-limit on bulk API.
- NFRs: extension load ≤ 2s in host; bulk-op progress polling ≤ 2s;
  100k-SKU update ≤ 15min.
- Rollout: internal namespace pilot → org GA.

**HLD-02: Order Enrichment via API Mesh**
- Containers: API Mesh (Commerce + ERP + tax GraphQL) + runtime
  resolver actions + IMS.
- ADRs: ADR-Mesh-vs-middleware-service; ADR-caching-per-source;
  ADR-error-shape.
- Cross-cutting: source-level cache TTL, PII redaction, partial-failure
  degradation.
- NFRs: p95 ≤ 400ms cached; ≤ 2s uncached; ≥ 99.9% availability.
- Rollout: read-only shadow → primary source.

**HLD-03: Cross-Cloud Analytics Event Bridge**
- Containers: I/O Events provider (Commerce) + runtime consumer +
  Analytics 2.0 + RTCDP + State SDK for dedupe.
- ADRs: ADR-event-schema-mapping; ADR-dedupe-window; ADR-DLQ-approach
  (State + retry action vs external queue).
- Cross-cutting: XDM mapping, consent gating, retry with exponential
  backoff.
- NFRs: p95 event lag ≤ 30s; dedupe hit ≥ 99.99%; DLQ MTTR ≤ 1h.
- Rollout: single event type → all events.

## Anti-patterns to avoid for App Builder

- **Long-running actions** — 60s max; batch/chunk work and use State
  SDK for progress instead of blocking.
- **Sync-blocking on external APIs** — a slow upstream burns action
  memory quota; always time-bound with `AbortSignal`.
- **Secrets in `app.config.yaml`** — get committed by accident; always
  `--param-file` (git-ignored) or bound params.
- **Building infra you don't need** — reach for API Mesh before spinning
  up middleware; use I/O Events before polling.
- **Ignoring cold starts** — schedule warm-up actions for latency-
  sensitive paths (or accept the cold-start budget in the SLA).

---

Generate the full HLD using `templates/HLD.md` as the master, populating
placeholders with stack-appropriate content from the guide above. When
container/technology decisions are still open, produce an ADR alongside
(see `resources/adr-templates/app-builder.md`).
