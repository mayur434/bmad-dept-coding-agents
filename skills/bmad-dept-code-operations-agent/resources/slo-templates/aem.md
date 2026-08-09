# SLO authoring guide — AEM (AEMaaCS + AMS)

## Purpose framing

SLOs for AEM establish **customer-facing reliability targets at the
Publish + Dispatcher edge** — the surface the browser actually hits —
plus author-time responsiveness for the editorial team. They anchor the
error-budget policy the Cloud Manager release manager consults before
promoting a pipeline, and they define the burn-rate thresholds that page
`@aem-oncall`. Author-tier SLOs are separate: editors are not customers.

## SLI catalog for AEM — what to measure

Each SLI is measured over a rolling 28-day window unless noted; `good_events / valid_events` formula.

- **Dispatcher availability** — `(dispatcher requests returning 2xx or 3xx) / (total dispatcher requests, excluding bot UA)`. Source: dispatcher access-log / CDN. <!-- verify: current dispatcher log format -->
- **Publish latency p95** — 95th-percentile end-to-end request duration at the dispatcher edge for the canonical customer path (home → PDP → cart). Source: RUM + dispatcher timing header.
- **CF publication lag** — `(content fragments published within 60s of author-submit) / (total CF publish events)`. Source: `aem.cf.publish_lag_seconds` metric. <!-- verify -->
- **Author availability** — `(Author `/system/console/healthcheck` returning 200) / (total probes)` during editorial hours (08:00–20:00 local).
- **DAM upload success rate** — `(DAM assets processed to `original + rendition` state within 5 min) / (total DAM upload events)`.
- **GraphQL persisted-query success** — `(persisted-query responses with no error field) / (total persisted-query requests)`. Headless-consumer SLI.
- **Replication freshness** — `(Publish subscribers with queue-depth < 10) / (total subscribers)`, sampled every minute.

## SLO targets per tier for AEM

| SLI | T1 target | T2 target | T3 target |
|-----|-----------|-----------|-----------|
| Dispatcher availability | 99.9% | 99.5% | 99% |
| Publish latency p95 | ≤ 300ms | ≤ 600ms | ≤ 1.5s |
| CF publication lag (within 60s) | 99% | 95% | 90% |
| Author availability (editorial hours) | 99.5% | 99% | 98% |
| DAM upload success (5-min SLA) | 99% | 97% | 95% |
| GraphQL persisted-query success | 99.9% | 99.5% | 99% |

Publish is customer-facing → treat as T1 by default unless the site is internal-only. Author is typically T2 (editorial disruption, no revenue impact). DAM is T2/T3 depending on whether asset delivery is on the critical path.

## Error-budget policy for AEM

- **Budget window** — 28-day rolling; anything else requires SLO council exception.
- **Burn-rate thresholds** — fast burn (2% budget in 1h → P1 page), slow burn (5% in 6h → P2 ticket), catastrophic (10% in 15min → P1 page + auto-freeze).
- **Freeze policy** — when Publish availability budget < 25%, Cloud Manager pipeline promotion to prod is frozen until budget > 25% OR SRE + product-owner sign-off. Reliability-only changes (dispatcher config, hotfix, capacity) still ship.
- **Rollback triggers** — cross-reference `release-plans/aem.md#rollback-triggers`. Fast-burn during a Cloud Manager execution auto-triggers the rollback playbook.
- **Escape hatches** — Cloud Manager quality-gate silences (deploy_start + 15m) exclude from budget. Editorial bulk-publish windows exclude CF-lag SLI. Planned dispatcher-farm maintenance windows tagged `maintenance:true` excluded.
- **Governance** — SRE + AEM tech lead + product-owner sign-off required for any target adjustment; recorded in `.bmad/decisions.yaml`.

## Multi-window burn-rate alerts for AEM

| SLO | Fast-burn (1h/2%) | Slow-burn (6h/5%) | Total-burn (24h/10%) |
|-----|-------------------|-------------------|---------------------|
| Dispatcher availability | P1 page `@aem-oncall` | P2 ticket | P2 ticket |
| Publish latency p95 | P2 page | P2 ticket | P3 warn |
| CF publication lag | P2 ticket | P3 warn | P3 warn |
| Author availability | P3 warn (editorial hours) | P3 warn | Info |
| GraphQL success | P1 page | P2 ticket | P3 warn |

See `resources/alert-rules/aem.md` for the underlying Datadog / Prometheus queries.

## SLI measurement per platform for AEM

- **Datadog** — availability: `sum:aem.dispatcher.requests{code:2xx OR code:3xx}.as_count() / sum:aem.dispatcher.requests{*}.as_count()`; latency: `p95:aem.publish.request.duration{tier:publish}`.
- **Prometheus** — availability: `sum(rate(aem_dispatcher_requests_total{code=~"[23].."}[28d])) / sum(rate(aem_dispatcher_requests_total[28d]))`; latency: `histogram_quantile(0.95, sum(rate(aem_publish_request_duration_bucket[5m])) by (le))`.
- **New Relic** — availability: `SELECT percentage(count(*), WHERE httpResponseCode < 400) FROM Transaction WHERE appName='publish' SINCE 28 days ago`; latency: `SELECT percentile(duration, 95) FROM Transaction WHERE appName='publish'`. Adobe AMS default.
- **RUM (authoritative for user-perceived latency)** — Google CrUX or Adobe RUM for Publish p95 at the browser; treat backend p95 as leading indicator only.

## Stakeholder + review cadence for AEM

- **Owner** — content-eng / AEM platform team (Publish + Dispatcher); editorial-eng team (Author).
- **Reviewer** — SRE / DevOps team; dispatcher-admin for edge SLIs.
- **Consumer** — product-owner, engineering-manager, Cloud Manager release manager.
- **Review cadence** — weekly SLO status in the AEM stand-up; quarterly SLO target review at the SLO council; annual policy review.

## 2 worked SLO examples for AEM

### Example 1: `publish-tier` (T1 — customer-facing)

- Tier: T1
- SLIs: Dispatcher availability (99.9%), Publish latency p95 (≤ 300ms), GraphQL persisted-query success (99.9%).
- SLOs: 99.9% / 43m budget / 28d; p95 ≤ 300ms / 28d; GraphQL success ≥ 99.9% / 28d.
- Budget policy: fast-burn → page `@aem-oncall` + halt Cloud Manager promotion.
- Current-state (baseline): 99.94% availability last 28d, budget 60% remaining, p95 245ms, 0 P1 incidents.

### Example 2: `author-tier` (T2 — editorial)

- Tier: T2
- SLIs: Author availability during editorial hours (99%), CF publication lag < 60s (95%), DAM upload success in 5 min (97%).
- SLOs: 99% / 4.4h budget / 28d (editorial hours only); CF lag ≤ 60s at p95; DAM success ≥ 97%.
- Budget policy: slow-burn → ticket `@aem-editorial`; no auto-freeze (editorial disruption, not revenue).
- Current-state (baseline): 99.2% availability, CF lag 45s p95, DAM success 96% (below target — action item to investigate rendition worker capacity).

## Anti-patterns to avoid for AEM

- **Setting Author-tier availability higher than Publish.** Customers hit Publish; editors hit Author. Author outages annoy 30 editors; Publish outages lose revenue.
- **Coupling Publish SLO to dispatcher-hit-ratio.** Hit-ratio is a leading indicator, not a user-experience SLI. Measure `2xx / total` at the dispatcher — cache misses that still return 200 are fine.
- **Using synthetic `/system/console/healthcheck` availability as the Publish SLO.** That endpoint is locked in AEMaaCS prod; measure the actual customer path.
- **Static SLO through a re-publish weekend.** CF republish surges spike the lag SLI; exclude declared editorial bulk-publish windows.
- **One SLO for all Publish subscribers.** A single failing subscriber shouldn't fail the SLO; measure `subscribers with queue < 10 / total subscribers`.

---

Generate the full SLO document using `templates/slo.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `alert-rules/aem.md` for burn-rate alert wiring.
