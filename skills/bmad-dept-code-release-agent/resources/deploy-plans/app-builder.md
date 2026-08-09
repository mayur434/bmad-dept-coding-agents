# Deploy-plan authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a deploy plan for an Adobe App Builder
project (I/O Runtime actions, API Mesh, Commerce / AEM UI
Extensibility). Combine with `templates/deploy-plan.md` as the master
skeleton.

## Purpose framing

An App Builder deploy plan coordinates workspace-scoped deploys
(`aio app deploy --workspace stage|prod`) with API Mesh resolver
updates, I/O Events provider registrations, and IMS client secret
rotation. Because there is no in-place canary at the action level, the
plan treats the stage workspace as the canary target and describes
how a workspace swap or feature-flag flips real traffic to the new
build.

## Pre-deploy checklist for App Builder

- **`aio app config get --workspace <target>`** matches expected
  values (IMS client, provider registrations, secrets).
- **Secret rotation** completed via `aio app config set --workspace
  <ws> -s` for any credentials changing this release.
- **Namespace quota** checked — action count, memory footprint, and
  concurrent activations within Runtime limits.
  <!-- verify: current tier quotas -->
- **API Mesh mesh definition** validated (`aio api-mesh:describe`)
  and diff reviewed vs live.
- **I/O Events provider registrations** preserved — no unintended
  provider deletion.
- **UI Extensibility manifest** version bumped if the extension
  contract changes; Adobe Exchange metadata current.
- **Downstream integrations** (Commerce store view configs, AEM
  extension registrations) pinged for readiness.
- **Cold-start estimate** understood — first activation after deploy
  incurs latency; smoke traffic pre-warm planned.

## Deploy phases for App Builder — rollout-specific

App Builder has no per-action traffic split. Phase against the
resolved `--rollout`:

- **`canary` (via workspace swap).** Phase 1 deploy to secondary
  workspace (`prod-canary` or reuse `stage`); Phase 2 route 10% of
  Commerce / AEM extension traffic to the canary workspace via the
  extension's own targeting rule; Phase 3 route 50%; Phase 4 promote
  to `prod`.
- **`blue-green` (workspace swap).** Deploy to blue workspace, warm,
  then flip the extension registration or downstream config to point
  at the blue namespace URL.
- **`rolling`.** Default `aio app deploy --workspace prod`; actions
  are versioned atomically at the Runtime; single phase with cold-
  start warm-up.
- **`feature-flag`.** Deploy dark; flip via `aio app config set` or
  a runtime env var read at action-invocation time.
- **`bigbang`.** Direct `aio app deploy --workspace prod`; reserved
  for hotfixes where the previous action version is broken.

## Verification per App Builder

- **Action smoke** — `aio app test --workspace <target>` (or
  scripted `aio rt action invoke`) returns 200 with expected payload
  shape.
- **I/O Runtime activation stats** — success rate ≥ 99% on the first
  100 activations post-deploy; average duration within baseline.
- **Cold-start latency** for a first-hit activation < 3s p95.
- **API Mesh endpoint** end-to-end query < 500ms p95.
- **I/O Events** — a synthetic event flows from provider → registered
  action → destination within 30s.
- **UI Extension** loads inside its host (Commerce Admin / AEM
  Author) without console errors on the last two majors of Chrome
  and Safari.
- **Log stream** (`aio rt activation logs -l`) clean of new
  `ERROR` entries during smoke.
- **IMS client** token exchange succeeds; refresh token TTL clear.

## Rollback triggers for App Builder

- **Action error rate > 5%** on the first 200 activations post-deploy.
- **State SDK errors** — `aio-lib-state` reads/writes fail (region or
  quota issue).
- **I/O Event delivery lag > 5 min** — consumer action failing or
  provider disconnected.
- **API Mesh resolver error rate > 2%** or timeout > 5%.
- **UI Extension load fails** in host application (Commerce Admin /
  AEM Author).
- **Downstream integration failure** — Commerce webhook / AEM
  extension not resolving to the new action.
- **Cold-start latency > 8s p95** and not recovering after warm-up.
- **Manual call** from release manager or on-call.

## Communication plan for App Builder

**Pre-deploy** (T-24h): announce in `#appbuilder-releases` — release
version, workspaces targeted, extension host teams pinged, IMS
secret rotation flagged.

**During deploy**: post at each phase gate — stage-deployed, canary-
traffic-shifted, prod-deployed. Extension host team notified when
their surface picks up the new action.

**Post-deploy** (T+1h): all-clear with activation success rate,
cold-start p95, event-delivery latency snapshot. Announcement
distributed to extension host teams.

## Stakeholder RACI for App Builder

| Role | Responsibility |
|---|---|
| Release manager | Owns workspace promotion + go/no-go per phase. |
| Tech lead | Owns action + mesh change set; on bridge for cold-start warm-up. |
| DevOps / SRE | Executes `aio app deploy`; monitors Runtime stats. |
| QA | Runs `aio app test` + cross-browser extension smoke. |
| Extension host team | Verifies extension loads in host surface. |
| Security | Signs off IMS secret rotation + provider registration diff. |
| On-call | Primary responder for action / event regressions. |

## 2 worked deploy-plan examples for App Builder

**v2.5.0 — New Commerce webhook action + API Mesh resolver, canary
(workspace swap), Prod.**
Pre-deploy: stage workspace deployed and green; mesh describe clean;
webhook host in Commerce Admin ready.
- Phase 1: deploy to `prod-canary` workspace; run `aio app test`;
  invoke action 100× via smoke script.
- Phase 2: route 10% of Commerce webhook traffic to canary namespace
  URL; 30 min soak.
- Phase 3: route 50%; monitor activation success + event-delivery
  lag; 30 min.
- Phase 4: promote to `prod` workspace; drain canary after 24h.
- Rollback: revert webhook target URL to previous namespace.

**v2.5.1 — IMS client secret rotation + hotfix action, rolling, Prod.**
Pre-deploy: rotated secret published to `prod` workspace; downstream
Commerce integration credential updated.
- Phase 1: `aio app deploy --workspace prod`; warm actions with 20
  smoke invocations.
- Phase 2: verify IMS token exchange + Commerce webhook 5-min soak.
- Rollback: `aio app deploy` prior tag; roll back IMS secret if
  auth failures.

## Anti-patterns to avoid for App Builder

- **Skipping cold-start warm-up** — first real traffic hits cold
  actions and spikes latency past SLO.
- **Rotating IMS secrets without downstream sync** — Commerce /
  AEM integrations fail auth mid-deploy.
- **Deploying UI Extension bumps without host-team notice** — host
  surface stops rendering; users see blank panels.
- **Modifying I/O Events provider registrations mid-deploy** —
  in-flight events drop; consumers see delivery gap.
- **Deploying without checking namespace quota** — `aio app deploy`
  fails halfway with partial action set live.

---

Generate the full deploy plan using `templates/deploy-plan.md` as the
master, populating placeholders with stack-appropriate content from
the guide above.
