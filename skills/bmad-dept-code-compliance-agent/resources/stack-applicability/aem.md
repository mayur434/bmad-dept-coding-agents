# Compliance applicability guide — AEM (AEMaaCS / AMS)

## Purpose framing

AEM is a **content and experience layer** — DAM assets, Content Fragments,
forms, personalization, and the dispatcher/CDN edge in front of it all.
Its compliance profile is dominated by what it *stores and renders*, not
by payment processing: personal data captured in AEM Forms, PII embedded
in DAM metadata or uploaded assets, and a large web-facing attack surface
(HTL rendering, dispatcher rules, service-user permissions) that pulls in
CWE/OWASP heavily. Payment-card data is rare on this stack and should
never be assumed present. Because AEM is often the front door for a
brand's entire digital presence, it's also frequently the stack where a
compliance run first encounters a mix of applicability signals in one
project — a form here, a DAM asset there, a personalization rule
somewhere else — none of which individually scream "regulated data,"
but which compound into a heavy GDPR posture once aggregated.

## Framework applicability matrix for AEM

| Framework | Applicability | Primary trigger | Typical evidence source |
|---|---|---|---|
| CWE | Heavy | HTL/Sightly templating, dispatcher config, service-user ACLs are all code-observable weakness surfaces. | `audit`/`sonar-scan` findings tagged `AEMCS-SEC-*`. |
| OWASP | Heavy | Public-facing app layer — Injection, Broken Access Control, Security Misconfiguration all apply directly. | `sonar-scan` Quality Gate + `audit` rule-pack findings. |
| CIS | Medium | Asset inventory, access-control hygiene, and logging safeguards apply; much of Cloud Manager's infra hardening sits outside code. | Cloud Manager pipeline config, dispatcher access-control lists. |
| PCI-DSS | None (typically) | AEM rarely touches cardholder data directly. Applicable only if a DAM asset or CF model is confirmed to hold card-data-adjacent content — rare; flag for human review, never assume. | N/A unless human-confirmed; see `resources/framework-mappings/pci.md`. |
| HIPAA | Medium | Applies only when the site is confirmed to serve PHI (e.g. a healthcare-provider content site, patient-education forms). **Requires explicit opt-in — never inferred.** | AEM Forms submission handling, DAM asset classification (human-confirmed PHI scope). |
| GDPR | Heavy | AEM Forms capture PII directly; DAM stores uploaded assets that may contain PII; personalization/Target integration processes behavioral data. | Form-submission handler code, DAM asset-retention config, Consent Management integration. |
| SOX | Light | Rarely touches financial-reporting systems directly — applicable only if AEM renders/exposes investor-relations or financial-disclosure content with a controlled-publication workflow. | Content-approval workflow config (if financial-disclosure content is in scope). |
| ISO 27001 | Medium | Technical controls (access control, logging, crypto) are code-observable; organizational controls (asset classification policy, supplier review) are not. | Cloud Manager audit logs, dispatcher security-rules changelog. |

## Shared-responsibility notes for AEM

AEMaaCS is Adobe-managed infrastructure (compute, network, patching
cadence) with customer-managed application code and content. Adobe's
own SOC2/ISO 27001 posture for the AEMaaCS platform covers the
*infrastructure* layer <!-- verify: confirm current Adobe AEMaaCS
compliance-certification scope before citing in an external artifact —
Adobe Trust Center publishes the authoritative, current list -->; it
does **not** cover application-layer decisions the customer makes —
dispatcher rules, service-user permission grants, form field
configuration, DAM retention policy, or CSP headers are all customer
responsibility. A frequent misconception on this stack: "AEMaaCS is
Adobe-managed, so it's already compliant." It is not — the content and
code deployed into it carry their own compliance obligations regardless
of the managed hosting layer underneath. On AMS (the non-cloud-service
flavor), the split shifts further toward the customer — Adobe manages
less of the infrastructure stack, so network-level controls that would
sit with Cloud Manager on AEMaaCS more often land on the customer's own
ops team on AMS. Confirm which flavor is in play before writing the
shared-responsibility paragraph into a cover letter — the two are not
interchangeable for this purpose.

## Stack-specific evidence sources

- Cloud Manager audit logs — deployment history, pipeline approvals.
- Dispatcher access-control-list (`.any`/`.dispatcher` rules) and access logs.
- IMS (Identity Management Service) access logs — who authenticated, when.
- Content-package deployment history — what shipped, and when.
- Workflow-launcher config for content-approval steps (SOX/financial-disclosure scope).
- Replication/activation logs — what content went live, and to which publish tier, and when.
- Query-Builder / Content Fragment Model schema definitions — useful for locating where PII fields are declared.

## Stack-specific common gaps

- PII captured via AEM Forms with no documented retention/deletion policy (GDPR Art. 5(1)(e)).
- PII or uploaded documents in DAM assets with no retention policy or classification tagging (GDPR Art. 5).
- Verbose error pages leaking stack traces on 500s (CWE-209 / OWASP A05).
- Missing or overly permissive Content-Security-Policy headers (OWASP A05 / CWE-1021).
- Over-privileged service-user accounts (`AEMCS-SEC-004`) granted broader DAM/content access than the integration needs (CWE-269 / CIS Control 6).
- Dispatcher rules missing deny-by-default on sensitive paths (`AEMCS-SEC-002`, CWE-284).
- Unescaped HTL output in custom components (`AEMCS-SEC-003`, CWE-79 / OWASP A03).
- No consent-capture mechanism wired into personalization/Target-driven components, so behavioral profiling runs ahead of a lawful basis being established (GDPR Art. 6/7).

## Stack-specific compliance quick-wins

- Add a documented retention/purge policy for DAM assets and form submissions — closes GDPR Art. 5(1)(e) gaps in one policy change plus a scheduled workflow.
- Harden dispatcher rules to deny-by-default and audit them into version control — closes CIS Control 4/6 and CWE-284 gaps simultaneously.
- Enable structured error handling (custom 500 pages) — removes stack-trace disclosure across every environment at once (CWE-209/OWASP A05).
- Tighten service-user ACLs to least-privilege per integration — a single review pass typically closes several CWE-269 findings.
- Wire the Consent Management integration to gate personalization/Target components the same way it already gates analytics — turns an implicit assumption into an enforced control.

## Worked scenario for AEM

A healthcare-marketing site built on AEMaaCS runs its first compliance
pass. The site has a patient-education content hub (DAM assets, some
containing downloadable PDFs with patient-facing health information) and
a contact/appointment-request AEM Form that captures name, email, and a
free-text "reason for visit" field.

Likely-applicable frameworks: GDPR (heavy — the form captures PII with
no visible consent checkbox or retention note), HIPAA (medium — the
"reason for visit" field is a PHI red flag; the team should be asked
directly whether this counts as PHI before HIPAA is scoped in), CWE/OWASP
(heavy — standard web-facing surface), CIS (medium), PCI (none — no
payment flow present), SOX (light — no financial-disclosure content
found).

A first compliance report run would likely surface: the form-submission
handler storing the free-text field without an obvious retention limit
(GDPR gap, and a HIPAA applicability question the agent should raise
rather than silently resolve), a missing CSP header on the DAM-asset
delivery path (OWASP A05 gap), and two over-privileged service users
found by a prior `audit` run mapping to CWE-269/CIS Control 6.

Given 18 merged findings from `audit` + `sonar-scan`, a representative
outcome looks like: 11 controls covered (mostly CWE/OWASP — escaping,
CSRF, ACL checks that already pass), 5 gaps (the form-retention gap,
the CSP gap, two service-user findings, and one dispatcher deny-by-default
gap), and 2 rows marked `N/A pending confirmation` — the HIPAA
applicability question and the SOX financial-disclosure-content
question, both of which the agent should surface as open questions in
the cover letter rather than resolve on its own. The remediation plan
would prioritize the GDPR retention gap and the HIPAA question first,
since both are CRITICAL-adjacent under the `content` role's default
SLA and neither has a pure-code fix — the retention gap needs a policy
decision before any code change closes it.

## Cross-references

See `resources/framework-mappings/gdpr.md` (heavy), `resources/framework-mappings/cwe.md`
and `resources/framework-mappings/owasp.md` (heavy), `resources/framework-mappings/hipaa.md`
(medium, opt-in only), `resources/framework-mappings/cis.md` and
`resources/framework-mappings/iso27001.md` (medium). SOX is light for
AEM in the vast majority of projects — only load `resources/framework-mappings/sox.md`
when a financial-disclosure-content workflow is explicitly in scope.

Use this guide alongside `resources/framework-mappings/<framework>.md` when
generating a control-mapping report scoped to AEM.
