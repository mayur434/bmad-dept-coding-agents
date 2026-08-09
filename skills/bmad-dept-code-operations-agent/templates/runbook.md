# Runbook — {{INCIDENT_SYMPTOM}}

| Field | Value |
|---|---|
| Runbook ID | `RB-{{SLUG}}` |
| Owner | {{OWNER_TEAM}} ({{OWNER_ROLE}}) |
| Stack | {{STACK}} |
| Service | {{SERVICE}} |
| Severity (default) | **{{DEFAULT_SEVERITY}}** — override on-page based on live signals |
| First-responder | {{FIRST_RESPONDER_ROLE}} |
| Last reviewed | {{LAST_REVIEWED}} |
| Next review | {{NEXT_REVIEW}} |
| Related dashboards | {{DASHBOARD_LINKS}} |
| Related alerts | {{ALERT_LINKS}} |

---

## Symptom

{{SYMPTOM_DESCRIPTION}}

<!-- 1-3 sentences describing the observable symptom the on-call sees.
     Be metric-specific: not "site is slow" but "checkout p95 > 2s for
     5+ minutes on the /cart/submit endpoint". Include the alert that
     paged (if any). -->

**What the customer sees:** {{CUSTOMER_IMPACT}}

<!-- One line describing the customer-visible impact. -->

---

## Quick diagnosis (first 5 minutes)

Run these first-check commands / dashboard glances **in order**. Stop
as soon as one narrows the cause.

1. **{{DIAG_1_LABEL}}** — `{{DIAG_1_COMMAND}}`
   - Expected: {{DIAG_1_EXPECTED}}
   - Interpretation: {{DIAG_1_INTERPRETATION}}
2. **{{DIAG_2_LABEL}}** — `{{DIAG_2_COMMAND}}`
   - Expected: {{DIAG_2_EXPECTED}}
   - Interpretation: {{DIAG_2_INTERPRETATION}}
3. **{{DIAG_3_LABEL}}** — `{{DIAG_3_COMMAND}}`
   - Expected: {{DIAG_3_EXPECTED}}
   - Interpretation: {{DIAG_3_INTERPRETATION}}
4. **{{DIAG_4_LABEL}}** — `{{DIAG_4_COMMAND}}`
5. **{{DIAG_5_LABEL}}** — `{{DIAG_5_COMMAND}}`

---

## Likely causes

Ranked by prior frequency for this symptom. Confirm before mitigating.

- **{{CAUSE_1_NAME}}** — {{CAUSE_1_DESCRIPTION}} (evidence: {{CAUSE_1_EVIDENCE}})
- **{{CAUSE_2_NAME}}** — {{CAUSE_2_DESCRIPTION}} (evidence: {{CAUSE_2_EVIDENCE}})
- **{{CAUSE_3_NAME}}** — {{CAUSE_3_DESCRIPTION}} (evidence: {{CAUSE_3_EVIDENCE}})
- **{{CAUSE_4_NAME}}** — {{CAUSE_4_DESCRIPTION}} (evidence: {{CAUSE_4_EVIDENCE}})

---

## Mitigation steps

Numbered. Each step is atomic and reversible unless flagged otherwise.
**Announce each step in {{COMMS_CHANNEL}}** before executing.

1. **{{MITIGATION_1_LABEL}}** — {{MITIGATION_1_ACTION}}
   - Command: `{{MITIGATION_1_COMMAND}}`
   - Verify: {{MITIGATION_1_VERIFY}}
   - Reversible: {{MITIGATION_1_REVERSIBLE}}
2. **{{MITIGATION_2_LABEL}}** — {{MITIGATION_2_ACTION}}
   - Command: `{{MITIGATION_2_COMMAND}}`
   - Verify: {{MITIGATION_2_VERIFY}}
3. **{{MITIGATION_3_LABEL}}** — {{MITIGATION_3_ACTION}}
   - Command: `{{MITIGATION_3_COMMAND}}`
   - Verify: {{MITIGATION_3_VERIFY}}
4. **{{MITIGATION_4_LABEL}}** — {{MITIGATION_4_ACTION}}
5. **{{MITIGATION_5_LABEL}}** — {{MITIGATION_5_ACTION}} <!-- often "revert last deploy" -->
6. **{{MITIGATION_6_LABEL}}** — {{MITIGATION_6_ACTION}} <!-- often "engage vendor support" -->

---

## Rollback triggers

Any of these → move to rollback (see `ROLLBACK_PLAN.md` from the Release agent).

- {{ROLLBACK_TRIGGER_1}} <!-- e.g. "5xx rate > 2% sustained 3 min" -->
- {{ROLLBACK_TRIGGER_2}}
- {{ROLLBACK_TRIGGER_3}}
- Manual call from Incident Commander (any reason)

---

## Escalation

Escalate if mitigation steps 1-4 do not resolve within {{ESCALATION_WINDOW}}
minutes, OR if the symptom worsens, OR if a rollback trigger fires.

| Step | Who | How | When |
|---|---|---|---|
| 1 | {{ESCALATE_L1_ROLE}} | {{ESCALATE_L1_CHANNEL}} | Immediately |
| 2 | {{ESCALATE_L2_ROLE}} | {{ESCALATE_L2_CHANNEL}} | +{{ESCALATE_L2_MINUTES}}min if unresolved |
| 3 | {{ESCALATE_L3_ROLE}} | {{ESCALATE_L3_CHANNEL}} | +{{ESCALATE_L3_MINUTES}}min if unresolved |
| 4 | Vendor support ({{VENDOR}}) | {{VENDOR_CONTACT}} | Only if the cause is confirmed vendor-side |

---

## Verification (resolved criteria)

The incident is resolved when **all** of the following hold for
{{VERIFY_STABILIZATION_WINDOW}} consecutive minutes:

- [ ] {{VERIFY_METRIC_1}} — recovered to baseline
- [ ] {{VERIFY_METRIC_2}} — recovered to baseline
- [ ] {{VERIFY_METRIC_3}} — recovered to baseline
- [ ] Synthetic check ({{SYNTHETIC_NAME}}) — green
- [ ] No new alerts firing on this service in the last {{VERIFY_QUIET_WINDOW}} min

---

## Comms templates

**Internal — declaration** ({{COMMS_CHANNEL}}):

> `[INCIDENT — {{DEFAULT_SEVERITY}}]` {{SYMPTOM_SHORT}}. Investigating.
> IC: @{{IC_HANDLE}}. Bridge: {{BRIDGE_LINK}}. Next update in 15 min.

**Internal — update**:

> `[UPDATE]` {{CURRENT_STATE}}. Mitigation step {{STEP_N}} in progress.
> Next update in 15 min.

**Internal — resolution**:

> `[RESOLVED]` {{SYMPTOM_SHORT}}. Root cause: {{ROOT_CAUSE_SHORT}}.
> Postmortem to follow within {{POSTMORTEM_SLA_HOURS}}h.

**Customer-facing** (only if impact >= {{CUSTOMER_COMMS_THRESHOLD}}):

> {{CUSTOMER_COMMS_TEMPLATE}}

---

## Post-incident follow-ups

- [ ] Author blameless postmortem (`--artifacts postmortem --incident-in <log>`)
- [ ] Review runbook effectiveness — did the diag commands narrow the cause? Update if not.
- [ ] Add missing alert (if the incident was noticed by a human before an alert fired)
- [ ] Tune noisy alert (if any alert fired without action)
- [ ] Update SLO error budget consumed
- [ ] Cross-reference in `CHANGE-LOG.md`

---

_Generated by BMAD DCA Operations agent — {{GENERATED_AT}}_
