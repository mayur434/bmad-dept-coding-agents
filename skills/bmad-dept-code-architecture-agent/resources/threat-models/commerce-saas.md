# STRIDE threat-model authoring guide — Adobe Commerce SaaS (ACCS)

## Purpose framing

An Adobe Commerce SaaS threat model catalogs threats across the
**Storefront ↔ Catalog / Live Search / Payment SDK ↔ Commerce Admin**
surfaces. Adobe owns the backend PCI boundary (Vault, hosted fields);
customer surface is the storefront blocks + drop-in extensions + App
Builder actions. Reference `templates/threat-model-stride.md` for
master shape.

## Typical trust boundaries for Commerce SaaS

- **Consumer ↔ Storefront Edge (EDS / CDN)** — TLS + WAF.
- **Storefront ↔ Catalog Service** — Adobe-managed GraphQL; API key
  auth (public); scoped read-only.
- **Storefront ↔ Live Search** — Adobe-managed; API key.
- **Storefront ↔ Payment SDK iframe** — hosted fields; PCI SAQ-A.
- **Storefront ↔ Commerce Session API** — cart / auth / checkout;
  session token in secure cookie.
- **Storefront ↔ App Builder Runtime** — custom actions via API Mesh
  or direct fetch; IMS or API key.
- **Commerce Admin (backend)** — Adobe-managed; MFA enforced by IMS.
- **Third-party analytics / Launch tags** — Adobe Tags governs; CSP
  gate.

## Assets and data classification for Commerce SaaS

- **Session token** — Confidential; HttpOnly, Secure, SameSite=Lax.
- **Cart contents** — Internal (shipping address if attached).
- **Customer profile** — Restricted.
- **Product catalog** — Public (public storefront).
- **Custom attributes marked "customer only"** — Internal; scope-check.
- **Payment tokens (returned from SDK)** — Restricted; short TTL.
- **API keys (public storefront-callable)** — must be scoped read-only,
  domain-restricted, rotatable.

## Per-component STRIDE table

| Component-Type | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | EoP | Common Mitigations |
|---|---|---|---|---|---|---|---|
| Storefront block | XSS via authored content | client-side price tamper | RUM checkpoint gap | leak session cookie | main-thread block | admin block loaded on public | DOMPurify; server-verify at cart; RUM discipline; SameSite cookie; strict CSP |
| Drop-in extension | slot handler impersonate | prop tamper via URL | no event-bus audit | over-render PII | infinite render loop | extension escapes drop-in scope | pin drop-in version; validate props; scope handler; effect cleanup |
| Catalog Service call | API key theft (public) | GraphQL injection | fetch log gap | over-fetch fields | complexity DoS | admin-only field via public key | scope key read-only; domain-restrict; depth+complexity limits; audit key usage |
| Payment SDK iframe | fake iframe overlay | postMessage tamper | payment log gap | leaked cvv via console | slow iframe blocks checkout | script escapes iframe | strict `frame-src` CSP; SRI; validate postMessage origin |
| App Builder action fronting cart | IMS token replay | body tamper | activation log leak PII | log leaks token | quota flood | action runs as admin | short IMS token; DTO validate; mask logger; per-action quota |
| Storefront config sheet | sheet author impersonation | env-swap via URL param | author log gap | endpoint leak | fetch flood | prod uses stage endpoint | GDoc/SharePoint ACL on sheet; env determined by hostname, not query param |

## Common threats + mitigations for Commerce SaaS

- **XSS via authored block content** → `DOMPurify` or `textContent`;
  never `innerHTML` with untrusted; strict CSP with `nonce`.
- **Client-side price manipulation** → cart always re-prices server-
  side at Commerce Admin; storefront displays for UX only.
- **Public API key misuse** → domain restriction (`Origin` check),
  read-only scope, rate-limit per IP.
- **Drop-in downgrade attack** → package.json exact pin + integrity
  hash in CI.
- **Session token via URL** → Commerce SDK uses cookie; enforce no
  token-in-URL in blocks.
- **Consent bypass** → Adobe Tags gated; block network before consent
  for non-essential.
- **App Builder action leaks IMS token in log** → `aio-lib-core-logging`
  mask; never `console.log(params)`.
- **Cart CSRF** → SameSite cookie + custom header + Origin check.

## Attack trees for common flows

### Attack tree — Price tamper via storefront

```
Goal: pay lower price
├── Modify DOM price display
├── Modify GraphQL request body
│   └── Send crafted price hint to add-to-cart
└── Modify localStorage cart data
Mitigation: server-side reprice at cart; ignore client price hints; sign cart mutations
```

### Attack tree — API key exfil + abuse

```
Goal: use public Catalog key from attacker origin
├── Scrape key from storefront JS
├── Call Catalog Service from attacker origin
└── Data-mine catalog + custom attributes
Mitigation: Origin restriction; per-origin rate-limit; short-lived signed keys where possible; audit for anomaly
```

## PCI / GDPR / SOX applicability per Commerce SaaS

- **PCI-DSS** — Adobe Commerce SaaS + hosted-fields = SAQ-A (smallest
  scope). Merchant still responsible for iframe hosting page (CSP, SRI).
- **GDPR** — customer profile + cart + browsing behavior; consent
  banner before RUM/analytics; RTBF via Adobe Commerce Admin.
- **SOX** — orders/invoices flow via Commerce Admin (Adobe-managed);
  merchant retains audit obligation via export.
- **CCPA** — same posture as GDPR for CA residents.

## Residual-risk framing per Commerce SaaS

- Accept vendor risk of Adobe-hosted backend (SOC 2 covered).
- Accept small residual on drop-in version-pin lag (upgrade cadence
  vs vuln disclosure).
- Do not accept residual on price computed client-side.
- Do not accept residual on iframe CSP absence.

## Anti-patterns to avoid for Commerce SaaS

- Treating storefront as "just marketing site" — cart flow is
  PCI-adjacent.
- Forking drop-in to patch a vuln — breaks upgrade path; report to
  Adobe.
- Storing PII in localStorage — GDPR issue; use Commerce session.
- Skipping consent gate on Adobe Tags — regulatory risk.
- Modeling only happy-path — payment SDK error states leak most.

---

Generate the full threat model using `templates/threat-model-stride.md`
as master, populating placeholders with stack-appropriate content from
the guide above. Reference the LLD
(`resources/lld-templates/commerce-saas.md`) for component list.
