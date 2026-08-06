# BMAD DCA Prompt Catalog

> This file is a **pointer**. The full 480+ prompt catalog now lives on the Docusaurus site, organized per agent for easier browsing.

**Source of truth:** [mayur434.github.io/bmad-dept-code-agent](https://mayur434.github.io/bmad-dept-code-agent)

---

## Per-agent prompt catalogs

| Agent | Docusaurus page |
|-------|-----------------|
| Audit | [Reference → Prompts → Audit](https://mayur434.github.io/bmad-dept-code-agent/reference/prompts/audit) |
| Sonar Scan | [Reference → Prompts → Sonar Scan](https://mayur434.github.io/bmad-dept-code-agent/reference/prompts/sonar-scan) |
| Code Generation | [Reference → Prompts → Code Generation](https://mayur434.github.io/bmad-dept-code-agent/reference/prompts/code-generation) |
| Impact Analysis | [Reference → Prompts → Impact Analysis](https://mayur434.github.io/bmad-dept-code-agent/reference/prompts/impact-analysis) |
| Test Coverage | [Reference → Prompts → Test Coverage](https://mayur434.github.io/bmad-dept-code-agent/reference/prompts/test-coverage) |

## Chained / multi-agent prompts

For chained SDLC workflows (Audit → Sonar → Test Coverage → Impact, etc.), including per-role variants:

- [Workflows → chain-all](https://mayur434.github.io/bmad-dept-code-agent/workflows/chain-all)
- [Workflows → Per-Role Recipes](https://mayur434.github.io/bmad-dept-code-agent/workflows/per-role-recipes)
- [Workflows → CI Integration](https://mayur434.github.io/bmad-dept-code-agent/workflows/ci-integration)

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
