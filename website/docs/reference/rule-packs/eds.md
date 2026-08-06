---
id: eds
title: EDS
sidebar_position: 7
description: Audit + Sonar rule packs for Adobe Edge Delivery Services (EDS / Franklin / Helix).
---

Covers **Adobe Edge Delivery Services** — vanilla-JS block-based storefronts served from Helix / Franklin, authored in Google Docs / SharePoint, and hydrated in the browser. Engine ID: `eds`. Aliases: Franklin, Helix.

Related pages: [Audit agent](../../agents/audit) · [Sonar Scan agent](../../agents/sonar-scan) · [EDS + Commerce](eds-commerce).

---

## Audit rule pack (17 rules)

Source: [`skills/bmad-dept-code-audit-agent/resources/rule-packs/eds/rules.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/eds/rules.md) (1247 lines).

| Category | Rules | Focus |
|----------|:-----:|-------|
| Architecture | 4 | Block contract (`decorate()` signature, block CSS scope), `scripts/scripts.js` bootstrap discipline, `head.html` size, sidekick plugin boundaries. |
| Performance | 5 | Core Web Vitals — LCP hero block, CLS on late-injected media, INP on hydration, image `loading="eager"` for LCP, deferred non-critical blocks. |
| Security | 3 | No inline `<script>` in Docs, CSP-friendly block code, sanitize Doc-authored HTML (`innerHTML` avoidance). |
| SEO | 2 | Proper `<title>` + meta from Doc metadata, canonical + Open Graph mapping. |
| Code Quality | 3 | No `console.log` in prod, no dead / commented-out block code, block filenames match block class. |

Severity distribution (approximate): CRITICAL 1, HIGH 4, MEDIUM 8, LOW 4.

### How to run

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine eds --path ./

# Chat-driven focus prompts:
#   focus on Core Web Vitals (LCP, CLS, INP) and lazy-loading
#   focus on block hydration and script placement
#   audit only blocks/hero and blocks/cards
```

---

## Sonar rule pack

Source: [`skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/eds/rules.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/eds/rules.md).

Language: **JavaScript** (browser).

| Pillar | Rule IDs | Severity |
|--------|----------|----------|
| Bug (Reliability) | `S2259` Unchecked DOM Query Results, `S2589` Gratuitous Boolean Expressions, `S1854` Dead Stores | HIGH / LOW / LOW |
| Vulnerability (Security) | `S5131` DOM XSS via `innerHTML`, `S2068` Hardcoded API Endpoints / Keys | HIGH / CRITICAL |
| Security Hotspot | `S4507` Unvalidated Fetch from Dynamic URLs | MEDIUM |
| Code Smell (Maintainability) | `S3776` Cognitive Complexity, `S1192` Duplicated String Literals, `S1481` Unused Local Variables | MEDIUM / LOW / LOW |
| Duplication | `S125` Commented-out Code | LOW |
| Complexity | `S138` Functions with Too Many Lines | MEDIUM |

### How to run

```bash
# Step 1 (chat): "sonar scan my EDS site"
# Step 2 (deterministic ingest):
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json --engine eds --path .
```

---

## How to extend

EDS pack rules should be block-file-local wherever possible (each block is one folder under `blocks/<name>/`). See [Writing rule packs](../../contributing/writing-rule-packs).
