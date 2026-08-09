---
id: role-adaptation
title: Role Adaptation
sidebar_position: 4
description: Ten roles tune every agent's default mode, output flavor, and recommended follow-up — from EA (executive MD) to DevOps (SARIF).
---

Every one of the nine agents adapts its default mode, output shape, and recommended follow-ups to the **role** of the person driving the run. Role handling is a shared foundation (`skills/shared/role/`) consumed by every agent, and it is entirely opt-out (set `role: generic` to disable).

## Why roles

Different consumers of these agents need different output shapes and different default modes. An Enterprise Architect wants a top-N executive Markdown; a Delivery Engineer wants a Jira-ready CSV they can paste straight into a sprint; a DevOps engineer wants SARIF for GitHub code-scanning. Role gating lets one plugin serve an EA, a Security Engineer, and a Delivery Engineer without confusing anyone — each sees the plugin tuned to what they actually do.

## The 10 roles

Canonical source: [`skills/shared/role/ROLES.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/shared/role/ROLES.md). Six are **promoted** (surfaced first in the interactive picker); four are **additional** (behind a "More roles" affordance). `generic` is the fallback.

| Code | Name | Promoted? | Priority agents | Default output flavor | One-line description |
|------|------|:---------:|-----------------|-----------------------|----------------------|
| `ea` | Enterprise Architect | yes | audit, sonar-scan, impact-analysis | `executive` | Owns cross-cutting architecture across Adobe/JVM estates; needs portfolio-level health, risk, and modernization signals over per-file detail. |
| `tl` | Tech Lead / Solution Architect | yes | audit, generation, impact-analysis | `technical` | Leads a delivery team on a specific solution; needs component-level design review, generation scaffolds, and impact blast-radius for changes. |
| `de` | Senior Delivery Engineer | yes | generation, test-coverage, audit | `jira-csv` | Ships stories on a sprint cadence; needs generated scaffolds, test coverage gaps, and audit findings shaped as Jira-ready tickets. |
| `qa` | QA / SDET | yes | test-coverage, impact-analysis, audit | `technical` | Owns test strategy and coverage; needs coverage gaps, impact-driven regression scope, and audit findings that map to test surfaces. |
| `devops` | DevOps / SRE | yes | sonar-scan, generation, audit | `sarif` | Runs pipelines and production; needs SARIF-shaped scan output that plugs into CI gates and generated infra/pipeline scaffolds. |
| `security` | Security Engineer | yes | sonar-scan, audit | `technical` | Owns AppSec posture across the estate; needs deep sonar-scan and audit output focused on vulnerability classes and remediation guidance. |
| `pm` | Product Manager / PMO | no | audit, impact-analysis | `executive` | Owns roadmap and delivery risk; needs executive-shape audit and impact output framed as scope, effort, and portfolio risk. |
| `ba` | Business Analyst | no | impact-analysis | `executive` | Bridges business intent and system behavior; needs impact-analysis output that reads as feature/flow-level change summaries. |
| `migration` | Migration / Upgrade Lead | no | audit, impact-analysis, test-coverage | `technical` | Drives platform upgrades and re-platforming; needs audit baselines, impact of upgrade paths, and coverage of legacy surfaces. |
| `content` | Content / CMS Engineer | no | generation, audit | `technical` | Builds and maintains AEM/EDS content surfaces; needs component/block generation scaffolds and audit findings scoped to content code. |
| `generic` | Generic (fallback) | n/a | — | `default` | No role selected — used as fallback when `.bmad/role.yaml` is absent and no `--role` flag was passed. |

## How to set / change

Four ways, in resolution-priority order (highest wins for a given run):

1. **`--role=<code>` CLI flag** — per-run only; does NOT overwrite `.bmad/role.yaml`.
    ```bash
    npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
      --path . --role=security
    ```
2. **Prefix a chat prompt** — *"as `<role>`, ..."*, e.g. *"as security, audit my project"*. Per-run only.
3. **`.bmad/role.yaml`** — persisted; every subsequent run reads it silently.
    ```yaml title=".bmad/role.yaml"
    # BMAD DCA — role selection
    role: ea                        # one of: ea, tl, de, qa, devops, security, pm, ba, migration, content
    set_at: 2026-08-06T02:53:00Z    # ISO-8601 UTC
    set_by: interactive             # interactive | --role-flag | config
    notes: |
      Optional free-text notes about the role choice.
    ```

:::info Role persistence lives in `.bmad/role.yaml`
The file is committed to the project (or gitignored, per your policy) — it does NOT live in your home directory. That's deliberate: different projects can have different default roles, and swapping projects swaps role gating automatically.
:::
4. **Install-time default** — `--set dca.default_role=<code>` on `npx bmad-method install` skips the first-activation picker.

### Interactive picker

The first time you invoke any agent (unless `default_role` was set at install), the AI performs a **role handshake** — asks *"Which role best matches how you'll use this plugin?"*, lists the 6 promoted roles first, then the 4 additional roles, then `generic`. Your choice is saved to `.bmad/role.yaml`.

### Changing later

- **From chat** — *"switch role to `<code>`"*. The agent rewrites `.bmad/role.yaml`.
- **By hand** — edit the YAML.
- **Reset** — delete `.bmad/role.yaml`; next run drops back to the picker.

### Runtime signals

The resolved role is exposed to child engines via `process.env.DCA_ROLE` (and `DCA_ROLE_NAME`, `DCA_ROLE_FLAVOR`, `DCA_ROLE_SOURCE`), and a one-line banner is printed to stderr on every run so you always know which role the agent picked up:

```text
[dca-role] Enterprise Architect (source: role-file)
```

Sources: `cli-flag` · `role-file` · `generic-fallback`.

## The 3 adaptation axes

Once the resolved role is known, every agent adapts along three axes:

1. **Default mode when the trigger is ambiguous** — e.g. Audit's default (Scan Only / Full Audit / Deep Audit) shifts by role; Test Coverage's default (`analyze` / `generate` / `full`) shifts by role; Impact Analysis's consent-picker default (*"what's connected"* vs *"what could break"*) shifts by role.
2. **Output flavor** — a role-specific *extra* artifact written into the report directory alongside the standard XLSX + Markdown twin.
3. **Recommended follow-up** — the next agent (and next prompt) the AI offers at the end of the run.

## The 5 output flavors

| Flavor | What it produces |
|--------|------------------|
| `executive` | Markdown-first deliverable: top-N findings, business-impact framing, no rule IDs; the XLSX is supplementary. |
| `technical` | The current default look — the standard XLSX plus its Markdown twin. |
| `jira-csv` | A companion CSV next to the XLSX where each row is a Jira import row (Summary, Description, Priority, Labels, Component). |
| `sarif` | A `.sarif` file suitable for GitHub code-scanning upload alongside the XLSX. |
| `default` | Today's behavior with no role-specific shaping (used for `generic`). |

:::info Flavor generation is AI-post-processed today
The deterministic pipeline always emits the standard XLSX + Markdown twin regardless of role. Role-specific extras (Jira CSV, SARIF, executive MD) are written by the AI, post-run, into the same report directory. The run never blocks because a flavor generator is not wired into the deterministic pipeline.
:::

## Role × Agent behavior matrix

One short phrase per cell. Grounded in each agent's `SKILL.md` "Role-aware behavior" section. For the deep detail (default mode, output emphasis, exact follow-up prompt), see the agent's own `SKILL.md`.

| Role | Audit | Sonar Scan | Code Generation | Impact Analysis | Test Coverage |
|------|-------|------------|-----------------|-----------------|---------------|
| `ea` | Deep Audit, architecture-focused → executive MD | All 6 pillars + Maintainability trend | Scaffold with house conventions enforced | Dependency-map lens ("what's connected") + module ownership heatmap | `full` + coverage-by-module heatmap |
| `tl` | Deep Audit (full) → technical XLSX | All 6 pillars → technical | Standard scaffold; offer LLM/MCP for uncovered types | Breakage lens ("what could break") + design impact section | `full` → technical |
| `de` | Scan Only → Jira-ready CSV + XLSX | Jira-ready CSV alongside XLSX | Scaffold + matching test stub + Jira-ready CSV row per file | Jira-ready CSV of impacted files with risk-mapped priority | Jira-ranked backlog CSV with S/M/L effort |
| `qa` | Full Audit → technical XLSX | All 6 pillars, Reliability + Bugs emphasis | Test files only + coverage checklist | Regression test plan section per impacted file | `full` + mutation hints + MFTF/API stubs |
| `devops` | Scan Only → SARIF + XLSX | SARIF export + Quality Gate → CI exit code | IaC / pipeline / dispatcher scaffolds preferred | Deploy-risk score + change-freeze recommendation | `analyze` only + coverage-gate PASS/FAIL for CI |
| `security` | Full Audit, Vulnerability/Hotspot rows highlighted, CWE/OWASP tags | All 6 pillars; Vulnerabilities sheet first + CWE/OWASP tags | Security-hardened defaults + "Security decisions" section | Threat surface impact per file (auth/crypto/input/secrets/network) | `analyze` + security-critical files, cross-ref audit Security findings |
| `pm` | Scan Only → executive MD, top-10 | Executive MD: Quality Gate + top-10 vulns in business language | Not primary — generic behavior | Executive MD: top-10 modules + effort matrix + timeline buckets | `analyze` only + executive MD |
| `ba` | Scan Only → executive MD | Standard scan (not primary) | Not primary — generic behavior | BRD requirement coverage section + traceability | `analyze` only (not primary) |
| `migration` | Full Audit + patch/platform-upgrade rules + deprecated-API section | All 6 pillars + Deprecated section | Migration / patch artifacts (Commerce setup patches, AEM install hooks) | BOTH passes + migration blast radius (deprecated APIs, rollback candidates) | `full` + migration coverage delta |
| `content` | Scan Only on content-related rule packs | Standard scan | Prefer content-fragment / editable-template / EDS-block scaffolders | Standard, filtered to content-model files | `analyze` on content files only |
| `generic` | Full Audit (current default) | Standard scan | Standard scaffold | Ask user which pass | Ask user which mode |

## Skipping role adaptation

If a team doesn't want role gating at all:

- **Recommended** — set `role: generic` in `.bmad/role.yaml` once. The interactive picker never fires; every run uses standard defaults.
- **Per-run** — pass `--role=generic` on every `run.ts` invocation.

The `generic` role's default output flavor is `default` (the standard XLSX + Markdown twin with no role-specific shaping), and its priority-agent list is empty, so no agent will nudge you toward a specific follow-up.

## Next

- [Interactive vs Technical](interactive-vs-technical) — the other big first-run persisted preference.
- [Standardized Outputs](standardized-outputs) — the base shape that every flavor layers on top of.
