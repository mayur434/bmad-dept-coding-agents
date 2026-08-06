---
id: troubleshooting
title: Troubleshooting
sidebar_position: 90
description: Symptoms, root causes, and fixes for install, runtime, MCP, coverage, branch-cut, and per-agent issues.
---

# Troubleshooting

Grouped by symptom. If the exact wording differs, search this page for the closest cause.

## Install & bootstrap

### Can't find `.claude/skills/…` — CLI paths in this docs site don't resolve

BMAD installs skills under the tool's conventional path — `.claude/skills/` for Claude Code, but **`.agents/skills/`** for Cursor / GitHub Copilot / Codex / most other tools, and per-tool folders for the rest (`.cline/skills/`, `.kiro/skills/`, `.junie/skills/`, `.zencoder/skills/`). All bootstrap scripts and `run.ts` invocations resolve their sibling paths from `dirname "$0"`, so they work regardless of which directory BMAD chose.

Locate the actual path:

```bash
find . -type d -name 'bmad-dept-code-audit-agent' 2>/dev/null | head
```

Then substitute the prefix in every command in the docs.

### `Error: Cannot find module 'web-tree-sitter'` (or WASM load errors) on first Tier-1 scan

Dependencies weren't installed. Two fixes:

1. **Preferred** — rerun the agent with `--yes-install` to force the bootstrap.
2. **Manual fallback** — install both packages in order:

```bash
cd .claude/skills/shared && npm install
cd ../bmad-dept-code-audit-agent/scripts && npm install
```

Confirm Node.js is `≥ v20.12` — older Node cannot load the WASM grammars.

### Bootstrap declined (exit code `3`)

You answered `n` to the first-run install prompt. Two options:

- Rerun with **`--yes-install`** to force the install without asking.
- Run the manual fallback above, then retry the agent with **`--no-install`** so the exit reason is unambiguous (`2` = deps missing) if anything is still off.

Never re-answer `n` in a script — the agent stops on exit `3` and won't proceed.

### Install fails behind a corporate proxy

The bootstrap uses `npm install` under the hood. Before the first agent invocation:

```bash
npm config set proxy http://your-proxy
npm config set https-proxy http://your-proxy
# or export HTTP_PROXY / HTTPS_PROXY
```

Alternatively, run the manual fallback with `NPM_CONFIG_*` env vars exported, then retry the agent with `--no-install` to confirm it now no-ops silently.

## Runtime & flags

### Missing `--engine` — `No auto-detect match`

The dispatcher's registry couldn't find any signals for the 8 built-in engines in your project path. Two fixes:

- Pass `--engine <id>` explicitly (see `--list-engines` for the current list).
- Confirm `--path` points at the actual project root (`ls` should show `pom.xml`, `composer.json`, `package.json`, `app.config.yaml`, or the platform's marker files).

### Preflight recommends LLM but the project is huge (or STATIC on a tiny project)

The advisor detects the model + context window from env vars — the model detection may be wrong. Verify with `--preflight` alone and read the printed model. Override with `BMAD_TOKEN_BUDGET_TOTAL`, or just ignore the advisory (it never blocks).

For very large projects that don't fit the LLM budget, prefer the Tier-1 deterministic pass (Audit **Scan Only**, Test Coverage `--mode analyze`) — no tokens, deterministic, safe on any repo size.

### Branch cut failed — `dca/…` was never created

The `--create-branch` step is non-fatal. Common causes:

- Not in a git repo (or detached HEAD).
- The source-branch cascade found no `production` / `main` / `master` / `develop`. Pass `--source-branch <name>` explicitly.

The run still emits its `.xlsx` / `.md`. If you needed the branch, create it manually:

```bash
git checkout -b dca/<agent>-<stack>-<timestamp>
```

### Report came back empty — 0 findings, agent said "complete"

- **Tier 1** — check whether the engine's auto-detect actually picked a stack (`--list-engines`, then rerun with `--engine <id>` explicitly).
- **Tier 2** — confirm the LLM actually reached your files. The preflight's "project size" line should be non-zero. If it's zero, `--path` is pointing at an empty directory.

## Per-agent

### `Error: --ingest <findings.json> is required for Step 2` on Sonar Scan

You ran Step 2 without Step 1. Two options:

- Trigger the LLM scan first (chat: `sonar scan my project`) — Step 1 writes `sonar-findings.json` to the configured `sonar_output` directory. Then rerun `--ingest`.
- Use `--auto-ingest` / `--watch` — the dispatcher polls for the file to appear and runs Step 2 automatically.

### Sonar's Vulnerabilities sheet is empty even though the LLM found issues

The LLM must set `category: "Vulnerability"` (or `"Security Hotspot"`) on each finding in `sonar-findings.json`. Open the JSON and check the `category` field; the ingest step routes rows to the Vulnerabilities sheet by that string.

### MCP server not connecting (Code Generation LLM/MCP path)

Run the auto-provisioning:

```bash
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts --setup
```

Confirm that `.mcp.json`, `.bmad/mcp-registry.toml`, and `.env` were written at the project root. Restart your host (Claude Code / Cursor / IDE) so it re-reads `.mcp.json`.

### Audit's `--bugs` didn't accept my file, but Impact Analysis's `--bugs` did (or vice versa)

The two `--bugs` flags **accept different formats**:

- **Audit** Commerce engine `--bugs` → `.xlsx` bug report.
- **Impact Analysis** `--bugs` → Proofhub CSV export.

Use the format the specific agent's docs specify — this is intentional; the two agents have different upstream inputs.

### Coverage tool timed out (`--run-coverage`)

The runner shells out to `mvn`, `gradle`, `jest`, `nyc`, or `phpunit`. Run the underlying tool manually first to confirm it succeeds in isolation. If it does, run the agent again — the timeout is usually a transient CI issue.

If the underlying tool needs a longer timeout than the default, run it out-of-band and then pass the produced report to `--coverage-report <file>` instead of `--run-coverage`.

## Configuration & role

### `.bmad/role.yaml` corruption — delete to reset

The role file schema is small and stable. If it becomes corrupted (invalid YAML, unknown role code), delete it — the next agent invocation performs the role handshake again and writes a fresh file:

```bash
rm <projectRoot>/.bmad/role.yaml
```

Same story for `.bmad/intake.yaml` (interactive vs technical intake mode).

### Preflight recommends LLM mode but the project is too big for Static

The advisor is intentionally advisory. Two overrides:

- Set `BMAD_TOKEN_BUDGET_TOTAL` to the actual token budget you want the advisor to assume.
- Pass `--no-preflight` to suppress the advisor entirely and let the deterministic Tier-1 run.

## See also

- [Auto-install concept](./concepts/auto-install) — full bootstrap exit-code semantics.
- [Interactive vs technical intake](./concepts/interactive-vs-technical) — the `.bmad/intake.yaml` schema and how to switch modes.
- [Role adaptation](./concepts/role-adaptation) — the `.bmad/role.yaml` schema and the role × agent matrix.
- [CI Integration](./workflows/ci-integration) — CI-safe flag patterns.
