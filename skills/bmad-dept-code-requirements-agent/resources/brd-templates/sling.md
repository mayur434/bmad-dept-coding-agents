# BRD authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a BRD for an Apache Sling / Shaft (sling-12)
project — typically a JCR-backed content service standing alongside AEM
AMS instances. Combine with `templates/BRD.md` as the master skeleton.

## Stack-specific personas

- **Bundle developer** — writes OSGi bundles, Sling Models, Sling Servlets
  and Feature-Model composition. Pain: brittle bundle activation order,
  hard-to-reproduce OSGi wiring issues.
- **Content integrator** — feeds content into JCR via Sling POST or
  content-package install; wires resource types to renderers. Pain:
  resource-resolver misroutes, opaque `sling:resourceType` mappings.
- **Ops / platform engineer** — runs the Sling launcher, health checks,
  and Feature-Model releases. Pain: slow bundle-restart windows, missing
  observability on `OsgiInstaller`.

## Stack-specific in-scope patterns

- OSGi bundle scaffolding with `bnd-maven-plugin` or Sling Bundle Archetype.
- `@Component` + `@Service` + `@Reference` declarative services.
- Sling Models with adaptable `@Model(adaptables = {Resource.class,
  SlingHttpServletRequest.class})`.
- Sling POST servlet for content mutation (`:operation` selectors).
- Resource-resolver mappings via `/etc/map` or ResourceResolver.map().
- Health checks via `org.apache.felix.hc.api.HealthCheck`.
- Feature-Model composition (`feature.json`, feature launcher).
- Sling Jobs for async work (`JobConsumer`, `JobManager`).
- Sling Distribution for cross-instance content sync.
- Content-package (`filevault`) shape for JCR content deployment.

## Stack-specific out-of-scope patterns

- Direct `Session` access bypassing `ResourceResolver` — use
  `resourceResolver.adaptTo(Session.class)` only when the Sling Resource API
  is insufficient.
- `Thread.sleep()` inside a Sling Servlet — use `JobManager`.
- Static state on OSGi services — inject `BundleContext` for scoped state.
- Reflection to reach private OSGi service fields — declare a proper
  `@Reference`.
- Tight coupling to a specific JCR provider (Oak vs. Jackrabbit-1.x) beyond
  `javax.jcr` API surface.

## Stack-specific NFRs

**Performance**
- Sling Servlet p95 <= 250ms for read paths.
- Resource-resolver mapping cache-hit >= 99%.
- Sling Job dispatch latency <= 1s from enqueue to worker start under
  steady state.
- Content-package install <= 60s per 10MB package.

**Availability**
- OSGi bundle-activation SLA: <= 30s for a full-instance restart to serve
  first request.
- Health-check endpoint (`/system/health`) responds within 1s.
- Service availability SLO 99.9% monthly.

**Resource limits**
- JVM heap steady-state <= 70% of `-Xmx`; sustained pressure triggers alert.
- OSGi installer queue depth <= 50 pending items.
- Bundle count monitored; growth vs. baseline alerts on release.

**Security**
- All Sling POST endpoints protected by CSRF token or dedicated auth handler.
- OSGi ConfigAdmin values with credentials pulled from external secrets
  provider (Vault / KMS).
- Sling Feature model pins bundle versions; no `LATEST` in production.

## Stack-specific integration points

| System | Direction | Notes |
|---|---|---|
| Identity provider (SAML / OIDC) | inbound | via Sling `AuthenticationHandler` |
| Object storage (S3 / GCS / Azure Blob) | outbound | for binary offload |
| Existing AEM AMS instances | bidirectional | Shaft integrations, content sync via Sling Distribution |
| Event bus (Kafka / SNS / Pub-Sub) | outbound | for downstream fan-out |
| Metrics (Prometheus / Datadog) | outbound | via Sling Metrics + JMX exporter |
| MDM (master-data-management) | bidirectional | content and reference-data sync |
| CI/CD (Jenkins / GitHub Actions) | inbound | Feature-Model build + release |

## Stack-specific success KPIs

- OSGi bundle-activation time on cold start.
- Sling Servlet p95 latency on the top-10 read paths.
- Sling Job success rate + retry-count median.
- Health-check pass rate.
- MDM sync round-trip latency (write on MDM -> visible in Sling).

## Stack-specific risks

- **Bundle-activation order regressions** — a new `@Reference` inversion
  causing a race on startup.
- **Content-package cycle** — a package install triggering
  `OsgiInstaller` re-registration in a tight loop.
- **JCR observation storm** — a listener registered too broadly firing
  millions of events during a bulk import.
- **Feature-Model drift** — hand-patched bundles in prod not reflected in
  the feature file.
- **Session leak** — a servlet forgetting to close a `ResourceResolver`,
  eventually exhausting the pool.

## Stack-specific compliance

- **GDPR** — personal data in JCR under a well-known path, with a
  cross-repository deletion job for right-to-be-forgotten.
- **SOC2** — audit-logging of admin actions via `AuditLogger`.
  <!-- verify: current audit-logger bundle name -->
- **License compliance** — Sling / Felix / Jackrabbit are Apache-2.0; any
  bundled proprietary dependencies must be enumerated in a NOTICE file.

## Example BRD sections for Sling / Shaft

**Executive summary example.**
> The customer-data proxy replaces a legacy servlet container with a
> Sling-12 based Feature-Model deployment fronting an AEM AMS estate. It
> centralizes identity federation, exposes a curated Sling Servlet surface
> to downstream teams, and reduces JCR read pressure on AEM Author by
> caching in a dedicated Sling instance. Success is measured as: (1) Sling
> Servlet p95 read latency <= 250ms, (2) AEM Author `SlingRepository` read
> QPS down >= 40% within 60 days of cutover, (3) bundle-activation time on
> a cold-boot <= 30s.

**In-scope example.**
> New Feature-Model `com.acme.customer-proxy` composed of 8 bundles:
> `com.acme.customer.api`, `com.acme.customer.impl`,
> `com.acme.customer.auth` (SAML handler), `com.acme.customer.rest`,
> `com.acme.customer.jobs`, `com.acme.customer.metrics`,
> `com.acme.customer.config-user`, and `com.acme.customer.hc`
> (health-checks). Sling Jobs for asynchronous ERP sync.

**NFR example.**
> **NFR-Avail-1** — The Sling instance MUST reach a green
> `/system/health.json` state within 30s of process start, so that the
> load-balancer can rotate a rebooted node back into service within one
> heartbeat window. Parent BR: BR-4 (rolling restart). MoSCoW: MUST.

---

Generate the full BRD using `templates/BRD.md` as the master skeleton,
populating placeholders with stack-appropriate content from the guide above.
