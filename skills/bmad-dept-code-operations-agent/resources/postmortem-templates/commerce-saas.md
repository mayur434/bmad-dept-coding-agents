# Postmortem authoring guide — Adobe Commerce SaaS

## Purpose framing

A Commerce SaaS postmortem is a **blameless retrospective run after the
Catalog Service / drop-in / Payment Services incident is resolved** — it
closes the loop from `playbook-templates/commerce-saas.md` back into
`runbook-templates/commerce-saas.md` and `slo-templates/commerce-saas.md`.
Every SEV1 gets one within 5 business days; SEV2 by decision (mandatory
on repeat); SEV3 optional. Focus: what broke in the SaaS-hosted service
boundary (which Adobe owns) vs the drop-in/storefront code (which the
customer team owns), why the split didn't route the alert correctly, and
what we're changing on our side of the boundary.

## Common failure modes for Commerce SaaS

Recurring root-cause patterns, each with typical detection window:

- **Drop-in version mismatch across environments** — stage on v3.2, prod on v3.0; regression appears only in prod. Detection: immediate at deploy.
- **Catalog Service rate-limit hit under launch load** — 429 storm from drop-in; PDPs blank. Detection: 3-10 min via 429-rate SLI.
- **Storefront-events schema drift** — event payload shape changed; downstream analytics + personalization break silently. Detection: hours to days (analytics gap).
- **Live Search index corruption** — index rebuild dropped tokens; category pages return empty. Detection: 15-60 min via search-conversion drop.
- **API Mesh resolver latency** — GraphQL federation hits N+1; drop-in TTI degrades. Detection: 5-15 min via drop-in load p95.
- **Payment Services round-trip timeout** — Adobe Payment Services degradation; checkout hangs. Detection: 5-15 min via checkout SLI.
- **IMS token cache miss storm** — token cache TTL expired for all merchants at once; auth latency spike. Detection: 5-10 min via IMS RT p95.
- **Consent-mode-off in analytics config** — PII leaking to third-party tags. Detection: hours via privacy audit.
- **CDN purge lag on catalog update** — merchant sees old prices for 5-10 min post-publish. Detection: merchant report or synthetic check.

## Timeline capture patterns for Commerce SaaS

- **Storefront-events emission log** — Adobe Experience Platform event stream; per-event timestamp + payload hash.
- **Adobe I/O log** — I/O Runtime activation history if drop-in extensions run there; per-activation IDs.
- **Payment Services log** — Payment-Services-side transaction ID + timestamp; cross-reference to acquiring bank.
- **Adobe Support case log** — Adobe Commerce SaaS platform-side timeline; case ID + program ID + timestamp.
- **Merchant admin activity log** — who published which catalog change, when.
- **Drop-in bundle CDN log** — which bundle version served which region at which timestamp (surfaces version-drift incidents).
- **Browser RUM** — real-user drop-in load times, JS errors from live sessions.

Format: UTC timestamps, actor (merchant / customer / system / Adobe), action, evidence link.

## Root-cause analysis methods for Commerce SaaS

- **5-whys** — default for drop-in / storefront-events / config incidents.
- **Fishbone (Ishikawa)** — for incidents spanning Adobe (Catalog Service, Payment Services) + our drop-in + our analytics + CDN.
- **Fault-tree** — for consent-mode / PII leaks (STRIDE information-disclosure).
- **Chaos replay** — rarely applicable; SaaS is Adobe-managed.

Commerce SaaS leans **fishbone** — most incidents touch both the Adobe-managed service boundary and our storefront code; the postmortem must attribute contribution clearly to route action items correctly.

## Contributing-factor taxonomy for Commerce SaaS

- **Technical debt** — known-open backlog (e.g. `CS-441: drop-in version pinning per env overdue`).
- **Process gap** — missing merchant runbook, missing schema-drift detector, missing pre-launch load-test on Catalog Service quota.
- **Human error** — merchant published a catalog change that violated a schema constraint; framed blamelessly (admin UI allowed the invalid config).
- **External dependency** — Adobe Catalog Service, Adobe Payment Services, IMS, Adobe I/O outage.
- **Config drift** — drop-in version drift across env; storefront-events consent-mode drift; cross-reference `env-diff-templates/commerce-saas.md`.

## What-went-well template for Commerce SaaS

- Drop-in fallback rendered a cached PDP for 3 min while Catalog Service rate-limited.
- Payment Services failover to secondary payment method engaged automatically.
- Storefront-events consent gate caught PII flag before it hit analytics.
- Adobe Support responded within P1 SLA; a hotfix landed within 45 min.
- Live Search returned a fallback ranker when the primary index was corrupt.
- Rollback of drop-in bundle via CDN was < 2 min end-to-end.

## Action-item taxonomy for Commerce SaaS

- **Prevention** — root-cause fix in drop-in code, admin UI validation, Catalog Service quota pre-arrangement with Adobe.
- **Detection** — new alert on 429 rate, new dashboard tile for storefront-events schema drift, new SLI for drop-in TTI.
- **Response** — runbook update, playbook update, Adobe Support paging matrix refresh.
- **Communication** — comms template update, merchant notification template, Adobe escalation contact matrix.

Per action item: owner + due-date + priority (P0 within week; P1 within month; P2 within quarter) + tracking-ticket-id.

## Blameless-language enforcement for Commerce SaaS

- REJECT "the merchant pushed a bad drop-in" → REPLACE "the drop-in deploy tooling didn't validate version parity across env; a mismatched bundle reached prod".
- REJECT "the analytics engineer forgot consent-mode" → REPLACE "the storefront-events emission library defaulted consent-mode off; adding config linter".
- REJECT "someone changed the schema" → REPLACE "the schema-change process didn't include a downstream-consumer notification step; adding schema-registry gate".

## Stakeholder review process for Commerce SaaS

- **Author:** incident commander from the playbook run.
- **Reviewers:** SRE lead + drop-in tech lead + Adobe Commerce SaaS liaison.
- **Approvers:** engineering manager (SEV1: + director; SEV1 with PII/PCI: + legal + compliance + DPO).
- **Publication:** internal wiki + `#commerce-saas-oncall`; external merchant/customer notice for checkout-visible SEV1.
- **Adobe cross-file:** attach postmortem summary to Adobe Support case for platform-contributed incidents.

## 2 worked postmortem examples for Commerce SaaS

### Example 1 — Product-launch Catalog Service 429 storm (SEV1, 24 min)

Severity SEV1. Duration 24 min. Blast radius: launch-day PDPs blank for ~65% of visitors for 24 min; ~$45k estimated revenue loss + 2.1k abandoned sessions. Root cause (fishbone): launch traffic 8× baseline (external — marketing coordination gap) → drop-in fired 4 Catalog Service calls per PDP (own — no request coalescing) → Catalog Service quota not pre-arranged for launch (own — process gap with Adobe) → 429 storm collapsed PDP render. Action items: (P0) request coalescing in drop-in v3.3 (owner @drop-in-lead, due +1w); (P0) launch-day quota pre-arrangement process with Adobe (owner @sre-lead, due +1w); (P1) 429-rate SLO burn-rate alert (owner @sre-lead, due +2w). Well: cached PDP fallback held for 3 min.

### Example 2 — Storefront-events consent-mode PII leak (SEV1, 6 days undetected)

Severity SEV1 (privacy). Duration: 6 days undetected + 2h remediation. Blast radius: ~48k EU sessions with consent=off had email + user-ID emitted to third-party analytics; regulator notification triggered. Root cause (fault-tree): storefront-events lib update flipped consent default → CI didn't run consent-mode integration test → schema-registry didn't have a consent-required flag → privacy audit ran quarterly, not per deploy. Action items: (P0) consent-required flag on all PII fields in schema registry (owner @privacy-lead, due +1w); (P0) consent-mode CI gate (owner @dev-lead, due +1w); (P1) automated per-deploy privacy audit (owner @privacy-lead, due +1mo); (P0) regulator notification per GDPR Article 33 (owner @legal, due +3d — completed). Well: RUM captured all affected sessions for reach quantification.

## Anti-patterns to avoid for Commerce SaaS

- Don't skip UTC timestamps.
- Don't skip action-item owners.
- Don't blame merchants — blame the admin UI / validation that let them err.
- Don't publish postmortem details externally without legal + privacy review.
- Don't attribute Adobe-side failures without evidence (Adobe Support case + timeline).
- Don't skip drop-in-version-per-env in the timeline — version drift is a common contributor.
- Don't leave consent-mode contributing-factor unfilled for analytics incidents.

---

Generate the full postmortem using `templates/postmortem.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `playbook-templates/commerce-saas.md` for the response the postmortem retrospects on, and `runbook-templates/commerce-saas.md` for symptom-specific technical detail.
