# Incident-response playbook authoring guide — Adobe Commerce PaaS

## Purpose framing

A Commerce PaaS playbook covers **classes of incidents** on a
self-hosted / Adobe-hosted Magento estate — payment-gateway outage,
PCI-scope breach, checkout data-loss, catalog corruption — where
multiple runbooks may fire under one Incident Commander. Symptom-level
response belongs in `resources/runbook-templates/commerce-paas.md`.
PCI-DSS obligations make STRIDE structuring mandatory for any
security-tinged incident: the audit trail, cardholder-data scope, and
containment ordering all differ.

## Incident-type catalog for Commerce PaaS

- **Payment gateway outage** — Braintree/Adyen/PayPal 5xx cascading to checkout abandonment.
- **Checkout data loss** — quote/order records corrupted or truncated mid-transaction.
- **Catalog data corruption** — product/attribute/URL-rewrite table integrity break.
- **Admin lockout** — 2FA provider outage or admin credential compromise.
- **PII leak** — customer PII exposed via unauthenticated endpoint or misconfigured graphql.
- **PCI-scope breach** — cardholder-data exposure via logs, session store, or DB dump.
- **Cron worker starvation** — `consumers_runner`/`indexer` stuck; async orders backing up.
- **RabbitMQ backlog burst** — consumer failure causing message pile-up + memory pressure.

## STRIDE structure for security incidents

- **Spoofing** — admin credential compromise → force logout all admins (`bin/magento admin:user:logout-all`), rotate encryption key (`bin/magento setup:config:set --key`), dump admin audit log. <!-- verify command -->
- **Tampering** — SQL-injection or unauthorized DB mutation → snapshot RDS/MySQL, prepared-statement audit, WAF rule update for the offending pattern.
- **Repudiation** — verify `var/log/exception.log`, `system.log`, admin audit log intact + shipped to SIEM before restart.
- **Information disclosure** — PII/PAN leak via storefront/graphql → invoke breach-notification workflow; PCI-scope leaks require QSA notification within 24h. <!-- verify jurisdiction -->
- **Denial of service** — storefront DDoS → activate Fastly rate-limit fallback + WAF block; enable Magento full-page-cache stricter TTL.
- **Elevation of privilege** — unauthorized admin-role escalation → revert `admin_user_role` table from snapshot; audit `authorization_role` grants last 30d.

## Roles + responsibilities per Commerce PaaS

- **IC** — release manager or SRE lead.
- **Comms Lead** — pairs with merchant-support for external merchant comms.
- **Ops Lead** — payment-ops (payment incidents), DBA (catalog/order incidents), platform-SRE (RabbitMQ/cron).
- **Scribe** — captures order-IDs, quote-IDs, admin-user IDs, RabbitMQ message-IDs, timestamps UTC.
- **SMEs** — payment gateway TAM, QSA (PCI-scope), Fastly TAM, merchant-support lead.

## Initial-triage matrix for Commerce PaaS

- **SEV1** — checkout down > 5 min, payment gateway 100% failure, PII/PCI exposure confirmed, catalog table integrity break.
- **SEV2** — checkout conversion regression > 20%, single payment method down, cron backlog > 30 min, RabbitMQ backlog > 10k messages.
- **SEV3** — single storefront category degraded, single indexer stuck (non-price/non-stock), admin UI slow.

Decision flow: `alert fired → is checkout impacted? (SEV1) → is revenue at risk? → is cardholder data in play? → SEV assignment`.

## Containment steps for Commerce PaaS

- Enable maintenance mode (`bin/magento maintenance:enable --ip=<office-ip>`) — SEV1 only, revenue trade-off.
- Lock admin (`bin/magento admin:user:unlock` reverse; disable via DB `admin_user.is_active=0`).
- Freeze catalog re-index (`bin/magento indexer:set-mode schedule`).
- Disable payment method (`config → payment → <method> → active=0`) via config-only push.
- Isolate compromised consumer (RabbitMQ management UI → shovel to DLQ).
- Snapshot MySQL + Redis + session store before wiping.
- Enable Fastly WAF stricter ruleset if edge is under attack.
- Freeze composer package updates (`composer.lock` freeze notice to release manager).

## Investigation steps per Commerce PaaS

- **Log locations:** `var/log/exception.log`, `system.log`, `debug.log`, `var/report/*` for uncaught crashes, `var/session/*` for session-store forensics.
- **DB:** slow-query log, `binlog` last 24h for tampering forensics.
- **Fastly:** access log + WAF event export (last 48h).
- **RabbitMQ:** management UI → queues → check consumers, unacked, deliver-rate.
- **Spoofing:** query `admin_user_session` + `authorization_rule` last 72h.
- **Tampering:** compare `catalog_product_entity_*` row-counts against snapshot.
- **Information disclosure:** enumerate storefront + graphql endpoints touching `customer_entity` / `sales_order` in last 24h.
- **DoS:** Fastly RPS panel, WAF top-source-ASN histogram.
- **EoP:** diff `authorization_role` grants against last snapshot.

## Eradication + recovery per Commerce PaaS

- Revert offending composer package (`composer update <pkg>` to pinned prior version).
- Restore MySQL from snapshot (checkout-only tables preferred over full DB restore).
- Re-run indexers post-restore (`bin/magento indexer:reindex`).
- Rotate encryption key + re-encrypt payment tokens (`bin/magento encryption:key:change`). <!-- verify -->
- Purge Fastly + Varnish once fix verified.

## Communications plan for Commerce PaaS

- **Internal:** `#commerce-oncall`, `#commerce-releases`, `#merchant-support`.
- **External:** merchant status page (B2B merchants), consumer status page (D2C).
- **Regulatory:** QSA within 24h for PCI-scope incidents; state AG notifications per PII residency.
- **Vendor:** payment gateway 24/7 line; Fastly TAM; Adobe Commerce support (P1 case with server-ID + trace-ID).

Sample lines: `[INCIDENT — SEV1] Checkout down 100% since 02:14 UTC. Payment gateway timeout. IC @bob. Bridge <link>.`

## Stand-down criteria for Commerce PaaS

- Checkout conversion within 10% of baseline sustained 30 min (from `slo-templates/commerce-paas.md`).
- Payment gateway success rate ≥ 99% sustained 30 min.
- Cron/indexer/RabbitMQ backlogs drained + steady.
- No new alerts firing: SEV1 60 min, SEV2 30 min, SEV3 15 min.
- Merchant + consumer notifications updated.
- DB integrity check passed (`checksum table sales_order`).

## Postmortem trigger for Commerce PaaS

- **SEV1** — always. PCI-scope postmortems reviewed by QSA.
- **SEV2** — required for repeat (3+ in 30 days) or > $10k revenue impact.
- **SEV3** — optional.

Cross-reference `resources/postmortem-templates/commerce-paas.md` (3.5c-iii).

## 2 worked playbook examples for Commerce PaaS

### Example 1 — "Payment gateway 100% failure"

Type: availability, SEV1. Symptom: Braintree `/transactions` 5xx 100% since 02:14 UTC; checkout success 3%. Triage: revenue-critical → SEV1. Containment: switch payment method priority to secondary gateway via config-only push; disable Braintree in admin. Investigation: Braintree status page + TAM engagement; correlate 5xx with Braintree's incident window. Eradication: wait for vendor + verify. Recovery: re-enable Braintree; verify test transaction; ramp traffic. Stand-down: gateway success ≥ 99% for 30 min.

### Example 2 — "Admin credential compromise → potential PCI breach"

Type: security (Spoofing + Info-disclosure), SEV1. Symptom: SIEM alert on admin login from novel ASN; suspicious `sales_order_grid` export. Triage: PCI-scope potential → SEV1 pending QSA. Containment: force logout all admins; disable suspect admin; snapshot DB + Fastly logs; QSA engaged. Investigation: enumerate exported records; validate no PAN in logs; audit-role grants diff. Eradication: rotate encryption key; re-issue admin credentials with new 2FA seeds. Recovery: gradual admin re-enable with SSO. Stand-down: audit clean, QSA acknowledged.

## Anti-patterns to avoid for Commerce PaaS

- Don't clear checkout data (quote/order/session) during payment-outage investigation — you lose evidence of the failure mode.
- Don't skip QSA notification for PCI-scope incidents — audit non-compliance is worse than the breach.
- Don't restart cron/consumers before dumping RabbitMQ DLQ — poison messages lose forensic value.
- Don't skip STRIDE — admin-compromise (Spoofing) vs role-escalation (EoP) drives different containment.
- Don't restore full DB when checkout-only tables suffice — expands the customer-impact window.

Generate the full playbook using `templates/playbook.md` as the master, populating placeholders with stack-appropriate content from the guide above.
