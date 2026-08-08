# BRD authoring guide — EDS + Commerce hybrid

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a BRD for an EDS + Commerce hybrid — Edge Delivery
Services for content pages composing Adobe Commerce SaaS drop-ins on
product / cart / checkout / account routes. Combine with `templates/BRD.md`
as the master skeleton.

## Stack-specific personas

- **Storefront block developer** — writes decorate blocks that mount
  `@dropins/storefront-*` web components, wires the Storefront Events SDK,
  balances EDS bundle discipline with drop-in TTI. Pain: drop-in bundle
  shipping past the eager phase, `configs.js` per-env drift.
- **Merchandiser** — configures Catalog Service, Live Search rules
  (facets, boosts, synonyms), Product Recommendations. Same persona as
  commerce-saas.
- **Content editor** — authors non-commerce pages in Google Docs
  (marketing, blog, help), and product-adjacent content that composes with
  drop-ins. Pain: preview parity between Docs and live storefront routes
  that render drop-ins.
- **Consumer / shopper** — browses content + commerce interchangeably.
  Notices latency spikes on cart / checkout drop-ins.
- **RUM / perf owner** — watches CWV separately for content-only and
  commerce routes; commerce routes have a stricter TTI budget alongside
  the LCP budget.

## Stack-specific in-scope patterns

- All EDS in-scope patterns from `resources/brd-templates/eds.md`.
- Drop-in composition inside EDS blocks (block hosts the drop-in web
  component; block CSS coexists with drop-in shadow-DOM styles).
- `configs.js` wiring per environment for drop-in endpoints
  (Catalog Service, Payment Services, Storefront Events SDK).
- Storefront Events SDK subscription in the lazy phase (never eager).
- Product Recommendations block placement on category and PDP.
- Catalog Service + Live Search fetch patterns on PLP / PDP.
- SRI + `crossorigin="anonymous"` on all `@dropins/*` script tags.
- Consent-mode integration gating events + tags on cart / checkout /
  account routes.

## Stack-specific out-of-scope patterns

- All EDS out-of-scope patterns from `resources/brd-templates/eds.md`.
- Drop-ins on the eager critical path — always mount in `loadLazy()` at
  the earliest.
- Custom checkout replacing Adobe Payment Services drop-in — puts the
  merchant in a higher PCI SAQ.
- Bundling multiple drop-ins together — defeats independent-update.
- Direct writes to Catalog Service from the storefront — writes go through
  Commerce Admin / APIs.

## Stack-specific NFRs

**Core Web Vitals (all routes)**
- LCP p75 <= 2.5s (content routes) / <= 3.0s (drop-in-heavy routes).
- INP p75 <= 200ms.
- CLS p75 <= 0.1.

**Drop-in TTI budgets (commerce routes)**
- `/cart` drop-in TTI <= 3.0s on Moto-G-class hardware.
- `/checkout` drop-in TTI <= 3.5s.
- `/account` drop-in TTI <= 3.0s.

**Bundle budgets**
- Critical-path JS on any route (eager phase) <= 30KB gzipped.
- Individual drop-in bundle <= 60KB gzipped (JS + CSS).
- Shared runtime + drop-ins on cart page total <= 200KB gzipped.

**Data-layer latency**
- Cart-total calculation p95 <= 500ms end-to-end (client -> Commerce ->
  drop-in re-render).
- Live Search autocomplete p95 <= 250ms.
- Catalog Service PDP fetch p95 <= 400ms.

**Availability**
- Edge availability per Adobe / Cloudflare edge SLA.
- Adobe Payment Services availability per contractual SLA.
- Catalog Service uptime per Adobe SaaS SLA.
- Drop-in CDN availability per Adobe SaaS SLA.
<!-- verify: current SLA numbers for each service -->

**Security**
- PCI-DSS SAQ-A via Adobe Payment Services (hosted / tokenized fields).
- CSP + SRI on all drop-in bundles.
- Storefront Events SDK payloads gated by consent; no PII beyond
  consented identifiers.

## Stack-specific integration points

| System | Direction | Notes |
|---|---|---|
| All EDS integrations | | see `resources/brd-templates/eds.md` |
| Catalog Service | inbound | product data + facets |
| Live Search | inbound | search + autocomplete + recs |
| Product Recommendations | inbound | rec surfaces |
| Payment Services (Adobe) | outbound | checkout tokenization |
| Adobe Commerce (Admin / API tier) | bidirectional | order write-back, inventory |
| Storefront Events SDK | outbound | telemetry to Analytics + Target |

## Stack-specific success KPIs

- CWV pass rate on content-only routes AND on commerce routes (tracked
  separately).
- Cart / checkout drop-in TTI vs. budget on mid-tier mobile.
- Search-to-cart conversion (Live Search sessions -> add-to-cart).
- Drop-in bundle-size trend release-over-release.
- Publish-to-live latency for content routes.

## Stack-specific risks

- **Drop-in blocking eager phase** — an accidental `<script>` in the
  eager phase pushing LCP over budget on commerce routes.
- **`configs.js` env drift** — production drop-ins pointing at a staging
  Catalog Service endpoint.
- **Consent-mode gap** — Storefront Events SDK firing before consent is
  captured on cart / checkout.
- **PCI scope expansion** — a bespoke checkout page that bypasses Payment
  Services and lands the merchant in SAQ-D.
- **Bundle-size cascade** — a drop-in upgrade bringing in a new dep that
  regresses the whole page-total budget.
- **Live Search staleness** — merchandising rule not propagating within
  the freshness SLO.

## Stack-specific compliance

- **PCI-DSS** — SAQ-A via Adobe Payment Services (hosted fields).
- **GDPR / CCPA** — consent-mode gate on Storefront Events SDK, tag
  manager, and any personalization drop-in.
- **WCAG 2.2 AA** — content routes and commerce routes; drop-ins ship
  with baseline a11y that must be validated in-composition.
- **Data-residency** — Adobe Commerce SaaS region alignment per contract.

## Example BRD sections for EDS + Commerce hybrid

**Executive summary example.**
> The DTC storefront combines Edge Delivery Services for marketing,
> content, and blog routes with Adobe Commerce SaaS drop-ins for product,
> cart, checkout, and account routes. Success is measured as: (1) LCP
> p75 <= 2.5s on content routes, <= 3.0s on drop-in routes, (2) cart
> drop-in TTI <= 3.0s on Moto-G-class hardware, (3) checkout completion
> p95 <= 3.5s TTI, (4) zero eager-phase drop-in bundles.

**In-scope example.**
> Content routes: `/`, `/about`, `/blog/*`, `/help/*` — pure EDS blocks.
> Commerce routes: `/products/*` (PDP with Catalog Service fetch),
> `/search` (Live Search autocomplete + facets), `/cart` (drop-in),
> `/checkout` (drop-in with Adobe Payment Services), `/account/*`
> (drop-in). Storefront Events SDK wired in the lazy phase, consent-mode
> gated. `configs.js` per environment (staging / preprod / prod).

**NFR example.**
> **NFR-Perf-2** — Cart drop-in TTI on the `/cart` route MUST be <= 3.0s
> on a Moto-G-class device on a 4G Fast connection, measured with a
> warm CDN and no personalization delay. LCP on the same route MUST be
> <= 3.0s p75 in CrUX. Parent BR: BR-1 (mobile conversion). MoSCoW: MUST.

---

Generate the full BRD using `templates/BRD.md` as the master skeleton,
populating placeholders with stack-appropriate content from the guide above.
