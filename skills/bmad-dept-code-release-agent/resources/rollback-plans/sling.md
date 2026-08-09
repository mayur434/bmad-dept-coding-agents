# Rollback-plan authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a rollback plan for an Apache Sling / Shaft
(sling-12) project. Combine with `templates/rollback-plan.md` as the
master skeleton.

## Purpose framing

A Sling rollback plan establishes the OSGi bundle activation and
health-check signals that force the call, the on-call authority who
owns the Feature Model or bundle-uninstall revert, the exact revert
path (bundle uninstall + previous version install for a hot swap;
Feature Model recomposition + instance restart for framework-level
changes), and the SAM / MDM API-consumer comms that must fire before
downstream services degrade. Because Sling holds JCR state on the
instance, schema-level changes (node types, MDM columns) have limited
reversibility and must be flagged pre-ship.

## Rollback triggers for Sling — specific + quantified

- **OSGi bundle stuck in RESOLVED** (not ACTIVE) > 5 min post-deploy —
  bundle failed to start; check `/system/console/bundles`.
- **Sling health-check regression** — one or more registered checks
  in `/system/console/healthcheck` FAILED for > 5 min.
- **MDM CRUD error rate > 2%** for 10 min (from application metrics on
  the MDM service surface).
- **SAM API 5xx rate > 1%** for 10 min (Sling Authentication /
  Authorization service surface).
- **Sling servlet response p99 > 3s** for 10 min at the front tier.
- **JCR session-leak warning** in the log (> 100 open sessions or
  climbing linearly) — indicates servlet regression.
- **Sling Jobs queue backlog > 5 000 jobs** with no drain for 10 min.
- **Feature Model composition failure** at instance startup — instance
  refuses to boot with the new feature file.

## Decision authority for Sling

- **Primary:** on-call SRE watching `/system/console` + app metrics.
- **Approver for revert:** tech lead OR platform lead (owns the
  Feature Model + bundle install manifest).
- **Auto-rollback** — not native; some deployments wire a health-check
  poller that triggers Feature Model recompose to the previous
  composition. <!-- verify: shaft-specific automation -->
- **Escalation** — if primary on-call is unreachable within 5 min,
  backup SRE + platform lead paged in parallel.
- **CAB engagement required** for JCR node-type schema changes and MDM
  column drops — both have limited reversibility.

## Rollback steps for Sling — numbered + timed

1. **Identify affected bundles** — `/system/console/bundles` — find the
   bundles installed by the failed release (symbolic name + version).
2. **Uninstall the failed bundles** — via `/system/console/bundles`
   uninstall action OR `curl -u admin:admin -F action=uninstall
   http://<host>:<port>/system/console/bundles/<bsn>` (< 1 min per
   bundle).
3. **Install previous versions** — `curl -u admin:admin -F
   action=install -F bundlefile=@<previous>.jar
   http://<host>:<port>/system/console/bundles` (< 1 min each).
4. **If Feature Model composition changed** — revert the feature
   `.json` to previous revision + `mvn slingfeature:aggregate` to
   recompose, then restart instance (2–5 min).
5. **Verify bundles ACTIVE** — `/system/console/bundles` — all target
   bundles show ACTIVE state; any RESOLVED/INSTALLED requires manual
   dependency resolution.
6. **Verify health checks** — `/system/console/healthcheck` — all
   checks GREEN.
7. **Revert MDM schema** (if the release touched MDM columns) —
   WARNING: additive columns can stay; **drops** must be restored from
   backup (see Data reversibility below).
8. **Drain and re-enable Sling Jobs queues** — pause via
   `/system/console/slingjobs`, drain backlog, resume.
9. **Notify** SAM/MDM API consumers via `#sling-releases`.
10. **Verify** synthetic MDM CRUD + SAM auth flow end-to-end.

## Data reversibility flags for Sling

Which changes CANNOT be safely rolled back — must be flagged in the plan:

- **JCR node type schema removals** — removed cnd definitions cannot
  be re-added without re-populating repository state; content nodes
  referencing removed types become invalid.
- **MDM column drops** — schema down-migration requires backup restore;
  data in the dropped column is lost.
- **OSGi config namespace removals** — removed config PIDs mean the
  bundle expecting them fails to start on revert if the previous
  version still requires them.
- **Sling Jobs schema changes** — in-flight jobs authored against the
  new schema cannot deserialize under the reverted bundle.
- **Sling authentication provider changes** — removing a provider
  invalidates issued sessions.

**Guidance:** any JCR schema or MDM drop → CAB approval + JCR/DB
snapshot pre-deploy; do NOT auto-revert; walk forward-fix explicitly.

## Stakeholder comms during rollback for Sling

**Pre (moment of decision):** `#sling-releases` — `[ROLLBACK IN
PROGRESS] {{bundle_set}} v{{version}} → v{{previous}} — trigger:
{{trigger}} — ETA {{eta}}`.

**During:** bundle activation state per node in the pool; health-check
recovery.

**API consumers:** SAM and MDM consumers paged the moment the call is
made — they may need to fail over to a cached copy or degrade
gracefully.

**Customer-facing:** only if SAM/MDM failures were customer-observable
(front-facing app degradation).

**Post (all-clear):** `[ROLLBACK COMPLETE] {{bundle_set}}
v{{previous_version}} live — bundles ACTIVE — health-checks GREEN —
jobs queue drained`.

## Post-rollback for Sling

- **RCA within 24h**, blameless.
- **JCR content-integrity verification** — sample nodes written during
  the failed release window; confirm they read correctly under the
  reverted bundle version.
- **MDM data-integrity verification** — sample records touched during
  the window; confirm no orphan foreign keys or split-brain state.
- **Sling Jobs replay** — audit jobs authored during the window;
  determine whether any need re-queuing under the reverted schema.
- **Session audit** — confirm no leaked JCR sessions from the failed
  deploy.
- **OSGi config state** — confirm all PIDs match the reverted-version
  expected shape.
- **Lessons-learned template** — see `templates/rollback-plan.md`
  §Lessons learned; fill during RCA.

## 2 worked rollback-plan examples for Sling

**v4.1.0 — SAM auth provider bundle, session leak.** Trigger: JCR
session count climbed from 40 to 850 in 12 min post-deploy; health-check
`SessionCount` FAILED at T+15 min. Decision: on-call SRE + platform
lead on bridge, revert called at T+18 min. Steps: bundle uninstall of
`com.example.sam.auth@4.1.0` (< 1 min), install previous
`com.example.sam.auth@4.0.9` (< 1 min), bundle ACTIVE at T+21 min,
health-check GREEN at T+24 min, session count decayed to 45 by T+35.
Recovery: 17 min. Post: RCA identified a missing `try-with-resources`
around a `ResourceResolver` in the new auth-provider code path;
integration test coverage gap flagged.

**v4.2.0 — MDM column drop, DB restore path.** Trigger: MDM CRUD
failure at T+3 min post-deploy — release included a `DROP COLUMN
legacy_id` migration; downstream service referenced the dropped column
via cached schema. Decision: on-call SRE flagged irreversible — DB
restore approved. Steps: instance-level halt at T+8 (maintenance mode),
bundle revert at T+12, DB restore from pre-deploy snapshot at T+18
(28 min for 45GB MDM DB), reconciliation of 14 records written during
window (manual), instance resumed at T+52. Post: process gap flagged
— MDM drops added to CAB approval checklist; downstream consumers
audited for cached schema references.

## Anti-patterns to avoid for Sling

- **Uninstalling bundles without dependency ordering awareness** —
  removing a bundle whose exports another bundle imports leaves the
  importer in RESOLVED state.
- **Skipping Feature Model recompose after bundle uninstall** — the
  feature file still references the failed bundle; next restart
  reinstalls it.
- **Reverting without JCR snapshot** when the release touched node
  types — content authored during the window may be invalid on revert.
- **Ignoring Sling Jobs queue backlog** during revert — replayed
  jobs may run against a stale bundle version, compounding the
  regression.
- **Rolling back on a live instance without draining sessions** —
  active users see mid-flight bundle swap errors.

---

Generate the full rollback plan using `templates/rollback-plan.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
