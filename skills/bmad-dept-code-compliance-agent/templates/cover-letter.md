# Compliance Cover Letter — {{PROJECT_NAME}}

{{LETTERHEAD_PLACEHOLDER}}
<!-- Organization letterhead / logo goes here if this is exported to
     docx or PDF for external submission. -->

**Date:** {{RUN_TIMESTAMP}}
**Prepared for:** {{AUDIENCE}} <!-- e.g. "External Auditor", "Customer Security Review", "Internal Governance Committee" -->
**Prepared by:** {{PREPARED_BY}} <!-- team/role, not a claimed individual signature — that belongs on ATTESTATION.md -->
**Re:** Compliance posture summary — {{FRAMEWORKS_LIST}}

---

## Scope statement

This letter summarizes the compliance posture of **{{PROJECT_NAME}}**
against **{{FRAMEWORKS_LIST}}** as observed by the BMAD DEPT Compliance
Agent on {{RUN_TIMESTAMP}}.

{{SCOPE_DETAIL}}

<!-- 2-4 sentences: which repositories/services/stacks are in scope,
     which are explicitly out of scope, and the assessment period.
     Pull stack scope from resources/framework-mappings/<fw>.md § Per-
     stack applicability for each resolved framework. -->

---

## Methodology

This posture summary was produced by mapping findings from the
following automated sources against each framework's published control
taxonomy:

| Source | Contribution |
|---|---|
| `audit` | {{AUDIT_CONTRIBUTION}} |
| `sonar-scan` | {{SONAR_CONTRIBUTION}} |
| `test-coverage` | {{COVERAGE_CONTRIBUTION}} |
| `impact-analysis` | {{IMPACT_CONTRIBUTION}} |
| `code-review` | {{REVIEW_CONTRIBUTION}} |

Frameworks assessed: {{FRAMEWORKS_LIST}}. Control taxonomies referenced:
{{FRAMEWORK_VERSIONS}} <!-- e.g. "CWE Top 25 (2024), OWASP Top 10
(2021), PCI-DSS v4.0" -->.

**This is an automated, sampling-based correlation exercise — not a
formal audit, penetration test, or control walkthrough.** Findings were
produced by static-analysis and rule-based scanners; they are subject
to false positives and false negatives, and they cannot observe
organizational/process controls (training completion, physical
security, vendor contracts) that some frameworks require.

---

## Summary of posture

| Metric | Value |
|---|---|
| Controls in scope (all frameworks) | {{CONTROLS_TOTAL_COUNT}} |
| Controls covered | {{CONTROLS_COVERED_COUNT}} ({{COVERAGE_RATE_PCT}}%) |
| Controls with gaps | {{CONTROLS_GAP_COUNT}} |
| Gaps formally accepted (risk-accepted) | {{CONTROLS_ACCEPTED_COUNT}} |
| Gaps deferred (scheduled remediation) | {{CONTROLS_DEFERRED_COUNT}} |
| Controls not applicable | {{CONTROLS_NA_COUNT}} |

**{{COVERAGE_RATE_PCT}}%** of in-scope controls are covered by an
observed finding. {{POSTURE_NARRATIVE}}

<!-- 2-3 sentence plain-English characterization, e.g.: "The majority
     of gaps concentrate in [category] — largely process/evidence gaps
     rather than code-level weaknesses. No CRITICAL gap is currently
     unaddressed; [N] HIGH gaps have remediation scheduled within SLA." -->

---

## Key findings highlight

The following gaps are the highest-severity / highest-priority items
from this assessment:

1. **{{KEY_FINDING_1_TITLE}}** ({{KEY_FINDING_1_FRAMEWORK}} — {{KEY_FINDING_1_CONTROL_ID}}, {{KEY_FINDING_1_SEVERITY}}) — {{KEY_FINDING_1_SUMMARY}}. Status: {{KEY_FINDING_1_STATUS}}.
2. **{{KEY_FINDING_2_TITLE}}** ({{KEY_FINDING_2_FRAMEWORK}} — {{KEY_FINDING_2_CONTROL_ID}}, {{KEY_FINDING_2_SEVERITY}}) — {{KEY_FINDING_2_SUMMARY}}. Status: {{KEY_FINDING_2_STATUS}}.
3. **{{KEY_FINDING_3_TITLE}}** ({{KEY_FINDING_3_FRAMEWORK}} — {{KEY_FINDING_3_CONTROL_ID}}, {{KEY_FINDING_3_SEVERITY}}) — {{KEY_FINDING_3_SUMMARY}}. Status: {{KEY_FINDING_3_STATUS}}.

Full detail for every control: see `CONTROL-MAPPING-<framework>.md`.
Remediation timeline for open gaps: see `REMEDIATION-PLAN.md`.

---

## Sign-off block

| Role | Name | Date | Signature |
|---|---|---|---|
| Prepared by | {{PREPARED_BY_NAME}} | {{RUN_TIMESTAMP}} | *(AI-assisted draft — not a signed record)* |
| Reviewed by | {{REVIEWER_NAME_PLACEHOLDER}} | | |
| Approved for submission by | {{APPROVER_NAME_PLACEHOLDER}} | | |

<!-- The AI-authored draft never fills the Reviewed/Approved rows —
     those require a human signature before this letter is submitted
     anywhere external. If an ATTESTATION.md was also authored for
     this run, its sign-off block is the authoritative one; this
     cover-letter sign-off block is a lighter-weight internal-review
     tracker, not itself an attestation. -->

---

## Disclaimer

This cover letter and the control-mapping it summarizes were produced
by the **BMAD DEPT Compliance Agent**, an AI-assisted tool that
correlates automated scanner findings against published compliance
framework control taxonomies. It is **not** a certification, a formal
audit opinion, or legal advice, and it does not substitute for:

- A Qualified Security Assessor (QSA) or Internal Security Assessor
  (ISA) review for **PCI-DSS**.
- A Privacy Officer / Security Officer risk assessment for **HIPAA**.
- A Data Protection Officer (DPO) review for **GDPR**.
- An external auditor's opinion for **SOX** Section 302/404.
- A certification body's audit for **ISO 27001**.

**Human legal/compliance review is required before this letter is
submitted to any external party** (auditor, regulator, customer
security questionnaire, or board). Findings referenced here are
subject to the limitations of automated static analysis — false
positives, false negatives, and blind spots on organizational/process
controls that no code scanner can observe.

---

*Generated by the BMAD DEPT Compliance Agent (⚖️) on {{RUN_TIMESTAMP}}.*
