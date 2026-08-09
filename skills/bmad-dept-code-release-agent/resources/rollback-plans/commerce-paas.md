# Rollback-plan authoring guide — Adobe Commerce (PaaS / Magento 2)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a rollback plan for an Adobe Commerce PaaS
(Magento 2, on Magento Cloud or self-managed) project. Combine with
`templates/rollback-plan.md` as the master skeleton.

## Purpose framing

A Commerce PaaS rollback plan establishes the checkout-conversion and
payment-gateway signals that force the call, the on-call authority who
owns the revert, the composer-driven revert path (which for irreversible
`db_schema.xml` changes routes to backup-restore rather than code
revert), and the merchant + support communication that must fire before
the first order is impacted. Every trigger must be a number sourced from
New Relic / Fastly / gateway logs; every step must name the exact CLI
command; and every irreversible schema change must be pre-flagged so
"revert code" doesn't corrupt the DB.

## Rollback triggers for Commerce PaaS — specific + quantified

- **Checkout completion rate drops > 5% below trailing-7-day baseline**
  for 15 min (measured by New Relic funnel or Adobe Analytics
  onepage-checkout completion event).
- **Payment gateway error rate > 2%** for 10 min (Braintree / Adyen /
  Stripe error rate; per-gateway if multi-gateway routing is in play).
- **Cart-total (`quote/cart` API) p99 > 5s** for 10 min.
- **Storefront LCP p75 > 4s** at the CDN (Fastly RUM) for 15 min.
- **`bin/magento` catalog re-index FAILS** after `setup:upgrade`.
- **Admin panel 5xx rate > 1%** or admin login TTLB > 10s for 5 min.
- **Consumer queue backlog > 10 000 messages** with no drain for 10 min
  (`bin/magento queue:consumers:list`).
- **`db_schema` verification fails** post-deploy (schema mismatch vs
  `db_schema_whitelist.json`).

## Decision authority for Commerce PaaS

- **Primary:** on-call SRE watching New Relic + Fastly dashboards.
- **Approver for revert:** tech lead OR merchandising lead (business
  owner of the checkout funnel).
- **Auto-rollback** — Magento Cloud pipeline auto-aborts on a failed
  `setup:upgrade` or a failed post-deploy hook; no auto-revert once the
  pipeline lands. <!-- verify: current Magento Cloud behavior -->
- **Escalation** — if primary on-call is unreachable within 5 min,
  backup SRE calls; if a payment-gateway trigger fires, page the
  payments-ops rotation in parallel.
- **CAB engagement required** if the release includes a `dropColumn` or
  a `dropTable` in `db_schema.xml` — those cannot be reverted by
  redeploy alone.

## Rollback steps for Commerce PaaS — numbered + timed

1. **Fastly VCL revert** (if the release touched edge rules) — Fastly
   UI → Versions → Activate previous version (< 1 min propagation).
2. **Enable maintenance mode** — `bin/magento maintenance:enable
   --ip=<office_ip>` — buys time to revert without customers hitting a
   half-reverted state (< 30s).
3. **Revert code** — `composer install` at the previous release ref (or
   Magento Cloud `magento-cloud environment:redeploy --environment prod
   --commit <previous_sha>`) + `bin/magento setup:upgrade`
   (5–10 min).
4. **Revert `db_schema.xml`** — WARNING: additive changes (add column /
   add index) auto-revert on `setup:upgrade`; **destructive changes
   (`dropColumn`, `dropTable`) do NOT** — route to DB backup-restore
   (see Data reversibility below) if any destructive change was in the
   release.
5. **`setup:di:compile`** + **`setup:static-content:deploy -f`** for
   locales × areas × themes (5–15 min depending on locale count).
6. **`cache:clean`** in the mandatory order — `config` → `block_html`
   → `full_page` (< 1 min).
7. **`indexer:reindex`** — full re-index of catalog, price, stock,
   product/category flat (5–20 min depending on catalog size).
8. **`queue:consumers:restart`** — pick up code changes in async
   consumers.
9. **Disable maintenance mode** — `bin/magento maintenance:disable`.
10. **Verify checkout end-to-end** — synthetic order via the office IP
    against a test payment method; confirm payment gateway callback.
11. **Notify** `#commerce-ops` + customer-support DL — order backlog
    triage if orders were queued during maintenance.

## Data reversibility flags for Commerce PaaS

Which changes CANNOT be safely rolled back — must be flagged in the plan:

- **`db_schema.xml` `dropColumn` / `dropTable`** — schema down-migration
  is manual; requires DB backup restore.
- **Data patches** (`Setup/Patch/Data/*`) that mutated production data —
  data is not automatically reverted; requires backup restore or a
  compensating patch.
- **Deleted admin ACL resources** — admin permission grants against
  removed resources are lost; must be re-added post-revert.
- **Order state transitions** — orders moved to `complete` /
  `canceled` during the failed release cannot be moved back without a
  compensating admin action.
- **Deleted CMS blocks / pages** — deleted by the release are lost;
  restore from staging DB or backup.
- **Stock reservations** — decremented stock is not reverted on code
  revert; audit `inventory_reservation` table.

**Guidance:** any destructive schema or data change → CAB approval
before ship + full DB snapshot pre-deploy; do NOT auto-revert; walk
through backup-restore or forward-fix explicitly.

## Stakeholder comms during rollback for Commerce PaaS

**Pre (moment of decision):** `#commerce-ops` — `[ROLLBACK IN PROGRESS]
v{{version}} — trigger: {{trigger}} — maintenance mode ON — ETA {{eta}}`.

**During:** every 10 min — pipeline progress, cache/index status.

**Customer-facing:** status page update the moment maintenance mode is
enabled ("scheduled maintenance, checkout unavailable, back in ~30
min"). Support team scripts updated.

**Merchandising / merchant:** page the on-call merchandising lead —
they own the funnel-loss conversation and any customer-goodwill call
(discount codes, order-retry outreach).

**Post (all-clear):** `[ROLLBACK COMPLETE] v{{previous_version}} live
— checkout verified — orders queued during window: {{n}} — support
notified`.

## Post-rollback for Commerce PaaS

- **RCA within 24h**, blameless.
- **Order-integrity verification** — reconcile order table against
  payment gateway settlements for the failed window; identify orders
  charged but not persisted (rare but possible when the code revert
  caught a mid-flight order).
- **Stock reservation audit** — confirm `inventory_reservation` matches
  physical stock; release orphan reservations from cancelled sessions.
- **Feature-flag state** — audit `core_config_data` toggles set for
  the release; confirm reverted state.
- **Cache warm-up** — top-100 category pages + top-500 product pages
  primed to avoid a post-revert LCP regression.
- **Lessons-learned template** — see `templates/rollback-plan.md`
  §Lessons learned; fill during RCA.

## 2 worked rollback-plan examples for Commerce PaaS

**v2.8.3 — Braintree gateway migration, payment error spike.** Trigger:
Braintree error rate 4.2% at T+22 min post-deploy (threshold 2%/10min).
Decision: on-call SRE + payments-ops on bridge, revert called at
T+25 min. Steps: maintenance mode ON, Magento Cloud redeploy to v2.8.2
(9 min), `setup:upgrade` + `di:compile` + `static-content:deploy`
(14 min for 12 locales), cache-clean + re-index (11 min), maintenance
OFF at T+66 min. Synthetic order confirmed at T+70 min. Post: RCA
identified a Braintree webhook signature-verification regression from a
missing config key. 47 orders queued during window; support outreach
completed within 4h.

**v2.9.0 — Catalog import with dropColumn, DB restore path.** Trigger:
`db_schema` verification failed post-deploy — release included
`dropColumn` on `catalog_product_entity.legacy_sku`. Decision: on-call
SRE + tech lead flagged irreversible — DB restore instead of code
revert. Steps: maintenance ON, code revert to v2.8.9 (11 min), DB
restore from pre-deploy snapshot (37 min for 180GB), reconciliation of
orders placed during window (7 orders, manually re-inserted), cache
clean + reindex (14 min), maintenance OFF at T+82 min. Post: process
gap flagged — reversibility-review gate did not catch the `dropColumn`;
CAB approval added to the release checklist.

## Anti-patterns to avoid for Commerce PaaS

- **Reverting code without checking `db_schema.xml` reversibility** —
  schema mismatch corrupts subsequent `setup:upgrade` runs.
- **Skipping `cache:clean` in the mandated order** — stale config
  cache masks the revert; storefront serves the failed release.
- **Skipping full re-index** — search results and category pages serve
  the failed-release data.
- **Rolling back during business hours without maintenance mode** —
  customers see half-reverted checkout, order corruption risk.
- **Restoring DB from backup without a matching code revert** — schema
  version mismatch on next `setup:upgrade`; do both together.

---

Generate the full rollback plan using `templates/rollback-plan.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
