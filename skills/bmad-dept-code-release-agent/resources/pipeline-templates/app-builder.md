# Pipeline authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a CI/CD pipeline for an Adobe App Builder project
(I/O Runtime, API Mesh, Commerce UI Extensibility, AEM UI Extensibility).
Combine with the appropriate master template under `templates/`.

## Purpose

A pipeline for App Builder should establish: `aio` CLI configuration for
the target workspace, action bundle + web assets build, unit tests
against the action handlers, workspace-scoped deploy (stage workspace
→ prod workspace in the Developer Console), IMS/OAuth credential
rotation into the target workspace, and post-deploy invocation smoke
tests. App Builder deploys per-workspace, not per-region.

## Preferred pipeline target

**GitHub Actions** with the `aio` CLI is the canonical option; the
Adobe I/O CI templates are GH-Actions-first. GitLab CI works
equivalently.

Rationale — the `aio` CLI is the deploy authority for App Builder;
CI simply calls it with the right workspace credentials. No managed
Adobe pipeline (Cloud Manager is AEM-only).

## Typical pipeline stages for App Builder

1. **Setup** — Node 18 or 20 (per App Builder runtime), npm cache.
   <!-- verify: current App Builder runtime version -->
2. **Install** — `npm ci`.
3. **Lint** — `npm run lint`.
4. **Build** — `aio app build` — bundles actions + web assets.
5. **Test** — `npm test` — unit tests against handlers with
   `openwhisk-action-utils` mocks; skip cold-start integration tests
   in CI (they're expensive).
6. **DCA sonar-scan gate** — `--engine app-builder` for LLM-driven
   checks (action size limits, cold-start anti-patterns, missing
   error handling).
7. **DCA audit gate** — pre-release audit.
8. **Config workspace credentials** — `aio config set console.workspaces.stage
   ./workspace-stage.json` (JSON file with the target workspace's
   IMS credentials).
9. **Deploy stage** — `aio app deploy --workspace stage`.
10. **API Mesh update (if used)** — `aio api-mesh update mesh.json
    --workspace stage`.
11. **Smoke test** — `aio app test` or a direct `curl` against
    the deployed action URL.
12. **Manual approval** — CI holds before prod.
13. **Deploy prod** — `aio app deploy --workspace prod`.
14. **Post-deploy** — smoke test against prod; verify I/O Events
    provider registrations still intact.

## Stack-specific secrets / env-vars

- `AIO_STAGE_WORKSPACE_JSON` — full JSON blob with the stage
  workspace's IMS credentials (client ID, client secret, technical
  account, private key).
- `AIO_PROD_WORKSPACE_JSON` — same for prod.
- `AIO_CLI_TOKEN` — for CLI authentication.
- Secrets rotation via `aio app config set --workspace <ws> -s
  MY_SECRET=$VALUE` — per-workspace scope; rotate per Adobe SLA (usually
  90 days).
- Do NOT commit workspace JSON files; store as CI secrets, materialize
  to disk at build time.

## Stack-specific quality gates

- **Bundle size** — each action bundle < 48MB (App Builder limit).
  <!-- verify: current package size limit -->
- **Cold-start budget** — target < 500ms for user-facing actions;
  investigate any regression.
- **Test coverage** — Jest/Vitest coverage floor via DCA
  test-coverage agent.
- **DCA sonar-scan for app-builder** — surfaces missing timeouts,
  large synchronous crypto, action sequence anti-patterns, State SDK
  misuse.
- **`aio app doctor`** — pre-deploy config sanity check.

## Stack-specific rollout options

- **Workspace-swap** — deploy to a secondary workspace; validate;
  swap the "prod" alias to it. Effectively blue-green.
- **Feature-flag** — flag inside the action handler; flag store in
  Adobe State SDK or external (LaunchDarkly).
- **Version-pinned action names** — `myaction-v2` alongside
  `myaction-v1`; caller updates to v2 when ready. Manual, but works.
- **Instant rollback** — `aio app deploy --workspace prod` with the
  previous package.json ref; deploy is < 1min.

## Stack-specific deploy commands

- **Actions + web assets** — `aio app deploy --workspace <ws>`.
- **Single action** — `aio rt action update <name> <bundle>.zip`.
- **API Mesh** — `aio api-mesh update mesh.json --workspace <ws>`.
- **I/O Events providers** — `aio event provider update <id>`
  (rarely from CI; usually one-time setup in the Developer Console).
- **Rollback** — `aio app deploy --workspace <ws>` with a
  previous-package.json ref.

## Stack-specific verify steps

- **Action invoke smoke** — `curl -sf -H "Authorization: Bearer $IMS_TOKEN"
  https://<ns>.adobeioruntime.net/api/v1/web/<pkg>/<action>` and
  verify response.
- **`aio app test`** — Adobe's built-in smoke.
- **I/O Events provider ping** — publish a test event and verify the
  consumer action received it (log inspection).
- **Web asset check** — `curl -sf https://<ns>.adobeio-static.net/`
  and verify the app shell loads.
- **API Mesh probe** — a known-good GraphQL query against the mesh
  URL.

## Worked pipeline outlines

### 1. App Builder middleware — GH Actions with aio CLI

- **Target:** `github-actions`
- **Stages:** setup → install → lint → build (`aio app build`) →
  test → DCA sonar-scan → DCA audit gate → materialize stage
  workspace JSON → `aio app deploy --workspace stage` → smoke →
  manual approval → materialize prod workspace JSON →
  `aio app deploy --workspace prod` → smoke → verify I/O Events
  providers.

### 2. App Builder + API Mesh — GitLab CI

- **Target:** `gitlab-ci`
- **Stages:** identical to above, plus `aio api-mesh update` per
  workspace after the app deploy.

### 3. App Builder Commerce UI Extension — Azure DevOps

- **Target:** `azure-devops`
- **Stages:** setup → install → lint → build → test → DCA gates →
  deploy stage workspace → verify extension surfaces in Commerce
  Admin UI → manual approval → deploy prod → verify.

## Anti-patterns to avoid

1. **Storing workspace JSON in the repo.** Full-privilege IMS
   credentials in git; compromise the entire IMS org.
2. **Deploying to prod without a stage smoke.** No pre-prod signal;
   cold-start regressions caught by end users.
3. **Long-running synchronous work in an action.** Actions timeout
   at ~60s; use sequences or offload to a persistent worker.
4. **Missing `aio app doctor` pre-deploy.** Config typos found by
   `aio app deploy` fail late in the deploy; doctor catches them
   upfront.
5. **Not rotating IMS credentials on schedule.** Adobe rotates their
   IMS certs; missed rotation = deploy fails silently on stale token.

---

Generate the full pipeline using the appropriate `templates/pipeline-<target>.yml`
as the master, populating placeholders with App-Builder-appropriate
content from the guide above.
