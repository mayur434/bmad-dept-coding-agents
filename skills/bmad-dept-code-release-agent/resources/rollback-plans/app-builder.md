# Rollback-plan authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a rollback plan for an Adobe App Builder (I/O
Runtime + API Mesh + Commerce/AEM UI Extensibility) project. Combine
with `templates/rollback-plan.md` as the master skeleton.

## Purpose framing

An App Builder rollback plan establishes the action-error and I/O Event
delivery signals that force the call, the on-call authority who owns
the `aio app` redeploy, the exact revert path (workspace-scoped `aio
app undeploy` + previous package deploy, or workspace swap when
staging and production are separate namespaces), and the I/O Event
provider + downstream consumer comms that must fire before event
subscribers see gaps. Rollback is workspace-scoped — the wrong
`--workspace` on the revert command is the most common failure mode.

## Rollback triggers for App Builder — specific + quantified

- **Action error rate > 5%** for 10 min (Adobe I/O Runtime logs +
  Splunk / New Relic export).
- **Action cold-start p99 > 8s** for 10 min (indicates package-size
  regression or dep bloat).
- **I/O Event delivery lag > 5 min p95** — subscribers not receiving
  events on schedule.
- **I/O Event delivery failure rate > 2%** for 10 min.
- **API Mesh resolver 5xx > 1%** for 10 min.
- **Namespace quota exceeded** — Adobe I/O Runtime action-invocation
  or memory-second quota breach in the workspace.
- **Secret rotation verification FAILS** — action can't decrypt
  configured secret post-deploy (secret was updated but action can't
  reach the new value).
- **UI Extensibility extension load error** > 5% (Commerce / AEM host
  app failing to hydrate the extension).

## Decision authority for App Builder

- **Primary:** on-call SRE watching Adobe I/O Runtime metrics + Splunk.
- **Approver for revert:** tech lead — App Builder deploys are fast
  (< 3 min typically) so revert can proceed with a single approver.
- **Auto-rollback** — not native to App Builder; some teams wire a
  Adobe I/O Events health-check that triggers `aio app undeploy` +
  previous-package deploy via a CI job on breach. <!-- verify: no native automation -->
- **Escalation** — if trigger is Adobe-managed infrastructure
  (Runtime platform 5xx), escalate to Adobe support P1 in parallel.
- **Backup on-call** paged after 5 min if primary unreachable.

## Rollback steps for App Builder — numbered + timed

1. **Confirm workspace scope** — `aio config get` — the biggest
   revert-time failure is running `aio app deploy` against the wrong
   workspace; verify before every command.
2. **Undeploy failed release** — `aio app undeploy --workspace
   <production>` (< 1 min).
3. **Deploy previous package** — `aio app deploy --workspace
   <production>` from the previous git ref (checkout previous tag +
   `aio app deploy`) (2–5 min).
4. **Revert I/O Event provider registrations** (if the release touched
   provider config) — `aio app deploy` re-registers based on the
   current `app.config.yaml`; confirm provider IDs and event codes
   match the reverted spec (2 min).
5. **Revert workspace-level env / secret values** — `aio app config
   set -s --workspace <production>` for each secret that was rotated.
6. **Revert API Mesh** (if the release touched Mesh) — `aio api-mesh
   update <mesh.json>` at the previous config revision (3–5 min for
   mesh reconciliation).
7. **Verify actions responding** — `aio rt action invoke <ns/pkg/action>
   -r` for a representative action; confirm previous version behavior.
8. **Verify I/O Event delivery** — trigger a test event; confirm
   subscriber receives within expected latency.
9. **Notify** `#appbuilder-releases` + downstream event-consumer teams.

## Data reversibility flags for App Builder

Which changes CANNOT be safely rolled back — must be flagged in the plan:

- **I/O Event provider deletion** — deleted providers must be
  re-registered from scratch; subscribers lose their subscription and
  must re-subscribe.
- **State SDK keyspace changes** — key patterns changed in a release
  mean the reverted code cannot read state written by the failed code.
- **Adobe I/O Files namespace changes** — files uploaded during the
  failed window under new path conventions may be orphaned.
- **IMS OAuth client credential rotations** — new credentials
  invalidate the old ones; reverted code with old credentials fails
  IMS token exchange.
- **Runtime action namespace / package renames** — subscribers
  invoking by fully-qualified name break on revert unless renamed
  back.
- **API Mesh source removal** — removed source connectors must be
  re-added from source config.

**Guidance:** any provider / keyspace / credential / rename change →
CAB-lite approval + explicit revert path documented pre-ship; do NOT
auto-revert; forward-fix path typically safer.

## Stakeholder comms during rollback for App Builder

**Pre (moment of decision):** `#appbuilder-releases` + downstream
event-consumer channels — `[ROLLBACK IN PROGRESS] {{app}} v{{version}}
→ v{{previous}} — trigger: {{trigger}} — ETA {{eta}}`.

**During:** action redeploy status; I/O Event provider registration
confirmation; API Mesh reconciliation.

**Event subscribers:** page the maintainers of every subscribed event
consumer — they may see a delivery lag spike or dropped events during
the window and need to know it's release-related.

**Customer-facing:** typically internal-only unless the App Builder
app powers a customer-visible UI Extension (Commerce admin, AEM
Author).

**Post (all-clear):** `[ROLLBACK COMPLETE] {{app}} v{{previous_version}}
live — actions responding — event delivery lag {{value}}ms`.

## Post-rollback for App Builder

- **RCA within 24h**, blameless.
- **I/O Event delivery audit** — reconcile events emitted during the
  window vs delivered to subscribers; identify gaps and coordinate
  replay via Journaling API where possible.
- **State SDK integrity** — audit keys written during the window;
  determine whether any need re-encoding under the reverted schema.
- **Adobe I/O Files audit** — any files written during the window
  under new path patterns are catalogued for cleanup or
  re-registration.
- **Secret / credential state** — confirm all secrets in the workspace
  match the reverted-version expected set; document any credentials
  that had to be rolled forward (some IMS credentials cannot be
  reverted once issued).
- **API Mesh state** — confirm mesh config version matches the
  reverted app version.
- **Lessons-learned template** — see `templates/rollback-plan.md`
  §Lessons learned; fill during RCA.

## 2 worked rollback-plan examples for App Builder

**v1.4.0 — Commerce sync app, action error spike.** Trigger: action
error rate 7.1% at T+6 min post-deploy (threshold 5%/10min → early
fire). Decision: on-call SRE + tech lead on bridge, revert called at
T+9 min. Steps: workspace confirmed (`aio config get` → production
workspace verified), `aio app undeploy --workspace production` at
T+10, checkout previous tag + `aio app deploy` at T+11, deploy
complete at T+14, error rate back to 0.3% at T+16. Recovery: 10 min.
Post: RCA identified a missing null-check in a Commerce webhook
handler after a payload shape update; test coverage gap flagged.

**v1.5.0 — I/O Event provider rename, provider re-registration
required.** Trigger: I/O Event delivery failure rate 12% at T+15 min
— subscribers still bound to old provider ID couldn't receive events
from the renamed provider. Decision: on-call SRE flagged provider
rename as effectively irreversible for existing subscribers —
forward-fix approved instead of revert. Steps: hotfix v1.5.1
authored to register BOTH old and new provider IDs (backward
compatibility), `aio app deploy` at T+45, both providers live at
T+48, subscribers migrated to new ID over 2 weeks. Post: process
gap flagged — provider renames added to CAB checklist; two-release
migration pattern documented (v1 dual-register, v2 remove old).

## Anti-patterns to avoid for App Builder

- **Running `aio app deploy` against the wrong `--workspace`** — the
  single most common revert-time failure; verify workspace first.
- **Skipping I/O Event provider verification** — reverted code may
  reference the old provider ID; providers auto-recreate on deploy
  but subscribers lose events during the gap.
- **Forgetting API Mesh reconciliation** — mesh config version out of
  sync with app version leaves resolvers broken.
- **Reverting without checking State SDK schema** — reverted code
  cannot read state written by failed code.
- **Skipping event-subscriber comms** — subscribers see a delivery
  gap and open incident tickets thinking it's their bug.

---

Generate the full rollback plan using `templates/rollback-plan.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
