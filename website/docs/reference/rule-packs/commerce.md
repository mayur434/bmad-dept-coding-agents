---
id: commerce
title: Commerce
sidebar_position: 2
description: Audit + Sonar rule packs for Adobe Commerce PaaS (Magento 2 on-prem / cloud).
---

Covers **Adobe Commerce on PaaS** — the PHP-based Magento 2 codebase (on-prem or Adobe Commerce Cloud). Engine IDs: `commerce` (canonical) or `commerce-paas` (alias). For the JavaScript / drop-in storefront, see [Commerce SaaS](commerce-saas).

Related pages: [Audit agent](../../agents/audit) · [Sonar Scan agent](../../agents/sonar-scan) · [Commerce SaaS rules](commerce-saas).

---

## Audit rule pack (58 rules)

Source: [`skills/bmad-dept-code-audit-agent/resources/rule-packs/commerce-paas/rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/commerce-paas/rules.md) (3151 lines).

| Category | Rules | Focus |
|----------|:-----:|-------|
| Architecture | 5 | Module boundaries, DI graph shape, area code discipline (frontend / adminhtml / crontab / global), circular dependencies. |
| Performance | 4 | Uncached blocks, expensive collections, unindexed queries, remote calls in observers. |
| Security | 4 | SQLi, XSS via block output, CSRF absence on state-changing controllers, mass-assignment on models. |
| GraphQL | 2 | N+1 resolvers, missing `@requiresPermission` on privileged queries. |
| Coding Standards | 2 | Magento coding standard adherence, PHPCS/PHPMD violations. |
| Deployment | 15 | `bin/magento module:enable`, setup:upgrade dependencies, deployment mode, static-content deploy, cache-clean order, config split, secure config, sensitive config, patch application, composer install --no-dev, storefront/admin URL split, encryption key, generated code cleanup, prod-mode enforcement, custom install-hook safety. |
| Exception Handling | 2 | Generic catch, swallowed exceptions. |
| Caching | 2 | Public cache-tag omission, admin cache bleed. |
| Code Metrics | 2 | God-class (default `god_class_lines=500`), fat constructors (default `fat_constructor_deps=10`). |
| Deprecated API | 1 | `ObjectManager::getInstance()` direct usage. |
| Logging | 2 | `error_log()` in prod code, PII in logs. |
| File Storage | 1 | Local filesystem writes vs Adobe Commerce Cloud read-only FS. |
| Test Coverage | 1 | Missing PHPUnit or Integration test surface. |
| Cron Job | 1 | Cron without locking / distributed guard. |
| Queue Processing | 1 | Missing DLQ / retry policy. |
| XML Configuration | 1 | Invalid XSD, missing schema declaration. |
| Infrastructure | 1 | Direct RDBMS access outside the DAL. |
| PHP Deep Analysis | 1 | Static-analysis flags (Psalm / PHPStan) below threshold. |
| Backward Compatibility | 1 | `@api` interface breaks between minor versions. |
| Configuration Scope | 1 | Website vs Store-View scope mistakes. |
| Layout & UI Component | 1 | Broken layout XML handles, orphan UI components. |
| MSI / Inventory | 1 | Multi-source inventory checks and reservation handling. |
| Critical Commerce Flows | 1 | Cart / checkout / order-place event coverage. |
| Business Logic | 1 | Price-rule / promotion / discount edge cases. |
| Frontend Template | 1 | `.phtml` escaping, `Zend_Escaper` usage. |
| Composer & Dependency | 1 | Composer lockfile drift, CVE-flagged packages. |
| DB Schema | 1 | `db_schema.xml` correctness, whitelist coverage, index / FK constraints. |
| Input Validation | 1 | Request-data type coercion, admin form validation. |

Severity distribution (approximate): CRITICAL 8, HIGH 20, MEDIUM 22, LOW 6, INFO 2.

### PaaS-only rules (not in SaaS)

- **DI + interceptors** — plugin / observer / area code discipline.
- **`webapi.xml` + `di.xml`** — REST/SOAP API surface + ACL wiring.
- **Layout XML + `db_schema.xml`** — server-rendered templates + declarative schema.
- **Cron + Queue + File-storage** — server-side workers and stateful writes.
- **MSI / Inventory + Admin security** — PaaS-only admin panel + inventory reservations.

### How to run

```bash
# Full audit with DB + BRD + bug context on a fresh branch
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine commerce --db ./db/prod.sql \
  --brd ./docs/spec.docx --bugs ./reports/bugs.xlsx \
  --namespace Acme --create-branch --source-branch production
```

The `--namespace` filter defaults to `Custom` (see `audit_namespace` in [Config Vars](../config-vars)); pass a partner prefix like `Acme` to focus the scan on `app/code/Acme/*`.

---

## Sonar rule pack

Source: [`skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/commerce-paas/rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/commerce-paas/rules.md).

Language: **PHP**.

| Pillar | Rule IDs | Severity |
|--------|----------|----------|
| Bug (Reliability) | `S2259` Null / Object Not Found, `S1854` Dead Code Assignment | HIGH / LOW |
| Vulnerability (Security) | `S3649` SQL Injection via Direct Query, `S2068` Hardcoded Credentials / API Keys, `S5131` XSS via Block Output, `S1313` CSRF Missing on State-Changing Action | CRITICAL / CRITICAL / HIGH / HIGH |
| Security Hotspot | `S4507` `ObjectManager` Direct Usage | MEDIUM |
| Code Smell (Maintainability) | `S3776` Cognitive Complexity, `S1192` Duplicated String Literals, `S1066` Collapsible If Statements | MEDIUM / LOW / LOW |
| Duplication | `S1144` Dead Private Methods | LOW |
| Complexity | `S138` Methods with Too Many Lines | MEDIUM |

### How to run

```bash
# Step 1 (chat): "sonar scan my Commerce PaaS project"
# Step 2 (deterministic ingest):
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json --engine commerce-paas --path .
```

---

## How to extend

Adding a rule to the PaaS pack:

1. Add the rule under the appropriate `##` category header in `rules.md`.
2. If deterministic, add the detector under `scripts/engines/commerce/rules/` and tag `[scanner: <ID>]` in the pack.
3. Add a mapping under the correct Sonar pillar if the rule reports as Bug / Vulnerability / Hotspot / Smell.

See [Writing rule packs](../../contributing/writing-rule-packs) for the full authoring checklist.
