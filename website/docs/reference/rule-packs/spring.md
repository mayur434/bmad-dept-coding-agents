---
title: Spring
sidebar_position: 5
description: Audit + Sonar rule packs for Spring Boot services.
---

# Spring Boot — audit + sonar rule packs

Covers **Spring Boot** services — auto-configuration, stereotype annotations, Spring Data JPA, `application.yml` profiles, actuator, Spring Security, validation, and Kafka/RabbitMQ messaging. Engine ID: `spring`. Alias: `spring-boot`.

Related pages: [Audit agent](../../agents/audit) · [Sonar Scan agent](../../agents/sonar-scan).

---

## Audit rule pack (17 rules)

Source: [`skills/bmad-dept-code-audit-agent/resources/rule-packs/spring/rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/spring/rules.md) (277 lines).

| Category | Rules | Focus |
|----------|:-----:|-------|
| Security Configuration | 4 | `SecurityFilterChain` correctness, method-security (`@PreAuthorize`), CSRF configuration, session-fixation + CORS defaults (`SPRING-SEC-001..004`). |
| Actuator & Observability | 3 | Actuator endpoint exposure, `/env` / `/heapdump` / `/loggers` gating, secure management port (`SPRING-OBS-001..003`). |
| Injection & Input | 4 | `@RequestParam` / `@PathVariable` validation, SQL injection via `EntityManager.createNativeQuery`, mass-assignment via `@RequestBody`, SpEL injection (`SPRING-INJ-001..004`). |
| Secrets & Config | 2 | `application.yml` hardcoded secrets, `@Value` reading raw env without a default (`SPRING-CFG-001..002`). |
| Data Access & Reliability | 4 | JPA N+1 queries, missing `@Transactional` boundaries, `@Async` executor missing, `RestTemplate` without timeout (`SPRING-DATA-001..004`). |
| Generic Java (also applied) | — | Scanner cross-cuts: `JAVA-QUAL-001..004` (class size, method size, cyclomatic complexity, deprecated API), `SPRING-SEC-010/011` (extra auth checks), `GEN-SEC-004..006` (weak crypto, `Random` misuse, timing-safe compare). |

Severity distribution (approximate): CRITICAL 3, HIGH 8, MEDIUM 5, LOW 1.

### How to run

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine spring --path .
```

Chat-driven focus prompts:

```text
focus on Spring Security (auth, CSRF, method security)
focus on JPA N+1 queries and lazy-loading traps
focus on actuator exposure and management endpoints
focus on @Async / thread-pool configuration
audit only the controllers under src/main/java/com/acme/api
```

---

## Sonar rule pack

Source: [`skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/spring/rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/spring/rules.md).

Language: **Java**.

| Pillar | Rule IDs | Severity |
|--------|----------|----------|
| Bug (Reliability) | `S2259` Null Pointer Dereference, `S2095` Streams and Connections Not Closed, `S1854` Dead Stores | HIGH / HIGH / LOW |
| Vulnerability (Security) | `S3649` SQL Injection, `S2068` Hardcoded Credentials, `S5131` Cross-Site Scripting (XSS), `S4719` Spring Security Misconfiguration | CRITICAL / CRITICAL / HIGH / CRITICAL |
| Security Hotspot | `S4507` Debug Actuator Endpoints Exposed | MEDIUM |
| Code Smell (Maintainability) | `S3776` Cognitive Complexity, `S1192` Duplicated String Literals, `S1066` Collapsible If Statements | MEDIUM / LOW / LOW |
| Duplication | `S1144` Unused Private Methods | LOW |
| Complexity | `S138` Methods with Too Many Lines | MEDIUM |

### How to run

```bash
# Step 1 (chat): "sonar scan my Spring Boot service"
# Step 2 (deterministic ingest):
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json --engine spring --path .
```

---

## How to extend

See [Writing rule packs](../../contributing/writing-rule-packs). Spring Boot–specific rules should tie to a stereotype annotation or an autoconfigure class; generic Java rules belong in the shared Java quality pack (`JAVA-QUAL-*`).
