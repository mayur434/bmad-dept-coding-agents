---
name: bmad-dept-code-test-coverage-agent
description: "Two-tier test coverage agent (part of BMAD DEPT Code Agent suite). Tier 1: deterministic TypeScript/Node.js coverage analysis (gap detection, filename estimate + optional real line/branch coverage, coverage report). Tier 2: LLM-driven test generation producing platform-specific unit, integration, and functional tests."
---

# BMAD DEPT Code Agent — Test Coverage Skill

## Purpose

Two-tier test coverage system for enterprise Adobe projects across 8 stacks: AEM (AEMaaCS + AEM AMS), Adobe Commerce PaaS (Magento 2), Adobe Commerce SaaS, Apache Sling / Shaft (sling-12), Spring Boot, Adobe App Builder, Edge Delivery Services (EDS), and EDS + Commerce hybrid implementations.

This is one of the five agents in the BMAD DEPT Code Agent suite (audit, sonar-scan, generation, impact-analysis, test-coverage). Its Tier-1 gap analysis, real-coverage parsing, standardized report, CHANGE-LOG, and optional branch-cut are shared with the other four via the common `skills/shared/` foundation.

### Tier 1 — Deterministic Coverage Analysis (TypeScript/Node.js)

Fast, reproducible analysis using `scripts/run.ts` (auto-detects one of the 8 stacks or `--engine`). Produces a coverage report with:
- Testable unit inventory (source files discovered by fast-glob across the detected stack)
- Existing test mapping — which source files have tests, which don't, matched by basename (stripping `Test`/`Tests`/`IT`/`ITCase`-style suffixes)
- Coverage gap identification — every unmatched source file is a gap; sorted by priority and sliced to the top 100
- Complexity estimate — cyclomatic estimate by counting branch keywords (`if`/`else`/`switch`/`case`/`catch`/`for`/`while`/`?:`), driving priority and effort (S/M/L)
- **Coverage % is a filename ESTIMATE by default** (tested source basenames ÷ total source basenames), labeled `Coverage source: estimate (filename match)`
- Optional **real** line/branch coverage that overrides the estimate when a JaCoCo/Istanbul/LCOV/Clover report is present or produced (`--coverage-report` / `--run-coverage`)

**Commerce (PaaS) engine only** — the richest engine adds: 7 framework types, multi-strategy detection, a 6-factor priority model, and an interactive picker (see below). The other 7 engines run the same filename-based gap analysis and each hardcode a single framework tag; they ignore `--frameworks`/`--strategy`.

**Invocation:**
```bash
npx ts-node scripts/run.ts --mode analyze --path <PROJECT_ROOT>
# Commerce-only multi-framework analysis:
npx ts-node scripts/run.ts --mode analyze --path <PROJECT_ROOT> --frameworks unit,mftf,api-functional
# Commerce-only interactive framework/strategy picker:
npx ts-node scripts/run.ts --interactive --path <PROJECT_ROOT>
```

### Tier 2 — LLM Test Generation

AI-driven test creation using platform patterns and project conventions:
- Generates unit tests following existing project test style
- Creates integration tests for cross-module interactions
- Produces functional/API tests for endpoints and services
- Mocks dependencies following platform best practices
- Validates generated tests compile and follow naming conventions

**Note:** Tier 2 is NOT implemented in the CLI — every engine's `generateTests()` is a stub returning `[]`, so `--mode generate` writes no files and emits no report. The tests are written by **you (the LLM)** following this skill and the per-stack packs under `resources/test-generation/<stack>.md`.

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

## Intake mode (interactive vs technical)

> **CRITICAL:** The very first response to any activation must be the intake-mode question — unless `.bmad/intake.yaml` exists with a saved preference. Do NOT skip this. Do NOT show a CLI command as the first response.

When a user triggers this agent — via a natural-language prompt or a menu entry — do NOT show or run a raw CLI command as the first response. Ask which drive style they prefer:

> "Should I drive this **interactively** (I ask you step-by-step questions and run everything for you) or **technically** (I show you the CLI command with each flag explained, and you decide whether to run it or have me run it)?"

Save the answer to `.bmad/intake.yaml` (adjacent to `.bmad/role.yaml`) with keys `mode: interactive|technical` and `set_at: <ISO-8601>`. On subsequent runs, read the file silently and skip the prompt unless the user asks to switch.

To change intake mode later, the user says **"switch intake to interactive"** or **"switch intake to technical"** — overwrite `.bmad/intake.yaml` with the new choice.

**Sequencing note.** The `Preflight`, `Pre-flight: Auto-install Dependencies`, and `Consent: Ask Coverage Mode` sections below must NOT run before the intake picker resolves. Order for a fresh activation:
1. Resolve intake mode (ask, or read `.bmad/intake.yaml`).
2. If technical → show the coverage command + flag explanations, then run it (with the user's OK) or hand off.
3. If interactive → collect the intake questions below, then run silently.
4. Preflight + bootstrap run just before dispatch, once inputs are collected.

### Interactive mode (recommended for first-timers)

Ask one question per turn, in this order. Skip any question the user has already answered in their initial prompt.

1. "What's the project path?"
2. "Which stack? (auto-detect / `aem` / `commerce` / `commerce-saas` / `sling` / `spring` / `app-builder` / `eds` / `eds-commerce`)"
3. "Mode: **analyze** (find gaps), **generate** (LLM writes tests to 100%), or **full** (both)?"
4. "Do you have an existing coverage report I should ingest (path to a JaCoCo/Istanbul/LCOV/Clover file), or should I run the project's coverage tool now (`--run-coverage`), or fall back to the fast filename estimate (Enter to skip)?"
5. "Cut a working branch from production? (Y/n)"

Once every required input is collected, run the command internally (do NOT show it unless the user asks) and stream results conversationally:
> "Analyzing your Spring project…" → "Found 132 source files, 78% real line coverage, 41 gaps sorted by priority…" → "Report saved to `test-coverage-reports/test-coverage-main-20260801_120000-agent-report.xlsx`. Want me to write tests for the top 10 gaps?"

### Technical mode (for users who want CLI transparency)

Show the fully-formed command in a `bash` code block with one flag per line:

```bash
npx ts-node .claude/skills/bmad-dept-code-test-coverage-agent/scripts/run.ts \
  --path /path/to/project \
  --mode full \
  --coverage-report ./target/site/jacoco/jacoco.xml \
  --create-branch
```

Below the block, add a bulleted list explaining each flag in plain English:

- `--path` — the project root to analyze; the scanner walks this tree for source and test files.
- `--mode full` — run Tier-1 gap analysis and hand the top-priority gaps to Tier-2 test generation.
- `--coverage-report` — path to an existing JaCoCo/Istanbul/LCOV/Clover report; when present, `Coverage %` becomes real line/branch coverage instead of the filename estimate.
- `--create-branch` — cut a working `dca/test-coverage-<stack>-<timestamp>` branch (from `production`/`main`/`master`/`develop`) before writing outputs.

Then ask: **"Want me to run this now, or will you copy-paste it?"**

- If **run for me** → execute silently and stream results (same as interactive mode).
- If **I'll run it** → acknowledge, and remind them: "Report will land in `<project>/test-coverage-reports/`. Come back with 'summarize the coverage gaps' when you're done."

## Role-aware behavior

The Test Coverage agent adapts its **default mode**, **output emphasis**, and **recommended follow-up** to the role of the person driving the run. Role selection is a **shared** concept across the 5-agent DCA suite and is persisted per-project at `<projectRoot>/.bmad/role.yaml` (see `skills/shared/role/ROLES.md`).

### Role check on activation

**Before running any mode**, the AI agent MUST perform the role handshake:

1. **Check for `<projectRoot>/.bmad/role.yaml`.**
2. **If ABSENT**, ask the user — verbatim:
   > "Which role best matches how you'll use this plugin? Pick one from the 10 codes below (or say 'generic' to skip):"
   Then list the **6 promoted roles** first, each with a one-line description:
   - `ea` — Enterprise Architect: cross-cutting architecture across Adobe/JVM estates; portfolio-level coverage health and modernization signals.
   - `tl` — Tech Lead / Solution Architect: component-level coverage and generation scaffolds for the team.
   - `de` — Senior Delivery Engineer: sprint delivery; Jira-ready coverage backlog with per-file priority + effort.
   - `qa` — QA / SDET: test plan with unit + integration + e2e per module; mutation-testing hints; MFTF/API stubs.
   - `devops` — DevOps / SRE: PASS/FAIL coverage gate for CI with a PR-comment-ready Markdown block.
   - `security` — Security Engineer: security-critical files highlighted where coverage is < 80%.

   Then list the **4 additional roles**:
   - `pm` — Product Manager / PMO: executive coverage narrative + effort estimate for release readiness.
   - `ba` — Business Analyst: standard coverage analysis (not primary for BA).
   - `migration` — Migration/Upgrade Lead: regression-suite emphasis + before/after coverage delta.
   - `content` — Content/CMS Engineer: coverage on content-related files only (block/component/CF).

   Then the fallback: `generic` — skip role adaptation and use standard defaults.

3. **Persist the choice** by confirming with the user, then **write `.bmad/role.yaml`** using the shared `writeRoleFile(projectRoot, role, "interactive")` helper from `skills/shared/role`. If writing by hand, use the exact YAML format documented in `skills/shared/role/persistence.ts`:
   ```yaml
   # BMAD DCA — role selection
   # Set by the DCA agent suite on first activation; edit or delete to change.
   role: <code>
   set_at: <ISO-8601 timestamp>
   set_by: interactive
   ```

4. **If PRESENT**, read it silently and use the `role:` field — do NOT re-prompt.

5. **Per-run override**: the user can override for a single run by prefixing their prompt with **"as `<role>`"** (e.g. *"as qa, test-coverage my project"*) or by passing **`--role=<code>`** to `scripts/run.ts`. Do NOT write `.bmad/role.yaml` when the role is overridden this way.

6. **Permanent change**: if the user says **"switch role to `<code>`"**, overwrite `.bmad/role.yaml` with the new code (same `writeRoleFile` call, `set_by: interactive`).

### Role → Test Coverage behavior matrix

| Role | Default mode when ambiguous | Output emphasis | Recommended follow-up |
|---|---|---|---|
| `ea` | `full` (analyze + generate) | Standard XLSX + **coverage-by-module heatmap** section in Markdown twin — grouped by top-level package/module | "generate coverage roadmap" |
| `tl` | `full` | Standard XLSX + Markdown twin (technical) | "audit the low-coverage modules" |
| `de` | `full` | **Jira-ranked backlog CSV** — one row per uncovered file with Priority from the priority score (Commerce 6-factor where available; filename estimate elsewhere), Effort S/M/L, and Component from stack | "generate tests for the top backlog items" |
| `qa` | `full` — generate tests + include **mutation-testing hints** in the Markdown twin ("consider mutating boundary conditions in FILE:LINE") and **MFTF/API scenario** stubs for Commerce | Standard XLSX + a **full test plan** section: unit + integration + e2e per module | "run mutation testing" |
| `devops` | `analyze` only (fast) with `--run-coverage` if not already passed | Standard XLSX + a **coverage-gate section** with a PASS/FAIL decision (config-driven threshold, default 80%) and a **PR-comment-ready Markdown block** | "wire the coverage gate into CI" |
| `security` | `analyze` + focus on security-critical files (auth, crypto, input validation) — cross-reference audit's Security findings if available | Standard XLSX with **security-negative-tests** highlighted (rows where security-critical files have <80% coverage) | "audit --focus security to feed the security-critical file list" |
| `pm` | `analyze` only | **Executive Markdown** — coverage narrative in business language, top-5 gaps, effort estimate for closing them | "summarize coverage for release readiness" |
| `ba` | (not primary for BA) — `analyze` only, standard output | Standard | (none) |
| `migration` | `full` — emphasize **regression-suite for migration** (tests that must pass on both old and new versions) | Standard XLSX + a **migration coverage delta** section comparing before/after | "impact-analyze the migration" |
| `content` | `analyze` on content-related files only (block/component/CF) | Standard XLSX filtered to content files | "generate content-fragment scaffold with test stub" |
| `generic` | (Ask user which mode — current behavior) | Standard XLSX + Markdown twin | "list gaps" |

**Output flavors — what they mean.** The `executive` flavor is a Markdown-first deliverable: coverage narrative in business language, top-N gaps, effort estimate; the XLSX is supplementary. The `technical` flavor is today's default look — the standard XLSX plus its Markdown twin. The `jira-csv` flavor adds a companion CSV next to the XLSX where each row is a Jira-import row (columns: Summary, Description, Priority, Labels, Component). The `sarif` flavor adds a `.sarif` file (per-file coverage gaps as issues) suitable for CI upload alongside the XLSX. The `default` flavor is today's behavior with no role-specific shaping.

**When the deterministic pipeline hasn't shipped a flavor yet** (executive MD, Jira-ranked CSV, coverage-gate PR comment, mutation hints, regression delta): the CLI emits the **standard XLSX + Markdown twin only**. The AI agent is responsible for post-processing the coverage data into the extra artifact and emitting it into the same report directory alongside the standard files. Do not block the run because a flavor generator isn't wired up.

### Cross-agent chaining hints per role

After the Test Coverage run finishes, offer the follow-up handoff that matches the resolved role:

| Role | Next agent to invoke | Why |
|---|---|---|
| `ea` | `audit` + `impact-analysis` | Turn low-coverage modules into an architecture roadmap. |
| `tl` | `audit` | Audit the low-coverage modules the coverage run surfaced. |
| `de` | `generation` | Generate tests for the top backlog items. |
| `qa` | `sonar-scan` (mutation-adjacent), then more `test-coverage` | Deeper defect analysis + measure lift after generation. |
| `devops` | `sonar-scan` | Wire the coverage gate + sonar quality gate into CI together. |
| `security` | `audit` (`--focus security`) | Feed the security-critical file list into audit for the negative-tests. |
| `pm` | (stay in test-coverage) | Summarize coverage for release readiness. |
| `ba` | (none) | Not primary for BA. |
| `migration` | `impact-analysis` | Cross-version blast-radius on top of the coverage delta. |
| `content` | `generation` | Emit content-fragment / block scaffold with test stub. |
| `generic` | (stay in test-coverage) | Summarize gaps; ask user for next step. |

The resolved role is exposed to child engines via `process.env.DCA_ROLE` (and `DCA_ROLE_NAME` / `DCA_ROLE_FLAVOR` / `DCA_ROLE_SOURCE`), recorded on the Run-Info sheet of the standardized report, and a one-line `[dca-role] <Name> (source: <cli-flag|role-file|generic-fallback>)` is printed to stderr on every run.

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

Before ANY command execution, run the shared bootstrap. It installs the `shared/` foundation
(if missing) + this agent's `scripts/` deps in the correct order, with a one-line confirmation
prompt so the user knows what's happening. First-time cost is ~80MB / ~30–60s; subsequent
runs are silent no-ops.

**POSIX (macOS, Linux, WSL):**
```bash
bash .claude/skills/shared/bootstrap.sh test-coverage
```

**Windows (or when sh is unavailable):**
```bash
node .claude/skills/shared/bootstrap.js test-coverage
```

**Headless / CI mode (skip prompt):**
```bash
bash .claude/skills/shared/bootstrap.sh test-coverage --yes    # install without asking
bash .claude/skills/shared/bootstrap.sh test-coverage --no     # error if deps missing, don't install
```

**Behavior:**
- Both node_modules present → silent no-op (exit 0)
- Either missing → confirmation prompt, then install if approved
- User declines → exit 3, agent should tell user "Deps required. Run manually: cd .claude/skills/shared && npm install && cd ../bmad-dept-code-test-coverage-agent/scripts && npm install"
- Install failure → exit 4, agent should surface the npm error

**Instructions to the AI:** Do NOT skip this step. The bootstrap script handles the confirmation — you do NOT need to ask the user separately. If bootstrap exits non-zero, halt and report the exit code. If your dispatcher (`run.ts`) also accepts `--yes-install`/`--no-install`, pass those to bootstrap accordingly.

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
filename estimate. To get *real* coverage, either point at an existing
report or run the tool:

```bash
# use an existing report (JaCoCo / Istanbul json / Clover / LCOV — auto-detected)
npx ts-node scripts/run.ts --mode analyze --engine <ENGINE> --path <PROJECT> --coverage-report <path>

# or run the project's coverage tool first (needs its toolchain: Maven/Gradle, Jest/nyc, PHPUnit)
npx ts-node scripts/run.ts --mode analyze --engine <ENGINE> --path <PROJECT> --run-coverage
```

When a report is found, `Coverage %` becomes real line coverage, `testedFiles`
become the files at 100%, gaps become every file below 100% (sorted ascending,
top 300, with exact covered/total line + branch counts and re-bucketed priority:
`<50` critical, `<75` high, `<90` medium, else low), and the Run Info sheet
records `Coverage source: real (<tool>)`. Auto-discovered locations, most-reliable
first: `**/coverage/coverage-summary.json`, `**/coverage/coverage-final.json`,
`**/coverage/lcov.info`, `**/target/site/jacoco/jacoco.xml`,
`**/build/reports/jacoco/**.xml`, `**/clover.xml` (`node_modules` and `vendor`
ignored).

### Mode: Generate (Tier 2 — the LLM writes the tests to 100%)

The static engine finds the gaps; **you (the LLM) generate the tests.** The CLI
`--mode generate` only calls the `generateTests()` stub (returns `[]`, emits nothing);
the real work is this workflow. For each gap:

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

1. Run Tier 1 analysis to identify gaps (this is the only part the CLI performs; `--mode full` analyzes + calls the generate stub + emits the analyze report)
2. Present top-priority gaps to user for confirmation
3. Generate tests for confirmed gaps (Tier 2 — you, the LLM)
4. Summary report: what was generated, where placed, remaining gaps

## Platform-Specific Behavior

The **Commerce (PaaS)** engine is by far the richest (multi-framework + 6-factor scoring + detection strategies).
The other 7 engines run the same filename-based gap analysis and each **hardcode a single framework tag** — `unit`
for `aem`/`sling`/`spring`/`eds`/`eds-commerce`, `js` for `app-builder`/`commerce-saas` — and ignore
`--frameworks`/`--strategy`.

### Adobe Commerce (Magento 2 / PaaS) — engine `commerce`
- **7 testing frameworks supported:**
  - `unit` — PHPUnit unit tests (`app/code/**/Test/Unit/`)
  - `integration` — PHPUnit integration tests (`dev/tests/integration/`)
  - `mftf` — Magento Functional Testing Framework (XML-based E2E)
  - `api-functional` — REST & GraphQL endpoint tests (`dev/tests/api-functional/`)
  - `js` — JavaScript tests via Jasmine/Jest (`dev/tests/js/`)
  - `static` — Static analysis presence (PHPCS, PHPStan, PHPMD)
  - `performance` — Load tests (JMeter, Gatling, k6)
- **Detection strategies:** `filename` (path conventions), `namespace` (PSR-4 mapping), `annotation` (`@covers`/`@group`), or `all` (combined)
- **6-factor priority scoring:** complexity × revenue-path × plugin/interceptor × observer/event-handler × public-API (`@api`) × git-churn × dependency fan-in
- Mocking: PHPUnit mocks + ObjectManager isolation
- Patterns: Repository tests, Plugin tests, Observer tests, ViewModel tests

### Adobe Commerce SaaS — engine `commerce-saas`
- Test framework: Jest + jsdom (ESM, `jest.unstable_mockModule`, mocked GraphQL / `@dropins`)
- Single framework tag: `js`; `--frameworks`/`--strategy` are ignored
- Patterns: catalog-service / Live Search query tests, storefront drop-in block tests

### AEM (AEMaaCS + AEM AMS) — engine `aem`
- Test framework: JUnit 5 + wcm.io AEM Mocks (`AemContext`) + Mockito (Sling Mocks available)
- Unit tests: `src/test/java/` mirroring source package
- Integration tests: `it.tests/` module
- UI tests: `ui.tests/` module
- Mocking: AemContext, SlingContext, MockSlingHttpServletRequest
- Patterns: Sling Model tests, Servlet tests, OSGi service tests, Workflow tests

### Apache Sling / Shaft (sling-12) — engine `sling`
- Test framework: JUnit 5 + Apache Sling/OSGi Mocks (`SlingContext`/`OsgiContext`) + Mockito
- Unit tests: `src/test/java/` mirroring source package
- Patterns: OSGi service tests, Sling Servlet/Filter tests, Sling Model tests

### Spring Boot — engine `spring`
- Test framework: JUnit 5 + Spring Test (`@WebMvcTest`/`@DataJpaTest`/`@SpringBootTest`, MockMvc) + Mockito + spring-security-test + Testcontainers
- Unit tests: `src/test/java/` mirroring source package
- Patterns: REST controller (MockMvc) tests, service tests, JPA repository (`@DataJpaTest`) tests

### Adobe App Builder — engine `app-builder`
- Test framework: Jest (mocked `@adobe/aio-sdk` + global `fetch`, Istanbul coverage)
- Single framework tag: `js`; `--frameworks`/`--strategy` are ignored
- Patterns: I/O Runtime action tests, event-handler tests, API Mesh resolver tests

### Edge Delivery Services (EDS) — engine `eds`
- Test framework: Jest + jsdom + Babel
- Unit tests: `test/` directories
- Patterns: Block `decorate()` tests, DOM manipulation tests, fetch mock tests

### EDS + Commerce — engine `eds-commerce`
- Combines EDS test patterns with Commerce drop-in mocking (Jest + jsdom + Babel + mocked `@dropins` / `configs.js` / `fetch`)
- Additional: drop-in component tests, Commerce API integration tests

## Output Formats

Standard outputs are written to `<project>/test-coverage-reports/` (or `--output`) via the shared
`emitStandardOutputs` (agent id `test-coverage`):

- **Coverage Report:** standardized Excel workbook named `test-coverage-<branch>-<timestamp>-agent-report.xlsx` — Summary sheet (15-column contract) + Input-Traceability sheet + a Run-Info sheet carrying `Coverage %`, `Coverage source` (`estimate (filename match)` or `real (<tool>)`), `Tested Files`, `Total Source Files`
- **Markdown report:** `test-coverage-<branch>-<timestamp>-agent-report.md` — git-diffable twin of the Excel findings
- **CHANGE-LOG.md:** appended at `<projectRoot>/CHANGE-LOG.md` with a one-line summary — `Coverage analysis: N% (tested/total files); K gap(s).`
- **Generated Tests:** source files placed in the pack's test directories — written by you (the LLM), not the CLI
- **Optional standard git branch:** `dca/test-coverage-<stack>-<timestamp>` cut from production/main/master/develop, only when `--create-branch` is passed

## Commands Reference

| Trigger | Action |
|---------|--------|
| `analyze test coverage` | Tier 1 — gap analysis only |
| `analyze coverage --run-coverage` | Tier 1 + run the project coverage tool for real line/branch % |
| `analyze coverage --interactive` | Tier 1 with guided framework/strategy prompt (Commerce only) |
| `analyze coverage --frameworks unit,mftf` | Tier 1 scoped to specific frameworks (Commerce only) |
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
| `--engine <engine>` | One of: aem, commerce, commerce-saas, sling, spring, app-builder, eds, eds-commerce (auto-detect if omitted) |
| `--name <name>` | Report title / project name override |
| `--module <name>` | Scope to specific module/package (Commerce `app/code/<module>`) |
| `--output <dir>` | Output directory for reports (default `<project>/test-coverage-reports`) |
| `--frameworks <list>` | Comma-separated: unit,integration,mftf,api-functional,js,static,performance — **Commerce only** |
| `--strategy <strategy>` | Detection: filename, namespace, annotation, all (default: all) — **Commerce only** |
| `--interactive` | Prompt which frameworks/strategy to use — **Commerce only** |
| `--coverage-report <file>` | Parse an existing JaCoCo/Istanbul/LCOV/Clover report for real line/branch % |
| `--run-coverage` | Run the project's coverage tool first (Maven/Gradle JaCoCo, Jest/nyc/c8, PHPUnit-clover), then parse it |
| `--create-branch` | Cut standard branch `dca/test-coverage-<stack>-<timestamp>` before writing outputs |
| `--source-branch <name>` | Source branch for `--create-branch` (default candidates: production, main, master, develop) |
| `--preflight` | Print the model/context + STATIC/LLM/HYBRID advisory and exit |
| `--no-preflight` | Suppress the preflight advisory that otherwise prints on every run |
| `--role <code>` | Role adaptation: `ea|tl|de|qa|devops|security|pm|ba|migration|content`. Persisted at `<project>/.bmad/role.yaml`; `--role` wins for a single run. See **Role-aware behavior** above. |
| `--list-engines` | List available engines |
| `--help` | Print usage and exit |
