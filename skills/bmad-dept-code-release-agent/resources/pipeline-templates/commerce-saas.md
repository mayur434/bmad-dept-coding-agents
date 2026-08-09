# Pipeline authoring guide — Adobe Commerce SaaS

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a CI/CD pipeline for an Adobe Commerce SaaS
project (Catalog Service / Live Search / storefront drop-ins consumed
edge-side, usually via EDS). Combine with the appropriate master
template under `templates/`.

## Purpose

A pipeline for Adobe Commerce SaaS should establish: drop-in bundle
version compatibility with the Catalog Service schema, storefront-events
schema validation, edge deploy of the storefront code (usually EDS), and
IMS/API-Mesh configuration validation. Unlike Commerce PaaS, there is no
`app/code` — the platform runs Adobe-managed; the customer code lives
edge-side (EDS + drop-ins) and middleware-side (API Mesh + I/O Runtime).

## Preferred pipeline target

**GitHub Actions or GitLab CI** for the storefront (EDS) codebase. For
API Mesh + I/O Runtime middleware, `github-actions` + `aio` CLI is
standard.

Rationale — Commerce SaaS storefronts are typically EDS projects. EDS
uses a git-based edge deploy: merging to `main` triggers a deploy at the
edge. CI's role is: run tests + drop-in-compatibility check + Lighthouse
before the merge is allowed.

## Typical pipeline stages for Commerce SaaS

1. **Setup** — Node 20, npm cache.
2. **Install** — `npm ci`.
3. **Lint + type check** — `npm run lint`, `npm run type-check`
   (if TypeScript).
4. **Drop-in compatibility check** — verify pinned `@dropins/storefront-*`
   versions against the Catalog Service / Live Search schema version
   published for the target environment.
5. **Build** — `npm run build` (for standalone EDS deploys or when
   a bundler is in the loop; EDS itself is often bundler-free).
6. **Test** — unit tests (Jest / Vitest); Playwright smoke against a
   preview deploy.
7. **Lighthouse** — Core Web Vitals gate (LCP, CLS, INP, TBT).
8. **DCA sonar-scan gate** — `--engine commerce-saas` for LLM-driven
   checks (event schema drift, drop-in composition anti-patterns).
9. **DCA audit gate** — pre-release audit.
10. **Deploy** — git push to `main` triggers EDS edge deploy; API Mesh
    updates via `aio api-mesh update`; I/O Runtime actions via
    `aio app deploy`.
11. **Post-deploy** — Playwright smoke against production; monitor
    storefront-events for schema-mismatch errors.

## Stack-specific secrets / env-vars

- `ADOBE_IMS_CLIENT_ID` / `ADOBE_IMS_CLIENT_SECRET` — for API Mesh /
  I/O Runtime deploys.
- `AIO_CLI_TOKEN` — for `aio` CLI in CI.
- `EDS_ADMIN_TOKEN` — for helix-admin API calls (cache warming,
  preview control).
- `COMMERCE_SAAS_ENDPOINT` / `COMMERCE_SAAS_API_KEY` — Catalog Service /
  Live Search runtime credentials (mostly loaded at runtime from the
  storefront config, but CI may need them for smoke tests).

## Stack-specific quality gates

- **Lighthouse CI** — LCP < 2.5s, CLS < 0.1, INP < 200ms on the mobile
  emulator. Fail the pipeline on regression > 10%.
- **Drop-in version-matrix check** — every `@dropins/storefront-*`
  package pinned in `package.json` must match a version marked
  compatible with the Catalog Service schema in the target env.
- **Storefront events schema validation** — verify emitted events match
  the storefront-events schema version pinned for the target env.
- **DCA sonar-scan for commerce-saas** — surfaces drop-in composition
  anti-patterns, deprecated Catalog Service call shapes, IMS token
  handling issues.
- **Bundle size budget** — `blocks/**/*.js` size guardrails
  (< 40KB per critical block).

## Stack-specific rollout options

- **Feature-flag rollout** — flip a flag in Adobe Target audience to
  route N% of users to the new drop-in bundle version.
- **Drop-in-version pinning** — pin different versions per env in the
  storefront's config (test in stage, promote to prod).
- **EDS canary via helix-query** — cohort-based routing at the edge
  worker.
- **Instant revert** — git revert on the EDS repo pushes to main,
  edge redeploys, live in < 2 min.

## Stack-specific deploy commands

- **EDS storefront** — `git push origin main` (edge worker handles the
  deploy; no separate command).
- **API Mesh** — `aio api-mesh update mesh.json --workspace <ws>`.
- **I/O Runtime middleware** — `aio app deploy --workspace <ws>`.
- **Cache warming (helix-admin)** — `curl -X POST -H "Authorization:
  token $EDS_ADMIN_TOKEN" https://admin.hlx.page/live/<owner>/<repo>/main/<path>`.

## Stack-specific verify steps

- **Playwright smoke** — homepage / PLP / PDP / cart / checkout on the
  live URL.
- **Lighthouse** — post-deploy Lighthouse run against prod.
- **Storefront-events sanity** — check the events endpoint for schema
  errors in the first 30min.
- **Catalog Service call sanity** — hit the Catalog Service GraphQL
  endpoint with a known-good query and verify response shape.

## Worked pipeline outlines

### 1. EDS storefront + Commerce SaaS drop-ins — GH Actions

- **Target:** `github-actions`
- **Stages:** setup → install → lint + type-check → drop-in compat →
  build → unit tests → Playwright preview → Lighthouse → DCA sonar-scan
  → DCA audit gate → merge to main (auto-triggers EDS deploy) →
  Playwright prod smoke.

### 2. API Mesh middleware for Commerce SaaS — GitLab CI

- **Target:** `gitlab-ci`
- **Stages:** setup (Node + aio CLI) → mesh validation
  (`aio api-mesh validate mesh.json`) → deploy stage
  (`aio api-mesh update --workspace stage`) → smoke → manual approval →
  deploy prod (`aio api-mesh update --workspace prod`) → smoke.

### 3. Coordinated release — drop-in version bump + API Mesh update

- **Target:** `github-actions` (multi-repo orchestration)
- **Stages:** run both storefront and middleware pipelines in parallel
  → coordinate merge (both green before either merges) → deploy in
  order (middleware first, storefront second, so drop-ins don't call an
  API Mesh version that doesn't exist).

## Anti-patterns to avoid

1. **Bumping drop-in versions without matching Catalog Service schema.**
   Runtime GraphQL errors; storefront breaks silently.
2. **Deploying storefront and middleware simultaneously.** Race
   condition: storefront may hit an API Mesh endpoint that hasn't
   updated yet. Deploy middleware first.
3. **Missing Lighthouse budget.** EDS is Core-Web-Vitals-centric;
   regressions harm SEO immediately.
4. **Hardcoding IMS tokens in the storefront bundle.** Token leak;
   always exchange server-side (API Mesh / I/O Runtime).
5. **No storefront-events schema check.** Analytics silently break; PM
   sees zero events until dashboards go quiet.

---

Generate the full pipeline using the appropriate `templates/pipeline-<target>.yml`
as the master, populating placeholders with Commerce-SaaS-appropriate
content from the guide above.
