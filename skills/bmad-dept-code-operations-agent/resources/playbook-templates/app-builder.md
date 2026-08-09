# Incident-response playbook authoring guide — Adobe App Builder

## Purpose framing

An App Builder playbook covers **incident classes** on the Adobe I/O
Runtime + I/O Events + State/Files SDK stack — runtime action storm,
I/O Event pipeline stall, State-SDK corruption, namespace-quota
exhaustion, secret compromise. Symptom-scoped response belongs in
`resources/runbook-templates/app-builder.md`. The IC must draw a
clean seam between **merchant-controlled** (action code, event
registrations, namespace) vs **Adobe-controlled** (Runtime platform,
Journaling backend). Apply STRIDE for security incidents; App Builder
namespaces are shared-multi-tenant, so info-disclosure and EoP have
platform-scoped implications.

## Incident-type catalog for App Builder

- **Runtime action storm** — recursive/loop invocations exhausting namespace quota + activation queue.
- **I/O Event pipeline stall** — Journaling lag > 5 min; downstream integrations blind.
- **State SDK corruption** — cached state drift; concurrent-write race.
- **Namespace-quota exhaustion** — activations/day, memory-seconds, or concurrent-invocations exceeded.
- **Secret compromise** — action `params.__ow_secret` leaked in activation log or Git.
- **Web-action DoS** — unauthenticated web-action hammered by external traffic.
- **Deploy failure** — `aio app deploy` partial state; some actions on v2, some on v1.

## STRIDE structure for security incidents

- **Spoofing** — IMS token compromise for the App Builder project → revoke via Adobe Developer Console; audit action-invocation log for the token's window.
- **Tampering** — unauthorized action code deploy → revert via GitOps + `aio app deploy`; audit `aio app` command history.
- **Repudiation** — verify activation logs shipped to SIEM; enable Journaling audit stream retention if not already.
- **Information disclosure** — secret leaked in activation log via `console.log(params)` → immediate secret rotation; scrub log store.
- **Denial of service** — web-action DoS → attach `require-adobe-auth` annotation; enable CDN in front; rate-limit at Runtime.
- **Elevation of privilege** — unauthorized event-registration granting cross-tenant read → revoke via Adobe Developer Console; audit `io_management_client_id` grants.

## Roles + responsibilities per App Builder

- **IC** — App Builder tech lead or integration-engineering lead.
- **Comms Lead** — pairs with downstream-integration consumers (internal or partner apps).
- **Ops Lead** — action author (per-action incidents), integration eng (event/pipeline), platform-eng (namespace/quota).
- **Scribe** — captures activation-IDs, event-registration-IDs, namespace-IDs, `aio` command outputs, timestamps UTC.
- **SMEs** — Adobe Customer Care liaison, security engineer, downstream-integration owner.

## Initial-triage matrix for App Builder

- **SEV1** — namespace-wide activation failures blocking production integration, secret compromise with active exploit potential, cross-tenant data leak.
- **SEV2** — Journaling lag > 15 min, State-SDK corruption on hot key, deploy partial-state > 30 min, web-action DDoS thread-pool saturation.
- **SEV3** — single action degraded on non-critical topic, single event-topic backlog.

Decision flow: `alert fired → is production integration blocked? → is a secret or token in play? → is namespace-quota within limits? → SEV assignment`.

## Containment steps for App Builder

- Disable web-action via annotation strip (`aio rt action update <name> --web false`).
- Pause I/O Event registration (`aio event registration disable <id>`). <!-- verify subcommand -->
- Rotate compromised IMS token / Adobe Developer Console credential.
- Halt cascading action invocations by adding `require-adobe-auth` + rate-limit.
- Snapshot State SDK contents via `aio state list` + backup to Files SDK. <!-- verify -->
- Isolate offending action to sub-namespace (deploy to test-namespace only).
- Freeze `aio app deploy` for the project (revoke CI's Adobe Developer Console client).

## Investigation steps per App Builder

- **Log locations:** `aio app logs`, `aio rt activation list`, `aio rt activation logs <id>`; Journaling API; State SDK read.
- **Forensic:** export last 10k activations to file via `aio rt activation list --json > forensics.json`.
- **Spoofing:** enumerate token activity via Adobe Developer Console → API audit.
- **Tampering:** diff deployed action manifest against Git; check `aio app` command history in CI.
- **Info-disclosure:** grep activation logs for `password`, `token`, `secret`, `client_secret`, base64 sequences > 40 chars.
- **DoS:** activation-count-per-minute histogram; namespace quota usage panel.
- **EoP:** enumerate event registrations; diff against Git-tracked baseline.

## Eradication + recovery per App Builder

- Revert action code via `aio app deploy` from prior tagged commit.
- Rotate all secrets touched during incident window (`aio app config set --secret`).
- Restore State SDK from Files SDK backup snapshot.
- Purge activation queue for storm-affected actions (namespace quota recovery time depends on Runtime SLA).
- Re-enable event registrations once eradication verified.
- Add pre-deploy lint for `console.log(params)` + secret-scanner CI step.

## Communications plan for App Builder

- **Internal:** `#app-builder-oncall`, `#integrations-oncall`.
- **External:** downstream integration partners (email/status).
- **Regulatory:** cross-tenant data leaks trigger Adobe legal review.
- **Vendor:** Adobe Customer Care P1 case with namespace-ID + activation-ID + timestamp window.

Sample lines: `[INCIDENT — SEV1] Namespace prod-integrations activation-storm; quota exhausted since 05:14 UTC. IC @frank. Bridge <link>.`

## Stand-down criteria for App Builder

- Activation success rate ≥ 99% sustained 30 min (from `slo-templates/app-builder.md`).
- Journaling lag < 1 min sustained 15 min.
- Namespace quota usage < 60% headroom.
- No new alerts firing: SEV1 60 min, SEV2 30 min, SEV3 15 min.
- Downstream integrations verified consuming events normally.

## Postmortem trigger for App Builder

- **SEV1** — always postmortem within 5 business days. Cross-tenant leaks: joint postmortem with Adobe.
- **SEV2** — team-lead decision; required for repeat (3+ in 30 days).
- **SEV3** — optional.

Cross-reference `resources/postmortem-templates/app-builder.md` (3.5c-iii).

## 2 worked playbook examples for App Builder

### Example 1 — "Runtime action storm exhausting namespace quota"

Type: availability, SEV1. Symptom: `sync-orders` action activation-count jumped from 200/min to 12k/min at 05:14 UTC; namespace daily quota 90% consumed. Triage: production-integration-blocking → SEV1. Containment: disable web-action; add rate-limit annotation; identify recursive event → action → event loop. Investigation: activation logs show event-registration re-firing on action's own output; misconfigured event provider. Eradication: fix event provider filter; redeploy; validate loop broken. Recovery: gradual re-enable + monitor. Stand-down: activation-rate baseline + quota headroom > 60%.

### Example 2 — "Secret leaked in activation log via console.log(params)"

Type: security (Info-disclosure), SEV1. Symptom: SIEM alert on plaintext `client_secret` value in activation log for `token-refresh` action; last 4h of logs affected. Triage: active-compromise potential → SEV1. Containment: rotate `client_secret` via Adobe Developer Console; scrub activation logs from log store; disable action. Investigation: enumerate all activations logging params; audit downstream systems that received the leaked secret. Eradication: patch action to redact secrets before logging; add pre-deploy lint. Recovery: redeploy action; monitor secret-usage for anomalies. Stand-down: audit clean, security engineer sign-off.

## Anti-patterns to avoid for App Builder

- Don't purge activation queue before dumping activation-IDs — you lose the RCA trail.
- Don't rotate a compromised secret without scrubbing the log store — the leak remains exploitable.
- Don't skip STRIDE for cross-tenant incidents — info-disclosure vs EoP triggers different Adobe escalation paths.
- Don't `aio app deploy` a fix without first freezing CI — a bad concurrent deploy resurrects the storm.
- Don't skip scribe — activation-IDs + namespace-IDs are required for Adobe Customer Care RCAs.

Generate the full playbook using `templates/playbook.md` as the master, populating placeholders with stack-appropriate content from the guide above.
