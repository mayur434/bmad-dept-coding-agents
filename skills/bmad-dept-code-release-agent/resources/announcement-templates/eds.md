# Announcement authoring guide — Edge Delivery Services (EDS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a multi-channel release announcement for an
Edge Delivery Services (EDS) project. Combine with
`templates/announcement.md` as the master skeleton.

## Purpose framing

EDS announcements land primarily in front of **content editors** who
work in Google Docs / SharePoint and preview via the Sidekick — the
authoring surface is the release's most visible face. Because EDS
deploys are git-based and near-instant (merge to `main` → edge worker
deploy), the announcement is often as much a "here's the new block
available in Sidekick" as it is a release note. What makes this stack
unique: **Web Vitals are the shipping contract** — every release must
speak to LCP/CLS/INP impact, and the announcement should include a
preview URL that editors can open in Google Docs immediately.

## Audience segmentation for EDS

- **Content editors / authoring team** *(primary)* — Sidekick plugin
  changes, new blocks available, Google Docs / SharePoint patterns to
  use.
- **Consumers / site visitors** — visible feature changes on the live
  site; Web Vitals shift.
- **Developers** — block-code changes, `paths.json`,
  `helix-query.yaml`, `head.html` changes.
- **SEO / Web-perf owners** — Web Vitals delta, structured-data
  changes, redirects.xlsx changes.
- **Analytics / RUM owners** — event schema, `dataLayer`, RUM signals.

## Channel-by-channel guidance for EDS

### Email announcement (long-form)

- **Subject line pattern:** `[EDS] v{{version}} — {{block-or-feature}}
  + Sidekick update` (e.g. `[EDS] v2.5.0 — Loyalty hero block live +
  Sidekick plugin update`).
- **Body sections:** what/why/when + **editor-facing changes** (new
  blocks in Sidekick, new Google Docs patterns, new Sidekick plugins)
  + consumer-facing changes + Web Vitals impact (LCP/CLS/INP baseline
  vs post-release target) + preview URL + rollback via `git revert`.
- **CC/To:** primary To = `eds-releases@` + `content-editors@`; CC =
  `seo-webperf@`, `analytics@` when RUM changes, `sidekick-users@`
  when plugin updates.
- **Attachment/link conventions:** preview branch URL, Sidekick
  plugin config link, Web Vitals dashboard link, example Google Doc
  URL showing the new block, PR link.

### Slack announcement (short-form)

- **Channel routing:** `#eds-releases` (primary) + `#content-editors`
  (always for block/plugin changes) + `#web-perf` for Web Vitals
  impact + `#seo` for structured-data / redirects changes +
  `#incidents-eds` for rollback.
- **Emoji convention:** :package: block release, :writing_hand:
  Sidekick plugin, :chart_with_upwards_trend: Web Vitals win,
  :chart_with_downwards_trend: Web Vitals regression, :leftwards_arrow_with_hook:
  redirects update, :hammer_and_wrench: breaking, :rotating_light:
  security.
- **Threading:** top message = one-line release + preview URL; drop
  Web Vitals numbers, block examples, and Sidekick plugin steps in
  thread.
- **Pin:** pin release-day post; keep pinned through T+24h Web Vitals
  verification.

### Confluence page (documentation-first)

- **Space + location:** `EDS Platform` space → `Releases` →
  `v{{version}}`. <!-- verify: your team's Confluence structure -->
- **Long-form sections:** release scope, new-block authoring guide
  with **Google Docs pattern screenshots** + **Sidekick plugin
  walk-through**, `paths.json` changes, `helix-query.yaml` changes,
  `head.html` changes, `redirects.xlsx` changes, Web Vitals baseline
  vs target, RUM event changes, rollback via `git revert` + preview
  branch URL.
- **Label conventions:** `eds`, `release`, `v{{version}}`, plus one
  of `block-launch` / `plugin-update` / `content-config-change` /
  `redirects-change` / `web-perf` and one of `web-vitals-neutral` /
  `web-vitals-win` / `web-vitals-regression`.

### Twitter / LinkedIn (external-facing)

- **Use when:** consumer-visible feature launch (new PDP layout, new
  landing template, new interactive block) or a public Web Vitals
  milestone worth celebrating.
- **Character budget:** Twitter ~280, LinkedIn 3000 with rich media
  (block preview screenshot or Web Vitals badge).
- **Hashtag convention:** `#EdgeDeliveryServices #EDS #WebPerf
  #CoreWebVitals`. Skip internal sheet or path references.

## Stakeholder-tone matrix for EDS

| Audience | Email | Slack | Confluence | External |
|---|---|---|---|---|
| Content editors | Sidekick/block section + Google Docs example URL | `#content-editors` :writing_hand: pinned | Step-by-step authoring guide with screenshots | — |
| Consumers | — | — | — | Public feature-launch post |
| Developers | Block/code changelog + `head.html` deltas | `#eds-releases` thread | PR-linked changelog | — |
| SEO / Web-perf | Web Vitals delta + redirects diff | `#web-perf` :chart_with_upwards_trend: | Web Vitals baseline + structured-data changelog | Rare (milestone) |
| Analytics | RUM/dataLayer changes | `#analytics` cross-post | Event schema changelog | — |

## What to skip / redact per EDS

- Do NOT publish sheet-config URLs (Google Docs/SharePoint URLs)
  externally — they are authoring surfaces.
- Do NOT publish internal preview branch URLs externally.
- Do NOT publish `helix-query.yaml` internals externally.
- Do NOT publish RUM ingestion endpoints or API keys externally.
- Do NOT publish redirect-source URLs that leak internal taxonomy
  externally.
- Do NOT publish authored-content-repo (git) internals externally
  beyond public-friendly PR links.

## Sensitivity classification for EDS

- **New block / Sidekick plugin** → Editor-facing internal
  (`#content-editors`).
- **Consumer-facing feature** → Public.
- **Web Vitals shift** → Internal + `#web-perf`; external only for
  celebrated milestones.
- **Redirects / structured-data change** → Internal + `#seo`; SEO
  impact requires visibility.
- **RUM/analytics event change** → Internal + `#analytics`
  (consumer of the event contract).
- **Security patch** → Restricted until fix ships (usually fast on
  git-based deploy) then internal-only.

## 3 worked announcement examples for EDS

1. **Major feature launch — Loyalty hero block (v2.5.0).**
   Email `[EDS] v2.5.0 — Loyalty hero block live in Sidekick + Google
   Doc pattern` to `eds-releases@` + `content-editors@` +
   `seo-webperf@`. Slack `#eds-releases` :package: pinned +
   `#content-editors` :writing_hand: with Google Doc example URL +
   Sidekick walk-through in thread. Confluence long-form with block
   author guide + Web Vitals impact (LCP -180ms). LinkedIn post if
   consumer-facing campaign; otherwise skip external.

2. **Breaking change — block variant migration required (v2.6.0).**
   Email `[EDS] v2.6.0 — BREAKING: hero-block variant renamed,
   editors must update Google Docs`. T-14d pre-notice email to
   `content-editors@` + T-2d pinned Slack in `#content-editors` +
   `#eds-releases` with per-page migration checklist. Confluence
   migration guide with before/after Google Doc screenshots +
   list of pages needing update. **No external post.**

3. **Hotfix / redirects security patch (v2.5.1).**
   Slack-first `#eds-releases` + `#seo` :rotating_light: with
   `redirects.xlsx` change summary + preview URL + rollback via `git
   revert` ready. Email `seo-webperf@` + `eds-releases@` follow-up.
   No Confluence unless post-mortem. **No external post.**

## Anti-patterns to avoid for EDS

- Don't announce a new block without a Google Doc example URL —
  editors cannot author from a name; they need the pattern.
- Don't announce block/plugin changes only in `#eds-releases` —
  content editors live in `#content-editors`; always cross-post.
- Don't announce a Web Vitals regression without the rollback plan
  and RUM link — SEO and web-perf owners need to act.
- Don't dump raw block-code changes to `#content-editors` — link the
  PR from `#eds-releases`, keep the editor channel about authoring.
- Don't skip the preview URL — reviewers cannot verify anything
  without it, and git-based deploy makes preview cheap.
- Don't announce a redirects change without the SEO impact
  assessment (301s, canonical shifts).

---

Generate the full announcement using `templates/announcement.md` as
the master, populating placeholders with stack-appropriate content
from the guide above.
