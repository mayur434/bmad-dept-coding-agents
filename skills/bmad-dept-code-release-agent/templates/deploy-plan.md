# Deploy Plan — v{{VERSION}}

| Field | Value |
|---|---|
| Release version | {{VERSION}} |
| Stack | {{STACK}} |
| Source env | {{SOURCE_ENV}} |
| Target env | {{TARGET_ENV}} |
| From ref | `{{FROM_REF}}` |
| To ref | `{{TO_REF}}` |
| Rollout strategy | **{{ROLLOUT}}** |
| Planned start | {{PLANNED_START}} |
| Estimated duration | {{ESTIMATED_DURATION}} |
| Release manager | {{RELEASE_MANAGER}} |
| On-call | {{ON_CALL}} |

---

## Release scope

{{RELEASE_SCOPE_SUMMARY}}

<!-- 3-5 bullets: services touched, headline features, headline fixes,
     any breaking change, any migration. Link to RELEASE_NOTES.md. -->

---

## Stakeholders — RACI

| Role | Name | Responsibility |
|---|---|---|
| Release manager | {{RELEASE_MANAGER}} | Owns the release; makes go/no-go call at each gate. |
| Tech lead | {{TECH_LEAD}} | Owns the code change set; on the bridge during rollout. |
| DevOps / SRE | {{DEVOPS_LEAD}} | Executes the pipeline; monitors deploy signals; runs rollback if triggered. |
| QA | {{QA_LEAD}} | Owns smoke tests + UAT sign-off at each phase gate. |
| Security | {{SECURITY_LEAD}} | Signs off on secrets-rotation + vulnerability-fix inclusion. |
| Product | {{PRODUCT_LEAD}} | Signs off on feature-flag flips + stakeholder comms. |
| On-call | {{ON_CALL}} | Primary responder to deploy-window alerts. |

---

## Pre-deploy checklist

<!-- Every box must be checked before the pipeline starts. -->

- [ ] All required approvals granted (release manager + tech lead + security)
- [ ] DCA quality gates PASS (audit, sonar-scan, test-coverage — see release-reports/)
- [ ] Security review complete; no unresolved HIGH-severity vulns
- [ ] Dependency-lock audit clean (no vulnerable transitive deps)
- [ ] DB migrations reviewed and dry-run against a stage snapshot (schema PR merged; data PR queued)
- [ ] Config diff (`ENV_DIFF.md`) reviewed; secrets rotation pending items resolved or explicitly deferred
- [ ] Feature flags configured in target env; default state confirmed
- [ ] Rollback plan (`ROLLBACK_PLAN.md`) reviewed; drill run within last 30 days
- [ ] On-call notified; deploy window announced in {{COMMS_CHANNEL}}
- [ ] Change ticket created / linked ({{CHANGE_TICKET}})
- [ ] Downstream teams notified of any breaking change window
- [ ] Backup / snapshot taken of stateful services

---

## Deploy strategy: **{{ROLLOUT}}**

{{ROLLOUT_STRATEGY_DESCRIPTION}}

<!-- One paragraph explaining the chosen strategy, why it fits this
     release (based on --rollout flag), and how it interacts with the
     stack's deploy idioms. -->

---

## Phased steps

### Phase 1 — {{PHASE_1_NAME}}

- **Changes:** {{PHASE_1_CHANGES}}
- **Executor:** {{PHASE_1_EXECUTOR}}
- **Verification:** {{PHASE_1_VERIFICATION}}
- **Go/no-go gate:** {{PHASE_1_GATE}} <!-- e.g. "smoke tests PASS + error-rate stable for 10min" -->
- **Estimated duration:** {{PHASE_1_DURATION}}

### Phase 2 — {{PHASE_2_NAME}}

- **Changes:** {{PHASE_2_CHANGES}}
- **Executor:** {{PHASE_2_EXECUTOR}}
- **Verification:** {{PHASE_2_VERIFICATION}}
- **Go/no-go gate:** {{PHASE_2_GATE}}
- **Estimated duration:** {{PHASE_2_DURATION}}

### Phase 3 — {{PHASE_3_NAME}}

- **Changes:** {{PHASE_3_CHANGES}}
- **Executor:** {{PHASE_3_EXECUTOR}}
- **Verification:** {{PHASE_3_VERIFICATION}}
- **Go/no-go gate:** {{PHASE_3_GATE}}
- **Estimated duration:** {{PHASE_3_DURATION}}

### Phase 4 — {{PHASE_4_NAME}}

- **Changes:** {{PHASE_4_CHANGES}}
- **Executor:** {{PHASE_4_EXECUTOR}}
- **Verification:** {{PHASE_4_VERIFICATION}}
- **Go/no-go gate:** {{PHASE_4_GATE}}
- **Estimated duration:** {{PHASE_4_DURATION}}

<!-- Add / remove phases per rollout strategy. Canary defaults to 4
     (5% → 25% → 50% → 100%); blue-green to 4 (warm-blue → smoke →
     traffic-cut → drain-green); rolling to 1-2; bigbang to 1. -->

---

## Post-deploy checklist

- [ ] Smoke tests PASS in target env (production)
- [ ] Synthetic checks green (uptime, cart-checkout, sign-in)
- [ ] Monitoring alerts armed (RED / USE / error-rate / p99 latency)
- [ ] Business KPI dashboards checked (adoption, conversion, revenue-per-hour)
- [ ] On-call notified; handoff message posted to {{COMMS_CHANNEL}}
- [ ] Announcement (`ANNOUNCEMENT.md`) distributed per-channel
- [ ] Release ticket updated with actual timeline + link to release notes
- [ ] Feature flags in intended state; flag-flip plan noted for downstream release
- [ ] Post-deploy monitoring window scheduled ({{POST_DEPLOY_WATCH_HOURS}}h)

---

## Communication plan

**Pre-deploy** (T-24h): announce in {{COMMS_CHANNEL}} — release version,
scope, window, contact.

**During deploy** (T-0 to T+duration): status updates in
{{COMMS_CHANNEL}} at each phase gate (start / pass / go-next-phase).

**Post-deploy** (T+monitoring window): all-clear or rollback notification
in {{COMMS_CHANNEL}}; announcement distribution.

**Escalation:** {{ESCALATION_CONTACTS}} — on rollback trigger or gate
failure.

---

## Rollback triggers

<!-- These trigger the ROLLBACK_PLAN.md automatically. Keep the list
     short and metric-based so the on-call can decide in seconds. -->

- Error rate > {{ERROR_RATE_THRESHOLD}} for {{DURATION}}
- p99 latency > {{LATENCY_THRESHOLD}} for {{DURATION}}
- Business KPI (cart conversion / sign-in success) drops > {{KPI_DROP_THRESHOLD}} vs baseline
- Alert flood: > {{ALERT_COUNT}} alerts in {{ALERT_WINDOW}}
- Manual call from release manager or on-call (any reason)

---

## Sign-off

By deploying this release, the below-named have reviewed this plan and
accept accountability for the stated ownership.

- [ ] {{RELEASE_MANAGER}} — Release manager
- [ ] {{TECH_LEAD}} — Tech lead
- [ ] {{DEVOPS_LEAD}} — DevOps / SRE
- [ ] {{QA_LEAD}} — QA
- [ ] {{SECURITY_LEAD}} — Security
- [ ] {{PRODUCT_LEAD}} — Product

---

_Generated by BMAD DCA Release agent — {{GENERATED_AT}}_
