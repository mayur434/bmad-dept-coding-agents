---
id: sonar-scan
title: Sonar Scan
sidebar_position: 2
description: LLM-driven SonarQube-style code quality analysis — Bugs / Vulnerabilities / Hotspots / Smells / Duplications / Complexity, A–E ratings, Quality Gate, dedicated Vulnerabilities sheet.
keywords:
  - sonar
  - quality gate
  - code smells
  - vulnerabilities
  - security hotspots
---

## Purpose

The **Sonar Scan** agent runs an LLM-driven, SonarQube-style code quality pass — **no SonarQube server or binary required**. It covers all 6 Sonar pillars — **Bugs**, **Vulnerabilities**, **Security Hotspots**, **Code Smells**, **Duplications**, **Complexity** — and produces **A–E** ratings for Reliability / Security / Maintainability plus a pass/fail **Quality Gate**, all on top of the [standardized outputs contract](../concepts/standardized-outputs) and a dedicated **Vulnerabilities** sheet.

## When to use it

- **Enforce a Quality Gate on every merge to `main`** in a project that won't run a full SonarQube server.
- **Security-focused review before a release** — CWE / OWASP alignment on the Vulnerabilities sheet.
- **Post-refactor validation** — has the change improved or degraded the A–E ratings?
- **Cross-stack visibility for platform teams** operating multiple projects on one Quality Gate schema.
- **Vulnerability triage** — the color-coded Vulnerabilities sheet includes concrete fix code per row.
- **Complexity refactoring backlog** — the AST-based cyclomatic count surfaces functions above 15 (HIGH) and 25 (CRITICAL).

## What it produces

| Artifact | Where | Notes |
|----------|-------|-------|
| `sonar-findings.json` | `sonar-reports/` | Step 1 artifact — human-editable JSON conforming to the `Finding[]` shape. |
| `sonar-scan-<branch>-<timestamp>-agent-report.xlsx` | `sonar-reports/` | Standardized 6-sheet workbook + **Vulnerabilities** sheet appended (color-coded severity, concrete-fix column). |
| `sonar-scan-<branch>-<timestamp>-agent-report.md` | `sonar-reports/` | Markdown twin. |
| One `CHANGE-LOG.md` entry | project root | |
| Optional working branch | git | `dca/sonar-scan-<stack>-<timestamp>` when `--create-branch` is passed. |
| Findings cache | `.bmad/cache/sonar-scan-<hash>.json` | Consumed by downstream agents. |

The workbook's **Quality Gate** line sits at the top of the **Run Info** sheet. **PASS** = all three ratings are `A`; any non-A ⇒ **FAIL**.

## The two-step design

The Sonar Scan agent is intentionally **two-step**, so the LLM output can be reviewed / edited before the deterministic report is generated (and so the ingest step is independently rerunnable if the report step fails):

1. **Step 1 — Scan (LLM).** The agent reads the per-stack rule pack, reasons over the project's source files, and writes `sonar-findings.json` to the configured `sonar_output` directory.
2. **Step 2 — Ingest (deterministic).** `scripts/run.ts --ingest` reads `sonar-findings.json`, computes A–E ratings + Quality Gate, appends AST-based complexity findings, and emits the standardized `.xlsx` + Markdown + `CHANGE-LOG.md` + the **Vulnerabilities** sheet.

Chat-triggered flows run both steps in sequence. To run **Step 2 only** (after you've edited `sonar-findings.json`), invoke `--ingest` directly.

## Trigger phrases

```text
sonar scan my project
sonar scan my AEM project
sonar scan my Spring Boot service on a new branch from main
sonar scan --engine commerce-paas --path .
sonar scan my project focused on security vulnerabilities
ingest sonar findings from ./sonar-reports/sonar-findings.json
run the ingest step
list rule packs
```

The full copy-paste catalog is in the [Sonar prompts reference](../reference/prompts/sonar-scan).

## CLI usage (technical mode)

```bash
# Step 2 only (ingest) — the LLM step happens via chat; this is the deterministic follow-up
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json \
  --path /path/to/project \
  --engine spring

# One-command two-step — polls for sonar-findings.json, then auto-ingests
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --path /path/to/project --auto-ingest
```

## Flags reference

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--ingest <json>` | file | required for Step 2 | Path to the LLM-produced `sonar-findings.json`. |
| `--path <dir>` | string | `.` | Project root. |
| `--engine <id>` | enum | auto | Force a stack; otherwise inferred from the findings JSON. Aliases: `aemcs` / `aemams` → `aem`; `commerce` → `commerce-paas`. |
| `--focus <csv>` | csv | all 6 | Restrict the ingest report and rating math to a subset of the 6 Sonar categories: `bugs`, `vulnerabilities`, `hotspots`, `smells`, `duplications`, `complexity`. Ratings for excluded categories default to `A`. |
| `--no-fail` | bool | false | Never exit non-zero on Quality Gate FAIL. Default: **exit 1 on FAIL** so the run can be a required CI check. |
| `--auto-ingest` | bool | false | Poll every 2s for `sonar-findings.json` at `--findings-path`, then run Step 2 automatically when the file appears. |
| `--watch` | bool | false | Alias of `--auto-ingest`. |
| `--findings-path <path>` | file | `./sonar-findings.json` | Where `--auto-ingest` / `--watch` looks for the Step-1 output. |
| `--watch-timeout <sec>` | int | 300 | How long to poll before giving up. |
| `--role <code>` | enum | `.bmad/role.yaml` | Role adaptation. |
| `--output <dir>` | dir | `{sonar_output}` | Report output directory. |
| `--create-branch` | bool | false | Cut `dca/sonar-scan-<stack>-<timestamp>` before writing outputs. Takes effect only with `--ingest`. |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. |
| `--preflight` | bool | false | Print the LLM / context advisory and exit. |
| `--no-preflight` | bool | false | Suppress the preflight advisory. |
| `--yes-install` | bool | false | First-run dependency install without confirmation. |
| `--no-install` | bool | false | Error out if deps are missing (exit `2`). |
| `--interactive` | bool | false | Force interactive intake mode. |
| `--technical` | bool | false | Force technical intake mode. |
| `--list-engines` | bool | false | List available rule packs (one per stack). |
| `--help` | bool | false | Show help. |

### Enterprise Phase 1 flags

Shared with every DCA agent. See [Findings Gate](../concepts/findings-gate) and [SLA Tracking](../concepts/sla-tracking) for the full mechanics.

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `--include-decided` | bool | false | Bypass the findings gate — show items already decided in `.bmad/decisions.yaml`. |
| `--decisions-path <path>` | string | `<projectRoot>/.bmad/decisions.yaml` | Override the decisions file. |
| `--ignore-decision-expiry` | bool | false | Treat expired decisions as still active for this run. |
| `--list-decisions` | bool | false | Print all decisions and exit. |
| `--sla-path <path>` | string | `<projectRoot>/.bmad/sla.yaml` | Override the SLA file. |
| `--no-sla` | bool | false | Skip the SLA sheet and computation. |
| `--fail-on-overdue` | bool | false | Exit code 6 if any surviving item is overdue per role SLA. Independent of the Quality Gate. |

## One-shot examples

The Sonar Scan agent runs end-to-end without clarifying questions when the prompt is self-contained. See the [One-Shot Mode](../concepts/one-shot-mode) concept page for the full precedence rules.

- **"sonar scan my project"** — path + engine + role auto-resolved; `--auto-ingest` on so Step 1 -> Step 2 chain silently.
- **"sonar scan focus vulnerabilities as security"** — per-run role override + `--focus vulnerabilities`.
- **"sonar scan then ingest — one shot with --auto-ingest"** — explicit auto-ingest for a single pipeline call.
- **"sonar scan and fail if quality gate red"** — Quality Gate FAIL already exits non-zero; add `--fail-on-overdue` for the SLA gate too.
- **"ingest ./sonar-findings.json into a report"** — Step 2 only; `--ingest ./sonar-findings.json`.
- **"sonar scan with fresh findings — --watch until they land"** — `--watch` polls for Step 1 output before ingesting.

Full example bodies with the exact resolved commands live in the agent SKILL.md's `One-shot mode` section.

## What's new in the maturity batch

- **`--focus <csv>` filter** — restrict Step 1's LLM rule pack *and* Step 2's ingest to a subset of the 6 Sonar categories. Common pairings: `--focus vulnerabilities,hotspots` for a security-only pass; `--focus complexity` for a refactoring backlog. Ratings for excluded categories fall back to `A`.
- **`--auto-ingest` / `--watch` chaining** — one command drives both steps. Trigger the LLM scan in chat as usual; the dispatcher polls for `sonar-findings.json` and runs Step 2 automatically as soon as the file lands.
- **CI exit code on Quality Gate FAIL** — Step 2 exits with code **1** on FAIL so it can be wired into a required GitHub Actions / GitLab CI check. Pass `--no-fail` to opt out (pre-v1.1 behaviour — always exit 0) for CI configs with their own gate logic. See [CI Integration](../workflows/ci-integration).
- **AST cyclomatic complexity** — Step 2 runs a real per-function cyclomatic count via the shared tree-sitter harness (Java for `aem` / `commerce-paas`-variant / `spring` / `sling`; JS/TS for `app-builder` / `commerce-saas` / `eds` / `eds-commerce`; PHP for `commerce-paas`). Functions with cyclomatic complexity `> 15` become a **HIGH** `Complexity` smell; `> 25` becomes **CRITICAL**. These are appended to the LLM findings **before** rating math runs, so they drive the Maintainability rating and the Quality Gate.

## Example workflow — AEM AMS Quality Gate

AEM AMS project, sonar scan on a new branch cut from `production`, focused on security only, then vulnerability triage:

**Chat trigger (runs both steps):**

```text
sonar scan my AEM project focused on security vulnerabilities and cut a branch from production
```

**Under the hood — Step-2 CLI:**

```bash
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json \
  --path /path/to/aem-project \
  --engine aem \
  --focus vulnerabilities,hotspots \
  --create-branch --source-branch production
```

**Follow up in chat:**

```text
which finding drove the Quality Gate to FAIL?
list every Security Hotspot with a concrete recommended fix
map every Vulnerability to CWE and OWASP Top 10
export the Vulnerabilities sheet as CSV
```

## Cross-agent chaining hints

| Role | Next agent | Why |
|------|-----------|-----|
| `ea` | [Audit](./audit) | Broader architecture pass on top of the Quality Gate. |
| `tl` | [Impact Analysis](./impact-analysis) | Blast-radius the top Vulnerabilities before assigning fixes. |
| `de` | [Code Generation](./code-generation) | Scaffold the deterministic fix stubs for the top-N Bugs. |
| `qa` | [Test Coverage](./test-coverage) | Coverage on the files driving the FAIL. |
| `devops` | (stay in sonar-scan) | Wire `--no-fail=false` into CI as a required check. |
| `security` | (stay in sonar-scan) | Iterate on the Vulnerabilities sheet + CWE/OWASP triage. |
| `migration` | [Audit](./audit) `--since` | Delta of ratings across the upgrade. |

Or run the whole SDLC pass in one shot with [`--chain-all`](../workflows/chain-all).

## See also

- [Sonar prompt catalog](../reference/prompts/sonar-scan) — copy-paste prompts, one per stack.
- [Standardized outputs contract](../concepts/standardized-outputs) — 15-column Summary + Vulnerabilities sheet.
- [Findings cache](../concepts/findings-cache) — how sonar output feeds downstream agents.
- [CI Integration](../workflows/ci-integration) — Quality Gate as a required CI check.
