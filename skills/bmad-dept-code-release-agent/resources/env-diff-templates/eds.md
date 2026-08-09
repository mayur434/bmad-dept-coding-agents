# Env-diff authoring guide — Edge Delivery Services (EDS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an env-diff for an Edge Delivery Services (EDS
/ Helix / Franklin) project. Combine with `templates/env-diff.md` as
the master skeleton.

## Purpose framing

An EDS env-diff catches the drift that lives outside the git repo —
sheet-based configuration in Google Docs / SharePoint that diverged
between preview and live, redirects and metadata sheets that only
updated in one env, `paths.json` mount changes, and Sidekick config
mismatches. Because EDS is edge-native and stateless, the env-diff's
main value is confirming the preview→live promotion boundary is
tight: what's in preview must match what's about to be live, or the
gap must be explicitly intended.

## Config-file diff scope for EDS

- **`paths.json`** — mount points and helix mappings; env-scoped only
  when the project maintains preview / live variants.
- **`helix-config.json`** (if present) — code / content owner + repo +
  content source per env.
- **`helix-query.yaml`** — indexer definitions; drift here changes
  what listing pages return.
- **`head.html`** — early scripts, meta tags, script preload rules;
  should be near-identical across envs.
- **`fstab.yaml`** — mountpoints from repo path → content source
  folder.
- **Sidekick config** (`sidekick.json` or the SharePoint Sidekick
  extension config) — plugin registrations, environment definitions.
- **Sheet-based config**: `redirects.xlsx` (or `.json` mirror),
  `metadata.xlsx`, `nav.xlsx`, `footer.xlsx`, and any project-specific
  config sheet — resolved via the helix admin API per env
  (preview / live).
- **`404.html` + `500.html`** overlays if the project customizes them.

## Env-var diff conventions for EDS

EDS has essentially no code-side env vars — the runtime is edge and
stateless. Diffable env-var surface:

- **Helix admin API defaults** referenced from CI (`HLX_ADMIN_TOKEN`
  if the project uses helix admin CLI in pipelines).
- **Deploy-time build env vars** for pipelines that regenerate the
  `head.html` or bundle blocks — typically empty; flag anything found.
- Any `HLX_*` config env var used by custom Helix workers.

If secrets (any secret) are found configured on the EDS side — flag
CRITICAL: EDS is edge-only and should not hold secret material.

## Feature-flag state comparison

- **Sheet-config values as flags** — a cell in `metadata.xlsx` or a
  project-specific `features.xlsx` sheet whose value gates a block or
  a script include. Diff the preview vs live sheet snapshot.
- **`head.html` conditional includes** — script includes gated by
  hostname or URL params; diff resolves the effective per-env include
  set.
- **Block registration in `paths.json` or block-level `.json`** —
  when a block is registered in preview but not live.
- **A/B experiment configuration** — helix experiment sheet with
  variation weights per env.

Example `--env preview --to-env live` presentation:

> `features.enableCommerceDropIns` (metadata sheet) — Preview `on`,
> Live `off`. Owner: platform-team. Note: awaiting content-team QA on
> live catalog before promoting.

## Secret-rotation diff (redacted)

Usually N/A for EDS itself — the edge runtime doesn't hold secret
material. If any secret is found in a config sheet or `head.html`,
flag CRITICAL: secret material has leaked to the edge and must be
rotated immediately.

For CI-side rotation:

- **Helix admin tokens** used by pipelines — 90d SLA typical.
- **SharePoint / Google Docs OAuth tokens** used by content sync — SLA
  per provider.

Row shape for CI-side:
`<REDACTED — last rotated 2026-08-01, SLA 90d, status fresh>`.

## Infrastructure diffs for EDS

- **Edge cache TTL** — `cache-control` headers on rendered pages per
  env; short TTL in preview vs long in live is expected.
- **Origin content bucket region** — Google Docs vs SharePoint region;
  should be identical.
- **Image-optimizer config** — helix media / image pipeline settings.
- **Redirect count** — a huge diff in redirects.xlsx row count is
  worth calling out.
- **Custom domain / CDN routing** — hostname mappings per env.
- **helix-query index count** — how many indices are being maintained.

## Risk assessment per diff category

- Config diffs: MEDIUM (sheet edits take effect on next preview /
  live invalidation).
- Env-var diffs: LOW (rare) / CRITICAL if secrets found on the edge.
- Feature-flag diffs: MEDIUM-HIGH (sheet-flip = content or block
  behavior change).
- Secret rotation gaps: CRITICAL if any secret is present on the edge.
- Infrastructure diffs: LOW-MEDIUM (edge cache TTL diffs are usually
  intentional).

## 2 worked env-diff examples for EDS

**Preview → Live, v2.5.0 nav restructure.** 2 sheet-config deltas
(preview `nav.xlsx` has 12 entries, live has 9 — target of the
release; 3 new nav items to promote), 1 `redirects.xlsx` delta
(48 new redirects added in preview, all intended), 0 `paths.json`
deltas, 0 secrets found (as expected), infrastructure: identical.
**Critical action:** none blocking; promote the nav + redirects
sheets via helix admin API.

**Preview → Live, block-registration cleanup.** 0 sheet-config
deltas, 3 `paths.json` deltas (2 blocks removed from live paths but
still in preview — intended cleanup, must decide preview promotion
timing), 1 `head.html` delta (preview loads a `debug.js` script
tag — CRITICAL, must strip before ship). **Critical action:** remove
`debug.js` from preview `head.html` before promoting to live.

## Anti-patterns to avoid for EDS

- **Printing any secret found on the edge** — REDACT and flag CRITICAL;
  secrets do not belong on EDS.
- **Comparing cache-busted asset URLs** — asset URLs differ per build
  by design; compare the source path, not the fingerprinted URL.
- **Diffing `.hlx` internal folders** or the helix admin's internal
  bookkeeping paths — not user-facing config.
- **Skipping the `head.html` diff** — `head.html` is the most impactful
  file on EDS; even a one-line script include changes every page.
- **Assuming sheet-based config doesn't drift** — Google Docs /
  SharePoint are the most common silent-drift surfaces because
  content editors can edit them out-of-band.

---

Generate the full env-diff report using `templates/env-diff.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
