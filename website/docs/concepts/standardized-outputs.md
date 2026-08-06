---
id: standardized-outputs
title: Standardized Outputs
sidebar_position: 3
description: Three artifacts per run — XLSX, MD twin, CHANGE-LOG entry — with a 15-column Summary contract and a fixed sheet order.
---

Every agent, every stack, every run — through one shared `emitStandardOutputs()` entry point (`skills/shared/output/emit.ts`) — writes the same three artifacts.

## The three outputs

1. **`<agent>-<branch>-<timestamp>-agent-report.xlsx`** — ExcelJS workbook built by the shared `StandardExcelReport` (`skills/shared/report/standard-report.ts`). Fixed sheet order, 15-column Summary contract.
2. **`<agent>-<branch>-<timestamp>-agent-report.md`** — git-diffable Markdown twin (reduced 9-column Summary) written alongside the xlsx by default.
3. **`CHANGE-LOG.md`** — Keep-a-Changelog file at the project root. Each run splices one entry after the `<!-- dca:entries -->` marker (newest first).

## File naming

- `<agent>` — one of `audit`, `sonar-scan`, `generation`, `impact`, `test-coverage`.
- `<branch>` — the current git branch, sanitized (`/` → `-`). Falls back to `nobranch` outside a repo.
- `<timestamp>` — local time `YYYYMMDD_HHMMSS`.

Example: `audit-main-20260806_143512-agent-report.xlsx`.

## The 15-column Summary sheet contract

The Summary sheet's columns are the **contract**; their order is part of it. Do NOT reorder without a version bump.

| # | Column | Purpose |
|:-:|--------|---------|
| 1 | ID | Stable finding identifier (rule-id + hash of location). |
| 2 | Title | One-line problem statement. |
| 3 | Description | Longer explanation of what and why. |
| 4 | Tech Stack | Engine ID (e.g. `commerce`, `aem`, `spring`). |
| 5 | Category / Module | Rule category (Security, Performance, …) or Sonar pillar. |
| 6 | Code Reference | `path/to/file.ext:line[:col]`. |
| 7 | Severity | `CRITICAL` \| `HIGH` \| `MEDIUM` \| `LOW` \| `INFO`. |
| 8 | Confidence | `HIGH` \| `MEDIUM` \| `LOW` — how sure the engine is. |
| 9 | Rule ID | Rule pack identifier (or `SONAR:*`, `CWE:*`, etc.). |
| 10 | Recommendation / Fix | Concrete remediation snippet. |
| 11 | Impact Analysis | What breaks / who is affected. |
| 12 | Effort | S / M / L estimate. |
| 13 | Dev Comments | Free-text triage column. |
| 14 | Owner | Assignee (blank by default). |
| 15 | Status | `Open` / `In Progress` / `Fixed` / … (blank by default). |

**Required subset (guaranteed populated on every finding):** Title, Description, Code Reference, Severity, Recommendation/Fix, Impact Analysis, Dev Comments, Status.

## Fixed sheet order

1. **Run Info** — agent, engine, stack, project, source branch, working branch, timestamp, tool versions, severity counts.
2. **Summary** — the 15-column contract sheet.
3. **Severity Breakdown** — counts per severity.
4. **By Category** — counts per category (or Sonar pillar).
5. **Recommendations** — present only when recommendations are supplied.
6. **Input Traceability** — present only when findings carry `inputRef` (Impact Analysis agent only).

## Agent-specific extras

- **🛡️ Sonar Scan** — appends a dedicated **Vulnerabilities** sheet after the standard sheets. Color-coded severity rows, concrete fix column. Also writes `sonar-findings.json` as the Step 1 artifact.
- **🔍 Audit (legacy engines only)** — `aem`, `commerce`, `eds`, `eds-commerce` additionally write their own platform-specific multi-sheet Excel and optionally `.pdf` / `.json` (`--format`, `--json`). So a legacy engine run produces **two** `.xlsx` files (the standardized shape *and* the legacy rich report). New engines (`sling`, `spring`, `app-builder`, `commerce-saas`) emit only the standardized shape.
- **⚡ Code Generation** — the scaffolded source files at their canonical project locations.
- **🧪 Test Coverage** — (Tier 2 only) the LLM-generated test files under the project's canonical test tree.
- **💥 Impact Analysis** — the unique **Input Traceability** sheet (one row per bug / requirement).

## CHANGE-LOG entry format

The writer keeps a `# CHANGE-LOG` header at the top and a `<!-- dca:entries -->` marker. Each run splices one entry directly after the marker:

```markdown
## 20260806_143512 — audit — commerce — Acme

- **Branch:** dca/audit-commerce-20260806_143512 from production
- **Summary:** …
- **Findings:** 87 total (CRITICAL 4, HIGH 12, MEDIUM 41, LOW 25, INFO 5)
- **Report:** audit-dca-audit-commerce-20260806_143512-agent-report.xlsx
- **Files changed:** …
- **Details:** …
```

## Optional working branch — `--create-branch` / `--source-branch`

Pass **`--create-branch`** on any agent to cut `dca/<agent>-<stack>-<YYYYMMDD_HHMMSS>` **before** any files are written — so the report + CHANGE-LOG entry land on the fresh branch, not on your working branch.

Base-branch cascade: `production → main → master → develop` — the first branch that exists wins. Override with a single `--source-branch <name>`.

:::note Best-effort
All git operations are non-fatal — outside a repo, the branch step degrades gracefully and the run still emits its `.xlsx` / `.md`. The agents never force-push and never touch remotes on their own.
:::

## Example — Audit on Commerce, `main` branch

An Audit run on `main` in a Commerce PaaS project produces:

```text
audit-reports/
├── audit-main-20260806_143022-agent-report.xlsx
├── audit-main-20260806_143022-agent-report.md
└── (legacy engine only) audit-main-20260806_143022-<platform>.xlsx
CHANGE-LOG.md          ← one new entry spliced after the marker
```

Corresponding `CHANGE-LOG.md` entry header:

```markdown
## 20260806_143022 — `audit` — `commerce` — Acme Storefront
- **Branch:** main from main
- **Summary:** 42 findings (CRITICAL 3, HIGH 11, MEDIUM 18, LOW 10)
- **Report:** audit-main-20260806_143022-agent-report.xlsx
- **Files changed:** 0
- **Details:** …
```

## Where the reports land

Each agent honors its `*_output` config variable as the default; a per-run `--output <dir>` flag overrides. If neither is set, the agent falls back to `<project-root>/<agent-family>-reports/`:

- `audit-reports/`
- `sonar-reports/`
- `generation-reports/`
- `impact-reports/`
- `test-coverage-reports/`

Full config reference: [reference/config-vars](../reference/config-vars).

## Next

- [Findings Cache](findings-cache) — the per-run JSON that downstream agents consume for enrichment.
- [Role Adaptation](role-adaptation) — how role-specific output flavors (executive MD, Jira CSV, SARIF) layer on top of the standardized shape.
