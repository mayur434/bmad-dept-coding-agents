# Incident-response playbook authoring guide — Apache Sling (custom OSGi)

## Purpose framing

A Sling playbook covers **incident classes** on a custom OSGi + JCR
runtime (Sling apps not on AEMaaCS) — bundle catastrophic failure,
JCR replication break, MDM data corruption, SAM API abuse. Symptom-level
response belongs in `resources/runbook-templates/sling.md`; playbooks
compose runbooks under an IC. Custom OSGi environments are especially
exposed to **Elevation-of-privilege** via bundle install/update, so
STRIDE structuring is non-negotiable for security incidents.

## Incident-type catalog for Sling

- **OSGi bundle catastrophic failure** — bundle fails to activate, drags dependent bundles offline.
- **JCR replication break** — Author → Publish subscriber down; content freeze.
- **MDM data corruption** — mixed-in properties mismatched, node-type constraint violation.
- **SAM (Sling API Management) abuse** — unauthenticated endpoint hammered.
- **Unauthorized bundle install** — malicious bundle deployed via Felix Web Console.
- **JCR session leak** — unclosed sessions exhausting connection pool.
- **Sling job queue starvation** — poison message blocking topic worker.

## STRIDE structure for security incidents

- **Spoofing** — service-user token compromise → revoke via Sling `system/users`; audit `access.log` for the token's activity window.
- **Tampering** — unauthorized JCR mutation → snapshot repository via oak-run; diff against last-known-good backup.
- **Repudiation** — verify `audit.log` + Sling `RequestLog` shipped to SIEM; block Felix Web Console external access.
- **Information disclosure** — SAM endpoint leaking JCR content unauthenticated → immediate `AllowFrom` restrict + Sling filter deploy.
- **Denial of service** — SAM/API DDoS → activate WAF rate-limit; Sling `IPFilter` block source ASNs.
- **Elevation of privilege** — unauthorized bundle install → disable Felix Web Console (`/system/console` httpd deny); revert bundle set to known baseline.

## Roles + responsibilities per Sling

- **IC** — platform SRE lead.
- **Comms Lead** — pairs with content-ops if replication break freezes editorial.
- **Ops Lead** — OSGi engineer (bundle/config), JCR admin (repository/replication), SAM owner (API incidents).
- **Scribe** — captures bundle-IDs + versions, JCR paths, session-IDs, request-IDs, timestamps UTC.
- **SMEs** — Adobe/community for oak internals, security engineer for STRIDE incidents.

## Initial-triage matrix for Sling

- **SEV1** — customer-visible outage, unauthorized bundle install, JCR replication break > 15 min, MDM corruption on production.
- **SEV2** — Publish-tier degraded (partial 5xx), SAM API abuse triggering pool-exhaustion, session leak sustained.
- **SEV3** — Sling job queue backlog on non-critical topic, single non-customer-visible bundle failure.

Decision flow: `alert fired → is bundle graph healthy? → is JCR replication current? → is any SAM endpoint under abuse? → SEV assignment`.

## Containment steps for Sling

- Stop offending bundle via Felix Web Console → **Stop** (not uninstall; preserve state).
- Disable replication agent from Author → target subscriber if the subscriber is compromised.
- Snapshot JCR via `oak-run checkpoint` before any restart.
- Block Felix Web Console external access via httpd `AllowFrom` restrict.
- Restrict SAM endpoint via Sling `IPFilter` or WAF rule.
- Kill leaked JCR sessions via `/system/console/jmx` → `SessionRegistry`.
- Isolate poison-message-topic (`/system/console/slingjobs` → hold).
- Freeze new bundle installs (block `/system/console/bundles` POST).

## Investigation steps per Sling

- **Log locations:** `logs/error.log`, `logs/access.log`, `logs/request.log`, `logs/audit.log`, `logs/stdout.log`.
- **Bundle state:** `/system/console/bundles.json`; `bnd bundle:inspect`. <!-- verify -->
- **JCR:** `oak-run explore` for repository walk; `oak-run diff` for two-checkpoint diff.
- **Spoofing:** enumerate `system/users` service-user activity in access log.
- **Tampering:** oak-run diff against pre-incident checkpoint.
- **Info-disclosure:** grep `access.log` for SAM endpoint responses > 200 bytes unauthenticated.
- **DoS:** RPS histograms per SAM path; source-ASN top-N.
- **EoP:** `/system/console/bundles` install-time sort; diff against known baseline manifest.

## Eradication + recovery per Sling

- Revert offending bundle to prior version via `bnd deploy` or GitOps rollback.
- Restore JCR from checkpoint via `oak-run restore`.
- Rotate compromised service-user tokens; force re-auth on Author users.
- Redeploy Sling filter to close unauth SAM endpoint; add integration test.
- Re-enable replication agent; verify subscriber queue drains within 5 min.
- Purge Sling job queue DLQ once eradication verified.

## Communications plan for Sling

- **Internal:** `#sling-oncall`, `#sling-releases`, `#content-ops` (if editorial affected).
- **External:** rare — Sling deployments typically internal or headless-API.
- **Regulatory:** required if SAM leak exposed PII/PCI.
- **Vendor:** community + internal escalation only (no vendor SLA on Apache Sling).

Sample lines: `[INCIDENT — SEV1] Publish replication broken since 11:47 UTC; content freeze in effect. IC @dave. Bridge <link>.`

## Stand-down criteria for Sling

- Bundle graph fully `ACTIVE` (no `INSTALLED`/`RESOLVED` on customer-critical bundles).
- JCR replication queue empty; subscriber acking within 5 min baseline.
- No new alerts firing: SEV1 60 min, SEV2 30 min, SEV3 15 min.
- Editorial + content-ops notified with resolution.
- JCR integrity verified via `oak-run diff` against pre-incident checkpoint.

## Postmortem trigger for Sling

- **SEV1** — always postmortem within 5 business days.
- **SEV2** — team-lead decision; required for repeat (3+ in 30 days).
- **SEV3** — optional.

Cross-reference `resources/postmortem-templates/sling.md` (3.5c-iii).

## 2 worked playbook examples for Sling

### Example 1 — "OSGi bundle catastrophic failure post-deploy"

Type: availability, SEV1. Symptom: `com.customer.mdm-integration` bundle stuck `INSTALLED`; dependent bundles offline; Publish 5xx 3.4%. Triage: customer-visible → SEV1. Containment: stop bundle via Felix; failover to prior release via GitOps. Investigation: `error.log` shows class-not-found; missing package import. Eradication: revert bundle; add package-import lint to build. Recovery: redeploy prior; verify bundle graph all `ACTIVE`. Stand-down: 5xx < 0.5% for 15 min.

### Example 2 — "Unauthorized bundle installed via Felix Web Console"

Type: security (Elevation-of-privilege), SEV1. Symptom: SIEM alert on `/system/console/bundles` POST from novel IP; unknown bundle installed. Triage: active compromise → SEV1. Containment: block Felix Web Console external access via httpd; stop unknown bundle; snapshot JCR + bundle set. Investigation: audit.log for POST source; enumerate JCR mutations by the bundle's service user. Eradication: uninstall bundle; rotate all service-user tokens; deploy Sling filter denying `/system/console` external. Recovery: verify baseline bundle set restored. Stand-down: audit clean, security engineer sign-off.

## Anti-patterns to avoid for Sling

- Don't uninstall a suspect bundle before snapshotting — bundle bytecode is evidence.
- Don't restart the JVM before dumping threads + sessions — loses concurrency evidence.
- Don't skip STRIDE for Felix Web Console incidents — every one of them is EoP by default.
- Don't clear the Sling job queue DLQ during investigation — poison message is the RCA.
- Don't skip scribe — bundle-ID + version + install-time forms the audit trail.

Generate the full playbook using `templates/playbook.md` as the master, populating placeholders with stack-appropriate content from the guide above.
