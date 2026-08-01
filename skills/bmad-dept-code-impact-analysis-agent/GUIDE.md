# BMAD Code Impact Analysis Agent — Setup Guide

Input-driven code impact analysis for enterprise Adobe projects — feed it a bug
export or a BRD and it traces every item onto the impacted source files, computes
the reverse-dependency blast radius, and scores the risk.

---

## Prerequisites

- Node.js v20.12+
- npm (for `exceljs`, `mammoth`, `fast-glob`)
- BMAD installed on your project

## Installation

Installed as part of the BMAD DEPT Code Agent module:

```bash
npx bmad-method install \
  --directory . \
  --modules bmm,bmb \
  --custom-source /path/to/bmad-dept-code-agent/skills \
  --tools claude-code \
  --yes
```

After install: `.claude/skills/bmad-dept-code-impact-analysis-agent/`

## Install dependencies

The shared foundation is installed first (every agent imports it), then this
agent's scripts:

```bash
# Shared foundation (required by all five agents)
cd .claude/skills/shared && npm install

# This agent's scripts
cd .claude/skills/bmad-dept-code-impact-analysis-agent/scripts && npm install
```

This installs: `exceljs` (Excel reports), `mammoth` (BRD `.docx` parsing),
`fast-glob` (source scanning).

---

## Usage

This agent is **input-driven**: give it a Proofhub bug/task export (CSV) and/or a
BRD document (`.docx`, `.md`, or `.txt`). At least one input is required.

Ask your AI agent using natural language:

| Goal | Prompt |
|------|--------|
| Impact of a bug export | `analyze the impact of these bugs: bugs.csv` |
| Impact of a BRD | `trace the blast radius of this BRD: requirements.docx` |
| Combined (bugs + BRD) | `run impact analysis on bugs.csv and requirements.docx` |

The agent will:

1. Parse the bug export and/or BRD into individual items (bugs → `BUG-n`, requirements → `REQ-n`)
2. Trace each item onto the impacted source files in the detected stack (candidate-symbol matching)
3. Compute the reverse-dependency blast radius and score risk / severity / effort
4. Emit a standardized Excel report (+ Markdown twin) whose **Input Traceability** sheet links every input to the files it impacts

Every input item appears in the report. Items with no direct code match become
`INFO` "Needs manual review" rows, so nothing is silently dropped.

> Google Docs cannot be read directly — export the BRD to `.docx` or `.txt` first.

---

## Direct CLI Usage (without BMAD)

The single entry point is `scripts/run.ts`:

```bash
cd .claude/skills/bmad-dept-code-impact-analysis-agent/scripts

# Impact from a Proofhub bug export (auto-detects the stack)
npx ts-node run.ts --bugs /path/to/bugs.csv --path /path/to/project

# Impact from a BRD document
npx ts-node run.ts --brd /path/to/requirements.docx --path /path/to/project

# Both inputs together
npx ts-node run.ts --bugs /path/to/bugs.csv --brd /path/to/requirements.docx --path /path/to/project

# Force a specific stack instead of auto-detecting it
npx ts-node run.ts --brd /path/to/requirements.docx --path /path/to/project --engine commerce-paas

# List the available stacks
npx ts-node run.ts --list-engines
```

At least one of `--bugs` / `--brd` must be supplied; the run exits with an error
if neither is given.

### CLI flags

| Flag | Meaning |
|------|---------|
| `--path <dir>` | Project root to trace against (default `.`) |
| `--bugs <csv>` | Proofhub bug/task CSV export (headers auto-detected by keyword) |
| `--brd <doc>` | BRD document — `.docx` via mammoth; any other extension read as UTF-8 text |
| `--engine <id>` | Force a stack profile (auto-detected if omitted) |
| `--output <dir>` | Report output directory (default `<path>/impact-reports`) |
| `--create-branch` | Cut the standard branch `dca/impact-<stack>-<timestamp>` before writing outputs |
| `--source-branch <name>` | Source branch for `--create-branch` (default candidates: production, main, master, develop) |
| `--preflight` | Print the LLM/mode advisory (STATIC / HYBRID / LLM) and exit without tracing |
| `--no-preflight` | Suppress the preflight advisory that otherwise prints on every run |
| `--list-engines` | List the 8 stacks (and aliases) and exit |
| `--help` | Print usage and exit |

### Supported stacks

One generic tracer serves all eight stacks; per-stack behaviour is just
configuration (which source globs load, which entity suffixes become strong
candidate symbols, and — for Commerce PaaS only — a `Vendor_Module` pattern).

| Stack (engine id) | Platform |
|-------------------|----------|
| `aem` | AEM as a Cloud Service + AEM AMS (aliases `aemcs`, `aemams`) |
| `commerce-paas` | Adobe Commerce PaaS / Magento 2 (alias `commerce`) |
| `commerce-saas` | Adobe Commerce SaaS |
| `sling` | Apache Sling / Shaft (sling-12) |
| `spring` | Spring Boot |
| `app-builder` | Adobe App Builder |
| `eds` | Edge Delivery Services |
| `eds-commerce` | EDS + Commerce |

---

## Output

Reports land in `<project>/impact-reports/` by default (override with `--output`):

- **`impact-<branch>-<timestamp>-agent-report.xlsx`** — the standardized workbook.
  Sheets: Run Info, Summary (the 15-column contract), Severity Breakdown,
  By Category, Recommendations, and — uniquely for this agent — **Input Traceability**,
  which links every input item to its impacted files, code references, blast radius,
  and risk score.
- **`impact-<branch>-<timestamp>-agent-report.md`** — a git-diffable Markdown twin.
- **`CHANGE-LOG.md`** — appended at the project root with a one-line run summary
  (`Impact analysis: N input(s) → M impacted finding(s) across <stack>`).
- **Optional git branch** `dca/impact-<stack>-<timestamp>`, cut from a
  production/shared branch — only when `--create-branch` is passed.

The timestamp is local `YYYYMMDD_HHMMSS`; `<branch>` is the current git branch
(or `nobranch` outside a repo).
