---
title: Config Vars
sidebar_position: 2
description: Every install-time config variable, `.env` variable, and `.bmad/` runtime file the DCA suite reads.
---

# Config Vars

Every knob that shapes the DCA suite: install-time module config variables (from `skills/module.yaml`), the `.env` token-budget variables (from `skills/.env.example`), and the runtime `.bmad/` files each agent reads on activation.

Related pages: [CLI Flags](cli-flags) · [Scoring Model](scoring-model) · [Install](../getting-started/install).

---

## Module-level config variables

Defined in `skills/module.yaml`. Every variable is prompted at install time (via `bmad-method install --custom-source`) and persisted in the BMAD-installed config. Override by re-running install, or by passing `--set <var>=<value>` if your installer supports it.

| Variable | Prompt at install | Default | Accepted values | Consumed by |
|----------|-------------------|---------|-----------------|-------------|
| `audit_output` | "Where should audit reports be stored?" | `{output_folder}/audit-reports` | any relative path | Audit `--output` default |
| `generation_output` | "Where should scaffold + generation reports be stored?" | `{output_folder}/generation-reports` | any relative path | Generation `--output` default |
| `impact_output` | "Where should impact analysis reports be stored?" | `{output_folder}/impact-reports` | any relative path | Impact `--output` default |
| `test_coverage_output` | "Where should test coverage reports be stored?" | `{output_folder}/test-coverage-reports` | any relative path | Test Coverage `--output` default |
| `sonar_output` | "Where should sonar-scan reports be stored?" | `{output_folder}/sonar-reports` | any relative path | Sonar Scan `--output` default |
| `audit_engine` | "Default audit engine (auto-detects if not set)?" | `auto` | `auto`, `aem`, `commerce`, `commerce-paas`, `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce` | Audit `--engine` default |
| `audit_namespace` | "Custom module namespace for Commerce projects?" | `Custom` | any string | Audit `--namespace` default (Commerce only) |
| `default_role` | "Which role best matches how you'll use this plugin?" | `""` (empty — prompts on first activation) | `ea`, `tl`, `de`, `qa`, `devops`, `security`, `pm`, `ba`, `migration`, `content`, or empty | Every agent (resolves the DCA role) |

### How to override

- **Re-run install** — `bmad-method install --custom-source <path>` re-prompts and rewrites the persisted values.
- **Edit the persisted YAML** — the installed skills copy is at `.claude/skills/module.yaml`; edit its `default:` line and re-activate.
- **Per-run CLI override** — every value above has a matching `--` flag on the agent (`--output`, `--engine`, `--namespace`, `--role`). These do not persist.

`{output_folder}` is resolved by the BMAD installer to the project's chosen output root (typically `./bmad-output` or the project root).

---

## Directories created at install time

Listed under `directories:` in `skills/module.yaml`. Created (idempotent) on module install:

| Directory | Purpose |
|-----------|---------|
| `{audit_output}` | Audit reports (default `bmad-output/audit-reports/`). |
| `{generation_output}` | Scaffold + generation reports. |
| `{impact_output}` | Impact analysis reports. |
| `{test_coverage_output}` | Test coverage reports. |
| `{sonar_output}` | Sonar scan reports. |
| `.bmad` | Per-project runtime state (role, intake, cache, orchestrator runs). |

---

## `.env` file — token-budget knobs {#env-file}

The template lives at `skills/.env.example`. Copy it to `.env` at the project root (or into `.claude/skills/.env` where the installer looks) and tune the numbers to match your host's model and pricing.

```bash
# Total token budget allocated per session (context window)
BMAD_TOKEN_BUDGET_TOTAL=128000

# Warning / critical thresholds (percent of budget remaining)
BMAD_TOKEN_WARNING_PERCENT=20
BMAD_TOKEN_CRITICAL_PERCENT=10

# Cost projection (USD per 1K tokens)
BMAD_TOKEN_COST_PER_1K_INPUT=0.003
BMAD_TOKEN_COST_PER_1K_OUTPUT=0.015

# Static (Tier 1) scanner baselines — averages, not caps
BMAD_STATIC_SCAN_TOKENS_AVG=1200
BMAD_STATIC_AUDIT_TOKENS_AVG=1500
BMAD_STATIC_COVERAGE_TOKENS_AVG=1800
BMAD_STATIC_IMPACT_TOKENS_AVG=1400
BMAD_STATIC_SONAR_TOKENS_AVG=1600

# LLM-assisted (Tier 2) baselines — averages
BMAD_LLM_SCAN_TOKENS_AVG=18000
BMAD_LLM_AUDIT_TOKENS_AVG=25000
BMAD_LLM_COVERAGE_TOKENS_AVG=32000
BMAD_LLM_IMPACT_TOKENS_AVG=22000
BMAD_LLM_GENERATION_TOKENS_AVG=45000
BMAD_LLM_SONAR_TOKENS_AVG=28000

# Optimized-prompt multiplier — factor reduction after prompt optimization
BMAD_OPTIMIZED_PROMPT_MULTIPLIER=0.6
```

The preflight advisor reads these values to decide `STATIC` vs `HYBRID` vs `LLM` mode and to display the projected token cost before a run.

---

## `.bmad/` runtime files

Each project accumulates a `.bmad/` directory (git-ignored) that holds per-project state.

### `.bmad/role.yaml`

Written by the role picker on first agent activation, or manually to switch roles. Format:

```yaml
# BMAD DCA — role selection
# Set by the DCA agent suite on first activation; edit or delete to change.
role: ea                        # one of: ea, tl, de, qa, devops, security, pm, ba, migration, content
set_at: 2026-08-01T02:53:00Z    # ISO-8601 UTC
set_by: interactive             # interactive | --role-flag | config
notes: |
  Optional free-text notes about the role choice.
```

Full role catalog: [`skills/shared/role/ROLES.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/shared/role/ROLES.md).

### `.bmad/intake.yaml`

Written when an agent runs an intake questionnaire (e.g. picking the AEM `--platform` on ambiguous projects). Format:

```yaml
project_name: acme-storefront
engine: aem
platform: aemcs
last_intake_at: 2026-08-05T13:22:11Z
answers:
  primary_module: ui.apps
  ships_to_dispatcher: true
```

### `.bmad/cache/<agent>-*.json`

Per-agent memoization cache — file signatures, engine-detection results, AST parses. Safe to delete; agents recompute on next run.

Typical files:

- `.bmad/cache/audit-file-index.json` — file paths + mtimes seen last audit
- `.bmad/cache/sonar-scan-findings-<hash>.json` — recent scan findings
- `.bmad/cache/registry-detection.json` — last engine auto-detection result

### `.bmad/conventions.yaml`

Optional project-local overrides that customize scaffolder output (package prefixes, namespace defaults, license header). Read by Code Generation on `--scaffold`. Format:

```yaml
package_prefix: com.acme.storefront
commerce_namespace: Acme
license_header: |
  /*
   * Copyright (c) 2026 Acme Corp. All rights reserved.
   */
scaffolder_defaults:
  sling-model:
    adaptable: Resource
  osgi-service:
    scope: singleton
```

### `.bmad/orchestrator/<runId>/`

Written by `dca chain-all` — one directory per cross-agent run. Contains:

- `plan.json` — the planned pipeline (which agents, in what order)
- `<agent>/stdout.log`, `<agent>/stderr.log` — per-stage logs
- `<agent>/report.xlsx` — copy of each agent's standardized report
- `summary.md` — cross-agent narrative (Audit + Sonar + Impact + Coverage)

`runId` is `YYYYMMDD_HHMMSS-<slug>`. Older run directories can be pruned freely.

---

## Precedence

When the same knob is set in multiple places, agents resolve in this order (first wins):

1. **CLI flag** on the current run (e.g. `--role=security`, `--output ./reports`).
2. **`.bmad/*.yaml`** runtime file (e.g. `.bmad/role.yaml`).
3. **`.env`** variable.
4. **Module-level config var** persisted at install.
5. **Hard-coded default** in `run.ts`.
