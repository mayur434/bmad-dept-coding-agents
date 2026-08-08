# STRIDE threat-model authoring guide — EDS + Commerce hybrid

## Purpose framing

An EDS + Commerce threat model catalogs threats across the **Consumer ↔
EDS Edge ↔ Drop-in ↔ Catalog Service / Live Search / Payment SDK ↔
Commerce Admin** surfaces. Combines EDS client-side surface with
Commerce-SaaS storefront threats; PCI SAQ-A boundary applies when
payment iframes render on EDS-hosted pages. Reference
`templates/threat-model-stride.md` for master shape.

## Typical trust boundaries for EDS + Commerce

- **Consumer ↔ EDS Edge** — TLS + edge WAF.
- **EDS Edge ↔ Content Bus** — Adobe-managed sync from GDocs/SharePoint.
- **Consumer ↔ Catalog Service** — public API key; scoped read-only.
- **Consumer ↔ Live Search** — public API key; scoped.
- **Consumer ↔ Payment SDK iframe** — PCI SAQ-A boundary; hosted
  fields.
- **Consumer ↔ Commerce Session API** — session cookie; CSRF surface.
- **Consumer ↔ App Builder Runtime action (via API Mesh)** — IMS or
  API key.
- **Preview branch ↔ prod** — separate origins; separate Catalog
  keys.
- **GDoc/SharePoint content ↔ block JS** — authored content trust
  boundary.
- **Drop-in package (`@dropins/*`) ↔ block code** — supply-chain
  boundary; version pin critical.

## Assets and data classification for EDS + Commerce

- **Product catalog** — Public.
- **Custom attributes marked "customer only"** — Internal; scope-
  check via Catalog Service ACL.
- **Session token** — Confidential; HttpOnly cookie.
- **Cart contents** — Internal.
- **Customer profile** — Restricted.
- **Payment tokens (returned from SDK)** — Restricted; short TTL.
- **Public API keys** — Internal (visible in client JS); scope +
  rotate.
- **Drop-in bundles** — supply-chain vector.
- **Authored content in GDocs** — Internal.

## Per-component STRIDE table

| Component-Type | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | EoP | Common Mitigations |
|---|---|---|---|---|---|---|---|
| Drop-in hosting block (PDP/PLP) | XSS via authored content | client-side price/state tamper | RUM checkpoint gap | leak of session cookie | main-thread block | admin block on public path | DOMPurify; server-verify at cart; RUM discipline; SameSite cookie; strict CSP |
| Drop-in extension block | slot handler impersonation | prop tamper via URL | no event-bus audit | over-render PII | infinite render loop | extension escapes drop-in scope | pin drop-in exact version; validate props; effect cleanup |
| Catalog Service call | API key theft (public) | GraphQL injection | fetch log gap | over-fetch fields | complexity DoS | admin-only field via public key | scope key read-only; Origin restriction; depth+complexity limits |
| Payment SDK iframe | fake iframe overlay | postMessage tamper | payment log gap | leaked cvv | slow iframe blocks checkout | script escapes iframe | strict `frame-src` CSP; SRI; validate postMessage origin |
| Initializer script | fake init config from tampered sheet | env-swap via URL | init log gap | endpoint leak | init loop | prod init with stage endpoint | derive env from hostname; cache config; log at INFO |
| App Builder action bridge | IMS token replay | body tamper | activation log leak | log leaks token | quota flood | action runs as admin | short IMS TTL; DTO validate; mask logger; per-action quota |
| Sheet config | sheet author impersonation | env-swap | change log via GDoc | endpoint leak | fetch flood | prod uses stage endpoint | GDoc ACL; env by hostname; cache |
| Third-party tag (analytics) | script substitution | inline injection | tag log gap | leak of PII to third party | slow tag blocks page | tag with `eval` | SRI + CSP; consent gate; async load; audit tag inventory |

## Common threats + mitigations for EDS + Commerce

- **XSS via authored PDP content** → DOMPurify or textContent; strict
  CSP with `nonce`; content ACL in GDoc.
- **Client-side price tamper** → cart re-prices server-side at
  Commerce Admin; ignore client price hints.
- **Public API key misuse from attacker origin** → domain restriction
  (Origin check); per-origin rate-limit.
- **Drop-in downgrade attack** → exact-version pin + integrity hash in
  CI.
- **Session token in URL** → SDK uses cookie; enforce no token in URL.
- **Consent bypass for tags** → Adobe Tags gated; block network before
  consent for non-essential.
- **Payment iframe overlay attack** → strict CSP `frame-src` allow-list;
  SRI on iframe SDK; UI clarity (do not obscure iframe with siblings).
- **Cart CSRF** → SameSite cookie + custom header + Origin check.
- **App Builder action bridging cart leaks IMS token in log** → mask
  logger; never `console.log(params)`.
- **Fragment injection (EDS fragment loader loading off-repo URL)** →
  same-origin fragment allow-list.

## Attack trees for common flows

### Attack tree — Price manipulation on PDP

```
Goal: pay lower price
├── Modify GraphQL response client-side
├── Modify localStorage cart before submit
└── Bypass drop-in and call Commerce Session API directly
Mitigation: cart re-prices at server on add + at checkout; ignore any client-provided price
```

### Attack tree — Payment iframe overlay

```
Goal: capture PAN via overlay of fake iframe
├── Inject script into checkout page (XSS via authored content)
├── Overlay fake iframe atop hosted-fields iframe
└── Exfiltrate keystrokes
Mitigation: strict CSP; SRI; sanitize authored content; page structure that keeps iframe integrity
```

### Attack tree — API key exfil + abuse

```
Goal: use public Catalog key from attacker origin
├── Scrape key from storefront JS
├── Call from attacker origin (bypass Origin check via CORS misconfig)
└── Data-mine catalog
Mitigation: Origin restriction; per-origin rate-limit; audit key usage; short-lived signed keys where possible
```

## PCI / GDPR / SOX applicability per EDS + Commerce

- **PCI-DSS SAQ-A** if payment via hosted redirect or hosted-fields
  with no PAN through EDS/Commerce (preferred).
- **PCI-DSS SAQ-A-EP** if iframe embed on EDS page — EDS page in
  scope; CSP + SRI mandatory; quarterly ASV scan.
- **GDPR** — customer profile + cart + tags subject to consent; RTBF
  via Commerce Admin cascading; RUM must not carry PII.
- **SOX** — orders/invoices flow via Commerce Admin (Adobe-managed);
  merchant retains audit obligation via export + change history.

## Residual-risk framing per EDS + Commerce

- Accept vendor risk of Adobe SaaS + hlx edge.
- Accept small residual on drop-in version-pin lag vs vuln disclosure
  (mitigated by monitoring + fast-follow PR).
- Do not accept residual on price computed client-side.
- Do not accept residual on iframe CSP absence.
- Do not accept residual on tags loading before consent.

## Anti-patterns to avoid for EDS + Commerce

- Treating EDS as "just marketing" when it hosts checkout — same PCI
  scope as any checkout page.
- Forking drop-in for a hot fix — breaks upgrade + likely voids
  Adobe support.
- Skipping supply-chain check on `@dropins/*` — CVE watch needed.
- Modeling only PDP — cart + checkout + login carry more PII.
- Ignoring content-source ACL — GDoc/SharePoint write = ability to
  ship arbitrary HTML.

---

Generate the full threat model using `templates/threat-model-stride.md`
as master, populating placeholders with stack-appropriate content from
the guide above. Reference the LLD
(`resources/lld-templates/eds-commerce.md`) for component list.
