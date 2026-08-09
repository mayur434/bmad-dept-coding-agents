# Runbook authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a runbook for an Apache Sling / Shaft (sling-12)
project. Combine with `templates/runbook.md` as the master skeleton.

## Purpose framing

A Sling runbook is written for a middleware SRE at 3 AM. Sling is
OSGi-native — the vocabulary is **bundles**, **services**, **components**,
**Feature Model**, **Sling job queues**, **JCR sessions**. Runbooks focus
on: OSGi bundle state, service registration health, Sling job queue
backlog, JCR session leaks, and Feature Model install divergence. Sling
instance restart is a legitimate mitigation (unlike AEMaaCS).

## Common incident symptoms for Sling

- OSGi bundle stuck in INSTALLED (not ACTIVE) — dependency not resolved
- Sling service unavailable — service registration missing / stale
- MDM CRUD latency > 500ms (JCR session leak, connection-pool exhaustion)
- SAM API 5xx > 2% (bundle activation failure, missing OSGi config)
- Sling job queue depth per topic > 500 (worker starvation, poison message)
- Feature Model install divergence (Prod ≠ Stage bundle set)
- JCR session leak count rising (missing session.logout())
- Health check `/system/console/healthcheck` red (specific tag)
- Cluster leader election flapping (replication / discovery flapping)
- Bundle export-package version mismatch (semantic-versioning regression)

## Quick-diagnosis commands (per common symptom)

- **Bundle stuck INSTALLED:** `curl -sf http://{host}:8080/system/console/bundles.json | jq '.data[] | select(.state != "Active")'`;
  check unresolved dependencies via `/system/console/depfinder`.
- **Service unavailable:** `/system/console/services.json` — search for the missing pid;
  `/system/console/components.json` — check UNSATISFIED components.
- **MDM CRUD latency:** `/system/console/jmx` → `JCR SessionRegistry` MBean → active session count;
  connection-pool metrics via Micrometer `/actuator/metrics/hikaricp.connections.active` (if bridged).
- **SAM API 5xx:** `tail logs/error.log | grep -E 'ERROR|Exception'`;
  `/system/console/status-Configurations` for missing OSGi config.
- **Sling job queue backlog:** `/system/console/slingevent.json` — per-topic queue depth;
  check dead-letter (JobResult.CANCELLED) count.
- **Feature Model divergence:** compare Feature Model artifact hash across
  envs; `curl /system/console/features.json`.
- **Health check red:** `/system/console/healthcheck?tags=<tag>&format=json`;
  drill into the failing check's `resultLog`.
- **Cluster leader flapping:** discovery log tail; `/system/console/status-Discovery`.

## Likely causes (per common symptom)

- **Bundle INSTALLED:** unresolved import-package; version-range mismatch;
  Feature Model composition change dropped a dependency; classloader
  isolation regression.
- **Service unavailable:** OSGi component activation exception;
  `@Reference` unsatisfied; missing OSGi config in the run mode.
- **MDM CRUD latency:** JCR session leak — missing `session.logout()` in a
  code path; connection-pool tuning too low for load.
- **SAM API 5xx:** bundle activation failed post-deploy; missing config
  fragment; `@Reference(cardinality=MANDATORY)` for a service that failed to
  register.
- **Sling job queue backlog:** worker thread pool starved; poison message
  looping; DB write bottleneck downstream of the worker.
- **JCR session leak:** try/finally pattern missing;
  `AutoCloseable`/`ResourceResolver.close()` not called; long-running
  workflow retaining sessions.

## Mitigation steps (per common symptom)

- **Bundle INSTALLED:** `curl -sf -u admin:admin -F action=refresh /system/console/bundles`;
  if unresolved dependency, restart via `/system/console/bundles/<id>` action=start;
  if Feature Model divergence, redeploy last-known-good FM.
- **Service unavailable:** disable/enable the OSGi component via
  `/system/console/components` action=disable then enable; if config-missing,
  push the config via `curl -F apply=true .../configMgr/<pid>`.
- **MDM CRUD latency:** identify leak via `/system/console/jmx` session-count trend;
  restart affected bundle if leak is bundle-scoped; escalate to code owner.
- **SAM API 5xx:** restart affected bundle; if config drift, redeploy config;
  if unresolved in 5 min, restart the Sling instance (rolling across the pool).
- **Sling job queue backlog:** clear known-poison job via
  `/system/console/slingevent` action=cancel; scale worker pool if backlog is
  legitimate load; escalate if downstream DB is the bottleneck.

## Rollback triggers for Sling

Cross-reference `rollback-plans/sling.md` from the Release agent:

- Bundle ACTIVE-count regression > 5 bundles post-deploy.
- SAM API 5xx > 2% for 5 min.
- MDM CRUD latency p95 > 1s for 10 min.
- Sling job queue backlog > 5000 per topic and rising.
- Cluster leader flapping > 3 elections / 5 min.
- Manual call from middleware SRE.

## Escalation matrix for Sling

- **L1** — middleware on-call SRE, Sling service owner.
- **L2** — Sling / Shaft tech lead, OSGi platform owner.
- **L3** — Engineering manager, JVM/GC specialist for heap/GC storms.
- **Vendor** — Apache Sling community (open ticket at issues.apache.org
  for confirmed platform bugs); JVM vendor for GC-storm root cause.

## Verification steps for Sling

- All bundles ACTIVE (except intentionally FRAGMENT / RESOLVED).
- `/system/console/healthcheck?tags=live&format=json` all green.
- MDM CRUD p95 ≤ target for tier.
- SAM API 5xx ≤ 0.5% sustained 15 min.
- Sling job queue depth ≤ 100 per topic.
- JCR session count stable (no rising trend over 15 min).
- Cluster leader stable (no elections in 30 min).

## Comms templates for Sling

**Channels:** `#middleware-deploys`, `#sling-oncall`, `#platform-status`.

**Stakeholders:** middleware SRE, Sling tech lead, OSGi platform owner,
DBA (for JCR / connection-pool issues), on-call JVM specialist.

## 2 worked runbook examples for Sling

### Example 1 — "com.example.mdm-service bundle stuck INSTALLED"

- **Symptom:** `com.example.mdm-service` bundle state INSTALLED (not ACTIVE) after v2.5.0 deploy on Publish nodes 2 and 4.
- **Quick diagnosis:**
  1. `curl -sf .../system/console/bundles.json | jq '.data[] | select(.symbolicName=="com.example.mdm-service")'`.
  2. `/system/console/depfinder` — check missing import-package.
  3. Compare bundle version pins: `git log -p feature-model.json`.
  4. Check error.log for `ImportPackage` unresolved messages.
  5. Compare Feature Model artifact hash across all Publish nodes.
- **Mitigation:** refresh bundles via `/system/console/bundles action=refresh`;
  if unresolved, redeploy last-known-good Feature Model; verify all Publish
  nodes have the same FM hash.
- **Rollback trigger:** > 5 bundles non-ACTIVE at 10 min post-deploy.
- **Escalation:** L1 middleware SRE → L2 Sling tech lead if FM composition regression.

### Example 2 — "MDM CRUD p95 latency > 800ms"

- **Symptom:** MDM PUT `/mdm/customer/{id}` p95 spiked to 850ms (baseline 180ms) over 20 min.
- **Quick diagnosis:**
  1. `/system/console/jmx` → `JCRSessionRegistry` → active session count trend.
  2. `hikaricp.connections.active` — pool saturation?
  3. Downstream DB query time — MySQL slow-query log.
  4. `/system/console/slingevent` — is there a job backlog competing for threads?
  5. GC log — pause frequency / duration.
- **Mitigation:** if JCR session leak — restart the `mdm-service` bundle;
  if pool saturation — bump `pool.maximum` OSGi config; if DB, engage DBA.
- **Rollback trigger:** p95 > 1s at 15 min.
- **Escalation:** L1 middleware SRE → L2 Sling tech lead + DBA.

## Anti-patterns for Sling

- **Runbook says "restart JVM"** — restarting a Sling instance discards
  JCR working sets and impacts users; prefer bundle-level restart first.
- **No Feature Model check** — FM divergence across the pool is a top-5
  root cause and easy to miss.
- **Missing OSGi component vs service distinction** — an INACTIVE
  component and an unregistered service look similar but need different
  mitigations.
- **Diagnosis skips healthcheck endpoint** — Sling's built-in HC is the
  fastest triage tool.
- **Verification uses HTTP-only endpoints** — Sling internal state
  (bundles, components, jobs) is only visible via `/system/console`.

---

Generate the full runbook using `templates/runbook.md` as the master,
populating placeholders with stack-appropriate content from the guide above.
