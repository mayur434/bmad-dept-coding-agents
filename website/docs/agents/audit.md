---
id: audit
title: Audit
sidebar_position: 1
description: Two-tier code auditor — tree-sitter AST + regex (Tier 1) plus LLM deep semantic analysis (Tier 2) across all 8 stacks.
keywords:
  - code audit
  - static analysis
  - tree-sitter
  - ast
  - adobe commerce audit
---

## Purpose

The **Audit** agent is a two-tier code auditor. **Tier 1** is a deterministic TypeScript scanner (tree-sitter AST + regex, zero LLM tokens) across all 8 stacks; **Tier 2** is LLM-driven deep semantic analysis using per-stack rule packs. Every run emits the [standardized outputs contract](../concepts/standardized-outputs) — one Excel workbook, one Markdown twin, and one `CHANGE-LOG.md` entry.

:::note
The former standalone **Scan** agent has been retired — its Tier-1 deterministic pass now lives here as the Audit agent's **Scan Only** action (menu code `SC`). Distinct from the LLM-driven [Sonar Scan agent](./sonar-scan), which produces a Quality Gate + Vulnerabilities sheet.
:::

## When to use it

- **Before a major PR merge** — catch security / performance / architectural violations pre-review.
- **During a platform upgrade** — AEM AMS → AEMaaCS, Magento 2.4.7-p7 → 2.4.7-p9 — for a breaking-change baseline.
- **Onboarding a legacy Commerce or AEM project** — establish a starting-quality snapshot.
- **Quarterly / sprint-cadence code-health checks** for enterprise architects.
- **Step 1 of a chained SDLC pass** — feed findings to Impact Analysis or Test Coverage (see [chain-all](../workflows/chain-all)).
- **Regression / delta mode** — quantify the CRITICAL/HIGH surface a branch adds vs a prior baseline (`--since`).

## What it produces

Every audit run — from every engine, on every stack — emits:

| Artifact | Where | Notes |
|----------|-------|-------|
| `audit-<branch>-<timestamp>-agent-report.xlsx` | `audit-reports/` | Standardized 15-column Summary contract; 6-sheet fixed order. |
| `audit-<branch>-<timestamp>-agent-report.md` | `audit-reports/` | Git-diffable Markdown twin (9-column reduced Summary). |
| One `CHANGE-LOG.md` entry | project root | Spliced newest-first after the `<!-- dca:entries -->` marker. |
| Optional **Delta sheet** | appended to the xlsx | Only when `--since <ref\|ts\|last>` is passed — buckets new / fixed / persisting findings vs a cached baseline. |
| Findings cache | `.bmad/cache/audit-<hash>.json` | Consumed by downstream agents (Impact, Test Coverage, chain-all). |
| Optional working branch | git | `dca/audit-<stack>-<timestamp>` when `--create-branch` is passed. |

:::note Two workbooks for legacy engines
Legacy engines (`aem`, `commerce`, `eds`, `eds-commerce`) additionally write their own platform-specific multi-sheet Excel alongside the standardized workbook — so a legacy run produces **two** `.xlsx` files.
:::

## Modes

The Audit agent runs in one of three modes, resolved from the user's trigger phrase or the interactive picker.

| Mode | Menu code | Tier | What it does | Best for |
|------|:---------:|:---:|--------------|----------|
| **Full Audit** | `FA` | Tier 1 + Tier 2 | Deterministic scan → LLM cross-references findings against per-stack rule packs → merged report. | Comprehensive pre-release audit; default for QA / migration roles. |
| **Scan Only** | `SC` | Tier 1 | Deterministic pass only — tree-sitter AST + regex, no tokens. | CI gates; sprint-cadence smoke checks; DE / DevOps roles. |
| **Deep Audit** | `DA` | Tier 2 | LLM semantic analysis using rule packs — no deterministic pre-scan. | Architecture / business-logic reviews when Tier-1 findings are noise. |

## Trigger phrases

Paste any of these into the agent chat — the agent auto-detects the stack and routes.

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

The full copy-paste catalog is in the [Audit prompts reference](../reference/prompts/audit).

## CLI usage (technical mode)

The canonical invocation from the installed skill:

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --path /path/to/project \
  --engine auto \
  --preflight
```

The Preflight advisor prints on every run — see [The Agents](../concepts/the-agents) for how STATIC / LLM / HYBRID is decided, and [Auto-install](../concepts/auto-install) for the first-run dependency bootstrap.

## Flags reference

The Audit dispatcher (`run.ts`) parses a top-level flag set, then forwards the rest to the per-engine `audit.ts`.

### Dispatcher-level flags (all engines)

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--path <dir>` | string | required (or `--engine`) | Project root to scan. |
| `--engine <id>` | enum | auto-detected | One of `aem`, `commerce`, `commerce-paas`, `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`. `commerce` and `commerce-paas` are aliases. |
| `--format <t>` | enum | `excel` | `excel` \| `md` \| `pdf` \| `all`. Honored primarily by the AEM legacy report. |
| `--role <code>` | enum | `.bmad/role.yaml` | Role adaptation: `ea` \| `tl` \| `de` \| `qa` \| `devops` \| `security` \| `pm` \| `ba` \| `migration` \| `content`. Wins for one run. |
| `--since <ref\|ts\|last>` | string | — | Regression / delta vs a prior cached audit run. Accepts a git ref, ISO-8601 timestamp, or `last`. Emits a **Delta** sheet appended to the xlsx. |
| `--create-branch` | bool | false | Cut `dca/audit-<stack>-<timestamp>` before writing outputs. |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. Cascade: `production → main → master → develop`. |
| `--preflight` | bool | false | Print the LLM / context-window advisory and exit. |
| `--no-preflight` | bool | false | Suppress the preflight advisory that otherwise prints on every run. |
| `--yes-install` | bool | false | First-run dependency install without confirmation. Mutually exclusive with `--no-install`. |
| `--no-install` | bool | false | Error out if deps are missing (do not install). Exit code `2`. |
| `--interactive` | bool | false | Force interactive intake mode (step-by-step questions). Persists to `.bmad/intake.yaml`. |
| `--technical` | bool | false | Force technical mode; missing required inputs error out. |
| `--list-engines` | bool | false | Print the 8 registered engines and exit. |
| `--chain-all` | bool | false | Run audit → sonar-scan → test-coverage → impact-analysis in sequence. See [chain-all workflow](../workflows/chain-all). |
| `--chain-stages <csv>` | csv | all four | Comma-separated subset of stages to run. |
| `--chain-stop-on-fail` | bool | false | Abort the chain on the first stage failure. |
| `--help` / `-h` | bool | false | Show dispatcher help. |

### AEM engine flags

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--platform <p>` | enum | auto | `aemcs` \| `aemams` \| `both`. Force AEMaaCS-only or AMS-only rule packs. |

### Commerce engine flags (extra inputs)

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--name <str>` | string | folder name | Project name shown in the report. |
| `--namespace <ns>` | string | `Custom` | Filter to a namespace. |
| `--module <list>` | csv | — | Filter to specific modules. |
| `--db <path>` | file (`.sql`) | — | SQL dump for schema / indexes / integrity analysis. |
| `--brd <path>` | file | — | BRD document for scanner-side impact analysis (repeatable). `.docx` via mammoth, or `.md`/`.txt`. |
| `--bugs <path>` | file (`.xlsx`) | — | Bug report for the scanner. **Distinct** from the Impact Analysis agent's `--bugs` (Proofhub CSV). |
| `--no-code-audit` | bool | false | Skip the code scan (BRD-only or bugs-only run). |
| `--json` | bool | false | Also emit findings as JSON (aem/commerce engines). |
| `--output <dir>` | dir | `{audit_output}` | Override report directory. |

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
| `--fail-on-overdue` | bool | false | Exit code 6 if any surviving item is overdue per role SLA. Ideal for CI gates. |

## One-shot examples

The Audit agent runs end-to-end without clarifying questions when the prompt is self-contained. See the [One-Shot Mode](../concepts/one-shot-mode) concept page for the 7-item precedence and complete resolution rules.

- **"audit my project"** — engine + role auto-resolved; role default mode; SLA + decisions applied silently.
- **"audit my project as security, fail on overdue"** — per-run role override to `security`; `--fail-on-overdue` on for the SLA gate.
- **"scan-only my project, no LLM (fast Tier 1)"** — forces `--mode scan-only`; zero LLM tokens.
- **"deep audit /path/to/aem-project on the release branch"** — path + `--engine aem` + `--mode deep-audit` + `--create-branch --source-branch release`.
- **"audit my commerce project with DB dump at ./prod.sql and bugs at ./bugs.csv"** — engine + Commerce inputs auto-linked.
- **"audit since main — show me only the new items"** — `--since main` for delta scope.

Full example bodies with the exact resolved commands live in the agent SKILL.md's `One-shot mode` section.

## What's new in the maturity batch

- **XML AST scanning across 4 stacks** — `di.xml` / `.content.xml` / Spring XML previously ran through regex only; they now flow through the shared tree-sitter harness for precise rule matches.
- **Unified single-XLSX for legacy engines** — legacy AEM / Commerce / EDS / eds-commerce engines still write their platform-specific multi-sheet workbook alongside the standardized report, but every legacy engine now emits the identical standardized shape too.
- **`--since` delta mode with Delta sheet** — pass `--since main` / `--since <sha>` / `--since 2026-07-01T00:00:00Z` / `--since last` to compare against a cached prior run. The dispatcher appends a **Delta** sheet to the workbook with three buckets: **new**, **fixed**, **persisting** (matched by `ruleId + file + line`). Non-fatal when no baseline is found — the run still emits.
- **Confidence enforcement** — every finding now carries a `Confidence` value in the 15-column Summary contract (drops rows with missing confidence during ingest to keep the report shape honest).
- **Findings-cache emission** — every audit run writes `.bmad/cache/audit-<hash>.json` so downstream Impact Analysis and Test Coverage can cross-reference the CRITICAL / HIGH surface without re-scanning. See the [Findings cache concept page](../concepts/findings-cache).

## Example workflow — Commerce PaaS end-to-end

Full audit on a Magento 2 project, with DB dump + BRD + bug report, cutting a fresh working branch from `production` and running a delta vs `main`:

```bash
cd /path/to/magento-project
```

**Chat trigger:**

```text
full audit my project with DB at ./db/prod.sql, BRD at ./docs/spec.docx,
bugs at ./reports/bugs.xlsx, cut a branch from production, delta vs main
```

**Resolved CLI:**

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --engine commerce \
  --path /path/to/magento-project \
  --db ./db/prod.sql \
  --brd ./docs/spec.docx \
  --bugs ./reports/bugs.xlsx \
  --create-branch --source-branch production \
  --since main
```

**Outputs:**

```
dca/audit-commerce-20260806_143512               ← new working branch
audit-reports/
├── audit-dca-audit-commerce-20260806_143512-agent-report.xlsx      ← standardized (with Delta sheet)
├── audit-dca-audit-commerce-20260806_143512-agent-report.md
└── acme-commerce-audit-20260806_143512-dca-audit-commerce-…-.xlsx  ← legacy Commerce multi-sheet
CHANGE-LOG.md                                                        ← one new entry spliced in
.bmad/cache/audit-<hash>.json                                        ← findings cache for downstream agents
```

Follow up in chat:

```text
summarize the CRITICAL findings for the release note
which bugs cluster around the same files?
which findings are new vs main?
```

## Cross-agent chaining hints

The Audit agent adapts its recommended follow-up to the resolved [role](../concepts/role-adaptation):

| Role | Next agent | Why |
|------|-----------|-----|
| `ea` | [Impact Analysis](./impact-analysis) | Roll findings up to architecture-level risk. |
| `tl` | [Impact Analysis](./impact-analysis) | Blast-radius the top findings before assigning fixes. |
| `de` | [Code Generation](./code-generation) | Generate fix scaffolds for CRITICAL findings. |
| `qa` | [Test Coverage](./test-coverage) | Measure coverage on the files audit flagged. |
| `devops` | [Sonar Scan](./sonar-scan) | Deeper scan wired for CI gates. |
| `security` | [Sonar Scan](./sonar-scan) | Deeper Vulnerability + Security Hotspot analysis. |
| `pm` | (stay in audit) | Summarize CRITICAL findings for release notes. |
| `ba` | [Impact Analysis](./impact-analysis) | Map findings back to BRD requirements. |
| `migration` | [Impact Analysis](./impact-analysis) + [Test Coverage](./test-coverage) | Cross-version impact + coverage delta. |
| `content` | [Code Generation](./code-generation) | Emit content-fragment / block scaffolds. |

Or run the whole SDLC pass in one shot with [`--chain-all`](../workflows/chain-all).

## See also

- [Audit prompt catalog](../reference/prompts/audit) — 60+ copy-paste prompts, one per stack.
- [Standardized outputs contract](../concepts/standardized-outputs) — 15-column Summary + fixed sheet order.
- [Findings cache](../concepts/findings-cache) — how audit output feeds downstream agents.
- [Role adaptation](../concepts/role-adaptation) — how the audit's default mode and output flavor change per role.
- [The 8 stacks](../concepts/the-8-stacks) — engine IDs, aliases, auto-detection.
