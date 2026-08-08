# Acceptance-criteria authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **how to shape acceptance criteria**
for user stories on a Sling / Shaft BRD. Combine with
`templates/ac-checklist.md`. Priority tags map MoSCoW -> Summary contract
(`MUST` / `SHOULD` / `COULD` / `WONT`).

## Given / When / Then structure (Sling idioms)

- **Given** typically fixes *JCR content state* (a resource exists at
  `/content/x` with `sling:resourceType = my/rt`), *OSGi service state*
  (a service is registered with property `ranking=100`), or *feature-model
  state* (a feature is active in the current run-mode).
- **When** covers a *Sling HTTP request* (`GET /content/x.html`), an
  *OSGi service invocation*, or a *bundle lifecycle event* (start / stop).
- **Then** targets the *HTTP response* (status, `Content-Type`, body), a
  *JCR side-effect* (`sling:audit` node written), or an *OSGi observable*
  (service reference count, health-check status).

## Types of AC for Sling

### Functional AC
- Given a resource at `/content/my-app/home` with `sling:resourceType =
  my/app/page`, when a GET request hits `/content/my-app/home.html`, then
  the response is 200 with `Content-Type: text/html` and the correct
  script (`page.html.jsp` / `page.html`) resolves.
- Given a `SlingHttpServletRequest` with selector `.json` and extension
  `.json`, when it hits the resource, then the default GET servlet
  serializes the resource to JSON up to depth 3.
- Given a Sling Model annotated `@Model(adaptables=Resource.class)`, when
  the model is adapted from a resource of the right type, then the model
  fields are populated from the JCR properties.
- Given an OSGi feature-model `my-app` is active in run-mode `stage`,
  when the framework starts, then the `stage`-only bundle is present
  and its `Activate` method has run without error.
- Given a Sling Job is queued on topic `my/job/topic`, when a consumer
  is registered for that topic, then the job is processed within its
  configured retry-delay envelope.

### Non-functional AC
- Request throughput >= 1000 req/s per node on the `/content/*` render
  path at Sling Model p95 <= 100ms. <!-- verify: customer's actual load target -->
- Resource resolver p95 <= 20ms per lookup (Sling Metrics).
- Service startup: all `Activate` methods complete <= 60s from framework
  start; no service stuck in `SATISFIED` for more than 30s.
- Health-check aggregator returns `OK` within 5s of `/system/health.json`
  request; timeout budget per HC <= 2s.
- OSGi bundle activation p99 <= 1s per bundle.

### Edge-case AC
- Given a resource with a self-referential `sling:resourceSuperType`
  chain, when the resolver evaluates it, then the resolver breaks the
  cycle and logs a WARN (no stack overflow).
- Given an OSGi config `my.app.PID` is updated at runtime, when the
  `ConfigurationAdmin` fires, then the `@Modified` callback runs and
  no listener holds a stale reference.
- Given a bundle depends on `com.example:api;version="[1,2)"`, when a
  `2.0.0` version is installed, then the dependent bundle stays in
  `INSTALLED` (not `ACTIVE`) and a health-check reports it.
- Given a Sling Job topic has no consumer, when a job is queued, then
  it is retained on the queue and surfaces on the `/system/console/slingevent`
  page for operator triage.

### Security AC (STRIDE-inspired)
- Given a resource at `/apps/**`, when an unauthenticated request hits
  it directly, then the response is 404 (Sling default authorization).
- Given a `SlingServlet` at `/bin/my-app/*` receives a POST without a
  CSRF token, when it processes the request, then it responds 403.
- Given a service-user `my-app-service` is mapped in
  `org.apache.sling.serviceusermapping.impl.ServiceUserMapperImpl`, when
  the service opens a resolver, then it uses that user (never `admin`).
- Given a JCR property write from a servlet, when the input contains
  a JCR `expression` (`${...}`), then it is escaped and no JCR-EL
  injection occurs.
- Given OSGi web-console (`/system/console/*`) is exposed, when a
  request reaches it, then it is protected by a filter that requires
  `sudoers`/`admin` group membership.

### Performance AC (measurable)
- `curl -sw '%{time_total}' https://<host>/content/x.html` <= 0.15s p95
  over 100 warm requests.
- Sling Metrics `sling.resource.resolver.mapping.time` p95 <= 20ms.
- OSGi framework startup <= 90s from JVM start to `/system/health` = OK.
- Sling Job throughput on topic `my/job/topic` >= 100 jobs/s per node.

### Testability guidance
- Unit: **JUnit 5 + Sling Mocks (`org.apache.sling.testing.sling-mock`)**
  for Sling Models, servlets, and resource-resolver behavior.
- Integration: **Sling Testing PaxExam** for OSGi bundle wiring, or
  **Sling Starter / feature-model launcher** in CI.
- API: **Sling Testing Clients** (`org.apache.sling.testing.clients`) for
  HTTP-level assertions.
- Health: `/system/health.json?tags=readiness` scraped in CI.
- Reference `test-generation/sling.md`.

## Negative AC (what MUST NOT happen)
- A servlet MUST NOT open an admin `ResourceResolver` via
  `getAdministrativeResourceResolver` — deprecated and unsafe.
- A service MUST NOT rely on `@Reference` field injection for
  optional/dynamic services without a `policy=DYNAMIC` declaration.
- OSGi bundles MUST NOT be installed at runtime via a servlet — use the
  feature model + Cloud Manager pipeline.
- A Sling Job MUST NOT be marked `TIMEOUT`-only without a max-retries
  ceiling (avoid infinite queue growth).
- `/system/console/*` MUST NOT be exposed on the public network of any
  environment beyond `dev`.

## Testability check per AC
- [ ] Testable — framework + assertion identified.
- [ ] Measurable — concrete pass/fail.
- [ ] Unambiguous — no interpretation gap.
- [ ] Independent — no undeclared prereq.
- [ ] Small — one behavior per AC.

## Common AC anti-patterns for Sling
- "The resource should resolve fast" -> "Resource resolver mapping p95
  <= 20ms (Sling Metrics `sling.resource.resolver.mapping.time`)".
- "The service should be resilient" -> "Given the downstream service is
  down, When the OSGi service is invoked, Then it returns a fallback
  and increments the `service.error` metric".
- "Health check should work" -> "Given `/system/health.json?tags=readiness`
  is polled, When all aggregated HCs pass, Then response is 200 with
  `status: OK` and each HC completes <= 2s".
- "Job should retry" -> "Given a job on topic `X` fails transiently,
  When it retries, Then max retries = 5 with exponential backoff and
  a dead-letter emitted on the 6th failure".
