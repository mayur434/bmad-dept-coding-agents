---
id: sla-tracking
title: SLA Tracking
sidebar_position: 9
description: Every finding gets an age vs role x severity SLA. Overdue findings highlighted; --fail-on-overdue gates CI.
keywords:
  - sla
  - service level agreement
  - overdue findings
  - ci gate
  - role-based sla
---

Every finding surfaced by any DCA agent is aged against a **role x severity SLA**. The result is stamped into a dedicated **SLA Status** sheet in every standardized workbook, with green / amber / red styling by band, and — for CI — a `--fail-on-overdue` flag that returns **exit code 6** when any surviving finding is overdue.

Zero external dependencies. All logic lives under `skills/shared/sla/`, exercised by the smoke at `skills/shared/sla/smoke.ts`.

## Why role x severity

An SLA that treats every finding the same is a policy no one can follow. Two axes drive the defaults:

- **Severity** — CRITICAL vs HIGH vs MEDIUM vs LOW vs INFO. Time-to-remediate should compress as severity climbs.
- **Role** — the same CRITICAL means very different things to Security (24h), DevOps (48h), and EA (1w). The role-owner is the decision maker, so the SLA follows their calendar.

The result: the same finding, viewed by two roles, is aged against two different clocks — and both are documented in the workbook.

## Default SLAs

Source of truth: `skills/shared/sla/defaults.ts`. All values are per-role, per-severity durations.

| Role | CRITICAL | HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|---|---|
| **security** | 24h | 3d | 1w | 30d | 90d |
| **devops** | 2d | 5d | 2w | 30d | 90d |
| **qa** | 3d | 1w | 2w | 30d | 90d |
| **ea** | 1w | 30d | 60d | 90d | 180d |
| **tl** | 2d | 1w | 2w | 30d | 90d |
| **de** | 2d | 5d | 2w | 30d | 90d |
| **pm** | 1w | 2w | 30d | 60d | 180d |
| **ba** | 1w | 2w | 30d | 60d | 180d |
| **migration** | 24h | 3d | 1w | 2w | 30d |
| **content** | 3d | 1w | 2w | 30d | 90d |
| **generic** | 3d | 1w | 2w | 30d | 90d |

Grounded in industry norms (Security CRITICAL ~24h, HIGH ~3d) and biased to be tight rather than lenient — you can always relax via override, but a too-loose default hides risk.

## Overrides — `.bmad/sla.yaml`

Any subset of the defaults can be overridden per role and, optionally, per agent. The file lives at `<projectRoot>/.bmad/sla.yaml`.

```yaml title=".bmad/sla.yaml"
# BMAD DCA — Service Level Agreements per role and severity
version: 1
overrides:
  - role: security
    slas:
      CRITICAL: 12h      # tighter than the 24h default
      HIGH: 48h
  - role: ea
    slas:
      CRITICAL: 5d       # looser than the 1w default
per_agent_overrides:
  sonar-scan:
    CRITICAL: 24h
    HIGH: 48h
    MEDIUM: 1w
    LOW: 30d
    INFO: 90d
```

Precedence — first match wins:

1. **`per_agent_overrides.<agent>.<severity>`** — per-agent override for the current agent + severity.
2. **`overrides[role=<role>].slas.<severity>`** — per-role override.
3. **`DEFAULT_SLAS[<role>][<severity>]`** — hard-coded default.
4. **`DEFAULT_SLAS.generic[<severity>]`** — fallback when role is unknown.

Duration syntax: `12h`, `24h`, `2d`, `1w`, `30d`, `60d`, `90d`, `1mo`, `1y`. Whitespace between number and unit is optional. Malformed values fall back to the default and print a stderr WARN — they never crash the run.

## How age is computed

Age = **run time** minus **firstSeen**. `firstSeen` comes from the per-agent findings cache (`.bmad/cache/<agent>-*.json`), keyed by finding identity (`rule_id + file + line + snippet-hash`). Semantics:

- **First run against a project** — every finding is 0h old; nothing is overdue yet.
- **Subsequent runs** — findings that persist inherit their previous `firstSeen`; new findings start at 0h; fixed findings drop out.
- **Missing cache** — age is `unknown`; the SLA row still renders but the status band is `unknown` rather than `overdue`.

The tracker (`skills/shared/sla/tracker.ts`) is pure: given a findings array and a resolved SLA matrix, it returns rows with `{ id, severity, ageHours, slaHours, status, remainingHours }`.

## Status bands

| Band | Condition | Excel style |
|---|---|---|
| **ok** | age is below 70% of the SLA | green |
| **due-soon** | age is at 70% or above but below 100% | amber |
| **overdue** | age is at or beyond 100% of the SLA | red |
| **unknown** | no `firstSeen` in cache | grey |

The SLA Status sheet is added to every standardized XLSX via the `extraSheets` extension seam in `skills/shared/report/standard-report.ts`. Columns: `Finding ID`, `Severity`, `Rule ID`, `File`, `Line`, `First Seen`, `Age`, `SLA`, `Status`, `Remaining`.

## CLI flags

Every agent exposes the same three SLA flags:

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `--sla-path <path>` | string | `<projectRoot>/.bmad/sla.yaml` | Override the SLA file (e.g. team-shared config under source control). |
| `--no-sla` | bool | false | Skip SLA computation entirely — no SLA Status sheet is emitted. |
| `--fail-on-overdue` | bool | false | Exit with code **6** if any surviving finding is overdue per the resolved SLA. |

## CI gate — `--fail-on-overdue`

The `--fail-on-overdue` flag is designed for pipeline enforcement. It runs after the findings gate ([`decisions.yaml`](./findings-gate) suppression), so decisions already applied are not re-counted. Exit code semantics:

- `0` — success, no overdue findings.
- `1` — normal error (crash / bad flag / missing input).
- `2` — dependency issue (see `--no-install`).
- `6` — one or more surviving findings are overdue per the SLA gate.

Example CI step:

```yaml title=".github/workflows/nightly-audit.yml"
- name: DCA audit with SLA gate
  run: |
    npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
      --path . --role security \
      --fail-on-overdue --no-preflight --yes-install
```

If a CRITICAL Security finding sits at 25h without a signed decision in `.bmad/decisions.yaml`, the pipeline turns red.

## Per-agent SLA context

- **Audit** — SLA rows appear for every deterministic and LLM-driven finding. Default role SLA governs unless a `per_agent_overrides.audit` block is set.
- **Sonar Scan** — SLA rows appear for every non-fatal Sonar finding after the Quality Gate emits. The Quality Gate itself is independent — a green Quality Gate can still have overdue MEDIUM items.
- **Impact Analysis** — SLA is computed on the linked findings from the audit cache, not on impact rows themselves.
- **Test Coverage** — SLA is computed on coverage gaps promoted to findings when a linked audit cache exists.
- **Code Generation** — SLA rows are computed on any Preflight findings that survive filtering, so scaffolds don't ship over unpatched CRITICALs.

## See also

- [Findings Gate](./findings-gate) — decisions run **before** the SLA gate; a suppressed finding is not aged.
- [Audit](../agents/audit) / [Sonar Scan](../agents/sonar-scan) / [Impact Analysis](../agents/impact-analysis) / [Test Coverage](../agents/test-coverage) / [Code Generation](../agents/code-generation) — every agent emits the SLA Status sheet.
- [CLI Flags → Enterprise Phase 1](../reference/cli-flags#enterprise-phase-1--findings-gate--sla) — the flag table.
- [Role Adaptation](./role-adaptation) — role selection drives which SLA row applies.
