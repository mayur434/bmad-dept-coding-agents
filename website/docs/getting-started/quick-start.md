---
id: quick-start
title: Quick Start
sidebar_position: 3
description: A 5-minute smoke test — one natural-language prompt per agent, then the full SDLC chain.
---

# Quick Start

Once the plugin is [installed](install), open your AI coding tool (Claude Code, Cursor, Copilot, …) in your project and paste any of these into chat. The agent auto-detects your stack and routes to the right engine — no flags required for the happy path.

:::tip Interactive mode is the default
On the very first invocation each agent will ask you a couple of questions — role, intake mode, and (one-time) whether to install its Node deps. See [First Run](first-run) for the full picker walk-through.
:::

## One prompt per agent

### 🔍 Audit

```text
audit my project
```

Runs the two-tier auditor — Tier 1 (deterministic tree-sitter + regex) then Tier 2 (LLM deep semantic analysis) — and writes the standardized `audit-<branch>-<timestamp>-agent-report.xlsx` + `.md` twin. See [Audit](../agents/audit).

### 🛡️ Sonar Scan

```text
sonar scan my project
```

Two-step: the LLM produces `sonar-findings.json`, then the deterministic ingest computes A–E ratings + Quality Gate and emits the standardized workbook plus a dedicated **Vulnerabilities** sheet. See [Sonar Scan](../agents/sonar-scan).

### ⚡ Code Generation

```text
generate a Sling Model for the Article component
```

Runs the deterministic scaffolder for your stack (24 types across 8 stacks). For anything the scaffolders don't cover, ask for it in natural language and the LLM/MCP path takes over. See [Code Generation](../agents/code-generation).

Other examples:

```text
create a new AEM component called Hero Banner
create a Spring REST controller for Orders
create a new Commerce module Acme_CustomShipping
scaffold an API Mesh handler
create an EDS block called cards
```

### 🧪 Test Coverage

```text
analyze test coverage
```

Runs deterministic gap analysis (which files/classes/functions have no test) and, if you also point it at an existing report, parses real line/branch coverage from JaCoCo / Istanbul / Clover / LCOV. See [Test Coverage](../agents/test-coverage).

With real coverage:

```text
analyze coverage --coverage-report target/site/jacoco/jacoco.xml
```

### 💥 Impact Analysis

```text
trace the impact of these bugs at /path/to/proofhub-export.csv
```

Or with a BRD:

```text
analyze the impact of this BRD: /path/to/requirements.docx
```

Produces the standardized report plus a unique **Input Traceability** sheet — one row per bug or requirement → impacted file → blast-radius rank → risk score. See [Impact Analysis](../agents/impact-analysis).

## Prefer the CLI?

Every agent ships a standalone TypeScript dispatcher — natural-language chat isn't required.

```bash
# Auto-detect stack, run Audit (preflight runs automatically)
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts --path .

# Sonar Scan Step 2 (ingest — Step 1 produces sonar-findings.json via chat)
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest sonar-findings.json --path .

# List every engine the Audit agent registers
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts --list-engines
```

Substitute `.claude/skills/` with your tool's directory (see [Install](install#install-for-other-ai-coding-tools)).

## Try the full SDLC chain

The `dca --chain-all` orchestrator runs every agent in canonical SDLC order and emits one unified pass:

```text
dca --chain-all
```

Alternately, chain in natural language:

```text
run audit, sonar scan, test coverage, and impact analysis in that order on a new branch cut from production, then summarize as one release-readiness report
```

Full multi-agent workflow catalog: [Workflows → Chain All](../workflows/chain-all) and [PROMPTS.md §6](https://github.com/mayur434/bmad-dept-code-agent/blob/main/PROMPTS.md).

## What you get

Every prompt above produces the same three artifacts:

1. `<agent>-<branch>-<timestamp>-agent-report.xlsx` — 15-column Summary contract.
2. `<agent>-<branch>-<timestamp>-agent-report.md` — Markdown twin.
3. One appended entry in `CHANGE-LOG.md`.

Full details: [Standardized Outputs](../concepts/standardized-outputs).

## Next

- [First Run](first-run) — the three questions on first invocation.
- [Concepts → The 5 Agents](../concepts/the-5-agents).
- Copy-paste prompt catalog — 481 prompts across 5 agents × 8 stacks in [PROMPTS.md](https://github.com/mayur434/bmad-dept-code-agent/blob/main/PROMPTS.md).
