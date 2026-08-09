# Env-diff authoring guide — Adobe Commerce (PaaS / Magento 2)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an env-diff for an Adobe Commerce PaaS (Magento 2
on Adobe Commerce Cloud / self-managed) project. Combine with
`templates/env-diff.md` as the master skeleton.

## Purpose framing

A Commerce PaaS env-diff catches the drift most likely to break a store:
`app/etc/env.php` gaps between the shared build and per-env overrides,
`config.php` module state that fell out of sync, Fastly VCL snippets
that were hand-patched in one env only, admin store-config values that
never promoted, and secret rotation gaps on payment gateway keys. It
should also flag PHP-FPM and Redis sizing mismatches that will surface
as checkout latency in production.

## Config-file diff scope for Commerce PaaS

- **`app/etc/env.php`** per env — DB, cache, queue, session storage,
  crypt key, cache_types state. Redact `crypt->key` and DB passwords.
- **`app/etc/config.php`** — module enable/disable state, `system`
  scoped config committed to VCS via `bin/magento app:config:dump`.
- **`.magento.env.yaml`** — Magento Cloud stage/prod overrides (build
  hooks, deploy hooks, `stage.deploy.*` and `stage.build.*` variables).
- **`.magento.app.yaml`** — app definition, mounts, workers, crons,
  relationships. Rare drift but critical when it happens.
- **ECE-Tools deploy config** — `ece-tools` scenario overrides per env.
- **Fastly VCL snippets** per Fastly service (stage service vs prod
  service) — custom VCL, edge dictionaries, ACLs.
- **`php.ini` / `php.d/*.ini`** — memory_limit, max_execution_time,
  opcache settings; Cloud Commerce exposes these via project vars.
- **`config.php.repo_id`** — Adobe Commerce composer repo credentials
  scope; drift here breaks deploys silently.

## Env-var diff conventions for Commerce PaaS

- Non-sensitive: `MAGE_MODE` (`developer` / `default` / `production`),
  `MAGE_RUN_TYPE`, `MAGE_RUN_CODE`, `PHP_MEMORY_LIMIT`.
- Sensitive (REDACTED): DB credentials (embedded in `env.php`, not raw
  env vars in Cloud), `CRYPT_KEY`, Fastly API tokens, payment gateway
  API keys (Braintree/Adyen/Stripe), New Relic license key.
- Environment-specific: `CONFIG__DEFAULT__WEB__UNSECURE__BASE_URL`
  (and `SECURE`) — should differ per env; flag only if identical.

## Feature-flag state comparison

Commerce PaaS has multiple flag mechanisms — the diff must span them:

- **Admin store config** at
  `stores/config/<section>/<group>/<field>` per website/store scope —
  export via `bin/magento config:show` per env and diff. Common flag
  paths: `payment/*/active`, `carriers/*/active`,
  `sales/reorder/allow`, `catalog/frontend/*`.
- **`app/etc/config.php` module state** — `'modules' => ['Vendor_Foo' => 1]`
  vs `0` is a hard flag.
- **Feature-flag SaaS** (LaunchDarkly / Split) — only if the project
  wires a client; enumerate flag keys the codebase reads.
- **Fastly edge dictionaries** — dictionary-based routing flips.

Example `--env stage --to-env prod` presentation:

> `payment/braintree/active` — Stage `1` (on), Prod `0` (off). Owner:
> payments-team. Note: awaiting PCI sign-off before Prod flip.

## Secret-rotation diff (redacted)

- **`env.php` `crypt->key`** — rotating this re-encrypts stored payment
  tokens and must never diverge across a shared DB replica pair.
- **Admin salt** and admin 2FA secrets.
- **Payment gateway keys** — Braintree merchant ID + private key, Adyen
  API key + HMAC, Stripe secret key.
- **Fastly API tokens** used by ECE-Tools deploy hooks.
- **New Relic license key**, **Blackfire credentials**.

Row shape: `<REDACTED — last rotated 2026-08-01, SLA 90d, status fresh>`.
Payment keys typically carry a 180d SLA; call out per-key SLAs.

## Infrastructure diffs for Commerce PaaS

- **PHP-FPM workers** — `pm.max_children` per node; must scale with
  checkout RPS.
- **MySQL replica count** — read-only replicas for catalog reads;
  under-provisioned Prod = catalog-page latency.
- **RabbitMQ consumer count** — `queue:consumers:start` concurrency per
  consumer; async order processing lag if too low.
- **Redis size** — session, default cache, page cache pools; OOM
  evictions if under-sized.
- **Fastly PoP list** — regional edge availability differences.
- **Cron worker count** — indexer + reindex + queue processors.

## Risk assessment per diff category

- Config diffs: MEDIUM-HIGH (many Commerce configs require
  `cache:clean` or `setup:upgrade`).
- Env-var diffs: LOW (non-secret) / HIGH (payment or crypt-key).
- Feature-flag diffs: HIGH (payment/carrier toggles = revenue impact).
- Secret rotation gaps: CRITICAL for payment keys past their SLA.
- Infrastructure diffs: HIGH (checkout capacity is directly tied to
  PHP-FPM + Redis + MySQL sizing).

## 2 worked env-diff examples for Commerce PaaS

**Stage → Prod, v2.5.0 checkout revamp.** 5 `env.php` deltas (3
intended: new cache_types entries; 2 orphan: `session.save_path`
differs — should be identical for shared session infra), 2 admin config
deltas (`checkout/options/display_billing_address_on` on in Stage,
off in Prod — intended), 1 Fastly VCL delta (custom rate-limit rule
added to Stage only — must promote before ship), 1 secret gap (Adyen
HMAC rotated in Stage 2026-06-01, Prod still 2026-01-01 — 220d overdue
against 180d SLA), infrastructure: Prod PHP-FPM = 40 workers, Stage =
20 (intended for load). **Critical action:** rotate Adyen HMAC in
Prod and promote the Fastly rate-limit VCL before deploy.

**Stage → Prod, catalog-tax rate rebuild.** 0 `env.php` deltas, 12
admin config deltas under `tax/*` (all intended — new tax zones), 0
Fastly deltas, 0 secret deltas, 0 infra deltas, but 3 `config.php`
module state deltas (`Vendor_TaxOverride` enabled in Stage only).
**Critical action:** confirm `Vendor_TaxOverride` promotion via
`app:config:import` on Prod deploy.

## Anti-patterns to avoid for Commerce PaaS

- **Printing `crypt->key` or DB passwords** anywhere — always REDACT.
- **Skipping Fastly VCL diff** — VCL is the most common
  silently-drifting surface in a Commerce Cloud project.
- **Diffing `generated/code/*` or `generated/metadata/*`** — these are
  build artifacts, not env config.
- **Comparing `pub/static/*`** — static content is regenerated per
  deploy; diffs are noise.
- **Ignoring `app/etc/config.php` module state** — a module disabled in
  Prod but enabled in Stage will silently skip DI compilation for its
  classes on the Prod deploy.

---

Generate the full env-diff report using `templates/env-diff.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
