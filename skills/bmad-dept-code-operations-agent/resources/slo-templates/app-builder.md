# SLO authoring guide — Adobe App Builder

## Purpose framing

SLOs for App Builder establish **serverless-native reliability targets**
for I/O Runtime actions, I/O Events subscriptions, and API Mesh
resolvers — the surfaces third-party consumers hit through Adobe's
gateway. Cold-start behavior and namespace-quota headroom are
first-class SLIs, unlike long-running JVM services. They anchor the
error-budget policy the release engineer consults before promoting a
`aio app deploy` build, and the burn-rate thresholds page
`@app-builder-oncall`.

## SLI catalog for App Builder — what to measure

Each SLI is measured over a rolling 28-day window; `good_events / valid_events` formula.

- **Runtime action availability** — `(action invocations with `success:true`) / (total action invocations)` per action. Excludes user-caused 4xx (auth, bad input).
- **Runtime action p95 latency** — 95th-percentile end-to-end duration (activation time), per action. Includes cold-start latency by default; separate warm-only SLI recorded for trend.
- **Runtime action cold-start rate** — `(cold-start activations) / (total activations)` per action; leading indicator for latency SLO breach.
- **I/O Event delivery latency** — `(events delivered to registered webhook within 30s of emit) / (total events)` per event provider.
- **State SDK success rate** — `(State SDK put/get calls succeeding) / (total calls)`.
- **API Mesh resolver availability** — `(resolver responses without error) / (total resolver calls)` per resolver.
- **Namespace quota headroom** — `(minutes with `activations/minute < 80% of quota`) / (total minutes)`.

## SLO targets per tier for App Builder

| SLI | T1 target | T2 target | T3 target |
|-----|-----------|-----------|-----------|
| Runtime action availability | 99.9% | 99.5% | 99% |
| Runtime action p95 (incl. cold-start) | ≤ 500ms | ≤ 1s | ≤ 3s |
| Runtime action p95 (warm-only) | ≤ 200ms | ≤ 500ms | ≤ 1s |
| I/O Event delivery (30s) | 99% | 95% | 90% |
| State SDK success | 99.9% | 99.5% | 99% |
| API Mesh resolver availability | 99.9% | 99.5% | 99% |
| Namespace quota headroom | 99% | 95% | 90% |

Cold-start-inclusive p95 targets are looser than warm — chose the SLI that matches your invocation pattern (bursty → cold-start-inclusive; steady → warm-only). <!-- verify: current App Builder cold-start baselines -->

## Error-budget policy for App Builder

- **Budget window** — 28-day rolling. Actions with < 10,000 invocations / 28d use 90-day window.
- **Burn-rate thresholds** — fast burn (2%/1h → P1 page), slow burn (5%/6h → P2 ticket), catastrophic (10%/15min → P1 + auto-freeze).
- **Freeze policy** — when a T1 action's budget < 25%, `aio app deploy` for that action frozen; other actions in the namespace may deploy independently. Namespace-level freeze only if quota-headroom SLI is below 90%.
- **Rollback triggers** — cross-reference `release-plans/app-builder.md#rollback-triggers`. Fast-burn within 10 min of deploy triggers `aio app deploy --publish=false` rollback + I/O Runtime action version pin revert.
- **Escape hatches** — cold-start spikes after `aio app deploy` (first 10 min) excluded from p95 SLI. Adobe-declared I/O Runtime maintenance windows excluded from availability. Quota-headroom SLI resets after quota increase approved.
- **Governance** — SRE + integration-eng + product-owner sign-off on target changes; recorded in `.bmad/decisions.yaml`.

## Multi-window burn-rate alerts for App Builder

| SLO | Fast-burn (1h/2%) | Slow-burn (6h/5%) | Total-burn (24h/10%) |
|-----|-------------------|-------------------|---------------------|
| Action availability | P1 page `@app-builder-oncall` | P2 ticket | P2 ticket |
| Action p95 latency | P2 page | P2 ticket | P3 warn |
| I/O Event delivery | P2 ticket + Adobe case | P3 warn | P3 warn |
| State SDK success | P2 page | P3 ticket | Info |
| Namespace quota headroom | P2 page (quota-exhaustion risk) | P3 ticket | Info |

See `resources/alert-rules/app-builder.md` for underlying CloudWatch / Datadog queries.

## SLI measurement per platform for App Builder

- **CloudWatch (default — I/O Runtime logs land here)** — availability: `activations with success=true / total activations`, via metric filter on I/O Runtime activation logs. Cold-start rate: filter `initTime > 0`.
- **Datadog (via CloudWatch integration or Adobe I/O forwarder)** — availability: `sum:io.runtime.activations{result:success, action:$name}.as_count() / sum:io.runtime.activations{action:$name}.as_count()`; p95: `p95:io.runtime.activation.duration{action:$name}`. <!-- verify metric names -->
- **Adobe I/O Console** — authoritative for namespace quota headroom + I/O Event delivery lag; scrape or webhook into observability platform.
- **New Relic** — supported via `aio-lib-newrelic` wrapper on action handlers.

## Stakeholder + review cadence for App Builder

- **Owner** — integration-eng team (per action namespace — e.g. `commerce-integrations`, `crm-sync`).
- **Reviewer** — SRE / DevOps team; Adobe I/O TAM for platform issues.
- **Consumer** — product-owner (downstream partner impact), engineering-manager.
- **Review cadence** — weekly SLO status per namespace; monthly quota-headroom review; quarterly SLO review; annual policy review.

## 2 worked SLO examples for App Builder

### Example 1: `commerce-order-sync` (T1 — critical integration)

- Tier: T1
- SLIs: Action availability (99.9%), p95 warm-only (≤ 200ms), I/O Event delivery (99%).
- SLOs: 99.9% / 43m budget / 28d; warm p95 ≤ 200ms; event delivery ≥ 99%.
- Budget policy: fast-burn → page `@integration-oncall` + halt action deploys.
- Current-state (baseline): 99.94% last 28d, budget 55% remaining, warm p95 145ms, event delivery 99.4%.

### Example 2: `crm-webhook-processor` (T2 — near-real-time)

- Tier: T2
- SLIs: Action availability (99.5%), p95 cold-start-inclusive (≤ 1s), State SDK success (99.5%).
- SLOs: 99.5% / 3.6h budget / 28d; p95 ≤ 1s; State SDK ≥ 99.5%.
- Budget policy: slow-burn → ticket integration-eng; freeze changes to action when budget < 25%.
- Current-state: 99.6% availability, p95 850ms, State SDK 99.7%.

## Anti-patterns to avoid for App Builder

- **One p95 SLI mixing cold and warm.** Cold-start latency is 3-10× warm; the mix hides which population is regressing. Record both; SLO on whichever matches invocation pattern.
- **Ignoring namespace quota headroom.** Quota exhaustion is a hard failure (429 all invocations); measure headroom as an SLI, not just an alert.
- **Availability SLO that includes user 4xx.** Bad requests aren't your fault; exclude 400/401/403 from valid_events.
- **No I/O Event delivery SLI when your action is a webhook.** If Adobe drops the event, your action never fires — the SLO must include the delivery step.
- **Static SLO through action-version pinning.** New versions cold-start; announce a 10-min warm-up window in the release plan and exclude it from the SLI.

---

Generate the full SLO document using `templates/slo.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `alert-rules/app-builder.md` for burn-rate alert wiring.
