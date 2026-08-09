# Compliance applicability guide — EDS (Edge Delivery Services)

## Purpose framing

Edge Delivery Services is an **edge-rendered, git-driven storefront/
content stack** — no traditional application server in the request
path, content authored in a document (Google Docs/SharePoint) or
markdown source, transformed and served from the edge. That structural
difference reshapes the compliance profile entirely: there is no
server-side payment logic, no database of customer records living
inside EDS itself, so PCI drops to none. What remains heavy is
**client-side**: consent management, analytics/marketing tag loading,
and XSS-class weaknesses in whatever client-side JS the block library
introduces.

## Framework applicability matrix for EDS

| Framework | Applicability | Primary trigger | Typical evidence source |
|---|---|---|---|
| CWE | Medium | Client-side JS block code is the main weakness surface — DOM XSS sinks, unsafe `innerHTML` usage. Server-side weakness classes (SQLi, deserialization) largely don't apply — there's no traditional server-side app layer. | `audit` findings tagged `EDS-SEC-*`. |
| OWASP | Medium | Mostly client-side, XSS-focused (A03 Injection via DOM sinks); Broken Access Control and server-side categories apply much less since EDS has minimal server-side logic. | `sonar-scan`/`audit` findings on block/component JS. |
| CIS | Light | Most CIS safeguards (network hardening, server patching) don't apply to an edge-rendered, git-driven stack with no managed server to patch; the safeguards that remain are content-supply-chain and access-control (who can publish). | Git repository access controls, publish-pipeline audit trail. |
| PCI-DSS | None | No server-side payment logic exists in EDS itself — any checkout is either a redirect to a hosted payment page or (if commerce is involved) the drop-in integration surface, which is a separate concern (see `eds-commerce.md`). | N/A for pure-EDS; re-evaluate if a payment-adjacent block is found. |
| HIPAA | Light | Rarely applicable — content-only edge delivery has minimal PHI-handling surface unless a health-content site is confirmed to publish PHI-adjacent content (rare, human-confirmed only). | Human-confirmed applicability only. |
| GDPR | Heavy | Consent-management-platform integration, analytics/marketing tag loading, and any embedded form (even a simple newsletter signup) all fall under GDPR. | Consent-management-platform (CMP) integration code, analytics/tag-loading script gating. |
| SOX | Light | Content/storefront delivery layer rarely touches financial-reporting systems directly. | Not typically applicable; re-evaluate only if EDS renders financial-disclosure content. |
| ISO 27001 | Medium | Content-authoring access control and the publish pipeline are code/config-observable; most Annex A controls remain organizational. | Git repository access-control config, publish-pipeline (GitHub Actions/equivalent) audit trail. |

## Shared-responsibility notes for EDS

EDS's edge/CDN layer and the document-to-markup transformation pipeline
are Adobe-managed <!-- verify: confirm the current scope of Adobe's
managed responsibility for EDS's edge infrastructure and whether a
specific compliance certification is published for it before citing
externally -->. The customer's responsibility is everything
authored and configured on top: block-library JS, third-party
script/tag loading, consent-gate logic, and — critically — who has
write access to the content source (a Google Doc, a SharePoint
document, or a git repository) that drives what gets published. Because
EDS's publish path is unusually direct — an edited document can go live
very quickly — access control on the *content source*, not just the
code repository, deserves explicit compliance attention that doesn't
have a clean analog on the other stacks in this suite.

## Stack-specific evidence sources

- Git commit history — because EDS content and code changes are git-tracked, this is an **inherent, ready-made audit trail** unmatched by any other stack in this suite.
- Consent-management-platform (CMP) logs — consent-grant/revoke events.
- Content-source access-control settings (Google Workspace/SharePoint sharing permissions) — who can edit/publish source documents.
- Publish-pipeline (GitHub Actions or equivalent) run history.
- Site-wide `helix-query`/sitemap configuration — indirectly useful for confirming what content is publicly indexed vs. intended to stay unlisted.

## Stack-specific common gaps

- Missing consent-gate before analytics/marketing scripts load on page render (GDPR — scripts firing before consent is granted).
- Inline scripts without a CSP nonce/hash, widening XSS blast radius (OWASP A05 / CWE-1021).
- Unsafe `innerHTML` assignment in custom block JS instead of safe DOM APIs (`EDS-SEC-002`, CWE-79).
- Overly broad content-source edit access (e.g. a shared Google Doc editable by anyone with the link) — a content-supply-chain integrity gap, not a code gap.
- Third-party tag-manager scripts loaded with no subresource-integrity check, widening the trust boundary (CWE-1104 <!-- verify: CWE-1104 Use of Unmaintained Third Party Components — confirm best-fit ID for missing SRI specifically -->).
- No documented data-retention statement for analytics data collected via marketing tags (GDPR Art. 5).
- A newsletter/lead-capture form block posting directly to a third-party ESP with no visible privacy-notice link near the submit action (GDPR Art. 13 transparency obligation).
- No CSP `report-uri`/`report-to` configured, so a script-injection attempt would go undetected rather than logged (CIS Control 8 — monitoring gap).

## Stack-specific compliance quick-wins

- Gate all analytics/marketing script injection behind the CMP's consent signal — closes the single most common GDPR gap on this stack in one code change.
- Add CSP headers with nonces for any inline script blocks — closes an OWASP A05 gap suite-wide.
- Tighten content-source (Doc/SharePoint) sharing settings to named editors only — closes a content-integrity gap that has no code-level fix, only a permissions change.
- Replace unsafe `innerHTML` usage in block JS with `textContent`/safe DOM construction — closes CWE-79 findings with a small, mechanical refactor.
- Add a privacy-notice link adjacent to every lead-capture form block — a one-line template change that closes a GDPR Art. 13 transparency gap sitewide.

## Worked scenario for EDS

A retail brand's marketing site runs on EDS with a block library that
includes a newsletter-signup form (posting to a third-party ESP) and a
marketing-analytics tag loaded on every page.

Likely-applicable frameworks: GDPR (heavy — analytics tag and
newsletter form both process personal data with no visible consent
gate), CWE/OWASP (medium — inline script and one custom block using
`innerHTML`), CIS/ISO 27001 (medium — access control on the content
source is the main lever), PCI (none), HIPAA/SOX (light, no signal).

A first compliance report run would likely surface: the analytics tag
loading unconditionally on page load with no consent check (GDPR gap,
HIGH — a pure-gap row since there's no source finding, only a
framework-assigned severity), a custom block's `innerHTML` usage
flagged by `audit` (`EDS-SEC-002`, CWE-79, MEDIUM), and — a positive
finding worth noting in the cover letter — the CIS/audit-trail posture
is unusually strong here because every content and code change is
already git-tracked by construction.

Of 6 findings merged for this scope, a representative outcome is: 3
controls covered (CSP baseline present on most pages, block JS
otherwise clean), 2 gaps (the consent-gate finding and the `innerHTML`
finding above), and 1 documentation-only gap noted in the cover letter
rather than the control-mapping proper — the newsletter form has no
adjacent privacy notice, a GDPR transparency issue a template change
resolves in minutes. Because EDS finding volumes tend to be small and
the git-tracked audit trail is already strong, first-time compliance
runs on this stack often land closer to "mostly covered, a couple of
quick fixes" than the denser gap counts typical of Commerce or Spring
scopes.

## Cross-references

See `resources/framework-mappings/gdpr.md` (heavy), `resources/framework-mappings/cwe.md`
and `resources/framework-mappings/owasp.md` (medium), `resources/framework-mappings/cis.md`
and `resources/framework-mappings/iso27001.md` (medium/light).

Use this guide alongside `resources/framework-mappings/<framework>.md` when
generating a control-mapping report scoped to EDS.
