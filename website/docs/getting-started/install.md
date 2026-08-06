---
id: install
title: Install
sidebar_position: 2
description: One npx command per AI coding tool — installs into your project, no manual npm install.
keywords:
  - install
  - bmad-method
  - claude code
  - cursor
  - github copilot
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

The plugin installs into a **target project directory** — the folder containing your Adobe / JVM source tree. BMAD drops the agent skills under a tool-specific directory (e.g. `.claude/skills/` for Claude Code, `.agents/skills/` for Cursor / Copilot / Codex).

:::note Auto-install of Node dependencies
There is **no manual `npm install` step**. The first time you invoke any agent, a bootstrap detects missing `node_modules` and prompts once (~80MB, ~30–60s). See [Auto-install](../concepts/auto-install) for the full mechanics.
:::

## Fresh install — pick your AI coding tool

Substitute the tool you use. Claude Code is the reference host and the default.

<Tabs groupId="ai-tool" defaultValue="claude-code" values={[
  {label: 'Claude Code', value: 'claude-code'},
  {label: 'Cursor', value: 'cursor'},
  {label: 'GitHub Copilot', value: 'github-copilot'},
  {label: 'Codex', value: 'codex'},
  {label: 'Cline', value: 'cline'},
  {label: 'Windsurf', value: 'windsurf'},
  {label: 'Roo Code', value: 'roo'},
  {label: 'Gemini CLI', value: 'gemini'},
  {label: 'Junie', value: 'junie'},
  {label: 'Kiro', value: 'kiro'},
]}>

<TabItem value="claude-code">

```bash title="Terminal"
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools claude-code \
  --yes
```

Skills install under `.claude/skills/`.

</TabItem>

<TabItem value="cursor">

```bash title="Terminal"
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools cursor \
  --yes
```

Skills install under `.agents/skills/`.

</TabItem>

<TabItem value="github-copilot">

```bash title="Terminal"
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools github-copilot \
  --yes
```

Skills install under `.agents/skills/` (VS Code Copilot host).

</TabItem>

<TabItem value="codex">

```bash title="Terminal"
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools codex \
  --yes
```

Skills install under `.agents/skills/`.

</TabItem>

<TabItem value="cline">

```bash title="Terminal"
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools cline \
  --yes
```

Skills install under `.cline/skills/`.

</TabItem>

<TabItem value="windsurf">

```bash title="Terminal"
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools windsurf \
  --yes
```

Skills install under `.agents/skills/`.

</TabItem>

<TabItem value="roo">

```bash title="Terminal"
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools roo \
  --yes
```

Skills install under `.agents/skills/`.

</TabItem>

<TabItem value="gemini">

```bash title="Terminal"
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools gemini \
  --yes
```

Skills install under `.agents/skills/`.

</TabItem>

<TabItem value="junie">

```bash title="Terminal"
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools junie \
  --yes
```

Skills install under `.junie/skills/`.

</TabItem>

<TabItem value="kiro">

```bash title="Terminal"
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-code-agent.git \
  --tools kiro \
  --yes
```

Skills install under `.kiro/skills/`.

</TabItem>

</Tabs>

See [First Run](first-run) for what happens on your first agent invocation.

## Full supported-tools list

The 10 tabs above cover the common cases. BMAD supports 40+ AI coding tools total:

| Tool | `--tools <id>` | Installed under |
|------|----------------|-----------------|
| Claude Code (default) | `claude-code` | `.claude/skills/` |
| Cursor | `cursor` | `.agents/skills/` |
| GitHub Copilot (VS Code) | `github-copilot` | `.agents/skills/` |
| Codex | `codex` | `.agents/skills/` |
| Cline | `cline` | `.cline/skills/` |
| Windsurf | `windsurf` | `.agents/skills/` |
| Gemini CLI | `gemini` | `.agents/skills/` |
| Roo Code | `roo` | `.agents/skills/` |
| Sourcegraph Amp | `amp` | `.agents/skills/` |
| Kiro | `kiro` | `.kiro/skills/` |
| Junie | `junie` | `.junie/skills/` |
| Warp | `warp` | `.agents/skills/` |
| Zencoder | `zencoder` | `.zencoder/skills/` |
| Qwen Coder | `qwen` | `.qwen/skills/` |

30+ additional tools are supported (KiloCoder, CodeBuddy, CodeWhale, Mistral Vibe, Kimi Code, OpenHands, OpenCode, Ona, Replit, Rovo Dev, Trae, Kode, iFlow, others).

:::tip Get the full list
```bash title="Terminal"
npx bmad-method install --list-tools
```
:::

:::info Wherever the docs say `.claude/skills/…`
Substitute your tool's actual directory. To locate it after install:
```bash title="Terminal"
find . -type d -name "bmad-dept-code-audit-agent" 2>/dev/null | head -3
```
:::

## Fresh install (from a local clone)

Point `--custom-source` at the repo's **`skills/`** folder, not the repo root:

```bash title="Terminal"
git clone https://github.com/mayur434/bmad-dept-code-agent.git ~/src/dca
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source ~/src/dca/skills \
  --tools claude-code \
  --yes
```

## Auto-install of Node deps on first run

**No manual `npm install` needed.** The first time you invoke any agent, a bootstrap step detects missing `node_modules` and asks — on one line — whether to install:

> `[dca-bootstrap] First-run dependency install needed — ~80MB across shared/ and <agent>/ (~30–60s). Proceed? (Y/n)`

Answer **Y** (or press Enter). The bootstrap installs `shared/` first, then the agent's `scripts/`, both silently. Subsequent runs are silent no-ops.

:::warning Network-restricted environments
The bootstrap calls `npm install`. In air-gapped or heavily-firewalled setups, pre-populate `node_modules` and pass `--no-install` on every agent invocation so the bootstrap never tries to reach the registry. Corporate proxies: set `npm config set proxy` / `https-proxy` before the first agent run.
:::

Full mechanics — bootstrap exit codes, headless overrides (`--yes-install` / `--no-install`), Windows Node twin — on the [Auto-install concept page](../concepts/auto-install).

## Update

```bash title="Terminal"
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

## Uninstall

```bash title="Terminal"
npx bmad-method uninstall --directory .
```

This removes the agent skill folders. It does NOT remove reports the agents wrote (`audit-reports/`, `sonar-reports/`, etc.), the appended `CHANGE-LOG.md`, or any `dca/*` working branches. Delete those manually if you don't want them.

## Useful BMAD installer flags

| Flag | Purpose |
|------|---------|
| `--action quick-update` | Fast sync — preserves all config. |
| `--action update` | Full update — can modify modules / config. |
| `--custom-source <url\|path>` | Git URL or local `skills/` folder path. |
| `--yes` | Non-interactive, accept defaults. |
| `--channel next` | Use latest HEAD instead of stable tag. |
| `--pin CODE=TAG` | Pin module to a specific release tag. |
| `--set module.key=value` | Override a config variable non-interactively. |
| `--list-options [module]` | Show available `--set` keys. |
| `--list-tools` | Show valid tool/IDE IDs. |

The `dca` module exposes 7 config variables (`audit_output`, `sonar_output`, `generation_output`, `impact_output`, `test_coverage_output`, `audit_engine`, `audit_namespace`) plus `default_role` for role adaptation. See the [config reference](../reference/config-vars) for the full list and defaults.

## Next

- [Quick Start](quick-start) — a 5-minute smoke test.
- [First Run](first-run) — what the very first agent invocation looks like.
