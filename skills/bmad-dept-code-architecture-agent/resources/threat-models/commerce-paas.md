# STRIDE threat-model authoring guide — Adobe Commerce PaaS (Magento)

## Purpose framing

A Commerce PaaS threat model catalogs threats across the **Fastly ↔
Origin ↔ MySQL / Redis / RabbitMQ** tiers with heavy focus on **checkout
+ admin + Web API** surfaces. PCI-DSS applicability dominates.
Reference `templates/threat-model-stride.md` for master shape.

## Typical trust boundaries for Commerce PaaS

- **Consumer ↔ Fastly** — TLS + WAF; bot mitigation.
- **Fastly ↔ Origin (Nginx + PHP-FPM)** — shared secret header, IP
  allow-list.
- **Origin ↔ MySQL** — private network; TLS to RDS; credentialed user
  per env.
- **Origin ↔ Redis** — cache + session store; AUTH + TLS; ACL per key
  space.
- **Origin ↔ RabbitMQ** — queue consumers; vhost per env.
- **Storefront ↔ Admin** — same-origin; admin behind IP allow-list +
  MFA + 2FA.
- **Admin ↔ Payment Gateway** — server-to-server tokenization; never
  card data through Commerce.
- **Consumer ↔ Payment Gateway iframe** — hosted fields; Vault or
  gateway-hosted; PCI SAQ-A boundary.
- **Origin ↔ Adobe I/O Events** — outbound event bus; API key auth.

## Assets and data classification for Commerce PaaS

- **Customer PII** — Restricted (GDPR); minimize retention.
- **Order history** — Restricted.
- **PAN / card data** — MUST NOT touch Commerce (PCI); enforce via
  hosted-fields boundary.
- **Cart contents** — Internal; may contain PII (shipping address).
- **Admin credentials** — Confidential; MFA required.
- **API integration tokens** — Confidential; env-scoped rotation.
- **Payment tokens (network / gateway)** — Restricted; scope-limited.
- **Customer segments / lifetime value** — Confidential (marketing).

## Per-component STRIDE table

| Component-Type | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | EoP | Common Mitigations |
|---|---|---|---|---|---|---|---|
| Storefront controller | session hijack | form-key bypass | order-place log gap | verbose exception | flood cart-add | admin path reachable | form-key validation; short session; log at INFO; developer mode off in prod |
| Web API endpoint | JWT theft | mass-assignment | request log gap | over-serialized DTO | unbounded search criteria | admin scope on customer endpoint | OAuth2 / Adobe IMS; explicit data interfaces; pageSize cap; ACL per endpoint |
| Admin controller | admin creds phish | CSRF | admin action log gap | grid data leak | admin path exposed | plugin bypasses ACL | MFA; form-key; audit log via `Adobe_AdminBridge` <!-- verify -->; IP allow-list |
| Observer on `sales_order_place` | fake event | order data mutate | no audit | log leak | slow observer blocks checkout | run-as admin | idempotency; async via queue; no PAN in log |
| Plugin (interceptor) | wrong `sort_order` | around-plugin mutates result | plugin swallow exception | verbose exception in around | expensive around-work | plugin runs in wrong scope | explicit `sort_order`; test order; log exceptions |
| GraphQL resolver | token missing | query depth attack | resolver log gap | over-fetch of PII | complexity DoS | store scope bypass | JWT check; depth + complexity limit; field-level ACL |
| Queue consumer | poisoned message | payload mutate | consumer history TTL | log leaks PII | queue flood | consumer runs as root | dedupe; DLQ; strict schema; systemd `User=` |

## Common threats + mitigations for Commerce PaaS

- **SQL injection via raw `ObjectManager::get(ResourceConnection)->query`** →
  use repositories + prepared statements; static analysis (`Magento
  Coding Standard` `Magento2.SQL.RawQuery`).
- **Mass assignment via Web API request body** → declare explicit
  `Api/Data/` interface; `\Magento\Framework\Webapi\ServiceInputProcessor`
  filters extras.
- **Admin CSRF on config save** → Magento auto-adds form-key; do not
  disable per-controller.
- **Session fixation on checkout** → regenerate session on login and on
  cart merge.
- **Verbose exception in production** → `MAGE_MODE=production`;
  `dev/tests/generateException` fixture in CI.
- **Payment card leakage via logs** → PCI scanner in CI; block PANs via
  regex in `logger.php` shim.
- **Admin brute force** → rate limit + Fastly WAF + CAPTCHA on N failed
  attempts.
- **Indexer / cron running as `root`** → systemd unit user constrained.
- **Extension marketplace vuln** → vendor-lock + Composer audit; monthly
  Mage Report Scanner. <!-- verify -->

## Attack trees for common flows

### Attack tree — Checkout tokenization bypass

```
Goal: capture PAN by breaking iframe boundary
├── Inject script into checkout page (XSS)
│   ├── Bad extension outputs unescaped HTML
│   └── Admin CMS block with unfiltered {{block}}
├── Overlay fake iframe to capture keystrokes
└── Exfiltrate to attacker origin
Mitigation: strict CSP with `frame-src` allow-list; SRI on JS; template output escaping; PCI SAQ-A-EP scope acknowledgement
```

### Attack tree — Admin brute force + privilege gain

```
Goal: gain admin access
├── Discover admin URL (default /admin)
├── Bypass MFA (if disabled)
├── Try leaked creds
└── Escalate via user_role manipulation
Mitigation: random admin URL; MFA mandatory; role scope minimum; audit log
```

### Attack tree — Queue message poisoning

```
Goal: corrupt orders via forged queue msg
├── Discover queue endpoint (rabbit management UI leaked)
├── Send crafted message
└── Consumer processes without validation
Mitigation: schema validation; consumer runs as service user; management UI IP-restricted
```

## PCI / GDPR / SOX applicability per Commerce PaaS

- **PCI-DSS** — scope depends on tokenization pattern:
  - **SAQ-A** (hosted redirect / hosted fields, no PAN touches
    Commerce) — smallest scope; preferred.
  - **SAQ-A-EP** (iframe embed on Commerce page) — Commerce page in
    scope; CSP + SRI mandatory.
  - **SAQ-D** (direct PAN handling) — full merchant scope; avoid.
- **GDPR** — Commerce customer PII flows through profile, orders,
  quotes; use `Customer Data Deletion` module for RTBF.
- **SOX** — financial data (orders, invoices); segregation of duties
  via admin roles; immutable audit log.

## Residual-risk framing per Commerce PaaS

- Accept vendor lock-in to PCI-compliant Vault/gateway to descope
  Commerce PCI.
- Accept low residual on cache-poisoning if Fastly VCL enforces
  `Vary` correctness.
- Do not accept residual on PAN in application logs.
- Do not accept residual on admin without MFA.

## Anti-patterns to avoid for Commerce PaaS

- Modeling PCI as "the gateway's problem" — Commerce page hosting the
  iframe is in scope for SAQ-A-EP.
- Skipping observer exception paths — swallowed observer failures
  produce orphan orders / reservations.
- Threat-modeling without extensions — third-party modules are the
  largest CVE source.
- Rating every admin threat "critical" — grade by data reach; a config-
  page ACL and a customer-export ACL differ.

---

Generate the full threat model using `templates/threat-model-stride.md`
as master, populating placeholders with stack-appropriate content from
the guide above. Reference the LLD
(`resources/lld-templates/commerce-paas.md`) for component list.
