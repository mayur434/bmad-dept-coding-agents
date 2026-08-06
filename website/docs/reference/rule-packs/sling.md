---
id: sling
title: Sling
sidebar_position: 4
description: Audit + Sonar rule packs for Sling / Shaft (sling-12 middleware — Apache Sling + Felix + Oak).
---

Covers the **Sling-12 / Shaft** middleware stack — Apache Sling + Felix OSGi + Oak repository, packaged as a feature-model / starter, typically running JVM services that expose REST via `SlingServlet` and OSGi DS components. Engine ID: `sling`. Aliases: `sling-shaft`.

Related pages: [Audit agent](../../agents/audit) · [Sonar Scan agent](../../agents/sonar-scan) · [AEM rules](aem) (shares Sling/OSGi rules).

---

## Audit rule pack (27 rules)

Source: [`skills/bmad-dept-code-audit-agent/resources/rule-packs/sling/rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/sling/rules.md) (501 lines).

| Category | Rules | Focus |
|----------|:-----:|-------|
| Platform & Architecture | 2 | JDK 8+ target, OSGi component + configuration correctness (`SHAFT-ARCH-001..002`). |
| Request Filter Chain | 1 | XSS → Audit → Authorization filter chain must be intact and correctly ordered (`SHAFT-FILTER-001`). |
| Authentication & Authorization | 4 | JWT signature verification, partner-token scope + expiry, non-bypassable authorization, LDAP/OAuth2/SSO input + redirect validation (`SHAFT-AUTH-001..004`). |
| Connector & Secret | 3 | No hardcoded connector credentials, no logged secrets, TLS validation not disabled (`SHAFT-SEC-001`, `SHAFT-SEC-004`, `SHAFT-SEC-005/006` for crypto/CSPRNG). |
| Data-Access | 2 | No SQL injection via string building, no NoSQL/JSON injection in Mongo connector (`SHAFT-SEC-002`, `SHAFT-DATA-002`). |
| SAM (API Management) | 4 | Distributed APIs must enforce throttling + rate limits; Query-to-API translation correctness, channel isolation, and rate-limit persistence (`SHAFT-SAM-001..004`). |
| MDM | 4 | Master-data merge safety, ownership rules, delta-load correctness, quarantine on validation failure. |
| Sling / OSGi Hygiene | 4 | Resource-resolver + JCR-session lifetimes, DS component activation contract, feature-model + starter consistency. |
| Reliability & Quality | 3 | Circuit-breaker on downstream calls, retry policies, health-check endpoints. |

Severity distribution (approximate): CRITICAL 5, HIGH 12, MEDIUM 8, LOW 2.

### How to run

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine sling --path /path/to/shaft
```

Chat-driven focus prompts:

```text
focus on Sling filter chain ordering and priority
focus on resource resolver leaks and admin session use
focus on OSGi service ranking, DS component lifecycle
focus on Oak query indexes and JCR traversals
```

---

## Sonar rule pack

Source: [`skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/sling/rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/sling/rules.md).

Language: **Java**.

| Pillar | Rule IDs | Severity |
|--------|----------|----------|
| Bug (Reliability) | `S2259` Null Pointer Dereference, `S2095` Unclosed `ResourceResolver` / `Session`, `S1854` Dead Stores | HIGH / HIGH / LOW |
| Vulnerability (Security) | `S2068` Hardcoded Credentials, `S3649` JCR-SQL2 / XPath Injection, `S5131` Sling Servlet Response XSS | CRITICAL / CRITICAL / HIGH |
| Security Hotspot | `S4507` Unrestricted Sling Servlets (missing `requiresAuthentication`) | MEDIUM |
| Code Smell (Maintainability) | `S3776` Cognitive Complexity, `S1192` Duplicated String Literals, `S1066` Collapsible If Statements | MEDIUM / LOW / LOW |
| Duplication | `S1144` Unused Private Methods | LOW |
| Complexity | `S138` Methods with Too Many Lines | MEDIUM |

### How to run

```bash
# Step 1 (chat): "sonar scan my Sling project"
# Step 2 (deterministic ingest):
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json --engine sling --path .
```

---

## How to extend

See [Writing rule packs](../../contributing/writing-rule-packs) for the full authoring checklist. New Shaft-specific rules should live under an existing category (Platform / Auth / Connector / SAM / MDM) rather than proliferate top-level headings.
