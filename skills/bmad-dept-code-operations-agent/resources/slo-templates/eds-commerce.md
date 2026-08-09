# SLO authoring guide — EDS + Commerce hybrid

## Purpose framing

SLOs for EDS + Commerce hybrid establish **hybrid reliability targets**
that combine EDS delivery performance (CWV, edge availability) with the
Commerce SaaS drop-in surfaces (cart-total, drop-in TTI, Catalog
Service) rendered inside EDS pages. The user-perceived journey crosses
two platforms — a slow Catalog Service query breaks LCP just as surely
as a slow EDS block does. They anchor the freeze policy across two
release trains (helix-code + drop-in version pin), and they define
burn-rate thresholds that page `@storefront-oncall` (spanning both
teams).

## SLI catalog for EDS+Commerce — what to measure

Each SLI is measured over a rolling 28-day window; `good_events / valid_events` formula.

- **LCP p75** — 75th-percentile Largest Contentful Paint across all page views (inherited from EDS).
- **INP p75** — 75th-percentile Interaction to Next Paint on commerce pages (add-to-cart, cart update).
- **Edge availability** — `(edge responses with 2xx or 3xx) / (total requests)` at helix-live.
- **Block-load success** — `(page views where above-fold blocks + drop-ins loaded without error) / (total page views)`.
- **Cart-total latency p95** — 95th-percentile duration for cart-total resolution (Catalog Service + drop-in composition).
- **Checkout success rate** — `(orders successfully placed via drop-in checkout) / (checkout initiations)`.
- **Drop-in TTI p75** — 75th-percentile Time to Interactive for the primary drop-in on PDP + cart pages.
- **Catalog Service availability (vendor dependency)** — `(Catalog Service GraphQL responses with no error) / (total calls)`.

## SLO targets per tier for EDS+Commerce

| SLI | T1 target | T2 target | T3 target |
|-----|-----------|-----------|-----------|
| Edge availability | 99.9% | 99.5% | 99% |
| LCP p75 | ≤ 2.0s | ≤ 2.5s | ≤ 4s |
| INP p75 (commerce pages) | ≤ 200ms | ≤ 200ms | ≤ 500ms |
| Block-load success | 99.5% | 99% | 98% |
| Cart-total p95 | ≤ 1.5s | ≤ 3s | ≤ 5s |
| Drop-in TTI p75 | ≤ 2s | ≤ 3s | ≤ 5s |
| Checkout success | 99.9% | 99.5% | 99% |
| Catalog Service availability (vendor) | 99.9% | 99.5% | 99% |

Storefront commerce pages typically T1 (revenue). Non-commerce EDS pages (blog, corporate content) inherit EDS-only tiering.

## Error-budget policy for EDS+Commerce

- **Budget window** — 28-day rolling. Vendor-dependency SLIs on 90-day rolling window aligned with Adobe SLA reporting.
- **Burn-rate thresholds** — fast burn (2%/1h → P1 page), slow burn (5%/6h → P2 ticket), catastrophic (10%/15min → P1 + auto-freeze).
- **Freeze policy** — when checkout budget < 25%, both helix-code and drop-in version pin changes affecting checkout frozen. Content-only edits unaffected. Non-commerce EDS pages unaffected by commerce-side freeze.
- **Rollback triggers** — cross-reference `release-plans/eds-commerce.md#rollback-triggers`. Fast-burn on checkout or cart-total within 1h of either release train (helix-code SHA or drop-in version pin) triggers rollback of the just-shipped side.
- **Escape hatches** — helix-admin platform maintenance excluded. Adobe SaaS maintenance excluded from vendor SLI. Third-party embed outages (chat, analytics) attributed to dependency SLI.
- **Governance** — SRE + storefront-eng lead + web-perf lead + product-owner sign-off; recorded in `.bmad/decisions.yaml`.

## Multi-window burn-rate alerts for EDS+Commerce

| SLO | Fast-burn (1h/2%) | Slow-burn (6h/5%) | Total-burn (24h/10%) |
|-----|-------------------|-------------------|---------------------|
| Edge availability | P1 page `@eds-oncall` | P2 ticket | P2 ticket |
| LCP p75 | P2 page | P2 ticket | P3 warn |
| Cart-total p95 | P2 page `@storefront-oncall` | P2 ticket | P3 warn |
| Checkout success | P1 page + payment-eng | P2 ticket | P2 ticket |
| Drop-in TTI | P2 page | P2 ticket | P3 warn |
| Catalog Service (vendor) | P2 page + Adobe case | P2 ticket + Adobe case | P3 ticket |

See `resources/alert-rules/eds-commerce.md` for underlying queries.

## SLI measurement per platform for EDS+Commerce

- **helix-rum (LCP, INP, drop-in TTI)** — RUM `experience.checkpoint` events; segment by `page.type:PDP` / `page.type:cart` / `page.type:checkout`.
- **Datadog RUM** — `SELECT percentile(75, largest_contentful_paint) FROM PageView WHERE page.type IN ('PDP','cart','checkout')`.
- **Datadog (edge + cart-total)** — cart-total: `p95:eds.commerce.cart_total.duration{page_type:cart}`; checkout: `sum:eds.commerce.checkout.success.as_count() / sum:eds.commerce.checkout.attempts.as_count()`. <!-- verify metric names -->
- **Adobe SaaS status dashboard** — vendor SLI (Catalog Service, Payment Services); scrape or webhook into observability platform.
- **Google CrUX** — authoritative for CWV (28-day p75) on commerce URLs.

## Stakeholder + review cadence for EDS+Commerce

- **Owner** — storefront-eng team (drop-in integration + commerce blocks); web-perf team (CWV, edge); content-ops (non-commerce pages).
- **Reviewer** — SRE / DevOps team; helix-admin escalation; Adobe TAM for vendor SLI.
- **Consumer** — product-owner (revenue + SEO), engineering-manager, VP digital.
- **Review cadence** — weekly SLO status (joint web-perf + storefront-eng); monthly Adobe vendor-SLA review; quarterly SLO review; annual policy review.

## 2 worked SLO examples for EDS+Commerce

### Example 1: `pdp-buyflow` (T1 — revenue-critical)

- Tier: T1
- SLIs: LCP p75 (≤ 2s), drop-in TTI p75 (≤ 2s), cart-total p95 (≤ 1.5s), checkout success (99.9%).
- SLOs: LCP ≤ 2s; TTI ≤ 2s; cart ≤ 1.5s; checkout ≥ 99.9%.
- Budget policy: fast-burn on checkout → page `@storefront-oncall` + `@payment-eng` + halt both release trains.
- Current-state (baseline): LCP 1.9s p75, TTI 1.7s p75, cart p95 1.3s, checkout 99.93%, budget 40% remaining.

### Example 2: `campaign-plp` (T2 — traffic acquisition)

- Tier: T2
- SLIs: LCP p75 (≤ 2.5s), block-load success (99%), Catalog Service availability (99.5%).
- SLOs: LCP ≤ 2.5s; block-load ≥ 99%; Catalog Service ≥ 99.5%.
- Budget policy: slow-burn → ticket web-perf + storefront-eng; freeze block-code changes when budget < 25%.
- Current-state: LCP 2.4s p75, block-load 99.3%, Catalog Service 99.6%.

## Anti-patterns to avoid for EDS+Commerce

- **One LCP SLI across commerce and non-commerce pages.** Commerce pages carry drop-in JS + Catalog Service calls; blend hides which side is slow. Segment by `page.type`.
- **Attributing Catalog Service outages to your edge SLO.** Vendor-dependency SLIs must be separate — otherwise your reported availability includes something you can't control.
- **Ignoring drop-in TTI as a separate SLI from LCP.** LCP measures paint; TTI measures interactivity — drop-in JS can render fast but stay unresponsive. Report both.
- **Coupling checkout SLO to Catalog Service SLO.** They're independent surfaces — a Catalog Service brownout on PDP shouldn't fail the checkout SLO.
- **Static freeze policy across both release trains.** helix-code and drop-in version pin ship independently; the freeze must scope to the release train that owns the regression.

---

Generate the full SLO document using `templates/slo.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `alert-rules/eds-commerce.md` for burn-rate alert wiring.
