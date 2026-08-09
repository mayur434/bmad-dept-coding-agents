---
id: observability
title: Observability
sidebar_position: 14
description: How BMAD DCA authors observability artifacts — runbooks, dashboards, alerts, SLOs, on-call rotations, incident playbooks, and blameless postmortems — across 7 observability platforms and 8 Adobe/JVM stacks.
keywords:
  - observability
  - sre
  - runbook
  - dashboard
  - alerts
  - slo
  - sli
  - oncall
  - datadog
  - grafana
  - prometheus
  - incident response
  - postmortem
---

The **Observability** concept underpins the [Operations agent](../agents/operations) — the ninth agent of the BMAD DCA suite, added in Phase 3 as the fourth SDLC-alignment agent (after Requirements, Architecture, and Release). This page explains the 7-artifact model, the 7-platform observability catalog, the service-tier framework, the postmortem-severity framework, per-stack knowledge packs, the three authoring modes, and how the output feeds the rest of the DCA workflow.

## Why an operations agent

The first eight agents cover SDLC phases 1 (Requirements), 2 (Design), 3–4 (build, test, harden, analyze), and 5 (Deploy/Release). That left **phase 6 (Ops / Monitoring)** with no DCA coverage — and in practice, that's where teams accrue the deepest quality debt: dashboards drift out of sync with the deploy shape; alert rules are copy-pasted from a colleague and never re-tuned; SLOs are aspirational, not measured; on-call rotations exist as spreadsheets in a shared drive; runbooks were written once and never touched again; incident retros go in a doc that never becomes action items.

Operations closes phase 6 downstream of Release, and completes Phase 3 alongside it. Enterprise value:

- **Consistent SRE artifacts across teams** — one stack-native shape for a dashboard whether the change lives in an AEM repo, a Commerce PaaS repo, an EDS repo, or a Spring service. Every widget, every alert threshold, every SLO SLI rendered the same way.
- **Incident-driven runbook authoring** — passing `--incident "<text>"` (or `--incident-in <path>`) auto-expands the artifact set to include a runbook + a playbook, so the artifact library grows with the incident history instead of decaying.
- **Blameless postmortem enforcement** — the postmortem template enforces blameless language, forces a full-fidelity timeline (per-minute for SEV1, per-5-min for SEV2, per-15-min for SEV3), and requires an action-items table with owner + due-date + priority.
- **Per-stack observability defaults** — AEM projects default to Datadog + dispatcher hit-ratio + Cloud Manager health; Commerce PaaS defaults to New Relic (Adobe Cloud APM); Spring projects to Grafana + Prometheus + Micrometer; EDS to LCP p75 + block-load success — every stack ships with the right metric surface.
- **Enterprise gates** — participates in the shared [Findings Gate](./findings-gate) (`accepted` / `deferred` / `wontfix` for ops-artifact items) and [SLA Tracking](./sla-tracking) (ops-artifact-review SLA per role — how long a `gate` alert-rule can sit in `draft` before it blocks adoption).

## The 7-artifact model

Operations produces up to seven distinct artifact types per run. Each is a row category in the standardized Summary sheet AND a written file in `operations-reports/`:

| Artifact | File | Primary consumer | Typical driving role | Master template |
|----------|------|------------------|----------------------|-----------------|
| **Runbook** | `RUNBOOK-<slug>.md` | On-call engineer at 3 AM | `devops`, `tl`, `de`, `content`, `migration` | `templates/runbook.md` |
| **Dashboard** | `dashboard-<target>.{json,yml}` | Team dashboard wall + release war-room | `devops`, `tl`, `de`, `ea`, `pm` | `templates/dashboard-<target>.{json,yml}` |
| **Alerts** | `alerts-<target>.yaml` | PagerDuty / Opsgenie / on-call | `devops`, `security`, `qa` | `templates/alerts-<target>.yaml` |
| **SLO** | `SLO-<service>.md` | SRE + product + ops-review | `devops`, `ea`, `pm`, `ba` | `templates/slo.md` |
| **On-call rotation** | `oncall-rotation.yaml` | PagerDuty / Opsgenie import | `devops`, `tl` | `templates/oncall-rotation.yaml` |
| **Playbook** | `PLAYBOOK-<slug>.md` | Incident commander + comms lead | `devops`, `security` | `templates/playbook.md` |
| **Postmortem** | `POSTMORTEM-<slug>.md` | Team retro + leadership review | `security`, `pm`, `devops`, `qa` | `templates/postmortem.md` |

Every row in the workbook conforms to the 15-column Summary contract with these key columns:

| Column | Value for an operations row |
|--------|-----------------------------|
| `id` | `OPS-<n>` (monotonic per run) |
| `title` | Artifact / item title — runbook step / widget name / alert rule / SLI / on-call layer / playbook phase / timeline entry |
| `category` | `runbook` \| `dashboard` \| `alert` \| `slo` \| `oncall` \| `playbook` \| `postmortem` |
| `severity` | `gate` \| `risk` \| `action` \| `info` (`gate`≈CRITICAL, `risk`≈HIGH, `action`≈MEDIUM, `info`≈LOW) |
| `confidence` | `high` (explicit answer / config file / known idiom) \| `medium` (LLM-authored, template-aligned) \| `low` (inferred — needs tuning) |
| `ruleId` | `OPS-<stack>-<type>` (e.g. `OPS-aem-runbook-dispatcher`, `OPS-spring-alert-p99`, `OPS-eds-slo-lcp`) |
| `code-reference` | Emitted artifact path (`RUNBOOK-*.md#step-3` / `dashboard-datadog.json#/widgets/2` / `alerts-prometheus.yaml#/groups/latency/rules/p99`) |
| `status` | `draft` (default) \| `reviewed` \| `approved` \| `active` — advances via the [decisions gate](./findings-gate) and post-adoption update |

Full row-shape spec on the [Standardized Outputs](./standardized-outputs) page.

## The 7-platform catalog

`--observability` selects the dashboard/alerts target. When omitted, `autoDetectObservability()` walks the project root for platform config indicators.

| Target | Auto-detect signal | Per-stack preference |
|---|---|---|
| `datadog` | `datadog.yaml` / `.datadog.yml` / `datadog-agent.yaml` / `datadog-config.yaml` | **AEM, Spring** default — DevOps role default; Terraform provider is mature. |
| `newrelic` | `newrelic.yml` / `newrelic.js` / `newrelic.ini` | **Commerce PaaS** default (Adobe Cloud ships New Relic APM). |
| `grafana` | `grafana/dashboards/*.json` / `grafana.ini` | **Kubernetes / self-managed** default — pairs with Prometheus. |
| `prometheus` | `prometheus.yml` / `prometheus-rules.yaml` | **K8s-ecosystem** default — alerting rules live here; visualization typically Grafana. |
| `elastic` | `filebeat.yml` / `logstash.conf` / `kibana.yml` | Log-heavy stacks (ELK-native shops). |
| `cloudwatch` | `.cloudwatch/` / `cloudwatch-agent.json` | **App Builder** often uses CloudWatch for I/O Runtime logs. |
| `dynatrace` | `dynatrace.yaml` / `oneagent.conf` | Enterprise APM shops. |

**Detection precedence.** First hit wins in the source order defined in `autoDetectObservability()`: Datadog → New Relic → Grafana → Prometheus → Elastic → CloudWatch → Dynatrace. Pass `--observability <target>` to override.

## The service-tier framework

`--service-tier` keys the SLO defaults. When omitted, the SLO template uses `t2` unless `.bmad/conventions.yaml` overrides.

| Tier | Availability | Latency (p95) | RPO | RTO | Typical services |
|---|---|---|---|---|---|
| `t1` | **99.9%** (43m 49s / month) | ≤ **300ms** | ≤ 5 min | ≤ 15 min | Payment, checkout, auth, cart-total, PDP-add-to-cart. |
| `t2` | **99.5%** (3h 39m / month) | ≤ **1s** | ≤ 1 h | ≤ 4 h | Catalog, storefront, admin, search, account. |
| `t3` | **99%** (7h 18m / month) | ≤ **3s** | ≤ 24 h | ≤ 24 h | Internal tooling, admin reports, batch jobs. |

**Burn-rate alerts by tier** (from `templates/slo.md`): fast burn (2% budget in 1h → paging), slow burn (5% budget in 6h → ticketing), long burn (10% budget in 3d → warning).

## The postmortem-severity framework

`--postmortem-severity` keys the postmortem template's detail level, timeline granularity, and external-comms requirement.

| Severity | Detail level | Timeline granularity | External comms |
|---|---|---|---|
| `sev1` | Full-fidelity — every section required, every action-item owner + due-date. | Per-minute UTC | **Required** — customer status page + regulator if PII/PCI/HIPAA touched. |
| `sev2` | Standard — every section required, action-items may deferred-batch. | Per-5-min UTC | Optional — internal-only unless customer impact confirmed. |
| `sev3` | Lightweight — summary + timeline + top-3 action items. | Per-15-min or event-only | Internal only. |

## Per-stack knowledge packs

For each of the 8 stacks Operations loads **up to six per-stack resource files** at authoring time — a 6-pack per stack (runbook + dashboard + alerts + SLO + playbook + postmortem — on-call is stack-agnostic since it's the same YAML shape everywhere). Together they keep every artifact stack-native — an AEM runbook reads like an AEM runbook, not a generic doc with "AEM" sprinkled in:

| Pack | Path | Purpose |
|------|------|---------|
| **Runbook template** | `resources/runbook-templates/<stack>.md` | Stack-specific quick-diagnosis commands + likely-cause list + mitigation steps (AEM: `/dispatcher/publish/health` + `/system/console/healthcheck`; Commerce PaaS: `bin/magento indexer:status`; Spring: `/actuator/health/readiness`). |
| **Dashboard template** | `resources/dashboard-templates/<stack>.md` | Stack-specific widget catalogue (AEM: dispatcher hit-ratio, Publish 5xx, replication queue depth; Spring: JVM heap, HikariCP pool saturation, Kafka lag). |
| **Alerts template** | `resources/alert-rules/<stack>.md` | Stack-specific alert categories + thresholds keyed to service tier (AEM: `publish_5xx > 1%`; Commerce PaaS: `payment_gateway_error > 0.5%`; Spring: `p99 > 500ms for 5m`). |
| **SLO template** | `resources/slo-templates/<stack>.md` | Stack-specific SLI selection (AEM: dispatcher availability; Commerce PaaS: checkout success; Spring: actuator-derived HTTP metrics; EDS: LCP p75). |
| **Playbook template** | `resources/playbook-templates/<stack>.md` | Stack-specific containment + eradication + recovery steps + STRIDE tags for security incidents. |
| **Postmortem template** | `resources/postmortem-templates/<stack>.md` | Stack-specific contributing-factor prompts + typical rollback / recovery patterns to seed the RCA. |

Total: **48 per-stack guides** (6 packs × 8 stacks). Analogous to the Release 6-pack (pipeline / notes / deploy / rollback / env-diff / announcement).

## Three modes

### Full ops kit (default)

**Trigger:** `--artifacts all` (or omitted), or `"full ops kit"` / `"ops pack"` in the prompt.

Emits every artifact resolvable given other flags. Use this for a new-service observability kickoff, an enterprise ops-review baseline, or a quarterly refresh.

**Worked example:**

```text
full ops kit for checkout-api tier-1 on Datadog
```

Resolves to `--service checkout-api --service-tier t1 --observability datadog --artifacts all` and produces `RUNBOOK-*.md` + `dashboard-datadog.json` + `alerts-datadog.yaml` + `SLO-checkout-api.md` + `oncall-rotation.yaml` + `PLAYBOOK-*.md` + `POSTMORTEM-*.md` alongside the workbook.

### Individual artifact

**Trigger:** `--artifacts <one>` — one of `runbook`, `dashboard`, `alerts`, `slo`, `oncall-rotation` (alias `oncall`), `playbook`, `postmortem`.

Authors exactly the requested artifact using the stack template and available inputs. Use this for focused re-runs, iterating on one artifact, or scripted CI paths that own each artifact separately.

**Worked example:**

```text
Prometheus alerts for the promotions service
```

Resolves to `--artifacts alerts --observability prometheus --service promotions-service`, produces `alerts-prometheus.yaml` only, and skips runbook / dashboard / SLO / on-call / playbook / postmortem.

### Incident-driven

**Trigger:** `--incident "<text>"` or `--incident-in <path>`.

Auto-expands the artifact set to include `runbook + playbook`, and — with `--postmortem-severity` — the `postmortem` template. The incident text (or log contents) feeds the runbook's symptom + quick-diagnosis, the playbook's triage + containment, and the postmortem's incident-summary + timeline scaffold.

**Worked example:**

```text
postmortem for 2026-08-15 SEV1 --incident-in ./incidents/2026-08-15.md
```

Resolves to `--artifacts postmortem --postmortem-severity sev1 --incident-in ./incidents/2026-08-15.md` and produces `POSTMORTEM-*.md` with a per-minute UTC timeline and required external-comms callouts.

## Role-adaptation for operations

Operations adapts the **default artifact set**, the **service-tier default**, and the **recommended follow-up** to the resolved role — same [role-adaptation](./role-adaptation) mechanism the other eight agents use. **DevOps is the PRIMARY role** for this agent (dashboard + alerts + SLO + on-call); **Security is the SECONDARY primary role** (playbook + audit-log dashboards + SIEM alerts + PII-leak rules).

| Role | Typically requests |
|------|--------------------|
| `ea` | Portfolio-level observability strategy; SLO-standardization ADRs; multi-team dashboard rollup; error-budget aggregation. |
| `tl` | Team-level runbooks + dashboards + alert-rule tuning per component ownership. |
| `de` | Component-level runbooks + per-endpoint dashboard tiles + per-service log correlation. |
| `qa` | Regression-alert rules + test-env dashboards + postmortem contribution for repro / verify steps. |
| `devops` | **Primary role.** Pipeline-adjacent dashboards + CI-integrated alerts + SLO-driven deploy gates + on-call rotation. |
| `security` | **Secondary primary role.** STRIDE-informed incident playbooks + audit-log dashboards + SIEM-integrated alerts + PII-leak alert rules + comms templates. |
| `pm` | SLO-attainment + business-metric dashboards + incident-communication templates + postmortem business-impact. |
| `ba` | Feature-outcome dashboards + SLI selection for business-facing endpoints. |
| `migration` | Migration-window observability (before/after health checks) + cutover-day runbook + rollback-decision dashboard. |
| `content` | Publish-lag + dispatcher hit-ratio dashboards + content-ops runbook. |
| `generic` | Balanced default — every artifact resolvable. |

Full role matrix on the [Operations agent page](../agents/operations#cross-agent-chaining-hints-per-role) and in the source [`SKILL.md` § Role-aware behavior](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-operations-agent/SKILL.md#role-aware-behavior).

## Traceability

Every ops-artifact finding row is written to the standardized report **and** to a findings cache at `.bmad/cache/operations-<hash>.json`. That cache is consumed by downstream analysis agents via the shared [findings-cache](./findings-cache) contract — Impact Analysis can trace `OPS-<n>` rows back to the components that own each alerting SLI, Test Coverage can re-check that the failing path had test coverage during a postmortem authoring pass, Sonar Scan can vuln-scan the paths that triggered an alert.

**Upstream:** the [Release agent](../agents/release) deploy plan references the runbook + on-call rotation. Release-day comms cite the alert rules the ops agent authored.

**Downstream:** post-incident, Postmortem authoring pulls context from Impact Analysis (blast radius) + Test Coverage (was the failing path covered?) runs.

## STRIDE integration

The Playbook artifact is **STRIDE-informed for security incidents** — same STRIDE framework the [Architecture agent](../agents/architecture) uses for its threat models. This creates a **bi-directional loop**:

- **Architecture → Operations** — a STRIDE threat model authored by Architecture surfaces a Tampering or Elevation-of-Privilege risk. Operations authors a Playbook whose containment + eradication + recovery steps directly correspond to that STRIDE category.
- **Operations → Architecture** — an incident on a not-previously-modeled surface prompts an Architecture pass to add the STRIDE category to the portfolio threat model.

The security role explicitly benefits from this: `--role security` biases the artifact set toward `playbook,postmortem,alerts` and offers `sonar-scan` for the paths that triggered the alert as the recommended follow-up.

## Output artifacts

Every operations run writes into `<project>/operations-reports/` (override with `--output`):

- `operations-<branch>-<timestamp>-agent-report.xlsx` — the standardized workbook.
- `operations-<branch>-<timestamp>-agent-report.md` — the Markdown twin.
- `RUNBOOK-<slug>.md` — per incident symptom.
- `dashboard-<target>.{json,yml}` — dashboard-as-code for the resolved observability platform.
- `alerts-<target>.yaml` — alert rules for the resolved observability platform.
- `SLO-<service>.md` — SLO/SLI doc with error-budget policy + burn-rate alerts.
- `oncall-rotation.yaml` — primary + secondary + escalation layers.
- `PLAYBOOK-<slug>.md` — incident-response playbook.
- `POSTMORTEM-<slug>.md` — blameless postmortem template.
- `OPERATIONS-INDEX.md` — always emitted; manifest of inputs → artifacts.
- One `CHANGE-LOG.md` entry spliced into project root.

Optional `--format both` is currently **stubbed** — it logs a warning on stderr and falls back to markdown. The docx writer lands in a later phase.

## Ops-artifact-approval gate integration

The [Findings Gate](./findings-gate) applies to ops-artifact items directly — the mapping is one-to-one:

| Decision status | Effect on the ops-artifact item |
|-----------------|---------------------------------|
| `accepted` | Approved for production — alert live, SLO adopted, runbook step signed off. Frozen at current confidence; future reruns don't re-surface it. |
| `deferred` | Needs tuning — alert threshold too chatty, dashboard widget query too slow, SLO target too aggressive. Moves to SLA sheet with `next-review` date. |
| `wontfix` | Accepted risk / not applicable — an alert category the team consciously decided not to page on; a runbook step documented but skipped. Suppressed from Summary. |

Combine this with the ops-artifact-review **SLA per role** (see [SLA Tracking](./sla-tracking)) to gate CI on stale approvals: `--fail-on-overdue` exits with code 6 when any ops-artifact item has sat past its role SLA. Default thresholds — for `gate` severity: `devops` / `security` / `qa` 1 day, `tl` / `ea` / `pm` 2 days. See the source SKILL for the full matrix per severity bucket.

## See also

- [Operations agent](../agents/operations) — the per-agent reference (flags, modes, CLI, per-stack notes).
- [Operations prompts catalog](../reference/prompts/operations) — 100+ copy-paste prompts across stacks, roles, observability platforms, and artifact types.
- [Release agent](../agents/release) — upstream partner; deploy plans reference the runbook + on-call rotation.
- [Release Management concept](./release-management) — the 6-artifact sibling model for release.
- [Architecture agent](../agents/architecture) — STRIDE threat models inform security playbooks.
- [Audit agent](../agents/audit) · [Sonar Scan agent](../agents/sonar-scan) — findings feed alert rules.
- [Role adaptation](./role-adaptation) — how default artifact set + emphasis + follow-up change per role.
- [Findings cache](./findings-cache) — how operations output feeds downstream agents.
- [Findings gate](./findings-gate) — accept / defer / wontfix ops-artifact items.
- [SLA tracking](./sla-tracking) — ops-artifact-review SLA per role.
- [One-shot mode](./one-shot-mode) — full precedence rules for silent end-to-end execution.
- [Standardized outputs](./standardized-outputs) — the shared 15-column Summary + fixed sheet order.
