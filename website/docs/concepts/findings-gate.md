---
id: findings-gate
title: Findings Gate
sidebar_position: 8
description: Suppress accepted/deferred/wontfix findings via .bmad/decisions.yaml so gates stay green while approved risk is tracked separately.
keywords:
  - findings gate
  - decisions.yaml
  - approval workflow
  - audit trail
  - wontfix
---

The **findings gate** is a suppression layer every DCA agent applies to its finished findings before the standardized workbook and Markdown twin are emitted. Findings that a signed reviewer has already **accepted**, **deferred**, or marked **wontfix** never surface again — unless their decision expires, or unless the operator explicitly bypasses the gate.

The gate is grounded in a single per-project file: **`<projectRoot>/.bmad/decisions.yaml`**, written and read by `skills/shared/decisions/`. Zero external dependencies, hand-rolled YAML parser scoped to this schema.

## Why a findings gate

Two enterprise realities force the shape of this feature:

1. **Governance / auditor trail.** Compliance auditors want to see *why* a CRITICAL SQL-injection finding is not on the sprint board — not just that it is missing. `decisions.yaml` carries the rationale, signer, timestamp, and optional expiry inline with the code, so the answer is one grep away.
2. **CI gate noise.** Once a team has decided a finding is out of scope for this quarter, re-surfacing it every nightly run poisons the signal-to-noise ratio and trains reviewers to ignore the report. The gate suppresses that noise **without erasing the decision**.

The gate is opt-in per project: if `.bmad/decisions.yaml` is absent, every finding flows through untouched.

## File schema

```yaml title=".bmad/decisions.yaml"
# BMAD DCA — findings decisions
version: 1
last_modified: 2026-08-06T12:00:00Z
decisions:
  - id: dec-abc123
    rule_id: COMMERCE-SEC-001
    file: app/code/Vendor/Module/Model/Foo.php
    line: 42
    status: accepted            # accepted | deferred | wontfix
    rationale: |
      Legacy code from acquired product.
      Refactor scheduled for Q1 2027.
    signed_by: architect@company.com
    signed_at: 2026-08-06T12:00:00Z
    expires_at: 2027-01-31T23:59:59Z
    tags: [q4-release, tech-debt]

  - id: dec-def456
    rule_id: AEM-PERF-042
    file: ui.frontend/src/main/webpack/site/main.js
    # no line — matches any line hit by this rule in this file
    status: deferred
    rationale: Investigating in APP-1234.
    signed_by: tl@company.com
    signed_at: 2026-08-01T09:00:00Z
    expires_at: 2026-09-01T00:00:00Z

  - id: dec-ghi789
    rule_id: SEC-XSS-BASE-001
    # no file, no line — matches every finding of this rule anywhere
    status: wontfix
    rationale: |
      False positive class in our CSP-strict app;
      the rule flags string-concatenation into innerHTML
      but we compile via lit-html templating.
    signed_by: security@company.com
    signed_at: 2026-07-15T00:00:00Z
```

Fields:

- **`id`** — free-form; useful for cross-referencing from tickets / PRs.
- **`rule_id`** — the rule id the finding was raised under (matches finding `Rule ID`).
- **`file`** — optional; project-relative path.
- **`line`** — optional; only meaningful when `file` is present.
- **`status`** — one of `accepted`, `deferred`, `wontfix`.
- **`rationale`** — free-form; carried into the audit trail.
- **`signed_by` / `signed_at`** — mandatory for enterprise compliance; the tool does not validate signer identity, but auditors will.
- **`expires_at`** — optional ISO-8601 timestamp. When present and past, the decision is **expired** — the finding resurfaces on the next run.
- **`tags`** — optional list.

## Matching rules

For a decision to suppress a finding, they match in this specificity order (first match wins):

1. **`rule_id + file + line`** — exact tuple match. Most specific.
2. **`rule_id + file`** — decision has `rule_id + file` but no `line`; matches every finding of that rule in that file.
3. **`rule_id`** only — decision has neither `file` nor `line`; matches every finding of that rule anywhere.

The matcher lives in `skills/shared/decisions/matcher.ts`; both the exported `filterFindingsByDecisions()` and the internal specificity ranker are unit-tested by the smoke at `skills/shared/decisions/smoke.ts`.

## Expiry behavior

A decision with `expires_at` in the past is **still parsed and still visible via `--list-decisions`**, but by default it **no longer suppresses** its matched findings. The finding resurfaces in the report with its normal severity, so the team is reminded to renew the decision or fix the code.

Two escape hatches:

- **`--ignore-decision-expiry`** — treat expired decisions as still active for this run. Useful for "we're about to re-sign, one more nightly run please" moments.
- Simply update the decision's `expires_at` in `decisions.yaml` and re-run.

## CLI flags

Every agent exposes the same four flags:

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `--include-decided` | bool | false | Bypass the gate — show findings that have decisions, so a reviewer can audit what would otherwise be suppressed. |
| `--decisions-path <path>` | string | `<projectRoot>/.bmad/decisions.yaml` | Override the decisions file (e.g. team-shared file under source control). |
| `--ignore-decision-expiry` | bool | false | Treat expired decisions as still active. |
| `--list-decisions` | bool | false | Print all decisions parsed from the file and exit. Does not scan. |

## Worked example — decide-once, run-many-times

**Scenario:** A quarterly Security audit surfaces 84 items. After review, 12 are legitimate quarter-1 fixes; 44 are legacy code the migration team already scoped for Q2; 28 are false-positive class hits the CSP-strict frontend architecture is immune to.

Step 1 — capture the decisions once, signed by the security lead:

```yaml title=".bmad/decisions.yaml"
version: 1
decisions:
  # 44 legacy items → deferred to Q2 migration project
  - id: dec-q2-migration-batch
    rule_id: COMMERCE-SEC-001
    file: app/code/Legacy/PaymentModel.php
    status: deferred
    rationale: In scope for MIG-Q2-2026 tracker.
    signed_by: security@acme.com
    signed_at: 2026-08-01T00:00:00Z
    expires_at: 2026-11-01T00:00:00Z

  # 28 false-positive rule class → wontfix
  - id: dec-csp-strict-fp
    rule_id: SEC-XSS-BASE-001
    status: wontfix
    rationale: CSP-strict + lit-html templating makes this rule class inapplicable.
    signed_by: security@acme.com
    signed_at: 2026-08-01T00:00:00Z
```

Step 2 — every subsequent nightly / CI run reports only the 12 legitimate items:

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --path . --role security --technical --fail-on-overdue
# stderr:
# [dca-decisions] suppressed 72 finding(s) via .bmad/decisions.yaml
#   (accepted=0, deferred=44, wontfix=28, expired-still-suppressed=0)
```

Step 3 — before the Q2 milestone, review what is being hidden:

```bash
npx ts-node .../run.ts --path . --list-decisions
# prints each decision with signer + expiry + tags
```

Step 4 — one-off "show me everything, ignore the gate" run for the auditor:

```bash
npx ts-node .../run.ts --path . --include-decided --technical
```

:::note Globbing
The matcher does not currently glob `rule_id` or `file` — an exact-match design keeps the audit trail unambiguous. To cover a batch of related rules, add one decision per rule id. Wildcard support is on the roadmap; grep the shared module to confirm current behavior.
:::

## Interaction with the audit trail

Every suppressed item is counted in the stderr summary line printed by each agent — the count is broken out by status (`accepted`, `deferred`, `wontfix`, `expired-still-suppressed`). The counts appear in the `.bmad/cache/<agent>-*.json` snapshot for downstream tooling. Nothing about the decisions file is edited by the agent — writers must be explicit humans or an external workflow (e.g. a GitHub Action that appends after a signed approval).

## See also

- [Audit](../agents/audit) — the primary consumer; every audit run applies the gate.
- [Sonar Scan](../agents/sonar-scan) — same gate on Sonar findings before the Quality Gate emits.
- [CLI Flags → Enterprise Phase 1](../reference/cli-flags#enterprise-phase-1--findings-gate--sla) — the flag table.
- [SLA Tracking](./sla-tracking) — the companion enterprise feature; unsuppressed items then flow through the SLA sheet.
