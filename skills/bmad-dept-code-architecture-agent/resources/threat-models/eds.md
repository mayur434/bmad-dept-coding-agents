# STRIDE threat-model authoring guide — Edge Delivery Services (EDS)

## Purpose framing

An EDS threat model catalogs threats across the **Consumer ↔ Edge ↔
Content Bus ↔ Content Source (Word / GDocs / SharePoint)** with heavy
focus on **client-side execution** (blocks are ES modules on the
browser). Reference `templates/threat-model-stride.md` for master shape.

## Typical trust boundaries for EDS

- **Consumer ↔ Edge (helix-worker)** — TLS + Adobe edge WAF.
- **Edge ↔ Content Bus** — Adobe-managed; hlx-serviced.
- **Content Bus ↔ Content Source** — auth via Adobe OAuth to
  Google Drive / SharePoint; sync via `hlx` publish.
- **Author ↔ Content Source** — GDocs/SharePoint native permissions
  are the primary ACL.
- **Consumer ↔ Third-party scripts (analytics, tag manager)** — CSP
  gate; consent gate.
- **Consumer ↔ backend forms / API** — form POST to Adobe Forms API or
  third-party.
- **Preview branch (`<branch>--<repo>--<owner>.aem.page`) ↔ prod
  (`.aem.live`)** — separate origins; preview is auth-gated on private
  repos.
- **Content Source ↔ GitHub repo (code)** — code path via git; content
  path via GDocs/SharePoint; different ACLs.

## Assets and data classification for EDS

- **Published content** — Public.
- **Draft content in GDocs / SharePoint** — Internal; native ACL.
- **Sheet-based config** — Internal (may contain endpoint URLs, feature
  flags).
- **Metadata (per-page)** — Public (post-publish).
- **Form-submitted data** — Restricted; PII possible; retention on
  backend, not EDS.
- **RUM data** — Internal (aggregated); no PII by default.
- **Third-party script bundles** — supply-chain risk vector.

## Per-component STRIDE table

| Component-Type | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | EoP | Common Mitigations |
|---|---|---|---|---|---|---|---|
| Block | XSS via authored content | client-side DOM mutation for phishing | RUM missing | leak meta or cookie | main-thread block | admin block loaded on public | DOMPurify; content-driven `textContent`; strict CSP; RUM discipline; scope block CSS + JS |
| Auto-block | fake URL pattern trigger | pattern injection via query param | no auto-block trace | leak of internal patterns | infinite auto-block loop | admin auto-block on public URL | pattern allow-list; test in preview; loop guard |
| Fragment loader | fake fragment URL | fragment content substitution | fragment fetch log gap | leak of unpublished fragment | fragment fetch flood | preview fragment on prod | same-origin fragments only; CSP `frame-src`; env-scoped fragment paths |
| Sheet config | sheet author impersonation | env-swap via URL param | author change log via GDoc | endpoint leak | fetch flood | prod uses stage endpoint | GDoc ACL; env by hostname not query param; cache config |
| Form block | CSRF | field tamper | submit log gap | leak submitted data | submit flood | admin form on public page | CSRF token; server-side validate; rate limit at backend; no admin form on public path |
| Third-party script | script substitution (upstream compromise) | inline script inject | script log gap | leak of session cookie | slow script blocks page | escalation via `eval` | SRI hash; CSP with `nonce`; async/defer; audit tag inventory |

## Common threats + mitigations for EDS

- **XSS via authored content** → default is safe (helix serves as
  DOM-parsed HTML); if block uses `innerHTML`, sanitize with
  DOMPurify; enable strict CSP with `nonce`.
- **Third-party script CSP violation** → strict CSP; SRI on tag
  manager; per-domain allow-list.
- **Consent bypass** → block network for non-essential (analytics,
  personalization) until consent; Adobe Tags governs load order.
- **Fragment injection (loading fragment from off-repo URL)** → allow-
  list fragment origins in block.
- **Sheet env-swap via query param** → derive env from hostname only.
- **Preview branch leaked** → private repos require GH auth for preview;
  audit for public forks.
- **Form spam** → CAPTCHA (invisible) + honeypot + backend rate limit.
- **RUM leaking PII** → never send PII to RUM; validate `sampleRUM`
  payload shape in CI.
- **Supply-chain via `@dropins/*` or third-party libs (EDS-commerce)** →
  version pin + integrity hash + renovate + CVE watch.

## Attack trees for common flows

### Attack tree — XSS via authored content

```
Goal: run JS in consumer browser
├── Author with GDoc write access injects HTML
├── Block uses innerHTML on that content
└── Payload executes
Mitigation: DOMPurify; textContent by default; GDoc ACL reviewed; CSP `script-src` allow-list
```

### Attack tree — Fragment injection

```
Goal: substitute fragment content
├── Block reads fragment URL from user input
├── Attacker crafts URL pointing to attacker origin
└── Attacker HTML loaded into page
Mitigation: same-origin fragments only; validate URL against allow-list
```

## PCI / GDPR / SOX applicability per EDS

- **PCI** — EDS should not touch card data; forms with payment fields
  → hosted redirect or iframe to gateway.
- **GDPR** — form data + RUM subject to consent; RTBF via backend
  (Adobe Forms API, CRM); EDS content itself is generally not PII.
- **CCPA** — cookie / RUM consent gate; opt-out honored.
- **SOX** — content publication history via git commit log +
  GDoc/SharePoint version history.
- **Accessibility** — WCAG 2.1 AA; automated in Lighthouse CI (not a
  security threat but a compliance obligation for public sites).

## Residual-risk framing per EDS

- Accept low residual on client-side JS supply-chain if SRI + CSP +
  monthly audit.
- Accept vendor risk of Adobe edge (hlx).
- Do not accept residual on `innerHTML` with unsanitized authored
  content.
- Do not accept residual on consent-not-enforced for RUM/tags.

## Anti-patterns to avoid for EDS

- Treating EDS as "just static HTML" — blocks are JS with full DOM
  access.
- Rating every block "low" — a block on the checkout page differs from
  a footer block.
- Modeling only prod origin — preview branches are also public until
  configured private.
- Ignoring content-source ACL — the primary access control lives in
  GDoc/SharePoint, not git.

---

Generate the full threat model using `templates/threat-model-stride.md`
as master, populating placeholders with stack-appropriate content from
the guide above. Reference the LLD (`resources/lld-templates/eds.md`)
for component list.
