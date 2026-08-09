# Incident-response playbook authoring guide — Edge Delivery Services

## Purpose framing

An EDS playbook covers **incident classes** on the Helix/Franklin edge —
edge outage, sheet-config corruption, block-load cascade, Sidekick
plugin compromise, origin DDoS. Symptom-scoped response belongs in
`resources/runbook-templates/eds.md`. EDS is git-backed with edge
caching, so the Incident Commander's decisions are unusually tied to
version-control operations (revert vs republish). Apply STRIDE for
Sidekick plugin or edge-config compromises.

## Incident-type catalog for EDS

- **Edge outage** — Helix edge region degraded; global or regional 5xx.
- **Sheet-config corruption** — `metadata.xlsx`/`config.xlsx` breaks navigation, redirects, or content model.
- **Block-load cascade failure** — a shared block's runtime error takes multiple pages down.
- **Sidekick plugin compromise** — malicious plugin published or existing plugin's origin compromised.
- **DDoS on origin** — Google Docs / SharePoint content origin hammered via Helix bypass.
- **Publish latency spike** — Helix admin publish queue backing up.
- **RUM data-pipeline stall** — no RUM ingestion; blind to customer-visible regressions.

## STRIDE structure for security incidents

- **Spoofing** — Sidekick plugin auth-token compromise → revoke via Helix admin; audit plugin activity last 72h.
- **Tampering** — unauthorized commit to content-source repo → `git revert` + branch-protection audit.
- **Repudiation** — verify Helix admin audit-log + git commit history intact; block force-push in branch protection.
- **Information disclosure** — draft/unpublished content leaked via `.aem.page` preview URL guessed → immediate preview auth enforcement.
- **Denial of service** — edge/origin DDoS → activate Helix admin rate-limit + Fastly WAF; degrade to maintenance page.
- **Elevation of privilege** — Sidekick plugin loaded with excessive scopes → deny plugin via Helix admin; audit `sidekick-config.json`.

## Roles + responsibilities per EDS

- **IC** — web-eng lead or content-ops lead.
- **Comms Lead** — pairs with content-ops (editors are direct stakeholders).
- **Ops Lead** — web-eng (block/JS incidents), content-ops (sheet/config incidents), platform-SRE (edge/origin).
- **Scribe** — captures commit-SHAs, sheet-versions, edge cache-purge-IDs, Sidekick plugin-IDs, timestamps UTC.
- **SMEs** — Adobe Helix TAM, Fastly TAM, SharePoint/GDrive admin.

## Initial-triage matrix for EDS

- **SEV1** — global edge outage, homepage/nav broken via sheet corruption, Sidekick plugin exfiltrating data, content-source repo compromise.
- **SEV2** — single-region edge degraded, single block failing on multiple pages, publish latency > 15 min, Sidekick plugin misconfig.
- **SEV3** — single-page block regression, single sheet slow to publish, RUM ingestion delayed.

Decision flow: `alert fired → is edge serving? → is nav/homepage healthy? → is content source (sheets/repo) intact? → SEV assignment`.

## Containment steps for EDS

- Point origin to maintenance page via Helix admin (`/tools/sidekick/maintenance`). <!-- verify path -->
- Revert to last-known-good commit (`git revert <sha> && git push`); republish via Sidekick.
- Disable Sidekick auto-publish for the site (Helix admin → project → auto-publish off).
- Purge edge cache for affected paths (`aem-cli hlx cache invalidate`). <!-- verify -->
- Freeze `main` branch via GitHub branch protection (block pushes/merges).
- Deny Sidekick plugin via Helix admin plugin blocklist.
- Enable Fastly WAF rate-limit if origin is under DDoS.
- Rotate content-source repo access tokens (GitHub deploy keys / SharePoint app credentials).

## Investigation steps per EDS

- **Log locations:** Helix admin logs, Fastly access log, RUM error stream, browser console errors sampled via RUM.
- **Git history:** `git log --since='24 hours ago' --all --oneline`.
- **Sheet-config:** compare deployed sheet against last-known-good via Helix admin version history.
- **Spoofing:** Sidekick plugin activity log; enumerate publish/preview actions by the compromised token.
- **Tampering:** `git log -p` on content-source repo; SharePoint/GDrive version-history.
- **Info-disclosure:** enumerate `.aem.page` preview URLs accessed in last 24h via Fastly log.
- **DoS:** origin RPS + edge cache-miss ratio; source-ASN top-N.
- **EoP:** `sidekick-config.json` diff; enumerate plugins loaded per Fastly logs.

## Eradication + recovery per EDS

- `git revert` offending commit; re-verify via Sidekick preview.
- Restore sheet-config from Helix admin version history.
- Cache-purge Fastly + Helix edge; verify RUM shows healthy first-paint.
- Rotate content-source repo tokens; force re-auth on Sidekick users.
- Re-enable auto-publish once integrity verified.
- Add pre-commit lint for `metadata.xlsx`/`config.xlsx` schema (schema-first workflow).

## Communications plan for EDS

- **Internal:** `#eds-oncall`, `#content-ops`, `#web-eng`.
- **External:** consumer status page (marketing site outages are customer-visible).
- **Regulatory:** rare — usually consumer marketing content, but PII leak in preview would trigger jurisdictional notifications.
- **Vendor:** Adobe Helix TAM P1 case with project-ID + commit-SHA + timestamp window.

Sample lines: `[INCIDENT — SEV1] Homepage 5xx globally since 12:04 UTC; sheet-config regression. IC @grace. Bridge <link>.`

## Stand-down criteria for EDS

- Edge 5xx < 0.1% sustained 15 min (from `slo-templates/eds.md`).
- RUM Core Web Vitals within 10% of baseline sustained 30 min.
- Helix publish queue drained.
- No new alerts firing: SEV1 60 min, SEV2 30 min, SEV3 15 min.
- Content-ops verified nav + homepage + top-10 pages render correctly.

## Postmortem trigger for EDS

- **SEV1** — always postmortem within 5 business days.
- **SEV2** — team-lead decision; required for repeat (3+ in 30 days).
- **SEV3** — optional.

Cross-reference `resources/postmortem-templates/eds.md` (3.5c-iii).

## 2 worked playbook examples for EDS

### Example 1 — "Homepage broken by metadata.xlsx corruption"

Type: availability, SEV1. Symptom: homepage nav rendering blank globally since 12:04 UTC; RUM shows JS TypeError in nav block. Triage: customer-visible + global → SEV1. Containment: revert `metadata.xlsx` via Helix admin version history; republish via Sidekick; purge edge. Investigation: sheet-diff shows a removed column consumed by nav block. Eradication: restore column; add pre-commit sheet-schema lint. Recovery: verify homepage + top-10 pages render; RUM CWV healthy. Stand-down: RUM error rate baseline for 30 min.

### Example 2 — "Sidekick plugin exfiltrating draft content"

Type: security (Info-disclosure + EoP), SEV1. Symptom: security-eng flagged Sidekick plugin `analytics-helper@1.2.0` making outbound POST to unknown domain with draft-content payloads. Triage: cross-content leak potential → SEV1. Containment: deny plugin via Helix admin blocklist; freeze `main` branch; rotate content-source tokens; alert content-ops to stop using Sidekick. Investigation: enumerate draft content accessed by plugin last 72h; identify affected clients. Eradication: publish safe replacement plugin; add plugin allowlist policy. Recovery: content-ops re-enable Sidekick with allowlist. Stand-down: audit clean, security-eng sign-off.

## Anti-patterns to avoid for EDS

- Don't force-push to `main` during an incident — breaks the audit trail + prevents `git revert` traceability.
- Don't purge edge cache before republishing the fix — you serve the broken content until republish completes.
- Don't skip STRIDE for Sidekick plugin incidents — they are always EoP-adjacent.
- Don't disable RUM to hide the regression — RUM is the stand-down signal.
- Don't skip scribe — commit-SHAs + sheet-versions form the audit trail.

Generate the full playbook using `templates/playbook.md` as the master, populating placeholders with stack-appropriate content from the guide above.
