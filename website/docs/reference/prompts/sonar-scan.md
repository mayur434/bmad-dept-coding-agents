---
id: sonar-scan
title: Sonar Scan
sidebar_position: 2
description: Copy-paste prompts for the Sonar Scan agent, per stack, including the 2-step scan→ingest workflow and Quality Gate CI prompts.
---

Copy-paste prompts for the **Sonar Scan agent** (`bmad-dept-code-sonar-scan-agent`). The scan is a **two-step** workflow:

1. **Step 1** — LLM-driven scan (chat) produces `sonar-findings.json` in the configured `sonar_output` directory.
2. **Step 2** — deterministic ingest reads that JSON, computes Reliability / Security / Maintainability ratings (A–E), evaluates the Quality Gate (PASS = all three A; any non-A = FAIL), and emits the standardized `.xlsx` + Vulnerabilities sheet + Markdown twin + `CHANGE-LOG.md` append.

Source: extracted from [`PROMPTS.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/PROMPTS.md) §2. Related: [Sonar Scan agent](../../agents/sonar-scan) · [Scoring Model](../scoring-model#3-sonar-style-ratings-a-e) · [Rule Packs](../rule-packs/aem).

---

## 1. AEM

```text
sonar scan my AEM project
sonar scan my AEMaaCS project
sonar scan my AEM AMS code
sonar scan --engine aem --path /path/to/aem-project
sonar scan my AEM project focused on security vulnerabilities
sonar scan my AEM project with quality gate strict mode
sonar scan my AEM project and cut a branch from production
```

```text
ingest sonar findings from ./sonar-reports/sonar-findings.json
ingest sonar findings and create a new branch
ingest ./sonar-findings.json --engine aem --path .
```

---

## 2. Adobe Commerce PaaS

```text
sonar scan my Commerce project
sonar scan Magento
sonar scan --engine commerce-paas --path .
Magento quality gate — strict mode
sonar scan my PHP Commerce project focused on SQL injection and XSS
sonar scan Commerce PaaS on a new branch from staging
```

---

## 3. Adobe Commerce SaaS

```text
sonar scan my Commerce SaaS storefront
sonar scan my drop-ins
Live Search quality check
sonar scan --engine commerce-saas --path ./storefront
sonar scan the storefront JS focused on XSS and prototype pollution
```

---

## 4. Sling / Shaft

```text
sonar scan my Sling project
Shaft sonar scan
sling-12 quality scan
scan Shaft middleware
sonar scan --engine sling --path /path/to/shaft
sonar scan my Sling code focused on resource resolver leaks and admin sessions
```

---

## 5. Spring Boot

```text
sonar scan my Spring project
Spring Boot sonar
scan my Spring service
sonar scan --engine spring --path .
sonar scan my Spring service focused on Spring Security misuse
sonar scan Spring Boot with quality gate strict mode
```

---

## 6. Adobe App Builder

```text
sonar scan App Builder
IO Runtime quality scan
scan my aio project
check my App Builder app
sonar scan --engine app-builder --path .
sonar scan my App Builder actions focused on secrets and cold-start regressions
```

---

## 7. EDS

```text
sonar scan EDS
Franklin quality gate
scan my helix blocks
sonar scan --engine eds --path .
sonar scan my EDS site focused on prototype pollution and CSP violations
```

---

## 8. EDS + Commerce

```text
sonar scan EDS+Commerce
EDS commerce overlay scan
scan my EDS drop-in project
sonar scan --engine eds-commerce --path .
sonar scan my EDS+Commerce site focused on drop-in tenancy and CSP
```

---

## 2-step (scan → ingest) chained prompts

```text
sonar scan my project (Step 1 — writes sonar-findings.json)
ingest sonar findings from ./sonar-reports/sonar-findings.json (Step 2)
ingest ./sonar-findings.json --create-branch
```

Chain both steps in one message:

```text
sonar scan my AEM project, then ingest the resulting sonar-findings.json and cut a branch from production
```

```text
sonar scan my Spring service, ingest the findings, and fail if the Quality Gate is not PASS
```

---

## Quality Gate CI prompts

```text
sonar scan my project and print PASS / FAIL only
sonar scan my project with quality gate strict mode
which finding drove the Quality Gate to FAIL?
show me the Reliability / Security / Maintainability ratings from the last scan
list every non-A rating with the driving finding
export the Quality Gate verdict as a machine-readable JSON exit
```

---

## Follow-up prompts (any stack)

```text
explain this vulnerability: <ruleId or finding number>
produce a remediation plan for the top 10 vulnerabilities
generate a Reliability / Security / Maintainability trend line
list every Security Hotspot with a concrete recommended fix
show only the Blocker + Critical findings
which finding drove the Quality Gate to FAIL?
map every Vulnerability to CWE and OWASP Top 10
export the Vulnerabilities sheet as CSV
```
