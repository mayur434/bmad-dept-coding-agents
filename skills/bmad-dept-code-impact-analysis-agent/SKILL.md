---
name: bmad-dept-code-impact-analysis-agent
description: "Code impact analysis agent (part of BMAD DEPT Code Agent suite). Evaluates blast radius of changes, traces dependency chains, and assesses risk for modifications, upgrades, and patches."
---

# BMAD DEPT Code Agent — Impact Analysis Skill

## Purpose

Takes a **Proofhub bug export (CSV)** and/or a **BRD document (Word/Markdown/text)** as input, traces each
bug/requirement onto the impacted code, computes the **blast radius** (reverse dependencies), scores risk, and
emits the standardized impact report — including an **Input Traceability** sheet mapping every input item to
the code it touches. Answers "what does fixing this bug / building this requirement affect?"

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

```bash
cd {skill_path}/scripts && [ -d node_modules ] || npm install --silent
```

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
