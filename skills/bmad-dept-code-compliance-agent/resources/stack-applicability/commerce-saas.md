# Compliance applicability guide — Commerce SaaS (Adobe Commerce as a Cloud Service)

## Purpose framing

Commerce SaaS is Adobe's fully-managed Commerce offering — Adobe hosts
and operates the platform, and the customer integrates against it via
Payment Services, Drop-in components, and APIs rather than owning
first-party checkout controller code. Payment and customer-PII
applicability stay just as heavy as Commerce PaaS, but the **locus of
responsibility shifts**: much of what a PaaS merchant would fix in their
own codebase is instead an Adobe-managed control here, and the
customer's compliance surface narrows to the integration layer —
Drop-in configuration, storefront token handling, and webhook
verification.

## Framework applicability matrix for Commerce SaaS

| Framework | Applicability | Primary trigger | Typical evidence source |
|---|---|---|---|
| CWE | Heavy | Storefront JS integration and webhook-signature verification are customer-owned code with real weakness surface. | `audit`/`sonar-scan` findings on storefront/integration code. |
| OWASP | Heavy | Storefront and Drop-in checkout components run in the customer's front-end surface — Injection, Broken Access Control (via API tokens) still apply. | `sonar-scan` findings on storefront/integration bundles. |
| CIS | Medium | Many infra-level safeguards (patching, network hardening) shift to Adobe's managed platform; customer-side CIS surface narrows to integration-code hygiene and credential management. | Storefront deployment config, API-key rotation records. |
| PCI-DSS | Heavy | Payment Services + Drop-in checkout is Adobe-hosted, but the storefront's handling of tokens/redirects is still in-scope — commonly SAQ A or A-EP depending on integration method. | `audit`/`sonar-scan` findings on the Drop-in integration surface; SAQ type confirmed by the merchant. |
| HIPAA | None (typically) | Same rationale as Commerce PaaS — retail platform, applicable only if a health-product merchant confirms PHI is in scope. | Human-confirmed applicability only. |
| GDPR | Heavy | Customer PII and order history still flow through customer-facing storefront code even though the backend is Adobe-managed. | Storefront data-handling code, consent-integration config. |
| SOX | Medium | Same as PaaS — applicable when Commerce SaaS is the system of record feeding recognized-revenue reporting. | Order-data export/reporting integration code. |
| ISO 27001 | Medium | Adobe's managed infrastructure carries its own certification story <!-- verify -->; customer-side ISO 27001 surface narrows to the integration-code technical controls it still owns. | Storefront integration deployment audit trail. |

## Shared-responsibility notes for Commerce SaaS

This is the stack where the shared-responsibility line matters most.
Adobe operates and secures the Commerce SaaS platform itself — patching,
network segmentation, database encryption-at-rest, and (per Adobe's own
published trust documentation) a SOC2/ISO 27001-aligned posture for the
managed platform <!-- verify: confirm the current, specific
certification scope for Commerce SaaS / Payment Services on Adobe's
Trust Center before citing in an externally-facing artifact —
certification scope and status can change. -->. That coverage stops at
the platform boundary. The customer remains responsible for: how the
storefront handles payment tokens and redirects, whether Drop-in
components are kept at a patched version, webhook-signature
verification on inbound events, and all GDPR-relevant handling of PII
in the storefront's own code (search, personalization, marketing
integrations). **"Adobe SaaS = fully compliant" is the most common
misconception on this stack** — Adobe's certification covers Adobe's
infrastructure, not the customer's integration code or configuration
choices layered on top of it.

## Stack-specific evidence sources

- Storefront/Drop-in integration repository — git history as the primary code-level audit trail.
- Webhook-signature-verification code path and its test coverage.
- API credential/token rotation records (customer-managed, not Adobe-managed).
- Adobe Commerce SaaS Trust Center / compliance documentation for the platform layer <!-- verify: link and cite the current document, not a cached summary -->.
- Payment Services integration-method documentation (determines SAQ A vs A-EP scope).
- Storefront dependency manifest (`package.json`/lockfile) diffed against the Drop-in component's published release notes.

## Stack-specific common gaps

- Drop-in checkout bundle pinned to an outdated, vulnerable version (`COMM-DEP-*`, CWE — stale dependency / PCI Req 6.3).
- Unverified webhook signatures on inbound Commerce events (`CSAAS-SEC-003`, CWE — improper verification / PCI Req 6.2 + Req 4).
- Payment tokens or session identifiers logged client-side (CWE-532 / PCI Req 3.4).
- Missing consent gate before storefront marketing/analytics scripts load (GDPR).
- Customer PII (order/address data) rendered into client-side JS state without redaction on shared/cached pages (GDPR Art. 32).
- No clear internal owner for "which controls are Adobe's vs. ours" — a documentation gap, not a code gap, but a recurring finding in first-time compliance runs on this stack.
- Storefront API tokens issued with broader scope than the integration needs (CWE-269 / OWASP A01) — a common over-provisioning mistake when wiring up a new headless integration quickly.
- No monitoring/alerting on Payment Services API error rates that could mask a silent payment-processing failure (CIS Control 8 — logging/monitoring gap, not a direct PCI requirement but adjacent to Req 10's spirit).

## Stack-specific compliance quick-wins

- Pin and actively track the Drop-in checkout bundle version — closes stale-dependency PCI/CWE gaps with a version bump, not a rewrite.
- Add webhook-signature verification with a documented secret-rotation cadence — closes a PCI Req 6.2/Req 4 gap in a single code path.
- Write down the shared-responsibility boundary explicitly in the project's `.bmad/conventions.yaml` or compliance cover letter — turns a recurring confusion into a one-time documented fact.
- Add a consent gate ahead of marketing-script injection — closes a GDPR gap that's otherwise easy to miss on a "backend is managed" stack.
- Scope storefront API tokens to the minimum set of operations the integration actually calls — closes an over-provisioning gap with a token-policy change, no redeploy required.

## Worked scenario for Commerce SaaS

A DTC apparel brand runs Adobe Commerce SaaS with Payment Services and
the standard Drop-in checkout, integrated into a custom Next.js
storefront. The team assumed the payment side was "Adobe's problem"
and had done no PCI-specific review of their own integration code.

Likely-applicable frameworks: PCI-DSS (heavy — the Drop-in integration
and webhook handling are in the merchant's own repository even though
Payment Services is Adobe-hosted; SAQ A-EP confirmed given the
JS-based Drop-in embed), GDPR (heavy), SOX (medium — order data feeds
a finance reporting pipeline), CWE/OWASP (heavy on the storefront
integration code), CIS/ISO 27001 (medium, narrowed by Adobe's managed
platform), HIPAA (none).

A first compliance report run would likely surface: an outdated
Drop-in bundle version with a known CVE (PCI Req 6.3, HIGH), no
signature verification on the order-webhook handler (`CSAAS-SEC-003`,
PCI Req 6.2/4, CRITICAL), and — surfaced in the cover letter, not the
control-mapping — an explicit call-out that the team should document
the Adobe/customer responsibility split before their next SAQ renewal.

Across 16 merged findings, a typical breakdown looks like: 10 controls
covered (most of the CWE/OWASP baseline, since the storefront was
otherwise well-built), 4 gaps (the two above, an over-scoped API token,
and a missing consent gate on the marketing pixel), and 2 controls
marked N/A for this stack specifically — PCI Req 1 and Req 9, both
fully inside Adobe's managed-platform boundary and appropriately
excluded from the customer-facing control-mapping rather than listed
as a gap the team has no ability to remediate.

## Cross-references

See `resources/framework-mappings/pci.md` (heavy — note its SAQ-type
scoping guidance applies here too, just for a narrower in-scope
surface), `resources/framework-mappings/gdpr.md` (heavy),
`resources/framework-mappings/cwe.md` and `resources/framework-mappings/owasp.md`
(heavy), `resources/framework-mappings/iso27001.md` (medium — see its
notes on Annex A controls that are infra/organizational, not
code-observable).

Use this guide alongside `resources/framework-mappings/<framework>.md` when
generating a control-mapping report scoped to Commerce SaaS.
