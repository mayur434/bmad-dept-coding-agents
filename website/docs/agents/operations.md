---
id: operations
title: Operations
sidebar_position: 9
description: Author runbooks, observability dashboards, alert rules, SLO/SLI definitions, on-call rotation, incident playbooks, and blameless postmortems — grounded in per-stack Adobe/JVM ops idioms across all 8 supported stacks.
keywords:
  - operations
  - ops
  - sre
  - runbook
  - dashboard
  - alerts
  - slo
  - sli
  - oncall
  - observability
  - datadog
  - newrelic
  - grafana
  - prometheus
  - incident response
  - postmortem
  - monitoring
---

## Purpose

The **Operations & SRE Specialist** (📊) is the **ninth agent** in the DCA suite and **closes SDLC phase 6 (Ops / Monitoring)**. Where [Release](./release) ships the code, Operations owns what happens after: dashboards to see it, alerts to notice when it breaks, runbooks so someone can fix it at 3 AM, SLOs to know whether it is meeting its promise, on-call rotations to make sure someone answers, playbooks to run an incident, and postmortems to learn from what broke.

It authors — grounded in per-stack Adobe/JVM ops idioms — **runbooks** (incident-symptom-based, with exact commands and quantified triggers), **observability dashboards** as code (Datadog, New Relic, Grafana, Prometheus, Elastic, CloudWatch, Dynatrace), **alert rules** (per-platform equivalents of Datadog monitors / Prometheus `alerting.rules`), **SLO / SLI definitions** with error-budget policies keyed to `--service-tier`, **on-call rotation configs** (PagerDuty / Opsgenie / VictorOps compatible), **incident-response playbooks** (STRIDE-informed for security incidents), and **blameless postmortems**.

:::note Operations is an ops-artifact authoring specialist, not an ops executor
It does not run `kubectl`, install monitoring agents, page the on-call, or accept SLOs on behalf of the team. It emits the configs your platform (Datadog, PagerDuty, Grafana) consumes and the Markdown docs your team adopts. See [Constraints / non-goals](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/SKILL.md#constraints--non-goals) for the full boundary.
:::

## When to use

- **New-service observability kickoff** — one command produces the full ops kit (runbook + dashboard + alerts + SLO + on-call + playbook + postmortem) so the service ships with day-one observability wired to the same stack idioms every team recognizes.
- **Incident post-mortem** — after a SEV1/2/3, `--incident-in ./incidents/<log>.md --postmortem-severity <sev>` produces a blameless postmortem template with severity-keyed timeline granularity and a full action-items table.
- **SLO framework rollout** — `--artifacts slo` per service, keyed to `--service-tier t1|t2|t3`, gives every team the same SLO doc shape (availability + latency + error-budget policy + burn-rate alerts + freeze policy).
- **On-call rotation config** — one file that renders as PagerDuty / Opsgenie / VictorOps compatible YAML with primary layer + secondary layer + escalation + weekly handoff + holiday overrides.
- **Quarterly runbook refresh** — `--artifacts runbook --incident "<recent symptom>"` per incident type so the runbook library keeps pace with the fleet.

## What it produces

Every operations run emits the standardized DCA outputs into `<project>/operations-reports/` (override with `--output`):

| Artifact | Where | Notes |
|----------|-------|-------|
| `operations-<branch>-<timestamp>-agent-report.xlsx` | `operations-reports/` | Standardized 15-column Summary contract; one row per runbook step / dashboard widget / alert rule / SLI / on-call layer / playbook phase / postmortem timeline entry, keyed as `OPS-<n>`. |
| `operations-<branch>-<timestamp>-agent-report.md` | `operations-reports/` | Git-diffable Markdown twin. |
| `RUNBOOK-<slug>.md` | `operations-reports/` | Incident-symptom runbook — quick-diagnosis + likely causes + mitigation + rollback triggers + escalation. |
| `dashboard-<target>.{json,yml}` | `operations-reports/` | Dashboard-as-code for the resolved `--observability` target. |
| `alerts-<target>.yaml` | `operations-reports/` | Alert rules per observability target — uptime, latency, error rate, saturation, log-error rate, business SLI. |
| `SLO-<service>.md` | `operations-reports/` | SLO/SLI doc with error-budget policy + burn-rate alerts + freeze policy + sign-off block. |
| `oncall-rotation.yaml` | `operations-reports/` | Primary + secondary + escalation layers; weekly rotation; holiday overrides. |
| `PLAYBOOK-<slug>.md` | `operations-reports/` | Incident-response playbook — role assignments (IC, comms lead, ops lead, scribe), triage matrix, containment, comms plan. |
| `POSTMORTEM-<slug>.md` | `operations-reports/` | Blameless postmortem — timeline, 5-whys RCA, contributing factors, action items. |
| `OPERATIONS-INDEX.md` | `operations-reports/` | Manifest of inputs → authored artifacts. |
| One `CHANGE-LOG.md` entry | project root | e.g. `Operations: 1 runbook, 1 dashboard(datadog), 6 alerts, 1 SLO(t1), 1 oncall, 1 playbook, 1 postmortem(sev2).` |
| Optional working branch | git | `dca/operations-<stack>-<timestamp>` when `--create-branch` is passed. |

The report follows the [standardized outputs contract](../concepts/standardized-outputs): **Run Info** · **Summary** · **Severity Breakdown** · **By Category** · **Recommendations** · **SLA Status** (unless `--no-sla`) · optional **Delta** (against a prior ops run on the same service). The 15-column Summary maps `id → OPS-<n>`, `severity → {gate, risk, action, info}`, and `category → {runbook, dashboard, alert, slo, oncall, playbook, postmortem}`.

## Modes

Three artifact-scope modes, selected by `--artifacts` and by whether `--incident` / `--incident-in` are set:

| Mode | Trigger | What it does | Best for |
|------|---------|--------------|----------|
| **Full ops kit** (default) | `--artifacts all` (or omitted) or `"full ops kit"` / `"ops pack"` in the prompt | Emits every artifact resolvable given other flags: runbook + dashboard + alerts + SLO + on-call + playbook + postmortem. | New-service observability kickoff; enterprise ops-review baseline. |
| **Individual artifact** | `--artifacts <one>` — one of `runbook`, `dashboard`, `alerts`, `slo`, `oncall-rotation` (alias `oncall`), `playbook`, `postmortem` | Authors exactly the requested artifact using the stack template + observability target. | Focused re-runs; iterating on one artifact; scripted CI paths. |
| **Incident-driven** | `--incident "<text>"` or `--incident-in <path>` | Auto-expands the artifact set to include `runbook + playbook`, and — with `--postmortem-severity` — the `postmortem` template. Incident text feeds runbook symptom + quick-diagnosis, playbook triage + containment, postmortem timeline scaffold. | Live incident response; post-incident authoring. |

## Artifact catalog

`--artifacts` accepts a comma-separated list. `all` expands to every artifact resolvable given other flags. Missing → `all`.

| Artifact key | Written file(s) | Master template | Per-stack guide |
|---|---|---|---|
| `runbook` | `RUNBOOK-<slug>.md` | `templates/runbook.md` | [`resources/runbook-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-operations-agent/resources/runbook-templates) |
| `dashboard` | `dashboard-<target>.{json,yml}` | `templates/dashboard-<target>.{json,yml}` | [`resources/dashboard-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-operations-agent/resources/dashboard-templates) |
| `alerts` | `alerts-<target>.yaml` | `templates/alerts-<target>.yaml` | [`resources/alert-rules/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-operations-agent/resources/alert-rules) |
| `slo` | `SLO-<service>.md` | `templates/slo.md` | [`resources/slo-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-operations-agent/resources/slo-templates) |
| `oncall-rotation` (alias `oncall`) | `oncall-rotation.yaml` | `templates/oncall-rotation.yaml` | (stack-agnostic) |
| `playbook` | `PLAYBOOK-<slug>.md` | `templates/playbook.md` | [`resources/playbook-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-operations-agent/resources/playbook-templates) |
| `postmortem` | `POSTMORTEM-<slug>.md` | `templates/postmortem.md` | [`resources/postmortem-templates/<stack>.md`](https://github.com/mayur434/bmad-dept-coding-agents/tree/main/skills/bmad-dept-code-operations-agent/resources/postmortem-templates) |
| `all` | Every artifact resolvable given other flags. | — | — |

## Observability platform catalog

`--observability` selects the dashboard/alerts target. When omitted, `autoDetectObservability()` in `scripts/run.ts` walks the project root for platform config indicators.

| Target | Template file(s) | Auto-detect signal | Role default |
|---|---|---|---|
| `datadog` | `templates/dashboard-datadog.json` + `templates/alerts-datadog.yaml` | `datadog.yaml` / `.datadog.yml` / `datadog-agent.yaml` / `datadog-config.yaml` | **DevOps default** — broadest coverage. |
| `newrelic` | `templates/dashboard-newrelic.json` | `newrelic.yml` / `newrelic.js` / `newrelic.ini` | Common in **Adobe Commerce PaaS** (Adobe Cloud ships New Relic APM by default). |
| `grafana` | `templates/dashboard-grafana.json` | `grafana/dashboards/*.json` / `grafana.ini` | **Kubernetes / self-managed default** — pairs with Prometheus. |
| `prometheus` | `templates/dashboard-prometheus.yml` + `templates/alerts-prometheus.yaml` | `prometheus.yml` / `prometheus-rules.yaml` | **K8s-ecosystem default** — alerting rules live here. |
| `elastic` | (Kibana JSON — Phase 3.5b) | `filebeat.yml` / `logstash.conf` / `kibana.yml` | Log-heavy stacks (ELK-native shops). |
| `cloudwatch` | (CloudWatch dashboard JSON — Phase 3.5b) | `.cloudwatch/` / `cloudwatch-agent.json` | AWS-native (App Builder often uses CloudWatch for I/O Runtime logs). |
| `dynatrace` | (Dynatrace dashboard JSON — Phase 3.5b) | `dynatrace.yaml` / `oneagent.conf` | Enterprise APM shops. |

**Detection precedence.** First hit wins in the order defined in `autoDetectObservability()`: Datadog → New Relic → Grafana → Prometheus → Elastic → CloudWatch → Dynatrace. Pass `--observability <target>` to override. If nothing matches, the agent surfaces an INFO finding prompting the user to declare a target.

## Service-tier catalog

`--service-tier` keys the SLO defaults. When omitted, the SLO template uses `t2` unless `.bmad/conventions.yaml` overrides.

| Tier | Availability | Latency (p95) | RPO | RTO | Typical services |
|---|---|---|---|---|---|
| `t1` | **99.9%** (43m 49s / month error budget) | ≤ **300ms** | ≤ 5 min | ≤ 15 min | Payment, checkout, auth, cart-total, PDP-add-to-cart. Revenue-critical paths. |
| `t2` | **99.5%** (3h 39m / month) | ≤ **1s** | ≤ 1 h | ≤ 4 h | Catalog, storefront, admin, search, category browse, account. |
| `t3` | **99%** (7h 18m / month) | ≤ **3s** | ≤ 24 h | ≤ 24 h | Internal tooling, admin reports, batch jobs, non-customer-facing pipelines. |

Burn-rate alerts by tier (from `templates/slo.md`): fast burn (2% budget in 1h → paging), slow burn (5% budget in 6h → ticketing), long burn (10% budget in 3d → warning).

## Postmortem severity catalog

`--postmortem-severity` keys the postmortem template's detail level, timeline granularity, and external-comms requirement.

| Severity | Detail level | Timeline granularity | External comms |
|---|---|---|---|
| `sev1` | Full-fidelity — every section required, every action-item owner + due-date. | Per-minute UTC; every escalation, every mitigation, every rollback attempt. | **Required** — customer status page + regulator notification if PII/PCI/HIPAA touched. |
| `sev2` | Standard — every section required, action-items may deferred-batch. | Per-5-min UTC; key inflection points. | Optional — internal-only unless customer-facing impact confirmed. |
| `sev3` | Lightweight — summary + timeline + top-3 action items. | Per-15-min or event-only. | Internal only. |

## Trigger phrases

Paste any of these into the agent chat — the agent auto-detects the stack, observability target, service, and role.

```text
full ops kit for checkout-api tier-1 on Datadog
runbook for the dispatcher hit-ratio drop
Datadog dashboard for our Spring checkout service
Prometheus alerts for the promotions service
SLOs for tier-1 checkout-api
on-call rotation for the payment team
STRIDE playbook for a suspected data breach
postmortem for 2026-08-15 SEV1 --incident-in ./incidents/2026-08-15.md
ops as devops
list operations engines
```

The full copy-paste catalog is in the [Operations prompts reference](../reference/prompts/operations).

## CLI usage (technical mode)

The canonical invocation:

```bash
npx ts-node .claude/skills/bmad-dept-code-operations-agent/scripts/run.ts \
  --path . --artifacts all --service checkout-api --service-tier t1 --observability datadog
```

**One artifact per example** — copy-paste-friendly:

```bash
# Runbook for a specific incident symptom
npx ts-node .claude/skills/bmad-dept-code-operations-agent/scripts/run.ts \
  --path . --artifacts runbook --incident "dispatcher hit-ratio dropped below 90%"
```

```bash
# Datadog dashboard for a Spring service
npx ts-node .claude/skills/bmad-dept-code-operations-agent/scripts/run.ts \
  --path . --artifacts dashboard --engine spring --service checkout-service --observability datadog
```

```bash
# Prometheus alerts for a service
npx ts-node .claude/skills/bmad-dept-code-operations-agent/scripts/run.ts \
  --path . --artifacts alerts --observability prometheus --service promotions-service
```

```bash
# SLO doc for a tier-1 service
npx ts-node .claude/skills/bmad-dept-code-operations-agent/scripts/run.ts \
  --path . --artifacts slo --service checkout-api --service-tier t1
```

```bash
# On-call rotation
npx ts-node .claude/skills/bmad-dept-code-operations-agent/scripts/run.ts \
  --path . --artifacts oncall-rotation
```

```bash
# STRIDE playbook for a suspected security incident
npx ts-node .claude/skills/bmad-dept-code-operations-agent/scripts/run.ts \
  --path . --artifacts playbook --incident "suspected data breach"
```

```bash
# Blameless postmortem from an incident log
npx ts-node .claude/skills/bmad-dept-code-operations-agent/scripts/run.ts \
  --path . --artifacts postmortem --postmortem-severity sev1 --incident-in ./incidents/2026-08-15.md
```

The Preflight advisory prints on every run — see [The Agents](../concepts/the-agents) for how STATIC / LLM / HYBRID is decided (Operations is LLM-heavy for runbook / SLO / playbook / postmortem prose and template-driven for dashboard / alert placeholders), and [Auto-install](../concepts/auto-install) for the first-run dependency bootstrap.

## Flags reference

Every flag listed here is wired in `scripts/run.ts`.

### Operations-specific

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--observability <target>` | enum | auto-detect | Dashboard / alerts target. Values: `datadog`, `newrelic`, `grafana`, `prometheus`, `elastic`, `cloudwatch`, `dynatrace`. |
| `--incident <text>` | string | — | Natural-language incident description for runbook / playbook / postmortem authoring. |
| `--incident-in <path>` | path | — | Existing incident log / timeline to enrich into a postmortem (`.md` / `.txt` / `.json`). |
| `--service <name>` | string | — | Service name for dashboard / alerts / SLO artifacts (e.g. `checkout-api`, `catalog-service`, `author-tier`). |
| `--service-tier <t1\|t2\|t3>` | enum | `t2` | Service criticality tier for SLO defaults (t1 = 99.9%, t2 = 99.5%, t3 = 99%). |
| `--postmortem-severity <sev>` | enum | — | Postmortem template severity. Values: `sev1`, `sev2`, `sev3`. |
| `--artifacts <csv>` | csv | `all` | Which artifacts to author. Values: `runbook`, `dashboard`, `alerts`, `slo`, `oncall-rotation` (alias `oncall`), `playbook`, `postmortem`, `all`. |
| `--format <markdown\|both>` | enum | `markdown` | Output format. `both` currently writes markdown only (docx planned) with a stderr warning. |

### Standard (shared with every DCA agent)

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--path <dir>` | string | `.` | Project root — used for stack + observability auto-detection and as the output base. |
| `--engine <id>` | enum | auto | One of `aem`, `commerce-paas` (alias `commerce`), `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`. |
| `--output <dir>` | dir | `<project>/operations-reports/` | Override the report directory. |
| `--role <code>` | enum | `.bmad/role.yaml` | Role adaptation: `ea` \| `tl` \| `de` \| `qa` \| `devops` \| `security` \| `pm` \| `ba` \| `migration` \| `content` \| `generic`. Wins for one run. |
| `--interactive` | bool | false | Force interactive intake (step-by-step questions). Persists to `.bmad/intake.yaml`. |
| `--technical` | bool | false | Force technical intake mode. |
| `--create-branch` | bool | false | Cut `dca/operations-<stack>-<timestamp>` before writing outputs. |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. Cascade: `production → main → master → develop`. |
| `--preflight` | bool | false | Print the LLM / context-window advisory and exit. |
| `--no-preflight` | bool | false | Suppress the preflight advisory that otherwise prints on every run. |
| `--yes-install` | bool | false | First-run dependency install without confirmation. |
| `--no-install` | bool | false | Error out if deps are missing. |
| `--list-engines` | bool | false | Print the 8 stacks and exit. |
| `--help` | bool | false | Show help. |

### Findings gate (Enterprise Phase 1)

Shared with every DCA agent. See [Findings Gate](../concepts/findings-gate) for the full mechanics — for Operations, decisions apply to ops-artifact items: **accepted** (approved for production — alert live, SLO adopted, runbook step signed off) / **deferred** (needs tuning — moves to SLA sheet with `next-review`) / **wontfix** (accepted risk / not applicable — suppressed from Summary).

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--include-decided` | bool | false | Bypass the decisions gate — show items already decided in `.bmad/decisions.yaml`. |
| `--decisions-path <path>` | string | `<projectRoot>/.bmad/decisions.yaml` | Override the decisions file. |
| `--ignore-decision-expiry` | bool | false | Treat expired decisions as still active for this run. |
| `--list-decisions` | bool | false | Print all decisions and exit. |

### SLA tracking (Enterprise Phase 1)

Shared with every DCA agent. See [SLA Tracking](../concepts/sla-tracking) — for Operations, SLA is an **ops-artifact-review SLA**: how long an alert rule (or any ops artifact finding) can sit in `draft` per role before it becomes OVERDUE and blocks adoption / release.

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--sla-path <path>` | string | `<projectRoot>/.bmad/sla.yaml` | Override the SLA file. |
| `--no-sla` | bool | false | Skip the SLA sheet and computation. |
| `--fail-on-overdue` | bool | false | Exit code 6 if any surviving finding is OVERDUE per role SLA. Wire into CI to fail the release pipeline when a `gate` ops-artifact item has sat in `draft` too long. |

## What's new in Phase 3

Operations is the **9th agent** in the DCA suite and closes SDLC phase 6 (Ops / Monitoring). It completes Phase 3 alongside **Release** (phase 5), leaving **Phase 4** (Code Review + Compliance) as the last stretch on the original roadmap.

- **Requirements** (Phase 2 — 6th agent) — BRD + user stories + AC upstream of any design.
- **Architecture** (Phase 2 — 7th agent) — ADR + HLD + LLD + API + diagrams + STRIDE + data model.
- **Release** (Phase 3 — 8th agent) — pipeline + notes + deploy + rollback + env-diff + announcement.
- **Operations** (Phase 3 — 9th agent, this one) — runbook + dashboard + alerts + SLO + on-call + playbook + postmortem.

The natural fan-out from a Release run: **`release → operations`** — post-deploy runbook + alerts wired from the deploy plan, on-call rotation referenced from the release-day comms plan.

## Example workflow — checkout-api ops kickoff

**Chat trigger 1 — the full ops kit:**

```text
full ops kit for checkout-api, tier-1, on Datadog
```

**Resolved CLI:**

```bash
npx ts-node .claude/skills/bmad-dept-code-operations-agent/scripts/run.ts \
  --path . --artifacts all --service checkout-api --service-tier t1 --observability datadog \
  --technical --no-preflight --yes-install
```

**Chat trigger 2 — incident-driven runbook + playbook:**

```text
runbook + playbook for the checkout latency spike
```

**Chat trigger 3 — post-incident, blameless postmortem from a log:**

```text
postmortem for last week's SEV1 --incident-in ./incidents/2026-08-15.md
```

**Chained SDLC pass — release → operations:**

```text
wire the post-deploy alerts + runbook + on-call for release 2.5.0
```

**Outputs (composite):**

```
operations-reports/
├── operations-main-20260810_120000-agent-report.xlsx
├── operations-main-20260810_120000-agent-report.md
├── RUNBOOK-checkout-latency-spike.md
├── dashboard-datadog.json              ← 8 widgets, template vars env/service/region
├── alerts-datadog.yaml                 ← 6 monitors: 5xx, hit-ratio, p95, queue, CPU, GraphQL
├── SLO-checkout-api.md                 ← availability 99.9% + p95 300ms + burn-rate policy
├── oncall-rotation.yaml                ← primary + secondary + escalation, weekly handoff
├── PLAYBOOK-suspected-data-breach.md   ← STRIDE-informed role assignments
├── POSTMORTEM-payment-outage.md        ← blameless template, sev1 detail level
└── OPERATIONS-INDEX.md
CHANGE-LOG.md                            ← one new entry per run
```

## Cross-agent chaining hints per role

The Operations agent adapts its **default artifact set**, **service-tier default**, and **recommended follow-up** to the resolved [role](../concepts/role-adaptation):

| Role | Default artifact set | Emphasis | Next agent |
|------|----------------------|----------|-----------|
| `ea` | `slo,dashboard` | Portfolio-level observability strategy; SLO-standardization ADRs; multi-team dashboard rollup; error-budget aggregation. | [Architecture](./architecture) — observability-standardization ADR. |
| `tl` | `runbook,dashboard,alerts` | Team-level runbooks; dashboards per component; alert-rule tuning for service ownership; per-team on-call. | [Audit](./audit) — baseline quality of the alerted components. |
| `de` | `runbook,dashboard` | Component-level runbooks; per-endpoint dashboard tiles; alerting for developer-owned endpoints. | [Impact Analysis](./impact-analysis) — blast radius of the alert-firing metrics. |
| `qa` | `runbook,alerts` | Regression-alert rules; test-env dashboards; postmortem contributor for repro/verify steps. | [Test Coverage](./test-coverage) — coverage of the components that own alerting SLIs. |
| `devops` | `dashboard,alerts,slo,oncall-rotation` | **Primary role for this agent.** Pipeline-adjacent dashboards; CI-integrated alerts; SLO-driven deploy gates; on-call rotation; error-budget-aware release freeze. | [Release](./release) — wire alerts into the deploy plan; block ship on active SEV1. |
| `security` | `playbook,postmortem,alerts` | **Secondary primary role.** STRIDE-informed incident playbooks; audit-log dashboards; SIEM-integrated alerts; PII-leak alert rules; incident-response comms templates (customer + regulator). | [Sonar Scan](./sonar-scan) — vuln scan for the paths that triggered the alert. |
| `pm` | `slo,dashboard,postmortem` | SLO-attainment + business-metric dashboards; incident-communication templates; postmortem business-impact section; adoption / KPI tiles. | [Requirements](./requirements) — reconcile SLO targets against the BRD. |
| `ba` | `dashboard,slo` | Feature-outcome dashboards; SLI selection for business-facing endpoints; postmortem business-impact contributor. | [Requirements](./requirements) — link SLOs to BRD acceptance criteria. |
| `migration` | `runbook,dashboard,playbook` | Migration-window observability (before/after health checks); cutover-day runbook; rollback-decision dashboard; parallel-run health check. | [Release](./release) — cross-reference the cutover runbook with the rollback plan. |
| `content` | `dashboard,alerts,runbook` | Publish-lag + dispatcher hit-ratio dashboards for content paths; replication queue health; content-ops runbook. | [Code Generation](./code-generation) — scaffold the block/CF that keeps failing publish. |
| `generic` | `all` | Balanced default — every artifact resolvable. | [Audit](./audit) — ops posture against the code base. |

The resolved role is exposed to child engines via `process.env.DCA_ROLE`, recorded on the **Run Info** sheet, and printed to stderr on every run.

## Per-stack notes

The Operations agent loads up to **six per-stack resource files** at authoring time — a 6-pack per stack (runbook + dashboard + alerts + SLO + playbook + postmortem — on-call is stack-agnostic). See the [Observability concept](../concepts/observability) for the full 6-pack model.

| Stack | Engine ID | Runbook | Dashboard | Alerts | SLO | Playbook | Postmortem |
|-------|-----------|---------|-----------|--------|-----|----------|------------|
| AEM (AEMaaCS + AMS) | `aem` | [runbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/runbook-templates/aem.md) | [dashboard](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/dashboard-templates/aem.md) | [alerts](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/alert-rules/aem.md) | [slo](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/slo-templates/aem.md) | [playbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/playbook-templates/aem.md) | [postmortem](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/postmortem-templates/aem.md) |
| Adobe Commerce (PaaS) | `commerce-paas` / `commerce` | [runbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/runbook-templates/commerce-paas.md) | [dashboard](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/dashboard-templates/commerce-paas.md) | [alerts](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/alert-rules/commerce-paas.md) | [slo](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/slo-templates/commerce-paas.md) | [playbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/playbook-templates/commerce-paas.md) | [postmortem](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/postmortem-templates/commerce-paas.md) |
| Adobe Commerce SaaS | `commerce-saas` | [runbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/runbook-templates/commerce-saas.md) | [dashboard](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/dashboard-templates/commerce-saas.md) | [alerts](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/alert-rules/commerce-saas.md) | [slo](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/slo-templates/commerce-saas.md) | [playbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/playbook-templates/commerce-saas.md) | [postmortem](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/postmortem-templates/commerce-saas.md) |
| Sling / Shaft | `sling` | [runbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/runbook-templates/sling.md) | [dashboard](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/dashboard-templates/sling.md) | [alerts](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/alert-rules/sling.md) | [slo](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/slo-templates/sling.md) | [playbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/playbook-templates/sling.md) | [postmortem](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/postmortem-templates/sling.md) |
| Spring Boot | `spring` | [runbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/runbook-templates/spring.md) | [dashboard](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/dashboard-templates/spring.md) | [alerts](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/alert-rules/spring.md) | [slo](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/slo-templates/spring.md) | [playbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/playbook-templates/spring.md) | [postmortem](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/postmortem-templates/spring.md) |
| Adobe App Builder | `app-builder` | [runbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/runbook-templates/app-builder.md) | [dashboard](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/dashboard-templates/app-builder.md) | [alerts](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/alert-rules/app-builder.md) | [slo](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/slo-templates/app-builder.md) | [playbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/playbook-templates/app-builder.md) | [postmortem](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/postmortem-templates/app-builder.md) |
| Edge Delivery Services | `eds` | [runbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/runbook-templates/eds.md) | [dashboard](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/dashboard-templates/eds.md) | [alerts](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/alert-rules/eds.md) | [slo](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/slo-templates/eds.md) | [playbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/playbook-templates/eds.md) | [postmortem](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/postmortem-templates/eds.md) |
| EDS + Commerce | `eds-commerce` | [runbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/runbook-templates/eds-commerce.md) | [dashboard](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/dashboard-templates/eds-commerce.md) | [alerts](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/alert-rules/eds-commerce.md) | [slo](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/slo-templates/eds-commerce.md) | [playbook](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/playbook-templates/eds-commerce.md) | [postmortem](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/resources/postmortem-templates/eds-commerce.md) |

## See also

- [Operations prompts catalog](../reference/prompts/operations) — 100+ copy-paste prompts across stacks, roles, observability platforms, and artifact types.
- [Observability concept](../concepts/observability) — the 7-artifact model, 7-platform catalog, service-tier framework, per-stack knowledge packs.
- [CLI Flags reference](../reference/cli-flags) — including the Enterprise Phase 1 flags shared across all agents.
- [Release agent](./release) — upstream partner; post-deploy runbook + alerts wire-up starts from the deploy plan.
- [Architecture agent](./architecture) — STRIDE threat models inform security playbooks; observability ADR closes the loop back to portfolio strategy.
- [Audit agent](./audit) · [Sonar Scan agent](./sonar-scan) — findings feed alert rules; CRITICAL audit findings become on-call alerts.
- [Findings gate](../concepts/findings-gate) — accept / defer / wontfix ops-artifact items.
- [SLA tracking](../concepts/sla-tracking) — ops-artifact-review SLA per role; wire `--fail-on-overdue` into CI.
- [Standardized outputs contract](../concepts/standardized-outputs) — 15-column Summary + fixed sheet order.
- [Role adaptation](../concepts/role-adaptation) — how default artifact set + emphasis + follow-up change per role.
