# Incident-response playbook authoring guide — AEM (AEMaaCS + AMS)

## Purpose framing

An AEM playbook is written for the on-call IC handling an **incident
class** — a security breach on the Author tier, a region-wide Publish
outage, DAM data corruption — not a single symptom. Symptom-scoped
response belongs in `resources/runbook-templates/aem.md`; a playbook
composes multiple runbooks under an Incident Commander. For any
security-flavored AEM incident (IMS token compromise, JCR tampering,
unauthorized bundle install) apply STRIDE structuring so investigation
paths stay disjoint and the audit trail is preserved.

## Incident-type catalog for AEM

Ordered by likelihood on a production AEMaaCS estate:

- **Publish-tier outage** — region-wide 5xx after deploy or config drift; customer-visible.
- **Dispatcher misconfiguration** — cache-key or farm-filter regression collapsing hit-ratio + origin overload.
- **Author-tier unresponsive** — JCR session leak, replication clog, or long-running query starving worker threads.
- **DAM corruption** — asset-processing loop, missing rendition profile, or replication-driven asset overwrite.
- **Content Fragment publication stall** — workflow model regression; editorial launch blocked.
- **Cloud Manager pipeline failure** — quality-gate regression or perf-stage timeout blocking release.
- **Unauthorized Author access** — IMS/SSO token or admin credential compromise.
- **IMS token compromise** — service-user token leaked in a repo, CI log, or public bundle.

## STRIDE structure for security incidents

- **Spoofing** — IMS token compromise → revoke tokens via Admin Console, force IMS re-auth on all Author users, dump audit-log for the token's activity window, notify affected editorial users.
- **Tampering** — unauthorized JCR mutation (page/CF/asset overwrite) → snapshot the JCR via crx2oak, diff against last-known-good backup, isolate offending service user.
- **Repudiation** — verify `crx-quickstart/logs/audit.log` (AMS) or Log Forwarding audit stream (AEMaaCS) is intact and covers the entire incident window before any restart.
- **Information disclosure** — DAM asset with PII/PCI leaked to Publish → purge dispatcher + CDN, revoke share links, invoke breach-notification workflow with legal.
- **Denial of service** — Publish DDoS → enable dispatcher stricter cache-control + CDN rate-limit; block source ASN at WAF.
- **Elevation of privilege** — unauthorized OSGi bundle install → disable Felix Web Console external access, revert via Cloud Manager, audit `/system/console/bundles` install history.

## Roles + responsibilities per AEM

- **IC** — release manager or on-call SRE lead; owns declaration + stand-down.
- **Comms Lead** — pairs with editorial lead if content publication is impacted.
- **Ops Lead** — dispatcher-admin (edge/cache) or AEM tech lead (bundle/OSGi/JCR), rotated by incident type.
- **Scribe** — captures Cloud Manager execution IDs, bundle-ids, JCR paths, timestamps in UTC.
- **SMEs** — Adobe Customer Care liaison for AEMaaCS platform issues, DAM lead for asset incidents, security engineer for STRIDE incidents.

## Initial-triage matrix for AEM

- **SEV1** — Publish region-wide outage, DAM/PII exposure on Publish, IMS token active compromise, Author tier down + editorial freeze.
- **SEV2** — dispatcher hit-ratio < 85% sustained, single-Publish-instance 5xx > 5%, CF publication lag > 15 min, Cloud Manager pipeline FAIL on active release.
- **SEV3** — single-tenant Author slowness, single asset processing failure, Sling job backlog on non-critical topic.

Decision flow: `alert fired → check tier scope (Author/Publish/Dispatcher) → check blast radius (single-instance vs region) → check customer-visible surface (Publish + CDN) → assign SEV`.

## Containment steps for AEM

- Freeze Author content edits via **Users & Permissions → Deny write** on the impacted group.
- Disable dispatcher writes (`AllowFrom` block) if edge is the attack surface.
- Restrict IMS logins via Admin Console **Federated ID → Suspend** for the affected group.
- Snapshot JCR before any restart — `oak-run.jar checkpoint` (AMS) or Adobe support snapshot (AEMaaCS). <!-- verify: AEMaaCS snapshot procedure -->
- Enable stricter dispatcher cache-control (`/statfileslevel "3"`) on Publish under DDoS.
- Revoke suspected IMS service-user tokens via Adobe Developer Console.
- Isolate compromised Publish instance from the load balancer (Cloud Manager → Environment → drain).
- Pause Cloud Manager pipeline if a deploy is in flight (`aio cloudmanager:pipeline:cancel-execution`). <!-- verify -->

## Investigation steps per AEM

- **Log locations:** `crx-quickstart/logs/error.log`, `access.log`, `audit.log` (AMS); Log Forwarding + Cloud Manager logs (AEMaaCS).
- **Dispatcher:** `/var/log/httpd/dispatcher.log`, `access.log`, `error.log`.
- **Forensic snapshots:** crx2oak snapshot of JCR; Fastly/CDN access log export via Cloud Manager.
- **Spoofing:** query IMS audit stream for the affected user/token; check `/system/console/jmx` → `Session` MBean for anomalous service-user logins.
- **Tampering:** `/system/console/jmx` → `RepositoryManagement` → node-version compare; diff Content Fragment against last-known-good backup.
- **Information disclosure:** enumerate `/content/dam/**` served through dispatcher last 24h; correlate with editorial launch times.
- **DoS:** dispatcher log `grep -c MISS`, CDN request-rate panel, WAF source-ASN histogram.
- **Elevation of privilege:** `/system/console/bundles` install-time sort; diff against Cloud Manager expected bundle set.

## Eradication + recovery per AEM

- Revert offending code via Cloud Manager **Rollback** to the prior GREEN execution.
- Restore JCR from snapshot via crx2oak or Adobe Customer Care.
- Rotate all IMS service-user tokens created before the incident window.
- Purge dispatcher + CDN once eradication verified; validate hit-ratio ≥ 95% over 15 min.
- Re-enable Author writes only after IMS re-auth of all suspended users.

## Communications plan for AEM

- **Internal:** `#aem-oncall` (declaration + updates), `#aem-releases` (deploy state), `#customer-status` (external draft).
- **External:** status page — customer-facing Publish/CDN incidents only; internal Author outages are not customer-visible.
- **Regulatory:** required for DAM PII/PCI exposure on Publish; legal on the bridge before any notification.
- **Vendor:** Adobe Customer Care P1 case with Cloud Manager program ID + execution ID + timestamp window.

Sample lines: `[INCIDENT — SEV1] AEM Publish us-east 5xx 3.2% since 14:22 UTC. IC @alice. Bridge <link>. Next update 14:45 UTC.`

## Stand-down criteria for AEM

- Publish 5xx rate < 0.5% sustained 15 min (from `slo-templates/aem.md`).
- Dispatcher hit-ratio ≥ 95% sustained 15 min.
- Replication queues empty; no `403`/`404` from any Publish subscriber.
- No new alerts firing for the incident-type category: SEV1 60 min, SEV2 30 min, SEV3 15 min.
- Editorial + customer notifications posted with resolution.
- JCR integrity verified against pre-incident snapshot.

## Postmortem trigger for AEM

- **SEV1** — always postmortem within 5 business days.
- **SEV2** — team-lead decision; required if repeat (3+ in 30 days).
- **SEV3** — optional.

Cross-reference `resources/postmortem-templates/aem.md` (3.5c-iii).

## 2 worked playbook examples for AEM

### Example 1 — "Publish-tier outage post-v3.2.0"

Type: availability, SEV1. Symptom: `/content/**` Publish 5xx 4.7% at T+6min post-deploy in eu-west. Triage: region-wide, customer-visible → SEV1. Containment: pause Cloud Manager, drain affected Publish instances from LB. Investigation: `/system/console/status-productinfo` shows `INSTALLED` bundle `com.customer.loyalty`; error.log NPE in Sling model. Eradication: Cloud Manager rollback to v3.1.7. Recovery: verify healthcheck + hit-ratio + 5xx rate over 15 min. Stand-down: 5xx < 0.5% for 15 min, notified `#customer-status`.

### Example 2 — "IMS token compromise for build service user"

Type: security (Spoofing), SEV1. Symptom: token found in a public GitHub gist. Triage: active-compromise potential → SEV1 pending audit. Containment: revoke token in Adobe Developer Console; suspend Federated ID for the service user; freeze Cloud Manager. Investigation: audit-log dump for token activity window (last 72h); enumerate JCR mutations; diff DAM state. Eradication: rotate all sibling tokens; add GitHub secret-scanning; force Cloud Manager rotation. Recovery: re-issue new token; unfreeze pipeline. Stand-down: audit clean, notification sent to editorial.

## Anti-patterns to avoid for AEM

- Don't restart the Author tier before snapshotting JCR — you lose forensic evidence.
- Don't skip STRIDE for IMS/token incidents — spoofing vs elevation-of-privilege drives different containment.
- Don't communicate to `#customer-status` before Comms Lead + IC sign-off — leaked updates trigger regulator timeline.
- Don't clear replication queues during investigation — you erase the timeline.
- Don't skip the scribe role — Adobe Customer Care requires Cloud Manager execution IDs + timestamps.

Generate the full playbook using `templates/playbook.md` as the master, populating placeholders with stack-appropriate content from the guide above.
