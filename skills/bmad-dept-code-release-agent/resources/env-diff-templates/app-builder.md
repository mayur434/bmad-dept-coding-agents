# Env-diff authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an env-diff for an Adobe App Builder project
(I/O Runtime actions, API Mesh, Commerce / AEM UI Extensibility).
Combine with `templates/env-diff.md` as the master skeleton.

## Purpose framing

An App Builder env-diff catches workspace-config drift between the
Stage and Prod workspaces in the Developer Console, `.env.<workspace>`
gaps, `app.config.yaml` action-mapping deltas, I/O Events provider
registration mismatches, and IMS technical account credential rotation
gaps. It should also flag Runtime namespace tier deltas and action
concurrency limits that will surface as throttling in production.

## Config-file diff scope for App Builder

- **`app.config.yaml`** per workspace — action definitions, sequences,
  package name, extension manifest references.
- **`.env.<workspace>`** — workspace-scoped env vars consumed at
  `aio app run` and baked into action deploys.
- **`console.json`** exported from the Developer Console — org/project/
  workspace linkage, service subscriptions, IMS integration
  fingerprints.
- **`.aio`** — CLI-side workspace binding.
- **`ext.config.yaml`** for extension-point manifests (AEM/Commerce UI
  extensions) — extension registrations per workspace.
- **API Mesh `mesh.json`** — sources, additional resolvers, transforms;
  one mesh per workspace.
- **I/O Runtime `manifest.yml`** if the project still uses the legacy
  format; sequences, triggers, rules.

## Env-var diff conventions for App Builder

- Non-sensitive: `AIO_RUNTIME_NAMESPACE`, `AIO_STATE_REGION`,
  `AIO_STATE_TIER`, `AIO_RUNTIME_APIHOST`.
- Sensitive (REDACTED): `AIO_RUNTIME_AUTH` (namespace bearer),
  `SERVICE_API_KEY` / IMS technical-account client secret,
  `AIO_IMS_CONTEXTS_<CTX>_CLIENT_SECRET`,
  I/O Events consumer webhook signing secrets.
- `.env.<workspace>` files typically hold both — the diff must resolve
  which values are workspace-scoped vs action-runtime-injected.

## Feature-flag state comparison

App Builder has no first-class flag system; flags are typically
encoded as:

- **Runtime action `default` params** in `app.config.yaml` — per-action
  `inputs:` map. Diff the effective inputs per workspace.
- **State SDK value flags** — action-side reads `stateClient.get('feature-x')`.
  Diff by dumping the State SDK namespace per workspace (requires
  `aio app state` or SDK call).
- **API Mesh resolver enable/disable** — `enabled: true/false` on
  additional resolvers.
- **Extension manifest enable/disable** per extension point.

Example `--env stage --to-env prod` presentation:

> `commerce-catalog-sync.inputs.batchSize` — Stage `50`, Prod `10`.
> Owner: integration-team. Note: intentional throttle in Prod.

## Secret-rotation diff (redacted)

- **IMS technical-account client secret** — rotation via Developer
  Console; SLA typically 90d.
- **I/O Runtime namespace bearer** (`AIO_RUNTIME_AUTH`) — rotates
  when the namespace is regenerated in the console; SLA 180d.
- **I/O Events webhook signing secrets** — 90d SLA.
- **Downstream integration API keys** — per integration; enumerate.

Row shape: `<REDACTED — last rotated 2026-08-01, SLA 90d, status fresh>`.
Never emit `AIO_RUNTIME_AUTH` — it grants full namespace write access.

## Infrastructure diffs for App Builder

- **Runtime namespace tier** — free / paid / dedicated per workspace;
  concurrency and cold-start behavior differ per tier.
- **Action concurrency limit** — per-action `limits.concurrency`
  setting.
- **State SDK size** — key-count and total-bytes quota per workspace;
  Prod typically higher.
- **I/O Events topic partitioning** — provider-level throughput;
  differs by IMS-org/workspace pairing.
- **API Mesh tier** — request-per-minute cap per workspace.
- **Action memory + timeout** — per-action `limits.memory` and
  `limits.timeout` settings.

## Risk assessment per diff category

- Config diffs: MEDIUM (action redeploy required for
  `app.config.yaml` changes).
- Env-var diffs: LOW (non-secret) / HIGH (any IMS or runtime bearer).
- Feature-flag diffs: HIGH (action-input flip = behavior change).
- Secret rotation gaps: CRITICAL for IMS technical account past SLA —
  downstream Adobe API calls fail hard.
- Infrastructure diffs: MEDIUM-HIGH (tier mismatches cause throttling
  under production load).

## 2 worked env-diff examples for App Builder

**Stage → Prod, v2.5.0 catalog-sync rollout.** 3 `app.config.yaml`
deltas (2 intended: new `catalog-sync` action + sequence; 1 orphan:
`debug-dump` action still present in Stage), 4 `.env.<workspace>`
deltas (2 intended new IMS scopes; 1 misconfiguration:
`AIO_RUNTIME_AUTH` present in `.env.prod` committed to VCS — CRITICAL,
must remove and rotate), 1 mesh delta (new `loyalty` resolver in
Stage only — intended), 1 secret gap (IMS technical-account client
secret rotated in Stage 2026-06-01, Prod 2026-01-01 — 220d overdue
against 90d SLA), infrastructure: identical tier. **Critical
action:** rotate `AIO_RUNTIME_AUTH` (bearer was leaked to VCS),
rotate IMS technical account in Prod, remove `debug-dump` action
before promoting.

**Stage → Prod, I/O Events consumer tune.** 0 `app.config.yaml`
deltas at the top level, 2 action-limit deltas
(`orders-consumer.limits.concurrency=20` in Stage vs `5` in Prod —
target of the release), 1 State SDK size delta (Prod
`state.maxKeys=10000` vs Stage `1000` — intentional). **Critical
action:** confirm Prod State SDK quota headroom before deploy.

## Anti-patterns to avoid for App Builder

- **Printing `AIO_RUNTIME_AUTH` or IMS client secrets** — always
  REDACT and flag any occurrence in VCS-tracked files as CRITICAL.
- **Diffing `dist/` or `web-src/dist/` build artifacts** — those are
  produced per deploy and should not be compared.
- **Ignoring `.env.<workspace>` files that were accidentally committed**
  — surface a CRITICAL misconfiguration finding for any `.env.*`
  containing secret material found under version control.
- **Comparing action deploy timestamps** — those legitimately differ
  per deploy; compare action code hash instead if the mesh reports it.
- **Skipping I/O Events provider registrations** — a provider
  registered in Stage but not Prod means event fan-out simply doesn't
  happen; easy to miss.

---

Generate the full env-diff report using `templates/env-diff.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
