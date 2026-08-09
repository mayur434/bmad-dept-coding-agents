# BMAD DEPT Code Agent

[![GitHub](https://img.shields.io/badge/GitHub-mayur434%2Fbmad--dept--code--agent-blue)](https://github.com/mayur434/bmad-dept-coding-agents)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Module Version](https://img.shields.io/badge/module-v4.0.0-blueviolet)](.claude-plugin/marketplace.json)
[![Docs](https://img.shields.io/badge/docs-Docusaurus-3ECC5F)](https://mayur434.github.io/bmad-dept-coding-agents)

> A nine-agent AI suite (module code `dca`) for Adobe platform and JVM SDLC — author requirements + architecture, audit, sonar-scan, generate, analyse impact, reach 100% test coverage, ship the release, and run it in production across eight tech stacks with one standardized report shape.

---

## TL;DR

- **What it is** — a single BMAD module (`dca`, v4.0.0) plugging nine specialist AI coding agents into Claude Code (or any BMAD-compatible tool) via `npx bmad-method install`.
- **What it delivers** — Tier 1 deterministic TypeScript engines (tree-sitter AST + regex) + Tier 2 LLM knowledge packs, funnelled through one shared reporting foundation.
- **What you get, every run** — a standardized `<agent>-<branch>-<timestamp>-agent-report.xlsx` + Markdown twin + `CHANGE-LOG.md` entry, with an optional working branch cut on demand.
- **Who it's for** — Enterprise Architects, tech leads, and delivery engineers on Adobe Commerce (PaaS/SaaS), AEMaaCS/AMS, Adobe App Builder, Apache Sling/Shaft, Spring Boot, and Edge Delivery Services projects.

---

## 📖 Full documentation

**Every deep-dive lives on the Docusaurus site: [mayur434.github.io/bmad-dept-coding-agents](https://mayur434.github.io/bmad-dept-coding-agents)**

Quick links:

- **[Getting Started](https://mayur434.github.io/bmad-dept-coding-agents/getting-started/install)** — prerequisites, install, first-run walkthrough.
- **[Concepts](https://mayur434.github.io/bmad-dept-coding-agents/concepts/the-agents)** — the agents, the 8 stacks, standardized outputs, role adaptation, [requirements-authoring](https://mayur434.github.io/bmad-dept-coding-agents/concepts/requirements-authoring), [architecture-authoring](https://mayur434.github.io/bmad-dept-coding-agents/concepts/architecture-authoring), [release-management](https://mayur434.github.io/bmad-dept-coding-agents/concepts/release-management), [observability](https://mayur434.github.io/bmad-dept-coding-agents/concepts/observability).
- **[Agents](https://mayur434.github.io/bmad-dept-coding-agents/agents/audit)** — per-agent usage guides: [Requirements](https://mayur434.github.io/bmad-dept-coding-agents/agents/requirements) · [Architecture](https://mayur434.github.io/bmad-dept-coding-agents/agents/architecture) · [Audit](https://mayur434.github.io/bmad-dept-coding-agents/agents/audit) · [Sonar Scan](https://mayur434.github.io/bmad-dept-coding-agents/agents/sonar-scan) · [Code Generation](https://mayur434.github.io/bmad-dept-coding-agents/agents/code-generation) · [Impact Analysis](https://mayur434.github.io/bmad-dept-coding-agents/agents/impact-analysis) · [Test Coverage](https://mayur434.github.io/bmad-dept-coding-agents/agents/test-coverage) · [Release](https://mayur434.github.io/bmad-dept-coding-agents/agents/release) · [Operations](https://mayur434.github.io/bmad-dept-coding-agents/agents/operations).
- **[Workflows](https://mayur434.github.io/bmad-dept-coding-agents/workflows/chain-all)** — chain-all, CI integration, per-role recipes.
- **[Reference](https://mayur434.github.io/bmad-dept-coding-agents/reference/cli-flags)** — CLI flags, config vars, rule packs, scoring model.
- **[Prompt Catalog](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/audit)** — 480+ copy-paste prompts per agent.
- **[Contributing](https://mayur434.github.io/bmad-dept-coding-agents/contributing/authoring-a-new-skill)** — author a skill, add an engine, write rule packs.
- **[Troubleshooting](https://mayur434.github.io/bmad-dept-coding-agents/troubleshooting)** — common failure modes and fixes.
- **[Roadmap](https://mayur434.github.io/bmad-dept-coding-agents/roadmap)** — what's delivered vs. what's next.

> The Docusaurus site is the source of truth. In-repo `.md` files (this README, `MANUAL.md`, `PROMPTS.md`, `IMPLEMENTATION-PLAN.md`) are pointer docs.

---

## Coverage Matrix

Every agent supports every stack — all 72 cells (9 × 8) delivered.

| Agent | Commerce PaaS | Commerce SaaS | AEM (aaCS + AMS) | Sling / Shaft | Spring Boot | App Builder | EDS | EDS + Commerce |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Requirements** (BRD / stories / AC) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Architecture** (ADR / HLD / LLD / OpenAPI / STRIDE) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Audit** (Scanner + LLM) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Sonar Scan** (LLM Quality Gate) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Code Generation** (Scaffolders + MCP/LLM) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Impact Analysis** (Input-driven tracer) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Test Coverage** (Scanner + LLM) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Release** (Pipelines / notes / deploy / rollback / env-diff / announcements) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Operations** (Runbooks / dashboards / alerts / SLOs / on-call / playbooks / postmortems) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Details: [Concepts → The Agents](https://mayur434.github.io/bmad-dept-coding-agents/concepts/the-agents) · [Concepts → The 8 Stacks](https://mayur434.github.io/bmad-dept-coding-agents/concepts/the-8-stacks) · [Reference → Rule Packs](https://mayur434.github.io/bmad-dept-coding-agents/reference/rule-packs/aem).

---

## Install

Claude Code (the reference host):

```bash
cd /path/to/your-project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source https://github.com/mayur434/bmad-dept-coding-agents.git \
  --tools claude-code \
  --yes
```

Other tools (Cursor, VS Code + Copilot, Codex, Cline, Windsurf, Gemini CLI, Roo, Kiro, Junie, Warp, Zencoder, Qwen, 30+ more) — see **[Getting Started → Install](https://mayur434.github.io/bmad-dept-coding-agents/getting-started/install)**. Discover every tool ID with `npx bmad-method install --list-tools`.

First-run auto-installs the ~80MB of Node deps behind a single Y/N prompt. Non-interactive: pass `--yes-install` (CI) or `--no-install` (air-gapped). See **[Concepts → Auto-Install](https://mayur434.github.io/bmad-dept-coding-agents/concepts/auto-install)**.

---

## Quick start

Once installed, paste one of these into your AI coding tool's chat — the agent auto-detects the stack:

```text
author BRD for a new checkout-address feature
author ADR: Kafka vs SQS for orders event bus
audit my project
sonar scan my project
generate a Sling Model for the Article component
analyze test coverage
trace the impact of these bugs: ./bugs.csv
full release 2.5.0 — pipeline, notes, deploy, rollback, announcement
full ops kit for checkout-api tier-1 on Datadog
```

More: **[Getting Started → Quick Start](https://mayur434.github.io/bmad-dept-coding-agents/getting-started/quick-start)** · **[Prompt Catalog](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/audit)**.

---

## Standardized outputs, at a glance

Every run — every agent, every stack — emits three artifacts through one shared entry point (`skills/shared/output/emit.ts::emitStandardOutputs`):

1. **`<agent>-<branch>-<timestamp>-agent-report.xlsx`** — 6-sheet workbook (Run Info · Summary · Severity Breakdown · By Category · Recommendations · Input Traceability) with a frozen 15-column Summary contract.
2. **`<agent>-<branch>-<timestamp>-agent-report.md`** — a git-diffable Markdown twin.
3. **`CHANGE-LOG.md`** — Keep-a-Changelog-flavoured entry spliced newest-first after the `<!-- dca:entries -->` marker.

Pass `--create-branch` to also cut `dca/<agent>-<stack>-<timestamp>` from the first existing of `production → main → master → develop`. Full contract: **[Concepts → Standardized Outputs](https://mayur434.github.io/bmad-dept-coding-agents/concepts/standardized-outputs)**.

---

## Role-based operation

Each agent adapts its default mode, output flavor, and recommended follow-ups to the role of the person driving the run — Enterprise Architect, Tech Lead, Senior Delivery Engineer, QA / SDET, DevOps / SRE, Security Engineer, Product Manager, Business Analyst, Migration Lead, Content Engineer (10 roles + `generic` fallback). Set once per project via a first-run picker or manually in `<projectRoot>/.bmad/role.yaml`.

Full mechanics + per-agent × per-role matrix: **[Concepts → Role Adaptation](https://mayur434.github.io/bmad-dept-coding-agents/concepts/role-adaptation)**.

---

## Roadmap

All 81 delivered coverage cells are ✅ complete (9 agents × 9 in-scope stack variants). Phase 2 (📋 Requirements + 🏛️ Architecture) and Phase 3 (🚀 Release + 📊 Operations) shipped in recent releases; Phase 4 (Code Review + Compliance) is planned — see **[Roadmap](https://mayur434.github.io/bmad-dept-coding-agents/roadmap)**.

---

## Getting help / contributing

- **File a bug.** Open an issue at [github.com/mayur434/bmad-dept-coding-agents/issues](https://github.com/mayur434/bmad-dept-coding-agents/issues). Attach the `<agent>-<branch>-<timestamp>-agent-report.xlsx`, the CHANGE-LOG entry, your Node version + host tool, and the prompt / CLI command that triggered the bug.
- **Contribute.** See **[Contributing](https://mayur434.github.io/bmad-dept-coding-agents/contributing/authoring-a-new-skill)** — three pages cover authoring a new skill, adding a new engine, and writing rule packs.

---

## License

MIT — see [LICENSE](LICENSE).
