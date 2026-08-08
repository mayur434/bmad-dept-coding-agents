# ADR authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an ADR for an AEM as a Cloud Service (AEMaaCS) or
AEM Managed Services (AMS) project. Combine with `templates/ADR.md` as the
master skeleton.

## Stack-specific decision categories

- **Component decomposition** — do we build a bespoke AEM component
  (HTL + Sling Model + `cq:dialog`), extend a Core Component via
  `sling:resourceSuperType` + delegation, compose from Experience
  Fragments, or model as Content Fragments consumed headlessly?
- **Dispatcher topology** — number of farms, publish-tier caching rules,
  invalidation-agent scope, `/statfileslevel` depth, WAF interplay on AMS
  vs the AEMaaCS-managed CDN.
- **Cloud Manager pipeline shape** — Cloud Manager only, GitHub Actions
  as pre-CM validation, or a full customer-managed CI feeding a Cloud
  Manager production pipeline; quality-gate thresholds override policy.
- **Author-Publish topology** — single-author + N-publish, author
  clustering (AMS only <!-- verify: AEMaaCS author scaling policy -->),
  content freeze windows aligned to editorial calendars.
- **Sling Model vs OSGi service** — do we express a capability as a Sling
  Model (per-resource, cached under the resource), an OSGi service
  (singleton, DI-consumed), or a hybrid?
- **Content Fragment vs Experience Fragment vs Component** — reuse
  granularity for shared editorial content.
- **AEMaaCS migration strategy** — big-bang cutover, staged (site by
  site), or coexistence with dispatcher-routed traffic split.
- **Headless surface** — Sling Model exporter (`.model.json`), GraphQL
  API (Content Fragment GraphQL), or REST via custom Sling servlet.

## Common constraints (stack-specific)

- **AEMaaCS** enforces Java 11 (moving to Java 17 <!-- verify: current
  runtime version -->), immutable content packages under `/apps` and
  `/libs`, no filesystem writes at runtime — always JCR.
- **AEMaaCS uber-jar / SDK** boundary: only supported APIs; unsupported
  packages fail the Cloud Manager code-quality gate.
- **AMS** allows more flexibility (custom OS-level integrations, custom
  JVM tuning) but pins you to the AMS Jenkins-based pipeline and
  customer-managed dispatcher pool.
- **Cloud Manager quality gate** — `customer.critical` = 0 permitted;
  `customer.important` <= 10 with manual override; `customer.info`
  informational only. <!-- verify: current defaults -->
- **Content-package structure** must partition mutable content
  (`ui.content`) from immutable code (`ui.apps`) and config (`ui.config`);
  mixing breaks Cloud Manager promotions.
- **Client-libraries** — cache-busted via long-cache headers; broken
  categories/dependencies cause render-blocking JS.
- **Editable-template drift** — components created before template
  policies were introduced become un-editable in the new template.
- **Sling Jobs** — long synchronous work in servlets pins publisher
  threads; must offload.

## Common alternatives (stack-specific)

### Component decomposition
- **Bespoke AEM Component** — full control; more maintenance; owns dialog + HTL + Sling Model.
- **Core Component + `resourceSuperType`** — standards-aligned; requires Core Components >= v2.x <!-- verify: current supported version -->.
- **Experience Fragment reuse** — cross-site content reuse; author-side updates propagate; not addressable via URL.
- **Content Fragment (structured)** — headless / SPA consumption; editable via CF editor; needs a delivery layer.
- **Client-side block (SPA)** — React/Angular composition; author authoring UX weaker.

### Dispatcher topology
- **Single farm** — simple; risks blast radius on cache-invalidation.
- **Per-site farm** — isolation; more config to maintain; better for multi-brand.
- **Per-country farm** — GDPR data-residency alignment; multiplies edge count.
- **Farm-per-workload split** (static vs API) — protects API tier from static-asset churn.

### Cloud Manager pipeline
- **Cloud Manager only** — quickest to production; less flexibility on custom quality gates.
- **Cloud Manager + GitHub Actions pre-CM** — extra validation (unit tests, container security scans) before Cloud Manager pipeline runs.
- **External CI feeding Cloud Manager** (Jenkins, CircleCI) — custom stages, custom quality gates; more moving parts.

### Headless surface
- **Sling Model exporter (`.model.json`)** — same code path as HTL; cheap to add; JSON shape is coupled to Sling Model.
- **Content Fragment GraphQL** — first-class headless; requires CF-driven modelling.
- **Custom Sling Servlet returning JSON** — most flexible; owns its own security + versioning.

## Decision drivers for AEM

- **Core Web Vitals** (LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 on p75).
- **Dispatcher hit-ratio** target (>= 90% on publish tier).
- **Cloud Manager code-quality gate** pass rate (0 customer.critical).
- **Editorial velocity** — pages published per editor per week.
- **Sling render p95** budget (<= 200ms per component).
- **Migration cost** from AMS to AEMaaCS (uber-jar deprecations, javax.\*
  removal, replication API changes).
- **Team AEM depth** — HTL + Sling Model + OSGi vs generic-Java skew.
- **Adobe roadmap alignment** — Core Components, universal editor,
  headless SDK — future direction.
- **PCI scope** for Forms / commerce integration.
- **Multi-brand / multi-country** reuse needs (Experience Fragments,
  Language Copy, Translation Framework).
- **On-prem constraints** (AMS only — VPC peering, private DNS, custom TLS).
- **Author-tier peak concurrency** during content freezes.

## Worked ADR examples for AEM

**ADR-042 — Adopt Cloud Manager for release automation (retire Jenkins pipeline).**
- **Context.** Migrating from AEM 6.5 AMS with Jenkins-based CI to
  AEMaaCS; the AMS Jenkins pipeline runs 8 custom quality stages
  (SonarQube, unit, IT, dispatcher-lint, WAF-rule-lint) that Cloud
  Manager does not natively cover.
- **Options.** (A) Cloud Manager only, (B) Cloud Manager + GitHub Actions
  as pre-CM validation, (C) Cloud Manager + external Jenkins feeding it.
- **Decision.** (B). Cloud Manager owns build+deploy+quality-gate;
  GitHub Actions runs the 8 extra checks pre-push so Cloud Manager sees
  clean code. Rationale: fewer moving parts than option C, more coverage
  than option A.
- **Consequences.** + faster feedback loop, + no Jenkins to operate,
  – GitHub Actions runners bill separately, – custom dispatcher-lint
  script needs porting to GHA.

**ADR-043 — Component decomposition for the article-list block.**
- **Context.** Editorial team needs a paginated, filter-driven article
  list on the news site; must be authorable via TouchUI, must SEO-crawl,
  must LCP <= 2.5s.
- **Options.** (A) Bespoke Component + Sling Model rendering HTL, (B)
  Core Component list extended via `resourceSuperType`, (C) Content
  Fragment GraphQL + client-side rendering.
- **Decision.** (B). Core Component list + custom filter/pagination
  delegated to Sling Model. Rationale: Adobe roadmap alignment,
  automatic accessibility from Core, dispatcher-cacheable, SEO-safe.
- **Consequences.** + free Adobe upgrades, – customization limited by
  Core Component extension points, – requires Core Components v2.22+.

**ADR-044 — Dispatcher farm split by workload.**
- **Context.** Post-cutover to AEMaaCS, top-20 landing pages see 8x
  traffic during marketing campaigns; API-tier calls (`.model.json`)
  churn cache and push hit-ratio to 78%.
- **Options.** (A) Single farm (status quo), (B) Two farms — static
  content + API, (C) Per-site farms.
- **Decision.** (B). Static-content farm with aggressive TTLs; API farm
  with short TTLs + selective invalidation. Rationale: minimal
  configuration change vs C; restores hit-ratio to 92%+ in staging.
- **Consequences.** + protects static tier from API churn, – dispatcher
  config doubles, – needs separate invalidation-agent config.

## Anti-patterns to avoid for AEM

- **Skipping dispatcher farm design when moving to Cloud Manager** —
  AEMaaCS ships a managed CDN + dispatcher, but the config is still
  yours to author; assuming it "just works" produces cache-miss
  cascades.
- **Deploying Java via `ui.content/install/`** — always via `ui.apps`;
  install-folder bundles in `ui.content` are unsupported on AEMaaCS.
- **Custom `AuthenticationHandler` on AEMaaCS** — use
  `com.adobe.granite.auth.ims` for IMS; a custom handler collides with
  the platform's auth chain.
- **Long-running work in Sling servlets** — offload to Sling Jobs; a
  60s HTTP request pins a publisher thread.
- **Editable-templates without a template-type ADR** — teams that skip
  template-type design end up unable to reshape templates without touching
  every consuming page.
- **Undeclared client-library dependencies** — cyclic or missing
  categories cause render-blocking JS regressions that only show up in
  post-deploy Lighthouse runs.

---

Generate the full ADR using `templates/ADR.md` as the master, populating
placeholders with stack-appropriate content from the guide above.
