---
name: bmad-dept-code-review-agent
description: "Pre-Merge Code Review Specialist (📝) — the 10th agent of the BMAD DEPT Code Agent suite (audit, generation, impact-analysis, sonar-scan, test-coverage, requirements, architecture, release, operations, code-review). Reviews a PR/diff BEFORE merge: style-guide enforcement, breaking-change detection, dependency-change risk, design-pattern violations, and role-adapted pre-merge checklists. Produces GitHub/GitLab/plain-markdown-ready inline review comments per stack. Complements the Audit agent's post-hoc deep scan, which runs AFTER merge."
keywords: ["code review", "pr review", "pull request", "merge request", "style guide", "breaking change", "dependency review", "design pattern", "pre-merge", "checklist", "inline comments"]
---

# BMAD DEPT Code Agent — Code Review Skill

## Purpose

The **Pre-Merge Code Review Specialist (📝)** — the **10th agent** in the
BMAD DEPT Code Agent suite (audit, generation, impact-analysis,
sonar-scan, test-coverage, requirements, architecture, release,
operations, **code-review**) — closes **SDLC phase 3 deeper**: it
reviews a pull request or diff **before it merges**.

Where the **Audit agent** runs an exhaustive, deep static-analysis scan
— typically scheduled or run against the full repo, post-merge, looking
for everything a rule pack can catch — the **Code Review agent** is
**fast and diff-scoped**: it reads the changed lines the way a senior
teammate reads a PR in the two minutes before clicking "Approve." It
does not try to catch everything; it tries to catch what matters
**before the code ships**, and it produces content shaped for the
review UI you actually use (GitHub PR comments, GitLab MR discussion
threads, or plain markdown).

It authors:

- **Inline PR review comments** — file:line-anchored, severity-tagged,
  with a suggested fix — in GitHub, GitLab, or tool-agnostic
  inline-markdown shape.
- **Style-guide compliance reports** — built-in per-stack conventions,
  optionally layered with a custom `--style-guide` doc.
- **Breaking-change detection** — API/schema/contract changes that will
  break a consumer, with migration guidance.
- **Dependency-change risk assessment** — new/updated/removed
  dependencies, license and known-vulnerability flags, transitive
  impact.
- **Design-pattern violation reports** — stack-idiomatic anti-patterns
  introduced by the diff, with a suggested refactor.
- **Role-adapted pre-merge checklists** — code quality, tests, security,
  docs, deploy-readiness, plus role-specific extra items.

Grounded in per-stack Adobe / JVM pre-merge idioms across **AEM (AEMaaCS
+ AMS), Adobe Commerce PaaS (Magento 2), Adobe Commerce SaaS, Apache
Sling / Shaft, Spring Boot, Adobe App Builder, Edge Delivery Services
(EDS), EDS + Commerce hybrid**.

> **Code Review is a pre-merge review specialist, not a merge gate.**
> It does not run CI, does not approve or merge the PR itself, and does
> not replace Audit's exhaustive scan. It produces the review content —
> a human reviewer, or a CI status check consuming
> `--fail-on-severity`, acts on it. See **Constraints / non-goals**
> below.

### Two modes

**Full review (default when `--artifacts all`).** Every artifact
resolvable given other flags: review comments + style-check +
breaking-changes + dependency-review + design-patterns + checklist.

**Individual artifact.** Narrow to one: `--artifacts review`,
`--artifacts style-check`, `--artifacts breaking-changes`,
`--artifacts dependency-review`, `--artifacts design-patterns`,
`--artifacts checklist`.

## Activation

This skill activates when the user asks to:

- Review this PR / review my changes / review before merge / check this diff
- Check style guide / style guide review / lint this PR
- Breaking changes in this diff / will this break consumers / check for breaking changes
- Dependency review / review dependency changes / check new dependencies
- Design pattern check / review for anti-patterns / design pattern review
- Pre-merge checklist / generate merge checklist / is this PR ready to merge

Menu codes (see `skills/module-help.csv`):

| Code | Action |
|------|--------|
| `PR` | Full pre-merge review (auto-detect stack + `--artifacts all`). |
| `PS` | Style-check (`--artifacts style-check`). |
| `PB` | Breaking-change detection (`--artifacts breaking-changes`). |
| `PD` | Dependency review (`--artifacts dependency-review`). |
| `PN` | Design-pattern check (`--artifacts design-patterns`). |
| `PC` | Pre-merge checklist (`--artifacts checklist`). |
| `PA` | Review against the AEM stack (`--engine aem`). |
| `PM` | Review against Adobe Commerce PaaS (`--engine commerce-paas`). |
| `PZ` | Review against Adobe Commerce SaaS (`--engine commerce-saas`). |
| `PL` | Review against Apache Sling / Shaft (`--engine sling`). |
| `PG` | Review against Spring Boot (`--engine spring`). |
| `PP` | Review against Adobe App Builder (`--engine app-builder`). |
| `PE` | Review against Edge Delivery Services (`--engine eds`). |
| `PX` | Review against EDS + Commerce hybrid (`--engine eds-commerce`). |
| `PQ` | List available code-review engines (`--list-engines`). |

## Prompt → Action Resolution

Map the user's prompt to a `run.ts` invocation. All flags below are
already wired in `scripts/run.ts` (see the CLI reference at the bottom
— no invented flags).

| User says… | Resolves to |
|---|---|
| "review this PR" (no other context, uncommitted changes present) | `--diff` |
| "review this PR" (no other context, clean working tree) | `--pr main..HEAD` |
| "review PR #452, main..feature/checkout-v2" | `--pr main..feature/checkout-v2` |
| "check our style guide against ./docs/style.md" | `--style-guide ./docs/style.md` |
| "deep review — check design patterns too" | `--review-depth deep` |
| "format comments for GitLab" | `--comment-format gitlab` |
| "fail if anything critical" | `--fail-on-severity critical` |
| "just the breaking changes" | `--artifacts breaking-changes` |
| "full pre-merge review" | `--artifacts all` |
| "review my uncommitted changes" | `--diff` |
| "diff from origin/main to HEAD" | `--from-ref origin/main --to-ref HEAD` |
| "dependency review for this diff" | `--artifacts dependency-review` |

### Compound resolution

Combine flags when the prompt names multiple inputs:

- "deep review of main..feature/checkout-v2, fail on high, GitHub comments"
  → `--pr main..feature/checkout-v2 --review-depth deep --fail-on-severity high --comment-format github`
- "AEM style check + breaking changes on my uncommitted changes"
  → `--engine aem --diff --artifacts style-check,breaking-changes`
- "checklist for this PR as security"
  → `--role security --artifacts checklist`

### Missing required info — ask (do not guess)

- No `--pr`, no `--diff`, no `--from-ref`/`--to-ref`, **and** the
  working tree has no uncommitted changes:

  > "What should I review — an uncommitted diff (`--diff`), a specific
  > PR/branch range (`--pr main..feature/x`), or the full repo (no diff
  > scope)? Default suggestion: `--pr main..HEAD`."

- `--style-guide <path>` given but the path doesn't resolve — surface an
  INFO finding and fall back to the built-in per-stack guide; do not
  fail the run.

Everything else has a sensible default: `--engine` auto-detected,
`--role` from `.bmad/role.yaml` or `generic`, `--review-depth` role-driven
(see § Role-aware behavior), `--comment-format inline-markdown`,
`--artifacts all`, `--format markdown`, output at
`<project>/code-review-reports/`.

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
3. "What should I review — uncommitted changes (`--diff`), a PR/diff range
   (`--pr <base>..<head>`), or the full repo?"
4. If PR/diff range → "Give me the range, e.g. `main..feature/checkout-v2`
   (a single ref is diffed against the first existing
   main/master/develop/production branch)."
5. "Custom style guide? (path, or blank to use the built-in per-stack guide)"
6. "Review depth? (`quick` / `standard` / `deep` — blank uses the role default)"
7. "Comment format? (`github` / `gitlab` / `inline-markdown` — default
   `inline-markdown`)"
8. "Which artifacts? (comma-separated:
   `review,style-check,breaking-changes,dependency-review,design-patterns,checklist,all`
   — default `all`)"
9. "Fail the run on a severity threshold? (`critical` / `high` / `medium` /
   `low` / blank to skip)"
10. "Output format? (`markdown` / `both` — docx planned for a later phase,
    currently emits markdown only)"
11. "Cut a working branch from production? (Y/n)"
12. "Ready to run? (Y/n)"

Once every required input is collected, run the command internally (do NOT
show it unless the user asks) and stream results conversationally:

> "Reviewing `main..feature/checkout-v2` against Spring, standard depth,
> inline-markdown comments… 14 review comments (2 CRITICAL, 3 HIGH),
> 1 breaking change (removed `@RequestMapping` path), 2 dependency bumps
> (1 flagged — major version jump on `jackson-databind`), 1 design-pattern
> violation (missing `@Valid` on new endpoint), checklist: 11/14 items
> pass. Report at
> `code-review-reports/code-review-main-…-agent-report.xlsx`, index at
> `code-review-reports/CODE-REVIEW-INDEX.md`. Want me to hand the
> breaking-change list to the Impact Analysis agent to trace consumers?"

### Technical mode (for users who want CLI transparency)

Show the fully-formed command in a `bash` code block with one flag per line:

```bash
npx ts-node .claude/skills/bmad-dept-code-review-agent/scripts/run.ts \
  --path /path/to/project \
  --engine spring \
  --pr main..feature/checkout-v2 \
  --review-depth standard \
  --comment-format inline-markdown \
  --artifacts all \
  --format markdown \
  --create-branch
```

Below the block, add a bulleted list explaining each flag in plain English:

- `--path` — project root; used for stack auto-detection and as the base
  for the output directory.
- `--engine spring` — force the Spring authoring templates; without this
  the dispatcher probes the tree for stack signals.
- `--pr main..feature/checkout-v2` — diff range to review (`git diff
  --name-only main..feature/checkout-v2`). Mutually exclusive with
  `--diff` and `--from-ref`/`--to-ref`.
- `--review-depth standard` — lint-level + dependency-review +
  design-pattern surface checks (see § Review-depth catalog).
- `--comment-format inline-markdown` — tool-agnostic file:line-keyed
  markdown (see § Comment-format catalog).
- `--artifacts all` — every artifact resolvable given other flags; narrow
  with a comma-separated subset (see § Artifact catalog).
- `--format markdown` — output format (docx planned; `both` still writes
  markdown only for now with a warning).
- `--create-branch` — cut a working `dca/code-review-<stack>-<timestamp>`
  branch (from `production`/`main`/`master`/`develop`) before writing.

Then ask: **"Want me to run this now, or will you copy-paste it?"**

- If **run for me** → execute silently and stream results (same as interactive mode).
- If **I'll run it** → acknowledge, and remind them: "Report will land in
  `<project>/code-review-reports/`. Come back with 'summarize the review'
  or 'chain to audit post-merge' when you're done."

## One-shot mode

The **preferred enterprise path.** When the user's initial prompt fully
specifies what to run, do NOT ask any clarifying questions — execute
end-to-end, stream results, done. Use defaults from `.bmad/role.yaml`,
`.bmad/intake.yaml`, `.bmad/conventions.yaml`, and reasonable stack
auto-detection to fill missing inputs.

### When to enter one-shot mode

Trigger phrases (any of):

- "no questions, just do it", "one-shot", "review and go", "auto"
- OR any prompt that specifies: (a) the diff scope (`--pr` / `--diff` /
  `--from-ref`+`--to-ref`, or an explicit statement that uncommitted
  changes exist), (b) the project path (default: cwd)

You DO NOT need every field explicitly — role + intake + conventions cover
the rest silently.

### One-shot examples

- "review this PR — main..feature/checkout-v2"
- "review my uncommitted changes"
- "deep review with design-pattern checks, fail on high"
- "dependency review for this diff"
- "pre-merge checklist for this PR as security"
- "full review, GitHub comment format"

### Precedence for missing inputs

1. **Explicit in the user's prompt** (highest — always wins)
2. **`--flag` on run.ts** (headless / CI)
3. **`.bmad/role.yaml`** (role-driven review-depth + artifact emphasis)
4. **`.bmad/intake.yaml`** (interactive vs technical — one-shot forces technical + skip)
5. **`.bmad/conventions.yaml`** (project conventions: default base branch,
   custom style-guide path)
6. **Auto-detected** (stack from repo signatures; diff scope from
   uncommitted working-tree changes when present)
7. **Sensible defaults** (`--comment-format inline-markdown`,
   `--artifacts all`, `--format markdown`, output at `code-review-reports/`)

### What one-shot DOES silence

- The intake picker ("Interactive or Technical?") — one-shot forces technical.
- The **artifact-set picker** — one-shot uses the role default (see §
  Role-aware behavior).
- The **review-depth picker** — one-shot uses the role default (DE →
  quick, TL/Security → deep, everyone else → standard).
- The role picker (if `.bmad/role.yaml` absent) — one-shot uses `generic`
  silently (log to stderr: "one-shot: no role file, defaulting to generic").
- The comment-format confirmation — one-shot uses `inline-markdown` unless
  the prompt names a platform.
- The confirmation prompts around `--create-branch`, `--yes-install` —
  one-shot assumes yes for install, no for branch cut unless the prompt
  says otherwise.

### What one-shot DOES ask about (only when truly critical)

- **No diff scope resolvable.** If NEITHER `--pr` NOR `--diff` NOR
  `--from-ref`/`--to-ref` is given AND the working tree has no
  uncommitted changes, ask ONCE:

  > "What should I review? I don't see uncommitted changes and no PR/diff
  > range was given. Default suggestion: `--pr main..HEAD` — want me to
  > use that, or give me a different range?"

Everything else stays silent.

### One-shot prompt examples for the Code Review agent

Each example shows what the user pastes and what the AI silently resolves.

> **User:** "review this PR — main..feature/checkout-v2"
> **AI silently resolves:** path=cwd, engine=auto-detect, pr=`main..feature/checkout-v2`,
> role=(from `.bmad/role.yaml` or `generic`), review-depth=role default,
> comment-format=`inline-markdown`, artifacts=`all`, format=markdown.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --pr main..feature/checkout-v2 --artifacts all --technical --no-preflight --yes-install`
> **AI reports:** "Reviewed `main..feature/checkout-v2` (Spring, standard
> depth): 14 review comments (2 CRITICAL, 3 HIGH, 6 MEDIUM, 3 LOW), style
> check 9/11 rules pass, 1 breaking change (removed `/api/v1/cart` path),
> 2 dependency bumps (1 flagged), 1 design-pattern violation, checklist
> 11/14 pass. Saved to `code-review-reports/REVIEW-COMMENTS.md`."

> **User:** "review my uncommitted changes"
> **AI silently resolves:** diff=true (uncommitted), engine=auto-detect,
> artifacts=`all`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --diff --artifacts all --technical --no-preflight --yes-install`
> **AI reports:** "Reviewed uncommitted changes (AEM, standard depth):
> 6 review comments (1 CRITICAL — unclosed `ResourceResolver`), style
> check 7/8 rules pass, no breaking changes detected, checklist 9/12 pass
> (missing: test coverage for new servlet). Saved to
> `code-review-reports/REVIEW-COMMENTS.md`."

> **User:** "deep review with design-pattern checks, fail on high"
> **AI silently resolves:** review-depth=`deep`, fail-on-severity=`high`,
> diff scope=(uncommitted if present, else asks once), artifacts=`all`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --diff --review-depth deep --fail-on-severity high --artifacts all --technical --no-preflight --yes-install`
> **AI reports:** "Deep review complete: 18 comments including 2 cross-file
> semantic findings (new endpoint bypasses the existing rate-limiter
> middleware). Exit code 7 — 2 findings at/above HIGH threshold."

> **User:** "dependency review for this diff"
> **AI silently resolves:** artifacts=`dependency-review`, diff
> scope=(uncommitted if present, else `--pr main..HEAD`).
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --diff --artifacts dependency-review --technical --no-preflight --yes-install`
> **AI reports:** "Dependency review: 3 changes — `jackson-databind`
> 2.13.0→2.17.1 (patches known CVE-2022-42003, safe), `lodash` added
> (unpinned, flagged), `left-pad` removed (safe). Saved to
> `code-review-reports/DEPENDENCY-REVIEW.md`."

> **User:** "pre-merge checklist for this PR as security"
> **AI silently resolves:** role=`security`, artifacts=`checklist`, diff
> scope=(uncommitted if present, else asks once).
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --role security --diff --artifacts checklist --technical --no-preflight --yes-install`
> **AI reports:** "Security-role checklist: 16 items — code quality (4),
> tests (3), security (5, STRIDE-lite framed), docs (2), deploy-readiness
> (2). 2 unchecked: no auth-boundary test for the new endpoint, no
> secrets-scan note. Saved to `code-review-reports/PR-CHECKLIST.md`."

> **User:** "full review, GitHub comment format"
> **AI silently resolves:** comment-format=`github`, artifacts=`all`, diff
> scope=(uncommitted if present, else asks once).
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --diff --comment-format github --artifacts all --technical --no-preflight --yes-install`
> **AI reports:** "Full review authored in GitHub suggestion-block format
> — 11 comments ready to paste into the PR review UI. Report at
> `code-review-reports/code-review-main-…-agent-report.xlsx`."

### After one-shot execution

Always:

- Print a one-line summary (review comment count by severity, style-check
  pass/fail, breaking-change count, dependency flags, pattern violations,
  checklist pass rate, CODE-REVIEW-INDEX path, report path).
- Print the recommended follow-up from the role matrix (e.g. DevOps role
  after review → "wire the dependency flags into the release plan").
- Do NOT ask "want me to run the follow-up?" — the user will ask if they do.

Never:

- Ask what mode they wanted after the fact.
- Ask if they want to save preferences.
- Explain what you did (unless they ask).

### CLI equivalent for one-shot (technical mode)

Every one-shot prompt has a direct CLI equivalent using all Phase 1 flags:

```bash
npx ts-node .claude/skills/bmad-dept-code-review-agent/scripts/run.ts \
  --path . \
  --role <code> \
  --engine <stack> \
  --pr <base>..<head> \
  --style-guide <path> \
  --review-depth <quick|standard|deep> \
  --comment-format <github|gitlab|inline-markdown> \
  --fail-on-severity <critical|high|medium|low> \
  --artifacts all \
  --format markdown \
  --technical \
  --yes-install \
  --no-preflight \
  --sla-path .bmad/sla.yaml \
  --decisions-path .bmad/decisions.yaml
```

Use `--diff` instead of `--pr` for uncommitted changes, or
`--from-ref <ref> --to-ref <ref>` for an explicit range. Add
`--fail-on-overdue` for CI gates, `--include-decided` to bypass decisions,
`--create-branch` for a working branch.

## Role-aware behavior

The Code Review agent adapts its **default review emphasis**,
**review-depth default**, and **recommended follow-up** to the role of
the person driving the run. Role selection is a **shared** concept
across the 10-agent DCA suite and is persisted per-project at
`<projectRoot>/.bmad/role.yaml` (see `skills/shared/role/ROLES.md`).

### Role check on activation

**Before running any mode**, the AI agent MUST perform the role handshake
(same shape as Requirements, Architecture, Release, Operations):

1. Check for `<projectRoot>/.bmad/role.yaml`.
2. If ABSENT, ask the user — verbatim:

   > "Which role best matches how you'll use this plugin? Pick one from the
   > 10 codes below (or say 'generic' to skip):"

   Then list the **6 promoted roles** first:

   - `ea` — Enterprise Architect: portfolio-level pattern-consistency +
     architecture-drift flagging.
   - `tl` — Tech Lead / Solution Architect: design-pattern violations +
     breaking-change detection prioritized; deep depth default.
   - `de` — Senior Delivery Engineer: style-check + quick checklist; fast
     turnaround; quick depth default.
   - `qa` — QA / SDET: test-coverage presence in the diff; breaking-change
     detection for API-contract test impact.
   - `devops` — DevOps / SRE: dependency-review prioritized (supply-chain
     risk); CI-integrated comment format.
   - `security` — Security Engineer: dependency-review + breaking-change
     (auth/crypto) prioritized; deep depth default; STRIDE-lite framing.

   Then the **4 additional roles**:

   - `pm` — Product Manager / PMO: checklist framed as business-risk;
     executive-summary style.
   - `ba` — Business Analyst: checklist cross-references requirements/AC.
   - `migration` — Migration/Upgrade Lead: breaking-change detection is
     PRIMARY concern; before/after behavior comparison.
   - `content` — Content/CMS Engineer: style-check scoped to
     content-model/component conventions; design-pattern checks for
     content components.

   Then the fallback: `generic` — balanced default, standard review depth.

3. Persist the choice using the shared `writeRoleFile(projectRoot, role,
   "interactive")` helper.
4. If PRESENT, read it silently and use the `role:` field — do NOT re-prompt.
5. **Per-run override**: `"as <role>"` prefix or `--role=<code>` on
   `run.ts`. Does not write `.bmad/role.yaml`.
6. **Permanent change**: `"switch role to <code>"` overwrites `.bmad/role.yaml`.

### Role → Code Review behavior matrix

| Role | Review-depth default | Emphasis | Recommended follow-up |
|---|---|---|---|
| `ea` | `standard` | **Portfolio-level pattern-consistency** — cross-project consistency check on the diff; architecture-drift flagging (does this PR violate an existing ADR?); multi-team style convergence. | "architecture: check this diff against the ADR log for drift" |
| `tl` | `deep` | **Design-pattern violations + breaking-change detection prioritized** — deep cross-file semantic reasoning on whether the change interacts badly with code elsewhere in the repo. | "impact-analysis: trace the blast radius of the breaking change" |
| `de` | `quick` | **Style-check + quick checklist** — fast turnaround; lint-level findings only; unblock the PR quickly. | "generation: scaffold the missing test the checklist flagged" |
| `qa` | `standard` | **Test-coverage presence in the diff** — does the diff include tests; breaking-change detection framed as API-contract test impact. | "test-coverage: confirm coverage on the changed lines" |
| `devops` | `standard` | **Dependency-review prioritized** — new/updated deps = supply-chain risk; CI-integrated comment format (`github`/`gitlab`); `--fail-on-severity` wired into the pipeline. | "release: block the deploy plan on unresolved dependency flags" |
| `security` | `deep` | **Dependency-review + breaking-change (auth/crypto changes) prioritized** — STRIDE-lite framing on security-sensitive diffs; deep depth to catch cross-file auth-boundary regressions. | "sonar-scan: deep vuln scan on the touched auth/crypto paths" |
| `pm` | `standard` | **Checklist framed as business-risk** — what could this break for users; executive-summary style; less code-level detail, more "what changed and why it matters." | "requirements: confirm the diff satisfies the linked AC" |
| `ba` | `standard` | **Checklist cross-references requirements/AC** — if a Requirements-agent report is cached, trace each changed behavior back to its acceptance criterion. | "requirements: reconcile diff behavior against the BRD" |
| `migration` | `deep` | **Breaking-change detection is PRIMARY concern** — before/after behavior comparison; every breaking change gets a migration note. | "release: cross-reference breaking changes with the cutover plan" |
| `content` | `standard` | **Style-check scoped to content-model/component conventions** — design-pattern checks for content components (blocks, CFs, dialogs). | "generation: scaffold the content-model fix the review flagged" |
| `generic` | `standard` | Balanced default — every artifact resolvable, standard depth. | "audit: schedule a deep post-merge scan on the merged result" |

### Cross-agent chaining hints per role

| Role | Next agent to invoke | Why |
|---|---|---|
| `ea` | `architecture` | Check the diff against the ADR log for drift. |
| `tl` | `impact-analysis` | Trace blast radius of the flagged breaking change. |
| `de` | `generation` | Scaffold the test/fix the checklist flagged as missing. |
| `qa` | `test-coverage` | Confirm coverage on exactly the changed lines. |
| `devops` | `release` | Block the deploy plan on unresolved dependency flags. |
| `security` | `sonar-scan` | Deep vulnerability scan on the touched auth/crypto paths. |
| `pm` | `requirements` | Confirm the diff satisfies the linked acceptance criteria. |
| `ba` | `requirements` | Reconcile diff behavior against the BRD. |
| `migration` | `release` | Cross-reference breaking changes with the cutover plan. |
| `content` | `generation` | Scaffold the content-model fix the review flagged. |
| `generic` | `audit` | Schedule a deep post-merge scan on the merged result. |

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
bash .claude/skills/shared/bootstrap.sh code-review
```

**Windows (or when sh is unavailable):**

```bash
node .claude/skills/shared/bootstrap.js code-review
```

**Headless / CI mode (skip prompt):**

```bash
bash .claude/skills/shared/bootstrap.sh code-review --yes    # install without asking
bash .claude/skills/shared/bootstrap.sh code-review --no     # error if deps missing
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
> may not yet include a dedicated `"code-review"` entry; if so, `run.ts`
> piggybacks on an existing agent entry with identical shared deps
> (exceljs, fast-glob). Invisible to the user; the bootstrap prompt still
> names the code-review agent. <!-- verify: enum entry -->

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

**Rule of thumb for Code Review:** the diff itself is almost always small
relative to the full repo, so this agent fits comfortably in LLM mode far
more often than Audit does — the preflight is really telling you whether
**deep** review depth (which reasons about files outside the diff) is
affordable. If the fit is tight, fall back to `standard` or `quick` depth
rather than the full repo-aware cross-file reasoning `deep` requires.

## Modes

The Code Review agent has two artifact-scope modes, selected by
`--artifacts`:

### Mode: Full review (default with `--artifacts all`)

**Trigger:** `--artifacts all` (default when unspecified), or the prompt
asks for a "full review" / "full pre-merge review".

**Steps:**

1. Resolve stack (from `--engine`, else auto-detect from repo signals).
2. Resolve diff scope (from `--pr` / `--diff` / `--from-ref`+`--to-ref`;
   ask once if none given and the working tree is clean).
3. Resolve review depth (from `--review-depth`, else role default).
4. Load `resources/review-templates/<stack>.md` (this workstream) and
   `resources/pattern-libraries/<stack>.md` (later workstream, for
   design-pattern checks).
5. Load the master templates under `templates/`: `review-comment.md`,
   `style-checklist.md`, `breaking-change-report.md`,
   `dependency-review.md`, `design-pattern-report.md`, `pr-checklist.md`.
6. Feed the diff + stack guide + optional custom `--style-guide` to the
   LLM authoring pass.
7. Emit the artifact files + the standard workbook + `CODE-REVIEW-INDEX.md`
   (see § Written files).
8. Report the artifact counts and next-agent handoff.

### Mode: Individual artifact

**Trigger:** `--artifacts <one>` — narrow to a single artifact
(`review` / `style-check` / `breaking-changes` / `dependency-review` /
`design-patterns` / `checklist`).

**Steps:** same as full review, but only the requested artifact's
template + stack guide loads, and only the requested file is written.

## Artifact catalog

`--artifacts` accepts a comma-separated list. `all` expands to every
artifact resolvable given other flags. Missing → `all`.

| Artifact key | Written file(s) | Master template | Per-stack guide | Notes |
|---|---|---|---|---|
| `review` | `REVIEW-COMMENTS.md` (or `.json` for github/gitlab format) | `templates/review-comment.md` | `resources/review-templates/<stack>.md` | Full inline PR-comment set. File:line anchored, severity-tagged, with suggested-fix blocks. |
| `style-check` | `STYLE-CHECKLIST.md` | `templates/style-checklist.md` | `resources/review-templates/<stack>.md` | Style-guide compliance report — built-in per-stack guide, layered with `--style-guide` when given. |
| `breaking-changes` | `BREAKING-CHANGES.md` | `templates/breaking-change-report.md` | `resources/review-templates/<stack>.md` | Breaking API/schema/contract-change detector with migration guidance. |
| `dependency-review` | `DEPENDENCY-REVIEW.md` | `templates/dependency-review.md` | `resources/review-templates/<stack>.md` | New/updated/removed dependency risk — license + known-CVE + transitive-impact notes. |
| `design-patterns` | `DESIGN-PATTERNS.md` | `templates/design-pattern-report.md` | `resources/review-templates/<stack>.md` + `resources/pattern-libraries/<stack>.md` (later workstream) | Design-pattern violation + suggestion report. |
| `checklist` | `PR-CHECKLIST.md` | `templates/pr-checklist.md` | `resources/review-templates/<stack>.md` | Pre-merge checklist (role-adapted). |
| `all` | Every artifact resolvable given other flags. | — | — | Uses stack + role defaults for anything not disambiguated. |

`--format both` is accepted but currently emits markdown only (docx writer
is planned; a warning is printed on stderr).

## Review-depth catalog

`--review-depth` controls how much the review reasons about code outside
the literal diff. When omitted, the default is role-driven (see §
Role-aware behavior); `defaultReviewDepth()` in `scripts/run.ts` maps
`de` → `quick`, `tl`/`security` → `deep`, everyone else → `standard`.

| Depth | What it checks | Typical turnaround |
|---|---|---|
| `quick` | Lint-level: style-guide violations + obvious breaking changes visible purely from the diff text (removed public method, renamed field, changed signature). No dependency-review, no design-pattern reasoning. | Seconds — the fastest path; matches "would a linter catch this." |
| `standard` | Everything in `quick`, plus dependency-review (parses the changed `package.json`/`composer.json`/`pom.xml` lines) and design-pattern surface checks (pattern violations visible within the changed file itself). | Default for most roles — a few seconds to ~1 minute depending on diff size. |
| `deep` | Everything in `standard`, plus cross-file semantic reasoning: does this change interact badly with code elsewhere in the repo that is NOT part of the diff? (e.g. a removed interface method that's still called from a file outside the diff; a new endpoint that bypasses an existing middleware chain defined elsewhere). Requires reading beyond the diff — bounded by the preflight's context-window advisory. | Slowest — reserved for `tl`/`security` defaults or explicit request; falls back to `standard` reasoning when the preflight signals a tight context-window fit. |

## Comment-format catalog

`--comment-format` selects the shape of the `review` artifact. Default:
`inline-markdown`.

| Format | Shape | Best for |
|---|---|---|
| `github` | GitHub PR review-comment markdown with fenced ```suggestion blocks (paste-ready into GitHub's "Add single comment" / "Start a review" flow, or feed to the `gh pr review` / GitHub REST API `pulls/comments` payload shape). | Teams reviewing directly on GitHub; CI bots posting review comments via the API. |
| `gitlab` | GitLab MR discussion-thread markdown (paste-ready into a GitLab MR discussion, or feed to the Discussions API `notes` payload shape). Suggestion blocks use GitLab's ` ```suggestion:-0+0 ` syntax. | Teams reviewing on GitLab; CI bots posting MR discussions via the API. |
| `inline-markdown` | Plain markdown keyed by `file:line`, tool-agnostic — the default. Readable standalone, easy to paste into Slack/email/ticket systems, and the only format that doesn't assume a specific forge. | Everyone else; the safe default when the platform isn't named. |

## Per-stack authoring instructions

For each of the 8 stacks the Code Review agent loads a per-stack review
guide at `resources/review-templates/<stack>.md` at authoring time (and,
in a later workstream, a pattern-library file at
`resources/pattern-libraries/<stack>.md` for design-pattern checks). The
review guide is written for **pre-merge speed** — what a senior developer
would flag reading the diff in two minutes — which is a narrower,
faster-to-apply lens than Audit's exhaustive per-file static-analysis rule
packs (`skills/bmad-dept-code-audit-agent/resources/rule-packs/`). Where
Audit asks "does this file violate any of our 60 rules," Code Review asks
"does this specific *change* introduce something a reviewer would block
on right now."

Concretely, per stack:

- **AEM** — flag HTL context-escaping in newly added markup
  (`context='unsafe'`/`context='html'` on request-derived values), Sling
  Model injection-strategy choice on new `@Model` classes (adaptable
  mismatch), and missing `@PostConstruct` null-safety on new injected
  fields. Audit's AEM rule pack additionally does exhaustive
  resource-resolver-leak / Oak-index / dispatcher-rule scanning across
  the whole repo — Code Review only flags those patterns when they
  appear in the diff's changed lines.
- **Commerce PaaS** — flag plugin `sortOrder`/`sort_order` conflicts
  against existing plugins on the same method, and missing `di.xml`
  `<preference>` scope (module-scoped vs global) on newly declared
  preferences.
- **Spring** — flag missing `@Valid`/`@Validated` on new `@RequestBody`
  endpoint parameters, and transaction-boundary placement (`@Transactional`
  on a public-facing controller method vs the service layer it should sit on).
- **EDS** — flag a new block missing lazy-load wiring
  (`loadBlock`/`decorate` lifecycle), and DOM work performed outside the
  block's `decorate()` function (module-level side effects that run at
  import time).

Full per-stack guides — with 8-12 pre-merge red flags, style-guide
highlights, breaking-change signals, dependency-change signals,
design-pattern checks, a stack-specific checklist, two worked examples,
and reviewer anti-patterns — live at `resources/review-templates/<stack>.md`
for all 8 stacks: `aem.md`, `commerce-paas.md`, `commerce-saas.md`,
`sling.md`, `spring.md`, `app-builder.md`, `eds.md`, `eds-commerce.md`.

## Output contract

The Code Review agent emits the standardized DCA outputs into
`<project>/code-review-reports/` (override with `--output`), via the
shared `emitStandardOutputs` (agent id `code-review`). The 15-column
Summary contract is preserved so downstream agents (Audit, Impact
Analysis, Release, Requirements) can chain off the same row shape.

### Sheets

| Sheet | Contents |
|---|---|
| **Run Info** | Model, context window, stack, role + source, project name / root, diff scope, style-guide path (if custom), review depth, comment format, artifact set, artifact counts. |
| **Summary** | The 15-column contract, one row per review comment / style-rule check / breaking-change / dependency-change / design-pattern violation / checklist item. |
| **Severity Breakdown** | Counts per severity bucket (`CRITICAL` / `HIGH` / `MEDIUM` / `LOW` / `INFO`). |
| **By Category** | Counts per category (`style` / `breaking` / `dependency` / `pattern` / `checklist`). |
| **Recommendations** | Roll-up of the `recommendation` column, sorted by severity. |
| **SLA Status** (Phase 1) | Only when `--no-sla` is NOT set. See § SLA tracking. |
| **Delta** (optional) | When reviewing an updated PR revision against a prior review run (same diff base), shows what changed vs the prior review. |

### 15-column Summary contract

Each finding row carries:

| Column | Value |
|---|---|
| `id` | `REV-<n>` (monotonic per run) |
| `title` | Finding title — comment summary / style-rule name / breaking-change summary / dependency name / pattern-violation name / checklist item |
| `description` | Full text — comment body (what + why + suggested fix) / rule description / what-changed detail / dependency version-change / pattern description / checklist item detail |
| `tech-stack` | `aem` \| `commerce-paas` \| `commerce-saas` \| `sling` \| `spring` \| `app-builder` \| `eds` \| `eds-commerce` |
| `category` | `style` \| `breaking` \| `dependency` \| `pattern` \| `checklist` |
| `code-reference` | `file:line` in the diff |
| `severity` | `CRITICAL` \| `HIGH` \| `MEDIUM` \| `LOW` \| `INFO` — mapped from review-severity (breaking-change `MUST-COMMUNICATE` → `CRITICAL`/`HIGH`; `SHOULD-FLAG` → `MEDIUM`/`LOW`; style violations default `MEDIUM`/`LOW`; dependency CVE hits → severity of the CVE) |
| `confidence` | `high` (explicit diff evidence — a removed method, a changed signature) \| `medium` (LLM-authored pattern match) \| `low` (inferred — needs reviewer judgment) |
| `ruleId` | `REVIEW-<stack>-<type>` (e.g. `REVIEW-aem-htl-escaping`, `REVIEW-spring-missing-valid`, `REVIEW-eds-lazy-load`) |
| `recommendation` | Suggested fix — the concrete change to make |
| `impact` | Impact statement (per-role phrasing: business impact for pm; blast radius for migration/security; consumer impact for breaking changes) |
| `effort` | T-shirt: `S` \| `M` \| `L` \| `XL` |
| `comments` | Free text — reviewer notes, open questions, blocking dependencies |
| `owner` | Empty at authoring time; the PR author or reviewer fills it during triage |
| `status` | `open` (default) \| `acknowledged` \| `resolved` \| `wontfix` — advances via the decisions gate |

### Written files

- `REVIEW-COMMENTS.md` (or `.json` when `--comment-format` is `github`/`gitlab`
  and a structured payload is more useful than markdown) — rendered from
  `templates/review-comment.md`.
- `STYLE-CHECKLIST.md` — rendered from `templates/style-checklist.md`.
- `BREAKING-CHANGES.md` — rendered from `templates/breaking-change-report.md`.
- `DEPENDENCY-REVIEW.md` — rendered from `templates/dependency-review.md`.
- `DESIGN-PATTERNS.md` — rendered from `templates/design-pattern-report.md`.
- `PR-CHECKLIST.md` — rendered from `templates/pr-checklist.md`.
- `CODE-REVIEW-INDEX.md` — always emitted; manifest of inputs → artifacts.
- `code-review-<branch>-<timestamp>-agent-report.xlsx` — the standardized workbook.
- `code-review-<branch>-<timestamp>-agent-report.md` — Markdown twin.
- `CHANGE-LOG.md` — appended at the project root with a one-line run
  summary (e.g. `Code Review: 14 comments (2 CRITICAL), 1 breaking change,
  2 dependency flags, 1 pattern violation, checklist 11/14.`).
- Optional standard git branch `dca/code-review-<stack>-<timestamp>` — cut
  from `production`/`main`/`master`/`develop` (or `--source-branch <name>`)
  when `--create-branch` is passed.

## Findings gate (Phase 1)

The Code Review agent participates in the shared **decisions gate**
(`.bmad/decisions.yaml`) exactly the way the other nine agents do. For
this agent, decisions apply to review findings:

- `accepted` — the review finding is approved; ship it as-is (e.g. a
  style deviation the team has consciously accepted, a dependency bump
  that's been manually vetted).
- `deferred` — fix in a follow-up PR — moves to SLA sheet with
  `next-review` date (e.g. a design-pattern violation that's real but not
  worth blocking this PR for).
- `wontfix` — intentional, won't change (e.g. a breaking change that's
  deliberate and already communicated via a changelog entry).

**Flags:**

- `--include-decided` — show findings even when a decision exists.
- `--decisions-path <path>` — override the decisions file location.
- `--ignore-decision-expiry` — keep suppressing findings even when the
  decision has expired.
- `--list-decisions` — print every decision in `.bmad/decisions.yaml` and exit.

See `skills/shared/decisions/` and the Docusaurus concept page for the
full YAML shape.

## SLA tracking (Phase 1)

The Code Review agent participates in the shared **SLA gate**
(`.bmad/sla.yaml`). For this agent, SLA is interpreted as
**review-turnaround SLA**: how long a PR can sit with unaddressed
CRITICAL/HIGH review comments before it's `OVERDUE` per role.

**Default SLAs** (customize in `.bmad/sla.yaml`):

| Role | `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`/`INFO` |
|---|---|---|---|---|
| `tl` | 4 hours | 1 day | 3 days | ∞ |
| `security` | 4 hours | 4 hours | 1 day | ∞ |
| `devops` | 1 day | 1 day | 3 days | ∞ |
| `de` | 1 day | 2 days | 5 days | ∞ |
| `qa` | 1 day | 2 days | 5 days | ∞ |
| `ea` | 1 day | 2 days | 5 days | ∞ |
| `pm` | 1 day | 3 days | 7 days | ∞ |
| (other) | 1 day | 2 days | 5 days | ∞ |

**Flags:**

- `--sla-path <path>` — override the SLA file location.
- `--no-sla` — skip SLA computation + sheet.
- `--fail-on-overdue` — exit code 6 if any finding is OVERDUE per role
  SLA. Wire this into CI to fail the merge gate when a PR has been
  sitting with an unaddressed CRITICAL review comment too long.

The SLA sheet on the workbook shows each finding's age, its SLA
threshold given its severity + owner-role, and its state (`fresh` /
`nearing` / `overdue`).

## Cross-agent chaining hints

Code Review sits between generation/implementation and merge — it is the
last automated checkpoint before code lands on the default branch.
Recommended fan-in / fan-out:

```
Requirements (BRD) → Architecture (ADR + HLD + LLD)
    ↓
Generation → local dev / implementation
    ↓
Code Review (--pr <base>..<head> --artifacts all)   ← this agent, pre-merge
    → review comments (github/gitlab/inline-markdown)
    → style-check / breaking-changes / dependency-review / design-patterns
    → role-adapted pre-merge checklist
    ↓ (merge happens here — human or CI gate, not this agent)
Audit + Sonar-Scan + Test-Coverage   ← post-merge deep scan
    ↓
Impact Analysis (blast radius) → Release → Operations
```

Concrete one-liners the AI agent should offer as follow-ups after a Code
Review run:

- **Code Review → Audit** — "schedule a deep post-merge scan on the merged
  result" — Audit's exhaustive rule packs pick up anything the fast
  pre-merge pass didn't have budget to check.
- **Code Review → Test Coverage** — "does this diff need new tests?" — the
  checklist's test-coverage item hands off directly to a `test-coverage`
  run scoped to the changed files.
- **Code Review → Architecture** — "does this diff violate an existing
  ADR/LLD?" — surfaced automatically for the `ea` role; available on
  request for any role.
- **Code Review → Requirements** — "does this diff satisfy the AC it
  claims to?" — when a Requirements-agent report is cached, the checklist
  cross-references it (see `ba` role emphasis).
- **Code Review → Impact Analysis** — "trace the blast radius of the
  flagged breaking change" — hands the breaking-change list to Impact
  Analysis for a consumer trace.
- **Code Review → Release** — "block the deploy plan on unresolved
  dependency flags" — hands the dependency-review flags to Release's
  deploy-plan gate.

## Constraints / non-goals

**This agent reviews a diff/PR. It does not:**

- **Execute CI.** It does not run the test suite, does not run the
  build, does not run linters directly against the repo. It reads the
  diff text and reasons about it; running `npm test` or `mvn verify` is
  the pipeline's job, not this agent's.
- **Merge or approve PRs itself.** It produces the review content — the
  inline comments, the checklist, the severity-tagged findings. A human
  reviewer, or a CI gate consuming `--fail-on-severity`/
  `--fail-on-overdue`, decides whether the PR merges.
- **Replace Audit's exhaustive scan.** Code Review is fast and
  pre-merge-scoped — it reasons about the diff (and, at `deep` depth, a
  bounded amount of surrounding context). Audit is deep and
  post-merge/scheduled — it walks the entire repo against a full rule
  pack. Running Code Review does not substitute for a periodic Audit
  pass; they are complementary, not redundant.
- **Guarantee zero false negatives.** Especially at `quick`/`standard`
  depth, the agent will miss issues that only manifest through
  interactions with code outside the diff — that's precisely what `deep`
  depth (bounded) and Audit's full scan (unbounded) exist to catch.
- **Auto-post comments to GitHub/GitLab.** The `github`/`gitlab`
  comment-format artifacts are files shaped for those platforms' paste-in
  or API payload — the agent does not call the GitHub/GitLab API itself;
  it has no repo credentials and no network access assumption.
- **Own dependency remediation.** The dependency-review artifact flags
  risk (license, known-CVE, transitive-impact); it does not run
  `npm audit fix`, `composer update`, or open a Dependabot-style PR.
- **Author against unsupported stacks.** Code Review is Adobe/JVM-focused
  (the same 8 stacks as the rest of the DCA suite). If you point it at
  an unsupported stack, `--engine` auto-detection returns `null` and the
  dispatcher falls back to a generic INFO finding prompting `--engine
  <id>` or a stack-agnostic pass.

**What the agent does authoritatively:**

- Author inline PR review comments — file:line anchored, severity-tagged,
  with a suggested fix — in GitHub, GitLab, or tool-agnostic
  inline-markdown shape.
- Author a style-guide compliance report against the built-in per-stack
  guide, optionally layered with a custom `--style-guide` doc.
- Detect breaking API/schema/contract changes visible in the diff, with
  migration guidance and a suggested changelog entry.
- Assess dependency-change risk — license check, known-vulnerability
  flags, transitive-impact notes.
- Flag design-pattern violations introduced by the diff, with a suggested
  refactor and effort estimate.
- Author a role-adapted pre-merge checklist spanning code quality, tests,
  security, docs, and deploy-readiness.
- Adapt review emphasis, depth default, and recommended follow-up to the
  resolved role.
- Participate in the shared decisions + SLA gates so review findings can
  be triaged and stale unaddressed CRITICAL comments can block CI.

## Commands Reference

| Trigger | Action |
|---------|--------|
| `review this PR` / `review my changes` | `--artifacts all` with resolved diff scope |
| `check style guide` | `--artifacts style-check` |
| `breaking changes in this diff` | `--artifacts breaking-changes` |
| `dependency review` | `--artifacts dependency-review` |
| `design pattern check` | `--artifacts design-patterns` |
| `pre-merge checklist` | `--artifacts checklist` |
| `is this PR ready to merge` | `--artifacts all` |
| `review as <role>` | `--role <role> --artifacts all` |
| `list code review engines` | `--list-engines` |
| `switch role to <code>` | Rewrite `.bmad/role.yaml` |
| `switch intake to interactive` / `technical` | Rewrite `.bmad/intake.yaml` |

## CLI Options

| Flag | Description |
|------|-------------|
| `--path <dir>` | Project root (default: `.`) |
| `--engine <engine>` | `aem` \| `commerce-paas` (alias `commerce`) \| `commerce-saas` \| `sling` \| `spring` \| `app-builder` \| `eds` \| `eds-commerce` (auto-detect if omitted). AEM aliases: `aemcs`, `aemams`. |
| `--output <dir>` | Output directory (default `<project>/code-review-reports`) |
| `--interactive` | Interactive intake mode (prompts step-by-step) |
| `--technical` | Technical intake mode (silent error on missing required inputs) |
| `--list-engines` | List available engines |
| `--role <code>` | Role adaptation — persisted at `<project>/.bmad/role.yaml`; `--role` wins for a single run |
| `--pr <a>..<b>` | Diff range to review. A single ref is diffed against the first existing main/master/develop/production branch. Mutually exclusive with `--diff` and `--from-ref`/`--to-ref`. |
| `--diff` | Review uncommitted working-tree changes (`git diff HEAD`). Mutually exclusive with `--pr` and `--from-ref`/`--to-ref`. |
| `--from-ref <ref>` | Explicit diff start ref — pair with `--to-ref` as an alternative to `--pr`. |
| `--to-ref <ref>` | Explicit diff end ref — pair with `--from-ref`. |
| `--style-guide <path>` | Optional path to a custom style-guide doc, enforced alongside the built-in per-stack guide. |
| `--review-depth <depth>` | `quick` \| `standard` \| `deep`. Default is role-driven. |
| `--comment-format <fmt>` | `github` \| `gitlab` \| `inline-markdown`. Default `inline-markdown`. |
| `--fail-on-severity <sev>` | Exit code 7 if any finding at/above this severity exists. `critical` \| `high` \| `medium` \| `low`. |
| `--artifacts <csv>` | `review`, `style-check`, `breaking-changes`, `dependency-review`, `design-patterns`, `checklist`, `all`. Default: `all`. |
| `--format <markdown\|both>` | Output format. Default: `markdown`. `both` currently writes markdown only (docx planned) with a warning. |
| `--create-branch` | Cut standard branch `dca/code-review-<stack>-<timestamp>` before writing outputs |
| `--source-branch <name>` | Source branch for `--create-branch` (default: production/main/master/develop) |
| `--preflight` | Print model/context + STATIC/LLM/HYBRID advisory and exit |
| `--no-preflight` | Suppress the preflight advisory |
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
