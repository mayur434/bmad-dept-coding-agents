# SLO — {{SERVICE}}

| Field | Value |
|---|---|
| Service | **{{SERVICE}}** |
| Stack | {{STACK}} |
| Tier | **{{SERVICE_TIER}}** ({{TIER_DESCRIPTION}}) |
| Owner team | {{OWNER_TEAM}} |
| Product owner | {{PRODUCT_OWNER}} |
| SRE partner | {{SRE_PARTNER}} |
| Last reviewed | {{LAST_REVIEWED}} |
| Next review | {{NEXT_REVIEW}} |
| Status | `{{STATUS}}` (draft / reviewed / approved / active) |

---

## Service overview

{{SERVICE_OVERVIEW}}

<!-- 2-4 sentences: what the service does, who its consumers are, the
     critical user journeys it powers. This anchors SLI selection —
     SLIs must reflect user experience, not internal instrumentation. -->

**Critical user journeys:**

- {{JOURNEY_1}}
- {{JOURNEY_2}}
- {{JOURNEY_3}}

---

## Tier defaults (from `--service-tier {{SERVICE_TIER}}`)

| Metric | Target |
|---|---|
| Availability | **{{TIER_AVAILABILITY}}** (error budget: {{TIER_ERROR_BUDGET_MINUTES}} min / 30 days) |
| Latency p95 | ≤ **{{TIER_LATENCY_P95_MS}}ms** |
| RPO | ≤ {{TIER_RPO}} |
| RTO | ≤ {{TIER_RTO}} |

---

## SLIs

Each SLI is measured on a **rolling 28-day window** unless noted.

### SLI-1: Availability

- **Definition:** the fraction of successful requests to `{{AVAILABILITY_ENDPOINT}}` (HTTP 2xx or 3xx) over all requests.
- **Query:** `{{AVAILABILITY_QUERY}}`
- **Measurement window:** rolling 28 days
- **Data source:** {{AVAILABILITY_SOURCE}}
- **Exclusions:** planned maintenance windows tagged `maintenance:true`; synthetic health-check traffic.

### SLI-2: Latency

- **Definition:** the 95th percentile of end-to-end request duration for `{{LATENCY_ENDPOINT}}`.
- **Query:** `{{LATENCY_QUERY}}`
- **Measurement window:** rolling 28 days
- **Data source:** {{LATENCY_SOURCE}}

### SLI-3: {{SLI_3_NAME}} <!-- e.g. freshness, correctness, throughput -->

- **Definition:** {{SLI_3_DEFINITION}}
- **Query:** `{{SLI_3_QUERY}}`
- **Measurement window:** rolling 28 days
- **Data source:** {{SLI_3_SOURCE}}

---

## SLOs

| SLO ID | SLI | Target | Window | Rationale |
|---|---|---|---|---|
| `SLO-A-{{SERVICE}}-avail` | Availability | **{{SLO_AVAILABILITY}}** | 28 days | Tier-{{SERVICE_TIER}} default; {{SLO_AVAILABILITY_RATIONALE}} |
| `SLO-B-{{SERVICE}}-lat` | Latency p95 | **≤ {{SLO_LATENCY_P95_MS}}ms** | 28 days | {{SLO_LATENCY_RATIONALE}} |
| `SLO-C-{{SERVICE}}-{{SLI_3_KEY}}` | {{SLI_3_NAME}} | **{{SLO_3_TARGET}}** | 28 days | {{SLO_3_RATIONALE}} |

---

## Error-budget policy

The error budget is the **maximum allowable failure** within the SLO
window: `(1 - SLO) × window`. Spending the budget is expected and
healthy — a service that never spends its budget is over-invested in
reliability at the expense of velocity.

**Budget calculation for SLI-1 (Availability):**

- Window: 30 days × 24h × 60min = 43,200 min
- SLO: {{SLO_AVAILABILITY}}
- Budget: **{{ERROR_BUDGET_MINUTES}} min / 30 days**

### Burn-rate alerts

Multi-window multi-burn-rate strategy — alerts when the current burn rate
would exhaust the budget in less than the target window.

| Alert | Threshold | Window(s) | Severity | Action |
|---|---|---|---|---|
| **Fast burn** | Burning at ≥ 14.4× baseline | 5m + 1h | `sev1` — page on-call | Runbook: {{RUNBOOK_URL}}#slo-burn — immediate mitigation. |
| **Slow burn** | Burning at ≥ 6× baseline | 30m + 6h | `sev3` — ticket | Investigate within business hours; consider throttling change velocity. |
| **Long burn** | Burning at ≥ 3× baseline | 6h + 3d | `sev4` — warning | Awareness; no on-call action. |

### Freeze policy

When the **remaining error budget < 25%** for a rolling 28-day window:

- **Feature launches paused** for {{SERVICE}} until budget recovers or
  the SLO is intentionally reset by the SLO council.
- **Only reliability-improving changes** may deploy (bug fixes,
  observability improvements, capacity increases).
- **Retro required** on how the budget was spent (link the postmortems).

### Remediation

Budget exhausted → the SLO council must:

1. Decide whether the SLO is still meaningful (does user experience
   actually degrade at this level?).
2. Either invest in reliability (freeze features, do the work) or
   consciously adjust the SLO with sign-off from the product owner.

---

## Stakeholders

| Role | Name | Responsibility |
|---|---|---|
| Product owner | {{PRODUCT_OWNER}} | Signs off on SLO targets; owns error-budget spend decisions. |
| SRE partner | {{SRE_PARTNER}} | Owns SLI instrumentation, burn-rate alerts, error-budget tracking. |
| Tech lead | {{TECH_LEAD}} | Owns implementation changes that affect SLIs. |
| On-call | {{ONCALL_ROTATION}} | Responds to fast-burn alerts. |

---

## Review cadence

- **Monthly** — SLO council reviews error-budget spend + burn trends.
- **Quarterly** — full SLO doc review; target adjustments require sign-off.
- **Post-incident** — for any SEV1/SEV2, review whether the SLO reflects
  the observed user impact.

---

## Sign-off

- [ ] {{PRODUCT_OWNER}} — Product owner
- [ ] {{SRE_PARTNER}} — SRE partner
- [ ] {{TECH_LEAD}} — Tech lead
- [ ] {{ENGINEERING_MANAGER}} — Engineering manager

---

_Generated by BMAD DCA Operations agent — {{GENERATED_AT}}_
