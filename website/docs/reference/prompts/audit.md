---
id: audit
title: Audit
sidebar_position: 1
description: Copy-paste prompts for the Code Audit agent, per stack, with cross-cutting flag templates and follow-up prompts.
---

Copy-paste prompts for the **Code Audit agent** (`bmad-dept-code-audit-agent`). Send the whole block or a single line — the agent parses natural language and resolves flags, paths, and engine automatically.

**Modes:** `scan` = Tier 1 deterministic scanner only (zero LLM tokens). `deep audit` = Tier 2 LLM semantic analysis only. `full audit` = both.

Source: extracted from [`PROMPTS.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/PROMPTS.md) §1. Related: [Audit agent](../../agents/audit) · [CLI Flags](../cli-flags) · [Rule Packs](../rule-packs/aem).

---

## Cross-cutting flag templates

One prompt per flag — reuse for any stack:

```text
scan --engine aem --path /path/to/project
scan --engine spring --path .
scan --engine commerce-saas --path ./storefront
```

```text
full audit my project --create-branch
full audit my project --create-branch --source-branch production
audit my Spring service on a new branch from main
```

```text
audit my project --preflight
audit my project --no-preflight
audit my project and skip preflight
```

```text
scan my Commerce project --db /path/to/dump.sql
full audit with DB dump at /var/backup/prod.sql
scan with BRD impact analysis using /path/to/requirements.docx
scan with bug report from /path/to/bugs.xlsx
```

```text
audit my AEM project --format excel
audit my AEM project --format md
audit my AEM project --format pdf
audit my AEM project --format all
```

```text
scan my AEM Cloud Service project --platform aemcs
scan my AEM AMS project --platform aemams
scan my AEM project --platform both
```

---

## 1. AEM (AEMaaCS + AMS)

```text
scan my AEM project
scan my AEM project and name it "Client Name"
scan my AEM project at /Users/me/code/aem-project
scan --engine aem --path /path/to/project
scan my AEM Cloud Service project
scan my AEM AMS project
scan my AEM project --platform both
scan my AEM project --format all
```

```text
deep audit my AEM project
deep audit my AEM project and name it "Wipro"
run LLM analysis on my AEM codebase
full audit my AEM project
full audit my AEMaaCS project --format all
complete audit of my AEMaaCS project --create-branch
```

```text
audit only the core bundle at ui.apps/core
audit only /apps/mysite/components
scan the dispatcher config at dispatcher/src
focus on Sling Model caching and Oak query traversals
focus on HTL security (data-sly-use, XSS) and clientlib patterns
focus on cloud-readiness (mutable content, runmodes, Cloud SDK compat)
```

---

## 2. Adobe Commerce (PaaS)

```text
scan my project
scan my project and name it "Acme"
scan only the Checkout and Payment modules
scan only the Custom namespace
scan --engine commerce --path /path/to/magento
scan --engine commerce-paas --path .
```

```text
scan my project with DB dump at /path/to/dump.sql
scan with BRD impact analysis using /path/to/requirements.docx
scan with bug report from /path/to/bugs.xlsx
analyze patch upgrade impact from 2.4.7-p7 to 2.4.7-p9
run full scanner: code + DB + BRD + patch analysis
```

```text
deep audit my project
full audit my project
run full audit named "X" with DB at /path.sql, BRD at /path.docx, bugs at /path.xlsx, patch 2.4.7-p7 to 2.4.7-p9
full audit --engine commerce-paas --create-branch --source-branch production
```

---

## 3. Adobe Commerce SaaS

```text
scan my Commerce SaaS storefront
scan --engine commerce-saas --path ./storefront
scan only the drop-ins at src/dropins
scan Live Search integration and Catalog Service queries
deep audit my Commerce SaaS project
full audit my Commerce SaaS storefront
```

```text
focus on drop-in accessibility and Core Web Vitals
audit our GraphQL query shape for Catalog Service
which pages break under Live Search failures?
```

---

## 4. Sling / Shaft (sling-12)

```text
scan my Sling project
scan my Shaft project
scan --engine sling --path /path/to/shaft
deep audit my sling-12 middleware
full audit my Sling project
full audit my Shaft middleware --create-branch
```

```text
focus on Sling filter chain ordering and priority
focus on resource resolver leaks and admin session use
focus on OSGi service ranking, DS component lifecycle
focus on Oak query indexes and JCR traversals
audit only src/main/java/com/company/shaft/filters
```

---

## 5. Spring Boot

```text
scan my Spring Boot project
scan --engine spring --path .
deep audit my Spring Boot service
full audit my Spring Boot app
full audit my Spring app --create-branch --source-branch main
```

```text
focus on Spring Security (auth, CSRF, method security)
focus on JPA N+1 queries and lazy-loading traps
focus on actuator exposure and management endpoints
focus on @Async / thread-pool configuration
audit only the controllers under src/main/java/com/acme/api
audit only the persistence layer
```

---

## 6. Adobe App Builder

```text
scan my App Builder project
scan --engine app-builder --path ./actions
deep audit my App Builder actions
full audit my App Builder app
focus on IO Runtime action timeouts and cold starts
focus on API Mesh resolver perf and rate limits
focus on event registration and adobe-io-events best practices
audit only actions/checkout
```

---

## 7. EDS

```text
scan my EDS site
scan --engine eds --path ./
deep audit this EDS project
full audit my EDS project
focus on Core Web Vitals (LCP, CLS, INP) and lazy-loading
focus on block hydration and script placement
audit only blocks/hero and blocks/cards
```

---

## 8. EDS + Commerce

```text
scan my EDS Commerce project
scan --engine eds-commerce --path .
full audit my EDS+Commerce site
focus on drop-in overlay integration and pdp/plp hydration
focus on Catalog Service query fan-out from EDS
audit only blocks/product-details
```

---

## Follow-up prompts (post-run)

Reusable after any Audit run:

```text
summarize the audit findings
summarize CRITICAL findings
show all CRITICAL findings from the audit
show me all CRITICAL severity items
what are the top 10 highest-risk findings?
which modules have the most issues?
show all security findings
show all performance findings
show all cloud-readiness findings for AMS→AEMaaCS migration
```

```text
create a fix plan for the critical issues
create a fix plan for HIGH+CRITICAL
estimate effort to fix all HIGH and CRITICAL findings
estimate effort in ideal-days
generate an executive summary for leadership
produce a stakeholder-ready email
output a Jira-ready ticket per finding
map findings to CWE
map findings to OWASP Top 10
export findings as JSON
update thresholds: god_class_lines=600, fat_constructor_deps=12
```
