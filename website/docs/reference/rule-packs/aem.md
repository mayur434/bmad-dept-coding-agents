---
id: aem
title: AEM
sidebar_position: 1
description: Audit + Sonar rule packs for Adobe Experience Manager (AEMaaCS + AMS).
---

The `aem` engine covers both **AEM as a Cloud Service (AEMaaCS)** and **AEM AMS (on-prem / Managed Services)**. Two sub-packs live under `resources/rule-packs/aem/`: `aemcs/` (AEMaaCS-focused, 96 rules) and `aemams/` (AMS-focused, 48 rules). Select with `--platform aemcs`, `--platform aemams`, or `--platform both`.

Related pages: [Audit agent](../../agents/audit) · [Sonar Scan agent](../../agents/sonar-scan) · [Scoring Model](../scoring-model) · [Writing rule packs](../../contributing/writing-rule-packs).

---

## Audit rule pack

### AEMaaCS sub-pack (96 rules)

Source: [`skills/bmad-dept-code-audit-agent/resources/rule-packs/aem/aemcs/rules.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/aem/aemcs/rules.md) (4072 lines).

| Category | Rules | Focus |
|----------|:-----:|-------|
| Architecture | 5 | Mutable-vs-immutable content, Classic UI ban, runmode configs, `/libs` overlay depth, repoinit. |
| Sling / OSGi | 5 | Resource-resolver + JCR-session leaks, deprecated `@SlingServlet` / Felix SCR annotations, Sling Model adaptable validation. |
| Performance | 8 | Async processing for heavy ops, unbounded queries, Sling Model caching, client-library size + proxy + render-blocking, inline scripts / styles, category proliferation. |
| Security | 4 | Hardcoded credentials, missing dispatcher rules, HTL/Sightly XSS, insufficient service-user permissions. |
| Cloud Readiness | 4 | Local filesystem access, custom install hooks, Oak index issues, scheduled tasks without leader election. |
| Code Quality | 10 | `printStackTrace()` / `System.out.println`, empty catch, generic exceptions, deprecated `WCMUsePojo`, hardcoded content paths, unused imports, TODO/FIXME. |
| SEO | 8 | Title / meta description / canonical / Open Graph / viewport / lang attribute / H1 duplication / descriptive link text. |
| Accessibility (WCAG 2.1) | 8 | Alt text, form labels, non-interactive `onClick`, focus outline, empty link/button, iframe title, pinch-to-zoom, table headers. |
| Dispatcher | 5 | Security headers, permissive filter rules, static-asset cache rules, sensitive-path blocks, TTL configuration. |
| HTL & Frontend | 9 | JSP-in-HTL, long expressions, hardcoded URLs, missing clientlib categories, `eval()` / `document.write()`, `console.log`, excessive `!important`, oversize templates. |
| Test Coverage | 6 | JaCoCo plugin, UI tests module, Sling-Model test coverage, mock defaults, etc. |
| Maintainability | 4 | Class + method size, cyclomatic complexity, deprecated API drift. |
| Dependencies & Versions | 7 | `uber-jar` versions, AEM SDK bumps, third-party CVE surface, transitive drift. |
| Frontend Framework (ui.frontend SPA) | 13 | Webpack config, source-map exposure, React/Vue anti-patterns, bundle-size, tree-shaking, HMR left in prod. |

Severity distribution (approximate): CRITICAL 12, HIGH 28, MEDIUM 34, LOW 18, INFO 4.

### AEM AMS sub-pack (48 rules)

Source: [`skills/bmad-dept-code-audit-agent/resources/rule-packs/aem/aemams/rules.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/aem/aemams/rules.md) (2305 lines).

| Category | Rules | Focus |
|----------|:-----:|-------|
| Architecture | 6 | AMS runmodes, `/apps` overlay pattern, package structure, Classic-UI residuals, Bundle vs Content packages, deploy topology. |
| Sling / OSGi | 7 | Same resolver/session leaks as AEMCS + AMS-specific DS component packaging + Felix SCR removal windows. |
| Performance | 11 | Heavier focus on JVM tuning, Oak query indexes, on-prem cache warmup, dispatcher farm layout. |
| Security | 5 | On-prem CRX/DE lockdown, SSL termination, admin session leakage, package-install ACLs. |
| AMS-Specific | 6 | AMS runmode conventions, Golden Master repo layout, `crx-quickstart` structure, custom install hooks (permitted here), on-prem-only paths. |
| Frontend Framework (ui.frontend SPA) | 13 | Same as AEMCS — the SPA pack is shared. |

The two sub-packs are additive when `--platform both` is chosen; deduplication is by rule ID.

### How to run

```bash
# AEMaaCS only
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine aem --platform aemcs --path .

# Both sub-packs, all output formats
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine aem --platform both --format all --path .
```

---

## Sonar rule pack

Source: [`skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/aem/rules.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-sonar-scan-agent/resources/rule-packs/aem/rules.md).

Language: **Java**. Applies to both AEMaaCS and AEM AMS. Severity + rating model: see [Scoring Model](../scoring-model).

| Pillar | Rule IDs | Severity |
|--------|----------|----------|
| Bug (Reliability) | `S2259` Null Pointer Dereference, `S1854` Dead Stores, `S2095` Resources Should Be Closed | HIGH / LOW / HIGH |
| Vulnerability (Security) | `S3649` SQL / JCR-SQL2 Injection, `S2068` Hardcoded Credentials, `S5131` XSS via Sling / HTL | CRITICAL / CRITICAL / HIGH |
| Security Hotspot | `S4507` Delivering Code with Debug Features | MEDIUM |
| Code Smell (Maintainability) | `S3776` Cognitive Complexity, `S1192` Duplicated String Literals | MEDIUM / LOW |
| Duplication | `S1144` Unused Private Methods | LOW |
| Complexity | `S138` Methods with Too Many Lines | MEDIUM |

Every rule ships with `❌ Detect-Bad` + `✅ Detect-Good` snippets and a concrete remediation. The Sonar Scan agent emits a Reliability/Security/Maintainability rating (A–E) computed per the [scoring model](../scoring-model#3-sonar-style-ratings-a-e); Quality Gate PASS requires all three ratings = A.

### How to run

```bash
# Step 1 (chat): "sonar scan my AEM project"
# Step 2 (deterministic ingest):
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json --engine aem --path .
```

---

## How to extend

Adding a new rule to either pack:

1. Copy the rule template from an existing pack file (Markdown heading + Severity + `❌`/`✅` snippets + Remediation).
2. Increment the rule counter in the category-level summary at the top of the pack.
3. If the rule is deterministic, tag it `[scanner: <RULE-ID>]` and wire the detector into the corresponding TypeScript engine under `scripts/engines/aem/`.
4. Add the rule to the sonar pack if it also maps to a Sonar pillar (Bug / Vulnerability / Hotspot / Smell / Duplication / Complexity).

See [Writing rule packs](../../contributing/writing-rule-packs) for the full authoring checklist.
