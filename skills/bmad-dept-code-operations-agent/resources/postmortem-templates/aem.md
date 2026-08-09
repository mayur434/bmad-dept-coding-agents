# Postmortem authoring guide — AEM (AEMaaCS + AMS)

## Purpose framing

An AEM postmortem is a **blameless retrospective run after the incident
has been fully resolved** — it closes the loop from `playbook-templates/aem.md`
(response) back into `runbook-templates/aem.md` (future response) and
`slo-templates/aem.md` (future prevention). Every SEV1 gets one within
5 business days; SEV2 by team-lead decision (mandatory if 3+ in 30d);
SEV3 optional. Focus: what happened on the Publish/Author/Dispatcher
tier, why the systems let it happen, and what we're changing in Cloud
Manager, dispatcher config, or JCR governance.

## Common failure modes for AEM

Recurring root-cause patterns worth calling out by name in the timeline
and RCA sections; each has a typical detection window:

- **Dispatcher misconfig deploy** — cache-key/farm-filter regression collapsing hit-ratio. Detection: 5-15 min after purge storm hits Publish origin.
- **Author-tier OOM** — JCR session leak or workflow storm exhausting heap. Detection: 20-60 min (silent until GC storm surfaces).
- **CF publication stall** — replication agent stuck on poison payload; editorial launch blocked. Detection: 5-30 min via CF publication-lag SLI.
- **JCR replication break** — Publish subscriber offline or auth drift; queues fill silently. Detection: 5 min via queue-depth alert.
- **DAM upload timeout under load** — asset-processing worker starvation. Detection: 10-30 min once editorial reports rendition failures.
- **Cloud Manager quality-gate deployed-anyway (override)** — release manager overrode a WARN, regression reached prod. Detection: minutes to hours post-deploy.
- **Unauthorized JCR mutation via admin bypass** — service-user token abused or Federated ID compromised. Detection: minutes (SIEM) to days (audit review).
- **Sling job queue backlog on customer-critical topic** — worker starvation or poison message. Detection: 10-60 min via topic-depth alert.
- **CDN origin exposure** — dispatcher `AllowFrom` regression exposing internal endpoints. Detection: minutes via WAF / SIEM.
- **Author-authored broken CF model** — required-property removal breaks live Publish reads. Detection: at first client request.

## Timeline capture patterns for AEM

Pull evidence for the timeline section from:

- **Cloud Manager execution timestamps** — pipeline start/end + per-stage duration + step-level log (execution ID is mandatory for Adobe support cross-reference).
- **Dispatcher access log** — `/var/log/httpd/dispatcher/access.log` and `error.log` (AMS); Log Forwarding stream for AEMaaCS.
- **AEM `error.log` / `access.log` / `audit.log`** — `crx-quickstart/logs/` on AMS; Log Forwarding audit stream on AEMaaCS. <!-- verify: Log Forwarding audit endpoint -->
- **Author JCR audit** — `/system/console/jmx` → `RepositoryManagement` node-version diff; crx2oak snapshot metadata.
- **Fastly / CDN RUM** — request-rate panel + purge-log timeline (Cloud Manager CDN panel).
- **Adobe Customer Care case log** — every touchpoint with Adobe support recorded with case ID + program ID + timestamp.

Format: UTC timestamps, actor (person or "system"), action, evidence link (Cloud Manager execution URL, log excerpt path, Adobe case ID).

## Root-cause analysis methods for AEM

- **5-whys** — default for dispatcher / JCR / CF incidents (single causal chain).
- **Fishbone (Ishikawa)** — when multiple contributing factors span editorial process, deploy tooling, and platform config.
- **Fault-tree** — for IMS token / STRIDE security incidents; walk each disjoint attack surface.
- **Chaos replay** — for cascade Publish outages; reproduce in stage using traffic-shadow.

AEM leans on **5-whys** most often — dispatcher and JCR incidents usually collapse to a single systemic answer (a missing pre-deploy check, a missing schema-guard, a missing quality gate).

## Contributing-factor taxonomy for AEM

- **Technical debt** — known-open backlog (e.g. `AEM-4211: dispatcher config lacks pre-deploy diff`).
- **Process gap** — missing runbook, missing Cloud Manager quality gate, missing editorial launch checklist.
- **Human error** — release manager overrode a WARN; framed blamelessly (the tooling allowed override without a second reviewer).
- **External dependency** — Adobe platform outage, CDN provider issue, Federated ID (IMS) auth outage.
- **Config drift** — env divergence between stage and prod; cross-reference `env-diff-templates/aem.md` (Release agent).

## What-went-well template for AEM

- Dispatcher fell back to cached content gracefully — customer TTFB held.
- Cloud Manager quality gate caught a related regression on the retry pipeline pre-prod.
- Adobe Customer Care responded within P1 SLA and provided a Log Forwarding hotfix.
- Replication queues drained cleanly once subscriber came back — no manual JCR fix needed.
- Editorial team paused launches within 3 min of `#aem-oncall` declaration.
- Cloud Manager rollback executed in < 6 min end-to-end.

## Action-item taxonomy for AEM

Every postmortem produces action items — categorize per stack:

- **Prevention** — root-cause fix in code (Sling model NPE guard), config (dispatcher pre-deploy diff), or Cloud Manager (add a quality-gate metric).
- **Detection** — new alert on CF publication lag, new dashboard tile for Sling job depth, tighter SLO burn-rate window.
- **Response** — runbook update (add missing quick-diagnosis step), playbook update (STRIDE structure for repeat class), on-call training on Cloud Manager rollback drill.
- **Communication** — comms template update, status-page automation, Adobe Customer Care contact matrix refresh.

Per action item: owner (person, not team) + due-date + priority (P0: within week; P1: within month; P2: within quarter) + tracking-ticket-id (Jira/Asana).

## Blameless-language enforcement for AEM

- REJECT "the release manager pushed a broken deploy" → REPLACE "the Cloud Manager quality gate did not flag the dispatcher config change; the release proceeded on WARN".
- REJECT "the developer forgot to add a health check" → REPLACE "the health-check checklist wasn't wired into the PR template; the omission wasn't caught in review".
- REJECT "editorial published a broken CF" → REPLACE "the CF authoring UI accepted a required-property removal without preview against Publish; adding schema-diff validation".

## Stakeholder review process for AEM

- **Author:** incident commander from the playbook run.
- **Reviewers:** SRE lead + AEM tech lead + dispatcher-admin (if edge involved).
- **Approvers:** engineering manager (SEV1: + director; SEV1 with DAM PII exposure: + legal + compliance + DPO).
- **Publication:** internal wiki + `#aem-oncall` announcement; external status page + customer notice for Publish/CDN-visible SEV1.
- **Adobe cross-file:** if AEMaaCS platform contributed, attach postmortem summary to the Adobe Customer Care case.

## 2 worked postmortem examples for AEM

### Example 1 — Publish-tier v3.2.0 outage (SEV1, 47 min)

Severity SEV1. Duration 47 min. Blast radius: eu-west Publish, ~180k affected sessions, $22k estimated revenue impact via checkout redirects failing. Root cause (5-whys): Publish 5xx → bundle `com.customer.loyalty` in INSTALLED not ACTIVE → OSGi config missing in `runmode=publish` → the config-only pipeline wasn't in Cloud Manager release train → the release process treated code and config as one artifact. Action items: (P0) split config-only pipeline in Cloud Manager (owner @alice, due +1w); (P0) add `bundle-state != ACTIVE` alert (owner @bob, due +1w); (P1) health-check smoke against Publish tier post-deploy (owner @cara, due +2w). Well: Cloud Manager rollback in < 6 min; runbook quick-diagnosis identified bundle state in 4 min.

### Example 2 — IMS service-user token compromise (SEV1, 3h investigation)

Severity SEV1 (security). Duration 3h investigation, 0 min customer downtime. Blast radius: 1 service-user token leaked in public GitHub gist; 72h activity window audited; no JCR mutation detected. Root cause (5-whys): token in gist → developer copied token into a local script → local script committed by mistake → pre-commit hook didn't scan for Adobe IMS token pattern → the org's secret-scanning ruleset lacked the IMS token regex. Action items: (P0) add IMS-token regex to org secret-scanning (owner @security-lead, due +3d); (P0) rotate all sibling service-user tokens (owner @sre-lead, due +1d); (P1) enforce token-scope minimization in Developer Console (owner @platform-lead, due +2w). Well: token revoked within 8 min of detection; Adobe Developer Console rotation worked cleanly.

## Anti-patterns to avoid for AEM

- Don't skip UTC timestamps — Cloud Manager and Adobe support reason in UTC only.
- Don't skip action-item owners — team-only ownership defers accountability.
- Don't blame individuals — blame the tooling / process that let the human err.
- Don't skip the Cloud Manager execution ID for Cloud-hosted incidents — Adobe Customer Care can't cross-reference without it.
- Don't publish DAM-PII-exposure postmortems externally without legal + DPO review.
- Don't leave the JCR-audit contributing-factor unfilled for security incidents.

---

Generate the full postmortem using `templates/postmortem.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `playbook-templates/aem.md` for the response the postmortem retrospects on, and `runbook-templates/aem.md` for symptom-specific technical detail.
