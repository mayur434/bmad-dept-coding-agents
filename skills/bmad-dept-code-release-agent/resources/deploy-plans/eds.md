# Deploy-plan authoring guide — Edge Delivery Services (EDS)

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a deploy plan for an Edge Delivery Services
project (git-based edge deploy, sheet-driven content, block library).
Combine with `templates/deploy-plan.md` as the master skeleton.

## Purpose framing

An EDS deploy plan is unusual: the "deploy" is a git merge to `main`,
and rollback is a `git revert`. What the plan really coordinates is
the preview → live promotion, the edge cache warm-up on high-traffic
pages, and the alignment of code changes with sheet-driven config
(helix-query, metadata, redirects) that lives outside git. It also
guards against CLS/LCP regressions that only show up under real edge
routing.

## Pre-deploy checklist for EDS

- **Git branch merge-target** confirmed (`main` for production,
  `preview` if promoted via `helix-bot`).
- **Preview URL** (`https://<branch>--<repo>--<owner>.hlx.page`)
  smoke-tested — visual + LCP + no console errors.
- **helix-query** sheet ranges validated; no breaking column
  rename that downstream blocks depend on.
- **`head.html`** diff reviewed — third-party script additions
  audited for TTI impact.
- **Sheet-driven config** (metadata, redirects, placeholders) in
  sync with code — new blocks have metadata entries; new URL patterns
  have redirects.
- **`paths.json`** additions covered by the correct index config.
- **Edge cache warm-up plan** — script or Lighthouse crawl over
  top-N URLs post-deploy to seed the edge.
- **Consent-mode / analytics** — third-party additions gated by
  consent state.

## Deploy phases for EDS — rollout-specific

EDS naturally deploys on `git push` to `main`. Phase against the
resolved `--rollout`:

- **`canary` (via helix-query cohort or branch preview).** Route a
  small cohort (staff, geo, sheet-driven flag) to the branch preview;
  promote to `main` after soak.
- **`blue-green` (via branch swap).** Deploy to a `next` branch,
  publish via `helix-admin` cache invalidation only on that branch,
  then merge to `main`.
- **`rolling`.** Not applicable at edge level — EDS deploy is atomic
  per merge; single phase with edge warm-up.
- **`feature-flag` (via sheet toggle).** Ship blocks with a
  metadata-driven feature flag; flip via sheet edit and
  `helix-admin`-triggered index refresh.
- **`bigbang`.** Merge to `main`, warm edge; used for content-only
  changes or code hotfix.

## Verification per EDS

- **LCP ≤ 2.5s p75** at edge on the affected page templates (measured
  via CrUX / synthetic Lighthouse).
- **CLS ≤ 0.1 p75**; no layout shift regression from new block CSS.
- **Block-load-success rate** — Real-User-Monitoring shows blocks
  loading on ≥ 99% of page views.
- **Sitemap regeneration** — new / removed pages reflected in
  `sitemap.xml` after helix-index refresh.
- **helix-index status** GREEN on the query-index sheets.
- **`head.html`** loads without console errors; third-party scripts
  respect consent state.
- **Redirect map** — sampled redirects return 301 to correct target.
- **404 rate** at edge stays within baseline.

## Rollback triggers for EDS

- **LCP > 4s p75** at edge sustained 15 min after warm-up.
- **JS error rate > 1%** in RUM on the affected pages.
- **Block-load-success rate < 95%** — new block regression breaks
  page.
- **Sitemap regeneration fails** — helix-index shows STOPPED or
  errored state.
- **404 rate spikes > 3× baseline** — redirect map or path
  regression.
- **CLS > 0.25 p75** — visible layout shift under real edge routing.
- **Consent-mode regression** — beacons fire on reject-all.
- **Manual call** from release manager or content lead.

## Communication plan for EDS

**Pre-deploy** (T-4h — EDS releases can move fast): announce in
`#eds-releases` — merge target, scope, warm-up plan, sheets touched.

**During deploy**: post merge time, helix-index status, edge warm-up
completion, RUM snapshot.

**Post-deploy** (T+30m): all-clear with LCP, CLS, block-load-success
snapshot. Content team notified sheets are safe to edit again.

## Stakeholder RACI for EDS

| Role | Responsibility |
|---|---|
| Release manager | Owns merge + go/no-go on warm-up. |
| Tech lead | Owns block + `head.html` change set; on bridge for RUM. |
| DevOps / SRE | Runs warm-up crawl; monitors edge metrics. |
| QA | Cross-browser smoke on preview URL + live post-merge. |
| Content lead | Verifies sheet-driven config, redirects, metadata. |
| Analytics | Verifies consent-mode + tag firing behavior. |
| On-call | Primary responder to LCP / block-load regressions. |

## 2 worked deploy-plan examples for EDS

**v2.5.0 — Loyalty landing block + new template, canary (branch
preview cohort), Prod.**
Pre-deploy: preview URL green; helix-query includes new template;
metadata sheet has new block entry.
- Phase 1: route staff cohort (IP allowlist) to preview branch; 24h
  soak; monitor RUM.
- Phase 2: merge to `main`; helix-index refresh; warm top-50 loyalty
  URLs.
- Phase 3: monitor LCP + block-load-success for 30 min.
- Rollback: `git revert` + push; helix-index re-refresh; edge purge.

**v2.5.1 — head.html third-party script addition (analytics), bigbang,
Prod.**
Pre-deploy: preview URL confirms consent-mode gating; TTI +180ms
p75 (acceptable per SLO).
- Phase 1: merge to `main`; warm edge on top-100 URLs; verify TTI +
  consent-mode.
- Rollback: revert commit; edge purge; helix-index refresh.

## Anti-patterns to avoid for EDS

- **Forcing an edge cache purge during peak** — thundering herd on
  origin (helix-admin) can rate-limit legitimate refreshes.
- **Skipping storefront-events / analytics version-alignment** — new
  tags fire against old consent-mode config; privacy regression.
- **Merging code + sheet edits at the same instant** — race between
  block deploy and metadata sheet index refresh; blocks load without
  the metadata they expect.
- **Ignoring block-load-success in RUM** — a block failing in one
  browser silently degrades a % of traffic.
- **Skipping preview URL smoke** — the branch preview is the only
  place a real regression surfaces before it hits `main`.

---

Generate the full deploy plan using `templates/deploy-plan.md` as the
master, populating placeholders with stack-appropriate content from
the guide above.
