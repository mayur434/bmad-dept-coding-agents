# Env-diff authoring guide — EDS + Commerce hybrid

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an env-diff for an EDS + Commerce hybrid
project (Edge Delivery Services storefront wired to Commerce SaaS
Catalog Service / Live Search / Payment Services via drop-ins).
Combine with `templates/env-diff.md` as the master skeleton.

## Purpose framing

An EDS+Commerce env-diff catches the drift on both sides of the seam:
EDS sheet-config and edge scripts on the storefront side, and drop-in
bundle versions + `configs.js` + Catalog Service tenant configuration
on the Commerce side. Because a single release ships coupled changes
to both, the diff must be presented as one report — with the seam
explicitly called out so the reviewer sees when an EDS change
depends on a Commerce-side change that hasn't promoted yet.

## Config-file diff scope for EDS+Commerce

- **All EDS config** (`paths.json`, `helix-config.json`,
  `helix-query.yaml`, `head.html`, `fstab.yaml`, `redirects.xlsx`,
  `metadata.xlsx`, `nav.xlsx`, sheet-based content configs).
- **Drop-in `configs.js`** per storefront drop-in
  (`@dropins/storefront-cart`, `-checkout`, `-order`, `-account`).
- **Consent-mode config** per env — cookie/consent script config
  values that gate drop-in initialization.
- **Catalog Service catalog config** — catalog ID, environment ID,
  headers per env.
- **Payment Services config** per storefront.
- **Storefront-events config** — event forwarding wiring to
  Analytics / AEP.
- **`head.html` script includes** for drop-in bootstrap — this is the
  seam file where EDS meets Commerce.
- **`package.json`** drop-in version pins.

## Env-var diff conventions for EDS+Commerce

- Non-sensitive: `ADOBE_COMMERCE_ENVIRONMENT_ID`,
  `COMMERCE_CATALOG_TENANT_ID`, `STOREFRONT_ROOT_URL`,
  `DROPIN_FEATURE_*`.
- Sensitive (REDACTED): IMS client secrets, Payment Services
  credentials, storefront-events destination auth tokens.
- EDS side has no code-side env vars — sensitive material found on
  the EDS side is a CRITICAL misconfiguration.
- Drop-in build-time inlined values from `.env.<env>` — check bundle
  output for accidentally-inlined secrets.

## Feature-flag state comparison

- **Drop-in feature flags** per drop-in `configs.js` — cart, checkout,
  order, account flags.
- **EDS sheet-based flags** — `metadata.xlsx` values gating drop-in
  init in `head.html`.
- **Storefront config JSON** loaded at runtime — helix-config-scoped
  runtime flags.
- **Catalog Service merchandising rule enable/disable** per tenant.
- **Payment Services method enable/disable** per storefront.
- **Consent-mode gating flags** — drop-ins that only initialize after
  consent granted.

Example `--env preview --to-env live` presentation:

> `checkout.features.expressPayments` (Preview drop-in `configs.js`
> `true` / Live `false`) **AND** `head.html` script include for
> `express-payments-init.js` present in Preview only. Owner:
> checkout-team. Note: both sides must promote together.

## Secret-rotation diff (redacted)

- **IMS client secrets** per drop-in — 90d SLA.
- **Payment Services merchant credentials** — 180d SLA.
- **Catalog Service API keys** — 90d SLA.
- **Storefront-events destination tokens** (Adobe Analytics / AEP) —
  90d SLA.
- **Helix admin tokens** (CI-side) — 90d SLA.

Row shape: `<REDACTED — last rotated 2026-08-01, SLA 90d, status fresh>`.
Never emit raw values. Any secret material found on the EDS edge side
= CRITICAL misconfiguration; rotate immediately.

## Infrastructure diffs for EDS+Commerce

- **EDS edge cache TTL** on storefront pages.
- **Drop-in bundle CDN cache TTL** — cache-control on
  `@dropins/storefront-*` bundles.
- **Catalog Service tier** per tenant.
- **API Mesh tier** per workspace (if the project wires a mesh).
- **Live Search index refresh cadence** per tenant.
- **Payment Services regional endpoint** per env.

## Risk assessment per diff category

- Config diffs: MEDIUM (drop-in reloads on next nav; EDS sheet edits
  invalidate on preview / live push).
- Env-var diffs: LOW (non-secret) / HIGH (payment / IMS) / CRITICAL
  (edge-side secret).
- Feature-flag diffs: HIGH — drop-in + EDS seam flags gate revenue
  surfaces (cart, checkout, payment).
- Secret rotation gaps: CRITICAL for payment or IMS past SLA.
- Infrastructure diffs: MEDIUM (SaaS-managed capacity absorbs most
  drift; drop-in CDN TTL diffs occasionally matter).

## 2 worked env-diff examples for EDS+Commerce

**Preview → Live, v2.5.0 express-payments launch.** 2 drop-in
`configs.js` deltas (`checkout.features.expressPayments=true` in
Preview only — target of release), 1 `head.html` script-include
delta (`express-payments-init.js` in Preview only — must promote
together), 1 Payment Services delta (Apple Pay merchant ID present
in Preview, absent in Live — MUST register in Live before promoting),
1 secret gap (IMS client secret for checkout drop-in rotated in
Preview 2026-06-01, Live 2026-01-01 — 220d overdue against 90d SLA
— CRITICAL), 3 `metadata.xlsx` deltas (all intended feature-copy
edits), infrastructure: identical. **Critical action:** register
Apple Pay merchant ID in Live, rotate IMS client secret, promote
`head.html` and `configs.js` together in a single push.

**Preview → Live, catalog tenant swap for regional launch.** 0
drop-in `configs.js` deltas at feature level, 1 Catalog Service
tenant delta (Live points at `us-east` tenant, Preview at `eu-west`
— intentional for regional QA), 0 secret deltas, 0 `head.html`
deltas, 2 `redirects.xlsx` deltas (region-specific product URLs —
intended). **Critical action:** confirm tenant swap coordination
with Catalog Service team before ship.

## Anti-patterns to avoid for EDS+Commerce

- **Printing IMS or Payment Services credentials** — always REDACT;
  any occurrence on the EDS side = CRITICAL.
- **Promoting drop-in `configs.js` without the paired `head.html`
  change** — the seam files must promote together or the storefront
  boots with broken references.
- **Diffing `@dropins/*` bundle bytes** — compare `package.json`
  version pins, not minified bundles.
- **Ignoring Catalog Service tenant ID in `configs.js`** — tenant-ID
  drift silently serves the wrong catalog.
- **Skipping consent-mode config** — a drop-in that initializes
  before consent leaks PII to Analytics on Live pages.
- **Treating EDS side and Commerce side as separate diffs** — always
  present them together and highlight seam couplings.

---

Generate the full env-diff report using `templates/env-diff.md` as the
master, populating placeholders with stack-appropriate content from the
guide above.
