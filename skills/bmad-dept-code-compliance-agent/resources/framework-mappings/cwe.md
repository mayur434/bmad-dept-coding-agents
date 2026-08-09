# Framework mapping guide — CWE (Common Weakness Enumeration)

## What CWE requires

CWE is not a compliance framework in the regulatory sense — it's a
**community-maintained taxonomy of software weakness types**, maintained
by MITRE. It doesn't "require" anything on its own; it gives every
other framework a shared vocabulary for describing *what kind of
weakness* a finding represents. When PCI-DSS Requirement 6.2.4 says
"address common coding vulnerabilities," when OWASP names an Injection
category, or when CIS Control 16 talks about application software
security — they're all pointing, directly or indirectly, at CWE IDs.

That makes CWE the **foundation framework** in this agent's catalog.
Almost every finding from `audit` or `sonar-scan` maps to a CWE ID
first, and the other seven frameworks' mappings frequently derive from
that CWE mapping rather than being computed independently. Treat this
guide as the one the other seven lean on.

The most commonly cited subset is the **CWE Top 25 Most Dangerous
Software Weaknesses** — MITRE's annual ranking of the weakness types
most frequently linked to real-world exploited vulnerabilities.
<!-- verify: current-year CWE Top 25 ranking order changes annually;
     confirm against the latest published list before citing a rank
     number in an artifact. -->

## Control taxonomy

CWE findings map to individual **weakness IDs** (`CWE-<n>`), not
numbered "controls" — a control-mapping row here is really a
weakness-coverage row: "does at least one finding demonstrate this
weakness is present / absent / mitigated in this codebase." The
weakness IDs most relevant to the stacks this suite covers:

| CWE ID | Name |
|---|---|
| CWE-20 | Improper Input Validation |
| CWE-22 | Improper Limitation of a Pathname (Path Traversal) |
| CWE-79 | Improper Neutralization of Input During Web Page Generation (XSS) |
| CWE-89 | SQL Injection |
| CWE-200 | Exposure of Sensitive Information to an Unauthorized Actor |
| CWE-269 | Improper Privilege Management |
| CWE-284 | Improper Access Control |
| CWE-306 | Missing Authentication for Critical Function |
| CWE-346 | Origin Validation Error |
| CWE-352 | Cross-Site Request Forgery (CSRF) |
| CWE-434 | Unrestricted Upload of File with Dangerous Type |
| CWE-489 | Active Debug Code |
| CWE-502 | Deserialization of Untrusted Data |
| CWE-532 | Insertion of Sensitive Information into Log File |
| CWE-611 | Improper Restriction of XML External Entity Reference (XXE) |
| CWE-798 | Use of Hard-coded Credentials |
| CWE-862 | Missing Authorization |
| CWE-917 | Improper Neutralization of Special Elements used in an Expression Language Statement (EL Injection) |
| CWE-918 | Server-Side Request Forgery (SSRF) |

## Ruleid-to-control mapping patterns

DCA's audit rule packs already name a stack-scoped `ruleId` per rule
(e.g. `COMM-SEC-001`, `SPRING-SEC-011`) — the CWE mapper correlates the
rule's **category suffix** (`-SEC-`, `-PERF-`, `-CFG-`) and its known
description against the closest CWE ID.

| ruleId pattern | Maps to | Rationale |
|---|---|---|
| `COMM-SEC-001` (Missing CSRF Validation) | `CWE-352` | Rule description is a textbook CSRF weakness. |
| `COMM-SEC-002` (Raw SQL Without Parameter Binding) | `CWE-89` | String-concatenated SQL is the canonical SQLi pattern. |
| `COMM-SEC-003` (Missing ACL Check in Admin Controllers) | `CWE-862` | Authorization check absent, not just weak — "missing," not "incorrect." |
| `COMM-SEC-004` (Unescaped Output in Templates) | `CWE-79` | Raw `<?= $var ?>` without `escapeHtml()` is stored/reflected XSS. |
| `AEMCS-SEC-001` (Hardcoded Credentials) | `CWE-798` | Direct name match. |
| `AEMCS-SEC-002` (Missing Dispatcher Security Rules) | `CWE-284` | Access-control configuration gap at the CDN/dispatcher layer. |
| `AEMCS-SEC-003` (XSS in HTL/Sightly) | `CWE-79` | Same weakness class as COMM-SEC-004, different templating engine. |
| `AEMCS-SEC-004` (Insufficient Service User Permissions) | `CWE-269` | Over-privileged service account = improper privilege management. |
| `SPRING-SEC-002` (Validate request bodies `@Valid`) | `CWE-20` | Missing bean-validation annotation = improper input validation. |
| `SPRING-SEC-003` / `SPRING-SEC-007` (Actuator exposure) | `CWE-200` | Unauthenticated management endpoints expose internal state. |
| `SPRING-SEC-004` (CSRF protection disabled) | `CWE-352` | Direct match. |
| `SPRING-SEC-010` (Hardcoded secrets in Java) | `CWE-798` | Direct match. |
| `SPRING-SEC-011` (SQL/JPA injection via string building) | `CWE-89` | Direct match. |
| `SPRING-SEC-013` (SpEL / expression injection) | `CWE-917` | Direct match — EL/SpEL injection is the CWE-917 archetype. |
| `SPRING-SEC-014` (Unsafe deserialization) | `CWE-502` | Direct match. |
| `APPB-SEC-001` (Missing require-adobe-auth annotation) | `CWE-306` | Action reachable without authentication. |
| `APPB-SEC-003` (Logging sensitive data) | `CWE-532` | Direct match. |
| `EDS-SEC-002` (innerHTML with unsanitized content) | `CWE-79` | Client-side DOM XSS sink. |
| `SHAFT-SEC-004` (TLS validation disabled) | `CWE-295` <!-- verify: CWE-295 Improper Certificate Validation --> | Disabling cert checks is the canonical CWE-295 pattern. |

## Per-stack applicability for CWE

| Stack | Applicability | Why |
|---|---|---|
| Commerce PaaS | Heavy | PHP controller/template weakness classes (CSRF, SQLi, XSS, ACL) map cleanly. |
| Commerce SaaS | Heavy | Storefront JS + webhook-signature weaknesses map cleanly. |
| AEM (AEMaaCS/AMS) | Heavy | HTL/Sightly XSS, dispatcher access-control, service-user privilege weaknesses. |
| Spring Boot | Heavy | Broadest rule-pack coverage of any stack (12+ `SPRING-SEC-*` rules) — JVM weakness classes map almost 1:1 to CWE. |
| App Builder | Medium | Serverless action weaknesses (auth, input validation, logging) map cleanly; less surface area than a full app. |
| Sling / Shaft | Medium | Connector-credential and TLS weaknesses map cleanly; OSGi-specific issues are thinner on CWE precedent. |
| EDS | Medium | Client-side XSS/CSP weaknesses map cleanly; EDS's minimal server surface means fewer weakness classes apply. |
| EDS + Commerce | Medium | Union of EDS + Commerce SaaS applicability. |

CWE applies to **every** stack — this table describes *rule-pack
density*, not applicability, since CWE has no "not applicable" concept
at the framework level the way PCI or HIPAA do.

## Evidence requirements for CWE

- The mapped finding itself (ruleId + file:line + severity) is
  sufficient evidence for `covered` — CWE, unlike PCI or GDPR, doesn't
  require external documentation (a policy, a DPA) to close a control.
- For `gap` rows, evidence of a **fix** (a subsequent audit/sonar-scan
  run showing the same ruleId no longer fires, or an explicit
  code-review sign-off) is what moves the row to `remediated`.
- For weakness classes with no rule-pack coverage on a given stack
  (e.g. memory-safety CWEs like CWE-416/CWE-787 on a PHP/JS/JVM stack
  where they're largely inapplicable), mark `N/A` with the reason
  "stack does not exhibit this weakness class."

## Common gaps DCA CAN auto-detect

- Hardcoded credentials/secrets (`CWE-798`) — regex + AST pattern, high confidence.
- SQL/JPA injection via string concatenation (`CWE-89`) — AST-detectable across PHP/Java.
- Missing CSRF protection (`CWE-352`) — framework-config-detectable (Spring Security config, Magento controller annotations).
- Unescaped template output / XSS sinks (`CWE-79`) — AST-detectable across HTL, phtml, and client-side JS.
- Missing authorization checks (`CWE-862`) / missing authentication (`CWE-306`) — detectable when the framework's auth annotation convention is known (`@PreAuthorize`, `require-adobe-auth`, ACL resource checks).
- Sensitive data in logs (`CWE-532`) — regex-detectable logging-statement patterns.
- Unsafe deserialization (`CWE-502`) — AST-detectable (`ObjectInputStream`, `unserialize()`, etc.).
- TLS/certificate validation disabled (`CWE-295`) — config/AST-detectable.

## Common gaps DCA CANNOT auto-detect (human review required)

- Business-logic authorization flaws where the code *looks* correct but the logic is wrong for the actual business rule (e.g. a discount-stacking bug that isn't a code weakness pattern at all).
- Whether a "fixed" finding was actually verified in production, not just patched in a branch.
- Race conditions and TOCTOU (time-of-check/time-of-use) weaknesses that don't manifest as a static pattern.
- Cryptographic weaknesses in custom/non-obvious crypto usage that doesn't match a known-bad API call signature.
- Memory-safety weaknesses in native/compiled dependencies pulled in transitively (outside the scanned source).
- Whether a documented mitigating control (WAF rule, network segmentation) actually neutralizes a code-level weakness that is technically still present.

## Worked mapping example for CWE

Given three findings from a merged `audit` + `sonar-scan` run:

```
F1: COMM-SEC-002 "Raw SQL in ReportController::export()" — CRITICAL
    app/code/Vendor/Module/Controller/Adminhtml/Report/Export.php:44
F2: SPRING-SEC-010 "Hardcoded DB password in application.yml" — CRITICAL
    src/main/resources/application.yml:12
F3: AEMCS-SEC-003 "Unescaped ${properties.title} in HTL" — HIGH
    ui.apps/.../component/title/title.html:8
```

Resulting control-mapping rows:

| CWE ID | Status | Mapped finding | Remediation note |
|---|---|---|---|
| CWE-89 | gap | F1 (COMM-SEC-002) | Convert to parameter-bound query via Magento's ResourceConnection. |
| CWE-798 | gap | F2 (SPRING-SEC-010) | Move to a secrets manager / env-injected value; rotate the exposed credential. |
| CWE-79 | gap | F3 (AEMCS-SEC-003) | Wrap with HTL `context='html'` / explicit escaping. |
| CWE-352 | N/A | *(no CSRF-relevant finding this run)* | Reason: no `COMM-SEC-001`/`SPRING-SEC-004` finding present — mark for re-check next run, not asserted-covered. |

## Attestation considerations for CWE

CWE is rarely attested on its own — it underpins the attestation for
whichever *regulatory* framework is actually being submitted (PCI,
SOX, etc.). When a standalone CWE attestation is requested (e.g. for
an internal security-posture sign-off), the typical signer is the
**Security Engineering Lead** or **AppSec team lead**, not a
compliance officer — this is a technical, not a legal/regulatory,
attestation.

---

Generate the full control-mapping report using
`templates/control-mapping.md` as the master, populating placeholders
with the framework-specific content from the guide above.
Cross-reference other frameworks' guides for overlapping controls
(e.g. PCI Req 6 overlaps with OWASP Top 10, both of which cite CWE IDs
directly).
