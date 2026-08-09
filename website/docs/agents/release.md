---
id: release
title: Release
sidebar_position: 8
description: Author CI/CD pipelines, release notes from commit history, deploy plans, rollback plans, env-diffs, and stakeholder announcements — grounded in per-stack Adobe/JVM deploy idioms across all 8 supported stacks.
keywords:
  - release
  - deploy
  - ci/cd
  - pipeline
  - release notes
  - rollback
  - env diff
  - canary
  - blue-green
  - cloud manager
  - github actions
  - gitlab ci
  - changelog
---

## Purpose

The **Release & Deployment Specialist** (🚀) turns a set of merged changes into a shippable release across the same 8 stacks as the rest of the DCA suite. It authors **CI/CD pipelines** (Cloud Manager, GitHub Actions, GitLab CI, CircleCI, Jenkins, Azure DevOps), **release notes from commit history**, **deploy plans phased against a rollout strategy**, **rollback playbooks**, **env-diff reports**, and **multi-channel stakeholder announcements** — grounded in per-stack Adobe/JVM deploy idioms. It is the **eighth agent** of the suite and closes **SDLC phase 5 (Deploy/Release)**, downstream of Requirements (phase 1), Architecture (phase 2), and the existing five analysis / generation agents (phases 3–4).

:::note Release is a release-authoring specialist, not a release executor
It does not run `kubectl apply`, trigger a Cloud Manager pipeline, or post to Slack — the authored `pipeline.yml` is a file your CI/CD platform executes; the authored `ANNOUNCEMENT.md` is a Markdown file with per-channel headings you paste. See the [Constraints / non-goals](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/SKILL.md#constraints--non-goals) section in the source SKILL for the full boundary.
:::

## When to use

- **Pre-release documentation kickoff** — one command produces the full release pack (pipeline + notes + deploy + rollback + env-diff + announcement) so review, sign-off, and go-live all trace to one set of artifacts.
- **New-project pipeline generation** — a first pipeline for a repo that has none, auto-detected to the right platform (or forced with `--pipeline`) with the DCA quality gates (audit + sonar-scan + coverage) wired in.
- **Release-day communications** — release notes grouped by Conventional Commit type + a per-channel announcement (email + Slack + Confluence + short-form) ready to paste.
- **Rollback drill prep** — a playbook with named triggers, decision matrix, and numbered steps so on-call practices the rollback before they need it.
- **Env-config drift audit** — env-diff between two environments to surface config / env-var / feature-flag / secret / infrastructure deltas before a promotion.

## What it produces

Every release run emits the standardized DCA outputs into `<project>/release-reports/` (override with `--output`):

| Artifact | Where | Notes |
|----------|-------|-------|
| `release-<branch>-<timestamp>-agent-report.xlsx` | `release-reports/` | Standardized 15-column Summary contract; one row per pipeline stage / release-note entry / deploy-plan step / rollback-plan step / env-diff row / announcement channel, keyed as `REL-<n>`. |
| `release-<branch>-<timestamp>-agent-report.md` | `release-reports/` | Git-diffable Markdown twin. |
| `pipeline.yml` / `pipeline.groovy` | `release-reports/` | CI/CD workflow for the resolved `--pipeline` target. |
| `RELEASE_NOTES.md` | `release-reports/` | Release notes from git history between `--from-ref` and `--to-ref`. |
| `DEPLOY_PLAN.md` | `release-reports/` | Deploy plan phased against the resolved `--rollout` strategy. |
| `ROLLBACK_PLAN.md` | `release-reports/` | Rollback playbook — triggers, decision matrix, numbered steps, post-rollback RCA. |
| `ENV_DIFF.md` | `release-reports/` | Config / env-var / feature-flag / secret / infrastructure diff between `--env` and `--to-env`. |
| `ANNOUNCEMENT.md` | `release-reports/` | Multi-channel announcement — email + Slack + Confluence + short-form. |
| `RELEASE-INDEX.md` | `release-reports/` | Manifest of inputs → authored artifacts. |
| One `CHANGE-LOG.md` entry | project root | e.g. `Release 2.5.0: pipeline(cloudmanager), 47 note(s), 4 plan phase(s), 5 rollback trigger(s), 6 diff row(s), 4 channel(s).` |
| Optional working branch | git | `dca/release-<stack>-<timestamp>` when `--create-branch` is passed. |

The report follows the [standardized outputs contract](../concepts/standardized-outputs): **Run Info** · **Summary** · **Severity Breakdown** · **By Category** · **Recommendations** · **SLA Status** (unless `--no-sla`) · optional **Delta** (against a prior release). The 15-column Summary maps `id → REL-<n>`, `severity → {gate, risk, action, info}`, and `category → {pipeline, notes, plan, rollback, diff, announcement}`.

## Modes

Two artifact-scope modes, both selected by `--artifacts`:

| Mode | Trigger | What it does | Best for |
|------|---------|--------------|----------|
| **Full release** (default) | `--artifacts all` (or omitted) or `"full release … "` / `"release pack"` in the prompt | Emits every resolvable artifact from a release version, optional git ref range, and target environment. | Cutting a real release; brand-new-project release-pack scaffold; enterprise release-review kickoff. |
| **Individual artifact** | `--artifacts <one>` — one of `pipeline`, `release-notes`, `deploy-plan`, `rollback-plan`, `env-diff`, `announcement` | Authors exactly the requested artifact using the stack template and available inputs. | Focused re-runs; iterating on one artifact; scripted CI paths. |

## Artifact catalog

`--artifacts` accepts a comma-separated list. `all` expands to every artifact. Missing → `all`.

| Artifact key | Written file(s) | Master template | Per-stack guide |
|---|---|---|---|
| `pipeline` | `pipeline.<ext>` (`.yml` / `.groovy` per target) | `templates/pipeline-<target>.yml` (or `.groovy`) | [`resources/pipeline-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-release-agent/resources/pipeline-templates) |
| `release-notes` | `RELEASE_NOTES.md` | `templates/release-notes.md` | [`resources/release-notes-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-release-agent/resources/release-notes-templates) |
| `deploy-plan` | `DEPLOY_PLAN.md` | `templates/deploy-plan.md` | [`resources/deploy-plans/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-release-agent/resources/deploy-plans) |
| `rollback-plan` | `ROLLBACK_PLAN.md` | `templates/rollback-plan.md` | [`resources/rollback-plans/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-release-agent/resources/rollback-plans) |
| `env-diff` | `ENV_DIFF.md` | `templates/env-diff.md` | [`resources/env-diff-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-release-agent/resources/env-diff-templates) |
| `announcement` | `ANNOUNCEMENT.md` | `templates/announcement.md` | [`resources/announcement-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-release-agent/resources/announcement-templates) |
| `all` | Every artifact resolvable given other flags. | — | — |

## Pipeline-target catalog

`--pipeline` selects the CI/CD platform. When omitted, `autoDetectPipeline()` in `scripts/run.ts` walks the project root for CI indicators.

| Pipeline target | Master template | Auto-detect signal |
|---|---|---|
| `cloudmanager` | `templates/pipeline-cloudmanager.yml` | `pom.xml` with `com.adobe.aem`, `aem-sdk-api`, `uber-jar`, or `cq-quickstart` markers (only when no other CI file is present) |
| `github-actions` | `templates/pipeline-github-actions.yml` | `.github/workflows/*.yml` (or `.yaml`) |
| `gitlab-ci` | `templates/pipeline-gitlab-ci.yml` | `.gitlab-ci.yml` at repo root |
| `circleci` | `templates/pipeline-circleci.yml` | `.circleci/config.yml` |
| `jenkins` | `templates/pipeline-jenkins.groovy` | `Jenkinsfile` at repo root |
| `azure-devops` | `templates/pipeline-azure-devops.yml` | `azure-pipelines.yml` at repo root |

**Detection precedence.** When multiple CI files are present, source order in `autoDetectPipeline()` wins: GitHub Actions → GitLab CI → CircleCI → Jenkins → Azure DevOps → Cloud Manager (only for AEM projects). Pass `--pipeline <target>` to override.

## Rollout strategy catalog

`--rollout` selects the rollout strategy the deploy plan phases against. When omitted, `roleDefaultRollout(role)` in `run.ts` supplies a role-driven default (`devops`, `security` → `canary`; `migration` → `blue-green`; `pm`, `ea` → `feature-flag`; `de`, `tl`, other → `rolling`).

| Rollout | When to use |
|---|---|
| `canary` | Progressive percentage-based rollout: 5% → 25% → 50% → 100%. Best for consumer traffic where a bad release can be observed quickly. Requires traffic-splittable ingress or feature-flag targeting on user cohorts. |
| `blue-green` | Two identical environments; swap traffic in one cutover. Best for stateful services where mid-flight requests can't tolerate ambiguity. Requires DNS/LB cutover + warm-up strategy for the idle side. |
| `rolling` | Replace N instances at a time until the fleet is updated (K8s default). Best for stateless services with backwards-compatible schema changes. |
| `feature-flag` | Deploy the code dark; flip the flag to release. Best when release and deploy cadences decouple. Requires a feature-flag provider + flag-flip runbook. |
| `bigbang` | All at once, no ramp. Reserved for hotfixes or when no rollout infra exists. Pair with a fast rollback plan. |

## Trigger phrases

Paste any of these into the agent chat — the agent auto-detects the stack, target CI, rollout, and role.

```text
full release 2.5.0 — pipeline, notes, deploy, rollback, announcement
release notes from main..v2.5.0
release notes for 2.5.0, keep-a-changelog format
author Cloud Manager pipeline for our AEM project
GitHub Actions workflow for our Spring service
deploy plan for 2.5.0 canary rollout
blue-green deploy plan for stage
env-diff stage vs prod
rollback plan for the payment-service outage
release announcement for the loyalty launch
release as devops
list release stacks
```

The full copy-paste catalog is in the [Release prompts reference](../reference/prompts/release).

## CLI usage (technical mode)

The canonical invocation:

```bash
npx ts-node .claude/skills/bmad-dept-code-release-agent/scripts/run.ts \
  --path . --artifacts all --release-version 2.5.0 --rollout canary
```

**One artifact per example** — copy-paste-friendly:

```bash
# Pipeline (auto-detect target)
npx ts-node .claude/skills/bmad-dept-code-release-agent/scripts/run.ts \
  --path . --artifacts pipeline --engine aem
```

```bash
# Release notes for a specific ref range, Keep-a-Changelog style
npx ts-node .claude/skills/bmad-dept-code-release-agent/scripts/run.ts \
  --path . --artifacts release-notes --from-ref v2.4.0 --to-ref v2.5.0 \
  --release-version 2.5.0 --commit-format keep-a-changelog
```

```bash
# Deploy plan, blue-green to prod
npx ts-node .claude/skills/bmad-dept-code-release-agent/scripts/run.ts \
  --path . --artifacts deploy-plan --release-version 2.5.0 \
  --rollout blue-green --to-env prod
```

```bash
# Rollback plan
npx ts-node .claude/skills/bmad-dept-code-release-agent/scripts/run.ts \
  --path . --artifacts rollback-plan --release-version 2.5.0
```

```bash
# Env-diff stage vs prod
npx ts-node .claude/skills/bmad-dept-code-release-agent/scripts/run.ts \
  --path . --artifacts env-diff --env stage --to-env prod
```

```bash
# Multi-channel announcement
npx ts-node .claude/skills/bmad-dept-code-release-agent/scripts/run.ts \
  --path . --artifacts announcement --release-version 2.5.0
```

The Preflight advisory prints on every run — see [The Agents](../concepts/the-agents) for how STATIC / LLM / HYBRID is decided (Release is LLM-heavy for release notes + announcements; template-driven for pipelines + plans), and [Auto-install](../concepts/auto-install) for the first-run dependency bootstrap.

## Flags reference

Every flag listed here is wired in `scripts/run.ts` (Phase 3).

### Release-specific

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--pipeline <target>` | enum | auto-detect | CI/CD platform. Values: `cloudmanager`, `github-actions`, `gitlab-ci`, `circleci`, `jenkins`, `azure-devops`. |
| `--from-ref <ref>` | string | — | Start of release scope (git ref) — for release notes + env-diff. |
| `--to-ref <ref>` | string | `HEAD` | End of release scope. |
| `--env <name>` | string | — | Source environment for env-diff (e.g. `stage`). |
| `--to-env <name>` | string | — | Target environment for env-diff (e.g. `prod`). |
| `--rollout <strategy>` | enum | role-driven | Deploy strategy. Values: `canary`, `blue-green`, `rolling`, `feature-flag`, `bigbang`. |
| `--release-version <tag>` | string | — | Semantic version for the release (e.g. `2.5.0`). |
| `--artifacts <csv>` | csv | `all` | Which artifacts to author. Values: `pipeline`, `release-notes`, `deploy-plan`, `rollback-plan`, `env-diff`, `announcement`, `all`. |
| `--commit-format <style>` | enum | `conventional` | Release-notes commit style. Values: `conventional`, `keep-a-changelog`, `narrative`. |
| `--format <markdown\|both>` | enum | `markdown` | Output format. `both` currently emits markdown only (docx planned) with a warning. |

### Standard (shared with every DCA agent)

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--path <dir>` | string | `.` | Project root — used for stack auto-detection and as the output base. |
| `--engine <id>` | enum | auto | One of `aem`, `commerce-paas` (alias `commerce`), `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`. |
| `--output <dir>` | dir | `<project>/release-reports/` | Override the report directory. |
| `--role <code>` | enum | `.bmad/role.yaml` | Role adaptation: `ea` \| `tl` \| `de` \| `qa` \| `devops` \| `security` \| `pm` \| `ba` \| `migration` \| `content` \| `generic`. Wins for one run. |
| `--interactive` | bool | false | Force interactive intake (step-by-step questions). Persists to `.bmad/intake.yaml`. |
| `--technical` | bool | false | Force technical intake mode. |
| `--create-branch` | bool | false | Cut `dca/release-<stack>-<timestamp>` before writing outputs. |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. Cascade: `production → main → master → develop`. |
| `--preflight` | bool | false | Print the LLM / context-window advisory and exit. |
| `--no-preflight` | bool | false | Suppress the preflight advisory that otherwise prints on every run. |
| `--yes-install` | bool | false | First-run dependency install without confirmation. |
| `--no-install` | bool | false | Error out if deps are missing. |
| `--list-engines` | bool | false | Print the 8 stacks and exit. |
| `--help` | bool | false | Show help. |

### Findings gate (Enterprise Phase 1)

Shared with every DCA agent. See [Findings Gate](../concepts/findings-gate) for the full mechanics — for Release, decisions apply to specific release-gate items: **accepted** (approved for release, frozen) / **deferred** (needs re-test before ship, moves to SLA sheet) / **wontfix** (accept the risk, suppressed from Summary but retained in the emitted artifact).

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--include-decided` | bool | false | Bypass the findings gate — show items already decided in `.bmad/decisions.yaml`. |
| `--decisions-path <path>` | string | `<projectRoot>/.bmad/decisions.yaml` | Override the decisions file. |
| `--ignore-decision-expiry` | bool | false | Treat expired decisions as still active for this run. |
| `--list-decisions` | bool | false | Print all decisions and exit. |

### SLA tracking (Enterprise Phase 1)

Shared with every DCA agent. See [SLA Tracking](../concepts/sla-tracking) — for Release, the SLA is a **release-approval SLA**: how long a release-gate item can sit in `Open` (or a finding in `draft`) per role before it becomes OVERDUE and blocks the ship.

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--sla-path <path>` | string | `<projectRoot>/.bmad/sla.yaml` | Override the SLA file. |
| `--no-sla` | bool | false | Skip the SLA sheet and computation. |
| `--fail-on-overdue` | bool | false | Exit code 6 if any surviving finding is OVERDUE per role SLA. Wire into CI to fail the release pipeline when a gate item has been open too long. |

## What's new in Phase 3

Release is the **8th agent** in the DCA suite and closes SDLC phase 5 (Deploy/Release). Together with the existing agents:

- **Requirements** (Phase 2 — 6th agent) — authors BRD + user stories + AC upstream of any design.
- **Architecture** (Phase 2 — 7th agent) — turns the "what" into the "how" via ADR + HLD + LLD + API + diagrams + STRIDE + data model.
- **Audit** + **Sonar Scan** + **Test Coverage** — gate quality on existing code.
- **Impact Analysis** — traces blast radius across code.
- **Code Generation** — scaffolds from a spec / LLD.
- **Release** (this agent — 8th agent, Phase 3) — turns the merged change set into a shippable release: pipeline + notes + deploy + rollback + env-diff + announcement.
- **Operations** (Phase 3.4-3.6) — post-deploy runbook + alerts wire-up. Next up.

The natural fan-out from a Release run: **`release → audit` + `release → sonar-scan` + `release → test-coverage`** (release-gate quality baselines) and, when the Operations agent lands, **`release → operations`** (post-deploy runbook + alerts wired from the deploy plan).

## Example workflow — full release 2.5.0

**Chat trigger 1 — the full release pack:**

```text
full release 2.5.0 — pipeline, notes, deploy plan, rollback, announcement
```

**Resolved CLI:**

```bash
npx ts-node .claude/skills/bmad-dept-code-release-agent/scripts/run.ts \
  --path . --release-version 2.5.0 --artifacts all \
  --technical --no-preflight --yes-install
```

**Chained SDLC pass — release-gate quality baselines:**

```text
audit + sonar-scan + test-coverage the release scope, then release
```

**Chat trigger 2 — release → operations (Phase 3.4-3.6):**

```text
wire the post-deploy runbook + alerts for release 2.5.0
```

**Outputs (composite):**

```
release-reports/
├── release-main-20260808_120000-agent-report.xlsx
├── release-main-20260808_120000-agent-report.md
├── pipeline.yml                            ← CI/CD workflow
├── RELEASE_NOTES.md                        ← 47 commits grouped by Conventional Commits
├── DEPLOY_PLAN.md                          ← canary, 4 phases
├── ROLLBACK_PLAN.md                        ← 5 triggers, 7 steps
├── ENV_DIFF.md                             ← 6 config deltas
├── ANNOUNCEMENT.md                         ← email + Slack + Confluence + short-form
└── RELEASE-INDEX.md
CHANGE-LOG.md                                ← one new entry per run
```

## Cross-agent chaining hints per role

The Release agent adapts its **default rollout**, **artifact emphasis**, and **recommended follow-up** to the resolved [role](../concepts/role-adaptation):

| Role | Default rollout | Emphasis | Next agent |
|------|-----------------|----------|-----------|
| `ea` | `feature-flag` | Portfolio-level rollout ADR + risk summary; release train coordination. | [Impact Analysis](./impact-analysis) — portfolio blast radius. |
| `tl` | `rolling` | Solution-level deploy plan with RACI; team-level rollout schedule. | [Audit](./audit) — baseline quality of the release scope. |
| `de` | `rolling` | Commit-level release notes (author + ticket + file-touch); component-scoped deploy plan. | [Sonar Scan](./sonar-scan) — vuln + code-smell delta since last release. |
| `qa` | `canary` | Release-gate checklist — regression scope, feature-flag test matrix, UAT sign-off, smoke script per phase. | [Test Coverage](./test-coverage) — coverage gate against changed files. |
| `devops` | `canary` | **Primary role for this agent.** Pipeline YAML with DCA gate integration; canary orchestration (5→25→50→100); rollback drill runbook. | [Sonar Scan](./sonar-scan) + [Audit](./audit) — wire both gates into the pipeline. |
| `security` | `canary` | Release security-review gate; secrets-rotation checklist; PCI/HIPAA release-notes annotations. | [Sonar Scan](./sonar-scan) — vuln scan; block ship on HIGH residuals. |
| `pm` | `feature-flag` | Stakeholder announcement (email + Slack + Confluence + short-form); business-outcome release-notes framing. | [Impact Analysis](./impact-analysis) — business impact framing. |
| `ba` | `rolling` | Feature-to-requirement traceability in release notes; business-rules changelog. | [Requirements](./requirements) — reconcile release scope with BRD. |
| `migration` | `blue-green` | Cutover plan with parallel-run window; data-migration ordering; freeze windows; go/no-go criteria. | [Impact Analysis](./impact-analysis) + [Test Coverage](./test-coverage) — cross-version impact + coverage delta. |
| `content` | `rolling` | Content-migration release notes; AEM package deploy order / EDS bulk imports / dispatcher warmup. | [Code Generation](./code-generation) — content scaffold aligned to the new release. |
| `generic` | `rolling` | Balanced default — all six artifacts, rolling deploy. | [Audit](./audit) — quality baseline for the release. |

The resolved role is exposed to child engines via `process.env.DCA_ROLE`, recorded on the **Run Info** sheet, and printed to stderr on every run.

## Per-stack notes

The agent loads up to six per-stack resource files at authoring time — a 6-pack per stack. See the [Release Management concept](../concepts/release-management) for the full 6-pack model.

| Stack | Engine ID | Pipeline | Release Notes | Deploy Plan | Rollback | Env Diff | Announcement |
|-------|-----------|----------|---------------|-------------|----------|----------|--------------|
| AEM (AEMaaCS + AMS) | `aem` | [pipeline](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/pipeline-templates/aem.md) | [notes](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/release-notes-templates/aem.md) | [deploy](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/deploy-plans/aem.md) | [rollback](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/rollback-plans/aem.md) | [env-diff](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/env-diff-templates/aem.md) | [announce](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/announcement-templates/aem.md) |
| Adobe Commerce (PaaS) | `commerce-paas` / `commerce` | [pipeline](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/pipeline-templates/commerce-paas.md) | [notes](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/release-notes-templates/commerce-paas.md) | [deploy](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/deploy-plans/commerce-paas.md) | [rollback](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/rollback-plans/commerce-paas.md) | [env-diff](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/env-diff-templates/commerce-paas.md) | [announce](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/announcement-templates/commerce-paas.md) |
| Adobe Commerce SaaS | `commerce-saas` | [pipeline](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/pipeline-templates/commerce-saas.md) | [notes](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/release-notes-templates/commerce-saas.md) | [deploy](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/deploy-plans/commerce-saas.md) | [rollback](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/rollback-plans/commerce-saas.md) | [env-diff](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/env-diff-templates/commerce-saas.md) | [announce](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/announcement-templates/commerce-saas.md) |
| Sling / Shaft | `sling` | [pipeline](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/pipeline-templates/sling.md) | [notes](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/release-notes-templates/sling.md) | [deploy](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/deploy-plans/sling.md) | [rollback](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/rollback-plans/sling.md) | [env-diff](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/env-diff-templates/sling.md) | [announce](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/announcement-templates/sling.md) |
| Spring Boot | `spring` | [pipeline](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/pipeline-templates/spring.md) | [notes](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/release-notes-templates/spring.md) | [deploy](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/deploy-plans/spring.md) | [rollback](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/rollback-plans/spring.md) | [env-diff](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/env-diff-templates/spring.md) | [announce](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/announcement-templates/spring.md) |
| Adobe App Builder | `app-builder` | [pipeline](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/pipeline-templates/app-builder.md) | [notes](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/release-notes-templates/app-builder.md) | [deploy](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/deploy-plans/app-builder.md) | [rollback](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/rollback-plans/app-builder.md) | [env-diff](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/env-diff-templates/app-builder.md) | [announce](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/announcement-templates/app-builder.md) |
| Edge Delivery Services | `eds` | [pipeline](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/pipeline-templates/eds.md) | [notes](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/release-notes-templates/eds.md) | [deploy](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/deploy-plans/eds.md) | [rollback](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/rollback-plans/eds.md) | [env-diff](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/env-diff-templates/eds.md) | [announce](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/announcement-templates/eds.md) |
| EDS + Commerce | `eds-commerce` | [pipeline](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/pipeline-templates/eds-commerce.md) | [notes](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/release-notes-templates/eds-commerce.md) | [deploy](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/deploy-plans/eds-commerce.md) | [rollback](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/rollback-plans/eds-commerce.md) | [env-diff](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/env-diff-templates/eds-commerce.md) | [announce](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/resources/announcement-templates/eds-commerce.md) |

## See also

- [Release prompts catalog](../reference/prompts/release) — 100+ copy-paste prompts across stacks, roles, and artifact types.
- [Release Management concept](../concepts/release-management) — the 6-artifact model, per-stack knowledge packs, two authoring modes, traceability chain.
- [CLI Flags reference](../reference/cli-flags) — including the Enterprise Phase 1 flags shared across all agents.
- [Architecture agent](./architecture) — upstream partner; the release plan often references an ADR emitted by Architecture.
- [Audit agent](./audit) · [Sonar Scan agent](./sonar-scan) · [Test Coverage agent](./test-coverage) — release-gate quality baselines wired into the pipeline.
- [Findings gate](../concepts/findings-gate) — accept / defer / wontfix release-gate items per release.
- [SLA tracking](../concepts/sla-tracking) — release-approval SLA per role; wire `--fail-on-overdue` into CI to block stale gates.
- [Standardized outputs contract](../concepts/standardized-outputs) — 15-column Summary + fixed sheet order.
- [Role adaptation](../concepts/role-adaptation) — how default rollout + emphasis + follow-up change per role.
