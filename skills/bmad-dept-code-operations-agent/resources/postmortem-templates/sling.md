# Postmortem authoring guide — Apache Sling / Shaft (sling-12)

## Purpose framing

A Sling postmortem is a **blameless retrospective run after the OSGi /
JCR / SAM incident is resolved** — it closes the loop from
`playbook-templates/sling.md` back into `runbook-templates/sling.md` and
`slo-templates/sling.md`. Every SEV1 gets one within 5 business days;
SEV2 by decision (mandatory on repeat); SEV3 optional. Focus: what broke
in the bundle-install ordering / JCR governance / SAM API layer, why the
Feature Model or provisioning didn't catch it, and what we're changing.

## Common failure modes for Sling

Recurring root-cause patterns, each with typical detection window:

- **OSGi bundle install order dependency break** — Feature Model reordered bundles; downstream bundle stuck INSTALLED not ACTIVE. Detection: immediate at install; symptoms surface at first request.
- **JCR node lock leak** — long-running session held lock; blocking concurrent writes. Detection: 5-30 min via write-latency spike.
- **MDM data corruption via race condition** — concurrent writes on the same MDM entity; last-write-wins overwrote a valid record. Detection: hours to days via consumer complaint.
- **SAM API abuse from misbehaving client** — client retry-storm hammering SAM endpoint. Detection: 5-15 min via 5xx / rate-limit alert.
- **JCR session leak** — pool exhausted; new requests fail. Detection: 20-90 min via session-count alert.
- **Feature Model install divergence** — env A has bundle set X, env B has X+delta; behavior differs. Detection: at repro attempt across env.
- **Sling job queue depth explosion** — worker starved on a topic; batch backlog. Detection: 10-60 min via topic-depth alert.
- **Unauthorized OSGi bundle install** — attacker exploited exposed Felix Web Console. Detection: minutes (SIEM) to days (audit).
- **JCR checkpoint failure** — snapshot corrupted; recovery risk. Detection: at next backup attempt.

## Timeline capture patterns for Sling

- **`bundle-installer.log`** — bundle install/activate/stop transitions with timestamps + install source.
- **OSGi configuration audit** — Felix ConfigAdmin change log; who changed which PID at when.
- **JCR journal** — commit log for the Oak / crx repository; per-commit UUID + timestamp + user.
- **Feature Model manifest history** — which model was resolved when; captured at boot.
- **SAM API access log** — per-request timestamp + client-ID + response code.
- **`/system/console/bundles` history** — install-time sort at `state=INSTALLED`; symptom fingerprint.
- **JMX metrics history** — session count, thread count, GC pause history.

Format: UTC timestamps, actor, action, evidence link (bundle-ID, JCR node path, Feature Model URL).

## Root-cause analysis methods for Sling

- **5-whys** — default for OSGi / bundle / config incidents.
- **Fishbone (Ishikawa)** — for MDM / SAM incidents spanning multiple client teams + platform + data ownership.
- **Fault-tree** — for Felix Web Console exposure / unauthorized-install incidents (STRIDE elevation-of-privilege).
- **Chaos replay** — for cascade JCR-session incidents; reproduce under load in a lab.

Sling leans **5-whys** — OSGi and JCR incidents usually resolve to a single systemic answer (a missing bundle-order-check, a missing session-close, a missing lock-release).

## Contributing-factor taxonomy for Sling

- **Technical debt** — known-open backlog (e.g. `SLING-891: session-close audit overdue`).
- **Process gap** — missing runbook, missing bundle-order-check in Feature Model CI, missing MDM concurrent-write test.
- **Human error** — developer used a service session without try-with-resources; framed blamelessly (code review didn't have a session-lifecycle check).
- **External dependency** — upstream MDM data source, external SAM API consumer, Adobe support platform.
- **Config drift** — env divergence in Feature Model resolution; cross-reference `env-diff-templates/sling.md`.

## What-went-well template for Sling

- Feature Model boot-time validation caught 3 unrelated regressions before they reached prod.
- SAM API rate-limiter engaged and shed load gracefully.
- JCR session-count alert fired at 80% pool utilization — 4 min ahead of exhaustion.
- Bundle install-history log had the exact install-time for forensics.
- MDM checkpoint from 15 min pre-incident restored cleanly.
- On-call paged within 90s of first SAM 5xx symptom.

## Action-item taxonomy for Sling

- **Prevention** — root-cause fix in code (session-close audit), config (Feature Model diff-check), or infra (JCR checkpoint automation).
- **Detection** — new alert on bundle-state INSTALLED-not-ACTIVE, new dashboard tile for session leak, new SLI for SAM p95.
- **Response** — runbook update, playbook update, on-call training on bundle-recovery.
- **Communication** — comms template update, downstream-consumer notification matrix for SAM outage.

Per action item: owner + due-date + priority (P0 within week; P1 within month; P2 within quarter) + tracking-ticket-id.

## Blameless-language enforcement for Sling

- REJECT "the developer forgot to close the session" → REPLACE "the JCR session API allowed unclosed sessions to leak into GC; adding try-with-resources lint rule + code-review checklist".
- REJECT "someone exposed Felix Console" → REPLACE "the deployment default exposed Felix Web Console publicly; hardening the base Feature Model to bind it to localhost only".
- REJECT "MDM lost data due to bad code" → REPLACE "the MDM write path lacked optimistic-locking; concurrent writes silently overwrote; adding version-column enforcement".

## Stakeholder review process for Sling

- **Author:** incident commander from the playbook run.
- **Reviewers:** SRE lead + Sling / OSGi tech lead + MDM data-owner (if MDM involved).
- **Approvers:** engineering manager (SEV1: + director; SEV1 with data loss: + data-governance + legal).
- **Publication:** internal wiki + `#sling-oncall`; external notice for downstream-consumer-visible SEV1.
- **Downstream cross-file:** notify SAM consumers with a summary + action-items relevant to their integration.

## 2 worked postmortem examples for Sling

### Example 1 — SAM API 5xx storm from consumer retry (SEV1, 34 min)

Severity SEV1. Duration 34 min. Blast radius: 4 downstream consumers received 5xx for 34 min; ~180k API calls failed; 2 consumers escalated. Root cause (5-whys): SAM p95 5s → OSGi bundle `com.customer.sam.enrichment` in INSTALLED (post-deploy) → Feature Model reorder placed `enrichment` before its dependency `com.customer.sam.cache` → CI build-test didn't validate bundle-activation order → the Feature Model diff review was manual, not automated. Action items: (P0) automated Feature Model bundle-order-check in CI (owner @platform-lead, due +1w); (P0) bundle-state-INSTALLED alert on Publish tier (owner @sre-lead, due +1w); (P1) SAM consumer retry-backoff library (owner @sam-lead, due +2w). Well: rate-limiter shed load; on-call paged within 90s.

### Example 2 — MDM race-condition data loss (SEV2, 3 days undetected)

Severity SEV2 (data). Duration: 3 days undetected + 4h remediation. Blast radius: ~1.2k MDM entities silently overwritten; 40 downstream consumer records inconsistent. Root cause (fishbone): concurrent writers hit MDM without optimistic locking (own — schema gap) → MDM ingest UI accepted duplicate versions without warning (own — UI gap) → checkpoint cadence was 24h not 4h (own — infra gap) → consumer detected drift only via daily reconciliation report. Action items: (P0) add version-column optimistic-lock enforcement (owner @mdm-lead, due +1w); (P0) MDM ingest UI conflict warning (owner @mdm-lead, due +1w); (P1) 4h checkpoint cadence (owner @sre-lead, due +2w); (P1) real-time drift-detector (owner @data-lead, due +1mo). Well: 15-min-old checkpoint enabled targeted restore of affected records.

## Anti-patterns to avoid for Sling

- Don't skip UTC timestamps.
- Don't skip action-item owners.
- Don't blame individuals — blame the tooling / process.
- Don't skip Feature Model manifest capture in the timeline — install-order incidents are invisible without it.
- Don't restart bundles before capturing `/system/console/bundles` state — you lose forensics.
- Don't skip JCR journal cross-reference for data incidents.
- Don't publish MDM data-loss postmortems externally without data-governance sign-off.

---

Generate the full postmortem using `templates/postmortem.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `playbook-templates/sling.md` for the response the postmortem retrospects on, and `runbook-templates/sling.md` for symptom-specific technical detail.
