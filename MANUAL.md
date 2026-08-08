# BMAD DEPT Code Agent — Consumption Manual

> This file is a **pointer**. Full consumption docs live on the Docusaurus site: **[mayur434.github.io/bmad-dept-coding-agents](https://mayur434.github.io/bmad-dept-coding-agents)** — that's the source of truth. Only two things stay in this file: (1) the doc map below, so `grep` inside the repo still finds every topic, and (2) the manual install fallback for CI / air-gapped environments, which is copy-paste friendly.

---

## Doc map

| What you're looking for | Docusaurus page |
|-------------------------|-----------------|
| Prerequisites (Node version, git, AI tool support) | [Getting Started → Prerequisites](https://mayur434.github.io/bmad-dept-coding-agents/getting-started/prerequisites) |
| Install (per AI coding tool — 44+ supported) | [Getting Started → Install](https://mayur434.github.io/bmad-dept-coding-agents/getting-started/install) |
| First-run experience (auto-install prompt, role handshake, first report) | [Getting Started → First Run](https://mayur434.github.io/bmad-dept-coding-agents/getting-started/first-run) |
| 5-minute smoke test | [Getting Started → Quick Start](https://mayur434.github.io/bmad-dept-coding-agents/getting-started/quick-start) |
| Auto-install mechanics (`--yes-install`, `--no-install`, exit codes) | [Concepts → Auto-Install](https://mayur434.github.io/bmad-dept-coding-agents/concepts/auto-install) |
| Interactive vs technical CLI paths | [Concepts → Interactive vs Technical](https://mayur434.github.io/bmad-dept-coding-agents/concepts/interactive-vs-technical) |
| Standardized outputs contract (XLSX + MD twin + CHANGE-LOG + branch cut) | [Concepts → Standardized Outputs](https://mayur434.github.io/bmad-dept-coding-agents/concepts/standardized-outputs) |
| Role adaptation (10 roles, 5 output flavors, per-agent behavior) | [Concepts → Role Adaptation](https://mayur434.github.io/bmad-dept-coding-agents/concepts/role-adaptation) |
| The 5 agents (Audit / Sonar / Generation / Impact / Test Coverage) | [Concepts → The 5 Agents](https://mayur434.github.io/bmad-dept-coding-agents/concepts/the-5-agents) |
| The 8 stacks (engine IDs, aliases, auto-detection order) | [Concepts → The 8 Stacks](https://mayur434.github.io/bmad-dept-coding-agents/concepts/the-8-stacks) |
| Findings cache (cross-agent correlation) | [Concepts → Findings Cache](https://mayur434.github.io/bmad-dept-coding-agents/concepts/findings-cache) |
| Findings gate (accepted/deferred/wontfix decisions) | [Concepts → Findings Gate](https://mayur434.github.io/bmad-dept-coding-agents/concepts/findings-gate) |
| SLA tracking (role x severity, overdue detection) | [Concepts → SLA Tracking](https://mayur434.github.io/bmad-dept-coding-agents/concepts/sla-tracking) |
| One-shot mode (enterprise granular-prompt UX) | [Concepts → One-Shot Mode](https://mayur434.github.io/bmad-dept-coding-agents/concepts/one-shot-mode) |
| Per-agent usage guide (Audit) | [Agents → Audit](https://mayur434.github.io/bmad-dept-coding-agents/agents/audit) |
| Per-agent usage guide (Sonar Scan) | [Agents → Sonar Scan](https://mayur434.github.io/bmad-dept-coding-agents/agents/sonar-scan) |
| Per-agent usage guide (Code Generation) | [Agents → Code Generation](https://mayur434.github.io/bmad-dept-coding-agents/agents/code-generation) |
| Per-agent usage guide (Impact Analysis) | [Agents → Impact Analysis](https://mayur434.github.io/bmad-dept-coding-agents/agents/impact-analysis) |
| Per-agent usage guide (Test Coverage) | [Agents → Test Coverage](https://mayur434.github.io/bmad-dept-coding-agents/agents/test-coverage) |
| Multi-agent workflows (chain-all) | [Workflows → chain-all](https://mayur434.github.io/bmad-dept-coding-agents/workflows/chain-all) |
| CI integration | [Workflows → CI Integration](https://mayur434.github.io/bmad-dept-coding-agents/workflows/ci-integration) |
| Per-role recipes | [Workflows → Per-Role Recipes](https://mayur434.github.io/bmad-dept-coding-agents/workflows/per-role-recipes) |
| Full CLI flag reference | [Reference → CLI Flags](https://mayur434.github.io/bmad-dept-coding-agents/reference/cli-flags) |
| Module config variables (`--set dca.<key>=<value>`) | [Reference → Config Vars](https://mayur434.github.io/bmad-dept-coding-agents/reference/config-vars) |
| Rule packs (per-stack catalog) | [Reference → Rule Packs](https://mayur434.github.io/bmad-dept-coding-agents/reference/rule-packs/aem) |
| Scoring model (severity / confidence / rating vocabulary) | [Reference → Scoring Model](https://mayur434.github.io/bmad-dept-coding-agents/reference/scoring-model) |
| Prompt catalog (copy-paste, per agent) | [Reference → Prompts](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/audit) |
| Troubleshooting (common failure modes) | [Troubleshooting](https://mayur434.github.io/bmad-dept-coding-agents/troubleshooting) |
| Contributing — author a new skill | [Contributing → Authoring a New Skill](https://mayur434.github.io/bmad-dept-coding-agents/contributing/authoring-a-new-skill) |
| Contributing — add a new engine | [Contributing → Adding a New Engine](https://mayur434.github.io/bmad-dept-coding-agents/contributing/adding-a-new-engine) |
| Contributing — write rule packs | [Contributing → Writing Rule Packs](https://mayur434.github.io/bmad-dept-coding-agents/contributing/writing-rule-packs) |
| Roadmap (delivered + open enhancements) | [Roadmap](https://mayur434.github.io/bmad-dept-coding-agents/roadmap) |
| Changelog | [Changelog](https://mayur434.github.io/bmad-dept-coding-agents/changelog) |

---

## Manual fallback (CI / headless / air-gapped)

The first agent invocation normally installs deps behind an interactive Y/N prompt. In CI without a TTY, in air-gapped environments where you'll pre-populate `node_modules`, or when the prompt confuses your automation, run these six commands yourself — `shared/` FIRST, then each agent whose `scripts/` you plan to use:

```bash
# 1. shared foundation (required by every agent)
cd .claude/skills/shared && npm install

# 2. each agent you plan to use (skip any you won't)
cd .claude/skills/bmad-dept-code-audit-agent/scripts           && npm install
cd .claude/skills/bmad-dept-code-sonar-scan-agent/scripts      && npm install
cd .claude/skills/bmad-dept-code-generation-agent/scripts      && npm install
cd .claude/skills/bmad-dept-code-impact-analysis-agent/scripts && npm install
cd .claude/skills/bmad-dept-code-test-coverage-agent/scripts   && npm install
```

For non-Claude hosts, substitute `.claude/skills/` with your tool's install path (`.agents/skills/` for Cursor / Copilot / Codex / most tools; `.cline/skills/`, `.kiro/skills/`, `.junie/skills/`, `.zencoder/skills/`, etc. for tools that isolate). Full per-tool table: [Getting Started → Install](https://mayur434.github.io/bmad-dept-coding-agents/getting-started/install).

---

## Version + support

| Item | Value |
|------|-------|
| Module version | **4.0.0** ([`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)) |
| Module code | `dca` |
| License | [MIT](LICENSE) |
| Report bugs | [github.com/mayur434/bmad-dept-coding-agents/issues](https://github.com/mayur434/bmad-dept-coding-agents/issues) |
| Homepage / source | [github.com/mayur434/bmad-dept-coding-agents](https://github.com/mayur434/bmad-dept-coding-agents) |
| Full docs | [mayur434.github.io/bmad-dept-coding-agents](https://mayur434.github.io/bmad-dept-coding-agents) |
