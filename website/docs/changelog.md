---
id: changelog
title: Changelog
sidebar_position: 92
description: Auto-maintained per-run log — each DCA agent invocation appends a Keep-a-Changelog entry to CHANGE-LOG.md at the project root.
---

`CHANGE-LOG.md` is **auto-maintained** by the DCA agents. Each run appends a dated entry (most recent first) spliced in right after the `<!-- dca:entries -->` marker. The writer is [`skills/shared/git/changelog.ts`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/shared/git/changelog.ts) and is called by every agent through the shared `emitStandardOutputs` pipeline.

- **Location** — `<projectRoot>/CHANGE-LOG.md` (each installed project has its own; this repo also carries its own).
- **Format** — Keep-a-Changelog flavored, one entry per agent run.
- **Newest first** — entries are always spliced immediately after the marker.
- **Header pattern** — `## YYYYMMDD_HHMMSS — agent — stack — project`.

## Where to see the file

- **This module's log** — [CHANGE-LOG.md on GitHub](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/CHANGE-LOG.md).
- **In your installed project** — `cat <projectRoot>/CHANGE-LOG.md` after your first agent invocation.

## Entry format

Every entry has the same shape (from [IMPLEMENTATION-PLAN.md §4.A](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/IMPLEMENTATION-PLAN.md)):

```markdown
## 20260801_143512 — audit — commerce — Acme

- **Branch:** dca/audit-commerce-20260801_143512 from production
- **Summary:** 87 findings across 42 files
- **Findings:** 87 total (CRITICAL 4, HIGH 12, MEDIUM 41, LOW 25, INFO 5)
- **Report:** audit-dca-audit-commerce-20260801_143512-agent-report.xlsx
- **Files changed:** 0
- **Details:** …
```

## Fields

| Field | Content |
|-------|---------|
| **Header** | `## timestamp — agent — stack — project` (angle-bracketed in the file itself). |
| **Branch** | Working branch (`x`) from source branch (`y`) — the source is `production` / `main` / `master` / `develop` (or `--source-branch <name>`). |
| **Summary** | One-sentence natural-language summary of what the agent produced. |
| **Findings** | `N total (CRITICAL n, HIGH n, …)` — always present, even when N = 0. |
| **Report** | The `.xlsx` filename emitted by the run (the primary deliverable). |
| **Files changed** | For Code Generation: the number of files the scaffolder wrote. For other agents: `0` unless the run mutated project files. |
| **Details** | Free-form additional context per run. |

## See also

- [Standardized outputs contract](./concepts/standardized-outputs) — the full three-artifact set (xlsx + md + CHANGE-LOG entry).
- [The Agents](./concepts/the-agents) — which agents write to CHANGE-LOG (all of them).
- [chain-all workflow](./workflows/chain-all) — note that chained runs currently produce five CHANGE-LOG entries per invocation (four stage entries + one roll-up entry).
