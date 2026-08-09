# Pipeline authoring guide — Edge Delivery Services (EDS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a CI/CD pipeline for an Edge Delivery Services
(EDS) project. Combine with the appropriate master template under
`templates/`.

## Purpose

A pipeline for EDS should establish: block-level unit tests, Lighthouse
Core Web Vitals gates, a preview verification against the EDS preview
worker before merging, and confidence that a merge to `main` is safe
(because merge = production deploy at the edge, in seconds). Rollback is
`git revert && git push` — instant.

## Preferred pipeline target

**GitHub Actions** — canonical for EDS. GitLab CI works but EDS's own
tooling assumes GitHub for the branch-preview URLs. CircleCI and
Jenkins are viable for orgs standardized on them.

Rationale — EDS is a git-based deploy: merging to `main` triggers the
edge worker to redeploy. There is no separate `deploy` step in the
pipeline. CI's role is: run tests + Lighthouse budget + preview smoke
before the merge is allowed. The pipeline is a **PR gate**, not a
release-execution pipeline.

## Typical pipeline stages for EDS

1. **Setup** — Node 20, npm cache.
2. **Install** — `npm ci`.
3. **Lint** — `npm run lint` (typically ESLint + Prettier + Stylelint).
4. **Unit tests** — `npm test` — Jest / Vitest against block JS.
5. **Preview URL** — computed from branch name:
   `https://<branch>--<repo>--<owner>.hlx.page`.
6. **Playwright preview smoke** — headless-browser smoke against the
   preview URL: homepage loads, headline blocks render, no console errors.
7. **Lighthouse** — Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP <
   200ms; INP measured via lab-mode with Playwright interactions.
8. **DCA sonar-scan gate** — `--engine eds` for LLM-driven checks
   (block hierarchy issues, `scripts.js` phase misuse, LCP-critical
   asset patterns).
9. **DCA audit gate** — pre-release audit.
10. **Merge to main** — triggers EDS edge deploy automatically; typically
    live in < 60s.
11. **Post-deploy** — Playwright against production URL; Lighthouse
    against prod.

## Stack-specific secrets / env-vars

- `EDS_ADMIN_TOKEN` — for helix-admin API calls (cache warming, publish
  control, redirect config updates).
- No runtime secrets in the edge worker (everything client-side); any
  API keys the storefront calls must be exchanged server-side via
  API Mesh or a backend for frontends.
- `LIGHTHOUSE_SERVER_TOKEN` — optional; for Lighthouse CI server
  integration.

## Stack-specific quality gates

- **Lighthouse CI** — LCP, CLS, INP, TBT budgets. Fail on regression >
  10%.
- **Bundle size** — `blocks/**/*.js` individual budget (< 40KB per
  critical block); `scripts/scripts.js` total budget.
- **CSS budget** — `styles/styles.css` size cap.
- **DCA sonar-scan for eds** — surfaces load-eager/load-lazy/load-delayed
  phase misuse, missing `data-block-name` attributes, blocks reaching
  outside their DOM subtree.
- **Playwright block smoke** — every block has at least one Playwright
  render assertion.

## Stack-specific rollout options

- **Instant rollback via git revert** — `git revert HEAD && git push
  origin main`; edge redeploys in < 60s.
- **Canary via helix-query cohort** — helix-query can filter content by
  cohort attributes; use to route a slice of users to a canary version
  of a page. Niche.
- **Edge worker A/B via Adobe Target** — cohort routing at the edge;
  Adobe Target owns the split.
- **Sheet-driven config split** — some EDS projects use a
  `configs.xlsx` to toggle features per env.

## Stack-specific deploy commands

- **Deploy** — `git push origin main` (no other command needed).
- **Cache warming** — `curl -X POST -H "Authorization: token
  $EDS_ADMIN_TOKEN" "https://admin.hlx.page/live/<owner>/<repo>/main/"`
  for a full site warmup.
- **Path-scoped warmup** — same URL with a specific path suffix.
- **Preview refresh** — `curl -X POST -H "Authorization: token
  $EDS_ADMIN_TOKEN" "https://admin.hlx.page/preview/<owner>/<repo>/main/<path>"`.
- **Redirects deploy** — update `redirects.xlsx` in the content source
  (Google Docs / SharePoint); helix-admin refreshes the edge routing.

## Stack-specific verify steps

- **Playwright smoke** — homepage / a headline block-heavy page /
  a form page, on both mobile and desktop viewports.
- **Lighthouse** — production Lighthouse run; assert budgets.
- **Console error check** — Playwright collects `page.on('console')`
  errors during smoke; fail on any.
- **Preview vs live diff** — helix-admin can report content-source
  drift; fail if unexpected diff exists.

## Worked pipeline outlines

### 1. EDS greenfield — GH Actions PR gate

- **Target:** `github-actions`
- **Stages:** setup → install → lint → unit tests → Playwright
  preview smoke → Lighthouse (budget gate) → DCA sonar-scan → DCA
  audit gate → allow merge → (edge auto-deploys) → post-merge
  Lighthouse + Playwright against production.

### 2. EDS with helix-admin cache warming — GH Actions + post-merge cache warmup

- **Target:** `github-actions`
- **Stages:** identical to above, plus a `post-deploy` job that fires
  the helix-admin cache-warmup for headline paths after the merge.

### 3. EDS enterprise with content-source discipline — GitLab CI

- **Target:** `gitlab-ci`
- **Stages:** all of the above, plus a scheduled nightly Playwright
  regression against production (catches content-source-side changes
  that bypass CI).

## Anti-patterns to avoid

1. **Skipping Lighthouse gates.** EDS's value proposition is speed;
   regressions harm SEO immediately.
2. **Merging to main without preview smoke.** Merge = production; no
   preview smoke = production surprises.
3. **Runtime secrets in the edge worker.** Everything is client-side;
   any secret shipped is public.
4. **Bulking `blocks/*.js` with heavy dependencies.** Missed LCP
   budget; violates the EDS bundle-size philosophy.
5. **Ignoring `data-block-name` conventions.** Breaks EDS auto-block
   discovery; blocks don't hydrate.

---

Generate the full pipeline using the appropriate `templates/pipeline-<target>.yml`
as the master, populating placeholders with EDS-appropriate content
from the guide above.
