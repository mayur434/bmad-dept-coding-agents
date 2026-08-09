# Runbook authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a runbook for an AEM as a Cloud Service (AEMaaCS)
or AEM Managed Services (AMS) project. Combine with `templates/runbook.md`
as the master skeleton.

## Purpose framing

An AEM runbook is written for a Cloud Manager / dispatcher / AEM Publish
on-call at 3 AM. It must be **incident-symptom-based** (`dispatcher
hit-ratio dropped below 90%`, not `AEM is slow`), name **exact
commands** (`curl -s /system/console/status-productinfo`), and include
**quantified triggers** (`Publish 5xx > 1% for 5 min → rollback`).
Dispatcher, Publish, Author, and Cloud Manager each have their own
symptom vocabulary — do not conflate.

## Common incident symptoms for AEM

- Dispatcher hit-ratio dropped below 90% (cache-key regression / purge storm)
- Publish-tier 5xx rate > 1% (bundle activation failure, Sling model NPE)
- Author-instance unresponsive (JCR session leak, replication queue clog, GC storm)
- Replication queue depth > 100 items (Publish subscriber down, network segmentation)
- Content Fragment publication lag > 5 min (workflow bottleneck, missing model reference)
- DAM upload failing (asset processing queue stalled, missing profile)
- Cloud Manager execution stuck / failed (quality-gate regression, deploy-stage timeout)
- CDN origin errors after deploy (dispatcher config regression, cache-key change)
- GraphQL query error rate > 2% (schema drift, Content Fragment model change)
- Sling job queue backlog per topic (worker starvation, poison message)

## Quick-diagnosis commands (per common symptom)

- **Dispatcher hit-ratio drop:** `curl -sf https://{host}/dispatcher/publish/health` — probe;
  Cloud Manager → CDN hit-ratio panel; check `/etc/httpd/conf.d/dispatcher.conf`
  diff against last-known-good; `tail -f /var/log/httpd/dispatcher.log | grep MISS`.
- **Publish 5xx spike:** `curl -sf https://{host}/system/console/healthcheck?tags=publish`;
  `curl -sf https://{host}/system/console/status-productinfo`; look for `INSTALLED`
  bundles that should be `ACTIVE`; `curl /libs/granite/monitoring/gc.json`.
- **Author unresponsive:** `curl -sf https://{author}/system/console/healthcheck`;
  `curl /libs/granite/monitoring/threads.json`; check active JCR sessions via
  `/system/console/jmx`; check replication queues at `/etc/replication/agents.author.html`.
- **Replication queue depth:** `curl /etc/replication/agents.author/publish.queue.json`;
  probe each subscriber `/bin/receive?sling:authRequestLogin=1`.
- **CF publication lag:** `/etc/workflow/instances.html`; check `com.day.cq.wcm.workflow`
  queue backlog; check missing model references via `/mnt/overlay/wcm/core/content/sites`.
- **Cloud Manager execution:** Cloud Manager UI → Execution ID → step-level logs;
  `aio cloudmanager:pipeline:get-execution <pipelineId> <executionId>`. <!-- verify -->
- **GraphQL error rate:** `curl /content/_cq_graphql/global/endpoint.json -d '{...}'`
  — send representative query set; check `/system/console/configMgr` for the
  GraphQL persisted-query endpoint config.

## Likely causes (per common symptom)

- **Dispatcher hit-ratio drop:** dispatcher config change widened cache-key /
  removed a farm filter; edge purge storm; new Vary header from application
  layer; unrestricted query-string in URL.
- **Publish 5xx:** bundle activation failed post-deploy; Sling model NPE on a
  new template; missing OSGi config in the target run mode; JCR session leak
  exhausting connections.
- **Author unresponsive:** long-running query (JCR `select * from nt:base`);
  workflow storm; DAM asset processing loop; replication queue clogged and
  starving worker threads.
- **CF publication lag:** publish workflow model misconfigured; missing CF
  model reference; permissions denying replication service user.
- **Cloud Manager execution stuck:** quality-gate metric regression
  (`customer.critical > 0`); flaky UI test in the perf stage; runtime env
  provisioning delay. <!-- verify: current stage names -->

## Mitigation steps (per common symptom)

- **Dispatcher hit-ratio drop:** revert last dispatcher config change; issue a
  full purge (`curl -X POST /invalidate.cache`); reload dispatcher
  (`httpd -k graceful`); if unresolved, revert last Cloud Manager deploy.
- **Publish 5xx:** restart affected bundle via `/system/console/bundles`;
  redeploy last known-good build via Cloud Manager; if OSGi config drift is
  the cause, revert the config via Cloud Manager config-only pipeline.
- **Author unresponsive:** kill long-running JCR sessions via
  `/system/console/jmx` → `Session` MBean; if unresponsive after 3 min,
  restart the Author instance; escalate to AEM lead if AEMaaCS (no restart control).
- **Replication queue clog:** clear failed items via
  `/etc/replication/agents.author/publish.html` → Clear; if subscriber is
  down, escalate immediately (customer-visible content freeze).

## Rollback triggers for AEM

Cross-reference `rollback-plans/aem.md` from the Release agent:

- Cloud Manager quality gate fails post-deploy (any new `customer.critical`).
- Dispatcher hit-ratio drops below 90% and sustains 5 min.
- Publish 5xx rate > 1% sustained 5 min.
- Author instance CPU > 90% or unresponsive Sidekick > 3 min.
- Replication failure rate > 5%.
- Manual call from release manager or on-call.

## Escalation matrix for AEM

- **L1** — dispatcher-admin (dispatcher / CDN / cache-key issues), on-call SRE.
- **L2** — AEM tech lead (bundle / OSGi / Sling model issues), Cloud Manager owner.
- **L3** — Engineering manager (extended outages, cross-team coordination).
- **Vendor** — Adobe Customer Care (AEMaaCS platform issues; open a P1 case with
  Cloud Manager program ID + execution ID).

## Verification steps for AEM

- Cloud Manager execution GREEN across all stages.
- Dispatcher hit-ratio ≥ 95% at 15 min post-mitigation.
- Publish 5xx rate < 0.5% sustained 15 min.
- Author `/system/console/healthcheck` all-green.
- Replication queues empty; no `403`/`404` from Publish subscribers.
- CF GraphQL representative query set returns 200 (< 500ms).
- Synthetic customer journey (home → PDP → cart) green via CDN.

## Comms templates for AEM

**Channels:** `#aem-releases` (deploy comms), `#aem-oncall` (active incidents),
`#customer-status` (customer-facing).

**Stakeholders:** dispatcher-admin, AEM tech lead, editorial lead (if Author
affected), Cloud Manager release manager, on-call SRE.

## 2 worked runbook examples for AEM

### Example 1 — "Dispatcher hit-ratio dropped below 90%"

- **Symptom:** CDN hit-ratio 87% (baseline 96%) for 12 min; Publish origin RPS 4×.
- **Quick diagnosis:**
  1. Check dispatcher config diff (last 24h) — `git log -p /etc/httpd/conf.d/dispatcher.conf`.
  2. Sample dispatcher log — `tail -1000 /var/log/httpd/dispatcher.log | grep -c MISS`.
  3. Check CDN Vary header — `curl -I https://{host}/`.
  4. Check for purge-storm event — CDN purge log last 30 min.
  5. Check Author replication activity — spike may cascade into purge.
- **Mitigation:** revert last dispatcher config change → `httpd -k graceful` →
  full purge → wait 5 min → verify hit-ratio ≥ 95%.
- **Rollback trigger:** hit-ratio < 85% at 15 min post-mitigation.
- **Escalation:** L1 dispatcher-admin → L2 AEM lead if root cause is
  application-layer Vary header.

### Example 2 — "Publish 5xx rate > 1% after v2.5.0 deploy"

- **Symptom:** Publish `/content/loyalty/*` 5xx rate 2.3% (baseline 0.1%) starting T+8min after v2.5.0.
- **Quick diagnosis:**
  1. `/system/console/status-productinfo` on affected Publish — bundle state.
  2. `/system/console/healthcheck?tags=publish` — check registered health checks.
  3. `error.log | grep -E 'ERROR|Exception' | tail -100` — look for NPE / class-not-found.
  4. Cloud Manager execution → Deploy stage → per-instance log tail.
- **Mitigation:** restart affected bundle via `/system/console/bundles` → verify;
  if unresolved in 3 min → revert v2.5.0 via Cloud Manager rollback.
- **Rollback trigger:** 5xx > 1% at 5 min post-mitigation.
- **Escalation:** L1 AEM tech lead → L2 engineering manager if rollback fails.

## Anti-patterns for AEM

- **Runbook says "restart AEM"** — on AEMaaCS you cannot; use bundle-level
  restart or Cloud Manager rollback.
- **Diagnosis relies on `tail /error.log`** — AEMaaCS logs are not
  filesystem-accessible; use Log Forwarding or Cloud Manager logs.
- **Missing dispatcher context in a "site is slow" runbook** — 80% of AEM
  perf incidents route through the dispatcher / CDN; a runbook without
  dispatcher checks misses the common case.
- **No Cloud Manager execution ID in the escalation** — Adobe support cannot
  correlate without it.
- **Verification uses author-only endpoints** — Publish tier is the
  customer-facing surface; verify there.

---

Generate the full runbook using `templates/runbook.md` as the master,
populating placeholders with stack-appropriate content from the guide above.
