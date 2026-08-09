# Framework mapping guide — OWASP Top 10

## What OWASP requires

The **OWASP Top 10** is not a law or a certification — it's the
industry-consensus ranking of the ten most critical web-application
security risk *categories*, published by the Open Worldwide Application
Security Project and revised periodically from real-world vulnerability
and breach data. It doesn't mandate specific controls the way PCI-DSS
does; it names the risk categories and lets each organization decide
how to mitigate them. Most customer security questionnaires and many
internal AppSec programs use OWASP Top 10 coverage as their baseline
"have you thought about the big ones" checklist.

Unlike CWE, OWASP categories are **risk-shaped, not weakness-id-shaped**
— several distinct CWE IDs collapse into one OWASP category. That
makes an OWASP control-mapping row less granular but more
business-readable than a CWE row: "are we exposed to Injection risk"
reads better in an exec summary than a list of six CWE IDs.

The current published edition is **OWASP Top 10:2021**.
<!-- verify: confirm whether a newer edition (e.g. a 2025 refresh) has
     been officially released before citing edition year in an
     externally-facing artifact; as of this guide's authoring, 2021 is
     the last confirmed official release. -->

## Control taxonomy

| Category | Name |
|---|---|
| A01:2021 | Broken Access Control |
| A02:2021 | Cryptographic Failures |
| A03:2021 | Injection |
| A04:2021 | Insecure Design |
| A05:2021 | Security Misconfiguration |
| A06:2021 | Vulnerable and Outdated Components |
| A07:2021 | Identification and Authentication Failures |
| A08:2021 | Software and Data Integrity Failures |
| A09:2021 | Security Logging and Monitoring Failures |
| A10:2021 | Server-Side Request Forgery (SSRF) |

## Ruleid-to-control mapping patterns

The mapping here is mostly a **second hop off the CWE mapping**
(`resources/framework-mappings/cwe.md`) — once a finding has a CWE ID,
the OWASP category follows from well-known CWE→OWASP crosswalks.

| ruleId pattern | CWE (intermediate) | Maps to OWASP | Rationale |
|---|---|---|---|
| `COMM-SEC-003` (Missing ACL Check) | CWE-862 | A01:2021 Broken Access Control | Authorization gap is the textbook A01 case. |
| `AEMCS-SEC-002` (Missing Dispatcher Security Rules) | CWE-284 | A01:2021 Broken Access Control | Access-control config gap at the edge. |
| `SPRING-SEC-010` (Hardcoded secrets) | CWE-798 | A02:2021 Cryptographic Failures | Secrets-at-rest handling is grouped under crypto/data-protection failures in the 2021 edition. |
| `SHAFT-SEC-004`/`005`/`006` (TLS/crypto weak) | CWE-295 / CWE-326-family | A02:2021 Cryptographic Failures | Direct category match. |
| `COMM-SEC-002` (Raw SQL) | CWE-89 | A03:2021 Injection | Direct category match. |
| `COMM-SEC-004` / `AEMCS-SEC-003` (XSS) | CWE-79 | A03:2021 Injection | XSS is classified under Injection in the 2021 edition. |
| `SPRING-SEC-013` (SpEL injection) | CWE-917 | A03:2021 Injection | Expression-language injection is an Injection subtype. |
| `SPRING-SEC-005` (Deny by default, not `permitAll()`) | CWE-284 | A04:2021 Insecure Design | A design-level default, not a single misconfigured flag — Insecure Design fits better than Misconfiguration. |
| `SPRING-SEC-007` / `SPRING-SEC-003` (Actuator exposure) | CWE-200 | A05:2021 Security Misconfiguration | Unhardened default configuration exposing an endpoint. |
| `SPRING-SEC-008` (H2 console enabled) | CWE-489 | A05:2021 Security Misconfiguration | Debug feature left enabled outside dev. |
| `COMM-DEP-*` (outdated Composer dependency) | — | A06:2021 Vulnerable and Outdated Components | Direct category match — dependency-freshness findings. |
| `SPRING-SEC-014` (Unsafe deserialization) | CWE-502 | A08:2021 Software and Data Integrity Failures | Deserializing untrusted data is the 2021 edition's flagship A08 example. |
| `CSAAS-SEC-003` (missing webhook signature verification) | CWE-345-family | A08:2021 Software and Data Integrity Failures | Unverified webhook payload = integrity failure on inbound data. |
| `APPB-SEC-003` (Logging sensitive data) | CWE-532 | A09:2021 Security Logging and Monitoring Failures | Direct category match (logging hygiene). |

## Per-stack applicability for OWASP

| Stack | Applicability | Why |
|---|---|---|
| Commerce PaaS | Heavy | Full server-rendered web app with admin + storefront attack surface. |
| Commerce SaaS | Heavy | Storefront + API Mesh + webhook surface — A03, A08 especially relevant. |
| AEM (AEMaaCS/AMS) | Heavy | Author + Publish web surface; A01 (dispatcher/ACL), A03 (HTL XSS) especially relevant. |
| Spring Boot | Heavy | Broadest OWASP-relevant rule coverage — REST API surface touches nearly every category. |
| App Builder | Medium | Serverless action surface — A01/A03/A09 relevant; A05 (misconfiguration) less so given the managed runtime. |
| Sling / Shaft | Medium | Integration/connector surface — A02 (crypto/TLS), A08 (integrity) especially relevant; less classic "web app" surface. |
| EDS | Light-Medium | Minimal server-side surface (mostly static/edge-rendered); A03 (client-side XSS) and A05 (missing CSP) are the primary relevant categories. |
| EDS + Commerce | Medium | EDS applicability plus Commerce SaaS's API/webhook surface. |

## Evidence requirements for OWASP

- A mapped finding (ruleId + file:line) satisfies `covered` for the
  corresponding category, same as CWE.
- For **A06 (Vulnerable and Outdated Components)**, evidence should
  include the dependency-scan tool output (Composer audit, `npm audit`,
  OWASP Dependency-Check, Snyk) — a code-level finding alone is
  usually insufficient; cite the SCA tool run.
- For **A09 (Logging and Monitoring)**, evidence of *coverage* (not
  just absence of a bad pattern) ideally includes confirmation that
  security-relevant events are actually being logged and alerted on —
  this often needs the Operations agent's alert-rules artifact as
  corroborating evidence, not just a lack-of-`CWE-532` finding.

## Common gaps DCA CAN auto-detect

- A01 Broken Access Control — missing ACL/authorization annotations (`COMM-SEC-003`, `APPB-SEC-001`).
- A02 Cryptographic Failures — hardcoded secrets, disabled TLS validation, weak/no CSPRNG usage.
- A03 Injection — SQLi, XSS, SpEL/EL injection via known-bad API patterns.
- A05 Security Misconfiguration — exposed Actuator/debug endpoints, H2 console left enabled, permissive CORS.
- A06 Vulnerable and Outdated Components — stale dependency versions when a manifest/lockfile is present.
- A08 Software and Data Integrity Failures — unsafe deserialization, unverified webhook signatures.
- A09 Security Logging and Monitoring Failures — sensitive data logged in plaintext (a negative signal, not proof of good logging).

## Common gaps DCA CANNOT auto-detect (human review required)

- A04 Insecure Design — a threat-modeling gap, not a code pattern; requires the Architecture agent's STRIDE artifact or a human design review, not a scanner finding.
- A07 Identification and Authentication Failures at the *policy* level — e.g. whether MFA is actually enforced org-wide, whether password-reset flow has been pen-tested — code presence of an auth library doesn't confirm correct configuration end-to-end.
- A09's *positive* half — confirming monitoring/alerting is actually wired up and someone is watching it (see Evidence requirements above).
- A10 SSRF in cases where the vulnerable outbound call is behind a business-logic condition a static scanner can't reach.
- Whether third-party components flagged under A06 are actually reachable/exploitable in this deployment (reachability analysis needs runtime/dependency-graph context beyond static findings).
- Supply-chain integrity beyond the manifest (e.g. a compromised build pipeline) — A08 code-level findings don't cover build/CI integrity.

## Worked mapping example for OWASP

Given the same three findings used in the CWE worked example, plus one more:

```
F1: COMM-SEC-002 "Raw SQL in ReportController::export()" — CRITICAL
F2: SPRING-SEC-010 "Hardcoded DB password in application.yml" — CRITICAL
F3: AEMCS-SEC-003 "Unescaped ${properties.title} in HTL" — HIGH
F4: SPRING-SEC-007 "Actuator /env exposed without auth" — HIGH
```

Resulting control-mapping rows:

| OWASP category | Status | Mapped finding(s) | Remediation note |
|---|---|---|---|
| A03:2021 Injection | gap | F1, F3 | Two distinct injection sub-types (SQLi, XSS) both land under A03 — remediate both before marking `covered`. |
| A02:2021 Cryptographic Failures | gap | F2 | Secrets-at-rest; move to secrets manager. |
| A05:2021 Security Misconfiguration | gap | F4 | Restrict/authenticate Actuator endpoints per `SPRING-SEC-007` guidance. |
| A01:2021 Broken Access Control | partial | *(none this run — prior run had a COMM-SEC-003 finding now remediated)* | Re-verify no regression on the next audit run before marking fully `covered`. |

## Attestation considerations for OWASP

OWASP Top 10 attestations are most commonly requested as part of a
**customer or vendor security questionnaire**, not a regulatory filing.
Typical signer: the **AppSec Lead** or **Security Engineering Manager**.
Unlike PCI/HIPAA/SOX, there's no formal external certifying body for
OWASP compliance — the attestation is a good-faith statement of
posture, which makes the disclaimer in `templates/attestation.md`
especially important here: OWASP coverage is a risk-reduction signal,
not a compliance certification.

---

Generate the full control-mapping report using
`templates/control-mapping.md` as the master, populating placeholders
with the framework-specific content from the guide above.
Cross-reference other frameworks' guides for overlapping controls
(e.g. PCI Req 6 overlaps with OWASP Top 10 almost category-for-category).
