# HLD authoring guide — Adobe Commerce (PaaS / Magento 2)

## Purpose framing

A Commerce PaaS HLD establishes the **application/DB/cache/queue tier
layout** on Adobe Commerce Cloud infrastructure, the **Fastly VCL edge
strategy**, the **module boundary** (custom modules vs marketplace vs
core), and the **integration model** for ERP/OMS/PIM/tax/shipping. It
pins the **release approach** (composer + `bin/magento setup:upgrade`) and
the **indexer + cron topology**.

## Typical containers (C4 L2 elements) for Commerce PaaS

- **Fastly (Edge)** — managed by Adobe Commerce Cloud; VCL for full-page
  cache, image optimization, WAF, geo routing.
- **Nginx** — SSL termination, static asset serving, PHP-FPM proxy.
- **PHP-FPM app tier** — Magento 2 codebase (composer-managed); scaled
  horizontally on Pro plan (3-node HA cluster).
- **MySQL / Percona / MariaDB** — primary catalog/order/customer store;
  primary + 2 replicas on Pro.
- **OpenSearch (formerly Elasticsearch)** — catalog search, product
  filters, layered-navigation aggregations.
- **RabbitMQ** — consumer queues for async work (email, indexing, ERP
  sync, PWA cache flush).
- **Redis** — session storage + default cache backend + FPC L2.
- **Cron (`bin/magento cron:run`)** — indexers, cleanup, email digest,
  scheduled jobs (`crontab`).
- **Adobe Commerce Admin** — Adminhtml on same PHP-FPM tier
  (`admin` area), usually behind IP allowlist.
- **Payment gateway** — Braintree / Adobe Commerce Payment Services /
  external PSP over PCI-scoped tunnels.

## Stack-specific tech-choice table

| Container | Technology | Why |
|---|---|---|
| App | Magento 2.4.7+ on PHP 8.3 <!-- verify: current supported minor --> | Adobe LTS; PHP 8.2 EOL alignment |
| DB | MySQL 8.0 (Percona 8.0 on Cloud Pro) | Adobe-supported; GTID replication |
| Search | OpenSearch 2.x <!-- verify --> (Elastic removed in 2.4.6) | Adobe migrated away from Elastic license |
| Cache | Redis 7.x split into `default`, `page_cache`, `session` | Cache-key isolation avoids purge storms |
| Broker | RabbitMQ 3.11+ | Native `consumers.php` integration |
| Edge | Fastly VCL (Adobe Commerce Cloud module) | Purge via Surrogate-Keys, WAF included |
| Deploy | ECE-Tools + Composer 2.x | Adobe Commerce Cloud CI conventions |
| Payment | Adobe Commerce Payment Services / Braintree | SAQ-A PCI scope |

## Cross-cutting concerns for Commerce PaaS

- **AuthN/AuthZ** — Admin via `admin` area + 2FA (mandatory since 2.4.0);
  Storefront customer auth via `customer/account`; API via OAuth
  1.0a or Integration Bearer tokens.
- **Logging** — `var/log/system.log` + `debug.log` + `exception.log`;
  Cloud Pro forwards to New Relic + Fastly logs to Splunk sink.
- **Tracing** — New Relic APM (bundled on Cloud); OTEL via community
  module, non-standard on PaaS.
- **Config** — `env.php` (env-specific), `config.php` (shared), `.magento.env.yaml`
  build config; scopes: default / website / store.
- **Secrets** — Cloud env vars via `magento-cloud variable:create --sensitive`;
  never in `env.php` or config XML.
- **Feature flags** — `Magento_Config` + scope-scoped Yes/No configs; or
  LaunchDarkly module (community).
- **i18n** — `i18n/en_US.csv` translation packs; per-store view scope.

## Integration points typical to Commerce PaaS

- **ERP** (SAP, NetSuite, Oracle) — REST or SOAP; async via RabbitMQ
  consumers.
- **OMS** (IBM Sterling, Kibo, Fluent) — order-lifecycle webhooks or
  polled pull.
- **PIM** (Salsify, Akeneo, inRiver) — product import via CSV batch or
  REST push; hourly cadence typical.
- **Tax** — Vertex, Avalara (`bin/magento` extensions).
- **Shipping** — FedEx, UPS, USPS via native modules; Shipper HQ for
  complex rate rules.
- **Adobe Analytics / Launch** — via `Magento_Analytics` module + Web SDK.
- **Adobe Target** — server-side via API or client-side via `at.js`.
- **CDP/CRM** — Salesforce Connector or custom REST push.
- **Fraud** — Signifyd, Riskified, Kount.
- **Email/CRM** — Dotdigital (Adobe recommended), Mailchimp.

## NFR profile for Commerce PaaS

- **Checkout p95** ≤ 2s (`checkout/index/index`); order-place ≤ 3s.
- **Catalog TTFB** ≤ 300ms cached, ≤ 1.5s uncached (category page).
- **Fastly hit ratio** ≥ 90% for catalog+CMS pages.
- **DB replication lag** ≤ 5s (replica used for read APIs).
- **Indexer completion** — full reindex within 1h for 500k SKU catalog
  <!-- verify: current benchmark -->.
- **Cron drift** — ≤ 60s between scheduled and actual start.
- **Availability** — Cloud Pro SLA 99.99% (three-node HA)
  <!-- verify: current Adobe SLA number -->.
- **PCI compliance** — SAQ-A scope maintained (tokenized payments only).

## Capacity planning shape

- **Cloud Pro** — 3-node HA cluster standard; scale to 6-node for
  BFCM/major traffic (Adobe re-sizes on request).
- **SKU count → DB size** — plan ~1 GB per 100k SKUs on `catalog_product_*`
  tables + EAV overhead <!-- verify -->.
- **Traffic assumption** — 500 RPS storefront steady + 3x peak; checkout
  ~5% of total; API traffic budgeted separately.
- **Async workers** — one dedicated consumer worker per queue group
  (email, index, ERP-sync, PWA-cache).
- **Cache** — Redis sized to 2x average working set to survive purge
  bursts.

## Deployment topology

Mermaid `flowchart` shape: `Client → Fastly PoP → Nginx → PHP-FPM (3
nodes) → MySQL primary + 2 replicas; OpenSearch cluster (3 nodes);
RabbitMQ (3 nodes); Redis (3-node sentinel)`. Multi-AZ; single-region
primary with disaster-recovery region on Pro.

## Delivery / release approach for Commerce PaaS

- **Composer-based release** — `composer update` locally, commit
  `composer.lock`; `magento-cloud push` triggers build.
- **ECE-Tools deploy** — `build` → `deploy` → `post_deploy` hooks;
  `.magento.app.yaml` defines the phases.
- **DB migrations** — `bin/magento setup:upgrade` runs during `deploy`;
  schema patches versioned in module `Setup/Patch/Schema/`.
- **Catalog re-index** — reset `indexer:reindex` on catalog structural
  change; use `Update by Schedule` mode in production to avoid full
  rebuild.
- **Cache warm-up** — Fastly VCL primes top-N pages post-deploy.
- **Rollback** — `magento-cloud environment:redeploy --activate <prev>`.

## 3 worked HLD outline examples for Commerce PaaS

**HLD-01: B2B Punchout Catalog Integration**
- Containers: PHP-FPM + Magento_B2B module + custom Punchout module +
  RabbitMQ + Ariba/Coupa endpoints + PIM.
- ADRs: ADR-plugin-vs-preference-for-cart; ADR-async-vs-sync-punchout;
  ADR-company-account-scope.
- Cross-cutting: OAuth 1.0a for Ariba, IP allowlist per buyer.
- NFRs: punchout roundtrip ≤ 4s, quote generation ≤ 2s p95.
- Rollout: pilot with 3 buyers, then GA.

**HLD-02: OMS Integration for Ship-from-Store**
- Containers: PHP-FPM, Magento_InventoryApi, RabbitMQ (SFS queue), OMS
  webhook consumer, DC-select service.
- ADRs: ADR-MSI-source-selection-algo; ADR-async-vs-sync-reservation.
- Cross-cutting: idempotency keys per order-line, retry-with-backoff.
- NFRs: reservation p95 ≤ 500ms, source-select ≤ 200ms.
- Migration: feature flag by store view, phased ramp.

**HLD-03: Fastly Edge Personalization**
- Containers: Fastly VCL + edge dictionaries + PHP fallback + RTCDP.
- ADRs: ADR-edge-vs-origin-personalization; ADR-consent-mode.
- Cross-cutting: cookie-based cohort assignment; consent-aware fallback.
- NFRs: Fastly hit ratio ≥ 92%; personalization decision ≤ 20ms edge.
- Rollout: dark launch → 5% → 100%.

## Anti-patterns to avoid for Commerce PaaS

- **Synchronous ERP-blocking cart totals** — never call ERP inline in
  `quote/collectTotals`; cache or event-source.
- **Business logic in `Preferences`** — makes upgrades brittle; prefer
  plugins with clear priorities.
- **Skipping the indexer strategy** — full reindex on every save kills
  BFCM; always use `Update by Schedule`.
- **Custom `checkout` overrides via layout XML** — fragile; use
  UI-component config + LayoutProcessor.
- **Long-running observers** — pins PHP request threads; move to
  queue consumers.

---

Generate the full HLD using `templates/HLD.md` as the master, populating
placeholders with stack-appropriate content from the guide above. When
container/technology decisions are still open, produce an ADR alongside
(see `resources/adr-templates/commerce-paas.md`).
