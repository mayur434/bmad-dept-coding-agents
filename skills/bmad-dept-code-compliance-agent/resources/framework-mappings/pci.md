# Framework mapping guide — PCI-DSS

## What PCI-DSS requires

The **Payment Card Industry Data Security Standard (PCI-DSS)** is a
contractual requirement — not a law — imposed by the payment-card
brands (Visa, Mastercard, Amex, Discover, JCB) on any entity that
stores, processes, or transmits cardholder data. Compliance is
assessed via a **Self-Assessment Questionnaire (SAQ)** for lower-volume
merchants or a formal **Report on Compliance (ROC)** conducted by a
**Qualified Security Assessor (QSA)** for higher-volume merchants and
service providers.

Which of the 12 requirements are actually **in scope** depends heavily
on the applicable **SAQ type** — a merchant fully outsourcing payment
processing to a hosted page (SAQ A) has a much smaller in-scope surface
than one handling card data directly in its own application (SAQ D).
**This agent cannot determine your SAQ type from code alone** — that's
a business/contractual fact set by your acquiring bank and payment
processor relationship. Treat every PCI control-mapping run as scoped
to "requirements this project's SAQ type makes applicable" and confirm
that scoping with a human before treating any requirement as a gap
rather than N/A.

Current published version: **PCI-DSS v4.0** (v3.2.1 requirements are
formally retired). <!-- verify: confirm v4.0 is current before citing
in an externally-facing artifact — PCI SSC issues periodic revisions. -->

## Control taxonomy

The 12 top-level PCI-DSS v4.0 requirements:

| Req | Name |
|---|---|
| 1 | Install and maintain network security controls |
| 2 | Apply secure configurations to all system components |
| 3 | Protect stored account data |
| 4 | Protect cardholder data with strong cryptography during transmission over open, public networks |
| 5 | Protect all systems and networks from malicious software |
| 6 | Develop and maintain secure systems and software |
| 7 | Restrict access to system components and cardholder data by business need to know |
| 8 | Identify users and authenticate access to system components |
| 9 | Restrict physical access to cardholder data |
| 10 | Log and monitor all access to system components and cardholder data |
| 11 | Test security of systems and networks regularly |
| 12 | Support information security with organizational policies and programs |

<!-- verify: exact v4.0 requirement wording against the current
     published PCI-DSS standard before citing verbatim externally. -->

## Ruleid-to-control mapping patterns

| ruleId pattern | Maps to | Rationale |
|---|---|---|
| `COMM-SEC-002` (Raw SQL) | Req 6.2.4 (address common coding vulnerabilities) | Injection is explicitly named in Req 6.2.4 guidance. |
| `COMM-SEC-004` / `AEMCS-SEC-003` (XSS) | Req 6.2.4 | Same — XSS is one of the "common coding vulnerabilities." |
| `COMM-SEC-001` / `SPRING-SEC-004` (CSRF) | Req 6.2.4 | Same. |
| `COMM-SEC-003` (Missing ACL) | Req 7 (business need-to-know access) | Direct match — access restriction to cardholder-data-adjacent admin functions. |
| `AEMCS-SEC-004` (Insufficient service-user permissions) | Req 7 | Over-privileged service account touching payment-adjacent content. |
| `SPRING-SEC-010` / `AEMCS-SEC-001` (Hardcoded secrets) | Req 3.5 (protect cryptographic keys) / Req 8.3 (strong authentication) | If the secret is a key protecting stored account data → Req 3; if it's an auth credential → Req 8. |
| `SHAFT-SEC-004` (TLS validation disabled) | Req 4 (protect data in transit) | Direct match. |
| `SHAFT-SEC-005`/`006` (weak crypto / CSPRNG) | Req 3.6 / Req 3.7 (cryptographic key management) | Weak randomness undermines key-generation strength requirements. |
| `CSAAS-SEC-003` (unverified webhook signature) | Req 6.2 (secure software development) + Req 4 | Unverified inbound payment-adjacent webhook is both a secure-coding and data-integrity-in-transit gap. |
| `COMM-DEP-*` (stale dependency) | Req 6.3 (identify and address vulnerabilities) | Direct match — vulnerability management via patching. |
| `APPB-SEC-003` (Logging sensitive data) | Req 10 (log and monitor access) — **inverted**: this is evidence of a Req 3/Req 10 VIOLATION, not coverage | Logging cardholder-data-adjacent fields in plaintext is itself a Req 3.4 storage-protection failure, layered on top of a Req 10 logging-hygiene failure. |
| `SPRING-SEC-003`/`007` (Actuator exposure) | Req 2 (secure configuration) | Default/unhardened configuration left exposed. |

## Per-stack applicability for PCI-DSS

| Stack | Applicability | Why |
|---|---|---|
| Commerce PaaS (Magento 2) | **Heavy** | Payment-flow code lives directly in the codebase — checkout controllers, payment-method modules, admin order management. Most likely SAQ D scope unless fully tokenized/hosted. |
| Commerce SaaS | **Heavy** | Payment Services + Drop-in checkout components — even with Adobe-hosted payment processing, the storefront integration code is in-scope for how it handles tokens/redirects (commonly SAQ A or A-EP depending on integration method). |
| AEM (AEMaaCS/AMS) | **Light** | Content/experience layer rarely touches cardholder data directly — applicable only if a DAM asset store or CF model was found to hold card-data-adjacent content (rare; flag for human review if found, don't assume). |
| Spring Boot | **Medium-Heavy** | If the service processes payments directly (a payment-gateway integration microservice) → heavy; if it's an unrelated backend service → light. Confirm with the human before scoping. |
| App Builder | **Light** | Typically orchestration/extensibility logic; heavy only if a custom action directly handles card data (uncommon — most Adobe payment integrations route through Payment Services, not App Builder actions). |
| Sling / Shaft | **Light** | Integration/connector layer; heavy only if a connector directly transmits/stores cardholder data. |
| EDS | **Light** | Static/edge-rendered storefront; heavy only for the specific drop-in/checkout bundle version pinned into the page (see EDS + Commerce). |
| EDS + Commerce | **Medium** | Drop-in checkout bundle surface inherits Commerce SaaS's applicability; the rest of the EDS surface stays light. |

## Evidence requirements for PCI-DSS

- **Req 1 (network segmentation):** network-diagram or firewall-rule
  evidence — not code-observable; cite the infra team's documentation.
- **Req 3/4 (encryption at rest/in transit):** confirmation that
  cardholder-data fields use approved encryption, TLS 1.2+ enforced,
  no card data logged in plaintext.
- **Req 6 (secure development):** absence of the classic injection/XSS
  weakness classes; evidence of a documented secure-SDLC process
  (code-review agent findings + this Compliance agent's own audit
  trail can corroborate the "systematic" part).
- **Req 7/8 (access control/authentication):** ACL checks present,
  least-privilege service accounts, MFA enforcement — MFA enforcement
  itself is typically NOT code-observable (an IdP/SSO configuration
  fact) and needs human confirmation.
- **Req 10 (logging):** security-relevant events logged without
  leaking cardholder data into the log stream.
- **Req 9, 11, 12:** almost entirely non-code evidence — physical
  security, penetration-test reports, policy documents. Mark N/A for
  code-mapping purposes with a pointer to the actual evidence owner.

## Common gaps DCA CAN auto-detect

- SQL injection / XSS / CSRF in payment-adjacent controllers (Req 6.2.4).
- Missing ACL checks on admin order/payment management (Req 7).
- Hardcoded credentials or keys near payment-handling code (Req 3.5/8.3).
- TLS validation disabled on outbound payment-gateway calls (Req 4).
- Weak/predictable randomness in token/session generation (Req 3.6/3.7).
- Unverified payment-adjacent webhook signatures (Req 6.2 + Req 4).
- Stale/vulnerable dependencies in payment-flow modules (Req 6.3).
- Sensitive (potentially cardholder-adjacent) data written to logs (Req 3.4/10).

## Common gaps DCA CANNOT auto-detect (human review required)

- Correct SAQ type / actual PCI scope boundary — this is a business/contractual determination, not a code fact.
- Network segmentation effectiveness (Req 1) — requires network architecture review, not code review.
- Physical access controls to card-data environments (Req 9).
- Whether MFA is actually enforced for all access to the cardholder data environment (Req 8.4) — an IdP/SSO configuration fact.
- Key-rotation policy existence and adherence over time (Req 3.6) — a process fact, code shows a snapshot only.
- Penetration-test and vulnerability-scan (ASV) cadence and remediation-verification (Req 11).
- Organizational security-policy documentation and annual review (Req 12).
- Whether a third-party payment processor's own PCI attestation (AOC) is current — a vendor-management fact, not a code fact.

## Worked mapping example for PCI-DSS

Given findings from a merged `audit` + `sonar-scan` run against a
Commerce PaaS checkout module:

```
F1: COMM-SEC-002 "Raw SQL in PaymentMethodController::index()" — CRITICAL
F2: SPRING-SEC-010 "Hardcoded payment-gateway API key in config.yml" — CRITICAL
F3: COMM-SEC-003 "Missing ACL check in Adminhtml/Order/View" — HIGH
```

Resulting control-mapping rows (assuming SAQ D scope, confirmed by the user):

| Req | Status | Mapped finding(s) | Remediation note |
|---|---|---|---|
| Req 6.2.4 (secure coding — injection) | gap | F1 | Parameter-bind the query; retest before marking covered. |
| Req 3.5 (protect cryptographic keys) | gap | F2 | Move API key to a secrets manager; rotate the exposed key immediately (Req 3.6.7 key-compromise procedure applies). |
| Req 7 (need-to-know access) | gap | F3 | Add ACL annotation restricting order-view to authorized admin roles. |
| Req 1 (network segmentation) | N/A | — | Not code-observable — requires network architecture review; owner: infra/security team. |
| Req 9 (physical access) | N/A | — | Not code-observable — requires facilities/data-center review. |

## Attestation considerations for PCI-DSS

The formal PCI attestation instrument is the **Attestation of
Compliance (AOC)**, signed following either a **Self-Assessment
Questionnaire (SAQ)** (self-signed, or a QSA/ISA-assisted SAQ) or a
full **Report on Compliance (ROC)** (QSA-signed). This agent's
`ATTESTATION.md` is **never** a substitute AOC — it's a working
document that feeds evidence INTO the human-led SAQ/ROC process.
Typical signer for this agent's draft: the internal **Security
Engineering Lead** or **PCI Program Manager**, explicitly NOT
presented as a QSA/ISA signature. The final AOC always requires either
a QSA/ISA (ROC or QSA-assisted SAQ) or an authorized company officer
(self-assessed SAQ) — never this agent's output alone.

---

Generate the full control-mapping report using
`templates/control-mapping.md` as the master, populating placeholders
with the framework-specific content from the guide above.
Cross-reference other frameworks' guides for overlapping controls
(e.g. PCI Req 6 overlaps with OWASP Top 10 almost category-for-category;
PCI Req 3/4 overlaps with GDPR Art. 32 and CIS Control 3).
