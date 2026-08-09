# Runbook authoring guide — Adobe Commerce PaaS (Magento 2)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a runbook for an Adobe Commerce (Magento 2) PaaS
project — Magento Cloud or self-managed. Combine with
`templates/runbook.md` as the master skeleton.

## Purpose framing

A Commerce PaaS runbook is written for a Magento Cloud on-call, a
merchant-ops engineer, or a payments SRE at 3 AM during a peak-traffic
event. It must be **incident-symptom-based** (`checkout success rate
dropped to 87%`, not `Commerce is broken`), name **exact commands**
(`bin/magento indexer:status`, `bin/magento cache:status`), and include
**quantified triggers** (`payment gateway 5xx > 2% for 3 min → engage
gateway vendor`). Cart, checkout, catalog, admin, indexer, cron, and
consumer processes each have distinct symptom vocabularies.

## Common incident symptoms for Commerce PaaS

- Checkout success rate < 95% (payment gateway failure, cart validation regression)
- Cart p95 latency > 2s (catalog re-index storm, session lock contention)
- Catalog re-index stuck (indexer stale, DB lock, MySQL deadlock)
- Payment gateway 5xx spike (vendor outage, cert rotation, network segmentation)
- Admin login round-trip > 5s (session storage / Redis contention)
- Storefront cache hit-ratio < 80% (Fastly VCL regression, block-level TTL misconfig)
- RabbitMQ consumer lag > 1000 messages (consumer process crashed, poison message)
- Cron job overdue > 2h (`bin/magento cron:run` not firing, cron.php disabled)
- Redis fragmentation ratio > 1.5 (session store degradation)
- MySQL slow-query count > 100/min (missing index, product-attribute EAV regression)

## Quick-diagnosis commands (per common symptom)

- **Checkout success drop:** `bin/magento indexer:status`; check payment
  gateway status page; sample checkout via `curl -sf https://{host}/rest/V1/carts/mine`;
  Fastly hit-ratio panel.
- **Cart p95 latency:** `bin/magento cache:status`; check indexer state
  (mode: schedule vs realtime); `SHOW ENGINE INNODB STATUS` for locks;
  RabbitMQ consumer lag per queue.
- **Catalog re-index stuck:** `bin/magento indexer:status`;
  `SHOW PROCESSLIST` for long-running queries; check `mview` triggers;
  `bin/magento indexer:reset <indexer>` if truly stuck.
- **Payment gateway 5xx:** vendor status page; `tail var/log/payment.log`;
  `tail var/log/exception.log | grep <gateway>`; check IMS / gateway secret
  freshness.
- **Admin login slow:** `redis-cli --stat`; check `app/etc/env.php` session
  redis config; `SHOW STATUS LIKE 'Threads_running'`.
- **RabbitMQ lag:** `rabbitmqctl list_queues name messages consumers`;
  check `bin/magento queue:consumers:list` and running processes on hosts.
- **Cron overdue:** `bin/magento cron:status`; check crontab entry;
  check `cron_schedule` table for `status='error'` rows.

## Likely causes (per common symptom)

- **Checkout success drop:** payment gateway outage; new cart-rule regex
  regression; cart validation change; API Mesh gateway error.
- **Cart p95:** indexer switched to realtime under load; session lock in
  Redis; MySQL InnoDB row-lock contention on `sales_order`.
- **Payment gateway 5xx:** vendor incident; cert / API-key rotation;
  network segmentation; new payment method plugin regression.
- **Admin slow:** Redis eviction pressure; session-file storage instead
  of Redis; MySQL slow query on `admin_user` join.
- **RabbitMQ lag:** consumer process crashed and not restarted; poison
  message stuck in `deadletter`; DB connection pool exhausted.

## Mitigation steps (per common symptom)

- **Checkout success drop:** if payment gateway is confirmed down →
  disable that gateway (`Stores → Payment Methods → disable`); enable
  fallback gateway; announce degraded flow in `#commerce-status`. If
  application-layer → rollback the last deploy via ECE-Tools /
  Magento Cloud UI.
- **Cart p95:** switch indexers to schedule mode
  (`bin/magento indexer:set-mode schedule`); flush block_html cache
  (`bin/magento cache:flush block_html`); if Redis session contention,
  scale Redis or fail over.
- **Catalog re-index stuck:** `bin/magento indexer:reset <indexer>` then
  `bin/magento indexer:reindex <indexer>`; if MySQL deadlock, restart
  MySQL replica connection.
- **Payment gateway:** disable failing gateway; enable fallback; if
  vendor outage, monitor vendor status page + push status page update.
- **RabbitMQ lag:** restart failed consumer via
  `bin/magento queue:consumers:start <name>`; check dead-letter queue for
  poison messages; if lag > 10k, scale consumers.

## Rollback triggers for Commerce PaaS

Cross-reference `rollback-plans/commerce-paas.md` from the Release agent:

- Checkout success rate < 90% for 5 min.
- Cart p95 latency > 4s for 5 min.
- Payment gateway integration error rate > 5%.
- Admin login failure rate > 10%.
- Any DB deadlock storm (> 50 deadlocks / min).
- Manual call from release manager or merchant-ops.

## Escalation matrix for Commerce PaaS

- **L1** — merchant-ops (checkout / cart / cataglog), payments SRE (payment
  gateway), on-call SRE.
- **L2** — Magento tech lead, DBA (MySQL / Redis / RabbitMQ issues).
- **L3** — Engineering manager, payments vendor account owner.
- **Vendor** — Adobe Commerce Cloud support (Magento Cloud platform issues);
  payment gateway support (payment-specific 5xx / cert / auth).

## Verification steps for Commerce PaaS

- Checkout success rate ≥ 98% sustained 15 min.
- Cart p95 latency ≤ target for the tier.
- All indexers `Valid` (not `Reindex required`).
- `bin/magento cache:status` all cache types active.
- RabbitMQ consumer lag ≤ 100 messages per queue.
- Payment gateway synthetic transaction (test card) green.
- Admin login synthetic ≤ 3s p95.
- Fastly hit-ratio ≥ target.

## Comms templates for Commerce PaaS

**Channels:** `#commerce-deploys` (deploy comms), `#commerce-oncall`
(active incidents), `#customer-status` (public status page updates),
`#payment-ops` (payment-specific).

**Stakeholders:** merchant-ops, payments SRE, DBA, Magento tech lead,
customer support lead (external comms).

## 2 worked runbook examples for Commerce PaaS

### Example 1 — "Checkout success rate dropped to 87%"

- **Symptom:** Checkout success 87% (baseline 98%) for 8 min; error surface concentrated on `payment/authorize` endpoint.
- **Quick diagnosis:**
  1. Payment gateway status page.
  2. `tail var/log/payment.log | tail -100`.
  3. `bin/magento cache:status`; is `config` cache stale after a recent deploy?
  4. Check `sales_order_payment` for last-100 failed attempts — grouped by error code.
  5. Fastly hit-ratio (some checkout-error 500s cache negative and amplify).
- **Mitigation:** if vendor outage → disable primary gateway, enable fallback;
  announce degraded checkout in `#customer-status`; if application-layer error →
  rollback via `ece-tools cloud:deploy rollback <env>`.
- **Rollback trigger:** checkout success < 90% at 10 min post-mitigation.
- **Escalation:** L1 payments SRE → L2 payment vendor account owner (P1 case).

### Example 2 — "Catalog re-index stuck for 30 min"

- **Symptom:** `catalog_product_price` indexer stuck for 30 min; storefront pricing displays stale for 40% of PDPs.
- **Quick diagnosis:**
  1. `bin/magento indexer:status catalog_product_price`.
  2. `SHOW PROCESSLIST` — long-running query > 20 min?
  3. `SHOW ENGINE INNODB STATUS \G` — deadlock trace.
  4. `bin/magento setup:db:status` — pending schema change?
  5. Check disk space on DB host (`df -h`) — index rebuild needs headroom.
- **Mitigation:** kill the long-running query; `bin/magento indexer:reset catalog_product_price`;
  `bin/magento indexer:reindex catalog_product_price`; if repeats, switch mode to `schedule` and let
  cron process mview updates.
- **Rollback trigger:** if re-index fails 2 consecutive times, rollback last catalog import.
- **Escalation:** L1 merchant-ops → L2 DBA if MySQL is the bottleneck.

## Anti-patterns for Commerce PaaS

- **Runbook says "restart Apache/Nginx"** — Magento Cloud does not expose
  webserver control; use cache flushes and consumer restarts instead.
- **Diagnosis relies on `.htaccess` inspection** — Magento Cloud uses
  managed webserver config; `.htaccess` is largely inert.
- **No indexer state check** — 40% of Commerce perf incidents route through
  indexer state; a runbook without `indexer:status` misses the common case.
- **Missing cache-status check** — `config` cache staleness after a deploy
  is a top-5 root cause.
- **Verification uses admin endpoints only** — customer-facing routes
  (cart / checkout / PDP) are the surface that matters.

---

Generate the full runbook using `templates/runbook.md` as the master,
populating placeholders with stack-appropriate content from the guide above.
