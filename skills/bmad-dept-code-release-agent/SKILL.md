---
name: bmad-dept-code-release-agent
description: "Release & Deployment Specialist — the 8th agent of the BMAD DEPT Code Agent suite (audit, generation, impact-analysis, sonar-scan, test-coverage, requirements, architecture, release). Authors CI/CD pipelines (Cloud Manager, GitHub Actions, GitLab CI, CircleCI, Jenkins, Azure DevOps), release notes from commit history, deploy plans, rollback plans, env-diff calculations, and stakeholder announcements. Grounded in per-stack Adobe/JVM deploy idioms across all 8 supported stacks."
keywords: ["release", "deploy", "ci/cd", "pipeline", "release notes", "rollback", "env diff", "canary", "blue-green", "cloud manager", "github actions", "gitlab ci", "changelog"]
---

# BMAD DEPT Code Agent — Release Skill

## Purpose

The **Release** agent — the 8th agent in the BMAD DEPT Code Agent suite
(audit, generation, impact-analysis, sonar-scan, test-coverage,
requirements, architecture, release). It is the **release & deployment
specialist** that turns a set of merged changes into a shippable release
across **8 stacks**:

- **AEM** — AEM as a Cloud Service (AEMaaCS) + AEM AMS
- **Adobe Commerce (PaaS)** — Magento 2
- **Adobe Commerce SaaS** — Catalog Service / Live Search / storefront drop-ins
- **Apache Sling / Shaft** (sling-12)
- **Spring Boot** custom middleware
- **Adobe App Builder** — I/O Runtime, API Mesh, Commerce UI Extensibility, AEM UI Extensibility
- **Edge Delivery Services (EDS)**
- **EDS + Commerce** hybrid

Where the Requirements agent turns product intent into a BRD, Architecture
authors the design, Generation scaffolds code, Audit / Sonar / Test-Coverage
gate quality, and Impact Analysis traces blast radius — **Release closes
SDLC phase 5 (Deploy/Release)**. It produces the artifacts that ship the
code: CI/CD pipeline definitions, release notes from commit history, deploy
plans keyed to a rollout strategy, rollback playbooks, environment diffs
between source and target environments, and multi-channel stakeholder
announcements.

Unlike Architecture (which specifies "how to build"), Release specifies
**"how to ship"** — the pipeline that runs the build, the notes that
describe what changed, the plan that phases the rollout, and the playbook
that recovers when the deploy goes wrong.

> **Release is a release-authoring specialist, not a release executor.**
> It does not run `kubectl apply`, trigger a Cloud Manager pipeline, or
> post to Slack. It emits the artifacts your CI/CD platform, your
> Confluence/Jira/Slack surfaces, and your on-call team consume. See
> **Constraints / non-goals** below.

### Two modes

**Full release (default when `--artifacts all`).** From a release version,
optional git ref range, and target environment the agent emits every
resolvable artifact: `pipeline.<ext>`, `RELEASE_NOTES.md`,
`DEPLOY_PLAN.md`, `ROLLBACK_PLAN.md`, `ENV_DIFF.md`, `ANNOUNCEMENT.md`.

**Individual artifact.** Narrow the run via `--artifacts pipeline`,
`--artifacts release-notes`, etc. The agent authors exactly the requested
artifact using the stack template and available inputs.

## Activation

This skill activates when the user asks to:

- Author release notes / generate release notes / changelog from git history
- Generate a pipeline / author a CI/CD workflow / write a Jenkinsfile
- Write a deploy plan / release plan / rollout plan
- Write a rollback plan / recovery playbook
- Env-diff / env-config diff / compare stage vs prod
- Release announcement / stakeholder email / release post
- CI/CD for X / Cloud Manager pipeline / GitHub Actions workflow

Menu codes (see `skills/module-help.csv`):

| Code | Action |
|------|--------|
| `RY` | Full release pack (auto-detect stack + pipeline; all artifacts). |
| `RR` | Release notes from git history (`--artifacts release-notes`). |
| `RT` | Deploy plan (`--artifacts deploy-plan`). |
| `RO` | Rollback plan (`--artifacts rollback-plan`). |
| `RV` | Env-diff between two environments (`--artifacts env-diff`). |
| `RI` | Pipeline YAML/Groovy (`--artifacts pipeline`). |
| `RJ` | Author against the AEM stack (`--engine aem`). |
| `RC` | Author against Adobe Commerce (PaaS / Magento 2) (`--engine commerce-paas`). |
| `RK` | Author against Adobe Commerce SaaS (`--engine commerce-saas`). |
| `RF` | Author against Sling / Shaft (`--engine sling`). |
| `RG` | Author against Spring Boot (`--engine spring`). |
| `RU` | Author against Adobe App Builder (`--engine app-builder`). |
| `RH` | Author against Edge Delivery Services (`--engine eds`). |
| `RW` | Author against EDS + Commerce hybrid (`--engine eds-commerce`). |
| `LG` | List engines / stacks supported by the release agent (`--list-engines`). |

## Prompt → Action Resolution

When a user triggers the Release agent, map their prompt to a `run.ts`
invocation. All flags below are already wired in `scripts/run.ts` (see the
CLI reference at the bottom of this file — no invented flags).

| User says… | Resolves to |
|---|---|
| "generate release notes from main..v2.5.0" | `--artifacts release-notes --from-ref main --to-ref v2.5.0` |
| "release notes for 2.5.0, keep-a-changelog format" | `--artifacts release-notes --release-version 2.5.0 --commit-format keep-a-changelog` |
| "author Cloud Manager pipeline for our AEM project" | `--artifacts pipeline --pipeline cloudmanager --engine aem` |
| "GitHub Actions workflow for our Spring service" | `--artifacts pipeline --pipeline github-actions --engine spring` |
| "deploy plan for 2.5.0 canary rollout" | `--artifacts deploy-plan --release-version 2.5.0 --rollout canary` |
| "blue-green deploy plan for stage" | `--artifacts deploy-plan --rollout blue-green --to-env stage` |
| "env-diff stage vs prod" | `--artifacts env-diff --env stage --to-env prod` |
| "rollback plan for the payment-service outage" | `--artifacts rollback-plan` |
| "release announcement for the loyalty launch" | `--artifacts announcement --release-version 2.5.0` |
| "chain: full release — pipeline + notes + deploy + rollback + announcement" | `--artifacts all --release-version 2.5.0` |
| "release as devops" | `--role devops --artifacts all` |
| "cut a release branch first" | Append `--create-branch` |
| "no install prompt" | Append `--yes-install` |
| "fail CI on overdue release gates" | Append `--fail-on-overdue` |

### Compound resolution

Combine flags when the prompt names multiple inputs:

- "full release 2.5.0 for AEM as devops, canary, cut a branch"
  → `--role devops --engine aem --release-version 2.5.0 --rollout canary --artifacts all --create-branch`
- "notes + announcement for v2.5.0 in keep-a-changelog style"
  → `--release-version 2.5.0 --artifacts release-notes,announcement --commit-format keep-a-changelog`
- "GitLab pipeline + rollback plan for the commerce upgrade, blue-green"
  → `--pipeline gitlab-ci --engine commerce-paas --rollout blue-green --artifacts pipeline,rollback-plan`

### Missing required info — ask (do not guess)

The agent needs enough context to author against. If `--artifacts=release-notes`
(or `all`) is requested but no `--from-ref` / `--to-ref` are present and no
git tags exist to infer a range from:

> "I need a git ref range for the release notes — either give me the
> previous release tag (`--from-ref v2.4.0`) or a commit SHA to start from."

If `--artifacts=pipeline` (or `all`) is requested but the project has no
detectable CI system and no `--pipeline` was passed:

> "Which CI platform should I author for? — cloudmanager /
> github-actions / gitlab-ci / circleci / jenkins / azure-devops."

Everything else has a sensible default: `--pipeline` auto-detected from
project files, `--rollout` role-driven (`devops`→canary,
`migration`→blue-green, else `rolling`), `--commit-format conventional`,
`--engine` auto-detect, `--role` from `.bmad/role.yaml` or `generic`,
output at `<project>/release-reports/`.

## Intake mode (interactive vs technical)

> **For fast, enterprise-grade execution, prefer One-shot mode (see below).**
> Intake mode is for exploratory / first-time users.

> **CRITICAL:** The very first response to any activation must be the
> intake-mode question — unless `.bmad/intake.yaml` exists with a saved
> preference. Do NOT skip this. Do NOT show a CLI command as the first
> response.

When a user triggers this agent — via a natural-language prompt or a menu
entry — do NOT show or run a raw CLI command as the first response. Ask
which drive style they prefer:

> "Should I drive this **interactively** (I ask you step-by-step questions
> and run everything for you) or **technically** (I show you the CLI command
> with each flag explained, and you decide whether to run it or have me run
> it)?"

Save the answer to `.bmad/intake.yaml` (adjacent to `.bmad/role.yaml`) with
keys `mode: interactive|technical` and `set_at: <ISO-8601>`. On subsequent
runs, read the file silently and skip the prompt unless the user asks to
switch.

To change intake mode later, the user says **"switch intake to interactive"**
or **"switch intake to technical"** — overwrite `.bmad/intake.yaml`.

**Sequencing note.** The `Preflight`, `Pre-flight: Auto-install
Dependencies`, and per-stack authoring sections below must NOT run before
the intake picker resolves. Order for a fresh activation:

1. Resolve intake mode (ask, or read `.bmad/intake.yaml`).
2. If technical → show the command + flag explanations, then run it (with
   the user's OK) or hand off.
3. If interactive → collect the intake questions below, then run silently.
4. Preflight + bootstrap run just before dispatch, once inputs are collected.

### Interactive mode (recommended for first-timers)

Ask one question per turn, in this order. Skip any question the user has
already answered in their initial prompt.

1. "What's the project path? (defaults to current working directory)"
2. "Which stack? (auto-detect / `aem` / `commerce-paas` / `commerce-saas` /
   `sling` / `spring` / `app-builder` / `eds` / `eds-commerce`)"
3. "What's the release version? (e.g. `2.5.0`, or skip if you only want
   pipeline / env-diff)"
4. "Which artifacts? (comma-separated:
   `pipeline,release-notes,deploy-plan,rollback-plan,env-diff,announcement,all` —
   default `all`)"
5. If release-notes in the set → "Ref range? (e.g. `--from-ref v2.4.0
   --to-ref HEAD`; leave blank to auto-infer from git tags)"
6. If pipeline in the set → "Pipeline target? (auto-detect /
   `cloudmanager` / `github-actions` / `gitlab-ci` / `circleci` /
   `jenkins` / `azure-devops`)"
7. If deploy-plan in the set → "Rollout strategy? (`canary` /
   `blue-green` / `rolling` / `feature-flag` / `bigbang` — default follows
   your role)"
8. If env-diff in the set → "Source env and target env? (e.g. `stage`
   vs `prod`)"
9. "Commit format for release notes? (`conventional` / `keep-a-changelog` /
   `narrative` — default `conventional`)"
10. "Output format? (`markdown` / `both` — docx planned for a later
    phase, currently emits markdown only)"
11. "Cut a working branch from production? (Y/n)"
12. "Ready to run? (Y/n)"

Once every required input is collected, run the command internally (do NOT
show it unless the user asks) and stream results conversationally:

> "Authoring release 2.5.0 for AEM… pipeline (Cloud Manager), release
> notes (main..v2.5.0, 47 commits: 12 feat / 18 fix / 8 refactor / 9 other),
> deploy plan (canary), rollback plan, env-diff (stage→prod, 6 config
> deltas), announcement. Report saved to
> `release-reports/release-main-20260808_120000-agent-report.xlsx`,
> release index at `release-reports/RELEASE-INDEX.md`. Want me to hand
> the pipeline to Sonar-Scan so the Quality Gate is wired in?"

### Technical mode (for users who want CLI transparency)

Show the fully-formed command in a `bash` code block with one flag per line:

```bash
npx ts-node .claude/skills/bmad-dept-code-release-agent/scripts/run.ts \
  --path /path/to/project \
  --engine aem \
  --release-version 2.5.0 \
  --from-ref v2.4.0 \
  --to-ref HEAD \
  --pipeline cloudmanager \
  --rollout canary \
  --env stage \
  --to-env prod \
  --artifacts all \
  --commit-format conventional \
  --format markdown \
  --create-branch
```

Below the block, add a bulleted list explaining each flag in plain English:

- `--path` — the project root; used for stack + pipeline auto-detection
  and as the base for the output directory.
- `--engine aem` — force the AEM authoring templates; without this the
  dispatcher probes the tree for stack signals.
- `--release-version 2.5.0` — the semantic version cut on the release.
- `--from-ref` / `--to-ref` — the git ref range for release notes and
  env-diff (default `--to-ref HEAD`).
- `--pipeline cloudmanager` — the CI/CD platform to author for; auto-detected
  when omitted (falls back to Cloud Manager for AEM projects with `pom.xml`
  + AEM archetype signals).
- `--rollout canary` — the rollout strategy the deploy plan phases against
  (`canary` / `blue-green` / `rolling` / `feature-flag` / `bigbang`).
- `--env` / `--to-env` — the source and target environments for the env-diff.
- `--artifacts all` — every artifact the agent can author; narrow with
  a comma-separated subset (see § Artifact catalog).
- `--commit-format conventional` — how commits are grouped in release notes
  (`conventional` / `keep-a-changelog` / `narrative`).
- `--format markdown` — output format (docx planned for a later phase;
  passing `both` writes markdown only for now with a warning).
- `--create-branch` — cut a working `dca/release-<stack>-<timestamp>`
  branch (from `production`/`main`/`master`/`develop`) before writing outputs.

Then ask: **"Want me to run this now, or will you copy-paste it?"**

- If **run for me** → execute silently and stream results (same as interactive mode).
- If **I'll run it** → acknowledge, and remind them: "Report will land in
  `<project>/release-reports/`. Come back with 'summarize the release'
  or 'wire the pipeline to Sonar-Scan' when you're done."

## One-shot mode

The **preferred enterprise path.** When the user's initial prompt fully
specifies what to run, do NOT ask any clarifying questions — execute
end-to-end, stream results, done. Use defaults from `.bmad/role.yaml`,
`.bmad/intake.yaml`, `.bmad/conventions.yaml`, and reasonable stack /
pipeline auto-detection to fill missing inputs.

### When to enter one-shot mode

Trigger phrases (any of):

- "release end-to-end", "no questions, just do it", "one-shot",
  "author release and go", "auto"
- OR any prompt that specifies: (a) the operation (release / notes /
  pipeline / deploy plan / rollback / env-diff / announcement), (b) the
  project path (default: cwd), (c) at least one of: `--release-version`,
  `--from-ref`, `--pipeline`, `--env`

You DO NOT need every field explicitly — role + intake + conventions cover
the rest silently.

### Precedence for missing inputs

1. **Explicit in the user's prompt** (highest — always wins)
2. **`--flag` on run.ts** (headless / CI)
3. **`.bmad/role.yaml`** (role-driven default rollout + artifact emphasis)
4. **`.bmad/intake.yaml`** (interactive vs technical — one-shot forces technical + skip)
5. **`.bmad/conventions.yaml`** (project conventions: env names, commit style, branch names)
6. **Auto-detected** (stack from repo signatures; pipeline from CI files)
7. **Sensible defaults** (`--commit-format conventional`, `--to-ref HEAD`,
   `--format markdown`, `--artifacts all`, output at `release-reports/`)

### What one-shot DOES silence

- The intake picker ("Interactive or Technical?") — one-shot forces technical.
- The **artifact picker** — one-shot uses `--artifacts all` unless the
  prompt explicitly narrows.
- The role picker (if `.bmad/role.yaml` absent) — one-shot uses `generic`
  silently (log to stderr: "one-shot: no role file, defaulting to generic").
- The rollout / pipeline / commit-format confirmations — one-shot uses
  defaults or explicit flags.
- The confirmation prompts around `--create-branch`, `--yes-install` —
  one-shot assumes yes for install, no for branch cut unless the prompt
  says otherwise.

### What one-shot DOES ask about (only when truly critical)

- **Release notes with no ref range.** If `--artifacts=release-notes`
  (or `all`) is requested but no `--from-ref` / `--to-ref` are present
  and no git tags exist to infer from, ask ONCE:

  > "I need a git ref range for the release notes — either give me the
  > previous release tag (`--from-ref v2.4.0`) or a commit SHA to start from."

- **Pipeline with no auto-detect signal.** If `--artifacts=pipeline`
  (or `all`) is requested and no CI platform is detected in the project
  tree and no `--pipeline` was passed, ask ONCE:

  > "Which CI platform should I author for? — cloudmanager /
  > github-actions / gitlab-ci / circleci / jenkins / azure-devops."

- **Env-diff with no envs.** If `--artifacts=env-diff` was requested but
  `--env` and `--to-env` were both omitted, ask ONCE:

  > "Which two environments should I diff? (source vs target, e.g. `stage`
  > vs `prod`)"

  Everything else stays silent.

### One-shot prompt examples for the Release agent

Each example shows what the user pastes and what the AI silently resolves.

> **User:** "release notes from main..v2.5.0"
> **AI silently resolves:** path=cwd, engine=auto-detect,
> artifacts=`release-notes`, from-ref=`main`, to-ref=`v2.5.0`,
> commit-format=conventional, role=(from `.bmad/role.yaml` or `generic`),
> format=markdown, output-dir=`release-reports/`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --from-ref main --to-ref v2.5.0 --artifacts release-notes --technical --no-preflight --yes-install`
> **AI reports:** "Release notes: 47 commits grouped by conventional-commit
> type (12 feat / 18 fix / 8 refactor / 3 perf / 6 chore). 4 breaking
> changes surfaced. Saved to `release-reports/RELEASE_NOTES.md`. Want me
> to draft the announcement email next?"

> **User:** "Cloud Manager pipeline for our AEM project, canary rollout"
> **AI silently resolves:** engine=`aem` (or auto-detect), pipeline=`cloudmanager`,
> rollout=`canary`, artifacts=`pipeline`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --engine aem --pipeline cloudmanager --rollout canary --artifacts pipeline --technical --no-preflight --yes-install`
> **AI reports:** "Authored `.cloudmanager/pipelines/production.yaml` —
> stage/prod pipelines, custom event handlers for validate/build/deploy,
> Cloud Manager quality-gate thresholds preserved, canary rollout via
> Cloud Manager staged promotion. Want me to author the deploy plan
> alongside?"

> **User:** "deploy plan for 2.5.0 to prod, blue-green"
> **AI silently resolves:** artifacts=`deploy-plan`, release-version=`2.5.0`,
> to-env=`prod`, rollout=`blue-green`, engine=auto-detect.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --release-version 2.5.0 --to-env prod --rollout blue-green --artifacts deploy-plan --technical --no-preflight --yes-install`
> **AI reports:** "Deploy plan (blue-green, 4 phases: warm-blue → smoke →
> traffic-cut → drain-green). Pre-deploy checklist: 7 items (approvals,
> quality gates, security review, dep-check, migration ready, config
> reviewed, on-call notified). Rollback triggers: 5. Saved to
> `release-reports/DEPLOY_PLAN.md`."

> **User:** "env-diff stage vs prod"
> **AI silently resolves:** artifacts=`env-diff`, env=`stage`, to-env=`prod`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --env stage --to-env prod --artifacts env-diff --technical --no-preflight --yes-install`
> **AI reports:** "Env-diff (stage → prod): 6 config deltas, 3 env-var
> deltas, 2 feature-flag deltas, 1 secret rotation pending, infrastructure
> deltas: prod = 2× instance count. Risk assessment: 1 HIGH (secret
> rotation), 3 MEDIUM, 4 INFO. Saved to `release-reports/ENV_DIFF.md`."

> **User:** "rollback plan for payment-service 2.5.0"
> **AI silently resolves:** artifacts=`rollback-plan`, release-version=`2.5.0`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --release-version 2.5.0 --artifacts rollback-plan --technical --no-preflight --yes-install`
> **AI reports:** "Rollback playbook authored — 5 triggers (error-rate
> >1%, p99 latency >2s, cart-conversion drop >10%, alert flood, manual
> call), decision matrix, 7 numbered rollback steps, post-rollback RCA
> checklist. Saved to `release-reports/ROLLBACK_PLAN.md`."

> **User:** "release announcement for the loyalty launch"
> **AI silently resolves:** artifacts=`announcement`, release-version and
> release name inferred from prompt.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --artifacts announcement --technical --no-preflight --yes-install`
> **AI reports:** "Announcement pack: email (subject + body + CTA), Slack
> (short + emoji), Confluence (long-form with sections), Twitter/LinkedIn
> short-form. All four in `release-reports/ANNOUNCEMENT.md` under
> per-channel headings — copy-paste ready."

> **User:** "full release 2.5.0 — pipeline, notes, deploy plan, rollback, announcement"
> **AI silently resolves:** artifacts=`all` (explicit list matches),
> release-version=`2.5.0`, pipeline=auto-detect, rollout=role-driven,
> engine=auto-detect.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --release-version 2.5.0 --artifacts all --technical --no-preflight --yes-install`
> **AI reports:** end-to-end summary linking pipeline, notes, deploy plan,
> rollback plan, env-diff, and announcement counts.

### After one-shot execution

Always:

- Print a one-line summary (pipeline / notes / plan / rollback / diff /
  announcement counts, RELEASE-INDEX path, report path).
- Print the recommended follow-up from the role matrix (e.g. DevOps role
  after release → "wire the pipeline into the audit + sonar-scan gates").
- Do NOT ask "want me to run the follow-up?" — the user will ask if they do.

Never:

- Ask what mode they wanted after the fact.
- Ask if they want to save preferences.
- Explain what you did (unless they ask).

### CLI equivalent for one-shot (technical mode)

Every one-shot prompt has a direct CLI equivalent using all Phase 1 flags:

```bash
npx ts-node .claude/skills/bmad-dept-code-release-agent/scripts/run.ts \
  --path . \
  --role <code> \
  --engine <stack> \
  --release-version 2.5.0 \
  --from-ref v2.4.0 \
  --to-ref HEAD \
  --pipeline <target> \
  --rollout <strategy> \
  --env stage \
  --to-env prod \
  --artifacts all \
  --commit-format conventional \
  --format markdown \
  --technical \
  --yes-install \
  --no-preflight \
  --sla-path .bmad/sla.yaml \
  --decisions-path .bmad/decisions.yaml
```

Add `--fail-on-overdue` for CI gates, `--include-decided` to bypass
decisions, `--create-branch` for a working branch.

## Role-aware behavior

The Release agent adapts its **default artifact emphasis**, **rollout
strategy**, and **recommended follow-up** to the role of the person
driving the run. Role selection is a **shared** concept across the
8-agent DCA suite and is persisted per-project at
`<projectRoot>/.bmad/role.yaml` (see `skills/shared/role/ROLES.md`).

### Role check on activation

**Before running any mode**, the AI agent MUST perform the role handshake
(same shape as the Architecture and Requirements agents):

1. Check for `<projectRoot>/.bmad/role.yaml`.
2. If ABSENT, ask the user — verbatim:

   > "Which role best matches how you'll use this plugin? Pick one from the
   > 10 codes below (or say 'generic' to skip):"

   Then list the **6 promoted roles** first:

   - `ea` — Enterprise Architect: portfolio-level rollout ADR + risk summary.
   - `tl` — Tech Lead / Solution Architect: solution-level deploy plan.
   - `de` — Senior Delivery Engineer: commit-level release notes + component-scoped deploy plan.
   - `qa` — QA / SDET: release-gate checklist + regression scope + UAT sign-off.
   - `devops` — DevOps / SRE: **primary role for this agent** — pipeline YAML, canary orchestration, rollback drill runbook.
   - `security` — Security Engineer: release security-review gate + secrets-rotation checklist + PCI/HIPAA release-notes annotations.

   Then the **4 additional roles**:

   - `pm` — Product Manager / PMO: stakeholder announcement + business-outcome release-notes framing.
   - `ba` — Business Analyst: feature-to-requirement traceability in release notes + business-rules changelog.
   - `migration` — Migration/Upgrade Lead: cutover plan + parallel-run window + freeze windows + go/no-go criteria.
   - `content` — Content/CMS Engineer: content-migration release notes + dispatcher cache warmup.

   Then the fallback: `generic` — balanced default.

3. Persist the choice using the shared `writeRoleFile(projectRoot, role,
   "interactive")` helper.
4. If PRESENT, read it silently and use the `role:` field — do NOT re-prompt.
5. **Per-run override**: `"as <role>"` prefix or `--role=<code>` on
   `run.ts`. Does not write `.bmad/role.yaml`.
6. **Permanent change**: `"switch role to <code>"` overwrites `.bmad/role.yaml`.

### Role → Release behavior matrix

The `roleDefaultRollout(role)` in `scripts/run.ts` codifies the rollout
defaults. This table adds artifact emphasis and follow-up per role.

| Role | Default rollout | Emphasis | Recommended follow-up |
|---|---|---|---|
| `ea` | `feature-flag` | **Portfolio-level rollout ADR** (linked from the ADR set produced by Architecture). Release plan aggregates multiple teams' work into a single release train; risk/impact summary at portfolio level; multi-team coordination doc. | "impact-analyze the release scope across the estate" |
| `tl` | `rolling` | **Solution-level deploy plan** with team ownership called out (RACI). Release runbook links. Team-level rollout schedule. Handoff to team on-call. | "audit the impacted files before we ship" |
| `de` | `rolling` | **Commit-level release notes** — every merged PR surfaces with author, ticket, and file-touch summary. Component-scoped deploy plan (which components change). Feature-flag flip guide. | "sonar-scan the delta since the last release" |
| `qa` | `canary` | **Release-gate checklist** — regression test scope, feature-flag test matrix, UAT sign-off template, smoke-test script per phase. | "test-coverage the changed files against the release-gate threshold" |
| `devops` | `canary` | **Primary role for this agent.** Pipeline YAML/Groovy generation with real quality-gate integration (audit + sonar-scan + coverage). Canary orchestration steps (5% → 25% → 50% → 100%). Observability wire-up during deploy (RED/USE metrics, error budgets). Rollback drill runbook with practiced steps. | "wire the pipeline into the audit + sonar-scan gates" |
| `security` | `canary` | **Release security-review gate** — secrets-rotation checklist, vulnerability-fix inclusion audit ("did we ship all HIGH-severity fixes from the last sonar-scan?"), PCI/HIPAA release-notes annotations, dep-audit summary. | "sonar-scan the release scope for missed vulns" |
| `pm` | `feature-flag` | **Stakeholder announcement** — email + Slack + Confluence + short-form variants. Business-outcome release-notes framing ("delivers 3 loyalty stories, expected NPS uplift +5"). Release KPI tracking (adoption, error-rate, revenue-per-deploy). | "impact-analyze the release scope for the go-live meeting" |
| `ba` | `rolling` | **Feature-to-requirement traceability** in release notes (link each merged PR to the REQ / user story it satisfies from the Requirements agent). Business rules changelog. | "align the BRD to the release scope" |
| `migration` | `blue-green` | **Cutover plan** with a parallel-run window, data-migration ordering (schema first, backfill second, cutover third), freeze windows, explicit go/no-go criteria at each phase gate. | "audit + coverage delta between old and new versions" |
| `content` | `rolling` | **Content-migration release notes** — AEM package deploy order, EDS bulk imports, dispatcher cache warmup, CF migration steps. | "generate the content-fragment / block scaffold for the new release" |
| `generic` | `rolling` | Balanced default — all six artifacts, rolling deploy. | "audit the release scope before we ship" |

### Cross-agent chaining hints per role

| Role | Next agent to invoke | Why |
|---|---|---|
| `ea` | `impact-analysis` | Portfolio blast radius of the release train. |
| `tl` | `audit` | Baseline quality of the release scope. |
| `de` | `sonar-scan` | Vuln + code-smell delta since the last release. |
| `qa` | `test-coverage` | Coverage gate against the changed files. |
| `devops` | `sonar-scan` + `audit` | Wire both gates into the pipeline the release agent just authored. |
| `security` | `sonar-scan` | Vuln scan for the release scope; block ship on HIGH residuals. |
| `pm` | `impact-analysis` | Business impact framing for the release comms. |
| `ba` | `requirements` | Reconcile release scope with BRD. |
| `migration` | `impact-analysis` + `test-coverage` | Cross-version impact + coverage delta on the migration surface. |
| `content` | `generation` | Emit content scaffold aligned to the new release. |
| `generic` | `audit` | Quality baseline for the release. |

The resolved role is exposed to child engines via `process.env.DCA_ROLE`
(and `DCA_ROLE_NAME` / `DCA_ROLE_FLAVOR` / `DCA_ROLE_SOURCE`), recorded on
the Run-Info sheet of the standardized report, and a one-line
`[dca-role] <Name> (source: <cli-flag|role-file|generic-fallback>)` is
printed to stderr on every run.

## Pre-flight: Auto-install Dependencies

Before ANY command execution, run the shared bootstrap. It installs the
`shared/` foundation (if missing) + this agent's `scripts/` deps in the
correct order, with a one-line confirmation prompt. First-time cost is
~80MB / ~30–60s; subsequent runs are silent no-ops.

**POSIX (macOS, Linux, WSL):**

```bash
bash .claude/skills/shared/bootstrap.sh release
```

**Windows (or when sh is unavailable):**

```bash
node .claude/skills/shared/bootstrap.js release
```

**Headless / CI mode (skip prompt):**

```bash
bash .claude/skills/shared/bootstrap.sh release --yes    # install without asking
bash .claude/skills/shared/bootstrap.sh release --no     # error if deps missing
```

**Behavior:**

- Both `node_modules` present → silent no-op (exit 0)
- Either missing → confirmation prompt, then install if approved
- User declines → exit 3
- Install failure → exit 4

**Instructions to the AI:** Do NOT skip this step. The bootstrap script
handles the confirmation — you do NOT need to ask separately. `run.ts` also
accepts `--yes-install` / `--no-install` and forwards them to bootstrap.

> **Note.** The `InstallAgentName` enum in `skills/shared/install/preflight.ts`
> may not yet include a dedicated `"release"` entry; if so, `run.ts`
> piggybacks on the architecture entry (identical shared deps:
> exceljs, fast-glob, mammoth). Invisible to the user; the bootstrap prompt
> still names the release agent. <!-- verify: enum entry -->

## Preflight — report the user's LLM & recommend a mode

The moment this command is triggered from an AI assistant, run the preflight
and tell the user — in one line — **which LLM they're on** and **whether the
target project fits their context window**:

```bash
npx ts-node scripts/run.ts --path {project} [--engine {engine}] --preflight
```

It prints the detected **model + context window**, the **project size**
(files/LOC/tokens), the **fit** (% of the window), and a **recommendation**
— **STATIC** (deterministic scaffold only) when the project is large,
**LLM** (rich authoring) when it comfortably fits, or **HYBRID**. Surface
it like:

*"You're on `<model>` (~`<ctx>` context). This project is ~`<pct>%` of your window → I recommend **<mode>**. Proceed?"*

**Rule of thumb for Release:** the LLM authors release notes and
announcements, and populates deploy-plan / rollback-plan / env-diff
placeholders — this is a mostly-LLM agent. The preflight tells you
whether the git-log excerpt for release notes and the env-config files
for env-diff fit comfortably. If the fit is tight, the agent falls back
to template-driven authoring without repo-aware idioms.

## Modes

The Release agent has two artifact-scope modes, both selected by
`--artifacts`:

### Mode: Full release (default with `--artifacts all`)

**Trigger:** `--artifacts all` (default when unspecified), or the prompt
asks for a "full release" / "release pack".

**Steps:**

1. Resolve stack (from `--engine`, else auto-detect from repo signals).
2. Resolve pipeline target (from `--pipeline`, else auto-detect from
   `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/config.yml`,
   `Jenkinsfile`, `azure-pipelines.yml`, else `cloudmanager` for AEM
   `pom.xml` signals).
3. Resolve rollout strategy (from `--rollout`, else role-driven default).
4. Load `resources/pipeline-templates/<stack>.md`,
   `resources/release-notes-templates/<stack>.md`,
   `resources/deploy-plans/<stack>.md`,
   `resources/rollback-plans/<stack>.md`,
   `resources/env-diff-templates/<stack>.md`,
   `resources/announcement-templates/<stack>.md` (whichever the resolved
   artifact set needs). <!-- some land in 3.2b/3.2c -->
5. Load the master templates under `templates/`:
   `pipeline-<target>.yml` (or `.groovy`), `release-notes.md`,
   `deploy-plan.md`, `rollback-plan.md`, `env-diff.md`, `announcement.md`.
6. Feed the release context + stack guides + git-history excerpt (for
   release-notes) + env config diff (for env-diff) to the LLM authoring
   pass.
7. Emit the artifact files + the standard workbook + `RELEASE-INDEX.md`
   (see § Written files).
8. Report the artifact counts and next-agent handoff.

### Mode: Individual artifact

**Trigger:** `--artifacts <one>` — narrow to a single artifact
(`pipeline` / `release-notes` / `deploy-plan` / `rollback-plan` /
`env-diff` / `announcement`).

**Steps:** same as full release, but only the requested artifact's
template + stack guide loads, and only the requested file is written.

## Artifact catalog

`--artifacts` accepts a comma-separated list. `all` expands to every
artifact. Missing → `all`.

| Artifact key | Written file(s) | Master template | Per-stack guide | Notes |
|---|---|---|---|---|
| `pipeline` | `pipeline.<ext>` (`.yml` / `.groovy` per target) | `templates/pipeline-<target>.yml` (or `.groovy`) | `resources/pipeline-templates/<stack>.md` | CI/CD workflow for the chosen `--pipeline` target. Auto-detected from CI files if omitted (see § Pipeline-target catalog). |
| `release-notes` | `RELEASE_NOTES.md` | `templates/release-notes.md` | `resources/release-notes-templates/<stack>.md` (Phase 3.2b) | Markdown release notes from git history between `--from-ref` and `--to-ref`. Grouped by Conventional Commits (`feat` / `fix` / `perf` / `refactor` / `docs` / …) when `--commit-format conventional`; sectioned Added/Changed/Deprecated/Removed/Fixed/Security when `--commit-format keep-a-changelog`; free-form summary when `narrative`. |
| `deploy-plan` | `DEPLOY_PLAN.md` | `templates/deploy-plan.md` | `resources/deploy-plans/<stack>.md` (Phase 3.2b) | Deploy plan phased against the resolved `--rollout` strategy. RACI, pre-deploy checklist, phase gates, post-deploy checklist, sign-off block. |
| `rollback-plan` | `ROLLBACK_PLAN.md` | `templates/rollback-plan.md` | `resources/rollback-plans/<stack>.md` (Phase 3.2c) | Rollback playbook. Triggers, decision matrix, numbered steps, stakeholder comms, post-rollback RCA. |
| `env-diff` | `ENV_DIFF.md` | `templates/env-diff.md` | `resources/env-diff-templates/<stack>.md` (Phase 3.2c) | Config-file / env-var / feature-flag / secret / infrastructure diff between `--env` and `--to-env`. Risk assessment per category. |
| `announcement` | `ANNOUNCEMENT.md` | `templates/announcement.md` | `resources/announcement-templates/<stack>.md` (Phase 3.2c) | Multi-channel announcement: email + Slack + Confluence + Twitter/LinkedIn short-form. |
| `all` | Every artifact resolvable given other flags. | — | — | Uses stack defaults + role defaults for anything not disambiguated by explicit flags. |

`--format both` is accepted but currently emits markdown only (docx writer
is planned; a warning is printed on stderr).

## Pipeline-target catalog

`--pipeline` selects the CI/CD platform. When omitted, `autoDetectPipeline()`
in `scripts/run.ts` walks the project root for CI indicators.

| Pipeline target | Master template | Auto-detect signal | Notes |
|---|---|---|---|
| `cloudmanager` | `templates/pipeline-cloudmanager.yml` | `pom.xml` with `com.adobe.aem`, `aem-sdk-api`, `uber-jar`, or `cq-quickstart` markers (only when no other CI file is present, else preferred order kicks in) | Adobe Cloud Manager pipeline definition. Custom event handlers for validate/build/deploy stages, environment gates. |
| `github-actions` | `templates/pipeline-github-actions.yml` | `.github/workflows/*.yml` (or `.yaml`) | GitHub Actions workflow. Jobs: setup, build, test, security-scan, audit gate, deploy (env matrix), post-deploy. |
| `gitlab-ci` | `templates/pipeline-gitlab-ci.yml` | `.gitlab-ci.yml` at repo root | Same shape as GH Actions but GitLab CI syntax (stages, jobs, `before_script`, `needs`, `rules`). |
| `circleci` | `templates/pipeline-circleci.yml` | `.circleci/config.yml` | CircleCI 2.1 config. Orbs used sparingly. Workflows with holds for manual approval. |
| `jenkins` | `templates/pipeline-jenkins.groovy` | `Jenkinsfile` at repo root | Declarative pipeline. `withCredentials` for secrets, `input` steps for manual approval. |
| `azure-devops` | `templates/pipeline-azure-devops.yml` | `azure-pipelines.yml` at repo root | Azure Pipelines. Stages/jobs/steps. Templates referenced. Environments with approval gates. |

**Detection precedence.** If a project has multiple CI files (e.g. both
`.github/workflows/` and `Jenkinsfile`), the first hit in the source order
of `autoDetectPipeline()` wins: GitHub Actions → GitLab CI → CircleCI →
Jenkins → Azure DevOps → Cloud Manager (only for AEM projects). Pass
`--pipeline <target>` to override.

## Rollout strategy catalog

`--rollout` selects the rollout strategy the deploy plan phases against.
When omitted, `roleDefaultRollout(role)` supplies a role-driven default.

| Rollout | When to use | Requires |
|---|---|---|
| `canary` | Progressive percentage-based rollout: 5% → 25% → 50% → 100%. Best for consumer traffic where a bad release can be observed quickly. | Traffic-splittable ingress (K8s + Istio/Linkerd, ALB weighted target groups, Fastly/Cloudfront weighted origins) OR feature-flag targeting on user cohorts. |
| `blue-green` | Two identical environments; swap traffic in one cutover. Best for stateful services where mid-flight requests can't tolerate ambiguity. | Two identical environments + DNS/load-balancer cutover control + a warm-up strategy for the idle side. |
| `rolling` | Replace N instances at a time until the fleet is updated. K8s default (`RollingUpdate`). Best for stateless services with backwards-compatible schema changes. | Health-checked orchestrator (K8s, ECS, Nomad) or a fleet manager that respects `--surge` / `--max-unavailable`. |
| `feature-flag` | Deploy the code dark (unreleased); flip the flag to release. Best when release cadence and deploy cadence should decouple (e.g. weekly deploys, per-cohort releases). | Feature-flag provider (LaunchDarkly / Unleash / Split / homegrown) + a flag-flip runbook. |
| `bigbang` | All at once, no ramp. Reserved for hotfixes or when no rollout infra exists. | Nothing — but pair with a fast rollback plan (see `--artifacts rollback-plan`). |

**Role-driven default rollouts** (from `roleDefaultRollout(role)` in `run.ts`):

| Role | Default rollout |
|---|---|
| `devops` | `canary` |
| `security` | `canary` |
| `migration` | `blue-green` |
| `pm`, `ea` | `feature-flag` |
| `de`, `tl` | `rolling` |
| (other) | `rolling` |

## Per-stack authoring instructions

For each of the 8 stacks the Release agent loads per-stack resource files
at authoring time. Keep the tone stack-native — an AEM deploy plan reads
like an AEM deploy plan, not a generic doc with the word "AEM" sprinkled
in.

### AEM (AEMaaCS / AMS) — engine `aem`

- **Pipeline guide:** `resources/pipeline-templates/aem.md`
- **Release-notes guide:** `resources/release-notes-templates/aem.md` (Phase 3.2b)
- **Deploy-plan guide:** `resources/deploy-plans/aem.md` (Phase 3.2b)
- **Rollback guide:** `resources/rollback-plans/aem.md` (Phase 3.2c)
- **Env-diff guide:** `resources/env-diff-templates/aem.md` (Phase 3.2c)
- **Announcement guide:** `resources/announcement-templates/aem.md` (Phase 3.2c)
- **Deploy idioms.** Cloud Manager stage-by-stage promotion (Stage
  quality-gate → Prod quality-gate → Prod deploy); content-package deploy
  order (`ui.config` → `ui.apps` → `ui.content`); dispatcher flush after
  publish; RDE (Rapid Development Environment) preview before Stage;
  environment-specific `run modes` (`stage,publish` / `prod,publish`);
  Cloud Manager quality-gate thresholds (`customer.critical` = 0 blocks
  ship). <!-- verify: current defaults -->
- **Rollout note.** AEM effectively supports Cloud Manager staged
  promotion as its only rollout — canary is not natively supported. For
  content-only changes, use the CDN configuration to shift traffic to a
  staged publish tier.
- **Env-diff note.** Compare OSGi config (`ui.config/src/main/content/jcr_root/apps/*/osgiconfig`)
  by run mode; Cloud Manager environment variables; secrets.

### Adobe Commerce (PaaS / Magento 2) — engine `commerce-paas` (alias `commerce`)

- **Pipeline guide:** `resources/pipeline-templates/commerce-paas.md`
- **Release-notes guide:** `resources/release-notes-templates/commerce-paas.md` (Phase 3.2b)
- **Deploy-plan guide:** `resources/deploy-plans/commerce-paas.md` (Phase 3.2b)
- **Rollback guide:** `resources/rollback-plans/commerce-paas.md` (Phase 3.2c)
- **Env-diff guide:** `resources/env-diff-templates/commerce-paas.md` (Phase 3.2c)
- **Announcement guide:** `resources/announcement-templates/commerce-paas.md` (Phase 3.2c)
- **Deploy idioms.** ECE-Tools deploy for Magento Cloud (or the equivalent
  self-managed script); `setup:upgrade` (DB schema + data patches),
  `setup:di:compile` (generated code), `setup:static-content:deploy`
  (locales × areas × themes), `cache:clean` order (config → block_html →
  full_page), `indexer:reindex` timing, `queue:consumers:start`
  restart. Maintenance mode wrapping (`maintenance:enable/disable`).
- **Rollout note.** Blue-green via Fastly VCL swap or DNS cutover between
  two Magento Cloud projects. Canary is possible with Fastly weighted
  routing but rare in practice; rolling deploy is the norm for multi-node
  fleets.
- **Env-diff note.** `app/etc/env.php` diffs, `app/etc/config.php` module
  state diffs, `.magento.env.yaml` variable diffs.

### Adobe Commerce SaaS — engine `commerce-saas`

- **Pipeline guide:** `resources/pipeline-templates/commerce-saas.md`
- **Release-notes guide:** `resources/release-notes-templates/commerce-saas.md` (Phase 3.2b)
- **Deploy-plan guide:** `resources/deploy-plans/commerce-saas.md` (Phase 3.2b)
- **Rollback guide:** `resources/rollback-plans/commerce-saas.md` (Phase 3.2c)
- **Env-diff guide:** `resources/env-diff-templates/commerce-saas.md` (Phase 3.2c)
- **Announcement guide:** `resources/announcement-templates/commerce-saas.md` (Phase 3.2c)
- **Deploy idioms.** Drop-in bundle deploy (`@dropins/storefront-*`
  version pinning), Catalog Service publish, Live Search index refresh,
  storefront-events schema version bump, EDS deploy (git-based) sync.
- **Rollout note.** Feature-flag or drop-in-version-pinning is the
  effective rollout — SaaS platform manages the backend rollout, custom
  code lives edge-side (EDS) or storefront-side.
- **Env-diff note.** Drop-in versions across environments, API Mesh
  resolver configs, IMS client configs.

### Apache Sling / Shaft (sling-12) — engine `sling`

- **Pipeline guide:** `resources/pipeline-templates/sling.md`
- **Release-notes guide:** `resources/release-notes-templates/sling.md` (Phase 3.2b)
- **Deploy-plan guide:** `resources/deploy-plans/sling.md` (Phase 3.2b)
- **Rollback guide:** `resources/rollback-plans/sling.md` (Phase 3.2c)
- **Env-diff guide:** `resources/env-diff-templates/sling.md` (Phase 3.2c)
- **Announcement guide:** `resources/announcement-templates/sling.md` (Phase 3.2c)
- **Deploy idioms.** OSGi bundle install order (dependencies first, then
  consumers), Feature Model composition for reproducible install sets,
  hot swap via Sling starter vs restart (feature-model composition needs
  restart), health-check `/system/console/healthcheck` verification.
- **Rollout note.** Rolling deploy across the Sling instance pool;
  blue-green when a Sling instance is stateful (e.g. holds JCR).
- **Env-diff note.** OSGi config diffs (`org.apache.sling.*.config`),
  Feature Model files, run-mode-specific configs.

### Spring Boot — engine `spring`

- **Pipeline guide:** `resources/pipeline-templates/spring.md`
- **Release-notes guide:** `resources/release-notes-templates/spring.md` (Phase 3.2b)
- **Deploy-plan guide:** `resources/deploy-plans/spring.md` (Phase 3.2b)
- **Rollback guide:** `resources/rollback-plans/spring.md` (Phase 3.2c)
- **Env-diff guide:** `resources/env-diff-templates/spring.md` (Phase 3.2c)
- **Announcement guide:** `resources/announcement-templates/spring.md` (Phase 3.2c)
- **Deploy idioms.** DB migration ordering (Flyway/Liquibase — schema
  before deploy, backfill during, cleanup after cutover), K8s rolling
  deploy (`RollingUpdate` with `maxSurge`/`maxUnavailable`), Actuator
  `/health/readiness` + `/health/liveness` as deploy gates, Micrometer
  metrics as observability signal during the deploy.
- **Rollout note.** Canary via K8s + Istio/Linkerd traffic-split;
  blue-green via two Deployments + Service selector cutover; rolling is
  the default.
- **Env-diff note.** `application-<profile>.yaml` diffs, Kubernetes
  ConfigMap/Secret diffs, Helm value diffs.

### Adobe App Builder — engine `app-builder`

- **Pipeline guide:** `resources/pipeline-templates/app-builder.md`
- **Release-notes guide:** `resources/release-notes-templates/app-builder.md` (Phase 3.2b)
- **Deploy-plan guide:** `resources/deploy-plans/app-builder.md` (Phase 3.2b)
- **Rollback guide:** `resources/rollback-plans/app-builder.md` (Phase 3.2c)
- **Env-diff guide:** `resources/env-diff-templates/app-builder.md` (Phase 3.2c)
- **Announcement guide:** `resources/announcement-templates/app-builder.md` (Phase 3.2c)
- **Deploy idioms.** `aio app deploy` per namespace (stage / prod
  workspaces in the Developer Console), secret rotation via `aio app
  config set --workspace <ws> -s`, action sequence deploys, API Mesh
  resolver deploys via `aio api-mesh update`, I/O Events provider
  registrations preserved across deploys.
- **Rollout note.** Feature-flag or workspace-swap (stage → prod
  namespace) is the effective rollout — no in-place canary; secondary
  workspace serves as the canary target.
- **Env-diff note.** Workspace-level env vars, API Mesh mesh configs,
  I/O Events provider registrations, IMS client IDs.

### Edge Delivery Services (EDS) — engine `eds`

- **Pipeline guide:** `resources/pipeline-templates/eds.md`
- **Release-notes guide:** `resources/release-notes-templates/eds.md` (Phase 3.2b)
- **Deploy-plan guide:** `resources/deploy-plans/eds.md` (Phase 3.2b)
- **Rollback guide:** `resources/rollback-plans/eds.md` (Phase 3.2c)
- **Env-diff guide:** `resources/env-diff-templates/eds.md` (Phase 3.2c)
- **Announcement guide:** `resources/announcement-templates/eds.md` (Phase 3.2c)
- **Deploy idioms.** Git-based edge deploy — merge to `main` triggers
  edge worker deploy; preview via branch URL; instant rollback via `git
  revert` + push; sheet-driven content and configs (helix-query,
  redirects, metadata) live in Google Docs / SharePoint and version
  independently.
- **Rollout note.** Instant rollback is the safety net; canary via
  helix-query cohort splits or CDN-worker-level routing is niche.
- **Env-diff note.** `paths.json`, `helix-query.yaml`, `head.html`,
  `redirects.xlsx` (or equivalent), and Google Docs / SharePoint config
  sheets between preview and live.

### EDS + Commerce — engine `eds-commerce`

- **Pipeline guide:** `resources/pipeline-templates/eds-commerce.md`
- **Release-notes guide:** `resources/release-notes-templates/eds-commerce.md` (Phase 3.2b)
- **Deploy-plan guide:** `resources/deploy-plans/eds-commerce.md` (Phase 3.2b)
- **Rollback guide:** `resources/rollback-plans/eds-commerce.md` (Phase 3.2c)
- **Env-diff guide:** `resources/env-diff-templates/eds-commerce.md` (Phase 3.2c)
- **Announcement guide:** `resources/announcement-templates/eds-commerce.md` (Phase 3.2c)
- **Deploy idioms.** All EDS idioms plus drop-in bundle version sync
  (drop-in versions must be compatible with the Catalog Service /
  Live Search / Payment Services schema versions in the target
  environment); coordinated release with Commerce SaaS drop-in registry.
- **Rollout note.** Same as EDS — git-based edge deploy with instant
  revert. Drop-in version bumps behave like content bumps: sheet-driven
  or `package.json` pin.
- **Env-diff note.** All EDS diffs plus drop-in versions, IMS client
  configs for Commerce, API Mesh resolver configs.

## Output contract

The Release agent emits the standardized DCA outputs into
`<project>/release-reports/` (override with `--output`), via the shared
`emitStandardOutputs` (agent id `release`). The 15-column Summary
contract is preserved so downstream agents (Audit, Sonar-Scan,
Test-Coverage, Impact-Analysis) can chain off the same row shape.

### Sheets

| Sheet | Contents |
|---|---|
| **Run Info** | Model, context window, stack, role + source, project name / root, release version, from-ref/to-ref, source/target envs, pipeline target, rollout, artifact set, commit format, artifact counts. |
| **Summary** | The 15-column contract, one row per pipeline stage / release-note entry / deploy-plan step / rollback-plan step / env-diff row / announcement channel. |
| **Severity Breakdown** | Counts per severity bucket (`gate` / `risk` / `action` / `info`). |
| **By Category** | Counts per artifact category (`pipeline` / `notes` / `plan` / `rollback` / `diff` / `announcement`). |
| **Recommendations** | Roll-up of the `recommendation` column, sorted by severity. |
| **SLA Status** (Phase 1) | Only when `--no-sla` is NOT set. See § SLA tracking. |
| **Delta** (optional) | When authoring against a prior release (`--from-ref` supplies the diff base), shows what changed vs the prior release notes / deploy plan. |

### 15-column Summary contract

Each finding row carries:

| Column | Value |
|---|---|
| `id` | `REL-<n>` (monotonic per run) |
| `title` | Artifact / step title — pipeline stage name / release note headline / deploy step / rollback step / env-diff row / announcement channel |
| `description` | Full text (stage steps for pipeline; commit summary + author + PR for notes; step details for plans; before/after values for env-diff; channel body excerpt for announcement) |
| `tech-stack` | `aem` \| `commerce-paas` \| `commerce-saas` \| `sling` \| `spring` \| `app-builder` \| `eds` \| `eds-commerce` |
| `category` | `pipeline` \| `notes` \| `plan` \| `rollback` \| `diff` \| `announcement` |
| `code-reference` | File path of the emitted artifact (`pipeline.yml#/jobs/deploy` / `RELEASE_NOTES.md#features` / `DEPLOY_PLAN.md#phase-2` / `ENV_DIFF.md#config`) |
| `severity` | `gate` \| `risk` \| `action` \| `info` (`gate`≈CRITICAL — release blocker; `risk`≈HIGH — proceed with mitigation; `action`≈MEDIUM — do the thing; `info`≈LOW — for the record) |
| `confidence` | `high` (from git history / explicit answer / config file) \| `medium` (LLM-authored, template-aligned) \| `low` (inferred / assumed — needs review) |
| `ruleId` | `REL-<stack>-<type>` (e.g. `REL-aem-pipeline-cloudmanager`, `REL-spring-rollback-migration`, `REL-eds-diff-headhtml`) |
| `recommendation` | Authoring next-step: for pipelines, the wiring hint (e.g. "add audit-gate step"); for notes, the missing category; for env-diff, the reconciliation action |
| `impact` | Impact statement (per-role phrasing: business impact for pm; blast radius for security; runbook link for devops) |
| `effort` | T-shirt: `S` \| `M` \| `L` \| `XL` (per stack; see deploy-plan template) |
| `comments` | Free text — reviewer notes, open questions, blocking dependencies |
| `owner` | Empty at authoring time; the release manager / EM fills it during the review pass |
| `status` | `draft` (default) \| `reviewed` \| `approved` \| `deployed` — advances via the decisions gate and post-deploy update |

### Written files

- `pipeline.yml` (or `pipeline.groovy` for Jenkins) — rendered from
  `templates/pipeline-<target>.yml` (or `.groovy`).
- `RELEASE_NOTES.md` — rendered from `templates/release-notes.md` + git
  history.
- `DEPLOY_PLAN.md` — rendered from `templates/deploy-plan.md`.
- `ROLLBACK_PLAN.md` — rendered from `templates/rollback-plan.md`.
- `ENV_DIFF.md` — rendered from `templates/env-diff.md` + resolved env
  config diff.
- `ANNOUNCEMENT.md` — rendered from `templates/announcement.md`.
- `RELEASE-INDEX.md` — always emitted; manifest of inputs → artifacts.
- `release-<branch>-<timestamp>-agent-report.xlsx` — the standardized workbook.
- `release-<branch>-<timestamp>-agent-report.md` — Markdown twin.
- `CHANGE-LOG.md` — appended at the project root with a one-line run
  summary (e.g. `Release 2.5.0: pipeline(cloudmanager), 47 note(s), 4 plan phase(s), 5 rollback trigger(s), 6 diff row(s), 4 channel(s).`).
- Optional standard git branch `dca/release-<stack>-<timestamp>` — cut
  from `production`/`main`/`master`/`develop` (or `--source-branch <name>`)
  when `--create-branch` is passed.

## Findings gate (Phase 1)

The Release agent participates in the shared **decisions gate**
(`.bmad/decisions.yaml`) exactly the way the other seven agents do. For
this agent, decisions apply to specific release-gate items — mark a
release-gate finding as **accepted** (approved for release, freeze),
**deferred** (needs re-test before ship, moves to SLA sheet), or
**wontfix** (accept the risk, suppressed from Summary but retained in
the emitted artifact).

**How it applies here:**

- A `gate`-severity finding — e.g. "coverage below release threshold",
  "HIGH-severity vuln from sonar-scan not fixed", "pipeline missing
  audit gate" — is suppressed from Summary when `accepted` for the
  current release (`release: r2026.09`), but stays on the emitted
  artifact so the auditor can see it.
- `deferred` findings move to the SLA sheet with a `next-review` date.
- `accepted` findings are frozen — future reruns don't re-surface them
  as gates.

**Flags:**

- `--include-decided` — show findings even when a decision exists.
- `--decisions-path <path>` — override the decisions file location.
- `--ignore-decision-expiry` — keep suppressing findings even when the
  decision has expired.
- `--list-decisions` — print every decision in `.bmad/decisions.yaml` and exit.

See `skills/shared/decisions/` and the Docusaurus concept page for the
full YAML shape.

## SLA tracking (Phase 1)

The Release agent participates in the shared **SLA gate**
(`.bmad/sla.yaml`). For this agent, SLA is interpreted as
**release-approval SLA**: how long a release-gate item can sit in `Open`
(or a finding in `draft`) per role before it becomes OVERDUE and blocks
the ship.

**Default SLAs** (customize in `.bmad/sla.yaml`):

| Role | `gate` (CRITICAL) | `risk` (HIGH) | `action` (MEDIUM) | `info` (LOW) |
|---|---|---|---|---|
| `devops` | 1 day | 2 days | 5 days | ∞ |
| `security` | 1 day | 1 day | 3 days | ∞ |
| `qa` | 1 day | 2 days | 5 days | ∞ |
| `tl` | 2 days | 3 days | 7 days | ∞ |
| `ea` | 2 days | 3 days | 7 days | ∞ |
| `pm` | 2 days | 5 days | 10 days | ∞ |
| (other) | 2 days | 3 days | 7 days | ∞ |

**Flags:**

- `--sla-path <path>` — override the SLA file location.
- `--no-sla` — skip SLA computation + sheet.
- `--fail-on-overdue` — exit code 6 if any finding is OVERDUE per role
  SLA. Wire this into CI to fail the release pipeline when a gate item
  has been open too long.

The SLA sheet on the workbook shows each finding's age, its SLA
threshold given its severity + owner-role, and its state (`fresh` /
`nearing` / `overdue`).

## Cross-agent chaining hints

Release is the **shipping entry point** of the DCA workflow — where
Architecture formalizes the "how to build", Release formalizes the "how
to ship". Recommended fan-in / fan-out:

```
Architecture (author ADRs + HLD + LLD + OpenAPI)
    ↓
Generation (scaffold code from the design)
    ↓
Audit + Sonar-Scan + Test-Coverage (gate quality)
    ↓
Impact Analysis (trace blast radius of the change set)
    ↓
Release (--release-version <ver> --artifacts all)
    → pipeline (with Audit + Sonar-Scan gates wired in)
    → release notes (from git log of the change set)
    → deploy plan (phased against the resolved rollout)
    → rollback plan (with triggers pulled from Sonar-Scan alerts)
    → env-diff (source → target env)
    → announcement (per-channel, per-role framing)
    ↓
Operations (post-deploy runbook + alerts — Phase 3.4)
```

Concrete one-liners the AI agent should offer as follow-ups after a
Release run:

- **Release → Architecture (upstream loop)** — "release plan references
  an ADR I haven't seen; open it?" — chases the ADR the deploy plan
  cites.
- **Release → Audit** — "audit the release scope before we ship" —
  runs Audit on the files changed between `--from-ref` and `--to-ref`.
- **Release → Sonar-Scan** — "sonar-scan the release scope; block if
  Quality Gate fails" — wires the Sonar-Scan Quality Gate into the
  pipeline the release agent just authored.
- **Release → Test-Coverage** — "coverage gate for the release
  scope" — checks the coverage floor against changed files only.
- **Release → Operations** (Phase 3.4) — "wire the post-deploy
  runbook + alerts" — hands the deploy plan to the Operations agent to
  emit the observability + on-call assets.

## Constraints / non-goals

**This agent authors release artifacts. It does not:**

- **Execute deploys.** The authored `pipeline.yml` is a file — your CI/CD
  platform (Cloud Manager, GitHub Actions, GitLab CI, CircleCI, Jenkins,
  Azure DevOps) executes it. The release agent never runs `kubectl`,
  `aio app deploy`, `bin/magento`, or any deploy command.
- **Auto-post to Confluence, Jira, or Slack.** The announcement
  artifact is a Markdown file with per-channel headings (email / Slack /
  Confluence / Twitter/LinkedIn). You paste it — the agent does not have
  workspace credentials and will never store them.
- **Sign off on compliance gates for you.** PCI/HIPAA/SOX release gates
  require human sign-off. The agent surfaces the checklist (in the
  deploy plan and release-gate SLA); the responsible role must sign.
- **Guarantee a rollback works.** The rollback playbook is authored from
  the stack idiom (revert code, revert migration, revert config) — but
  data-integrity, downstream-side-effect reversibility, and
  irreversible operations (e.g. sent emails, external payment captures)
  are called out as caveats. Rollback drills before the release are the
  only proof the playbook works.
- **Author against unsupported stacks.** Release is Adobe/JVM-focused
  (the same 8 stacks as the rest of the DCA suite). If you point it at
  a Ruby-on-Rails or Django repo, `--engine` auto-detection returns
  `generic` and the agent falls back to stack-agnostic templates.
- **Handle release-train orchestration.** One release version per
  invocation. Chain runs manually when you need to orchestrate a train
  of releases across multiple services.

**What the agent does authoritatively:**

- Author a runnable pipeline YAML/Groovy for the resolved CI/CD platform
  with real DCA-agent gate integration (audit + sonar-scan +
  test-coverage) and per-stack customization points.
- Author release notes grouped by Conventional Commit type, with
  breaking-change surfacing, contributor list, and referenced ticket/PR
  callouts.
- Author a deploy plan phased against the resolved rollout strategy,
  with RACI, pre/post checklists, go/no-go gates, and stakeholder comms.
- Author a rollback playbook with named triggers, decision matrix,
  numbered steps, and post-rollback RCA scheduling.
- Author an env-diff report between two environments with per-category
  risk assessment.
- Author a multi-channel stakeholder announcement (email + Slack +
  Confluence + short-form).
- Adapt the artifact emphasis, rollout default, and follow-up handoff
  to the resolved role.
- Participate in the shared decisions + SLA gates so release-gate items
  can be frozen for a release and overdue gates can block CI.

## Commands Reference

| Trigger | Action |
|---------|--------|
| `full release` / `release pack` | Full release with `--artifacts all` |
| `release notes for X` | `--artifacts release-notes --release-version X` |
| `pipeline for X` / `CI/CD for X` | `--artifacts pipeline` (auto-detect target) |
| `Cloud Manager pipeline` | `--artifacts pipeline --pipeline cloudmanager` |
| `GitHub Actions workflow` | `--artifacts pipeline --pipeline github-actions` |
| `deploy plan for X` | `--artifacts deploy-plan --release-version X` |
| `blue-green deploy plan` | `--artifacts deploy-plan --rollout blue-green` |
| `canary deploy plan` | `--artifacts deploy-plan --rollout canary` |
| `rollback plan for X` | `--artifacts rollback-plan` |
| `env-diff X vs Y` | `--artifacts env-diff --env X --to-env Y` |
| `announcement for X` | `--artifacts announcement --release-version X` |
| `release as <role>` | `--role <role> --artifacts all` |
| `list release stacks` | `--list-engines` |
| `switch role to <code>` | Rewrite `.bmad/role.yaml` |
| `switch intake to interactive` / `technical` | Rewrite `.bmad/intake.yaml` |

## CLI Options

| Flag | Description |
|------|-------------|
| `--path <dir>` | Project root (default: `.`) |
| `--engine <engine>` | `aem` \| `commerce-paas` (alias `commerce`) \| `commerce-saas` \| `sling` \| `spring` \| `app-builder` \| `eds` \| `eds-commerce` (auto-detect if omitted) |
| `--output <dir>` | Output directory (default `<project>/release-reports`) |
| `--interactive` | Interactive intake mode (prompts step-by-step) |
| `--technical` | Technical intake mode (silent error on missing required inputs) |
| `--list-engines` | List available engines |
| `--role <code>` | Role adaptation — persisted at `<project>/.bmad/role.yaml`; `--role` wins for a single run |
| `--pipeline <target>` | CI/CD platform. Values: `cloudmanager`, `github-actions`, `gitlab-ci`, `circleci`, `jenkins`, `azure-devops`. Default: auto-detect from project files. |
| `--from-ref <ref>` | Start of release scope (git ref) — for release notes + env-diff. |
| `--to-ref <ref>` | End of release scope. Default: `HEAD`. |
| `--env <name>` | Source environment for env-diff (e.g. `stage`). |
| `--to-env <name>` | Target environment for env-diff (e.g. `prod`). |
| `--rollout <strategy>` | Deploy strategy. Values: `canary`, `blue-green`, `rolling`, `feature-flag`, `bigbang`. Default: role-driven. |
| `--release-version <tag>` | Semantic version for the release (e.g. `2.5.0`). |
| `--artifacts <csv>` | Which artifacts to author (comma-separated). Values: `pipeline`, `release-notes`, `deploy-plan`, `rollback-plan`, `env-diff`, `announcement`, `all`. Default: `all`. |
| `--commit-format <style>` | Release-notes commit style. Values: `conventional`, `keep-a-changelog`, `narrative`. Default: `conventional`. |
| `--format <markdown\|both>` | Output format. Default: `markdown`. `both` currently writes markdown only (docx planned) with a warning. |
| `--create-branch` | Cut standard branch `dca/release-<stack>-<timestamp>` before writing outputs |
| `--source-branch <name>` | Source branch for `--create-branch` (default candidates: production, main, master, develop) |
| `--preflight` | Print the model/context + STATIC/LLM/HYBRID advisory and exit |
| `--no-preflight` | Suppress the preflight advisory that otherwise prints on every run |
| `--yes-install` | Install missing dependencies without confirmation |
| `--no-install` | Error out if dependencies missing (do not install) |
| `--include-decided` | Show findings even when a decision exists in `.bmad/decisions.yaml` |
| `--decisions-path <path>` | Override decisions file location |
| `--ignore-decision-expiry` | Keep suppressing findings even when the decision has expired |
| `--list-decisions` | Print every decision in `.bmad/decisions.yaml` and exit |
| `--sla-path <path>` | Override SLA file location |
| `--no-sla` | Skip SLA computation + sheet |
| `--fail-on-overdue` | Exit code 6 if any finding is OVERDUE per role SLA |
| `--help` | Print usage and exit |
