# Env-diff authoring guide — Adobe Commerce SaaS

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an env-diff for an Adobe Commerce SaaS project
(Catalog Service / Live Search / Payment Services / storefront drop-ins).
Combine with `templates/env-diff.md` as the master skeleton.

## Purpose framing

A Commerce SaaS env-diff catches the drift that lives edge-side and in
drop-in config — because the backend is SaaS-managed, the drift surface
is drop-in bundle versions, `configs.js` per-storefront blocks,
Catalog Service tenant configuration, Payment Services credentials, and
API Mesh resolver deltas. Backend platform changes are not diffable
from the project side, but the mesh + drop-in surface absolutely is,
and this is where prod-only regressions typically originate.

## Config-file diff scope for Commerce SaaS

- **`configs.js` per drop-in** (`@dropins/storefront-cart`,
  `@dropins/storefront-checkout`, `@dropins/storefront-order`,
  `@dropins/storefront-account`) — feature-flag object, initialize
  options, event bus wiring.
- **Catalog Service catalog config** — catalog ID, headers,
  environment-scoped `x-magento-environment-id`.
- **Payment Services config** — payment method enable/disable per
  storefront, sandbox vs live endpoint, apple-pay merchant ID.
- **Storefront-events config** per drop-in tenant — event forwarding
  destinations (Analytics/Adobe Experience Platform).
- **API Mesh source configs** — `mesh.json` sources array,
  `additionalTypeDefs`, `additionalResolvers` per env-scoped mesh.
- **IMS client config** — client ID + scopes per drop-in surface.
- **Live Search widget config** — facet definitions, sort options,
  merchandising rule bindings per env.

## Env-var diff conventions for Commerce SaaS

- Non-sensitive: `ADOBE_COMMERCE_ENVIRONMENT_ID`,
  `COMMERCE_CATALOG_TENANT_ID`, `DROPIN_FEATURE_*` toggles,
  `STOREFRONT_ROOT_URL`.
- Sensitive (REDACTED): `ADOBE_COMMERCE_API_KEY`, IMS client secrets,
  Payment Services merchant credentials, storefront-events destination
  auth tokens.
- The env-diff should treat `configs.js` build-time inlined values as
  env-vars-in-disguise — bundle-inspected values often differ across
  envs when the build ran with different `.env.<env>` files.

## Feature-flag state comparison

- **Drop-in feature flags** — each drop-in exposes a `features` map in
  `configs.js` (e.g. `checkout.features.expressPayments`,
  `cart.features.giftOptions`). Diff must resolve the effective per-env
  map.
- **Storefront config JSON** loaded at runtime (helix-config or
  equivalent) — flag-shaped fields like `enable-live-search`,
  `enable-payment-services`.
- **API Mesh resolver toggles** — `enabled: true/false` on individual
  additional resolvers per env.
- **Catalog Service merchandising rule enable/disable** per tenant.

Example `--env stage --to-env prod` presentation:

> `checkout.features.expressPayments` — Stage `true`, Prod `false`.
> Owner: checkout-team. Note: awaiting Apple Pay cert approval for Prod.

## Secret-rotation diff (redacted)

- **IMS client secrets** per drop-in — rotation SLA typically 90d.
- **Payment Services merchant credentials** per storefront —
  180d SLA; rotating requires payment-team sign-off.
- **Catalog Service API keys** — 90d SLA.
- **Storefront-events destination tokens** (Adobe Analytics /
  Experience Platform) — 90d SLA.

Row shape: `<REDACTED — last rotated 2026-08-01, SLA 90d, status fresh>`.
Never emit raw values; SaaS credentials rotate through the Developer
Console and appear only as opaque handles at build time.

## Infrastructure diffs for Commerce SaaS

Infrastructure is largely SaaS-managed; the diffable surface:

- **Drop-in bundle CDN cache TTL** — cache-control on
  `@dropins/storefront-*` bundles per env.
- **Catalog Service tier** — throughput tier per tenant (may differ
  Stage vs Prod intentionally).
- **API Mesh tier** — concurrent request cap per environment.
- **Storefront edge cache TTL** for API responses forwarded through
  the mesh.
- **Live Search index refresh cadence** per tenant.

## Risk assessment per diff category

- Config diffs: MEDIUM (drop-in reloads on next page navigation).
- Env-var diffs: LOW (non-secret) / HIGH (payment or IMS secret).
- Feature-flag diffs: HIGH (drop-in flags directly gate revenue
  surfaces — cart, checkout, payment).
- Secret rotation gaps: CRITICAL for payment or IMS past SLA.
- Infrastructure diffs: MEDIUM (SaaS-managed capacity absorbs most
  drift, but mesh tier caps are real).

## 2 worked env-diff examples for Commerce SaaS

**Stage → Prod, v2.5.0 checkout drop-in bump.** 3 `configs.js`
deltas (2 intended: `checkout.features.expressPayments` on in Stage;
1 orphan: `checkout.telemetry.debug=true` in Stage — must strip before
promoting), 1 API Mesh source added in Stage (`loyalty-rewards`
resolver — intended), 1 Payment Services delta (Apple Pay merchant ID
present in Stage, absent in Prod — MUST resolve), 1 secret rotation
gap (IMS client secret for cart drop-in rotated in Stage 2026-06-01,
Prod 2026-01-01 — 220d overdue against 90d SLA), infrastructure:
identical. **Critical action:** register Apple Pay merchant ID in
Prod and rotate the IMS client secret before promoting.

**Stage → Prod, Live Search facet update.** 0 `configs.js` deltas, 4
Live Search facet-config deltas (all intended for release), 0 mesh
deltas, 0 secret deltas, but 1 infra delta (Live Search index refresh
cadence set to 5min in Stage vs 30min in Prod — intentional).
**Critical action:** none blocking; verify facet index freshness in
Prod at the 30min cadence during rollout.

## Anti-patterns to avoid for Commerce SaaS

- **Printing IMS client secrets or Payment Services credentials** in
  the diff — always REDACT.
- **Diffing `@dropins/*` bundle content** — compare package.json
  versions, not the minified bundle bytes.
- **Ignoring `configs.js` telemetry flags** — a stage-only `debug=true`
  leaks PII if it ships to Prod.
- **Comparing catalog headers case-sensitively** — `x-magento-*`
  headers are case-insensitive per HTTP spec; normalize before diff.
- **Treating SaaS-managed backend as "no drift"** — flag mesh source
  drift and drop-in version drift explicitly; those are the surfaces
  the project owns.

---

Generate the full env-diff report using `templates/env-diff.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
