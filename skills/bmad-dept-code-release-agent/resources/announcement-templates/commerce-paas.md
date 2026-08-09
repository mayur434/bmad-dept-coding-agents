# Announcement authoring guide — Adobe Commerce (PaaS / Magento 2)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a multi-channel release announcement for a
Magento 2 / Adobe Commerce PaaS project. Combine with
`templates/announcement.md` as the master skeleton.

## Purpose framing

Commerce PaaS announcements almost always land in **merchant hands
first** — the admin UI is the primary surface, not code — so the release
must land clearly with merchants and admins before it lands with
developers. Payment, checkout, and cart changes have compliance and
customer-support consequences that make PCI scope, DB migration timing,
and maintenance-mode windows communication-critical. What makes this
stack unique: a single release can touch admin UX, storefront UX, DB
schema, indexer behavior, and payment flow simultaneously — the
announcement has to segment cleanly by which surface changed.

## Audience segmentation for Commerce PaaS

- **Merchants / store admins** *(primary)* — admin UI changes, new
  admin workflows, indexer/queue impacts on their day-to-day.
- **Customer-support team** — customer-facing behavior changes (new
  error messages, checkout step reorder, order-status changes).
- **Developers / integrators** — module API changes, `di.xml` compile
  requirements, `setup:upgrade` needs.
- **Storefront customers** — visible storefront changes, payment
  additions, checkout UX.
- **Payment-ops / PCI-scope owners** — anything touching PCI scope
  (Payment Services, hosted-fields, tokenization, Vault module).
- **SRE / infrastructure** — maintenance-mode windows, indexer runtime
  impact, queue-consumer restart timing.

## Channel-by-channel guidance for Commerce PaaS

### Email announcement (long-form)

- **Subject line pattern:** `[Commerce PaaS] v{{version}} — Admin
  changes + {{feature}}` (e.g. `[Commerce PaaS] v2.5.0 — Admin: new
  loyalty tier UI + PayPal Wallet checkout`).
- **Body sections:** what/why/when + **admin-workflow impact**
  (screenshots of new admin sections) + **customer-facing changes**
  (checkout, cart, PDP visible deltas) + DB migration window + indexer
  reindex time estimate + maintenance-mode plan + support-team FYI +
  rollback timing.
- **CC/To:** primary To = `commerce-releases@` + `merchant-ops@`; CC =
  `customer-support-leads@`, `payment-ops@` when PCI scope changes.
- **Attachment/link conventions:** ECE-Tools deploy log link, admin
  screenshot deck, DB migration DDL summary (dev-internal only),
  PR link.

### Slack announcement (short-form)

- **Channel routing:** `#commerce-releases` (primary) + `#merchant-ops`
  (always for admin changes) + `#payment-ops` (PCI/checkout changes,
  restricted-audience) + `#customer-support` (user-visible changes) +
  `#incidents-commerce` for hotfixes.
- **Emoji convention:** :shopping_cart: launches, :credit_card:
  payment/checkout, :hammer_and_wrench: breaking, :rotating_light:
  security, :warning: maintenance window.
- **Threading:** top message = release headline + maintenance window;
  DB migration details, `setup:upgrade` runtime, indexer/cache order
  drop into the thread.
- **Pin:** pin maintenance-window post 24h ahead, keep pinned through
  ship + T+2h post-deploy verification.

### Confluence page (documentation-first)

- **Space + location:** `Commerce Platform` space → `Releases` →
  `v{{version}}`. <!-- verify: your team's Confluence structure -->
- **Long-form sections:** release scope, admin-UI feature deep-dive
  with **admin screenshots** per new panel, storefront changelog with
  screenshots, DB schema deltas (dev-internal section), module version
  matrix, ECE-Tools deploy notes, maintenance-window runbook, cache
  clean order (`config` → `block_html` → `full_page`), indexer/queue
  restart order, rollback triggers.
- **Label conventions:** `commerce`, `magento2`, `release`,
  `v{{version}}`, plus one of `admin-only` / `storefront-only` /
  `admin-and-storefront` / `payment` and one of `db-migration` /
  `no-db-migration`.

### Twitter / LinkedIn (external-facing)

- **Use when:** customer-visible checkout/PDP/cart feature that
  merchants want to advertise (new payment method live, new loyalty
  program). Skip for admin-only refactors, DB migrations, indexer
  changes.
- **Character budget:** Twitter ~280, LinkedIn 3000 with rich media
  (checkout screenshot).
- **Hashtag convention:** `#AdobeCommerce #Magento`. Skip anything
  referencing internal module names.

## Stakeholder-tone matrix for Commerce PaaS

| Audience | Email | Slack | Confluence | External |
|---|---|---|---|---|
| Merchants / admins | Admin-workflow section + screenshots | `#merchant-ops` :shopping_cart: post | Admin walk-through with screenshots per new panel | — |
| Customer support | Customer-visible section + new error codes | `#customer-support` cross-post | New error codes + FAQ additions | — |
| Developers | API changes + `setup:upgrade` notes | `#commerce-releases` thread | Module version matrix + `di.xml` compile notes | — |
| Storefront customers | — | — | — | Public post if consumer-visible feature |
| Payment ops (restricted) | PCI-scope callout (encrypted) | `#payment-ops` private channel | Restricted-space PCI page | Never |
| SRE | Maintenance window + DB migration timing | `#commerce-releases` pinned + `#sre-oncall` | Runbook with cache order + reindex time | — |

## What to skip / redact per Commerce PaaS

- **NEVER** publish payment-flow implementation details, tokenization
  keys, or Vault module internals externally — PCI scope violation.
- Payment/PCI-scope changes go **only** to `#payment-ops` and
  restricted Confluence — not public Slack, not merchant-wide email.
- DB schema deltas: **dev-internal Slack channel only** — do not send
  to merchant-ops email even accidentally.
- Do not publish `.magento.env.yaml`, `env.php`, or `config.php`
  contents anywhere externally.
- Do not publish admin-URL patterns or admin-user email addresses.
- Do not publish PII, order IDs, or customer emails in examples —
  scrub with `admin@example.com` / `ORDER-1234` placeholders.

## Sensitivity classification for Commerce PaaS

- **Admin UI change** → Merchant-facing (email + `#merchant-ops`).
- **Storefront change** → Public (external post appropriate).
- **DB schema change** → Dev-internal (never merchant-wide,
  never public).
- **Payment / PCI-scope change** → PCI-restricted audience only.
- **Customer-facing feature** (new payment method, loyalty, checkout
  UX) → Public.
- **Security patch** → PCI-restricted, then merchant-ops after fix
  ships, external only after CVE-window elapses.

## 3 worked announcement examples for Commerce PaaS

1. **Major feature launch — PayPal Wallet + loyalty tier (v2.5.0).**
   Email `[Commerce PaaS] v2.5.0 — PayPal Wallet checkout live + admin
   loyalty-tier UI` to `commerce-releases@` + `merchant-ops@` +
   `customer-support@`; separate restricted-audience email to
   `payment-ops@` with PCI scope statement. Slack `#commerce-releases`
   :shopping_cart: pinned + `#merchant-ops` admin-walkthrough + private
   `#payment-ops` PCI-scope thread + `#customer-support` new-error-codes
   heads-up. Confluence long-form with admin + storefront screenshots.
   LinkedIn post — customer-facing wallet launch, no internal detail.

2. **Breaking change / DB migration (v2.6.0 — indexer restructure).**
   Email `[Commerce PaaS] v2.6.0 — BREAKING: indexer restructure,
   maintenance window Sat 02:00–04:00 UTC`. 48h pre-notice email + T-24h
   pinned Slack in `#commerce-releases` + `#merchant-ops` + `#sre-oncall`.
   Confluence migration guide + rollback triggers. **No external post.**

3. **Hotfix / payment security patch (v2.5.1).**
   Slack-first `#payment-ops` (restricted) + `#incidents-commerce`
   :rotating_light: with hotfix summary + rollback trigger. Email to
   `payment-ops@` under CVE-embargo language. After embargo elapses (per
   Adobe Commerce security bulletin cadence), email `merchant-ops@` +
   Confluence post-mortem. **No external post** during embargo.

## Anti-patterns to avoid for Commerce PaaS

- Don't announce payment-flow changes in public Slack channels — PCI
  scope violation risk.
- Don't announce DB migrations without a maintenance-window pre-notice
  (T-48h minimum) — SRE and merchant-ops must plan.
- Don't skip cache-clean order (`config` → `block_html` → `full_page`)
  in the runbook — wrong order surfaces as intermittent storefront
  errors.
- Don't announce breaking module-API changes without a 30-day
  deprecation notice to integrator partners.
- Don't dump raw commit history to merchant-ops — they read admin
  behavior, not commits.

---

Generate the full announcement using `templates/announcement.md` as
the master, populating placeholders with stack-appropriate content
from the guide above.
