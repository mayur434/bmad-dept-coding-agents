# Alert-rule authoring guide — Edge Delivery Services (EDS)

## Purpose framing

An EDS alert pages the content-engineering on-call or Helix admin only
when a **customer-visible Core Web Vitals regression, JS error spike,
sitemap-gen failure, or preview/live divergence** breaks the delivered
experience — not on a single slow LCP sample or a bot-driven JS error.
Every rule links to a runbook symptom in `resources/runbook-templates/eds.md`.
Prefer RUM-backed metrics (LCP/INP/CLS from browser) + Helix admin
API status; segment by `device_type`, `page_template`, and `env`.

## Alert catalog for EDS — must-have rules

- **`eds.lcp.high`** — LCP p75 > 4s for 30 min → **P2** → runbook `#lcp-regression`
  - Datadog RUM: `avg(last_30m):p75:rum.largest_contentful_paint{env:$env, device:$device} > 4000`
  - Prometheus (RUM beacon): `histogram_quantile(0.75, sum by (le, device) (rate(rum_lcp_seconds_bucket[30m]))) > 4`
  - New Relic Browser: `SELECT percentile(largestContentfulPaint, 75) FROM PageViewTiming WHERE env='prod' SINCE 30 minutes ago`
- **`eds.inp.high`** — INP p75 > 500ms for 30 min → **P2** → runbook `#inp-regression`
- **`eds.cls.high`** — CLS p75 > 0.25 for 30 min → **P3** → runbook `#cls-regression`
- **`eds.js.error_rate.high`** — JS error rate > 1% of page views for 30 min → **P2** → runbook `#js-error-spike`
  - Datadog RUM: `sum(last_30m):sum:rum.error{env:$env}.as_count() / sum:rum.view{env:$env}.as_count() > 0.01`
- **`eds.sitemap.gen.fail`** — sitemap generation failed → **P2** → runbook `#sitemap-fail`
  - Datadog: `min(last_1h):min:eds.sitemap.gen.success{env:$env} < 1`
- **`eds.helix.preview_live.diff`** — preview vs live diff count > 20 pages for 30 min → **P2** → runbook `#preview-live-drift`
- **`eds.block.load_error`** — block-load error rate > 0.5% for 15 min → **P2** → runbook `#block-load-error`
- **`eds.origin.auth.stale`** — Google Docs / SharePoint auth token expiring in < 24h → **P3** (informational)
- **`eds.redirects.sync.fail`** — redirects.xlsx sync failure → **P2**
- **`eds.rum.sample_rate.drop`** — RUM sample rate drop > 50% vs baseline for 1h → **P3**
- **`eds.helix.admin.5xx`** — Helix admin API 5xx > 1% for 10 min → **P1** → runbook `#helix-admin-down`

## Alert severity mapping for EDS

- **P1:** Helix admin API 5xx, complete edge outage (via synthetic probe).
  Publishing/authoring completely broken.
- **P2:** LCP/INP regressions, JS error spike, sitemap gen fail, preview
  vs live drift, block-load errors, redirects.xlsx sync fail.
- **P3:** CLS regression, RUM sample-rate drop, auth-token expiring soon,
  cold-cache warmup notices.

## Alert-noise guidance for EDS

- **All:** minimum 30-min RUM window (RUM is noisy at short intervals);
  segment by `device_type`.
- **LCP alerts** should segment by device (`mobile` vs `desktop`) —
  averaging masks mobile regressions.
- **JS error rate** should exclude bot traffic (RUM beacon filter by
  `user_agent:!bot` / `is_bot:false`).
- **Sitemap-gen alerts** should exclude scheduled maintenance windows
  and post-bulk-content-publish quiet time (sitemap regen is expected).
- **Preview vs live diff** should skip active editorial windows (natural
  divergence during editing); page only after preview stabilizes > 30 min.
- **RUM sample-rate drop** should exclude low-traffic windows
  (< 100 pageviews/hour is not a statistically meaningful sample).

## Composite / multi-signal alerts for EDS

- **`eds.cwv.regressed`** — `lcp_p75 > 4s AND inp_p75 > 500ms` for 30 min → P1
  (SEO-affecting; page immediately) — confirms real regression across
  metrics vs single-signal noise.
- **`eds.edge.degraded`** — `js_error > 1% AND block_load_error > 0.5%`
  for 15 min → P2. Rules out client-side vs edge issue.
- **`eds.publish.stuck`** — `preview_live_diff > 20 AND sitemap_gen_fail`
  → P2. Confirms publish pipeline stall.

## Alert deduplication / grouping for EDS

- **Datadog:** group_by `env,device_type,page_template`; suppress
  duplicates within 15 min per `service:eds` scope (RUM is noisier
  than APM).
- **Prometheus Alertmanager:** routes → `team-frontend` for CWV / JS
  errors; `team-content-ops` for sitemap / redirects; `team-eds-platform`
  for Helix admin.
- **PagerDuty:** merge on `eds.$env.$env_group.*` prefix within 30 min
  (long window — RUM lag is significant).

## On-call escalation policy per EDS

- **Primary (0 min):** content-engineering on-call (`@eds-oncall`).
- **Secondary (15 min):** frontend performance engineer for CWV alerts;
  content-ops lead for sitemap / redirects.
- **Tertiary (30 min):** EDS tech lead → engineering manager.
- **Vendor (60 min):** Adobe EDS support (Helix admin API issues) with
  `org` + `site` + `ref` and preview vs live URLs.

## Alerting cadence / silences for EDS

- **Silences during sheet-config bulk-updates** — redirect + sitemap
  alerts paused during declared bulk edits (announced in `#eds-editorial`).
- **Silences during declared Helix maintenance** — auto-suppress alerts
  when Adobe status API reports EDS platform maintenance.
- **CWV cadence** — LCP/INP alerts fire max once/hour per env/device
  combo; do not double-page on flapping.
- **After-hours reduction for P3** — CLS + RUM sample warnings
  delivery-only Slack overnight.

## 2 worked alert-rule examples for EDS

### Example 1 — LCP regression on mobile (Datadog RUM)

```yaml
name: "[prod] eds — mobile LCP p75 > 4s for 30 min"
type: rum alert
query: 'rum("@type:view env:prod @view.device.type:mobile").rollup("pc75", "@view.largest_contentful_paint").last("30m") > 4000'
message: |
  Mobile LCP p75 > 4s for 30 min. Correlate with last helix-live push.
  Check block-load timing on top templates.
  Runbook: RUNBOOK-eds.md#lcp-regression
  @slack-eds-oncall
tags: [service:eds, env:prod, device:mobile, severity:sev2]
priority: 2
monitor_thresholds: { critical: 4000, warning: 2500 }
```

### Example 2 — Sitemap generation failed (Prometheus)

```yaml
- alert: EdsSitemapGenFail
  expr: min_over_time(eds_sitemap_gen_success[1h]) < 1
  for: 1h
  labels: { severity: sev2, team: content-ops }
  annotations:
    summary: "EDS sitemap generation has failed for the last hour"
    runbook: "runbooks/eds.md#sitemap-fail"
    action: "Check /helix-admin/sitemap/{{ $labels.org }}/{{ $labels.site }}"
```

## Anti-patterns to avoid for EDS

- **Paging on LCP for bot traffic** — Googlebot / bingbot LCP is
  meaningless for user experience; filter.
- **Static CWV thresholds not segmented by device** — mobile and desktop
  distributions differ ~2× on LCP.
- **JS error alerts without release-tag correlation** — cannot triage
  which deploy introduced the regression; include `release_sha`.
- **Preview/live diff alerts during editorial hours** — natural
  divergence; page only past a 30-min stable window.
- **Alerting on Helix admin availability from a single geo-probe** —
  use multi-region synthetic; single geo goes flappy.

---

Generate the full alert-rules file using the appropriate `templates/alerts-<target>.yaml` as the master, populating placeholders with stack-appropriate content from the guide above.
