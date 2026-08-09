# Deploy-plan authoring guide — Adobe Commerce (PaaS / Magento 2)

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a deploy plan for an Adobe Commerce PaaS
(Magento 2 on Magento Cloud or self-managed) project. Combine with
`templates/deploy-plan.md` as the master skeleton.

## Purpose framing

A Commerce PaaS deploy plan orchestrates a set of highly-ordered
tasks — `setup:upgrade`, `setup:di:compile`, `setup:static-content:deploy`,
cache-clean, indexer, queue consumers — around a maintenance window
that customers see. It must state exactly which phases hold the store
in maintenance, which run hot, and how checkout latency + admin
availability are verified before traffic is fully released.

## Pre-deploy checklist for Commerce PaaS

- **`bin/magento setup:upgrade --dry-run`** executed on a stage
  snapshot; `db_schema_whitelist.json` diff reviewed.
- **Data patch classes** (`Setup/Patch/Data/*`) reviewed for
  idempotency and estimated runtime; long-running patches split.
- **`config.php` module state** diff reviewed — no unintended module
  enable/disable.
- **`env.php` scope diffs** reviewed for cache backend, session
  backend, queue backend changes.
- **Fastly VCL** custom snippets reviewed if the release changes edge
  logic (waf, cache TTLs, purge tags).
- **Admin session invalidation window** agreed — release manager +
  merchandising notified their sessions will drop.
- **Cache-clear ordering** confirmed: `config` → `layout` →
  `block_html` → `full_page` (order avoids serving stale layout under
  fresh config).
- **Indexer status** all `Ready` on source env; no `Reindex Required`
  carried into the deploy.
- **Queue consumers** drained; cron shut down; scheduled jobs paused.
- **Payment-gateway sandbox smoke** on Stage confirms mid-flight order
  handling.

## Deploy phases for Commerce PaaS — rollout-specific

Commerce PaaS rarely runs in-place canary — Fastly weighted routing
is possible but rare. Phase against the resolved `--rollout`:

- **`canary` (Fastly-weighted).** Requires two Magento Cloud projects
  or two node groups behind Fastly. Phase 1 warm-canary + smoke, Phase
  2 5% weighted, Phase 3 50% weighted, Phase 4 100%.
- **`blue-green` (VCL/DNS swap).** Two identical Magento Cloud
  projects; deploy to blue, warm caches, run `setup:upgrade` +
  `indexer:reindex` + full-page cache warmup, then Fastly VCL swap
  origin. Phases: warm-blue, warm-cache, VCL cut, drain-green.
- **`rolling` (multi-node).** Standard for multi-web-node fleets;
  Magento Cloud handles the sequence. Maintenance window brief; single
  phase with per-node verification.
- **`feature-flag`.** Toggle behind a `system/config` scope or
  `deployment/config` env var; deploy dark, flip via `config:set` +
  cache-clean of `config`.
- **`bigbang`.** Hotfix path only; single maintenance window,
  condensed verification.

## Verification per Commerce PaaS

- **Checkout p95 ≤ 2s** on `/checkout/onepage` (Fastly + origin).
- **Cart-total API** (`/rest/V1/carts/mine/totals`) sub-500ms p95.
- **Admin login round-trip** < 3s; admin dashboard renders without
  timeout.
- **`bin/magento indexer:status`** all `Ready` post-`indexer:reindex`.
- **Queue consumers** back online (`bin/magento queue:consumers:list`);
  no queue depth above baseline.
- **Payment-gateway sandbox transaction** completes end-to-end.
- **Fastly hit-ratio ≥ 90%** at 15 min post-deploy.
- **Order-placement synthetic** green on the Stage-in-Prod smoke path.

## Rollback triggers for Commerce PaaS

- **Checkout success rate < 95%** (baseline ~99%) sustained 5 min.
- **Payment-gateway error rate > 2%** — indicates auth-token /
  hash-key mismatch after deploy.
- **Cart-total endpoint latency > 5s** — indicates catalog/pricing
  index desync.
- **Admin login failure rate > 10%** — admin session or ACL
  regression.
- **Fastly origin fetch rate > 3× baseline** — cache-key regression
  flooding origin.
- **`setup:upgrade` fails** or a data-patch times out beyond planned
  window.
- **Queue consumer crash loop** — `queue:consumers:start` fails after
  3 attempts.
- **Manual call** from release manager or on-call.

## Communication plan for Commerce PaaS

**Pre-deploy** (T-48h): announce in `#commerce-releases` and to
merchandising — release version, maintenance window, admin-session
drop notice.

**During deploy**: post at each phase gate — maintenance enabled,
`setup:upgrade` complete, cache-clean done, indexer green,
maintenance disabled, traffic ramped.

**Post-deploy** (T+4h): all-clear with checkout p95, order-count
snapshot vs baseline, Fastly hit-ratio.

## Stakeholder RACI for Commerce PaaS

| Role | Responsibility |
|---|---|
| Release manager | Owns maintenance window + go/no-go at each phase gate. |
| Tech lead | Owns module + data-patch changes; on bridge for `setup:upgrade`. |
| DevOps / SRE | Executes deploy; owns Fastly VCL + cache-clean ordering. |
| QA | Runs checkout + admin smoke; UAT sign-off on Stage. |
| Merchandising | Signs off on admin-session drop window + storefront readiness. |
| Payment ops | Verifies payment-gateway sandbox + PCI compliance. |
| On-call | Primary responder for checkout / payment regressions. |

## 2 worked deploy-plan examples for Commerce PaaS

**v2.5.0 — Loyalty extension, blue-green, Prod.**
Pre-deploy: `setup:upgrade --dry-run` green; VCL diff clean; blue
project warmed with prior snapshot.
- Phase 1: deploy code to blue, run `setup:upgrade`,
  `setup:di:compile`, `setup:static-content:deploy`,
  `indexer:reindex`.
- Phase 2: warm full-page cache via crawler on top-200 URLs, verify
  checkout p95 ≤ 2s on blue.
- Phase 3: Fastly VCL swap origin blue ← green; monitor 5xx +
  checkout success 10 min.
- Phase 4: drain green (stop consumers, snapshot, decommission).
- Rollback: VCL revert (single command); < 60s cutback.

**v2.5.1 — PCI patch, bigbang, Prod.**
Pre-deploy: maintenance window 02:00–02:45 UTC agreed; PCI ops on
bridge.
- Phase 1: `maintenance:enable`, deploy composer patch, run
  `setup:upgrade`, cache-clean `config`+`full_page`,
  `maintenance:disable`, verify payment sandbox transaction.
- Rollback: composer roll to previous lock, cache-clean, verify.

## Anti-patterns to avoid for Commerce PaaS

- **Skipping `setup:upgrade --dry-run`** — a failing data patch mid-deploy
  extends the maintenance window unpredictably.
- **Cache-cleaning `full_page` before `config`** — serves stale layout
  under fresh config; visible layout breakage.
- **Deploying admin changes during admin business hours** without a
  notice — merchandising sessions drop mid-edit.
- **Skipping catalog re-index** after schema-affecting changes —
  category pages show stale product sets.
- **Running long data patches during peak** — cron and consumer
  starvation cascades into order-placement failures.

---

Generate the full deploy plan using `templates/deploy-plan.md` as the
master, populating placeholders with stack-appropriate content from
the guide above.
