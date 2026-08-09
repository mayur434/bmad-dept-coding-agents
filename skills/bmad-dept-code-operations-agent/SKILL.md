---
name: bmad-dept-code-operations-agent
description: "Operations & SRE Specialist (📊) — the 9th agent of the BMAD DEPT Code Agent suite (audit, generation, impact-analysis, sonar-scan, test-coverage, requirements, architecture, release, operations). Authors runbooks, observability dashboards (Datadog, New Relic, Grafana, Prometheus, Elastic, CloudWatch, Dynatrace), alert rules, SLO/SLI definitions, on-call rotation configs, incident-response playbooks (STRIDE-informed for security incidents), and blameless postmortems. Grounded in per-stack Adobe/JVM ops idioms across all 8 supported stacks."
keywords: ["operations", "ops", "runbook", "dashboard", "alerts", "slo", "sli", "oncall", "observability", "datadog", "newrelic", "grafana", "prometheus", "elastic", "cloudwatch", "dynatrace", "incident response", "postmortem", "sre", "monitoring"]
---

# BMAD DEPT Code Agent — Operations Skill

## Purpose

The **Operations & SRE Specialist (📊)** — the **9th agent** in the BMAD
DEPT Code Agent suite (audit, generation, impact-analysis, sonar-scan,
test-coverage, requirements, architecture, release, **operations**) —
**closes SDLC phase 6 (Ops / Monitoring)**. Where Release ships the
code, Operations owns what happens after: dashboards to see it, alerts
to notice when it breaks, runbooks so someone can fix it at 3 AM, SLOs
to know whether it is meeting its promise, on-call rotations to make
sure someone answers, playbooks to run an incident, and postmortems to
learn from what broke.

It authors:

- **Runbooks** — incident-symptom-based, with exact commands, quantified
  triggers, and escalation matrices — per stack.
- **Observability dashboards (dashboard-as-code)** — Datadog, New Relic,
  Grafana, Prometheus, Elastic (Kibana), CloudWatch, Dynatrace.
- **Alert rules** — Datadog monitors YAML (Terraform provider schema),
  Prometheus `alerting.rules`, and per-platform equivalents.
- **SLO/SLI definitions** — availability, latency, freshness, and
  error-budget policies keyed to `--service-tier`.
- **On-call rotation configs** — PagerDuty / Opsgenie / VictorOps
  compatible YAML — primary, secondary, escalation, holiday overrides.
- **Incident-response playbooks** — STRIDE-informed for security
  incidents; role assignments, containment, comms plan.
- **Blameless postmortems** — chronological timeline, 5-whys RCA,
  contributing factors, action items, lessons learned.

Grounded in per-stack Adobe / JVM ops idioms across **AEM (AEMaaCS +
AMS), Adobe Commerce PaaS (Magento 2), Adobe Commerce SaaS, Apache
Sling / Shaft, Spring Boot, Adobe App Builder, Edge Delivery Services
(EDS), EDS + Commerce hybrid**.

> **Operations is an ops-artifact authoring specialist, not an ops
> executor.** It does not run `kubectl`, install monitoring agents,
> page the on-call, or accept SLOs on behalf of the team. It emits the
> configs your platform (Datadog, PagerDuty, Grafana) consumes and the
> Markdown docs your team adopts. See **Constraints / non-goals** below.

### Two modes

**Full ops kit (default when `--artifacts all`).** Every artifact
resolvable given other flags: runbook + dashboard + alerts + SLO +
on-call rotation + playbook + postmortem.

**Individual artifact.** Narrow to one: `--artifacts runbook`,
`--artifacts dashboard`, `--artifacts alerts`, `--artifacts slo`,
`--artifacts oncall-rotation`, `--artifacts playbook`,
`--artifacts postmortem`.

**Incident-driven.** When `--incident "<text>"` (or `--incident-in
<path>`) is passed, the agent auto-expands the artifact set to include
runbook + playbook, and — with `--postmortem-severity` — the postmortem
template.

## Activation

This skill activates when the user asks to:

- Author a runbook / generate a runbook / write ops runbook
- Generate a dashboard / dashboard-as-code for X / observability dashboard
- Write alert rules / wire alerts for X / Prometheus alerts / Datadog monitors
- Define SLOs / SLI definitions / service level objectives
- Author an on-call rotation / PagerDuty rotation / Opsgenie schedule
- Incident playbook / STRIDE playbook / IR playbook
- Postmortem for X / blameless postmortem / incident retro
- Observability plan / monitoring plan for X

Menu codes (see `skills/module-help.csv`):

| Code | Action |
|------|--------|
| `OP` | Full ops kit (auto-detect stack + observability + all artifacts). |
| `OR` | Runbook (`--artifacts runbook`). |
| `OD` | Dashboard-as-code (`--artifacts dashboard`). |
| `OA` | Alert rules (`--artifacts alerts`). |
| `OL` | SLO/SLI definitions (`--artifacts slo`). |
| `ON` | On-call rotation (`--artifacts oncall-rotation`). |
| `OY` | Incident-response playbook (`--artifacts playbook`). |
| `OM` | Blameless postmortem (`--artifacts postmortem`). |
| `OH` | Author against the AEM stack (`--engine aem`). |
| `OC` | Author against Adobe Commerce PaaS (`--engine commerce-paas`). |
| `OZ` | Author against Adobe Commerce SaaS (`--engine commerce-saas`). |
| `OJ` | Author against Apache Sling / Shaft (`--engine sling`). |
| `OG` | Author against Spring Boot (`--engine spring`). |
| `OB` | Author against Adobe App Builder (`--engine app-builder`). |
| `OE` | Author against Edge Delivery Services (`--engine eds`). |
| `OW` | Author against EDS + Commerce hybrid (`--engine eds-commerce`). |
| `OQ` | List operations engines (`--list-engines`). |

## Prompt → Action Resolution

Map the user's prompt to a `run.ts` invocation. All flags below are
already wired in `scripts/run.ts` (see the CLI reference at the bottom
— no invented flags).

| User says… | Resolves to |
|---|---|
| "author runbook for the checkout latency spike" | `--artifacts runbook --incident "checkout latency spike"` |
| "generate Datadog dashboard for our AEM Publish tier" | `--artifacts dashboard --observability datadog --service publish-tier --engine aem` |
| "wire Prometheus alerts for the promotions service" | `--artifacts alerts --observability prometheus --service promotions-service` |
| "define SLOs for our tier-1 checkout API" | `--artifacts slo --service checkout-api --service-tier t1` |
| "on-call rotation for our payment team" | `--artifacts oncall-rotation` |
| "STRIDE playbook for a suspected data breach" | `--artifacts playbook --incident "suspected data breach"` |
| "postmortem for the 2026-08-15 P1 outage" | `--artifacts postmortem --postmortem-severity sev1 --incident-in ./incidents/2026-08-15.md` |
| "postmortem for the checkout latency spike, sev2" | `--artifacts postmortem --postmortem-severity sev2 --incident "checkout latency spike"` |
| "chain: full ops artifacts for the checkout service" | `--artifacts all --service checkout-api` |
| "ops kit for our Spring middleware, tier-1" | `--artifacts all --engine spring --service-tier t1` |
| "Grafana dashboard-as-code for our K8s fleet" | `--artifacts dashboard --observability grafana` |
| "ops as devops" | `--role devops --artifacts all` |

### Compound resolution

Combine flags when the prompt names multiple inputs:

- "ops kit for AEM as devops, target Datadog, tier-1"
  → `--role devops --engine aem --observability datadog --service-tier t1 --artifacts all`
- "runbook + playbook for the Publish 5xx spike"
  → `--artifacts runbook,playbook --incident "Publish 5xx spike" --engine aem`
- "postmortem for the 2026-08-15 SEV1, plus follow-up runbook"
  → `--artifacts postmortem,runbook --postmortem-severity sev1 --incident-in ./incidents/2026-08-15.md`

### Missing required info — ask (do not guess)

- `--artifacts=runbook` (or `all` with incident intent) but no `--incident`
  and no `--incident-in`:

  > "Which incident symptom should the runbook cover? Give me a short
  > description (e.g. `dispatcher hit-ratio dropped below 90%`) — or point
  > me at an incident log with `--incident-in <path>`."

- `--artifacts=dashboard|alerts|slo` (or `all` requesting service artifacts)
  but no `--service`:

  > "Which service should I author for? (`--service checkout-api`,
  > `catalog-service`, `author-tier`, etc.) — the dashboard, alerts, and
  > SLO all need a service anchor."

- `--artifacts=postmortem` but no `--postmortem-severity`:

  > "Which severity? (`sev1` / `sev2` / `sev3`) — that keys the timeline
  > granularity and comms requirement in the postmortem template."

Everything else has a sensible default: `--observability` auto-detected,
`--engine` auto-detected, `--role` from `.bmad/role.yaml` or `generic`,
`--format markdown`, `--artifacts all`, `--service-tier t2` when
authoring for a service without explicit tier, output at
`<project>/operations-reports/`.

## Intake mode (interactive vs technical)

> **For fast, enterprise-grade execution, prefer One-shot mode (see below).**
> Intake mode is for exploratory / first-time users.

> **CRITICAL:** The very first response to any activation must be the
> intake-mode question — unless `.bmad/intake.yaml` exists with a saved
> preference. Do NOT skip this. Do NOT show a CLI command as the first
> response.

When a user triggers this agent — via a natural-language prompt or a menu
entry — do NOT show or run a raw CLI command as the first response. Ask
which drive style they prefer:

> "Should I drive this **interactively** (I ask you step-by-step questions
> and run everything for you) or **technically** (I show you the CLI command
> with each flag explained, and you decide whether to run it or have me run
> it)?"

Save the answer to `.bmad/intake.yaml` (adjacent to `.bmad/role.yaml`) with
keys `mode: interactive|technical` and `set_at: <ISO-8601>`. On subsequent
runs, read the file silently and skip the prompt unless the user asks to
switch.

To change intake mode later, the user says **"switch intake to interactive"**
or **"switch intake to technical"** — overwrite `.bmad/intake.yaml`.

**Sequencing note.** The `Preflight`, `Pre-flight: Auto-install
Dependencies`, and per-stack authoring sections below must NOT run before
the intake picker resolves. Order for a fresh activation:

1. Resolve intake mode (ask, or read `.bmad/intake.yaml`).
2. If technical → show the command + flag explanations, then run it (with
   the user's OK) or hand off.
3. If interactive → collect the intake questions below, then run silently.
4. Preflight + bootstrap run just before dispatch, once inputs are collected.

### Interactive mode (recommended for first-timers)

Ask one question per turn, in this order. Skip any question the user has
already answered in their initial prompt.

1. "What's the project path? (defaults to current working directory)"
2. "Which stack? (auto-detect / `aem` / `commerce-paas` / `commerce-saas` /
   `sling` / `spring` / `app-builder` / `eds` / `eds-commerce`)"
3. "Which artifacts? (comma-separated:
   `runbook,dashboard,alerts,slo,oncall-rotation,playbook,postmortem,all` —
   default `all`)"
4. If dashboard/alerts in the set → "Observability platform? (auto-detect /
   `datadog` / `newrelic` / `grafana` / `prometheus` / `elastic` /
   `cloudwatch` / `dynatrace`)"
5. If dashboard/alerts/slo in the set → "Service name? (e.g.
   `checkout-api`, `catalog-service`, `author-tier`)"
6. If slo in the set → "Service tier? (`t1` = 99.9% / `t2` = 99.5% /
   `t3` = 99% availability)"
7. If runbook/playbook in the set → "Incident description? (short natural
   language — e.g. `dispatcher hit-ratio dropped below 90%`; blank if
   authoring a general-purpose runbook)"
8. If postmortem in the set → "Existing incident log path?
   (`--incident-in <path>`; blank if authoring from `--incident` text only)"
9. If postmortem in the set → "Postmortem severity? (`sev1` / `sev2` /
   `sev3`)"
10. "Output format? (`markdown` / `both` — docx planned for a later phase,
    currently emits markdown only)"
11. "Cut a working branch from production? (Y/n)"
12. "Ready to run? (Y/n)"

Once every required input is collected, run the command internally (do NOT
show it unless the user asks) and stream results conversationally:

> "Authoring the full ops kit for `checkout-api` (Spring, tier-1) against
> Datadog… runbook (checkout latency spike, 5 quick-diagnosis steps),
> dashboard (`dashboard-datadog.json`, 8 widgets), alerts
> (`alerts-datadog.yaml`, 6 monitors), SLO (`SLO-checkout-api.md`,
> availability 99.9% + p95 300ms + error-budget policy), on-call rotation
> (`oncall-rotation.yaml`, 2-layer + escalation), playbook, postmortem
> template. Report at `operations-reports/operations-main-…-agent-report.xlsx`,
> index at `operations-reports/OPERATIONS-INDEX.md`. Want me to hand the
> alerts pack to the Release agent so the deploy plan references them?"

### Technical mode (for users who want CLI transparency)

Show the fully-formed command in a `bash` code block with one flag per line:

```bash
npx ts-node .claude/skills/bmad-dept-code-operations-agent/scripts/run.ts \
  --path /path/to/project \
  --engine spring \
  --service checkout-api \
  --service-tier t1 \
  --observability datadog \
  --artifacts all \
  --format markdown \
  --create-branch
```

Below the block, add a bulleted list explaining each flag in plain English:

- `--path` — project root; used for stack + observability auto-detection
  and as the base for the output directory.
- `--engine spring` — force the Spring authoring templates; without this
  the dispatcher probes the tree for stack signals.
- `--service checkout-api` — service anchor for the dashboard / alerts /
  SLO artifacts.
- `--service-tier t1` — availability 99.9%, p95 ≤ 300ms defaults for the
  SLO doc (see § Service-tier catalog).
- `--observability datadog` — pin the dashboard/alerts to Datadog;
  auto-detected when omitted.
- `--artifacts all` — every artifact resolvable given other flags; narrow
  with a comma-separated subset (see § Artifact catalog).
- `--format markdown` — output format (docx planned; `both` still writes
  markdown only for now with a warning).
- `--create-branch` — cut a working `dca/operations-<stack>-<timestamp>`
  branch (from `production`/`main`/`master`/`develop`) before writing.

Then ask: **"Want me to run this now, or will you copy-paste it?"**

- If **run for me** → execute silently and stream results (same as interactive mode).
- If **I'll run it** → acknowledge, and remind them: "Report will land in
  `<project>/operations-reports/`. Come back with 'summarize the ops kit'
  or 'wire the alerts into the release plan' when you're done."

## One-shot mode

The **preferred enterprise path.** When the user's initial prompt fully
specifies what to run, do NOT ask any clarifying questions — execute
end-to-end, stream results, done. Use defaults from `.bmad/role.yaml`,
`.bmad/intake.yaml`, `.bmad/conventions.yaml`, and reasonable stack /
observability auto-detection to fill missing inputs.

### When to enter one-shot mode

Trigger phrases (any of):

- "ops kit end-to-end", "no questions, just do it", "one-shot",
  "author the runbook and go", "auto"
- OR any prompt that specifies: (a) the operation (runbook / dashboard /
  alerts / SLO / on-call / playbook / postmortem), (b) the project path
  (default: cwd), (c) at least one of: `--service`, `--incident`,
  `--service-tier`, `--observability`, `--postmortem-severity`

You DO NOT need every field explicitly — role + intake + conventions cover
the rest silently.

### Precedence for missing inputs

1. **Explicit in the user's prompt** (highest — always wins)
2. **`--flag` on run.ts** (headless / CI)
3. **`.bmad/role.yaml`** (role-driven default artifact set + emphasis)
4. **`.bmad/intake.yaml`** (interactive vs technical — one-shot forces technical + skip)
5. **`.bmad/conventions.yaml`** (project conventions: service names, tier defaults, comms channels)
6. **Auto-detected** (stack from repo signatures; observability from
   `datadog.yaml` / `newrelic.yml` / `prometheus.yml` / `grafana/` etc.)
7. **Sensible defaults** (`--service-tier t2`, `--format markdown`,
   `--artifacts all`, output at `operations-reports/`)

### What one-shot DOES silence

- The intake picker ("Interactive or Technical?") — one-shot forces technical.
- The **artifact picker** — one-shot uses the role default (DevOps role
  emphasizes `dashboard,alerts,slo`; Security role emphasizes
  `playbook,postmortem`; other roles → `all`).
- The role picker (if `.bmad/role.yaml` absent) — one-shot uses `generic`
  silently (log to stderr: "one-shot: no role file, defaulting to generic").
- The observability / service-tier / format confirmations — one-shot uses
  defaults or explicit flags.
- The confirmation prompts around `--create-branch`, `--yes-install` —
  one-shot assumes yes for install, no for branch cut unless the prompt
  says otherwise.

### What one-shot DOES ask about (only when truly critical)

- **Runbook with no incident anchor.** If `--artifacts=runbook` (or `all`
  with runbook intent) is requested but `--incident` and `--incident-in`
  are both absent, ask ONCE:

  > "Which incident symptom should the runbook cover? Give me a short
  > description (e.g. `dispatcher hit-ratio dropped below 90%`)."

- **Dashboard / alerts / SLO with no service.** If any of these are
  requested but `--service` was omitted, ask ONCE:

  > "Which service should I author for? (e.g. `--service checkout-api`)."

- **Postmortem with no severity.** If `--artifacts=postmortem` is
  requested but `--postmortem-severity` was omitted, ask ONCE:

  > "Which severity? (`sev1` / `sev2` / `sev3`)"

Everything else stays silent.

### One-shot prompt examples for the Operations agent

Each example shows what the user pastes and what the AI silently resolves.

> **User:** "runbook: dispatcher hit-ratio dropped below 90%"
> **AI silently resolves:** path=cwd, engine=auto-detect (AEM signal),
> artifacts=`runbook`, incident=`dispatcher hit-ratio dropped below 90%`,
> role=(from `.bmad/role.yaml` or `generic`), format=markdown, output-dir=`operations-reports/`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --artifacts runbook --incident "dispatcher hit-ratio dropped below 90%" --technical --no-preflight --yes-install`
> **AI reports:** "Runbook authored: 5 quick-diagnosis commands (`curl
> /dispatcher/publish/health`, `tail dispatcher.log`, Cloud Manager CDN
> hit-ratio panel, `stat` on `/tmp/dispatcher`), 4 likely causes, 6
> mitigation steps, rollback triggers, dispatcher-admin escalation.
> Saved to `operations-reports/RUNBOOK-dispatcher-hit-ratio-drop.md`."

> **User:** "Datadog dashboard for our Spring checkout service, tier-1"
> **AI silently resolves:** engine=`spring`, service=`checkout-service`,
> service-tier=`t1`, observability=`datadog`, artifacts=`dashboard`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --engine spring --service checkout-service --service-tier t1 --observability datadog --artifacts dashboard --technical --no-preflight --yes-install`
> **AI reports:** "Authored `dashboard-datadog.json` — 8 widgets
> (actuator health, p99 latency, error rate, JVM heap, DB pool
> saturation, Kafka consumer lag, thread-pool utilization, top-error log
> stream), template variables `env`, `service`, `region`. Want the alerts
> pack alongside?"

> **User:** "alerts for our AEM Publish 5xx rate above 1%"
> **AI silently resolves:** engine=`aem`, service=`publish-tier`,
> observability=(auto-detect; else `datadog` as AEM default),
> artifacts=`alerts`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --engine aem --service publish-tier --observability datadog --artifacts alerts --technical --no-preflight --yes-install`
> **AI reports:** "Alerts authored: 6 Datadog monitors — Publish 5xx > 1%
> (2 windows: 5-min warn / 15-min critical), dispatcher hit-ratio < 95%,
> Publish-tier response-time p95 > 2s, replication queue depth > 100,
> author-instance CPU > 90%, GraphQL error rate > 2%. Saved to
> `operations-reports/alerts-datadog.yaml`."

> **User:** "SLOs for tier-2 catalog-service"
> **AI silently resolves:** service=`catalog-service`, service-tier=`t2`,
> artifacts=`slo`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --service catalog-service --service-tier t2 --artifacts slo --technical --no-preflight --yes-install`
> **AI reports:** "SLO doc authored: availability 99.5% (3.6h/month
> error budget), latency p95 ≤ 1s over 28-day rolling window, error
> budget burn-rate alerts (5% / 10% / 25%), freeze policy, sign-off
> block. Saved to `operations-reports/SLO-catalog-service.md`."

> **User:** "postmortem for last week's SEV1 payment outage"
> **AI silently resolves:** artifacts=`postmortem`, postmortem-severity=`sev1`,
> incident=`payment outage`, incident-in=`(none — asks if a log exists)`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --artifacts postmortem --postmortem-severity sev1 --incident "payment outage" --technical --no-preflight --yes-install`
> **AI reports:** "Blameless postmortem template authored: incident-summary
> block (SEV1, external-comms REQUIRED), full-fidelity timeline scaffold
> (UTC + who + what per event), 5-whys RCA structure, action-items table
> with owner/due-date/priority, blameless-language enforcement.
> Saved to `operations-reports/POSTMORTEM-payment-outage.md`."

> **User:** "full ops kit for checkout — dashboards, alerts, SLOs, runbook, on-call"
> **AI silently resolves:** artifacts=`all` (explicit list matches),
> service=`checkout`, observability=auto-detect, engine=auto-detect,
> service-tier=(default `t2` unless conventions overrides).
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --service checkout --artifacts all --technical --no-preflight --yes-install`
> **AI reports:** end-to-end summary linking runbook / dashboard / alerts
> / SLO / on-call / playbook / postmortem counts.

### After one-shot execution

Always:

- Print a one-line summary (runbook / dashboard / alerts / SLO / on-call
  / playbook / postmortem counts, OPERATIONS-INDEX path, report path).
- Print the recommended follow-up from the role matrix (e.g. DevOps role
  after ops → "wire the alerts into the release plan").
- Do NOT ask "want me to run the follow-up?" — the user will ask if they do.

Never:

- Ask what mode they wanted after the fact.
- Ask if they want to save preferences.
- Explain what you did (unless they ask).

### CLI equivalent for one-shot (technical mode)

Every one-shot prompt has a direct CLI equivalent using all Phase 1 flags:

```bash
npx ts-node .claude/skills/bmad-dept-code-operations-agent/scripts/run.ts \
  --path . \
  --role <code> \
  --engine <stack> \
  --service <name> \
  --service-tier <t1|t2|t3> \
  --observability <target> \
  --incident "<text>" \
  --incident-in <path> \
  --postmortem-severity <sev1|sev2|sev3> \
  --artifacts all \
  --format markdown \
  --technical \
  --yes-install \
  --no-preflight \
  --sla-path .bmad/sla.yaml \
  --decisions-path .bmad/decisions.yaml
```

Add `--fail-on-overdue` for CI gates, `--include-decided` to bypass
decisions, `--create-branch` for a working branch.

## Role-aware behavior

The Operations agent adapts its **default artifact set**, **service-tier
default**, and **recommended follow-up** to the role of the person
driving the run. Role selection is a **shared** concept across the
9-agent DCA suite and is persisted per-project at
`<projectRoot>/.bmad/role.yaml` (see `skills/shared/role/ROLES.md`).

### Role check on activation

**Before running any mode**, the AI agent MUST perform the role handshake
(same shape as Requirements, Architecture, Release):

1. Check for `<projectRoot>/.bmad/role.yaml`.
2. If ABSENT, ask the user — verbatim:

   > "Which role best matches how you'll use this plugin? Pick one from the
   > 10 codes below (or say 'generic' to skip):"

   Then list the **6 promoted roles** first:

   - `ea` — Enterprise Architect: portfolio-level observability strategy.
   - `tl` — Tech Lead / Solution Architect: team-level runbooks + dashboards.
   - `de` — Senior Delivery Engineer: component-level runbooks + per-endpoint tiles.
   - `qa` — QA / SDET: regression-alert rules, test-env dashboards.
   - `devops` — DevOps / SRE: **primary role for this agent** — CI-integrated
     alerts, SLO-driven deploy gates, on-call rotation config.
   - `security` — Security Engineer: **secondary primary role** —
     STRIDE-informed incident playbooks, audit-log dashboards,
     SIEM-integrated alerts, PII-leak alert rules.

   Then the **4 additional roles**:

   - `pm` — Product Manager / PMO: SLO-attainment + business-metric dashboards.
   - `ba` — Business Analyst: feature-outcome dashboards.
   - `migration` — Migration/Upgrade Lead: cutover-day runbook + before/after health checks.
   - `content` — Content/CMS Engineer: publish-lag + dispatcher hit-ratio dashboards.

   Then the fallback: `generic` — balanced default.

3. Persist the choice using the shared `writeRoleFile(projectRoot, role,
   "interactive")` helper.
4. If PRESENT, read it silently and use the `role:` field — do NOT re-prompt.
5. **Per-run override**: `"as <role>"` prefix or `--role=<code>` on
   `run.ts`. Does not write `.bmad/role.yaml`.
6. **Permanent change**: `"switch role to <code>"` overwrites `.bmad/role.yaml`.

### Role → Operations behavior matrix

| Role | Default artifact set | Emphasis | Recommended follow-up |
|---|---|---|---|
| `ea` | `slo,dashboard` | **Portfolio-level observability strategy** — SLO framework alignment across teams; observability-standardization ADRs; multi-team dashboard rollup; error-budget aggregation. | "architecture: emit an observability-standardization ADR" |
| `tl` | `runbook,dashboard,alerts` | **Team-level runbooks** — dashboards per component; alert-rule tuning for service ownership; per-team on-call. | "audit the alerts pack against the coverage-owned components" |
| `de` | `runbook,dashboard` | **Component-level runbooks** — per-endpoint dashboard tiles; alerting for developer-owned endpoints; per-service log correlation. | "impact-analyze which components own the alert-firing metrics" |
| `qa` | `runbook,alerts` | **Regression-alert rules** — test-env dashboards; postmortem contributor for repro/verify steps; test-plan alignment with SLO burn. | "test-coverage the components that own the alerting SLIs" |
| `devops` | `dashboard,alerts,slo,oncall-rotation` | **Primary role for this agent.** Pipeline-adjacent dashboards; CI-integrated alerts; SLO-driven deploy gates; on-call rotation config; error-budget-aware release freeze. | "release: wire the alerts into the deploy plan; block ship on active SEV1" |
| `security` | `playbook,postmortem,alerts` | **Secondary primary role.** Security-incident playbooks (STRIDE-informed for containment / eradication / recovery); audit-log dashboards; SIEM-integrated alerts; PII-leak alert rules; incident-response comms templates (customer + regulator). | "sonar-scan the code paths that triggered the alert" |
| `pm` | `slo,dashboard,postmortem` | **SLO-attainment dashboards** — business-metric dashboards; incident-communication templates; postmortem business-impact section; adoption / KPI tiles. | "requirements: reconcile SLO targets against the BRD" |
| `ba` | `dashboard,slo` | **Feature-outcome dashboards** — usage metrics per feature; postmortem business-impact contributor; SLI selection for business-facing endpoints. | "requirements: link SLOs to BRD acceptance criteria" |
| `migration` | `runbook,dashboard,playbook` | **Migration-window observability** (before/after health checks); cutover-day runbook; rollback-decision dashboard; parallel-run health check. | "release: cross-reference the cutover runbook with the rollback plan" |
| `content` | `dashboard,alerts,runbook` | **Content-team dashboards** — publish-lag, dispatcher hit ratio for content paths, replication queue health; content-ops runbook. | "generation: scaffold the block/CF that keeps failing publish" |
| `generic` | `all` | Balanced default — every artifact resolvable. | "audit the ops posture against the code base" |

### Cross-agent chaining hints per role

| Role | Next agent to invoke | Why |
|---|---|---|
| `ea` | `architecture` | Portfolio observability ADR — SLO standardization. |
| `tl` | `audit` | Baseline quality of the components the alerts cover. |
| `de` | `impact-analysis` | Blast radius of the alert-firing metrics. |
| `qa` | `test-coverage` | Coverage of the components that own alerting SLIs. |
| `devops` | `release` | Wire alerts / SLO burn into the deploy plan; block ship on active SEV1. |
| `security` | `sonar-scan` | Vuln scan for the paths that triggered the alert. |
| `pm` | `requirements` | Reconcile SLO targets against the BRD. |
| `ba` | `requirements` | Link SLOs to BRD acceptance criteria. |
| `migration` | `release` | Cross-reference cutover runbook with rollback plan. |
| `content` | `generation` | Scaffold the block/CF that keeps failing publish. |
| `generic` | `audit` | Ops posture against the code base. |

The resolved role is exposed to child engines via `process.env.DCA_ROLE`
(and `DCA_ROLE_NAME` / `DCA_ROLE_FLAVOR` / `DCA_ROLE_SOURCE`), recorded on
the Run-Info sheet of the standardized report, and a one-line
`[dca-role] <Name> (source: <cli-flag|role-file|generic-fallback>)` is
printed to stderr on every run.

## Pre-flight: Auto-install Dependencies

Before ANY command execution, run the shared bootstrap. It installs the
`shared/` foundation (if missing) + this agent's `scripts/` deps in the
correct order, with a one-line confirmation prompt. First-time cost is
~80MB / ~30–60s; subsequent runs are silent no-ops.

**POSIX (macOS, Linux, WSL):**

```bash
bash .claude/skills/shared/bootstrap.sh operations
```

**Windows (or when sh is unavailable):**

```bash
node .claude/skills/shared/bootstrap.js operations
```

**Headless / CI mode (skip prompt):**

```bash
bash .claude/skills/shared/bootstrap.sh operations --yes    # install without asking
bash .claude/skills/shared/bootstrap.sh operations --no     # error if deps missing
```

**Behavior:**

- Both `node_modules` present → silent no-op (exit 0)
- Either missing → confirmation prompt, then install if approved
- User declines → exit 3
- Install failure → exit 4

**Instructions to the AI:** Do NOT skip this step. The bootstrap script
handles the confirmation — you do NOT need to ask separately. `run.ts` also
accepts `--yes-install` / `--no-install` and forwards them to bootstrap.

> **Note.** The `InstallAgentName` enum in `skills/shared/install/preflight.ts`
> may not yet include a dedicated `"operations"` entry; if so, `run.ts`
> piggybacks on the release agent entry (identical shared deps:
> exceljs, fast-glob, mammoth). Invisible to the user; the bootstrap
> prompt still names the operations agent. <!-- verify: enum entry -->

## Preflight — report the user's LLM & recommend a mode

The moment this command is triggered from an AI assistant, run the preflight
and tell the user — in one line — **which LLM they're on** and **whether the
target project fits their context window**:

```bash
npx ts-node scripts/run.ts --path {project} [--engine {engine}] --preflight
```

It prints the detected **model + context window**, the **project size**
(files/LOC/tokens), the **fit** (% of the window), and a **recommendation**
— **STATIC** (deterministic scaffold only) when the project is large,
**LLM** (rich authoring) when it comfortably fits, or **HYBRID**. Surface
it like:

*"You're on `<model>` (~`<ctx>` context). This project is ~`<pct>%` of your window → I recommend **<mode>**. Proceed?"*

**Rule of thumb for Operations:** the LLM authors runbook / SLO /
playbook / postmortem prose and populates dashboard / alerts placeholders
with stack-appropriate metrics — this is a mostly-LLM agent. The
preflight tells you whether the incident log (`--incident-in`) and the
per-stack idiom set fit comfortably. If the fit is tight, the agent
falls back to template-driven authoring without repo-aware idioms.

## Modes

The Operations agent has three artifact-scope modes, selected by
`--artifacts` (and by whether `--incident` / `--incident-in` are set):

### Mode: Full ops kit (default with `--artifacts all`)

**Trigger:** `--artifacts all` (default when unspecified), or the prompt
asks for a "full ops kit" / "ops pack".

**Steps:**

1. Resolve stack (from `--engine`, else auto-detect from repo signals).
2. Resolve observability target (from `--observability`, else auto-detect
   from `datadog.yaml` / `newrelic.yml` / `grafana/` / `prometheus.yml` /
   `filebeat.yml` / `.cloudwatch/` / `dynatrace.yaml`).
3. Resolve service + service-tier (from `--service` / `--service-tier`,
   else asks once if missing).
4. Load `resources/runbook-templates/<stack>.md`,
   `resources/dashboard-templates/<stack>.md` (Phase 3.5b),
   `resources/alert-rules/<stack>.md` (Phase 3.5b),
   `resources/slo-templates/<stack>.md` (Phase 3.5c),
   `resources/playbook-templates/<stack>.md` (Phase 3.5c),
   `resources/postmortem-templates/<stack>.md` (Phase 3.5c).
5. Load the master templates under `templates/`: `runbook.md`,
   `dashboard-<target>.{json,yml}`, `alerts-<target>.yaml`, `slo.md`,
   `playbook.md`, `postmortem.md`, `oncall-rotation.yaml`.
6. Feed the ops context + stack guides + optional incident context to the
   LLM authoring pass.
7. Emit the artifact files + the standard workbook + `OPERATIONS-INDEX.md`
   (see § Written files).
8. Report the artifact counts and next-agent handoff.

### Mode: Individual artifact

**Trigger:** `--artifacts <one>` — narrow to a single artifact
(`runbook` / `dashboard` / `alerts` / `slo` / `oncall-rotation` /
`playbook` / `postmortem`).

**Steps:** same as full ops kit, but only the requested artifact's
template + stack guide loads, and only the requested file is written.

### Mode: Incident-driven

**Trigger:** `--incident "<text>"` or `--incident-in <path>`.

**Behavior:** the artifact set auto-expands to include `runbook +
playbook`, and — with `--postmortem-severity` — the `postmortem`
template. The incident text (or log contents) feeds directly into the
runbook's symptom + quick-diagnosis sections, into the playbook's
triage + containment sections, and into the postmortem's incident-summary
+ timeline scaffold.

## Artifact catalog

`--artifacts` accepts a comma-separated list. `all` expands to every
artifact resolvable given other flags. Missing → `all`.

| Artifact key | Written file(s) | Master template | Per-stack guide | Notes |
|---|---|---|---|---|
| `runbook` | `RUNBOOK-<slug>.md` | `templates/runbook.md` | `resources/runbook-templates/<stack>.md` | Per-incident-symptom runbook. Section shape: symptom, quick-diagnosis (3-5 first-check commands), likely causes (3-5), mitigation steps (numbered), rollback triggers, escalation, verification, comms templates, post-incident follow-ups. |
| `dashboard` | `dashboard-<target>.{json,yml}` | `templates/dashboard-<target>.{json,yml}` | `resources/dashboard-templates/<stack>.md` (Phase 3.5b) | Dashboard-as-code per observability target. See § Observability platform catalog. |
| `alerts` | `alerts-<target>.yaml` | `templates/alerts-<target>.yaml` | `resources/alert-rules/<stack>.md` (Phase 3.5b) | Alert rules per observability target. Categories: uptime, latency p99, error rate, saturation, log-error rate, business SLI. |
| `slo` | `SLO-<service>.md` | `templates/slo.md` | `resources/slo-templates/<stack>.md` (Phase 3.5c) | SLO/SLI definitions with error-budget policy. Keyed to `--service-tier` (see § Service-tier catalog). |
| `oncall-rotation` | `oncall-rotation.yaml` | `templates/oncall-rotation.yaml` | (stack-agnostic) | PagerDuty / Opsgenie / VictorOps compatible YAML — primary layer + secondary layer + escalation policy. Weekly rotation with handoff time; holiday overrides. |
| `playbook` | `PLAYBOOK-<slug>.md` | `templates/playbook.md` | `resources/playbook-templates/<stack>.md` (Phase 3.5c) | Incident-response playbook. STRIDE-informed for security incidents. Role assignments (IC, comms lead, ops lead, scribe), triage matrix, containment, investigation, eradication, recovery, comms plan, stand-down criteria. |
| `postmortem` | `POSTMORTEM-<slug>.md` | `templates/postmortem.md` | `resources/postmortem-templates/<stack>.md` (Phase 3.5c) | Blameless postmortem. Section shape: incident summary (severity, duration, blast radius), timeline (UTC + who + what), 5-whys RCA, contributing factors, what-went-well, what-went-wrong, action items (owner + due-date + priority), lessons learned, sign-off. |
| `all` | Every artifact resolvable given other flags. | — | — | Uses stack defaults + role defaults for anything not disambiguated. |

`--format both` is accepted but currently emits markdown only (docx writer
is planned; a warning is printed on stderr).

## Observability platform catalog

`--observability` selects the dashboard/alerts target. When omitted,
`autoDetectObservability()` in `scripts/run.ts` walks the project root
for platform config indicators.

| Target | Template file(s) | Auto-detect signal | Role default |
|---|---|---|---|
| `datadog` | `templates/dashboard-datadog.json` + `templates/alerts-datadog.yaml` | `datadog.yaml` / `.datadog.yml` / `datadog-agent.yaml` / `datadog-config.yaml` | **DevOps default** (broadest coverage; Terraform provider maturity). |
| `newrelic` | `templates/dashboard-newrelic.json` | `newrelic.yml` / `newrelic.js` / `newrelic.ini` | Common in **Adobe Commerce PaaS** (Adobe Cloud ships New Relic APM by default). |
| `grafana` | `templates/dashboard-grafana.json` | `grafana/dashboards/*.json` / `grafana.ini` | **Kubernetes / self-managed default** — pairs with Prometheus data source. |
| `prometheus` | `templates/dashboard-prometheus.yml` + `templates/alerts-prometheus.yaml` | `prometheus.yml` / `prometheus-rules.yaml` | **K8s-ecosystem default** — alerting rules live here; visualization typically Grafana. |
| `elastic` | (Kibana JSON — Phase 3.5b) | `filebeat.yml` / `logstash.conf` / `kibana.yml` | Log-heavy stacks (ELK-native shops). |
| `cloudwatch` | (CloudWatch dashboard JSON — Phase 3.5b) | `.cloudwatch/` / `cloudwatch-agent.json` | AWS-native (App Builder often uses CloudWatch for I/O Runtime logs). |
| `dynatrace` | (Dynatrace dashboard JSON — Phase 3.5b) | `dynatrace.yaml` / `oneagent.conf` | Enterprise APM shops. |

**Detection precedence.** First hit wins in the source order defined in
`autoDetectObservability()`: Datadog → New Relic → Grafana → Prometheus →
Elastic → CloudWatch → Dynatrace. Pass `--observability <target>` to
override. If nothing matches, the agent surfaces an INFO finding
prompting the user to declare a target.

## Service-tier catalog

`--service-tier` keys the SLO defaults. When omitted, the SLO template
uses `t2` unless `.bmad/conventions.yaml` overrides.

| Tier | Availability | Latency (p95) | RPO | RTO | Typical services |
|---|---|---|---|---|---|
| `t1` | **99.9%** (43m 49s / month error budget) | ≤ **300ms** | ≤ 5 min | ≤ 15 min | Payment, checkout, auth, cart-total, PDP-add-to-cart. Revenue-critical paths. |
| `t2` | **99.5%** (3h 39m / month) | ≤ **1s** | ≤ 1 h | ≤ 4 h | Catalog, storefront, admin, search, category browse, account. |
| `t3` | **99%** (7h 18m / month) | ≤ **3s** | ≤ 24 h | ≤ 24 h | Internal tooling, admin reports, batch jobs, non-customer-facing pipelines. |

Burn-rate alerts by tier (from `templates/slo.md`):

- **Fast burn** (2% budget in 1h → paging alert)
- **Slow burn** (5% budget in 6h → ticketing alert)
- **Long burn** (10% budget in 3d → warning)

## Postmortem severity catalog

`--postmortem-severity` keys the postmortem template's detail level +
timeline granularity + external-comms requirement.

| Severity | Detail level | Timeline granularity | External comms |
|---|---|---|---|
| `sev1` | Full-fidelity — every section required, every action-item owner named + due-date. | Per-minute UTC; every escalation, every mitigation, every rollback attempt. | **Required** — customer status page + regulator notification if PII/PCI/HIPAA touched. |
| `sev2` | Standard — every section required, action-items may deferred-batch. | Per-5-min UTC; key inflection points. | Optional — internal-only unless customer-facing impact confirmed. |
| `sev3` | Lightweight — summary + timeline + top-3 action items. | Per-15-min or event-only. | Internal only. |

## Per-stack authoring instructions

For each of the 8 stacks the Operations agent loads per-stack resource
files at authoring time. Keep the tone stack-native — an AEM runbook
reads like an AEM runbook, not a generic doc with the word "AEM" sprinkled in.

### AEM (AEMaaCS / AMS) — engine `aem`

- **Runbook guide:** `resources/runbook-templates/aem.md`
- **Dashboard guide:** `resources/dashboard-templates/aem.md` (Phase 3.5b)
- **Alerts guide:** `resources/alert-rules/aem.md` (Phase 3.5b)
- **SLO guide:** `resources/slo-templates/aem.md` (Phase 3.5c)
- **Playbook guide:** `resources/playbook-templates/aem.md` (Phase 3.5c)
- **Postmortem guide:** `resources/postmortem-templates/aem.md` (Phase 3.5c)
- **Ops idioms.** Dispatcher hit-ratio, Author-instance responsiveness,
  Publish 5xx rate, Cloud Manager execution health, Content Fragment
  publication lag, DAM upload success rate, replication queue depth,
  Sling job queue backlog. Health endpoints:
  `/system/console/healthcheck`, `/system/console/status-productinfo`,
  `/dispatcher/publish/health`. <!-- verify: current AEMaaCS endpoints -->

### Adobe Commerce (PaaS / Magento 2) — engine `commerce-paas` (alias `commerce`)

- **Runbook guide:** `resources/runbook-templates/commerce-paas.md`
- **Dashboard guide:** `resources/dashboard-templates/commerce-paas.md` (Phase 3.5b)
- **Alerts guide:** `resources/alert-rules/commerce-paas.md` (Phase 3.5b)
- **SLO guide:** `resources/slo-templates/commerce-paas.md` (Phase 3.5c)
- **Playbook guide:** `resources/playbook-templates/commerce-paas.md` (Phase 3.5c)
- **Postmortem guide:** `resources/postmortem-templates/commerce-paas.md` (Phase 3.5c)
- **Ops idioms.** Checkout success rate, cart p95, catalog re-index
  status, indexer health (`bin/magento indexer:status`), payment gateway
  error rate, admin login round-trip, RabbitMQ consumer lag, Redis
  fragmentation, MySQL slow-query count, Fastly hit-ratio.

### Adobe Commerce SaaS — engine `commerce-saas`

- **Runbook guide:** `resources/runbook-templates/commerce-saas.md`
- **Dashboard guide:** `resources/dashboard-templates/commerce-saas.md` (Phase 3.5b)
- **Alerts guide:** `resources/alert-rules/commerce-saas.md` (Phase 3.5b)
- **SLO guide:** `resources/slo-templates/commerce-saas.md` (Phase 3.5c)
- **Playbook guide:** `resources/playbook-templates/commerce-saas.md` (Phase 3.5c)
- **Postmortem guide:** `resources/postmortem-templates/commerce-saas.md` (Phase 3.5c)
- **Ops idioms.** Drop-in bundle load success, Catalog Service query
  latency, Storefront-events emit rate, Payment Services round-trip,
  API Mesh resolver latency, IMS token roundtrip, drop-in bundle version
  drift across environments.

### Apache Sling / Shaft (sling-12) — engine `sling`

- **Runbook guide:** `resources/runbook-templates/sling.md`
- **Dashboard guide:** `resources/dashboard-templates/sling.md` (Phase 3.5b)
- **Alerts guide:** `resources/alert-rules/sling.md` (Phase 3.5b)
- **SLO guide:** `resources/slo-templates/sling.md` (Phase 3.5c)
- **Playbook guide:** `resources/playbook-templates/sling.md` (Phase 3.5c)
- **Postmortem guide:** `resources/postmortem-templates/sling.md` (Phase 3.5c)
- **Ops idioms.** OSGi bundle state (ACTIVE vs INSTALLED count), MDM
  CRUD latency, SAM API 5xx, service-availability, `/system/console/bundles`
  health, Sling job queue depth per topic, Feature Model install
  divergence, JCR session leak count.

### Spring Boot — engine `spring`

- **Runbook guide:** `resources/runbook-templates/spring.md`
- **Dashboard guide:** `resources/dashboard-templates/spring.md` (Phase 3.5b)
- **Alerts guide:** `resources/alert-rules/spring.md` (Phase 3.5b)
- **SLO guide:** `resources/slo-templates/spring.md` (Phase 3.5c)
- **Playbook guide:** `resources/playbook-templates/spring.md` (Phase 3.5c)
- **Postmortem guide:** `resources/postmortem-templates/spring.md` (Phase 3.5c)
- **Ops idioms.** Actuator health (`/actuator/health/liveness` +
  `/actuator/health/readiness`), Micrometer p99 latency, JVM heap
  headroom (used vs committed vs max), G1 pause count, connection-pool
  saturation (HikariCP active vs max), Kafka consumer lag per group,
  DB slow-query count, thread-pool queue depth.

### Adobe App Builder — engine `app-builder`

- **Runbook guide:** `resources/runbook-templates/app-builder.md`
- **Dashboard guide:** `resources/dashboard-templates/app-builder.md` (Phase 3.5b)
- **Alerts guide:** `resources/alert-rules/app-builder.md` (Phase 3.5b)
- **SLO guide:** `resources/slo-templates/app-builder.md` (Phase 3.5c)
- **Playbook guide:** `resources/playbook-templates/app-builder.md` (Phase 3.5c)
- **Postmortem guide:** `resources/postmortem-templates/app-builder.md` (Phase 3.5c)
- **Ops idioms.** Action error rate per namespace, I/O Event delivery lag,
  State SDK error rate, namespace quota headroom (activations/day,
  concurrent invocations, memory), API Mesh resolver latency, IMS token
  cache miss rate, cold-start count per action.

### Edge Delivery Services (EDS) — engine `eds`

- **Runbook guide:** `resources/runbook-templates/eds.md`
- **Dashboard guide:** `resources/dashboard-templates/eds.md` (Phase 3.5b)
- **Alerts guide:** `resources/alert-rules/eds.md` (Phase 3.5b)
- **SLO guide:** `resources/slo-templates/eds.md` (Phase 3.5c)
- **Playbook guide:** `resources/playbook-templates/eds.md` (Phase 3.5c)
- **Postmortem guide:** `resources/postmortem-templates/eds.md` (Phase 3.5c)
- **Ops idioms.** LCP p75, block-load success rate, sitemap generation
  duration, edge cache hit ratio, helix-preview vs helix-live diff count,
  Google Docs / SharePoint auth token freshness, redirects.xlsx sync
  status, RUM sample rate. <!-- verify: current helix admin endpoints -->

### EDS + Commerce — engine `eds-commerce`

- **Runbook guide:** `resources/runbook-templates/eds-commerce.md`
- **Dashboard guide:** `resources/dashboard-templates/eds-commerce.md` (Phase 3.5b)
- **Alerts guide:** `resources/alert-rules/eds-commerce.md` (Phase 3.5b)
- **SLO guide:** `resources/slo-templates/eds-commerce.md` (Phase 3.5c)
- **Playbook guide:** `resources/playbook-templates/eds-commerce.md` (Phase 3.5c)
- **Postmortem guide:** `resources/postmortem-templates/eds-commerce.md` (Phase 3.5c)
- **Ops idioms.** All EDS idioms + drop-in TTI, cart-total latency,
  drop-in bundle version pinned per env, storefront-events schema drift
  detector, Catalog Service query latency piped to EDS block, Payment
  Services round-trip observed edge-side.

## Output contract

The Operations agent emits the standardized DCA outputs into
`<project>/operations-reports/` (override with `--output`), via the shared
`emitStandardOutputs` (agent id `operations`). The 15-column Summary
contract is preserved so downstream agents (Audit, Sonar-Scan,
Test-Coverage, Impact-Analysis, Release) can chain off the same row shape.

### Sheets

| Sheet | Contents |
|---|---|
| **Run Info** | Model, context window, stack, role + source, project name / root, service, service-tier, observability target, incident (if any), postmortem severity (if any), artifact set, artifact counts. |
| **Summary** | The 15-column contract, one row per runbook step / dashboard widget / alert rule / SLI / on-call layer / playbook phase / postmortem timeline entry. |
| **Severity Breakdown** | Counts per severity bucket (`gate` / `risk` / `action` / `info`). |
| **By Category** | Counts per artifact category (`runbook` / `dashboard` / `alert` / `slo` / `oncall` / `playbook` / `postmortem`). |
| **Recommendations** | Roll-up of the `recommendation` column, sorted by severity. |
| **SLA Status** (Phase 1) | Only when `--no-sla` is NOT set. See § SLA tracking. |
| **Delta** (optional) | When authoring against a prior ops run (same service), shows what changed vs the prior SLO / alerts / runbook. |

### 15-column Summary contract

Each finding row carries:

| Column | Value |
|---|---|
| `id` | `OPS-<n>` (monotonic per run) |
| `title` | Artifact / item title — runbook step / dashboard widget name / alert rule name / SLI name / on-call layer / playbook phase / timeline entry |
| `description` | Full text (runbook step body / widget metric + query / alert threshold + window / SLI definition / on-call schedule / playbook step / timeline event) |
| `tech-stack` | `aem` \| `commerce-paas` \| `commerce-saas` \| `sling` \| `spring` \| `app-builder` \| `eds` \| `eds-commerce` |
| `category` | `runbook` \| `dashboard` \| `alert` \| `slo` \| `oncall` \| `playbook` \| `postmortem` |
| `code-reference` | File path of the emitted artifact (`RUNBOOK-*.md#step-3` / `dashboard-datadog.json#/widgets/2` / `alerts-prometheus.yaml#/groups/latency/rules/p99`) |
| `severity` | `gate` \| `risk` \| `action` \| `info` (`gate`≈CRITICAL — production blocker; `risk`≈HIGH — proceed with mitigation; `action`≈MEDIUM — do the thing; `info`≈LOW — for the record) |
| `confidence` | `high` (explicit answer / config file / known idiom) \| `medium` (LLM-authored, template-aligned) \| `low` (inferred — needs tuning) |
| `ruleId` | `OPS-<stack>-<type>` (e.g. `OPS-aem-runbook-dispatcher`, `OPS-spring-alert-p99`, `OPS-eds-slo-lcp`) |
| `recommendation` | Authoring next-step — for runbooks: any missing quick-diagnosis command; for dashboards: the metric to add; for alerts: the tuning suggestion; for SLOs: the burn-rate to add |
| `impact` | Impact statement (per-role phrasing: business impact for pm; blast radius for security; on-call impact for devops) |
| `effort` | T-shirt: `S` \| `M` \| `L` \| `XL` |
| `comments` | Free text — reviewer notes, open questions, blocking dependencies |
| `owner` | Empty at authoring time; the SRE / EM fills it during the review pass |
| `status` | `draft` (default) \| `reviewed` \| `approved` \| `active` — advances via the decisions gate and post-adoption update |

### Written files

- `RUNBOOK-<slug>.md` — rendered from `templates/runbook.md`.
- `dashboard-<target>.{json,yml}` — rendered from
  `templates/dashboard-<target>.{json,yml}`.
- `alerts-<target>.yaml` — rendered from `templates/alerts-<target>.yaml`.
- `SLO-<service>.md` — rendered from `templates/slo.md`.
- `oncall-rotation.yaml` — rendered from `templates/oncall-rotation.yaml`.
- `PLAYBOOK-<slug>.md` — rendered from `templates/playbook.md`.
- `POSTMORTEM-<slug>.md` — rendered from `templates/postmortem.md`.
- `OPERATIONS-INDEX.md` — always emitted; manifest of inputs → artifacts.
- `operations-<branch>-<timestamp>-agent-report.xlsx` — the standardized workbook.
- `operations-<branch>-<timestamp>-agent-report.md` — Markdown twin.
- `CHANGE-LOG.md` — appended at the project root with a one-line run
  summary (e.g. `Operations: 1 runbook, 1 dashboard(datadog), 6 alerts,
  1 SLO(t1), 1 oncall, 1 playbook, 1 postmortem(sev2).`).
- Optional standard git branch `dca/operations-<stack>-<timestamp>` — cut
  from `production`/`main`/`master`/`develop` (or `--source-branch <name>`)
  when `--create-branch` is passed.

## Findings gate (Phase 1)

The Operations agent participates in the shared **decisions gate**
(`.bmad/decisions.yaml`) exactly the way the other eight agents do. For
this agent, decisions apply to ops-artifact items:

- `accepted` — the artifact item is approved for production (e.g. this
  alert rule is live, this SLO is adopted, this runbook step is signed
  off).
- `deferred` — the artifact needs tuning (e.g. alert threshold too
  chatty, dashboard widget query too slow, SLO target too aggressive
  for current instrumentation) — moves to SLA sheet with `next-review`
  date.
- `wontfix` — accepted risk / not applicable (e.g. an alert category
  the team has consciously decided not to page on; a runbook step that
  is documented but the team chose to skip).

**Flags:**

- `--include-decided` — show findings even when a decision exists.
- `--decisions-path <path>` — override the decisions file location.
- `--ignore-decision-expiry` — keep suppressing findings even when the
  decision has expired.
- `--list-decisions` — print every decision in `.bmad/decisions.yaml` and exit.

See `skills/shared/decisions/` and the Docusaurus concept page for the
full YAML shape.

## SLA tracking (Phase 1)

The Operations agent participates in the shared **SLA gate**
(`.bmad/sla.yaml`). For this agent, SLA is interpreted as
**ops-artifact-review SLA**: how long an alert rule (or any ops artifact
finding) can sit in `draft` per role before it becomes OVERDUE and
blocks the adoption / release.

**Default SLAs** (customize in `.bmad/sla.yaml`):

| Role | `gate` (CRITICAL) | `risk` (HIGH) | `action` (MEDIUM) | `info` (LOW) |
|---|---|---|---|---|
| `devops` | 1 day | 2 days | 5 days | ∞ |
| `security` | 1 day | 1 day | 3 days | ∞ |
| `qa` | 1 day | 2 days | 5 days | ∞ |
| `tl` | 2 days | 3 days | 7 days | ∞ |
| `ea` | 2 days | 3 days | 7 days | ∞ |
| `pm` | 2 days | 5 days | 10 days | ∞ |
| (other) | 2 days | 3 days | 7 days | ∞ |

**Flags:**

- `--sla-path <path>` — override the SLA file location.
- `--no-sla` — skip SLA computation + sheet.
- `--fail-on-overdue` — exit code 6 if any finding is OVERDUE per role
  SLA. Wire this into CI to fail the release pipeline when a `gate`
  ops-artifact item has been sitting in `draft` too long.

The SLA sheet on the workbook shows each finding's age, its SLA
threshold given its severity + owner-role, and its state (`fresh` /
`nearing` / `overdue`).

## Cross-agent chaining hints

Operations is the **ops entry point** of the DCA workflow — where
Release formalizes the "how to ship", Operations formalizes the "how
to run". Recommended fan-in / fan-out:

```
Requirements (BRD) → Architecture (ADR + HLD + LLD)
    ↓
Generation → Audit + Sonar-Scan + Test-Coverage
    ↓
Impact Analysis (blast radius)
    ↓
Release (--artifacts all)
    → pipeline / release notes / deploy plan / rollback / env-diff / announcement
    ↓
Operations (--artifacts all --service <svc>)   ← SDLC phase 6 closes here
    → runbook (per incident symptom)
    → dashboard (per observability platform)
    → alerts (per observability platform)
    → SLO (per service tier)
    → on-call rotation (PagerDuty / Opsgenie)
    → playbook (STRIDE-informed for security)
    → postmortem (blameless template)
```

Concrete one-liners the AI agent should offer as follow-ups after an
Operations run:

- **Operations → Release** — "reference the runbook + on-call from the
  deploy plan" — bi-directional loop; the Release deploy plan cites the
  runbook and on-call rotation the Ops agent just authored.
- **Operations → Audit** — "audit findings feed alert rules — turn
  CRITICAL audit findings into on-call alerts" — audit's CRITICAL
  findings become Ops-authored alert rules.
- **Operations → Sonar-Scan** — "wire Quality Gate breach as an alert"
  — a Sonar-Scan Quality Gate failure raises an Ops alert (pipeline
  Ops-integrated).
- **Operations → Impact Analysis** — "impact-analyze the components
  behind the alerting SLIs" — trace what code owns each metric.
- **Operations → Test-Coverage** — postmortem authoring pulls test-
  coverage context for "did we have coverage on the failing path?"
- **Operations → Architecture** — "emit an observability-standardization
  ADR" — codify the observability platform + SLO framework at portfolio
  level.

## Constraints / non-goals

**This agent authors ops artifacts. It does not:**

- **Execute ops actions.** The authored `dashboard-datadog.json` is a
  file — your Datadog account (or Terraform run, or `terraform apply
  -target=datadog_dashboard`) creates the dashboard. The Ops agent
  never calls the Datadog API, never installs a monitoring agent, never
  pages an on-call.
- **Install monitoring agents or SDKs.** It produces the config you apply;
  it does not run `pip install datadog`, `helm install prometheus`,
  `newrelic-install install`, or equivalent.
- **Accept SLOs on behalf of the team.** SLO adoption requires human
  sign-off. The agent produces the SLO doc + error-budget policy — the
  team must review, tune, and adopt.
- **Auto-post to PagerDuty / Opsgenie.** The `oncall-rotation.yaml` is a
  file with the platform-compatible shape; you apply it via `pd-cli`,
  Terraform, or the platform's UI import. The agent has no workspace
  credentials.
- **Author blameless postmortems on autopilot.** Postmortem authoring
  is a template + prompt scaffold — the human incident participants
  still fill in the timeline, the 5-whys, and the action items. The
  agent enforces blameless language + section shape.
- **Guarantee an alert is well-tuned.** Alert thresholds are authored
  from stack idioms + service tier — but noise / paging fatigue can only
  be discovered by running the alert for a week. The agent surfaces
  "tune after 7d of data" as an ACTION item.
- **Author against unsupported stacks.** Operations is Adobe/JVM-focused
  (the same 8 stacks as the rest of the DCA suite). If you point it at
  a Ruby-on-Rails or Django repo, `--engine` auto-detection returns
  `generic` and the agent falls back to stack-agnostic templates.
- **Own the incident.** During an active incident, use the emitted
  runbook / playbook — the agent produces the reference documents, not
  the incident commander.

**What the agent does authoritatively:**

- Author an incident-symptom-based runbook with exact commands,
  quantified triggers, and per-stack escalation.
- Author a dashboard-as-code file with 6-8 stack-appropriate widgets +
  template variables.
- Author alert rules covering uptime, latency, error rate, saturation,
  and log-error rate — with per-tier thresholds.
- Author an SLO doc with SLI definitions, targets keyed to service
  tier, error-budget policy, and burn-rate alerts.
- Author an on-call rotation with primary + secondary + escalation
  layers, weekly handoff, and holiday overrides.
- Author an incident-response playbook (STRIDE-informed for security
  incidents) with role assignments, triage matrix, and comms plan.
- Author a blameless postmortem template with timeline scaffold, 5-whys
  RCA structure, and action-items table — severity-keyed detail level.
- Adapt the artifact emphasis and follow-up handoff to the resolved role.
- Participate in the shared decisions + SLA gates so ops-artifact items
  can be frozen and overdue items can block CI.

## Commands Reference

| Trigger | Action |
|---------|--------|
| `full ops` / `ops kit` | Full ops kit with `--artifacts all` |
| `runbook for X` | `--artifacts runbook --incident "X"` |
| `dashboard for X` | `--artifacts dashboard --service X` (auto-detect observability) |
| `Datadog dashboard for X` | `--artifacts dashboard --observability datadog --service X` |
| `Prometheus alerts for X` | `--artifacts alerts --observability prometheus --service X` |
| `SLOs for X, tier-N` | `--artifacts slo --service X --service-tier tN` |
| `on-call rotation` | `--artifacts oncall-rotation` |
| `STRIDE playbook for X` | `--artifacts playbook --incident "X"` |
| `postmortem for X, sevN` | `--artifacts postmortem --postmortem-severity sevN --incident "X"` |
| `ops as <role>` | `--role <role> --artifacts all` |
| `list operations engines` | `--list-engines` |
| `switch role to <code>` | Rewrite `.bmad/role.yaml` |
| `switch intake to interactive` / `technical` | Rewrite `.bmad/intake.yaml` |

## CLI Options

| Flag | Description |
|------|-------------|
| `--path <dir>` | Project root (default: `.`) |
| `--engine <engine>` | `aem` \| `commerce-paas` (alias `commerce`) \| `commerce-saas` \| `sling` \| `spring` \| `app-builder` \| `eds` \| `eds-commerce` (auto-detect if omitted) |
| `--output <dir>` | Output directory (default `<project>/operations-reports`) |
| `--interactive` | Interactive intake mode (prompts step-by-step) |
| `--technical` | Technical intake mode (silent error on missing required inputs) |
| `--list-engines` | List available engines |
| `--role <code>` | Role adaptation — persisted at `<project>/.bmad/role.yaml`; `--role` wins for a single run |
| `--observability <target>` | Observability platform. Values: `datadog`, `newrelic`, `grafana`, `prometheus`, `elastic`, `cloudwatch`, `dynatrace`. Default: auto-detect. |
| `--incident <text>` | Natural-language incident description for runbook / playbook / postmortem authoring. |
| `--incident-in <path>` | Existing incident log / timeline to enrich into a postmortem (.md / .txt / .json accepted). |
| `--service <name>` | Service name for dashboard / alerts / SLO artifacts (e.g. `checkout-api`, `catalog-service`, `author-tier`). |
| `--service-tier <t1\|t2\|t3>` | Service criticality tier for SLO defaults: t1 = 99.9%, t2 = 99.5%, t3 = 99%. |
| `--postmortem-severity <sev>` | Postmortem template severity. Values: `sev1`, `sev2`, `sev3`. |
| `--artifacts <csv>` | Which artifacts to author (comma-separated). Values: `runbook`, `dashboard`, `alerts`, `slo`, `oncall-rotation` (alias `oncall`), `playbook`, `postmortem`, `all`. Default: `all`. |
| `--format <markdown\|both>` | Output format. Default: `markdown`. `both` currently writes markdown only (docx planned) with a warning. |
| `--create-branch` | Cut standard branch `dca/operations-<stack>-<timestamp>` before writing outputs |
| `--source-branch <name>` | Source branch for `--create-branch` (default: production/main/master/develop) |
| `--preflight` | Print model/context + STATIC/LLM/HYBRID advisory and exit |
| `--no-preflight` | Suppress the preflight advisory |
| `--yes-install` | Install missing dependencies without confirmation |
| `--no-install` | Error out if dependencies missing (do not install) |
| `--include-decided` | Show findings even when a decision exists in `.bmad/decisions.yaml` |
| `--decisions-path <path>` | Override decisions file location |
| `--ignore-decision-expiry` | Keep suppressing findings even when the decision has expired |
| `--list-decisions` | Print every decision in `.bmad/decisions.yaml` and exit |
| `--sla-path <path>` | Override SLA file location |
| `--no-sla` | Skip SLA computation + sheet |
| `--fail-on-overdue` | Exit code 6 if any finding is OVERDUE per role SLA |
| `--help` | Print usage and exit |
