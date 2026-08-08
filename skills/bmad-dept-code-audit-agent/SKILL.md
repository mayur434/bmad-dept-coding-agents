---
name: bmad-dept-code-audit-agent
description: "Two-tier code auditor — the Audit agent of the 5-agent BMAD DEPT Code Agent suite (audit, generation, impact-analysis, sonar-scan, test-coverage). Tier 1: deterministic TypeScript/Node.js static analysis (tree-sitter AST + regex, zero tokens) across 8 stacks — AEM (AEMaaCS + AMS), Commerce (PaaS), Commerce SaaS, Sling/Shaft, Spring Boot, App Builder, EDS, and EDS+Commerce. Tier 2: LLM-driven deep semantic analysis via per-stack rule packs. Emits a standardized Excel report + Markdown twin + CHANGE-LOG."
---

# BMAD DEPT Code Agent — Audit Skill

## Purpose

The **Audit** agent — one of the five agents in the BMAD DEPT Code Agent suite (audit, generation, impact-analysis, sonar-scan, test-coverage). It is a two-tier code audit system spanning **8 stacks**:

- **AEM** — AEM as a Cloud Service (AEMaaCS) + AEM AMS
- **Adobe Commerce (PaaS)** — Magento 2
- **Adobe Commerce SaaS** — Catalog Service / Live Search / storefront drop-ins
- **Apache Sling / Shaft** (sling-12)
- **Spring Boot** custom middleware
- **Adobe App Builder** — I/O Runtime, API Mesh, Commerce UI Extensibility, AEM UI Extensibility
- **Edge Delivery Services (EDS)**
- **EDS + Commerce** hybrid

> The former standalone deterministic `scan-agent` has been retired — its capability now lives here as this agent's **Scan Only** action (Tier 1 only). Note: this is distinct from the new LLM-driven **sonar-scan agent** (`bmad-dept-code-sonar-scan-agent`), which is a separate agent in the suite that performs SonarQube-style quality analysis (Bugs / Vulnerabilities / Security Hotspots / Code Smells / Duplications / Complexity) and emits a Quality Gate.

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

## Intake mode (interactive vs technical)

> **For fast, enterprise-grade execution, prefer One-shot mode (see below).** Intake mode is for exploratory / first-time users.

> **CRITICAL:** The very first response to any activation must be the intake-mode question — unless `.bmad/intake.yaml` exists with a saved preference. Do NOT skip this. Do NOT show a CLI command as the first response.

When a user triggers this agent — via a natural-language prompt or a menu entry — do NOT show or run a raw CLI command as the first response. Ask which drive style they prefer:

> "Should I drive this **interactively** (I ask you step-by-step questions and run everything for you) or **technically** (I show you the CLI command with each flag explained, and you decide whether to run it or have me run it)?"

Save the answer to `.bmad/intake.yaml` (adjacent to `.bmad/role.yaml`) with keys `mode: interactive|technical` and `set_at: <ISO-8601>`. On subsequent runs, read the file silently and skip the prompt unless the user asks to switch.

To change intake mode later, the user says **"switch intake to interactive"** or **"switch intake to technical"** — overwrite `.bmad/intake.yaml` with the new choice.

**Sequencing note.** The `Preflight` (LLM/context advisory) and the `Pre-flight: Auto-install Dependencies` bootstrap sections below must NOT run before the intake picker resolves. Order for a fresh activation:
1. Resolve intake mode (ask, or read `.bmad/intake.yaml`).
2. If technical → show the command + flag explanations, then run it (with the user's OK) or hand off.
3. If interactive → collect the intake questions below, then run silently.
4. Preflight + bootstrap run just before dispatch, once inputs are collected.

### Interactive mode (recommended for first-timers)

Ask one question per turn, in this order. Skip any question the user has already answered in their initial prompt.

1. "What's the project path? (defaults to current working directory)"
2. "Which stack? (auto-detect / `aem` / `commerce` / `commerce-saas` / `sling` / `spring` / `app-builder` / `eds` / `eds-commerce`)"
3. "Full audit (deterministic scan + LLM), scan-only (fast Tier-1), or deep-audit (LLM only)?"
4. "Any extra inputs? (BRD `.docx` path / bug CSV path / DB `.sql` dump path — press Enter to skip)"
5. "Cut a working branch from production? (Y/n)"
6. "Ready to run? (Y/n)"

Once every required input is collected, run the command internally (do NOT show it unless the user asks) and stream the results back conversationally:
> "Scanning your project…" → "Found 42 findings (12 CRITICAL, 30 HIGH)…" → "Report saved to `audit-reports/audit-main-20260801_120000-agent-report.xlsx`. Want me to summarize the CRITICAL items?"

### Technical mode (for users who want CLI transparency)

Show the fully-formed command in a `bash` code block with one flag per line:

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --path /path/to/project \
  --engine auto \
  --create-branch --source-branch production \
  --preflight
```

Below the block, add a bulleted list explaining each flag in plain English:

- `--path` — the project root to audit; the folder the scanner will walk.
- `--engine auto` — auto-detect the stack from project signals; pass an explicit engine ID to override.
- `--create-branch --source-branch production` — cut a working `dca/audit-<stack>-<timestamp>` branch from `production` before writing any outputs.
- `--preflight` — show the LLM/context-window advisor before dispatch so the user can see the mode recommendation.

Then ask: **"Want me to run this now, or will you copy-paste it?"**

- If **run for me** → execute silently and stream results (same as interactive mode).
- If **I'll run it** → acknowledge, and remind them: "Report will land in `<project>/audit-reports/`. Come back with 'summarize the findings' when you're done."

## One-shot mode

The **preferred enterprise path.** When the user's initial prompt fully specifies what to run, do NOT ask any clarifying questions — execute end-to-end, stream results, done. Use defaults from `.bmad/role.yaml`, `.bmad/intake.yaml`, `.bmad/conventions.yaml`, and reasonable stack auto-detection to fill missing inputs.

### When to enter one-shot mode

Trigger phrases (any of):
- "run the audit end-to-end", "no questions, just do it", "one-shot", "just run", "auto"
- OR any prompt that specifies: (a) the operation, (b) the project path (default: cwd), (c) the primary input (BRD/CSV/type/name/etc)

You DO NOT need every field explicitly — role + intake + conventions cover the rest silently.

### Precedence for missing inputs

1. **Explicit in the user's prompt** (highest — always wins)
2. **`--flag` on run.ts** (headless / CI)
3. **`.bmad/role.yaml`** (role-driven default: mode + output flavor + follow-up)
4. **`.bmad/intake.yaml`** (interactive vs technical preference — one-shot forces technical + skip)
5. **`.bmad/conventions.yaml`** (project conventions: naming, packages, house rules)
6. **Auto-detected** (stack from repo signatures, coverage report from standard paths)
7. **Sensible defaults** (see per-agent list below)

### What one-shot DOES silence

- The intake picker ("Interactive or Technical?") — one-shot forces technical.
- The mode picker ("Full / Scan Only / Deep?") — resolved from role default.
- The consent picker ("What's connected vs What could break?" for Impact; "gaps only / write tests / full" for Test Coverage) — resolved from role default.
- The role picker (if `.bmad/role.yaml` absent) — one-shot uses `generic` role silently (log to stderr: "one-shot: no role file, defaulting to generic").
- The confirmation prompts around `--create-branch`, `--yes-install`, etc. — one-shot assumes yes for install (auto-install), no for branch cut unless the user's prompt or CLI says otherwise.

### What one-shot DOES ask about (only when truly critical)

- **Audit** — all required inputs can be resolved silently from role + auto-detection + defaults. One-shot proceeds without asking.

### One-shot prompt examples for the Audit agent

Each example shows what the user pastes and what the AI silently resolves.

> **User:** "audit my project"
> **AI silently resolves:** path=cwd, engine=auto-detect, role=(from `.bmad/role.yaml` or `generic`), mode=(from role default — e.g. Full for `qa`, Scan Only for `de`), sla-path=`.bmad/sla.yaml`, decisions-path=`.bmad/decisions.yaml`, output-dir=`audit-reports/`.
> **AI runs:** `npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts --path <cwd> --technical --no-preflight --yes-install`
> **AI reports:** "Scanning… found 42 findings (5 CRITICAL, 12 HIGH). Report: `audit-main-…-agent-report.xlsx`. Want me to summarize?"

> **User:** "audit my project as security, fail on overdue"
> **AI silently resolves:** role=`security` (per-run override, no write to `.bmad/role.yaml`), mode=Full, output flavor=technical XLSX with security emphasis, `--fail-on-overdue` on for the SLA gate.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --role security --technical --fail-on-overdue --no-preflight --yes-install`
> **AI reports:** severity breakdown + SLA breach count + non-zero exit code if any overdue.

> **User:** "scan-only my project, no LLM (fast Tier 1)"
> **AI silently resolves:** mode=`scan-only` (overrides role default), engine=auto-detect.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --mode scan-only --technical --no-preflight --yes-install`
> **AI reports:** "Tier-1 findings only: 28 items. Report: … Want to escalate to Full Audit?"

> **User:** "deep audit /path/to/aem-project on the release branch"
> **AI silently resolves:** path=`/path/to/aem-project`, engine=`aem` (from path signature), mode=`deep-audit`, `--source-branch release --create-branch`.
> **AI runs:** `npx ts-node .../run.ts --path /path/to/aem-project --engine aem --mode deep-audit --create-branch --source-branch release --technical --no-preflight --yes-install`
> **AI reports:** working branch cut, deep-audit summary streamed live.

> **User:** "audit my commerce project with DB dump at ./prod.sql and bugs at ./bugs.csv"
> **AI silently resolves:** engine=`commerce`, `--db ./prod.sql`, `--bugs ./bugs.csv`, mode from role default.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --engine commerce --db ./prod.sql --bugs ./bugs.csv --technical --no-preflight --yes-install`
> **AI reports:** findings + DB-schema-linked issues + bug cascade summary.

> **User:** "audit since main — show me only the new findings"
> **AI silently resolves:** `--since main` for regression/delta scope, mode=Full.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --since main --technical --no-preflight --yes-install`
> **AI reports:** delta findings vs. `main` only.

### After one-shot execution

Always:
- Print a one-line summary (findings count, severity breakdown, report path).
- Print the recommended follow-up from the role matrix (e.g. Security role after audit → "sonar scan for deeper vulnerability analysis").
- Do NOT ask "want me to run the follow-up?" — user will ask if they do.

Never:
- Ask what mode they wanted after the fact.
- Ask if they want to save preferences.
- Explain what you did (unless they ask).

### CLI equivalent for one-shot (technical mode)

Every one-shot prompt has a direct CLI equivalent using all Phase 1 flags:

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --path . \
  --role <code> \
  --technical \
  --yes-install \
  --no-preflight \
  --sla-path .bmad/sla.yaml \
  --decisions-path .bmad/decisions.yaml
```

Add `--fail-on-overdue` for CI gates, `--include-decided` to bypass decisions, `--create-branch` for a working branch.

## Role-aware behavior

The Audit agent adapts its **default mode**, **output flavor**, and **recommended follow-up** to the role of the person driving the run. Role selection is a **shared** concept across the 5-agent DCA suite and is persisted per-project at `<projectRoot>/.bmad/role.yaml` (see `skills/shared/role/ROLES.md`).

### Role check on activation

**Before running any mode**, the AI agent MUST perform the role handshake:

1. **Check for `<projectRoot>/.bmad/role.yaml`.**
2. **If ABSENT**, ask the user — verbatim:
   > "Which role best matches how you'll use this plugin? Pick one from the 10 codes below (or say 'generic' to skip):"
   Then list the **6 promoted roles** first, each with a one-line description:
   - `ea` — Enterprise Architect: cross-cutting architecture across Adobe/JVM estates; portfolio-level health, risk, modernization signals.
   - `tl` — Tech Lead / Solution Architect: component-level design review, generation scaffolds, impact blast-radius.
   - `de` — Senior Delivery Engineer: sprint delivery; scaffolds, coverage gaps, Jira-ready audit tickets.
   - `qa` — QA / SDET: coverage gaps, impact-driven regression scope, audit-to-test-surface mapping.
   - `devops` — DevOps / SRE: SARIF-shaped scan output for CI gates; infra/pipeline scaffolds.
   - `security` — Security Engineer: deep sonar-scan + audit focused on vulnerability classes and remediation.

   Then list the **4 additional roles**:
   - `pm` — Product Manager / PMO: executive-shape audit/impact framed as scope, effort, portfolio risk.
   - `ba` — Business Analyst: impact-analysis as feature/flow-level change summaries.
   - `migration` — Migration/Upgrade Lead: upgrade baselines, deprecated-API impact, legacy coverage.
   - `content` — Content/CMS Engineer: AEM/EDS content-surface scaffolds and content-scoped audit.

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

5. **Per-run override**: the user can override for a single run by prefixing their prompt with **"as `<role>`"** (e.g. *"as security, audit my project"*) or by passing **`--role=<code>`** to `scripts/run.ts`. Do NOT write `.bmad/role.yaml` when the role is overridden this way.

6. **Permanent change**: if the user says **"switch role to `<code>`"**, overwrite `.bmad/role.yaml` with the new code (same `writeRoleFile` call, `set_by: interactive`).

### Role → Audit behavior matrix

| Role | Default mode when ambiguous | Output flavor | Recommended follow-up |
|---|---|---|---|
| `ea` | **Deep Audit**, architecture-focused (skip low-severity code smells) | Executive Markdown summary + technical XLSX | "generate architecture roadmap" |
| `tl` | **Deep Audit** (full) | Technical XLSX | "impact-analyze the top 5 findings" |
| `de` | **Scan Only** (fast Tier 1) | Jira-ready CSV + technical XLSX | "generate fixes for CRITICAL findings" |
| `qa` | **Full Audit** | Technical XLSX | "test-coverage the impacted files" |
| `devops` | **Scan Only** | SARIF export + XLSX | "wire audit into CI as a gate" |
| `security` | **Full Audit**, Vulnerability + Security Hotspot rows highlighted; enrich with CWE/OWASP tags | Technical XLSX with security emphasis | "sonar scan for deeper vulnerability analysis" |
| `pm` | **Scan Only** | Executive Markdown, top-10 findings only | "summarize CRITICAL findings for the release note" |
| `ba` | **Scan Only** | Executive Markdown | "map findings to BRD requirements" |
| `migration` | **Full Audit** + patch-upgrade analysis (Commerce) or platform-upgrade rules (AEM) | Technical XLSX with deprecated-API section highlighted | "impact + coverage delta between versions" |
| `content` | **Scan Only**, focus on AEM/EDS content-related rule packs | Technical XLSX | "generate content-fragment or block scaffold" |
| `generic` | **Full Audit** (current default) | Standard XLSX + MD | "summarize findings" |

**Output flavors — what they mean.** The `executive` flavor is a Markdown-first deliverable: top-N findings, business-impact framing, no rule-IDs; the XLSX is supplementary. The `technical` flavor is the current default look — the standard XLSX plus its Markdown twin. The `jira-csv` flavor adds a companion CSV next to the XLSX where each row is a Jira import row (columns: Summary, Description, Priority, Labels, Component). The `sarif` flavor adds a `.sarif` file suitable for GitHub code-scanning upload alongside the XLSX. The `default` flavor is today's behavior with no role-specific shaping.

**When the deterministic pipeline hasn't shipped a flavor yet** (Jira-CSV, SARIF, executive-MD): post-process the standard XLSX+MD yourself and emit the extra artifact into the same report directory. Do not block the run because a flavor generator isn't wired up.

### Cross-agent chaining hints per role

After the Audit run finishes, offer the follow-up handoff that matches the resolved role:

| Role | Next agent to invoke | Why |
|---|---|---|
| `ea` | `impact-analysis` | Roll findings up to architecture-level risk. |
| `tl` | `impact-analysis` | Blast-radius the top findings before assigning fixes. |
| `de` | `generation` | Generate fix scaffolds for CRITICAL findings. |
| `qa` | `test-coverage` | Measure coverage on the files audit flagged. |
| `devops` | `sonar-scan` | Deeper scan wired for CI gates. |
| `security` | `sonar-scan` | Deeper Vulnerability + Security Hotspot analysis. |
| `pm` | (stay in audit) | Summarize CRITICAL findings for release notes / status. |
| `ba` | `impact-analysis` | Map findings back to BRD requirements. |
| `migration` | `impact-analysis` + `test-coverage` | Cross-version impact + coverage delta. |
| `content` | `generation` | Emit content-fragment / block scaffolds. |
| `generic` | (stay in audit) | Summarize findings; ask user for next step. |

The resolved role is exposed to child engines via `process.env.DCA_ROLE` (and `DCA_ROLE_NAME` / `DCA_ROLE_FLAVOR` / `DCA_ROLE_SOURCE`), and a one-line `[dca-role] <Name> (source: <cli-flag|role-file|generic-fallback>)` is printed to stderr on every run.

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

Before ANY command execution, run the shared bootstrap. It installs the `shared/` foundation
(if missing) + this agent's `scripts/` deps in the correct order, with a one-line confirmation
prompt so the user knows what's happening. First-time cost is ~80MB / ~30–60s; subsequent
runs are silent no-ops.

**POSIX (macOS, Linux, WSL):**
```bash
bash .claude/skills/shared/bootstrap.sh audit
```

**Windows (or when sh is unavailable):**
```bash
node .claude/skills/shared/bootstrap.js audit
```

**Headless / CI mode (skip prompt):**
```bash
bash .claude/skills/shared/bootstrap.sh audit --yes    # install without asking
bash .claude/skills/shared/bootstrap.sh audit --no     # error if deps missing, don't install
```

**Behavior:**
- Both node_modules present → silent no-op (exit 0)
- Either missing → confirmation prompt, then install if approved
- User declines → exit 3, agent should tell user "Deps required. Run manually: cd .claude/skills/shared && npm install && cd ../bmad-dept-code-audit-agent/scripts && npm install"
- Install failure → exit 4, agent should surface the npm error

**Instructions to the AI:** Do NOT skip this step. The bootstrap script handles the confirmation — you do NOT need to ask the user separately. If bootstrap exits non-zero, halt and report the exit code. If your dispatcher (`run.ts`) also accepts `--yes-install`/`--no-install`, pass those to bootstrap accordingly.

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
| AEMaaCS | `rule-packs/aem/aemcs/` |
| AEM AMS | `rule-packs/aem/aemams/` |
| Sling-12 / Shaft | `rule-packs/sling/` (Tier-1 AST engine at `scripts/engines/sling/`) |
| Spring Boot | `rule-packs/spring/` (Tier-1 AST + config engine at `scripts/engines/spring/`) |
| Commerce | `rule-packs/commerce-paas/` |
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
