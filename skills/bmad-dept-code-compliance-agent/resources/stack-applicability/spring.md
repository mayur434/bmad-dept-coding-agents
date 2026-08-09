# Compliance applicability guide — Spring (Spring Boot / JVM backend)

## Purpose framing

Spring Boot services in this suite's context are general-purpose JVM
backends — anything from a payment-gateway integration microservice to
an internal reporting API. That makes Spring's compliance profile
**the most variable of any stack**: the framework-applicability answer
is almost always "it depends what the service does," not a fixed
per-stack default. A payment-processing Spring service inherits PCI and
SOX heavily; a generic internal backend inherits neither. What stays
constant across every Spring service is a dense, well-covered CWE/OWASP/
CIS surface — this stack has the broadest rule-pack coverage
(`SPRING-SEC-*`) of any stack in the suite.

## Framework applicability matrix for Spring

| Framework | Applicability | Primary trigger | Typical evidence source |
|---|---|---|---|
| CWE | Heavy | Broadest rule-pack density in the suite — injection, deserialization, actuator exposure, SpEL injection all map cleanly. | `audit` findings tagged `SPRING-SEC-*`. |
| OWASP | Heavy | Any Spring service exposing a REST/HTTP API inherits the full OWASP surface. | `sonar-scan` Quality Gate findings. |
| CIS | Heavy | Actuator/management-endpoint exposure, dependency hygiene, and RBAC config are all code-observable and densely covered. | Spring Security config, Actuator endpoint exposure audit. |
| PCI-DSS | Depends | **Heavy** if the service is a payment-gateway integration or handles cardholder data directly; **none** if it's an unrelated internal backend. Confirm with the human before scoping either way. | `audit`/`sonar-scan` findings on payment-adjacent service code, if any. |
| HIPAA | Depends | Same pattern — heavy only if the service is confirmed to process PHI (a clinical-data API, a patient-portal backend); never inferred from code alone. | Human-confirmed applicability only. |
| GDPR | Depends | Heavy if the service processes EU personal data (a customer-account API, a CRM sync service); light/none for infrastructure-internal services with no PII. | Service's data-model/entity classes, request/response DTOs. |
| SOX | Depends | Heavy if the service is a financial-services API feeding recognized-revenue or financial-reporting systems; light otherwise. | Audit-logging config on financial-data mutation endpoints. |
| ISO 27001 | Heavy | Technical Annex A controls (access control, cryptography, logging, secure development) are all code-observable on this stack. | Spring Security audit-event config, dependency-management (SBOM) records. |

## Shared-responsibility notes for Spring

Spring services in this suite are typically self-hosted or
customer-deployed (Kubernetes, a customer's own cloud account) rather
than an Adobe-managed SaaS surface — so unlike Commerce SaaS, App
Builder, or EDS, there is **no Adobe shared-responsibility split to
reason about here**. The full compliance stack — from network
configuration up through application code — is the deploying team's
responsibility. The one adjacent shared-responsibility fact worth
flagging: if the Spring service runs on a managed Kubernetes offering
or cloud provider, that provider's own infrastructure certifications
(SOC2, ISO 27001) cover the infra layer the same way any cloud
provider's would — this is a general cloud-shared-responsibility fact,
not something specific to this suite's Adobe stacks.

## Stack-specific evidence sources

- Application logs (structured logging, e.g. Logback/SLF4J output).
- Spring Security audit events — authentication/authorization decision logs.
- Kubernetes RBAC configuration (if deployed to K8s) — who can access what at the platform layer.
- Secrets-manager audit trail (Vault, AWS Secrets Manager, etc.) — credential access history.
- Actuator endpoint exposure configuration (`management.endpoints.web.exposure.include`).
- Dependency SBOM (software bill of materials) or `mvn dependency:tree`/Gradle equivalent output — evidence for CIS Control 2/ISO 27001 A.8.8 vulnerability-management controls.

## Stack-specific common gaps

- Actuator endpoints (`/actuator/env`, `/actuator/heapdump`) exposed without authentication (`SPRING-SEC-003`/`007`, CWE-200 / OWASP A01 / CIS Control 4).
- Missing audit logging on admin/financial-data mutation actions (SOX gap — a pure-gap row, not tied to a security finding; also CIS Control 8).
- SQL/JPA injection via string-built queries instead of parameterized `@Query` (`SPRING-SEC-011`, CWE-89 / OWASP A03).
- Hardcoded secrets in `application.yml`/`application.properties` (`SPRING-SEC-010`, CWE-798).
- CSRF protection disabled globally for API convenience without a compensating token-auth control (`SPRING-SEC-004`, CWE-352).
- SpEL/expression injection in dynamically-built expressions (`SPRING-SEC-013`, CWE-917 / OWASP A03).
- Unsafe deserialization of untrusted input (`SPRING-SEC-014`, CWE-502).
- Missing `@Valid`/bean-validation annotations on request DTOs, letting malformed or oversized payloads reach business logic unchecked (`SPRING-SEC-002`, CWE-20).

## Stack-specific compliance quick-wins

- Lock down Actuator exposure to a minimal safe set (`health`, `info`) behind authentication — closes CWE-200/CIS Control 4 findings with one config change.
- Move all secrets from `application.yml` to a secrets manager with env-injection at deploy time — closes CWE-798 across the whole service in one pass.
- Add `@PreAuthorize`/audit-logging aspect around financial-data mutation endpoints — closes both a CWE-862 gap and a SOX segregation-of-duties/audit-trail gap simultaneously.
- Switch string-built JPA queries to parameter-bound `@Query`/`Criteria` usage — closes CWE-89 findings and their downstream PCI Req 6.2.4 mapping if payment-adjacent.
- Add `@Valid` to every `@RequestBody`-bound controller method — closes CWE-20 findings across the whole API surface in one sweep.

## Worked scenario for Spring

A payment-gateway integration microservice, built in Spring Boot, sits
between the storefront and an external card processor — it handles
tokenized payment requests, writes transaction records, and exposes an
internal reconciliation API used by finance.

Likely-applicable frameworks: PCI-DSS (heavy — confirmed payment-gateway
role), SOX (heavy — the reconciliation API feeds finance's
revenue-recognition process), GDPR (medium — transaction records include
customer identifiers), CWE/OWASP/CIS (heavy, as on every Spring
service), ISO 27001 (heavy), HIPAA (none — no PHI signal).

A first compliance report run would likely surface: the Actuator
`/env` endpoint exposed publicly, leaking config including a database
connection string (CWE-200/CIS Control 4, CRITICAL — and a PCI Req 2
gap given the payment-adjacent scope), a missing `@PreAuthorize` on the
reconciliation endpoint (CWE-862/PCI Req 7, HIGH), and a SOX pure-gap
row flagging that transaction-record mutations have no audit-log
aspect attached — a process/code gap the mapper surfaces even without
a matching security finding.

With 24 merged findings across `audit`/`sonar-scan`/`test-coverage`
for this service, a representative outcome is: 16 controls covered, 6
gaps (the three above plus a hardcoded downstream-API secret, a
missing-`@Valid` finding on the transaction-submission endpoint, and a
CSRF-disabled finding that turned out to be intentional — token-auth
already compensates, so it should move to `accepted` via the decisions
gate rather than sit as an open gap), and 2 controls N/A (PCI Req 1/9,
infra-level, not this service's concern). Given the `security` role's
default SLA, the PCI-adjacent CRITICAL Actuator finding gets a 24-hour
window; the SOX audit-logging gap, being a process fix, is typically
routed to `pm`/`tl` for prioritization against the next sprint rather
than assigned a code-fix SLA.

## Cross-references

See `resources/framework-mappings/cwe.md` (heavy, foundation),
`resources/framework-mappings/owasp.md` and `resources/framework-mappings/cis.md`
(heavy), `resources/framework-mappings/pci.md` and
`resources/framework-mappings/sox.md` (depends — confirm applicability
per service before scoping), `resources/framework-mappings/iso27001.md`
(heavy on technical controls).

Use this guide alongside `resources/framework-mappings/<framework>.md` when
generating a control-mapping report scoped to Spring.
