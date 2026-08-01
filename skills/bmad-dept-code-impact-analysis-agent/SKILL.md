---
name: bmad-dept-code-impact-analysis-agent
description: "Code impact analysis agent (part of the BMAD DEPT Code Agent 5-agent suite: audit, generation, impact-analysis, sonar-scan, test-coverage). Evaluates blast radius of changes, traces dependency chains, and assesses risk for modifications, upgrades, and patches across all 8 supported stacks (aem, commerce, commerce-saas, sling, spring, app-builder, eds, eds-commerce)."
---

# BMAD DEPT Code Agent — Impact Analysis Skill

## Purpose

One of the **5 agents** in the BMAD DEPT Code Agent suite (audit, generation, impact-analysis, sonar-scan,
test-coverage). Takes a **Proofhub bug export (CSV)** and/or a **BRD document (Word/Markdown/text)** as input,
traces each bug/requirement onto the impacted code, computes the **blast radius** (reverse dependencies), scores
risk, and emits the standardized impact report — including an **Input Traceability** sheet mapping every input
item to the code it touches. Answers "what does fixing this bug / building this requirement affect?" across the
8 supported stacks (aem, commerce, commerce-saas, sling, spring, app-builder, eds, eds-commerce).

## Activation

This skill activates when the user asks to:
- Analyze the impact of a Proofhub bug list / bug export
- Analyze the impact of a BRD / requirements document
- Check what code is affected by a set of bugs/requirements
- Evaluate blast radius of planned changes
- Trace dependencies for a change set
- List available impact analysis engines / stacks

---

## Prompt → Action Resolution

Resolve the user's natural language prompt to the correct action **before** running preflight.

### Direct-intent triggers

The first row of each entry is the **BMAD help panel prompt-template** — the pre-filled message shown when the user clicks the command. All other rows are organic conversation triggers.

| User says… | Action | Resolved flags |
|------------|--------|---------------|
| "Please analyze the impact of my Proofhub bug export at {proofhub_csv} on the project at {project_path}" _(help panel)_ | Analyze — bugs | `--bugs {proofhub_csv} --path {project_path}` |
| "analyze impact of this bug export" / "trace blast radius of my Proofhub CSV" / "what does fixing these bugs affect" / "impact analysis from bugs" | Analyze — bugs | `--bugs {bugs_csv} --path {project_path}` |
| "Please analyze the impact of my BRD at {brd_doc} on the project at {project_path}" _(help panel)_ | Analyze — BRD | `--brd {brd_doc} --path {project_path}` |
| "analyze impact of this BRD" / "requirements blast radius" / "what does building this BRD affect" / "impact from requirements document" | Analyze — BRD | `--brd {brd_doc} --path {project_path}` |
| "Please analyze the combined impact of my bug export at {proofhub_csv} and BRD at {brd_doc} on the project at {project_path}" _(help panel)_ | Analyze — bugs + BRD | `--bugs {proofhub_csv} --brd {brd_doc} --path {project_path}` |
| "analyze impact from both bugs and BRD" / "combined impact analysis" / "bugs and requirements together" | Analyze — bugs + BRD | `--bugs {bugs_csv} --brd {brd_doc} --path {project_path}` |
| "Please list all available impact analysis engines and supported stacks" _(help panel)_ | List engines | `--list-engines` |
| "list impact analysis engines" / "what stacks does impact analysis support?" / "show available engines" | List engines | `--list-engines` |

### Flag resolution rules

| User says… | Flag | Value |
|------------|------|-------|
| _(always)_ | `--path` | Current workspace root (auto-detect) |
| "bugs from /path" / "Proofhub export at /path" / "bug CSV at /path" | `--bugs` | CSV file path |
| "BRD at /path" / "requirements document /path" / "from /path.docx" | `--brd` | .docx / .md / .txt path |
| "for AEM" / "Spring project" / "Commerce project" / explicit engine name | `--engine` | stack id |
| "output to /dir" / "save report at /dir" | `--output` | Directory path |
| "cut a branch" / "on a new branch" / "create branch" | `--create-branch` | _(flag, no value)_ |
| "branch from production/main/staging" | `--source-branch` | Branch name |

### Engine auto-detection (do not ask unless ambiguous)

| Project signal | Engine |
|----------------|--------|
| `composer.json` with `magento/` or `app/code/` | `commerce-paas` |
| `ui.apps/`, `pom.xml` with AEM SDK | `aem` |
| `pom.xml`/`bnd` with `org.apache.sling`/`org.apache.felix` (no AEM markers) | `sling` |
| `spring-boot-starter` / `@SpringBootApplication` in `pom.xml` or `build.gradle` | `spring` |
| Storefront Events SDK / `catalog-service.adobe.io` (no `app/code`) | `commerce-saas` |
| `blocks/`, `helix-query.yaml`, `fstab.yaml` | `eds` |
| EDS signals + commerce dropin references | `eds-commerce` |
| `app.config.yaml`, `.aio`, `@adobe/aio-sdk` | `app-builder` |
| Cannot determine | Ask: "What platform is this? Commerce / AEM / Sling-Shaft / Spring / EDS / App Builder?" |

### Missing required info — ask (don't guess)

| When user says… | What to ask |
|-----------------|-------------|
| "analyze impact" with no file path | "Please provide the path to your Proofhub CSV and/or BRD document." |
| "analyze bugs" but no CSV path | "Please provide the path to your Proofhub CSV export." |
| "analyze BRD" but no file path | "Please provide the path to your BRD document (.docx / .md / .txt)." |
| No `--path` / project root unclear | "Which project directory should I trace impact against? Use current workspace?" |
| Stack is ambiguous | "I see markers for both [X] and [Y]. Which stack should I use?" |

### Compound resolution

Combine all matched flags from a single prompt:

- "analyze impact of bugs.csv and cut a branch" → `--bugs bugs.csv --create-branch`
- "BRD impact on Spring project, output to /reports, branch from main" → `--brd brd.docx --engine spring --output /reports --create-branch --source-branch main`
- "combined impact from bugs.csv and requirements.docx" → `--bugs bugs.csv --brd requirements.docx`
- "trace blast radius of this Proofhub export on a new branch" → `--bugs export.csv --create-branch`

### Concrete examples — one per skill entry

**`IB` — Impact from Bugs**
> _Help panel:_ "Please analyze the impact of my Proofhub bug export at `/path/to/bugs.csv` on the project at `/your/project/path`"
> _Or say:_ "analyze impact of this bug export" / "trace blast radius of my bugs" / "what does fixing these bugs affect"

Extract `{proofhub_csv}` and `{project_path}` from the message:
```bash
npx ts-node {skill_path}/scripts/run.ts --bugs {proofhub_csv} --path {project_path}
```

---

**`IR` — Impact from BRD**
> _Help panel:_ "Please analyze the impact of my BRD at `/path/to/brd.docx` on the project at `/your/project/path`"
> _Or say:_ "analyze impact of this BRD" / "requirements blast radius" / "what does building this BRD affect"

Extract `{brd_doc}` and `{project_path}`. Supports `.docx`, `.md`, `.txt`:
```bash
npx ts-node {skill_path}/scripts/run.ts --brd {brd_doc} --path {project_path}
```

---

**`IX` — Impact Bugs + BRD**
> _Help panel:_ "Please analyze the combined impact of my bug export at `/path/to/bugs.csv` and BRD at `/path/to/brd.docx` on the project at `/your/project/path`"
> _Or say:_ "analyze impact from both bugs and BRD" / "combined impact analysis" / "bugs and requirements together"

Extract `{proofhub_csv}`, `{brd_doc}`, and `{project_path}`:
```bash
npx ts-node {skill_path}/scripts/run.ts --bugs {proofhub_csv} --brd {brd_doc} --path {project_path}
```

---

**`IL` — List Engines**
> _Help panel:_ "Please list all available impact analysis engines and supported stacks"
> _Or say:_ "list impact analysis engines" / "what stacks does impact analysis support?" / "show available engines"

```bash
npx ts-node {skill_path}/scripts/run.ts --list-engines
```

---

## Intake mode (interactive vs technical)

> **CRITICAL:** The very first response to any activation must be the intake-mode question — unless `.bmad/intake.yaml` exists with a saved preference. Do NOT skip this. Do NOT show a CLI command as the first response.

When a user triggers this agent — via a natural-language prompt or a menu entry — do NOT show or run a raw CLI command as the first response. Ask which drive style they prefer:

> "Should I drive this **interactively** (I ask you step-by-step questions and run everything for you) or **technically** (I show you the CLI command with each flag explained, and you decide whether to run it or have me run it)?"

Save the answer to `.bmad/intake.yaml` (adjacent to `.bmad/role.yaml`) with keys `mode: interactive|technical` and `set_at: <ISO-8601>`. On subsequent runs, read the file silently and skip the prompt unless the user asks to switch.

To change intake mode later, the user says **"switch intake to interactive"** or **"switch intake to technical"** — overwrite `.bmad/intake.yaml` with the new choice.

**Sequencing note.** The `Preflight`, `Pre-flight: Auto-install Dependencies`, and `Consent: Ask Analysis Mode` sections below must NOT run before the intake picker resolves. Order for a fresh activation:
1. Resolve intake mode (ask, or read `.bmad/intake.yaml`).
2. If technical → show the tracer command + flag explanations, then run it (with the user's OK) or hand off.
3. If interactive → collect the intake questions below, then run silently.
4. Preflight + bootstrap run just before dispatch, once inputs are collected.

### Interactive mode (recommended for first-timers)

Ask one question per turn, in this order. Skip any question the user has already answered in their initial prompt.

1. "What's the project path?"
2. "Which stack? (auto-detect / `aem` / `commerce-paas` / `commerce-saas` / `sling` / `spring` / `app-builder` / `eds` / `eds-commerce`)"
3. "What's the input? (Proofhub bug CSV path / BRD `.docx`/`.md`/`.txt` path / both)"
4. "**What's connected** analysis (map the touchpoints, deterministic and fast) or **What could break** (same tracer + LLM interprets blast radius)?"
5. "Cut a working branch from production? (Y/n)"

Once every required input is collected, run the command internally (do NOT show it unless the user asks) and stream results conversationally:
> "Tracing 84 bugs and 12 BRD requirements across your Spring project…" → "Mapped to 43 impacted files, 3 CRITICAL blast-radius…" → "Report saved to `impact-reports/impact-main-20260801_120000-agent-report.xlsx`. Want me to summarize the top CRITICAL items?"

### Technical mode (for users who want CLI transparency)

Show the fully-formed command in a `bash` code block with one flag per line:

```bash
npx ts-node .claude/skills/bmad-dept-code-impact-analysis-agent/scripts/run.ts \
  --path /path/to/project \
  --bugs ./reports/bugs.csv --brd ./docs/spec.docx \
  --create-branch
```

Below the block, add a bulleted list explaining each flag in plain English:

- `--path` — the project root to trace impact against; the tracer walks this tree for reverse-dependency analysis.
- `--bugs` — path to the Proofhub CSV export; the tracer extracts candidate symbols per bug and maps them to code.
- `--brd` — path to the BRD document (`.docx`/`.md`/`.txt`); requirements are split by heading/id and traced the same way.
- `--create-branch` — cut a working `dca/impact-<stack>-<timestamp>` branch (from `production`/`main`/`master`/`develop`) before writing outputs.

Then ask: **"Want me to run this now, or will you copy-paste it?"**

- If **run for me** → execute silently and stream results (same as interactive mode).
- If **I'll run it** → acknowledge, and remind them: "Report will land in `<project>/impact-reports/`. Come back with 'summarize the blast radius' when you're done."

---

## Role-aware behavior

The Impact Analysis agent adapts its **default consent-picker pass** (What's connected vs What could break), **output emphasis**, and **recommended follow-up** to the role of the person driving the run. Role selection is a **shared** concept across the 5-agent DCA suite and is persisted per-project at `<projectRoot>/.bmad/role.yaml` (see `skills/shared/role/ROLES.md`).

### Role check on activation

**Before dispatching the tracer**, the AI agent MUST perform the role handshake:

1. **Check for `<projectRoot>/.bmad/role.yaml`.**
2. **If ABSENT**, ask the user — verbatim:
   > "Which role best matches how you'll use this plugin? Pick one from the codes below (or say 'generic' to skip):"
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

5. **Per-run override**: the user can override for a single run by prefixing their prompt with **"as `<role>`"** (e.g. *"as security, analyze impact of these bugs"*) or by passing **`--role=<code>`** to `scripts/run.ts`. Do NOT write `.bmad/role.yaml` when the role is overridden this way.

6. **Permanent change**: if the user says **"switch role to `<code>`"**, overwrite `.bmad/role.yaml` with the new code (same `writeRoleFile` call, `set_by: interactive`).

### Role → Impact Analysis behavior matrix

The consent picker (see **Consent: Ask Analysis Mode** below) offers two passes: **"What's connected"** (dependency-map lens — fast, deterministic) and **"What could break"** (breakage lens — same tracer + risk interpretation). The role sets the **default** — the user can always override.

| Role | Default consent-picker choice | Output emphasis | Recommended follow-up |
|---|---|---|---|
| `ea` | **What's connected** (dependency-map lens) | Standard XLSX + a **module ownership heatmap** section in the Markdown twin; group findings by top-level module | "generate architecture roadmap from the blast radius" |
| `tl` | **What could break** (breakage lens) | Standard XLSX + a **design impact** section calling out shared abstractions | "audit the impacted modules" |
| `de` | **What could break** | **Jira-ready CSV** — one row per impacted file with Priority mapped from risk, Component from stack, and Labels for the input source (bug ID / BRD requirement) | "generate fixes for high-risk files" |
| `qa` | **What could break** | Standard XLSX + a **regression test plan** section: one bullet per impacted file naming the test framework (from test-coverage packs) and suggested test type (unit / integration / e2e) | "run test coverage on the impacted files" |
| `devops` | **What could break** | Standard XLSX + a **deploy-risk score** and **change-freeze recommendation** (LOW/MEDIUM/HIGH) computed from total blast radius, CRITICAL findings count, and cross-module fan-out | "audit before deploy" |
| `security` | **What could break** | Standard XLSX + a **threat surface impact** section: for each impacted file, note if it touches auth / crypto / input validation / secrets / network — enrich with CWE/OWASP hints where obvious | "sonar scan the impacted files" |
| `pm` | **What's connected** | **Executive Markdown** — top-10 impacted modules in business language + **effort matrix** (S/M/L/XL per impacted file) + **suggested timeline** buckets | "summarize impact for stakeholders" |
| `ba` | **What's connected** | Standard XLSX + a **BRD requirement coverage** section: for each BRD requirement, list impacted files + a "requirement fully covered / partial / uncovered" flag | "generate requirements traceability matrix" |
| `migration` | **BOTH passes** (connected + breakage) | Standard XLSX + a **migration blast radius** section highlighting deprecated APIs, cross-version compatibility notes, and rollback candidates | "test-coverage delta between versions" |
| `content` | **What's connected** | Standard XLSX filtered to content-model files (component / CF / EDS block) + a **content-model impact** section | "audit content models" |
| `generic` | _(Ask the user which pass to run — current behavior)_ | Standard XLSX + Markdown twin | "summarize the blast radius" |

**Output flavors — what they mean.** The `executive` flavor is a Markdown-first deliverable: top-N impacted modules, business-language framing, no rule-IDs; the XLSX is supplementary. The `technical` flavor is the current default look — the standard XLSX plus its Markdown twin. The `jira-csv` flavor adds a companion CSV next to the XLSX where each row is a Jira import row (columns: Summary, Description, Priority, Labels, Component). The `sarif` flavor adds a `.sarif` file suitable for GitHub code-scanning upload alongside the XLSX. The `default` flavor is today's behavior with no role-specific shaping.

**When the deterministic pipeline hasn't shipped a flavor yet** (executive Markdown, Jira-CSV, regression test plan, deploy-risk score, threat surface impact, BRD requirement coverage, migration blast radius, content-model impact): the tracer pipeline emits only the **standard XLSX + Markdown twin**. The AI agent is responsible for **post-processing the tracer output** into the extra role-shaped artifacts and **emitting them into the same report directory** alongside the standard files. Do not block the run because a flavor generator isn't wired up.

### Cross-agent chaining hints per role

After the Impact Analysis run finishes, offer the follow-up handoff that matches the resolved role:

| Role | Next agent to invoke | Why |
|---|---|---|
| `ea` | (stay in impact-analysis, then hand to `generation`) | Produce the architecture roadmap from the blast radius. |
| `tl` | `audit` | Audit the modules the tracer flagged as impacted. |
| `de` | `generation` | Generate fix scaffolds for the high-risk impacted files. |
| `qa` | `test-coverage` | Measure coverage on the impacted files before regression. |
| `devops` | `audit` | Run a pre-deploy audit on the impacted surface. |
| `security` | `sonar-scan` | Deeper Vulnerability + Security Hotspot analysis on the impacted files. |
| `pm` | (stay in impact-analysis) | Summarize impact for stakeholders / release notes. |
| `ba` | (stay in impact-analysis) | Generate the requirements traceability matrix from the BRD-scoped run. |
| `migration` | `test-coverage` | Coverage delta between versions across the impacted surface. |
| `content` | `audit` | Audit the impacted content models. |
| `generic` | (stay in impact-analysis) | Summarize the blast radius; ask the user for the next step. |

The resolved role is exposed to the tracer + emit layer via `process.env.DCA_ROLE` (and `DCA_ROLE_NAME` / `DCA_ROLE_FLAVOR` / `DCA_ROLE_SOURCE`), recorded on the Run Info sheet of the report, and a one-line `[dca-role] <Name> (source: <cli-flag|role-file|generic-fallback>)` is printed to stderr on every run.

## Preflight — report the user's LLM & recommend a mode (do this first, conversationally)

The moment this command is triggered from an AI assistant (GitHub Copilot, Claude, Cursor, or any LLM), run the
preflight and tell the user — in one line — **which LLM they're on** and **whether to lean on the Static engine
or the LLM**:

```bash
npx ts-node scripts/run.ts --path {project} --bugs {csv} --preflight
```

It prints the detected **model + context window**, the **project size** (files/LOC/tokens), the **fit** (% of the
window), and a **recommendation** — **STATIC** (Tier-1 deterministic tracer) when the project is large, **LLM**
(Tier-2 semantic) when it comfortably fits, or **HYBRID**. Surface it like:
*"You're on `<model>` (~`<ctx>` context). This project is ~`<pct>%` of your window → I recommend **<mode>**. Proceed?"*
then run the full command (the advisory also prints on every normal run unless `--no-preflight`).

**Rule of thumb:** run the Static (Tier-1) tracer to map bugs/requirements → code deterministically, then use the
LLM (Tier-2) to interpret the traceability + blast radius. Lean more on the LLM only when the project fits the window.

## Pre-flight: Auto-install Dependencies

Before ANY command execution, run the shared bootstrap. It installs the `shared/` foundation
(if missing) + this agent's `scripts/` deps in the correct order, with a one-line confirmation
prompt so the user knows what's happening. First-time cost is ~80MB / ~30–60s; subsequent
runs are silent no-ops.

**POSIX (macOS, Linux, WSL):**
```bash
bash .claude/skills/shared/bootstrap.sh impact-analysis
```

**Windows (or when sh is unavailable):**
```bash
node .claude/skills/shared/bootstrap.js impact-analysis
```

**Headless / CI mode (skip prompt):**
```bash
bash .claude/skills/shared/bootstrap.sh impact-analysis --yes    # install without asking
bash .claude/skills/shared/bootstrap.sh impact-analysis --no     # error if deps missing, don't install
```

**Behavior:**
- Both node_modules present → silent no-op (exit 0)
- Either missing → confirmation prompt, then install if approved
- User declines → exit 3, agent should tell user "Deps required. Run manually: cd .claude/skills/shared && npm install && cd ../bmad-dept-code-impact-analysis-agent/scripts && npm install"
- Install failure → exit 4, agent should surface the npm error

**Instructions to the AI:** Do NOT skip this step. The bootstrap script handles the confirmation — you do NOT need to ask the user separately. If bootstrap exits non-zero, halt and report the exit code. If your dispatcher (`run.ts`) also accepts `--yes-install`/`--no-install`, pass those to bootstrap accordingly.

## Consent: Ask Analysis Mode

**Direct-intent triggers (skip the question, go straight):**
- "trace dependencies" / "blast radius" / "what does X affect" / "dependency chain" → run the tracer and present the traceability

The tracer is always deterministic regardless of the input phrasing. STATIC vs LLM/HYBRID is an advisory from
preflight about how to interpret the results, not a switch that changes tracer behaviour.

**Ambiguous triggers (ask which mode):**
- "impact analysis" / "analyze impact" / "check impact"

When the intent is ambiguous, ask using the interactive question picker. Use the `vscode_askQuestions` tool:

```
question: "What are you trying to understand?"
options:
  - label: "What's connected to this?"
    description: "I'll run the tracer and show you what touches what. Fast and light — deterministic, no AI inference."
    recommended: true
  - label: "What could break?"
    description: "I'll run the same tracer, then interpret the risk — how likely things are to break and what to watch out for. Uses more tokens."
```

**Important:** Always recommend "What's connected to this?" as default. It answers the connectivity question without needing AI inference.

Proceed with the user's chosen mode.

## Workflow

1. **Collect inputs** — a Proofhub CSV export (`--bugs`) and/or a BRD (`--brd`). At least one is required.
   - Proofhub columns are auto-detected by header keyword (Task/Bug ID, Title, Description, Module/Label,
     Priority, Status — the first header containing the keyword wins, so this is not a fixed schema); the run
     log prints the resolved mapping so a mismatched export is obvious. `.docx` BRDs are read as raw text (via
     mammoth); any other extension (`.md`/`.txt`) is read as UTF-8 text. BRDs are split into requirements by
     Markdown/numbered headings, REQ/FR/NFR/US/BR ids, or `Label:` lines (falling back to blank-line paragraphs
     when no heading is found). Google Docs → export to `.docx` or `.txt` first.
2. **Resolve the stack** — auto-detected, or `--engine <id>` (see `--list-engines`). Supported (8):
   `commerce-paas`, `commerce-saas`, `app-builder`, `spring`, `sling`, `aem` (AEMaaCS + AMS), `eds`, `eds-commerce`
   (aliases: `aemcs`/`aemams` → `aem`, `commerce` → `commerce-paas`).
3. **Trace** — for each bug/requirement the engine extracts candidate symbols (class names, file/module names,
   paths), scores source files by filename + content match, then computes the **reverse-dependency blast
   radius** (who references each impacted file). Risk = match strength × blast radius × input priority.
4. **Emit** the standardized report + CHANGE-LOG.

```bash
cd {skill_path}/scripts
npx ts-node run.ts --path {project} --bugs proofhub-export.csv
npx ts-node run.ts --path {project} --brd requirements.docx --engine spring
npx ts-node run.ts --path {project} --bugs bugs.csv --brd brd.md
npx ts-node run.ts --list-engines
```

## Output

`impact-<branch>-<timestamp>-agent-report.xlsx` (+ markdown twin) and an appended `CHANGE-LOG.md`, via the shared
standardized report (written to `--output` or the default `<project>/impact-reports`). Key sheet:
**Input Traceability** — one row per (input item → impacted file) with Input ID, Input Type (bug/requirement),
impacted title, code reference, severity, impact analysis (symbols matched + blast radius), and recommendation.
Plus Run Info, Summary, Severity Breakdown, By Category, and Recommendations sheets. Every input item appears —
items with no code match are flagged **"Needs manual review"** (INFO) so nothing is silently dropped.

Pass `--create-branch` (optionally with `--source-branch <name>`) to first cut the standard working branch
`dca/impact-<stack>-<timestamp>` from `production`/`main`/`master`/`develop` before the outputs are written.

> **Note on fidelity:** tracing is heuristic (symbol/identifier matching + reverse-reference), not full
> type-resolved data-flow — it favors recall and always lists its evidence (matched symbols) so a reviewer can
> confirm. Enrich Proofhub items with a module/label or a file/class name to sharpen matches.

---

## Post-Run Follow-Up

After an impact report has been generated, the user may ask follow-up questions. Handle these by reading the generated report and responding:

| User prompt | Action |
|-------------|--------|
| "summarize the impact findings" | Read the report, provide executive summary with top blast-radius items and severity breakdown |
| "show items with no code match" | Filter Input Traceability sheet for rows with severity INFO and status "Needs manual review" |
| "which modules are most affected?" | Group findings by Category/Module column, rank by count |
| "what's the highest blast-radius item?" | Find the finding with highest blast radius from the Impact Analysis column |
| "show me only CRITICAL and HIGH findings" | Filter Summary sheet by Severity column |
| "re-run with a different engine" | Ask which engine, then re-run with `--engine <id>` added |
| "generate a fix plan for the top items" | Prioritize highest-severity findings and their Recommendation column values |
| "why was file X included?" | Read matched symbols / evidence in Code Reference and Impact Analysis columns for that file |
| "which input items had the most blast radius?" | Group by inputRef.id in the Input Traceability sheet, sum affected files per input |

**Report location:** Look for the latest `impact-<branch>-<timestamp>-agent-report.xlsx` (and its `.md` twin) in `<project>/impact-reports/` or the `--output` directory. The appended `CHANGE-LOG.md` at the project root lists every report by filename.
