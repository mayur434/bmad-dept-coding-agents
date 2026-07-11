---
name: bmad-dept-code-audit-agent
description: "Two-tier code auditor — the Audit agent of the 4-agent BMAD DEPT Code Agent suite (audit, generation, impact-analysis, test-coverage). Tier 1: deterministic TypeScript/Node.js static analysis (tree-sitter AST + regex, zero tokens) across 8 stacks — Commerce (PaaS), Sling/Shaft, Spring Boot, App Builder, Commerce SaaS, AEM (AEMaaCS + AMS), EDS, and EDS+Commerce. Tier 2: LLM-driven deep semantic analysis via per-stack rule packs. Emits a standardized Excel report + Markdown twin + CHANGE-LOG."
---

# BMAD DEPT Code Agent — Audit Skill

## Purpose

The **Audit** agent — one of the four agents in the BMAD DEPT Code Agent suite (audit, generation, impact-analysis, test-coverage). It is a two-tier code audit system spanning **8 stacks**:

- **AEM** — AEM as a Cloud Service (AEMaaCS) + AEM AMS
- **Adobe Commerce (PaaS)** — Magento 2
- **Adobe Commerce SaaS** — Catalog Service / Live Search / storefront drop-ins
- **Apache Sling / Shaft** (sling-12)
- **Spring Boot** custom middleware
- **Adobe App Builder** — I/O Runtime, API Mesh, Commerce UI Extensibility, AEM UI Extensibility
- **Edge Delivery Services (EDS)**
- **EDS + Commerce** hybrid

> The former standalone `scan-agent` has been retired. Its deterministic-scan capability now lives here as this agent's **Scan Only** action (Tier 1 only).

### Tier 1 — Deterministic Static Analysis (TypeScript/Node.js)

Fast, reproducible scan using `scripts/run.ts` — tree-sitter AST + regex, **zero tokens**. Auto-detects the stack (or takes `--engine`) and emits the standardized workbook. The four **new** engines (sling, spring, app-builder, commerce-saas) are built natively on the shared tree-sitter harness and emit **only** the standardized report; the four **legacy** engines (aem, commerce, eds, eds-commerce) keep their original regex scanner plus an AST precision pass and **also** emit the standardized report — so a legacy run writes two `.xlsx` files.

The **Commerce** engine additionally accepts optional inputs for a richer run:
- Database dump analysis (`--db`, schema/indexes/integrity)
- BRD impact analysis (`--brd`, repeatable)
- Bug cascade & severity analysis (`--bugs`, from `.xlsx` bug reports)
- Patch/upgrade breaking-change analysis (configured in `config.json`)

**Invocation:** `npx ts-node scripts/run.ts --path <PROJECT_ROOT>`

### Tier 2 — LLM Deep Semantic Analysis

AI-driven analysis using rule packs and detection strategy. Catches what scripts cannot:
- Architectural anti-patterns and design violations
- Cross-file data flow issues (unsanitized input propagation)
- Business logic correctness problems
- Contextual performance issues (N+1 across multiple endpoints)
- Configuration consistency (code expects config that doesn't exist)

**Invocation:** Activated via BMAD skill workflow (rule packs + detection strategy)

## Activation

This skill activates when the user asks to:
- Audit project code
- Scan a project (code scan, quick scan)
- Review code quality for AEM/Commerce/EDS projects
- Analyze architecture compliance
- Check for anti-patterns or violations
- Generate a code audit report
- Audit an App Builder application or extension
- Review API Mesh configuration
- Audit Commerce Admin UI extension
- Audit AEM UI extension
- Run a static analysis scan
- Analyze with DB dump / database schema
- Run BRD impact analysis
- Analyze bug reports / bug cascade
- Analyze patch upgrade impact
- Export audit findings

## Preflight — report the user's LLM & recommend a mode (do this first, conversationally)

The moment this command is triggered from an AI assistant (GitHub Copilot, Claude, Cursor, or any LLM), run the
preflight and tell the user — in one line — **which LLM they're on** and **whether to lean on the Static engine
or the LLM**:

```bash
npx ts-node scripts/run.ts --path {project} [--engine {engine}] --preflight
```

It prints the detected **model + context window**, the **project size** (files/LOC/tokens), the **fit** (% of the
window), and a **recommendation** — **STATIC** (Tier-1 deterministic engine) when the project is large, **LLM**
(Tier-2 semantic) when it comfortably fits, or **HYBRID**. Surface it like:
*"You're on `<model>` (~`<ctx>` context). This project is ~`<pct>%` of your window → I recommend **<mode>**. Proceed?"*
then run the full command (the advisory also prints on every normal run unless `--no-preflight`).

**Rule of thumb:** always run the Static (Tier-1) engine to scan — it's deterministic, repeatable, and costs no
tokens — and use the LLM (Tier-2) to interpret/deepen the findings. Lean more on the LLM only when the project fits the window.

## Pre-flight: Auto-install Dependencies

Before running any audit, check if Node dependencies are installed. If not, install them automatically:

```bash
# Check and install (works on macOS, Linux, Windows WSL)
cd .claude/skills/bmad-dept-code-audit-agent/scripts && [ -d node_modules ] || npm install --silent
```

Do NOT ask the user for permission to install these — they are required for the scanner to function. Just install silently if missing.

## Consent: Ask Audit Mode

**Direct-intent triggers (skip the question, go straight to that mode):**
- "scan my project" / "run scanner" / "quick scan" / "scan with DB" / "scan with BRD" / "scan with bugs" / "analyze patch" → Tier 1 (Scanner)
- "deep audit" / "LLM analysis" / "semantic audit" → Tier 2 (LLM)
- "full audit" / "complete audit" → Tier 1 + Tier 2

**Ambiguous triggers (ask which mode):**
- "audit my project" / "run code review" / "check my code" / "review code quality"

When the intent is ambiguous, ask using the interactive question picker (options UI). Use the `vscode_askQuestions` tool with these options:

```
question: "How deep should I look?"
options:
  - label: "Quick review"
    description: "I'll check your code against best practices and give you a report in seconds. Barely uses any tokens (~1.5K)."
    recommended: true
  - label: "Deep review"
    description: "I'll reason through your architecture and logic to find subtle issues. Uses ~15K tokens."
  - label: "Everything"
    description: "Quick review first, then I'll dig deeper into what I find. Uses ~25K tokens."
```

**Important:** Always recommend "Quick review" as default. It produces the same structured report with near-zero token cost. Only suggest deeper modes when the user needs semantic/architectural insights that rules can't catch.

Proceed with the user's chosen mode.

## Prompt → CLI Resolution (Tier 1)

When the user triggers a Tier 1 scan, build the CLI command by extracting parameters from their natural language prompt. The base command is:

```
npx ts-node {this_skill_path}/scripts/run.ts [flags]
```

### Flag Resolution Rules

| User says... | Flag | Value |
|--------------|------|-------|
| _(always)_ | `--path` | Current workspace root (auto-detect) |
| _(always)_ | `--engine` | Auto-detect from project signals, or from user's mention of "commerce" / "AEM" / "EDS" |
| "name it X" / "call it X" / "project name X" | `--name` | Extract quoted or mentioned name |
| "DB dump at /path" / "database /path" / "with DB" | `--db` | Extract file path (Commerce engine). If user says "with database" but no path → **ask for path** |
| "BRD from /path" / "requirements /path" / "with BRD" | `--brd` | Extract file path (Commerce engine). Repeatable. If no path → **ask** |
| "bug report /path" / "bugs /path" / "with bugs" | `--bugs` | Extract file path (.xlsx, Commerce engine). If no path → **ask** |
| "only X module" / "scan X and Y modules" | `--module` | Comma-separated module names (aem/commerce engines) |
| "only X namespace" / "Custom namespace" | `--namespace` | Namespace string (Commerce engine) |
| "skip code audit" / "BRD only" / "just BRD" | `--no-code-audit` | Flag set (no value) — Commerce engine |
| "export JSON" / "JSON output" / "for CI" / "machine-readable" | `--json` | Flag set (no value) — aem/commerce engines |
| "output to /dir" / "save report at /dir" | `--output` | Directory path |
| "as markdown" / "as PDF" / "all formats" | `--format` | `excel` \| `md` \| `pdf` \| `all` (honored by the AEM legacy report; default `excel`) |
| "AEMaaCS rules" / "AMS rules" / "cloud vs AMS" | `--platform` | `aemcs` \| `aemams` \| `both` (AEM engine only; else auto-detected) |
| "cut a working branch" / "on a new branch" | `--create-branch` | Flag set — cuts `dca/audit-<stack>-<timestamp>` before writing outputs |
| "branch from production/main" | `--source-branch` | Branch name to cut from (default tries production, main, master, develop) |

### Compound Resolution

When a single prompt mentions multiple inputs, combine all matched flags into one command:

- "full audit named Client X with DB at /db.sql and BRD at /spec.docx"
  → `--name "Client X" --db /db.sql --brd /spec.docx`
- "scan Checkout module, include bugs from /bugs.xlsx, output JSON"
  → `--module Checkout --bugs /bugs.xlsx --json`
- "audit Payment namespace with database from /prod.sql"
  → `--namespace Payment --db /prod.sql`

### Missing Required Info — Ask (don't guess)

| When user says... | What to ask |
|-------------------|-------------|
| "scan with database" (no path) | "Please provide the path to your DB dump file (.sql)" |
| "run BRD analysis" (no path) | "Please provide the path to your BRD document (.docx/.txt)" |
| "scan with bugs" (no path) | "Please provide the path to your bug report (.xlsx)" |
| "scan" but project path unclear | "Which project directory should I scan? Current workspace?" |
| "analyze patch upgrade" (no versions) | "Please provide the from and to versions (e.g., 2.4.7-p7 → 2.4.7-p9)" |

### Patch Analysis (Config-Based)

Patch analysis is configured via `config.json`, not CLI flags. When the user says "analyze patch upgrade from X to Y":

1. Read `{this_skill_path}/scripts/engines/commerce/config.json`
2. Set `analysis.patch.enabled = true`, `analysis.patch.from_version = "X"`, `analysis.patch.to_version = "Y"`
3. Write config back
4. Run the CLI command normally (patch will be included in the scan automatically)

Example prompt: "analyze patch upgrade impact from 2.4.7-p7 to 2.4.7-p9"
→ Update config.json patch section, then run: `npx ts-node {this_skill_path}/scripts/run.ts --path {cwd} --engine commerce`

### Engine Auto-Detection (do not ask unless ambiguous)

| Project signal | Engine |
|----------------|--------|
| `composer.json` with `magento/` or `app/code/` | `commerce` |
| `ui.apps/`, `pom.xml` with AEM SDK | `aem` |
| `pom.xml`/`bnd` with `org.apache.sling`/`org.apache.felix` (or Shaft/MDM/SAM markers), **no** AEM markers | `sling` |
| `spring-boot-starter`/`org.springframework.boot` in `pom.xml`/`build.gradle`, or `@SpringBootApplication` | `spring` |
| Storefront Events SDK / `Magento-Environment-Id` / `catalog-service.adobe.io` (no `app/code`) | `commerce-saas` |
| `blocks/`, `helix-query.yaml`, `fstab.yaml` | `eds` |
| EDS signals + commerce dropins | `eds-commerce` |
| `app.config.yaml`, `.aio`, `@adobe/aio-sdk` | `app-builder` |
| Cannot determine | Ask: "What platform is this? Commerce / AEM / Sling-Shaft / EDS / App Builder?" |

### Examples of Full Resolution

**User:** "scan my project"
```bash
npx ts-node {this_skill_path}/scripts/run.ts --path {cwd} --engine commerce
```

**User:** "scan my project and name it Acme, include DB dump at ./db/prod.sql"
```bash
npx ts-node {this_skill_path}/scripts/run.ts --path {cwd} --engine commerce --name "Acme" --db ./db/prod.sql
```

**User:** "run full scanner with everything — DB at /tmp/dump.sql, BRD at /docs/brd.docx, bugs at /reports/bugs.xlsx"
```bash
npx ts-node {this_skill_path}/scripts/run.ts --path {cwd} --engine commerce --db /tmp/dump.sql --brd /docs/brd.docx --bugs /reports/bugs.xlsx
```

**User:** "just run BRD analysis from /spec/requirements.docx, skip the code scan"
```bash
npx ts-node {this_skill_path}/scripts/run.ts --path {cwd} --engine commerce --no-code-audit --brd /spec/requirements.docx
```

**User:** "what engines are available?"
```bash
npx ts-node {this_skill_path}/scripts/run.ts --list-engines
```

---

## Workflow

### Mode A: Script-Only (Tier 1)

Use when the user wants a quick deterministic report (the **Scan Only** action). Build the command using the **Prompt → CLI Resolution** rules above and execute it.

Output: the standardized `audit-<branch>-<timestamp>-agent-report.xlsx` + Markdown twin, plus an appended `CHANGE-LOG.md`. New engines default the output to `<project>/audit-reports/`; legacy engines (aem, commerce, eds, eds-commerce) additionally write their own platform-specific multi-sheet Excel.

### Mode B: Deep Analysis (Tier 2)

Use when the user wants semantic/architectural analysis:

### Mode C: Full Audit (Tier 1 + Tier 2)

Recommended for comprehensive audits:

1. Run Tier 1 → produces Excel with deterministic findings
2. Load `resources/shared/scanner-llm-crossref.md` to determine LLM action per category
3. For **SKIP** categories → keep scanner findings as-is (no LLM re-analysis)
4. For **DEEPEN** categories → feed high-severity scanner findings to LLM with rule context for root-cause and cross-file enrichment
5. For **VERIFY** categories → LLM confirms true positives, dismisses false positives
6. For **EXPAND** categories → LLM runs full semantic analysis (business logic, cross-module flow) independent of scanner
7. Deduplicate: same file+line from both tiers → merge into single finding using LLM rule ID
8. Combined output: Excel report + AI-driven narrative report

### Step 1: Detect Project Type

Scan the workspace to determine which Adobe platform(s) are in use:

| Platform | Detection Signals |
|----------|------------------|
| AEMaaCS | `ui.apps/`, `ui.content/`, `core/`, `all/`, `pom.xml` with AEM SDK dependency |
| Sling-12 / Shaft | `pom.xml`/`bnd.bnd` with `org.apache.sling`/`org.apache.felix`/feature-model, or Shaft/MDM/SAM markers — and **no** AEM markers (ui.apps, aem-sdk, uber-jar) |
| Spring Boot | `spring-boot-starter*`/`org.springframework.boot` in `pom.xml` or `build.gradle(.kts)`, or `@SpringBootApplication` in sources |
| Commerce | `app/code/`, `composer.json` with `magento/`, `etc/module.xml` |
| Commerce SaaS | `@adobe/magento-storefront-event*`, `Magento-Environment-Id`, `catalog-service.adobe.io`/`commerce.adobe.io`, Live Search — and **no** `app/code` |
| EDS | `scripts/`, `blocks/`, `helix-query.yaml`, `fstab.yaml`, `paths.json` |
| EDS+Commerce | EDS signals + Commerce dropin references, `commerce-`/`product-` prefixed blocks |
| App Builder | `app.config.yaml`, `.aio` file, `@adobe/aio-sdk` in `package.json`, `dx/excshell/1` or `dx/asset-compute/worker/1` in config |
| App Builder — Commerce UI Ext | `commerce/backend-ui/1` in `app.config.yaml`, `@adobe/uix-guest` in `package.json` |
| App Builder — AEM UI Ext | `aem/cf-console-admin/1`, `aem/cf-editor/1`, `aem/universal-editor/1`, `aem/experience-hub/1`, or `aem/assets-view/1` in config |
| App Builder — API Mesh | `meshConfig` in JSON files, `aio api-mesh` usage |
### Step 2: Load Applicable Rule Pack(s)

Based on detected platform, load rules from `resources/rule-packs/<platform>/`.

| Platform | Rule pack files |
|----------|----------------|
| AEMaaCS | `rule-packs/aemcs/` |
| AEM AMS | `rule-packs/aemams/` |
| Sling-12 / Shaft | `rule-packs/sling-shaft/` (Tier-1 AST engine at `scripts/engines/sling/`) |
| Spring Boot | `rule-packs/spring-boot/` (Tier-1 AST + config engine at `scripts/engines/spring/`) |
| Commerce | `rule-packs/commerce/` |
| Commerce SaaS | `rule-packs/commerce-saas/` (Tier-1 JS + config engine at `scripts/engines/commerce-saas/`) |
| EDS | `rule-packs/eds/` |
| EDS+Commerce | `rule-packs/eds-commerce/` |
| App Builder (core) | `rule-packs/app-builder/rules.md` |
| App Builder — Commerce UI | `rule-packs/app-builder/rules.md` + `rule-packs/app-builder/commerce-ui-extensibility-rules.md` |
| App Builder — AEM UI | `rule-packs/app-builder/rules.md` + `rule-packs/app-builder/aem-ui-extensibility-rules.md` |

For hybrid projects (e.g., EDS+Commerce, or App Builder with multiple extension types), load multiple rule packs and apply intersection logic.

### Step 3: Deep Analysis

Use the multi-pass analysis strategy defined in `resources/shared/detection-strategy.md`:

#### Pass 1 — Structural Scan
- Map project topology: packages, modules, configs, deployment artifacts
- Identify dependency graph and module boundaries
- Flag structural violations (misplaced files, missing manifests, circular deps)

#### Pass 2 — Pattern Matching
For each file in scope, apply platform-specific rules from the loaded rule pack:
- Match **bad code examples** against actual source (regex + semantic)
- Compare against **good code examples** to confirm it's truly violating
- Check **false positive conditions** to avoid noise
- Note **related rules** that should also be checked in the same context

#### Pass 3 — Cross-File & Contextual Analysis
- Trace data flow across files (e.g., unsanitized input flowing to output)
- Check configuration consistency (code expects config that doesn't exist)
- Validate inter-module contracts (declared dependencies vs actual usage)
- Assess cumulative patterns (e.g., N+1 query across multiple endpoints)

#### Pass 4 — Scoring & Correlation
1. Score severity using `resources/shared/severity-model.md`
2. Calculate confidence using `resources/shared/confidence-scoring.md`
3. Assess impact using `resources/shared/impact-analysis.md`
4. Correlate related findings (group root causes, deduplicate symptoms)
5. Identify systemic patterns (same mistake repeated = architectural issue)

### Step 4: Generate Report

The primary deliverable is the standardized workbook `audit-<branch>-<timestamp>-agent-report.xlsx` (with its Markdown twin and an appended `CHANGE-LOG.md`), emitted by the shared output layer. The legacy narrative templates under `templates/` (`report-markdown.md`, `report-json.md`) remain available as optional Tier-2 documentation aids for shaping the LLM's written summary — they are not the main report.

### Step 5: Actionable Recommendations

Beyond findings, generate:
- Prioritized remediation roadmap (fix order considering dependencies between findings)
- Quick wins list (high-impact, low-effort fixes)
- Architecture improvement suggestions (when systemic patterns detected)
- Upgrade path warnings (deprecated APIs with timeline)

## Configuration

Module-level settings (from `module.yaml`):

| Setting | Purpose | Default |
|---------|---------|---------|
| `audit_output` | Where audit reports are stored | `{output_folder}/audit-reports` |
| `audit_engine` | Default engine (or `auto` to auto-detect) | `auto` |
| `audit_namespace` | Custom module namespace for Commerce projects | `Custom` |

Engine-level configuration lives in `scripts/engines/commerce/config.json` (Commerce thresholds and patch-upgrade analysis; see **Patch Analysis** above). Other engines take their behavior from CLI flags.

## Tools Required

- `claude-code` — For code analysis and pattern matching

## Output

Every run emits the standardized outputs via the shared output layer:

- **`audit-<branch>-<timestamp>-agent-report.xlsx`** — sheets in fixed order: Run Info, Summary, Severity Breakdown, By Category, Recommendations (when present). The Summary sheet is the 15-column contract: ID, Title, Description, Tech Stack, Category / Module, Code Reference, Severity, Confidence, Rule ID, Recommendation / Fix, Impact Analysis, Effort, Dev Comments, Owner, Status.
- **`audit-<branch>-<timestamp>-agent-report.md`** — a git-diffable Markdown twin (reduced Summary table).
- **`CHANGE-LOG.md`** — appended at the project root with agent/stack/branches/timestamp, severity counts, and the report filename.
- **Optional standard branch** `dca/audit-<stack>-<timestamp>` — cut from production/main/master/develop only when `--create-branch` is passed.
- **Legacy engines only** (aem, commerce, eds, eds-commerce) additionally write their own platform-specific multi-sheet Excel (and `.md`/`.pdf`/`.json` via `--format`/`--json`).

Each finding carries: location, rule violated, severity, confidence, remediation, impact, and effort — grouped by severity and category, with platform-specific recommendations.

## Post-Audit Actions

After an audit has been run (Excel or markdown report exists), the user may ask follow-up questions. Handle these by reading the generated report and responding:

| User prompt | Action |
|-------------|--------|
| "summarize the audit findings" | Read the latest report, provide executive summary |
| "show me all CRITICAL severity items" | Filter findings by CRITICAL, list them |
| "what are the top 10 highest-risk findings?" | Sort by risk score, show top 10 |
| "which modules have the most issues?" | Group findings by module, rank by count |
| "create a fix plan for the critical items" | Generate prioritized remediation steps for CRITICAL findings |
| "estimate effort to fix all HIGH and CRITICAL findings" | Analyze findings complexity, provide time estimates |
| "export findings as JSON" | Re-run with `--json` flag or convert existing report |
| "show current audit config" | Read and display `config.json` |
| "update thresholds: god_class_lines=600, fat_constructor_deps=12" | Update `config.json` thresholds section |

**Report location:** Look for the latest `audit-<branch>-<timestamp>-agent-report.xlsx` (or its `.md` twin) in the configured `audit_output` directory — by default `{project-root}/audit-reports/` (new engines) or the engine's `--output` directory. The appended `CHANGE-LOG.md` at the project root also lists every report by filename.
