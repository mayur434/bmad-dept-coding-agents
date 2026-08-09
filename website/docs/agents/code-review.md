---
id: code-review
title: Code Review
sidebar_position: 10
description: Pre-merge PR/diff review — style-guide enforcement, breaking-change detection, dependency-change risk, design-pattern violations, and role-adapted merge checklists. Complements Audit's post-hoc deep scan.
keywords:
  - code review
  - pr review
  - pull request review
  - merge request review
  - style guide
  - breaking change
  - dependency review
  - design pattern
  - pre-merge
  - checklist
  - inline comments
---

## Purpose

The **Pre-Merge Code Review Specialist** (📝) is the **10th agent** in the DCA suite and closes **SDLC phase 3 deeper** — pre-merge review, complementing [Audit](./audit)'s post-hoc deep scan. Where Audit runs an exhaustive, scheduled, post-merge scan against a full rule pack across the whole repo, Code Review is **fast and diff-scoped**: it reads the changed lines the way a senior teammate reads a PR in the two minutes before clicking "Approve," and reviews a diff/PR **before it merges** across 6 artifact types.

It authors — grounded in per-stack Adobe/JVM pre-merge idioms across all 8 supported stacks — **inline PR review comments** (file:line-anchored, severity-tagged, with a suggested fix), **style-guide compliance reports**, **breaking-change detection** with migration guidance, **dependency-change risk assessment** (license + known-CVE + transitive-impact), **design-pattern violation reports**, and **role-adapted pre-merge checklists**.

:::note Code Review is a pre-merge review specialist, not a merge gate
It does not run CI, does not approve or merge the PR itself, and does not replace Audit's exhaustive scan. It produces the review content — a human reviewer, or a CI status check consuming `--fail-on-severity`, acts on it. See the [Constraints / non-goals](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/SKILL.md#constraints--non-goals) section in the source SKILL for the full boundary.
:::

## When to use

- **Opening a PR for review** — a first-pass review before assigning human reviewers, catching the obvious stuff (style, an accidental breaking change, an unpinned dependency) before anyone else looks at it.
- **Self-review before requesting reviewers** — run `--diff` against your own uncommitted or staged changes before opening the PR at all; fix what's flagged, then open a cleaner PR.
- **Reviewing a teammate's PR** — point `--pr <base>..<head>` at their branch for a structured first pass: inline comments ready to paste straight into the review, plus a checklist to work through together.
- **Dependency-bump review** — a PR that's "just" a `package.json`/`composer.json`/`pom.xml` version bump; run `--artifacts dependency-review` for the license + known-CVE + transitive-impact read before approving what looks like a trivial change.
- **Pre-release final-diff sanity check** — before cutting a release, diff the release branch against the last tag (`--from-ref v2.3.0 --to-ref release/2.4.0`) and run a `deep` review to catch anything that slipped past individual PR reviews.

## What it produces

Every code-review run emits the standardized DCA outputs into `<project>/code-review-reports/` (override with `--output`):

| Artifact | Where | Notes |
|----------|-------|-------|
| `code-review-<branch>-<timestamp>-agent-report.xlsx` | `code-review-reports/` | Standardized 15-column Summary contract; one row per review comment / style-rule check / breaking-change / dependency-change / design-pattern violation / checklist item, keyed as `REV-<n>`. |
| `code-review-<branch>-<timestamp>-agent-report.md` | `code-review-reports/` | Git-diffable Markdown twin. |
| `REVIEW-COMMENTS.md` (or `.json` for github/gitlab format) | `code-review-reports/` | Full inline PR-comment set — file:line anchored, severity-tagged, suggested-fix blocks. |
| `STYLE-CHECKLIST.md` | `code-review-reports/` | Style-guide compliance report — built-in per-stack guide, layered with `--style-guide` when given. |
| `BREAKING-CHANGES.md` | `code-review-reports/` | Breaking API/schema/contract-change detector output with migration guidance. |
| `DEPENDENCY-REVIEW.md` | `code-review-reports/` | New/updated/removed dependency risk — license + known-CVE + transitive-impact notes. |
| `DESIGN-PATTERNS.md` | `code-review-reports/` | Design-pattern violation + suggested-refactor report. |
| `PR-CHECKLIST.md` | `code-review-reports/` | Role-adapted pre-merge checklist. |
| `CODE-REVIEW-INDEX.md` | `code-review-reports/` | Manifest of inputs → authored artifacts. |
| One `CHANGE-LOG.md` entry | project root | e.g. `Code Review: 14 comments (2 CRITICAL), 1 breaking change, 2 dependency flags, 1 pattern violation, checklist 11/14.` |
| Optional working branch | git | `dca/code-review-<stack>-<timestamp>` when `--create-branch` is passed. |

The report follows the [standardized outputs contract](../concepts/standardized-outputs): **Run Info** · **Summary** · **Severity Breakdown** · **By Category** · **Recommendations** · **SLA Status** (unless `--no-sla`) · optional **Delta** (against a prior review of the same diff base). The 15-column Summary maps `id → REV-<n>`, `severity → CRITICAL/HIGH/MEDIUM/LOW/INFO`, and `category → {style, breaking, dependency, pattern, checklist}`.

## Modes

Two artifact-scope modes, both selected by `--artifacts`:

| Mode | Trigger | What it does | Best for |
|------|---------|--------------|----------|
| **Full review** (default) | `--artifacts all` (or omitted) or `"full review"` / `"full pre-merge review"` in the prompt | Emits every resolvable artifact: review comments + style-check + breaking-changes + dependency-review + design-patterns + checklist. | Opening a PR; pre-release sanity check; enterprise merge-gate review. |
| **Individual artifact** | `--artifacts <one>` — one of `review`, `style-check`, `breaking-changes`, `dependency-review`, `design-patterns`, `checklist` | Authors exactly the requested artifact using the stack template and available inputs. | Focused re-runs; dependency-bump-only review; scripted CI paths. |

## Artifact catalog

`--artifacts` accepts a comma-separated list. `all` expands to every artifact resolvable given other flags. Missing → `all`.

| Artifact key | Written file(s) | Master template | Per-stack guide |
|---|---|---|---|
| `review` | `REVIEW-COMMENTS.md` (or `.json` for github/gitlab format) | `templates/review-comment.md` | [`resources/review-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-review-agent/resources/review-templates) |
| `style-check` | `STYLE-CHECKLIST.md` | `templates/style-checklist.md` | [`resources/review-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-review-agent/resources/review-templates) |
| `breaking-changes` | `BREAKING-CHANGES.md` | `templates/breaking-change-report.md` | [`resources/review-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-review-agent/resources/review-templates) |
| `dependency-review` | `DEPENDENCY-REVIEW.md` | `templates/dependency-review.md` | [`resources/review-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-review-agent/resources/review-templates) |
| `design-patterns` | `DESIGN-PATTERNS.md` | `templates/design-pattern-report.md` | [`resources/review-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-review-agent/resources/review-templates) + [`resources/pattern-libraries/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-review-agent/resources/pattern-libraries) |
| `checklist` | `PR-CHECKLIST.md` | `templates/pr-checklist.md` | [`resources/review-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-review-agent/resources/review-templates) |
| `all` | Every artifact resolvable given other flags. | — | — |

## Review-depth catalog

`--review-depth` controls how much the review reasons about code outside the literal diff. When omitted, `defaultReviewDepth()` in `scripts/run.ts` supplies a role-driven default (`de` → `quick`; `tl`, `security` → `deep`; everyone else → `standard`).

| Depth | What it checks | Role defaults | Typical turnaround |
|---|---|---|---|
| `quick` | Lint-level: style-guide violations + obvious breaking changes visible purely from the diff text (removed public method, renamed field, changed signature). No dependency-review, no design-pattern reasoning. | `de` | Seconds — matches "would a linter catch this." |
| `standard` | Everything in `quick`, plus dependency-review (parses changed `package.json`/`composer.json`/`pom.xml` lines) and design-pattern surface checks visible within the changed file itself. | Default for most roles | A few seconds to ~1 minute depending on diff size. |
| `deep` | Everything in `standard`, plus cross-file semantic reasoning — does this change interact badly with code elsewhere in the repo that is NOT part of the diff? Bounded by the preflight's context-window advisory; falls back to `standard` reasoning when the fit is tight. | `tl`, `security` | Slowest — reserved for deep-default roles or explicit request. |

## Comment-format catalog

`--comment-format` selects the shape of the `review` artifact. Default: `inline-markdown`.

| Format | Shape | Best for |
|---|---|---|
| `github` | GitHub PR review-comment markdown with fenced ` ```suggestion ` blocks — paste-ready into GitHub's "Add single comment" / "Start a review" flow, or the `pulls/comments` REST payload shape. | Teams reviewing directly on GitHub; CI bots posting review comments via the API. |
| `gitlab` | GitLab MR discussion-thread markdown, using GitLab's ` ```suggestion:-0+0 ` syntax — paste-ready into an MR discussion, or the Discussions API `notes` payload shape. | Teams reviewing on GitLab; CI bots posting MR discussions via the API. |
| `inline-markdown` | Plain markdown keyed by `file:line`, tool-agnostic — the default. Readable standalone, easy to paste into Slack/email/ticket systems, and the only format that doesn't assume a specific forge. | Everyone else; the safe default when the platform isn't named. |

## Trigger phrases

Paste any of these into the agent chat — the agent auto-detects the stack, diff scope, and role.

```text
review this PR
review my uncommitted changes
review PR #452, main..feature/checkout-v2
deep review with design-pattern checks
breaking changes in this diff
dependency review for this diff
check style guide against ./docs/style.md
pre-merge checklist for this PR
is this PR ready to merge
review as security
list code review engines
```

The full copy-paste catalog is in the [Code Review prompts reference](../reference/prompts/code-review).

## CLI usage (technical mode)

The canonical invocation:

```bash
npx ts-node .claude/skills/bmad-dept-code-review-agent/scripts/run.ts \
  --path . --pr main..feature/checkout-v2 --review-depth deep
```

**One artifact per example** — copy-paste-friendly:

```bash
# Full review of uncommitted changes
npx ts-node .claude/skills/bmad-dept-code-review-agent/scripts/run.ts \
  --path . --diff --artifacts all
```

```bash
# Style-check against a custom style guide
npx ts-node .claude/skills/bmad-dept-code-review-agent/scripts/run.ts \
  --path . --diff --artifacts style-check --style-guide ./docs/style.md
```

```bash
# Breaking-change detection only
npx ts-node .claude/skills/bmad-dept-code-review-agent/scripts/run.ts \
  --path . --pr main..HEAD --artifacts breaking-changes
```

```bash
# Dependency review
npx ts-node .claude/skills/bmad-dept-code-review-agent/scripts/run.ts \
  --path . --diff --artifacts dependency-review
```

```bash
# Design-pattern check
npx ts-node .claude/skills/bmad-dept-code-review-agent/scripts/run.ts \
  --path . --pr main..HEAD --artifacts design-patterns
```

```bash
# Pre-merge checklist as security, GitHub comment format, fail on high
npx ts-node .claude/skills/bmad-dept-code-review-agent/scripts/run.ts \
  --path . --pr main..HEAD --role security \
  --comment-format github --fail-on-severity high
```

The Preflight advisory prints on every run — see [The Agents](../concepts/the-agents) for how STATIC / LLM / HYBRID is decided (the diff itself is almost always small relative to the full repo, so Code Review fits comfortably in LLM mode far more often than Audit does — the preflight mainly signals whether `deep` review depth, which reasons about files outside the diff, is affordable), and [Auto-install](../concepts/auto-install) for the first-run dependency bootstrap.

## Flags reference

Every flag listed here is wired in `scripts/run.ts`.

### Review-specific

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--pr <a>..<b>` | string | — | Diff range to review (`git diff --name-only a..b`). A single ref is diffed against the first existing main/master/develop/production branch. Mutually exclusive with `--diff` and `--from-ref`/`--to-ref`. |
| `--diff` | bool | false | Review uncommitted working-tree changes (`git diff HEAD`). Mutually exclusive with `--pr` and `--from-ref`/`--to-ref`. |
| `--from-ref <ref>` | string | — | Explicit diff-range start — pair with `--to-ref` as an alternative to `--pr`. |
| `--to-ref <ref>` | string | — | Explicit diff-range end — pair with `--from-ref`. |
| `--style-guide <path>` | string | — | Optional path to a custom style-guide doc, enforced alongside the built-in per-stack guide. Path not found → INFO finding + fallback to the built-in guide, does not fail the run. |
| `--review-depth <depth>` | enum | role-driven | How much the review reasons about code outside the diff. Values: `quick`, `standard`, `deep`. |
| `--comment-format <fmt>` | enum | `inline-markdown` | Shape of the review-comment artifact. Values: `github`, `gitlab`, `inline-markdown`. |
| `--fail-on-severity <sev>` | enum | — | Exit code 7 if any finding at/above this severity exists. Values: `critical`, `high`, `medium`, `low`. Distinct from `--fail-on-overdue` (SLA-based, exit code 6). |
| `--artifacts <csv>` | csv | `all` | Which artifacts to author. Values: `review`, `style-check`, `breaking-changes`, `dependency-review`, `design-patterns`, `checklist`, `all`. |
| `--format <markdown\|both>` | enum | `markdown` | Output format. `both` currently emits markdown only (docx planned) with a warning. |

### Standard (shared with every DCA agent)

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--path <dir>` | string | `.` | Project root — used for stack auto-detection and as the output base. |
| `--engine <id>` | enum | auto | One of `aem`, `commerce-paas` (alias `commerce`), `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`. AEM aliases: `aemcs`, `aemams`. |
| `--output <dir>` | dir | `<project>/code-review-reports/` | Override the report directory. |
| `--role <code>` | enum | `.bmad/role.yaml` | Role adaptation: `ea` \| `tl` \| `de` \| `qa` \| `devops` \| `security` \| `pm` \| `ba` \| `migration` \| `content` \| `generic`. Wins for one run. |
| `--interactive` | bool | false | Force interactive intake (step-by-step questions). Persists to `.bmad/intake.yaml`. |
| `--technical` | bool | false | Force technical intake mode. |
| `--create-branch` | bool | false | Cut `dca/code-review-<stack>-<timestamp>` before writing outputs. |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. Cascade: `production → main → master → develop`. |
| `--preflight` | bool | false | Print the LLM / context-window advisory and exit. |
| `--no-preflight` | bool | false | Suppress the preflight advisory that otherwise prints on every run. |
| `--yes-install` | bool | false | First-run dependency install without confirmation. |
| `--no-install` | bool | false | Error out if deps are missing. |
| `--list-engines` | bool | false | Print the 8 stacks and exit. |
| `--help` | bool | false | Show help. |

### Findings gate (Enterprise Phase 1)

Shared with every DCA agent. See [Findings Gate](../concepts/findings-gate) for the full mechanics — for Code Review, decisions apply to review findings: **accepted** (approved as-is — a style deviation the team has consciously accepted, a manually-vetted dependency bump) / **deferred** (fix in a follow-up PR — moves to the SLA sheet with a `next-review` date) / **wontfix** (intentional, won't change — e.g. a deliberate breaking change already communicated via a changelog entry).

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--include-decided` | bool | false | Bypass the findings gate — show items already decided in `.bmad/decisions.yaml`. |
| `--decisions-path <path>` | string | `<projectRoot>/.bmad/decisions.yaml` | Override the decisions file. |
| `--ignore-decision-expiry` | bool | false | Treat expired decisions as still active for this run. |
| `--list-decisions` | bool | false | Print all decisions and exit. |

### SLA tracking (Enterprise Phase 1)

Shared with every DCA agent. See [SLA Tracking](../concepts/sla-tracking) — for Code Review, the SLA is a **review-turnaround SLA**: how long a PR can sit with unaddressed CRITICAL/HIGH review comments before it's `OVERDUE` per role.

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--sla-path <path>` | string | `<projectRoot>/.bmad/sla.yaml` | Override the SLA file. |
| `--no-sla` | bool | false | Skip the SLA sheet and computation. |
| `--fail-on-overdue` | bool | false | Exit code 6 if any surviving finding is OVERDUE per role SLA. Wire into CI to fail the merge gate when a PR has been sitting with an unaddressed CRITICAL review comment too long. |

## What's new (Phase 4)

Code Review is the **10th agent** in the DCA suite and closes SDLC phase 3 deeper — pre-merge review, complementing Audit's post-hoc deep scan. It ships alongside **Compliance** (11th agent, phase 8) — together the two close the **last remaining SDLC coverage gaps**, completing full 8-phase coverage across the whole DCA suite:

- **Requirements** (Phase 2) — authors BRD + user stories + AC upstream of any design.
- **Architecture** (Phase 2) — turns the "what" into the "how" via ADR + HLD + LLD + API + diagrams + STRIDE + data model.
- **Audit** + **Sonar Scan** + **Test Coverage** — gate quality on existing code, post-merge / scheduled.
- **Impact Analysis** — traces blast radius across code.
- **Code Generation** — scaffolds from a spec / LLD.
- **Release** (Phase 3) — turns a merged change set into a shippable release.
- **Operations** (Phase 3) — post-deploy runbook + alerts wire-up.
- **Code Review** (this agent — Phase 4) — pre-merge diff review: style + breaking-changes + dependency-review + design-patterns + checklist.
- **Compliance** (Phase 4, 11th agent) — closes phase 8 in parallel with this agent.

The natural fan-out from a Code Review run: **`code-review → audit`** (post-merge deep scan on the merged result) and **`code-review → test-coverage`** (does this diff need new tests?).

## Example workflow

**Chat trigger 1 — review a PR:**

```text
review this PR — main..feature/checkout-v2
```

**Resolved CLI:**

```bash
npx ts-node .claude/skills/bmad-dept-code-review-agent/scripts/run.ts \
  --path . --pr main..feature/checkout-v2 --artifacts all \
  --technical --no-preflight --yes-install
```

**Chained SDLC passes:**

```text
code-review → audit — schedule a deep post-merge scan on the merged result
code-review → test-coverage — does this diff need new tests?
```

**Outputs:**

```
code-review-reports/
├── code-review-main-20260809_120000-agent-report.xlsx
├── code-review-main-20260809_120000-agent-report.md
├── REVIEW-COMMENTS.md              ← inline comments, file:line anchored
├── STYLE-CHECKLIST.md              ← 9/11 rules pass
├── BREAKING-CHANGES.md             ← 1 breaking change + migration note
├── DEPENDENCY-REVIEW.md            ← 2 bumps, 1 flagged
├── DESIGN-PATTERNS.md              ← 1 violation + suggested refactor
├── PR-CHECKLIST.md                 ← 11/14 items pass
└── CODE-REVIEW-INDEX.md
CHANGE-LOG.md                       ← one new entry per run
```

## Cross-agent chaining hints per role

The Code Review agent adapts its **default review-depth**, **artifact emphasis**, and **recommended follow-up** to the resolved [role](../concepts/role-adaptation):

| Role | Review-depth default | Emphasis | Next agent |
|------|-----------------------|----------|-----------|
| `ea` | `standard` | Portfolio-level pattern-consistency; architecture-drift flagging against the ADR log. | [Architecture](./architecture) — check the diff against the ADR log for drift. |
| `tl` | `deep` | **Design-pattern violations + breaking-change detection prioritized** — deep cross-file semantic reasoning. | [Impact Analysis](./impact-analysis) — trace blast radius of the flagged breaking change. |
| `de` | `quick` | Style-check + quick checklist; fast turnaround; unblock the PR quickly. | [Code Generation](./code-generation) — scaffold the test/fix the checklist flagged. |
| `qa` | `standard` | Test-coverage presence in the diff; breaking-change detection framed as API-contract test impact. | [Test Coverage](./test-coverage) — confirm coverage on the changed lines. |
| `devops` | `standard` | **Primary role for this agent.** Dependency-review prioritized (supply-chain risk); CI-integrated comment format. | [Release](./release) — block the deploy plan on unresolved dependency flags. |
| `security` | `deep` | Dependency-review + breaking-change (auth/crypto) prioritized; STRIDE-lite framing; deep depth to catch cross-file auth-boundary regressions. | [Sonar Scan](./sonar-scan) — deep vulnerability scan on the touched auth/crypto paths. |
| `pm` | `standard` | Checklist framed as business-risk; executive-summary style. | [Requirements](./requirements) — confirm the diff satisfies the linked AC. |
| `ba` | `standard` | Checklist cross-references requirements/AC when a Requirements report is cached. | [Requirements](./requirements) — reconcile diff behavior against the BRD. |
| `migration` | `deep` | **Breaking-change detection is PRIMARY concern** — before/after behavior comparison; every breaking change gets a migration note. | [Release](./release) — cross-reference breaking changes with the cutover plan. |
| `content` | `standard` | Style-check scoped to content-model/component conventions; design-pattern checks for content components. | [Code Generation](./code-generation) — scaffold the content-model fix the review flagged. |
| `generic` | `standard` | Balanced default — every artifact resolvable, standard depth. | [Audit](./audit) — schedule a deep post-merge scan on the merged result. |

The resolved role is exposed to child engines via `process.env.DCA_ROLE`, recorded on the **Run Info** sheet, and printed to stderr on every run.

## Per-stack notes

The agent loads a per-stack review guide, and (for design-pattern checks) a per-stack pattern library, at authoring time. See the [Pre-Merge Review concept](../concepts/pre-merge-review) for the full 2-pack model.

| Stack | Engine ID | Review Guide | Pattern Library |
|-------|-----------|---------------|------------------|
| AEM (AEMaaCS + AMS) | `aem` | [review guide](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/review-templates/aem.md) | [pattern library](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/pattern-libraries/aem.md) |
| Adobe Commerce (PaaS) | `commerce-paas` / `commerce` | [review guide](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/review-templates/commerce-paas.md) | [pattern library](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/pattern-libraries/commerce-paas.md) |
| Adobe Commerce SaaS | `commerce-saas` | [review guide](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/review-templates/commerce-saas.md) | [pattern library](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/pattern-libraries/commerce-saas.md) |
| Sling / Shaft | `sling` | [review guide](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/review-templates/sling.md) | [pattern library](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/pattern-libraries/sling.md) |
| Spring Boot | `spring` | [review guide](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/review-templates/spring.md) | [pattern library](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/pattern-libraries/spring.md) |
| Adobe App Builder | `app-builder` | [review guide](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/review-templates/app-builder.md) | [pattern library](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/pattern-libraries/app-builder.md) |
| Edge Delivery Services | `eds` | [review guide](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/review-templates/eds.md) | [pattern library](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/pattern-libraries/eds.md) |
| EDS + Commerce | `eds-commerce` | [review guide](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/review-templates/eds-commerce.md) | [pattern library](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/resources/pattern-libraries/eds-commerce.md) |

## See also

- [Code Review prompts catalog](../reference/prompts/code-review) — 90+ copy-paste prompts across stacks, roles, and artifact types.
- [Pre-Merge Review concept](../concepts/pre-merge-review) — the 6-artifact model, per-stack knowledge packs, two authoring modes, relationship to Audit.
- [CLI Flags reference](../reference/cli-flags) — including the Enterprise Phase 1 flags shared across all agents.
- [Audit agent](./audit) — post-merge deep scan; complements this agent's fast pre-merge pass.
- [Test Coverage agent](./test-coverage) — test-gap chaining from the checklist's test-coverage item.
- [Architecture agent](./architecture) — ADR/LLD-violation chaining, primary for the `ea` role.
- [Requirements agent](./requirements) — AC-traceability chaining, primary for the `ba` role.
- [Findings gate](../concepts/findings-gate) — accept / defer / wontfix per review finding.
- [SLA tracking](../concepts/sla-tracking) — review-turnaround SLA per role; wire `--fail-on-overdue` into CI to block stale PRs.
- [Standardized outputs contract](../concepts/standardized-outputs) — 15-column Summary + fixed sheet order.
- [Role adaptation](../concepts/role-adaptation) — how default review-depth + emphasis + follow-up change per role.
