---
name: bmad-dept-code-sonar-scan-agent
description: "LLM-driven SonarQube-style code quality analysis agent (part of BMAD DEPT Code Agent suite). Produces Bugs, Vulnerabilities, Security Hotspots, Code Smells, Duplications, and Complexity findings with Reliability/Security/Maintainability ratings (A–E) and a pass/fail Quality Gate. Emits a standardized Excel report with a dedicated Vulnerabilities sheet, Markdown twin, and CHANGE-LOG."
---

# BMAD DEPT Code Agent — Sonar Scan Skill

## Purpose

The **Sonar Scan** agent — the 5th agent in the BMAD DEPT Code Agent suite (audit, generation, impact-analysis, test-coverage, sonar-scan). It replicates SonarQube's analysis taxonomy using LLM reasoning, with **no SonarQube server or binary required**.

Covers all 8 enterprise stacks:

- **AEM** — AEM as a Cloud Service (AEMaaCS) + AEM AMS
- **Adobe Commerce PaaS** — Magento 2 / PHP
- **Adobe Commerce SaaS** — Catalog Service / Live Search / storefront drop-ins
- **Apache Sling / Shaft** (sling-12)
- **Spring Boot** custom middleware
- **Adobe App Builder** — I/O Runtime, API Mesh
- **Edge Delivery Services (EDS)**
- **EDS + Commerce** hybrid

**Two-step workflow (scan → ingest):**

1. **Scan** (this skill, LLM): Reads the per-stack rule pack, reasons over the project files, and writes `sonar-findings.json`.
2. **Ingest** (deterministic `scripts/run.ts --ingest`): Reads the JSON → `Finding[]`, computes ratings + Quality Gate, emits the standardized `.xlsx` + `CHANGE-LOG.md`.

> The two steps are intentionally separate so the LLM output can be reviewed and corrected before the report is generated, and so the ingest step is independently rerunnable if the LLM finishes but the report step fails.

---

## Activation

This skill activates when the user asks to:
- Sonar scan / SonarQube scan a project
- Check code quality (vulnerabilities, code smells, complexity)
- Find security vulnerabilities in project code
- Evaluate code maintainability or reliability
- Get a Quality Gate result
- Detect duplications or cognitive complexity issues
- Generate a Sonar report / security report
- Check for SQL injection, hardcoded credentials, NPE risks, or similar CWE/OWASP issues

---

## Intake mode (interactive vs technical)

> **For fast, enterprise-grade execution, prefer One-shot mode (see below).** Intake mode is for exploratory / first-time users.

> **CRITICAL:** The very first response to any activation must be the intake-mode question — unless `.bmad/intake.yaml` exists with a saved preference. Do NOT skip this. Do NOT show a CLI command as the first response.

When a user triggers this agent — via a natural-language prompt or a menu entry — do NOT show or run a raw CLI command as the first response. Ask which drive style they prefer:

> "Should I drive this **interactively** (I ask you step-by-step questions and run everything for you) or **technically** (I show you the CLI command with each flag explained, and you decide whether to run it or have me run it)?"

Save the answer to `.bmad/intake.yaml` (adjacent to `.bmad/role.yaml`) with keys `mode: interactive|technical` and `set_at: <ISO-8601>`. On subsequent runs, read the file silently and skip the prompt unless the user asks to switch.

To change intake mode later, the user says **"switch intake to interactive"** or **"switch intake to technical"** — overwrite `.bmad/intake.yaml` with the new choice.

**Sequencing note.** Sonar-scan is a **two-step** tool (LLM scan → deterministic ingest). The intake picker resolves once for the whole session and covers both steps. The `Preflight` and `Pre-flight: Auto-install Dependencies` sections below must NOT run before the intake picker resolves. Order for a fresh activation:
1. Resolve intake mode (ask, or read `.bmad/intake.yaml`).
2. If technical → show the Step 1 prompt-shape and the Step 2 ingest command with flag explanations, then run each with the user's OK.
3. If interactive → collect the intake questions below, then perform Step 1 (LLM scan) and Step 2 (ingest) silently.
4. Preflight + bootstrap run just before dispatch, once inputs are collected.

### Interactive mode (recommended for first-timers)

Ask one question per turn, in this order. Skip any question the user has already answered in their initial prompt.

1. "What's the project path? (defaults to current working directory)"
2. "Which stack? (auto-detect / `aem` / `commerce-paas` / `commerce-saas` / `sling` / `spring` / `app-builder` / `eds` / `eds-commerce`)"
3. "This is a 2-step run — (a) LLM scan produces `sonar-findings.json`, then (b) ingest the JSON into the Excel report + Quality Gate. Do you already have a `sonar-findings.json`, or should I start from scratch?"
4. "Cut a working branch from production? (Y/n)"

Once every required input is collected, drive both steps internally (do NOT show the raw commands unless the user asks) and stream results conversationally:
> "Reasoning over your Spring Boot project…" → "Wrote 17 findings to `sonar-reports/sonar-findings.json`…" → "Ingested. Quality Gate: FAIL (Security = C). Report saved to `sonar-reports/sonar-scan-main-20260801_120000-agent-report.xlsx`. Want me to summarize the Vulnerabilities sheet?"

### Technical mode (for users who want CLI transparency)

**Step 1** — the LLM scan is agent-driven; the "command" is the natural-language prompt to yourself, shown in a `text` code block so the user can see what you'll do:

```text
sonar scan my project at /path/to/project focused on the 6 Sonar categories
```

**Step 2** — the deterministic ingest is a real CLI. Show it in a `bash` code block with one flag per line:

```bash
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-findings.json \
  --path /path/to/project \
  --create-branch
```

Below the block, add a bulleted list explaining each flag in plain English:

- `--ingest` — the `sonar-findings.json` produced by Step 1 (or supplied by the user); the ingest reads and validates it into `Finding[]`.
- `--path` — the project root; used to compute the working branch name, output directory, and ratings baseline.
- `--create-branch` — cut a working `dca/sonar-scan-<stack>-<timestamp>` branch (from `production`/`main`/`master`/`develop`) before writing outputs.

Then ask: **"Want me to run this now, or will you copy-paste it?"**

- If **run for me** → execute silently and stream results (same as interactive mode).
- If **I'll run it** → acknowledge, and remind them: "Report will land in `<project>/sonar-reports/`. Come back with 'summarize the Quality Gate' when you're done."

---

## One-shot mode

The **preferred enterprise path.** When the user's initial prompt fully specifies what to run, do NOT ask any clarifying questions — execute end-to-end (both Step 1 scan and Step 2 ingest), stream results, done. Use defaults from `.bmad/role.yaml`, `.bmad/intake.yaml`, `.bmad/conventions.yaml`, and reasonable stack auto-detection to fill missing inputs.

### When to enter one-shot mode

Trigger phrases (any of):
- "run the sonar scan end-to-end", "no questions, just do it", "one-shot", "just run", "auto"
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

- **Sonar-scan Step 2 (ingest)**: if no `sonar-findings.json` exists at the expected path AND no `--auto-ingest` flag was passed — ask ONCE whether to wait for the LLM output (`--watch`) or fail. This is the only forced question in one-shot mode.

### One-shot prompt examples for the Sonar Scan agent

Each example shows what the user pastes and what the AI silently resolves.

> **User:** "sonar scan my project"
> **AI silently resolves:** path=cwd, engine=auto-detect, role=(from `.bmad/role.yaml` or `generic`), focus=all six Sonar categories, `--auto-ingest` on so both steps chain, sla-path/decisions-path=defaults, output-dir=`sonar-reports/`.
> **AI runs:** Step 1 LLM scan → writes `sonar-findings.json` → Step 2: `npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts --path <cwd> --auto-ingest --technical --no-preflight --yes-install`
> **AI reports:** "Quality Gate: FAIL (Security=C). 17 findings. Report: `sonar-scan-main-…-agent-report.xlsx`."

> **User:** "sonar scan focus vulnerabilities as security"
> **AI silently resolves:** role=`security` (per-run override), `--focus vulnerabilities`, engine=auto-detect.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --role security --focus vulnerabilities --auto-ingest --technical --no-preflight --yes-install`
> **AI reports:** vulnerability-only breakdown + CWE/OWASP tags + follow-up hint.

> **User:** "sonar scan then ingest — one shot with --auto-ingest"
> **AI silently resolves:** explicit `--auto-ingest`; scan then ingest silently in one pipeline.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --auto-ingest --technical --no-preflight --yes-install`
> **AI reports:** streamed Step 1 → Step 2 progress + final Quality Gate.

> **User:** "sonar scan and fail if quality gate red"
> **AI silently resolves:** `--fail-on-overdue` for SLA gate + implicit non-zero exit if Quality Gate = FAIL (default behavior; do NOT pass `--no-fail`).
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --auto-ingest --fail-on-overdue --technical --no-preflight --yes-install`
> **AI reports:** gate status + exit code suitable for CI wiring.

> **User:** "ingest ./sonar-findings.json into a report"
> **AI silently resolves:** Step 2 only; `--ingest ./sonar-findings.json`, path=cwd.
> **AI runs:** `npx ts-node .../run.ts --ingest ./sonar-findings.json --path <cwd> --technical --no-preflight --yes-install`
> **AI reports:** ingest summary + Quality Gate + report path.

### After one-shot execution

Always:
- Print a one-line summary (findings count, severity breakdown, report path).
- Print the recommended follow-up from the role matrix (e.g. Security role after sonar scan → "generate hardened scaffolds for the top vulnerabilities").
- Do NOT ask "want me to run the follow-up?" — user will ask if they do.

Never:
- Ask what mode they wanted after the fact.
- Ask if they want to save preferences.
- Explain what you did (unless they ask).

### CLI equivalent for one-shot (technical mode)

Every one-shot prompt has a direct CLI equivalent using all Phase 1 flags:

```bash
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --path . \
  --role <code> \
  --auto-ingest \
  --technical \
  --yes-install \
  --no-preflight \
  --sla-path .bmad/sla.yaml \
  --decisions-path .bmad/decisions.yaml
```

Add `--fail-on-overdue` for CI gates, `--include-decided` to bypass decisions, `--create-branch` for a working branch, `--watch` if Step 1's `sonar-findings.json` may still be in-flight.

---

## Prompt → Action Resolution

Resolve the user's natural language prompt to the correct action **before** running preflight or scan.

### Direct-intent triggers

The first two rows of each entry are the **BMAD help panel prompt-templates** — pre-filled messages the user sends by clicking a command in the help UI. The remaining rows are organic conversation triggers. All forms activate the same workflow.

| User says… | Action | Engine flag |
|------------|--------|-------------|
| "Please run a sonar quality scan on my project at {path} — auto-detect the tech stack" _(help panel)_ | Scan — auto-detect | _(auto)_ |
| "sonar scan my project" / "run sonar" / "quality scan" (no stack) | Scan — auto-detect | _(auto)_ |
| "Please run a sonar quality scan on my AEM project at {path}" _(help panel)_ | Scan — AEM | `--engine aem` |
| "sonar scan my AEM project" / "AEM quality gate" / "AEMaaCS sonar" / "AEM AMS scan" | Scan — AEM | `--engine aem` |
| "Please run a sonar quality scan on my Spring Boot project at {path}" _(help panel)_ | Scan — Spring | `--engine spring` |
| "sonar scan my Spring project" / "Spring Boot sonar" / "scan my Spring service" | Scan — Spring | `--engine spring` |
| "Please run a sonar quality scan on my Sling / Shaft project at {path}" _(help panel)_ | Scan — Sling | `--engine sling` |
| "sonar scan my Sling project" / "Shaft sonar scan" / "sling-12 quality scan" / "scan Shaft middleware" | Scan — Sling | `--engine sling` |
| "Please run a sonar quality scan on my Commerce (Magento) project at {path}" _(help panel)_ | Scan — Commerce PaaS | `--engine commerce-paas` |
| "sonar scan Commerce" / "Magento quality scan" / "scan my PHP Commerce project" / "Commerce PaaS sonar" | Scan — Commerce PaaS | `--engine commerce-paas` |
| "Please run a sonar quality scan on my Commerce SaaS storefront at {path}" _(help panel)_ | Scan — Commerce SaaS | `--engine commerce-saas` |
| "sonar scan storefront" / "Commerce SaaS scan" / "scan my drop-ins" / "Live Search quality check" | Scan — Commerce SaaS | `--engine commerce-saas` |
| "Please run a sonar quality scan on my App Builder project at {path}" _(help panel)_ | Scan — App Builder | `--engine app-builder` |
| "sonar scan App Builder" / "IO Runtime quality scan" / "scan my aio project" / "check my App Builder app" | Scan — App Builder | `--engine app-builder` |
| "Please run a sonar quality scan on my EDS / Franklin site at {path}" _(help panel)_ | Scan — EDS | `--engine eds` |
| "sonar scan EDS" / "Franklin quality gate" / "scan my helix blocks" / "EDS sonar" | Scan — EDS | `--engine eds` |
| "Please run a sonar quality scan on my EDS + Commerce project at {path}" _(help panel)_ | Scan — EDS+Commerce | `--engine eds-commerce` |
| "sonar scan EDS+Commerce" / "EDS commerce overlay scan" / "scan my EDS drop-in project" | Scan — EDS+Commerce | `--engine eds-commerce` |
| "Please ingest sonar findings from {json} for my project at {path} and generate the Excel report with Quality Gate" _(help panel)_ | Ingest only (Step 2) | _(from JSON)_ |
| "ingest sonar findings" / "generate the sonar Excel report" / "run ingest on sonar-findings.json" | Ingest only (Step 2) | _(from JSON)_ |
| "Please list all available sonar scan rule packs and the stacks they cover" _(help panel)_ | List rule packs | — |
| "list rule packs" / "what stacks does sonar support?" / "show available sonar engines" | List rule packs | — |

### Flag resolution rules

When building the ingest command after Step 1, resolve flags from the user's prompt:

| User says… | Flag | Value |
|------------|------|-------|
| _(always)_ | `--path` | Current workspace root (auto-detect) |
| "output to /dir" / "save report at /dir" | `--output` | Directory path |
| "cut a branch" / "on a new branch" / "create branch" | `--create-branch` | _(flag, no value)_ |
| "branch from production/main/staging" | `--source-branch` | Branch name |
| "ingest /path/sonar-findings.json" | `--ingest` | JSON file path (required for SI) |

### Missing required info — ask (don't guess)

| When user says… | What to ask |
|-----------------|-------------|
| "ingest" with no JSON path | "Please provide the path to your sonar-findings.json file." |
| "sonar scan" but project path unclear | "Which project directory should I scan? Use the current workspace?" |
| Stack is ambiguous (e.g. both AEM and Spring markers) | "I see markers for both AEM and Spring. Which stack should I use?" |

### Compound resolution

Combine all matched flags when a single prompt mentions multiple inputs:

- "sonar scan my AEM project and cut a branch" → `--engine aem --create-branch`
- "scan my Spring service, output to /reports" → `--engine spring --output /reports`
- "ingest findings from /tmp/sonar-findings.json, project is /projects/myapp" → `--ingest /tmp/sonar-findings.json --path /projects/myapp`
- "sonar scan Commerce SaaS on a new branch from main" → `--engine commerce-saas --create-branch --source-branch main`

### Concrete examples — one per skill entry

Each entry shows: the **BMAD help panel prompt-template** (what the user sees pre-filled when they click the command), organic conversation triggers, and the resulting ingest command.

---

**`SS` — Sonar Scan (auto-detect)**
> _Help panel:_ "Please run a sonar quality scan on my project at `/your/project/path` — auto-detect the tech stack"
> _Or say:_ "sonar scan my project" / "run quality scan" / "check code quality"

Extract `{project_path}` from the message (or use current workspace). Auto-detect the stack, run Step 1, then Step 2:
```bash
npx ts-node {skill_path}/scripts/run.ts --ingest {output}/sonar-findings.json --path {project_path}
```

---

**`SA` — Sonar Scan — AEM**
> _Help panel:_ "Please run a sonar quality scan on my AEM project at `/your/aem/project`"
> _Or say:_ "sonar scan my AEM project" / "AEM quality gate" / "check my AEMaaCS / AMS code"

```bash
npx ts-node {skill_path}/scripts/run.ts --ingest {output}/sonar-findings.json --path {project_path} --engine aem
```

---

**`SP` — Sonar Scan — Spring**
> _Help panel:_ "Please run a sonar quality scan on my Spring Boot project at `/your/spring/project`"
> _Or say:_ "sonar scan my Spring Boot service" / "check Spring code quality" / "Spring sonar"

```bash
npx ts-node {skill_path}/scripts/run.ts --ingest {output}/sonar-findings.json --path {project_path} --engine spring
```

---

**`SN` — Sonar Scan — Sling**
> _Help panel:_ "Please run a sonar quality scan on my Sling / Shaft project at `/your/sling/project`"
> _Or say:_ "sonar scan my Sling project" / "Shaft quality scan" / "check sling-12 code" / "scan Shaft middleware"

```bash
npx ts-node {skill_path}/scripts/run.ts --ingest {output}/sonar-findings.json --path {project_path} --engine sling
```

---

**`SM` — Sonar Scan — Commerce PaaS**
> _Help panel:_ "Please run a sonar quality scan on my Commerce (Magento) project at `/your/commerce/project`"
> _Or say:_ "sonar scan my Commerce project" / "Magento quality scan" / "scan my PHP Commerce code"

```bash
npx ts-node {skill_path}/scripts/run.ts --ingest {output}/sonar-findings.json --path {project_path} --engine commerce-paas
```

---

**`SZ` — Sonar Scan — Commerce SaaS**
> _Help panel:_ "Please run a sonar quality scan on my Commerce SaaS storefront at `/your/storefront/project`"
> _Or say:_ "sonar scan my Commerce SaaS storefront" / "scan my drop-ins" / "quality scan for storefront JS"

```bash
npx ts-node {skill_path}/scripts/run.ts --ingest {output}/sonar-findings.json --path {project_path} --engine commerce-saas
```

---

**`SB` — Sonar Scan — App Builder**
> _Help panel:_ "Please run a sonar quality scan on my App Builder project at `/your/app-builder/project`"
> _Or say:_ "sonar scan my App Builder app" / "IO Runtime quality scan" / "check my aio project"

```bash
npx ts-node {skill_path}/scripts/run.ts --ingest {output}/sonar-findings.json --path {project_path} --engine app-builder
```

---

**`SD` — Sonar Scan — EDS**
> _Help panel:_ "Please run a sonar quality scan on my EDS / Franklin site at `/your/eds/project`"
> _Or say:_ "sonar scan my EDS site" / "Franklin quality gate" / "check my helix blocks" / "EDS JavaScript scan"

```bash
npx ts-node {skill_path}/scripts/run.ts --ingest {output}/sonar-findings.json --path {project_path} --engine eds
```

---

**`SE` — Sonar Scan — EDS+Commerce**
> _Help panel:_ "Please run a sonar quality scan on my EDS + Commerce project at `/your/eds-commerce/project`"
> _Or say:_ "sonar scan my EDS+Commerce project" / "scan my EDS commerce overlay" / "EDS drop-in quality scan"

```bash
npx ts-node {skill_path}/scripts/run.ts --ingest {output}/sonar-findings.json --path {project_path} --engine eds-commerce
```

---

**`SI` — Sonar Ingest**
> _Help panel:_ "Please ingest sonar findings from `/path/to/sonar-findings.json` for my project at `/your/project/path` and generate the Excel report with Quality Gate"
> _Or say:_ "ingest sonar findings" / "generate Excel report from sonar-findings.json" / "run the ingest step"

Extract `{sonar_findings_path}` and `{project_path}` from the message. Runs Step 2 only — for when the user has already reviewed/edited `sonar-findings.json`:
```bash
npx ts-node {skill_path}/scripts/run.ts --ingest {sonar_findings_path} --path {project_path}
```

---

**`LR` — List Rule Packs**
> _Help panel:_ "Please list all available sonar scan rule packs and the stacks they cover"
> _Or say:_ "list sonar rule packs" / "what stacks do you support?" / "show available sonar engines"

```bash
npx ts-node {skill_path}/scripts/run.ts --list-engines
```

---

## Role-aware behavior

Sonar Scan adapts its emphasis to the role of the person driving the run.
Ten roles are supported plus a `generic` fallback (see
`skills/shared/role/ROLES.md` for the canonical catalog).

**This is a two-step tool — role affects both steps:**

- **Step 1 (LLM scan)** — role emphasis nudges category weighting. Examples:
  `security` → deeper Vulnerability / Security Hotspot analysis and OWASP/CWE
  enrichment; `ea` → deeper Complexity / Maintainability narrative;
  `migration` → surface deprecation smells. The LLM **must** record the acting
  role in `sonar-findings.json` as a top-level `role: "<code>"` field
  (see the JSON contract update in Step 1d below).
- **Step 2 (ingest)** — role determines report emphasis and recommended
  follow-ups. If a `--role` flag is passed to `run.ts --ingest`, it
  **overrides** the role recorded in the JSON (a WARN is logged when they
  differ). If `--role` is absent, ingest uses the JSON's `role` field; if
  that is also absent, it falls back to `.bmad/role.yaml`, then `generic`.

### Role check on activation

Before Step 1 (scan) or Step 2 (ingest), check `<projectRoot>/.bmad/role.yaml`:

1. **Absent** — ask the user to pick a role. Present the six **promoted**
   roles first (`ea`, `tl`, `de`, `qa`, `devops`, `security`), then the four
   **additional** roles (`pm`, `ba`, `migration`, `content`), and finally the
   `generic` fallback. Persist the choice to `.bmad/role.yaml` (schema in
   `skills/shared/role/persistence.ts`; use `set_by: interactive`).
2. **Present** — read it silently and proceed.
3. **Single-run override** — if the user prefixes their prompt with
   `as <role>` (e.g. `"as security, sonar scan my project"`), use that role
   for this run only. Do **not** overwrite `.bmad/role.yaml`.
4. **Permanent switch** — if the user says `"switch role to <code>"`,
   overwrite `.bmad/role.yaml` with the new selection.

### Role → Sonar Scan behavior matrix

| Role | Scan focus emphasis | Ingest / report emphasis | Recommended follow-up |
|---|---|---|---|
| `ea` | All 6 Sonar categories; emphasize Maintainability + Complexity trend narrative | Standard XLSX + Maintainability trend section in Markdown twin | "generate architecture roadmap from the Maintainability rating" |
| `tl` | All 6 categories | Standard XLSX + technical twin | "audit for architecture verification" |
| `de` | All 6 categories | Jira-ready CSV alongside XLSX, one row per issue with Priority mapped from severity | "generate fixes for CRITICAL vulnerabilities" |
| `qa` | All 6 categories; emphasize Reliability + Bugs | Standard XLSX + Reliability rating narrative | "test-coverage on the changed files" |
| `devops` | All 6 categories | **SARIF export** alongside XLSX for GitHub code-scanning upload; Quality Gate PASS/FAIL sets the process exit code (0 = PASS, 1 = FAIL). This is now enforced by default — pass `--no-fail` to suppress. | "wire the Quality Gate into CI as a required check" |
| `security` | All 6 categories; emphasize Vulnerabilities + Security Hotspots; enrich with CWE / OWASP Top-10 tags where the rule pack knows them | Vulnerabilities sheet moved to first; XLSX; ratings emphasize Security | "audit --focus security" |
| `pm` | All 6 categories | Executive Markdown: Quality Gate + 3 ratings A–E + top-10 vulnerabilities in business language | "summarize the Quality Gate for release notes" |
| `ba` | Standard scan | Standard XLSX; no special shaping | _(none — sonar-scan is not a primary BA tool)_ |
| `migration` | All 6 categories; emphasize deprecation smells + Code Smells | Standard XLSX + a "Deprecated" section in Markdown twin | "impact-analyze deprecated API usage" |
| `content` | Standard scan | Standard XLSX | _(none)_ |
| `generic` | Standard scan (current default) | Standard XLSX + MD (current default) | "list ratings" |

**Output flavors** (matches the audit agent's flavor definitions):

- `executive` — leadership-facing Markdown: Quality Gate + 3 ratings + top-N
  in business language, no code snippets.
- `technical` — engineer-facing XLSX + Markdown twin with full finding
  details, code refs, rule IDs.
- `jira-csv` — Jira-ready CSV alongside XLSX; one row per issue with Summary,
  Description, Priority (mapped from severity), Component (mapped from
  category), Labels.
- `sarif` — SARIF 2.1.0 export alongside XLSX for GitHub code-scanning /
  security-tab upload; PASS/FAIL Quality Gate drives process exit code.
- `default` — standard XLSX + Markdown twin + CHANGE-LOG (current v1 output).

### CLI flag

Pass `--role=<code>` (or `--role <code>`) to `scripts/run.ts` to override the
persisted role for a single run. On `--ingest`, this also overrides any
`role` recorded inside the findings JSON:

```bash
npx ts-node run.ts --ingest sonar-findings.json --path /project --role security
```

---

## Preflight — report the user's LLM & recommend a mode (do this first, conversationally)

The moment this skill is triggered, run the preflight and tell the user — in one line — **which LLM they're on** and **whether the project fits the context window**:

```bash
npx ts-node scripts/run.ts --path {project} --preflight
```

It prints the detected **model + context window**, the **project size** (files/LOC/tokens), the **fit** (% of the window), and a **recommendation** — **LLM** when the project fits comfortably, **HYBRID** for large projects (scan focused directories). Surface it like:
*"You're on `<model>` (~`<ctx>` context). This project is ~`<pct>%` of your window → I recommend **<mode>**. Proceed?"*

For HYBRID mode: scan the highest-risk directories first (e.g. `src/main/java/`, `app/code/`, `actions/`) and mention that files outside those directories are not covered in this run.

---

## Pre-flight: Auto-install Dependencies

Before ANY command execution, run the shared bootstrap. It installs the `shared/` foundation
(if missing) + this agent's `scripts/` deps in the correct order, with a one-line confirmation
prompt so the user knows what's happening. First-time cost is ~80MB / ~30–60s; subsequent
runs are silent no-ops.

**POSIX (macOS, Linux, WSL):**
```bash
bash .claude/skills/shared/bootstrap.sh sonar-scan
```

**Windows (or when sh is unavailable):**
```bash
node .claude/skills/shared/bootstrap.js sonar-scan
```

**Headless / CI mode (skip prompt):**
```bash
bash .claude/skills/shared/bootstrap.sh sonar-scan --yes    # install without asking
bash .claude/skills/shared/bootstrap.sh sonar-scan --no     # error if deps missing, don't install
```

**Behavior:**
- Both node_modules present → silent no-op (exit 0)
- Either missing → confirmation prompt, then install if approved
- User declines → exit 3, agent should tell user "Deps required. Run manually: cd .claude/skills/shared && npm install && cd ../bmad-dept-code-sonar-scan-agent/scripts && npm install"
- Install failure → exit 4, agent should surface the npm error

**Instructions to the AI:** Do NOT skip this step. The bootstrap script handles the confirmation — you do NOT need to ask the user separately. If bootstrap exits non-zero, halt and report the exit code. If your dispatcher (`run.ts`) also accepts `--yes-install`/`--no-install`, pass those to bootstrap accordingly.

---

## Consent: Confirm scope

Before scanning, ask the user in one line:

```
"I'll scan {projectName} ({stack}) for Bugs, Vulnerabilities, Security Hotspots, Code Smells, Duplications, and Complexity. Run now?"
```

If the user confirms a specific category focus (e.g. "just vulnerabilities"), keep all 6 categories in the JSON but note the focus in the scan — this ensures the ratings and Quality Gate are always complete.

**Exception — explicit `--focus` flag:** when the user (or the CLI dispatcher)
passes `--focus <csv>` (accepted tokens: `bugs`, `vulnerabilities`, `hotspots`,
`smells`, `duplications`, `complexity`) the intent is to _narrow_ the run. In
that mode the LLM MUST emit findings ONLY for the requested categories in
`sonar-findings.json` — do NOT pad with the other 4/5. Rating math in Step 2
is computed only from the included categories, and the Quality Gate is
reported against that reduced surface. Example:

  `--focus vulnerabilities,hotspots` → Step 1 writes only Vulnerability and
  Security Hotspot findings; Step 2 ingests those and reports Security
  rating + Quality Gate against them (Reliability and Maintainability are
  reported as `A` because those categories are empty).

---

## Step 1: Scan — LLM Analysis

### 1a. Resolve the stack

Check `{project}` for the markers in `resources/detection-strategy.md`:
- If auto-detecting, read the detection markers table and match against the project files.
- If `--engine <id>` was given by the user, use that directly.
- Log: `🔍 Sonar Scan — <stack> (<engine id>)` and `   Project: <name>`.

### 1b. Load the rule pack

Read the rule pack for the resolved stack:

```
{skill_path}/resources/rule-packs/<engine-id>/rules.md
```

Also read the shared severity/rating model:
```
{skill_path}/resources/shared/severity-and-rating-model.md
```

These two files are your authoring contract for this scan. Every finding you produce **must** conform to them.

### 1c. Reason over the project

Read the relevant source files from `{project}`. For each finding you identify:

**Mandatory for Vulnerability and Bug findings:**
- `file` + `line` — the exact file path and line number
- `codeRef` — `"<file>:<line>"` (e.g. `"src/main/java/Foo.java:42"`)
- `ruleId` — the SonarSource RSPEC key (e.g. `"S3649"`)
- `recommendation` — a **concrete, directly-applicable fix**: the exact code change, config value, library call, or pattern substitution — NOT generic advice

**Recommendation quality bar (strictly enforced):**
- ❌ `"Sanitize user input before using it in a query"` — too vague
- ✅ `"Replace the string concatenation on line 42 with a parameterized query: \`stmt.setString(1, userId)\` and remove the direct \`query += userId\` concatenation"`
- ❌ `"Avoid hardcoded credentials"` — too vague
- ✅ `"Move the password on line 17 to an environment variable: \`System.getenv(\"DB_PASSWORD\")\`, remove the literal string \`\"admin123\"\` from the source, and rotate the credential"`

If you cannot produce a concrete recommendation with a specific code location, lower your confidence (`confidence: 0.5`) and document what additional context you'd need in `description`.

**For Code Smell, Duplication, and Complexity findings:** `file` and `line` are still strongly preferred, but a class-level or module-level reference is acceptable when the issue spans multiple lines.

**Category values** — use exactly these strings (they drive the By Category and Vulnerabilities sheets automatically):
- `"Bug"`, `"Vulnerability"`, `"Security Hotspot"`, `"Code Smell"`, `"Duplication"`, `"Complexity"`

**Severity mapping** — see `resources/shared/severity-and-rating-model.md` for the full Sonar→DCA mapping. Summary:
- Sonar Blocker → `"CRITICAL"`, Critical → `"HIGH"`, Major → `"MEDIUM"`, Minor → `"LOW"`, Info → `"INFO"`

### 1d. Write sonar-findings.json

Write the findings to `{output}/sonar-findings.json` using the template in `templates/report-json.md`. The exact field names matter — the ingest step maps them directly to `Finding`.

**Top-level JSON contract:**

```jsonc
{
  "meta": {
    "project": "<project name>",
    "engine":  "<engine id, e.g. spring>",
    "stack":   "<human stack label, e.g. Spring Boot>",
    "timestamp": "<ISO-8601 UTC>"
  },
  "role": "<ea|tl|de|qa|devops|security|pm|ba|migration|content|generic>",
  "findings": [ /* Finding objects — see per-finding contract in Step 1c */ ]
}
```

The `role` field is **required**. It records which role you (the LLM) were
acting under while producing this file. Use the role resolved on activation
(see the "Role-aware behavior" section above). At ingest time, this value
is picked up automatically unless `--role=<code>` is passed to
`run.ts --ingest`, in which case the CLI flag wins (a WARN is logged when
they differ).

```bash
# Output location (default: {project}/sonar-reports)
{output}/sonar-findings.json
```

Log: `✅ Wrote {N} finding(s) to sonar-findings.json (role: <code>)`

---

## Step 2: Ingest — produce the standardized Excel report

After `sonar-findings.json` is written, immediately run the ingest step:

```bash
cd {skill_path}/scripts
npx ts-node run.ts \
  --ingest {output}/sonar-findings.json \
  --path {project} \
  [--engine {engine}] \
  [--output {output}] \
  [--create-branch] \
  [--source-branch {source_branch}]
```

The ingest step:
1. Reads and validates `sonar-findings.json` → `Finding[]`
2. Computes Reliability, Security, and Maintainability ratings (A–E)
3. Evaluates the Quality Gate (PASS = all three A; any non-A = FAIL)
4. Calls `emitStandardOutputs()` → `sonar-scan-<branch>-<timestamp>-agent-report.xlsx` + Markdown twin + `CHANGE-LOG.md`
5. Adds a dedicated **Vulnerabilities** sheet to the workbook (color-coded by severity, concrete fix column)

---

## Rule-pack routing

| Stack (engine id) | Rule pack path |
|-------------------|----------------|
| `aem` | `resources/rule-packs/aem/rules.md` |
| `commerce-paas` | `resources/rule-packs/commerce-paas/rules.md` |
| `commerce-saas` | `resources/rule-packs/commerce-saas/rules.md` |
| `sling` | `resources/rule-packs/sling/rules.md` |
| `spring` | `resources/rule-packs/spring/rules.md` |
| `app-builder` | `resources/rule-packs/app-builder/rules.md` |
| `eds` | `resources/rule-packs/eds/rules.md` |
| `eds-commerce` | `resources/rule-packs/eds-commerce/rules.md` |

Aliases: `aemcs`/`aemams` → `aem`; `commerce` → `commerce-paas`.

---

## Output

After both steps complete, report to the user:

```
🎯 Sonar Scan complete — <projectName> (<stack>)

Quality Gate: PASS / FAIL
  Reliability (Bugs):       <A–E>
  Security (Vulns+Hotspots): <A–E>
  Maintainability (Smells):  <A–E>

Findings: <CRITICAL> critical · <HIGH> high · <MEDIUM> medium · <LOW> low · <INFO> info

📊 Report:     <xlsxPath>    (see 'Vulnerabilities' sheet for security fixes)
📝 Markdown:   <mdPath>
📋 CHANGE-LOG: <changelogPath>
```

If the Quality Gate FAILS, emphasize which rating(s) drove the failure and point to the specific finding(s) on the Vulnerabilities sheet.

---

## New in v1.1 — CLI enhancements

### `--focus <csv>` — narrow the run to a subset of the 6 categories

Restricts BOTH the LLM Step-1 rule pack AND the Step-2 ingest report to a
subset of the 6 Sonar categories. Accepted tokens (comma-separated):

- `bugs`, `vulnerabilities`, `hotspots`, `smells`, `duplications`, `complexity`

Example:

```bash
npx ts-node run.ts --ingest sonar-findings.json --path /project \
  --focus vulnerabilities,hotspots
```

The ingest filters `sonar-findings.json` rows to just the requested
categories before rating math runs. Ratings for excluded categories fall
back to `A` (empty set).

### `--auto-ingest` / `--watch` — one-command two-step

Step 1 is LLM-driven and cannot be launched by the dispatcher. Instead:

```bash
npx ts-node run.ts --path /project --auto-ingest
# → prints:  Two-step mode: run 'sonar scan my project at /project' in the
#            AI chat to produce sonar-findings.json, then this dispatcher
#            will auto-ingest.
# → polls every 2s for ./sonar-findings.json (or --findings-path <path>)
# → runs Step 2 automatically once the file appears
# → times out after --watch-timeout <seconds> (default 300)
```

`--watch` is an alias of `--auto-ingest`.

### `--no-fail` — opt out of the CI Quality-Gate exit code

By default, Step 2 exits with code **1** when the Quality Gate is FAIL, so
the run can be wired into a required CI check. Pass `--no-fail` to preserve
the pre-v1.1 behaviour (always exit 0) for CI configs with their own gate
logic.

### AST-based cyclomatic complexity

The Step-2 ingest now runs a real per-function cyclomatic count via the
shared tree-sitter harness (Java for `aem`/`commerce-paas` variant/`spring`/
`sling`; JS/TS for `app-builder`/`commerce-saas`/`eds`/`eds-commerce`; PHP
for `commerce-paas`). Functions with cyclomatic complexity:

- `> 15` → HIGH `Complexity` smell
- `> 25` → CRITICAL `Complexity` smell

These are appended to the LLM findings **before** rating math runs, so they
drive the Maintainability rating and the Quality Gate.

---

## Future extension (not in v1)

**Real SonarQube/SonarCloud API ingestion** — connecting to a Sonar server (`--sonar-host-url`), fetching project issues via the REST API, or ingesting a `sonar-report.json` export — is explicitly out of scope for v1 to keep the agent dependency-free. This would be a `--sonar-api` mode in a future release.

**Coverage-based gate** — coverage % thresholds (new-code gate) are owned by the Test-Coverage agent. The sonar-scan Quality Gate uses the three severity-based ratings only.
