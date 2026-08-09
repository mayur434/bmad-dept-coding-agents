# Postmortem authoring guide — Adobe App Builder

## Purpose framing

An App Builder postmortem is a **blameless retrospective run after the
I/O Runtime / Mesh / State SDK incident is resolved** — it closes the
loop from `playbook-templates/app-builder.md` back into
`runbook-templates/app-builder.md` and `slo-templates/app-builder.md`.
Every SEV1 gets one within 5 business days; SEV2 by decision (mandatory
on repeat); SEV3 optional. Focus: what broke in the serverless-action /
event / state boundary, why the namespace-quota or event-delivery
signals didn't catch it, and what we're changing.

## Common failure modes for App Builder

Recurring root-cause patterns, each with typical detection window:

- **Runtime action storm from mesh loop** — API Mesh resolver invokes action that re-invokes mesh; recursive activation. Detection: 3-10 min via activation-rate alert (quota hit fast).
- **I/O Event delivery lag from downstream slow-consumer** — consumer webhook slow; delivery queue backs up. Detection: 15-60 min via event-lag SLI.
- **State SDK write conflict** — concurrent writes on same key; last-write-wins overwrote valid state. Detection: hours to days (silent data drift).
- **Namespace-quota exhaustion under launch load** — activations/day cap hit mid-launch; new activations throttled. Detection: 5-15 min via 429 storm.
- **IMS token cache miss storm** — token TTL expired for all actions at once; auth latency spike. Detection: 5-10 min via IMS RT.
- **Action cold-start cascade** — traffic spike, all actions cold-start together, downstream timeouts. Detection: 5-15 min via p95 latency spike.
- **API Mesh resolver N+1** — federated query fans out per-item, downstream service overwhelmed. Detection: 5-30 min via mesh-p95 alert.
- **Adobe I/O SDK version drift** — one action on old SDK with a known bug. Detection: at repro attempt.
- **Secrets-manager rotation not propagated** — action still uses old secret; downstream 401. Detection: immediate at rotation.

## Timeline capture patterns for App Builder

- **`aio app logs`** — action stdout/stderr with activation ID + timestamp; primary evidence source.
- **I/O Runtime activation history** — `aio runtime activation list` with per-activation duration + status + trigger.
- **State SDK audit** — if audit-mode enabled, per-key write log with actor + timestamp.
- **I/O Events delivery log** — event-provider console; per-event delivery attempt + retry timeline.
- **CloudWatch logs (if configured for Runtime)** — cross-reference activation IDs.
- **API Mesh query log** — per-query execution trace with resolver-level timing.
- **Adobe Developer Console activity** — deploy history, credential rotation history.

Format: UTC timestamps, actor (person / action / event provider / Adobe), action, evidence link (activation ID, event ID, State SDK key).

## Root-cause analysis methods for App Builder

- **5-whys** — default for single-action / config incidents.
- **Fishbone (Ishikawa)** — for incidents spanning actions + mesh + events + downstream consumers.
- **Fault-tree** — for security incidents (IMS token compromise, unauthorized action deploy).
- **Chaos replay** — for cascade activation-storm incidents; reproduce with synthetic load.

App Builder leans **5-whys** for most incidents (serverless is simple to reason about per-action), but **fault-tree** when the mesh loop or event fan-out crosses multiple actions.

## Contributing-factor taxonomy for App Builder

- **Technical debt** — known-open backlog (e.g. `AB-334: mesh recursion guard overdue`).
- **Process gap** — missing runbook, missing namespace-quota-alerting, missing pre-launch load test.
- **Human error** — engineer deployed an action without idempotency check; framed blamelessly (deploy tooling didn't require it).
- **External dependency** — Adobe I/O outage, downstream commerce/AEM service outage, IMS outage.
- **Config drift** — env divergence in action `env.yaml`; cross-reference `env-diff-templates/app-builder.md`.

## What-went-well template for App Builder

- Namespace-quota alert fired at 70% headroom; on-call had 4 min lead time before throttle kicked in.
- I/O Events auto-retry recovered 87% of delayed deliveries without manual intervention.
- State SDK conflict counter surfaced the race pattern within 15 min.
- Action rollback via `aio app deploy --previous` completed in < 90s.
- API Mesh resolver-level tracing pinpointed the N+1 in one query.
- Cold-start reserved-concurrency pool absorbed the traffic spike.

## Action-item taxonomy for App Builder

- **Prevention** — root-cause fix in action code (idempotency, mesh-recursion guard), config (namespace-quota headroom, reserved concurrency), or infra (State SDK versioning).
- **Detection** — new alert on activation-rate anomaly, new dashboard tile for event-delivery lag, new SLI for action p95.
- **Response** — runbook update, playbook update, Adobe Support paging matrix.
- **Communication** — comms template update, downstream-consumer notification for event lag.

Per action item: owner + due-date + priority (P0 within week; P1 within month; P2 within quarter) + tracking-ticket-id.

## Blameless-language enforcement for App Builder

- REJECT "the developer wrote a recursive mesh call" → REPLACE "the API Mesh SDK didn't guard against action-to-mesh recursion; adding invocation-depth limit".
- REJECT "the SRE forgot to raise the namespace quota" → REPLACE "the launch-readiness checklist didn't include a namespace-quota-review step; adding it".
- REJECT "someone deployed the wrong version" → REPLACE "the deploy tooling didn't diff env vars between preview and prod; adding config-diff gate".

## Stakeholder review process for App Builder

- **Author:** incident commander from the playbook run.
- **Reviewers:** SRE lead + App Builder tech lead + downstream-service liaison (if events involved).
- **Approvers:** engineering manager (SEV1: + director; SEV1 with PII in State SDK: + legal + DPO).
- **Publication:** internal wiki + `#app-builder-oncall`; downstream-consumer notice for event-lag SEV1.
- **Adobe cross-file:** attach summary to Adobe Support case for Runtime / Events platform-contributed incidents.

## 2 worked postmortem examples for App Builder

### Example 1 — Namespace quota exhaustion at product launch (SEV1, 27 min)

Severity SEV1. Duration 27 min. Blast radius: ~18k action invocations throttled (429); 3 downstream customer journeys degraded (order-confirmation, coupon-apply, product-recommend). Root cause (5-whys): activation-rate hit namespace daily cap → traffic 6× baseline (external — launch) → namespace daily-cap set to launch-year baseline × 2 → launch-readiness checklist didn't include quota-review step → capacity planning defaulted to autoscaling assumption, but Runtime quota is not autoscaled. Action items: (P0) raise namespace daily-cap 5× (owner @platform-lead, due +3d); (P0) launch-readiness quota checklist step (owner @sre-lead, due +1w); (P1) 70%-headroom alert on activations/day (owner @sre-lead, due +2w). Well: alert fired at 70%; 4-min lead time saved deeper impact.

### Example 2 — API Mesh recursion storm (SEV1, 12 min)

Severity SEV1. Duration 12 min. Blast radius: 100% mesh queries returned 5xx for 12 min; downstream storefront fell back to cached data. Root cause (5-whys): mesh resolver invoked action `enrichProduct` → action called back into mesh for product-detail → mesh re-fanned to `enrichProduct` → SDK had no recursion-depth guard → deploy tooling didn't test resolver-invocation patterns. Action items: (P0) resolver invocation-depth limit in SDK (owner @mesh-lead, due +1w); (P0) mesh recursion detection alert (owner @sre-lead, due +1w); (P1) mesh-resolver integration test in CI (owner @dev-lead, due +2w). Well: rollback via `aio app deploy --previous` in 90s; storefront cache absorbed the outage.

## Anti-patterns to avoid for App Builder

- Don't skip UTC timestamps.
- Don't skip action-item owners.
- Don't blame individuals — blame the tooling / process.
- Don't skip activation IDs in the timeline — evidence must be reproducible in Adobe Support.
- Don't ignore State SDK audit for data-drift postmortems.
- Don't publish State-SDK PII incidents externally without legal + DPO review.
- Don't leave namespace-quota headroom off the contributing factors for launch incidents.
- Don't skip mesh-recursion-depth analysis for activation-storm incidents.

---

Generate the full postmortem using `templates/postmortem.md` as the master, populating placeholders with stack-appropriate content from the guide above. Cross-reference `playbook-templates/app-builder.md` for the response the postmortem retrospects on, and `runbook-templates/app-builder.md` for symptom-specific technical detail.
