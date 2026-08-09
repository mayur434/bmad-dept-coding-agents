# Release-notes authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating release notes for an Adobe App Builder project
(I/O Runtime actions, API Mesh, Commerce UI Extensibility, AEM UI
Extensibility). Combine with `templates/release-notes.md` as the master
skeleton.

## Purpose framing

App Builder release notes address I/O Runtime operators, Adobe
Developer Console admins, and the downstream host apps (Commerce
Admin, AEM Author) that surface UI extensions. Every release is scoped
to a workspace (stage / prod) in the Adobe Developer Console, so notes
must name the workspace, action versions, and any I/O Events provider
registration changes that survive deploy. Internal Node.js dependency
patch bumps are usually not release-noteworthy unless they affect a
public action signature.

## Change categories for App Builder

- **Runtime action signature changes** — action name renames, input
  parameter changes, response shape shifts.
- **Runtime action additions / removals** — new actions in
  `app.config.yaml`; deleted actions (URL 404s).
- **I/O Events schema changes** — event provider metadata, event type
  additions, payload shape shifts.
- **State-SDK key changes** — `aio-lib-state` key namespace changes;
  TTL adjustments; region routing changes.
- **API Mesh source changes** — new upstream sources, resolver
  overrides, auth-header changes, mesh-level caching config.
- **UI extension surface changes** — Commerce UI Ext / AEM UI Ext new
  extension points, iframe origin changes, host-app compatibility.
- **Workspace / env-var changes** — new required `aio app config`
  values, secret rotations.
- **Runtime version / Node.js version bumps** — I/O Runtime version
  compatibility. <!-- verify: current I/O Runtime Node version -->

## Commit-format conventions for App Builder

- **Conventional Commits mapping:**
  - `feat(action|mesh|ext): …` → **New features**
  - `fix(action|resolver|ext): …` → **Fixes**
  - `perf(action|mesh): …` → **Performance**
  - `refactor(action|state): …` → **Refactoring**
  - `build(app-config|package): …` → **CI / build changes**
  - `chore(deps): …` → skip unless CVE
- **Escalate as BREAKING when any commit touches:**
  - Action rename (existing callers 404 on old URL)
  - Action input schema removal or required-field addition
  - I/O Events event-type schema field removal
  - State-SDK key namespace change (previously stored state orphaned)
  - API Mesh source URL change or resolver removal
  - UI extension extension-point rename or removal
  - Workspace env-var removal (action init crashes)
  - IMS client ID rotation without dual-issuer window
- **Skip in customer-facing notes:** `test:` action-unit-test refactors,
  `chore(deps):` `aio-*` patch bumps with no behavior change, internal
  logging additions.

## Breaking changes for App Builder

1. **Action rename.** Existing webhooks / Commerce Admin buttons /
   AEM Author extension URLs return 404. *Mitigation:* keep the old
   action alive as a thin proxy for one release.
2. **Action input schema tighten.** Callers omitting the new required
   field crash. *Mitigation:* accept + default for one release, then
   require.
3. **I/O Events schema removal.** Downstream event consumers
   deserialize null. *Mitigation:* dual-emit for one release cycle.
4. **State-SDK namespace change.** Previously stored session state
   orphaned; user-facing "cart reset" symptom.
   *Mitigation:* migration action + dual-read window.
5. **API Mesh resolver removal.** GraphQL storefront queries fail.
   *Mitigation:* deprecation notice + client migration.
6. **UI extension-point rename.** Commerce Admin / AEM Author no longer
   shows the extension. *Mitigation:* Adobe Developer Console
   re-registration.
7. **Workspace env-var removal.** Action init crashes.
   *Mitigation:* pre-deploy `aio app config get` audit.
8. **IMS client rotation.** All action-to-service calls 401.
   *Mitigation:* rotate secrets to workspace BEFORE deploy.

## Upgrade notes for App Builder

Guidance on what upgrade notes should include:

- **`aio app deploy` per workspace** — stage first, verify, then prod.
- **Secret rotation** — `aio app config set --workspace prod -s
  MYSECRET=<value>` BEFORE deploy when secrets change.
- **API Mesh redeploy** — `aio api-mesh update` sequenced BEFORE
  storefront deploy when new resolvers land; AFTER when a resolver is
  deprecated.
- **I/O Events provider registration** — surviving deploys is the
  norm, but re-verify via `aio app get-events-of-provider` post-deploy.
- **UI Extension registration** — `aio app deploy` publishes to the
  Adobe Developer Console; verify extension appears in host-app
  extension gallery.
- **Namespace-scoped `aio-lib-state`** — call out any TTL or namespace
  shift that could orphan sessions.
- **Node.js version compatibility** — call out I/O Runtime Node
  crossings (e.g. Node 18 → 20). <!-- verify: current runtime Node -->
- **Coordination with Commerce / AEM release windows** when UI
  extensions live in a shared surface.

## Known issues for App Builder

Typical known-issues to disclose:

- Cold-start of a Node 20 action ~800ms; warm-up hook recommended for
  latency-sensitive paths.
- `aio-lib-state` occasional stale-read on region failover (~2s
  divergence).
- I/O Events delivery latency spikes during Adobe Experience Platform
  incidents; buffer + retry pattern recommended.
- API Mesh cold-cache p99 latency ~400ms above warm; keep-alive
  scheduled probe recommended.
- UI Extension iframe layout shift on Commerce Admin when host page
  navigates during extension load.

## Contributor + PR/ticket linking conventions

- **Jira project keys:** typically `AIO-####`, `AB-####`, or
  customer-specific.
- **PR links:** GitHub `owner/app-builder-project#456`.
- **Workspace + deploy hash** — cite `workspace: prod, deploy: 3f2a1b`
  from the `aio app deploy` output.
- **Adobe Developer Console app ID** — surface the app ID + workspace
  ID for the release.
- **I/O Events provider ID** — cite provider IDs affected by the release.

## 3 worked release-notes examples for App Builder

**v1.3.0 — Order-status webhook action (2026-04-08).**
- **New:** Runtime action `orders/status-webhook` (POST) surfaces
  Commerce order-status events to a customer CRM; API Mesh resolver
  `Query.orderStatus` proxies the same.
- **Fixed:** State-SDK read timeout on region failover (Jira AIO-812).
- **Perf:** Action `orders/enrich` p95 -240ms via mesh-side caching.
- **Upgrade:** `aio app deploy --workspace prod`; env vars
  `CRM_ENDPOINT` + `CRM_API_KEY` set BEFORE deploy; `aio api-mesh
  update` sequenced BEFORE storefront release.
- **Known issue:** Cold-start ~800ms; scheduled warm-up ping in v1.3.1.

**v1.3.1 — I/O Events schema patch (2026-04-15).**
- **Breaking:** Event `order.status.updated` field `paymentToken`
  removed for PCI-scope reduction. Downstream event consumers must
  drop the field from their pipelines.
- **Fixed:** `orders/status-webhook` retried on 5xx with correct
  exponential backoff (AIO-830).
- **Upgrade:** dual-emit window closes 2026-05-01; consumers migrate
  by that date.

**v2.0.0 — Node 20 crossing + UI Ext (2026-06-05).**
- **Breaking:** I/O Runtime Node 18 → 20; all actions rebuilt.
  `aio-lib-state` bumped to v6.
- **New:** Commerce UI Extension `admin.order.view` extension point
  registered; adds "Retry payment" panel to Commerce Admin order view.
- **Upgrade:** `aio app deploy --workspace prod`; verify UI extension
  in Commerce Admin extension gallery post-deploy; IMS client
  rotation coordinated with Commerce team (deploy-window doc linked).
- **Known issue:** UI Ext iframe layout shift on rapid Admin navigation;
  Adobe tracking.

## Anti-patterns to avoid for App Builder

- **Undocumented action rename.** URL 404s the moment stage cutover
  runs; upstream webhooks silently break.
- **Missing workspace name.** Release notes without a workspace name
  are ambiguous — prod release vs stage release vs dev.
- **Skipping the mesh redeploy sequencing note.** Ops teams learn from
  the storefront 500s.
- **I/O Events schema changes buried under "internal".** Downstream
  event consumers are as much a stakeholder as the storefront.
- **`aio-lib-state` namespace change unnamed.** Session-state loss is
  a user-facing regression.

---

Generate the full release notes using `templates/release-notes.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
