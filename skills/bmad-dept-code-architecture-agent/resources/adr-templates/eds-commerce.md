# ADR authoring guide — EDS + Commerce (hybrid)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating an ADR for an EDS + Adobe Commerce SaaS hybrid
project (EDS storefront + `@dropins/storefront-*` drop-ins + Catalog
Service / Live Search / Payment Services). Combine with `templates/ADR.md`
as the master skeleton — and read the standalone `eds.md` and
`commerce-saas.md` guides for the underlying concerns.

## Stack-specific decision categories

- **Drop-in wiring pattern** — where drop-ins mount on EDS pages
  (`blocks/product-details/product-details.js` bootstraps
  `@dropins/storefront-pdp`; `blocks/cart/cart.js` bootstraps
  `@dropins/storefront-cart`), and how state flows between EDS blocks and
  drop-in state.
- **Cart state persistence** — localStorage only (drop-in default) vs
  server-side session vs commerce-backend cart-id + retrieval on load.
- **Auth token exchange** — anonymous vs IMS-authenticated shopper; how
  IMS token exchanges into a Commerce customer session; guest
  checkout vs registered checkout.
- **Product picker approach** — Catalog Service `productSearch` vs Live
  Search widget vs custom block over API Mesh.
- **Consent-mode + PII redaction** — where Storefront Events emit
  (drop-in-internal) and where they get consumed (Launch, Storefront
  Events SDK, custom bus); PII redaction pipeline.
- **Configs contract** (`configs.js`) — how per-environment values
  (endpoints, IMS org, region, feature flags) are surfaced to drop-ins
  and EDS scripts without leaking secrets.
- **Middleware placement** — API Mesh for read composition; App Builder
  actions for write composition (post-order enrichment, entitlements).
- **Payment flow** — Adobe Payment Services drop-in vs external gateway
  drop-in (Braintree / Adyen); PCI surface.

## Common constraints (stack-specific)

- **All EDS constraints** — no build step for EDS core, 100KB critical
  JS budget, LCP <= 2.5s, INP <= 200ms, CLS <= 0.1, edge-cached.
- **Drop-in extension** boundaries — slot API is stable, forking breaks
  upgrades.
- **Storefront Events schema** — pinned by drop-in version; consumers
  must handle bumps.
- **Adobe Commerce SaaS** capability set — cannot modify Catalog Service /
  Live Search / Payment Services.
- **PCI scope** — Payment Services drop-in keeps merchant in SAQ-A;
  custom payment flows push toward SAQ-D-Merchant.
- **Region alignment** — EDS edge worker, Commerce SaaS region, and any
  App Builder middleware should all sit in the same region.
- **Auth surface** — IMS shopper login is a separate flow from Commerce's
  customer login; exchange only if both are used.

## Common alternatives (stack-specific)

### Drop-in wiring
- **Direct mount in EDS block** — `blocks/pdp/pdp.js` imports
  `@dropins/storefront-pdp` and mounts on `#pdp-root`.
- **Auto-block via metadata** — page metadata drives which drop-in
  mounts; EDS auto-blocks the container div.
- **Composition (drop-in + custom slot)** — drop-in provides core;
  custom EDS block fills a slot for merchant-specific UI.

### Cart persistence
- **LocalStorage (drop-in default)** — offline-tolerant; not
  cross-device; may leak stale state.
- **Server-side session via cart-id** — cross-device; requires backend
  session store or Commerce cart-token cookie.
- **Hybrid** — cart-id cookie identifies; localStorage caches; sync on
  navigation.

### Product picker
- **Catalog Service** `productSearch` — precise; needed for filtered PLPs
  with strict facet fidelity.
- **Live Search widget** — ML-ranked; managed relevance; ships turnkey UI.
- **Custom block over API Mesh** — for cross-source composition (e.g.
  Catalog + PIM merged rows).

### Consent-mode
- **Storefront Events → Launch (via extension)** — turnkey; consent-mode
  respected via Launch.
- **Storefront Events → custom consent-aware bus → Analytics** — for
  organizations not on Launch.
- **Drop-in-internal only, no forward** — simplest; loses cross-tool
  attribution.

### Auth exchange
- **Guest checkout only** — simplest; no exchange; no CRM identifier.
- **Commerce customer login only** — traditional; no IMS involvement.
- **IMS + Commerce** — corporate SSO; requires an exchange endpoint
  (typically an App Builder action).

## Decision drivers for EDS + Commerce

- **All EDS drivers** (LCP, CLS, INP, Lighthouse mobile).
- **Drop-in bundle size** as a slice of the 100KB critical budget —
  measure per drop-in adopted.
- **Storefront Events adoption depth** — mandatory for consistent
  analytics + real-time segmentation.
- **PCI scope** target (SAQ-A vs SAQ-D-Merchant).
- **Shopper journey complexity** — guest-only vs cross-device
  persistence vs corporate SSO.
- **Middleware appetite** — every custom middleware adds a hop; keep
  paths short.
- **Team split** — is one team owning the storefront + Commerce config,
  or are they separate? Cross-team contracts drive the drop-in wiring
  ADR.
- **Payment method breadth** — Apple Pay, Google Pay, Klarna, PayPal;
  Payment Services coverage matters.
- **Multi-brand / multi-region** — separate configs.js per brand; region
  co-location; catalog scope.
- **Consent-mode regulatory scope** — GDPR / CCPA / CPRA / LGPD.

## Worked ADR examples for EDS + Commerce

**ADR-111 — Direct drop-in mount inside EDS blocks (no auto-block).**
- **Context.** Team debated whether to auto-block drop-in containers via
  page metadata or import + mount them directly inside dedicated EDS
  blocks (`blocks/pdp`, `blocks/cart`, `blocks/checkout`).
- **Options.** (A) Auto-block via metadata, (B) Direct mount in EDS
  block, (C) Global mount in `scripts.js` load-lazy.
- **Decision.** (B). Rationale: block-per-drop-in is discoverable, keeps
  drop-in JS out of load-eager for non-drop-in pages, and mirrors the
  EDS mental model.
- **Consequences.** + drop-in JS only loads on relevant pages, +
  block-scoped CSS + slot-code lives with the block, – authors need to
  explicitly place the drop-in-block on the doc, – auto-block would have
  been zero-touch for authors.

**ADR-112 — Hybrid cart persistence (cart-id cookie + localStorage cache).**
- **Context.** Analytics shows 22% of shoppers open the cart across two
  devices in the same session (mobile → desktop); pure-localStorage
  loses cross-device state.
- **Options.** (A) LocalStorage only, (B) Cart-id cookie + backend
  fetch on load, (C) Hybrid — cart-id cookie identifies; localStorage
  caches; sync on nav.
- **Decision.** (C). Rationale: covers cross-device via cart-id; keeps
  offline optimism via localStorage; single backend round-trip on first
  paint.
- **Consequences.** + cross-device cart continuity, + tolerant of
  offline, – slightly more code (sync reconciliation), – Storefront
  Events may fire twice on hydration if not de-duped.

**ADR-113 — Adobe Payment Services drop-in (keep SAQ-A).**
- **Context.** Regulatory + audit team wants to keep PCI scope at SAQ-A
  (fully hosted / no cardholder data touches merchant JS).
- **Options.** (A) Adobe Payment Services drop-in, (B) Braintree custom
  drop-in, (C) External hosted payment page.
- **Decision.** (A). Rationale: Payment Services drop-in tokenizes in an
  Adobe iframe; SAQ-A applies; supports Apple Pay / Google Pay natively.
- **Consequences.** + SAQ-A preserved, + Apple/Google Pay in-scope,
  – limited to Payment Services supported gateways, – less UI control
  vs custom Braintree implementation.

## Anti-patterns to avoid for EDS + Commerce

- **Loading all drop-ins in `scripts.js` load-eager** — dwarfs 100KB
  critical budget; import per-block.
- **Forking a drop-in for a merchant-branding change** — try CSS-only
  overrides first; slot-based extension second.
- **Storefront Events emitted directly to third-party pixels** —
  bypasses consent-mode; every pixel becomes a compliance surface.
- **Cross-region API calls** — EDS in AMER hitting Commerce SaaS in
  EMEA adds 100+ms; align region.
- **Two separate cart states** (EDS mini-cart + drop-in cart) — sync
  drift; author both against the same drop-in state.
- **Custom payment JS handling PAN** — pushes merchant to SAQ-D-Merchant;
  a much bigger audit surface — think hard before choosing this over
  Payment Services drop-in.

---

Generate the full ADR using `templates/ADR.md` as the master, populating
placeholders with stack-appropriate content from the guide above.
