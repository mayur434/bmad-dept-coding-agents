# Deploy-plan authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a deploy plan for an AEM as a Cloud Service
(AEMaaCS) or AEM Managed Services (AMS) project. Combine with
`templates/deploy-plan.md` as the master skeleton.

## Purpose framing

An AEM deploy plan establishes the Cloud Manager staged promotion path
(Dev → Stage → Prod), the content-package deploy order, the dispatcher
warm-up window, and the quality-gate posture that must hold at each
gate. It is written for the Cloud Manager release manager on the bridge
and the on-call who has to decide whether to promote or roll back —
verifications must be observable inside Cloud Manager + the dispatcher
tier, and rollback triggers must be metric-based so the call can be
made in seconds.

## Pre-deploy checklist for AEM

- Cloud Manager **quality-gate report** PASS on the source build
  (`customer.critical = 0`, `customer.important` within threshold,
  security composite ≥ target). <!-- verify: current defaults -->
- **Dispatcher config diff** reviewed by ops — no widened cache-key or
  farm-filter change without a communication step.
- **Package deploy order** confirmed: `ui.config` → `ui.apps` →
  `ui.content` (Cloud Manager enforces automatically; AMS is manual).
- **Author-instance content freeze** window scheduled with editorial
  (spans the deploy window + dispatcher warm-up).
- **RDE preview** run on OSGi-service or Sling-model changes before Stage
  promotion.
- **Replication queues** drained on Author; no stuck items.
- **Cloud Manager custom event handler** changes — if any, note
  pipeline re-run requirement in the plan.
- **CDN / Fastly** cache-key or purge tokens rotated if the release
  touches `head.html` or edge rules.

## Deploy phases for AEM — rollout-specific

AEM does not natively support percentage-based canary — Cloud Manager
provides the equivalent via staged promotion. Phase the plan against
the resolved `--rollout`:

- **`canary` (effective = staged promotion).** Phase 1 Dev promotion +
  smoke, Phase 2 Stage promotion + quality-gate + UAT, Phase 3 Prod
  Publish (one region if multi-region), Phase 4 Prod full + dispatcher
  warm-up. Go/no-go at each Cloud Manager gate.
- **`blue-green`.** Rare for AEM. Runs against a parallel AEMaaCS
  program or a duplicate AMS stack; DNS/CDN cutover completes the swap.
  Phases: warm-blue, smoke on blue, CDN traffic-cut, drain-green.
- **`rolling`.** Content-only or dispatcher-only changes; Cloud Manager
  publishes to Publish tier instances sequentially. Single phase with
  per-instance verification.
- **`feature-flag`.** Ship code dark behind an OSGi config toggle or
  editable-template policy; flip via Cloud Manager config-only pipeline.
  Phase 1 code deploy, Phase 2 flip in Stage, Phase 3 flip in Prod.
- **`bigbang`.** Reserved for dispatcher-hotfix or content-package
  hotfix; single phase with condensed verification.

## Verification per AEM

- **Cloud Manager execution** status GREEN across build, code-quality,
  security, performance-test, deploy stages.
- **Dispatcher hit-ratio ≥ 95%** at 15 min post-deploy (from CDN /
  dispatcher metrics dashboard).
- **Publish-tier 5xx rate < 0.5%** sustained 15 min.
- **Author-instance responsiveness** — `/libs/granite/core/content/login.html`
  round-trip < 2s p95; Sidekick loads without stalling.
- **`/system/console/status-productinfo`** returns expected bundle
  versions on Publish; no `INSTALLED` bundles that should be `ACTIVE`.
- **Replication queues** empty; no `403`/`404` from Publish subscribers.
- **Content Fragment GraphQL** endpoints return 200 on a representative
  query set.
- **Synthetic customer journey** (home → PDP → cart) green on the
  Publish tier via the CDN.

## Rollback triggers for AEM

- Cloud Manager **quality gate fails** post-deploy (any new
  `customer.critical`).
- **Dispatcher hit-ratio drops below 90%** and sustains 5 min (indicates
  cache-key regression flooding origin).
- **Publish 5xx rate > 1%** sustained 5 min.
- **Author instance CPU > 90%** or unresponsive sidekick > 3 min.
- **Replication failure rate > 5%** — Publish subscribers not receiving.
- **Synthetic customer journey red** for > 2 consecutive runs.
- **Content Fragment GraphQL error rate > 2%** — indicates schema or
  cache regression.
- **Manual call** from release manager or on-call (any reason).

## Communication plan for AEM

**Pre-deploy** (T-24h): announce in `#aem-releases` — release version,
Cloud Manager execution ID, package deploy order, dispatcher warm-up
window, editorial content-freeze window.

**During deploy**: post at each Cloud Manager stage transition
(build-done, Stage-deployed, quality-gate-passed, Prod-Publish-deployed,
Prod-Publish-Author-deployed). Editorial notified when Author is
available again.

**Post-deploy** (T+2h): all-clear message with dispatcher hit-ratio,
Publish 5xx snapshot, top-5 pages LCP delta. Announcement distributed.

## Stakeholder RACI for AEM

| Role | Responsibility |
|---|---|
| Release manager | Cloud Manager execution owner; go/no-go at each stage. |
| Tech lead | Package + OSGi change owner; on bridge for bundle activation. |
| DevOps / SRE | Dispatcher + CDN config owner; monitors deploy signals. |
| QA | Author-instance smoke + Publish-tier UAT sign-off. |
| Security | Reviews any dispatcher-rule widening + secret rotation. |
| Editorial lead | Signs off on content-freeze window + Sidekick block availability. |
| On-call | Primary responder to Publish 5xx or dispatcher regressions. |

## 2 worked deploy-plan examples for AEM

**v2.5.0 — Loyalty landing pages, canary (staged promotion), Prod.**
Pre-deploy: Cloud Manager execution 1234567 GREEN; dispatcher config
diff reviewed (1 new farm filter, cache-friendly); editorial freeze
16:00–19:00.
- Phase 1 (T+0): Dev promotion, RDE smoke, GraphQL query set green.
- Phase 2 (T+30m): Stage promotion, quality-gate PASS, UAT sign-off.
- Phase 3 (T+90m): Prod Publish deploy (region-1), dispatcher warm-up,
  hit-ratio ≥ 95%.
- Phase 4 (T+120m): Prod Publish + Author full, dispatcher flush
  `/content/loyalty`, announcement.
- Rollback triggers: dispatcher hit-ratio < 90%; Publish 5xx > 1%.

**v2.5.1 — Dispatcher hotfix, bigbang, Prod.**
Pre-deploy: Cloud Manager config-only pipeline; VCL diff reviewed.
- Phase 1: config-only deploy to all Publish instances, dispatcher
  reload, invalidate `/content` + `/etc`, verify cache rule change on
  representative URLs.
- Rollback trigger: 5xx > 1% within 3 min → revert VCL snippet.

## Anti-patterns to avoid for AEM

- **Deploying `ui.content` before `ui.apps`.** Content references types
  that don't yet exist; authoring breaks silently.
- **Skipping the dispatcher warm-up window.** First 10 min of origin
  hits can overwhelm Publish if you announce availability too early.
- **Deploying content-package changes during editorial business hours**
  without a freeze — mid-authoring session data loss.
- **Cloud Manager execution ID missing** from the plan — the bridge
  cannot correlate quality-gate reports to the release.
- **Widening dispatcher cache-key without a full purge.** Old cached
  entries under the new key never expire until natural TTL.

---

Generate the full deploy plan using `templates/deploy-plan.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
