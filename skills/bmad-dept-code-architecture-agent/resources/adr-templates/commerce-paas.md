# ADR authoring guide — Adobe Commerce (PaaS / Magento 2)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an ADR for an Adobe Commerce (Magento 2 / PaaS)
project. Combine with `templates/ADR.md` as the master skeleton.

## Stack-specific decision categories

- **Preference vs Plugin vs Observer** — how to extend core: DI
  preference (replaces the class — upgrade-hostile), plugin
  (before/after/around — upgrade-safer), observer (event subscription —
  loose coupling).
- **GraphQL vs REST for new endpoints** — headless-first shops prefer
  GraphQL; enterprise integrations often need REST + WS-\*.
- **DB schema patch strategy** — declarative-schema (`db_schema.xml`) vs
  data patches (`Setup/Patch/Data`) vs schema patches
  (`Setup/Patch/Schema`); UpgradeSchema is deprecated.
- **Full-page cache invalidation** — cache-tag strategy (per-entity
  vs per-collection), Varnish vs FPC internal, hole-punching for private
  blocks (customer sections).
- **Payment tokenization approach** — hosted payment page vs iframe vs
  vaulted payment SDK; PCI scope difference.
- **Async / message topology** — RabbitMQ topics + consumers vs direct
  synchronous call; consumer horizontal scaling; MQ vs bulk API.
- **Multi-store / customer-group scoping** — per-website, per-store,
  per-store-view configuration precedence; catalog + attribute scope.
- **Indexer strategy** — schedule vs on-save; partial indexers; MView
  changelog vs full re-index.
- **Search backend** — OpenSearch (bundled) vs Adobe Commerce Live Search
  (SaaS-hosted); relevance tuning shifts.

## Common constraints (stack-specific)

- **PHP 8.1+ / 8.2** target runtime; Composer 2. <!-- verify: current
  supported PHP versions per version -->
- **Magento module load order** enforced by
  `module.xml` `<sequence>`; a preference cycle blocks bootstrap.
- **`app/code` for custom, `vendor/` immutable** — hotfixes go through
  Composer patches (`vaimo/composer-patches` or `cweagans/composer-patches`).
- **DI compilation** required for production; missing type-hints in DI
  args break `bin/magento setup:di:compile`.
- **Static-content deployment** required per environment; theme changes
  need deploy + FPC flush.
- **Multi-store data locality** — MySQL EAV vs flat catalog affects
  scope-aware queries.
- **PCI-DSS** scope — SAQ-A (fully hosted / redirect / iframe) vs
  SAQ-D-Merchant (JavaScript direct-post) — determines audit surface.
- **B2B module** licensing gates B2B features (Company, Requisition
  Lists, Quotes).
- **PWA Studio / Luma** theme fork — PWA is separate deployable.

## Common alternatives (stack-specific)

### Extension mechanism
- **Preference** — replaces target class; simplest to write; **very**
  upgrade-hostile; conflicts with any other preference.
- **Plugin** — around/before/after; upgrade-safer; type-hint fragile; must
  respect `sortOrder`.
- **Observer** — fires on event; loosest coupling; async candidate; harder
  to debug ordering.

### GraphQL vs REST
- **GraphQL** — headless-native; single round-trip; harder to cache at
  edge; Apollo/urql clients.
- **REST (V1)** — standardized under `/rest/V1/*`; cacheable per-URL;
  swagger.json auto-generated; heavier for composite queries.
- **REST async / bulk** — `/rest/async/V1/*` + `/rest/all/async/bulk/V1/*`
  for high-throughput back-office writes.

### Schema patches
- **Declarative schema (`db_schema.xml`)** — reversible, idempotent, safe
  in CI; can't do data changes.
- **Data patch** — one-shot data manipulation; idempotency in patch body;
  hard to roll back.
- **Schema patch** — imperative schema edits (adding indexes not
  representable in declarative); prefer declarative when possible.

### Cache invalidation
- **Per-entity tag** — narrow invalidation; more tags per response;
  Varnish tag-header size limits at scale.
- **Per-collection tag** — broader; simpler; over-invalidates.
- **Hole-punching** — private block ESI/AJAX; keeps FPC on for cart /
  customer / mini-cart.

### Async topology
- **RabbitMQ topic + consumer** — decoupled; horizontal scale; needs
  DLQ + retry policy.
- **Direct synchronous call** — simpler; back-pressure risk on peak.
- **Bulk API** — merges thousands of ops; report-based tracking; better
  for batch ETL from ERP.

## Decision drivers for Commerce PaaS

- **Checkout latency** budgets (TTFB <= 200ms; add-to-cart <= 500ms).
- **Catalog re-index** SLA (partial <= 5 min; full <= 30 min).
- **FPC hit-ratio** target (>= 90% on category / PDP).
- **Upgrade cost** — every year Adobe ships breaking changes; preferences
  compound the tax.
- **PCI scope** (SAQ-A vs SAQ-D-Merchant) — payment integration ADR
  drives the audit surface.
- **B2B licensing** — Company / Quote / Requisition-List features gate
  design choices.
- **Multi-store scope** — website / store / store-view partitioning drives
  everything from catalog attribute scope to config precedence to
  translation strategy.
- **Team PHP depth** vs generic backend skew.
- **On-prem vs cloud** — self-hosted infra vs Adobe Commerce Cloud (ECE)
  vs Adobe Commerce as a Service — deployment mechanism differs.
- **Payment gateway** presence (Braintree / Adyen / Stripe / PayPal /
  Klarna) — module choice + tokenization approach.
- **ERP integration cadence** (real-time vs batch) — sync vs message-queue.

## Worked ADR examples for Commerce PaaS

**ADR-051 — Plugin over Preference for `\Magento\Sales\Model\Order\Email\Sender\OrderSender`.**
- **Context.** Marketing wants order-confirmation emails routed via a
  third-party ESP (SendGrid) with template versioning; core `OrderSender`
  handles both send + template resolution.
- **Options.** (A) Preference on `OrderSender`, (B) `around` plugin,
  (C) Observer on `sales_order_place_after` + suppress core email.
- **Decision.** (B) `around` plugin. Rationale: upgrade-safe (core
  changes to `OrderSender` don't break us), sortOrder=10 so any other
  plugin runs first, no need for suppression.
- **Consequences.** + upgrade tax minimized, + observer coordination
  unneeded, – small overhead per invocation, – must revisit if Adobe
  changes the `send()` signature.

**ADR-052 — RabbitMQ topic for post-order provisioning to ERP.**
- **Context.** SAP provisioning is currently a sync call in
  `OrderPlaceAfter` observer; sync latency adds 800ms to checkout p95;
  SAP downtime blocks checkout.
- **Options.** (A) Keep sync (status quo), (B) RabbitMQ topic + consumer,
  (C) Message-queue bulk API.
- **Decision.** (B). Observer publishes to
  `acme.order.placed` topic; SAP-consumer subscribes, retries with
  exponential backoff, DLQs after 5 attempts. Rationale: decouples
  checkout from SAP; horizontal scale on consumer; DLQ gives ops
  visibility.
- **Consequences.** + checkout latency – 800ms, + SAP downtime doesn't
  block checkout, – must add consumer to Cloud instance
  `.magento.app.yaml`, – DLQ monitoring needed, – eventual consistency
  on ERP provisioning.

**ADR-053 — Adopt Adobe Commerce Live Search over bundled OpenSearch for facets.**
- **Context.** Bundled OpenSearch relevance tuning is manual; category
  auto-complete latency > 800ms p95 with 200k SKUs.
- **Options.** (A) Keep OpenSearch, (B) Live Search (SaaS), (C) Third-party
  (Algolia / Klevu).
- **Decision.** (B) Live Search. Rationale: native storefront widget,
  Adobe-managed relevance ML, no additional vendor.
- **Consequences.** + p95 < 200ms via CDN-cached widget, + Adobe ML
  tuning, – catalog sync latency (data-services indexer), – limited
  custom relevance overrides today.

## Anti-patterns to avoid for Commerce PaaS

- **Choosing Preference over Plugin without an upgrade-cost check** —
  preferences pin you to a class signature; every Adobe release becomes a
  merge job.
- **Custom module in `app/code` when the marketplace has a supported
  extension** — you own the maintenance; check `commercemarketplace.adobe.com`
  first.
- **Bypassing FPC for edge-case dynamic content** — hole-punch via
  private blocks instead; disabling FPC on a whole route destroys perf.
- **Synchronous ERP calls in critical-path observers** — always MQ;
  observer downtime shouldn't block checkout.
- **UpgradeSchema after Magento 2.3** — deprecated in favor of
  declarative schema; using it in a new module dates the code on day one.
- **Ignoring multi-store scope in config reads** — always resolve via
  `ScopeConfigInterface`; hard-coding a global config read breaks
  multi-store pilots.

---

Generate the full ADR using `templates/ADR.md` as the master, populating
placeholders with stack-appropriate content from the guide above.
