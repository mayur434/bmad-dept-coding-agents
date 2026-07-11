# BMAD DEPT Code Agent — Manual

---

## Install / Update / Uninstall

### Fresh Install (into a target project)

```bash
cd /path/to/your-project

# From Git URL
npx bmad-method install \
  --directory . \
  --modules bmm,bmb \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools claude-code \
  --yes

# From local path (points to skills/ folder, NOT repo root)
npx bmad-method install \
  --directory . \
  --modules bmm,bmb \
  --custom-source /path/to/bmad-dept-code-agent/skills \
  --tools claude-code \
  --yes
```

After install, run deps (Node.js v20.12+). Install the **shared foundation FIRST** — every agent imports `skills/shared/` — then each agent's `scripts/` you intend to use:
```bash
# shared foundation (required by every agent) — install first
cd .claude/skills/shared && npm install

# then each agent you use, e.g. the auditor
cd .claude/skills/bmad-dept-code-audit-agent/scripts && npm install
```

The four agent folders are `bmad-dept-code-audit-agent`, `bmad-dept-code-generation-agent`, `bmad-dept-code-impact-analysis-agent`, and `bmad-dept-code-test-coverage-agent`.

### Update (after pushing changes to this repo)

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

Then reinstall deps (shared foundation first, then each agent's `scripts/`):
```bash
cd .claude/skills/shared && npm install
cd .claude/skills/bmad-dept-code-audit-agent/scripts && npm install
```

### Uninstall

```bash
npx bmad-method uninstall --directory .
```

### Useful Flags

| Flag | Purpose |
|------|---------|
| `--action quick-update` | Fast sync — preserves all config |
| `--action update` | Full update — can modify modules/config |
| `--custom-source <url\|path>` | Git URL or local `skills/` folder path |
| `--yes` | Non-interactive, accept defaults |
| `--channel next` | Use latest HEAD instead of stable tag |
| `--pin CODE=TAG` | Pin module to specific release tag |
| `--set module.key=value` | Override config non-interactively |
| `--list-options [module]` | Show available `--set` keys |
| `--list-tools` | Show valid tool/IDE IDs |

---

## Repository Structure

The suite ships **4 agents** and one shared foundation. Module version (3.0.0) lives only in `.claude-plugin/marketplace.json`.

```
bmad-dept-code-agent/
├── README.md
├── MANUAL.md                        ← This file
├── IMPLEMENTATION-PLAN.md
├── PROMPTS.md
├── DCA-Agent-Coverage.xlsx          ← Coverage deliverables (built by tools/)
├── DCA-Agent-Coverage.pdf
├── DCA-Test-Commands.xlsx
├── .claude-plugin/
│   └── marketplace.json             ← Plugin manifest (module version)
├── tools/
│   └── coverage-report/             ← build-xlsx.js, build-pdf.js, build-test-commands.js
└── skills/                          ← --custom-source points here
    ├── module.yaml                  ← Module identity + config variables
    ├── module-help.csv              ← Menu entries (13-column CSV)
    ├── shared/                      ← @bmad/dca-shared — install deps FIRST
    │   ├── ast/ core/ coverage/ git/ java/ js/ php/
    │   ├── output/ preflight/ report/ token-budget/
    │   ├── index.ts
    │   └── package.json · tsconfig.json
    ├── bmad-dept-code-audit-agent/            ← Auditor 🔍
    ├── bmad-dept-code-generation-agent/       ← Generator ⚡
    ├── bmad-dept-code-impact-analysis-agent/  ← Impact Analyst 💥
    └── bmad-dept-code-test-coverage-agent/    ← Test Coverage 🧪
```

Every agent folder shares the same layout (the audit agent is shown expanded):

```
bmad-dept-code-audit-agent/
├── SKILL.md                 ← Agent instructions (most important)
├── GUIDE.md                 ← Human docs
├── customize.toml           ← Commands, activation keywords, script paths
├── assets/                  ← Copies of module.yaml + module-help.csv
├── resources/               ← Rule packs, scoring models
├── templates/               ← Report templates
└── scripts/                 ← TypeScript Tier-1 scanner
    ├── run.ts               ← Dispatcher entry point
    ├── package.json
    ├── tsconfig.json
    ├── shared/
    └── engines/             ← 8 registered engines
        ├── registry.ts
        ├── aem/
        ├── commerce/
        ├── commerce-saas/
        ├── sling/
        ├── spring/
        ├── app-builder/
        ├── eds/
        └── eds_commerce/    ← underscore on disk; canonical ID is `eds-commerce`
```

---

## Key Files

| File | Role |
|------|------|
| `SKILL.md` | Instructions TO the AI agent — workflows, commands, modes |
| `GUIDE.md` | Instructions FOR humans — setup, CLI examples |
| `customize.toml` | Activation keywords, named commands, script paths |
| `module.yaml` | Module identity, agents, config variables |
| `module-help.csv` | Agent menu entries (13-column CSV) |

---

## Creating a New Module

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

### customize.toml

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

### SKILL.md Principles

- Write as instructions TO the AI agent, not to a human
- Be explicit about file paths, commands, error handling
- Include "do NOT ask the user" for things that should be silent
- Define trigger phrases that map to specific modes
- Pre-flight section auto-installs deps silently:
  ```bash
  cd .claude/skills/your-skill/scripts && [ -d node_modules ] || npm install --silent
  ```

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Repo | `bmad-<purpose>` | `bmad-dept-code-agent` |
| Skill folder | `bmad-<purpose>-agent` | `bmad-dept-code-audit-agent` |
| Module code | 2-4 chars | `dca` |
| Engine dirs | lowercase, underscores | `eds_commerce` |
| Engine IDs | lowercase, hyphens | `eds-commerce` |

---

## Checklist

- [ ] `module.yaml` — `code` unique, `name` matches everywhere
- [ ] `module-help.csv` — actions match customize.toml commands
- [ ] `customize.toml` — skill name matches folder name
- [ ] `SKILL.md` — frontmatter `name` matches folder, paths relative
- [ ] `package.json` — all deps listed
- [ ] `scripts/run.ts` — runs standalone (`npx ts-node run.ts --help`)
- [ ] `assets/` — contains copies of module.yaml + module-help.csv
- [ ] TypeScript compiles clean (`npx tsc --noEmit`)

Then fill in each file following the **Creating a New Module** guidance above.
