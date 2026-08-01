# BMAD DEPT Code Agent — Consumption Manual

> Day-to-day operating guide for engineering teams who install the `dca` plugin into their Adobe or JVM project and run the five agents against real code.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Install](#3-install)
4. [Configuration](#4-configuration)
5. [The Five Agents — usage guide](#5-the-five-agents--usage-guide)
    - [5.1 Audit](#51-audit-agent)
    - [5.2 Sonar Scan](#52-sonar-scan-agent)
    - [5.3 Code Generation](#53-code-generation-agent)
    - [5.4 Impact Analysis](#54-impact-analysis-agent)
    - [5.5 Test Coverage](#55-test-coverage-agent)
6. [Understanding the 8 stacks](#6-understanding-the-8-stacks)
7. [Standardized outputs contract](#7-standardized-outputs-contract)
8. [Preflight mode (Static / LLM / Hybrid)](#8-preflight-mode-static--llm--hybrid)
9. [Multi-agent workflows](#9-multi-agent-workflows)
10. [Troubleshooting](#10-troubleshooting)
11. [Uninstall / rollback](#11-uninstall--rollback)
12. [Advanced — Author's guide](#12-advanced--authors-guide)
13. [Appendix A — Authoring a new skill module](#appendix-a--authoring-a-new-skill-module)
14. [Appendix B — Full CLI flag reference](#appendix-b--full-cli-flag-reference)
15. [Appendix C — Naming conventions + repo layout](#appendix-c--naming-conventions--repo-layout)
16. [Appendix D — Version + support](#appendix-d--version--support)

---

## 1. Overview

### What this plugin is

The **BMAD DEPT Code Agent** (module code `dca`) is a five-agent AI suite that plugs into the [BMAD Method](https://github.com/bmadcode/bmad-method) framework and delivers deterministic + LLM-driven code analysis across eight enterprise stacks:

- Adobe Experience Manager (AEMaaCS + AEM AMS)
- Adobe Commerce (PaaS / Magento 2, and SaaS / storefront drop-ins)
- Adobe App Builder (I/O Runtime, API Mesh, UI Extensibility)
- Edge Delivery Services (EDS) — including the EDS + Commerce hybrid
- Apache Sling / Shaft (sling-12)
- Spring Boot middleware

The five agents are:

| # | Agent | Skill code | Icon | One-liner |
|---|-------|------------|:----:|-----------|
| 1 | **Audit** | `bmad-dept-code-audit-agent` | 🔍 | Two-tier code auditor — tree-sitter AST + regex (Tier 1) + LLM deep semantic analysis (Tier 2). |
| 2 | **Sonar Scan** | `bmad-dept-code-sonar-scan-agent` | 🛡️ | LLM SonarQube-style scan → Reliability / Security / Maintainability ratings + Quality Gate. |
| 3 | **Code Generation** | `bmad-dept-code-generation-agent` | ⚡ | 24 deterministic scaffolders across the 8 stacks + LLM/MCP path for complex generation. |
| 4 | **Impact Analysis** | `bmad-dept-code-impact-analysis-agent` | 💥 | Input-driven tracer — Proofhub CSV and/or BRD document → impacted files + blast radius. |
| 5 | **Test Coverage** | `bmad-dept-code-test-coverage-agent` | 🧪 | Gap analysis + real line/branch coverage (JaCoCo / Istanbul / Clover / LCOV) + LLM test generation. |

### What it delivers

Every agent — regardless of stack — writes the **same three standardized outputs** for every run:

1. `<agent>-<branch>-<timestamp>-agent-report.xlsx` — a workbook with a fixed sheet order and a frozen 15-column Summary contract.
2. `<agent>-<branch>-<timestamp>-agent-report.md` — a git-diffable Markdown twin.
3. `CHANGE-LOG.md` — a Keep-a-Changelog file at the project root, appended (newest first) with one entry per run.

An **optional** working branch `dca/<agent>-<stack>-<timestamp>` is cut from your production/shared branch when you pass `--create-branch`.

Full contract details live in [§7 Standardized outputs contract](#7-standardized-outputs-contract).

### Who this manual is for

Engineering leads, tech leads, and architects who have installed the plugin into a real Adobe/JVM project and want to know **how to use it day-to-day** — which prompts to send, which flags to pass, where reports land, how to chain agents, and how to recover from the common failure modes.

If you are trying to *author or extend* the plugin (add a new stack engine, add a new scaffolder, add a new agent), see [§12 Advanced — Author's guide](#12-advanced--authors-guide) and [Appendix A](#appendix-a--authoring-a-new-skill-module).

### Where to look for what

| Document | Read it when you… |
|----------|-------------------|
| [README](README.md) | Want the 30-second pitch, install commands, and the coverage matrix. |
| **This MANUAL** | Want to actually run the agents, understand every flag, chain workflows, or troubleshoot. |
| [PROMPTS](PROMPTS.md) | Need copy-paste natural-language prompts by agent × stack. |
| [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md) | Need to know which features are shipped, which are partial, and the standardized-outputs schema in exhaustive detail. |
| [LICENSE](LICENSE) | Confirming redistribution terms (MIT). |

---

## 2. Prerequisites

### Runtime

| Requirement | Version | Why |
|-------------|---------|-----|
| **Node.js** | v20.12 or newer | The Tier-1 engines run via `npx ts-node`; the AST layer uses `web-tree-sitter` (WASM), which requires the newer Node runtime. |
| **npm** | Ships with Node.js | Used for the `npm install` steps in `skills/shared/` and each agent's `scripts/`. |
| **Git** | Any recent version | Required for `--create-branch`, `--source-branch`, and the branch/timestamp used in the report filename. Non-fatal outside a repo (falls back to `nobranch`). |

### AI coding tool

The plugin is designed for **Claude Code** (the reference host — every install command uses `--tools claude-code`). Because it is a BMAD module, other BMAD-compatible tools should work in principle — the framework itself claims support for tools like **Cursor**, **VS Code + Copilot**, and other IDEs — but the reference test bed is Claude Code. If you install into a different host, verify the activation keywords in each agent's `customize.toml` are honored and confirm the CLI dispatch path with a smoke run (see [§3](#3-install)).

### Recommended

- A **real project** in one of the 8 stacks. The auto-detector needs signal files (`composer.json`, `pom.xml`, `app.config.yaml`, `blocks/`, etc.) to pick an engine without you having to pass `--engine`.
- If you plan to run the **Impact Analysis** agent, have a Proofhub CSV export (`--bugs`) or a `.docx` BRD (`--brd`) ready. At least one input is required.
- If you plan to run the **Test Coverage** agent with real coverage, have your build tool (Maven + JaCoCo, `npm test` + Jest/nyc, PHPUnit + Clover, etc.) already producing a coverage report — or be able to run it.
- If you plan to use the **Code Generation** agent's LLM/MCP path for AEM, MCP-compatible credentials for your target instance (the agent can auto-provision `.mcp.json` and `.bmad/mcp-registry.toml` with `--setup`).

---

## 3. Install

The plugin installs into a **target project directory** — the folder containing your Adobe / JVM source tree. It writes each agent skill into `.claude/skills/` (or `bmad/dca/agents/…` depending on the BMAD installer's chosen layout — see [§10 Troubleshooting](#10-troubleshooting)) and appends a small set of config directories to your project.

### Fresh install (from Git)

```bash
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools claude-code \
  --yes
```

### Fresh install (from a local clone)

Point `--custom-source` at the repo's **`skills/`** folder, not the repo root:

```bash
git clone https://github.com/mayur434/bmad-dept-code-agent.git ~/src/dca
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source ~/src/dca/skills \
  --tools claude-code \
  --yes
```

### Post-install: install dependencies

Every agent depends on the top-level **`shared/`** foundation (`@bmad/dca-shared`) — install it FIRST, then each agent's `scripts/` folder you intend to use:

```bash
# 1. shared foundation (required by every agent)
cd .claude/skills/shared && npm install

# 2. each agent you plan to use (repeat for the others)
cd .claude/skills/bmad-dept-code-audit-agent/scripts        && npm install
cd .claude/skills/bmad-dept-code-sonar-scan-agent/scripts   && npm install
cd .claude/skills/bmad-dept-code-generation-agent/scripts   && npm install
cd .claude/skills/bmad-dept-code-impact-analysis-agent/scripts && npm install
cd .claude/skills/bmad-dept-code-test-coverage-agent/scripts   && npm install
```

Each agent's `SKILL.md` also contains a pre-flight step that auto-installs missing `node_modules` silently on first run — pre-installing manually just saves you the wait on the first invocation.

### Two verification steps every consumer should run

**1. Confirm the install path.** Depending on your host's layout, skills may land in `.claude/skills/…` (Claude Code default) or `bmad/dca/agents/…` (some BMAD installers). Locate one agent so you know where the rest live:

```bash
find . -type d -name "bmad-dept-code-audit-agent" 2>/dev/null | head -3
```

Use whichever path this prints as the base for the `cd` commands and CLI invocations below.

**2. Smoke run the dispatcher `--help`.** From the target project root, run any agent's `run.ts --help`. This confirms Node ≥ 20.12, that dependencies are installed, and that the dispatcher parses arguments:

```bash
cd .claude/skills/bmad-dept-code-audit-agent/scripts
npx ts-node run.ts --help
```

You should see the audit help text listing `--path`, `--engine`, `--format`, `--list-engines`, etc.

### Update

The BMAD installer supports two update actions:

```bash
cd /path/to/your-project

# Quick update — preserves settings, syncs module files only
npx bmad-method install \
  --directory . \
  --action quick-update \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --yes

# Full update — re-resolves everything, allows config changes
npx bmad-method install \
  --directory . \
  --action update \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --yes
```

Re-run the `npm install` for `skills/shared/` (and any agent that was upgraded) after either action.

### Uninstall

```bash
npx bmad-method uninstall --directory .
```

This removes the agent skill folders. It does NOT remove reports the agents have already written (`audit-reports/`, `sonar-reports/`, etc.) or the appended `CHANGE-LOG.md` — those are your artifacts to keep or delete manually.

### Useful BMAD installer flags

| Flag | Purpose |
|------|---------|
| `--action quick-update` | Fast sync — preserves all config. |
| `--action update` | Full update — can modify modules / config. |
| `--custom-source <url\|path>` | Git URL or local `skills/` folder path. |
| `--yes` | Non-interactive, accept defaults. |
| `--channel next` | Use latest HEAD instead of stable tag. |
| `--pin CODE=TAG` | Pin module to a specific release tag. |
| `--set module.key=value` | Override a config variable non-interactively (see [§4](#4-configuration)). |
| `--list-options [module]` | Show available `--set` keys. |
| `--list-tools` | Show valid tool/IDE IDs. |

---

## 4. Configuration

Configuration is split three ways: **module-level variables** (in `skills/module.yaml`, set via `--set` at install time), **per-agent CLI flags** (see [§5](#5-the-five-agents--usage-guide) and [Appendix B](#appendix-b--full-cli-flag-reference)), and **environment variables** (via a `.env` file at your project root).

### Module-level variables

Each variable has a prompt (shown during interactive install) and a default. Override any of them with `--set dca.<key>=<value>` on the install command.

| Key | Default | What it controls |
|-----|---------|------------------|
| `audit_output` | `{output_folder}/audit-reports` | Where the **Audit** agent writes its `.xlsx` / `.md`. |
| `sonar_output` | `{output_folder}/sonar-reports` | Where the **Sonar Scan** agent writes `sonar-findings.json` and its final `.xlsx`. |
| `generation_output` | `{output_folder}/generation-reports` | Where the **Code Generation** agent writes its scaffold report. |
| `impact_output` | `{output_folder}/impact-reports` | Where the **Impact Analysis** agent writes its report. |
| `test_coverage_output` | `{output_folder}/test-coverage-reports` | Where the **Test Coverage** agent writes its report. |
| `audit_engine` | `auto` | Default engine ID for the Audit agent. Set to one of `auto`, `aem`, `commerce`, `commerce-paas`, `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`. |
| `audit_namespace` | `Custom` | Adobe Commerce PaaS-specific — default module namespace used by Commerce scans/scaffolders. |

The `{output_folder}` placeholder is resolved to the value BMAD uses for that project (typically `docs/` or a project-level output root).

**Override examples** (during install):

```bash
npx bmad-method install \
  --directory . \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --set dca.audit_output=reports/audits \
  --set dca.audit_engine=commerce-paas \
  --set dca.audit_namespace=Acme \
  --yes
```

**Where reports actually land.** Every agent honors its `*_output` config variable as the default, but individual runs can override it via the `--output <dir>` CLI flag. If neither is set, the agent falls back to `<project-root>/<agent-family>-reports/` (e.g. `audit-reports/`, `sonar-reports/`, `impact-reports/`, `test-coverage-reports/`, `generation-reports/`).

### Environment variables (`.env`)

A sample `.env` lives at [`skills/.env.example`](skills/.env.example). Copy it to your **target project's root** (not into `.claude/skills/…`):

```bash
cp .claude/skills/.env.example .env
# then edit .env to taste
```

The `.env` is optional. It's used mainly to tune token-budget and cost-projection knobs consumed by the preflight advisor:

| Variable (subset) | Purpose |
|-------------------|---------|
| `BMAD_TOKEN_BUDGET_TOTAL` | Total context-window budget assumed for the current LLM. |
| `BMAD_TOKEN_WARNING_PERCENT` / `_CRITICAL_PERCENT` | Amber / red thresholds shown by the preflight advisor. |
| `BMAD_TOKEN_COST_PER_1K_INPUT` / `_OUTPUT` | USD-per-1K numbers for the cost projection line. |
| `BMAD_STATIC_*_TOKENS_AVG`, `BMAD_LLM_*_TOKENS_AVG` | Baselines the preflight uses to project session cost per agent × mode. |
| `BMAD_OPTIMIZED_PROMPT_MULTIPLIER` | Multiplier reduction applied when the agent uses its optimized prompt path. |

None of these are load-bearing — leave them at defaults if you don't care about cost projection. See the full list in [`skills/.env.example`](skills/.env.example).

### MCP setup (Code Generation agent)

The **Code Generation** agent has an LLM/MCP path used for anything the deterministic scaffolders don't cover (e.g. AEM UI extensions, custom Commerce integrations). It can auto-provision the required MCP config with:

```bash
cd .claude/skills/bmad-dept-code-generation-agent/scripts
npx ts-node run.ts --setup
```

This writes/updates (in your project root):

- **`.mcp.json`** — the standard MCP client manifest.
- **`.bmad/mcp-registry.toml`** — the BMAD MCP registry entry.
- **`.env`** — appends credential placeholders if they don't exist.
- **`.gitignore`** — ensures `.env` and any credential files are not committed.

Confirm the result before you commit any of the above. If your organization uses centrally-managed MCP servers, edit `.mcp.json` and `.bmad/mcp-registry.toml` afterwards to point at those.

---

## 5. The Five Agents — usage guide

Each agent follows the same shape below. Agents are listed in canonical SDLC order — **Audit → Sonar Scan → Code Generation → Impact Analysis → Test Coverage** — but they are **fully independent**. Run any agent on its own.

### 5.1 Audit agent

#### Purpose

Two-tier code auditor. **Tier 1** is a deterministic TypeScript scanner (tree-sitter AST + regex, zero LLM tokens) across all 8 stacks. **Tier 2** is LLM-driven deep semantic analysis using per-stack rule packs. The old standalone `scan-agent` was retired — its Tier-1 pass now lives here as the **Scan Only** action.

#### When to use it

- Before a major PR merge, to catch security/perf/architectural violations pre-review.
- During a platform upgrade (AEM AMS → AEMaaCS, Magento 2.4.7-p7 → 2.4.7-p9) for a breaking-change baseline.
- Onboarding a legacy Commerce or AEM project to establish a starting-quality snapshot.
- Quarterly / sprint-cadence code-health checks for enterprise architects.
- As Step 1 of the "Vulnerability triage" or "Pre-release gate" chained workflows in [§9](#9-multi-agent-workflows).

#### Trigger phrases

Paste any of these into the agent chat:

```text
audit my project
scan my project
scan my project and name it "Acme"
full audit my project
deep audit my project
scan my AEM project --platform aemcs
scan --engine commerce --path .
scan my project with DB dump at /path/to/dump.sql
audit only the Checkout and Payment modules
```

#### CLI usage (standalone, without BMAD activation)

```bash
cd .claude/skills/bmad-dept-code-audit-agent/scripts

# Auto-detect stack and run Tier 1 (preflight runs automatically)
npx ts-node run.ts --path /path/to/project --name "Project Name"

# Explicit engine
npx ts-node run.ts --engine commerce --path /path/to/project

# List available engines
npx ts-node run.ts --list-engines
```

#### Flags reference

The Audit dispatcher (`run.ts`) accepts a small top-level flag set, then forwards the rest to the per-engine `audit.ts`. Legacy engines (aem, commerce) accept a richer flag set.

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--path <dir>` | string | required (or `--engine`) | Project root to scan. | |
| `--engine <id>` | enum | auto-detected | One of `aem`, `commerce`, `commerce-paas`, `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`. | `commerce` and `commerce-paas` are aliases. |
| `--name <str>` | string | folder name | Project name shown in the report. | |
| `--format <t>` | enum | `excel` | `excel` \| `md` \| `pdf` \| `all`. | Honored by the AEM legacy report path. Confirm behavior on other engines against `run.ts` before shipping. |
| `--platform <p>` | enum | auto | AEM engine only: `aemcs` \| `aemams` \| `both`. | Only meaningful when `--engine aem`. |
| `--namespace <ns>` | string | `Custom` | Commerce engine — filter to a namespace. | |
| `--module <list>` | csv | — | Filter to specific modules (aem / commerce). | |
| `--db <path>` | file | — | Commerce engine — SQL dump for schema/index/integrity analysis. | Verify accepted extensions (`.sql`) against `run.ts`. |
| `--brd <path>` | file | — | Commerce engine — BRD document (repeatable). | `.docx` via mammoth, or `.md`/`.txt`. |
| `--bugs <path>` | file | — | Commerce engine — bug report `.xlsx`. | Note: this is *scanner input*, distinct from the Impact Analysis agent's `--bugs` (Proofhub CSV). |
| `--no-code-audit` | bool | false | Commerce engine — skip the code scan (BRD-only or bugs-only run). | |
| `--json` | bool | false | Also emit findings as JSON (aem/commerce engines). | |
| `--output <dir>` | dir | `{audit_output}` | Override report directory. | |
| `--create-branch` | bool | false | Cut `dca/audit-<stack>-<timestamp>` before writing outputs. | |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. Default cascade: `production → main → master → develop`. | |
| `--preflight` | bool | false | Print the model/context advisory and exit. | See [§8](#8-preflight-mode-static--llm--hybrid). |
| `--no-preflight` | bool | false | Suppress the preflight advisory that otherwise prints on every run. | |
| `--list-engines` | bool | false | List registered engines and exit. | |
| `--help` / `-h` | bool | false | Show help. | |

#### Output files

- `audit-<branch>-<timestamp>-agent-report.xlsx` — standardized workbook (6-sheet fixed order, 15-column Summary).
- `audit-<branch>-<timestamp>-agent-report.md` — Markdown twin.
- `CHANGE-LOG.md` — appended at project root.
- Optional `dca/audit-<stack>-<timestamp>` branch (`--create-branch`).
- **Legacy engines only** (aem, commerce, eds, eds-commerce) additionally write their platform-specific multi-sheet Excel (and `.md`/`.pdf`/`.json` per `--format`/`--json`) — so a legacy engine run produces **two** `.xlsx` files.

#### Example workflow (end-to-end)

Commerce PaaS project, full audit with database + BRD + bug report, on a fresh branch:

```bash
cd /path/to/magento-project
# Trigger via chat:
#   "full audit my project with DB at ./db/prod.sql, BRD at ./docs/spec.docx,
#    bugs at ./reports/bugs.xlsx, and cut a branch from production"
# The agent resolves the CLI:
```

```bash
cd .claude/skills/bmad-dept-code-audit-agent/scripts
npx ts-node run.ts \
  --engine commerce \
  --path /path/to/magento-project \
  --db /path/to/magento-project/db/prod.sql \
  --brd /path/to/magento-project/docs/spec.docx \
  --bugs /path/to/magento-project/reports/bugs.xlsx \
  --create-branch --source-branch production
```

You end up with the audit branch, the standardized `.xlsx` + `.md`, the platform-specific Commerce workbook, and a new `CHANGE-LOG.md` entry summarizing findings by severity.

---

### 5.2 Sonar Scan agent

#### Purpose

LLM-driven SonarQube-style code quality analysis, with **no SonarQube server or binary required**. Covers all 6 Sonar pillars — **Bugs**, **Vulnerabilities**, **Security Hotspots**, **Code Smells**, **Duplications**, **Complexity** — and produces **A–E** ratings for Reliability / Security / Maintainability plus a pass/fail **Quality Gate**.

#### When to use it

- Enforce a Quality Gate on every merge to `main` in a project that isn't willing to run a full SonarQube server.
- Security-focused review before a release (CWE / OWASP alignment).
- Post-refactor validation — has the change improved or degraded ratings?
- Cross-stack visibility for platform teams operating multiple projects.
- Vulnerability triage — the workbook's dedicated **Vulnerabilities** sheet color-codes severity and includes concrete fix code.

#### Trigger phrases

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

#### The two-step workflow

The Sonar Scan agent is intentionally **two-step**, so the LLM output can be reviewed / edited before the deterministic report is generated (and so the ingest step is independently rerunnable if the report step fails):

1. **Step 1 — Scan (LLM):** The agent reads the per-stack rule pack, reasons over the project's source files, and writes `sonar-findings.json` to the configured `sonar_output` directory.
2. **Step 2 — Ingest (deterministic):** `scripts/run.ts --ingest` reads `sonar-findings.json`, computes A–E ratings + Quality Gate, and emits the standardized `.xlsx` + Markdown + `CHANGE-LOG.md` + a dedicated **Vulnerabilities** sheet.

The chat-triggered flows run both steps in sequence. To run **Step 2 only** (after you've edited `sonar-findings.json`), invoke `--ingest` directly.

#### CLI usage

```bash
cd .claude/skills/bmad-dept-code-sonar-scan-agent/scripts

# Step 2 (ingest) — the LLM step happens via chat; this is the deterministic followup
npx ts-node run.ts --ingest ./sonar-reports/sonar-findings.json --path /path/to/project
npx ts-node run.ts --ingest ./sonar-findings.json --path . --engine spring

# Preflight only
npx ts-node run.ts --path . --preflight

# List rule packs / registered engines
npx ts-node run.ts --list-engines
```

#### Flags reference

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--ingest <json>` | file | required for Step 2 | Path to the LLM-produced `sonar-findings.json`. | |
| `--path <dir>` | string | `.` | Project root. | |
| `--engine <id>` | enum | auto | Force a stack; otherwise inferred from the findings JSON. | Aliases: `aemcs`/`aemams` → `aem`; `commerce` → `commerce-paas`. |
| `--output <dir>` | dir | `{sonar_output}` | Report output dir. | |
| `--create-branch` | bool | false | Cut `dca/sonar-scan-<stack>-<timestamp>`. Only takes effect with `--ingest`. | |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. | |
| `--preflight` | bool | false | Print the LLM/context advisory and exit. | |
| `--no-preflight` | bool | false | Suppress the preflight advisory. | |
| `--list-engines` | bool | false | List available rule packs (one per stack). | |
| `--help` | bool | false | Show help. | |

#### Output files

- **`sonar-findings.json`** — the Step 1 artifact. Human-editable JSON conforming to the `Finding[]` shape defined in the Sonar Scan agent's `templates/report-json.md`.
- `sonar-scan-<branch>-<timestamp>-agent-report.xlsx` — standardized workbook + dedicated **Vulnerabilities** sheet (color-coded, includes concrete fix column).
- `sonar-scan-<branch>-<timestamp>-agent-report.md` — Markdown twin.
- `CHANGE-LOG.md` — appended.
- Optional `dca/sonar-scan-<stack>-<timestamp>` branch.

The workbook's Quality Gate line is at the top of the Run Info sheet. PASS = all three A ratings; any non-A ⇒ FAIL.

#### Example workflow

AEM AMS project, sonar scan on a new branch cut from `production`, then vulnerability triage:

```text
# In chat, Step 1 + Step 2 chained:
sonar scan my AEM project and cut a branch from production

# Once complete, follow up (chat):
which finding drove the Quality Gate to FAIL?
list every Security Hotspot with a concrete recommended fix
map every Vulnerability to CWE and OWASP Top 10
export the Vulnerabilities sheet as CSV
```

The Step-2 CLI executed under the hood:

```bash
cd .claude/skills/bmad-dept-code-sonar-scan-agent/scripts
npx ts-node run.ts \
  --ingest ./sonar-reports/sonar-findings.json \
  --path /path/to/aem-project \
  --engine aem \
  --create-branch --source-branch production
```

---

### 5.3 Code Generation agent

#### Purpose

Two-path code generation. **Tier 1** = 24 deterministic scaffolders across the 8 stacks (correct-by-construction, zero LLM tokens). **Tier 2** = an LLM/MCP path for anything the scaffolders don't cover, with **zero-config MCP auto-provisioning** for AEM.

#### When to use it

- Bootstrapping a new module (AEM component, Commerce module, Spring REST controller, App Builder action).
- Standardizing team output — every scaffolded artifact follows platform best practices out of the box.
- Rapid prototype scaffolding during an architecture-review workshop.
- Zero-config MCP setup when onboarding a team to Adobe MCP for AEM.
- LLM/MCP path for complex generation that composes multiple scaffolders (a full Commerce module with plugin + observer + admin form).

#### Trigger phrases

```text
list scaffolder types
create a new AEM component called Hero Banner
generate a Sling Model for the Article component
create a Spring REST controller for Orders
create a new Commerce module Acme_CustomShipping
create an after plugin on Magento\Catalog\Model\Product::getName
scaffold an API Mesh handler
create an EDS block called cards
set up MCP for this project
scaffold in dry-run mode so I can review before writing
force overwrite existing files if they conflict
```

#### The 24 scaffolder types by stack

Full canonical list (source: `IMPLEMENTATION-PLAN.md` §6 — the `GENERATORS` map in `scripts/scaffold/`):

| Stack | Scaffolders |
|-------|-------------|
| `aem` (5) | `sling-model`, `osgi-service`, `sling-servlet`, `component`, `workflow-process` |
| `sling` (4) | `osgi-service`, `sling-servlet`, `sling-filter`, `sling-model` |
| `spring` (3) | `rest-controller`, `service`, `jpa-repository` |
| `commerce-paas` (5) | `module`, `plugin`, `observer`, `graphql-resolver`, `controller` |
| `commerce-saas` (2) | `catalog-query`, `storefront-block` |
| `app-builder` (3) | `action`, `mesh`, `event-handler` |
| `eds` (1) | `block` |
| `eds-commerce` (1) | `dropin-block` |

Complex Commerce PaaS artifacts (admin grids, admin forms, CLIs, crons, queues, db-schema, repositories, tests) are addressable via the `--scope <thing>` route through the deterministic path or via the LLM/MCP path — see the `module-help.csv` capabilities and PROMPTS.md §3.4. Confirm the exact `--scope` values against `run.ts --list-types` before scripting them.

#### CLI usage

```bash
cd .claude/skills/bmad-dept-code-generation-agent/scripts

# List all deterministic scaffolders
npx ts-node run.ts --list-types

# List LLM/MCP generation templates
npx ts-node run.ts --list-templates

# One-shot scaffolder
npx ts-node run.ts --scaffold \
  --engine aem --type component --name HeroBanner \
  --path /path/to/aem-project

# Dry run (print planned files, write nothing)
npx ts-node run.ts --scaffold --engine spring --type rest-controller \
  --name OrdersController --path . --dry-run

# Force overwrite existing files
npx ts-node run.ts --scaffold --engine commerce-paas --type module \
  --name Acme_Foo --path . --force

# Auto-provision MCP for this project
npx ts-node run.ts --setup
```

#### Flags reference

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--path <dir>` | dir | `.` | Project root. | |
| `--engine <stack>` | enum | required (with `--scaffold`) | Target stack. | Same 8 engine IDs as elsewhere. |
| `--scaffold` | bool | false | Enter the deterministic scaffolder path. | Requires `--engine`, `--type`, `--name`. |
| `--type <t>` | enum | required (with `--scaffold`) | Scaffolder type — see the table above and `--list-types`. | |
| `--name <str>` | string | required (with `--scaffold`) | Name of the artifact being scaffolded. | |
| `--output <dir>` | dir | project-appropriate default | Override output directory. | |
| `--dry-run` | bool | false | Print planned files, write nothing. | Confirm the flag name against `run.ts --help` in your installed version. |
| `--force` | bool | false | Overwrite existing files if they conflict. | Confirm the flag name against `run.ts --help` in your installed version. |
| `--setup` | bool | false | Auto-provision `.mcp.json`, `.bmad/mcp-registry.toml`, `.env`, `.gitignore` for LLM/MCP generation. | Confirm before shipping — the setup writes files at your project root. |
| `--list-types` | bool | false | List deterministic scaffolder types. | Confirm the flag name against `run.ts --help`. |
| `--list-templates` | bool | false | List available LLM/MCP generation templates. | Confirm the flag name against `run.ts --help`. |
| `--create-branch` | bool | false | Cut `dca/generation-<stack>-<timestamp>` before writing. | |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. | |
| `--preflight` / `--no-preflight` | bool | false | Preflight advisory. | |
| `--help` | bool | false | Show help. | |

#### Output files

- The **scaffolded source files** at their canonical locations in your project tree.
- `generation-<branch>-<timestamp>-agent-report.xlsx` — the standardized report listing files created / files skipped.
- `generation-<branch>-<timestamp>-agent-report.md` — Markdown twin.
- `CHANGE-LOG.md` — appended.
- Optional `dca/generation-<stack>-<timestamp>` branch.

#### Example workflow

AEM component, dry-run first, then commit on a new branch:

```bash
# Chat: "create a new AEM component called Hero Banner --dry-run"
# Review the file list printed by the dry-run, then:
# Chat: "create a new AEM component called Hero Banner and cut a branch from develop"
```

The two CLI invocations:

```bash
cd .claude/skills/bmad-dept-code-generation-agent/scripts

npx ts-node run.ts --scaffold --engine aem --type component \
  --name HeroBanner --path /path/to/aem-project --dry-run

npx ts-node run.ts --scaffold --engine aem --type component \
  --name HeroBanner --path /path/to/aem-project \
  --create-branch --source-branch develop
```

---

### 5.4 Impact Analysis agent

#### Purpose

**Input-driven** blast-radius tracer. Give it a Proofhub CSV export (`--bugs`) and/or a BRD document (`--brd` — `.docx`, `.md`, or `.txt`). It extracts symbols/paths, scores files, walks reverse dependencies, and emits an **Input Traceability** report where every input item (bug or requirement) appears as a row — items with no code match become an INFO row flagged for manual review.

At least one input (`--bugs` or `--brd`) is required.

#### When to use it

- Sprint planning — quantify blast radius of the incoming bug backlog before you commit.
- Release readiness — trace which files change if the top-N bugs from the Proofhub export ship.
- BRD-to-code traceability for compliance / audit / regulated-industry projects.
- Regression scoping — identify the minimum set of modules to smoke-test given a bug batch.
- Combined bugs+BRD to reconcile stakeholder requirements against active bug pressure.

#### Trigger phrases

```text
trace the impact of these bugs: /path/to/bugs.csv
analyze the impact of this BRD: /path/to/requirements.docx
analyze impact --brd ./BRD.docx --engine spring
combined impact analysis of ./bugs.csv and ./requirements.docx
which bugs cluster around the same files?
which inputs had no code match?
```

#### CLI usage

```bash
cd .claude/skills/bmad-dept-code-impact-analysis-agent/scripts

# Bugs only
npx ts-node run.ts --path /project --bugs proofhub-export.csv

# BRD only, explicit engine
npx ts-node run.ts --path /project --brd requirements.docx --engine spring

# Combined
npx ts-node run.ts --path /project --bugs bugs.csv --brd brd.md

# List supported stacks
npx ts-node run.ts --list-engines
```

#### Flags reference

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--path <dir>` | dir | `.` | Project root. | |
| `--bugs <csv>` | file | — | Proofhub bug/task CSV export. | Custom RFC-4180 parser; headers keyword-auto-detected (id/title/description/module/priority/status). Confirm your export format resolves before shipping. |
| `--brd <doc>` | file | — | BRD document. | `.docx` via mammoth; any other extension read as UTF-8 (`.md`/`.txt`). Google Docs must be exported to `.docx` or `.txt` first. |
| `--engine <id>` | enum | auto | Force a stack profile. | 8 stack profiles; `aem` covers AEMaaCS + AMS. |
| `--output <dir>` | dir | `<path>/impact-reports` | Report output dir. | |
| `--create-branch` | bool | false | Cut `dca/impact-<stack>-<timestamp>` before writing. | |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. | |
| `--preflight` / `--no-preflight` | bool | false | Preflight advisory. | |
| `--list-engines` | bool | false | List available stack engines. | |
| `--help` | bool | false | Show help. | |

Note: The Impact Analysis `--bugs` (Proofhub CSV) is distinct from the Audit Commerce engine's `--bugs` (bug report `.xlsx`).

#### Output files

- `impact-<branch>-<timestamp>-agent-report.xlsx` — standardized workbook. The **Input Traceability** sheet is unique to this agent: one row per bug / BRD requirement → impacted file → blast-radius rank → risk score.
- `impact-<branch>-<timestamp>-agent-report.md` — Markdown twin.
- `CHANGE-LOG.md` — appended.
- Optional `dca/impact-<stack>-<timestamp>` branch.

#### Example workflow

Spring Boot service, combined bugs + BRD, produce a regression scoping report:

```bash
cd /path/to/spring-service
# Chat: "run impact analysis on my Spring Boot project using ./bugs.csv and ./BRD.docx"
```

```bash
cd .claude/skills/bmad-dept-code-impact-analysis-agent/scripts
npx ts-node run.ts \
  --path /path/to/spring-service \
  --engine spring \
  --bugs ./bugs.csv \
  --brd ./BRD.docx
```

Then follow up in chat:

```text
which modules should we regress-test based on this impact set?
show the input-to-code traceability
which inputs had no code match?
```

---

### 5.5 Test Coverage agent

#### Purpose

Two-tier test coverage. **Tier 1** = deterministic gap analysis (which files/classes/functions have no test) + optional **real** line/branch coverage from your existing tooling (JaCoCo XML, Istanbul JSON, Clover XML, LCOV). **Tier 2** = LLM-driven test generation to close the gaps toward 100%, per framework (JUnit + AEM/Sling Mocks, Spring Test + MockMvc + Testcontainers, PHPUnit + MFTF, Jest + jsdom).

#### When to use it

- Baseline coverage snapshot for a legacy project ("what percentage of this codebase has any test at all?").
- Real coverage snapshot when the CI already produces JaCoCo / Istanbul / Clover / LCOV — surface it in a standardized report.
- Test-generation sprint — LLM writes the missing tests to close gaps, then you re-run to verify the delta.
- Pre-release gate — enforce a floor on branch coverage of impacted files (chain with Impact Analysis — see [§9](#9-multi-agent-workflows)).
- Framework migration — identify test files that need porting.

#### Trigger phrases

```text
analyze test coverage
show untested code
analyze test coverage for the Checkout module
analyze coverage --coverage-report target/site/jacoco/jacoco.xml
run the coverage tool and report real line/branch coverage
generate tests for the Checkout module
full test coverage
generate JUnit tests for ArticleModel using AEM Mocks
```

#### CLI usage

```bash
cd .claude/skills/bmad-dept-code-test-coverage-agent/scripts

# Gap analysis only
npx ts-node run.ts --mode analyze --path /project --engine commerce

# Real coverage from an existing report
npx ts-node run.ts --mode analyze --path /project \
  --coverage-report target/site/jacoco/jacoco.xml

# Run the project's coverage tool first, then parse
npx ts-node run.ts --mode analyze --path /project --run-coverage --engine spring

# Generate tests to 100% (Tier 2 — LLM)
npx ts-node run.ts --mode generate --path /project

# Full cycle: analyze gaps, then generate
npx ts-node run.ts --mode full --path /project
```

#### Flags reference

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--mode <m>` | enum | `analyze` | `analyze` \| `generate` \| `full`. | |
| `--path <dir>` | dir | `.` | Project root. | |
| `--engine <id>` | enum | auto | Force a stack. | |
| `--name <str>` | string | folder name | Report title. | |
| `--module <name>` | string | — | Scope to a specific module / package. | |
| `--output <dir>` | dir | `{test_coverage_output}` | Output directory for reports. | |
| `--frameworks <list>` | csv | — | Subset of `unit,integration,mftf,api-functional,js,static,performance`. | |
| `--strategy <s>` | enum | `all` | Detection strategy: `filename` \| `namespace` \| `annotation` \| `all`. | |
| `--interactive` | bool | false | Prompt for framework/strategy selection. | |
| `--coverage-report <file>` | file | — | Parse an existing JaCoCo / Istanbul / LCOV / Clover report for real line/branch coverage. | Supported formats verified: JaCoCo XML, Istanbul JSON (summary + final), Clover XML, LCOV. |
| `--run-coverage` | bool | false | Run the project's coverage tool first (mvn/gradle-jacoco, jest/nyc, phpunit-clover), then parse it. | Confirm the exact commands invoked against your project's build setup. |
| `--create-branch` | bool | false | Cut `dca/test-coverage-<stack>-<timestamp>` before writing outputs. | |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. | |
| `--preflight` / `--no-preflight` | bool | false | Preflight advisory. | |
| `--list-engines` | bool | false | List available engines. | |
| `--help` | bool | false | Show help. | |

#### Output files

- `test-coverage-<branch>-<timestamp>-agent-report.xlsx` — standardized workbook. `Coverage %` is real line coverage when a report is present; otherwise a filename-existence estimate labeled `Coverage source`.
- `test-coverage-<branch>-<timestamp>-agent-report.md` — Markdown twin.
- `CHANGE-LOG.md` — appended.
- Optional `dca/test-coverage-<stack>-<timestamp>` branch.
- (Tier 2 only) The **generated test files** at their canonical locations in your test tree.

#### Example workflow

AEM project — gap analysis with real JaCoCo, then LLM-generate the missing tests:

```bash
# Step 1: real coverage snapshot
cd .claude/skills/bmad-dept-code-test-coverage-agent/scripts
npx ts-node run.ts --mode analyze --path /path/to/aem-project \
  --coverage-report /path/to/aem-project/target/site/jacoco/jacoco.xml

# Step 2: LLM test generation (via chat — the LLM writes tests to 100%)
# Chat: "full test coverage for the Payment module"
# Step 3: re-run analyze to confirm the delta
```

---

## 6. Understanding the 8 stacks

### The 8 engines

| Engine (`--engine`) | Platform | Tier-1 analysis |
|--------|----------|-----------------|
| `aem` | AEM as a Cloud Service / AEM AMS (Java) | Legacy regex scanner + Java tree-sitter AST pass. |
| `commerce` | Adobe Commerce / Magento 2 (PHP) | Legacy regex scanner + PHP tree-sitter AST pass. |
| `commerce-saas` | Adobe Commerce SaaS (Catalog / Live Search / drop-ins) | JS tree-sitter AST + config parse. |
| `sling` | Apache Sling / Shaft, sling-12 (Java) | Pure Java tree-sitter AST. |
| `spring` | Spring Boot middleware (Java) | Java tree-sitter AST + regex + config parse. |
| `app-builder` | Adobe App Builder / I/O Runtime (JS) | JS tree-sitter AST + config parse. |
| `eds` | Edge Delivery Services (JS) | Legacy regex scanner + JS tree-sitter AST pass. |
| `eds-commerce` | EDS + Commerce hybrid | Legacy regex scanner + reuses EDS JS AST pass. |

### Engine ID aliases

- `commerce` = `commerce-paas`
- `aemcs` and `aemams` → `aem` (use `--platform` to constrain)

### Auto-detection order

The Audit agent's dispatcher iterates the registry in registration order. On a multi-match, it prefers `eds-commerce` (so a project with both EDS signals and Commerce dropins is served by the hybrid engine). Detection signals used:

| Signal | Engine |
|--------|--------|
| `composer.json` with `magento/` or `app/code/` | `commerce` |
| `ui.apps/`, `pom.xml` with AEM SDK | `aem` |
| `pom.xml`/`bnd` with `org.apache.sling`/`org.apache.felix` (Shaft/MDM/SAM markers), no AEM markers | `sling` |
| `spring-boot-starter*`/`org.springframework.boot` in `pom.xml`/`build.gradle`, or `@SpringBootApplication` | `spring` |
| Storefront Events SDK / `Magento-Environment-Id` / `catalog-service.adobe.io` (no `app/code`) | `commerce-saas` |
| `blocks/`, `helix-query.yaml`, `fstab.yaml` | `eds` |
| EDS signals + commerce dropins | `eds-commerce` |
| `app.config.yaml`, `.aio`, `@adobe/aio-sdk` | `app-builder` |

### The 11 in-scope variants → 8 engines mapping

The overall coverage matrix serves **11 tech-stack variants** through **8 engines**:

| # | Variant | Engine |
|---|---------|--------|
| 1 | AEMaaCS | `aem` (`--platform aemcs`) |
| 2 | AEM AMS | `aem` (`--platform aemams`) |
| 3 | Commerce PaaS (Magento 2) | `commerce` / `commerce-paas` |
| 4 | Commerce SaaS (ACCS / drop-ins / Catalog / Live Search) | `commerce-saas` |
| 5 | App Builder — API Mesh | `app-builder` |
| 6 | App Builder — Middleware / BFF | `app-builder` |
| 7 | App Builder — Eventing (I/O Events) | `app-builder` |
| 8 | App Builder — Apps (UI Extensibility) | `app-builder` |
| 9 | Sling-12 / Shaft | `sling` |
| 10 | Spring Boot | `spring` |
| 11 | EDS + EDS×Commerce | `eds` / `eds-commerce` |

### `--platform` for AEM

Only the `aem` engine honors `--platform`. Values:

- `aemcs` — AEM as a Cloud Service rules only.
- `aemams` — AEM AMS (on-prem / managed services) rules only.
- `both` — apply both rule sets (default when auto-detected).

Use this when you're on a specific platform and don't want the noise of the other's rules.

### When to override auto-detection

- The project mixes signals from two families (e.g. a Spring Boot service that also embeds AEM libraries) — pass `--engine` to force the analysis you care about.
- CI where the working directory may not have complete signal files.
- Split repos where a single folder contains only a subset of the platform's canonical layout.
- Migrations mid-flight, where the source tree partially matches both `commerce` and `commerce-saas`.

---

## 7. Standardized outputs contract

Every agent, every stack, every run.

### The three outputs

1. **Excel workbook** — `<agent>-<branch>-<timestamp>-agent-report.xlsx`.
2. **Markdown twin** — `<agent>-<branch>-<timestamp>-agent-report.md`.
3. **CHANGE-LOG.md** append — one entry per run, spliced newest-first after the `<!-- dca:entries -->` marker.

### File naming

- `<agent>` — one of `audit`, `sonar-scan`, `generation`, `impact`, `test-coverage`.
- `<branch>` — the current git branch, sanitized (`/` → `-`). Falls back to `nobranch` outside a repo.
- `<timestamp>` — local time `YYYYMMDD_HHMMSS`.

Example: `audit-main-20260801_143512-agent-report.xlsx`.

### The 15-column Summary sheet contract

The Summary sheet's columns are the **contract**; their order is part of it. Do NOT reorder without a version bump.

| # | Column |
|---|--------|
| 1 | ID |
| 2 | Title |
| 3 | Description |
| 4 | Tech Stack |
| 5 | Category / Module |
| 6 | Code Reference |
| 7 | Severity |
| 8 | Confidence |
| 9 | Rule ID |
| 10 | Recommendation / Fix |
| 11 | Impact Analysis |
| 12 | Effort |
| 13 | Dev Comments |
| 14 | Owner |
| 15 | Status |

Required subset (guaranteed populated on every finding): **Title, Description, Code Reference, Severity, Recommendation/Fix, Impact Analysis, Dev Comments, Status**.

### Fixed sheet order

1. **Run Info** — agent, engine, stack, project, source branch, working branch, timestamp, tool versions, severity counts.
2. **Summary** — the 15-column contract sheet.
3. **Severity Breakdown** — counts per severity.
4. **By Category** — counts per category (or Sonar pillar).
5. **Recommendations** — present only when recommendations are supplied.
6. **Input Traceability** — present only when findings carry `inputRef` (i.e. the Impact Analysis agent).

**Agent-specific extras:**

- **Sonar Scan** — adds a dedicated **Vulnerabilities** sheet after the standard sheets. Color-coded severity rows, concrete fix column. Also writes `sonar-findings.json` as the Step 1 artifact.
- **Audit** — legacy engines (aem, commerce, eds, eds-commerce) additionally write their own platform-specific multi-sheet Excel and optionally `.pdf`/`.json` (`--format`, `--json`).
- **Code Generation** — the generated source files at their canonical project locations.
- **Test Coverage** — the LLM-generated test files under the project's canonical test tree.

### CHANGE-LOG entry format

The writer keeps a `# CHANGE-LOG` header at the top and a `<!-- dca:entries -->` marker. Each run splices one entry directly after the marker:

```markdown
## 20260801_143512 — audit — commerce — Acme

- **Branch:** dca/audit-commerce-20260801_143512 from production
- **Summary:** …
- **Findings:** 87 total (CRITICAL 4, HIGH 12, MEDIUM 41, LOW 25, INFO 5)
- **Report:** audit-dca-audit-commerce-20260801_143512-agent-report.xlsx
- **Files changed:** …
- **Details:** …
```

### `--create-branch` / `--source-branch` behavior

- `--create-branch` opts in to cutting `dca/<agent>-<stack>-<YYYYMMDD_HHMMSS>` **before** any files are written, so the report + CHANGE-LOG entry land on the fresh branch (not on your working branch).
- The source-branch cascade is `production → main → master → develop` — the first branch that exists wins. Override with a single `--source-branch <name>`.
- All git operations are best-effort — outside a repo, the branch step degrades gracefully and the run still emits its `.xlsx` / `.md`.

---

## 8. Preflight mode (Static / LLM / Hybrid)

Before dispatching to any engine, every agent runs an **advisory** preflight that surfaces:

1. **Model + context-window detection** — reads provider model env vars and the host tool (Claude Code / Copilot / Cursor / VS Code) and maps to a context-window size.
2. **Project size estimation** — globs source files, counts LOC, estimates token cost.
3. **Mode recommendation** — one of three modes based on window fit:
   - **STATIC** — project fits **≥ 60%** of the window (too big to reason over end-to-end). Run the deterministic scanner first; LLM only enriches.
   - **LLM** — project fits **≤ 12%** of the window. The LLM can reason over the code directly.
   - **HYBRID** — anywhere in between. Scan first, focus LLM on the highest-risk directories.

The advisor prints on every normal run. To see just the advisory and exit:

```bash
npx ts-node run.ts --path . --preflight
```

To suppress it entirely:

```bash
npx ts-node run.ts --path . --no-preflight
```

The preflight is intentionally advisory — it never blocks the run. If you disagree with its recommendation, ignore it. The token cost projections it prints are governed by the `BMAD_*` variables in [`.env.example`](skills/.env.example) — tune those for your team's actual price.

---

## 9. Multi-agent workflows

Paste any of these chained blocks into the agent chat. Each block runs its steps in order. Full catalog in [PROMPTS.md §6](PROMPTS.md).

### 9.1 Full pre-release gate

```text
run audit, sonar scan, test coverage, and impact analysis in that order on a new branch cut from production, then summarize as one release-readiness report
```

Use for: a release-candidate go/no-go. Produces one branch, four standardized reports, and one summary.

### 9.2 Audit → Sonar → Generate fixes

```text
audit my project, then sonar scan the same project, then generate deterministic fixes for the top 5 vulnerabilities
```

Use for: post-audit vulnerability remediation. Each step produces its own standardized outputs; the Generation step scaffolds the fix stubs.

### 9.3 Impact → Coverage → Generate tests

```text
impact-analyze this Proofhub export at ./bugs.csv, then run test coverage on the impacted files, then generate missing tests to close every gap
```

Use for: sprint start when you have a bug backlog and want to lock in test coverage for exactly the files that will change.

### 9.4 Upgrade diff

```text
run a full audit against branch production and save the baseline, then check out release/2.4.7-p9 and run the same audit, then diff the two reports and list the new HIGH+CRITICAL findings
```

Use for: platform upgrades — Magento patches, AEMaaCS SDK bumps, Spring Boot majors. Establishes a pre/post delta.

### 9.5 AEM cloud-readiness migration

```text
full audit my AEM AMS project --platform aemams, then sonar scan the same project, then generate a fix plan focused on AEMaaCS cloud-readiness gaps only
```

Use for: AMS → AEMaaCS migration prep. Focuses the LLM on cloud-readiness gaps rather than the full audit surface.

---

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| **Can't find `.claude/skills/…`** — the CLI paths in this manual don't resolve. | Depending on your BMAD installer's layout, skills may install to `bmad/dca/agents/…` instead. Locate one agent with `find . -type d -name "bmad-dept-code-audit-agent"` and use that path as the base. |
| **`Error: Cannot find module 'web-tree-sitter'`** or WASM load errors on first Tier-1 scan. | Dependencies weren't installed. Run `cd .claude/skills/shared && npm install`, then repeat for the specific agent's `scripts/` folder. Confirm Node.js is ≥ v20.12 — older Node can't load the WASM. |
| **`Error: --ingest <findings.json> is required for Step 2`** on Sonar Scan. | You ran Step 2 without Step 1. Trigger the LLM scan first (chat: `sonar scan my project`) so `sonar-findings.json` is written to the configured `sonar_output` directory, then re-run `--ingest`. |
| **MCP server not connecting** (Code Generation LLM/MCP path). | Run `npx ts-node run.ts --setup` from the generation agent's `scripts/` folder. Confirm `.mcp.json`, `.bmad/mcp-registry.toml`, and `.env` were written at your project root. Then restart your host (Claude Code / IDE) so it re-reads `.mcp.json`. |
| **Preflight recommends LLM but project is huge** — or **recommends STATIC even though project is small**. | The advisor uses the assumed context window from env vars — the model detection may be wrong. Verify by running `--preflight` alone and reading the printed model. Override the assumption by exporting the `BMAD_TOKEN_BUDGET_TOTAL` env var, or just ignore the advisory (it never blocks). |
| **Branch cut failed** — `dca/audit-…` was never created. | The most common cause is not being in a git repo, or being detached HEAD. The branch step is non-fatal — the run still emits its `.xlsx` / `.md`. If you needed the branch, `git checkout -b dca/<agent>-<stack>-<timestamp>` manually and re-run. |
| **`--source-branch` cascade found nothing** — no `production`, `main`, `master`, or `develop` exists. | Pass `--source-branch <name>` explicitly with the branch you want the working branch cut from. |
| **Report came back empty** — 0 findings, agent said "complete". | For Tier 1: check whether the engine's auto-detect actually picked a stack (`--list-engines` and re-run with `--engine <id>` explicitly). For Tier 2: confirm the LLM actually reached your files — the preflight's "project size" line should be non-zero. |
| **Coverage tool timed out** (`--run-coverage`). | The runner shells out to `mvn`, `gradle`, `jest`, `nyc`, or `phpunit`. Run the underlying tool manually to confirm it succeeds in isolation. If it does, run the agent again — the timeout is usually a transient CI issue. |
| **`No auto-detect match`** — the dispatcher errored out. | Pass `--engine <id>` explicitly. If your project genuinely doesn't match any of the 8, confirm you're in the right directory (`--path`). |
| **Audit's `--bugs` didn't accept my file** vs. **Impact Analysis's `--bugs` did**. | The two `--bugs` flags accept different formats. Audit's Commerce engine `--bugs` is an `.xlsx` bug report; Impact Analysis's `--bugs` is a Proofhub CSV export. Use the format the agent's docs specify. |
| **Sonar's Vulnerabilities sheet is empty even though the LLM found issues**. | The LLM must set `category: "Vulnerability"` (or `"Security Hotspot"`) on each finding in `sonar-findings.json`. Open the JSON and check the `category` field; the ingest step routes rows to the Vulnerabilities sheet by that string. |

Additional troubleshooting prompts (copy-paste to the agent chat) live in [PROMPTS.md §8](PROMPTS.md).

---

## 11. Uninstall / rollback

### Full uninstall

```bash
cd /path/to/your-project
npx bmad-method uninstall --directory .
```

This removes the agent skill folders. It does not touch:

- Reports the agents wrote (`audit-reports/`, `sonar-reports/`, etc.) — delete manually if you want.
- `CHANGE-LOG.md` at the project root — delete manually.
- `.mcp.json`, `.bmad/mcp-registry.toml`, `.env` created by `--setup` — delete manually if you never plan to reinstall.
- `dca/*` working branches — delete via `git branch -D dca/<agent>-<stack>-<timestamp>`.

### Reset config only (keep the skills)

Re-run the installer with `--action update` and override the config variables:

```bash
npx bmad-method install \
  --directory . \
  --action update \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --set dca.audit_engine=auto \
  --set dca.audit_output={output_folder}/audit-reports \
  --yes
```

### Revert a working branch

```bash
git branch -D dca/<agent>-<stack>-<timestamp>
# or if you already merged it:
git revert <merge-commit>
```

The agents never force-push and never touch remotes on their own — everything they do is local.

---

## 12. Advanced — Author's guide

Adding a new engine or a new agent is out of scope for this consumption manual. See **[Appendix A](#appendix-a--authoring-a-new-skill-module)** below for the folder scaffold and file conventions, and the "Adding a New Platform Engine" section of the [README](README.md#adding-a-new-platform-engine) for the engine-registration flow.

If you're extending an existing engine (adding a rule to `sling`, adding a scaffolder to `commerce-paas`), you don't need to touch anything under `skills/`. Fork the repo, edit `scripts/engines/<stack>/` or `scripts/scaffold/`, then republish via `--custom-source <your-fork>`.

---

## Appendix A — Authoring a new skill module

Preserved for authors who want to add a new module to the `dca` family (or fork it to a new module code entirely).

### Scaffold

```bash
MODULE_NAME="my-skill-name"
mkdir -p skills/$MODULE_NAME/{assets,resources,templates,scripts/{engines,shared}}
touch skills/{module.yaml,module-help.csv}
touch skills/$MODULE_NAME/{SKILL.md,GUIDE.md,customize.toml}
touch skills/$MODULE_NAME/assets/{module.yaml,module-help.csv}
touch skills/$MODULE_NAME/scripts/{run.ts,package.json,tsconfig.json}
touch skills/$MODULE_NAME/scripts/engines/registry.ts
touch skills/$MODULE_NAME/scripts/shared/base.ts
```

### `customize.toml`

```toml
[skill]
name = "your-skill-name"
description = "One sentence."
version = "1.0.0"

[skill.tools]
required = ["claude-code"]

[skill.activation]
keywords = ["audit", "scan", "review"]

[skill.scripts]
dispatcher = "scripts/run.ts"
package = "scripts/package.json"

[skill.commands]
scan = "npx ts-node scripts/run.ts"
deep = "skill"
full = "scan+skill"
```

> **Note on the schema.** `customize.toml` uses a project-local `[skill.*]` shape; the top-level `skills/module.yaml` is authoritative for BMAD module registration. Verify with your BMAD installer whether the activation / commands defined here are picked up in your target install — depending on installer version, some fields may be advisory only.

### `SKILL.md` principles

- Write as instructions **TO the AI agent**, not to a human. Human docs live in `GUIDE.md`.
- Be explicit about file paths, commands, error handling.
- Include "do NOT ask the user" for things that should be silent (like `npm install`).
- Define trigger phrases that map to specific modes.
- Pre-flight section auto-installs deps silently:
  ```bash
  cd .claude/skills/your-skill/scripts && [ -d node_modules ] || npm install --silent
  ```

### Author's checklist

- [ ] `module.yaml` — `code` unique, `name` matches everywhere.
- [ ] `module-help.csv` — actions match `customize.toml` commands.
- [ ] `customize.toml` — skill name matches folder name.
- [ ] `SKILL.md` — frontmatter `name` matches folder, paths relative.
- [ ] `package.json` — all deps listed.
- [ ] `scripts/run.ts` — runs standalone (`npx ts-node run.ts --help`).
- [ ] `assets/` — contains copies of `module.yaml` + `module-help.csv`.
- [ ] TypeScript compiles clean (`npx tsc --noEmit`).

---

## Appendix B — Full CLI flag reference

Every documented CLI flag across all five agents. **Applicable agents** column: `A`=Audit, `S`=Sonar Scan, `G`=Code Generation, `I`=Impact Analysis, `T`=Test Coverage. Flags marked "confirm against `run.ts`" should be verified against the exact `--help` output of your installed version before scripting them into CI.

| Flag | Agents | Type | Default | Purpose | Notes / Warnings |
|------|:------:|------|---------|---------|------------------|
| `--path <dir>` | A, S, G, I, T | dir | `.` | Project root. | |
| `--engine <id>` | A, S, G, I, T | enum | auto | Force a stack. See [§6](#6-understanding-the-8-stacks). | |
| `--name <str>` | A, T | string | folder name | Project name in report. | |
| `--output <dir>` | A, S, G, I, T | dir | per-agent default | Override report output directory. | |
| `--format <t>` | A | enum | `excel` | `excel` \| `md` \| `pdf` \| `all`. | Confirm behavior per engine — reliably honored by the AEM legacy report. |
| `--platform <p>` | A | enum | auto | AEM engine only: `aemcs` \| `aemams` \| `both`. | Only meaningful when `--engine aem`. |
| `--namespace <ns>` | A | string | `Custom` | Commerce namespace filter. | |
| `--module <list>` | A, T | csv | — | Filter to specific module(s) / package(s). | |
| `--db <path>` | A | file | — | Commerce SQL dump. | Commerce engine only — passed to Commerce's `audit.ts`. |
| `--brd <path>` | A, I | file | — | BRD document. | Audit-Commerce: repeatable. Impact: single value. |
| `--bugs <path>` | A, I | file | — | Bug report. | Audit-Commerce: `.xlsx`. Impact: Proofhub CSV. **Distinct formats.** |
| `--no-code-audit` | A | bool | false | Skip the code scan (BRD-only or bugs-only run). | Commerce engine only. |
| `--json` | A | bool | false | Also emit findings as JSON. | aem/commerce engines. |
| `--mode <m>` | T | enum | `analyze` | `analyze` \| `generate` \| `full`. | |
| `--frameworks <list>` | T | csv | — | Subset of `unit,integration,mftf,api-functional,js,static,performance`. | |
| `--strategy <s>` | T | enum | `all` | `filename` \| `namespace` \| `annotation` \| `all`. | |
| `--interactive` | T | bool | false | Prompt for framework / strategy selection. | |
| `--coverage-report <file>` | T | file | — | Parse an existing JaCoCo / Istanbul / Clover / LCOV report. | Supported formats verified: JaCoCo XML, Istanbul JSON, Clover XML, LCOV. |
| `--run-coverage` | T | bool | false | Run the project's coverage tool first, then parse. | Confirm against `run.ts` — invokes mvn/gradle-jacoco, jest/nyc, phpunit-clover. |
| `--ingest <json>` | S | file | required for Step 2 | Path to `sonar-findings.json`. | Sonar Step 2 only. |
| `--scaffold` | G | bool | false | Enter deterministic scaffolder path. | Requires `--engine`, `--type`, `--name`. |
| `--type <t>` | G | enum | required (with `--scaffold`) | Scaffolder type. | See [§5.3](#53-code-generation-agent) or `--list-types`. |
| `--dry-run` | G | bool | false | Print planned files, write nothing. | **Confirm against `run.ts`** — flag name may vary by installed version. |
| `--force` | G | bool | false | Overwrite existing files if they conflict. | **Confirm against `run.ts`** — flag name may vary by installed version. |
| `--setup` | G | bool | false | Auto-provision `.mcp.json` + `.bmad/mcp-registry.toml` + `.env` + `.gitignore`. | **Confirm against `run.ts`** — writes files at project root. |
| `--list-templates` | G | bool | false | List LLM/MCP generation templates. | **Confirm against `run.ts`.** |
| `--list-types` | G | bool | false | List deterministic scaffolder types. | **Confirm against `run.ts`.** |
| `--list-engines` | A, S, I, T | bool | false | List registered engines / rule packs. | |
| `--create-branch` | A, S, G, I, T | bool | false | Cut `dca/<agent>-<stack>-<timestamp>` before writing outputs. | |
| `--source-branch <name>` | A, S, G, I, T | string | auto | Base branch for `--create-branch`. Default cascade: `production → main → master → develop`. | |
| `--preflight` | A, S, G, I, T | bool | false | Print the model/context advisory and exit. | See [§8](#8-preflight-mode-static--llm--hybrid). |
| `--no-preflight` | A, S, G, I, T | bool | false | Suppress the preflight advisory that otherwise prints on every run. | |
| `--help` / `-h` | A, S, G, I, T | bool | false | Show help. | |

---

## Appendix C — Naming conventions + repo layout

### Naming table

| Item | Convention | Example |
|------|-----------|---------|
| Repo | `bmad-<purpose>` | `bmad-dept-code-agent` |
| Skill folder | `bmad-<purpose>-agent` | `bmad-dept-code-audit-agent` |
| Module code | 2–4 chars | `dca` |
| Engine dirs | lowercase, **hyphens** (match the engine ID) | `eds-commerce` |
| Engine IDs | lowercase, hyphens | `eds-commerce` |
| Report filename | `<agent>-<branch>-<timestamp>-agent-report.<ext>` | `audit-main-20260801_143512-agent-report.xlsx` |
| Working branch | `dca/<agent>-<stack>-<timestamp>` | `dca/audit-commerce-20260801_143512` |

Note: engine directories are now consistently hyphenated (`eds-commerce`, not `eds_commerce`) matching the engine ID. Older forks may still show `eds_commerce` — the ID and dir have been reconciled.

### Source-repo layout

```
bmad-dept-code-agent/
├── README.md
├── MANUAL.md                          ← This file
├── IMPLEMENTATION-PLAN.md
├── PROMPTS.md
├── CHANGE-LOG.md
├── LICENSE
├── DCA-Agent-Coverage.xlsx            ← Coverage deliverables (built by tools/)
├── DCA-Agent-Coverage.pdf
├── DCA-Test-Commands.xlsx
├── .claude-plugin/
│   └── marketplace.json               ← Plugin manifest (module version 4.0.0)
├── tools/
│   └── coverage-report/               ← build-xlsx.js, build-pdf.js, build-test-commands.js
└── skills/                            ← --custom-source points here
    ├── module.yaml                    ← Module identity + config variables
    ├── module-help.csv                ← Menu entries (13-column CSV)
    ├── .env.example                   ← Token-budget + cost knobs
    ├── shared/                        ← @bmad/dca-shared foundation — install deps FIRST
    │   ├── ast/  core/  coverage/  git/  java/  js/  php/
    │   ├── output/  preflight/  report/  token-budget/
    │   ├── index.ts
    │   └── package.json · tsconfig.json
    ├── bmad-dept-code-audit-agent/           ← Auditor
    ├── bmad-dept-code-sonar-scan-agent/      ← Sonar Scanner
    ├── bmad-dept-code-generation-agent/      ← Generator
    ├── bmad-dept-code-impact-analysis-agent/ ← Impact Analyst
    └── bmad-dept-code-test-coverage-agent/   ← Test Coverage
```

Each agent folder shares the same shape (Audit shown expanded):

```
bmad-dept-code-audit-agent/
├── SKILL.md                 ← AI-facing instructions (workflows, modes)
├── GUIDE.md                 ← Human-facing setup / examples
├── customize.toml           ← Activation keywords, named commands
├── assets/                  ← Copies of module.yaml + module-help.csv
├── resources/               ← Rule packs, detection strategy, scoring models
├── templates/               ← LLM-path output templates
└── scripts/                 ← TypeScript dispatcher + engines
    ├── run.ts               ← Entry point (preflight → dispatch)
    ├── package.json  ·  tsconfig.json
    ├── shared/              ← Agent-local helpers
    └── engines/             ← 8 registered engines
        ├── registry.ts      ← Auto-detection + engine resolution
        ├── aem/  commerce/  commerce-saas/
        ├── sling/  spring/  app-builder/
        ├── eds/  eds-commerce/
```

### Key files

| File | Role |
|------|------|
| `SKILL.md` | Instructions TO the AI agent — workflows, commands, modes. |
| `GUIDE.md` | Instructions FOR humans — setup, CLI examples. |
| `customize.toml` | Activation keywords, named commands, script paths. |
| `module.yaml` | Module identity, agents, config variables. |
| `module-help.csv` | Agent menu entries (13-column CSV). |
| `scripts/run.ts` | Dispatcher — preflight → CLI parse → engine resolve → dispatch. |
| `scripts/engines/registry.ts` | Auto-detection + engine resolution (8 engines). |
| `skills/shared/report/standard-report.ts` | `StandardExcelReport` — the 15-column Summary contract. |
| `skills/shared/output/emit.ts` | Emits `.xlsx` + `.md` twin + `CHANGE-LOG.md`, optional branch cut. |
| `skills/shared/preflight/index.ts` | Preflight advisor — detects model/context, recommends STATIC/HYBRID/LLM. |

---

## Appendix D — Version + support

| Item | Value |
|------|-------|
| Module version | **4.0.0** (source of truth: [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)) |
| Module code | `dca` |
| BMAD framework | Any recent BMAD Method version supporting `bmad-method install --custom-source`. If in doubt, use the latest — the plugin has no upper bound. |
| Reference host | Claude Code (`--tools claude-code`). Other BMAD-supported hosts (Cursor, VS Code + Copilot) work in principle — verify with a smoke run. |
| License | [MIT](LICENSE) |
| Report bugs | [https://github.com/mayur434/bmad-dept-code-agent/issues](https://github.com/mayur434/bmad-dept-code-agent/issues) |
| Homepage / source | [https://github.com/mayur434/bmad-dept-code-agent](https://github.com/mayur434/bmad-dept-code-agent) |

For prompt-level questions, start with [PROMPTS.md](PROMPTS.md). For architectural / feature-status questions, start with [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). For anything else, open an issue.
