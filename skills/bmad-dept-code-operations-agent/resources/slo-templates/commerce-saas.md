# SLO authoring guide — Adobe Commerce SaaS

## Purpose framing

SLOs for Adobe Commerce SaaS establish **customer-visible reliability
targets against Adobe-hosted services** (Catalog Service, Payment
Services, Storefront Events, API Mesh) that the shop does not directly
operate but does directly depend on. Since the underlying platform is
Adobe-managed, tenant SLOs anchor **integration-side reliability**:
drop-in bundle load, edge-side rendering, cart mutations, and the
tenant's own API Mesh resolvers. Vendor availability enters as an
external-dependency SLI, distinct from tenant-controlled paths.

## SLI catalog for Commerce SaaS — what to measure

Each SLI is measured over a rolling 28-day window; `good_events / valid_events` formula.

- **Drop-in bundle load success** — `(drop-in bundle chunks returning 2xx) / (total drop-in requests)` at the edge / CDN.
- **Drop-in TTI (Time to Interactive)** — 75th-percentile TTI for the first drop-in on a canonical PDP path. Source: RUM.
- **Catalog Service availability** — `(Catalog Service GraphQL responses with no error field) / (total Catalog Service queries)`. Vendor-dependency SLI (Adobe SLA <!-- verify: current Adobe SaaS SLA baseline -->).
- **Payment Services availability** — `(Payment Services authorizations succeeding) / (total authorization attempts, excluding card declines)`.
- **Storefront-events delivery rate** — `(events delivered to configured subscriber within 60s) / (total events emitted)`.
- **API Mesh resolver p95** — 95th-percentile duration for the tenant's canonical mesh resolver. Tenant-controlled.
- **IMS token freshness** — `(tenant-side IMS tokens refreshed successfully before expiry) / (total refresh attempts)`.

## SLO targets per tier for Commerce SaaS

| SLI | T1 target | T2 target | T3 target |
|-----|-----------|-----------|-----------|
| Drop-in bundle availability | 99.9% | 99.5% | 99% |
| Drop-in TTI p75 | ≤ 2s | ≤ 3s | ≤ 5s |
| Catalog Service availability (vendor) | 99.9% | 99.5% | 99% |
| Payment Services availability (vendor) | 99.95% | 99.9% | 99.5% |
| Storefront-events delivery (60s) | 99% | 95% | 90% |
| API Mesh resolver p95 | ≤ 500ms | ≤ 1s | ≤ 3s |

Vendor-dependency SLIs cannot exceed Adobe's published SLA — record the SLA baseline and set tenant target at or below it.

## Error-budget policy for Commerce SaaS

- **Budget window** — 28-day rolling. Vendor-dependency SLIs carry a separate 90-day rolling budget aligned with Adobe SLA reporting.
- **Burn-rate thresholds** — fast burn (2%/1h → P1 page tenant on-call), slow burn (5%/6h → P2 ticket), catastrophic (10%/15min → P1 + auto-freeze).
- **Freeze policy** — when tenant-controlled budget < 25%, tenant-side changes (drop-in customizations, mesh resolvers, JS event handlers) frozen. Vendor-side outages **do not** trigger tenant-side freeze but do trigger customer-comms per playbook.
- **Rollback triggers** — cross-reference `release-plans/commerce-saas.md#rollback-triggers`. Fast-burn on drop-in TTI within 15min of drop-in version pin auto-triggers version-pin rollback.
- **Escape hatches** — planned Adobe maintenance windows (published to tenant admin) excluded from vendor SLI budget. Tenant-declared editorial windows excluded from Storefront-events SLI.
- **Governance** — SRE + storefront-eng + product-owner sign-off on tenant SLO changes; vendor-SLA-based targets non-negotiable without Adobe amendment.

## Multi-window burn-rate alerts for Commerce SaaS

| SLO | Fast-burn (1h/2%) | Slow-burn (6h/5%) | Total-burn (24h/10%) |
|-----|-------------------|-------------------|---------------------|
| Drop-in availability | P1 page `@storefront-oncall` | P2 ticket | P2 ticket |
| Drop-in TTI | P2 page | P2 ticket | P3 warn |
| Catalog Service (vendor) | P2 page + Adobe case | P2 ticket + Adobe case | P3 ticket |
| Payment Services (vendor) | P1 page + Adobe P1 case | P2 ticket + Adobe case | P2 ticket |
| Storefront-events delivery | P2 ticket | P3 warn | P3 warn |

See `resources/alert-rules/commerce-saas.md` for underlying queries.

## SLI measurement per platform for Commerce SaaS

- **Datadog** — drop-in availability: `sum:cdn.dropins.requests{code:2xx}.as_count() / sum:cdn.dropins.requests{*}.as_count()`; API Mesh p95: `p95:mesh.resolver.duration{resolver:$name}`. <!-- verify -->
- **Prometheus** — mesh + drop-in exporters typically not first-party; scrape API Mesh admin API for resolver stats.
- **New Relic** — RUM authoritative for drop-in TTI: `SELECT percentile(largestContentfulPaint, 75) FROM PageViewTiming WHERE pageUrl LIKE '%/products/%'`.
- **Adobe SaaS status dashboard** — authoritative for vendor-side availability; scrape or webhook into observability platform for Catalog Service + Payment Services SLI attribution.
- **RUM** — authoritative for user-perceived TTI; backend timing is leading indicator only.

## Stakeholder + review cadence for Commerce SaaS

- **Owner** — storefront-eng team (drop-in + JS integrations); mesh-eng team (API Mesh resolvers); vendor-management for Adobe SLA tracking.
- **Reviewer** — SRE / DevOps team.
- **Consumer** — product-owner, engineering-manager, VP digital, Adobe TAM (Technical Account Manager).
- **Review cadence** — weekly SLO status; monthly Adobe vendor-SLA review with TAM; quarterly SLO review; annual policy review.

## 2 worked SLO examples for Commerce SaaS

### Example 1: `storefront-dropins` (T1 — customer-facing)

- Tier: T1
- SLIs: Drop-in bundle availability (99.9%), drop-in TTI p75 (≤ 2s), Catalog Service availability (99.9%).
- SLOs: 99.9% / 43m budget / 28d; TTI ≤ 2s p75; Catalog Service ≥ Adobe SLA.
- Budget policy: fast-burn → page `@storefront-oncall` + version-pin rollback trigger.
- Current-state (baseline): 99.94% availability last 28d, budget 55% remaining, TTI p75 1.8s.

### Example 2: `payment-integration` (T1 — revenue-critical)

- Tier: T1
- SLIs: Payment Services availability (99.95%), tenant-side mesh resolver `paymentContext` p95 (≤ 500ms), IMS token freshness (99.9%).
- SLOs: Payment ≥ 99.95% / 28d; mesh resolver ≤ 500ms; IMS freshness ≥ 99.9%.
- Budget policy: fast-burn on Payment Services → open Adobe P1 case within 5 min; page tenant payments-eng.
- Current-state: 99.96% Payment availability, mesh p95 380ms, IMS refresh success 100%.

## Anti-patterns to avoid for Commerce SaaS

- **Setting tenant SLOs higher than Adobe's SLA.** You can't exceed what your dependency guarantees; use Adobe's SLA as the ceiling.
- **Attributing vendor outages to tenant availability.** Separate vendor-dependency SLIs let you report tenant reliability honestly and escalate vendor issues cleanly.
- **Measuring TTI only in synthetic tests.** Synthetic loads a warm cache from a fixed location; RUM is authoritative for real users.
- **Skipping the drop-in version-pin SLI.** Drop-in updates change behavior; without a pinned-version SLI you can't attribute regressions.
- **Ignoring Storefront-events lag.** Events power inventory sync, loyalty accrual, CDP — a 5-min lag creates order-truth divergence downstream.

---

Generate the full SLO document using `templates/slo.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `alert-rules/commerce-saas.md` for burn-rate alert wiring.
