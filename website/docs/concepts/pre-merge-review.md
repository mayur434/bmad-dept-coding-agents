---
id: pre-merge-review
title: Pre-Merge Review
sidebar_position: 15
description: How BMAD DCA reviews a diff/PR before merge — style, breaking changes, dependencies, design patterns, and role-adapted checklists — across 8 Adobe/JVM stacks, distinct from Audit's post-hoc deep scan.
keywords:
  - pre-merge review
  - code review
  - pull request
  - style guide
  - breaking change
  - dependency review
  - design pattern
  - checklist
---

The **Pre-Merge Review** concept underpins the [Code Review agent](../agents/code-review) — the 10th agent of the BMAD DCA suite, added in Phase 4 alongside Compliance to close the last remaining SDLC coverage gaps. This page explains the 6-artifact model, the review-depth and comment-format spectrums, per-stack knowledge packs, the two authoring modes, role adaptation, and how Code Review's output relates to — and feeds — the rest of the DCA workflow.

## Why a pre-merge review agent?

The first nine agents cover SDLC phases 1 (Requirements), 2 (Design), 3–4 (build, test, harden, analyze), 5 (Deploy/Release), and 6 (Ops/Monitoring). Audit already provides deep static-analysis coverage — but it is, by design, **exhaustive and whole-codebase**, typically scheduled or run on-demand against the full rule pack. That leaves a gap: the two minutes before a PR merges, when a fast, diff-scoped, human-readable pass would catch the obvious stuff before it's baked into `main`.

Code Review closes that gap:

- **Fast, diff-scoped, before merge.** It reads only what changed — the way a senior teammate reads a PR before clicking "Approve" — not the whole repository. `quick`/`standard` depth resolves in seconds to about a minute; `deep` depth bounds its cross-file reasoning by the preflight's context-window advisory.
- **Audit is exhaustive, whole-codebase, typically post-merge/scheduled.** It walks the entire repo against a full per-stack rule pack, catching everything a rule can express, at the cost of being too slow and too broad for "should this PR merge right now."
- **Enterprise value: catches issues while context is fresh.** A style deviation, an accidental breaking change, or an unpinned dependency is cheapest to fix in the PR that introduced it — before it's merged, before the author has moved on, before three more PRs stack on top of it.

Both agents are complementary, not redundant — running Code Review on every PR does not substitute for a periodic Audit pass, and vice versa.

## The 6-artifact model

Code Review produces up to six distinct artifact types per run. Each is a row category in the standardized Summary sheet AND a written file in `code-review-reports/`:

| Artifact | Primary consumer | Typical driving role | Master template |
|----------|-------------------|------------------------|------------------|
| **Review comments** | PR author + reviewers | `de`, `tl`, `qa` | `templates/review-comment.md` |
| **Style checklist** | PR author | `de`, `content` | `templates/style-checklist.md` |
| **Breaking changes** | Consumers of the changed API/schema/contract | `tl`, `migration`, `security` | `templates/breaking-change-report.md` |
| **Dependency review** | Supply-chain / security reviewers | `devops`, `security` | `templates/dependency-review.md` |
| **Design patterns** | Reviewer + PR author | `tl`, `ea` | `templates/design-pattern-report.md` |
| **PR checklist** | Whoever signs off the merge | all roles (content varies) | `templates/pr-checklist.md` |

Every row in the workbook conforms to the 15-column Summary contract with these key columns:

| Column | Value for a code-review row |
|--------|-------------------------------|
| `id` | `REV-<n>` (monotonic per run) |
| `title` | Finding title — comment summary / style-rule name / breaking-change summary / dependency name / pattern-violation name / checklist item |
| `category` | `style` \| `breaking` \| `dependency` \| `pattern` \| `checklist` |
| `severity` | `CRITICAL` \| `HIGH` \| `MEDIUM` \| `LOW` \| `INFO` |
| `confidence` | `high` (explicit diff evidence — a removed method, a changed signature) \| `medium` (LLM-authored pattern match) \| `low` (inferred — needs reviewer judgment) |
| `ruleId` | `REVIEW-<stack>-<type>` (e.g. `REVIEW-aem-htl-escaping`, `REVIEW-spring-missing-valid`, `REVIEW-eds-lazy-load`) |
| `code-reference` | `file:line` in the diff |
| `status` | `open` (default) \| `acknowledged` \| `resolved` \| `wontfix` — advances via the [decisions gate](./findings-gate) |

Full row-shape spec on the [Standardized Outputs](./standardized-outputs) page.

## The review-depth spectrum

`--review-depth` controls how much the review reasons about code outside the literal diff. When omitted, `defaultReviewDepth()` in `scripts/run.ts` supplies a role-driven default.

| Depth | What expands | Role defaults |
|---|---|---|
| `quick` | Lint-level: style-guide violations + obvious breaking changes visible purely from the diff text. No dependency-review, no design-pattern reasoning. | `de` |
| `standard` | Adds dependency-review (parses changed `package.json`/`composer.json`/`pom.xml` lines) and design-pattern surface checks visible within the changed file itself. | Default for most roles |
| `deep` | Adds cross-file semantic reasoning — does this change interact badly with code elsewhere in the repo that is NOT part of the diff? Bounded by the preflight's context-window advisory; falls back to `standard` when the fit is tight. | `tl`, `security` |

**Rule of thumb.** The diff itself is almost always small relative to the full repo, so this agent fits comfortably in LLM mode far more often than Audit does — the preflight is really telling you whether `deep` depth's repo-aware cross-file reasoning is affordable, not whether the run itself will fit.

## The comment-format spectrum

`--comment-format` selects the shape of the review-comment artifact. Default: `inline-markdown`.

| Format | When to use |
|---|---|
| `github` | Team reviews directly on GitHub, or a CI bot posts comments via the `pulls/comments` REST API. Uses fenced ` ```suggestion ` blocks. |
| `gitlab` | Team reviews on GitLab, or a CI bot posts MR discussions via the Discussions API. Uses GitLab's ` ```suggestion:-0+0 ` syntax. |
| `inline-markdown` | The platform isn't named, or the output needs to be pasted somewhere forge-agnostic (Slack, email, a ticket). Plain markdown keyed by `file:line`. |

## Per-stack knowledge packs

For each of the 8 stacks, Code Review loads **two per-stack resource files** at authoring time — a 2-pack (a narrower sibling of the Requirements 3-pack, the Architecture 4-pack, and the Release 6-pack):

| Pack | Path | Purpose |
|------|------|---------|
| **Review template** | `resources/review-templates/<stack>.md` | Pre-merge-speed guide — 8-12 pre-merge red flags, style-guide highlights, breaking-change signals, dependency-change signals, design-pattern checks, a stack-specific checklist, two worked examples, and reviewer anti-patterns. |
| **Pattern library** | `resources/pattern-libraries/<stack>.md` | Stack-idiomatic anti-pattern catalog consumed by the `design-patterns` artifact — what a "God Sling Model," a leaky transaction boundary, or a block that skips its `decorate()` lifecycle looks like for this stack. |

16 files total (2 packs × 8 stacks). The review guide is written for what a senior developer would flag reading the diff in two minutes — narrower and faster to apply than [Audit](../agents/audit)'s exhaustive per-file rule packs (`skills/bmad-dept-code-audit-agent/resources/rule-packs/`). Where Audit asks "does this file violate any of our 60 rules," Code Review asks "does this specific *change* introduce something a reviewer would block on right now."

**What each stack biases toward** (one-liners; full grid in [`SKILL.md` § Per-stack authoring instructions](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/SKILL.md#per-stack-authoring-instructions)):

- **AEM** — HTL context-escaping on newly added markup, Sling Model injection-strategy choice on new `@Model` classes, missing `@PostConstruct` null-safety on new injected fields.
- **Commerce PaaS** — plugin `sortOrder`/`sort_order` conflicts against existing plugins on the same method, missing `di.xml` `<preference>` scope on newly declared preferences.
- **Spring** — missing `@Valid`/`@Validated` on new `@RequestBody` endpoint parameters, transaction-boundary placement (`@Transactional` on a controller vs the service layer).
- **EDS** — a new block missing lazy-load wiring (`loadBlock`/`decorate` lifecycle), DOM work performed outside `decorate()` (module-level side effects at import time).

## Two modes

Code Review has two artifact-scope modes, both selected by `--artifacts`:

### Full review (default)

**Trigger:** `--artifacts all` (or omitted), or `"full review"` / `"full pre-merge review"` in the prompt.

Emits every resolvable artifact: review comments + style-check + breaking-changes + dependency-review + design-patterns + checklist. Use this when opening a PR, or for a pre-release final-diff sanity check.

**Worked example:**

```text
review this PR — main..feature/checkout-v2
```

Resolves to `--pr main..feature/checkout-v2 --artifacts all` and produces `REVIEW-COMMENTS.md` + `STYLE-CHECKLIST.md` + `BREAKING-CHANGES.md` + `DEPENDENCY-REVIEW.md` + `DESIGN-PATTERNS.md` + `PR-CHECKLIST.md` + `CODE-REVIEW-INDEX.md` alongside the workbook.

### Individual artifact

**Trigger:** `--artifacts <one>` — one of `review`, `style-check`, `breaking-changes`, `dependency-review`, `design-patterns`, `checklist`.

Authors exactly the requested artifact. Use this for a dependency-bump-only review, a quick style check, or a scripted CI path that owns each artifact separately.

**Worked example:**

```text
dependency review for this diff
```

Resolves to `--artifacts dependency-review` with the diff scope taken from uncommitted changes if present, else `--pr main..HEAD`, and produces `DEPENDENCY-REVIEW.md` only.

## Role-adaptation for code review

Code Review adapts the **default review-depth**, the **artifact emphasis**, and the **recommended follow-up** to the resolved role — same [role-adaptation](./role-adaptation) mechanism the other ten agents use.

| Role | Review emphasis |
|------|--------------------|
| `ea` | Portfolio-level pattern-consistency; architecture-drift flagging against the ADR log. |
| `tl` | **Design-pattern violations + breaking-change detection prioritized** — deep cross-file semantic reasoning. |
| `de` | Style-check + quick checklist; fast turnaround; lint-level findings only. |
| `qa` | Test-coverage presence in the diff; breaking-change detection framed as API-contract test impact. |
| `devops` | **Dependency-review priority** — supply-chain risk; CI-integrated comment format. |
| `security` | **Deep depth + dependency-review priority** — breaking-change (auth/crypto) detection; STRIDE-lite framing. |
| `pm` | Checklist framed as business-risk; executive-summary style. |
| `ba` | Checklist cross-references requirements/AC when a Requirements report is cached. |
| `migration` | Breaking-change detection is PRIMARY concern; before/after behavior comparison. |
| `content` | Style-check scoped to content-model/component conventions; design-pattern checks for content components. |
| `generic` | Balanced default — every artifact resolvable, standard depth. |

Full role matrix on the [Code Review agent page](../agents/code-review#cross-agent-chaining-hints-per-role) and in the source [`SKILL.md` § Role-aware behavior](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-review-agent/SKILL.md#role-aware-behavior).

## Relationship to Audit

| | Code Review | Audit |
|---|---|---|
| **Scope** | Diff-scoped — only the changed lines (plus bounded cross-file reasoning at `deep` depth). | Whole-repo — every file against the full rule pack. |
| **Speed** | Fast — seconds to about a minute. | Slow — an exhaustive scan, minutes to longer on large repos. |
| **Timing** | Pre-merge — before the PR lands. | Post-merge / scheduled / on-demand — typically periodic. |
| **Output shape** | Human-readable inline comments (GitHub/GitLab/inline-markdown), plus the standard workbook. | XLSX report, optimized for exhaustive triage rather than pasting into a PR. |
| **Goal** | Catch what a reviewer would block on right now. | Catch everything a rule pack can express, given unlimited time. |

Both funnel into the same [findings-cache](./findings-cache) / [findings-gate](./findings-gate) / [SLA tracking](./sla-tracking) system — a decision recorded against a Code Review finding and a decision recorded against an Audit finding share the same `.bmad/decisions.yaml` shape and the same `.bmad/sla.yaml` shape.

## Traceability chain

Every finding row is written to the standardized report **and** to a findings cache at `.bmad/cache/code-review-<hash>.json`, consumed by downstream agents via the shared [findings-cache](./findings-cache) contract — Impact Analysis can trace a `REV-<n>` breaking-change row to impacted consumers, Test Coverage can re-check the changed-files coverage the checklist flagged as missing, Release can gate the deploy plan on unresolved dependency-review flags.

**Downstream note (future enhancement).** Audit's next scheduled run does not currently cross-reference what Code Review already flagged on the merged PR — that de-duplication (avoiding the same finding surfacing twice, once pre-merge and once post-merge) is a planned enhancement on top of the shared findings cache, not yet implemented.

## Output artifacts

Every code-review run writes into `<project>/code-review-reports/` (override with `--output`):

- `code-review-<branch>-<timestamp>-agent-report.xlsx` — the standardized workbook.
- `code-review-<branch>-<timestamp>-agent-report.md` — the Markdown twin.
- `REVIEW-COMMENTS.md` (or `.json` for github/gitlab format) — inline PR review comments.
- `STYLE-CHECKLIST.md` — style-guide compliance report.
- `BREAKING-CHANGES.md` — breaking-change detector output.
- `DEPENDENCY-REVIEW.md` — dependency-change risk assessment.
- `DESIGN-PATTERNS.md` — design-pattern violation report.
- `PR-CHECKLIST.md` — role-adapted pre-merge checklist.
- `CODE-REVIEW-INDEX.md` — always emitted; manifest of inputs → artifacts.
- One `CHANGE-LOG.md` entry spliced into project root.

`--format both` is currently **stubbed** — it logs a warning on stderr and falls back to markdown. The docx writer lands in a later phase.

## Review-turnaround gate integration

The [Findings Gate](./findings-gate) applies to review comments directly:

| Decision status | Effect on the review finding |
|-----------------|---------------------------------|
| `accepted` | Approved as-is — e.g. a style deviation the team has consciously accepted, a dependency bump that's been manually vetted. |
| `deferred` | Fix in a follow-up PR — moves to the SLA sheet with a `next-review` date; e.g. a design-pattern violation that's real but not worth blocking this PR for. |
| `wontfix` | Intentional, won't change — e.g. a breaking change that's deliberate and already communicated via a changelog entry. |

Combine this with the **review-turnaround SLA per role** (see [SLA Tracking](./sla-tracking)): how long a PR can sit with unaddressed CRITICAL/HIGH review comments before it becomes `OVERDUE`. Default thresholds — `tl`/`security` 4 hours for CRITICAL; `devops`/`de`/`qa`/`ea` 1 day; `pm` 1 day. `--fail-on-overdue` exits with code 6 when any review finding has sat past its role SLA — wire this into CI to fail the merge gate.

## See also

- [Code Review agent](../agents/code-review) — the per-agent reference (flags, modes, CLI, per-stack notes).
- [Code Review prompts catalog](../reference/prompts/code-review) — 90+ copy-paste prompts across stacks, roles, and artifact types.
- [Role adaptation](./role-adaptation) — how default review-depth + emphasis + follow-up change per role.
- [Findings cache](./findings-cache) — how Code Review output feeds downstream agents.
- [One-shot mode](./one-shot-mode) — full precedence rules for silent end-to-end execution.
- [Findings gate](./findings-gate) — accept / defer / wontfix per review finding.
- [SLA tracking](./sla-tracking) — review-turnaround SLA per role.
- [Audit agent](../agents/audit) — post-merge exhaustive scan; complementary, not redundant.
- [Test Coverage agent](../agents/test-coverage) — test-gap chaining from the checklist.
- [Architecture agent](../agents/architecture) — ADR/LLD-drift chaining, primary for the `ea` role.
- [Requirements agent](../agents/requirements) — AC-traceability chaining, primary for the `ba` role.
