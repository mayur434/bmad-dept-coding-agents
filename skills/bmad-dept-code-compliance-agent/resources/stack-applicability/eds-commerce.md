# Compliance applicability guide — EDS + Commerce (Edge Delivery Services + Commerce drop-in)

## Purpose framing

EDS + Commerce is Edge Delivery Services' storefront rendering combined
with Commerce SaaS's Drop-in checkout/product components embedded into
the page. Its compliance profile is a **direct composite**: everything
in `eds.md` applies to the edge-rendered storefront surface, and
everything in `commerce-saas.md`'s PCI/GDPR-heavy applicability applies
specifically to the Drop-in integration surface embedded within it. The
important nuance is that these two applicability profiles don't blend
into one medium rating — they **coexist at different severities on
different parts of the same page**.

## Framework applicability matrix for EDS + Commerce

| Framework | Applicability | Primary trigger | Typical evidence source |
|---|---|---|---|
| CWE | Medium–Heavy | Medium on general EDS block JS (per `eds.md`); heavy specifically on the Drop-in checkout/cart integration code (per `commerce-saas.md`). | `audit` findings tagged `EDS-SEC-*` (general) and `CSAAS-SEC-*`/`COMM-SEC-*` (Drop-in surface). |
| OWASP | Medium–Heavy | Same split — general page surface is medium, Drop-in integration surface is heavy (payment tokens, cart-state handling). | `sonar-scan` findings segmented by page-surface vs. Drop-in bundle. |
| CIS | Medium | EDS's access-control/publish-pipeline safeguards apply across the whole site; Commerce-side infra safeguards shift to Adobe's managed platform per `commerce-saas.md`. | Git repository access controls + Commerce SaaS integration credential rotation records. |
| PCI-DSS | Heavy (scoped to Drop-in surface) | The general EDS page carries no PCI applicability on its own (per `eds.md`); the moment a Drop-in checkout/cart component is embedded, that specific bundle inherits Commerce SaaS's heavy PCI applicability — commonly SAQ A or A-EP. | `audit`/`sonar-scan` findings on the Drop-in bundle specifically; SAQ type confirmed by the merchant. |
| HIPAA | Light | Same rationale as pure EDS — applicable only if the site is confirmed to handle PHI, independent of the commerce integration. | Human-confirmed applicability only. |
| GDPR | Heavy | Both halves contribute — EDS's consent/analytics surface (per `eds.md`) plus Commerce's customer-PII/order-history surface (per `commerce-saas.md`) compound into a heavy rating across the whole site. | Consent-management-platform integration + Drop-in customer-data handling code. |
| SOX | Light–Medium | Light on the general EDS surface; medium if the Commerce integration feeds recognized-revenue reporting, same trigger as `commerce-saas.md`. | Order-data export/reporting integration, if in scope. |
| ISO 27001 | Medium | Composite of both stacks' medium ratings — technical controls observable on both the content and the Drop-in integration surface. | Git repository access controls + Drop-in integration deployment audit trail. |

## Shared-responsibility notes for EDS + Commerce

Two separate shared-responsibility boundaries stack here rather than
merge into one. EDS's edge/CDN and transformation pipeline are
Adobe-managed (see `eds.md`); Commerce SaaS's payment processing and
core commerce backend are separately Adobe-managed (see
`commerce-saas.md`) <!-- verify: confirm whether Adobe publishes a
unified compliance-certification scope for the combined EDS+Commerce
integration path, or whether each platform's certification remains
independently scoped, before citing either in an externally-facing
artifact -->. The customer is responsible for both integration
surfaces independently: the EDS-side consent/analytics/block-JS
hygiene, AND the Drop-in checkout embedding, token handling, and
version currency. Treating "it's all Adobe-managed" as a blanket
assumption is the most common — and most consequential — mistake on
this stack, precisely because it combines two platforms where that
assumption is already individually wrong.

## Stack-specific evidence sources

- Git commit history for the EDS content/block repository (inherent audit trail, per `eds.md`).
- Consent-management-platform (CMP) logs.
- Drop-in bundle version-pin record and its update/patch history.
- Webhook-signature-verification code path for Commerce order events, if the integration includes server-side event handling.
- Commerce SaaS integration credential rotation records.
- Edge/CDN cache-configuration rules (cache-key definitions, TTLs) for any page fragment touching cart or checkout state.

## Stack-specific common gaps

- Missing consent-gate before analytics/marketing scripts load — same EDS-baseline gap, still present once commerce is added (GDPR).
- Drop-in checkout bundle pinned to an outdated version embedded in an EDS block (CWE — stale dependency / PCI Req 6.3), harder to spot because it's nested inside a content block rather than a dedicated storefront repo.
- Cart/checkout state exposed in client-side JS state without redaction on a page that's otherwise cached at the edge — a caching-layer-specific GDPR risk unique to this composite stack (cached pages must not leak one customer's cart data to another).
- Unverified webhook signatures on inbound Commerce order events, if server-side handling exists in the integration (`CSAAS-SEC-003`, PCI Req 6.2/4).
- Inline scripts on commerce pages (product/cart/checkout blocks) without CSP nonces, same as general EDS but higher-stakes given the payment-adjacent context (OWASP A05).
- No clear internal documentation of which parts of the page are "EDS content" vs. "Commerce Drop-in" for compliance-scoping purposes — a recurring first-run finding on this stack specifically.
- Drop-in component mounted on a page that is otherwise fully static-cacheable, with no explicit review of whether the mount point itself leaks the cache boundary (PCI Req 4 / GDPR Art. 32 — a subtle architectural gap, not a single-line fix).
- SAQ type not reconfirmed after adding the Drop-in integration to an existing EDS site — teams sometimes treat the addition as "just a content change" and skip the PCI scoping conversation entirely.

## Stack-specific compliance quick-wins

- Add explicit cache-key segmentation (or `no-store`) on any edge-cached page fragment containing cart/checkout state — closes the caching-specific GDPR risk unique to this stack.
- Pin and actively track the Drop-in bundle version the same way as pure Commerce SaaS — closes PCI Req 6.3 gaps.
- Gate analytics/marketing scripts behind the CMP consent signal site-wide, including on commerce pages — closes the GDPR gap inherited from the EDS half.
- Document which page regions are EDS-authored content vs. Commerce Drop-in surface in the project's `.bmad/conventions.yaml` — the single highest-leverage fix for correctly scoping every subsequent compliance run on this stack.
- Re-run the PCI SAQ-scoping conversation explicitly whenever a Drop-in component is newly added to an EDS page — a five-minute confirmation that prevents an entire compliance run from silently under-scoping PCI.

## Worked scenario for EDS + Commerce

A retailer runs its marketing and category pages on EDS, with a
Commerce SaaS Drop-in cart-and-checkout flow embedded on product and
cart pages, plus the standard analytics/marketing tag stack across the
whole site.

Likely-applicable frameworks: PCI-DSS (heavy, scoped to the Drop-in
cart/checkout bundle only — SAQ A-EP confirmed given the JS-embed
integration method), GDPR (heavy across the whole site — both the
analytics-consent gap and the Drop-in's customer-PII handling
contribute), CWE/OWASP (medium on general content pages, heavy on the
Drop-in surface), CIS/ISO 27001 (medium), SOX (light — no
revenue-reporting integration confirmed), HIPAA (light, no signal).

A first compliance report run would likely surface: an outdated
Drop-in bundle version on the product-page block (PCI Req 6.3, HIGH),
missing consent-gating on the site-wide analytics tag (GDPR, HIGH,
pure-gap row), and a caching-configuration finding — cart-state HTML
fragments served from a shared edge cache without a `no-store`/
segmented cache key, a GDPR Art. 32 gap specific to combining an
edge-cached content stack with a stateful checkout flow.

Merging 13 findings across the general EDS surface and the Drop-in
integration, a representative outcome is: 7 controls covered, 5 gaps
(the three above plus a missing CSP nonce on the checkout block and an
unpinned Drop-in dependency), and 1 control marked N/A (PCI Req 1,
infra-level). Notably, the two constituent stacks' findings should stay
visually segmented in the report — a CRITICAL PCI gap on the Drop-in
bundle and a MEDIUM GDPR gap on the general content pages carry very
different urgency, and collapsing them into one undifferentiated
"EDS+Commerce" severity count would understate how much of the risk is
concentrated in the narrow checkout surface.

## Cross-references

See `resources/stack-applicability/eds.md` and
`resources/stack-applicability/commerce-saas.md` for the two
constituent profiles this guide composites. Framework guides: see
`resources/framework-mappings/pci.md` (heavy, Drop-in-scoped),
`resources/framework-mappings/gdpr.md` (heavy), `resources/framework-mappings/cwe.md`
and `resources/framework-mappings/owasp.md` (medium–heavy split),
`resources/framework-mappings/cis.md` and `resources/framework-mappings/iso27001.md`
(medium).

Use this guide alongside `resources/framework-mappings/<framework>.md` when
generating a control-mapping report scoped to EDS + Commerce.
