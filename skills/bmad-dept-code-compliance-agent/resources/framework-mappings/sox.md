# Framework mapping guide — SOX

## What SOX requires

The **Sarbanes-Oxley Act of 2002 (SOX)** is US federal law enacted
after the Enron/WorldCom accounting scandals, applying to all publicly
traded companies (and, in a lighter form, to their auditors). Its two
sections most relevant to a codebase are:

- **Section 302** — requires the CEO and CFO to personally certify the
  accuracy of financial reports and the effectiveness of disclosure
  controls each quarter.
- **Section 404** — requires management to assess, and an external
  auditor to attest to, the effectiveness of **Internal Control over
  Financial Reporting (ICFR)** annually.

For engineering teams, SOX in practice means: **any system that
produces, stores, or feeds data into the financial statements** (order
totals, revenue recognition, general-ledger feeds, payroll,
inventory-valuation systems) is subject to ICFR — which requires
demonstrable, auditable **internal controls**, not just "secure code."
A perfectly secure piece of code can still be a SOX gap if it lacks an
**audit trail** or a **segregation-of-duties** control on a
financial-data mutation path. This is the key distinction from every
other framework in this catalog: SOX cares about *control and
auditability of financial data*, not primarily about *security* per se
— though the two frequently overlap in implementation.

**SOX applicability requires explicit human confirmation before
mapping, same as HIPAA and PCI** — see `SKILL.md` § Constraints /
non-goals. Not every codebase touches financial-reporting systems even
within a publicly traded company; confirm the specific service is
in-scope before treating a gap as real rather than N/A.

## Control taxonomy

SOX itself does not prescribe a specific control framework — most
organizations implement ICFR using the **COSO Internal Control —
Integrated Framework** (Committee of Sponsoring Organizations of the
Treadway Commission), which organizes controls into five components:

| COSO Component | Focus |
|---|---|
| Control Environment | Tone at the top, organizational structure, integrity/ethics |
| Risk Assessment | Identification and analysis of risks to financial-reporting objectives |
| Control Activities | Policies/procedures that ensure management directives are carried out (approvals, authorizations, reconciliations, **segregation of duties**, **system access controls**) |
| Information and Communication | Systems that capture and communicate information needed for financial reporting |
| Monitoring Activities | Ongoing evaluations to ascertain whether internal-control components are present and functioning |

Code-level SOX findings map almost exclusively into **Control
Activities**, specifically the IT General Controls (ITGC) subset:
**access control, change management, and audit-trail/logging
integrity** over financial-data-producing systems.
<!-- verify: confirm SOX Section 302/404 citations and COSO framework
     structure against current authoritative sources before quoting
     verbatim in an externally-facing artifact. -->

## Ruleid-to-control mapping patterns

| ruleId pattern | Maps to | Rationale |
|---|---|---|
| `COMM-SEC-003` (Missing ACL check on admin controllers) | ITGC — Access Control / Segregation of Duties | Admin functions touching order/revenue data need role-based access enforcement to satisfy segregation-of-duties. |
| `AEMCS-SEC-004` (Insufficient service-user permissions) | ITGC — Access Control | Over-privileged service account on a financial-data-adjacent content path. |
| `SPRING-SEC-010` / `AEMCS-SEC-001` (Hardcoded credentials) | ITGC — Access Control | Shared/hardcoded credentials defeat individual accountability, a segregation-of-duties prerequisite. |
| `APPB-SEC-003` (Logging sensitive data) | ITGC — Audit Trail Integrity — **mixed signal**: logging exists (positive for audit-trail) but leaking sensitive fields is itself a control weakness | Evaluate case-by-case: does the log entry corroborate a financial transaction's who/what/when, or does it leak data that shouldn't be logged? |
| `COMM-SEC-002` / `SPRING-SEC-011` (SQL injection) | ITGC — Change Management / Data Integrity | Injection risk on a financial-data-mutation path threatens the integrity of reported figures — a direct ICFR concern, not just a security one. |
| `SPRING-SEC-014` (Unsafe deserialization) | ITGC — Data Integrity | Untrusted deserialization on a financial-data path threatens data integrity assurances ICFR requires. |
| Absence of an audit-log entry on a financial-data mutation (heuristic — no matching rule-pack entry yet) | Control Activities — Audit Trail | Flag as `<!-- verify: needs a dedicated rule-pack entry -->` — a mutation endpoint (e.g. order-total adjustment) with no corresponding audit-log call is a SOX-relevant gap even with zero security findings. |
| Direct-database-write bypass patterns (skipping an application-layer approval workflow) | Control Activities — Segregation of Duties | Heuristic pattern — flag for human review; static analysis can spot a raw-write path but not confirm whether an approval step was actually bypassed in practice. |

## Per-stack applicability for SOX

| Stack | Applicability | Why |
|---|---|---|
| Commerce PaaS/SaaS | **Heavy** (once confirmed in-scope) | Order totals, revenue recognition triggers, refund/credit-memo workflows are canonical SOX-relevant financial-reporting inputs. |
| Spring Boot | **Heavy** (once confirmed in-scope) | Common home for financial-services APIs, general-ledger feeds, payment-reconciliation services. |
| AEM (AEMaaCS/AMS) | **Light** | Content/experience layer rarely produces financial-statement data directly — applicable only if a CF model or admin workflow directly feeds a financial system (rare; confirm before scoping heavy). |
| App Builder | **Light-Medium** | Heavy only if a custom action orchestrates a financial-data mutation or reconciliation step. |
| Sling / Shaft | **Light-Medium** | Heavy only if a connector integrates with an ERP/general-ledger system. |
| EDS | **Light** | Static/edge-rendered presentation layer; essentially never a direct financial-reporting data producer. |
| EDS + Commerce | **Medium** | Inherits Commerce SaaS's applicability for the drop-in checkout/order-summary surface specifically. |

## Evidence requirements for SOX

- **Access Control / Segregation of Duties:** role-based access
  enforcement on financial-data mutation endpoints; absence of shared
  or hardcoded service credentials on those paths; evidence that no
  single role can both initiate AND approve a financial transaction
  (a workflow fact, only partially code-observable).
- **Change Management:** evidence that changes to financial-data-
  producing code paths went through code review + approval (this
  agent's `audit-trail` artifact, sourced from `CHANGE-LOG.md` +
  findings-cache history, can partially corroborate this — a
  timestamped record of who ran what).
- **Audit Trail Integrity:** logging present on financial-data
  mutation events, capturing who/what/when, without leaking sensitive
  data that shouldn't be logged.
- **Data Integrity:** absence of injection/deserialization weakness
  classes on financial-data-mutation paths.
- Most Control Environment, Risk Assessment, and Monitoring Activities
  evidence is organizational, not code-observable — cite the external
  auditor's ICFR walkthrough as the actual evidence source.

## Common gaps DCA CAN auto-detect

- Missing ACL/authorization checks on financial-data admin endpoints (Access Control).
- Hardcoded/shared credentials on financial-data-adjacent service accounts (Access Control / Segregation of Duties).
- Injection weaknesses on financial-data-mutation paths (Data Integrity).
- Unsafe deserialization on financial-data-mutation paths (Data Integrity).
- Sensitive-data logging patterns that either corroborate or undermine audit-trail integrity (Audit Trail — mixed signal, needs case-by-case read).
- A change-history record via `CHANGE-LOG.md` + findings-cache (Change Management — partial, corroborating evidence only).

## Common gaps DCA CANNOT auto-detect (human review required)

- Whether the specific service is actually in-scope for the company's ICFR assessment — the foundational scoping question.
- Whether a documented segregation-of-duties matrix exists and is actually enforced end-to-end (a workflow/organizational fact beyond a single access-control check).
- Whether financial-close, reconciliation, and reporting processes have documented, tested controls (Monitoring Activities).
- Whether management has performed and documented its annual ICFR assessment (Section 404(a)).
- Whether the external auditor's ICFR attestation (Section 404(b)) is current.
- Whistleblower-protection and ethics-hotline program existence (Control Environment).
- Whether change-management approvals were actually obtained for each production deployment, beyond what a git/CHANGE-LOG history can corroborate — full change-advisory-board evidence is typically outside DCA's visibility.
- Board/audit-committee oversight documentation.

## Worked mapping example for SOX

*(Assumes SOX in-scope status has been explicitly confirmed for this
Commerce PaaS order-management service.)*

```
F1: COMM-SEC-003 "Missing ACL check in Adminhtml/CreditMemo/Save" — HIGH
F2: SPRING-SEC-010 "Hardcoded reconciliation-service API key" — CRITICAL
F3: COMM-SEC-002 "Raw SQL in RefundController::process()" — CRITICAL
```

Resulting control-mapping rows:

| Control | Status | Mapped finding(s) | Remediation note |
|---|---|---|---|
| Access Control / Segregation of Duties | gap | F1 | Add ACL restricting credit-memo creation to authorized finance-ops roles distinct from the approver role. |
| Access Control (Change Mgmt evidence) | gap | F2 | Rotate the exposed key; move to a secrets manager with per-service scoping and rotation policy. |
| Data Integrity | gap | F3 | Parameter-bind the query; injection on a refund-processing path directly threatens reported-figures integrity. |
| Monitoring Activities | N/A (not code-observable) | — | Confirm quarterly ICFR monitoring review covers this service; owner: Internal Audit / Controller's office. |

## Attestation considerations for SOX

SOX attestation is the most formally regulated of the eight frameworks
in this catalog: **Section 302** requires the **CEO and CFO** to
personally certify quarterly; **Section 404(b)** requires the
**external auditor** to independently attest to ICFR effectiveness
annually (for accelerated filers). This agent's `ATTESTATION.md`
output is never presented as satisfying either obligation — it is, at
most, supporting evidence a **Controller** or **Internal Audit** team
might compile as part of their own ICFR testing workpapers, which then
feed the CFO's certification and the external auditor's independent
attestation. Name the signer explicitly as "Controller" / "Internal
Audit Lead" / similar — never imply the CEO/CFO's Section 302
certification or the external auditor's Section 404(b) opinion is
satisfied by this document.

---

Generate the full control-mapping report using
`templates/control-mapping.md` as the master, populating placeholders
with the framework-specific content from the guide above.
Cross-reference other frameworks' guides for overlapping controls
(e.g. SOX's Access Control ITGCs overlap with CIS Control 6 and PCI
Req 7/8 — all three require role-based, least-privilege access
enforcement, even though the underlying regulatory purpose differs).
