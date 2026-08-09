# Compliance applicability guide — Commerce PaaS (Adobe Commerce / Magento 2)

## Purpose framing

Commerce PaaS is the self-managed-application-layer flavor of Adobe
Commerce (Magento 2 on Adobe-managed infrastructure) — checkout
controllers, payment-method modules, customer-account management, and
order/revenue data all live directly in the codebase the customer
controls. That makes it the **heaviest-weighted stack in this suite**
for both PCI-DSS (payment flow is first-party code, not a hosted
redirect) and GDPR (customer PII and order history are directly
queryable). SOX applies whenever the platform feeds revenue-recognition
reporting.

## Framework applicability matrix for Commerce PaaS

| Framework | Applicability | Primary trigger | Typical evidence source |
|---|---|---|---|
| CWE | Heavy | PHP controller/template/admin-panel weakness classes (SQLi, XSS, CSRF, ACL) map cleanly and densely. | `audit` findings tagged `COMM-SEC-*`, `COMM-DEP-*`. |
| OWASP | Heavy | Full HTTP-facing app layer — storefront, checkout, and Adminhtml admin panel all in scope. | `sonar-scan` Quality Gate + `audit` findings. |
| CIS | Medium | Access-control and logging safeguards are code-observable; network/infra safeguards sit with the Cloud/on-prem ops team. | Admin-panel action logs, Cloud infra pipeline config. |
| PCI-DSS | Heavy | Payment-method modules, checkout controllers, and stored order/card-adjacent data live directly in-scope code — most likely SAQ D unless fully tokenized. | `audit`/`sonar-scan` findings on payment-flow modules; SAQ type confirmed by the merchant. |
| HIPAA | None (typically) | Commerce PaaS is a retail/checkout platform — applicable only in the rare case of a health-product merchant confirmed to handle PHI at checkout. | Human-confirmed applicability only. |
| GDPR | Heavy | Customer accounts, order history, and address books are directly queryable PII stores. | Customer-data-export/erasure code paths, admin customer-grid access logs. |
| SOX | Medium | Order and revenue data feeds financial reporting when Commerce is the system of record for recognized revenue. | Order-state-transition audit trail, admin action logs on order/refund actions. |
| ISO 27001 | Medium | Technical controls (access control, crypto, logging) are code-observable; organizational ISMS controls are not. | Admin RBAC config, Cloud Manager (or equivalent) deployment audit trail. |

## Shared-responsibility notes for Commerce PaaS

Commerce PaaS runs on Adobe-managed cloud infrastructure (Fastly CDN,
managed database/compute), but — unlike Commerce SaaS — the
*application* is customer-owned and customer-deployed. Network
segmentation (PCI Req 1) and infrastructure-level encryption-at-rest are
largely Adobe/infra-team responsibility and outside this agent's
code-scan scope; everything above that line — checkout controller logic,
payment-module configuration, admin ACLs, customer-data handling — is
squarely the customer's compliance burden. Do not assume "PaaS" implies
"Adobe handles PCI scope" — the merchant is very likely still SAQ D or
SAQ A-EP scope precisely because payment-flow code is first-party. This
is also why Commerce PaaS carries the largest human-review surface of
any stack for PCI Req 1 (network segmentation) — the platform runs on
Adobe's managed Fastly/cloud infrastructure, but the segmentation
boundary between the merchant's Commerce instance and the rest of
Adobe's shared platform is an infra-architecture fact this agent cannot
observe from application code, and should always be routed to the
infra/security team rather than marked `covered` or `gap` from a code
finding alone.

## Stack-specific evidence sources

- `var/log/*` (system.log, exception.log, debug.log) — application-level audit trail.
- Adminhtml action logs — who took which admin action, when.
- PCI network-segmentation documentation — infra-level, outside this agent's code-scan scope; cite the infra/ops team as owner.
- Encryption-at-rest confirmation for the customer/order database — a DB-config fact, not code-observable.
- Order-state-transition history — evidence for SOX segregation-of-duties on refunds/credit memos.
- Customer-data GDPR erasure/export request logs (Magento's built-in privacy tools, if enabled).
- Cron job history for scheduled export/report jobs — evidence of what left the system and when.

## Stack-specific common gaps

- Card-adjacent data or full request payloads logged in debug mode (`var/log/debug.log`) — PCI Req 3.4 / CWE-532.
- Missing rate-limiting on customer-account login/reset endpoints (CWE-307 / OWASP A07).
- Raw SQL in custom admin-grid or report controllers (`COMM-SEC-002`, CWE-89 / PCI Req 6.2.4).
- Missing ACL annotations on custom Adminhtml controllers (`COMM-SEC-003`, CWE-862 / PCI Req 7).
- Unencrypted PII export files (customer/order CSV exports) left in `var/export/` without cleanup (GDPR Art. 32).
- Missing CSRF validation on custom storefront forms (`COMM-SEC-001`, CWE-352).
- No segregation-of-duties control on who can both create and approve a refund (SOX gap, not a security gap — code can look "secure" and still fail this).
- Stale/vulnerable third-party payment-module dependency left unpatched past its vendor's disclosed CVE (`COMM-DEP-*`, PCI Req 6.3).

## Stack-specific compliance quick-wins

- Disable/gate debug-log verbosity in production and add a log-scrubbing filter for payment-adjacent fields — closes a PCI Req 3.4 gap and a GDPR gap in one config change.
- Add a scheduled cleanup job for `var/export/` — closes an unencrypted-PII-at-rest gap with minimal code.
- Add `@Acl` annotations to every custom Adminhtml controller — closes several CWE-862/PCI Req 7 findings in one pass.
- Introduce an explicit refund-approval step distinct from refund-creation — closes the SOX segregation-of-duties gap without touching security posture at all.
- Pin and monitor third-party payment-module versions against the vendor's security-advisory feed — closes PCI Req 6.3 gaps before they age into CRITICAL.

## Worked scenario for Commerce PaaS

A mid-market retailer runs Commerce PaaS with a custom payment-gateway
integration module and a custom admin report exporting daily order
totals to finance. SAQ type is confirmed D by the merchant's acquiring
bank relationship (custom payment code, not a hosted redirect).

Likely-applicable frameworks: PCI-DSS (heavy — confirmed SAQ D),
GDPR (heavy — customer accounts and order history), SOX (medium — the
daily order-total export feeds recognized-revenue reporting), CWE/OWASP
(heavy), CIS (medium), ISO 27001 (medium), HIPAA (none).

A first compliance report run would likely surface: a hardcoded gateway
API key in the custom payment module (PCI Req 3.5 + CWE-798, CRITICAL),
a missing ACL check on the finance export controller (PCI Req 7 +
CWE-862, HIGH), and a SOX gap flagged by the compliance mapper itself
(not from a source finding) — the refund workflow has no
segregation-of-duties control, a pure-gap row with no code fix, only a
process fix.

Merging 21 findings from `audit` + `sonar-scan` against this scope, a
representative outcome is: 14 controls covered, 6 gaps (the three
above plus a stale payment-module dependency, a missing rate-limit on
the account-reset endpoint, and an unencrypted export-file gap), and 1
control marked N/A pending confirmation (PCI Req 1, network
segmentation — routed to the infra team). Under the `security` role's
default SLA, the two CRITICAL PCI gaps get a 24-hour remediation
window; the SOX segregation-of-duties gap, having no code fix, would
typically be handed to `pm`/`ba` to scope as a workflow change rather
than assigned to an engineer.

## Cross-references

See `resources/framework-mappings/pci.md` (heavy — read its § SAQ-type
scoping note first), `resources/framework-mappings/gdpr.md` (heavy),
`resources/framework-mappings/sox.md` (medium), `resources/framework-mappings/cwe.md`
and `resources/framework-mappings/owasp.md` (heavy).

Use this guide alongside `resources/framework-mappings/<framework>.md` when
generating a control-mapping report scoped to Commerce PaaS.
