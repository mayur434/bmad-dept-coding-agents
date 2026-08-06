---
id: prerequisites
title: Prerequisites
sidebar_position: 1
description: Node 20.12+, Git, and one of 44+ supported AI coding tools — that's the whole list.
---

# Prerequisites

Everything you need before running [`npx bmad-method install`](install).

## Runtime

| Requirement | Version | Why |
|-------------|---------|-----|
| **Node.js** | v20.12 or newer | The Tier-1 engines run via `npx ts-node`. The AST layer uses `web-tree-sitter` (WASM), which requires the newer Node runtime. |
| **npm** | Ships with Node.js | Used by the first-run bootstrap and for the manual fallback `npm install` in `skills/shared/` and each agent's `scripts/`. |
| **Git** | Any recent version | Required for `--create-branch`, `--source-branch`, and for the branch component of the report filename. Non-fatal outside a repo — the run still emits its `.xlsx` / `.md` and the branch component falls back to `nobranch`. |

:::tip Check your Node
```bash
node --version   # must print v20.12.x or higher
```
If you use `nvm`: `nvm install 20 && nvm use 20`.
:::

## AI coding tool

The plugin works with **any AI coding assistant BMAD Method supports** — 44+ tools. The four **BMAD-recommended** tools are:

- **Claude Code** — the reference test bed (`--tools claude-code`).
- **Cursor** (`--tools cursor`).
- **GitHub Copilot** in VS Code (`--tools github-copilot`).
- **Codex** (`--tools codex`).

Discover the full tool list — with each tool's install directory — with:

```bash
npx bmad-method install --list-tools
```

The complete 14-tool table (recommended + additional common ones) is documented on the [Install](install) page.

:::note Tool-agnostic by design
`SKILL.md` prose is tool-agnostic, `customize.toml` activation keywords work in every host that reads them, and the bootstrap script resolves paths from `dirname "$0"` — so once you pick your tool and pass the right `--tools <id>`, everything else is identical.
:::

## Recommended

- **A real project** in one of the 8 stacks (AEM, Commerce PaaS/SaaS, App Builder, Sling/Shaft, Spring Boot, EDS, EDS+Commerce). The auto-detector needs signal files (`composer.json`, `pom.xml`, `app.config.yaml`, `blocks/`, …) to pick an engine without you having to pass `--engine`. See [The 8 Stacks](../concepts/the-8-stacks) for the full auto-detection table.
- **VS Code / IDE** — any IDE works, but the reference host is Claude Code inside VS Code (Claude Code runs headlessly via CLI too — either flow is fine).
- **For Impact Analysis** — a Proofhub CSV export (`--bugs`) or a `.docx` BRD (`--brd`). At least one is required.
- **For Test Coverage (real coverage)** — your build tool (Maven + JaCoCo, `npm test` + Jest/nyc, PHPUnit + Clover, etc.) already producing a coverage report, or be able to run it.
- **For Code Generation (LLM/MCP path)** — MCP-compatible credentials for your target AEM instance. The agent can auto-provision `.mcp.json` and `.bmad/mcp-registry.toml` with `--setup`.

## What's next

Head to [Install](install) to run the actual command.
