# BMAD DEPT Code Agent — Consumption Manual

> This file is a **pointer**. Full consumption docs live on the Docusaurus site: **[mayur434.github.io/bmad-dept-code-agent](https://mayur434.github.io/bmad-dept-code-agent)** — that's the source of truth. Only two things stay in this file: (1) the doc map below, so `grep` inside the repo still finds every topic, and (2) the manual install fallback for CI / air-gapped environments, which is copy-paste friendly.

---

## Doc map

| What you're looking for | Docusaurus page |
|-------------------------|-----------------|
| Prerequisites (Node version, git, AI tool support) | [Getting Started → Prerequisites](https://mayur434.github.io/bmad-dept-code-agent/getting-started/prerequisites) |
| Install (per AI coding tool — 44+ supported) | [Getting Started → Install](https://mayur434.github.io/bmad-dept-code-agent/getting-started/install) |
| First-run experience (auto-install prompt, role handshake, first report) | [Getting Started → First Run](https://mayur434.github.io/bmad-dept-code-agent/getting-started/first-run) |
| 5-minute smoke test | [Getting Started → Quick Start](https://mayur434.github.io/bmad-dept-code-agent/getting-started/quick-start) |
| Auto-install mechanics (`--yes-install`, `--no-install`, exit codes) | [Concepts → Auto-Install](https://mayur434.github.io/bmad-dept-code-agent/concepts/auto-install) |
| Interactive vs technical CLI paths | [Concepts → Interactive vs Technical](https://mayur434.github.io/bmad-dept-code-agent/concepts/interactive-vs-technical) |
| Standardized outputs contract (XLSX + MD twin + CHANGE-LOG + branch cut) | [Concepts → Standardized Outputs](https://mayur434.github.io/bmad-dept-code-agent/concepts/standardized-outputs) |
| Role adaptation (10 roles, 5 output flavors, per-agent behavior) | [Concepts → Role Adaptation](https://mayur434.github.io/bmad-dept-code-agent/concepts/role-adaptation) |
| The 5 agents (Audit / Sonar / Generation / Impact / Test Coverage) | [Concepts → The 5 Agents](https://mayur434.github.io/bmad-dept-code-agent/concepts/the-5-agents) |
| The 8 stacks (engine IDs, aliases, auto-detection order) | [Concepts → The 8 Stacks](https://mayur434.github.io/bmad-dept-code-agent/concepts/the-8-stacks) |
| Findings cache (cross-agent correlation) | [Concepts → Findings Cache](https://mayur434.github.io/bmad-dept-code-agent/concepts/findings-cache) |
| Per-agent usage guide (Audit) | [Agents → Audit](https://mayur434.github.io/bmad-dept-code-agent/agents/audit) |
| Per-agent usage guide (Sonar Scan) | [Agents → Sonar Scan](https://mayur434.github.io/bmad-dept-code-agent/agents/sonar-scan) |
| Per-agent usage guide (Code Generation) | [Agents → Code Generation](https://mayur434.github.io/bmad-dept-code-agent/agents/code-generation) |
| Per-agent usage guide (Impact Analysis) | [Agents → Impact Analysis](https://mayur434.github.io/bmad-dept-code-agent/agents/impact-analysis) |
| Per-agent usage guide (Test Coverage) | [Agents → Test Coverage](https://mayur434.github.io/bmad-dept-code-agent/agents/test-coverage) |
| Multi-agent workflows (chain-all) | [Workflows → chain-all](https://mayur434.github.io/bmad-dept-code-agent/workflows/chain-all) |
| CI integration | [Workflows → CI Integration](https://mayur434.github.io/bmad-dept-code-agent/workflows/ci-integration) |
| Per-role recipes | [Workflows → Per-Role Recipes](https://mayur434.github.io/bmad-dept-code-agent/workflows/per-role-recipes) |
| Full CLI flag reference | [Reference → CLI Flags](https://mayur434.github.io/bmad-dept-code-agent/reference/cli-flags) |
| Module config variables (`--set dca.<key>=<value>`) | [Reference → Config Vars](https://mayur434.github.io/bmad-dept-code-agent/reference/config-vars) |
| Rule packs (per-stack catalog) | [Reference → Rule Packs](https://mayur434.github.io/bmad-dept-code-agent/reference/rule-packs/aem) |
| Scoring model (severity / confidence / rating vocabulary) | [Reference → Scoring Model](https://mayur434.github.io/bmad-dept-code-agent/reference/scoring-model) |
| Prompt catalog (copy-paste, per agent) | [Reference → Prompts](https://mayur434.github.io/bmad-dept-code-agent/reference/prompts/audit) |
| Troubleshooting (common failure modes) | [Troubleshooting](https://mayur434.github.io/bmad-dept-code-agent/troubleshooting) |
| Contributing — author a new skill | [Contributing → Authoring a New Skill](https://mayur434.github.io/bmad-dept-code-agent/contributing/authoring-a-new-skill) |
| Contributing — add a new engine | [Contributing → Adding a New Engine](https://mayur434.github.io/bmad-dept-code-agent/contributing/adding-a-new-engine) |
| Contributing — write rule packs | [Contributing → Writing Rule Packs](https://mayur434.github.io/bmad-dept-code-agent/contributing/writing-rule-packs) |
| Roadmap (delivered + open enhancements) | [Roadmap](https://mayur434.github.io/bmad-dept-code-agent/roadmap) |
| Changelog | [Changelog](https://mayur434.github.io/bmad-dept-code-agent/changelog) |

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

For non-Claude hosts, substitute `.claude/skills/` with your tool's install path (`.agents/skills/` for Cursor / Copilot / Codex / most tools; `.cline/skills/`, `.kiro/skills/`, `.junie/skills/`, `.zencoder/skills/`, etc. for tools that isolate). Full per-tool table: [Getting Started → Install](https://mayur434.github.io/bmad-dept-code-agent/getting-started/install).

---

## Version + support

| Item | Value |
|------|-------|
| Module version | **4.0.0** ([`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)) |
| Module code | `dca` |
| License | [MIT](LICENSE) |
| Report bugs | [github.com/mayur434/bmad-dept-code-agent/issues](https://github.com/mayur434/bmad-dept-code-agent/issues) |
| Homepage / source | [github.com/mayur434/bmad-dept-code-agent](https://github.com/mayur434/bmad-dept-code-agent) |
| Full docs | [mayur434.github.io/bmad-dept-code-agent](https://mayur434.github.io/bmad-dept-code-agent) |
