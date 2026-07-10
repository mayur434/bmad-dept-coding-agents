# Adobe Commerce SaaS Rules

> **Stack identity:** Adobe Commerce as a Cloud Service (SaaS) — an EDS/drop-in storefront + App Builder
> consuming SaaS services: **Catalog Service**, **Live Search**, **Product Recommendations**, **Data
> Connection** (event forwarding), and the **Storefront Events SDK**. There is no Magento `app/code` tree;
> the "code" is storefront JS (drop-ins/blocks), integration JS (GraphQL to the SaaS services), config, and
> App Builder actions. Distinct from Commerce **PaaS** (PHP modules) and from plain EDS.
>
> **Tier-1 scanner:** `scripts/engines/commerce-saas/` (auto-detected via the SaaS markers — Storefront Events
> SDK, `Magento-Environment-Id`, `catalog-service.adobe.io`). Tags below marked `[scanner: …]` are deterministic.

---

### CSAAS-SEC-001: No private/admin credentials in storefront code `[scanner: CSAAS-SEC-001]`

- **Severity**: Critical
- **Description**: Only the **public** Catalog Service / Live Search `x-api-key` is meant to be client-side.
  An `Authorization`/`Bearer`, integration token, or admin token literal in storefront JS leaks a privileged
  Commerce credential to every visitor.
- **Detect**: `Authorization`/`Bearer`/`integration-token`/`admin-token` literal in `blocks/`/`src/` JS.
- **Good**: public api-key only client-side; privileged calls go through an App Builder action with secrets in env.
- **Remediation**: move privileged calls server-side; inject the public key via config; rotate any leaked token.

---

### CSAAS-CFG-001: No private secrets committed in config `[scanner: CSAAS-CFG-001]`

- **Severity**: Critical
- **Description**: `integration_token` / `admin_token` / private keys in `config.json` / `commerce.env.json` /
  `.env` ship in VCS. Only public storefront values belong in committed config.
- **Remediation**: externalize private secrets (App Builder secrets / env); commit only `environmentId`,
  `storeViewCode`, and the public api-key.

---

### CSAAS-CFG-002: Externalize SaaS endpoints & environment id `[scanner: CSAAS-CFG-002]`

- **Severity**: Medium
- **Description**: Hardcoding `catalog-service.adobe.io`/`commerce.adobe.io` endpoints or `Magento-Environment-Id`
  in JS makes stage→prod promotion error-prone and causes environment bleed.
- **Remediation**: read endpoints + environmentId from the storefront config.

---

### CSAAS-SEC-003: Verify Data Connection / eventing webhook signatures `[scanner: CSAAS-SEC-003]`

- **Severity**: High
- **Description**: Commerce Data Connection / eventing webhooks must be HMAC-signature-verified before the
  handler acts, else events are forgeable. (Shares the App Builder `APPB-EVT-001` pattern.)
- **Remediation**: verify the signature (aio-lib-events / `crypto.timingSafeEqual`) and make handling idempotent.

---

## Tier-2 (semantic) checks — verify by reading

- **Catalog Service / Live Search queries:** request only needed fields; handle `errors[]` in the GraphQL
  response; send the required headers (`Magento-Environment-Id`, `Magento-Store-View-Code`,
  `Magento-Website-Code`, `x-api-key`); apply Live Search query rules/facets server-appropriately.
- **Storefront Events SDK / Data Connection:** don't collect PII beyond consent; gate on the consent signal;
  don't forward secrets in event context.
- **Performance:** PDP/PLP are commonly LCP — defer non-critical drop-ins; cache Catalog Service responses where
  allowed; avoid N+1 product-search calls.
- **Drop-ins:** use official `@dropins/storefront-*` components + the event bus rather than bespoke state;
  sanitize URL params (`sku`, `q`, category id) before use.
- **PaaS↔SaaS portability:** keep the data layer behind the configured client so a PaaS/SaaS switch is config-only.
