---
id: compliance
title: Compliance — Prompts
sidebar_position: 11
description: Copy-paste prompts for the Compliance agent — control mapping, audit trails, cover letters, remediation plans, and attestations across 8 compliance frameworks and 8 Adobe/JVM stacks.
keywords:
  - compliance prompts
  - cwe prompts
  - owasp prompts
  - pci prompts
  - hipaa prompts
  - gdpr prompts
  - sox prompts
  - iso27001 prompts
  - audit trail prompts
  - attestation prompts
---

Copy-paste prompts for the **Compliance agent** (`bmad-dept-code-compliance-agent`). Send a whole block or a single line — the agent parses natural language and resolves flags, framework(s), source agents, and role automatically.

**Modes:** `full-report` = every resolvable artifact across the resolved framework(s) in one run (`--artifacts all --framework all`, or role-default framework set). `individual` = narrow to one artifact and/or one or more frameworks (`--artifacts control-mapping` / `audit-trail` / `cover-letter` / `remediation-plan` / `attestation`, `--framework <csv>`).

Related: [Compliance agent](../../agents/compliance) · [Compliance Mapping concept](../../concepts/compliance-mapping) · [CLI Flags](../cli-flags) · [Role adaptation](../../concepts/role-adaptation).

---

## Quick starters

Send one of these first — the agent auto-detects the framework(s), source agents, and role, and asks a single question only if a required input is truly missing (an attestation signer, or applicability of HIPAA/PCI/SOX when there's no prior signal).

```text
compliance report
map our findings to OWASP
PCI compliance for our checkout
full compliance across all frameworks
audit trail export
remediation plan with SLA
are we PCI compliant
which controls does this violate
```

---

## Per-framework control mapping

Per-framework prompts — grounded in `resources/framework-mappings/<framework>.md`.

### CWE

```text
map our audit findings to CWE
CWE control-mapping sourced from audit + sonar-scan
```

### OWASP

```text
OWASP Top 10 mapping for our storefront
map to OWASP, deep dive on injection-category findings
```

### CIS

```text
CIS Controls posture across all services
CIS mapping — flag which safeguards are code-observable vs. process-only
```

### PCI

```text
PCI-DSS mapping for our checkout code
PCI compliance — what SAQ type applies, and what's still a gap?
```

### HIPAA

```text
HIPAA mapping — we confirm this project handles PHI
HIPAA Security Rule control-mapping, Privacy Officer will review
```

### GDPR

```text
GDPR mapping for our AEM forms + DAM
GDPR mapping — flag data-flow gaps a code finding alone can't resolve
```

### SOX

```text
SOX controls for our order/revenue data path
SOX Section 404 continuity check ahead of our cutover
```

### ISO 27001

```text
ISO 27001 Annex A mapping across our estate
ISO 27001 — which Annex A controls are actually code-observable?
```

---

## Multi-framework

```text
map to both PCI and GDPR
compliance report across CWE, OWASP, and CIS
map our checkout code to PCI and SOX together
full sweep — CWE, OWASP, PCI, GDPR
compliance as security — CWE and OWASP only, then add PCI once confirmed
```

---

## Source-agent scoping

```text
compliance sourced only from sonar-scan
compliance including code-review pre-merge findings
compliance with findings no older than 30 days
compliance sourced from audit and impact-analysis only
compliance — merge every source agent's cache, default freshness
```

---

## Audit trail

```text
audit trail for the last 90 days
audit trail export for our SOC2 renewal
audit trail — full CHANGE-LOG + findings-cache run history
audit trail scoped to this quarter only
audit trail — how many runs have we logged across the whole DCA suite?
```

---

## Cover letters + attestations

```text
auditor cover letter for our PCI QSA
attestation for HIPAA, signed by our Privacy Officer
executive compliance-posture summary
cover letter — business-risk framing, no code-level detail
attestation — ISO 27001, signed by our CISO
```

---

## Remediation plans

```text
remediation plan with SLA for our OWASP gaps
remediation plan, no SLA — just prioritized list
Jira-ready remediation items
remediation plan scoped to CRITICAL and HIGH gaps only
remediation plan — group by owner-to-be-assigned
```

---

## Per-stack compliance

Per-stack prompts — grounded in `resources/stack-applicability/<stack>.md`.

### AEM

```text
compliance profile for our AEM estate
```

### Adobe Commerce (PaaS)

```text
compliance profile for our Commerce PaaS checkout
```

### Adobe Commerce SaaS

```text
compliance profile for our Commerce SaaS storefront — where's the Adobe/customer line?
```

### Sling / Shaft

```text
compliance profile for our Sling connector bundles
```

### Spring Boot

```text
compliance profile for our Spring payment-gateway service
```

### Adobe App Builder

```text
compliance profile for our App Builder actions
```

### Edge Delivery Services (EDS)

```text
compliance profile for our EDS storefront — consent and analytics focus
```

### EDS + Commerce

```text
compliance profile for our EDS + Commerce drop-in integration
```

---

## Chained SDLC passes

```text
audit → sonar-scan → compliance report
compliance → release — gate the deploy on the remediation plan's SLA status
impact-analyze the blast radius of a compliance remediation
compliance → architecture — standardization ADR for cross-team gaps
compliance → requirements — trace this compliance gap back to its BRD source
```

---

## Role-flavored requests

Prefix any prompt with `"as <role>, ..."` for a per-run role override (no write to `.bmad/role.yaml`):

```text
as security, deep CWE+OWASP mapping
as PM, executive compliance posture for the board
as migration lead, SOX continuity report
as devops, audit-trail automation with --fail-on-overdue wired into CI
as de, remediation plan with SLA, Jira-ready
as qa, control-mapping cross-referenced with test-coverage gaps
as ea, portfolio-level compliance sweep across every framework
as ba, control-mapping cross-referenced with BRD traceability
```

---

## Enterprise gate patterns

Mark compliance gaps accepted / deferred / wontfix so subsequent runs stop resurfacing them. See [Findings Gate](../../concepts/findings-gate) for the YAML shape.

```text
list decisions
mark COMP-14 accepted-risk — leadership signed off, revisit next cycle
mark COMP-9 deferred — GDPR retention-policy fix on next quarter's roadmap
mark COMP-3 wontfix — HIPAA not applicable, confirmed no PHI touches this project
compliance --fail-on-overdue                       # CI gate: exit 6 if a remediation SLA is OVERDUE
```

---

## Troubleshooting

```text
no cached findings — what do I run first?
HIPAA applicability unclear — how do I confirm it?
attestation missing signer — what do I need to provide?
control-mapping is all gaps, nothing covered — why?
--source-max-age-hours rejected my findings — how do I widen the window?
```

---

## Follow-up prompts

Reusable after any Compliance run:

```text
which controls have the most gaps?
compliance trend over the last quarter
generate a board-ready compliance summary slide outline
which compliance gaps are OVERDUE per SLA?
which decisions are already accepted for this framework?
hand the remediation plan to Release as a sign-off gate
schedule an audit + sonar-scan pass to refresh the source findings
summarize the CRITICAL compliance gaps only
```
