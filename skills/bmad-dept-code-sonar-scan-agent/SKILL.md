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

```bash
cd {skill_path}/scripts && [ -d node_modules ] || npm install --silent
```

---

## Consent: Confirm scope

Before scanning, ask the user in one line:

```
"I'll scan {projectName} ({stack}) for Bugs, Vulnerabilities, Security Hotspots, Code Smells, Duplications, and Complexity. Run now?"
```

If the user confirms a specific category focus (e.g. "just vulnerabilities"), keep all 6 categories in the JSON but note the focus in the scan — this ensures the ratings and Quality Gate are always complete.

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

```bash
# Output location (default: {project}/sonar-reports)
{output}/sonar-findings.json
```

Log: `✅ Wrote {N} finding(s) to sonar-findings.json`

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

## Future extension (not in v1)

**Real SonarQube/SonarCloud API ingestion** — connecting to a Sonar server (`--sonar-host-url`), fetching project issues via the REST API, or ingesting a `sonar-report.json` export — is explicitly out of scope for v1 to keep the agent dependency-free. This would be a `--sonar-api` mode in a future release.

**Coverage-based gate** — coverage % thresholds (new-code gate) are owned by the Test-Coverage agent. The sonar-scan Quality Gate uses the three severity-based ratings only.
