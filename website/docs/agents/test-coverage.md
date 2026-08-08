---
id: test-coverage
title: Test Coverage
sidebar_position: 5
description: Gap analysis + real line/branch coverage (JaCoCo / Istanbul / Clover / LCOV) + framework-aware LLM test generation to 100%, with a 6-factor priority model across all 8 engines.
keywords:
  - test coverage
  - jacoco
  - istanbul
  - phpunit
  - jest
  - mutation testing
---

## Purpose

The **Test Coverage** agent is a two-tier coverage system. **Tier 1** is deterministic gap analysis (which files / classes / functions have no test) plus **real** line/branch coverage from your existing tooling (JaCoCo XML, Istanbul JSON, Clover XML, LCOV). **Tier 2** is LLM-driven test generation that closes the gaps toward 100%, using framework-aware packs (JUnit + AEM/Sling Mocks, Spring Test + MockMvc + Testcontainers, PHPUnit + MFTF, Jest + jsdom).

Every run emits the [standardized outputs contract](../concepts/standardized-outputs).

## When to use it

- **Baseline coverage snapshot** for a legacy project ("what percentage of this codebase has any test at all?").
- **Real coverage snapshot** when CI already produces JaCoCo / Istanbul / Clover / LCOV — surface it in a standardized report.
- **Test-generation sprint** — LLM writes the missing tests to close gaps; re-run to verify the delta.
- **Pre-release gate** — enforce a floor on branch coverage of impacted files (chain with [Impact Analysis](./impact-analysis)).
- **Framework migration** — identify test files that need porting.
- **Mutation-testing backlog** — emit Pitest / Stryker / Infection hints for the highest-priority uncovered files.

## What it produces

| Artifact | Where | Notes |
|----------|-------|-------|
| `test-coverage-<branch>-<timestamp>-agent-report.xlsx` | `test-coverage-reports/` | Standardized workbook. `Coverage %` is real line coverage when a report is present; otherwise a filename-existence estimate labeled `Coverage source`. |
| `test-coverage-<branch>-<timestamp>-agent-report.md` | `test-coverage-reports/` | Markdown twin. Includes an optional **Mutation Hints** section when `--emit-mutation-hints` is set. |
| One `CHANGE-LOG.md` entry | project root | |
| Optional working branch | git | `dca/test-coverage-<stack>-<timestamp>` when `--create-branch` is passed. |
| Findings cache | `.bmad/cache/test-coverage-<hash>.json` | Consumed by chained workflows. |
| **Generated test files** (Tier 2) | canonical test tree | LLM-authored tests placed at the framework-idiomatic location for each stack. |

## The three modes

| Mode | What it does | Tier | Best for |
|------|--------------|:---:|----------|
| `analyze` | Gap analysis + real coverage parsing / running. | 1 | Baseline snapshot, CI gate, sprint check-in. |
| `generate` | LLM writes the missing tests to 100% using the per-framework pack. | 2 | Test-generation sprint after `analyze` has surfaced the gaps. |
| `full` | `analyze` first, then `generate` on the uncovered set. | 1 + 2 | End-to-end coverage push. |

## Real coverage integration

Point the agent at an existing coverage report to get real line/branch numbers, or let it run the tool for you.

| Flag | Format | Runner (with `--run-coverage`) |
|------|--------|--------------------------------|
| `--coverage-report <file>` — JaCoCo XML | `target/site/jacoco/jacoco.xml` | `mvn test jacoco:report` or `gradle test jacocoTestReport` |
| `--coverage-report <file>` — Istanbul JSON | `coverage/coverage-final.json` \| `coverage-summary.json` | `jest --coverage` or `nyc --reporter=json` |
| `--coverage-report <file>` — Clover XML | `build/logs/clover.xml` | `phpunit --coverage-clover` |
| `--coverage-report <file>` — LCOV | `coverage/lcov.info` | `jest --coverage --coverageReporters=lcov` |

Without a report or `--run-coverage`, `Coverage %` falls back to a filename-existence estimate (labeled `Coverage source: filename-estimate`).

## Trigger phrases

```text
analyze test coverage
show untested code
analyze test coverage for the Checkout module
analyze coverage --coverage-report target/site/jacoco/jacoco.xml
run the coverage tool and report real line/branch coverage
generate tests for the Checkout module
full test coverage
generate JUnit tests for ArticleModel using AEM Mocks
list the top-20 uncovered files by priority
emit mutation hints for uncovered files
```

Full catalog in the [Test Coverage prompts reference](../reference/prompts/test-coverage).

## CLI usage (technical mode)

```bash
# Gap analysis only
npx ts-node .claude/skills/bmad-dept-code-test-coverage-agent/scripts/run.ts \
  --mode analyze --path /project --engine commerce

# Real coverage from an existing report
npx ts-node .claude/skills/bmad-dept-code-test-coverage-agent/scripts/run.ts \
  --mode analyze --path /project \
  --coverage-report target/site/jacoco/jacoco.xml

# Run the project's coverage tool first, then parse
npx ts-node .claude/skills/bmad-dept-code-test-coverage-agent/scripts/run.ts \
  --mode analyze --path /project --run-coverage --engine spring

# Full cycle — analyze then LLM-generate
npx ts-node .claude/skills/bmad-dept-code-test-coverage-agent/scripts/run.ts \
  --mode full --path /project
```

## Flags reference

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--mode <m>` | enum | `analyze` | `analyze` \| `generate` \| `full`. |
| `--path <dir>` | dir | `.` | Project root. |
| `--engine <id>` | enum | auto | Force a stack. |
| `--name <str>` | string | folder name | Report title. |
| `--module <name>` | string | — | Scope to a specific module / package. |
| `--output <dir>` | dir | `{test_coverage_output}` | Output directory for reports. |
| `--frameworks <list>` | csv | — | Subset of `unit,integration,mftf,api-functional,js,static,performance` (Commerce PaaS multi-framework only). |
| `--strategy <s>` | enum | `all` | Detection strategy: `filename` \| `namespace` \| `annotation` \| `all` (Commerce PaaS only). |
| `--coverage-report <file>` | file | — | Parse a JaCoCo / Istanbul / LCOV / Clover report. |
| `--run-coverage` | bool | false | Run the project's coverage tool first (mvn/gradle-jacoco, jest/nyc, phpunit-clover), then parse. |
| `--emit-mutation-hints` | bool | false | Append a **Mutation Hints** section to the Markdown twin (Pitest / Stryker / Infection commands) for uncovered files with priority `>= 50`. |
| `--no-audit-chain` | bool | false | Skip boosting priority for files that have prior CRITICAL / HIGH audit findings in the shared cache. |
| `--audit-max-age-hours <n>` | int | `168` (7 days) | Ignore audit findings older than N hours. |
| `--role <code>` | enum | `.bmad/role.yaml` | Role adaptation. |
| `--create-branch` | bool | false | Cut `dca/test-coverage-<stack>-<timestamp>` before writing outputs. |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. |
| `--preflight` | bool | false | Print the preflight advisory and exit. |
| `--no-preflight` | bool | false | Suppress the preflight advisory. |
| `--yes-install` | bool | false | First-run dependency install without confirmation. |
| `--no-install` | bool | false | Error out if deps are missing (exit `2`). |
| `--interactive` | bool | false | Force interactive intake mode. |
| `--technical` | bool | false | Force technical intake mode. |
| `--list-engines` | bool | false | List available engines. |
| `--help` | bool | false | Show help. |

### Enterprise Phase 1 flags

Shared with every DCA agent. See [Findings Gate](../concepts/findings-gate) and [SLA Tracking](../concepts/sla-tracking) for the full mechanics.

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `--include-decided` | bool | false | Bypass the findings gate — show coverage gaps already decided in `.bmad/decisions.yaml`. |
| `--decisions-path <path>` | string | `<projectRoot>/.bmad/decisions.yaml` | Override the decisions file. |
| `--ignore-decision-expiry` | bool | false | Treat expired decisions as still active for this run. |
| `--list-decisions` | bool | false | Print all decisions and exit. |
| `--sla-path <path>` | string | `<projectRoot>/.bmad/sla.yaml` | Override the SLA file. |
| `--no-sla` | bool | false | Skip the SLA sheet and computation. |
| `--fail-on-overdue` | bool | false | Exit code 6 if any coverage-linked gap is overdue per role SLA. |

## One-shot examples

The Test Coverage agent runs end-to-end without clarifying questions when the prompt is self-contained. Coverage report is auto-detected from standard paths (`target/site/jacoco/jacoco.xml`, `coverage/lcov.info`, `build/reports/jacoco/...`). See the [One-Shot Mode](../concepts/one-shot-mode) concept page for the full precedence rules.

- **"analyze test coverage"** — mode=`analyze`; coverage report auto-detected; scope from role default.
- **"full test coverage with real jacoco at ./target/site/jacoco/jacoco.xml"** — mode=`full`; explicit `--coverage-report`; gaps + LLM-generated tests.
- **"generate tests for the OrderService"** — mode=`generate`; `--name OrderService` targets the scope.
- **"coverage for the impacted files (chain with prior audit)"** — audit chain on; coverage scoped to impacted-file set.
- **"--run-coverage — auto-run the coverage tool then analyze"** — `--run-coverage` executes `mvn`/`npm test --coverage`/etc. before analysis.
- **"mutation hints for the top-10 uncovered files"** — `--emit-mutation-hints`; PIT/Stryker mutation seeds per gap.

Full example bodies with the exact resolved commands live in the agent SKILL.md's `One-shot mode` section.

## What's new in the maturity batch

- **6-factor priority for all 8 engines** — the priority scorer (previously Commerce-only) now runs across every stack. Factors: complexity × revenue-path × plugin/interceptor × observer/event-handler × public-API (`@api`) × git-churn × dependency fan-in. Every uncovered file gets a numeric priority you can sort by.
- **Audit-chain boost** — when the shared findings cache has a recent audit run (default within `--audit-max-age-hours 168`), files with CRITICAL / HIGH audit findings get a priority bump so they surface at the top of the backlog. Opt out with `--no-audit-chain`.
- **Mutation-testing hooks** — `--emit-mutation-hints` appends a **Mutation Hints** section to the Markdown twin with concrete Pitest (Java), Stryker (JS), or Infection (PHP) commands for uncovered files with priority `>= 50`. Off by default — mutation testing is heavyweight.
- **Framework auto-detect** — the dispatcher scans `pom.xml`, `build.gradle(.kts)`, `package.json`, and `composer.json` to determine which test framework the project already uses. Detected frameworks appear on the **Run Info** sheet, and the LLM test-generation pack for that framework becomes the default.

## LLM test-generation packs

One pack per stack under `resources/test-generation/`:

| Stack | Pack | Frameworks |
|-------|------|-----------|
| `aem` | `aem.md` | JUnit 5 + AEM Mocks (AemContext) |
| `sling` | `sling.md` | JUnit 5 + Sling Mocks |
| `spring` | `spring.md` | Spring Test + `@WebMvcTest` + `@DataJpaTest` + MockMvc + Testcontainers |
| `commerce-paas` | `commerce-paas.md` | PHPUnit + MFTF + api-functional |
| `commerce-saas` | `commerce-saas.md` | Jest (real Istanbul) |
| `app-builder` | `app-builder.md` | Jest |
| `eds` | `eds.md` | Jest + jsdom |
| `eds-commerce` | `eds-commerce.md` | Jest + jsdom |

Each pack lists framework + deps, canonical test location and naming, setup/mock boilerplate, a worked example, and a "Reaching 100%" checklist. Tier 2 (LLM `generate` mode) drives from these packs.

## Example workflow — AEM, real JaCoCo then LLM-generate to 100%

```bash
# Step 1 — real coverage snapshot
npx ts-node .claude/skills/bmad-dept-code-test-coverage-agent/scripts/run.ts \
  --mode analyze --path /path/to/aem-project \
  --coverage-report /path/to/aem-project/target/site/jacoco/jacoco.xml \
  --emit-mutation-hints
```

**Chat step 2 — LLM test generation:**

```text
full test coverage for the Payment module
```

**Chat step 3 — verify the delta:**

```text
re-analyze coverage and show me the delta vs the last run
```

## Cross-agent chaining hints

| Role | Next agent | Why |
|------|-----------|-----|
| `ea` | [Audit](./audit) + [Impact Analysis](./impact-analysis) | Turn low-coverage modules into an architecture roadmap. |
| `tl` | [Audit](./audit) | Audit the low-coverage modules surfaced by coverage. |
| `de` | [Code Generation](./code-generation) | Scaffold + tests for the top backlog items. |
| `qa` | [Sonar Scan](./sonar-scan) (mutation-adjacent), then more Test Coverage | Deeper defect analysis + measure lift after generation. |
| `devops` | [Sonar Scan](./sonar-scan) | Wire the coverage gate + sonar Quality Gate into CI together. |
| `security` | [Audit](./audit) (`--focus security`) | Feed the security-critical file list into audit for negative tests. |
| `migration` | [Impact Analysis](./impact-analysis) | Cross-version blast-radius on top of the coverage delta. |
| `pm` | (stay in test-coverage) | Summarize coverage for release readiness. |

Or run the whole SDLC pass in one shot with [`--chain-all`](../workflows/chain-all).

## See also

- [Test Coverage prompt catalog](../reference/prompts/test-coverage) — copy-paste prompts, one per stack.
- [Standardized outputs contract](../concepts/standardized-outputs) — 15-column Summary + Markdown twin.
- [Findings cache](../concepts/findings-cache) — how audit-chain boost works.
- [The 8 stacks](../concepts/the-8-stacks) — engine IDs and framework auto-detect signals.
