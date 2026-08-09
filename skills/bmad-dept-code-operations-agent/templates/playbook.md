# Incident Response Playbook — {{INCIDENT_TYPE}}

| Field | Value |
|---|---|
| Playbook ID | `PB-{{SLUG}}` |
| Incident type | **{{INCIDENT_TYPE}}** (security / availability / data / performance / other) |
| Stack | {{STACK}} |
| Owner team | {{OWNER_TEAM}} |
| Last reviewed | {{LAST_REVIEWED}} |
| Applies to | {{APPLIES_TO}} |

---

## Purpose

{{PURPOSE_STATEMENT}}

<!-- 2-3 sentences describing when this playbook applies and what it
     covers. Playbooks are for incident classes (data breach, latency
     regression, region-wide outage); runbooks are for specific symptoms
     within them. -->

---

## Incident roles

| Role | Responsibility | Who fills it |
|---|---|---|
| **Incident Commander (IC)** | Owns the incident end-to-end. Decides go/no-go, delegates work, calls stand-down. Not hands-on-keys. | {{IC_POOL}} |
| **Comms Lead** | Owns internal + external comms. Writes updates, syncs with PR/legal for external notices. | {{COMMS_POOL}} |
| **Ops Lead** | Hands-on-keys — runs mitigations from the runbook, drives investigation. | {{OPS_POOL}} |
| **Scribe** | Timestamped bridge log — every action, every decision, UTC. Feeds the postmortem. | {{SCRIBE_POOL}} |
| **Subject-matter experts (SMEs)** | Pulled in by IC as needed — DBA, security, platform, vendor. | On call |

---

## Initial triage (first 10 minutes)

### Step 1 — Confirm the incident

- [ ] Is the alert / report real, or a false positive? Cross-check dashboards.
- [ ] What is the scope? (single instance / region / global?)
- [ ] Is customer traffic affected? What percentage?

### Step 2 — Assess severity

| Severity | Blast radius | Duration threshold | External comms |
|---|---|---|---|
| **SEV1** | Global outage, revenue-critical path down, data breach confirmed, PII/PCI exposure | Any duration | Required within {{SEV1_COMMS_MINUTES}}min |
| **SEV2** | Regional outage, degraded feature, single-tenant impact | > 30 min | Optional; escalates to SEV1 if unresolved in {{SEV2_ESCALATION_HOURS}}h |
| **SEV3** | Isolated / internal impact, no customer-visible degradation | > 2h | Not required |

### Step 3 — Declare + assign

- [ ] IC declares in {{COMMS_CHANNEL}} using the standard template.
- [ ] Open the incident bridge ({{BRIDGE_URL}}).
- [ ] Assign Comms Lead, Ops Lead, Scribe.
- [ ] Page SMEs as needed.

---

## Containment

Goal: stop the bleeding. Prioritize stopping harm over understanding it.

- [ ] {{CONTAIN_STEP_1}}   <!-- e.g. "block the affected IP range at WAF" -->
- [ ] {{CONTAIN_STEP_2}}   <!-- e.g. "disable the affected feature flag" -->
- [ ] {{CONTAIN_STEP_3}}   <!-- e.g. "isolate the compromised instance from the fleet" -->
- [ ] Preserve evidence before wiping — snapshot volumes, capture logs, export bridge transcript.

---

## Investigation

<!-- FOR SECURITY INCIDENTS — apply STRIDE framing:
     Spoofing / Tampering / Repudiation / Information disclosure /
     Denial of service / Elevation of privilege. Each STRIDE category
     is a distinct investigation path. -->

### For security incidents (STRIDE)

- **Spoofing** — Was authentication bypassed? Check auth logs, session tokens, IMS/SSO traces.
- **Tampering** — Was data modified? Compare against last-known-good snapshot; check audit log integrity.
- **Repudiation** — Is the audit trail intact? Can we prove who did what?
- **Information disclosure** — Was PII/PCI/PHI exposed? Enumerate exposed records; scope regulator notification.
- **Denial of service** — Is this exhaustion, malicious traffic, or a bug? Traffic shape analysis.
- **Elevation of privilege** — Did any account gain unauthorized capability? Review role / permission changes.

### For availability / performance / data incidents

- Reproduce the symptom in a controlled environment.
- Correlate with recent changes (deploys, config, upstream/downstream).
- Identify the root cause candidate + a contributing-factors shortlist.
- Timeline analysis: when did the symptom start? What changed at that time?

---

## Eradication

Remove the root cause. Do not proceed to recovery until the cause is
gone — otherwise the incident will recur immediately.

- [ ] {{ERADICATE_STEP_1}}
- [ ] {{ERADICATE_STEP_2}}
- [ ] Verify the eradication (root cause is gone, not just symptom-masked).

---

## Recovery

Restore normal service. Communicate progress at each milestone.

- [ ] {{RECOVER_STEP_1}}
- [ ] {{RECOVER_STEP_2}}
- [ ] {{RECOVER_STEP_3}}
- [ ] Full verification (see the associated runbook's "Verification" section).
- [ ] Restore any traffic / features that were shed during containment.

---

## Communications plan

**Internal — declaration:** IC posts to {{COMMS_CHANNEL}} using the
`[INCIDENT — <SEV>]` template. Include: symptom, IC handle, bridge link,
next-update time.

**Internal — updates:** every 15 min (SEV1) / 30 min (SEV2) / 2h (SEV3),
even if "no change".

**External — customer:** Comms Lead drafts the status-page update; IC
approves; Comms Lead publishes. First customer update within
{{EXTERNAL_COMMS_MINUTES}} min of SEV1 declaration.

**External — regulator:** required for PII/PCI/HIPAA exposure. Legal
must be on the bridge before the notification is sent. Timeframe per
jurisdiction: {{REGULATOR_TIMELINE}}.

**Vendor:** engage vendor support ({{VENDOR_SUPPORT_CONTACT}}) if the
root cause is confirmed vendor-side.

---

## Stand-down criteria

The incident is closed only when **all** of the following hold:

- [ ] Symptoms recovered for {{STANDDOWN_STABILIZATION_MINUTES}} consecutive minutes
- [ ] Root cause identified (or explicitly parked with a follow-up)
- [ ] No further customer impact
- [ ] External comms updated to "resolved" (if any were sent)
- [ ] Bridge transcript archived
- [ ] IC declares stand-down in {{COMMS_CHANNEL}}

---

## Postmortem trigger

- **SEV1** — postmortem within 5 business days. **Required.**
- **SEV2** — postmortem within 10 business days. **Required.**
- **SEV3** — postmortem optional but recommended if any of: repeat
  incident (3+ in 30 days), customer complaint escalation, novel root cause.

Generate the postmortem template:

```
--artifacts postmortem --postmortem-severity <sev> --incident-in <bridge-transcript-path>
```

---

_Generated by BMAD DCA Operations agent — {{GENERATED_AT}}_
