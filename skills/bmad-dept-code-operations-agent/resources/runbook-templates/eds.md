# Runbook authoring guide — Edge Delivery Services (EDS)

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a runbook for an Edge Delivery Services
(EDS / helix / Franklin) project. Combine with `templates/runbook.md`
as the master skeleton.

## Purpose framing

An EDS runbook is written for an edge/content-ops on-call. The
vocabulary is **helix-preview vs helix-live**, **block components**,
**sheet-driven content (Google Docs / SharePoint)**, **CDN cache
hit-ratio**, **LCP / RUM metrics**, **sitemap generation**,
**redirects.xlsx sync**. Runbooks focus on: LCP p75 regression,
block-load success rate, sitemap generation health, sheet-source
availability, edge cache health. **Instant `git revert` + push** is
the safety-net mitigation.

## Common incident symptoms for EDS

- LCP p75 > 2.5 s regression (block-load, image, CLS)
- Block-load success rate < 99% (JS exception in a block)
- Sitemap generation failing (helix-query yaml error, source sheet down)
- Edge cache hit-ratio < 80% (helix-live purge storm, cache-key regression)
- Preview branch published to live by accident (branch protection missed)
- Google Docs / SharePoint auth token stale (sheet-source 401)
- Redirects.xlsx out-of-sync (helix-admin sync lag)
- RUM beacon drop-off > 30% (adblock, CSP regression, script order)
- Head.html regression breaking global scripts (all pages LCP + block failures)
- helix-admin API 5xx (Adobe helix control-plane incident)

## Quick-diagnosis commands (per common symptom)

- **LCP p75:** helix RUM dashboard → LCP by URL; sample via
  `curl -sf https://main--<repo>--<owner>.hlx.live/<path>`; inspect
  Chrome DevTools → Performance tab; check `head.html` for new render-blocking scripts.
- **Block-load failure:** browser console on affected pages; check block
  JS via `blocks/{block}/{block}.js`; recent git diff on block folder.
- **Sitemap failing:** `curl -sf https://<host>/sitemap.xml`; check
  `helix-query.yaml` syntax (`aio helix query check` <!-- verify -->);
  source-sheet last-modified.
- **Edge cache hit-ratio:** helix-admin CDN panel; sample
  `curl -I https://<host>/<path>` and check `x-cdn-cache` header.
- **Sheet auth:** `curl -sf https://<host>/config.json`;
  check helix-admin → source-doc auth status.
- **Redirects out-of-sync:** `curl -I https://<host>/<old-path>`;
  check `redirects.xlsx` last-preview vs last-publish time in helix-admin.
- **RUM drop-off:** helix RUM sample rate; check `head.html` for missing
  RUM script; CSP header via `curl -I`.
- **helix-admin 5xx:** helix status page; `aio helix admin <cmd>` should
  return errors that mirror UI. <!-- verify: current aio helix CLI -->

## Likely causes (per common symptom)

- **LCP p75:** new render-blocking script in `head.html`; large hero image
  without responsive srcset; large CLS from a new block; third-party
  script order change.
- **Block-load failure:** JS exception in a newly-added block; missing
  dependency (import path typo); async / defer regression.
- **Sitemap failing:** helix-query.yaml YAML error; source sheet renamed
  or moved; permissions revoked on sheet.
- **Edge cache hit-ratio:** publish-storm (bulk publish flushed cache);
  new query-string variability (URL fragments now hit origin);
  cache-key regression in helix rewrite rules.
- **Preview-to-live accident:** branch protection off; someone pushed to
  the live branch directly.
- **Sheet auth:** OAuth token expired; source-doc moved to a different
  folder without re-auth; sharing permission revoked.
- **Redirects out-of-sync:** helix-admin sync lag; someone edited
  redirects.xlsx without triggering preview.
- **RUM drop-off:** adblock disabling beacon; CSP header change blocking
  RUM script; script order regression in head.html.

## Mitigation steps (per common symptom)

- **LCP p75:** `git revert` last commit → push → helix auto-deploys
  edge-side. If asset-related, republish with `srcset` + `loading=lazy`.
- **Block-load failure:** `git revert` block change → push. If a single
  block owns the failure, isolate via feature flag if implemented.
- **Sitemap failing:** fix helix-query.yaml syntax → push;
  re-preview + re-publish; verify sitemap.xml 200.
- **Edge cache hit-ratio:** cancel bulk publish if in progress; issue
  targeted invalidation only for changed paths; wait for TTL recovery.
- **Preview-to-live accident:** `git revert` on the live branch → push;
  re-verify via helix-admin; enforce branch protection post-incident.
- **Sheet auth:** re-authenticate source in helix-admin; if perms revoked,
  restore sharing; re-preview affected pages.
- **Redirects out-of-sync:** open `redirects.xlsx` → save → preview →
  publish (forces helix to re-ingest).
- **RUM drop-off:** revert `head.html` change; if CSP-related, add script
  to allowlist; verify via helix RUM sample.

## Rollback triggers for EDS

Cross-reference `rollback-plans/eds.md` from the Release agent:

- LCP p75 > 3s for 15 min (edge-wide).
- Block-load success rate < 95% for 10 min.
- Sitemap 5xx sustained 15 min.
- Edge cache hit-ratio < 70% for 30 min.
- RUM beacon drop-off > 50%.
- Preview-branch content on live (any duration).
- Manual call from content-ops or edge-ops.

## Escalation matrix for EDS

- **L1** — content-ops on-call, edge-ops SRE.
- **L2** — EDS tech lead, head-html owner, block platform owner.
- **L3** — Engineering manager, PR/comms lead for customer-visible content regressions.
- **Vendor** — Adobe helix support (helix-admin API, sitemap, RUM
  platform issues).

## Verification steps for EDS

- LCP p75 ≤ 2.5 s (RUM 15-min window).
- Block-load success rate ≥ 99.5%.
- Sitemap.xml returns 200 with the correct URL count.
- Edge cache hit-ratio ≥ 90%.
- All redirects resolve correctly (spot-check top-10 legacy paths).
- RUM beacon rate at baseline sample count.
- Preview branch content NOT visible on live.
- helix-admin all-green.

## Comms templates for EDS

**Channels:** `#edge-deploys`, `#eds-oncall`, `#content-status`,
`#customer-status` (public content issues).

**Stakeholders:** content-ops on-call, edge-ops SRE, EDS tech lead,
head-html owner, editorial lead (for content-visible regressions),
Adobe helix support liaison.

## 2 worked runbook examples for EDS

### Example 1 — "LCP p75 regressed to 3.4s after head.html change"

- **Symptom:** LCP p75 3.4s (baseline 1.9s) starting T+10min after commit `abc123` merged to main.
- **Quick diagnosis:**
  1. helix RUM dashboard — LCP by URL last 30 min; is the regression global or per-path?
  2. `git log --oneline main -5` — recent commits.
  3. Sample page → Chrome DevTools → Performance → what's the LCP element? Any new render-blocking script?
  4. `curl -I https://<host>/` — cache-control + CSP headers.
  5. helix-admin → head.html preview vs live.
- **Mitigation:** `git revert abc123 && git push origin main`; wait 2 min for
  edge deploy; verify RUM LCP recovers within 15 min. If asset-related,
  push image optimization (srcset, loading=lazy) as forward fix.
- **Rollback trigger:** LCP p75 > 3s at 30 min post-revert.
- **Escalation:** L1 edge-ops → L2 EDS tech lead if head.html owner needs
  to author the forward fix.

### Example 2 — "sitemap.xml returning 500"

- **Symptom:** `curl -I https://<host>/sitemap.xml` returns 500 for 20 min; Google Search Console alert.
- **Quick diagnosis:**
  1. `curl -sf https://<host>/sitemap.xml` — response body if any.
  2. `git log -p helix-query.yaml | head -50` — recent syntax change?
  3. helix-admin → query engine status.
  4. Source sheet — accessible? renamed?
  5. helix status page.
- **Mitigation:** fix helix-query.yaml syntax OR restore source-sheet
  access → push; re-preview + re-publish; verify sitemap.xml 200.
- **Rollback trigger:** sitemap 5xx sustained 15 min after fix.
- **Escalation:** L1 content-ops → L2 EDS tech lead → Adobe helix support
  if helix-admin control-plane is the root cause.

## Anti-patterns for EDS

- **Runbook says "restart the edge worker"** — you cannot; edge is
  Adobe-managed. Use `git revert` + push instead.
- **Diagnosis relies on server logs** — EDS is serverless; RUM + CDN
  headers are the observability surface.
- **No helix-preview vs helix-live distinction** — regressions often
  slip when preview is misused as production.
- **Missing head.html check** — head.html regressions are global (affect
  every page) and are a top-3 root cause.
- **Verification uses helix-preview URLs** — customers hit helix-live;
  verify there.

---

Generate the full runbook using `templates/runbook.md` as the master,
populating placeholders with stack-appropriate content from the guide above.
