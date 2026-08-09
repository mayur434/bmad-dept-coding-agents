# Framework mapping guide — GDPR

## What GDPR requires

The **General Data Protection Regulation (GDPR)** is EU law governing
how organizations collect, process, store, and transfer the personal
data of individuals in the European Union — regardless of where the
processing organization itself is based. It applies to any project
that handles EU residents' personal data, which in practice means most
commerce, content, and analytics systems with any EU user base at all.
Unlike HIPAA/PCI/SOX, GDPR applicability is a **weaker, more commonly
true default** — this agent does not require the same explicit opt-in
confirmation before running the GDPR mapper, though the AI agent
should still note the assumption ("mapping against GDPR — confirm this
project has no EU user data if that's wrong") rather than silently
assuming it applies to every project unconditionally.

GDPR is organized around **principles** (Article 5) and **individual
rights** (Articles 12–23), backed by **accountability obligations**
(Articles 24–43) on the data controller/processor. Compliance is
enforced by national Data Protection Authorities (DPAs), with fines up
to the greater of €20M or 4% of global annual turnover for the most
serious violations.

## Control taxonomy

Key articles most relevant to code-level mapping:

| Article | Subject |
|---|---|
| Art. 5 | Principles (lawfulness, purpose limitation, data minimization, accuracy, storage limitation, integrity/confidentiality, accountability) |
| Art. 6 | Lawfulness of processing |
| Art. 7 | Conditions for consent |
| Art. 9 | Processing of special category data |
| Art. 12–15 | Transparency + right of access |
| Art. 16 | Right to rectification |
| Art. 17 | Right to erasure ("right to be forgotten") |
| Art. 20 | Right to data portability |
| Art. 21 | Right to object |
| Art. 25 | Data protection by design and by default |
| Art. 30 | Records of processing activities |
| Art. 32 | Security of processing |
| Art. 33–34 | Personal data breach notification |
| Art. 35 | Data Protection Impact Assessment (DPIA) |
| Art. 37 | Designation of a Data Protection Officer (DPO) |
| Art. 44–49 | Transfers of personal data to third countries |

<!-- verify: confirm article numbers/wording against the current
     consolidated GDPR text before citing verbatim in an externally-
     facing artifact. -->

## Ruleid-to-control mapping patterns

| ruleId pattern | Maps to | Rationale |
|---|---|---|
| `COMM-SEC-002` / `SPRING-SEC-011` (SQL injection) | Art. 32 (Security of processing) | Injection risk threatens confidentiality/integrity of stored personal data. |
| `AEMCS-SEC-003` / `EDS-SEC-002` (XSS) | Art. 32 | XSS can exfiltrate personal-data-bearing session state or displayed personal data. |
| `SPRING-SEC-010` / `AEMCS-SEC-001` (Hardcoded credentials) | Art. 32 | Direct match — "appropriate technical measures" including access control. |
| `SHAFT-SEC-004` (TLS validation disabled) | Art. 32 | Direct match — encryption of personal data in transit. |
| `APPB-SEC-003` (Logging sensitive data) | Art. 5(1)(f) Integrity/confidentiality + Art. 32 — **inverted**: evidence of a violation | Logging personal data in plaintext is itself an unminimized, unprotected copy — also complicates Art. 17 erasure (now the data exists in two places). |
| `COMM-SEC-003` (Missing ACL check) | Art. 32 + Art. 25 (data protection by design) | Access-control gap undermines both the security-of-processing and privacy-by-design obligations. |
| `CSAAS-SEC-003` (unverified webhook signature) | Art. 32 | Unverified inbound data channel threatens integrity of processed personal data. |
| Analytics/tracking-pixel code with no consent gate (EDS/analytics idiom, not a named rule yet) | Art. 6 + Art. 7 (lawfulness + consent) | Flag as a `<!-- verify: needs a dedicated rule-pack entry -->` gap type — see § Common gaps DCA CANNOT auto-detect for the consent-verification limitation. |
| Fields clearly named/typed as PII with no apparent retention/deletion logic | Art. 17 (right to erasure) + Art. 5(1)(e) (storage limitation) | A heuristic-confidence gap, not a rule-pack finding — flag for human review, don't assert as `gap` with high confidence. |

## Per-stack applicability for GDPR

| Stack | Applicability | Why |
|---|---|---|
| AEM (AEMaaCS/AMS) | **Heavy** | Forms Core Components capture personal data directly; DAM often stores personal-data-bearing assets (ID scans, headshots with metadata); Content Fragments may model customer/lead data. |
| Commerce PaaS/SaaS | **Heavy** | Customer accounts, order history, addresses, payment-adjacent PII are core commerce data. |
| Spring Boot | **Medium-Heavy** | Depends on the service — a customer-data or CRM-adjacent API is heavy; an internal tooling API may be light. |
| App Builder | **Medium** | Depends on what the custom action's payload carries. |
| Sling / Shaft | **Medium** | Heavy if a connector integrates with a CRM/marketing-data system. |
| EDS | **Medium** | Analytics/RUM collection and consent-banner implementation are the primary GDPR-relevant surface even on an otherwise static site. |
| EDS + Commerce | **Heavy** | Inherits Commerce SaaS's applicability plus EDS's analytics/consent surface. |

## Evidence requirements for GDPR

- **Art. 32 (Security of processing):** absence of the classic
  injection/access-control/crypto weakness classes on personal-data
  paths — largely the same evidence bar as CWE/OWASP mapped to
  personal-data-touching code specifically.
- **Art. 30 (Records of processing):** a maintained Record of
  Processing Activities (RoPA) document — not code-observable; cite
  the document's existence and last-review date as evidence, sourced
  from the human/legal team.
- **Art. 6/7 (lawfulness/consent):** evidence of a consent-capture
  mechanism (banner, checkbox with unticked default) in the actual
  rendered flow — partially code-observable (is there a consent
  component in the codebase at all?) but NOT fully verifiable by code
  alone (is consent actually required before the tracking script
  fires? that's a runtime/DOM-order fact a static scan struggles with).
- **Art. 17 (erasure) / Art. 20 (portability):** evidence of an
  actual deletion/export code path — presence of a "delete my account"
  or "export my data" endpoint is a positive code signal; its absence
  is a documentable gap.
- **Art. 33/34 (breach notification):** a documented, tested breach-
  notification procedure — not code-observable.
- **Art. 44–49 (international transfers):** evidence of Standard
  Contractual Clauses (SCCs) or an adequacy-decision basis for any
  cross-border data flow — a legal/contractual fact, not a code fact,
  though the *existence* of a cross-border data flow (e.g. a
  non-EU-hosted analytics endpoint) can sometimes be code-observable.

## Common gaps DCA CAN auto-detect

- Injection/access-control/crypto weaknesses on personal-data-touching code paths (Art. 32).
- Hardcoded credentials protecting personal-data access (Art. 32).
- Personal data logged in plaintext (Art. 5(1)(f), inverted signal).
- Absence of a deletion/export endpoint pattern where an account/profile model clearly exists (Art. 17/20 — heuristic, medium confidence).
- Analytics/tracking code present with no adjacent consent-gate pattern (Art. 6/7 — heuristic, medium confidence; needs human confirmation of actual runtime behavior).
- Unverified inbound data-integration webhooks touching personal data (Art. 32).

## Common gaps DCA CANNOT auto-detect (human review required)

- Whether a valid lawful basis (Art. 6) is actually documented for each processing purpose.
- Whether a Data Processing Agreement (DPA) exists with every third-party processor touching personal data.
- Whether consent, once captured, is honored end-to-end (e.g. a marketing system that ignores a stored opt-out flag) — a data-flow/integration fact beyond static code visibility.
- Retention-policy documentation and whether automated deletion jobs actually run on schedule (a runtime/ops fact, not a code-presence fact).
- Whether a DPIA (Art. 35) was performed for high-risk processing activities.
- International-transfer legal basis (SCCs, adequacy decisions) for any cross-border data flow identified in code.
- Data-subject-request (DSAR) fulfillment process timeliness and completeness — a process fact.
- Whether the designated DPO (Art. 37, where required) has actually reviewed the processing activities in scope.

## Worked mapping example for GDPR

Given findings from a merged `audit` + `sonar-scan` run against an AEM
forms + Commerce SaaS project:

```
F1: COMM-SEC-002 "Raw SQL in CustomerAddressController" — CRITICAL
F2: APPB-SEC-003 "Full customer profile object logged at INFO" — HIGH
F3: (heuristic, medium confidence) "No delete-account endpoint found alongside CustomerAccountController"
```

Resulting control-mapping rows:

| Article | Status | Mapped finding(s) | Remediation note |
|---|---|---|---|
| Art. 32 (Security of processing) | gap | F1 | Parameter-bind the query; injection threatens confidentiality of stored customer addresses. |
| Art. 5(1)(f) / Art. 32 | gap | F2 | Redact PII fields from the log statement. |
| Art. 17 (Right to erasure) | gap (heuristic — confirm with human) | F3 | Confirm whether deletion is handled by a separate/manual process before treating as a real gap; if genuinely absent, scope an account-deletion endpoint. |
| Art. 30 (Records of processing) | N/A (not code-observable) | — | Confirm a current RoPA exists; owner: DPO/Legal. |

## Attestation considerations for GDPR

The typical signer for a GDPR-related attestation is the organization's
**Data Protection Officer (DPO)** where one is designated (mandatory
under Art. 37 for public authorities, large-scale systematic
monitoring, or large-scale special-category processing — otherwise
optional but common practice), or **Legal/Privacy Counsel** where no
DPO is designated. This agent's `ATTESTATION.md` output should never
be presented as satisfying the organization's Art. 30 RoPA obligation
or as a DPIA — it is, at most, one technical input a DPO might
reference while conducting either.

---

Generate the full control-mapping report using
`templates/control-mapping.md` as the master, populating placeholders
with the framework-specific content from the guide above.
Cross-reference other frameworks' guides for overlapping controls
(e.g. GDPR Art. 32 overlaps with PCI Req 3/4, HIPAA §164.312(e)(1), and
CIS Control 3 — all four require protecting sensitive data at rest and
in transit).
