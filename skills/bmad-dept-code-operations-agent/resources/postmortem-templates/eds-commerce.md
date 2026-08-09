# Postmortem authoring guide — EDS + Commerce hybrid

## Purpose framing

An EDS + Commerce postmortem is a **blameless retrospective run after
the hybrid drop-in / storefront / edge / Commerce-SaaS incident is
resolved** — it closes the loop from `playbook-templates/eds-commerce.md`
back into `runbook-templates/eds-commerce.md` and `slo-templates/eds-commerce.md`.
Every SEV1 gets one within 5 business days; SEV2 by decision (mandatory
on repeat); SEV3 optional. Focus: which side of the hybrid boundary
failed (EDS edge vs Commerce SaaS drop-in vs Catalog/Payment Services),
why the cross-boundary signals didn't correlate quickly, and what we're
changing on either side.

## Common failure modes for EDS + Commerce

Recurring root-cause patterns, each with typical detection window:

- **Drop-in bundle upgrade broke cart persistence** — drop-in v3.1 changed storage-key naming; live carts orphaned. Detection: 5-15 min via cart-recovery-rate drop.
- **Consent-mode-off caused PII leak to analytics** — drop-in emitted `user_email` without consent gate. Detection: hours to days via privacy audit.
- **Checkout-events schema drift between EDS + Commerce SaaS** — EDS block emits `qty` (int), Commerce SaaS expects `quantity` (int); downstream analytics gap. Detection: hours to days via analytics gap.
- **Catalog Service query latency piped to EDS block** — Catalog Service p95 spike collapses EDS PDP TTI. Detection: 5-15 min via LCP + Catalog p95.
- **Payment Services round-trip observed edge-side** — Payment Services degradation shows up as EDS checkout hang. Detection: 5-15 min via checkout SLI.
- **Drop-in version drift across env** — EDS preview shows v3.2, live shows v3.0; regression only in live. Detection: at repro attempt.
- **Sheet-driven pricing override collided with Catalog Service** — sheet-driven promo override vs Catalog canonical price; disagreement per env. Detection: at customer complaint.
- **Consent-manager JS load order regression** — consent library loaded after storefront-events; leak window. Detection: hours via audit.
- **Storefront-events emitter fell off with drop-in upgrade** — event stream silent; personalization data pipeline dry. Detection: 4-24h via data-freshness alarm.

## Timeline capture patterns for EDS + Commerce

- **Helix debug endpoint** — EDS preview vs live per-file status.
- **Edge access log** — per-request block-name, drop-in bundle version served, region.
- **Drop-in bundle CDN log** — which drop-in bundle version served which region at which timestamp.
- **Catalog Service query log** — per-query timestamp + latency + status (Adobe-side).
- **Payment Services log** — per-transaction ID + timestamp (Adobe-side).
- **Storefront-events emission log** — Adobe Experience Platform event stream; per-event timestamp + payload hash.
- **RUM error timeline** — real-user JS errors correlated to block + drop-in version.
- **Git commit + PR history** — EDS-side deploy timeline (git-backed).
- **Adobe Support case log** — for Commerce SaaS platform-contributed incidents.

Format: UTC timestamps, actor (author / developer / drop-in / helix / edge / Adobe), action, evidence link — critically, tag each entry with **owner-side** (EDS / Commerce-SaaS / Adobe / Merchant).

## Root-cause analysis methods for EDS + Commerce

- **5-whys** — for single-side incidents (pure EDS or pure Commerce SaaS).
- **Fishbone (Ishikawa)** — **most common for hybrid**: incidents typically span EDS + drop-in + Commerce SaaS + analytics + consent + CDN. Multiple contributing factors from disparate teams.
- **Fault-tree** — for privacy / consent incidents; walk each disjoint leak path.
- **Chaos replay** — for cross-boundary latency-cascade incidents.

EDS + Commerce leans **fishbone** — the hybrid boundary is the frequent contributing factor and the postmortem must attribute contribution clearly on both sides.

## Contributing-factor taxonomy for EDS + Commerce

- **Technical debt** — known-open backlog (e.g. `EC-72: drop-in version-pinning per env overdue`).
- **Process gap** — missing cross-boundary runbook, missing schema-drift detector across EDS block + Commerce event, missing consent-mode integration test.
- **Human error** — author edited sheet-driven promo without Catalog Service coordination; framed blamelessly (sheet UI didn't warn about conflict).
- **External dependency** — Adobe Catalog Service, Payment Services, IMS, helix platform, CDN.
- **Config drift** — drop-in version drift; consent-mode drift across env; cross-reference `env-diff-templates/eds-commerce.md`.

## What-went-well template for EDS + Commerce

- Drop-in fallback rendered cached PDP for 3 min while Catalog Service rate-limited.
- Edge cache absorbed 8 min of Commerce SaaS degradation.
- Storefront-events consent-gate blocked a `user_email` leak before it hit analytics.
- Git revert of EDS block deployed in < 60s; drop-in rollback via CDN in < 2 min.
- RUM captured cross-boundary failure with block-name + drop-in-version + Catalog-latency correlation.
- Payment Services failover engaged; 91% of in-flight carts recovered.

## Action-item taxonomy for EDS + Commerce

- **Prevention** — root-cause fix in drop-in code, block code, sheet-schema linter, or consent-mode CI gate.
- **Detection** — new alert on drop-in-version-drift, new dashboard tile for cross-boundary cart-recovery-rate, tighter LCP SLO with Catalog attribution.
- **Response** — cross-boundary runbook update, playbook update, on-call training on hybrid attribution.
- **Communication** — comms template update, merchant + customer notification templates, Adobe escalation matrix.

Per action item: owner (EDS-side vs Commerce-SaaS-side named explicitly) + due-date + priority (P0/P1/P2) + tracking-ticket-id.

## Blameless-language enforcement for EDS + Commerce

- REJECT "the EDS author broke the drop-in" → REPLACE "the sheet allowed a pricing config that conflicted with Catalog Service canonical; adding cross-source validation".
- REJECT "the drop-in dev shipped a bad bundle" → REPLACE "the drop-in deploy tooling didn't validate version parity across env; a mismatched bundle reached prod".
- REJECT "the merchant misconfigured consent" → REPLACE "the consent-mode default was off; the storefront-events emitter had no consent-required flag; adding both".

## Stakeholder review process for EDS + Commerce

- **Author:** incident commander from the playbook run.
- **Reviewers:** SRE lead + EDS tech lead + Commerce SaaS drop-in lead + Adobe liaison.
- **Approvers:** engineering manager (SEV1: + director; SEV1 with PII/PCI: + legal + compliance + DPO).
- **Publication:** internal wiki + `#eds-commerce-oncall`; external merchant/customer notice for checkout-visible SEV1; status page for outage.
- **Adobe cross-file:** attach summary to Adobe Support case for Commerce SaaS platform-contributed incidents.

## 2 worked postmortem examples for EDS + Commerce

### Example 1 — Drop-in v3.1 broke cart persistence (SEV1, 32 min)

Severity SEV1. Duration 32 min. Blast radius: 100% live carts orphaned for 32 min; ~14k affected carts, ~$52k estimated recoverable revenue lost. Root cause (fishbone): drop-in v3.1 changed cart storage key from `dropin_cart` to `commerce_cart` (Commerce-SaaS-side — schema change without migration) → EDS block wrapper called drop-in `getCart()` and returned null (EDS-side — no defensive handling) → drop-in release notes didn't flag as breaking (Adobe-side — process) → EDS-side CI didn't have drop-in-upgrade smoke test (own — process gap). Action items: (P0) drop-in-upgrade smoke test in EDS CI (owner @eds-lead, due +1w); (P0) storage-key migration shim in drop-in (owner @commerce-lead, due +1w); (P1) Adobe drop-in release-notes review process (owner @commerce-lead, due +2w). Well: git revert of EDS wrapper in 50s reduced impact window.

### Example 2 — Consent-mode leak across drop-in + EDS (SEV1, 9 days undetected)

Severity SEV1 (privacy). Duration: 9 days undetected + 3h remediation. Blast radius: ~72k EU sessions leaked `user_id + email` via drop-in checkout-events + EDS block RUM emitter; GDPR regulator notification triggered. Root cause (fault-tree branches): (1) consent library loaded async, storefront-events emitted before consent resolved; (2) drop-in v3.1 defaulted consent-mode off; (3) EDS block RUM emitter never checked consent flag; (4) privacy audit ran quarterly, not per drop-in upgrade. Action items: (P0) synchronous consent-gate before any event emission (owner @privacy-lead, due +1w); (P0) consent-required flag on all PII fields in schema registry (owner @privacy-lead, due +1w); (P0) per-drop-in-upgrade privacy audit (owner @privacy-lead, due +1w); (P0) regulator notification per GDPR Article 33 (owner @legal, due +3d — completed). Well: RUM had enough sampling to reach-quantify affected sessions.

## Anti-patterns to avoid for EDS + Commerce

- Don't skip UTC timestamps.
- Don't skip action-item owners.
- Don't blame merchants / authors / drop-in devs — blame the systems / tooling.
- Don't skip owner-side tagging in the timeline — hybrid attribution requires it.
- Don't skip drop-in-version-per-env in the evidence chain.
- Don't publish PII/PCI postmortems externally without legal + DPO review.
- Don't skip RUM-based cross-boundary correlation for hybrid latency incidents.
- Don't attribute a Commerce-SaaS-side failure without an Adobe Support case number.

---

Generate the full postmortem using `templates/postmortem.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `playbook-templates/eds-commerce.md` for the response the postmortem retrospects on, and `runbook-templates/eds-commerce.md` for symptom-specific technical detail.
