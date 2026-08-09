# Announcement authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a multi-channel release announcement for an
Apache Sling / Shaft (sling-12) project. Combine with
`templates/announcement.md` as the master skeleton.

## Purpose framing

Sling announcements are almost entirely **internal engineering
communication** — the audience is bundle consumers within your
department, OSGi ops teams who own the runtime, and integrators who
share SAM/MDM contracts. There is no "content author" or "merchant"
audience here; the reader is always technical. What makes this stack
unique: releases can require **OSGi restarts** (Feature Model
composition changes) or land as hot-swaps (single-bundle updates), and
the announcement must make that clear because it changes the deploy
window and the on-call posture.

## Audience segmentation for Sling

- **Bundle consumers** *(primary)* — other teams whose bundles import
  packages or consume services from yours; they care about API changes.
- **OSGi ops team** — Feature Model composition changes, `config.PID`
  changes, restart-required vs hot-swap classification.
- **Integrators (SAM/MDM contract owners)** — Shaft SAM/MDM contract
  changes that ripple to their bundles.
- **On-call / SRE** — restart timing, health-check gate names, expected
  bundle-refresh windows.
- **Platform / architecture leads** — deprecation cycles, package
  versioning (`export-package` version bumps), API-stability commitments.

## Channel-by-channel guidance for Sling

### Email announcement (long-form)

- **Subject line pattern:** `[Sling] v{{version}} — {{scope}}
  ({{restart|hot-swap}})` (e.g. `[Sling] v2.5.0 — SAM contract update
  (restart-required)`).
- **Body sections:** what/why/when + API changes (`export-package`
  version bumps) + PID/config changes + Feature Model composition
  deltas + restart-required flag + rollback via Feature Model revert +
  health-check gate names.
- **CC/To:** primary To = `sling-releases@`; CC = bundle-consumer team
  leads (per your dependency graph), `osgi-ops@`, `sam-mdm-integrators@`.
- **Attachment/link conventions:** Feature Model diff, `/system/console/bundles`
  post-deploy snapshot link (internal), PR link, health-check
  dashboard link.

### Slack announcement (short-form)

- **Channel routing:** `#sling-releases` (primary) + `#osgi-ops` for
  restart-required or PID changes + `#sam-mdm-integrators` for SAM/MDM
  contract changes + `#platform-arch` for API deprecation cycles.
- **Emoji convention:** :gear: bundle release, :arrows_counterclockwise:
  restart-required, :zap: hot-swap-only, :hammer_and_wrench: breaking
  API, :rotating_light: security, :package: Feature Model change.
- **Threading:** top message = one-line release + restart flag; drop
  the Feature Model diff, PID list, and bundle-consumer notice into
  the thread.
- **Pin:** pin restart-required posts through the restart window
  (usually T+2h for a Sling instance-pool rolling restart).

### Confluence page (documentation-first)

- **Space + location:** `Sling Platform` space → `Releases` →
  `v{{version}}`. <!-- verify: your team's Confluence structure -->
- **Long-form sections:** release scope, API changelog with
  `export-package` before/after versions, PID/config changelog, Feature
  Model composition deltas, restart-required matrix per instance pool,
  deprecation cycle status per removed API, health-check gate list,
  rollback playbook.
- **Label conventions:** `sling`, `release`, `v{{version}}`, plus one
  of `hot-swap` / `restart-required` / `feature-model-change` and one
  of `api-additive` / `api-breaking`.

### Twitter / LinkedIn (external-facing)

- **Skip.** Sling releases are almost never externally interesting.
  Only reach for LinkedIn when the release contains an open-source
  contribution back to Apache Sling, a public conference talk
  reference, or a customer-facing feature that happens to be
  Sling-implemented. Otherwise: internal-only.
- If used: `#ApacheSling` hashtag, no internal PID names.

## Stakeholder-tone matrix for Sling

| Audience | Email | Slack | Confluence | External |
|---|---|---|---|---|
| Bundle consumers | API changelog + upgrade snippets | `#sling-releases` :gear: | `export-package` version matrix + code examples | — |
| OSGi ops | Restart flag + PID changes + Feature Model | `#osgi-ops` :arrows_counterclockwise: pinned | Restart runbook + health-check gates | — |
| SAM/MDM integrators | Contract changes with impact call-out | `#sam-mdm-integrators` :hammer_and_wrench: | Contract changelog + integration test matrix | — |
| On-call / SRE | Health-check gates + restart window | `#osgi-ops` cross-post | Runbook link | — |
| Platform / arch | Deprecation cycle status | `#platform-arch` thread | ADR link + API-stability statement | Rare (open-source contrib) |

## What to skip / redact per Sling

- Do NOT publish SAM/MDM internal endpoint URLs, service-user names,
  or integration credentials externally — ever.
- Do NOT publish OSGi config values that contain secrets — always
  present as `<REDACTED>` in Slack/email.
- Do NOT publish internal PID naming conventions externally (they
  reveal service-topology internals).
- Do NOT publish `/system/console/*` URLs externally — those are
  admin surfaces.
- Do NOT dump full bundle-inventory snapshots to Confluence unless
  behind a restricted-audience page.

## Sensitivity classification for Sling

- **Hot-swap bundle update, additive API** → Internal (bundle
  consumers + `#sling-releases`).
- **Restart-required release** → Internal + `#osgi-ops` pinned; ops
  audience critical.
- **Breaking API change** → Internal, 30-day deprecation notice
  required; announce twice (30d pre + release day).
- **SAM/MDM contract change** → Integrator-restricted; internal only.
- **Security patch** → Restricted internal until CVE-window elapses;
  no external post.

## 3 worked announcement examples for Sling

1. **Major feature launch — SAM contract v2 (v2.5.0).**
   Email `[Sling] v2.5.0 — SAM contract v2 live (restart-required)`
   to `sling-releases@` + `sam-mdm-integrators@` + `osgi-ops@`. Slack
   `#sling-releases` :arrows_counterclockwise: pinned with restart
   window + `#sam-mdm-integrators` :hammer_and_wrench: with contract
   diff in thread + `#osgi-ops` restart runbook cross-post. Confluence
   long-form with `export-package` version matrix + Feature Model diff
   + health-check gates. **No external post.**

2. **Breaking change — deprecation cycle close (v2.6.0).**
   Email `[Sling] v2.6.0 — BREAKING: com.example.legacy.* removed
   (deprecation window closed)`. T-30d pre-notice email + T-7d pinned
   `#sling-releases` + `#platform-arch` reminder. Confluence migration
   guide with per-import replacement table. **No external post.**

3. **Hotfix / security patch (v2.5.1).**
   Slack-first `#sling-releases` + `#osgi-ops` :rotating_light: with
   hotfix summary + hot-swap-safe flag + rollback via bundle revert.
   Email to `sling-releases@` under CVE-embargo language. No Confluence
   until post-mortem. **No external post** during embargo.

## Anti-patterns to avoid for Sling

- Don't announce a restart-required release without a clear restart
  window in the top-line message — ops needs it front and center.
- Don't announce API breaking changes without the deprecation-cycle
  history — bundle consumers need context.
- Don't dump raw Feature Model XML into Slack — link to the diff, keep
  the top-line clean.
- Don't skip the `export-package` version matrix — bundle consumers
  read it as their upgrade guide.
- Don't announce SAM/MDM contract changes only in your team's channel
  — cross-post to `#sam-mdm-integrators` so the contract owners see it.

---

Generate the full announcement using `templates/announcement.md` as
the master, populating placeholders with stack-appropriate content
from the guide above.
