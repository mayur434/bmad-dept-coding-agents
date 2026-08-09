---
id: operations
title: Operations — Prompts
sidebar_position: 9
description: Copy-paste prompts for the Operations agent — runbooks, dashboards, alerts, SLOs, on-call rotations, playbooks, postmortems across 8 Adobe/JVM stacks and 7 observability platforms.
keywords:
  - operations prompts
  - runbook prompts
  - dashboard prompts
  - alert prompts
  - slo prompts
  - playbook prompts
  - postmortem prompts
---

Copy-paste prompts for the **Operations agent** (`bmad-dept-code-operations-agent`). Send a whole block or a single line — the agent parses natural language and resolves flags, stack, observability platform, service, and role automatically.

**Modes:** `full-ops-kit` = all seven artifacts in one run (`--artifacts all`, default). `individual-artifact` = narrow to one artifact (`--artifacts runbook` / `dashboard` / `alerts` / `slo` / `oncall-rotation` / `playbook` / `postmortem`). `incident-driven` = pass `--incident "<text>"` or `--incident-in <path>` to auto-expand to runbook + playbook (+ postmortem when `--postmortem-severity` is set).

Related: [Operations agent](../../agents/operations) · [Observability concept](../../concepts/observability) · [CLI Flags](../cli-flags) · [Role adaptation](../../concepts/role-adaptation).

---

## Quick starters

Send one of these first — the agent auto-detects the stack, observability platform, and role, and asks a single question only if a required input is truly missing.

```text
full ops kit for checkout-api tier-1 on Datadog
runbook for the dispatcher hit-ratio drop
Datadog dashboard for our Spring checkout service
Prometheus alerts for the promotions service
SLOs for tier-1 checkout-api
on-call rotation for the payment team
postmortem for last week's SEV1
STRIDE playbook for a suspected data breach
list operations engines
```

---

## Cross-cutting flag templates

One prompt per flag — reuse for any stack:

```text
operations --engine aem --path /path/to/project
operations --engine spring --service checkout-api
operations --engine commerce-saas --path ./storefront
```

```text
operations --create-branch
operations --create-branch --source-branch production
operations on a new branch from main
```

```text
operations --preflight
operations --no-preflight
operations and skip preflight
```

```text
operations --artifacts runbook
operations --artifacts dashboard,alerts
operations --artifacts all
operations --observability datadog
operations --observability prometheus
operations --format markdown
```

---

## Runbooks

Per-stack runbook prompts — grounded in `resources/runbook-templates/<stack>.md`.

### AEM

```text
runbook for dispatcher hit-ratio dropped below 90%
runbook for Author-tier slowdown (response-time p95 > 2s)
```

### Adobe Commerce (PaaS)

```text
runbook for the checkout latency spike (cart-total p95 > 3s)
runbook for admin lockout (admin login round-trip > 8s)
```

### Adobe Commerce SaaS

```text
runbook for a drop-in bundle load failure on PDP
runbook for Catalog Service query latency > 1s
```

### Sling / Shaft

```text
runbook for OSGi bundles stuck in INSTALLED state
runbook for Sling job queue backlog > 500 per topic
```

### Spring Boot

```text
runbook for Actuator readiness flapping
runbook for HikariCP pool exhaustion (active == max for > 2m)
```

### Adobe App Builder

```text
runbook for action error rate spike in the salesforce-sync namespace
runbook for I/O Event delivery lag > 30s
```

### Edge Delivery Services (EDS)

```text
runbook for LCP p75 regression above 2.5s
runbook for sitemap generation duration > 60s
```

### EDS + Commerce

```text
runbook for cart-total edge latency > 1s (EDS + Catalog Service pipeline)
runbook for drop-in bundle version drift across preview and live
```

---

## Dashboards

Per-platform dashboard prompts. Uses the `--observability` flag when unambiguous.

### Datadog

```text
Datadog dashboard for our Spring checkout service (JVM + HikariCP + Kafka + p99)
Datadog dashboard for our AEM Publish tier (dispatcher hit-ratio + Publish 5xx + replication queue)
```

### New Relic

```text
New Relic dashboard for our Commerce PaaS storefront (Adobe Cloud APM defaults)
New Relic dashboard for cart p95 + catalog re-index + Fastly hit-ratio
```

### Grafana

```text
Grafana dashboard-as-code for our K8s fleet (paired with Prometheus data source)
Grafana dashboard for our Spring service with Micrometer metrics
```

### Prometheus

```text
Prometheus dashboard scaffolding for our Spring service (alerting-rules + recording-rules)
Prometheus dashboard for Kafka consumer lag + JVM heap headroom
```

### Elastic (Kibana)

```text
Kibana dashboard for our log-heavy Sling instance (audit-log + service-availability)
Kibana dashboard for AEM error-log correlation across Author + Publish
```

### CloudWatch

```text
CloudWatch dashboard for our App Builder namespace (action error rate + I/O Runtime logs)
CloudWatch dashboard for the salesforce-sync action + State SDK error rate
```

### Dynatrace

```text
Dynatrace dashboard for our Spring service (Smartscape + purepath baselines)
Dynatrace dashboard for enterprise APM view of the checkout journey
```

---

## Alerts

Per-platform alert prompts.

### Datadog

```text
Datadog monitors for AEM Publish 5xx > 1% (5-min warn / 15-min critical)
Datadog monitors for Spring service p99 > 500ms for 5m + HikariCP saturation
```

### New Relic

```text
New Relic alerts for Commerce PaaS checkout success rate < 99% + payment gateway error > 0.5%
New Relic alerts for Adobe Cloud APM error-count baseline
```

### Grafana

```text
Grafana alerting rules for K8s pod restart rate + Prometheus scrape failure
Grafana alerts wired to PagerDuty for our Spring service
```

### Prometheus

```text
Prometheus alerts for the promotions service (uptime + latency + error rate + saturation)
Prometheus alerting.rules for JVM heap > 85% for 10m + Kafka consumer lag > 10k
```

### Elastic

```text
Elastic Watcher alerts for audit-log unauthorized-access spike
Elastic Watcher alerts for AEM error-log ERROR-count > 100 in 5m
```

### CloudWatch

```text
CloudWatch alarms for App Builder namespace quota headroom < 20%
CloudWatch alarms for I/O Runtime activation errors > 1% for 10m
```

### Dynatrace

```text
Dynatrace alerts for baseline p95 breach on our Spring service
Dynatrace anomaly-detection alerts for the checkout journey
```

---

## SLOs

```text
SLOs for tier-1 checkout-api (availability 99.9% + p95 300ms + burn-rate policy)
SLOs for tier-2 catalog-service (availability 99.5% + p95 1s)
error-budget policy for our payment service
burn-rate alerts for T1 availability SLO (fast/slow/long burn)
quarterly SLO review — surface top-3 at-risk services
```

---

## On-call rotations

```text
on-call rotation for the checkout team, weekly handoff
escalation policy for payment-ops (primary → secondary → EM → director)
holiday overrides for Q4 (Thanksgiving + Christmas + New Year)
```

---

## Playbooks

Per-stack incident-response playbook prompts. STRIDE-informed for security scenarios.

### AEM

```text
STRIDE playbook for AEM unauthorized author access (Spoofing + Elevation of Privilege)
playbook for AEM Publish outage (Cloud Manager rollback + dispatcher failover)
```

### Adobe Commerce (PaaS)

```text
playbook for Commerce PaaS payment gateway outage (containment + external-comms)
STRIDE playbook for admin credential-stuffing attack
```

### Adobe Commerce SaaS

```text
playbook for Storefront Events schema drift across environments
STRIDE playbook for drop-in bundle tampering
```

### Sling / Shaft

```text
playbook for Sling instance pool health-check cascade failure
STRIDE playbook for MDM CRUD Information-Disclosure
```

### Spring Boot

```text
Spring service-outage cascade playbook (upstream service failing readiness)
STRIDE playbook for JWT-signing-key exposure
```

### Adobe App Builder

```text
playbook for namespace quota exhaustion (activations/day cap hit)
STRIDE playbook for exposed I/O Event handler
```

### Edge Delivery Services (EDS)

```text
playbook for LCP-critical regression that blocks a launch
STRIDE playbook for redirects.xlsx tampering / open-redirect risk
```

### EDS + Commerce

```text
playbook for cart-conversion drop caused by drop-in / EDS block coordination failure
STRIDE playbook for Payment Services edge-side round-trip data exposure
```

---

## Postmortems

```text
postmortem for 2026-08-15 SEV1 --incident-in ./incidents/2026-08-15.md
postmortem for last week's Commerce checkout outage — blameless format
postmortem for the payment outage, sev2 (auto-expand from --incident text)
postmortem action-items followup for open items > 30 days
postmortem for the App Builder namespace exhaustion, sev3 (lightweight)
```

---

## Chained SDLC passes

Operations is the ops entry point. Common one-shot chains:

```text
chain: release → operations (post-deploy runbook + alerts wire-up)
audit findings → alert rules for CRITICAL items
sonar Quality Gate breach → alert
operations → impact-analysis if we page too often on X (which components own the SLI?)
chain: architecture → operations (STRIDE threat model → playbook)
```

---

## Role-flavored requests

Prefix any prompt with `"as <role>, ..."` for a per-run role override (no write to `.bmad/role.yaml`):

```text
as devops, full ops kit for our new service (Datadog stack)
as security, STRIDE-informed playbook + audit-log dashboard + PII-leak alerts
as ea, portfolio-level observability strategy across all services
as tl, team-level runbook + dashboard + alerts for service X
as de, component-level runbook + per-endpoint dashboard tiles
as qa, regression-alert rules + test-env dashboard
as pm, SLO-attainment + business-metric dashboards
as migration lead, cutover-day runbook + before/after health-check dashboard
```

---

## Enterprise gate patterns

Mark ops-artifact items accepted / deferred / wontfix so subsequent runs stop resurfacing them. See [Findings Gate](../../concepts/findings-gate) for the YAML shape.

```text
list decisions
operations --include-decided                    # bypass the decisions gate
operations --decisions-path ./compliance/decisions.yaml
operations --ignore-decision-expiry
operations --fail-on-overdue                    # CI: exit 6 if any ops-artifact item is OVERDUE per role SLA
```

---

## Troubleshooting

```text
auto-detect couldn't find observability platform — how do I set --observability manually?
runbook missing quick-diagnosis commands — how do I add them?
alerts fire too often — how do I tune the threshold in --artifacts alerts?
SLO doc reports the wrong tier — how do I switch --service-tier?
switch role to devops
switch intake to technical
```

---

## Follow-up prompts (post-run)

Reusable after any Operations run:

```text
which alerts fired most last month — should we tune them?
SLO burn-rate report for our tier-1 services
on-call rotation health check — anyone approaching burnout?
which runbooks haven't been touched in > 6 months?
which ops-artifact items are OVERDUE per SLA?
which decisions are already accepted for this service?
hand the alerts pack to the Release agent — wire them into the deploy plan
audit the code paths that own the alerting SLIs
```
