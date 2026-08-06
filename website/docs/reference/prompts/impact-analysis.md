---
id: impact-analysis
title: Impact Analysis
sidebar_position: 4
description: Copy-paste prompts for the Impact Analysis agent — Proofhub CSV, BRD, PR-diff, and blast-radius interpretation prompts.
---

Copy-paste prompts for the **Impact Analysis agent** (`bmad-dept-code-impact-analysis-agent`). This agent is **input-driven**, not scanner-driven: give it a Proofhub bug/task export (`--bugs`, CSV) and/or a BRD document (`--brd`; `.docx`, `.md`, `.txt`). At least one input is required.

The agent emits **Input Traceability** — every input item appears in the output; items with no code match show an `INFO` "needs manual review" row.

Source: extracted from [`PROMPTS.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/PROMPTS.md) §4. Related: [Impact Analysis agent](../../agents/impact-analysis) · [CLI Flags](../cli-flags).

---

## 1. Proofhub CSV — all stacks

```text
trace the impact of these bugs: /path/to/bugs.csv
analyze impact of this bug export at ./proofhub-export.csv
what does fixing these bugs affect?
blast radius of the bugs in /path/bugs.csv
analyze impact --bugs ./proofhub-export.csv --path .
```

```text
trace impact of a single bug ID PH-1234 from ./bugs.csv
filter the bug export to CRITICAL and HIGH only, then trace impact
trace impact of bugs affecting the Checkout module only
per-module blast radius of the attached Proofhub export
```

---

## 2. BRD document — all stacks

```text
analyze the impact of this BRD: /path/to/requirements.docx
analyze impact --brd ./BRD.docx --engine spring --path .
what does building this BRD affect?
assess upgrade risk from the requirements in /path/spec.docx
analyze the impact of BRD.md (markdown fallback)
analyze the impact of spec.txt (plain-text fallback)
```

---

## 3. Combined (bugs + BRD)

```text
trace impact from bugs /path/bugs.csv and BRD /path/spec.docx
combined impact analysis of ./bugs.csv and ./requirements.docx
run impact analysis on my Spring Boot project using ./bugs.csv and ./BRD.docx
```

---

## 4. PR-diff / branch-comparison variants

```text
impact-analyze the diff between production and this branch
run impact analysis on the files changed in PR #482
what's the blast radius of the commits since main branched?
impact analysis for the delta between release/2.4.7-p7 and release/2.4.7-p9
```

---

## 5. Per-stack invocation

```text
run impact analysis on my AEM project using ./bugs.csv
run impact analysis on my Commerce project using ./bugs.csv
run impact analysis on my Commerce SaaS storefront using ./BRD.docx
run impact analysis on my Sling/Shaft project using ./bugs.csv
run impact analysis on my Spring Boot service using ./BRD.docx
run impact analysis on my App Builder project using ./bugs.csv
run impact analysis on my EDS site using ./BRD.docx
run impact analysis on my EDS+Commerce project using ./bugs.csv and ./BRD.docx
```

---

## 6. Blast-radius / risk-score follow-ups

```text
summarize the impacted files
show only the CRITICAL and HIGH impacted files
which inputs had no code match?
show the input-to-code traceability
what's the reverse-dependency graph for src/Model/OrderProcessor.php?
which bugs cluster around the same files?
explain the risk score for the top 5 impacted files
which modules should we regress-test based on this impact set?
```

```text
group impacted files by module
group impacted files by owner (git blame)
what percentage of open bugs have zero code impact (candidates for triage)?
identify the smallest set of files to fix that resolves 80% of impacted bugs
produce a Jira-ready epic per impact cluster with one story per bug
```
