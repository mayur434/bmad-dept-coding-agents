---
id: release
title: Release — Prompts
sidebar_position: 8
description: Copy-paste prompts for the Release agent — CI/CD pipelines, release notes, deploy plans, rollback plans, env-diffs, announcements across 8 Adobe/JVM stacks.
keywords:
  - release prompts
  - pipeline prompts
  - release notes prompts
  - deploy plan prompts
  - rollback prompts
  - env diff prompts
---

Copy-paste prompts for the **Release agent** (`bmad-dept-code-release-agent`). Send a whole block or a single line — the agent parses natural language and resolves flags, stack, pipeline target, rollout strategy, and role automatically.

**Modes:** `full-release` = all six artifacts in one run (`--artifacts all`, default). `individual-artifact` = narrow to one artifact (`--artifacts pipeline` / `release-notes` / `deploy-plan` / `rollback-plan` / `env-diff` / `announcement`).

Related: [Release agent](../../agents/release) · [Release Management concept](../../concepts/release-management) · [CLI Flags](../cli-flags) · [Role adaptation](../../concepts/role-adaptation).

---

## Quick starters

Send one of these first — the agent auto-detects the stack, pipeline target, and role, and asks a single question only if a required input is truly missing.

```text
full release 2.5.0 — all artifacts
release notes from main..v2.5.0
generate Cloud Manager pipeline for our AEM project
deploy plan for canary rollout of 2.5.0
rollback plan for 2.5.0
env-diff stage vs prod
release announcement for the loyalty launch
list release stacks
```

---

## Cross-cutting flag templates

One prompt per flag — reuse for any stack:

```text
release --engine aem --path /path/to/project
release --engine spring --path .
release --engine commerce-saas --path ./storefront
```

```text
release --create-branch
release --create-branch --source-branch production
release on a new branch from main
```

```text
release --preflight
release --no-preflight
release and skip preflight
```

```text
release --artifacts pipeline
release --artifacts release-notes,announcement
release --artifacts all
release --commit-format conventional
release --commit-format keep-a-changelog
release --commit-format narrative
release --format markdown
```

---

## Pipelines

Per-target pipeline prompts — grounded in the per-target `templates/pipeline-<target>.yml` (or `.groovy`).

### Cloud Manager (AEM)

```text
author Cloud Manager pipeline for our AEM project
Cloud Manager pipeline for AEM with the DCA audit + sonar-scan gates wired in
```

### GitHub Actions

```text
GitHub Actions workflow for our Spring service
GitHub Actions pipeline with env matrix (dev/stage/prod) and manual approval before prod
```

### GitLab CI

```text
GitLab CI pipeline for our Commerce PaaS repo
GitLab pipeline with stages: setup / build / test / security-scan / audit / deploy
```

### CircleCI

```text
CircleCI 2.1 config for our Sling project
CircleCI workflow with a hold before prod deploy
```

### Jenkins

```text
Jenkinsfile for our commerce upgrade — withCredentials + input step for approval
Jenkins declarative pipeline for a Spring service
```

### Azure DevOps

```text
Azure Pipelines YAML for our Spring service
Azure DevOps pipeline with environments + approval gates for stage and prod
```

---

## Release notes

Per-stack release-notes prompts. Choose `--commit-format conventional` (default), `keep-a-changelog`, or `narrative`.

### AEM

```text
release notes for the loyalty extension launch on AEM
release notes v2.5.0 — group by conventional commits, escalate any content-package DROP as BREAKING
```

### Adobe Commerce (PaaS)

```text
release notes for the catalog enrichment release on Magento Cloud
release notes v2.5.0 — keep-a-changelog format, flag any db-schema drop as BREAKING
```

### Adobe Commerce SaaS

```text
release notes for a drop-in bundle bump on the storefront
release notes v2.5.0 — surface Catalog Service publish + Live Search index refresh notes
```

### Sling / Shaft

```text
release notes for the health-check bundle refresh
release notes v2.5.0 — group by OSGi bundle + Feature Model changes
```

### Spring Boot

```text
release notes for the promotions service 2.5.0
release notes v2.5.0 — surface Flyway migrations under BREAKING when non-reversible
```

### Adobe App Builder

```text
release notes for the Salesforce sync action deploy
release notes v2.5.0 — group by workspace + API Mesh resolver changes
```

### Edge Delivery Services (EDS)

```text
release notes for the block library refresh on the marketing site
release notes v2.5.0 — surface sheet-driven config changes (redirects.xlsx, helix-query.yaml)
```

### EDS + Commerce

```text
release notes for the PDP drop-in bump on the storefront
release notes v2.5.0 — group by drop-in version bump + block change
```

---

## Deploy plans

Per-stack deploy-plan prompts. Rollout defaults per role; override with `--rollout <canary|blue-green|rolling|feature-flag|bigbang>`.

### AEM

```text
deploy plan for AEM 2.5.0 canary via Cloud Manager (staged promotion)
deploy plan for AEM 2.5.0 with content-package deploy order + dispatcher flush window
```

### Adobe Commerce (PaaS)

```text
Commerce PaaS deploy plan v2.5.0 with catalog re-index window
Commerce PaaS 2.5.0 deploy plan — setup:upgrade + di:compile + static-content:deploy phases, maintenance-mode wrapping
```

### Adobe Commerce SaaS

```text
Commerce SaaS 2.5.0 deploy plan — drop-in version bump + Catalog Service publish
Commerce SaaS 2.5.0 rolling drop-in bundle deploy, Live Search index refresh
```

### Sling / Shaft

```text
Sling 2.5.0 deploy plan — bundle install order + health-check verification
Sling 2.5.0 rolling deploy across the instance pool
```

### Spring Boot

```text
Spring 2.5.0 canary deploy plan on K8s with Istio traffic-split
Spring 2.5.0 blue-green deploy plan with Flyway before deploy + backfill during
```

### Adobe App Builder

```text
App Builder 2.5.0 deploy plan — workspace-swap (stage → prod namespace)
App Builder 2.5.0 deploy plan — aio app deploy per namespace + API Mesh resolver update
```

### Edge Delivery Services (EDS)

```text
EDS 2.5.0 deploy plan — git-based edge deploy + branch preview
EDS 2.5.0 deploy plan — merge to main + sheet-driven config sync window
```

### EDS + Commerce

```text
EDS + Commerce 2.5.0 deploy plan — drop-in version sync + git edge deploy
EDS + Commerce 2.5.0 deploy plan — coordinated with Commerce SaaS drop-in registry
```

---

## Rollback plans

Per-stack rollback-playbook prompts.

### AEM

```text
rollback plan for AEM 2.5.0 — dispatcher hit-ratio trigger
AEM 2.5.0 rollback playbook — Cloud Manager rollback + dispatcher flush + content-package revert order
```

### Adobe Commerce (PaaS)

```text
Commerce PaaS 2.5.0 rollback — cache-tag invalidation + config.php revert
Commerce PaaS 2.5.0 rollback with db_schema irreversibility callouts
```

### Adobe Commerce SaaS

```text
Commerce SaaS 2.5.0 rollback — drop-in version pin revert
Commerce SaaS 2.5.0 rollback — Storefront Events schema fallback
```

### Sling / Shaft

```text
Sling 2.5.0 rollback — bundle uninstall order + Feature Model composition revert
Sling 2.5.0 rollback with health-check failure trigger
```

### Spring Boot

```text
Spring 2.5.0 rollback with Flyway irreversibility check on down-migrations
Spring 2.5.0 rollback — K8s Deployment revert + Actuator readiness gate
```

### Adobe App Builder

```text
App Builder 2.5.0 rollback — workspace-swap back to previous namespace
App Builder 2.5.0 rollback — aio app undeploy + API Mesh resolver rollback
```

### Edge Delivery Services (EDS)

```text
EDS 2.5.0 rollback — git revert + push
EDS 2.5.0 rollback with LCP-critical regression trigger
```

### EDS + Commerce

```text
EDS + Commerce 2.5.0 rollback — coordinated drop-in downgrade + git revert
EDS + Commerce 2.5.0 rollback with cart-conversion drop trigger
```

---

## Env-diffs

```text
env-diff stage vs prod — flag secret rotation gaps
env-diff dev vs stage — flag feature-flag drift
env-diff stage vs prod for our Commerce PaaS repo (app/etc/env.php + config.php + magento.env.yaml)
env-diff stage vs prod for our Spring service (application-<profile>.yaml + K8s ConfigMap/Secret)
env-diff preview vs live for our EDS site (paths.json + head.html + redirects.xlsx)
```

---

## Announcements

```text
release announcement email + Slack — major loyalty launch
breaking-change announcement with 30-day deprecation window
hotfix announcement — Slack-first, no external
PCI-scope-change announcement (restricted audience)
consumer-facing feature launch — external post + LinkedIn + Twitter short-form included
```

---

## Chained SDLC passes

Release is the shipping entry point. Common one-shot chains:

```text
chain: architecture → release → operations
audit + sonar-scan + test-coverage gates the release scope, then release
release → operations — wire alerts + runbook post-deploy
test-coverage gate then release with --fail-on-overdue
chain: impact-analysis → release (blast radius before the ship)
```

---

## Role-flavored requests

Prefix any prompt with `"as <role>, ..."` for a per-run role override (no write to `.bmad/role.yaml`):

```text
as devops, generate Cloud Manager pipeline with all DCA gates wired
as security, generate release with PCI-scope callout in every artifact
as pm, generate stakeholder announcement for external launch
as migration lead, cutover plan for AEM 6.5 → aaCS with parallel-run window
as tl, solution-level deploy plan with team ownership (RACI)
as de, commit-level release notes with author + ticket + file-touch
as qa, release-gate checklist with regression scope + UAT sign-off
as content, content-migration release notes with dispatcher cache warmup
```

---

## Enterprise gate patterns

Mark release-gate items accepted / deferred / wontfix for a release so subsequent runs stop resurfacing them. See [Findings Gate](../../concepts/findings-gate) for the YAML shape.

```text
list decisions
release --include-decided                    # bypass the decisions gate
release --decisions-path ./compliance/decisions.yaml
release --ignore-decision-expiry
release --fail-on-overdue                    # CI: exit 6 if any release-gate item is OVERDUE per role SLA
```

---

## Troubleshooting

```text
why is my release notes empty?
how do I set --pipeline manually if auto-detect fails?
release notes categorized wrong — how do I switch --commit-format?
list release stacks
switch role to devops
switch intake to technical
```

---

## Follow-up prompts (post-run)

Reusable after any Release run:

```text
summarize top-3 breaking changes from the last release
which env vars changed between stage and prod?
generate rollback runbook for on-call handoff
operations agent — wire alerts for the metrics this release exposes
which release-gate items are OVERDUE per SLA?
which decisions are already accepted for this release?
hand the pipeline to Sonar-Scan so the Quality Gate is wired in
audit the release scope before we ship
```
