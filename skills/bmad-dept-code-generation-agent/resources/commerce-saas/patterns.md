# Adobe Commerce SaaS — Generation Patterns

> **Stack:** Commerce-as-a-Cloud-Service — EDS/drop-in storefront + App Builder consuming **Catalog Service**,
> **Live Search**, **Product Recommendations**, **Data Connection**. No `app/code`; the surface is storefront JS,
> integration JS (GraphQL), config, and App Builder actions. Audit rules:
> `bmad-dept-code-audit-agent/resources/rule-packs/commerce-saas/`.
>
> **Deterministic scaffolder:** `run.ts --scaffold --engine commerce-saas --type <t> --name <Name>` →
> `catalog-query` (Catalog Service GraphQL module) · `storefront-block` (drop-in block + css).

## Service integration
- **Catalog Service / Live Search** via GraphQL. Required headers: `Magento-Environment-Id`,
  `Magento-Store-View-Code`, `Magento-Website-Code`, `x-api-key` (**public** key only client-side). Read all of
  these from the **storefront config**, never hardcode `environmentId`/endpoints (see CSAAS-CFG-001/002).
- Handle the GraphQL `errors[]` array, not just HTTP status. Request only the fields you render.
- **Privileged** operations (write, admin, integration token) go through an **App Builder action** with the
  secret in env — never client-side.

## Storefront (drop-ins)
- Use `@dropins/storefront-*` components + `@dropins/tools/event-bus.js`; don't hand-roll cart/checkout state.
- Sanitize URL params (`sku`, `q`, category id) before using in queries or the DOM.
- Keep PDP/PLP fast (LCP): defer non-critical drop-ins; cache Catalog Service responses where allowed.

## Data Connection / events
- Storefront Events SDK: gate collection on the consent signal; don't put secrets/PII beyond consent in event
  context. Server-side event/webhook consumers must verify the HMAC signature and be idempotent (dedupe on event id).

## Portability
- Keep the data layer behind the configured client so a **PaaS ↔ SaaS** switch is config-only.

## Testing
- Mock the GraphQL client + `@dropins/tools/event-bus.js`; Jest-test the query mapping/error handling and the
  block's render/transform helpers.
