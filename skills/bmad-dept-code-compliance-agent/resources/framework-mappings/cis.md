# Framework mapping guide — CIS Controls

## What CIS Controls requires

The **CIS Critical Security Controls** (published by the Center for
Internet Security) are a prioritized set of security best-practice
safeguards, organized into 18 top-level Controls and further broken
into "Implementation Groups" (IG1/IG2/IG3) that scale from small
organizations to enterprises with dedicated security teams. Unlike
PCI or HIPAA, CIS Controls are **voluntary** — there's no regulator
enforcing them — but they're widely used as the baseline "are we doing
security hygiene basics" checklist, and several other frameworks
(including some PCI SAQ guidance) reference CIS as a starting point.

Critically, CIS Controls are as much about **process and
infrastructure** (asset inventory, patch cadence, log retention,
security-awareness training) as about application code. Several of the
18 Controls have **no code-level manifestation at all** — a scanner
finding can never satisfy Control 14 (Security Awareness and Skills
Training) or Control 17 (Incident Response Management) on its own.
This guide flags which Controls are code-observable and which are
not, so the control-mapping doesn't imply false coverage.

Current published version: **CIS Controls v8**.
<!-- verify: confirm current version before citing in an externally-
     facing artifact — CIS periodically issues major revisions. -->

## Control taxonomy

| Control | Name | Code-observable? |
|---|---|---|
| CIS 1 | Inventory and Control of Enterprise Assets | No |
| CIS 2 | Inventory and Control of Software Assets | Partial (dependency manifests) |
| CIS 3 | Data Protection | Yes |
| CIS 4 | Secure Configuration of Enterprise Assets and Software | Yes |
| CIS 5 | Account Management | Partial |
| CIS 6 | Access Control Management | Yes |
| CIS 7 | Continuous Vulnerability Management | Partial (scan cadence, not code itself) |
| CIS 8 | Audit Log Management | Yes |
| CIS 9 | Email and Web Browser Protections | No |
| CIS 10 | Malware Defenses | No |
| CIS 11 | Data Recovery | No |
| CIS 12 | Network Infrastructure Management | No |
| CIS 13 | Network Monitoring and Defense | No |
| CIS 14 | Security Awareness and Skills Training | No |
| CIS 15 | Service Provider Management | No |
| CIS 16 | Application Software Security | Yes |
| CIS 17 | Incident Response Management | No |
| CIS 18 | Penetration Testing | Partial (findings can corroborate, not replace) |

<!-- verify: exact v8 control numbering/wording against the current
     published CIS Controls document before citing verbatim in an
     externally-facing artifact. -->

## Ruleid-to-control mapping patterns

| ruleId pattern | Maps to | Rationale |
|---|---|---|
| `AEMCS-SEC-001` / `SPRING-SEC-010` (hardcoded credentials) | CIS 3 (Data Protection) + CIS 6 (Access Control) | Credential material at rest in source is both a data-protection and an access-control gap. |
| `SHAFT-SEC-004` (TLS validation disabled) | CIS 3 (Data Protection) | Data-in-transit protection failure. |
| `SPRING-SEC-003` / `SPRING-SEC-007` (Actuator exposure) | CIS 4 (Secure Configuration) | Default configuration left insecure. |
| `SPRING-SEC-008` (H2 console enabled outside dev) | CIS 4 (Secure Configuration) | Debug feature left on in a non-dev config. |
| `COMM-SEC-003` (Missing ACL check) | CIS 6 (Access Control Management) | Direct match — authorization enforcement gap. |
| `AEMCS-SEC-004` (Insufficient service-user permissions) | CIS 6 (Access Control Management) | Over-privileged service account. |
| `APPB-SEC-003` (Logging sensitive data) | CIS 8 (Audit Log Management) | Log-hygiene finding — logs exist but leak sensitive data, which undermines log-management trust. |
| `COMM-DEP-*` / stale dependency findings | CIS 2 (Inventory and Control of Software Assets) + CIS 7 (Continuous Vulnerability Management) | A stale dependency is simultaneously an inventory-freshness gap and a vulnerability-management gap. |
| `COMM-SEC-001` / `SPRING-SEC-004` (CSRF) | CIS 16 (Application Software Security) | General secure-coding-practice control. |
| `COMM-SEC-002` / `SPRING-SEC-011` (SQL injection) | CIS 16 (Application Software Security) | Direct match. |
| `AEMCS-SEC-003` / `EDS-SEC-002` (XSS) | CIS 16 (Application Software Security) | Direct match. |
| `SPRING-SEC-014` (unsafe deserialization) | CIS 16 (Application Software Security) | Direct match. |

## Per-stack applicability for CIS Controls

| Stack | Applicability | Why |
|---|---|---|
| All 8 stacks | Heavy (for CIS 3, 4, 6, 8, 16) | These five code-observable Controls apply uniformly — every stack has data-protection, configuration, access-control, logging, and secure-coding surface. |
| All 8 stacks | None (for CIS 1, 9, 10, 11, 12, 13, 14, 15, 17) | These Controls are organizational/infrastructure — no stack's source code can satisfy them; always mark `N/A` for code-mapping purposes, with a note pointing to the organization's IT/security team as the actual control owner. |

Unlike PCI/HIPAA/SOX, CIS applicability doesn't vary meaningfully by
stack — the code-observable subset applies everywhere source code
exists; the non-observable subset is out of scope for THIS agent
everywhere, regardless of stack.

## Evidence requirements for CIS Controls

- **CIS 3 (Data Protection):** encryption-at-rest/in-transit
  confirmation, absence of hardcoded secrets, secrets-manager usage
  evidence.
- **CIS 4 (Secure Configuration):** hardened defaults — no
  debug/management endpoints exposed, no permissive CORS, dependency
  manifest showing pinned (not floating) versions.
- **CIS 6 (Access Control Management):** ACL/authorization checks
  present at every privileged entry point; least-privilege service
  accounts.
- **CIS 8 (Audit Log Management):** logging present at
  security-relevant events, without sensitive-data leakage into the
  log stream itself.
- **CIS 16 (Application Software Security):** absence of the classic
  injection/XSS/deserialization weakness classes — largely the same
  evidence bar as the CWE Top 25 subset relevant to this stack.
- For every `N/A` Control (1, 9–15, 17), evidence requirement is
  explicitly "not assessable by this agent" — do not fabricate
  evidence; point to the organization's asset-management/security-ops
  tooling as the actual evidence source.

## Common gaps DCA CAN auto-detect

- Hardcoded secrets/credentials (CIS 3 + 6).
- Disabled TLS/certificate validation (CIS 3).
- Exposed management/debug endpoints, permissive CORS (CIS 4).
- Missing authorization checks, over-privileged service accounts (CIS 6).
- Sensitive data logged in plaintext (CIS 8, negative signal).
- Stale/outdated dependency versions when a manifest is present (CIS 2 partial, CIS 7 partial).
- Classic injection/XSS/deserialization weakness classes (CIS 16).

## Common gaps DCA CANNOT auto-detect (human review required)

- Whether an enterprise asset inventory actually exists and is current (CIS 1).
- Whether patch/vulnerability-management SLAs are actually being met at the infrastructure layer, beyond what a code-level dependency scan shows (CIS 7 — full scope).
- Email/web-browser protection configuration (CIS 9) — entirely outside source-code visibility.
- Malware-defense tooling deployment and coverage (CIS 10).
- Backup/data-recovery testing cadence and success rate (CIS 11).
- Network infrastructure and monitoring posture (CIS 12, 13) — no code-level signal exists.
- Security-awareness training completion rates (CIS 14).
- Third-party/service-provider risk-assessment status (CIS 15).
- Incident-response plan existence, testing cadence, and tabletop-exercise history (CIS 17).
- Penetration-test scheduling and remediation-verification cadence, beyond what automated findings corroborate (CIS 18).

## Worked mapping example for CIS Controls

Given findings from a merged `audit` + `sonar-scan` run:

```
F1: SPRING-SEC-010 "Hardcoded DB password in application.yml" — CRITICAL
F2: SPRING-SEC-007 "Actuator /env exposed without auth" — HIGH
F3: COMM-SEC-003 "Missing ACL check in ReportController" — HIGH
F4: COMM-DEP-014 "magento/module-catalog pinned to EOL version" — MEDIUM
```

Resulting control-mapping rows:

| CIS Control | Status | Mapped finding(s) | Remediation note |
|---|---|---|---|
| CIS 3 (Data Protection) | gap | F1 | Move credential to secrets manager. |
| CIS 4 (Secure Configuration) | gap | F2 | Restrict/authenticate Actuator endpoints. |
| CIS 6 (Access Control Management) | gap | F3 | Add ACL annotation to admin controller. |
| CIS 2 / CIS 7 (Software Inventory / Vuln Mgmt) | gap | F4 | Upgrade to a supported module version; establish a dependency-freshness review cadence. |
| CIS 1 (Asset Inventory) | N/A | — | Not code-observable — owned by IT asset management, not this codebase. |
| CIS 14 (Security Awareness Training) | N/A | — | Not code-observable — owned by HR/security training program. |

## Attestation considerations for CIS Controls

CIS Controls attestations are typically used **internally** — for a
security-maturity self-assessment, a vendor-risk questionnaire
response, or an Implementation Group (IG1/IG2/IG3) self-scoring
exercise. Typical signer: the **CISO** or **Head of Security
Engineering**. Because roughly half the 18 Controls are outside code
visibility entirely, a CIS attestation from this agent should be
explicit that it covers **only the code-observable subset** (Controls
2, 3, 4, 6, 7 partial, 8, 16) — never imply full-framework attestation
from a code-only assessment.

---

Generate the full control-mapping report using
`templates/control-mapping.md` as the master, populating placeholders
with the framework-specific content from the guide above.
Cross-reference other frameworks' guides for overlapping controls
(e.g. CIS 16 overlaps heavily with OWASP Top 10 and CWE; CIS 3
overlaps with PCI Req 3/4 and GDPR Art. 32).
