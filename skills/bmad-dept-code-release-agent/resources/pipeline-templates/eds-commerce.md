# Pipeline authoring guide — EDS + Commerce hybrid

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a CI/CD pipeline for an EDS + Adobe Commerce
SaaS hybrid project (EDS storefront with `@dropins/storefront-*`
consuming Catalog Service / Live Search / Payment Services). Combine
with the appropriate master template under `templates/`.

## Purpose

A pipeline for EDS+Commerce hybrid should establish everything the EDS
pipeline establishes (see `eds.md`) plus: drop-in version compatibility
with the Catalog Service / Live Search / Payment Services schema in the
target environment, IMS token exchange validation for Commerce calls,
Playwright smoke against commerce flows (browse → PDP → cart →
checkout), and coordinated release with any middleware (API Mesh) the
drop-ins depend on.

## Preferred pipeline target

**GitHub Actions** — canonical for EDS-based projects. GitLab CI works
equivalently.

Rationale — Same as EDS: merge to `main` triggers edge deploy. CI's
role is the PR gate. The additional responsibility for hybrid is
verifying drop-in version compatibility with the target Commerce SaaS
env before allowing the merge.

## Typical pipeline stages for EDS+Commerce

1. **Setup** — Node 20, npm cache.
2. **Install** — `npm ci`.
3. **Lint** — `npm run lint`.
4. **Unit tests** — `npm test`.
5. **Drop-in compatibility check** — for each pinned
   `@dropins/storefront-*` version, verify it's on the compatibility
   matrix for the target Commerce SaaS schema version (script pulls the
   matrix from the drop-in registry or a maintained
   `commerce-compat.json`).
6. **Middleware coordination check** — if the project has an
   accompanying API Mesh, verify the mesh version pinned matches what
   the storefront expects. Fail if unaligned.
7. **Preview URL** — `https://<branch>--<repo>--<owner>.hlx.page`.
8. **Playwright preview smoke** — homepage, PLP (via Live Search),
   PDP (via Catalog Service), add-to-cart, checkout mock (guest flow).
9. **Lighthouse** — same CWV budgets as EDS; commerce pages included.
10. **Storefront events schema check** — verify the emitted event names
    + shape match the target env's storefront-events schema version.
11. **DCA sonar-scan gate** — `--engine eds-commerce` for LLM-driven
    checks (drop-in composition anti-patterns, cart-state persistence
    issues, IMS token handling in the storefront).
12. **DCA audit gate** — pre-release audit.
13. **Merge to main** — triggers EDS edge deploy.
14. **Post-deploy** — Playwright commerce flow against production;
    Lighthouse against prod; storefront-events sanity check
    (any schema errors in the first 30min).

## Stack-specific secrets / env-vars

- `EDS_ADMIN_TOKEN` — helix-admin API.
- `COMMERCE_SAAS_ENDPOINT` / `COMMERCE_SAAS_API_KEY` — Catalog Service /
  Live Search endpoints for CI smoke.
- `IMS_CLIENT_ID` / `IMS_CLIENT_SECRET` — for IMS token exchange
  (usually server-side; Playwright smoke may need for authenticated
  flows).
- `PAYMENT_SERVICES_TEST_KEY` — for checkout-flow smoke; must be a
  test-mode key, never production.

## Stack-specific quality gates

- **Everything from `eds.md`** — Lighthouse, bundle-size, block
  budgets.
- **Drop-in version compatibility matrix** — hard gate. Fail on
  unaligned versions.
- **Commerce flow smoke** — cart, checkout, sign-in.
- **Storefront-events schema alignment** — hard gate on schema drift.
- **DCA sonar-scan for eds-commerce** — cart-state anti-patterns
  (localStorage leaks), unencrypted PII in events, missing consent-mode.

## Stack-specific rollout options

Same as EDS:

- **Instant rollback via git revert** — for the storefront.
- **Drop-in version pinning per env** — pin different `@dropins/*`
  versions in `package.json` per env (via env-specific build override
  or a bootstrap-time env-var).
- **Middleware coordination** — deploy API Mesh first, storefront
  second, so drop-ins don't hit an unmigrated mesh.
- **Adobe Target A/B for pricing / promo rollouts** — cohort routing.

## Stack-specific deploy commands

- **Storefront** — `git push origin main`.
- **API Mesh** — `aio api-mesh update mesh.json --workspace <ws>` if
  the project has a mesh.
- **Cache warming** — helix-admin path warmup after merge.
- **Rollback** — `git revert HEAD && git push origin main` for the
  storefront; API Mesh has its own rollback via a previous mesh
  version.

## Stack-specific verify steps

- **Playwright commerce flow** — full guest-checkout end-to-end
  against prod after deploy.
- **Lighthouse on PDP + Cart pages** — traffic-heavy pages get their
  own budget assertions.
- **Storefront-events endpoint** — assert no schema errors in the
  first 30min.
- **Catalog Service query sanity** — a known-good query returns the
  expected product shape.
- **Payment Services test transaction** — a test-mode transaction
  succeeds end-to-end.

## Worked pipeline outlines

### 1. EDS storefront + Commerce SaaS drop-ins — GH Actions

- **Target:** `github-actions`
- **Stages:** setup → install → lint → unit tests → drop-in
  compat matrix → middleware coordination check → Playwright preview
  commerce smoke → Lighthouse → storefront-events schema check →
  DCA sonar-scan → DCA audit gate → merge (edge auto-deploys) →
  post-deploy Playwright + Lighthouse.

### 2. Coordinated release — storefront + API Mesh middleware

- **Target:** `github-actions` (multi-repo orchestration)
- **Stages:** deploy API Mesh first (stage → prod), wait for mesh
  version to be live, then merge storefront PR (edge deploys), then
  smoke.

### 3. EDS+Commerce with Payment Services — GitLab CI

- **Target:** `gitlab-ci`
- **Stages:** all of the above, plus a Payment Services test
  transaction smoke in the post-deploy stage.

## Anti-patterns to avoid

1. **Bumping drop-in versions without matrix check.** Runtime GraphQL
   shape errors; commerce flow breaks silently.
2. **Deploying storefront before API Mesh.** Storefront calls new
   mesh handlers that don't exist yet; race condition.
3. **Skipping cart / checkout Playwright smoke.** Regressions on the
   revenue-critical flow shipped straight to users.
4. **Missing storefront-events schema check.** Marketing dashboards
   go silent; product SEE thinks the release failed.
5. **Test-mode Payment Services key in prod bundle.** Payments look
   fine in QA but fail at real card charge; fund-flow break.

---

Generate the full pipeline using the appropriate `templates/pipeline-<target>.yml`
as the master, populating placeholders with EDS+Commerce-appropriate
content from the guide above.
