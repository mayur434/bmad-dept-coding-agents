# Rollback Plan — v{{VERSION}}

| Field | Value |
|---|---|
| Release version | {{VERSION}} |
| Stack | {{STACK}} |
| Target env | {{TARGET_ENV}} |
| Rollout strategy | {{ROLLOUT}} |
| Deploy plan | [`DEPLOY_PLAN.md`](./DEPLOY_PLAN.md) |
| Estimated rollback duration | {{ROLLBACK_DURATION}} |
| Rollback owner | {{ROLLBACK_OWNER}} |

---

## Rollback triggers

<!-- Metric-based, unambiguous. On-call reads this list first when a
     signal spikes. Keep to 5-8 triggers max. -->

| # | Trigger | Threshold | Observation window | Alert / dashboard |
|---|---|---|---|---|
| 1 | {{TRIGGER_1_NAME}} | {{TRIGGER_1_THRESHOLD}} | {{TRIGGER_1_WINDOW}} | {{TRIGGER_1_ALERT}} |
| 2 | {{TRIGGER_2_NAME}} | {{TRIGGER_2_THRESHOLD}} | {{TRIGGER_2_WINDOW}} | {{TRIGGER_2_ALERT}} |
| 3 | {{TRIGGER_3_NAME}} | {{TRIGGER_3_THRESHOLD}} | {{TRIGGER_3_WINDOW}} | {{TRIGGER_3_ALERT}} |
| 4 | {{TRIGGER_4_NAME}} | {{TRIGGER_4_THRESHOLD}} | {{TRIGGER_4_WINDOW}} | {{TRIGGER_4_ALERT}} |
| 5 | Manual call | Any reason | — | Release manager / on-call |

---

## Rollback decision

**Who calls it:** {{ROLLBACK_DECISION_OWNER}} (primary), {{ROLLBACK_DECISION_BACKUP}} (backup).

**Escalation:** if any trigger fires and the primary decision owner is
unreachable within {{ESCALATION_TIMEOUT}}, the backup makes the call.

**Threshold to invoke:** any single **CRITICAL** trigger, OR two
**HIGH** triggers within a 15-minute window, OR a manual call for any
reason (loss of confidence, unexplained anomaly, business ask).

**Decision comms:** post `ROLLBACK IN PROGRESS — v{{VERSION}}` to
{{COMMS_CHANNEL}} the moment the call is made, before executing.

---

## Rollback steps

<!-- Numbered. Each step: what, who, expected duration, verification.
     Keep executable steps as literal commands where possible. -->

### 1. Announce rollback

- **Who:** {{ROLLBACK_DECISION_OWNER}}
- **What:** post `ROLLBACK IN PROGRESS — v{{VERSION}}` to {{COMMS_CHANNEL}} + page {{ON_CALL_ROTATION}}.
- **Duration:** < 1min

### 2. Revert code

- **Who:** {{DEVOPS_LEAD}}
- **What:** {{REVERT_CODE_COMMAND}}
  <!-- Per-stack: `git revert && git push` + trigger pipeline (Spring/Sling),
       Cloud Manager rollback to previous release (AEM), drop-in version
       pin revert (Commerce SaaS / EDS), aio app deploy previous
       package (App Builder), git revert + edge deploy (EDS) -->
- **Verification:** deploy pipeline shows previous version live.
- **Duration:** {{REVERT_CODE_DURATION}}

### 3. Revert DB migration (if applicable)

- **Who:** {{DBA_OR_TECH_LEAD}}
- **What:** {{REVERT_MIGRATION_COMMAND}}
  <!-- Flyway/Liquibase down-migration; Magento `setup:upgrade` to
       previous package.xml; JCR content-package uninstall. If the
       migration is non-reversible (dropped column, encrypted at rest),
       call it out explicitly and route to forward-fix instead. -->
- **Verification:** schema snapshot matches previous release.
- **Duration:** {{REVERT_MIGRATION_DURATION}}
- **Caveat:** {{IRREVERSIBLE_MIGRATION_NOTE}}

### 4. Revert config / feature flags

- **Who:** {{DEVOPS_LEAD}} or {{PRODUCT_LEAD}}
- **What:** revert config changes surfaced in `ENV_DIFF.md`; flip feature flags to previous state.
- **Verification:** config diff shows target env matches previous release baseline.
- **Duration:** < 5min

### 5. Verify rollback

- **Who:** {{QA_LEAD}}
- **What:** run smoke test suite {{SMOKE_TEST_COMMAND}}; check RED metrics for 10min.
- **Verification:** all smoke tests PASS; error-rate below trigger threshold; p99 latency normal.
- **Duration:** {{VERIFY_ROLLBACK_DURATION}}

### 6. Announce rollback complete

- **Who:** {{RELEASE_MANAGER}}
- **What:** post `ROLLBACK COMPLETE — v{{VERSION}} → v{{PREVIOUS_VERSION}} live` to {{COMMS_CHANNEL}}.
- **Duration:** < 1min

### 7. Schedule RCA

- **Who:** {{RELEASE_MANAGER}}
- **What:** book RCA meeting within 48h; assign scribe; open incident ticket ({{INCIDENT_TICKET_TEMPLATE}}).
- **Duration:** < 5min

---

## Stakeholder comms during rollback

**Internal (all-hands / #eng-broadcast):** at start ("rollback in
progress, ETA {{ETA}}"), at midpoint if long ("still rolling back, no
customer impact"), and at completion ("rollback complete, systems
normal").

**Customer-facing (status page / support / marketing):** only when
customer impact is confirmed. Use {{STATUS_PAGE_TEMPLATE}}. Do NOT
speculate on cause during rollback — save that for the RCA.

**Executive (leadership):** at completion, with a one-line summary and
RCA date.

---

## Post-rollback

- **RCA schedule:** {{RCA_DATE}} — {{RCA_CADENCE_LINK}}.
- **Data-integrity verification:** {{DATA_INTEGRITY_CHECK}} — confirm no
  data loss / corruption / duplicate side effects from the failed release.
- **Feature-flag state:** confirm all flags in intended pre-release state.
- **Downstream systems:** notify any consumer that depended on v{{VERSION}}
  behavior (webhooks, API consumers, event subscribers).
- **Forward-fix plan:** decision — hotfix + reship, or defer to next
  release cycle. Track in {{FORWARD_FIX_TICKET}}.

---

## Lessons learned template

<!-- Filled during RCA. Blameless, focused on process + tooling gaps. -->

- **What happened** (timeline): {{TIMELINE_SUMMARY}}
- **Detection** (time-to-detect): {{TIME_TO_DETECT}}
- **Response** (time-to-decision, time-to-rollback): {{TIME_TO_ROLLBACK}}
- **Contributing factors** (technical, process, communication): {{CONTRIBUTING_FACTORS}}
- **What went well:** {{WHAT_WENT_WELL}}
- **What we'll change** (action items with owner + due date): {{ACTION_ITEMS}}

---

_Generated by BMAD DCA Release agent — {{GENERATED_AT}}_
