# Incident-response playbook authoring guide — EDS + Commerce (drop-ins)

## Purpose framing

An EDS+Commerce playbook covers **compound incident classes** where an
EDS-side issue (edge, sheet, block) cascades through the commerce
drop-ins (cart, checkout, PDP), or vice versa. Symptom-level response
belongs in `resources/runbook-templates/eds-commerce.md`. The IC's
core job is to distinguish **EDS-origin** (sheet/edge/block) from
**Commerce-origin** (drop-in package, Catalog/Payment SaaS) from
**integration-origin** (cart-persistence, consent-mode) — the wrong
diagnosis wastes the first 10 minutes. Apply STRIDE for any consent-mode
or drop-in supply-chain incident.

## Incident-type catalog for EDS+Commerce

- **EDS incident + drop-in cascade** — sheet regression breaks cart mount block; global cart down.
- **Cart-persistence break** — cart-service errors cause item-loss on navigation/refresh.
- **Consent-mode breach** — GTM/consent config fires commerce analytics pre-consent.
- **Drop-in bundle 404 via EDS block loader** — CDN-side drop-in miss serves broken PDP/PLP.
- **Sheet-driven catalog override drift** — merchant sheet-config override conflicts with Catalog Service response.
- **PDP block failure on hot SKU** — high-traffic PDP throws JS error, 100% add-to-cart failure.
- **Checkout redirect loop** — misconfigured drop-in checkout URL vs EDS route.

## STRIDE structure for security incidents

- **Spoofing** — merchant admin (EDS + Commerce Admin) credential compromise → revoke via both consoles; force IMS re-auth.
- **Tampering** — unauthorized sheet or drop-in config change → `git revert` (EDS) + Storefront-config revert (Commerce); joint audit.
- **Repudiation** — verify Helix admin audit + Commerce Admin audit intact + shipped to SIEM.
- **Information disclosure** — consent-mode misfire leaking commerce analytics pre-consent → immediate GTM revert; enumerate exposed sessions.
- **Denial of service** — coordinated edge + drop-in DDoS → Fastly WAF rate-limit both origins; Adobe TAM escalation.
- **Elevation of privilege** — drop-in package supply-chain injection → pin package version + integrity-hash lockdown + rebuild.

## Roles + responsibilities per EDS+Commerce

- **IC** — commerce-eng lead (revenue-critical) or platform-SRE lead.
- **Comms Lead** — pairs with merchant-support + consumer-support.
- **Ops Lead** — web-eng (EDS/sheet/block), drop-in eng (commerce drop-ins), integration-eng (cart/checkout).
- **Scribe** — captures commit-SHAs, drop-in bundle hashes, cart-service trace-IDs, Storefront-events IDs, timestamps UTC.
- **SMEs** — Adobe Commerce SaaS TAM, Adobe Helix TAM, Fastly TAM.

## Initial-triage matrix for EDS+Commerce

- **SEV1** — checkout down globally, cart-loss > 5% of sessions, consent-mode breach fireing commerce PII pre-opt-in, drop-in supply-chain compromise.
- **SEV2** — PDP block regression on top-1000 SKUs, cart-persistence intermittent, Storefront-events lag > 15 min.
- **SEV3** — single non-critical block regression, single low-traffic PDP degraded.

Decision flow: `alert fired → is edge serving? → is drop-in bundle loading? → is cart mutating cleanly? → is checkout completing? → SEV assignment`.

## Containment steps for EDS+Commerce

- Revert offending sheet or `git revert` in EDS repo; republish via Sidekick + edge purge.
- Rollback drop-in package version via CDN edge-config or storefront HTML integrity-hash swap.
- Disable non-critical drop-ins (recommendations, personalization) to reduce blast radius.
- Enable Fastly `serve stale` on drop-in bundle path.
- Fall back checkout to Adobe-hosted checkout URL if drop-in checkout is broken.
- Revert GTM consent-mode config; block commerce analytics tags until fix.
- Freeze both EDS `main` branch + drop-in publish pipeline.
- Isolate cart-service consumer if a bad event triggers loss cascade.

## Investigation steps per EDS+Commerce

- **Log locations:** Helix admin logs, Fastly access log (both EDS + Commerce origins), RUM error stream, cart-service trace store, Storefront-events trace UI.
- **Cross-stack correlation:** align timestamps across EDS commit-SHA, drop-in bundle-hash, and cart-service deploy-version.
- **Sheet vs drop-in isolation:** load storefront with `?dropinDebug=true` (or equivalent) to isolate which layer errors first. <!-- verify -->
- **Spoofing:** joint audit — Helix admin + Commerce Admin activity for the incident window.
- **Tampering:** EDS repo `git log -p` + Storefront-config diff.
- **Info-disclosure:** GTM tag audit + Fastly beacon capture.
- **DoS:** RPS panels for both EDS edge + drop-in CDN.
- **EoP (supply-chain):** `npm ls` for drop-in tree + integrity-hash validation.

## Eradication + recovery per EDS+Commerce

- Fix + republish via GitOps (EDS) + drop-in package publish with new integrity-hash.
- Purge Fastly across both origins.
- RUM verification: first-paint + hydration + add-to-cart success + checkout completion.
- Rotate any secrets/tokens touched during incident window.
- Re-enable non-critical drop-ins gradually with per-tier verification.

## Communications plan for EDS+Commerce

- **Internal:** `#eds-oncall`, `#commerce-oncall`, `#storefront-integration`.
- **External:** consumer status page (revenue-critical outages) + merchant status page (B2B storefronts).
- **Regulatory:** consent-mode breaches trigger jurisdictional notifications (GDPR, CCPA); commerce PII leaks trigger state AG notifications.
- **Vendor:** Adobe TAM (joint EDS + Commerce SaaS) + Fastly TAM.

Sample lines: `[INCIDENT — SEV1] Cart mount block error globally since 08:42 UTC; add-to-cart 0%. IC @henry. Bridge <link>.`

## Stand-down criteria for EDS+Commerce

- Add-to-cart success ≥ 99% sustained 30 min (from `slo-templates/eds-commerce.md`).
- Checkout completion rate within 10% of baseline sustained 30 min.
- RUM Core Web Vitals within 10% of baseline sustained 30 min.
- No new alerts firing: SEV1 60 min, SEV2 30 min, SEV3 15 min.
- Cart-persistence verified across nav/refresh/session-restore.

## Postmortem trigger for EDS+Commerce

- **SEV1** — always postmortem within 5 business days. Consent-mode breaches: DPO on postmortem review.
- **SEV2** — team-lead decision; required for repeat (3+ in 30 days) or > $10k revenue impact.
- **SEV3** — optional.

Cross-reference `resources/postmortem-templates/eds-commerce.md` (3.5c-iii).

## 2 worked playbook examples for EDS+Commerce

### Example 1 — "Sheet regression → cart mount block error → add-to-cart 0%"

Type: availability + revenue, SEV1. Symptom: cart mount block throwing TypeError globally since 08:42 UTC; add-to-cart 0% conversions. Triage: revenue-critical → SEV1. Containment: `git revert` last sheet-driven config commit; republish via Sidekick; purge edge. Investigation: sheet-diff removed a required drop-in config key. Eradication: restore key + add sheet-schema lint for cart-config keys. Recovery: RUM add-to-cart success returned to baseline. Stand-down: 30 min baseline + merchant-support notified.

### Example 2 — "Drop-in supply-chain injection → consent-mode PII exfiltration"

Type: security (EoP + Info-disclosure), SEV1. Symptom: security-eng flagged drop-in `analytics-integration@2.1.0` making outbound POST to unknown domain with cart PII pre-consent. Triage: cross-jurisdictional PII exfil → SEV1 pending DPO. Containment: pin drop-in to `@2.0.9`; integrity-hash swap in storefront HTML; edge purge; GTM revert; block analytics tags; freeze both pipelines. Investigation: enumerate affected sessions; scope PII exposure per jurisdiction. Eradication: publish patched drop-in; add integrity-hash CI gate + supply-chain scanner. Recovery: staged re-enable with DPO sign-off. Stand-down: audit clean, DPO briefed, notifications sent per jurisdiction.

## Anti-patterns to avoid for EDS+Commerce

- Don't debug drop-in errors without first isolating EDS vs drop-in vs integration layer — you waste 10 min in the wrong stack.
- Don't push a drop-in fix without integrity-hash update — you re-open the supply-chain window.
- Don't force-push to EDS `main` — breaks joint audit trail with Storefront-config.
- Don't skip STRIDE for consent-mode incidents — info-disclosure obligations are jurisdictional and time-boxed.
- Don't skip scribe — cross-stack correlation requires timestamps + commit-SHAs + bundle-hashes + trace-IDs.

Generate the full playbook using `templates/playbook.md` as the master, populating placeholders with stack-appropriate content from the guide above.
