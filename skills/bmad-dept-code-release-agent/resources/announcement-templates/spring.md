# Announcement authoring guide — Spring Boot

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a multi-channel release announcement for a
Spring Boot service. Combine with `templates/announcement.md` as the
master skeleton.

## Purpose framing

Spring Boot release announcements are shaped by **operational reality**:
services carry SLAs, DB migrations have windows, deploys wake on-call
rotations, and downstream consumers of your API contracts read release
notes as an upgrade guide. The audience skews strongly technical —
service consumers, ops/SRE, on-call — with very rare external framing.
What makes this stack unique: **API contract changes and DB migrations
often dictate the entire release cadence**, so announcements must
foreground contract version, migration window, and rollout strategy
before any feature narrative.

## Audience segmentation for Spring

- **API consumers** *(primary)* — internal services that call your
  REST/gRPC/messaging contracts; they care about contract-version
  changes and deprecation windows.
- **Ops / SRE** — deploy window, DB migration timing, K8s rollout
  strategy, new alerts/runbooks/dashboards.
- **On-call rotation (primary + secondary)** — new alerts, new
  runbooks, error-budget impact, rollback triggers.
- **Platform / infra owners** — dependency bumps that affect the
  platform baseline (Spring Boot minor upgrades, JDK crossings).
- **Data / analytics team** — event schema changes if the service
  publishes to Kafka/Kinesis/EventBridge.

## Channel-by-channel guidance for Spring

### Email announcement (long-form)

- **Subject line pattern:** `[Spring / {{service}}] v{{version}} —
  {{contract}} + {{rollout}}` (e.g. `[Spring / payment-service] v2.5.0
  — REST v2 API + canary rollout Tue 09:00 UTC`).
- **Body sections:** what/why/when + API contract diff (endpoints,
  request/response schemas) + DB migration window + new
  alerts/runbooks + rollback triggers + on-call primary/secondary
  named + observability signals to watch.
- **CC/To:** primary To = `{{service}}-releases@`; CC =
  `api-consumers-{{service}}@` (per your dependency graph),
  `oncall-primary@`, `sre-{{team}}@`, `data-eng@` when event schema
  changes.
- **Attachment/link conventions:** OpenAPI diff / proto diff, Grafana
  dashboard link, PagerDuty escalation policy link, Flyway migration
  DDL summary, PR link.

### Slack announcement (short-form)

- **Channel routing:** `#{{service}}-releases` (primary) +
  `#oncall-primary` for deploy window + `#api-consumers` for contract
  changes + `#sre-{{team}}` for infra impact + `#data-eng` for event
  schema changes + `#incidents-{{service}}` for hotfixes.
- **Emoji convention:** :rocket: launches, :leaves: canary, :large_blue_circle:
  blue-green, :arrows_counterclockwise: rolling, :hammer_and_wrench:
  breaking API, :rotating_light: security, :warning: DB migration.
- **Threading:** top message = one-line release + rollout strategy +
  window; DB migration DDL, alert list, dashboard links, on-call names
  drop into thread.
- **Pin:** pin release-day post through T+24h; pin DB migration posts
  T-24h through window-close.

### Confluence page (documentation-first)

- **Space + location:** `Backend Services` space → `{{service}}` →
  `Releases` → `v{{version}}`. <!-- verify: your team's Confluence
  structure -->
- **Long-form sections:** release scope, API contract diff (endpoints
  + schemas), DB migration plan (Flyway/Liquibase ordering: schema
  before deploy, backfill during, cleanup after), K8s rollout config
  (`maxSurge`/`maxUnavailable` or Istio weights), new alerts +
  runbooks + dashboards, rollback triggers with numeric thresholds
  (error-rate, p99 latency), on-call rotation for release window,
  post-deploy verification checklist.
- **Label conventions:** `spring-boot`, `{{service}}`, `release`,
  `v{{version}}`, plus one of `contract-additive` / `contract-breaking`
  / `no-contract-change` and one of `db-migration` / `no-db-migration`.

### Twitter / LinkedIn (external-facing)

- **Usually skip.** Internal service releases are not externally
  interesting. Only reach for external comms when the release is a
  public API launch (developer-facing product) or an open-source
  contribution.
- **Character budget:** Twitter ~280, LinkedIn 3000. Keep to public
  API surface only; no internal endpoints, K8s namespaces, or DB
  details.
- **Hashtag convention:** `#SpringBoot #API` for public API; skip for
  internal services.

## Stakeholder-tone matrix for Spring

| Audience | Email | Slack | Confluence | External |
|---|---|---|---|---|
| API consumers | Contract diff + deprecation timeline | `#api-consumers` :hammer_and_wrench: | OpenAPI diff + upgrade guide + example client code | Rare (public API) |
| Ops / SRE | Deploy window + rollout + DB migration | `#sre-{{team}}` :warning: | Rollout runbook + rollback triggers | — |
| On-call | New alerts + runbooks + rollback triggers | `#oncall-primary` pinned | Runbook links + escalation matrix | — |
| Platform owners | Framework/JDK bumps | `#platform` thread | Baseline compatibility matrix | — |
| Data / analytics | Event schema changes | `#data-eng` :hammer_and_wrench: | Event schema changelog | — |

## What to skip / redact per Spring

- Do NOT publish internal API paths, service DNS names, or K8s
  namespace names externally.
- Do NOT publish DB credentials, connection strings, or JDBC URLs
  anywhere — even internal.
- Do NOT publish PagerDuty escalation contacts externally.
- Do NOT publish `application-{{env}}.yaml`, ConfigMap, or Secret
  contents in any channel.
- Do NOT publish Grafana/Prometheus internal endpoints externally.
- Do NOT dump raw stack traces from prod in external channels — they
  leak class-path structure and library versions.

## Sensitivity classification for Spring

- **Additive contract change** → Internal (`#{{service}}-releases` +
  `#api-consumers`).
- **Breaking contract change** → Internal, 30-day deprecation notice
  required (announce twice: T-30d + release day).
- **DB migration** → Internal + `#sre-{{team}}` pinned; ops window
  coordination critical.
- **New alert / runbook** → Internal + `#oncall-primary` mandatory.
- **Security patch** → Restricted internal until CVE embargo elapses;
  no external post.
- **Public API launch** → External appropriate; no internal detail.

## 3 worked announcement examples for Spring

1. **Major feature launch — REST API v2 for payment-service (v2.5.0).**
   Email `[Spring / payment-service] v2.5.0 — REST v2 API live, canary
   rollout Tue 09:00 UTC` to `payment-service-releases@` +
   `api-consumers-payment@` + `oncall-primary@` + `sre-payments@`.
   Slack `#payment-service-releases` :leaves: pinned + `#api-consumers`
   :hammer_and_wrench: with OpenAPI diff in thread + `#oncall-primary`
   with rollback triggers (error-rate >1%, p99 >2s). Confluence
   long-form with contract diff + canary weights + rollback playbook.
   **No external post** (internal service).

2. **Breaking change — REST v1 sunset (v2.6.0).**
   Email `[Spring / payment-service] v2.6.0 — BREAKING: REST v1
   removed, consumers must migrate`. T-30d pre-notice email to
   `api-consumers-payment@` + T-7d reminder + T-24h pinned Slack in
   `#api-consumers` + `#payment-service-releases`. Confluence migration
   guide with per-endpoint v1→v2 mapping table. **No external post.**

3. **Hotfix / security patch (v2.5.1).**
   Slack-first `#payment-service-releases` + `#incidents-payment`
   :rotating_light: with hotfix summary + K8s rollout ETA + rollback
   trigger. Email `oncall-primary@` + `sre-payments@` under
   CVE-embargo language. No Confluence until post-mortem. **No
   external post** during embargo.

## Anti-patterns to avoid for Spring

- Don't announce a DB migration without a maintenance window
  pre-notice (T-24h minimum) — ops and consumers must plan.
- Don't announce breaking API changes without a 30-day deprecation
  window — consumer teams cannot re-plan sprints on release day.
- Don't skip numeric rollback triggers — "roll back if it looks bad"
  is not actionable at 3am; give concrete thresholds.
- Don't announce a new alert without the runbook link — on-call gets
  the page with no recourse.
- Don't dump raw commit history to `#api-consumers` — they read
  contracts, not commits.
- Don't announce Spring Boot minor upgrades without the platform
  baseline compatibility matrix — dependency-conflict tickets follow.

---

Generate the full announcement using `templates/announcement.md` as
the master, populating placeholders with stack-appropriate content
from the guide above.
