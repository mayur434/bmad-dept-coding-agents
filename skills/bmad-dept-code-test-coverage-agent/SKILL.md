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

## Preflight — report the user's LLM & recommend a mode (do this first, conversationally)

The moment this command is triggered from an AI assistant (GitHub Copilot, Claude, Cursor, or any LLM), run the
preflight and tell the user — in one line — **which LLM they're on** and **whether to lean on the Static engine
or the LLM**:

```bash
npx ts-node scripts/run.ts --path {project} [--engine {engine}] --preflight
```

It prints the detected **model + context window**, the **project size** (files/LOC/tokens), the **fit** (% of the
window), and a **recommendation** — **STATIC** (Tier-1 deterministic coverage engine) when the project is large,
**LLM** (Tier-2 test generation) when it comfortably fits, or **HYBRID**. Surface it like:
*"You're on `<model>` (~`<ctx>` context). This project is ~`<pct>%` of your window → I recommend **<mode>**. Proceed?"*
then run the full command (the advisory also prints on every normal run unless `--no-preflight`).

**Rule of thumb:** run the Static (Tier-1) engine to find coverage gaps deterministically, then use the LLM
(Tier-2) to generate the missing tests. Lean more on the LLM only when the project fits the window.

## Pre-flight: Auto-install Dependencies

Before ANY command execution, silently run:
```bash
cd {skill_path}/scripts && [ -d node_modules ] || npm install --silent
```
Do NOT ask the user. Do NOT print install output unless it fails.

## Consent: Ask Coverage Mode

**Direct-intent triggers (skip the question, go straight to that mode):**
- "analyze coverage" / "show gaps" / "coverage report" / "untested code" → Tier 1 (Analyze)
- "generate tests" / "write tests for X" / "create unit tests" → Tier 2 (Generate)
- "full coverage" / "analyze and generate" → Tier 1 + Tier 2

**Ambiguous triggers (ask which mode):**
- "test coverage" / "help with tests" / "improve coverage"

When the intent is ambiguous, ask using the interactive question picker. Use the `vscode_askQuestions` tool:

```
question: "What would you like me to help with?"
options:
  - label: "Show me what's missing"
    description: "I'll map your code against existing tests and highlight the gaps. Almost no tokens used (~1.8K)."
    recommended: true
  - label: "Write tests for me"
    description: "I'll generate test files for uncovered code following your project's patterns. Uses ~32K tokens."
  - label: "Find gaps, then write tests"
    description: "I'll identify what's missing and write tests for the top priorities. Uses ~34K tokens."
```

**Important:** Always recommend "Show me what's missing" as default. Users often just need visibility into what's untested before deciding what to generate.

Proceed with the user's chosen mode.

## Workflow

### Mode: Analyze (Tier 1 only)

1. Run `npx ts-node scripts/run.ts --mode analyze --path <PROJECT_ROOT> [--engine <ENGINE>]`
2. Engine auto-detects platform if not specified
3. Scanner inventories source files and maps existing tests
4. Outputs coverage gap report (standardized Excel + Markdown + CHANGE-LOG)

**Real coverage (accurate line/branch %):** by default the metric is a fast
filename/class estimate. To get *real* coverage, either point at an existing
report or run the tool:

```bash
# use an existing report (JaCoCo / Istanbul json / Clover / LCOV — auto-detected)
npx ts-node scripts/run.ts --mode analyze --engine <ENGINE> --path <PROJECT> --coverage-report <path>

# or run the project's coverage tool first (needs its toolchain: Maven/Gradle, Jest/nyc, PHPUnit)
npx ts-node scripts/run.ts --mode analyze --engine <ENGINE> --path <PROJECT> --run-coverage
```

When a report is found, `Coverage %` becomes real line coverage, gaps become the
files below 100% (with exact line/branch numbers + uncovered-line counts), and
the Run Info sheet records `Coverage source: real (<tool>)`. Auto-discovered
locations: `**/target/site/jacoco/jacoco.xml`, `**/coverage/coverage-summary.json`,
`**/coverage/lcov.info`, `**/clover.xml`.

### Mode: Generate (Tier 2 — the LLM writes the tests to 100%)

The static engine finds the gaps; **you (the LLM) generate the tests.** For each gap:

1. Run Tier 1 first (or read the prior gap report) for the ranked list of untested files.
2. **Load the stack's test-generation pack** — `resources/test-generation/<stack>.md` (mapping below). It gives the
   exact framework + dependencies, test location & naming, the setup/mock boilerplate, a worked example, and the
   **"Reaching 100%" checklist**.
3. For each gap, read the source file and write the test that satisfies the pack's 100% checklist — a test per
   public method **plus** a case for every branch/condition, every thrown/caught exception, boundary + null/empty
   inputs, and the stack's **security-negative** cases. Private methods are covered via their public callers.
4. Write each test to the pack's location convention (Java → `src/test/java/<same package>/`, PHP →
   `…/Test/Unit/`, JS → `test/`).
5. **Validate:** run the tests + the coverage tool named in the pack (JaCoCo / PHPUnit-coverage / Jest
   `--coverage` with a 100% threshold) and iterate on any file below 100% using the checklist.

**Stack → pack:**

| Engine | Pack | Framework |
|--------|------|-----------|
| `aem` (AEMaaCS / AMS) | `resources/test-generation/aem.md` | JUnit 5 + AEM Mocks (`AemContext`) |
| `sling` | `resources/test-generation/sling.md` | JUnit 5 + Sling/OSGi Mocks (`SlingContext`) |
| `spring` | `resources/test-generation/spring.md` | JUnit 5 + Spring Test / MockMvc |
| `commerce` (PaaS) | `resources/test-generation/commerce-paas.md` | PHPUnit + Magento TestFramework / MFTF |
| `commerce-saas` | `resources/test-generation/commerce-saas.md` | Jest + jsdom (mocked GraphQL / drop-ins) |
| `app-builder` | `resources/test-generation/app-builder.md` | Jest (mocked `@adobe/aio-sdk`) |
| `eds` | `resources/test-generation/eds.md` | Jest + jsdom |
| `eds-commerce` | `resources/test-generation/eds-commerce.md` | Jest + jsdom + mocked `@dropins` |

> **100% means 100% of the checklist** — every branch, error path, edge case, and security-negative case in the
> pack — not just line coverage. Line coverage is the floor, not the goal.

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
