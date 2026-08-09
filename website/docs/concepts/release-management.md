---
id: release-management
title: Release Management
sidebar_position: 13
description: How BMAD DCA authors release artifacts — pipelines, release notes, deploy plans, rollback plans, env-diffs, and stakeholder announcements across 8 Adobe/JVM stacks with per-stack knowledge packs.
keywords:
  - release management
  - ci/cd
  - deploy
  - release notes
  - rollback
  - env diff
  - canary
  - blue-green
  - cloud manager
---

The **Release Management** concept underpins the [Release agent](../agents/release) — the eighth agent of the BMAD DCA suite, added in Phase 3 as the third SDLC-alignment agent (after Requirements and Architecture). This page explains the 6-artifact model, the 6-platform pipeline catalog, the 5-rollout strategy catalog, per-stack knowledge packs, the two authoring modes, and how the output feeds the rest of the DCA workflow.

## Why a release agent

The first seven agents cover SDLC phases 1 (Requirements), 2 (Design), and 3–4 (build, test, harden, analyze). That left **phase 5 (Deploy/Release)** with no DCA coverage — and in practice, that's where operational risk originates: pipelines drift across teams; release notes are hand-typed from memory the day of ship; deploy plans live in a wiki that hasn't been touched in a year; rollback drills are theoretical until they're not; env-config diffs are discovered mid-cutover; announcements go out with the wrong scope or audience.

Release closes phase 5 downstream of Architecture and Generation, and upstream of the (upcoming) Operations agent. Concretely:

- **Consistent release artifacts across teams** — one stack-native shape for a pipeline whether the change lives in an AEM repo, a Commerce PaaS repo, an EDS repo, or a Spring service. Every stage, every gate, every rollout phase rendered the same way.
- **Auditor-ready deploy trail** — every release run writes a `RELEASE-INDEX.md`, a workbook row per stage / note / plan step / rollback trigger / env-diff row / channel, and a one-line `CHANGE-LOG.md` entry in the project root. Auditors get the shape they expect without asking.
- **Tested rollback drills** — a rollback playbook with named triggers, a decision matrix, numbered steps, and a post-rollback RCA checklist means on-call practices the recovery before they need it. The stack template already knows what to revert (Flyway migrations, dispatcher cache, drop-in versions, OSGi bundles) and what's irreversible (sent emails, external captures).
- **Traceable release chain via findings cache** — every pipeline stage / release-note entry / deploy step / rollback step / env-diff row / channel is a `REL-<n>` row in the standardized Summary sheet, consumed by downstream agents via the [findings cache](./findings-cache).
- **Enterprise gates** — participates in the shared [Findings Gate](./findings-gate) (`accepted` / `deferred` / `wontfix` per release; release-gate items freeze at Approved once accepted) and [SLA Tracking](./sla-tracking) (release-approval SLA per role — how long a gate item can sit Open before it becomes OVERDUE and blocks the ship).

## The 6-artifact model

Release produces up to six distinct artifact types per run. Each is a row category in the standardized Summary sheet AND a written file in `release-reports/`:

| Artifact | Format | File | Primary consumer | Typical driving role |
|----------|--------|------|------------------|----------------------|
| **Pipeline** | YAML / Groovy per `--pipeline` target | `pipeline.yml` / `pipeline.groovy` | CI/CD platform + DevOps | `devops`, `tl`, `security` |
| **Release Notes** | Markdown, grouped by `--commit-format` | `RELEASE_NOTES.md` | EM / PM / stakeholders / customers | `de`, `pm`, `ba`, `content` |
| **Deploy Plan** | Markdown phased against `--rollout` | `DEPLOY_PLAN.md` | Release manager + on-call | `devops`, `tl`, `qa`, `migration` |
| **Rollback Plan** | Markdown playbook | `ROLLBACK_PLAN.md` | On-call + incident commander | `devops`, `security`, `qa` |
| **Env Diff** | Markdown diff table between two envs | `ENV_DIFF.md` | Release manager + DevOps | `devops`, `security`, `migration` |
| **Announcement** | Multi-channel Markdown (email + Slack + Confluence + short-form) | `ANNOUNCEMENT.md` | Stakeholders / customers | `pm`, `ea`, `content` |

Every row in the workbook conforms to the 15-column Summary contract with these key columns:

| Column | Value for a release row |
|--------|-------------------------|
| `id` | `REL-<n>` (monotonic per run) |
| `title` | Artifact / step title — pipeline stage / release-note headline / deploy step / rollback step / env-diff row / channel |
| `category` | `pipeline` \| `notes` \| `plan` \| `rollback` \| `diff` \| `announcement` |
| `severity` | `gate` \| `risk` \| `action` \| `info` (`gate`≈CRITICAL, `risk`≈HIGH, `action`≈MEDIUM, `info`≈LOW) |
| `confidence` | `high` (from git history / config file) \| `medium` (LLM-authored, template-aligned) \| `low` (inferred — needs review) |
| `ruleId` | `REL-<stack>-<type>` (e.g. `REL-aem-pipeline-cloudmanager`, `REL-spring-rollback-migration`, `REL-eds-diff-headhtml`) |
| `code-reference` | Emitted artifact path (e.g. `pipeline.yml#/jobs/deploy`, `RELEASE_NOTES.md#features`, `ENV_DIFF.md#config`) |
| `status` | `draft` (default) \| `reviewed` \| `approved` \| `deployed` — advances via the [decisions gate](./findings-gate) and post-deploy update |

Full row-shape spec on the [Standardized Outputs](./standardized-outputs) page.

## The 6-platform pipeline catalog

`--pipeline` selects the CI/CD platform for the pipeline artifact. When omitted, `autoDetectPipeline()` walks the project root for CI indicators.

| Pipeline target | Auto-detect signal | Notes |
|---|---|---|
| `cloudmanager` | `pom.xml` with `com.adobe.aem`, `aem-sdk-api`, `uber-jar`, or `cq-quickstart` markers (fallback for AEM projects) | Adobe Cloud Manager pipeline definition; custom event handlers; environment gates. |
| `github-actions` | `.github/workflows/*.yml` (or `.yaml`) | GitHub Actions workflow; jobs for setup, build, test, security-scan, audit gate, deploy (env matrix), post-deploy. |
| `gitlab-ci` | `.gitlab-ci.yml` at repo root | GitLab CI syntax — stages, jobs, `before_script`, `needs`, `rules`. |
| `circleci` | `.circleci/config.yml` | CircleCI 2.1 config; workflows with holds for manual approval. |
| `jenkins` | `Jenkinsfile` at repo root | Declarative pipeline; `withCredentials` for secrets, `input` steps for manual approval. |
| `azure-devops` | `azure-pipelines.yml` at repo root | Azure Pipelines; stages/jobs/steps; environments with approval gates. |

**Detection precedence.** When multiple CI files are present, source order in `autoDetectPipeline()` wins: GitHub Actions → GitLab CI → CircleCI → Jenkins → Azure DevOps → Cloud Manager (only for AEM). Pass `--pipeline <target>` to override.

## The 5-rollout catalog

`--rollout` selects the strategy the deploy plan phases against. When omitted, `roleDefaultRollout(role)` in `run.ts` supplies a role-driven default.

| Rollout | When to use | Common stacks |
|---|---|---|
| `canary` | Progressive percentage-based rollout (5→25→50→100). Best for consumer traffic where a bad release is observed quickly. | Spring on K8s + Istio; EDS via helix-query cohort splits (niche); Commerce PaaS via Fastly weighted routing. |
| `blue-green` | Two identical environments; swap in one cutover. Best for stateful services or migrations. | Spring on K8s with Service selector cutover; Commerce PaaS via Fastly VCL swap or DNS between two Magento Cloud projects; Sling when instance state matters. |
| `rolling` | Replace N instances at a time until fleet is updated. K8s default. Best for stateless services with backwards-compatible schema. | Spring / Sling / Commerce PaaS multi-node fleets. |
| `feature-flag` | Deploy dark; flip the flag to release. Decouples release from deploy cadence. | Commerce SaaS (drop-in-version-pinning); App Builder (workspace-swap); any stack with LaunchDarkly / Unleash / Split / homegrown. |
| `bigbang` | All at once, no ramp. Reserved for hotfixes or when no rollout infra exists. | Any stack — pair with a fast rollback plan. |

**Stack rollout notes.** AEM ships via Cloud Manager staged promotion (Stage QG → Prod QG → Prod deploy) — canary is not natively supported. Commerce SaaS effectively rolls out via drop-in version pins. App Builder uses workspace-swap between stage and prod namespaces. EDS relies on git-based edge deploy with instant `git revert` as the safety net.

## Per-stack knowledge packs

For each of the 8 stacks Release loads **up to six per-stack resource files** at authoring time — a 6-pack (analogous to the Requirements 3-pack and the Architecture 4-pack). Together they keep every artifact stack-native — an AEM deploy plan reads like an AEM deploy plan, not a generic doc with the word "AEM" sprinkled in:

| Pack | Path | Purpose |
|------|------|---------|
| **Pipeline template** | `resources/pipeline-templates/<stack>.md` | Stack-native pipeline stages (AEM: Cloud Manager quality-gate thresholds + custom event handlers; Spring: JDK setup + Actuator readiness gate; EDS: git-preview branch build). |
| **Release-notes template** | `resources/release-notes-templates/<stack>.md` | Stack-specific commit categorization + noteworthy-change surfacing (AEM: content-package deploy notes; Commerce PaaS: db-schema patches; EDS: sheet-driven config changes). |
| **Deploy-plan template** | `resources/deploy-plans/<stack>.md` | Stack-specific deploy idioms (AEM: content-package order `ui.config` → `ui.apps` → `ui.content` + dispatcher flush; Commerce PaaS: `setup:upgrade` → `di:compile` → `static-content:deploy` + cache clean order; Spring: Flyway before deploy). |
| **Rollback template** | `resources/rollback-plans/<stack>.md` | Stack-specific revert steps + irreversibility callouts (Spring: Flyway irreversibility check on down-migrations; Commerce PaaS: RabbitMQ consumer restart order; EDS: `git revert` + push). |
| **Env-diff template** | `resources/env-diff-templates/<stack>.md` | Stack-specific config-diff surface (AEM: OSGi config by run-mode + Cloud Manager env vars; Commerce PaaS: `app/etc/env.php` + `config.php` module state; Spring: `application-<profile>.yaml` + K8s ConfigMap/Secret; EDS: `paths.json` + `head.html`). |
| **Announcement template** | `resources/announcement-templates/<stack>.md` | Stack-flavored per-channel copy (AEM: content-team invalidation windows; Commerce PaaS: catalog re-index window; EDS: preview URL + go-live URL). |

**What each stack biases toward** (one-liners; the full grid is in [`SKILL.md` § Per-stack authoring instructions](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/SKILL.md#per-stack-authoring-instructions)):

- **AEM** — Cloud Manager staged promotion, content-package deploy order, dispatcher flush, RDE preview, quality-gate thresholds (`customer.critical` = 0 blocks ship).
- **Commerce PaaS** — ECE-Tools deploy, `setup:upgrade` / `di:compile` / `static-content:deploy` ordering, cache-clean order, `indexer:reindex` timing, maintenance-mode wrapping.
- **Commerce SaaS** — drop-in bundle version pinning, Catalog Service publish, Live Search index refresh, Storefront Events schema version, EDS git-based deploy sync.
- **Sling** — OSGi bundle install order (deps first), Feature Model composition, health-check verification, rolling deploy across the pool.
- **Spring** — DB migration ordering (Flyway/Liquibase — schema before, backfill during, cleanup after), K8s `RollingUpdate` with surge/unavailable, Actuator readiness/liveness gates, Micrometer signals.
- **App Builder** — `aio app deploy` per namespace, workspace-swap rollout, secret rotation via `aio app config set`, API Mesh resolver deploys via `aio api-mesh update`.
- **EDS** — git-based edge deploy (merge to `main` triggers), branch preview URL, instant rollback via `git revert` + push, sheet-driven config independence.
- **EDS + Commerce** — all EDS idioms + drop-in version sync + coordinated release with Commerce SaaS drop-in registry.

## Two modes

Release has two artifact-scope modes, both selected by `--artifacts`:

### Full release (default)

**Trigger:** `--artifacts all` (or omitted), or `"full release … "` / `"release pack"` in the prompt.

Emits every resolvable artifact from a release version, optional git ref range, and target environment. Use this for a real release cut, a brand-new-project release-pack scaffold, or an enterprise release-review kickoff.

**Worked example:**

```text
full release 2.5.0 — pipeline, notes, deploy, rollback, announcement
```

Resolves to `--release-version 2.5.0 --artifacts all` and produces `pipeline.yml` + `RELEASE_NOTES.md` + `DEPLOY_PLAN.md` + `ROLLBACK_PLAN.md` + `ENV_DIFF.md` + `ANNOUNCEMENT.md` + `RELEASE-INDEX.md` alongside the workbook. Rollout defaults per role (`devops` → canary; `migration` → blue-green; `pm`, `ea` → feature-flag; else rolling).

### Individual artifact

**Trigger:** `--artifacts <one>` — one of `pipeline`, `release-notes`, `deploy-plan`, `rollback-plan`, `env-diff`, `announcement`.

Authors exactly the requested artifact using the stack template and available inputs. Use this for focused re-runs, iterating on one artifact, or scripted CI paths that own each artifact separately.

**Worked example:**

```text
release notes from main..v2.5.0
```

Resolves to `--artifacts release-notes --from-ref main --to-ref v2.5.0`, produces `RELEASE_NOTES.md` only, and skips pipeline / deploy / rollback / env-diff / announcement.

## Role-adaptation for release

Release adapts the **default rollout**, the **artifact emphasis**, and the **recommended follow-up** to the resolved role — same [role-adaptation](./role-adaptation) mechanism the other eight agents use. The 11-role artifact matrix:

| Role | Typically requests |
|------|--------------------|
| `ea` — Enterprise Architect | Portfolio-level rollout ADR + release-train risk summary; multi-team coordination doc. |
| `tl` — Tech Lead / Solution Architect | Solution-level deploy plan with team ownership (RACI); release runbook links. |
| `de` — Senior Delivery Engineer | Commit-level release notes (author + ticket + file-touch); component-scoped deploy plan; feature-flag flip guide. |
| `qa` — QA / SDET | Release-gate checklist — regression scope, feature-flag test matrix, UAT sign-off template, smoke-test script per phase. |
| `devops` — DevOps / SRE | **Primary role for this agent.** Pipeline YAML/Groovy with DCA-agent gate wiring (audit + sonar-scan + coverage); canary orchestration; rollback drill runbook. |
| `security` — Security Engineer | Release security-review gate — secrets-rotation checklist; vulnerability-fix inclusion audit; PCI/HIPAA release-notes annotations; dep-audit summary. |
| `pm` — Product Manager | Stakeholder announcement (email + Slack + Confluence + short-form); business-outcome release-notes framing; release KPI tracking. |
| `ba` — Business Analyst | Feature-to-requirement traceability in release notes (each PR → the REQ / user story it satisfies); business-rules changelog. |
| `migration` — Migration Lead | Cutover plan with parallel-run window; data-migration ordering; freeze windows; explicit go/no-go criteria per phase gate. |
| `content` — Content/CMS Engineer | Content-migration release notes — AEM package deploy order, EDS bulk imports, dispatcher cache warmup, CF migration steps. |
| `generic` | Balanced default — all six artifacts, rolling deploy. |

Full role matrix on the [Release agent page](../agents/release#cross-agent-chaining-hints-per-role) and in the source [`SKILL.md` § Role-aware behavior](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-release-agent/SKILL.md#role-aware-behavior).

## Traceability

Every finding row is written to the standardized report **and** to a findings cache at `.bmad/cache/release-<hash>.json`. That cache is consumed by downstream analysis agents via the shared [findings-cache](./findings-cache) contract — Impact Analysis can trace `REL-<n>` rows to impacted files, Test Coverage can re-check the changed-files coverage against the release gate, Sonar Scan can vuln-scan exactly the components the release scope touches.

Downstream of Release, the **Operations agent** (Phase 3.4-3.6) will consume deploy-plan timing + rollback triggers to wire post-deploy runbooks + alerts — the release plan tells Ops what to watch and when to page.

The recommended DCA fan-out at release time:

```
Architecture (author ADRs + HLD + LLD + OpenAPI)
    ↓
Generation (scaffold code from the design)
    ↓
Audit + Sonar-Scan + Test-Coverage (gate quality on the release scope)
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
Operations (post-deploy runbook + alerts — Phase 3.4-3.6)
```

## Output artifacts

Every release run writes into `<project>/release-reports/` (override with `--output`):

- `release-<branch>-<timestamp>-agent-report.xlsx` — the standardized workbook.
- `release-<branch>-<timestamp>-agent-report.md` — the Markdown twin.
- `pipeline.yml` (or `pipeline.groovy` for Jenkins) — CI/CD workflow.
- `RELEASE_NOTES.md` — notes from git history.
- `DEPLOY_PLAN.md` — phased against the resolved rollout.
- `ROLLBACK_PLAN.md` — playbook with triggers + steps.
- `ENV_DIFF.md` — source-env vs target-env diff.
- `ANNOUNCEMENT.md` — per-channel announcement bundle.
- `RELEASE-INDEX.md` — always emitted; manifest of inputs → artifacts.
- One `CHANGE-LOG.md` entry spliced into project root.

Optional `--format both` is currently **stubbed** — it logs a warning on stderr and falls back to markdown. The docx writer lands in a later phase.

## Release-approval gate integration

The [Findings Gate](./findings-gate) applies to release-gate items directly — the mapping is one-to-one:

| Decision status | Effect on the release-gate item |
|-----------------|---------------------------------|
| `accepted` | Approved for release — frozen at current confidence; future reruns don't re-surface it as a gate (still visible in Summary with Status=Approved). |
| `deferred` | Needs re-test before ship — moves to the SLA sheet with a `next-review` date; suppressed from Summary until the review date passes. |
| `wontfix` | Accept the risk — suppressed from Summary but the emitted artifact retains the callout for audit. |

Combine this with the release-approval **SLA per role** (see [SLA Tracking](./sla-tracking)) to gate CI on stale approvals: `--fail-on-overdue` exits with code 6 when any release-gate item has sat past its role SLA. Default thresholds — for `gate` severity: `devops` / `security` / `qa` 1 day, `tl` / `ea` / `pm` 2 days. See the source SKILL for the full matrix per severity bucket.

## See also

- [Release agent](../agents/release) — the per-agent reference (flags, modes, CLI, per-stack notes).
- [Release prompts catalog](../reference/prompts/release) — 100+ copy-paste prompts across stacks, roles, and artifact types.
- [Architecture agent](../agents/architecture) — upstream partner; release plans often reference an ADR emitted by Architecture.
- [Architecture Authoring concept](./architecture-authoring) — the 4-pack sibling model for architecture.
- [Requirements Authoring concept](./requirements-authoring) — the 3-pack sibling model for requirements.
- [Audit agent](../agents/audit) · [Sonar Scan agent](../agents/sonar-scan) · [Test Coverage agent](../agents/test-coverage) — release-gate quality baselines wired into the pipeline.
- [Role adaptation](./role-adaptation) — how default rollout + emphasis + follow-up change per role.
- [Findings cache](./findings-cache) — how release output feeds downstream agents.
- [Findings gate](./findings-gate) — accept / defer / wontfix per release.
- [SLA tracking](./sla-tracking) — release-approval SLA per role.
- [One-shot mode](./one-shot-mode) — full precedence rules for silent end-to-end execution.
- [Standardized outputs](./standardized-outputs) — the shared 15-column Summary + fixed sheet order.
