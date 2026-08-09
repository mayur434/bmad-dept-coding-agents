# Announcement authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a multi-channel release announcement for an AEM
project. Combine with `templates/announcement.md` as the master skeleton.

## Purpose framing

AEM announcements land in front of **three very different audiences at
once**: content authors and editorial leads (who care about "what changed
in Sidekick, what new components can I drop on a page"), Cloud Manager
release managers and dispatcher-ops (who care about pipeline runs and
cache invalidations), and business stakeholders on Marketing/Digital
(who care about the customer-facing feature and the go-live date). What
makes AEM unique: the primary audience is often *editorial*, not
engineering — the announcement is the trigger for authoring to start,
not just for engineering to celebrate.

## Audience segmentation for AEM

- **Content authors + editorial team** *(primary)* — what changed in the
  author UI, what new components/templates are available, what existing
  pages will look different after publish.
- **Tech leads / bundle developers** — OSGi/Sling contract changes,
  `resourceType` renames, AEM SDK version bumps.
- **Dispatcher-admin / ops** — dispatcher farm or filter changes, CDN
  rule tightening, cache-warmup expectations.
- **Cloud Manager release manager** — pipeline re-run required? new
  quality-gate thresholds? new custom event handlers?
- **Business stakeholders** — feature availability, campaign readiness,
  authoring-team readiness for launch.

## Channel-by-channel guidance for AEM

### Email announcement (long-form)

- **Subject line pattern:** `[AEM Release] v{{version}} — {{one-line-feature}}`
  (e.g. `[AEM Release] v2.5.0 — Loyalty landing pages + Sidekick block`).
- **Body sections:** what/why/when + author-impact ("new blocks in
  Sidekick under Loyalty") + engineering-impact (OSGi contract deltas) +
  dispatcher/CDN impact + action-required + Cloud Manager execution
  link.
- **CC/To conventions:** primary To = `aem-releases@`, CC =
  content-team leads, dispatcher-ops distribution list, and product
  owner for the campaign. Add editorial team explicitly when a new
  component ships. <!-- verify: your DL names -->
- **Attachment/link conventions:** Cloud Manager execution URL,
  RELEASE_NOTES.md link, Confluence page link, Sidekick preview URL
  when a new authorable component ships.

### Slack announcement (short-form)

- **Channel routing:** `#aem-releases` (primary) + `#content-team` when
  editorial-facing + `#dispatcher-ops` when farm/filter changes ship +
  `#incidents-aem` for hotfixes.
- **Emoji convention:** :rocket: launches, :hammer_and_wrench: breaking,
  :rotating_light: security, :page_facing_up: content-only, :package:
  package-order-sensitive deploy.
- **Threading:** post the two-line release summary at top; drop the
  Cloud Manager execution ID, dispatcher flush commands, and
  known-issues links into the thread — keeps the top clean for readers.
- **Pin:** pin release-day post and any rollback comms. Unpin after the
  next release ships.

### Confluence page (documentation-first)

- **Space + location:** typically `AEM Platform` space → `Releases`
  child page → `v{{version}}`. <!-- verify: your team's Confluence
  structure -->
- **Long-form sections:** release scope, feature deep-dive with
  **author-UI screenshots** (Sidekick, editable template preview, new
  component dialog), OSGi/API changelog, dispatcher rule changelog, CDN
  changes, Cloud Manager pipeline changes, migration groovy scripts +
  who runs them, known issues.
- **Label conventions:** `aem`, `release`, `v{{version}}`,
  plus one of `code-only` / `content-code` / `content-only` /
  `dispatcher-only` and one of `authoring-impact` / `no-authoring-impact`.

### Twitter / LinkedIn (external-facing)

- **Use when:** consumer-facing feature launches (new landing-page
  templates for a campaign, new customer-touching component). Skip for
  dispatcher-only, OSGi refactors, or internal editorial-tooling
  changes.
- **Character budget:** Twitter/X ~280; LinkedIn 3000 with rich media
  (component preview screenshot works well).
- **Hashtag convention:** `#AdobeExperienceManager #AEM
  #DigitalExperience`. Skip `#CloudManager` — internal ops audience.

## Stakeholder-tone matrix for AEM

| Audience | Email | Slack | Confluence | External |
|---|---|---|---|---|
| Content authors | "new blocks in Sidekick" + dialog preview | :page_facing_up: post in `#content-team` | Step-by-step new-block authoring guide + screenshots | — (usually internal) |
| Tech leads | OSGi/Sling contract deltas + deprecation windows | :hammer_and_wrench: in `#aem-releases` thread | API changelog + migration groovy scripts | — |
| Dispatcher ops | Rule/filter deltas + flush commands + CDN key changes | Pinned in `#dispatcher-ops` | Rule changelog + flush runbook | — |
| Release manager | Cloud Manager execution ID + quality-gate results | Top-line in `#aem-releases` | Pipeline changelog + gate overrides | — |
| Marketing / stakeholders | Feature availability + go-live date | Executive channel one-liner | Business-outcome section at top | Campaign-launch post |

## What to skip / redact per AEM

- Do NOT publish dispatcher config internals (filter regex, farm ACL
  rules) in external channels — keep those in Confluence + `#dispatcher-ops`.
- Do NOT publish Cloud Manager env-var names or values externally —
  internal-only.
- Do NOT publish IMS technical-account or service-user credentials
  ever — even names of specific service users belong in restricted
  Confluence pages.
- Do NOT publish JCR content paths that expose internal `/conf`
  structure externally.
- Do NOT dump raw commit SHAs externally — link to Cloud Manager
  execution instead.

## Sensitivity classification for AEM

- **Editorial-team update** (new component, new template) → Internal
  (`#content-team` + email to editorial DL).
- **Author UI change** (dialog restructure, sidekick change) → Internal
  with authoring-team walk-through.
- **Dispatcher change** → Internal (`#dispatcher-ops` + Confluence);
  never external.
- **Publish/consumer-facing change** (new page component visible to
  end-users) → Public; external post appropriate when campaign-aligned.
- **Security patch** → Restricted internal until CVE-window elapses,
  then Confluence + `#aem-releases`.

## 3 worked announcement examples for AEM

1. **Major feature launch — Loyalty landing pages (v2.5.0).**
   Email to `aem-releases@` + `content-team-leads@` — subject `[AEM
   Release] v2.5.0 — Loyalty landing pages live in Sidekick`. Body:
   what/why + 3 new components in Sidekick + editable template
   `templates/loyalty-page` + Cloud Manager execution `1234567` link.
   Slack `#aem-releases` :rocket: post + pinned + `#content-team`
   :page_facing_up: cross-post with Sidekick screenshot in thread.
   Confluence long-form with author walk-through + business-outcome
   section. LinkedIn post from marketing linking to the campaign
   landing page.

2. **Breaking change — resourceType rename (v2.6.0).** Email
   `[AEM Release] v2.6.0 — BREAKING: hero-banner resourceType rename +
   migration groovy required`. Slack pinned in `#aem-releases` +
   `#content-team` with 30-day pre-notice thread. Confluence
   long-form migration guide with the groovy script inline + author
   sign-off checklist. **No external post.**

3. **Hotfix / dispatcher security patch (v2.5.1).** Slack-first
   `#aem-releases` + `#dispatcher-ops` + `#incidents-aem`
   :rotating_light: with hotfix summary + dispatcher flush commands +
   Cloud Manager execution link. Email follow-up 60 minutes later
   after ship confirmed. No Confluence until post-mortem lands. **No
   external post** (security patch — CVE embargo window applies).

## Anti-patterns to avoid for AEM

- Don't dump raw commit history into an external channel.
- Don't announce dispatcher changes only in email — content team
  will miss it; always cross-post to `#content-team` if the change
  affects authoring behavior.
- Don't announce a new component without a Sidekick screenshot or
  preview URL — authoring team cannot act on a name alone.
- Don't skip the Cloud Manager execution ID — ops team can't correlate
  the release to quality-gate results.
- Don't announce OSGi contract changes without a deprecation window
  called out — downstream bundle owners deserve a 30-day heads-up.

---

Generate the full announcement using `templates/announcement.md` as
the master, populating placeholders with stack-appropriate content
from the guide above.
