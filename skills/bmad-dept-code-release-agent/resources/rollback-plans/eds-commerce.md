# Rollback-plan authoring guide — EDS + Commerce hybrid

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a rollback plan for an EDS + Commerce hybrid
project (Edge Delivery Services storefront + Adobe Commerce SaaS
drop-ins + Catalog Service / Live Search). Combine with
`templates/rollback-plan.md` as the master skeleton.

## Purpose framing

An EDS+Commerce rollback plan establishes the CWV + drop-in load +
Catalog Service signals that force the call, the on-call authority
who owns BOTH the EDS `git revert` AND the drop-in version pin revert
(both surfaces move in coordinated release windows), and the
merchandising + Adobe support comms that must fire when the failing
surface is ambiguous (edge code? drop-in bundle? Catalog Service?).
Rollback ordering matters — flip feature flags first (fastest),
re-pin drop-ins second, git revert third — because the flag flip is
the widest net for the smallest cost.

## Rollback triggers for EDS+Commerce — specific + quantified

- **Drop-in bundle 4xx/5xx load rate > 1%** for 10 min (RUM signal on
  `@dropins/storefront-*` load failures).
- **Cart persistence errors > 2%** for 10 min (cart drop-in localStorage
  or Commerce SaaS cart-service failures).
- **Add-to-cart success rate drops > 5%** for 15 min.
- **Consent-mode toggle failure** — cookie/consent banner change
  breaking downstream analytics or drop-in initialization.
- **LCP p75 > 4s** at the edge for 15 min (PDP or category-page
  template regression).
- **PDP price/inventory drop-in returns error > 2%** for 10 min
  (Catalog Service or Live Search regression).
- **Storefront-events emit rate drops > 20%** vs baseline for 15 min.
- **Checkout drop-in payment error rate > 2%** for 10 min.

## Decision authority for EDS+Commerce

- **Primary:** on-call SRE watching both edge RUM + Adobe I/O logs.
- **Approver for revert:** frontend tech lead + Commerce tech lead
  (dual-approval because two surfaces are in play).
- **Auto-rollback** — feature-flag flip can be auto-triggered on
  breach; version pin revert and git revert are manual.
- **Escalation** — if the trigger is ambiguous (both edge and drop-in
  changed in the release), escalate to both frontend lead + Commerce
  lead; if Catalog Service 5xx and no code change on your side,
  escalate to Adobe support P1.
- **Merchandising lead** — paged the moment the call is made because
  checkout funnel loss becomes an active commercial concern.

## Rollback steps for EDS+Commerce — numbered + timed

1. **Flip release feature flag OFF** first (if release is flag-gated)
   — propagates in seconds; the widest, cheapest revert (< 30s).
2. **Re-pin drop-in bundle version** in storefront config (repo
   `package.json` or edge config sheet) to previous version + commit
   + push (2–5 min).
3. **`git revert`** the EDS commit(s) from the failed release
   window; `git push origin main` triggers edge deploy (< 60s
   propagation).
4. **CDN purge** for bundle URLs + affected PDP / category page paths.
5. **Revert API Mesh mesh config** (if the release touched Mesh) —
   `aio api-mesh update <mesh.json>` at the previous revision (3–5
   min).
6. **Revert storefront-events schema** (if a schema version bump was
   included) — pin previous events SDK version.
7. **Verify PDP + category + cart + checkout** end-to-end from a
   private window; confirm price/inventory drop-in shows correct
   values; confirm add-to-cart + checkout drop-in.
8. **Verify CWV** — LCP p75 on top-10 PDP + category templates back
   to baseline.
9. **Notify** `#eds-commerce-releases` + merchandising DL + support.

## Data reversibility flags for EDS+Commerce

Which changes CANNOT be safely rolled back — must be flagged in the plan:

- **Consent-mode revocation events** logged during failed release
  window — regulatory record; cannot be undone.
- **Catalog Service field removals** — if the release removed a field
  from your catalog export, previous drop-in versions may query the
  removed field.
- **Storefront-events schema bumps** with subscribers already
  processing — subscribers expect the new shape; reverting emitter
  leaves them stuck.
- **Sheet-driven storefront config** (category-page metadata,
  redirects) — Google Docs / SharePoint revision history is the
  source of truth; git revert does not restore sheet state.
- **Deleted product URLs** — 301 redirects added during the failed
  release may need manual reversal.
- **IMS OAuth credential rotations** for Commerce — previous
  credentials void once rotated.
- **Cart persistence key-schema changes** — cart drop-in reading
  localStorage under new key patterns can't fall back to old keys.

**Guidance:** any Catalog Service field, storefront-events schema,
consent-mode, or cart-schema change → CAB-lite + explicit revert path
documented pre-ship; do NOT auto-revert; forward-fix typically safer.

## Stakeholder comms during rollback for EDS+Commerce

**Pre (moment of decision):** `#eds-commerce-releases` +
`#commerce-ops` — `[ROLLBACK IN PROGRESS] EDS + drop-in v{{version}}
→ v{{previous}} — trigger: {{trigger}} — ETA {{eta}}`.

**During:** edge propagation status, drop-in version verification per
region, cart/checkout flow verification.

**Merchandising:** paged so they can own the funnel-loss conversation
and decide on any customer-goodwill actions (discount codes, order
retry outreach).

**Adobe support:** open P1 in parallel if trigger points at Adobe-side
infrastructure (Catalog Service 5xx with no code change on your side).

**Customer-facing:** status page update if checkout was impacted for
> 5 min; support team scripts updated.

**Post (all-clear):** `[ROLLBACK COMPLETE] EDS {{previous_sha}} +
drop-in v{{previous_version}} live — add-to-cart {{value}}% —
checkout verified`.

## Post-rollback for EDS+Commerce

- **RCA within 24h**, blameless — if Adobe-managed infrastructure was
  involved, request Adobe's RCA in parallel.
- **Order-integrity verification** — reconcile orders placed during
  the failed window against Commerce SaaS backend; identify any
  orders with malformed cart schema.
- **Cart persistence audit** — sample carts abandoned during the
  window; verify they resume correctly under the reverted drop-in
  cart schema.
- **Storefront-events integrity** — confirm event emit volume is
  back to baseline; audit subscriber consumption health.
- **Consent-mode audit** — any consent-mode-related events during the
  window are catalogued for the regulatory record.
- **CWV baseline** — LCP / CLS / INP on top-10 PDP + category
  templates confirmed at pre-release baseline.
- **Sheet integrity** — confirm sheet-driven config sheets are at
  intended pre-release revision.
- **Lessons-learned template** — see `templates/rollback-plan.md`
  §Lessons learned; fill during RCA.

## 2 worked rollback-plan examples for EDS+Commerce

**v2024.10 — PDP redesign + cart drop-in bump, cart persistence
failure.** Trigger: cart persistence errors 3.4% at T+9 min post-merge
(threshold 2%/10min → early fire). Decision: on-call SRE + both
frontend and Commerce tech leads on bridge, revert called at T+12
min. Steps: feature flag OFF at T+12 (cart error rate dropped to
0.4% within 90s — the flag was gating a partial cohort), full
drop-in pin revert at T+16 to previous
`@dropins/storefront-cart@2.4.7`, `git revert` of PDP changes at
T+18, `git push` at T+18, edge propagation complete at T+19.
Recovery: 10 min. Post: RCA identified an incompatible localStorage
key-schema change between old and new cart drop-in versions.

**v2024.11 — Catalog Service field query change, Catalog Service
5xx.** Trigger: PDP price drop-in returned 5xx at 4.1% for 8 min
(threshold 2%/10min → early fire). Decision: on-call SRE flagged
Catalog Service response — escalated to Adobe P1 in parallel while
attempting revert. Steps: drop-in pin revert at T+11 (5xx persisted
— confirming Adobe-side), Adobe support engaged, Adobe fix deployed
at T+58 min, drop-in re-pinned forward at T+72 with Adobe ACK.
Recovery: 68 min (blocked on Adobe). Post: Adobe RCA received at
T+96h; process gap flagged — "align with Adobe partner engineer for
Catalog Service query pattern shifts" added to release checklist.

## Anti-patterns to avoid for EDS+Commerce

- **Reverting drop-in without a matching EDS revert** — mismatched
  drop-in and storefront code versions leave PDP / cart broken.
- **`git push --force`** on the EDS revert — breaks audit history
  and other in-flight PRs; always `git revert`.
- **Skipping the feature-flag flip** as the first revert step — flag
  flip is faster and often sufficient.
- **Skipping CDN purge** on drop-in bundle URLs — browsers keep
  serving stale bundle from cache.
- **Reverting without merchandising notification** — they own the
  funnel-loss conversation and lose credibility if they hear about
  it from customers first.
- **Assuming a Catalog Service 5xx is your bug** without checking
  Adobe I/O logs first — you may burn revert window on the wrong
  surface.

---

Generate the full rollback plan using `templates/rollback-plan.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
