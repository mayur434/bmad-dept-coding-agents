# Release-notes authoring guide — Edge Delivery Services (EDS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating release notes for an Edge Delivery Services
(EDS) project. Combine with `templates/release-notes.md` as the master
skeleton.

## Purpose framing

EDS release notes are shaped by the git-driven, edge-worker delivery
model — every merge to `main` deploys to production edge; every branch
gets its own preview URL; rollback is `git revert`. Notes should
distinguish *block* changes (in the git repo) from *content* /
*config* changes (in the Google Docs / SharePoint / sheet layer that
authors control). Editorial should be able to read the notes without
looking at code; developers should be able to find the specific block
`.js` / `.css` diffs. Internal script refactors that don't touch a
block are usually not release-noteworthy.

## Change categories for EDS

- **Block additions / updates** — new blocks under `blocks/*/*.{js,css}`;
  changes to `scripts/scripts.js` decoration order.
- **Storefront-events schema changes** — event names, payload fields
  emitted from EDS blocks. (Not applicable to non-commerce EDS — see
  `eds-commerce.md`.)
- **Sidekick plugin changes** — additions to `tools/sidekick/config.json`;
  new plugin buttons in the author sidekick.
- **Edge config changes** — `paths.json`, `redirects.xlsx` (or
  equivalent), `head.html`, `helix-query.yaml`.
- **Head + performance changes** — `<link>` / `<script>` additions in
  `head.html`; LCP / CLS impact.
- **Fonts / icons / assets** — additions to `styles/fonts.css`,
  `icons/*.svg`, `styles/styles.css`.
- **Document / sheet-driven config** — new sheets consumed by
  `helix-query.yaml` or block-side fetch; author-side metadata sheet
  changes.
- **Preview / live promotion policy changes** — franklin/helix
  bulk-publish rules; `helix-config.yaml` origin changes.

## Commit-format conventions for EDS

- **Conventional Commits mapping:**
  - `feat(block|scripts|sidekick): …` → **New features**
  - `fix(block|helix-query|head): …` → **Fixes**
  - `perf(head|lcp|inp): …` → **Performance**
  - `refactor(scripts|utils): …` → **Refactoring**
  - `build(package|edge): …` → **CI / build changes**
  - `chore(deps|fmt): …` → skip
- **Escalate as BREAKING when any commit touches:**
  - Block name rename (existing author-side references break)
  - `head.html` change that adds a render-blocking script (LCP regression)
  - `paths.json` include rule removal (routes disappear)
  - `redirects.xlsx` rule removal (bookmark 404s)
  - Sidekick plugin ID change (author config resets)
  - Storefront-events field removal
  - `helix-query.yaml` index removal (block queries fail)
- **Skip in customer-facing notes:** `chore(fmt):` prettier /
  eslint-fix commits, `test:` playwright snapshot refreshes, `docs:`
  in-repo READMEs.

## Breaking changes for EDS

1. **Block rename.** Docs referring to old block name silently render
   as default section. *Mitigation:* alias in `scripts.js` for one
   release, then remove.
2. **Render-blocking script in `head.html`.** LCP regresses across the
   site. *Mitigation:* defer / async loading; measure via Lighthouse.
3. **`redirects.xlsx` rule removal.** Bookmarked URLs 404.
   *Mitigation:* 410 with clear message + SEO team notified.
4. **`helix-query.yaml` index removal.** Blocks that fetch the index
   break silently. *Mitigation:* block-side null-guard + fallback.
5. **`head.html` metadata change.** OG-image / Twitter-card previews
   break across social. *Mitigation:* smoke-test link previews.
6. **Sidekick plugin removal.** Authors lose a workflow shortcut.
   *Mitigation:* announce in the editorial channel + link migration.
7. **Storefront-events schema removal.** (Applies when EDS emits
   events downstream.) Analytics pipelines break.
8. **`paths.json` include-rule tightening.** Previously-published pages
   404 on `.live`. *Mitigation:* dry-run rule change on preview first.

## Upgrade notes for EDS

Guidance on what upgrade notes should include:

- **Edge deploy is automatic on merge to `main`** — no manual step.
- **Preview vs live** — merge to `main` promotes preview to live in
  seconds; use `.page` URLs for stakeholder review.
- **Sidekick plugin re-install** — usually automatic on next-load;
  call out if manual re-install is required (plugin ID change).
- **helix cache warm** — targeted warm command post-deploy for
  above-the-fold pages.
- **CDN purge** — via `hlx purge` or `helix-admin` API for cases where
  `head.html` changed and browser-cached HTML would linger.
- **Document / sheet source page** — link the Google Docs folder /
  SharePoint library that authoritatively drives configuration
  content.
- **Preview branch URL** — always include one preview URL for QA in
  the release notes.
- **Instant rollback** — `git revert <sha> && git push` restores in
  seconds; call out as the standard rollback path.

## Known issues for EDS

Typical known-issues to disclose:

- Sheet-driven config propagation ~10s from Google Docs save to
  edge-visible.
- `hlx purge` occasional 5xx during Adobe I/O incidents; retry.
- Sidekick "Publish" button greyed out for authors without the correct
  role on the Google Docs source.
- LCP regression window ~2s post-deploy while edge cache warms on
  cold routes.
- Chrome DevTools Lighthouse INP measurement varies ±30ms — use RUM as
  source of truth. <!-- verify: current INP variability -->

## Contributor + PR/ticket linking conventions

- **Jira project keys:** typically `EDS-####`, `FRK-####`, or
  customer-specific.
- **PR links:** GitHub `owner/eds-site#456`.
- **Preview URL:** always include the preview URL for the branch
  (`https://<branch>--<repo>--<owner>.hlx.page/…`) so QA can validate.
- **Google Docs / SharePoint source page** — link the source doc where
  sheet-driven config changed.
- **Sidekick config version** — cite the `tools/sidekick/config.json`
  version if changed.

## 3 worked release-notes examples for EDS

**v0.9.0 — Loyalty landing pages (2026-03-14).**
- **New:** `blocks/loyalty-hero`, `blocks/tier-comparison`; sidekick
  plugin "Insert Loyalty CTA" added.
- **Fixed:** Cards block image aspect ratio drift on Safari 17.2
  (Jira EDS-812).
- **Perf:** `head.html` deferred non-critical analytics — LCP -180ms
  on p75.
- **Upgrade:** merge to `main` auto-deploys; preview URL
  `https://loyalty--acme-eds--acme.hlx.page/loyalty` for QA sign-off;
  no manual step.
- **Known issue:** Sidekick plugin greyed for authors without the
  loyalty-team role on the source doc.

**v0.9.1 — Redirects hotfix (2026-03-19).**
- **Fixed:** `redirects.xlsx` rule for `/loyalty/legacy` restored
  (missing after v0.9.0 sheet cleanup) — SEO team ticket EDS-820.
- **Breaking:** `blocks/hero` block renamed to `blocks/loyalty-hero`
  for consistency. Legacy `blocks/hero` aliased through v0.9.5, then
  removed.
- **Upgrade:** merge triggers deploy; `hlx purge /loyalty/**` for
  browser-cached HTML.

**v1.0.0 — Head refresh + Sidekick v2 (2026-04-10).**
- **Breaking:** `head.html` rewritten — inlined critical CSS, deferred
  all `<script>` except analytics-consent. Consumers depending on
  a global JS from `head.html` re-source from `scripts.js`.
- **New:** Sidekick config v2 (`tools/sidekick/config.json`) with
  plugin `Insert Block` UI overhaul.
- **Upgrade:** Sidekick auto-updates on next author load; hard-refresh
  if plugin list appears stale. `helix cache warm` for top-20 pages.
- **Known issue:** LCP regression ~1s on first cold-cache hit
  post-deploy (recovers within 60s).

## Anti-patterns to avoid for EDS

- **Silent block renames.** Author docs referencing the old name
  render as unstyled sections; nobody notices until the marketing
  team ships a campaign page.
- **Render-blocking additions to `head.html`.** LCP regresses
  site-wide; RUM alerts fire hours later.
- **Missing preview URL.** QA has no branch to validate against
  before merge.
- **Undocumented `redirects.xlsx` removal.** SEO discovers via
  Search Console coverage reports days later.
- **Listing every `chore(fmt)` commit.** Editorial doesn't care;
  those belong in a developer changelog only.

---

Generate the full release notes using `templates/release-notes.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
