# User-story authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **how to shape user stories** for
an Apache Sling / Shaft (sling-12) BRD — typically a JCR-backed content
service alongside AEM AMS. Combine with `templates/user-story.md` as the
master single-story skeleton.

## INVEST criteria (stack-specific interpretation)

- **Independent** — stories should not couple to a specific Feature-Model
  release bundle. Bundle activation order must be described, not assumed.
- **Negotiable** — leave room to swap a Sling POST hook for a `JobConsumer`
  handler based on the write-pattern shape.
- **Valuable** — value expressed to a Bundle Developer, Content
  Integrator, or Consumer of the Sling instance — not "the platform".
- **Estimable** — team can size once the OSGi `@Component` boundary,
  `@Reference` graph, and resource-type mapping are agreed.
- **Small** — one Sling Servlet + one Sling Model + one health check
  is fine; adding a new Feature-Model composition is too big — split.
- **Testable** — every story is testable with JUnit + Sling Mocks (for
  Sling Models + Servlets), OSGi Mocks (for services), and integration
  tests via `sling-mock-oak` for JCR-heavy paths.

## Stack-specific personas

- **Bundle developer** — writes OSGi bundles, Sling Models, Sling
  Servlets, `JobConsumer` handlers.
- **Content integrator** — feeds JCR via Sling POST or content-package
  install; wires `sling:resourceType` mappings.
- **Ops / platform engineer** — Sling launcher, Feature-Model releases,
  health-check dashboard.
- **API consumer** — an upstream service calling a Sling endpoint.

## Story shape

`As a {{PERSONA}}, I want {{CAPABILITY}}, so that {{BENEFIT}}`

Realistic titles per persona:

- Bundle developer — "add a Sling Model exposing product metadata as
  JSON", "register a `HealthCheck` for the S3 binary store", "publish a
  `JobConsumer` for async thumbnail rendering".
- Content integrator — "ingest a batch of 500 fragments via Sling POST",
  "map `/content/products/*` to the `product-renderer` resource type".
- Ops engineer — "surface OSGi installer queue depth on the metrics
  dashboard", "drop bundle activation for the deprecated `legacy-search`
  module without downtime".
- API consumer — "get product JSON at `/products/{sku}.json` with etag
  support", "receive a 429 when I exceed the read rate limit".

## Story splitting patterns for Sling

- **Servlet vs Sling Model** — the servlet resolution is one story; the
  Sling Model that renders the response is another when tests differ.
- **`@Component` vs `@Reference`** — introducing a new service is one
  story; wiring consumers to it is another.
- **Sling POST vs Sling Job** — the synchronous POST handler is one
  story; the async `JobConsumer` that follows is another.
- **Feature-Model composition** — bundle additions ship in one story;
  the Feature-Model release that packages them is a follow-up story.
- **Resource type vs renderer** — declaring `sling:resourceType` is
  separate from the renderer bundle if two teams own them.
- **Health-check registration** — every new service that owns a
  liveness-relevant dependency gets its own `HealthCheck` story.
- **Content-package boundary** — resource-only packages split from
  bundle-installing packages by convention.

## Effort estimation guidance

- **S (~1 day)** — add a `HealthCheck` component with a single JMX
  probe; add a Sling Model with two `@Inject` fields.
- **M (~2-3 days)** — new Sling Servlet + Sling Model + JUnit + Sling
  Mocks integration test.
- **L (~1 sprint)** — new async `JobConsumer` topology (`JobManager`
  producer + consumer + retry policy + dead-letter handling).
- **XL (>1 sprint, split)** — Feature-Model refactor introducing a new
  bundle group with cross-bundle wiring.

**Estimation anti-patterns**
- Ignoring OSGi bundle-activation ordering on restart; costs a full
  troubleshooting cycle.
- Underestimating Sling POST validation surface (CSRF token, auth
  handler wiring).
- Assuming Sling Distribution config is idempotent across environments.

## Ready-for-dev checklist

- [ ] OSGi bundle boundary agreed (which bundle owns which package).
- [ ] `@Component` service registration + config PID defined.
- [ ] `@Reference` graph reviewed for cardinality + policy (`OPTIONAL`
      vs `MANDATORY`, `STATIC` vs `DYNAMIC`).
- [ ] Resource type + servlet path (`sling.servlet.resourceTypes` /
      `sling.servlet.paths`) confirmed.
- [ ] Sling Model adaptables + `defaultInjectionStrategy` chosen.
- [ ] Health-check tags + JMX probe planned.
- [ ] `feature.json` slot (which feature group) identified.
- [ ] CSRF token / auth handler for any Sling POST endpoint.
- [ ] Content-package layout (`ui.apps` vs `ui.content` vs
      `resource-only`) decided.

## Example user stories for Sling

### STORY-001: Product JSON servlet with etag

**As an** API consumer
**I want** `GET /products/{sku}.json` with `ETag` and `304` support
**So that** clients can cache without re-fetching identical payloads.

**Priority**: MUST | **Effort**: M | **Parent epic**: EPIC-1 Product API
**Dependencies**: `Product` Sling Model (STORY-002)
**AC**:
- Given a valid SKU, when the servlet is called, then a JSON payload +
  `ETag` header are returned.
- Given a request with a matching `If-None-Match`, then the response is
  `304 Not Modified` with an empty body.
- Given an unknown SKU, then `404 Not Found` is returned within 100ms.

### STORY-002: Async thumbnail `JobConsumer`

**As a** content integrator
**I want** thumbnail generation to run asynchronously via `JobConsumer`
**So that** author-side content publishes don't wait on rendering.

**Priority**: SHOULD | **Effort**: L | **Parent epic**: EPIC-2 Async
**Dependencies**: S3 binary store service.
**AC**:
- Given a page is activated, when the observer fires, then a
  `com/example/thumbnail` job is enqueued.
- Given the consumer succeeds, then the rendered thumbnail is stored at
  `/var/thumbnails/<hash>.jpg` within 30s.
- Given the consumer fails 3 times, then the job is moved to the
  dead-letter queue with a diagnostic log entry.

### STORY-003: OSGi installer queue-depth metric

**As an** ops engineer
**I want** OSGi installer queue depth exposed as a Prometheus metric
**So that** I can alert when bundle installation stalls.

**Priority**: MUST | **Effort**: S | **Parent epic**: EPIC-3 Observability
**AC**:
- Given the metric endpoint is scraped, then
  `sling_osgi_installer_queue_depth` is exported.
- Given queue depth exceeds 50, then the Prometheus alert fires within
  60s.

## Anti-patterns to avoid

- "As a developer, I want to inject `BundleContext` into a Sling Model" —
  implementation-only; describe the consumer-visible behavior.
- "As an ops engineer, I want the service to be stable" — no probe,
  no threshold, no SLO.
- "As an integrator, I want better POST performance" — no target, no
  payload size, no concurrency.
- Bundling bundle-registration + resource-type mapping + `HealthCheck`
  + Feature-Model release into one story.

## Story-title formulation

Good:
- "Product JSON servlet with etag"
- "Async thumbnail `JobConsumer`"
- "OSGi installer queue-depth metric"

Bad:
- "OSGi improvements" — vague, no boundary, no owner.
- "Add a bundle" — no capability, no consumer.
- "Fix Sling Distribution" — no cluster, no failure mode.
