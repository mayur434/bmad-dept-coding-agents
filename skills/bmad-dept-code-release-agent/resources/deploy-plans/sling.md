# Deploy-plan authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a deploy plan for an Apache Sling or
Adobe Shaft (sling-12) project. Combine with `templates/deploy-plan.md`
as the master skeleton.

## Purpose framing

A Sling deploy plan choreographs OSGi bundle install order, Feature
Model composition, and health-check gates on each Sling instance in
the pool. Because Sling supports live bundle install (no restart for
most bundles) and Feature Model requires restart, the plan must state
which changes go live hot and which need a rolling restart, and how
the Sling `/system/console/healthcheck` result gates traffic on each
instance.

## Pre-deploy checklist for Sling

- **OSGi bundle deploy order** confirmed — dependencies before
  consumers; API bundles before impl bundles.
- **Feature Model diff** reviewed if the release changes the
  composition (`.slingfeature` files); classify as hot-install or
  restart-required.
- **Health checks** GREEN on all instances pre-deploy via
  `/system/console/healthcheck.json`.
- **JCR content freeze** if the release touches node-types or ACLs
  (writes during migration risk conflicts).
- **Repoinit scripts** reviewed for idempotency; existing structures
  respected.
- **`sling.properties`** run-mode diff verified across the pool.
- **Sling starter version** compatibility confirmed if bumping.
  <!-- verify: 12.x compatibility matrix -->
- **Load-balancer drain** procedure ready — each instance drained
  before bundle install, re-enabled after health-check pass.

## Deploy phases for Sling — rollout-specific

Sling deploys are naturally rolling — bundle install per instance
after LB drain. Phase against the resolved `--rollout`:

- **`canary`.** Deploy to 1 instance, hold for a soak window with
  synthetic traffic + real 5% via LB weighted routing, then remainder
  in a rolling pass.
- **`blue-green`.** Two Sling instance pools; deploy blue, warm
  caches, health-check green, LB cut. Preferred when the release
  touches JCR node-types.
- **`rolling` (default).** Drain instance, deploy bundles + feature
  model, restart if required, health-check, undrain; repeat per
  instance.
- **`feature-flag`.** Deploy dark behind an OSGi config toggle; flip
  via `/system/console/configMgr` update (persists to
  `sling:OsgiConfig`) — no restart.
- **`bigbang`.** All instances at once via cluster-wide install;
  reserved for hotfixes and non-stateful changes.

## Verification per Sling

- **Bundle activation state** — all target bundles in `ACTIVE` (not
  `INSTALLED` or `RESOLVED`) via `/system/console/bundles.json`.
- **OSGi component satisfied** — no `UNSATISFIED_REFERENCE` in
  `/system/console/components.json`.
- **Health checks** GREEN on
  `/system/console/healthcheck.json?tags=systemalive,shallow`.
- **Service-lookup latency** — a representative Sling servlet
  round-trip < 200ms p95.
- **JCR session-count** and **thread-pool** within baseline via
  Sling metrics.
- **Repoinit** post-conditions verified (target nodes / ACLs
  present).
- **Feature Model provisioning report** — no missing artifacts, no
  version conflicts.
- **`/error.log`** clean of new `ERROR` entries during the deploy
  window.

## Rollback triggers for Sling

- **Bundle stuck in `INSTALLED`** after 60s — dependency resolution
  failed.
- **Component `UNSATISFIED_REFERENCE`** on a newly-deployed
  component blocking a downstream service.
- **Health-check RED** on any instance and does not recover within
  2 min.
- **Servlet 5xx rate > 1%** sustained 5 min.
- **JCR session leak** — session-count trending upward > 20% baseline.
- **Repoinit failure** — target ACL/node not established after 3
  retries.
- **Feature Model provisioning fails** on any instance.
- **Manual call** from release manager or on-call.

## Communication plan for Sling

**Pre-deploy** (T-24h): announce in `#sling-releases` — bundle set,
Feature Model diff, whether restart is required, instance-by-instance
schedule.

**During deploy**: per-instance status posts (draining / deploying /
health-checking / restored). Consolidated status every 15 min for the
pool.

**Post-deploy** (T+1h): all-clear with bundle activation summary,
health-check state, error-log delta. Announcement distributed.

## Stakeholder RACI for Sling

| Role | Responsibility |
|---|---|
| Release manager | Owns instance-by-instance schedule + go/no-go per instance. |
| Tech lead | Owns bundle + feature-model change set; on bridge for activation. |
| DevOps / SRE | Executes LB drain + bundle install; monitors health checks. |
| QA | Runs Sling servlet smoke + representative content roundtrip. |
| Content ops | Verifies JCR content unchanged if repoinit ran. |
| On-call | Primary responder for bundle-activation regressions. |

## 2 worked deploy-plan examples for Sling

**v2.5.0 — New content-search servlet + supporting API bundle,
rolling, Prod.**
Pre-deploy: bundles built (`com.example.search-api-2.5.0.jar`,
`com.example.search-impl-2.5.0.jar`); health checks GREEN across 4
instances.
- Phase 1 (per instance, sequential): drain instance-1, install
  api-bundle → impl-bundle, verify activation, health-check pass,
  undrain.
- Repeat for instance-2, instance-3, instance-4.
- Rollback: uninstall impl-bundle + api-bundle, restore prior
  versions from OBR.

**v2.5.1 — Feature Model composition change (new bundle set), blue-
green, Prod.**
Pre-deploy: blue pool provisioned via `.slingfeature`; warm-up job
run.
- Phase 1: deploy to blue, restart, verify all bundles ACTIVE + all
  components satisfied.
- Phase 2: warm caches via synthetic traffic; verify servlet
  round-trip.
- Phase 3: LB cut traffic 5% → 50% → 100%; monitor error-log +
  latency.
- Phase 4: drain green after 24h.
- Rollback: LB cut back to green.

## Anti-patterns to avoid for Sling

- **Installing impl bundles before API bundles** — impl fails to
  resolve on missing package; component enters
  `UNSATISFIED_REFERENCE`.
- **Feature Model change without restart** where required — silently
  runs on stale provisioning; drift accumulates across the pool.
- **Skipping LB drain** — in-flight requests hit an instance mid-
  bundle-install and 5xx.
- **Deploying repoinit that isn't idempotent** — second-run failures
  cascade across the pool.
- **Ignoring `UNSATISFIED_REFERENCE`** in the console — the component
  is dead code until resolved; downstream calls fail cryptically.

---

Generate the full deploy plan using `templates/deploy-plan.md` as the
master, populating placeholders with stack-appropriate content from
the guide above.
