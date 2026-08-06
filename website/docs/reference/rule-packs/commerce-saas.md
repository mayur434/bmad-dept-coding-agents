---
id: commerce-saas
title: Commerce SaaS
sidebar_position: 3
description: Audit + Sonar rule packs for Adobe Commerce SaaS (drop-ins / Storefront / Catalog Service / Live Search).
---

Covers **Adobe Commerce as a Cloud Service (SaaS)** — an EDS/drop-in storefront + App Builder consuming the SaaS services: **Catalog Service**, **Live Search**, **Product Recommendations**, **Data Connection** (event forwarding), and the **Storefront Events SDK**. There is no `app/code` PHP tree; the code is storefront JS (drop-ins/blocks), integration JS (GraphQL to the SaaS services), config, and App Builder actions.

Engine ID: `commerce-saas`. Distinct from [Commerce PaaS](commerce) (PHP modules) and from plain [EDS](eds).

Related pages: [Audit agent](../../agents/audit) · [Sonar Scan agent](../../agents/sonar-scan) · [EDS + Commerce](eds-commerce).

---

## Audit rule pack (4 deterministic + Tier-2 semantic checks)

Source: [`skills/bmad-dept-code-audit-agent/resources/rule-packs/commerce-saas/rules.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/commerce-saas/rules.md).

The pack is intentionally compact — SaaS surface area is small — and split into 4 deterministic rules (scanner-backed) plus a Tier-2 semantic checklist the LLM reads by inspection.

### Deterministic rules

| Rule ID | Severity | Description |
|---------|----------|-------------|
| `CSAAS-SEC-001` | CRITICAL | No `Authorization`/`Bearer`/integration/admin token literals in storefront JS. Only the **public** Catalog Service / Live Search `x-api-key` is meant to be client-side. |
| `CSAAS-CFG-001` | CRITICAL | No private secrets committed in `config.json` / `commerce.env.json` / `.env`. |
| `CSAAS-CFG-002` | MEDIUM | Externalize SaaS endpoints (`catalog-service.adobe.io`, `commerce.adobe.io`) and `Magento-Environment-Id` — read from config, don't hardcode. |
| `CSAAS-SEC-003` | HIGH | Verify Data Connection / eventing webhook signatures with `aio-lib-events` / `crypto.timingSafeEqual`; handling must be idempotent. |

### Tier-2 semantic checks (LLM-verified)

The auditor reads these categories and reports findings against them:

- **Catalog Service / Live Search queries** — request only needed fields; handle `errors[]` in the GraphQL response; send required headers (`Magento-Environment-Id`, `Magento-Store-View-Code`, `Magento-Website-Code`, `x-api-key`); apply Live Search query rules / facets server-appropriately.
- **Storefront Events SDK / Data Connection** — don't collect PII beyond consent; gate on the consent signal; don't forward secrets in event context.
- **Performance** — PDP/PLP are commonly LCP → defer non-critical drop-ins; cache Catalog Service responses where allowed; avoid N+1 product-search calls.
- **Drop-ins** — use official `@dropins/storefront-*` components + the event bus rather than bespoke state; sanitize URL params (`sku`, `q`, category id) before use.
- **PaaS ↔ SaaS portability** — keep the data layer behind the configured client so a PaaS/SaaS switch is config-only.

### How to run

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine commerce-saas --path ./storefront

# LLM Tier 2 focused on drop-in tenancy + Core Web Vitals (via chat):
#   "deep audit my Commerce SaaS storefront focused on drop-in tenancy and CWV"
```

---

## Sonar rule pack

Source: [`skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/commerce-saas/rules.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/commerce-saas/rules.md).

Language: **JavaScript / TypeScript**.

| Pillar | Rule IDs | Severity |
|--------|----------|----------|
| Bug (Reliability) | `S2259` Unchecked Null / Undefined, `S2589` Gratuitous Boolean Expressions | HIGH / LOW |
| Vulnerability (Security) | `S5131` DOM XSS via `innerHTML`, `S2068` Hardcoded API Keys / Tokens, `S4502` Prototype Pollution via `Object.assign` | HIGH / CRITICAL / HIGH |
| Security Hotspot | `S4507` Analytics Data Exposure (PII in event context) | MEDIUM |
| Code Smell (Maintainability) | `S3776` Cognitive Complexity, `S1192` Duplicated String Literals, `S1481` Unused Local Variables | MEDIUM / LOW / LOW |
| Duplication | `S125` Commented-out Code | LOW |
| Complexity | `S138` Functions with Too Many Lines | MEDIUM |

### How to run

```bash
# Step 1 (chat): "sonar scan my Commerce SaaS storefront"
# Step 2 (deterministic ingest):
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json --engine commerce-saas --path .
```

---

## How to extend

The SaaS pack is intentionally small and stable. New rules should either target a specific SaaS service (Catalog Service / Live Search / Data Connection) or a well-known drop-in anti-pattern. See [Writing rule packs](../../contributing/writing-rule-packs).
