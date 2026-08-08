# HLD authoring guide — AEM (AEMaaCS + AMS)

## Purpose framing

An AEM HLD establishes the **Author-Publish topology**, the **dispatcher
farm layout**, the **content-model boundary** (page components vs Content
Fragments vs Experience Fragments), and the **cross-tier integrations**
(IMS, Assets, external CMS/PIM, personalization). It sets the **Cloud
Manager pipeline shape** for AEMaaCS (or Jenkins for AMS) and pins
**Author-tier capacity** against editorial peak concurrency.

## Typical containers (C4 L2 elements) for AEM

- **AEM Author Instance** — Sling/OSGi runtime; TouchUI + WCM APIs; authors
  create content, workflows fan out to translation/approvals. AEMaaCS
  provides a managed single-author (with autoscaled preview); AMS supports
  author-clustering.
- **AEM Publish Instances** — 2–N replicas serving public traffic; content
  replicated from Author via `com.day.cq.replication`.
- **Dispatcher (Apache + mod_dispatcher)** — one farm per site or per
  workload; caches under `/mnt/var/www/html`; enforces `filter` and
  `renders` rules.
- **CDN** — AEMaaCS-managed CDN in front of dispatcher (Fastly-based); AMS
  brings its own (Akamai / CloudFront / Fastly).
- **AEM Assets / DAM** — renditions pipeline, Dynamic Media, Assets Insights.
- **AEMaaCS Preview tier** — pre-publish preview for editorial validation.
- **External CMS / PIM / DAM sync source** — inbound content via CIF, SFTP,
  or Assets Brand Portal.
- **Adobe Target / Analytics / Journey Optimizer** — personalization and
  attribution downstream of Publish.

## Stack-specific tech-choice table

| Container | Technology | Why |
|---|---|---|
| Author | AEMaaCS 2024.x / AEM 6.5 SP20+ on AMS <!-- verify --> | Adobe-managed runtime; Cloud Manager gate |
| Publish | Same as Author, run-mode `publish` | Same code, different config precedence |
| Dispatcher | Apache 2.4 + `dispatcher.any` v4.x + Immutable Files ruleset <!-- verify --> | Adobe-shipped module; farm-level `/statfileslevel` control |
| CDN | AEMaaCS Fastly (managed) or customer Akamai on AMS | Edge cache, WAF, HTTP/3 |
| DAM | AEM Assets (built-in) or Assets Essentials for hub | Native rendition pipeline |
| Search | AEM QueryBuilder (native) or Adobe Sensei preview | Content search vs commerce catalog |
| Auth | IMS via `com.adobe.granite.auth.ims` (AEMaaCS) / SAML (AMS) | Enforced by platform on AEMaaCS |
| Client-libs | HTL + AEM ClientLibraryManager | Cache-busted, categorized |

## Cross-cutting concerns for AEM

- **AuthN/AuthZ** — AEMaaCS enforces IMS federation; AMS uses SAML/LDAP.
  Author permissions via `rep:policy` + Closed User Groups on Publish for
  entitled content.
- **Logging** — AEMaaCS ships to Cloud Log Forwarder (Splunk sink common);
  AMS writes `error.log` / `request.log` / `access.log` under `crx-quickstart/logs`.
- **Tracing** — Adobe Cloud Manager provides basic traces; OTEL SDK via
  custom OSGi bundle (bring-your-own).
- **Config** — OSGi run-mode configs under `ui.config/src/main/content/jcr_root/apps/<project>/osgiconfig/config.<runmode>`.
- **Secrets** — Cloud Manager env secrets (`$[secret:...]` placeholders);
  never in OSGi configs committed to git.
- **Feature flags** — Toggle Router pattern via OSGi service, or
  `com.day.cq.wcm.foundation.forms.impl.FormsHandlingServlet` toggle
  configs; LaunchDarkly SDK when third-party is approved.
- **i18n** — Language Copies + Translation Framework; JCR `i18n` dictionaries.

## Integration points typical to AEM

- **Adobe Target** — via `at.js` on Publish; MBox server-side via Target Node SDK.
- **Adobe Analytics** — Launch tag manager; Analytics Extension.
- **Adobe Journey Optimizer / Campaign** — inbound triggers, offer decisioning.
- **RTCDP** — profile enrichment via Web SDK (`alloy.js`).
- **Commerce backend** — CIF connector (GraphQL to Adobe Commerce) for
  product data.
- **External PIM / DAM** — polling Sling jobs or webhook-triggered import.
- **Translation vendors** — GlobalLink / Smartling connectors.
- **Search vendors** — Coveo / Algolia / Endeca connectors when native
  QueryBuilder is insufficient.
- **CRM** — SOAP/REST via Sling OSGi HTTP client.
- **Payment/eCommerce** — usually through Commerce CIF; direct integration
  is an anti-pattern.

## NFR profile for AEM

- **Author responsiveness** — p95 `/cf#/` editor page load ≤ 3s; component
  dialog open ≤ 500ms.
- **Publish TTFB** — p95 ≤ 200ms for cached; ≤ 800ms for uncached.
- **Dispatcher hit ratio** — ≥ 90% publish tier; ≥ 95% for static content
  farm.
- **Replication lag** — Author → Publish ≤ 60s p95; CF publication ≤ 60s.
- **CDN offload** — ≥ 85% requests never reach dispatcher.
- **Availability** — 99.9% publish tier (Adobe AEMaaCS SLA);
  <!-- verify: current AEMaaCS SLA percentage --> author is not SLA-covered
  for consumer availability.
- **Core Web Vitals** — LCP ≤ 2.5s / INP ≤ 200ms / CLS ≤ 0.1 on p75.
- **Cloud Manager code-quality gate** — 0 `customer.critical`.

## Capacity planning shape

- **AEMaaCS** — capacity is Adobe-managed; you plan **traffic tiers** and
  **content volumes** (DAM TB, page count, CF count) not instance count.
- **AMS** — typical starter: 1 Author + 2 Publish + 2 Dispatcher (per DC);
  scale Publish horizontally at ~200 concurrent RPS per instance
  <!-- verify: AMS sizing guide -->.
- **DAM** — plan for 3–5x source-asset volume after renditions.
- **Editorial peaks** — content freezes push author concurrency 5–10x
  above baseline; plan for it in AMS, monitor on AEMaaCS.

## Deployment topology

Mermaid `flowchart` shape: `CDN → Dispatcher farm (per site/workload) →
Publish pool → Author (replication only)`; DAM assets served via
Author → binary-cloud storage → CDN. Cloud Manager tier boundary
separates dev / stage / prod, with git branches `develop` / `stage` /
`main` mapped to Cloud Manager pipelines.

## Delivery / release approach for AEM

- **Cloud Manager phased rollout** — dev auto on merge; stage on tag;
  prod via manual production pipeline with 24h stage soak.
- **Content packages** — code (`ui.apps`) immutable; content
  (`ui.content`) mutable; configs (`ui.config`) run-mode-scoped.
- **Maintenance windows** — content-freeze windows around big-bang
  releases; blue/green not native (Adobe manages).
- **Rollback** — Cloud Manager one-click; content changes captured via
  package snapshot pre-deploy.

## 3 worked HLD outline examples for AEM

**HLD-01: Loyalty Program Author-Publish Extension**
- Containers: Author, Publish (3x), Dispatcher (loyalty farm), CDN,
  Adobe Journey Optimizer, Loyalty backend (Spring), PIM.
- ADRs: ADR-CF-vs-XF-for-tier-content; ADR-Journey-vs-Campaign-triggers;
  ADR-token-exchange (IMS → loyalty).
- Cross-cutting: IMS federation, secrets in CM env, feature flag for
  "double-points weekend".
- NFRs: Author responsiveness (editorial 8-person concurrency), CF
  publication lag ≤ 60s, Journey enrollment ≤ 5s p95.
- Migration: dual-run with legacy loyalty; strangler-fig by tier.

**HLD-02: Newsroom Site AEMaaCS Cutover**
- Containers: Author, Publish (5x), Dispatcher (news + assets farms),
  CDN, Assets (Dynamic Media), Translation Framework.
- ADRs: ADR-editable-templates-migration; ADR-CIF-vs-headless-shop;
  ADR-dispatcher-farm-split.
- Cross-cutting: Language Copies, GDPR cookie consent, syndication feed.
- NFRs: LCP ≤ 2.5s, dispatcher hit ≥ 92%, editorial publish workflow
  ≤ 30s.
- Migration: staged site-by-site over 3 sprints; DNS cutover per site.

**HLD-03: Assets Brand Portal Distribution**
- Containers: AEM Assets, Brand Portal, DAM sync consumers, S3 archive.
- ADRs: ADR-DAM-sync-cadence; ADR-rendition-pipeline-tuning.
- Cross-cutting: Assets Insights, IMS auth for partner brands.
- NFRs: rendition throughput ≥ 500 assets/hr, DAM search ≤ 500ms p95.
- Rollout: pilot with 2 brands, then org-wide.

## Anti-patterns to avoid for AEM

- **Skipping the dispatcher farm design** — AEMaaCS ships a managed CDN
  but the farm rules are still yours; assuming "it just works" produces
  cache-miss cascades.
- **Author-side rendering for consumer traffic** — Author is not SLA
  guaranteed for public traffic; always render on Publish.
- **Custom AuthenticationHandler on AEMaaCS** — collides with the
  platform IMS chain; use `com.adobe.granite.auth.ims`.
- **Long synchronous work in Sling servlets** — pins publisher threads;
  offload via Sling Jobs / Scheduled Jobs.
- **Mixing mutable content into `ui.apps`** — breaks Cloud Manager
  promotions; always partition `ui.apps` / `ui.content` / `ui.config`.

---

Generate the full HLD using `templates/HLD.md` as the master, populating
placeholders with stack-appropriate content from the guide above. When
container/technology decisions are still open, produce an ADR alongside
(see `resources/adr-templates/aem.md`).
