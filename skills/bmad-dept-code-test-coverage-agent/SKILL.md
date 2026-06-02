---
name: bmad-dept-code-test-coverage-agent
description: "Two-tier test coverage agent (part of BMAD DEPT Code Agent suite). Tier 1: deterministic TypeScript/Node.js coverage analysis (gap detection, dependency mapping, coverage report). Tier 2: LLM-driven test generation producing platform-specific unit, integration, and functional tests."
---

# BMAD DEPT Code Agent — Test Coverage Skill

## Purpose

Two-tier test coverage system for enterprise projects including Adobe Commerce (Magento), AEM as a Cloud Service (AEMaaCS), Edge Delivery Services (EDS), and EDS+Commerce hybrid implementations.

### Tier 1 — Deterministic Coverage Analysis (TypeScript/Node.js)

Fast, reproducible analysis using `scripts/run.ts`. Produces a coverage report with:
- Testable unit inventory (classes, methods, functions, templates)
- Existing test mapping (which source files have tests, which don't)
- Coverage gap identification (untested public methods, critical paths without coverage)
- 6-factor priority scoring (complexity, revenue path, plugin/observer, public API, git churn, fan-in)
- Platform-specific test pattern detection across 7 framework types
- Multi-strategy detection (filename, namespace, annotation — or combined)
- Interactive mode for guided framework/strategy selection

**Invocation:**
```bash
npx ts-node scripts/run.ts --mode analyze --path <PROJECT_ROOT>
npx ts-node scripts/run.ts --mode analyze --path <PROJECT_ROOT> --frameworks unit,mftf,api-functional
npx ts-node scripts/run.ts --interactive --path <PROJECT_ROOT>
```

### Tier 2 — LLM Test Generation

AI-driven test creation using platform patterns and project conventions:
- Generates unit tests following existing project test style
- Creates integration tests for cross-module interactions
- Produces functional/API tests for endpoints and services
- Mocks dependencies following platform best practices
- Validates generated tests compile and follow naming conventions

**Invocation:** Activated via BMAD skill workflow (coverage gaps → test generation)

## Activation

This skill activates when the user asks to:
- Analyze test coverage
- Find missing tests or coverage gaps
- Generate unit/integration/functional tests
- Create a test plan
- Improve test coverage for a module or class
- Show untested code
- Produce a coverage report
- Generate tests for specific files or components

## Pre-flight: Auto-install Dependencies

Before ANY command execution, silently run:
```bash
cd {skill_path}/scripts && [ -d node_modules ] || npm install --silent
```
Do NOT ask the user. Do NOT print install output unless it fails.

## Workflow

### Mode: Analyze (Tier 1 only)

1. Run `npx ts-node scripts/run.ts --mode analyze --path <PROJECT_ROOT> [--engine <ENGINE>]`
2. Engine auto-detects platform if not specified
3. Scanner inventories source files and maps existing tests
4. Outputs coverage gap report (Excel + JSON summary)

### Mode: Generate (Tier 2 only)

1. Read coverage gaps from prior analysis (or run Tier 1 first)
2. For each priority gap:
   a. Read the source file
   b. Identify testable units (public methods, API contracts)
   c. Check project test conventions (framework, naming, directory structure)
   d. Generate test file following platform patterns
   e. Validate generated code compiles
3. Output: generated test files placed in correct directories

### Mode: Full (Tier 1 + Tier 2)

1. Run Tier 1 analysis to identify gaps
2. Present top-priority gaps to user for confirmation
3. Generate tests for confirmed gaps (Tier 2)
4. Summary report: what was generated, where placed, remaining gaps

## Platform-Specific Behavior

### Adobe Commerce (Magento 2)
- **7 testing frameworks supported:**
  - `unit` — PHPUnit unit tests (`app/code/**/Test/Unit/`)
  - `integration` — PHPUnit integration tests (`dev/tests/integration/`)
  - `mftf` — Magento Functional Testing Framework (XML-based E2E)
  - `api-functional` — REST & GraphQL endpoint tests (`dev/tests/api-functional/`)
  - `js` — JavaScript tests via Jasmine/Jest (`dev/tests/js/`)
  - `static` — Static analysis presence (PHPCS, PHPStan, PHPMD)
  - `performance` — Load tests (JMeter, Gatling, k6)
- **Detection strategies:** `filename` (path conventions), `namespace` (PSR-4 mapping), `annotation` (`@covers`/`@group`), or `all` (combined)
- **Priority scoring:** complexity × revenue-path × plugin/observer × public-API × git-churn × fan-in
- Mocking: PHPUnit mocks + ObjectManager isolation
- Patterns: Repository tests, Plugin tests, Observer tests, ViewModel tests

### AEMaaCS
- Test framework: JUnit 5 + Sling Mocks + AEM Mocks
- Unit tests: `src/test/java/` mirroring source package
- Integration tests: `it.tests/` module
- UI tests: `ui.tests/` module
- Mocking: AemContext, SlingContext, MockSlingHttpServletRequest
- Patterns: Sling Model tests, Servlet tests, OSGi service tests, Workflow tests

### EDS
- Test framework: Mocha/Jest
- Unit tests: `test/` or `__tests__/` directories
- Patterns: Block tests, DOM manipulation tests, fetch mock tests

### EDS + Commerce
- Combines EDS test patterns with Commerce API mocking
- Additional: Dropin component tests, Commerce API integration tests

## Output Formats

- **Coverage Report:** Excel workbook with sheets per module + summary
- **Gap List:** JSON array of untested units with priority scores
- **Generated Tests:** Source files placed in correct test directories
- **Summary:** Markdown report of actions taken

## Commands Reference

| Trigger | Action |
|---------|--------|
| `analyze test coverage` | Tier 1 — gap analysis only |
| `analyze coverage --interactive` | Tier 1 with guided framework/strategy prompt |
| `analyze coverage --frameworks unit,mftf` | Tier 1 scoped to specific frameworks |
| `generate tests` | Tier 2 — LLM generates tests for known gaps |
| `full test coverage` | Tier 1 + Tier 2 combined |
| `generate tests for <file/module>` | Targeted generation for specific scope |
| `show untested code` | Tier 1 — list uncovered units |
| `create test plan` | Tier 1 analysis + prioritized plan output |

## CLI Options

| Flag | Description |
|------|-------------|
| `--mode <analyze\|generate\|full>` | Operation mode (default: analyze) |
| `--path <dir>` | Project root (default: .) |
| `--engine <engine>` | Platform engine (auto-detect if omitted) |
| `--frameworks <list>` | Comma-separated: unit,integration,mftf,api-functional,js,static,performance |
| `--strategy <strategy>` | Detection: filename, namespace, annotation, all (default: all) |
| `--interactive` | Prompt which frameworks/strategy to use |
| `--module <name>` | Scope to specific module/package |
| `--output <dir>` | Output directory for reports |
| `--list-engines` | List available engines |
