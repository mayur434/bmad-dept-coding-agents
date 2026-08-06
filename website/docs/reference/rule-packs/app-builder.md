---
title: App Builder
sidebar_position: 6
description: Audit + Sonar rule packs for Adobe App Builder (IO Runtime actions, API Mesh, IO Events, UI Extensibility).
---

# Adobe App Builder — audit + sonar rule packs

Covers **Adobe App Builder** — serverless actions on IO Runtime, API Mesh for GraphQL stitching, IO Events for evented integrations, and UI Extensibility (UIX) for admin panel embeds. Engine ID: `app-builder`. Aliases: `app-builder-mesh`, `appbuilder`.

Includes two UI Extensibility sub-packs, one for **AEM UIX** and one for **Commerce UIX**.

Related pages: [Audit agent](../../agents/audit) · [Sonar Scan agent](../../agents/sonar-scan).

---

## Audit rule pack (12 rules)

Source: [`skills/bmad-dept-code-audit-agent/resources/rule-packs/app-builder/rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/app-builder/rules.md) (409 lines).

| Category | Rules | Focus |
|----------|:-----:|-------|
| Architecture | 3 | Action shape + response contract, sequence composition correctness, `app.config.yaml` runtime target discipline (`APPB-ARCH-001..003`). |
| Security | 3 | No hardcoded IO Runtime / Commerce credentials, webhook signature verification (HMAC via `aio-lib-events` / `crypto.timingSafeEqual`), no PII in action logs (`APPB-EVT-001`, `APPB-SEC-001..002`). |
| API Mesh | 2 | Resolver rate limits + timeouts, source-schema drift protection (`APPB-MESH-001..002`). |
| Performance | 2 | Cold-start heavy imports, unbounded concurrent fetches inside an action (`APPB-PERF-001..002`). |
| Configuration | 2 | Missing `manifest.yml` inputs / secrets declaration, workspace mismatch across environments (`APPB-CFG-001..002`). |

Severity distribution (approximate): CRITICAL 3, HIGH 5, MEDIUM 4.

---

## UI Extensibility sub-packs

### AEM UIX rules (14 rules)

Source: [`skills/bmad-dept-code-audit-agent/resources/rule-packs/app-builder/aem-ui-extensibility-rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/app-builder/aem-ui-extensibility-rules.md) (428 lines).

| Category | Rules | Focus |
|----------|:-----:|-------|
| Architecture | 4 | Extension registration + iframe host contract, React Spectrum discipline, AEM assets vs sites extension separation, guest-token lifetime. |
| Security | 3 | CSP compliance for iframe embeds, no `postMessage` origin bypass, safe use of `AEM_HOST` env. |
| Extension Point | 3 | Correct extension-point IDs (`headerMenu`, `actionBar`, `productDetails`), missing `getExtensions()` factory, over-broad permissions. |
| Performance | 2 | Deferred imports for the extension iframe, `React.lazy` for panels. |
| Configuration | 2 | Workspace vs runtime alignment, missing `extension.js` bundle in `dist/`. |

### Commerce UIX rules (13 rules)

Source: [`skills/bmad-dept-code-audit-agent/resources/rule-packs/app-builder/commerce-ui-extensibility-rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/app-builder/commerce-ui-extensibility-rules.md) (394 lines).

| Category | Rules | Focus |
|----------|:-----:|-------|
| Architecture | 3 | Extension registration for Adobe Commerce Admin, Commerce host bridge, isolated bundle. |
| Security | 3 | CSRF token forwarding to Commerce Admin REST, admin ACL awareness, safe deep-links back to Commerce. |
| Extension Point | 3 | Correct extension-point IDs (`orderDetails`, `productAttributes`, `catalogGrid`), missing `getExtensions()` factory, over-broad permissions. |
| Performance | 2 | Deferred imports, avoid blocking calls on grid render. |
| Configuration | 2 | Workspace alignment, missing bundle in `dist/`. |

### How to run

```bash
# Audit the App Builder action set + UIX extensions
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine app-builder --path ./actions

# Chat-driven focus prompts:
#   focus on IO Runtime action timeouts and cold starts
#   focus on API Mesh resolver perf and rate limits
#   focus on event registration and adobe-io-events best practices
```

---

## Sonar rule pack

Source: [`skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/app-builder/rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/app-builder/rules.md).

Language: **JavaScript / TypeScript** (Node.js).

| Pillar | Rule IDs | Severity |
|--------|----------|----------|
| Bug (Reliability) | `S2259` Unhandled Promise Rejection / Null Response, `S1854` Dead Stores | HIGH / LOW |
| Vulnerability (Security) | `S5131` Server-Side Request Forgery (SSRF), `S2068` Hardcoded Adobe IO / Commerce Credentials, `S4502` Injection via Unvalidated Event Payload | HIGH / CRITICAL / HIGH |
| Security Hotspot | `S4507` Unrestricted Action Access (missing `require-adobe-auth`) | MEDIUM |
| Code Smell (Maintainability) | `S3776` Cognitive Complexity, `S1192` Duplicated String Literals, `S1481` Unused Variables | MEDIUM / LOW / LOW |
| Duplication | `S125` Commented-out Code | LOW |
| Complexity | `S138` Action Functions with Too Many Lines | MEDIUM |

### How to run

```bash
# Step 1 (chat): "sonar scan my App Builder project"
# Step 2 (deterministic ingest):
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json --engine app-builder --path .
```

---

## How to extend

New rules should fit under an existing category (Architecture / Security / API Mesh / Performance / Configuration) or target a specific UIX extension-point contract. See [Writing rule packs](../../contributing/writing-rule-packs).
