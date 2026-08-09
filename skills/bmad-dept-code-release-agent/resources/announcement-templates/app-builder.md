# Announcement authoring guide — Adobe App Builder

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a multi-channel release announcement for an
Adobe App Builder project (I/O Runtime actions, API Mesh, Commerce UI
Extensibility, AEM UI Extensibility). Combine with
`templates/announcement.md` as the master skeleton.

## Purpose framing

App Builder announcements are for **extension consumers** — the Adobe
product surfaces (Commerce admin, AEM authoring, Analytics, Workfront)
that host your extension — and for **Adobe I/O ops teams** who own the
I/O Events pipeline, workspace state, and IMS integrations. Because
App Builder actions are surfaces layered on top of Adobe products, the
audience often overlaps with the host-product's audience: an AEM UI
Extension release lands with AEM authors, a Commerce Admin extension
lands with merchants. What makes this stack unique: **workspace
promotion is the deploy model** (stage workspace → prod workspace) and
I/O Event schema changes ripple to any downstream event consumer.

## Audience segmentation for App Builder

- **Extension consumers / host-product users** *(primary)* — Commerce
  admins, AEM authors, Analytics users — depending on which host
  product the extension attaches to.
- **Adobe I/O ops** — I/O Event provider registrations, event schema
  changes, IMS client rotations, workspace state.
- **Extension developers** — SDK version bumps (`@adobe/aio-sdk`,
  `@adobe/uix-*`), action-runtime version pin, API Mesh resolver code.
- **Downstream event consumers** — services subscribing to I/O Events
  emitted by your extension.
- **Adobe partner ecosystem** — when the extension is published to
  Adobe Exchange or shared across customers.

## Channel-by-channel guidance for App Builder

### Email announcement (long-form)

- **Subject line pattern:** `[App Builder / {{ext}}] v{{version}} —
  {{host}} extension + {{feature}}` (e.g. `[App Builder /
  loyalty-admin] v2.5.0 — Commerce admin extension + I/O Events
  schema v2`).
- **Body sections:** what/why/when + host-product user impact +
  workspace promotion status (stage → prod) + I/O Event schema deltas
  + SDK version bumps + IMS scope changes + rollback via workspace
  revert.
- **CC/To:** primary To = `app-builder-releases@`; CC =
  `{{host-product}}-{{audience}}@` (merchants for Commerce,
  authors for AEM), `io-ops@`, `event-consumers-{{ext}}@` when event
  schema changes.
- **Attachment/link conventions:** Adobe Developer Console workspace
  URL, I/O Event schema diff, PR link, extension surface screenshot.

### Slack announcement (short-form)

- **Channel routing:** `#app-builder-releases` (primary) +
  `#{{host-product}}-users` for host-audience cross-post (`#commerce-admins`
  or `#aem-authors`) + `#io-ops` for event/workspace changes +
  `#event-consumers` for event schema changes.
- **Emoji convention:** :jigsaw: extension surface change, :satellite:
  I/O Events schema, :closed_lock_with_key: IMS scope change,
  :hammer_and_wrench: breaking, :rotating_light: security,
  :arrows_counterclockwise: workspace promotion.
- **Threading:** top message = one-line release + host product +
  workspace status; drop event schema diff, IMS scope list, and SDK
  version matrix in thread.
- **Pin:** pin workspace-promotion post through post-deploy verify;
  pin I/O Event schema-change post through consumer adoption window.

### Confluence page (documentation-first)

- **Space + location:** `App Builder Extensions` space → `{{ext-name}}`
  → `Releases` → `v{{version}}`. <!-- verify: your team's Confluence
  structure -->
- **Long-form sections:** release scope, host-product surface
  screenshots (Commerce admin panel, AEM authoring shell) with
  before/after, I/O Event schema changelog, action-sequence changes,
  API Mesh resolver changes (if any), SDK version matrix, IMS scope
  changelog, workspace-promotion runbook, rollback playbook.
- **Label conventions:** `app-builder`, `{{host-product}}`, `release`,
  `v{{version}}`, plus one of `ui-extension` / `io-events-only` /
  `api-mesh-only` / `mixed` and one of `event-schema-change` /
  `no-event-schema-change`.

### Twitter / LinkedIn (external-facing)

- **Use when:** extension is published to Adobe Exchange or launched as
  a public partner offering. Skip for internal-customer extensions and
  internal SDK bumps.
- **Character budget:** Twitter ~280, LinkedIn 3000 with rich media
  (host-surface screenshot).
- **Hashtag convention:** `#AdobeAppBuilder #AdobeIO #AdobeExchange`
  when Exchange-published; skip when internal.

## Stakeholder-tone matrix for App Builder

| Audience | Email | Slack | Confluence | External |
|---|---|---|---|---|
| Host-product users | Extension surface changes + screenshots | `#{{host-product}}-users` :jigsaw: | Surface walk-through with before/after | Rare (Exchange launch) |
| Adobe I/O ops | Workspace promotion + event/IMS changes | `#io-ops` :satellite: | Workspace runbook + IMS scope list | — |
| Extension developers | SDK version matrix + action changes | `#app-builder-releases` thread | SDK matrix + code examples | — |
| Event consumers | Event schema diff + deprecation timeline | `#event-consumers` :hammer_and_wrench: | Event schema changelog | — |
| Adobe partners | Exchange listing update | — | Public docs | Exchange listing post |

## What to skip / redact per App Builder

- Do NOT publish I/O secrets, IMS client secrets, or runtime
  namespace credentials externally — ever.
- Do NOT publish workspace namespace names externally (they reveal
  Developer Console org structure).
- Do NOT publish API Mesh endpoint URLs externally.
- Do NOT publish I/O Event provider registration IDs externally.
- Do NOT publish action-invocation URLs (I/O Runtime endpoints) —
  those are protected endpoints.
- Do NOT publish IMS technical-account emails externally.

## Sensitivity classification for App Builder

- **UI-extension surface change** → Host-audience-facing (Commerce
  admins, AEM authors) — internal.
- **I/O Event schema additive** → Internal + event consumers.
- **I/O Event schema breaking** → Restricted-audience, 30-day
  deprecation notice required.
- **IMS scope change** → I/O-ops restricted (`#io-ops` only).
- **API Mesh resolver change** → Dev-internal.
- **Exchange-published launch** → Public appropriate.
- **Security patch** → Restricted internal until CVE-window elapses.

## 3 worked announcement examples for App Builder

1. **Major feature launch — loyalty-admin Commerce UI extension (v2.5.0).**
   Email `[App Builder / loyalty-admin] v2.5.0 — Commerce admin
   extension live + I/O Events schema v2` to `app-builder-releases@` +
   `commerce-admins@` + `io-ops@`. Slack `#app-builder-releases`
   :jigsaw: pinned + `#commerce-admins` cross-post with admin
   screenshot + `#io-ops` :arrows_counterclockwise: with workspace
   promotion note. Confluence long-form with host-surface before/after.
   Exchange listing update if publicly published; otherwise no
   external post.

2. **Breaking change — I/O Events schema v2 (v2.6.0).**
   Email `[App Builder / loyalty-admin] v2.6.0 — BREAKING: I/O Events
   schema v2, downstream consumers must update`. T-30d pre-notice
   email to `event-consumers-loyalty@` + T-7d pinned Slack in
   `#event-consumers` + `#app-builder-releases`. Confluence migration
   guide with per-event field mapping. **No external post.**

3. **Hotfix / security patch (v2.5.1).**
   Slack-first `#app-builder-releases` + `#io-ops` :rotating_light:
   with hotfix summary + workspace hot-deploy status + rollback via
   workspace revert. Email `io-ops@` under CVE-embargo language. No
   Confluence until post-mortem. **No external post** during embargo.

## Anti-patterns to avoid for App Builder

- Don't announce an extension release only in `#app-builder-releases`
  — the host-product user channel (`#commerce-admins` /
  `#aem-authors`) is the primary audience.
- Don't announce I/O Event schema changes without the schema diff and
  a deprecation timeline — consumer services will break silently.
- Don't announce workspace promotion without naming stage-source and
  prod-target workspaces — I/O ops needs it explicit.
- Don't dump SDK version bumps without the compat matrix — extension
  developers cannot upgrade blindly.
- Don't announce IMS scope changes in a wide-audience channel — scope
  changes are restricted-audience by policy.
- Don't skip the host-surface screenshot — extension consumers cannot
  identify a UI change from a name alone.

---

Generate the full announcement using `templates/announcement.md` as
the master, populating placeholders with stack-appropriate content
from the guide above.
