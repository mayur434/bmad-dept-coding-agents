# Incident-response playbook authoring guide — Adobe Commerce SaaS

## Purpose framing

A Commerce SaaS playbook covers **incident classes** on the SaaS
storefront stack — drop-in bundle failures, Catalog/Payment Services
outages, Storefront-events pipeline stalls — where the merchant owns
the storefront but Adobe owns the platform. Symptom-scoped response
belongs in `resources/runbook-templates/commerce-saas.md`. Because
Adobe's SaaS services are shared multi-tenant, the merchant's playbook
must draw a clean seam between **what the merchant can contain**
(storefront, drop-ins, cart) vs **what only Adobe can contain**
(Catalog/Payment Services regional outage). Apply STRIDE for security
incidents impacting the merchant's drop-in surface.

## Incident-type catalog for Commerce SaaS

- **Drop-in bundle load failure** — CDN/edge serves stale or malformed drop-in bundle; storefront blank.
- **Catalog Service outage** — Adobe-side; PLP/search returns 0 results globally.
- **Payment Services outage** — Adobe-side; checkout collapses to error state.
- **Storefront-events pipeline failure** — event backlog stalls personalization + analytics.
- **Drop-in security incident** — supply-chain compromise of a drop-in package version.
- **Cart-persistence break** — cart-service errors cause item-loss on refresh.
- **Consent-mode misconfiguration** — GTM/consent config leaks PII before opt-in.

## STRIDE structure for security incidents

- **Spoofing** — merchant admin credential compromise → Admin Console revoke; force IMS re-auth; audit Storefront-config API calls last 72h.
- **Tampering** — unauthorized drop-in config change → revert via Storefront-config API to last-known-good; audit change-log.
- **Repudiation** — verify Storefront-events audit stream + Adobe Admin audit-log are intact before restart.
- **Information disclosure** — PII leak via misconfigured GTM consent-mode → immediate GTM revert; enumerate exposed sessions via edge logs.
- **Denial of service** — edge DDoS on merchant storefront → Fastly rate-limit + WAF rule; Adobe TAM escalation if origin (Adobe SaaS) affected.
- **Elevation of privilege** — supply-chain injection into a drop-in npm package → package version pin + integrity-hash lockdown + rebuild.

## Roles + responsibilities per Commerce SaaS

- **IC** — merchant SRE lead or platform-eng manager.
- **Comms Lead** — pairs with merchant-support + Adobe TAM.
- **Ops Lead** — frontend/drop-in engineer (drop-in incidents), platform-SRE (edge/CDN), integration eng (events).
- **Scribe** — captures drop-in bundle hashes, Storefront-events IDs, Catalog Service trace-IDs, timestamps UTC.
- **SMEs** — Adobe Commerce SaaS TAM, Fastly TAM, Adobe Customer Care.

## Initial-triage matrix for Commerce SaaS

- **SEV1** — storefront blank (drop-in fail), Catalog/Payment global outage, PII leak via consent-mode, cart-persistence 100% loss.
- **SEV2** — Storefront-events backlog > 15 min, single drop-in degraded (e.g. PDP but not PLP), regional Adobe SaaS degradation.
- **SEV3** — drop-in warning-only regression, single event-topic backlog on non-critical stream.

Decision flow: `alert fired → is drop-in surface loading? → is checkout completable? → is PII surface leaking? → SEV assignment`.

## Containment steps for Commerce SaaS

- Revert drop-in package version via CDN edge-config or GitOps rollback.
- Pin drop-in `integrity` hash to last-known-good in the storefront HTML.
- Enable Fastly `serve stale` (`beresp.stale_if_error`) for drop-in bundle path.
- Disable non-critical drop-ins (recommendations, personalization) to reduce blast radius.
- Freeze Storefront-config API writes (revoke API key temporarily).
- Fall back checkout to `redirect to Adobe checkout URL` if Payment Services degraded.
- Revert GTM consent-mode config to prior version; block analytics beacons until fix.
- Isolate Storefront-events consumer if a bad event triggers cascading failure.

## Investigation steps per Commerce SaaS

- **Log locations:** merchant edge (Fastly) access log; browser RUM error stream; Storefront-events trace UI; Adobe Admin audit log.
- **Drop-in:** compare deployed bundle hash against expected; run `npm audit` on drop-in tree.
- **Adobe-side outages:** check Adobe status page; open TAM case with trace-ID + tenant-ID.
- **Spoofing:** Admin Console audit; Storefront-config API access-log last 72h.
- **Tampering:** diff Storefront-config JSON against last-known-good in Git.
- **Info-disclosure:** GTM tag audit; edge log for beacons pre-consent.
- **DoS:** Fastly RPS + WAF top-source-ASN.
- **EoP (supply-chain):** `npm ls`, `package-lock.json` integrity check, drop-in dependency-tree audit.

## Eradication + recovery per Commerce SaaS

- Rebuild drop-in bundle with pinned versions + integrity-hash regen.
- Restore Storefront-config from Git-tracked backup.
- Adobe SaaS outages: wait for TAM confirmation; verify Catalog/Payment status endpoints green.
- Re-enable non-critical drop-ins once core storefront verified.
- Purge Fastly + CDN edge; RUM verification of first-paint + hydration.

## Communications plan for Commerce SaaS

- **Internal:** `#storefront-oncall`, `#drop-ins`, `#merchant-support`.
- **External:** consumer status page (if consumer-facing outage); merchant status page (B2B storefronts).
- **Regulatory:** PII consent-mode leaks trigger jurisdictional notifications (GDPR, CCPA).
- **Vendor:** Adobe TAM 24/7 P1 case with tenant-ID + trace-ID + timestamp window.

Sample lines: `[INCIDENT — SEV1] Storefront blank in us-east; drop-in bundle 404 since 09:12 UTC. IC @carol. Bridge <link>.`

## Stand-down criteria for Commerce SaaS

- Storefront TTFB + hydration within 10% of baseline for 30 min (from `slo-templates/commerce-saas.md`).
- Catalog Service PLP/search success ≥ 99.5% for 30 min.
- Payment Services checkout completion ≥ 99% for 30 min.
- Storefront-events lag < 1 min.
- No new alerts firing: SEV1 60 min, SEV2 30 min, SEV3 15 min.
- All external comms resolved.

## Postmortem trigger for Commerce SaaS

- **SEV1** — always. Adobe-side outages: joint postmortem with Adobe TAM.
- **SEV2** — required for repeat (3+ in 30 days).
- **SEV3** — optional.

Cross-reference `resources/postmortem-templates/commerce-saas.md` (3.5c-iii).

## 2 worked playbook examples for Commerce SaaS

### Example 1 — "Drop-in bundle 404 → storefront blank"

Type: availability, SEV1. Symptom: RUM shows drop-in `catalog@1.4.2` returning 404 from CDN since 09:12 UTC; storefront blank for 100% of eu-west sessions. Triage: revenue-critical → SEV1. Containment: rollback via CDN edge-config to `catalog@1.4.1`; pin integrity hash. Investigation: CDN cache purge log shows misconfigured origin path in v1.4.2 release. Eradication: rebuild + republish v1.4.3 with corrected origin. Recovery: purge + verify hydration. Stand-down: RUM first-paint healthy 30 min.

### Example 2 — "Consent-mode misconfig leaked analytics pre-consent"

Type: security (Info-disclosure), SEV1. Symptom: privacy-eng flagged GTM firing analytics beacons before consent granted for eu-west traffic. Triage: GDPR-scope → SEV1 pending DPO. Containment: GTM revert to prior config; block analytics tags in GTM workspace; freeze GTM publishes. Investigation: enumerate affected sessions from Fastly log; scope PII in beacons. Eradication: republish GTM with correct consent-mode gating; add pre-publish lint. Recovery: staged re-enable with DPO sign-off. Stand-down: audit clean, DPO briefed.

## Anti-patterns to avoid for Commerce SaaS

- Don't debug an Adobe SaaS outage as if it's a merchant bug — check Adobe status first, open TAM immediately.
- Don't skip STRIDE for supply-chain incidents — drop-in package injection is EoP.
- Don't push a drop-in fix without integrity-hash update — you re-open the attack window.
- Don't communicate before confirming Adobe TAM has the case — merchant status must match Adobe status.
- Don't skip scribe — Adobe TAM requires trace-ID + tenant-ID + timestamps for RCAs.

Generate the full playbook using `templates/playbook.md` as the master, populating placeholders with stack-appropriate content from the guide above.
