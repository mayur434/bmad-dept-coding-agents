# Postmortem authoring guide — Edge Delivery Services (EDS)

## Purpose framing

An EDS postmortem is a **blameless retrospective run after the sheet /
block / edge / preview-vs-live incident is resolved** — it closes the
loop from `playbook-templates/eds.md` back into `runbook-templates/eds.md`
and `slo-templates/eds.md`. Every SEV1 gets one within 5 business days;
SEV2 by decision (mandatory on repeat); SEV3 optional. Focus: what
broke in the git-backed edge-delivery pipeline (helix), why the RUM /
LCP / block-load signals didn't catch it earlier, and what we're
changing in the block library, sheet-governance, or edge-cache policy.

## Common failure modes for EDS

Recurring root-cause patterns, each with typical detection window:

- **Sheet-config bulk-update broke live pages** — author saved a `helix-config.xlsx` change that removed a required column; all pages using it 500. Detection: 5-15 min via block-load error rate.
- **Block-JS regression not caught in review** — new block dependency broke on a subset of pages. Detection: 5-30 min via RUM JS-error spike.
- **Sidekick plugin conflict** — plugin update collided with the site's block naming; authors couldn't preview. Detection: at first author-preview attempt.
- **Edge-cache invalidation storm** — bulk republish triggered global purge; origin overload for 10 min. Detection: 5-15 min via origin RPS.
- **Google Docs / SharePoint auth token expired** — source-sync stopped; edits stopped publishing. Detection: 5-30 min via publish-lag.
- **redirects.xlsx sync failure** — redirect table stale; 404s on migrated URLs. Detection: 15-60 min via 404-rate alert.
- **helix-preview vs helix-live diff regression** — preview OK, live broken (env-specific block behavior). Detection: only after author-publishes.
- **LCP regression from new image handling** — non-optimized image referenced from block; LCP tanks. Detection: 15-60 min via LCP p75 alert.
- **RUM sample-rate misconfigured** — no data to detect the incident; blind spot. Detection: at post-hoc review.

## Timeline capture patterns for EDS

- **Helix debug endpoint** — `admin.hlx.page/status` / `admin.hlx.page/preview` per-file status + timestamp; source of truth for preview vs live divergence. <!-- verify: current helix admin endpoints -->
- **Edge access log** — CDN request log with request-ID + block-name + timing; usually Cloudflare or Fastly.
- **RUM error timeline** — real-user JS error events with URL + block name + user-agent.
- **Git commit + PR history** — every edge deploy is a git commit; `git log` on the site repo is the deploy timeline.
- **Sheet audit** — Google Docs / SharePoint revision history on the impacted sheet (who edited when).
- **Sidekick console log** — plugin errors from the author's browser (attach screenshots).

Format: UTC timestamps, actor (author / developer / helix / edge), action, evidence link (git commit SHA, sheet revision link, RUM URL).

## Root-cause analysis methods for EDS

- **5-whys** — **most common for EDS**: single-edit blast radius is the norm; incidents typically resolve to a single missing lint / preview-diff / sheet-schema guard.
- **Fishbone (Ishikawa)** — for incidents spanning authoring, block-dev, and edge-cache.
- **Fault-tree** — rarely applicable; EDS security incidents are usually source-repo access, handled at git-forge level.
- **Chaos replay** — for edge-cache invalidation-storm incidents; reproduce with synthetic bulk republish.

EDS leans **5-whys** — the git-backed model means most incidents map to a single commit or sheet edit.

## Contributing-factor taxonomy for EDS

- **Technical debt** — known-open backlog (e.g. `EDS-142: sheet-schema linter overdue`).
- **Process gap** — missing runbook, missing preview-required gate before author-publish, missing block-load-test coverage.
- **Human error** — author bulk-edited a sheet without preview; framed blamelessly (Sidekick didn't warn about the schema break).
- **External dependency** — Google Docs / SharePoint auth outage, helix platform outage, CDN provider issue.
- **Config drift** — helix-config.xlsx per-branch divergence; cross-reference `env-diff-templates/eds.md`.

## What-went-well template for EDS

- Git revert deployed to edge in < 60s.
- RUM captured all affected users (100% sample-rate on the impacted block).
- Sidekick alert triggered on the author's screen within 30s of the broken publish.
- Edge cache absorbed origin failure for 8 min before hit-ratio decayed.
- Preview-vs-live diff caught 2 unrelated regressions on the retry publish.
- Author community responded quickly in `#eds-authoring` channel.

## Action-item taxonomy for EDS

- **Prevention** — root-cause fix in block code (defensive rendering), sheet-schema linter, or Sidekick pre-publish gate.
- **Detection** — new RUM error-rate alert per block, new dashboard tile for helix-preview lag, tighter LCP SLO.
- **Response** — runbook update, playbook update, author training on preview-first workflow.
- **Communication** — comms template update, author-community notification for site-wide-visible incidents.

Per action item: owner + due-date + priority (P0 within week; P1 within month; P2 within quarter) + tracking-ticket-id.

## Blameless-language enforcement for EDS

- REJECT "the author broke the sheet" → REPLACE "the sheet editor accepted a required-column removal without preview; adding schema-lock on required columns".
- REJECT "the developer forgot to test the block" → REPLACE "the block-library CI didn't run per-block visual regression; adding it".
- REJECT "the redirects sheet was stale" → REPLACE "the redirects-sync automation didn't alert on sync failure; adding a sync-failure alert".

## Stakeholder review process for EDS

- **Author:** incident commander from the playbook run.
- **Reviewers:** SRE lead + EDS tech lead + content lead (if authoring workflow involved).
- **Approvers:** engineering manager (SEV1: + director; SEV1 with SEO impact: + marketing).
- **Publication:** internal wiki + `#eds-oncall`; author-community notification for site-wide-visible SEV1; status page for outage.
- **Adobe cross-file:** if helix platform contributed, attach summary to Adobe Support / helix-admin ticket.

## 2 worked postmortem examples for EDS

### Example 1 — Sheet-config bulk-update broke 40% of pages (SEV1, 18 min)

Severity SEV1. Duration 18 min. Blast radius: ~40% of live pages returned partial-render for 18 min; ~85k affected sessions; LCP p75 spiked to 4.2s. Root cause (5-whys): pages using `promo-block` failed → block reads column `cta_url` → author bulk-edit removed the column → sheet editor didn't warn → block didn't defensively handle missing column → sheet-schema linter didn't exist. Action items: (P0) block defensive-render fallback (owner @block-lead, due +1w); (P0) sheet-schema linter for required columns (owner @dev-lead, due +1w); (P1) author preview-required workflow (owner @content-lead, due +2w). Well: git revert in 45s; RUM captured full affected-user set.

### Example 2 — LCP regression from block image handler (SEV2, 4 days undetected)

Severity SEV2. Duration: 4 days undetected + 2h remediation. Blast radius: LCP p75 4.8s (baseline 2.1s) on ~30% of PDP-like pages; SEO ranking degraded; ~$12k estimated organic-traffic loss. Root cause (5-whys): new `hero-block` referenced non-optimized image → image handler didn't route through helix optimize pipeline → block-library CI didn't run LCP synthetic → LCP alert threshold set to 5s (too loose) → RUM sample rate on this block was 10% (too low to trigger fast). Action items: (P0) tighten LCP alert to 3.5s p75 (owner @sre-lead, due +1w); (P0) helix-optimize enforcement in `hero-block` (owner @block-lead, due +1w); (P1) LCP synthetic in block-library CI (owner @dev-lead, due +2w); (P1) raise RUM sample rate to 25% on hero blocks (owner @sre-lead, due +2w). Well: RUM had enough data for retro reach analysis.

## Anti-patterns to avoid for EDS

- Don't skip UTC timestamps.
- Don't skip action-item owners.
- Don't blame authors — blame the tooling that let them err.
- Don't skip RUM-based user-impact metrics — synthetic isn't authoritative on EDS.
- Don't skip git commit SHAs in the timeline — every deploy is a commit; the SHA is the timeline anchor.
- Don't publish SEO-impact numbers externally without marketing review.
- Don't leave sheet revision history out of the evidence chain for sheet incidents.

---

Generate the full postmortem using `templates/postmortem.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `playbook-templates/eds.md` for the response the postmortem retrospects on, and `runbook-templates/eds.md` for symptom-specific technical detail.
