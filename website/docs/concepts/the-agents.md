---
id: the-agents
title: The Agents
sidebar_position: 1
description: Requirements, Architecture, Audit, Sonar Scan, Code Generation, Impact Analysis, Test Coverage, Release, Operations, Code Review, Compliance — one shared foundation, eleven independent specialists across the full SDLC.
keywords:
  - agents
  - dca
  - requirements
  - architecture
  - audit
  - sonar
  - code generation
  - impact analysis
  - test coverage
  - release
  - operations
  - code review
  - compliance
---

Eleven independent AI coding agents, each with a deterministic Tier 1 (TypeScript) and an LLM-driven Tier 2, all funneled through one shared `@bmad/dca-shared` foundation so reports, changelog entries, git ops, and preflight look identical across the fleet.

:::note Full SDLC coverage — the roster is complete
The DCA suite ships **11 agents**, covering all 8 classic SDLC phases end to end: Requirements → Architecture → Pre-merge Review → Build/Test/Audit → Deploy → Operate → Maintenance → Governance/Compliance. This is the full roster delivered by the 4-phase SDLC-coverage roadmap — see [Roadmap](../roadmap).
:::

## At a glance

| Agent | Icon | Purpose | When to use | Primary CLI flags | Findings-cache output |
|-------|:-:|---------|-------------|-------------------|----------------------|
| **Requirements** | 📋 | Authors BRDs, epics, user stories, and acceptance criteria from a `--product-description`; parses and enriches existing BRDs. Emits Epic → Story → AC traceability. | New-feature discovery, brownfield BRD refresh, story-splitting workshops. | `--product-description <text>` · `--brd-in <file>` · `--brd-out <file>` · `--stories-count <n>` | `requirements-<hash>.json` |
| **Architecture** | 🏛️ | Authors ADRs (MADR), HLD/LLD, API contracts (OpenAPI 3.1 / GraphQL SDL), C4 + sequence diagrams (Mermaid), STRIDE threat models, and data models. | Design-phase decisions, HLD/LLD authoring, API contract-first, threat modeling. | `--design-question <text>` · `--design-in <file>` · `--adr <topic>` · `--openapi-in <file>` · `--artifacts <list>` | `architecture-<hash>.json` |
| **Audit** | 🔍 | Two-tier code auditor — tree-sitter AST + regex (Tier 1) then LLM deep semantic analysis (Tier 2). | PR gates, upgrade prep, legacy onboarding, quarterly health checks. | `--engine <stack>` · `--path <dir>` · `--platform <p>` (AEM) · `--format <t>` | `audit-<hash>.json` |
| **Sonar Scan** | 🛡️ | LLM SonarQube-style pass — Bugs / Vulnerabilities / Hotspots / Smells / Duplications / Complexity → A–E ratings + Quality Gate + Vulnerabilities sheet. | Pre-merge gates, security review, post-refactor validation. | `--ingest <sonar-findings.json>` · `--engine <stack>` | `sonar-scan-<hash>.json` |
| **Code Generation** | ⚡ | 24 deterministic scaffolders across 8 stacks + LLM/MCP path for anything the scaffolders don't cover. Zero-config MCP auto-provisioning for AEM. | Bootstrapping new modules, standardizing team output, prototype scaffolding. | `--scaffold` · `--engine <stack>` · `--type <t>` · `--name <str>` · `--setup` | `generation-<hash>.json` |
| **Impact Analysis** | 💥 | Input-driven reverse-dependency tracer over Proofhub bug CSV and/or BRD doc → impacted files + blast radius + risk score. | Sprint planning, release readiness, BRD-to-code traceability, regression scoping. | `--bugs <csv>` · `--brd <doc>` · `--engine <stack>` | `impact-analysis-<hash>.json` |
| **Test Coverage** | 🧪 | Deterministic gap analysis + real line/branch coverage (JaCoCo / Istanbul / Clover / LCOV) + framework-aware LLM test generation. | Baseline snapshot, real coverage on CI, test-generation sprint, pre-release gate. | `--mode <analyze\|generate\|full>` · `--coverage-report <file>` · `--run-coverage` | `test-coverage-<hash>.json` |
| **Release** | 🚀 | Authors CI/CD pipelines (6 platforms), release notes from git history, deploy plans, rollback plans, env-diffs, and multi-channel stakeholder announcements. | Release-day communications, pipeline bootstrap, rollout planning, env-drift audit, rollback drill prep. | `--pipeline <target>` · `--from-ref <ref>` · `--to-ref <ref>` · `--rollout <strategy>` · `--env <e>` · `--to-env <e>` · `--artifacts <list>` | `release-<hash>.json` |
| **Operations** | 📊 | Authors runbooks, observability dashboards (7 platforms), alert rules, SLO/SLI + error-budget policies, on-call rotations, incident playbooks, and blameless postmortems. | Runbook-per-symptom authoring, dashboard-as-code, SLO baseline, incident kickoff, postmortem authoring. | `--observability <platform>` · `--incident <symptom>` · `--service <name>` · `--service-tier <tier>` · `--postmortem-severity <sev>` · `--artifacts <list>` | `operations-<hash>.json` |
| **Code Review** | 📝 | Pre-merge PR/diff review — style-guide enforcement, breaking-change detection, dependency-change risk, design-pattern violations, and role-adapted merge checklists. Produces GitHub/GitLab-ready inline comments. | Fast, diff-scoped review before merge; complements Audit's post-hoc deep scan. | `--pr <n>` · `--diff <file>` · `--from-ref <ref>` · `--to-ref <ref>` · `--style-guide <name>` · `--review-depth <d>` · `--comment-format <f>` · `--fail-on-severity <sev>` | `code-review-<hash>.json` |
| **Compliance** | ⚖️ | Maps findings from every other DCA agent (via the shared findings cache) to 8 compliance frameworks (CWE, OWASP Top 10, CIS Controls, PCI-DSS, HIPAA, GDPR, SOX, ISO 27001). Produces control-mapping reports, audit-trail exports, attestations, and SLA remediation plans. | Auditor-ready reporting, control-gap analysis, remediation planning, sign-off attestations. | `--framework <fw>` · `--source-agent <agent>` · `--source-max-age-hours <n>` · `--audit-trail` · `--attestation-signer <name>` · `--remediation-sla` | `compliance-<hash>.json` |

Each agent's full command surface lives in its `SKILL.md`; the flags above are the ones you'll type most often.

## Architecture

```mermaid
flowchart TD
    subgraph Agents ["Eleven DCA agents (independent)"]
        direction LR
        Req["📋 Requirements"]
        Arch["🏛️ Architecture"]
        Audit["🔍 Audit"]
        Sonar["🛡️ Sonar Scan"]
        Gen["⚡ Code Generation"]
        Impact["💥 Impact Analysis"]
        Cov["🧪 Test Coverage"]
        Release["🚀 Release"]
        Ops["📊 Operations"]
        CodeReview["📝 Code Review"]
        Compliance["⚖️ Compliance"]
    end

    subgraph Shared ["@bmad/dca-shared foundation"]
        direction LR
        Report["report/ · output/"]
        Git["git/ (branch + CHANGE-LOG)"]
        Preflight["preflight/"]
        AST["ast/ + java/ js/ php/"]
        Coverage["coverage/ parsers"]
        Cache["findings/ (cross-agent cache)"]
        Role["role/"]
    end

    Req --> Shared
    Arch --> Shared
    Audit --> Shared
    Sonar --> Shared
    Gen --> Shared
    Impact --> Shared
    Cov --> Shared
    Release --> Shared
    Ops --> Shared
    CodeReview --> Shared
    Compliance --> Shared

    Shared --> Outputs["📊 XLSX + MD twin + CHANGE-LOG entry"]
```

Agents are **independent** — invoke any one on its own; there are no ordering dependencies. The canonical SDLC order (Requirements → Architecture → Generate → Audit → Sonar Scan → Test Coverage → Impact Analysis) is a convenience for chained workflows, not a requirement. See [Workflows → Chain All](../workflows/chain-all).

## Per-agent detail

### 📋 Requirements

**Authoring specialist** for the Discovery / Requirements SDLC phase. Turns a natural-language `--product-description` into a stack-native BRD, epics, INVEST-shaped user stories, and Gherkin acceptance criteria. Also parses and enriches existing BRDs (`.docx` / `.md` / `.txt`) via `--brd-in`. Emits an **Epic → Story → AC traceability matrix** as the standard workbook plus a rendered `BRD.md`.

Two modes: **Author** (from `--product-description`) and **Parse-and-enrich** (from `--brd-in`).

Full detail: **[Requirements agent](../agents/requirements)**.

### 🏛️ Architecture

**Design-authoring specialist** for the Design SDLC phase. Turns a `--design-question` (or `--adr` topic) into ADRs (MADR 3.0), HLD / LLD, API contracts (OpenAPI 3.1 / GraphQL SDL), C4 + sequence diagrams (Mermaid), STRIDE threat models, and data models. Also parses and enriches existing designs (`--design-in` for `.md`, `--openapi-in` for `.yaml` / `.json`). Grounded in per-stack Adobe / JVM idioms across all 8 supported stacks.

Two modes: **Author** (from `--design-question`) and **Parse-and-enrich** (from `--design-in` / `--openapi-in`).

Full detail: **[Architecture agent](../agents/architecture)**.

### 🔍 Audit

**Tier 1** is a deterministic TypeScript scanner (tree-sitter AST + regex, zero LLM tokens) across all 8 stacks. **Tier 2** is LLM-driven deep semantic analysis using per-stack rule packs. The old standalone `scan-agent` was retired — its Tier-1 pass now lives here as the **Scan Only** action (menu code `SC`).

Standardized output plus, for legacy engines (AEM, Commerce, EDS, EDS+Commerce), an additional platform-specific multi-sheet workbook.

Full flags, trigger phrases, and workflows: **[Audit agent](../agents/audit)**.

### 🛡️ Sonar Scan

LLM-driven SonarQube-style code quality — **no SonarQube server or binary required**. Covers all 6 Sonar pillars, produces **A–E** ratings for Reliability / Security / Maintainability, and a pass/fail **Quality Gate**.

Intentionally **two-step**:

1. **Scan (LLM)** — writes `sonar-findings.json` to `sonar_output`.
2. **Ingest (deterministic)** — `run.ts --ingest sonar-findings.json` computes ratings + Quality Gate and emits the standardized workbook plus a dedicated color-coded **Vulnerabilities** sheet.

Full detail: **[Sonar Scan agent](../agents/sonar-scan)**.

### ⚡ Code Generation

**Tier 1** = 24 correct-by-construction scaffolders across the 8 stacks. **Tier 2** = LLM/MCP path for anything the scaffolders don't cover, with zero-config MCP auto-provisioning for AEM (`--setup` writes `.mcp.json`, `.bmad/mcp-registry.toml`, `.env`, `.gitignore`).

Deterministic scaffolder counts per stack: AEM (5), Sling (4), Spring (3), Commerce PaaS (5), Commerce SaaS (2), App Builder (3), EDS (1), EDS+Commerce (1).

Full detail: **[Code Generation agent](../agents/code-generation)**.

### 💥 Impact Analysis

**Input-driven** blast-radius tracer. Give it a Proofhub CSV (`--bugs`) and/or a BRD document (`--brd` — `.docx` / `.md` / `.txt`). It extracts symbols/paths, scores files, walks reverse dependencies, and emits an **Input Traceability** report where every input item (bug or requirement) appears as a row — items with no code match become an INFO row flagged for manual review.

At least one input (`--bugs` or `--brd`) is required.

Full detail: **[Impact Analysis agent](../agents/impact-analysis)**.

### 🧪 Test Coverage

**Tier 1** = deterministic gap analysis (which files/classes/functions have no test) + optional **real** line/branch coverage from JaCoCo XML, Istanbul JSON, Clover XML, or LCOV. **Tier 2** = LLM-driven test generation to close the gaps toward 100%, per framework (JUnit + AEM/Sling Mocks, Spring Test + MockMvc + Testcontainers, PHPUnit + MFTF, Jest + jsdom).

Modes: `analyze` (gap-only), `generate` (Tier 2), `full` (both).

Full detail: **[Test Coverage agent](../agents/test-coverage)**.

### 🚀 Release

**Release-authoring specialist** for the Deploy/Release SDLC phase. Authors CI/CD pipelines for 6 platforms (Cloud Manager, GitHub Actions, GitLab CI, CircleCI, Jenkins, Azure DevOps), release notes from git history (Conventional Commits / Keep-a-Changelog / narrative), deploy plans phased against a rollout strategy (canary / blue-green / rolling / feature-flag / bigbang), rollback playbooks, env-diffs, and multi-channel stakeholder announcements (email / Slack / Confluence / Twitter+LinkedIn). Grounded in per-stack Adobe/JVM deploy idioms.

Full detail: **[Release agent](../agents/release)**.

### 📊 Operations

**Operations-authoring specialist** for the Ops / Monitoring SDLC phase. Authors runbooks per incident symptom, observability dashboards as code for 7 platforms (Datadog, New Relic, Grafana, Prometheus, Elastic, CloudWatch, Dynatrace), alert rules, SLO/SLI definitions with error-budget policies keyed to `--service-tier`, on-call rotation configs (PagerDuty-compatible), STRIDE-informed incident-response playbooks, and blameless postmortems.

Full detail: **[Operations agent](../agents/operations)**.

### 📝 Code Review

**Pre-merge review specialist** for the deeper end of the Pre-merge Review SDLC phase, complementing [Audit](../agents/audit)'s post-hoc deep scan. Reviews a diff/PR **before it merges**: style-guide enforcement, breaking-change detection with migration guidance, dependency-change risk (license + known-CVE + transitive-impact), design-pattern violation reports, and role-adapted merge checklists. Produces GitHub/GitLab-ready inline comments (file:line-anchored, severity-tagged, with a suggested fix).

Scoped by `--pr`, `--diff`, or `--from-ref` / `--to-ref`; `--fail-on-severity` exits non-zero (exit code 7) for CI gating.

Full detail: **[Code Review agent](../agents/code-review)**.

### ⚖️ Compliance

**Governance & Compliance specialist** closing the final SDLC phase — Governance / Compliance. Unique among the 11 agents: it does not scan code itself. It reads findings that other agents already produced from the shared [Findings Cache](findings-cache) (`audit`, `sonar-scan`, `test-coverage`, `impact-analysis`, `code-review`) and maps them against 8 compliance-framework control catalogs: CWE, OWASP Top 10, CIS Controls, PCI-DSS, HIPAA, GDPR, SOX, ISO 27001.

Produces a control-mapping report, an audit-trail export, an auditor cover letter, an SLA-bound remediation plan, and a sign-off attestation. Human legal/compliance review is required before any artifact goes to an auditor or regulator.

Full detail: **[Compliance agent](../agents/compliance)**.

## Cross-agent chaining

Every successful agent run writes a `<agent>-<hash>.json` cache entry to `<projectRoot>/.bmad/cache/`. Downstream agents consume these silently for enrichment:

- **Impact Analysis** — reads the latest Audit cache to boost priority for files with existing CRITICAL findings.
- **Test Coverage** — reads the latest Audit cache to enrich coverage gaps with severity context.
- **Sonar Scan** — reads the latest Audit cache to include delta context in the Quality Gate rationale.
- **Compliance** — reads the latest cache from Audit, Sonar Scan, Test Coverage, Impact Analysis, and Code Review to build its control-mapping report.

See [Findings Cache](findings-cache).

## Shared foundation

The `@bmad/dca-shared` subdirectories every agent depends on:

| Subdir | Responsibility |
|--------|----------------|
| `report/` | `StandardExcelReport` — fixed sheet order, 15-column Summary contract. |
| `output/` | `emitStandardOutputs()` — writes xlsx + md twin + CHANGE-LOG entry + optional branch cut. |
| `git/` | Branch/timestamp helpers, `CHANGE-LOG.md` writer, `maybeCutStandardBranch`. |
| `preflight/` | Model + context-window detection, project sizing, STATIC / HYBRID / LLM recommendation. |
| `ast/` | web-tree-sitter (WASM) harness — no native build required. |
| `java/` · `js/` · `php/` | Per-language rule libraries shared by every engine that speaks that language. |
| `coverage/` | JaCoCo / Istanbul / Clover / LCOV parsers + report discovery + opt-in runner. |
| `core/` | Shared types (`Finding`, `Severity`, `Confidence`, …). |
| `role/` | Role catalog + persistence at `.bmad/role.yaml`. |
| `interactive/` | Q&A prompter + intake-mode persistence at `.bmad/intake.yaml`. |
| `findings/` | Cross-agent findings cache. |
| `token-budget/` | Token accounting for LLM handoffs. |

## Next

- [The 8 Stacks](the-8-stacks)
- [Standardized Outputs](standardized-outputs)
- Individual agent deep-dives: [Requirements](../agents/requirements) · [Architecture](../agents/architecture) · [Audit](../agents/audit) · [Sonar Scan](../agents/sonar-scan) · [Code Generation](../agents/code-generation) · [Impact Analysis](../agents/impact-analysis) · [Test Coverage](../agents/test-coverage) · [Release](../agents/release) · [Operations](../agents/operations) · [Code Review](../agents/code-review) · [Compliance](../agents/compliance).
