---
title: CLI Flags
sidebar_position: 1
description: Consolidated CLI flag reference across all 5 DCA agents, the shared bootstrap, and the cross-agent chain orchestrator.
---

# CLI Flags

Every documented CLI flag across the five DCA agents (`run.ts` dispatchers), the shared bootstrap installer, and the `dca chain-all` cross-agent orchestrator.

The **Agents** column uses these codes:

- `A` = Audit (`bmad-dept-code-audit-agent`)
- `S` = Sonar Scan (`bmad-dept-code-sonar-scan-agent`)
- `G` = Code Generation (`bmad-dept-code-generation-agent`)
- `I` = Impact Analysis (`bmad-dept-code-impact-analysis-agent`)
- `T` = Test Coverage (`bmad-dept-code-test-coverage-agent`)

Flags marked **"Confirm against `run.ts`"** should be verified against `--help` output of your installed version before scripting them into CI.

Related pages: [Config Vars](config-vars) · [Scoring Model](scoring-model) · [Audit](../agents/audit) · [Sonar Scan](../agents/sonar-scan).

---

## Common flags (all agents)

Flags accepted by every agent's `run.ts` dispatcher.

| Flag | Agents | Type | Default | Purpose | Notes |
|------|:------:|------|---------|---------|-------|
| `--path <dir>` | A, S, G, I, T | dir | `.` | Project root the agent operates on. | Absolute or relative; agents resolve to absolute. |
| `--engine <id>` | A, S, G, I, T | enum | auto | Force a stack. Values: `aem`, `commerce`, `commerce-paas`, `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`. | Skip auto-detection. See [Engines](../concepts/engines). |
| `--role <code>` | A, S, G, I, T | enum | resolved | Override the resolved DCA role for a single run. One of: `ea`, `tl`, `de`, `qa`, `devops`, `security`, `pm`, `ba`, `migration`, `content`, `generic`. | Per-run only; does NOT persist to `.bmad/role.yaml`. |
| `--preflight` | A, S, G, I, T | bool | false | Print the preflight advisory (STATIC / HYBRID / LLM) and exit. | See [Preflight](../concepts/preflight). |
| `--no-preflight` | A, S, G, I, T | bool | false | Suppress the preflight advisory that otherwise prints on every run. | Useful in CI where the advisory is noise. |
| `--create-branch` | A, S, G, I, T | bool | false | Cut `dca/<agent>-<stack>-<timestamp>` before writing outputs. | Base branch cascade: `production` → `main` → `master` → `develop`. |
| `--source-branch <name>` | A, S, G, I, T | string | auto | Base branch for `--create-branch`. | Overrides the auto cascade. |
| `--yes-install` | A, S, G, I, T | bool | false | Skip the first-run install prompt; always install missing deps. | Mutually exclusive with `--no-install`. |
| `--no-install` | A, S, G, I, T | bool | false | Do not install missing deps; exit 2 if any are missing. | For air-gapped / locked-down CI. |
| `--interactive` | A, S, G, I, T | bool | false | Prompt for role and other inputs interactively (where supported). | Otherwise agents run headless. |
| `--list-engines` | A, S, I, T | bool | false | Print registered engines / rule packs and exit. | Sonar exposes `--list-rule-packs` as an alias. |
| `--help` / `-h` | A, S, G, I, T | bool | false | Show help and exit. | |

---

## Audit-specific flags

Flags accepted by `bmad-dept-code-audit-agent/scripts/run.ts`.

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--name <str>` | string | folder name | Project name embedded in report headers and file names. | |
| `--output <dir>` | dir | `{audit_output}` config var | Override the report output directory. | Default resolves from `skills/module.yaml`. |
| `--format <t>` | enum | `excel` | Output format: `excel` \| `md` \| `pdf` \| `all`. | Reliably honored by the AEM engine; confirm per-engine coverage against `run.ts`. |
| `--platform <p>` | enum | auto | AEM engine only: `aemcs` \| `aemams` \| `both`. | Ignored for non-AEM engines. |
| `--namespace <ns>` | string | `Custom` | Commerce namespace filter (default is `Custom` per `audit_namespace` config var). | Commerce engine only. |
| `--module <list>` | csv | — | Filter to specific modules / packages. | Repeatable via comma. |
| `--db <path>` | file | — | Commerce SQL dump path. | Commerce engine only. |
| `--brd <path>` | file | — | BRD document (`.docx` / `.md` / `.txt`). | Commerce engine: repeatable. |
| `--bugs <path>` | file | — | Bug report. Commerce: `.xlsx`. | Distinct format from Impact Analysis's `--bugs`. |
| `--no-code-audit` | bool | false | Skip the code scan (BRD-only or bugs-only run). | Commerce engine only. |
| `--json` | bool | false | Also emit findings as JSON. | AEM + Commerce engines. |
| `--mode <m>` | enum | `full` | `scan` (Tier 1 only) \| `deep-audit` (Tier 2 only) \| `full`. | Chat activations select the correct mode. |

---

## Sonar-specific flags

Flags accepted by `bmad-dept-code-sonar-scan-agent/scripts/run.ts`. The scan is a **two-step** workflow: Step 1 is the LLM scan (chat-driven) that writes `sonar-findings.json`; Step 2 is the deterministic ingest that reads that JSON and produces the standardized Excel report + Quality Gate.

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--ingest <json>` | file | required for Step 2 | Path to `sonar-findings.json` produced by Step 1. | Sonar Step 2 only. |
| `--output <dir>` | dir | `{sonar_output}` config var | Override the report output directory. | |
| `--list-rule-packs` | bool | false | List available Sonar rule packs (one per supported stack). | Alias for `--list-engines`. |
| `--focus <topic>` | string | — | Chat-only hint that biases Step 1 (e.g. "SQL injection and XSS", "Core Web Vitals"). | Not enforced by `run.ts`; the LLM parses natural language. |
| `--strict-gate` | bool | false | Chat-only shorthand for treating any non-A rating as FAIL (identical to default). | The Quality Gate is already strict by default (all three ratings = A). |

---

## Generation-specific flags

Flags accepted by `bmad-dept-code-generation-agent/scripts/run.ts`.

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--scaffold` | bool | false | Enter the deterministic scaffolder path (bypasses the LLM path). | Requires `--engine`, `--type`, `--name`. |
| `--type <t>` | enum | required with `--scaffold` | Scaffolder type (see `--list-types`). | E.g. `sling-model`, `osgi-service`, `plugin`, `observer`, `rest-controller`. |
| `--scope <t>` | enum | — | Menu-CSV alias for `--type` used by `module-help.csv` entries (e.g. `--scope module`, `--scope plugin`). | Confirm against `run.ts` for your installed version. |
| `--name <str>` | string | required with `--scaffold` | Name of the artifact to create. | E.g. `HeroBanner`, `Acme_CustomShipping`. |
| `--dry-run` | bool | false | Print the planned files, write nothing. | Confirm against `run.ts` — flag name may vary. |
| `--force` | bool | false | Overwrite existing files if they conflict. | Confirm against `run.ts`. |
| `--setup` | bool | false | Auto-provision `.mcp.json` + `.bmad/mcp-registry.toml` + `.env` + `.gitignore` at project root. | Confirm against `run.ts`. |
| `--list-templates` | bool | false | List the LLM / MCP generation templates. | Confirm against `run.ts`. |
| `--list-types` | bool | false | List deterministic scaffolder types (per engine). | Confirm against `run.ts`. |
| `--output <dir>` | dir | project source tree | Override where scaffolded files are written (rarely used). | |

---

## Impact-specific flags

Flags accepted by `bmad-dept-code-impact-analysis-agent/scripts/run.ts`. **At least one of `--bugs` or `--brd` is required.**

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--bugs <path>` | file | — | Proofhub bug/task export CSV. | Distinct from Audit's `--bugs` (which takes `.xlsx`). |
| `--brd <path>` | file | — | BRD document: `.docx` \| `.md` \| `.txt`. | Single value; use combined input for BRD + CSV. |
| `--output <dir>` | dir | `{impact_output}` config var | Override the report output directory. | |
| `--focus-module <name>` | string | — | Narrow blast-radius to a single module. | |

---

## Test-coverage-specific flags

Flags accepted by `bmad-dept-code-test-coverage-agent/scripts/run.ts`.

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--mode <m>` | enum | `analyze` | `analyze` (Tier 1) \| `generate` (Tier 2) \| `full` (both). | |
| `--name <str>` | string | folder name | Project name embedded in report. | |
| `--frameworks <list>` | csv | — | Subset of `unit,integration,mftf,api-functional,js,static,performance`. | |
| `--strategy <s>` | enum | `all` | Test-file discovery strategy: `filename` \| `namespace` \| `annotation` \| `all`. | |
| `--interactive` | bool | false | Prompt for framework / strategy selection. | |
| `--coverage-report <file>` | file | — | Parse an existing coverage report. | Supported: JaCoCo XML, Istanbul JSON, Clover XML, LCOV. |
| `--run-coverage` | bool | false | Run the project's coverage tool first (mvn/gradle-jacoco, jest/nyc, phpunit-clover), then parse. | Confirm exact invocation against `run.ts`. |
| `--module <list>` | csv | — | Filter to specific module(s) / package(s). | |
| `--output <dir>` | dir | `{test_coverage_output}` config var | Override the report output directory. | |

---

## Bootstrap flags (`bootstrap.sh`)

Flags accepted by `skills/shared/bootstrap.sh` (auto-installs shared foundation + selected agents).

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--shared-only` | bool | false | Install only `skills/shared` npm deps. | Useful for cold-start CI images. |
| `--agent <code>` | enum | all | Install a specific agent's deps only (repeatable). | E.g. `--agent audit --agent sonar-scan`. |
| `--no-interactive` | bool | false | Skip role selection prompt; use `generic` or `default_role` config var. | Alias for `--yes-install` semantics at bootstrap time. |
| `--force` | bool | false | Reinstall even when `node_modules/` looks intact. | |
| `--help` | bool | false | Show bootstrap help. | |

The `.env.example` at `skills/.env.example` documents `BMAD_LLM_*_TOKENS_AVG` and `BMAD_TOKEN_*` variables the bootstrap references. See [Config Vars](config-vars#env-file).

---

## Chain flags (`dca chain-all`)

The cross-agent orchestrator runs a curated multi-agent sequence and writes a unified SDLC pass under `.bmad/orchestrator/<runId>/`.

| Flag | Type | Default | Purpose | Notes |
|------|------|---------|---------|-------|
| `--chain-all` | bool | false | Run the full sequence: audit → sonar-scan → impact-analysis → test-coverage (and optional generation). | Skips agents whose preconditions aren't met. |
| `--path <dir>` | dir | `.` | Project root passed through to every agent. | |
| `--engine <id>` | enum | auto | Forwarded to every agent. | |
| `--role <code>` | enum | resolved | Forwarded to every agent. | |
| `--bugs <path>` | file | — | Forwarded to Impact Analysis. | |
| `--brd <path>` | file | — | Forwarded to Impact Analysis. | |
| `--run-coverage` | bool | false | Forwarded to Test Coverage. | |
| `--create-branch` | bool | false | Cut one working branch shared by every agent in the chain. | Prevents per-agent branch fan-out. |
| `--only <list>` | csv | all | Sub-select stages, e.g. `--only audit,sonar-scan`. | |
| `--skip <list>` | csv | — | Skip specific stages. | |
| `--dry-run` | bool | false | Print the planned pipeline, execute nothing. | |

---

## Flag combinations cookbook

Real-world flag combos, with a one-line rationale each.

### 1. Air-gapped CI: audit without any install prompt

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --path . --engine auto --no-install --no-preflight
```

Fails fast (exit 2) if deps are missing; the advisory noise is suppressed for machine consumption.

### 2. Cloud-readiness AMS → AEMaaCS migration baseline

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine aem --platform aemams --format all --create-branch --source-branch production
```

Runs both PDF + Markdown + Excel on a `dca/audit-aem-<ts>` branch cut from `production` so the baseline is preserved.

### 3. Commerce PaaS full audit with DB + BRD + bug context

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine commerce --db ./db/prod.sql \
  --brd ./docs/spec.docx --bugs ./reports/bugs.xlsx \
  --create-branch --source-branch production
```

Combines all Commerce-only inputs on a fresh branch. Add `--namespace Acme` to scope to a partner namespace.

### 4. Sonar Step 2 (ingest) after a chat-driven Step 1

```bash
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json \
  --engine aem --path . --create-branch
```

Deterministic ingest; produces the Quality Gate + Vulnerabilities sheet on a fresh working branch.

### 5. Real coverage, then LLM-generate to 100%

```bash
npx ts-node .claude/skills/bmad-dept-code-test-coverage-agent/scripts/run.ts \
  --mode full --run-coverage --engine spring --path .
```

Runs the project's own JaCoCo tooling first for a true baseline; Tier 2 then targets only the actual gaps.

### 6. Impact analysis from combined bugs + BRD, filtered to one module

```bash
npx ts-node .claude/skills/bmad-dept-code-impact-analysis-agent/scripts/run.ts \
  --bugs ./proofhub-export.csv --brd ./BRD.docx \
  --engine spring --focus-module payments --path .
```

Blast radius is scoped to `payments/*`; every input still appears in the traceability output.

### 7. Dry-run scaffolder review, then apply

```bash
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --scaffold --engine aem --type component --name HeroBanner --dry-run
# review the file list, then:
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --scaffold --engine aem --type component --name HeroBanner --create-branch --source-branch develop
```

Verifies the planned file list before touching the tree; the second call cuts a fresh branch and writes.

### 8. Full pre-release gate on one shared branch

```bash
dca chain-all --path . --engine auto --create-branch --source-branch production \
  --bugs ./bugs.csv --brd ./BRD.docx --run-coverage
```

Runs audit → sonar-scan → impact-analysis → test-coverage against the same working branch; unified summary lands under `.bmad/orchestrator/<runId>/`.
