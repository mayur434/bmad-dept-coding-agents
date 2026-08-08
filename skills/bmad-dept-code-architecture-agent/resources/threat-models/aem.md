# STRIDE threat-model authoring guide — AEM (AEMaaCS + AMS)

## Purpose framing

An AEM threat model catalogs threats across the **Author↔Publish↔Dispatcher
↔CDN** tiers plus **cross-tier integrations** (IMS, external CMS, Target,
Analytics). Reference `templates/threat-model-stride.md` for master shape;
this guide populates the stack-idiomatic content.

## Typical trust boundaries for AEM

- **Consumer ↔ CDN** — internet edge; TLS termination; WAF rules.
- **CDN ↔ Dispatcher** — trust CDN via shared secret header or IP allow-
  list; dispatcher enforces filter rules.
- **Dispatcher ↔ Publish** — filter rules gate what URLs reach publish;
  Sling Referrer Filter checks form POSTs.
- **Publish ↔ Author** — replication over `com.day.cq.replication`;
  transport user credentials; Author is never public.
- **Author ↔ IMS / LDAP** — federated login for authors; scope-of-authz
  enforced via `rep:policy` in JCR.
- **Author ↔ external CMS / PIM / DAM** — inbound content pipelines
  (SFTP, webhook, GraphQL polling).
- **Publish ↔ third-party (Target, Analytics, RTCDP)** — client-side +
  server-side calls; Web SDK datastream ID as identity.
- **DAM ↔ binary storage** — asset binaries in Adobe-managed cloud
  storage; presigned URLs via CDN.

## Assets and data classification for AEM

- **Editorial content** — Public (post-publish) / Internal (draft).
- **Author credentials** — Confidential; IMS-managed on AEMaaCS.
- **Form-submitted PII** — Restricted (GDPR); minimize retention.
- **CUG-gated content** — Restricted; entitlement checked per request.
- **Replication transport user** — Confidential; rotate per env.
- **DAM originals** — Internal or Restricted per brand policy.
- **OSGi secrets** — Confidential; `$[secret:...]` never in git.
- **Cloud Manager service credentials** — Confidential; rotate on
  team change.

## Per-component STRIDE table

| Component-Type | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | EoP | Common Mitigations |
|---|---|---|---|---|---|---|---|
| Sling servlet on `/bin/*` | unauth access | query-param injection | missing audit log | verbose error body | long sync blocks thread | ACL bypass via path traversal | Sling Referrer Filter; ACL on service user; short timeouts; sanitized error page; offload to Sling Jobs |
| Content Fragment editor | session hijack | XSS via CF text field | no edit trail | draft leak via API | mass import | privilege via `rep:write` | IMS auth; sanitize HTL output; enable versioning audit; scope ACL to CF folder |
| Dispatcher filter | referrer spoof | path traversal | cache pollution log gap | leak `/etc.clientlibs` | cache-buster DoS | `/admin` reachable | filter allow-list; `/glob` denies; stat file level; WAF |
| Replication endpoint | fake replication POST | payload tamper | no origin log | leak Author state | flood publish queue | privilege via `admin` user | IP allow-list; transport user auth; queue size limits |
| Sling Job consumer | poisoned job | payload tamper | job history TTL | log leaks payload | queue flood | run-as elevated user | schema validation; DLQ; retention; run-as `service-user` |
| Custom REST API (`.model.json`) | JWT bypass | body mutation | missing audit | over-serialize | N+1 to JCR | admin selector accessible | filter selectors; DTO allow-list; rate limit at dispatcher |

## Common threats + mitigations for AEM

- **Dispatcher pass-through of Author-only paths** → dispatcher filter
  `/glob "*/system/*"` deny; `/glob "*.infinity.json"` deny;
  `dispatcher-filter-check` in CI.
- **Sling Referrer Filter bypass on POST** → allow-list Referrer +
  method + CSRF token; `com.adobe.granite.csrf.impl.CSRFFilter`.
- **CF injection via unsanitized HTML field** → HTL auto-escapes;
  `data-sly-attribute` for URLs; explicit escaping via
  `xssapi.encodeForHTMLAttr`.
- **Author IMS impersonation** → IMS token audience check; no
  `AuthenticationHandler` overrides on AEMaaCS.
- **Cloud Manager secret leak into OSGi config commit** → `$[secret:...]`
  only; pre-commit hook rejects raw secrets; audit `ui.config/` diffs.
- **CUG bypass via cache** → mark responses `Dispatcher: no-cache` when
  personalized; use ESI for shared shells + user islands.
- **Author-fronting publisher content** → dispatcher never routes to
  Author; Author has no CDN.

## Attack trees for common flows

### Attack tree — Author-only path leaked to Publish

```
Goal: attacker retrieves /system/console via public URL
├── Discover unfiltered path
│   ├── crawl robots.txt for hints
│   └── fuzz /libs/*, /apps/*, /etc/*
├── Bypass dispatcher filter
│   ├── use `.json` selector
│   └── use `.infinity` extension
└── Reach publish
    └── console requires admin — check for default creds
Mitigation: filter deny-list, IP restrict, no default creds
```

### Attack tree — Replication forgery

```
Goal: inject content into Publish without Author
├── Discover replication endpoint (POST /bin/receive)
├── Guess transport user credentials
└── Send crafted package
Mitigation: IP allow-list, per-env transport user, mTLS
```

## PCI / GDPR / SOX applicability per AEM

- **PCI-DSS** — AEM should not touch card data. Forms with payment
  fields must POST directly to a tokenizer (Vault, gateway hosted
  fields), never to Sling servlets.
- **GDPR** — right-to-be-forgotten across DAM metadata (uploaders,
  approvers), form submissions, workflow history. Retention policies
  per Content Fragment folder.
- **SOX** — if AEM hosts investor-relations content, audit trail via
  versioning + workflow history; segregation of duties via ACL.
- **Cookie consent** — must-load-first pattern; OneTrust / Adobe
  Privacy Service integration.

## Residual-risk framing per AEM

- Accept low residual on cache-invalidation DoS if CDN absorbs (Adobe
  Fastly on AEMaaCS).
- Accept medium residual on Author availability (Adobe SLA covers
  publish, not author responsiveness during freezes).
- Do not accept residual on unauthenticated `/bin/*` — always ACL +
  filter.
- Do not accept residual on CF payload injection into HTML rendering —
  always escape.

## Anti-patterns to avoid for AEM

- Rating every servlet "high" — meaningless; grade by data
  classification + reachability.
- Skipping repudiation — Sling audit logs are cheap; enable per-CF.
- Threat-modeling without the LLD component list — miss surfaces;
  always take LLD as input.
- Ignoring the dispatcher farm — half of AEM's security surface lives
  there.
- Only modeling Publish tier — Author compromise is a data-exfil path.

---

Generate the full threat model using `templates/threat-model-stride.md`
as master, populating placeholders with stack-appropriate content from
the guide above. Reference the LLD (`resources/lld-templates/aem.md`)
for component list.
