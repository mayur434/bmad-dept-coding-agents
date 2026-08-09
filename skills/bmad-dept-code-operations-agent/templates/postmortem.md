# Postmortem — {{INCIDENT_TITLE}}

> **This is a blameless postmortem.** The purpose is to learn how our
> systems and processes failed, not to assign fault to individuals. Every
> section below uses **passive voice for actions** (`the deploy was
> triggered`, not `Alice triggered the deploy`), and root cause is framed
> in terms of **systems and processes**, never people. See § Blameless
> language rules below.

| Field | Value |
|---|---|
| Postmortem ID | `PM-{{SLUG}}` |
| Severity | **{{SEVERITY}}** |
| Detection | {{DETECTION_TIME_UTC}} UTC |
| Mitigation | {{MITIGATION_TIME_UTC}} UTC |
| Resolution | {{RESOLUTION_TIME_UTC}} UTC |
| Total duration | {{TOTAL_DURATION}} |
| Time to detect (TTD) | {{TTD}} |
| Time to mitigate (TTM) | {{TTM}} |
| Time to resolve (TTR) | {{TTR}} |
| Blast radius | {{BLAST_RADIUS}} |
| Author | {{AUTHOR}} |
| Reviewers | {{REVIEWERS}} |
| Status | `{{STATUS}}` (draft / reviewed / approved / actions-in-flight / closed) |

---

## Incident summary

{{INCIDENT_SUMMARY}}

<!-- 3-5 sentences. What happened, when, who was impacted, how it was
     resolved. Written for someone who did not attend the incident. Use
     passive voice; do not name individuals. -->

**Customer impact:** {{CUSTOMER_IMPACT}}

**Business impact:** {{BUSINESS_IMPACT}}

<!-- Quantify: revenue lost, requests failed, users affected, downtime
     minutes. For PII/PCI/HIPAA impact, list records exposed. -->

---

## Timeline (UTC)

<!-- Every event, chronological, UTC timestamps, who + what.
     For SEV1: per-minute granularity, every escalation, every mitigation.
     For SEV2: per-5-min granularity at key inflection points.
     For SEV3: per-15-min or event-only. -->

| UTC | Who (role) | What |
|---|---|---|
| {{TS_1}} | {{ROLE_1}} | {{EVENT_1}} |
| {{TS_2}} | {{ROLE_2}} | {{EVENT_2}} |
| {{TS_3}} | {{ROLE_3}} | {{EVENT_3}} |
| {{TS_4}} | {{ROLE_4}} | {{EVENT_4}} |
| {{TS_5}} | {{ROLE_5}} | {{EVENT_5}} |
| {{TS_6}} | {{ROLE_6}} | Symptom detected — alert `{{ALERT_NAME}}` fired |
| {{TS_7}} | IC | Incident declared, bridge opened |
| {{TS_8}} | Ops Lead | Mitigation step 1 executed |
| {{TS_9}} | ... | ... |
| {{TS_RESOLVE}} | IC | Stand-down called; incident resolved |

---

## Root cause analysis (5-whys)

<!-- Walk the causal chain. Each "why" surfaces a level deeper. Stop
     when you reach a systemic answer (a system / process / policy),
     never an individual. -->

**Symptom:** {{SYMPTOM_ONE_LINER}}

- **Why 1:** {{WHY_1}} — because…
- **Why 2:** {{WHY_2}} — because…
- **Why 3:** {{WHY_3}} — because…
- **Why 4:** {{WHY_4}} — because…
- **Why 5 (root cause):** {{WHY_5_ROOT_CAUSE}}

---

## Contributing factors

Factors that made the incident more likely, harder to detect, harder to
mitigate, or larger in blast radius. Distinct from root cause.

- **{{CONTRIB_1_CATEGORY}}:** {{CONTRIB_1_DESCRIPTION}}
- **{{CONTRIB_2_CATEGORY}}:** {{CONTRIB_2_DESCRIPTION}}
- **{{CONTRIB_3_CATEGORY}}:** {{CONTRIB_3_DESCRIPTION}}

---

## What went well

- {{WELL_1}}
- {{WELL_2}}
- {{WELL_3}}

<!-- Genuine, not aspirational. E.g. "the runbook's quick-diagnosis
     section narrowed the cause in <5 min"; "on-call was paged within
     90s of the first symptom". -->

---

## What went wrong

- {{WRONG_1}}
- {{WRONG_2}}
- {{WRONG_3}}

<!-- Process, tooling, or system failures. Use passive voice. E.g.
     "the alert threshold was not tuned for this class of failure";
     "the runbook did not include the mitigation that ultimately
     resolved the incident". -->

---

## Action items

<!-- Each item is SMART: specific, measurable, assigned, realistic,
     time-bound. Owner is a person; team ownership defers accountability.
     Priority: P0 = do this week; P1 = do this month; P2 = do this quarter. -->

| ID | Action | Owner | Due | Priority | Category |
|---|---|---|---|---|---|
| `AI-1` | {{AI_1_ACTION}} | @{{AI_1_OWNER}} | {{AI_1_DUE}} | **{{AI_1_PRIORITY}}** | {{AI_1_CATEGORY}} |
| `AI-2` | {{AI_2_ACTION}} | @{{AI_2_OWNER}} | {{AI_2_DUE}} | {{AI_2_PRIORITY}} | {{AI_2_CATEGORY}} |
| `AI-3` | {{AI_3_ACTION}} | @{{AI_3_OWNER}} | {{AI_3_DUE}} | {{AI_3_PRIORITY}} | {{AI_3_CATEGORY}} |
| `AI-4` | {{AI_4_ACTION}} | @{{AI_4_OWNER}} | {{AI_4_DUE}} | {{AI_4_PRIORITY}} | {{AI_4_CATEGORY}} |
| `AI-5` | {{AI_5_ACTION}} | @{{AI_5_OWNER}} | {{AI_5_DUE}} | {{AI_5_PRIORITY}} | {{AI_5_CATEGORY}} |

**Categories:** `alert` (new / tuned alert), `runbook` (new / updated runbook),
`code` (fix / hardening), `test` (regression coverage), `docs` (SLO / architecture),
`process` (on-call / comms).

---

## Lessons learned

{{LESSONS_LEARNED}}

<!-- 3-5 paragraphs. What did we learn about our systems, our
     processes, or ourselves? What patterns should other teams watch
     for? What assumptions were invalidated? -->

---

## Blameless language rules (enforced by this template)

- **Use passive voice for actions** — `the migration was applied`, not
  `Bob applied the migration`.
- **Talk about systems, not people** — "the deploy pipeline lacked a
  safety check", not "the engineer forgot the safety check".
- **Assume good intent** — every action taken during the incident was
  the best call the actor could make with the information they had.
- **Judge decisions in context** — not with hindsight bias.

---

## Sign-off

- [ ] {{AUTHOR}} — Postmortem author
- [ ] {{IC}} — Incident Commander
- [ ] {{TECH_LEAD}} — Tech lead
- [ ] {{SRE_LEAD}} — SRE lead
- [ ] {{ENGINEERING_MANAGER}} — Engineering manager

**Action items follow-up:** {{ACTIONS_TRACKING_LINK}}

---

_Generated by BMAD DCA Operations agent — {{GENERATED_AT}}_
