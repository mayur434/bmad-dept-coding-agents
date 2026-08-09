# Compliance applicability guide — App Builder (Adobe I/O Runtime extensions)

## Purpose framing

App Builder is Adobe's serverless extensibility layer — actions running
on Adobe I/O Runtime, typically gluing together other Adobe products
(AEM, Commerce, Target, Analytics) or external systems via webhooks and
API calls. As an **extension/middleware layer**, App Builder rarely owns
data of its own; it passes data *through*. That makes its compliance
profile almost entirely a function of what systems it integrates —
PCI/HIPAA/SOX applicability depends entirely on what App Builder actions
touch, while the platform's own serverless-runtime characteristics
(shared-responsibility infrastructure, per-action auth) stay constant
across every App Builder deployment.

## Framework applicability matrix for App Builder

| Framework | Applicability | Primary trigger | Typical evidence source |
|---|---|---|---|
| CWE | Medium | Serverless-action weakness classes (missing auth, input validation, logging hygiene) map cleanly but the surface per action is small. | `audit` findings tagged `APPB-SEC-*`. |
| OWASP | Medium | Actions are HTTP-invocable, so Broken Access Control and Injection apply; smaller surface area than a full web app per action. | `sonar-scan`/`audit` findings on action handlers. |
| CIS | Medium | Access-control and logging safeguards are code-observable; the I/O Runtime infrastructure itself is Adobe-managed and outside CIS code-scan scope. | Action-level auth annotations, I/O Runtime deployment manifest. |
| PCI-DSS | Depends | None by default; heavy only if a specific action is confirmed to directly handle card data (uncommon — most Adobe payment integrations route through Commerce Payment Services, not App Builder). | Human-confirmed applicability per action. |
| HIPAA | Depends | None by default; scoped in only if an action is confirmed to process PHI as part of an integration (e.g. syncing patient-facing content metadata). Never inferred. | Human-confirmed applicability only. |
| GDPR | Medium | Applies whenever an action passes personal data between systems (e.g. syncing a customer record from Commerce to a CRM) — common enough to default to medium rather than none. | Action payload/request-mapping code. |
| SOX | Depends | None by default; heavy only if an action moves financial-reporting-relevant data between systems (e.g. syncing order totals to a finance system). | Action-level data-flow mapping, if financial-data-adjacent. |
| ISO 27001 | Medium | Technical controls (per-action auth, secret management) are code-observable; the I/O Runtime infrastructure's own ISMS controls are Adobe's. | Action auth-annotation coverage, secret-store references in `.env`/deployment config. |

## Shared-responsibility notes for App Builder

Adobe I/O Runtime is fully Adobe-managed serverless infrastructure —
compute provisioning, scaling, and the runtime's own patching are
Adobe's responsibility, and Adobe's published trust documentation
covers the platform layer <!-- verify: confirm current I/O Runtime
compliance-certification scope on Adobe's Trust Center before citing in
an externally-facing artifact -->. The customer remains fully
responsible for: whether each action requires authentication
(`require-adobe-auth` or an equivalent per-action gate), what data an
action logs, how secrets/API keys are stored and rotated, and — most
importantly — what the action does with the data flowing through it.
Because App Builder is a thin middleware layer, the most common
compliance mistake here isn't "assuming Adobe covers it" (the way it is
with Commerce SaaS) — it's **under-scoping**: teams treat App Builder
actions as "just glue code" and skip a compliance review entirely, when
an action passing PII or payment-adjacent data between two systems
carries the same GDPR/PCI obligations as if that logic lived in a
first-party service.

## Stack-specific evidence sources

- Adobe I/O Runtime action-invocation logs.
- Action manifest (`app.config.yaml`) — per-action `require-adobe-auth` and annotation configuration.
- Secrets referenced via `.env`/deployment config and the secrets-manager audit trail behind them.
- Webhook-registration configuration for inbound-triggered actions.
- Action-level rate-limit/throttling configuration — relevant to CIS Control 13 (denial-of-service resilience) for publicly-triggered actions.

## Stack-specific common gaps

- Actions missing the `require-adobe-auth: true` annotation, reachable without authentication (`APPB-SEC-001`, CWE-306 / OWASP A01).
- Sensitive fields (customer PII, tokens) logged inside action handlers for debugging and left enabled in production (`APPB-SEC-003`, CWE-532 / GDPR Art. 32).
- API keys/secrets for downstream systems hardcoded in action source rather than referenced from a secrets store (CWE-798).
- No input validation on webhook-triggered action payloads before they're forwarded downstream (CWE-20).
- No documented data-flow map for what PII/financial data an action passes between systems — a recurring gap because App Builder is treated as "just glue code."
- Overly broad IMS/OAuth scopes granted to the App Builder application registration, beyond what any individual action actually calls (CWE-269 / CIS Control 6).
- No retry/idempotency safeguard on an action that mutates downstream financial or order data, risking duplicate-write incidents (SOX-adjacent data-integrity gap, when financial data is in scope).

## Stack-specific compliance quick-wins

- Add `require-adobe-auth: true` (or an equivalent explicit auth gate) to every action manifest entry — closes CWE-306 findings suite-wide in one config pass.
- Strip PII/token fields from debug-log statements before production deploy — closes CWE-532/GDPR gaps with a logging-hygiene pass, not a rewrite.
- Move all downstream-system API keys to a secrets manager referenced at runtime — closes CWE-798 across every action.
- Write a one-page data-flow note per integration ("this action moves X data from system A to system B") — the single highest-leverage GDPR/PCI scoping fix on this stack, and it's documentation, not code.
- Scope the IMS/OAuth application registration down to only the products/APIs each action actually calls — closes an over-provisioning gap application-wide, not action-by-action.

## Worked scenario for App Builder

A retailer uses App Builder to sync customer loyalty-tier updates from
Commerce to a third-party marketing platform, triggered by a Commerce
webhook on every order completion. The action forwards customer email,
loyalty tier, and lifetime order total.

Likely-applicable frameworks: GDPR (medium, resolving to heavy for this
specific action once confirmed — customer email and purchase data are
personal data flowing to a third party), CWE/OWASP (medium), CIS/ISO
27001 (medium), PCI (none — no card data present), HIPAA (none), SOX
(depends — likely none unless "lifetime order total" is treated as
financial-reporting-relevant, which the team should confirm).

A first compliance report run would likely surface: the action missing
`require-adobe-auth` on its webhook-receiver endpoint (CWE-306, HIGH),
the marketing-platform API key hardcoded in the action source
(CWE-798, CRITICAL), and a GDPR pure-gap row asking whether a Data
Processing Agreement exists with the third-party marketing platform —
not code-observable, routed to human/legal review.

Across 7 findings scoped to this single action (App Builder findings
sets are typically small and per-integration rather than
project-wide), a representative outcome is: 3 controls covered, 3 gaps
(the two above plus an overly broad IMS scope on the application
registration — it can read/write far more of the Commerce API than
this one sync action needs), and 1 GDPR row routed to human review.
Because App Builder integrations are often built quickly and
iterated on by a small team, this stack sees a disproportionate share
of `wontfix`/`deferred` decisions in `.bmad/decisions.yaml` relative to
its finding volume — teams frequently accept a scoped, documented risk
on a low-traffic internal integration rather than investing in a fix
cycle, which is a legitimate outcome as long as the rationale is
recorded.

## Cross-references

See `resources/framework-mappings/cwe.md` and `resources/framework-mappings/owasp.md`
(medium), `resources/framework-mappings/gdpr.md` (medium — verify per
integration), `resources/framework-mappings/iso27001.md` (medium),
`resources/framework-mappings/pci.md`/`hipaa.md`/`sox.md` (depends
entirely on what system the action integrates with — never assume).

Use this guide alongside `resources/framework-mappings/<framework>.md` when
generating a control-mapping report scoped to App Builder.
