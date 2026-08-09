# Compliance applicability guide — Sling (Apache Sling / OSGi foundation)

## Purpose framing

Sling is the OSGi-based request-processing framework AEM is built on —
resource resolution, servlets/scripts bound to resource types, and
connector/integration bundles. Treated as its own stack in this suite
because plenty of DCA findings originate at the Sling layer
(OSGi service configuration, connector credentials, servlet
registration) independent of AEM's content-authoring concerns. Its
compliance profile is **foundational rather than content-driven**: the
same CWE/OWASP/CIS surface as AEM, minus the DAM/forms-specific GDPR
weight, unless something built on top of it introduces PII handling.

## Framework applicability matrix for Sling

| Framework | Applicability | Primary trigger | Typical evidence source |
|---|---|---|---|
| CWE | Medium | Servlet/resource-resolution and OSGi-config weakness classes exist but with a thinner rule-pack than AEM's content layer. | `audit` findings tagged against Sling servlets/connector bundles. |
| OWASP | Medium | Sling-registered servlets are HTTP-facing, but the surface is narrower without AEM's templating/forms layer on top. | `sonar-scan` findings on custom Sling servlets. |
| CIS | Medium | OSGi service configuration and connector-credential hygiene map to CIS asset-inventory and access-control safeguards. | OSGi config repository (`config.d`/Sling Feature Model), connector credential store. |
| PCI-DSS | None (typically) | Sling itself is a request-processing/integration layer, not a payment surface — heavy only if a connector directly transmits or stores cardholder data, which is uncommon. | Human-confirmed only if a payment-adjacent connector is found. |
| HIPAA | Depends | No inherent applicability; scoped in only if a bundle built on Sling is confirmed to process PHI (mirrors AEM's rule — never inferred). | Human-confirmed applicability only. |
| GDPR | Depends | Sling itself doesn't store PII; applicability depends entirely on what's built on top of it (a custom servlet handling form submissions, a connector syncing customer records). | Servlet code path handling personal-data fields, if any. |
| SOX | Light | Rarely touches financial-reporting directly; applicable only if a Sling-layer integration bundle feeds financial data downstream. | Integration-bundle data-flow documentation, if financial-reporting-adjacent. |
| ISO 27001 | Medium | Technical controls (OSGi service ACLs, connector credential management) are code-observable; the rest of Annex A is organizational. | OSGi config audit trail, connector-credential rotation records. |

## Shared-responsibility notes for Sling

Sling is not typically deployed as a standalone managed SaaS in this
suite's context — it ships as the foundation layer of AEMaaCS/AMS, so
its shared-responsibility boundary mirrors AEM's: Adobe manages the
runtime and patching cadence for the OSGi container itself; the
customer owns every bundle, servlet, and OSGi service configuration
deployed into it. There is no separate Sling-specific certification
story distinct from the AEM platform it runs inside <!-- verify:
confirm whether any Sling-specific compliance documentation exists
independent of the AEMaaCS platform documentation before asserting
otherwise -->.

## Stack-specific evidence sources

- OSGi configuration repository (`config.d`, Sling Feature Model config) — what's configured, version-controlled.
- Connector-credential store and rotation records (LDAP/SMTP/external-system connectors commonly registered as OSGi services).
- Sling servlet-registration manifest — which resource types/paths are bound to which servlets (attack-surface inventory).
- Bundle deployment history via Cloud Manager or the AMS deployment pipeline.
- JMX/Felix Web Console access logs, where enabled — a common overlooked exposure point for OSGi runtime introspection.

## Stack-specific common gaps

- OSGi service credentials (connector passwords, API keys) stored in plaintext config rather than a secrets vault (CWE-798).
- Custom Sling servlets registered without an authentication/authorization check (`selectors`/`resourceTypes` bound broadly) (CWE-306/CWE-862 / OWASP A01).
- Missing input validation on servlet parameters feeding downstream connector calls (CWE-20).
- Verbose Sling default error-handler output exposing internal resource paths (CWE-209).
- OSGi service ACLs granting broader repository access than the connector's actual integration scope needs (CWE-269 / CIS Control 6).
- No audit logging on OSGi service configuration changes (CIS Control 8).
- Felix Web Console or JMX endpoints left reachable without authentication in non-local environments (CWE-284 / CIS Control 4).
- Connector retry/backoff logic that silently swallows and logs a full failed-request payload (including any personal data in it) at INFO level (CWE-532).

## Stack-specific compliance quick-wins

- Move connector credentials out of OSGi config files and into a secrets manager referenced at runtime — closes CWE-798 findings across every registered connector in one change.
- Add explicit `authType`/resource-based ACL checks to every custom servlet — closes CWE-306/862 findings in a single review pass.
- Turn on OSGi configuration-change audit logging in Cloud Manager/AMS — closes a CIS Control 8 gap with a platform setting, no code change required.
- Restrict Felix Web Console/JMX access to author-tier internal networks only — closes a CWE-284 gap with a config change, not a code fix.

## Worked scenario for Sling

A team has built a custom Sling connector bundle that syncs customer
loyalty-program data from AEM into an external CRM via a scheduled OSGi
service, plus a handful of custom servlets exposing internal lookup
APIs used by front-end components.

Likely-applicable frameworks: CWE/OWASP (medium — the custom servlets
are the main surface), GDPR (depends — heavy once it's confirmed the
loyalty-sync connector moves customer PII, which it does here, so this
resolves to heavy for this specific project even though the stack's
baseline is "depends"), CIS/ISO 27001 (medium), PCI/HIPAA/SOX (none,
no signal present).

A first compliance report run would likely surface: the CRM-connector
credential stored in plaintext OSGi config (CWE-798, CRITICAL — and
also a GDPR Art. 32 gap given it's PII in transit to a third party), a
custom lookup servlet reachable without an ACL check (CWE-862, HIGH),
and a GDPR-flagged pure-gap row asking whether a Data Processing
Agreement exists with the CRM vendor — not code-observable, routed to
human review.

Of 9 merged findings scoped to the connector and its servlets, a
representative split is: 5 controls covered (the servlets that already
have correct ACL checks), 3 gaps (the two CRITICAL/HIGH findings above
plus a missing audit-log entry on the OSGi config change that
introduced the connector), and 1 GDPR row marked
`N/A pending confirmation`. Because Sling findings are often a small
slice of a larger AEM-hosted project, the compliance report scoped to
Sling alone is most useful when a team wants to isolate the
integration/connector layer's posture from the content-authoring
layer's — for example before a third-party security review of "just
the CRM sync," without pulling in unrelated AEM content findings.

## Cross-references

See `resources/framework-mappings/cwe.md` and `resources/framework-mappings/owasp.md`
(medium), `resources/framework-mappings/gdpr.md` (depends — confirm
per-project before treating as heavy or none), `resources/framework-mappings/cis.md`
and `resources/framework-mappings/iso27001.md` (medium).

Use this guide alongside `resources/framework-mappings/<framework>.md` when
generating a control-mapping report scoped to Sling.
