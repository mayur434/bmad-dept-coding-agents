# SLO authoring guide — Apache Sling / Shaft (sling-12)

## Purpose framing

SLOs for Sling / Shaft establish **service-level reliability targets
per critical OSGi service** — MDM APIs, SAM APIs, JCR-backed CRUD
endpoints — where "the service" is a bundle exposing a stable contract.
They anchor the error-budget policy the platform team consults before
promoting a Feature Model change, and they define the burn-rate
thresholds that page `@sling-oncall`. Bundle-state health (ACTIVE vs
INSTALLED) is a leading indicator, not the customer-facing SLI.

## SLI catalog for Sling — what to measure

Each SLI is measured over a rolling 28-day window; `good_events / valid_events` formula.

- **OSGi service availability per critical service** — `(service invocations succeeding) / (total invocations)` per registered OSGi service. Measured via bundle metric-forwarding (Sling Metrics).
- **MDM CRUD latency p95** — 95th-percentile duration for `POST /mdm/entities/*`, `PUT /mdm/entities/*/{id}`, `DELETE /mdm/entities/*/{id}`.
- **SAM API availability** — `(SAM API responses with 2xx or 3xx) / (total requests)`.
- **JCR write success rate** — `(successful JCR node writes) / (total write attempts)`. Excludes user-authorization failures.
- **Sling job dispatch success** — `(jobs completing without error) / (total jobs dispatched)` per topic.
- **Bundle steady-state** — `(bundles in ACTIVE state) / (total installed bundles)` sampled every 5 minutes; SLO is that this ratio remains at 1.0 outside deploy windows.
- **Feature Model install success** — `(feature-model deploys resulting in all bundles ACTIVE within 5 min) / (total deploys)`.

## SLO targets per tier for Sling

| SLI | T1 target | T2 target | T3 target |
|-----|-----------|-----------|-----------|
| OSGi service availability | 99.9% | 99.5% | 99% |
| MDM CRUD p95 | ≤ 100ms | ≤ 300ms | ≤ 1s |
| SAM API availability | 99.9% | 99.5% | 99% |
| JCR write success | 99.99% | 99.9% | 99% |
| Sling job dispatch success | 99.5% | 99% | 98% |
| Bundle steady-state (outside deploy) | 100% | 100% | 99% |
| Feature Model install success | 99% | 95% | 90% |

MDM and SAM are typically T1 (downstream consumers depend on them); JCR write must be near-perfect (data integrity, not latency). Job dispatch tolerates retries.

## Error-budget policy for Sling

- **Budget window** — 28-day rolling; anything else requires platform-team exception.
- **Burn-rate thresholds** — fast burn (2%/1h → P1 page), slow burn (5%/6h → P2 ticket), catastrophic (10%/15min → P1 + auto-freeze).
- **Freeze policy** — when a T1 service budget < 25%, Feature Model changes affecting that service frozen. Reliability-only bundle patches allowed. Platform-wide freeze only if 2+ T1 services below budget simultaneously.
- **Rollback triggers** — cross-reference `release-plans/sling.md#rollback-triggers`. Fast-burn within 10 min of Feature Model install triggers rollback to prior feature-model version.
- **Escape hatches** — planned bundle reload windows tagged `maintenance:true` excluded. JVM restart windows (10 min) excluded from availability. RCAs > 24h old drop from budget with SRE sign-off.
- **Governance** — SRE + platform tech-lead + service-owning-team sign-off on target changes; recorded in `.bmad/decisions.yaml`.

## Multi-window burn-rate alerts for Sling

| SLO | Fast-burn (1h/2%) | Slow-burn (6h/5%) | Total-burn (24h/10%) |
|-----|-------------------|-------------------|---------------------|
| OSGi service availability | P1 page `@sling-oncall` | P2 ticket | P2 ticket |
| MDM CRUD p95 | P2 page | P2 ticket | P3 warn |
| SAM API availability | P1 page | P2 ticket | P2 ticket |
| JCR write success | P1 page (data integrity) | P1 page | P2 ticket |
| Bundle steady-state | P2 page (post-deploy) | P3 ticket | Info |

See `resources/alert-rules/sling.md` for underlying Prometheus / Datadog queries.

## SLI measurement per platform for Sling

- **Prometheus (K8s-native default)** — availability: `sum(rate(sling_service_invocations_total{result="success", service="mdm"}[28d])) / sum(rate(sling_service_invocations_total{service="mdm"}[28d]))`; latency: `histogram_quantile(0.95, sum(rate(sling_service_duration_bucket[5m])) by (le))`.
- **Datadog** — availability: `sum:sling.service.invocations{result:success, service:mdm}.as_count() / sum:sling.service.invocations{service:mdm}.as_count()`; bundle state: `avg:sling.bundle.state{state:ACTIVE} / avg:sling.bundle.count{*}`. <!-- verify metric names -->
- **JMX bridge** — for shops using jmx_exporter → Prometheus, service metrics come off `org.apache.sling.metrics:*` MBeans.
- **Sling status console** — `/system/console/status` for runtime bundle state; scrape into observability platform every minute.

## Stakeholder + review cadence for Sling

- **Owner** — service-owning team (MDM: mdm-eng; SAM: sam-eng; platform bundles: sling-platform-eng).
- **Reviewer** — SRE / DevOps team; Sling platform tech-lead.
- **Consumer** — product-owner (downstream API consumers), engineering-manager.
- **Review cadence** — weekly SLO status per critical service; quarterly SLO review with all service teams; annual policy review.

## 2 worked SLO examples for Sling

### Example 1: `mdm-api` (T1 — reference data)

- Tier: T1
- SLIs: OSGi service availability (99.9%), MDM CRUD p95 (≤ 100ms), JCR write success (99.99%).
- SLOs: 99.9% availability / 28d; p95 ≤ 100ms; JCR writes ≥ 99.99%.
- Budget policy: fast-burn → page `@mdm-oncall` + halt feature-model promotion for MDM-affecting bundles.
- Current-state (baseline): 99.93% availability last 28d, budget 40% remaining, p95 85ms, 0 write failures.

### Example 2: `sam-api` (T2 — internal service)

- Tier: T2
- SLIs: SAM API availability (99.5%), SAM API p95 (≤ 300ms), Sling job dispatch success for sam topic (99%).
- SLOs: 99.5% availability / 28d; p95 ≤ 300ms; job success ≥ 99%.
- Budget policy: slow-burn → ticket sam-eng; freeze SAM changes when budget < 25%.
- Current-state: 99.6% availability, p95 220ms, job success 99.2%.

## Anti-patterns to avoid for Sling

- **Setting bundle-state (ACTIVE %) as a customer SLI.** Bundle state is a leading indicator; a bundle can be ACTIVE and still return 5xx. Measure the service invocation directly.
- **Sharing one availability SLO across MDM + SAM + platform.** Different teams, different consumers, different failure modes. One SLO per service.
- **SLO based on `/system/console/bundles` scrape alone.** That endpoint reports state, not request success — it will miss a service that's up but broken.
- **No feature-model-install SLI.** Bundle installs succeed silently sometimes but leave services in wire-wait; measure the "all-ACTIVE within 5 min" event explicitly.
- **Static thresholds through Sling job queue backlogs.** Job topics vary 10× during backfills — either exclude declared backfill windows or use per-topic thresholds.

---

Generate the full SLO document using `templates/slo.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `alert-rules/sling.md` for burn-rate alert wiring.
