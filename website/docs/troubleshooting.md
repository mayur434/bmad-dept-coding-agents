---
id: troubleshooting
title: Troubleshooting
sidebar_position: 90
description: Symptoms, root causes, and fixes for install, runtime, MCP, coverage, branch-cut, and per-agent issues.
keywords:
  - troubleshooting
  - docs
  - bmad help
  - install errors
  - dca debug
---

Grouped by symptom. If the exact wording differs, search this page for the closest cause.

## Install & bootstrap

### Can't find `.claude/skills/…` — CLI paths in this docs site don't resolve

:::warning Symptom
Commands in the docs reference `.claude/skills/…` but your project has no `.claude/` directory.
:::

BMAD installs skills under the tool's conventional path — `.claude/skills/` for Claude Code, but **`.agents/skills/`** for Cursor / GitHub Copilot / Codex / most other tools, and per-tool folders for the rest (`.cline/skills/`, `.kiro/skills/`, `.junie/skills/`, `.zencoder/skills/`). All bootstrap scripts and `run.ts` invocations resolve their sibling paths from `dirname "$0"`, so they work regardless of which directory BMAD chose.

:::tip Fix
Locate the actual path, then substitute the prefix in every command in the docs.

```bash title="Terminal"
find . -type d -name 'bmad-dept-code-audit-agent' 2>/dev/null | head
```
:::

### `Error: Cannot find module 'web-tree-sitter'` (or WASM load errors) on first Tier-1 scan

:::warning Symptom
The Tier-1 deterministic scan aborts because `web-tree-sitter` (or a WASM grammar) can't load.
:::

Dependencies weren't installed. Confirm Node.js is `≥ v20.12` — older Node cannot load the WASM grammars.

:::tip Fix (preferred)
Rerun the agent with `--yes-install` to force the bootstrap.
:::

:::tip Fix (manual fallback)
Install both packages in order:

```bash title="Terminal"
cd .claude/skills/shared && npm install
cd ../bmad-dept-code-audit-agent/scripts && npm install
```
:::

### Bootstrap declined (exit code `3`)

:::warning Symptom
The dispatcher exits with code `3` and never proceeds.
:::

You answered `n` to the first-run install prompt.

:::tip Fix
- Rerun with **`--yes-install`** to force the install without asking.
- Or run the manual fallback above, then retry the agent with **`--no-install`** so the exit reason is unambiguous (`2` = deps missing) if anything is still off.

Never re-answer `n` in a script — the agent stops on exit `3` and won't proceed.
:::

### Install fails behind a corporate proxy

:::warning Symptom
`npm install` inside the bootstrap fails with connection errors.
:::

The bootstrap uses `npm install` under the hood.

:::tip Fix
Configure npm before the first agent invocation:

```bash title="Terminal"
npm config set proxy http://your-proxy
npm config set https-proxy http://your-proxy
# or export HTTP_PROXY / HTTPS_PROXY
```

Alternatively, run the manual fallback with `NPM_CONFIG_*` env vars exported, then retry the agent with `--no-install` to confirm it now no-ops silently.
:::

## Runtime & flags

### Missing `--engine` — `No auto-detect match`

:::warning Symptom
The dispatcher's registry couldn't find any signals for the 8 built-in engines in your project path.
:::

:::tip Fix
- Pass `--engine <id>` explicitly (see `--list-engines` for the current list).
- Confirm `--path` points at the actual project root (`ls` should show `pom.xml`, `composer.json`, `package.json`, `app.config.yaml`, or the platform's marker files).
:::

### Preflight recommends LLM but the project is huge (or STATIC on a tiny project)

:::warning Symptom
The preflight advisor's mode recommendation doesn't fit the project size.
:::

The advisor detects the model + context window from env vars — the model detection may be wrong. Verify with `--preflight` alone and read the printed model.

:::tip Fix
Override with `BMAD_TOKEN_BUDGET_TOTAL`, or just ignore the advisory (it never blocks). For very large projects that don't fit the LLM budget, prefer the Tier-1 deterministic pass (Audit **Scan Only**, Test Coverage `--mode analyze`) — no tokens, deterministic, safe on any repo size.
:::

### Branch cut failed — `dca/…` was never created

:::warning Symptom
The run finished but no `dca/*` working branch appears.
:::

The `--create-branch` step is non-fatal. Common causes:

- Not in a git repo (or detached HEAD).
- The source-branch cascade found no `production` / `main` / `master` / `develop`. Pass `--source-branch <name>` explicitly.

:::tip Fix
The run still emits its `.xlsx` / `.md`. If you needed the branch, create it manually:

```bash title="Terminal"
git checkout -b dca/<agent>-<stack>-<timestamp>
```
:::

### Report came back empty — 0 findings, agent said "complete"

:::warning Symptom
The agent reports success but the XLSX has no rows.
:::

:::tip Fix
- **Tier 1** — check whether the engine's auto-detect actually picked a stack (`--list-engines`, then rerun with `--engine <id>` explicitly).
- **Tier 2** — confirm the LLM actually reached your files. The preflight's "project size" line should be non-zero. If it's zero, `--path` is pointing at an empty directory.
:::

## Per-agent

### `Error: --ingest <findings.json> is required for Step 2` on Sonar Scan

:::warning Symptom
Step 2 aborts because it can't find the JSON findings file from Step 1.
:::

You ran Step 2 without Step 1.

:::tip Fix
- Trigger the LLM scan first (chat: `sonar scan my project`) — Step 1 writes `sonar-findings.json` to the configured `sonar_output` directory. Then rerun `--ingest`.
- Use `--auto-ingest` / `--watch` — the dispatcher polls for the file to appear and runs Step 2 automatically.
:::

### Sonar's Vulnerabilities sheet is empty even though the LLM found issues

:::warning Symptom
The Vulnerabilities sheet has zero rows but the LLM clearly reported issues.
:::

The LLM must set `category: "Vulnerability"` (or `"Security Hotspot"`) on each finding in `sonar-findings.json`. The ingest step routes rows to the Vulnerabilities sheet by that string.

:::tip Fix
Open the JSON and check the `category` field on each finding.
:::

### MCP server not connecting (Code Generation LLM/MCP path)

:::warning Symptom
The Code Generation agent's LLM/MCP path can't reach the MCP server.
:::

:::tip Fix
Run the auto-provisioning, then restart your host (Claude Code / Cursor / IDE) so it re-reads `.mcp.json`.

```bash title="Terminal"
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts --setup
```

Confirm that `.mcp.json`, `.bmad/mcp-registry.toml`, and `.env` were written at the project root.
:::

### Audit's `--bugs` didn't accept my file, but Impact Analysis's `--bugs` did (or vice versa)

:::warning Symptom
The same-named `--bugs` flag rejects a file that the other agent accepted.
:::

The two `--bugs` flags **accept different formats**:

- **Audit** Commerce engine `--bugs` → `.xlsx` bug report.
- **Impact Analysis** `--bugs` → Proofhub CSV export.

:::tip Fix
Use the format the specific agent's docs specify — this is intentional; the two agents have different upstream inputs.
:::

### Coverage tool timed out (`--run-coverage`)

:::warning Symptom
`--run-coverage` aborts before the underlying coverage tool finishes.
:::

The runner shells out to `mvn`, `gradle`, `jest`, `nyc`, or `phpunit`.

:::tip Fix
Run the underlying tool manually first to confirm it succeeds in isolation. If it does, run the agent again — the timeout is usually a transient CI issue.

If the underlying tool needs a longer timeout than the default, run it out-of-band and then pass the produced report to `--coverage-report <file>` instead of `--run-coverage`.
:::

## Configuration & role

### `.bmad/role.yaml` corruption — delete to reset

:::warning Symptom
The role file has invalid YAML or an unknown role code, and every agent invocation errors.
:::

The role file schema is small and stable. If it becomes corrupted, delete it — the next agent invocation performs the role handshake again and writes a fresh file.

:::tip Fix
```bash title="Terminal"
rm <projectRoot>/.bmad/role.yaml
```

Same story for `.bmad/intake.yaml` (interactive vs technical intake mode).
:::

### Preflight recommends LLM mode but the project is too big for Static

:::warning Symptom
The advisor points at LLM but you know the project won't fit any reasonable token budget.
:::

The advisor is intentionally advisory.

:::tip Fix
- Set `BMAD_TOKEN_BUDGET_TOTAL` to the actual token budget you want the advisor to assume.
- Pass `--no-preflight` to suppress the advisor entirely and let the deterministic Tier-1 run.
:::

## See also

- [Auto-install concept](./concepts/auto-install) — full bootstrap exit-code semantics.
- [Interactive vs technical intake](./concepts/interactive-vs-technical) — the `.bmad/intake.yaml` schema and how to switch modes.
- [Role adaptation](./concepts/role-adaptation) — the `.bmad/role.yaml` schema and the role × agent matrix.
- [CI Integration](./workflows/ci-integration) — CI-safe flag patterns.
