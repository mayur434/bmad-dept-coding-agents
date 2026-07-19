# BMAD Code Sonar Scan Agent — Setup Guide

LLM-driven SonarQube-style code quality analysis for all eight enterprise stacks.
Unlike a traditional Sonar scanner, this agent uses the LLM to reason over your
source files and produce Bugs, Vulnerabilities, Security Hotspots, Code Smells,
Duplications, and Complexity findings — no server, no binary, no license required.

---

## Prerequisites

- Node.js v20.12+
- npm (for `exceljs`, `fast-glob`)
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

After install: `.claude/skills/bmad-dept-code-sonar-scan-agent/`

## Install dependencies

```bash
# Shared foundation (required by all agents)
cd .claude/skills/shared && npm install

# This agent's scripts
cd .claude/skills/bmad-dept-code-sonar-scan-agent/scripts && npm install
```

This installs: `exceljs` (Excel reports), `fast-glob` (source scanning).

---

## Two-step workflow

This agent uses a two-step flow that separates LLM reasoning from report generation.

### Step 1 — Scan (LLM analysis)

Ask your AI agent naturally:

| Goal | Prompt |
|------|--------|
| Scan the whole project | `sonar scan my project` |
| Scan a specific stack | `sonar scan my AEM project` |
| Focus on vulnerabilities | `sonar scan my Spring Boot project for vulnerabilities` |

The LLM will:
1. Auto-detect the tech stack (or use your stated engine)
2. Load the matching rule pack from `resources/rule-packs/<stack>/rules.md`
3. Reason over the source files and produce findings across all 6 Sonar pillars
4. Write a `sonar-findings.json` file to the output directory

### Step 2 — Ingest (deterministic report generation)

Once `sonar-findings.json` exists, run the ingest step to produce the Excel report:

```bash
cd .claude/skills/bmad-dept-code-sonar-scan-agent/scripts

npx ts-node run.ts --ingest /path/to/sonar-findings.json --path /path/to/project
```

The ingest step:
1. Reads and validates the findings JSON
2. Computes Reliability, Security, and Maintainability ratings (A–E)
3. Evaluates the Quality Gate (PASS/FAIL — fails unless all three ratings = A)
4. Calls `emitStandardOutputs()` to produce the Excel report, Markdown twin, and CHANGE-LOG entry
5. Adds a dedicated **Vulnerabilities** sheet with color-coded severity rows and concrete recommended fixes

---

## Direct CLI usage (without BMAD)

```bash
cd .claude/skills/bmad-dept-code-sonar-scan-agent/scripts

# Ingest an LLM-authored findings JSON into the standardized Excel report
npx ts-node run.ts --ingest /path/to/sonar-findings.json --path /path/to/project

# Specify the stack explicitly (skips auto-detection during ingest)
npx ts-node run.ts --ingest findings.json --path /path/to/project --engine spring

# Cut the standard working branch before writing outputs
npx ts-node run.ts --ingest findings.json --path /path/to/project --create-branch

# Override the source branch for --create-branch
npx ts-node run.ts --ingest findings.json --path /path/to/project --create-branch --source-branch main

# Set a custom report output directory
npx ts-node run.ts --ingest findings.json --path /path/to/project --output /path/to/reports

# List the available rule packs (one per stack)
npx ts-node run.ts --list-engines

# Print help
npx ts-node run.ts --help
```

### CLI flags

| Flag | Meaning |
|------|---------|
| `--ingest <json>` | Path to `sonar-findings.json` produced by the LLM scan step |
| `--path <dir>` | Project root (default `.`) |
| `--engine <id>` | Force a stack id (auto-detected from findings JSON if omitted) |
| `--output <dir>` | Report output directory (default `<path>/sonar-reports`) |
| `--create-branch` | Cut the standard branch `dca/sonar-scan-<stack>-<timestamp>` before writing outputs |
| `--source-branch <name>` | Source branch for `--create-branch` (default candidates: production, main, master, develop) |
| `--list-engines` | List available rule packs and exit |
| `--help` | Print usage and exit |

### Supported stacks

| Stack (engine id) | Platform | Language |
|-------------------|----------|----------|
| `aem` | AEM as a Cloud Service + AEM AMS (aliases `aemcs`, `aemams`) | Java |
| `commerce-paas` | Adobe Commerce PaaS / Magento 2 (alias `commerce`) | PHP |
| `commerce-saas` | Adobe Commerce SaaS | JavaScript |
| `sling` | Apache Sling / Shaft (sling-12) | Java |
| `spring` | Spring Boot | Java |
| `app-builder` | Adobe App Builder | JavaScript/Node.js |
| `eds` | Edge Delivery Services | JavaScript |
| `eds-commerce` | EDS + Commerce | JavaScript |

---

## Output

Reports land in `<project>/sonar-reports/` by default (override with `--output`):

- **`sonar-scan-<branch>-<timestamp>-agent-report.xlsx`** — the standardized workbook.
  Sheets: Run Info (with ratings + Quality Gate verdict), Summary (the 15-column contract),
  **Vulnerabilities** (dedicated sheet — all Vulnerability and Security Hotspot findings,
  color-coded by severity, each with a concrete recommended fix), Severity Breakdown,
  By Category (auto-groups findings by the 6 Sonar pillars), Recommendations
  (per-rating rationale rows), and optionally Traceability.
- **`sonar-scan-<branch>-<timestamp>-agent-report.md`** — a git-diffable Markdown twin.
- **`CHANGE-LOG.md`** — appended at the project root with a one-line run summary.
- **`sonar-findings.json`** — the LLM-authored findings file (Step 1 output / Step 2 input).
- **Optional git branch** `dca/sonar-scan-<stack>-<timestamp>`, cut from a
  production/shared branch — only when `--create-branch` is passed.

The timestamp is local `YYYYMMDD_HHMMSS`; `<branch>` is the current git branch
(or `nobranch` outside a repo).

---

## Sonar pillars and ratings

### The 6 finding categories

| Category | What it covers |
|----------|----------------|
| Bug | Code that is demonstrably wrong or will behave unexpectedly |
| Vulnerability | Security weaknesses exploitable by an attacker |
| Security Hotspot | Security-sensitive code that needs manual review |
| Code Smell | Maintainability issues — cognitive complexity, dead code, duplication |
| Duplication | Repeated logic that should be extracted |
| Complexity | Methods or classes that exceed cognitive-complexity thresholds |

### Quality ratings (A–E)

| Rating | Meaning |
|--------|---------|
| A | No issues (or only INFO) |
| B | At least one LOW |
| C | At least one MEDIUM |
| D | At least one HIGH |
| E | At least one CRITICAL |

Three ratings are computed separately: **Reliability** (Bugs), **Security**
(Vulnerabilities + Security Hotspots), and **Maintainability** (Code Smells +
Duplication + Complexity).

### Quality Gate

The Quality Gate **PASSES** only when all three ratings are A. Any non-A rating
causes a **FAIL**. The verdict and per-rating values are shown on the Run Info sheet
and in the Recommendations sheet (one row per non-A rating with the worst finding
cited as the driver).

---

## Out of scope (v1)

- **Real SonarQube/SonarCloud API ingestion** — connecting to a Sonar server, fetching
  project issues via the REST API, or ingesting a `sonar-report.json` export. This would
  reintroduce a deterministic-scanner dependency. Planned as a future extension only.
- **Coverage-based gate conditions** — coverage data is owned by the Test-Coverage agent.
  The sonar-scan gate uses only the three ratings above.
