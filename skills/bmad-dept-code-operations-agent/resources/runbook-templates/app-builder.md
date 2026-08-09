# Runbook authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a runbook for an Adobe App Builder project
(I/O Runtime actions, API Mesh, I/O Events, State SDK, UI Extensions).
Combine with `templates/runbook.md` as the master skeleton.

## Purpose framing

An App Builder runbook is written for a serverless/integration on-call.
The vocabulary is **actions**, **sequences**, **workspaces**, **I/O
Events**, **API Mesh resolvers**, **State SDK**, **IMS**, **namespace
quotas**. Runbooks focus on: action error rate per namespace, I/O Event
delivery lag, State SDK errors, namespace quota headroom, API Mesh
latency, IMS token cache health. Escalation to Adobe support is a
first-class mitigation.

## Common incident symptoms for App Builder

- Action error rate > 5% per namespace (deployed code regression, cold-start storm)
- I/O Event delivery lag > 5 min (webhook receiver 5xx, subscription mis-config)
- State SDK error rate rising (region unavailable, quota saturation)
- Namespace quota headroom < 10% (activations/day, concurrent invocations, memory)
- API Mesh resolver 5xx > 1% (JS exception, upstream vendor timeout)
- IMS token cache miss storm (IMS rotation, cache eviction)
- Cold-start count per action > baseline (memory pressure, deploy churn)
- Action sequence stuck (child action timed out mid-sequence)
- UI Extension load failure (extension manifest error, IMS scope missing)
- Workspace deploy failure (aio CLI error, IMS auth stale)

## Quick-diagnosis commands (per common symptom)

- **Action error rate:** `aio app logs -a <action> --limit 100`;
  `aio runtime activation list --limit 50 | grep -v success`;
  `aio runtime activation get <id>` for a failing activation.
- **I/O Event delivery lag:** `aio event registration list`;
  webhook receiver 5xx rate; event journal for pending events.
- **State SDK errors:** action logs for `StateError`; check namespace region;
  Adobe status page (State SDK).
- **Namespace quota:** `aio runtime namespace get -l`; check `activations/day`,
  `concurrent invocations`, `memory quota per action`.
- **API Mesh 5xx:** `aio api-mesh describe --envId <id>`;
  `aio api-mesh log-list`; test resolver via `curl -sf $MESH_URL -d '{...}'`.
- **IMS token:** `aio auth:list`; check token exp; IMS status page.
- **Cold-start:** action logs `initTime > 500ms`; if bumping, check
  memory-per-action; recent deploy churn.

## Likely causes (per common symptom)

- **Action error rate:** deploy regression; new dependency version;
  cold-start timeouts; upstream API vendor 5xx.
- **I/O Event lag:** webhook receiver rejecting; subscription bound to a
  stale endpoint; event provider outage.
- **State SDK errors:** region-wide State SDK outage; quota saturation;
  key-collision under bulk writes.
- **Namespace quota:** legitimate load spike; runaway loop
  (action-invokes-action recursion); leaked long-running actions.
- **API Mesh 5xx:** custom resolver JS exception; upstream API timeout
  not caught; mesh cache TTL misconfig.
- **IMS token storm:** IMS rotation; cache TTL mismatch; action failing
  to cache and re-issuing on every invocation.
- **Cold-start spike:** memory bumped forcing new containers; action
  churn (redeploy loop); traffic burst beyond warm pool.

## Mitigation steps (per common symptom)

- **Action error rate:** rollback action via `aio app deploy` with the
  previous artifact; if a specific dependency, downgrade in `package.json`
  and redeploy.
- **I/O Event lag:** fix webhook 5xx (rolling restart the receiver);
  if subscription mis-config, re-register via `aio event registration create`.
- **State SDK errors:** if Adobe status confirms — no local action;
  disable heavy State usage in the affected path via feature flag;
  escalate P1 to Adobe.
- **Namespace quota:** identify the noisy action (per-action activation
  count); temporarily reduce its concurrency; request quota increase from
  Adobe (P2 case).
- **API Mesh 5xx:** rollback mesh config via
  `aio api-mesh update -f <last-good.json>`; disable failing resolver
  temporarily.
- **IMS token storm:** ensure IMS token is cached (State SDK) with TTL <
  token exp; if cache is present but missing, re-init on first action call.
- **Cold-start spike:** lower per-action memory if over-provisioned; pin
  concurrency; scale warm pool via `aio runtime activation` config.

## Rollback triggers for App Builder

Cross-reference `rollback-plans/app-builder.md` from the Release agent:

- Action error rate > 5% per namespace for 10 min.
- I/O Event delivery lag > 15 min.
- State SDK error rate > 5%.
- API Mesh 5xx > 2% for 5 min.
- Namespace quota exhausted (any dimension).
- Manual call from integration on-call.

## Escalation matrix for App Builder

- **L1** — integration on-call, App Builder service owner.
- **L2** — App Builder tech lead, API Mesh owner.
- **L3** — Engineering manager.
- **Vendor** — Adobe I/O Runtime support (P1/P2 case with namespace ID);
  Adobe IMS support (auth flow).

## Verification steps for App Builder

- Action error rate ≤ 0.5% per namespace.
- I/O Event delivery lag ≤ 30 s.
- State SDK error rate ≤ 0.5%.
- Namespace quota headroom ≥ 30% on all dimensions.
- API Mesh 5xx ≤ 0.5%; p95 ≤ 500ms.
- IMS token cache hit ≥ 95%.
- Cold-start ratio ≤ 5% of total activations.

## Comms templates for App Builder

**Channels:** `#app-builder-deploys`, `#{{namespace}}-oncall`,
`#adobe-io-status`.

**Stakeholders:** integration on-call, App Builder tech lead, API Mesh
owner, IMS/auth owner, Adobe I/O Runtime support liaison.

## 2 worked runbook examples for App Builder

### Example 1 — "myservice/order-webhook error rate 12%"

- **Symptom:** `myservice/order-webhook` action error rate 12% (baseline 0.3%) starting T+15min after deploy v2.5.0.
- **Quick diagnosis:**
  1. `aio app logs -a myservice/order-webhook --limit 200 | grep -i error`.
  2. `aio runtime activation list -a myservice/order-webhook --limit 50 | grep -v success`.
  3. Sample failing activation — `aio runtime activation get <id>`; inspect exception.
  4. Recent deploy: `aio app deploy` last artifact hash — is a dependency version bumped?
  5. Namespace quota: `aio runtime namespace get -l`.
- **Mitigation:** redeploy previous artifact via
  `aio app deploy --output <last-good-artifact-tarball>`; verify at 5 min.
- **Rollback trigger:** error rate > 5% at 15 min post-rollback.
- **Escalation:** L1 integration on-call → L2 App Builder tech lead if
  a shared library / mesh dependency is the root cause.

### Example 2 — "State SDK error rate 8%"

- **Symptom:** State SDK GET failures at 8% across all `myservice/*` actions in `wskns-prod`; baseline 0.1%.
- **Quick diagnosis:**
  1. Adobe I/O status page — State SDK section.
  2. Action logs — is the region tag consistent (State SDK is region-scoped)?
  3. `aio runtime namespace get -l` — quota saturation?
  4. Check State SDK client-side cache hit ratio (if applied).
  5. Cross-check IMS token freshness — auth cascades into State SDK 401.
- **Mitigation:** if Adobe status confirms — disable heavy State reads
  via feature flag; announce degraded feature; open P1 with Adobe.
  If IMS-related — refresh token cache; ensure TTL < token exp.
- **Rollback trigger:** error rate > 10% at 20 min.
- **Escalation:** L1 integration on-call → L2 → Adobe I/O Runtime P1.

## Anti-patterns for App Builder

- **Runbook says "restart the container"** — I/O Runtime is serverless;
  containers cycle automatically. Mitigate via action redeploy.
- **Diagnosis skips namespace quota check** — a top-3 root cause and
  invisible without `aio runtime namespace get -l`.
- **No Adobe status-page check** — 25%+ of App Builder incidents
  originate Adobe-side (I/O Runtime, IMS, State SDK, I/O Events).
- **Missing IMS token freshness check** — auth-cascade 401s look like
  application errors but are IMS-scoped.
- **Verification uses `/health` HTTP endpoint** — App Builder has no
  such endpoint; verify via action activation success rate.

---

Generate the full runbook using `templates/runbook.md` as the master,
populating placeholders with stack-appropriate content from the guide above.
