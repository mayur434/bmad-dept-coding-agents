---
id: code-review
title: Code Review — Prompts
sidebar_position: 10
description: Copy-paste prompts for the Code Review agent — PR/diff review, style checks, breaking-change detection, dependency review, design patterns, checklists across 8 Adobe/JVM stacks.
keywords:
  - code review prompts
  - pr review prompts
  - style check prompts
  - breaking change prompts
  - dependency review prompts
  - design pattern prompts
---

Copy-paste prompts for the **Code Review agent** (`bmad-dept-code-review-agent`). Send a whole block or a single line — the agent parses natural language and resolves flags, diff scope, stack, and role automatically.

**Modes:** `full-review` = all six artifacts in one run (`--artifacts all`, default). `individual-artifact` = narrow to one artifact (`--artifacts review` / `style-check` / `breaking-changes` / `dependency-review` / `design-patterns` / `checklist`).

Related: [Code Review agent](../../agents/code-review) · [Pre-Merge Review concept](../../concepts/pre-merge-review) · [CLI Flags](../cli-flags) · [Role adaptation](../../concepts/role-adaptation).

---

## Quick starters

Send one of these first — the agent auto-detects the diff scope, stack, and role, and asks a single question only if a required input is truly missing.

```text
review this PR
review my uncommitted changes
deep review with design patterns
breaking changes in this diff
dependency review for this PR
pre-merge checklist
full pre-merge review, GitHub comment format
is this PR ready to merge
```

---

## PR / diff reviews

Per-stack full-review prompts — grounded in `resources/review-templates/<stack>.md`.

### AEM

```text
review this AEM component PR for HTL context issues
deep review of this Sling Model diff
```

### Adobe Commerce (PaaS)

```text
review this plugin diff for sort_order conflicts
review this di.xml change for missing preference scope
```

### Adobe Commerce SaaS

```text
review this drop-in bundle bump for Catalog Service compatibility
review this Live Search index config diff
```

### Sling / Shaft

```text
review this OSGi bundle diff for install-order issues
review this Feature Model composition change
```

### Spring Boot

```text
review this Spring controller diff for missing @Valid
review this @Transactional boundary change
```

### Adobe App Builder

```text
review this action deploy diff for workspace scoping
review this API Mesh resolver change
```

### Edge Delivery Services (EDS)

```text
review this new block for missing lazy-load wiring
review this decorate() diff for module-level side effects
```

### EDS + Commerce

```text
review this PDP drop-in bump diff
review this block change for coordinated drop-in version sync
```

---

## Style checks

```text
style-check against our custom guide at ./docs/style.md
style-check this diff, quick depth
style-check my uncommitted changes
style-check this PR against the built-in AEM guide
lint-level check only, no dependency or pattern reasoning
```

---

## Breaking-change detection

Per-stack breaking-change prompts — grounded in `resources/review-templates/<stack>.md`.

### AEM

```text
breaking changes in this AEM Sling Model interface change
```

### Adobe Commerce (PaaS)

```text
breaking changes in this Commerce plugin removal
```

### Adobe Commerce SaaS

```text
breaking changes in this Storefront Events schema version bump
```

### Sling / Shaft

```text
breaking changes in this OSGi bundle API removal
```

### Spring Boot

```text
breaking changes in this @RequestMapping path removal
```

### Adobe App Builder

```text
breaking changes in this API Mesh resolver contract change
```

### Edge Delivery Services (EDS)

```text
breaking changes in this head.html / paths.json diff
```

### EDS + Commerce

```text
breaking changes in this drop-in version downgrade
```

---

## Dependency reviews

```text
dependency review for this composer.json change
dependency review — flag any license issues
dependency review for this package.json diff, quick summary
dependency review for this pom.xml version bump
dependency review — any known CVEs in the new transitive deps?
```

---

## Design-pattern checks

Per-stack design-pattern prompts — grounded in `resources/pattern-libraries/<stack>.md`.

### AEM

```text
design-pattern check on this AEM component — God Sling Model risk?
```

### Adobe Commerce (PaaS)

```text
design-pattern check on this plugin diff — anti-pattern risk?
```

### Adobe Commerce SaaS

```text
design-pattern check on this drop-in integration diff
```

### Sling / Shaft
```text
design-pattern check on this OSGi service diff
```

### Spring Boot

```text
design-pattern check on this Spring service diff
```

### Adobe App Builder

```text
design-pattern check on this App Builder action diff
```

### Edge Delivery Services (EDS)

```text
design-pattern check on this block — lifecycle violation risk?
```

### EDS + Commerce

```text
design-pattern check on this hybrid block/drop-in diff
```

---

## Checklists

```text
pre-merge checklist as security
pre-merge checklist as QA — focus on test coverage
pre-merge checklist as PM — business-risk framing
pre-merge checklist as tech lead — design-pattern + breaking-change focus
pre-merge checklist for this PR, GitHub comment format
```

---

## Chained SDLC passes

```text
chain: code-review → audit (post-merge deep scan)
code-review → test-coverage (does this diff need tests)
architecture → code-review (does this diff match the LLD)
requirements → code-review (does this diff satisfy the AC)
code-review → impact-analysis (trace the breaking-change blast radius)
```

---

## Role-flavored requests

Prefix any prompt with `"as <role>, ..."` for a per-run role override (no write to `.bmad/role.yaml`):

```text
as security, deep review with dependency-review priority
as devops, review with GitHub comment format for CI
as TL, design-pattern + breaking-change focus, deep depth
as de, quick style-check and checklist only
as qa, review with test-coverage presence emphasis
as migration lead, breaking-change detection as primary concern
as ba, checklist cross-referenced against the BRD
as ea, portfolio-level pattern-consistency check
```

---

## Enterprise gate patterns

Mark review comments accepted / deferred / wontfix so subsequent runs stop resurfacing them. See [Findings Gate](../../concepts/findings-gate) for the YAML shape.

```text
list decisions
mark REV-12 accepted — dependency bump manually vetted
mark REV-7 deferred — fix in a follow-up PR
mark REV-3 wontfix — breaking change already in the changelog
review --fail-on-severity critical                # CI gate: exit 7 on any CRITICAL finding
review --fail-on-overdue                           # CI gate: exit 6 if a review-turnaround SLA is OVERDUE
```

---

## Troubleshooting

```text
no diff found — how do I specify one?
style-guide path not found — where does it resolve from?
comment-format doesn't match my platform — how do I switch to gitlab?
deep review is too slow — how do I fall back to standard?
--fail-on-severity is blocking CI unexpectedly — why?
```

---

## Follow-up prompts

Reusable after any Code Review run:

```text
summarize the CRITICAL review comments
which files in this PR have the most design-pattern violations?
generate a Jira ticket per unresolved breaking change
which review comments are OVERDUE per SLA?
which decisions are already accepted for this PR?
hand the breaking-change list to Impact Analysis for a consumer trace
schedule a deep post-merge Audit scan on the merged result
does this diff need new tests — hand off to Test Coverage
```
