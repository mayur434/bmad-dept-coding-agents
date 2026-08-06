---
id: interactive-vs-technical
title: Interactive vs Technical
sidebar_position: 5
description: Two intake modes — Q&A walk-through or full-CLI upfront — with per-project persistence at .bmad/intake.yaml.
---

The **intake mode** determines *how* an agent gathers the inputs it needs — either by walking you through a Q&A (interactive) or by expecting the full CLI up front (technical). The picker fires on your first invocation, persists to `.bmad/intake.yaml`, and every subsequent run reads it silently.

## The intake picker

On the first invocation in a project (unless you pass `--interactive` or `--technical` at install), the agent asks:

> *"How would you like to interact with the DCA agents?"*
>
> - **Interactive** — I'll ask you a few questions and show the resolved command for confirmation.
> - **Technical** — I'll expect the full CLI up front; no Q&A.

Your choice is persisted at `<projectRoot>/.bmad/intake.yaml`:

```yaml
# BMAD DCA — intake mode preference
# Set by an agent's --interactive/--technical flag or by asking the LLM to switch modes.
mode: interactive
set_at: 2026-08-06T14:30:45Z
```

Resolution order at runtime:

1. **`--interactive` / `--technical` CLI flag** (also persists to `.bmad/intake.yaml`).
2. **`.bmad/intake.yaml`** — read silently if no flag.
3. **Default `technical`** — backward-compatible fallback when neither is present.

## Interactive mode

The agent walks you through a Q&A, one question at a time, on stderr. Each prompt shows the key, any choices, and any default:

```text
[dca-interactive] Project root [.]?
[dca-interactive] Engine [auto|aem|commerce|commerce-saas|sling|spring|app-builder|eds|eds-commerce] [auto]?
[dca-interactive] Filter to a specific module [Enter to skip]?
[dca-interactive] Format [excel|md|pdf|all] [excel]?
```

After you've answered every required question, the agent prints the resolved command and asks whether to run it now:

```text
[dca-interactive] Resolved command:
  npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
    --path . --engine commerce --format excel

[dca-interactive] Run this now? (Y/n)
```

- **Y** (or Enter) — executes.
- **n** — cancels the run; you can copy the printed command and tweak it.

Chat-triggered flows behave analogously — the AI asks the questions conversationally instead of on stderr.

:::note Non-TTY guardrail
`--interactive` in a headless environment (no TTY) prints every unresolved required input and exits cleanly rather than blocking on `readline`. In CI, use technical mode with explicit flags.
:::

## Technical mode

You supply the full CLI up front; no Q&A. Every flag is explicit, every value is on the command line:

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --path /path/to/magento-project \
  --engine commerce \
  --db /path/to/magento-project/db/prod.sql \
  --brd /path/to/magento-project/docs/spec.docx \
  --create-branch --source-branch production
```

Every flag:

- `--path` — project root to scan.
- `--engine` — force the stack (skip auto-detection).
- `--db` — Commerce SQL dump for schema/index/integrity analysis.
- `--brd` — Commerce BRD document (`.docx` / `.md` / `.txt`).
- `--create-branch` — cut `dca/audit-commerce-<timestamp>` before writing outputs.
- `--source-branch` — override the default cascade (`production → main → master → develop`).

Full per-agent flag reference: [reference/cli-flags](../reference/cli-flags).

## Overrides and switching

- **`--interactive`** on any `run.ts` — force interactive for that run *and* persist `mode: interactive` to `.bmad/intake.yaml`. The next flagless run honors it.
- **`--technical`** on any `run.ts` — mirror behavior for technical mode.
- **In chat** — say *"switch intake to interactive"* or *"switch intake to technical"*; the agent rewrites `.bmad/intake.yaml`.
- **By hand** — edit `.bmad/intake.yaml` and change the `mode:` line.
- **Reset** — delete `.bmad/intake.yaml`; next run falls back to the `technical` default.

## When to pick which

| Situation | Recommended mode |
|-----------|------------------|
| Solo development, exploring the agents for the first time | Interactive |
| Team-shared repo, everyone runs the same standard command | Technical |
| CI / GitHub Actions / GitLab / any headless environment | Technical (interactive fails cleanly if there's no TTY) |
| Ad-hoc chat sessions with a lot of flag variation | Interactive |
| Reproducible runs where the command is part of a runbook | Technical |

## Next

- [First Run](../getting-started/first-run) — where the intake picker fires in the first-invocation sequence.
- [Role Adaptation](role-adaptation) — the other big first-run persisted preference.
