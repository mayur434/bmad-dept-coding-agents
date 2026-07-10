# EDS + Adobe Commerce (Drop-ins Storefront) — Generation Patterns

> **Stack:** EDS storefront powered by Adobe Commerce (PaaS or SaaS) via the **`@dropins/*`** components and
> the Commerce boilerplate. Builds on the EDS patterns (`resources/eds/patterns.md`) plus Commerce data.
>
> **Deterministic scaffolder:** `run.ts --scaffold --engine eds-commerce --type dropin-block --name <Name>` →
> `blocks/commerce-<name>/commerce-<name>.{js,css}`.

## Data + drop-ins
- Storefront data comes from **Commerce GraphQL** (Catalog / Live Search / Cart / Checkout services for SaaS;
  Luma/Adobe Commerce GraphQL for PaaS). Query via the boilerplate's configured client — don't hand-roll fetch.
- Use official **drop-in components** (`@dropins/storefront-cart`, `-checkout`, `-pdp`, `-product-discovery`, …)
  and the shared **event bus** (`@dropins/tools/event-bus.js`) rather than bespoke state.
- Read endpoints/keys from **configuration** (`configs.json` / `.env` at build), never hardcode API keys or
  the store code in block source.

## Block pattern (commerce)
```js
import { events } from '@dropins/tools/event-bus.js';
export default async function decorate(block) {
  block.classList.add('commerce-<name>');
  // 1. read config (store code, endpoint) from the boilerplate config, not literals
  // 2. mount the relevant drop-in / render container
  // 3. subscribe to events (e.g. 'cart/updated') and update UI
  // 4. validate any query params (sku, category id) before use
}
```

## Security & correctness
- **PaaS vs SaaS:** the same drop-ins target both — keep the data layer behind the configured client so a
  PaaS↔SaaS switch is config-only.
- Sanitize URL params (`sku`, `q`, category id) before using in queries or DOM.
- Never expose admin/integration tokens client-side; only the public storefront GraphQL + API key belong here.
- Keep LCP fast (PDP/PLP are commonly LCP): defer non-critical drop-ins.

## Testing
- Mock `@dropins/tools/event-bus.js` and the GraphQL client; unit-test the block's transform/render helpers with Jest.
