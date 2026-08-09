# Compliance Attestation — {{PROJECT_NAME}}

{{LETTERHEAD_PLACEHOLDER}}

---

## ⚠️ Before you sign

**This document is an AI-assisted draft.** It is not a substitute for
a formal audit, a certification-body assessment, or a signed legal
opinion. Read § Methodology and limitations below in full before any
named individual signs the block at the bottom of this document.
**Do not submit this attestation externally without human
legal/compliance review.**

---

## Scope + period covered

| Field | Value |
|---|---|
| Project / system | {{PROJECT_NAME}} |
| Framework(s) attested | {{FRAMEWORKS_LIST}} |
| Assessment period | {{PERIOD_START}} → {{PERIOD_END}} |
| In-scope components | {{IN_SCOPE_COMPONENTS}} |
| Out-of-scope components | {{OUT_OF_SCOPE_COMPONENTS}} |
| Attestation generated | {{RUN_TIMESTAMP}} |

{{SCOPE_DETAIL}}

<!-- 2-4 sentences describing the boundary of what this attestation
     covers — which repos/services, which environments (prod only?
     staging too?), and any explicit exclusions. -->

---

## Framework(s) attested

### {{FRAMEWORK_1_NAME}} (`{{FRAMEWORK_1_KEY}}`)

- **Controls assessed:** {{FW1_CONTROLS_TOTAL}}
- **Controls covered:** {{FW1_CONTROLS_COVERED}} ({{FW1_COVERAGE_PCT}}%)
- **Open gaps at time of attestation:** {{FW1_OPEN_GAPS}}
- **Accepted-risk gaps:** {{FW1_ACCEPTED_GAPS}} (see `.bmad/decisions.yaml`)
- **Attestation statement:** {{FW1_ATTESTATION_STATEMENT}}

<!-- e.g.: "Based on the control-mapping performed on {{RUN_TIMESTAMP}},
     {{FW1_COVERAGE_PCT}}% of applicable {{FRAMEWORK_1_NAME}} controls
     are covered by observed findings. {{FW1_OPEN_GAPS}} gap(s) remain
     open, tracked in REMEDIATION-PLAN.md with SLA deadlines. No
     CRITICAL gap is unaddressed as of this date." Populate honestly —
     do not soften an open CRITICAL gap. -->

### {{FRAMEWORK_N_NAME}} (`{{FRAMEWORK_N_KEY}}`)

<!-- Repeat per attested framework. -->

---

## Methodology + limitations

This attestation is based on an **automated, sampling-based
correlation** performed by the BMAD DEPT Compliance Agent, which maps
findings produced by static-analysis and rule-based scanners
(`audit`, `sonar-scan`, `test-coverage`, `impact-analysis`,
`code-review`) against each framework's published control taxonomy.

**This methodology has the following limitations, which the signer
below acknowledges:**

1. **AI-assisted, not independently audited.** No third-party auditor
   or certification body reviewed this mapping before it was generated.
2. **Sampling-based.** Scanner findings are a sample of the codebase's
   actual behavior, not exhaustive proof of absence of a weakness.
   False negatives are possible.
3. **Not a substitute for a formal audit.** This attestation does not
   satisfy the requirements of a PCI-DSS Report on Compliance (ROC), a
   HIPAA Security Rule risk assessment, a SOX external audit opinion,
   or an ISO 27001 certification audit.
4. **Cannot observe organizational/process controls.** Training
   completion, physical security, vendor/supplier due diligence,
   documented incident-response plan testing, and similar
   process-level controls required by several frameworks are outside
   what a code-findings correlation can ever confirm — see each
   framework's guide (`resources/framework-mappings/<fw>.md` §
   Common gaps DCA CANNOT auto-detect) for the specific list.
5. **Point-in-time.** This attestation reflects the state of mapped
   findings as of {{RUN_TIMESTAMP}}. Code changes after this date are
   not reflected until the next compliance run.

---

## Attestor

| Field | Value |
|---|---|
| Name | {{ATTESTOR_NAME}} |
| Role / title | {{ATTESTOR_ROLE}} |
| Organization | {{ORGANIZATION_NAME}} |
| Date | {{ATTESTATION_DATE}} |

<!-- ATTESTOR_NAME and ATTESTOR_ROLE come from --attestation-signer.
     See resources/framework-mappings/<fw>.md § Attestation
     considerations for who typically signs this document for each
     framework (e.g. PCI: QSA/ISA; HIPAA: Privacy/Security Officer;
     SOX: CFO/Controller + external auditor; GDPR: DPO). -->

By signing below, {{ATTESTOR_NAME}} confirms they have reviewed this
attestation's scope, methodology, and limitations, and that the
statements in § Framework(s) attested accurately reflect their
understanding of the project's compliance posture as of the date
above — **subject to the limitations disclosed in this document.**

---

## Signature block

```
_________________________________          Date: ______________
{{ATTESTOR_NAME}}
{{ATTESTOR_ROLE}}, {{ORGANIZATION_NAME}}
```

<!-- This is a plain-text signature block for a printed/PDF-exported
     copy. It is NOT a cryptographic or legally-binding e-signature —
     route through your organization's actual e-signature system
     (DocuSign, Adobe Sign, etc.) for anything submitted externally. -->

---

## Disclaimer

This attestation was drafted by the **BMAD DEPT Compliance Agent**, an
AI-assisted tool. It is **not** a certification, a formal audit
opinion, or legal advice. It does not substitute for a Qualified
Security Assessor (PCI-DSS), a Privacy/Security Officer risk assessment
(HIPAA), a Data Protection Officer review (GDPR), an external auditor's
opinion (SOX), or a certification-body audit (ISO 27001). **Human
legal/compliance review is required before this attestation is signed
and submitted to any external party.**

---

*Generated by the BMAD DEPT Compliance Agent (⚖️) on {{RUN_TIMESTAMP}}.*
