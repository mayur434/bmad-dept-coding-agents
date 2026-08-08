# STRIDE threat-model authoring guide — Sling / Shaft

## Purpose framing

A Sling threat model catalogs threats across the **HTTP ↔ Filter chain
↔ Servlet ↔ JCR ↔ JobManager ↔ external systems** surfaces. Without
the AEM WCM stack, threats center on Sling's raw HTTP + resource-tree
addressing model. Reference `templates/threat-model-stride.md` for
master shape.

## Typical trust boundaries for Sling

- **Consumer ↔ Reverse Proxy / CDN** — TLS + WAF; edge auth.
- **Reverse Proxy ↔ Sling HTTP** — IP allow-list or mTLS.
- **Sling HTTP ↔ Filter chain** — filters enforce auth; chain order
  matters.
- **Servlet ↔ Service** — in-process; but service-user boundary via
  `ResourceResolverFactory.getServiceResourceResolver`.
- **Service ↔ JCR (Oak)** — session context carries auth; ACL enforced
  in Oak.
- **JobManager ↔ Consumer** — job payload untrusted; consumer runs as
  service user.
- **Bundle ↔ Bundle** — OSGi package export/import; API boundary.
- **Sling ↔ external HTTP** — outbound; TLS + circuit breaker.

## Assets and data classification for Sling

- **JCR content** — variable; classify per path.
- **Service-user credentials** — Confidential; scope-limited via
  `service-user mapping`.
- **OSGi secrets** — Confidential; store outside git.
- **Job payload** — variable; document per topic.
- **Session cookies** — Confidential; HttpOnly + Secure.
- **Bundle jar** — Internal; supply-chain in scope.

## Per-component STRIDE table

| Component-Type | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | EoP | Common Mitigations |
|---|---|---|---|---|---|---|---|
| Sling servlet | unauth access | selector/suffix injection | audit gap | verbose error | slow response pins thread | admin-scoped path reachable | filter allow-list; sanitized error page; short timeouts; ACL on service user |
| Sling filter | filter order bypass | header injection | request log gap | leak stack | filter throws → chain broken | filter runs as admin | test chain order in CI; strip untrusted headers; try/catch in filter |
| Job consumer | poisoned job | payload mutate | job TTL too short | log leaks payload | queue flood | consumer runs as admin | schema validate; DLQ; retention config; service-user constrained |
| OSGi service | fake reference | mutable ref target | activation log gap | leak config on activate | activation loop | service scope prototype vs singleton confusion | `@Reference` immutable; `@Activate` logs at INFO; state-machine transitions |
| ResourceProvider | spoofed backing store | mutation without auth | no write audit | leak of hidden nodes | provider blocking calls | admin-only path served publicly | resource-level ACL; async backing calls; explicit provider path |
| Adapter factory | wrong adaptable | adapt returns tainted | no adapt trace | leak internals via adapt | expensive adapt path | privileged type returned to anon | `@Nullable` return; short adapt path; scope check |

## Common threats + mitigations for Sling

- **`/system/console` reachable in prod** → disable Web Console
  bundle or IP-restrict via filter chain.
- **`.json` selector data leak (`/content/foo.infinity.json`)** → deny
  in reverse-proxy allow-list; `SlingSafeMethodsServlet` variants.
- **`ResourceResolver` leak** → try-with-resources; leak detector via
  `ResourceResolverFactory` metrics; alert on session-count growth.
- **Job payload injection** → JSON schema validate in `process()`
  before work; reject on schema fail (CANCEL, not FAILED).
- **Cross-bundle package export tainted** → `@ProviderType` /
  `@ConsumerType` discipline; import-version narrowing.
- **Service-user with `jcr:all`** → scope service-user via `system/user`
  ACL policies; per-service-user mapping.
- **OSGi config with plaintext secret** → `felix.fileinstall` encryption
  or external secret store; scan configs in CI.

## Attack trees for common flows

### Attack tree — Web Console reachable

```
Goal: gain OSGi admin console
├── Discover /system/console (default)
├── Try default creds (admin/admin)
└── Install malicious bundle
Mitigation: disable in prod, IP-restrict, change default creds, remove admin user
```

### Attack tree — JCR path traversal via selector

```
Goal: read admin-only resource via public servlet
├── Craft URL /content/public.json/../admin
├── Servlet resolves resource with tainted path
└── Response includes admin content
Mitigation: never build resource path from user input; use `ResourceResolver.getResource(fixedBase + '/' + safeName)`; ACL on `admin`
```

## PCI / GDPR / SOX applicability per Sling

- **PCI** — Sling shouldn't touch card data; if it does, apply full
  merchant scope.
- **GDPR** — if Sling stores personal data in JCR, RTBF via delete +
  version purge; retention via scheduled cleanup jobs.
- **SOX** — if Sling handles financial workflows, workflow-step audit
  log.
- **SOC 2** — service-user policy segregation; audit log retention.

## Residual-risk framing per Sling

- Accept low residual on unbounded resource walks if reverse proxy
  rate-limits.
- Accept medium residual on bundle-supply-chain if signed bundles +
  Adobe/Sling upstream trusted.
- Do not accept residual on service-user with `jcr:all`.
- Do not accept residual on Web Console reachable in prod.

## Anti-patterns to avoid for Sling

- Modeling only servlets — jobs and filters are equal attack surface.
- Rating every OSGi service "high" — grade by cardinality + who
  references.
- Skipping bundle supply-chain — a vulnerable dependency is the most
  common CVE path.
- Threat-model in isolation from LLD — always take LLD component list
  as input.

---

Generate the full threat model using `templates/threat-model-stride.md`
as master, populating placeholders with stack-appropriate content from
the guide above. Reference the LLD (`resources/lld-templates/sling.md`)
for component list.
