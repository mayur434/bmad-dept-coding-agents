# BRD authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a BRD for an AEM as a Cloud Service (AEMaaCS) or
AEM Managed Services (AMS) project. Combine with `templates/BRD.md` as the
master skeleton.

## Stack-specific personas

- **Content author (editorial)** — authors and publishes pages via the AEM
  Sites TouchUI, works in Experience Fragments and Content Fragments, needs
  editable-template stability and predictable component dialogs. Pain: broken
  dialogs after component updates, missing preview parity.
- **AEM developer (backend + frontend)** — writes Sling Models, HTL, Java
  services, client-libraries, and dispatcher rules. Ships via Cloud Manager
  or a customer-managed CI/CD. Pain: opaque quality-gate failures, dispatcher
  rule regressions, slow local Author instance.
- **Dispatcher / infrastructure admin** — owns dispatcher configuration,
  CDN, TLS, WAF rules on AMS; owns the config farm on AEMaaCS. Pain:
  cache-invalidation ripples, hit-ratio drops after a release.
- **DevOps / release manager** — owns Cloud Manager pipelines (or AMS Jenkins
  / CircleCI), quality gates, environment promotion. Pain: `customer.critical`
  violations blocking prod deploys, code-quality drift.

## Stack-specific in-scope patterns

- Editable templates, template types, and policy configuration.
- Core Components extension via `sling:resourceSuperType` + delegation.
- Custom AEM components (HTL + Sling Model + dialog `cq:dialog.xml`).
- Sling Model exporters for headless / SPA use.
- Content Fragment Models and Experience Fragment reuse across sites.
- Dispatcher farm updates (filters, rewrites, cache rules, invalidation
  agents).
- Cloud Manager custom pipeline steps (or AMS pipeline steps).
- Content-package structure (`ui.apps`, `ui.content`, `ui.config`, `all`).
- OSGi run modes (`author`, `publish`, `dev`, `stage`, `prod`) and config
  precedence.
- Client-library categories, dependencies, and long-cache headers.

## Stack-specific out-of-scope patterns

- Direct filesystem writes at runtime — always go through the JCR.
- Custom authentication mechanisms — use Sling `AuthenticationHandler` and,
  on AEMaaCS, integrate with Adobe IMS via the `com.adobe.granite.auth.ims`
  bundle.
- Long-running synchronous work in `SlingServlet` — offload to Sling Jobs.
- Bypassing the dispatcher for authoring surfaces on publish tier.
- Java code deployed via `install/` folder in `ui.content` — install
  bundles via `ui.apps` only.
- Custom `sling:OsgiConfig` for third-party bundles without a `resource-only`
  package boundary.

## Stack-specific NFRs

**Performance (Core Web Vitals + AEM-native)**
- LCP <= 2.5s on p75 devices (mobile + desktop).
- INP <= 200ms on p75.
- CLS <= 0.1 on p75.
- Dispatcher cache hit-ratio >= 90% on publish tier.
- Author instance p95 request latency <= 800ms during editorial peak.
- Sling Model render p95 <= 200ms per component.
- Publisher replication end-to-end <= 30s from activate to dispatcher purge.

**Availability**
- Publish tier SLO: 99.9% monthly.
- Author tier SLO: 99.5% during business hours (AEMaaCS-managed, but content
  freezes still apply on customer side).

**Cloud Manager quality gate thresholds** <!-- verify: current defaults -->
- `customer.critical`: 0 permitted.
- `customer.important`: <=10 permitted before manual override.
- `customer.info`: informational only.

**Accessibility**
- WCAG 2.2 AA on all publicly-rendered pages.
- Author-tier admin UI accessibility per Adobe Sites baseline.

**Security**
- CSRF tokens on all POST / DELETE / PUT to `/bin/*` and custom servlets.
- Dispatcher denies `/system/*`, `/crx/*`, `/bin/*` selectors on publish.
- Secrets via Cloud Manager environment variables (or `granite.auth.token`
  on AMS) — never in the content repository.

## Stack-specific integration points

| System | Direction | Notes |
|---|---|---|
| Adobe Target | outbound | via ContextHub / Adobe Launch |
| Adobe Analytics | outbound | via Adobe Launch data layer |
| Adobe Launch / Tags | outbound | tag-manager for all client-side telemetry |
| Adobe I/O Events for AEM | outbound | asset / content-fragment events |
| Cloud Manager pipelines | bidirectional | source-code -> deployment |
| External CDN (Fastly / Akamai) | inbound | for AMS; AEMaaCS ships managed CDN |
| Identity provider (Adobe IMS / SAML / OIDC) | inbound | via `AuthenticationHandler` |
| Adobe Assets essentials (DAM) | bidirectional | asset lifecycle + metadata |
| Translation service (Smartling / TransPerfect / GlobalLink) | bidirectional | via Translation Framework |

## Stack-specific success KPIs

- Core Web Vitals p75 within targets on top-20 landing pages.
- Dispatcher hit-ratio measured weekly on the publish tier.
- Author-side content-velocity (pages published per editor per week).
- Cloud Manager pipeline pass-rate.
- Customer-critical quality-gate violations trending toward zero.

## Stack-specific risks

- **Cache-invalidation cascades** — a mis-scoped dispatcher `/statfileslevel`
  flush hitting the whole site.
- **Editable-template drift** — components created before template policies
  were introduced becoming un-editable in the new template.
- **Long-running Sling Jobs** — job queue backlog causing publisher heap
  pressure.
- **Author instance content freezes** — Cloud Manager maintenance windows
  colliding with editorial peak.
- **Client-library dependency loops** — leading to render-blocking JS on
  publish.

## Stack-specific compliance

- **WCAG 2.2 AA** on all public-facing pages (Sites, Forms).
- **GDPR** — cookie consent surface (Adobe Launch + OneTrust or in-house),
  content-fragment PII segregation.
- **AODA / EN-301-549** for regulated markets. <!-- verify: per-market
  applicability -->
- On AMS, contractual **99.9% publish-tier availability** and
  incident-response SLAs per Adobe Managed Services SLA.

## Example BRD sections for AEM

**Executive summary example.**
> The Sites platform migration from AEM 6.5 AMS to AEMaaCS unlocks
> continuous release cadence via Cloud Manager, retires the customer-run
> dispatcher pool, and aligns the front-end with Core Component v3
> patterns. Success is measured as: (1) all 200+ authored templates
> re-authored on editable templates with policies, (2) dispatcher hit-ratio
> restored to >= 92% within 30 days of cutover, (3) LCP p75 <= 2.5s on the
> top-20 landing pages measured via CrUX.

**In-scope example.**
> Migration of 12 sites (US/UK/DE/FR/JP/AU + brand variants), 240 templates,
> 1,850 pages, 6,200 experience fragments, and 14 content-fragment models.
> Cloud Manager production pipeline with per-stage quality gates.
> Re-authored dispatcher config using the AEMaaCS SDK. Adobe Launch
> re-integration.

**FR example.**
> **FR-14** — Editorial preview parity. Author preview MUST render pages
> using the same client-library manifest and dispatcher rewrite rules as
> production, so that a page approved on Author renders identically on
> Publish. Parent BR: BR-3. MoSCoW: MUST. Effort: L.

---

Generate the full BRD using `templates/BRD.md` as the master skeleton,
populating placeholders with stack-appropriate content from the guide above.
