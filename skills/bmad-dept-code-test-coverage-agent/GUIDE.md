# BMAD DEPT Code Agent — Test Coverage Guide

## Overview

The Test Coverage agent analyzes your project's test coverage gaps and generates missing tests using platform-specific patterns. It works in two tiers:

- **Tier 1 (Scanner):** Fast deterministic analysis — inventories source files, maps existing tests, identifies gaps, and scores priority. This is the only tier the CLI runs itself. By default `coveragePercent` is a filename-based estimate; point it at a real coverage report to get exact line/branch numbers (see [Real Coverage](#real-coverage)).
- **Tier 2 (LLM):** AI-driven test generation — the LLM follows `SKILL.md` plus the per-stack packs in `resources/test-generation/<stack>.md` to write unit, integration, and functional tests that reach 100% for the identified gaps, following your project's conventions. The CLI's `--mode generate` is a stub that emits no files; the tests are written by the agent, not by a deterministic generator.

Engines are auto-detected (or forced with `--engine`) across 8 stacks: `aem`, `commerce`, `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`.

## Quick Start

After BMAD install, just ask:

```
analyze test coverage
```

Or go straight to generation:

```
generate tests for the Checkout module
```

## Usage Modes

### Analyze Only

```
analyze test coverage
show untested code
create test plan
```

Produces the standardized Excel report + Markdown twin (see [Output](#output)).

### Generate Only

```
generate tests for src/Model/OrderProcessor.php
generate unit tests for the Payment module
```

Uses existing coverage data (or runs analysis first). Test generation is an LLM workflow — the agent writes the test files.

### Full (Analyze + Generate)

```
full test coverage
```

Runs analysis, presents top gaps, generates tests upon confirmation.

## CLI (Standalone)

```bash
cd .claude/skills/bmad-dept-code-test-coverage-agent/scripts

# Analyze coverage gaps (auto-detect engine)
npx ts-node run.ts --mode analyze --path /path/to/project

# Explicit engine
npx ts-node run.ts --mode analyze --engine commerce --path /path/to/project

# Analyze only specific frameworks (Commerce engine only)
npx ts-node run.ts --mode analyze --path /project --frameworks unit,mftf,api-functional

# Choose a detection strategy (Commerce engine only)
npx ts-node run.ts --mode analyze --path /project --strategy namespace

# Interactive mode — guided prompt for frameworks & strategy (Commerce-oriented)
npx ts-node run.ts --interactive --path /path/to/project

# Scope to a single module
npx ts-node run.ts --mode analyze --path /project --module Vendor_Checkout

# List engines
npx ts-node run.ts --list-engines
```

> `--frameworks`, `--strategy`, and `--interactive` are honored only by the Commerce engine. The other seven engines hardcode a single framework tag (`unit` for aem/sling/spring/eds/eds-commerce, `js` for app-builder/commerce-saas) and ignore these options.

### Real Coverage

By default the coverage percentage is a filename-based **estimate** (tested source basenames vs. source basenames). Supply a real report — or run the toolchain — to replace it with exact line/branch coverage. Four formats are auto-detected: JaCoCo (`jacoco.xml`), Istanbul (`coverage-summary.json` / `coverage-final.json`), LCOV (`lcov.info`), and Clover (`clover.xml`).

```bash
# Parse an existing coverage report for real line/branch %
npx ts-node run.ts --mode analyze --path /project --coverage-report coverage/lcov.info

# Run the project's coverage tool first (Maven/Gradle JaCoCo, Jest/nyc/c8, or PHPUnit-clover), then parse it
npx ts-node run.ts --mode analyze --path /project --run-coverage
```

When a real report is used, gaps become every file under 100% (with exact covered/total line and branch counts) and the report's coverage source flips from `estimate (filename match)` to `real (<tool>)`.

### Frameworks (Commerce)

| Key | Description |
|-----|-------------|
| `unit` | PHPUnit unit tests (`app/code/**/Test/Unit/`) |
| `integration` | PHPUnit integration tests (`dev/tests/integration/`) |
| `mftf` | MFTF functional tests (XML-based E2E) |
| `api-functional` | REST & GraphQL endpoint tests |
| `js` | JavaScript tests — Jasmine/Jest |
| `static` | Static analysis (PHPCS/PHPStan/PHPMD) |
| `performance` | Load tests (JMeter/Gatling/k6) |

### Detection Strategies (Commerce)

| Strategy | How it finds tests |
|----------|--------------------|
| `filename` | Directory/path conventions (e.g. `Test/Unit/`) |
| `namespace` | PSR-4 namespace mapping to source |
| `annotation` | `@covers` / `@group` annotations in test files |
| `all` | All three combined (default — most accurate) |

## Output

The **`analyze`** and **`full`** modes emit the standardized DCA outputs into `<project>/test-coverage-reports/` (override with `--output`). `--mode generate` writes no report — the Tier‑2 LLM path produces the test files (see Tier 2 above):

- `test-coverage-<branch>-<timestamp>-agent-report.xlsx` — the coverage report (Summary sheet + Input Traceability sheet + Run Info sheet carrying Coverage %, Coverage source, Tested Files, and Total Source Files). Timestamp is local `YYYYMMDD_HHMMSS`.
- `test-coverage-<branch>-<timestamp>-agent-report.md` — Markdown twin of the report.
- `CHANGE-LOG.md` — appended at the project root with a one-line run summary (e.g. `Coverage analysis: N% (tested/total files); K gap(s).`).
- Generated test files (Tier 2) are written by the LLM into each stack's conventional test location (Java `src/test/java/<pkg>/`, PHP `.../Test/Unit/`, JS `test/`).
- Optional standard git branch `dca/test-coverage-<stack>-<timestamp>`, cut from `production`/`main`/`master`/`develop` (or `--source-branch <name>`) when `--create-branch` is passed.
