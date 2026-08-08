# STRIDE threat-model authoring guide — Spring Boot

## Purpose framing

A Spring Boot threat model catalogs threats across the **External ↔
API Gateway ↔ App ↔ DB / Cache / Broker** tiers. JWT + OAuth2 posture,
DTO mass-assignment, and JPA query-injection dominate. Reference
`templates/threat-model-stride.md` for master shape.

## Typical trust boundaries for Spring Boot

- **External ↔ API Gateway** — TLS + WAF; API-gateway auth (JWT
  verification, mTLS for partners).
- **Gateway ↔ App** — mTLS or shared secret; L7 network policy.
- **App ↔ DB** — VPC-scoped; credentials from Vault; TLS to Postgres/
  MySQL.
- **App ↔ Cache (Redis)** — AUTH + TLS; per-app key namespace.
- **App ↔ Broker (Kafka / RabbitMQ)** — SASL/SCRAM + TLS; per-topic
  ACL.
- **App ↔ Downstream service** — mTLS + service-mesh identity.
- **App ↔ Config Server / Vault** — token-based; short TTL.
- **App ↔ Actuator endpoints** — separate port; internal-only network
  policy.

## Assets and data classification for Spring Boot

- **JWT signing key** — Confidential; rotate via JWK.
- **DB credentials** — Confidential; Vault-issued, short TTL.
- **Business data** — variable per bounded context.
- **PII in DTO** — Restricted; classify per field.
- **API keys for downstream** — Confidential.
- **Actuator info** — Internal; can leak env, deps, git commit.
- **Log payloads** — variable; do not log request/response bodies
  containing PII.

## Per-component STRIDE table

| Component-Type | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | EoP | Common Mitigations |
|---|---|---|---|---|---|---|---|
| REST controller | JWT weak alg (none/HS256 mixup) | mass-assignment via `@RequestBody` | request log gap | `ProblemDetail` too verbose | unbounded page size | `@PreAuthorize` missing | JWK verification pinned alg; DTO with `@JsonProperty` allow-list; MDC correlation; sanitized error body; Pageable size cap; method security |
| Service | wrong `@Transactional` propagation | non-atomic writes | audit log gap | `toString` leaks entity | slow SQL blocks pool | scope check missing | REQUIRES_NEW where needed; explicit save; `@ToString(exclude=...)`; timeouts on JDBC; caller-passed tenant id |
| JPA repository | tenant leakage | HQL injection | query log off | `findAll` returns all tenants | N+1 cascade | native SQL bypasses ACL | tenant filter (`@FilterDef`); parameterized queries only; slow-query log; hard scope in every query |
| Kafka consumer | fake message | payload replay | consumer group audit gap | log leaks PII | poison flood | consumer runs as admin | schema registry + signature; idempotency key + dedupe; masked logger; retry topic + DLQ; namespace-scoped serviceaccount |
| Scheduled task | task run by wrong node | concurrent runs corrupt | task run log gap | log leaks state | task starves pool | task runs as elevated user | ShedLock for HA; task-specific executor pool |
| Actuator endpoint | unauth access | expose secrets via env | audit gap | `/env`, `/heapdump` leaks | endpoint DoS | endpoints on public port | separate mgmt port; Spring Security on actuator; disable heapdump/threaddump in prod |
| Web filter | filter order | header injection | filter log gap | leak stack | filter throws | filter runs before auth | test filter order; strip untrusted headers; try/catch |

## Common threats + mitigations for Spring Boot

- **JWT `alg=none` / algorithm confusion** → pin allowed algs in
  `NimbusJwtDecoder.withJwkSetUri(...).jwsAlgorithms(...)`.
- **Mass-assignment** → dedicated request DTO with explicit
  `@JsonProperty` fields; never bind entity directly.
- **SQL injection via JPQL string concat** → parameterized queries;
  `@Query` with named params; static analysis (SpotBugs / Semgrep).
- **SSRF via user-supplied URL** → allow-list host + scheme; block RFC
  1918 + link-local.
- **Deserialization RCE (Jackson / SnakeYAML)** → default-typing off;
  keep Jackson patched; use `SafeConstructor` for YAML.
- **Log injection (CRLF)** → log-encoder that escapes control chars.
- **Actuator `/env` leaks secrets** → disable in prod or ACL; use
  `management.endpoints.web.exposure.include` narrowly.
- **CORS wide-open (`*`)** → per-origin allow-list.
- **CSRF disabled on state-changing endpoints** → keep enabled or
  document JWT + Origin check equivalence for SPAs.
- **Spring Security misconfiguration (missing `authorizeHttpRequests`)** →
  security tests via `@WithMockUser`; `SecurityFilterChain` bean.
- **Log4Shell-class RCE** → Spring Boot BOM pins; renovate + CVE watch.

## Attack trees for common flows

### Attack tree — JWT bypass

```
Goal: forge token accepted by app
├── Downgrade to alg=none
├── Confuse RS256 ↔ HS256 (key-as-secret)
├── Steal signing key (leaked, static)
└── Replay expired token (clock skew abuse)
Mitigation: pin alg; JWK rotation; short TTL + refresh; strict `exp/nbf`
```

### Attack tree — Mass-assignment privilege gain

```
Goal: set admin=true via user-update endpoint
├── Discover admin field on entity
├── POST body with `admin: true`
└── Entity binds full body
Mitigation: DTO with allow-list; ignore-unknown false; integration test that admin cannot be set from user role
```

### Attack tree — SSRF to metadata service

```
Goal: read cloud-instance credentials via 169.254.169.254
├── Find endpoint accepting URL
├── Bypass allow-list (DNS rebinding, redirects)
└── Fetch IMDS
Mitigation: IMDSv2; egress network policy; disable redirect follow; validate resolved IP
```

## PCI / GDPR / SOX applicability per Spring Boot

- **PCI** — if handling PAN, full merchant scope; prefer tokenization
  gateway.
- **GDPR** — DPIA per bounded context; RTBF endpoint + audit log.
- **SOX** — for financial systems, immutable audit log (append-only
  table or event store); segregation of duties in RBAC.
- **HIPAA** — if health data, PHI encryption at-rest + BAA with cloud
  provider.

## Residual-risk framing per Spring Boot

- Accept low residual on library-supply-chain if Dependabot + weekly
  scan.
- Accept medium residual on Actuator misuse if separate mgmt port +
  network policy.
- Do not accept residual on `alg=none` accepted.
- Do not accept residual on `@PreAuthorize` missing on write endpoints.

## Anti-patterns to avoid for Spring Boot

- Treating "Spring Security is on" as the whole threat model.
- Ignoring consumer/producer surface — brokers are 30%+ of surface in
  event-driven systems.
- Rating every controller "high" — grade by data reach + auth model.
- Modeling only synchronous flow — retry topics + DLQ are attack
  surface.

---

Generate the full threat model using `templates/threat-model-stride.md`
as master, populating placeholders with stack-appropriate content from
the guide above. Reference the LLD
(`resources/lld-templates/spring.md`) for component list.
