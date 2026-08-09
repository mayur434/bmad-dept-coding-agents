# Env-diff authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an env-diff for an AEM as a Cloud Service
(AEMaaCS) or AEM Managed Services (AMS) project. Combine with
`templates/env-diff.md` as the master skeleton.

## Purpose framing

An AEM env-diff catches the drift that Cloud Manager cannot: OSGi
run-mode configs that were edited in Stage but never promoted, dispatcher
farms and filter includes that diverge between publish tiers, Cloud
Manager environment variables added out-of-band, and secret rotations
that only landed in one env. It should also flag capacity gaps between
the Author/Publish/Dispatcher sizing on Stage vs Prod that will surface
as latency the moment the release lands.

## Config-file diff scope for AEM

Diff every file the LLM can resolve under the project tree, keyed by
run mode:

- **OSGi `.config` files** under
  `ui.config/src/main/content/jcr_root/apps/<project>/osgiconfig/config.<env>/`
  and any `config.<mode>` runmode folder — one diff block per PID.
- **Dispatcher farms** `dispatcher/src/conf.dispatcher.d/farms/*.any`
  per env-scoped include.
- **Dispatcher filters** `dispatcher/src/conf.dispatcher.d/filters/*.any`
  and any `conf.dispatcher.d/available_filters/` overlay.
- **Cloud Manager env config** — `jvm.opts` fragments, dispatcher-mods
  bundled into the pipeline variables, and CM env-vars (via the
  Cloud Manager API export).
- **`com.day.crx.security.token.impl.impl.TokenAuthenticationHandler`**
  and other `com.day.crx.security.*` OSGi factory configs.
- **CDN / Fastly VCL snippets** referenced from `dispatcher.any` when
  the project uses Fastly in front of AEMaaCS.
- **Content Fragment model JSON** under `ui.content/.../models` when a
  release includes CF schema changes.

## Env-var diff conventions for AEM

- Non-sensitive: `AEM_PROXY_HOST`, `AEM_RUNMODE_*`, `SLING_OPTS`,
  `AEM_HTTP_PORT`, `CM_MAX_HEAP` (JVM sizing via CM env vars).
- Sensitive (must appear REDACTED): `CM_SECRET_*` — any Cloud Manager
  env var declared as `secret` type. Never print the value; print
  presence, type (`secret` vs `env`), and last-modified date.
- Flag mismatches when Stage has an env var Prod is missing (or vice
  versa) — this is the most common cause of prod-only regressions.

## Feature-flag state comparison

AEM uses OSGi component configuration as the primary flag mechanism —
no external LaunchDarkly client is typical (though projects sometimes
add one for consumer-side flags).

- **OSGi component-enabled flag** via `.config` — the diff shows
  `enabled=true` in Stage vs `enabled=false` in Prod, per PID.
- **Runmode-scoped config** — the diff must resolve the *effective*
  config per env (author.stage vs publish.prod) and compare, not the
  raw file names.
- **Editable-template policies** under
  `ui.content/.../conf/<project>/settings/wcm/policies` — flag-shaped
  when a policy enables/disables a component category per env.
- **Cloud Manager custom event handler enable/disable** counts as a
  build-time flag; call it out.

Example `--env stage --to-env prod` presentation:

> `com.example.loyalty.LoyaltyServlet` — Stage `enabled=true`, Prod
> `enabled=false`. Owner: growth-team. Note: intended for release.

## Secret-rotation diff (redacted)

Values MUST NEVER appear in the diff — only presence, type, and
rotation age.

- **`com.day.crx.security.*` keys** — auth handlers, IMS creds, service
  user credentials.
- **Cloud Manager `CM_SECRET_*`** — every secret-typed env var.
- **Adobe IMS technical account** JWT keys used by AEM-to-Adobe
  integrations.
- **Fastly API tokens** referenced from CM pipeline variables when
  Fastly fronts the dispatcher.

Row shape: `<REDACTED — last rotated 2026-08-01, SLA 90d, status fresh>`.

## Infrastructure diffs for AEM

- **Publish instance count** — CM environment tier (Small/Medium/Large)
  translates to a fixed count per tier; call out tier mismatches.
- **Dispatcher farm count** — how many dispatcher instances front
  Publish; capacity gap if Prod has fewer than Stage load-tests assume.
- **CDN cache TTL** — `head.html` cache-control + Fastly TTL per
  content type; drift causes cache-behavior surprises.
- **Author heap** (CM env var / JVM opts) — Author OOMs under editor
  load if Prod is under-provisioned vs Stage.
- **Publish heap** — same, sized against traffic RPS.
- **DAM storage tier** — CM asset compute pool; different tier means
  different asset-processing throughput.

## Risk assessment per diff category

- Config diffs: MEDIUM (functional change; OSGi restart in-place).
- Env-var diffs: LOW (non-secret) / HIGH (secret-typed).
- Feature-flag diffs: HIGH (behavioral change without a code deploy).
- Secret rotation gaps: CRITICAL if any secret is past its 90d SLA in
  Prod but rotated in Stage.
- Infrastructure diffs: MEDIUM-HIGH (capacity mismatch = latency + OOM
  risk in production).

## 2 worked env-diff examples for AEM

**Stage → Prod, v2.5.0 loyalty release.** 4 OSGi config deltas
(3 intended for release, 1 orphan — `LoggingConfig.stage-only` that
should not promote), 2 dispatcher filter deltas (both intended), 1
Cloud Manager env-var added in Stage but missing in Prod
(`LOYALTY_FEATURE_TIER=gold`), 1 secret rotation gap (IMS technical
account rotated in Stage 2026-07-01, Prod still 2026-04-01 — 121d
overdue against 90d SLA), infrastructure: Prod = Large tier, Stage =
Medium tier (intended). **Critical action:** rotate IMS technical
account in Prod before promoting; strip `LoggingConfig.stage-only`
from the promotion.

**Stage → Prod, dispatcher-hotfix env-diff.** 0 OSGi deltas, 3
dispatcher filter deltas (1 new rule intended for the hotfix, 2 legacy
`/etc/designs.*` filters that exist in Stage but not Prod — indicates
a prior Prod cleanup Stage never received), 0 secret deltas, 0 infra
deltas. **Critical action:** decide whether the legacy filters
should be pushed to Prod or removed from Stage before ship.

## Anti-patterns to avoid for AEM

- **Printing raw secret values** anywhere in the diff — always redact
  and show only rotation age.
- **Diffing `ui.apps/.../install/*.jar`** — bundle jars should be
  byte-identical on the same code deploy; diffs here indicate a build
  contamination, not an env drift.
- **Comparing raw runmode file paths** instead of the resolved effective
  config per env — a `.author.dev.config` and a `.author.prod.config`
  are supposed to differ; the diff should show the effective delta.
- **Ignoring dispatcher `available_filters/` overlays** — these silently
  compose into the effective filter chain and drift is common.
- **Reporting Cloud Manager tier as a drift** when the environments are
  intentionally sized differently — flag it once as expected, then move
  on.

---

Generate the full env-diff report using `templates/env-diff.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
