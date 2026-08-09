# BMAD DCA Prompt Catalog

> This file is a **pointer**. The full 480+ prompt catalog now lives on the Docusaurus site, organized per agent for easier browsing.

**Source of truth:** [mayur434.github.io/bmad-dept-coding-agents](https://mayur434.github.io/bmad-dept-coding-agents)

---

## Per-agent prompt catalogs

| Agent | Docusaurus page |
|-------|-----------------|
| Requirements | [Reference → Prompts → Requirements](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/requirements) |
| Architecture | [Reference → Prompts → Architecture](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/architecture) |
| Audit | [Reference → Prompts → Audit](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/audit) |
| Sonar Scan | [Reference → Prompts → Sonar Scan](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/sonar-scan) |
| Code Generation | [Reference → Prompts → Code Generation](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/code-generation) |
| Impact Analysis | [Reference → Prompts → Impact Analysis](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/impact-analysis) |
| Test Coverage | [Reference → Prompts → Test Coverage](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/test-coverage) |
| Release | [Reference → Prompts → Release](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/release) |
| Operations | [Reference → Prompts → Operations](https://mayur434.github.io/bmad-dept-coding-agents/reference/prompts/operations) |

## Chained / multi-agent prompts

For chained SDLC workflows (Audit → Sonar → Test Coverage → Impact, etc.), including per-role variants:

- [Workflows → chain-all](https://mayur434.github.io/bmad-dept-coding-agents/workflows/chain-all)
- [Workflows → Per-Role Recipes](https://mayur434.github.io/bmad-dept-coding-agents/workflows/per-role-recipes)
- [Workflows → CI Integration](https://mayur434.github.io/bmad-dept-coding-agents/workflows/ci-integration)

## Quick-paste starter set

If you just want to try the plugin without visiting the docs:

```text
audit my project
sonar scan my project
generate a Sling Model for the Article component
analyze test coverage
trace the impact of these bugs: ./bugs.csv
```

Every block above is a ready-to-paste message for your AI coding tool's chat — the agent parses natural language and resolves flags, paths, and engine automatically.
