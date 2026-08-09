# Postmortem authoring guide — Adobe Commerce PaaS (Magento 2)

## Purpose framing

A Commerce PaaS postmortem is a **blameless retrospective run after the
incident is resolved and revenue is flowing again** — it closes the loop
from `playbook-templates/commerce-paas.md` back into `runbook-templates/commerce-paas.md`
and `slo-templates/commerce-paas.md`. Every SEV1 gets one within 5 business
days (payment/checkout impact often carries a regulatory reporting clock
in parallel); SEV2 by decision (mandatory on repeat); SEV3 optional.
Focus: what broke in the storefront / admin / integration layer, why the
Magento / Fastly / New Relic stack didn't catch it earlier, and what
we're changing.

## Common failure modes for Commerce PaaS

Recurring root-cause patterns per stack, each with typical detection window:

- **Catalog re-index deadlock** — full re-index blocking write lock on `catalog_product_entity`. Detection: 5-15 min via indexer stuck + admin latency spike.
- **`bin/magento setup:upgrade` partial-fail on prod** — DB migration succeeded but code deploy failed midway; store in maintenance loop. Detection: immediate at deploy step.
- **Payment gateway timeout not gracefully handled** — checkout hangs, cart abandoned, no retry queue. Detection: 5-30 min via checkout-success-rate SLI.
- **Admin session storage full (Redis)** — `session_out_of_memory`; admin locked out mid-incident-response. Detection: 5 min via Redis OOM alert.
- **RabbitMQ consumer starvation** — async consumer down; order emails / catalog sync backlog. Detection: 30-120 min via queue-depth alert.
- **Fastly VCL bad-deploy** — cache-key regression collapsing hit-ratio + origin overload. Detection: 5-15 min via origin RPS spike.
- **SQL-injection via unfiltered admin form** — CVE or custom-module regression. Detection: hours to days (SIEM / audit).
- **Cron misfire** — `cron_schedule` skew causing duplicate order-status transitions. Detection: 30-90 min via order-state anomaly.
- **Elasticsearch cluster split-brain** — search returns partial results. Detection: 5-30 min via search-relevance drop.
- **Composer autoloader stale post-deploy** — new modules class-not-found. Detection: immediate at first request.

## Timeline capture patterns for Commerce PaaS

- **`var/log/*.log`** — `system.log`, `exception.log`, `debug.log`, `payment.log` (payment-specific transactions).
- **`var/report/*`** — Magento exception reports with the correlation ID surfaced to the user.
- **Fastly RUM + access log** — request-rate panel, purge-log timeline, VCL deploy history.
- **New Relic Transactions** — per-endpoint p95 timeline, DB slow-query attribution, external-service (payment gateway) latency.
- **DB slow-query log** — MySQL slow-log with query digest; correlate with re-index / cart operations.
- **Indexer audit** — `bin/magento indexer:status` output history; `indexer_state` table timeline.
- **Adobe Commerce Cloud logs** — deploy hooks, cron logs, project-level activity feed.
- **Payment provider dashboard** — gateway-side transaction log (Braintree, Adyen, Stripe) with request IDs.

Format: UTC timestamps, actor, action, evidence link (New Relic trace URL, log excerpt path, payment-provider transaction ID).

## Root-cause analysis methods for Commerce PaaS

- **5-whys** — default for indexer / cache / cron incidents.
- **Fishbone (Ishikawa)** — **most common for Commerce**: incidents typically span dev + ops + payment-ops + platform (Adobe Cloud) + third-party (gateway, tax service). Multiple contributing factors.
- **Fault-tree** — for security (STRIDE) incidents — SQLi, admin bypass, PCI-scope leak.
- **Chaos replay** — for load-driven cascade failures (Black-Friday-class); reproduce in stage via traffic replay.

Commerce leans **fishbone** because multi-team coordination is the norm — payment gateway + tax service + shipping API + Adobe Cloud platform all in play during a single checkout incident.

## Contributing-factor taxonomy for Commerce PaaS

- **Technical debt** — known-open backlog (e.g. `COM-1123: cron rebalance overdue`); often magento-2 EOL modules.
- **Process gap** — missing runbook, missing payment-ops on-call rotation, missing stage-load-test before Black Friday.
- **Human error** — release manager deployed during freeze; framed blamelessly (calendar tooling didn't block the deploy button).
- **External dependency** — payment gateway outage, tax-service outage, Adobe Cloud platform issue, Fastly incident.
- **Config drift** — env divergence between stage and prod (`env.php`, `config.php`); cross-reference `env-diff-templates/commerce-paas.md`.

## What-went-well template for Commerce PaaS

- Maintenance-mode toggle worked cleanly, protecting cart data.
- Payment gateway failover to secondary triggered within SLA; 92% of in-flight carts recovered.
- RCA-friendly logging in place — correlation IDs carried request → payment gateway → order.
- Fastly cache absorbed origin outage for 8 min before hit-ratio decayed.
- Admin login didn't lock out incident responders (Redis had headroom).
- Consumer restart drained backlog within 12 min post-fix.

## Action-item taxonomy for Commerce PaaS

- **Prevention** — root-cause fix in code (module hardening, cron idempotency), config (indexer cadence, Redis sizing), or infra (RabbitMQ HA).
- **Detection** — new alert on payment-gateway-timeout rate, new dashboard tile for consumer lag, new SLI for admin-login p95.
- **Response** — runbook update, playbook update, on-call training on payment failover.
- **Communication** — comms template update, payment-ops paging matrix, customer notification template for checkout outage.

Per action item: owner + due-date + priority (P0 within week; P1 within month; P2 within quarter) + tracking-ticket-id.

## Blameless-language enforcement for Commerce PaaS

- REJECT "the deploy engineer skipped setup:upgrade" → REPLACE "the deploy pipeline's setup:upgrade step wasn't idempotent; a retry corrupted the DB state".
- REJECT "the merchant misconfigured the coupon" → REPLACE "the admin UI accepted a coupon config that produced impossible discounts; adding validation".
- REJECT "the consumer restart was forgotten" → REPLACE "the runbook's consumer-restart step wasn't cross-referenced from the deploy checklist".

## Stakeholder review process for Commerce PaaS

- **Author:** incident commander from the playbook run.
- **Reviewers:** SRE lead + Commerce tech lead + payment-ops lead (if payment involved).
- **Approvers:** engineering manager (SEV1: + director; SEV1 with PCI/PII: + legal + compliance + acquiring bank contact).
- **Publication:** internal wiki + `#commerce-oncall`; external status page + customer email for checkout-visible SEV1.
- **Adobe Commerce Cloud cross-file:** if platform contributed, attach postmortem summary to Adobe Support case.

## 2 worked postmortem examples for Commerce PaaS

### Example 1 — Black Friday checkout outage (SEV1, 38 min)

Severity SEV1. Duration 38 min. Blast radius: 100% checkouts globally; ~$180k estimated revenue loss + 4.2k abandoned carts. Root cause (fishbone): payment gateway p99 spiked to 12s (external — gateway upstream congestion) → checkout timeout not tuned for high-latency scenario → maintenance mode not proactively enabled → cart storage filled queue → admin locked out via Redis OOM (contributing) → runbook for gateway-degraded scenario missing. Action items: (P0) circuit-breaker on payment call with 3s SLA (owner @dev-lead, due +1w); (P0) gateway-degraded runbook (owner @ops-lead, due +1w); (P1) Redis sizing +2× for BF (owner @sre-lead, due +2w). Well: payment failover engaged; 92% of carts recovered.

### Example 2 — Catalog re-index deadlock during flash sale (SEV2, 22 min)

Severity SEV2. Duration 22 min. Blast radius: catalog admin unavailable, PDPs served stale prices for 22 min, ~$8k discount-abuse exposure. Root cause (5-whys): admin PDP updates failed → indexer `catalog_price` deadlocked → full re-index kicked off during peak → cron cadence set to reindex hourly instead of on-demand → runbook didn't cover "disable full re-index during flash-sale" pre-window step. Action items: (P0) switch indexer to update-on-schedule during flash-sale windows (owner @dev-lead, due +1w); (P1) add `indexer_deadlock` alert (owner @sre-lead, due +2w); (P2) merchandising-ops runbook for flash-sale windows (owner @merch-lead, due +1mo). Well: Fastly absorbed stale-price impact for 15 min before customer notice.

## Anti-patterns to avoid for Commerce PaaS

- Don't skip UTC timestamps.
- Don't skip action-item owners.
- Don't blame individuals — blame the systems / tooling.
- Don't publish postmortem details externally without payment-ops + legal review (PCI Article 12 requires care with attack disclosure).
- Don't skip New Relic trace links in the timeline — evidence must be reproducible.
- Don't skip payment-gateway request IDs — reconciliation with the acquiring bank depends on them.
- Don't leave PII/PCI exposure unquantified; SEV1 postmortem for card exposure requires exact record count + notification timeline.

---

Generate the full postmortem using `templates/postmortem.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `playbook-templates/commerce-paas.md` for the response the postmortem retrospects on, and `runbook-templates/commerce-paas.md` for symptom-specific technical detail.
