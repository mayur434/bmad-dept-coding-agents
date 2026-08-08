---
id: first-run
title: First Run
sidebar_position: 4
description: The three questions every DCA agent asks the first time — deps, role, intake mode — and how to change any of them later.
---

The very first time you invoke any of the DCA agents in a project, the suite performs a short handshake — three questions, in order — then remembers your answers for every subsequent run.

## The three questions

### 1. Auto-install of Node dependencies

The dispatcher shells out to `skills/shared/bootstrap.sh` (POSIX) or `bootstrap.js` (Windows), detects that no `node_modules` are present yet, and prints one line on stderr:

```text
[dca-bootstrap] First-run dependency install needed — ~80MB across shared/ and <agent>/ (~30–60s). Proceed? (Y/n)
```

- **Y** (or Enter) — the bootstrap installs `shared/` first, then this agent's `scripts/`, both silently. Typical wall-clock time: 30–60 seconds on a normal network.
- **n** — the bootstrap exits with code `3` ("user declined") and the agent stops.

Subsequent runs are silent no-ops. Full mechanics — bootstrap exit codes, headless overrides, cross-platform notes — on the [Auto-install concept page](../concepts/auto-install).

:::tip Skip the prompt in CI
Pass `--yes-install` on any `run.ts` to force the install without asking, or `--no-install` to fail fast (exit code `2`) if deps are missing. Mutually exclusive.
:::

### 2. Role selection

Next the AI performs a **role handshake** — it asks:

> *"Which role best matches how you'll use this plugin?"*

and lists the 6 promoted roles first (Enterprise Architect, Tech Lead, Senior Delivery Engineer, QA/SDET, DevOps/SRE, Security Engineer), then the 4 additional roles (PM, BA, Migration Lead, Content Engineer) under a "More roles" affordance, then the `generic` fallback.

Your choice is persisted to `<projectRoot>/.bmad/role.yaml`, e.g.:

```yaml
# BMAD DCA — role selection
role: ea
set_at: 2026-08-06T14:30:22Z
set_by: interactive
```

Every subsequent agent run reads this file silently and prints a one-line banner on stderr:

```text
[dca-role] Enterprise Architect (source: role-file)
```

Full detail — the 10 roles, the 5 output flavors, the role × agent behavior matrix — on the [Role Adaptation concept page](../concepts/role-adaptation).

### 3. Intake mode

Finally, the agent asks which intake style you prefer:

- **Interactive** — the agent walks you through a Q&A (path, engine, filters, …) and shows the resolved CLI command for confirmation before running.
- **Technical** — you supply the full CLI up front; no Q&A.

Your choice is persisted to `<projectRoot>/.bmad/intake.yaml`:

```yaml
# BMAD DCA — intake mode preference
mode: interactive
set_at: 2026-08-06T14:30:45Z
```

Full detail on both flows and their prompt UX: [Interactive vs Technical](../concepts/interactive-vs-technical).

## How to change any of these later

### Deps

Not really a "setting" — once `node_modules` are present, the bootstrap silently no-ops. If something got corrupted, delete `.claude/skills/shared/node_modules` and any agent's `scripts/node_modules`, then re-run to trigger the prompt again.

### Role

- **From an agent chat** — say *"switch role to `<code>`"*; the agent rewrites `.bmad/role.yaml`.
- **Per-run only** — pass `--role=<code>` on that single `run.ts` invocation, or prefix your prompt with *"as `<role>`, ..."*. Neither writes the file.
- **By hand** — edit `.bmad/role.yaml` and change the `role:` line to any of `ea | tl | de | qa | devops | security | pm | ba | migration | content | generic`.
- **Reset** — delete `.bmad/role.yaml`; next run drops back to the interactive picker.
- **Install-time default** — pass `--set dca.default_role=<code>` on `npx bmad-method install` to skip the prompt on first activation.

### Intake mode

- **Per-run flags** — `--interactive` or `--technical` on any `run.ts`. Passing either flag *also* persists that mode to `.bmad/intake.yaml` (so the next flagless run honors it).
- **In chat** — say *"switch intake to interactive"* / *"switch intake to technical"*.
- **By hand** — edit `.bmad/intake.yaml` and change the `mode:` line.

## What the first run actually produces

Assuming you answered **Y** to the install, picked a role, and picked an intake mode, the first invocation then goes on to run the agent normally. You end up with:

1. The three standardized artifacts — `<agent>-<branch>-<timestamp>-agent-report.xlsx`, `.md`, and a new entry in `CHANGE-LOG.md`. See [Standardized Outputs](../concepts/standardized-outputs).
2. Two new files in `<projectRoot>/.bmad/` — `role.yaml` and `intake.yaml` — that every subsequent run reads.
3. A populated cache directory `<projectRoot>/.bmad/cache/` — one JSON snapshot per successful run, consumed by downstream agents for cross-agent chaining. See [Findings Cache](../concepts/findings-cache).

## Next

- [Concepts → The Agents](../concepts/the-agents)
- [Concepts → Role Adaptation](../concepts/role-adaptation)
- [Concepts → Interactive vs Technical](../concepts/interactive-vs-technical)
- [Concepts → Auto-install](../concepts/auto-install)
