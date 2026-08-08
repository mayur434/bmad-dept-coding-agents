---
id: one-shot-mode
title: One-Shot Mode
sidebar_position: 10
description: Preferred enterprise UX — self-contained prompts execute end-to-end using role + intake + conventions defaults. No clarifying questions.
keywords:
  - one-shot
  - granular prompt
  - enterprise
  - automation
  - no-clarify
---

**One-shot mode** is the preferred enterprise UX for every DCA agent. When the user's initial prompt fully specifies the operation, the agent executes end-to-end, streams results, and exits — no clarifying questions, no interactive picker, no "would you like to save this as a preference?" follow-up. Defaults from `.bmad/role.yaml`, `.bmad/intake.yaml`, `.bmad/conventions.yaml`, and stack auto-detection silently fill everything missing.

Intake mode still exists (see [Interactive vs Technical](./interactive-vs-technical)), and is the right choice for first-time / exploratory users. One-shot is the right choice for anyone who knows what they want and does not want to be interrupted.

## When to enter one-shot mode

Any of these signals triggers one-shot:

- Explicit trigger phrase — `"one-shot"`, `"just do it"`, `"no questions"`, `"end-to-end"`, `"run for me"`, `"auto"`.
- The prompt fully specifies **(a)** the operation, **(b)** the project path (default: cwd is acceptable), and **(c)** the primary input (BRD path, CSV path, `--type`, `--name`, etc. — whichever the agent needs).
- The `--yes-install` and `--no-preflight` flag combination on the CLI.

You do **not** need every field explicit. Role + intake + conventions cover the rest silently. Missing role is fine — the agent uses `generic` and logs a stderr note.

## Precedence for missing inputs

Every one-shot resolution walks the same 7-item precedence, first match wins:

1. **Explicit in the user's prompt** — highest; always wins.
2. **`--flag` on `run.ts`** — headless / CI path.
3. **`.bmad/role.yaml`** — resolved role drives default mode + output flavor + follow-up.
4. **`.bmad/intake.yaml`** — interactive-vs-technical preference; one-shot forces `--technical`.
5. **`.bmad/conventions.yaml`** — project conventions (naming, packages, license header).
6. **Auto-detected** — stack from repo signatures, coverage report from standard paths (`target/site/jacoco/jacoco.xml`, `coverage/lcov.info`, etc.), engine from directory shape.
7. **Sensible defaults** — the hard-coded fallback in each agent's `run.ts`.

## What one-shot silences

Every interactive prompt the agents normally show is replaced by the precedence above:

- The **intake picker** ("Interactive or Technical?") — one-shot forces technical.
- The **mode picker** ("Full / Scan Only / Deep?" for Audit, "gaps only / write tests / full" for Test Coverage, "What's connected / What could break?" for Impact) — resolved from role default.
- The **role picker** (when `.bmad/role.yaml` is absent) — one-shot uses `generic` and logs to stderr `one-shot: no role file, defaulting to generic`.
- Confirmation prompts around `--create-branch` and `--yes-install` — one-shot assumes yes for install (auto-install), no for branch cut unless the user's prompt or the CLI says otherwise.
- Post-run "would you like to run the follow-up?" prompts — one-shot prints the recommended follow-up as text and exits.

## What one-shot still asks about

Only one situation forces a clarifying question, and it is agent-specific:

- **Impact Analysis** — requires at least one of `--bugs` or `--brd` or `--pr` or `--diff` as the input source. If the prompt has none, the agent asks *once* which input to use (or exits with a clear error in `--no-interactive` mode).
- **Audit / Sonar Scan / Test Coverage / Code Generation** — all required inputs can be resolved from role + auto-detection + defaults. One-shot proceeds without asking.

## Per-agent examples

Full lists of one-shot prompt examples live in each agent's SKILL.md `One-shot mode` section:

- [Audit](../agents/audit) — 6 examples including regression / delta mode, per-role overrides, and DB-linked Commerce audits.
- [Sonar Scan](../agents/sonar-scan) — 6 examples including auto-ingest of Step 1 findings and per-focus prompts (SQL injection, XSS, CWV).
- [Code Generation](../agents/code-generation) — 6 examples covering deterministic scaffolders (`--scaffold --type sling-model --name Foo`) and LLM MCP flows.
- [Impact Analysis](../agents/impact-analysis) — 6 examples covering `--bugs`, `--brd`, `--pr <range>`, and `--diff` inputs.
- [Test Coverage](../agents/test-coverage) — 6 examples covering analyze-only, generate-only, live coverage run, and mutation-hint seeding.

Every example follows the same shape:

> **User pastes:** the natural-language prompt
> **AI silently resolves:** the inputs it filled in from the precedence chain
> **AI runs:** the exact `npx ts-node` command with all flags
> **AI reports:** the one-line summary streamed at completion

## CLI equivalent

Every one-shot prompt has a direct CLI equivalent. The five common flags used in one-shot are the same across every agent:

```bash
npx ts-node .claude/skills/bmad-dept-code-<agent>-agent/scripts/run.ts \
  --path . \
  --role <code> \
  --technical \
  --yes-install \
  --no-preflight
```

Layer on the Phase 1 enterprise flags as needed:

```bash
  --sla-path .bmad/sla.yaml \
  --decisions-path .bmad/decisions.yaml \
  --fail-on-overdue \        # exit 6 if any surviving finding is overdue
  --include-decided          # bypass the findings gate for a review run
```

That combination is what the AI resolves behind every one-shot prompt.

## Interaction with the enterprise gate

One-shot mode plays cleanly with both Phase 1 enterprise features:

- [Findings Gate](./findings-gate) — `.bmad/decisions.yaml` suppression is applied silently. The suppressed count is streamed to stderr.
- [SLA Tracking](./sla-tracking) — the SLA Status sheet is added to every XLSX. Add `--fail-on-overdue` to make one-shot fail loudly when the SLA is breached.

Both gates are role-aware, and one-shot's role resolution is the same 7-item precedence above.

## See also

- [Role Adaptation](./role-adaptation) — how role picks default mode and output flavor.
- [Interactive vs Technical](./interactive-vs-technical) — the non-one-shot path, useful for exploration.
- [Findings Gate](./findings-gate) — silent suppression during a one-shot run.
- [SLA Tracking](./sla-tracking) — silent SLA computation during a one-shot run.
