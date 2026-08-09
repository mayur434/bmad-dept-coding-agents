# Framework mapping guide — HIPAA

## What HIPAA requires

The **Health Insurance Portability and Accountability Act (HIPAA)**,
via its implementing regulations (the Privacy Rule, the Security Rule,
and the Breach Notification Rule at 45 CFR Parts 160/162/164), governs
how **covered entities** (health plans, healthcare clearinghouses,
most healthcare providers) and their **business associates** (any
vendor handling Protected Health Information — PHI — on a covered
entity's behalf) must protect individually identifiable health
information.

**This framework is opt-in only in this agent — never auto-inferred.**
Whether a given project is a covered entity, a business associate, or
simply has no PHI in scope is a legal/business determination that no
code scanner can make. A codebase can process patient data without a
single obviously-named "patient" field, and conversely a codebase full
of health-sounding field names might process zero real PHI (e.g. a
wellness-content marketing site with no patient records). **Always
confirm PHI-handling status with the user explicitly before running
this framework's mapper against a project** — see the parent
`SKILL.md` § Constraints / non-goals for the exact confirmation prompt.

## Control taxonomy

HIPAA's implementing regulations split into three rules; this agent's
mapping focuses primarily on the **Security Rule**, since it's the
rule with the most code-observable requirements. The Security Rule
(45 CFR §164.308–§164.312) organizes safeguards into three categories:

| Category | 45 CFR § | Scope | Code-observable? |
|---|---|---|---|
| Administrative Safeguards | §164.308 | Risk analysis, workforce training, access management policy, contingency planning | Mostly no — policy/process |
| Physical Safeguards | §164.310 | Facility access, workstation use, device/media controls | No — physical |
| Technical Safeguards | §164.312 | Access control, audit controls, integrity, person/entity authentication, transmission security | **Yes — the code-observable subset** |

Technical Safeguards sub-requirements (§164.312):

| ID | Requirement |
|---|---|
| §164.312(a)(1) | Access Control (unique user ID, emergency access, automatic logoff, encryption/decryption) |
| §164.312(b) | Audit Controls |
| §164.312(c)(1) | Integrity (mechanisms to authenticate ePHI hasn't been improperly altered/destroyed) |
| §164.312(d) | Person or Entity Authentication |
| §164.312(e)(1) | Transmission Security (integrity controls, encryption) |

Plus the **Breach Notification Rule** (45 CFR §164.400–414), which
governs what happens if PHI is exposed — largely a process/legal
requirement, not code-observable, but a compliance-mapping run should
still flag when a finding represents a *potential breach vector* worth
the org's breach-notification-readiness attention.
<!-- verify: confirm current 45 CFR citations before quoting verbatim
     in an externally-facing artifact — HIPAA regulations are amended
     periodically (e.g. HITECH Act updates). -->

## Ruleid-to-control mapping patterns

| ruleId pattern | Maps to | Rationale |
|---|---|---|
| `COMM-SEC-003` (Missing ACL check) | §164.312(a)(1) Access Control | Direct match — unique-user access enforcement gap. |
| `AEMCS-SEC-004` (Insufficient service-user permissions) | §164.312(a)(1) Access Control | Over-privileged access to content that may include PHI-adjacent fields. |
| `SPRING-SEC-010` / `AEMCS-SEC-001` (Hardcoded credentials) | §164.312(d) Person or Entity Authentication | Weakens the authentication mechanism protecting ePHI access. |
| `APPB-SEC-003` (Logging sensitive data) | §164.312(b) Audit Controls — **inverted**: evidence of a violation, not coverage | Logging PHI fields in plaintext defeats the purpose of audit controls and creates an unprotected PHI copy in log storage. |
| `SHAFT-SEC-004` (TLS validation disabled) | §164.312(e)(1) Transmission Security | Direct match — encryption-in-transit requirement. |
| `SHAFT-SEC-005`/`006` (weak crypto/CSPRNG) | §164.312(c)(1) Integrity + §164.312(e)(1) | Weak cryptographic primitives undermine both integrity-verification and transmission-security mechanisms. |
| `COMM-SEC-002` / `SPRING-SEC-011` (SQL injection) | §164.312(c)(1) Integrity | Injection risk threatens unauthorized alteration of stored ePHI. |
| `AEMCS-SEC-003` / `EDS-SEC-002` (XSS) | §164.312(a)(1) + §164.312(c)(1) | XSS can be used to exfiltrate session/access tokens (access control) or tamper with displayed ePHI (integrity). |
| `SPRING-SEC-014` (unsafe deserialization) | §164.312(c)(1) Integrity | Direct match — untrusted deserialization threatens data integrity. |

## Per-stack applicability for HIPAA

Applicability is **project-specific, not stack-specific** — HIPAA
scope follows the *data*, not the technology. Once PHI-handling is
confirmed for a project, applicability across stacks looks like:

| Stack | Applicability (once PHI confirmed) | Why |
|---|---|---|
| AEM (AEMaaCS/AMS) | Heavy if patient-facing forms/DAM assets carry PHI | Forms Core Components, DAM asset metadata, CF models are common PHI-adjacent surfaces in healthcare AEM implementations. |
| Commerce PaaS/SaaS | Medium — heavy only if the storefront sells health-adjacent products with clinical data capture | Most commerce PII is not PHI unless clinically contextualized. |
| Spring Boot | Heavy if the service is a clinical/patient-data API | Common for healthcare backend microservices. |
| App Builder | Medium — depends on whether the custom action touches PHI in its payload | |
| Sling / Shaft | Medium — heavy if a connector integrates with an EHR/clinical system | |
| EDS | Light — heavy only if the edge layer renders patient-portal content directly | |
| EDS + Commerce | Light-Medium | Inherits Commerce SaaS's determination. |

**Do not populate this table's applicability level for a real project
without the human PHI-handling confirmation described above** — this
table describes *where PHI tends to live when it exists*, not
*whether it exists here*.

## Evidence requirements for HIPAA

- **§164.312(a)(1) Access Control:** unique-user-ID enforcement,
  automatic-logoff/session-timeout configuration, encryption of ePHI
  at rest.
- **§164.312(b) Audit Controls:** logging of ePHI access events,
  without ePHI itself leaking into the log stream.
- **§164.312(c)(1) Integrity:** absence of injection/tampering
  weakness classes on ePHI-touching data paths; checksums/hash
  verification where applicable.
- **§164.312(d) Authentication:** strong authentication mechanism (no
  hardcoded/shared credentials) protecting ePHI access.
- **§164.312(e)(1) Transmission Security:** TLS enforced on all
  ePHI-carrying transmission paths; no disabled certificate validation.
- **Administrative/Physical Safeguards:** essentially all
  non-code-observable — a completed **HIPAA Security Risk Assessment**
  document is the actual evidence source; this agent can never produce
  or substitute for one.

## Common gaps DCA CAN auto-detect

- Missing access-control/authorization checks on data-access endpoints (§164.312(a)(1)).
- Hardcoded credentials protecting data-access paths (§164.312(d)).
- Disabled TLS/certificate validation on data-in-transit paths (§164.312(e)(1)).
- Injection weaknesses on data-mutation paths (§164.312(c)(1)).
- Sensitive fields (potentially PHI) written to logs in plaintext (§164.312(b), inverted signal).
- Weak/predictable cryptographic randomness on tokens/session identifiers (§164.312(c)(1)/(e)(1)).

## Common gaps DCA CANNOT auto-detect (human review required)

- Whether the project handles PHI at all — the foundational scoping question (see above).
- Whether a formal HIPAA Security Risk Assessment has been completed and is current (§164.308(a)(1)).
- Workforce training completion and sanction-policy enforcement (§164.308(a)(5)).
- Physical facility access controls, workstation-use policy adherence (§164.310).
- Business Associate Agreement (BAA) existence with every third-party vendor touching PHI (§164.308(b)).
- Breach-notification-plan existence and whether it has been tested (§164.400–414).
- Contingency-plan (backup, disaster-recovery, emergency-mode operation) existence and test cadence (§164.308(a)(7)).
- Whether automatic-logoff / session-timeout is actually *configured and enforced* at the infrastructure/IdP layer, vs. merely present as a code capability.

## Worked mapping example for HIPAA

*(Assumes PHI-handling has been explicitly confirmed by the user for
this project — a Spring Boot clinical-data API.)*

```
F1: SPRING-SEC-011 "String-built JPA query in PatientRecordRepository" — CRITICAL
F2: SPRING-SEC-010 "Hardcoded service-account token in application.yml" — CRITICAL
F3: APPB-SEC-003 "Full patient object logged at INFO level" — HIGH
```

Resulting control-mapping rows:

| Control | Status | Mapped finding(s) | Remediation note |
|---|---|---|---|
| §164.312(c)(1) Integrity | gap | F1 | Parameterize the JPA query; injection risk threatens unauthorized ePHI alteration. |
| §164.312(d) Authentication | gap | F2 | Rotate the exposed token; move to a secrets manager with per-service scoped credentials. |
| §164.312(b) Audit Controls | gap | F3 | Redact PHI fields from the log statement; log a reference ID, not the payload. |
| §164.308(a)(1) Risk Assessment | N/A (not code-observable) | — | Confirm a current Security Risk Assessment exists; owner: Privacy/Security Officer. |

## Attestation considerations for HIPAA

The typical signer for a HIPAA-related attestation is the
organization's designated **Privacy Officer** and/or **Security
Officer** (HIPAA requires covered entities/business associates to
designate both — often, but not always, the same person at smaller
organizations). This agent's `ATTESTATION.md` output should always
name the signer's role explicitly as Privacy/Security Officer (not
"CISO" generically, since HIPAA's regulatory language specifically
contemplates these designated roles) and should never be presented as
satisfying the organization's formal Security Risk Assessment
obligation under §164.308(a)(1) — it is, at most, one input to that
assessment.

---

Generate the full control-mapping report using
`templates/control-mapping.md` as the master, populating placeholders
with the framework-specific content from the guide above.
Cross-reference other frameworks' guides for overlapping controls
(e.g. HIPAA §164.312(e)(1) overlaps with PCI Req 4 and GDPR Art. 32 —
all three require encryption of sensitive data in transit).
