# SLO authoring guide — Edge Delivery Services (EDS)

## Purpose framing

SLOs for EDS establish **user-perceived performance targets** —
Core Web Vitals (LCP, INP, CLS) at the browser, plus edge availability
and content-freshness — because EDS is a delivery-first architecture
where "reliability" means the page loads fast, renders correctly, and
reflects the author's latest edit. RUM is authoritative for
performance SLIs; synthetic monitoring is a leading indicator. They
anchor the freeze policy the web-perf team uses before merging
block changes and page `@eds-oncall` on regression.

## SLI catalog for EDS — what to measure

Each SLI is measured over a rolling 28-day window; `good_events / valid_events` formula.

- **LCP p75** — 75th-percentile Largest Contentful Paint across all page views. Source: RUM (helix-rum, CrUX). Standard CWV threshold.
- **INP p75** — 75th-percentile Interaction to Next Paint. Replaces FID as of CWV 2024. <!-- verify: current CWV threshold definitions -->
- **CLS p75** — 75th-percentile Cumulative Layout Shift.
- **Block-load success rate** — `(page views where all above-fold blocks loaded without error) / (total page views)`. Source: RUM error-block-load event.
- **Edge availability** — `(edge responses with 2xx or 3xx) / (total edge requests)`. Source: helix-live / CDN.
- **Sitemap generation success** — `(sitemap.xml requests returning fresh (< 1h) content) / (total sitemap requests)`.
- **Content-freshness (helix-preview → helix-live)** — `(publish events reflected on helix-live within 60s of author-preview) / (total publish events)`.

## SLO targets per tier for EDS

| SLI | T1 target | T2 target | T3 target |
|-----|-----------|-----------|-----------|
| Edge availability | 99.9% | 99.5% | 99% |
| LCP p75 | ≤ 2.0s | ≤ 2.5s | ≤ 4s |
| INP p75 | ≤ 200ms | ≤ 200ms | ≤ 500ms |
| CLS p75 | ≤ 0.1 | ≤ 0.1 | ≤ 0.25 |
| Block-load success | 99.5% | 99% | 98% |
| Sitemap freshness (< 1h) | 99% | 95% | 90% |
| Content-freshness (60s) | 99% | 95% | 90% |

CWV thresholds (LCP 2.5s, INP 200ms, CLS 0.1) are Google's "good" thresholds — treat as T2 minimum. T1 tightens LCP for revenue-critical pages. <!-- verify: current Google CWV thresholds -->

## Error-budget policy for EDS

- **Budget window** — 28-day rolling. CWV SLIs align with Google's 28-day CrUX report window.
- **Burn-rate thresholds** — fast burn (2%/1h → P1 page), slow burn (5%/6h → P2 ticket), catastrophic (10%/15min → P1 + auto-freeze).
- **Freeze policy** — when LCP budget < 25%, block-code changes affecting above-fold blocks frozen; content-only edits unaffected. Sitewide freeze only if edge availability budget < 25%.
- **Rollback triggers** — cross-reference `release-plans/eds.md#rollback-triggers`. Fast-burn on LCP within 1h of block deploy triggers `helix-code` revert to prior main SHA.
- **Escape hatches** — helix-admin declared platform maintenance windows excluded. RUM sample-rate changes require SLO baseline recompute (thin data = wide confidence). Third-party embed outages (chat widget, analytics) attributed to a dependency SLI, not to core availability.
- **Governance** — SRE + web-perf lead + product-owner sign-off on target changes; recorded in `.bmad/decisions.yaml`.

## Multi-window burn-rate alerts for EDS

| SLO | Fast-burn (1h/2%) | Slow-burn (6h/5%) | Total-burn (24h/10%) |
|-----|-------------------|-------------------|---------------------|
| Edge availability | P1 page `@eds-oncall` | P2 ticket | P2 ticket |
| LCP p75 | P2 page | P2 ticket | P3 warn |
| INP p75 | P2 ticket | P3 warn | P3 warn |
| Block-load success | P2 page | P2 ticket | P3 warn |
| Content-freshness | P3 ticket (editorial) | P3 warn | Info |

See `resources/alert-rules/eds.md` for underlying RUM / edge-log queries.

## SLI measurement per platform for EDS

- **helix-rum (native, authoritative for CWV)** — LCP: RUM `experience.checkpoint` event `type:lcp`; INP: `type:inp`; block-load: `type:error` filtered to block scope. Query via `rum.hlx.page` API. <!-- verify: current helix-rum API surface -->
- **Datadog RUM** — `SELECT percentile(75, largest_contentful_paint) FROM PageView WHERE application.id='eds-site' SINCE 28 days ago`.
- **Google CrUX** — 28-day rolling percentiles for LCP / INP / CLS; considered ground truth for CWV. Pull via BigQuery or PageSpeed Insights API.
- **Edge logs (helix-live)** — availability: 2xx+3xx / total per hostname; ship to Datadog / Splunk.
- **Synthetic (Lighthouse CI)** — leading indicator only; not the SLI.

## Stakeholder + review cadence for EDS

- **Owner** — web-perf team (CWV, block-load); content-ops team (content-freshness, sitemap).
- **Reviewer** — SRE / DevOps team; helix-admin escalation for platform issues.
- **Consumer** — product-owner (SEO ranking + conversion), engineering-manager, marketing team.
- **Review cadence** — weekly SLO status; monthly CrUX-vs-RUM reconciliation; quarterly SLO review; annual policy review.

## 2 worked SLO examples for EDS

### Example 1: `main-storefront` (T1 — SEO + revenue)

- Tier: T1
- SLIs: LCP p75 (≤ 2s), INP p75 (≤ 200ms), edge availability (99.9%).
- SLOs: LCP ≤ 2s p75 / 28d; INP ≤ 200ms; availability ≥ 99.9%.
- Budget policy: fast-burn LCP → page `@web-perf` + halt block deploys.
- Current-state (baseline): LCP 1.85s p75, INP 175ms p75, availability 99.94%, budget 55% remaining.

### Example 2: `campaign-landing-pages` (T2 — high-turnover)

- Tier: T2
- SLIs: LCP p75 (≤ 2.5s), block-load success (99%), content-freshness (95%).
- SLOs: LCP ≤ 2.5s; block-load ≥ 99%; content-freshness ≥ 95%.
- Budget policy: slow-burn → ticket content-ops; freeze new block variants when budget < 25%.
- Current-state: LCP 2.3s p75, block-load 99.2%, content-freshness 96%.

## Anti-patterns to avoid for EDS

- **Setting LCP SLO from synthetic tests only.** Synthetic loads from one location with a warm cache; RUM is authoritative for real-user experience.
- **Ignoring the 75th-percentile convention.** Google CWV thresholds are p75, not p95 or p50; align to CrUX conventions or you can't compare to search-ranking data.
- **Single LCP SLO across all pages.** Homepage and PDP have different content shapes; per-template SLOs surface where the regression lives.
- **Coupling edge-availability to third-party script availability.** Analytics or chat widget outages should attribute to a dependency SLI, not to your edge SLO.
- **Not recomputing baseline after sample-rate change.** RUM sample-rate directly affects confidence interval; thin data = wide bands; document the sample rate in the SLO doc.

---

Generate the full SLO document using `templates/slo.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `alert-rules/eds.md` for burn-rate alert wiring.
