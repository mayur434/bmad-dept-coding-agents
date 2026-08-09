---
id: intro
title: Overview
sidebar_position: 1
description: A nine-agent AI suite (module code dca) for Adobe platform + JVM SDLC — one standardized report shape across 8 stacks.
keywords:
  - bmad
  - dca
  - adobe commerce
  - aem
  - sonar
  - code audit
  - requirements
  - architecture
  - release
  - operations
  - ai coding agents
  - docusaurus
---

**BMAD DEPT Code Agent** (module code `dca`) is a nine-agent AI suite for Adobe platform and JVM middleware SDLC. Every agent works standalone; every run emits the same three artifacts.

## TL;DR

- **Nine specialist agents** — Requirements, Architecture, Audit, Sonar Scan, Code Generation, Impact Analysis, Test Coverage, Release, Operations — installed into your project via `npx bmad-method install`.
- **Eight tech stacks covered** — AEMaaCS + AMS, Commerce PaaS + SaaS, App Builder, Sling/Shaft, Spring Boot, EDS, EDS + Commerce.
- **One standardized report** — every run of every agent writes the same XLSX + Markdown twin + `CHANGE-LOG.md` entry.
- **Tool-agnostic** — works with Claude Code (reference host), Cursor, GitHub Copilot, Codex, Cline, Windsurf, Gemini CLI, Kiro, Junie, and 30+ more BMAD-supported AI coding tools.

## What is BMAD?

[BMAD Method](https://github.com/bmadcode/bmad-method) is a modular AI-agent framework that lets you compose specialized skills into any AI coding tool. Each module ships as a collection of skills — `SKILL.md` (AI instructions), `GUIDE.md` (human docs), `customize.toml` (activation), and optional TypeScript engines under `scripts/`. Modules install into your project with a single CLI command and extend your agent with domain-specific knowledge, scripts, and workflows.

## What is DCA?

DCA (**D**ept **C**ode **A**gents) is a custom BMAD module that ships nine independent AI coding agents for Adobe platform + JVM middleware projects. Each agent runs on its own — no orchestration required — but they share one runtime foundation (`@bmad/dca-shared`) so every report, changelog entry, and branch cut looks identical across the fleet. All nine agents share the same 8 engine stacks.

## Coverage matrix

Every agent supports every stack. All 72 cells (9 × 8) are delivered.

| Agent | Commerce PaaS | Commerce SaaS | AEM (aaCS + AMS) | Sling / Shaft | Spring Boot | App Builder | EDS | EDS + Commerce |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Requirements** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Architecture** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Audit** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Sonar Scan** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Code Generation** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Impact Analysis** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Test Coverage** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Release** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Operations** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## The 9 agents at a glance

| Icon | Agent | Tier 1 (deterministic TS) | Tier 2 (LLM) |
|:-:|-------|--------------------------|--------------|
| 📋 | [Requirements](agents/requirements) | Standardized BRD/story/AC template rendering + Epic → Story → AC traceability workbook | Authors BRD, epics, INVEST-shaped user stories, Gherkin AC from `--product-description`; parses + enriches existing BRDs |
| 🏛️ | [Architecture](agents/architecture) | MADR/HLD/LLD/OpenAPI template rendering + Mermaid C4/sequence emission | Authors ADRs, HLD/LLD, API contracts, STRIDE threat models, data models from `--design-question`; parses + enriches existing designs |
| 🔍 | [Audit](agents/audit) | tree-sitter AST + regex scan (8 engines); Scan-Only mode | Architecture / data-flow / business-logic deep analysis via per-stack rule packs |
| 🛡️ | [Sonar Scan](agents/sonar-scan) | Ingests LLM findings via `--ingest sonar-findings.json` | Sonar-style: Bugs, Vulnerabilities, Hotspots, Smells, Duplications, Complexity → A–E ratings + Quality Gate |
| ⚡ | [Code Generation](agents/code-generation) | 24 correct-by-construction scaffolders across 8 stacks + zero-config MCP for AEM | LLM/MCP path for anything the scaffolders don't cover |
| 💥 | [Impact Analysis](agents/impact-analysis) | Input-driven tracer over `--bugs` (Proofhub CSV) and/or `--brd` (docx/md/txt) | Risk assessment + blast-radius interpretation |
| 🧪 | [Test Coverage](agents/test-coverage) | Gap detection + real coverage from JaCoCo / Istanbul / Clover / LCOV | Framework-aware test generation to 100% |
| 🚀 | [Release](agents/release) | Pipeline / release-notes / deploy / rollback / env-diff / announcement template rendering; git-history parsing between `--from-ref` and `--to-ref` | Authors CI/CD pipelines for 6 platforms, release notes, deploy + rollback plans, env-diffs, and multi-channel announcements from `--pipeline` / `--rollout` / `--artifacts` |
| 📊 | [Operations](agents/operations) | Runbook / dashboard / alert / SLO / oncall / playbook / postmortem template rendering across 7 observability platforms | Authors incident runbooks, dashboards-as-code, alert rules, SLO/SLI + error-budget policies, on-call configs, incident playbooks (STRIDE-informed), and blameless postmortems |

Each agent's `SKILL.md` documents its full command surface.

## What every run produces

Every agent, every stack — through one shared `emitStandardOutputs()` — writes:

1. **`<agent>-<branch>-<timestamp>-agent-report.xlsx`** — fixed sheet order (Run Info · Summary · Severity Breakdown · By Category · optional Recommendations · optional Input Traceability), 15-column Summary contract.
2. **`<agent>-<branch>-<timestamp>-agent-report.md`** — git-diffable Markdown twin (reduced 9-column Summary).
3. **`CHANGE-LOG.md`** — one Keep-a-Changelog entry per run, spliced newest-first after the `<!-- dca:entries -->` marker.

Opt-in: `--create-branch` cuts `dca/<agent>-<stack>-<YYYYMMDD_HHMMSS>` from the first existing of `production → main → master → develop` (override with `--source-branch`). See [Standardized Outputs](concepts/standardized-outputs).

## Adapts to your role

Every agent tunes its default mode, output flavor, and recommended follow-up to the **role** of the person driving the run — from Enterprise Architect (executive Markdown) to DevOps (SARIF for CI gates) to Senior Delivery Engineer (Jira-ready CSV). Ten roles are supported plus a `generic` fallback. See [Role Adaptation](concepts/role-adaptation).

## Where to next?

- **[Getting Started → Prerequisites](getting-started/prerequisites)** — Node 20.12+, Git, and one of 44+ supported AI coding tools.
- **[Getting Started → Install](getting-started/install)** — `npx bmad-method install` with the tool-specific flag.
- **[Getting Started → Quick Start](getting-started/quick-start)** — a 5-minute smoke test that touches the core agents.
- **[Concepts → The Agents](concepts/the-agents)** — deeper detail on each agent.
- **[Concepts → The 8 Stacks](concepts/the-8-stacks)** — engine IDs, aliases, auto-detection.
- **[Concepts → Standardized Outputs](concepts/standardized-outputs)** — the 15-column contract.
- **Individual agent pages** — [Requirements](agents/requirements) · [Architecture](agents/architecture) · [Audit](agents/audit) · [Sonar Scan](agents/sonar-scan) · [Code Generation](agents/code-generation) · [Impact Analysis](agents/impact-analysis) · [Test Coverage](agents/test-coverage) · [Release](agents/release) · [Operations](agents/operations).
