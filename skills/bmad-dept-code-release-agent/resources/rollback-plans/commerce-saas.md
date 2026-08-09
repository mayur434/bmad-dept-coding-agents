# Rollback-plan authoring guide — Adobe Commerce SaaS

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a rollback plan for an Adobe Commerce SaaS
project (Catalog Service / Live Search / storefront drop-ins). Combine
with `templates/rollback-plan.md` as the master skeleton.

## Purpose framing

A Commerce SaaS rollback plan establishes the drop-in bundle load and
Catalog Service signals that force the call, the on-call authority who
owns the version-pin revert, the exact drop-in package re-pin path
(since SaaS custom code is client-side and edge-side, not server-side),
and the feature-flag flips that gate the released capability. The
backend SaaS platform is Adobe-managed — you cannot revert the
underlying Catalog Service or Live Search release; you revert *your*
integration surface (drop-ins, storefront-events schema, API Mesh
resolvers).

## Rollback triggers for Commerce SaaS — specific + quantified

- **Drop-in JS load error rate > 1%** at the CDN (RUM signal on
  `@dropins/storefront-*` load failures) sustained 10 min.
- **Catalog Service 5xx rate > 1%** for 10 min (Adobe I/O logs; if
  Adobe-side, escalate to Adobe support in parallel).
- **Storefront-events emit rate drops > 20%** vs baseline for 15 min
  (indicates event-schema break or drop-in wiring regression).
- **Live Search query error rate > 2%** for 10 min.
- **API Mesh resolver 5xx > 1%** for 10 min (if mesh is in the
  storefront path).
- **Add-to-cart success rate drops > 5%** for 15 min (checkout drop-in
  funnel).
- **Drop-in bundle version hash mismatch** across regions (indicates
  partial deploy — some CDN POPs serving new bundle, some old).
- **Manual call** from release manager or on-call.

## Decision authority for Commerce SaaS

- **Primary:** on-call SRE watching CDN + Adobe I/O dashboards.
- **Approver for revert:** frontend tech lead (owns drop-in wiring) OR
  release manager.
- **Auto-rollback** — feature-flag flip (if the release is gated behind
  a flag) can be automated on error-rate breach via LaunchDarkly /
  Split; drop-in version pin revert is manual.
- **Escalation** — if the trigger is Catalog Service 5xx and the code
  hasn't changed on your side, escalate to Adobe support (P1) in
  parallel; you cannot revert Adobe-managed infrastructure.
- **Backup on-call** paged after 5 min if primary unreachable.

## Rollback steps for Commerce SaaS — numbered + timed

1. **Flip the release feature flag OFF** (if release is flag-gated) —
   propagates in seconds; often resolves without a bundle revert
   (< 30s).
2. **Re-pin drop-in bundle version** in storefront config to the
   previous version — commit + push; edge propagates on next CDN cache
   miss (1–5 min).
3. **Force CDN purge** for the bundle URL to accelerate propagation
   (< 1 min).
4. **Revert API Mesh mesh config** (if the release touched Mesh) — `aio
   api-mesh update mesh.json` at the previous config revision (3–5 min
   for mesh reconciliation).
5. **Revert storefront-events schema** (if a schema version bump was
   included) — pin the previous `@adobe/magento-storefront-events-sdk`
   version.
6. **Verify drop-in reload** — hard-refresh the storefront in a private
   window; confirm the previous bundle version loads and add-to-cart
   flow works.
7. **Notify** `#commerce-saas` + support DL — customer-visible impact
   assessment.

## Data reversibility flags for Commerce SaaS

Which changes CANNOT be safely rolled back — must be flagged in the plan:

- **Catalog Service field removals** (backend schema was updated by
  Adobe on your behalf) — if you removed a field from your catalog
  export, previous drop-in versions may query the removed field and
  break; forward-fix required.
- **Storefront-events schema-version bump** with subscribers already
  processing new-schema events — reverting the emitter leaves
  subscribers expecting the new shape.
- **Consent-mode revocations** logged during the failed release window
  — cannot be undone; regulatory record.
- **Deleted API Mesh resolvers** — deleted resolvers must be re-added
  from source; not auto-recovered on revert.
- **IMS client credential rotations** — previous credentials are void
  once new ones are issued.

**Guidance:** any change to Catalog Service field shape, Adobe-side
event schema, or IMS credential should go through the SaaS
change-review with Adobe partners before ship; do NOT auto-revert;
forward-fix path is typically safer.

## Stakeholder comms during rollback for Commerce SaaS

**Pre (moment of decision):** `#commerce-saas` — `[ROLLBACK IN PROGRESS]
drop-in v{{version}} → v{{previous}} — trigger: {{trigger}} — ETA <5min`.

**During:** CDN purge status, bundle version verification per region.

**Customer-facing:** typically not needed if the flag flip or version
pin catches early (customer sessions get the reverted bundle on next
page load); page the status page owner only if bundle load errors
were customer-observable.

**Adobe support:** open a P1 ticket in parallel if the trigger points
at Adobe-managed infrastructure (Catalog Service 5xx with no code
change on your side).

**Post (all-clear):** `[ROLLBACK COMPLETE] drop-in v{{previous_version}}
live — CDN purged — add-to-cart verified`.

## Post-rollback for Commerce SaaS

- **RCA within 24h**, blameless — if the trigger was Adobe-managed
  infrastructure, request Adobe's RCA in parallel.
- **Event-integrity verification** — confirm storefront-events emit
  volume is back to baseline; audit consumer subscription health (any
  subscribers stuck on the new-schema shape?).
- **Feature-flag state** — confirm the release flag is OFF in all
  environments; any partial flip cohorts are cleaned up.
- **CDN cache audit** — sample the bundle URL from 5 geo POPs; confirm
  all serve the reverted hash.
- **API Mesh state** — confirm the mesh version pinned matches the
  reverted drop-ins.
- **Lessons-learned template** — see `templates/rollback-plan.md`
  §Lessons learned; fill during RCA.

## 2 worked rollback-plan examples for Commerce SaaS

**v3.2.0 — Cart drop-in refactor, add-to-cart failure spike.** Trigger:
add-to-cart success rate dropped from 91% to 79% at T+12 min (threshold
5%/15min → early fire). Decision: on-call SRE + frontend tech lead on
bridge, revert called at T+18 min. Steps: feature flag OFF at T+18
(add-to-cart recovered to 88% within 90s — flag was gating a partial
cohort), full drop-in pin revert at T+22 to previous `@dropins/storefront-cart@2.4.7`,
CDN purge at T+23, add-to-cart back to 91% at T+27. Recovery: 15 min.
Post: RCA identified an event listener registration order bug — new
drop-in registered before the cart context provider mounted on slow
connections.

**v3.3.0 — Catalog Service query pattern change, 5xx spike from
Adobe.** Trigger: Catalog Service 5xx 3.1% at T+8 min (threshold
1%/10min → early fire). Decision: on-call SRE flagged Adobe-managed
infrastructure — escalated to Adobe P1 in parallel with drop-in pin
revert. Steps: drop-in re-pinned to previous version at T+11 (Catalog
Service errors persisted — confirming Adobe-side issue), Adobe fix
deployed at T+52 min, drop-in re-pinned forward at T+65 with Adobe's
support ACK. Post: Adobe RCA received at T+72h; process gap flagged
— add "coordinate with Adobe partner engineer for major query pattern
shifts" to the release checklist.

## Anti-patterns to avoid for Commerce SaaS

- **Reverting drop-in bundle without CDN purge** — old bundle keeps
  serving from cache; users see stale broken version.
- **Reverting emitter without checking subscriber compatibility** —
  subscribers processing new-schema events break on reverted emitter.
- **Assuming a Catalog Service issue is your bug** without checking
  Adobe I/O logs first — you may spend the rollback window on the
  wrong revert.
- **Skipping the feature-flag flip before the version pin** — flag
  flip is faster and often sufficient; try it first.
- **Not documenting the drop-in version matrix** — on the next
  release, you don't know what the "previous good" version was.

---

Generate the full rollback plan using `templates/rollback-plan.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
