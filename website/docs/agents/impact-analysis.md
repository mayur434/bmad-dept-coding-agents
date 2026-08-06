---
id: impact-analysis
title: Impact Analysis
sidebar_position: 4
description: Input-driven reverse-dependency tracer over Proofhub bug CSVs, BRD docs, and PR diffs — impacted files, blast radius, risk score, audit cross-reference.
---

# Impact Analysis (💥)

## Purpose

The **Impact Analysis** agent is an **input-driven** blast-radius tracer. Give it a Proofhub CSV export, a BRD document, a PR diff, or the uncommitted working tree — it extracts symbols and paths, scores files, walks reverse dependencies through a per-stack profile, and emits an **Input Traceability** report where every input item (bug, requirement, changed file) appears as a row.

Items with no code match become an **INFO** row flagged for manual review — nothing is silently dropped.

At least one input (`--bugs`, `--brd`, `--pr`, or `--diff`) is required.

## When to use it

- **Sprint planning** — quantify blast radius of the incoming bug backlog before you commit.
- **Release readiness** — trace which files change if the top-N bugs from the Proofhub export ship.
- **BRD-to-code traceability** for compliance / audit / regulated-industry projects.
- **Regression scoping** — identify the minimum set of modules to smoke-test given a bug batch.
- **Combined bugs + BRD** to reconcile stakeholder requirements against active bug pressure.
- **PR blast radius** — pass `--pr <a>..<b>`, `--pr <sha>`, or `--diff` for the working tree, and see which downstream modules the change touches.

## What it produces

| Artifact | Where | Notes |
|----------|-------|-------|
| `impact-<branch>-<timestamp>-agent-report.xlsx` | `impact-reports/` | Standardized workbook + the unique **Input Traceability** sheet. |
| `impact-<branch>-<timestamp>-agent-report.md` | `impact-reports/` | Markdown twin. |
| One `CHANGE-LOG.md` entry | project root | |
| Optional working branch | git | `dca/impact-<stack>-<timestamp>` when `--create-branch` is passed. |
| Findings cache | `.bmad/cache/impact-analysis-<hash>.json` | Consumed by downstream agents. |

### The Input Traceability sheet (unique to this agent)

One row per input item → impacted file → blast-radius rank → risk score. Columns:

- **Input ID** — the source key (Proofhub bug id, BRD requirement id, PR file path).
- **Input Title / Requirement** — the natural-language description of the input.
- **Impacted File** — the file the tracer resolved.
- **Blast Radius Rank** — how many downstream files reference it (heuristic identifier / reverse-ref count).
- **Risk Score** — composite of severity × blast radius × audit cross-reference (when a recent audit cache exists).
- **Evidence** — the concrete symbol / path match that drove the resolution.

Items with **no** file match still land here as an INFO row so nothing is silently lost.

## Inputs

Combine any of the four inputs freely — the report merges them under one Input Traceability view.

| Input | Flag | Format | Notes |
|-------|------|--------|-------|
| Proofhub CSV | `--bugs <csv>` | RFC-4180 CSV | Custom parser; headers keyword-auto-detected (id / title / description / module / priority / status). |
| BRD document | `--brd <doc>` | `.docx` \| `.md` \| `.txt` | `.docx` via mammoth; any other extension read as UTF-8. Google Docs must be exported to `.docx` or `.txt` first. |
| PR range or SHA | `--pr <a>..<b>` \| `--pr <sha>` | git ref(s) | `a..b` for a range; a single ref diffs against the first existing `main` / `master` / `develop` / `production`. |
| Uncommitted working tree | `--diff` | git diff HEAD | Local uncommitted changes. |

## Trigger phrases

```text
trace the impact of these bugs: /path/to/bugs.csv
analyze the impact of this BRD: /path/to/requirements.docx
analyze impact --brd ./BRD.docx --engine spring
combined impact analysis of ./bugs.csv and ./requirements.docx
impact analysis on the current PR
impact analysis of the uncommitted changes
which bugs cluster around the same files?
which inputs had no code match?
```

Full catalog in the [Impact Analysis prompts reference](../reference/prompts/impact-analysis).

## CLI usage (technical mode)

```bash
# Bugs only
npx ts-node .claude/skills/bmad-dept-code-impact-analysis-agent/scripts/run.ts \
  --path /project --bugs proofhub-export.csv

# BRD only, explicit engine
npx ts-node .claude/skills/bmad-dept-code-impact-analysis-agent/scripts/run.ts \
  --path /project --brd requirements.docx --engine spring

# Combined bugs + BRD
npx ts-node .claude/skills/bmad-dept-code-impact-analysis-agent/scripts/run.ts \
  --path /project --bugs bugs.csv --brd brd.md

# PR blast radius
npx ts-node .claude/skills/bmad-dept-code-impact-analysis-agent/scripts/run.ts \
  --path /project --pr feature/x..main
```

## Flags reference

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--bugs <csv>` | file | — | Proofhub bug/task CSV export. |
| `--brd <doc>` | file | — | BRD document (`.docx` / `.md` / `.txt`). |
| `--pr <ref[..ref]>` | git ref | — | Diff a range (`a..b`) or a single ref (diffed vs the first main/master/develop/production). |
| `--diff` | bool | false | Use `git diff HEAD` — uncommitted working-tree changes. |
| `--path <dir>` | dir | `.` | Project root. |
| `--engine <id>` | enum | auto | Force a stack profile — 8 profiles; `aem` covers AEMaaCS + AMS. |
| `--output <dir>` | dir | `<path>/impact-reports` | Report output directory. |
| `--role <code>` | enum | `.bmad/role.yaml` | Role adaptation. |
| `--audit-max-age-hours <n>` | int | `168` (7 days) | Max age of the cached audit run consumed for cross-reference. |
| `--no-audit-crossref` | bool | false | Skip audit-findings cross-reference enrichment. |
| `--create-branch` | bool | false | Cut `dca/impact-<stack>-<timestamp>` before writing outputs. |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. |
| `--preflight` | bool | false | Print the preflight advisory and exit. |
| `--no-preflight` | bool | false | Suppress the preflight advisory. |
| `--yes-install` | bool | false | First-run dependency install without confirmation. |
| `--no-install` | bool | false | Error out if deps are missing (exit `2`). |
| `--interactive` | bool | false | Force interactive intake mode. |
| `--technical` | bool | false | Force technical intake mode. |
| `--list-engines` | bool | false | List available stack engines. |
| `--help` | bool | false | Show help. |

:::note
The Impact Analysis `--bugs` (Proofhub CSV) is **distinct** from the Audit Commerce engine's `--bugs` (bug report `.xlsx`). Different agents, different formats.
:::

## What's new in the maturity batch

- **Audit-findings cross-reference** — when a recent audit run's findings cache is present (default within `--audit-max-age-hours 168`, i.e. 7 days), the tracer enriches each impacted file with its CRITICAL / HIGH audit surface so the Risk Score reflects known defects. Opt out with `--no-audit-crossref`.
- **CODEOWNERS integration** — when `.github/CODEOWNERS` (or `docs/CODEOWNERS`) is present, the Input Traceability sheet's Owner column resolves from CODEOWNERS instead of Run Info's default.
- **PR-diff input** — the tracer now accepts `--pr <a>..<b>`, `--pr <sha>`, and `--diff` (uncommitted working tree). PR files enter the same tracer pipeline as bugs / BRD requirements, so a mixed run (bugs + BRD + PR) produces one unified Input Traceability view.
- **8 per-stack heuristic files** — one heuristic profile per engine (`aem`, `commerce-paas`, `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`) tuned to that stack's symbol shape and reverse-reference conventions.

## Example workflow — Spring Boot, bugs + BRD, regression scoping

```bash
cd /path/to/spring-service
```

**Chat trigger:**

```text
run impact analysis on my Spring Boot project using ./bugs.csv and ./BRD.docx,
then rank regression modules for me
```

**Resolved CLI:**

```bash
npx ts-node .claude/skills/bmad-dept-code-impact-analysis-agent/scripts/run.ts \
  --path /path/to/spring-service \
  --engine spring \
  --bugs ./bugs.csv \
  --brd ./BRD.docx
```

**Follow up:**

```text
which modules should we regress-test based on this impact set?
show the input-to-code traceability
which inputs had no code match?
which impacted files also have CRITICAL audit findings?
```

## Cross-agent chaining hints

| Role | Next agent | Why |
|------|-----------|-----|
| `ea` | [Audit](./audit) | Turn the blast-radius map into an architecture roadmap. |
| `tl` | [Audit](./audit) + [Test Coverage](./test-coverage) | Audit the impacted files, then measure coverage on them. |
| `de` | [Code Generation](./code-generation) | Scaffold fix stubs for the top-impact bugs. |
| `qa` | [Test Coverage](./test-coverage) | Focus test generation on the impacted set. |
| `devops` | [Test Coverage](./test-coverage) | Wire a coverage gate on the impacted files into CI. |
| `security` | [Sonar Scan](./sonar-scan) | Vulnerability triage on the impacted set. |
| `pm` / `ba` | (stay in impact-analysis) | Map results back to release scope / BRD requirements. |
| `migration` | [Test Coverage](./test-coverage) | Cross-version regression scope on the migration delta. |

Or run the whole SDLC pass in one shot with [`--chain-all`](../workflows/chain-all).

## See also

- [Impact Analysis prompt catalog](../reference/prompts/impact-analysis) — copy-paste prompts, one per stack.
- [Standardized outputs contract](../concepts/standardized-outputs) — 15-column Summary + Input Traceability sheet.
- [Findings cache](../concepts/findings-cache) — how the audit cache feeds Impact Analysis.
