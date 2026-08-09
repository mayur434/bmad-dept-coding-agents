# Rollback-plan authoring guide — Edge Delivery Services (EDS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a rollback plan for an Edge Delivery Services
(EDS) project. Combine with `templates/rollback-plan.md` as the master
skeleton.

## Purpose framing

An EDS rollback plan establishes the edge Core Web Vitals + JS error
signals that force the call, the on-call authority who owns the `git
revert` (which for EDS is the entire revert path — merge to `main`
triggers edge deploy, revert-commit + push triggers instant re-deploy),
and the editorial + Sidekick-user comms that must fire before authors
lose an in-flight page-preview session. EDS's superpower is
git-revert-as-rollback — the plan should exploit that speed rather
than over-engineering it, while flagging the few sheet-driven changes
and edge-cached content that don't come back on `git revert` alone.

## Rollback triggers for EDS — specific + quantified

- **LCP p75 > 4s** at the edge for 15 min (CrUX / Speedcurve /
  Speedlify signal on top-100 pages).
- **CLS p75 > 0.15** for 15 min.
- **JS error rate > 1%** at the edge (RUM signal) for 10 min.
- **Block-load success rate < 95%** for 10 min (custom RUM signal on
  block init).
- **Sitemap regeneration FAILS** post-deploy — Sidekick "Publish"
  action returns error.
- **helix-query.yaml validation FAILS** — new query definition rejected
  by the edge builder.
- **Redirects sheet load error** — `redirects.xlsx` malformed after
  the release; 404s spike.
- **404 rate > 2%** for 10 min at the edge (indicates path or
  redirect regression).

## Decision authority for EDS

- **Primary:** on-call SRE / frontend lead watching Speedcurve + RUM
  dashboards.
- **Approver for revert:** frontend tech lead OR EDS release manager.
- **Auto-rollback** — not native; some teams wire a Speedcurve
  budget-breach webhook that opens a revert PR automatically (still
  human-merged).
- **Escalation** — backup on-call paged after 5 min if primary
  unreachable.
- **Editorial lead** — always paged the moment the call is made,
  because Sidekick + preview URLs are affected during the revert
  propagation.

## Rollback steps for EDS — numbered + timed

1. **Identify the offending commit(s)** — `git log --oneline main`;
   often a single commit in the release window.
2. **`git revert <sha> [<sha>...]`** — produces a NEW commit that
   inverts the failed change (audit-friendly; never `git push --force`).
3. **`git push origin main`** — merge to `main` triggers edge deploy;
   propagation typically < 60s to all edge POPs.
4. **Verify edge propagation** — hard-refresh a representative page in
   a private window from 3 geo regions; confirm reverted code.
5. **Revert sheet-driven config** (if the release touched
   `helix-query.yaml`, `paths.json`, `redirects.xlsx`, `head.html`, or
   Google Docs / SharePoint config sheets) — restore previous
   revision in the Doc/Sheet + Sidekick "Publish" to propagate (1–5
   min per sheet).
6. **Sidekick "Publish"** on any content pages authored during the
   window that need to fall back to the previous rendition.
7. **CDN purge** for any pages served the failed rendition — many
   teams don't purge and let TTL expire; force-purge if the
   regression is customer-visible.
8. **Notify** `#eds-releases` + editorial DL.
9. **Verify** CWV + JS error rate for 10 min post-revert.

## Data reversibility flags for EDS

Which changes CANNOT be safely rolled back — must be flagged in the plan:

- **Sheet-based config removal** — deleted rows in
  `helix-query.yaml`, `redirects.xlsx`, or metadata sheets — the
  Google Docs / SharePoint revision history is the source of truth;
  git revert does not restore sheet state.
- **Deleted Google Docs / SharePoint content pages** — deleted pages
  during the release window are only recoverable from Doc/Site
  version history, not git.
- **Edge-cached content already served** — pages served during the
  failed window remain in browser caches until natural TTL; revert
  does not force-purge browser caches.
- **Third-party integration state** — analytics tag changes, martech
  pixel events fired during the window persist in downstream systems.
- **Sidekick plugin config** — plugin config lives in the Google
  Docs / SharePoint config sheet; a plugin config change is
  sheet-scoped, not git-scoped.

**Guidance:** any sheet-driven config change or content deletion →
document the sheet revision history explicitly in the release plan;
do NOT rely on git revert alone — restore sheet state manually.

## Stakeholder comms during rollback for EDS

**Pre (moment of decision):** `#eds-releases` — `[ROLLBACK IN
PROGRESS] {{commit_sha}} revert — trigger: {{trigger}} — ETA <2min`.

**During:** edge propagation status; representative page verification
from geo regions.

**Editorial:** Sidekick may show intermittent errors during the
propagation window; ask authors to pause new publishes for 5 min.

**Customer-facing:** typically not needed — revert is fast enough that
customer-visible impact is measured in seconds. Update the status page
only if the failed release was live > 15 min with a customer-visible
regression.

**Post (all-clear):** `[ROLLBACK COMPLETE] {{previous_sha}} live —
CWV back to baseline — JS error rate {{value}}%`.

## Post-rollback for EDS

- **RCA within 24h**, blameless.
- **CWV verification** — sample 20 pages across templates; confirm
  LCP / CLS / INP back to pre-release baseline.
- **Sheet integrity** — confirm all sheet-driven config sheets are
  at the intended pre-release revision; audit change history for any
  edits during the window that need reverting.
- **Sidekick health** — confirm authors can Preview + Publish; test
  a representative content page end-to-end.
- **Sitemap + redirects** — confirm regeneration is complete and
  redirect chains resolve correctly.
- **Third-party integration audit** — analytics events, martech
  pixels; note any events fired during the failed window in the RCA.
- **Lessons-learned template** — see `templates/rollback-plan.md`
  §Lessons learned; fill during RCA.

## 2 worked rollback-plan examples for EDS

**v2024.11 — Hero block refactor, LCP regression.** Trigger: LCP p75
climbed from 1.8s to 4.4s at T+18 min post-merge (threshold
4s/15min). Decision: on-call frontend lead + release manager on
bridge, revert called at T+22 min. Steps: `git revert <sha>` at
T+23, `git push origin main` at T+23, edge propagation complete at
T+24, LCP p75 back to 1.9s at T+38 (15 min recovery window for CrUX
signal). Recovery: 16 min. Post: RCA identified a hero image
`loading="lazy"` regression — the refactor removed the `fetchpriority="high"`
attribute; regression added to the LCP test suite.

**v2024.12 — `helix-query.yaml` schema update, sheet-driven revert.**
Trigger: sitemap regeneration failed post-deploy; 404 rate spiked on
newly-published article URLs. Decision: on-call SRE + editorial lead
on bridge, revert called at T+8 min. Steps: `git revert <sha>` at T+9
(reverted the yaml file in git), Google Docs revision history restore
of the sheet at T+11 (the release also edited the config sheet
directly), Sidekick "Publish" of the reverted sitemap query at T+13,
sitemap regeneration succeeded at T+15, 404 rate back to baseline at
T+18. Recovery: 10 min. Post: process gap flagged — sheet edits and
git changes should be atomic in a single release; sheet-driven
config change checklist added.

## Anti-patterns to avoid for EDS

- **`git push --force` to unwind the failed commit** — breaks git
  history, non-audit-friendly, breaks other in-flight PRs; always use
  `git revert` which creates a new commit.
- **Reverting git without checking sheet-driven config** —
  sheet-based changes don't come back on git revert; content stays
  broken.
- **Not force-purging CDN when the regression is customer-visible** —
  browsers keep serving stale bundle from cache until natural TTL.
- **Rolling back during editorial peak hours without paging editorial
  lead** — authors lose Sidekick sessions and think preview broke.
- **Assuming edge propagation is instant** — typically < 60s but
  larger fleets can take 2–3 min; verify from 3 geo regions before
  declaring recovery.

---

Generate the full rollback plan using `templates/rollback-plan.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
