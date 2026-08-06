---
id: authoring-a-new-skill
title: Authoring a New Skill
sidebar_position: 1
description: How to author a new BMAD skill module for the DCA plugin — folder scaffold, required files, customize.toml schema, SKILL.md principles, and a publishing checklist.
---

This page describes how to author a **new BMAD skill module** — a peer of `bmad-dept-code-audit-agent`, `bmad-dept-code-sonar-scan-agent`, etc. — either inside the DCA fleet or as a fork under a different module code entirely.

:::note Scope
This is for adding a **new agent** (a new SKILL.md-driven capability with its own dispatcher). For adding a new stack engine under an existing agent, see [Adding a New Engine](./adding-a-new-engine). For adding rule content to an existing engine, see [Writing Rule Packs](./writing-rule-packs).
:::

---

## 1. Prerequisites

Before you start:

- Read at least one existing agent end-to-end — [`skills/bmad-dept-code-audit-agent/`](https://github.com/mayur434/bmad-dept-code-agent/tree/main/skills/bmad-dept-code-audit-agent) is the reference implementation (deepest surface area).
- Confirm your capability doesn't already fit as a mode of an existing agent (a new **Scan Only**-style action inside Audit is often cheaper than a fifth top-level agent).
- Pick a skill name — lowercase, hyphenated, `bmad-<purpose>-agent` (e.g. `bmad-dept-code-lint-agent`).
- Pick a module code if forking to a new module — 2–4 lowercase characters (e.g. `dca` is the DCA family). Skills authored under the DCA umbrella reuse `dca`.

---

## 2. Scaffold structure

Every DCA-family skill has the same folder shape. Create it under `skills/<your-skill>/`:

```
skills/<your-skill>/
├── SKILL.md                  ← AI-facing instructions (workflows, modes)
├── GUIDE.md                  ← Human-facing setup + examples
├── customize.toml            ← Activation keywords, named commands
├── assets/
│   ├── module.yaml           ← Local copy of module.yaml (for the BMAD installer)
│   └── module-help.csv       ← Local copy of module-help.csv (menu / capability entries)
├── resources/                ← Rule packs, knowledge packs, scoring models
├── templates/                ← LLM-path output templates
└── scripts/
    ├── run.ts                ← CLI dispatcher (entry point)
    ├── package.json          ← Node.js dependencies
    ├── tsconfig.json         ← TypeScript config
    ├── shared/               ← Agent-local helpers (delta, emit adapters, etc.)
    └── engines/              ← Per-stack engines (registry.ts + `<stack>/` subdirs)
```

Bash one-liner (adapt `SKILL_NAME`):

```bash
SKILL_NAME="bmad-dept-code-lint-agent"
mkdir -p skills/$SKILL_NAME/{assets,resources,templates,scripts/{engines,shared}}
touch skills/$SKILL_NAME/{SKILL.md,GUIDE.md,customize.toml}
touch skills/$SKILL_NAME/assets/{module.yaml,module-help.csv}
touch skills/$SKILL_NAME/scripts/{run.ts,package.json,tsconfig.json}
touch skills/$SKILL_NAME/scripts/engines/registry.ts
touch skills/$SKILL_NAME/scripts/shared/base.ts
```

Then register the skill at the top-level `skills/module.yaml` (add an entry under `agents:`) and add a row per menu action to `skills/module-help.csv`.

---

## 3. Required files (line-by-line)

### `SKILL.md`

The AI-facing instruction sheet. See [`skills/bmad-dept-code-audit-agent/SKILL.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/SKILL.md) as the reference. Standard sections in order:

1. **Front-matter** — `name`, `description`, `version`, `tools`, `activation` keywords.
2. **Preflight** — a snippet the AI reads first to run the model/context advisor and decide STATIC / HYBRID / LLM.
3. **Modes / triggers** — a table mapping trigger phrases (`audit my project`, `scan my project`, `deep audit`) to CLI dispatch.
4. **Workflow** — step-by-step for each mode (what the AI reads, what it writes, what it emits).
5. **Output contract** — link to [standardized outputs](../concepts/standardized-outputs).
6. **Role-aware behavior** — per-role default mode + follow-up prompt (link to [role adaptation](../concepts/role-adaptation)).
7. **Bootstrap** — the silent auto-install snippet.

### `GUIDE.md`

The human-facing docs. Short and scannable — links to the Docusaurus site are welcome. Cover setup, common CLI examples, and the two or three failure modes a first-time user is most likely to hit.

### `customize.toml`

Activation keywords and named commands. Example — verify the exact keys accepted by your target BMAD installer version:

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

:::caution Schema is project-local
`customize.toml` uses a project-local `[skill.*]` shape. The top-level `skills/module.yaml` is authoritative for BMAD module registration — some `customize.toml` fields (particularly `[skill.commands]` composition) may be advisory-only depending on installer version. Verify against a real install before relying on any composed command like `scan+skill`.
:::

### `module.yaml` (top-level `skills/module.yaml`)

Add an entry to the `agents:` list. Match the shape of the existing entries:

```yaml
- code: bmad-dept-code-lint-agent
  name: Linter
  title: Code Linting Specialist
  icon: "🧹"
  description: "One-sentence pitch — what stacks, what tier, what it emits."
  team: software-development
```

### `module-help.csv`

Add one row per menu code / capability. The 15 columns (header row) are:

```
module,skill,display-name,menu-code,description,action,args,phase,preceded-by,followed-by,required,output-location,outputs,example-prompts,prompt-template
```

Minimum: one row for the primary action (e.g. `LN` for **Lint**), plus one per named sub-action (**List Rules**, **Fix**, etc.). Menu codes are 2-character uppercase, unique across the whole CSV.

### `assets/module.yaml` and `assets/module-help.csv`

Per-skill copies used by BMAD's help subsystem. Keep in sync with the top-level file — the audit agent's `assets/` copies are a working reference.

### `scripts/run.ts`

The dispatcher. Must:

- Accept `--help` / `-h` and print usage.
- Parse a small top-level flag set (`--path`, `--engine`, `--output`, `--create-branch`, `--source-branch`, `--preflight`, `--no-preflight`, `--yes-install`, `--no-install`, `--role`).
- Run the preflight advisor (`skills/shared/preflight/index.ts`) unless `--no-preflight` is passed.
- Resolve the engine via `engines/registry.ts` (`detectPlatform` → `getEngine`).
- Dispatch to the engine's `main()` — which builds `Finding[]` and calls `emitStandardOutputs()`.

Copy the shape of [`skills/bmad-dept-code-audit-agent/scripts/run.ts`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/scripts/run.ts).

### `scripts/package.json`

Declare dependencies. At minimum, list `@bmad/dca-shared` (`file:../../shared`), plus anything specific (`exceljs`, `fast-glob`, `mammoth`, etc.).

### `scripts/tsconfig.json`

Copy an existing one — the strictness settings across the fleet are aligned.

---

## 4. `SKILL.md` authoring principles

SKILL.md is a prompt for the AI. A few rules the DCA agents follow consistently:

- **Write TO the AI, not TO a human.** Human docs live in `GUIDE.md`. SKILL.md should read like a runbook the AI executes.
- **Be explicit about file paths and commands.** "Run `npx ts-node scripts/run.ts --path {project_path}`" beats "run the dispatcher."
- **Say "do NOT ask the user" where you want silence.** The bootstrap step should install without a confirmation prompt (except the first-run install prompt itself); role selection asks once; nothing else should interrogate the user by default.
- **Define trigger phrases that map to specific modes.** Users type natural language — SKILL.md is where you turn that into deterministic dispatch.
- **Include a Preflight section** so the AI runs the advisor before dispatching. Example snippet:
  ```bash
  cd .claude/skills/<your-skill>/scripts && [ -d node_modules ] || npm install --silent
  ```
- **Cross-reference other agents** where the workflow chains — Audit's `SKILL.md` points to Test Coverage and Impact Analysis; do the same if your agent participates in `dca chain-all`.

---

## 5. Naming conventions

| Item | Convention | Example |
|------|-----------|---------|
| Repo | `bmad-<purpose>` | `bmad-dept-code-agent` |
| Skill folder | `bmad-<purpose>-agent` | `bmad-dept-code-audit-agent` |
| Module code | 2–4 lowercase chars | `dca` |
| Engine dir | lowercase, hyphens (matches engine ID) | `eds-commerce` |
| Engine ID | lowercase, hyphens | `eds-commerce` |
| Menu code | 2 uppercase chars (unique across CSV) | `AU`, `SC`, `DA` |
| Report filename | `<agent>-<branch>-<timestamp>-agent-report.<ext>` | `audit-main-20260801_143512-agent-report.xlsx` |
| Working branch | `dca/<agent>-<stack>-<timestamp>` | `dca/audit-commerce-20260801_143512` |

Rule-pack directory names match the engine ID — see [`resources/rule-packs/README.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/README.md).

---

## 6. Publishing checklist

Before you open a PR:

- [ ] `skills/module.yaml` — new agent entry present, `code` unique across the file, `name` matches the folder name.
- [ ] `skills/module-help.csv` — at least one row per menu action, menu codes unique across the whole CSV.
- [ ] `assets/module.yaml` and `assets/module-help.csv` — kept in sync with the top-level copies.
- [ ] `customize.toml` — `[skill].name` matches folder name.
- [ ] `SKILL.md` — front-matter `name` matches folder; all file paths written as `.claude/skills/<your-skill>/...` (installer substitutes for other tools).
- [ ] `GUIDE.md` — at least one end-to-end example that a first-time user could paste.
- [ ] `scripts/package.json` — all deps declared; peer-depends on `@bmad/dca-shared` if you use the shared foundation.
- [ ] `scripts/run.ts` — runs standalone: `npx ts-node run.ts --help` prints usage, no crash.
- [ ] `scripts/run.ts` — emits through `emitStandardOutputs()` so a run produces the standard `.xlsx` + `.md` + `CHANGE-LOG.md`.
- [ ] TypeScript compiles clean: `npx tsc --noEmit` under `scripts/` and `shared/`.
- [ ] Smoke run against a fixture project — the standardized report appears at the expected path.
- [ ] Update the `website/docs/agents/` sidebar (add a page for your agent).
- [ ] Update `website/docs/reference/cli-flags.md` — add any new flag your dispatcher accepts.
- [ ] Update `website/docs/reference/config-vars.md` — add any new `module.yaml` config variable.
- [ ] Add a `CHANGE-LOG.md` entry noting the new agent (Keep-a-Changelog format).

---

## 7. Related pages

- [Adding a New Engine](./adding-a-new-engine) — add a new stack under an existing agent.
- [Writing Rule Packs](./writing-rule-packs) — Tier 2 LLM knowledge + Tier 1 deterministic rules.
- [Standardized Outputs Contract](../concepts/standardized-outputs) — the shared XLSX + Markdown + CHANGE-LOG contract every agent must satisfy.
- [Role Adaptation](../concepts/role-adaptation) — the 10-role model your agent should honour.
- [The 5 Agents](../concepts/the-5-agents) — the current agent fleet for reference.
- [The 8 Stacks](../concepts/the-8-stacks) — the engine IDs new agents should reuse when possible.
