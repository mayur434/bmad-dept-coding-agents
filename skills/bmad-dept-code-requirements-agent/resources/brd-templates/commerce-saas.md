# BRD authoring guide — Adobe Commerce SaaS (ACCS / Catalog Service / Live Search / Drop-ins)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a BRD for an Adobe Commerce SaaS (ACCS) project.
Combine with `templates/BRD.md` as the master skeleton.

## Stack-specific personas

- **Storefront consumer (shopper)** — browses the drop-in storefront,
  searches via Live Search, adds to cart, checks out via Adobe Payment
  Services or a headless equivalent.
- **Drop-in developer** — composes storefronts from
  `@dropins/storefront-cart`, `@dropins/storefront-checkout`,
  `@dropins/storefront-order`, and `@dropins/storefront-account`, wiring
  Storefront Events SDK for telemetry.
- **Merchandiser** — configures Live Search rules, synonyms, boosts,
  faceting; manages Catalog Service through the Admin.
- **Integrator / architect** — designs headless topology, wires Payment
  Services, decides between Adobe Commerce SaaS drop-ins and a fully
  headless React/Next.js storefront.

## Stack-specific in-scope patterns

- Catalog Service + Live Search subscriptions and index synchronization.
- Storefront composition using Adobe drop-in web components
  (`@dropins/storefront-*`).
- Storefront Events SDK wiring for analytics + personalization.
- `configs.js` contract (endpoints, headers, feature flags for drop-ins).
- Payment Services (Adobe) or third-party payment integration for headless
  checkout.
- Live Search facet + boost configuration, synonyms, redirect rules.
- Product Recommendations block placement.
- Site-wide CSP + SRI for drop-in JS bundles.
- Fastly edge caching for storefront routes.

## Stack-specific out-of-scope patterns

- **No `app/code`.** SaaS storefront is headless — server-side PHP customization
  is not available.
- Direct writes to Catalog Service — writes go through Admin or Commerce
  APIs.
- Custom drop-in *forks* — use provided extension points; forks lose upgrade
  path.
- Bundling multiple drop-ins into one JS chunk that defeats the
  independent-update model.
- Server-rendered checkout on the SaaS tier — drop-ins ship as client-side
  web components.

## Stack-specific NFRs

**Performance**
- LCP p75 <= 2.5s on top-20 storefront routes.
- INP p75 <= 200ms.
- CLS p75 <= 0.1.
- Cart / Checkout drop-in TTI <= 3.0s on mid-tier mobile hardware
  (Moto G-class).
- Live Search autocomplete p95 <= 250ms.
- Storefront event payload delivery p95 <= 300ms.

**Bundle budgets**
- Individual drop-in bundle: <= 60KB gzipped (JS + CSS).
- Shared runtime + drop-ins on the cart page: <= 200KB gzipped total.
- Zero blocking third-party scripts on the critical path.

**Availability**
- Catalog Service uptime per Adobe SaaS SLA. <!-- verify: current SLA -->
- Live Search index-freshness <= 5 min for catalog updates.
- Payment Services availability per contractual SLA. <!-- verify -->

**Security**
- All drop-ins loaded with `integrity` (SRI) and `crossorigin="anonymous"`.
- CSP disallows `unsafe-inline` for scripts in the checkout / account
  route.
- PCI-DSS SAQ-A (or SAQ-EP if using tokenization vaults) via Adobe Payment
  Services.
- Storefront Events SDK payload contains no PII beyond consented identifiers.

## Stack-specific integration points

| System | Direction | Notes |
|---|---|---|
| Catalog Service | inbound | product data + facets |
| Live Search | inbound | search + autocomplete + recommendations |
| Product Recommendations | inbound | rec surfaces |
| Payment Services (Adobe) | outbound | checkout tokenization + auth/capture |
| Adobe Analytics | outbound | Storefront Events SDK -> Analytics |
| Adobe Target | outbound | Storefront Events SDK -> Target |
| Adobe Commerce (Admin / API tier) | outbound | order write-back, inventory queries |
| CMS (EDS / AEM headless) | inbound | non-catalog content composition |
| Identity provider (IMS / SSO for merchandiser Admin) | inbound | Admin login |

## Stack-specific success KPIs

- Drop-in load time (LCP / INP) trending toward budgets on top-20 routes.
- Search-to-cart conversion rate (Live Search sessions -> add-to-cart).
- Catalog-index freshness percentile (p95, p99).
- Storefront Events SDK ingest-loss rate (should be <1%).
- Drop-in bundle size trend release-over-release (should not grow).

## Stack-specific risks

- **Drop-in version drift** — different drop-ins loading incompatible
  runtime versions and clobbering each other's state.
- **Live Search index staleness** — merchandising rule changes not
  propagating to autocomplete within the freshness SLO.
- **Third-party script blast radius** — a tag-manager rule injecting a
  render-blocking script into the checkout drop-in.
- **PCI scope expansion** — a bespoke checkout that stops using Payment
  Services and lands the merchant in SAQ-D.
- **Event schema breakage** — a Storefront Events SDK upgrade dropping a
  field the analytics team depends on.

## Stack-specific compliance

- **PCI-DSS** — SAQ-A when using Adobe Payment Services with hosted /
  tokenized fields.
- **GDPR / CCPA** — consent surface must gate Storefront Events SDK
  emission; consent-mode integration with Analytics + Target.
- **WCAG 2.2 AA** — drop-ins ship with baseline a11y; validate composed
  routes end-to-end.
- **Data-residency** — Adobe Commerce SaaS region choice per contract.
  <!-- verify: current region list -->

## Example BRD sections for Adobe Commerce SaaS

**Executive summary example.**
> The DTC storefront migrates from a legacy Magento 2 monolith to Adobe
> Commerce SaaS composed of Cart, Checkout, and Order drop-ins fronted by
> Edge Delivery Services for content. Success is measured as: (1) LCP p75
> <= 2.5s on the top-20 landing pages, (2) cart drop-in TTI <= 3.0s on
> Moto-G-class hardware, (3) Live Search autocomplete p95 <= 250ms, (4)
> zero drop-in bundle-size regressions release-over-release.

**In-scope example.**
> Composition of `@dropins/storefront-cart`, `@dropins/storefront-checkout`,
> and `@dropins/storefront-account`. `configs.js` wiring per environment
> (staging / preprod / prod). Storefront Events SDK integration with Adobe
> Analytics + Target via consent-aware emission. Live Search rules for the
> top-100 category pages (facets, boosts, synonyms).

**NFR example.**
> **NFR-Perf-2** — Cart drop-in must reach interactive (TTI) within 3.0s on
> a Moto-G-class device on a 4G Fast connection, measured on the /cart
> route with a warm CDN and no personalization delay. Parent BR: BR-1
> (mobile conversion). MoSCoW: MUST.

---

Generate the full BRD using `templates/BRD.md` as the master skeleton,
populating placeholders with stack-appropriate content from the guide above.
