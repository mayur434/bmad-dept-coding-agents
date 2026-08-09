# Rollback-plan authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a rollback plan for an AEM as a Cloud Service
(AEMaaCS) or AEM Managed Services (AMS) project. Combine with
`templates/rollback-plan.md` as the master skeleton.

## Purpose framing

An AEM rollback plan establishes the metric-based signals that force the
call, the decision authority who can invoke it during a Cloud Manager
promotion window, the exact revert path (which for AEMaaCS is Cloud
Manager's "revert to previous release" — not a hand-crafted rollback),
and the dispatcher + content-authoring communication that must fire the
moment the call is made. Triggers must be quantified so on-call reads a
number, not a hunch; decision authority must be pre-agreed so the bridge
doesn't spend 10 minutes deciding who owns the call; and the rollback
comms must reach editorial before they lose an in-flight authoring
session.

## Rollback triggers for AEM — specific + quantified

- **Cloud Manager quality gate FAIL post-deploy** — any new
  `customer.critical` → auto-revert candidate (Cloud Manager blocks
  promotion; the trigger for a *rolled-forward* prod is a re-run).
- **Dispatcher hit-ratio < 90%** sustained 15 min at the CDN /
  dispatcher tier — indicates cache-key regression flooding origin.
- **Publish-tier 5xx rate > 1%** sustained 10 min (measured at the
  dispatcher or Cloud Manager CDN log tier).
- **Author instance unresponsive** > 5 min (Sidekick stalling, login
  page > 5s p95, `/system/console` timeouts).
- **Replication failure rate > 5%** — Publish subscribers not receiving
  activation events; content freeze becomes mandatory.
- **DAM upload / asset processing failure rate > 5%** — indicates
  workflow or Sling Jobs regression.
- **Content Fragment GraphQL 5xx rate > 2%** sustained 10 min.
- **Synthetic customer journey RED** for 2 consecutive runs against the
  Publish tier through the CDN.

## Decision authority for AEM

- **Primary:** on-call SRE (accountable) — the person watching Cloud
  Manager and the dispatcher dashboard.
- **Approver for prod revert:** tech lead OR release manager — Cloud
  Manager "revert to previous release" is a promotion action and
  benefits from a second pair of eyes on a 4-figure customer surface.
- **Auto-rollback** — Cloud Manager quality-gate FAIL auto-cancels the
  current promotion; there is no auto-revert once prod is live. <!-- verify: current CM behavior -->
- **Escalation** — if primary on-call is unreachable within 5 min,
  backup SRE calls; if both unreachable, engineering manager approves.
- **Editorial lead** — non-blocking but always paged the moment the
  call is made, so authoring can freeze before content loss.

## Rollback steps for AEM — numbered + timed

1. **Cancel current Cloud Manager promotion** (if still in progress) —
   Cloud Manager UI → Cancel current step (< 30s).
2. **If already promoted to Prod** — Cloud Manager → Releases → previous
   release → **Revert** (5–15 min for the full staged revert to Publish
   + Author). <!-- verify: current CM revert SLA -->
3. **Verify dispatcher config auto-reverted** with the code revert; if
   the change was VHost-only (out-of-band change), restore the previous
   VHost snapshot manually via ops SSH + service reload (< 5 min).
4. **Flush dispatcher cache selectively** for the affected content
   paths — `curl -X POST -H "CQ-Action: Activate" -H "CQ-Handle: /content/<path>" ...`
   — avoid full-tree flush unless the regression is structural.
5. **Release the editorial content-freeze** once Author responsiveness is
   verified — post in `#aem-releases` and to editorial DLs.
6. **Notify content authors** — Sidekick availability, any in-flight CFs
   that were locked, and expected re-authoring path if content packages
   were rolled back.
7. **Verify Publish-tier + Author-tier health** — `/system/console/status-productinfo`,
   `/system/console/healthcheck`, replication queue drain, GraphQL 200s.

## Data reversibility flags for AEM

Which changes CANNOT be safely rolled back — must be flagged in the plan:

- **JCR content migrations** (script that mutated `/content` or
  `/conf`) — the reverse-migration is a manual re-author unless a JCR
  snapshot exists.
- **DAM asset deletions** — deleted assets are only recoverable from
  backup; Cloud Manager does not restore DAM state on revert.
- **Content Fragment schema removals** (removed models or removed
  fields) — content authored against the removed field is lost.
- **User-generated content** authored during the failed release window
  — on revert, UGC written to Author may be orphaned or lost.
- **Cloud Manager environment variable deletions** — deleted vars are
  not restored automatically.

**Guidance:** if any of the above is included in the release, escalate
to the change-advisory-board before ship; take a JCR/DAM backup via
package manager first; do NOT auto-revert — walk through a forward-fix
decision instead.

## Stakeholder comms during rollback for AEM

**Pre (moment of decision):** `#aem-releases` — `[ROLLBACK IN PROGRESS]
v{{version}} — trigger: {{trigger}} — ETA {{eta}} — Author freeze in effect`.

**During:** every 10 min for long-running reverts — Cloud Manager phase
progress, dispatcher hit-ratio recovery, replication queue status.

**Customer-facing:** only if Publish-tier 5xx was customer-observable
— use the status page template ("degraded content availability, working
to restore").

**Post (all-clear):** `[ROLLBACK COMPLETE] v{{previous_version}} live —
dispatcher hit-ratio {{value}} — Author available — freeze released`.

**On-call handoff:** written note in the incident channel — trigger
that fired, revert path taken, follow-up items (dispatcher warm-up
still in progress? replication catch-up pending?).

## Post-rollback for AEM

- **RCA within 24h**, blameless — timeline of the quality-gate signal,
  the promotion decision, the revert call, the recovery.
- **Content-integrity verification** — sample 20 pages authored in the
  failed release window, confirm they render on Publish; sample 5 CFs
  written during the window, confirm they read back through GraphQL.
- **DAM integrity** — confirm no asset renditions were regenerated
  under the new codebase and are now stale under the reverted codebase.
- **Feature-flag state** — audit OSGi config toggles set for the
  release; confirm they're in the intended pre-release state.
- **Replication queue** — confirm drain complete; no lingering items
  from the failed window.
- **Lessons-learned template** — see `templates/rollback-plan.md`
  §Lessons learned; fill during RCA.

## 2 worked rollback-plan examples for AEM

**v2.5.0 — Loyalty landing pages, dispatcher hit-ratio regression.**
Trigger: dispatcher hit-ratio dropped to 78% at T+8 min (threshold
90%/15min → 5 min early-fire on rapid drop). Decision: on-call SRE +
tech lead on bridge, revert called at T+12 min. Steps: Cloud Manager
revert to v2.4.7 (11 min to propagate to all Publish + Author),
dispatcher config auto-reverted, selective flush on `/content/loyalty`,
editorial freeze released at T+30 min. Recovery time: 24 min. Post:
RCA identified a widened cache-key on `/content/loyalty/*` that
invalidated all cached pages under the tree.

**v2.5.1 — CF schema field removal, no revert (forward-fix).** Trigger:
GraphQL 5xx rate 4% at T+15 min. Decision: on-call SRE flagged
irreversible schema — CAB paged, forward-fix approved instead of
revert. Steps: hotfix v2.5.2 authored (re-added the removed field as
deprecated), Cloud Manager promotion re-run, GraphQL error rate
recovered by T+95 min. Post: RCA scheduled — process gap flagged
(CF schema removals should have been caught by the
reversibility-review gate).

## Anti-patterns to avoid for AEM

- **Cancelling a Cloud Manager promotion mid-Publish deploy** — leaves
  Publish instances at mixed versions; use Revert instead.
- **Skipping the dispatcher flush after code revert** — cached
  responses under the failed-release version keep serving until TTL.
- **Rolling back a content package without editorial freeze** — active
  authors lose their in-flight session data.
- **Reverting without a JCR/DAM backup** when the release touched
  content-migration scripts — reversal is not automatic.
- **Rolling forward "just to fix it fast"** without weighing the
  reversibility of the forward fix — you may end up needing another
  rollback.

---

Generate the full rollback plan using `templates/rollback-plan.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
