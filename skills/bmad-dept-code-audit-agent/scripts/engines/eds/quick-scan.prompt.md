---
description: "Quick Scan — Run a fast EDS code audit (88 rules, 15 categories, no LLM). Produces a styled Excel report with scores, findings, and recommendations."
---

# EDS Quick Scan

When the user says **"quick scan my project"**, **"scan my project"**, **"run quick scan"**, or similar, run the EDS quick-scan engine. This is a **Tier 1** deterministic static analysis — no LLM tokens are consumed.

## What you need from the user

- **Project path** (required): Local directory path to the EDS project to scan.
- **Project name** (optional): A friendly label for the report. Defaults to the folder name.

## Pre-flight: Auto-install Dependencies

Before running, ensure Node dependencies are installed:

```
cd "skills/bmad-dept-code-audit-agent/scripts"
if (!(Test-Path node_modules)) { npm install --silent }
```

## How to run

Execute this command in the terminal:

```
cd "skills/bmad-dept-code-audit-agent/scripts"
npx ts-node engines/eds/quick-scan.ts --path "<PROJECT_PATH>" --name "<PROJECT_NAME>"
```

### Optional flags

| Flag | Purpose |
|------|---------|
| `--path` | **(Required)** Local project directory to scan |
| `--name` | Friendly project name for the report header |
| `--output` | Output directory for the Excel report (default: current dir) |
| `--json` | Also generate a JSON report alongside the Excel |
| `--silent` | Suppress progress logs (only JSON summary line printed) |

## Output

The last line of stdout is always a JSON object for programmatic consumption:
```json
{"score":56,"findings":3596,"critical":12,"high":89,"medium":1200,"low":2295,"filesScanned":234,"linesOfCode":45000,"ruleChecks":2808,"duration":"8.2s","report":"D:\\path\\to\\report.xlsx"}
```

## After the scan completes

1. Parse the JSON output line to extract the `report` path and `score`.
2. Tell the user: **"Quick scan complete! Score: {score}/100 with {findings} findings. Report saved to: {report}"**
3. Offer to open or reveal the Excel file.

## Rules & Categories (88 rules across 15 categories)

| # | Category | Rule Prefix | Rules | Status |
|---|----------|-------------|-------|--------|
| 1 | Architecture | EDS-ARCH | 12 | ✅ Implemented |
| 2 | Performance | EDS-PERF | 12 | ✅ Implemented |
| 3 | Security | EDS-SEC | 5 | ✅ Implemented |
| 4 | SEO | EDS-SEO | 4 | ✅ Implemented |
| 5 | Accessibility | EDS-A11Y | 5 | ✅ Implemented |
| 6 | Code Quality | EDS-QUAL | 6 | ✅ Implemented |
| 7 | CSS | EDS-CSS | 6 | ✅ Implemented |
| 8 | JavaScript | EDS-JS | 5 | ✅ Implemented |
| 9 | Linting | EDS-LINT | 4 | ✅ Implemented |
| 10 | Content Practices | EDS-CONTENT | 4 | ✅ Implemented |
| 11 | Dev Workflow | EDS-DEV | 6 | ✅ Implemented |
| 12 | Git Hooks | EDS-HOOKS | 5 | ✅ Implemented |
| 13 | Observability | EDS-OBS | 3 | 🔜 Planned |
| 14 | Go-Live Readiness | EDS-LIVE | 4 | 🔜 Planned |
| 15 | Block Patterns | EDS-BLOCK | 7 | 🔜 Planned |

**Currently active:** 12 analyzers covering 75 rules from categories 1-12.
**Planned:** 3 additional analyzers (Observability, Go-Live, Block Patterns) adding 14 more rules.

## Key facts

- Runs ALL implemented EDS audit rules using pure static analysis (regex/pattern matching).
- No LLM tokens are consumed during the scan itself.
- The Excel report has the same format as the full audit: Summary sheet, per-category sheets with severity banners, low-score files, and processing metrics.
- Typical scan time: 5-15 seconds depending on project size.
- Engine auto-detection: Looks for `blocks/`, `helix-query.yaml`, `fstab.yaml`, `scripts/aem.js` as EDS project signals.
- Full rule documentation: `resources/rule-packs/eds/rules.md`

## Difference from full audit (`audit.ts`)

| Feature | `quick-scan.ts` | `audit.ts` |
|---------|-----------------|------------|
| Interactive menu | No | Yes (open/reveal/exit) |
| PageSpeed Insights | No | Yes (via `--pagespeed`) |
| GitHub repo fetch | No | Yes (via `--github`) |
| JSON summary line | Always printed | Not printed |
| LLM usage | None | None |
| Report format | Same Excel | Same Excel |
