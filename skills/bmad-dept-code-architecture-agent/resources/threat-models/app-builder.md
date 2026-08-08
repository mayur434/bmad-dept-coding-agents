# STRIDE threat-model authoring guide — Adobe App Builder

## Purpose framing

An App Builder threat model catalogs threats across the **Trigger ↔
I/O Runtime ↔ Action ↔ State/Files ↔ IMS ↔ External API** surfaces.
Focus areas: IMS S2S token handling, event-payload trust, and secret
handling in serverless action logs. Reference
`templates/threat-model-stride.md` for master shape.

## Typical trust boundaries for App Builder

- **Consumer ↔ Web action HTTP** — TLS + Adobe auth (`require-adobe-auth`)
  or custom.
- **Event source (Commerce / AEM / Custom) ↔ I/O Events** — Adobe-
  managed; signed events.
- **I/O Events ↔ Runtime handler** — Adobe internal; at-least-once
  delivery.
- **Action ↔ IMS** — S2S OAuth or JWT for token exchange; token TTL
  short.
- **Action ↔ State SDK** — Adobe-managed KV; namespace-scoped.
- **Action ↔ Files SDK** — S3-backed; presigned URLs for external
  fetch.
- **Action ↔ External API (Commerce Admin, third-party)** — TLS + API
  key from `params`.
- **API Mesh ↔ upstream sources** — mesh-level auth; per-source
  credentials.

## Assets and data classification for App Builder

- **IMS S2S credentials** — Confidential; store in Adobe Console
  workspace secrets.
- **IMS access tokens** — Restricted; short TTL (~1h);
  never log.
- **API keys for upstream** — Confidential; passed via `--param-file`
  at deploy.
- **Event payloads** — variable per event type; classify per source.
- **State entries** — variable; treat as untrusted between actions.
- **Log activation payload** — Internal; do not log secrets or PII.

## Per-component STRIDE table

| Component-Type | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | EoP | Common Mitigations |
|---|---|---|---|---|---|---|---|
| Web action | missing `require-adobe-auth` | body injection | activation log gap | error body leaks stack | invocation flood → quota | admin action publicly reachable | require-adobe-auth or explicit JWT check; DTO validate; sanitized error; per-workspace quota; per-action ACL |
| Event handler | forged event via test endpoint | payload replay | no dedupe audit | log leaks event body | event storm | privileged onward call | verify event signature; idempotency via State dedupe key; masked logger; concurrency limit |
| API Mesh handler | upstream API key theft | GraphQL injection | mesh log gap | over-fetch fields | complexity DoS | admin field via public mesh | rotate keys; depth+complexity limits; field-level ACL |
| Sequence | wrong action order | intermediate result tamper | sequence log gap | intermediate leaks | slow action starves sequence | privileged action last in chain | test action order; validate between; short timeouts |
| UI SPA action | XSS via authored | drop-in prop tamper | no client log | leak IMS token in URL | main-thread block | admin UI publicly served | CSP; do not store IMS token in localStorage; separate admin app |
| State access | wrong namespace | value tamper | no read audit | leak of secrets | quota exhaustion | admin key writable by user action | scope by prefix; encrypt values; TTL; quota alarm |
| Files access | presigned URL guess | overwrite | no access log | leak private path | quota exhaustion | overwrite of shared file | UUID paths; short TTL on presigned; separate namespace per tenant |

## Common threats + mitigations for App Builder

- **Logging `params` object leaks IMS token + API keys** →
  `@adobe/aio-lib-core-logging` mask; explicit allow-list of logged
  fields.
- **Event replay attack** → dedupe on cloudevent `id` in State SDK
  with TTL longer than event retention window.
- **Missing `require-adobe-auth` on web action** → CI check in
  `app.config.yaml` linter; must be explicit yes/no.
- **Cold-start token fetch on every invocation** → cache IMS token in
  module scope with expiry buffer; refresh at 80% of TTL.
- **Long-running action hitting 60s timeout** → split via sequence or
  async pattern with callback.
- **Secret in `app.config.yaml` default value** → use `$INPUT` env var
  ref; scan repo for hardcoded values.
- **API Mesh public resolver expose admin data** → per-field ACL via
  directives; test with unauth call in CI.
- **Trust-boundary confusion — action assumes event came from Commerce**
  → verify event provider + signature; do not trust `source` field
  blindly.
- **Deep import from `@adobe/aio-*` package internals** → semver-safe
  imports only; renovate + upstream release watch.

## Attack trees for common flows

### Attack tree — IMS token exfil via log

```
Goal: obtain IMS S2S token from activation log
├── Action logs `params`
├── Attacker with log-read scope views activation
└── Uses token against IMS-authenticated APIs
Mitigation: mask logger; per-workspace log ACL; token rotation on suspected leak
```

### Attack tree — Event replay to double-award loyalty points

```
Goal: award points twice for same order
├── Discover event handler is not idempotent
├── Trigger event replay (test endpoint or Journaling API)
└── Second invocation succeeds
Mitigation: dedupe on event id in State with TTL > event retention; idempotent write in Commerce Admin
```

### Attack tree — Web action DoS

```
Goal: exhaust workspace quota
├── Discover public web action
├── Loop invoke
└── Workspace throttled → real traffic dropped
Mitigation: per-action rate-limit at API Mesh; require-adobe-auth; monitor quota + alert
```

## PCI / GDPR / SOX applicability per App Builder

- **PCI** — do not handle card data in App Builder; use gateway
  tokenization. If handling tokens (network / gateway), scope minimally.
- **GDPR** — event payloads may contain PII; document per event type;
  RTBF via cascading action against Commerce.
- **SOX** — if action mutates financial data, log the mutation via
  audit topic (I/O Events custom provider).
- **SOC 2** — Adobe App Builder in Adobe's SOC 2 scope
  <!-- verify: current SOC 2 posture -->; merchant retains code +
  config controls.

## Residual-risk framing per App Builder

- Accept vendor risk of Adobe-managed I/O Runtime.
- Accept medium residual on cold-start latency (not a security issue
  unless causing timeouts on auth flows).
- Do not accept residual on `require-adobe-auth: no` for actions that
  reach Commerce Admin.
- Do not accept residual on secrets logged via `params`.

## Anti-patterns to avoid for App Builder

- Treating "it's Adobe-hosted" as sufficient — customer code is
  customer's problem.
- Skipping event dedupe — at-least-once semantics guarantee replay.
- Rating every action "critical" — grade by data reach + auth chain.
- Modeling only web actions — event handlers are equal surface.
- Ignoring API Mesh — mesh resolver is often the largest public
  surface.

---

Generate the full threat model using `templates/threat-model-stride.md`
as master, populating placeholders with stack-appropriate content from
the guide above. Reference the LLD
(`resources/lld-templates/app-builder.md`) for component list.
