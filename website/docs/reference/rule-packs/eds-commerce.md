---
id: eds-commerce
title: EDS + Commerce
sidebar_position: 8
description: Audit + Sonar rule packs for the EDS + Commerce hybrid storefront (drop-ins consuming Commerce SaaS APIs).
---

Covers the **EDS + Commerce** hybrid — an EDS block-based storefront wired to Adobe Commerce SaaS APIs (Catalog Service, Live Search, Cart, Checkout) via the official `@dropins/storefront-*` drop-in components. Engine ID: `eds-commerce`.

Related pages: [Audit agent](../../agents/audit) · [Sonar Scan agent](../../agents/sonar-scan) · [EDS](eds) · [Commerce SaaS](commerce-saas).

---

## Audit rule pack (13 rules)

Source: [`skills/bmad-dept-code-audit-agent/resources/rule-packs/eds-commerce/rules.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/eds-commerce/rules.md) (1093 lines).

| Category | Rules | Focus |
|----------|:-----:|-------|
| Architecture | 4 | Drop-in block file layout, dropin-block vs plain-EDS-block contract, isolated bundle per drop-in, correct `@dropins/storefront-*` version pinning. |
| Performance | 4 | PDP / PLP LCP defense, Catalog Service query size, prefetch on hover with cancellation, deferred cart hydration. |
| Security | 3 | No admin/integration tokens client-side, sanitize `sku` / `q` / category IDs from URL, CSP-compatible drop-in code. |
| Integration | 2 | Correct `Magento-Environment-Id` / `Magento-Store-View-Code` / `Magento-Website-Code` header wiring, event-bus subscription lifecycle. |

Severity distribution (approximate): CRITICAL 2, HIGH 4, MEDIUM 5, LOW 2.

### How to run

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine eds-commerce --path .

# Chat-driven focus prompts:
#   focus on drop-in overlay integration and pdp/plp hydration
#   focus on Catalog Service query fan-out from EDS
#   audit only blocks/product-details
```

---

## Sonar rule pack

Source: [`skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/eds-commerce/rules.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/eds-commerce/rules.md).

Language: **JavaScript** (browser).

| Pillar | Rule IDs | Severity |
|--------|----------|----------|
| Bug (Reliability) | `S2259` Commerce API Null Guards, `S2589` Gratuitous Boolean Expressions | HIGH / LOW |
| Vulnerability (Security) | `S5131` DOM XSS via Commerce Product HTML, `S2068` Hardcoded Commerce API Key, `S4502` Cart Mutation with Unvalidated SKU | HIGH / CRITICAL / HIGH |
| Security Hotspot | `S4507` Storefront Event PII | MEDIUM |
| Code Smell (Maintainability) | `S3776` Cognitive Complexity, `S1192` Duplicated String Literals, `S1481` Unused Variables | MEDIUM / LOW / LOW |
| Duplication | `S125` Commented-out Code | LOW |
| Complexity | `S138` Functions with Too Many Lines | MEDIUM |

### How to run

```bash
# Step 1 (chat): "sonar scan my EDS+Commerce site"
# Step 2 (deterministic ingest):
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json --engine eds-commerce --path .
```

---

## How to extend

The EDS + Commerce pack should stay a thin overlay on top of the [EDS](eds) and [Commerce SaaS](commerce-saas) packs — new rules should target the *integration seam* (drop-in wiring, event-bus, Catalog Service query shape). See [Writing rule packs](../../contributing/writing-rule-packs).
