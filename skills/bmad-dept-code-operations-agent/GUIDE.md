# BMAD DEPT Code Agent — Operations Module

Operations & SRE Specialist (📊) for enterprise Adobe and custom-middleware
projects. Turns a running service into a supportable one: a runbook
someone can follow at 3 AM, a dashboard that surfaces the golden signals,
alert rules that fire before the customer notices, SLO/SLI definitions
that make the reliability promise measurable, an on-call rotation that
answers, an incident-response playbook that keeps the war-room on track,
and a blameless postmortem that captures what was learned — plus the
standardized DCA workbook so downstream chains (Audit, Sonar-Scan,
Release) can baseline the ops posture.

---

## What it is

The **9th agent** in the BMAD DEPT Code Agent suite (after audit,
generation, impact-analysis, sonar-scan, test-coverage, requirements,
architecture, release). Where Release formalizes the **how to ship**,
Operations formalizes the **how to run** — the dashboards that show
health, the alerts that page the on-call, the runbook that resolves
the page, and the postmortem that closes the loop.

Three artifact-scope modes, all selected by `--artifacts` (and by whether
`--incident` / `--incident-in` are passed):

- **Full ops kit (`--artifacts all`, default).** Every artifact —
  runbook + dashboard + alerts + SLO + on-call rotation + playbook +
  postmortem.
- **Individual artifact.** Narrow to one: `--artifacts runbook`,
  `--artifacts dashboard`, `--artifacts alerts`, `--artifacts slo`,
  `--artifacts oncall-rotation`, `--artifacts playbook`,
  `--artifacts postmortem`.
- **Incident-driven.** `--incident "<text>"` auto-expands the set to
  include `runbook + playbook` (+ `postmortem` when
  `--postmortem-severity` is set).

All modes emit the DCA workbook + Markdown twin + `OPERATIONS-INDEX.md` +
one file per requested artifact under `<project>/operations-reports/`.

---

## When to use

1. **New-service observability kickoff.** A new service is being brought
   into production — author the full ops kit against the resolved
   observability platform + service tier so on-call, dashboards, alerts,
   SLOs, and runbooks are all in place before the first customer hits it.
2. **Incident post-mortem authoring.** A SEV1/SEV2 has just been
   resolved — author a blameless postmortem template with the incident
   log as input (`--incident-in <path>`) so the team can fill in the
   timeline and RCA against a consistent structure.
3. **SLO framework rollout.** The platform team is standardizing SLOs
   across services — author `--artifacts slo` per service with the
   right `--service-tier` and let each team review + adopt the doc.
4. **On-call rotation config.** A new team is standing up on-call —
   author `--artifacts oncall-rotation` for a PagerDuty/Opsgenie-shaped
   YAML with primary + secondary + escalation layers.
5. **Quarterly runbook refresh.** Every quarter, the SRE team refreshes
   its runbook library — chain `--artifacts runbook` per known incident
   symptom to regenerate against the current stack idioms.

---

## Install

See the Docusaurus **Getting Started → Install** page for the canonical
one-time setup (BMAD install, shared foundation, per-agent `npm install`).
The Operations agent shares dependencies with Requirements, Architecture,
Release, and Test Coverage (`exceljs`, `fast-glob`, `mammoth`) — the
shared `bootstrap.sh operations` command auto-installs on first
invocation.

Direct-CLI usage without the full BMAD install:

```bash
cd /path/to/bmad-dept-coding-agents/skills/shared && npm install
cd ../bmad-dept-code-operations-agent/scripts && npm install
npx ts-node run.ts --path /path/to/project --service checkout-api --service-tier t1
```

---

## Quick start

### 1. Full ops kit for a Spring service

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --engine spring \
  --service checkout-api \
  --service-tier t1 \
  --observability datadog \
  --artifacts all
```

Output (stderr summary + written files):

```
📊  BMAD Operations Agent
   Path:      /path/to/project
   Engine:    Spring
   Service:   checkout-api (t1)
   Observ:    datadog (--observability)
   Artifacts: runbook, dashboard, alerts, slo, oncall-rotation, playbook, postmortem

📊 Report:      operations-reports/operations-main-20260809_120000-agent-report.xlsx
📄 Markdown:    operations-reports/operations-main-20260809_120000-agent-report.md
📝 CHANGE-LOG:  CHANGE-LOG.md
📊 Ops index:   operations-reports/OPERATIONS-INDEX.md
📚 Artifacts:   7 file(s)
```

### 2. Runbook for a specific incident symptom

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --engine aem \
  --artifacts runbook \
  --incident "dispatcher hit-ratio dropped below 90%"
```

Emits `RUNBOOK-dispatcher-hit-ratio-drop.md` with AEM-specific
quick-diagnosis commands, likely causes (cache-key regression, farm
filter change, purge storm), mitigation steps, and dispatcher-admin
escalation — plus the standardized workbook and `OPERATIONS-INDEX.md`.

### 3. Blameless postmortem from an existing incident log

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --artifacts postmortem \
  --postmortem-severity sev1 \
  --incident-in ./incidents/2026-08-15.md
```

Emits `POSTMORTEM-<slug>.md` with SEV1 detail level (per-minute UTC
timeline, external comms required, every section required + every
action-item owner named + due-date).

---

## CLI reference

### Operations-specific flags

| Flag | Description |
|------|-------------|
| `--observability <target>` | Observability platform. Values: `datadog`, `newrelic`, `grafana`, `prometheus`, `elastic`, `cloudwatch`, `dynatrace`. Default: auto-detect from project files (`datadog.yaml`, `newrelic.yml`, `grafana/`, `prometheus.yml`, `filebeat.yml`, `.cloudwatch/`, `dynatrace.yaml`). |
| `--incident <text>` | Natural-language incident description for runbook / playbook / postmortem authoring. |
| `--incident-in <path>` | Existing incident log / timeline to enrich into a postmortem. |
| `--service <name>` | Service anchor for dashboard / alerts / SLO artifacts. |
| `--service-tier <t1\|t2\|t3>` | Service criticality tier for SLO defaults (t1=99.9%, t2=99.5%, t3=99%). |
| `--postmortem-severity <sev>` | `sev1`, `sev2`, or `sev3`. Keys template detail + comms requirement. |
| `--artifacts <csv>` | `runbook`, `dashboard`, `alerts`, `slo`, `oncall-rotation` (alias `oncall`), `playbook`, `postmortem`, `all`. Default: `all`. |
| `--format <markdown\|both>` | Output format. Default: `markdown`. `both` currently emits markdown only (docx planned) with a warning. |

### Standard flags (shared with the other 8 DCA agents)

See the Docusaurus **Reference → CLI Flags** page for the canonical table.
In short:

- `--path <dir>` — project root (default: cwd).
- `--engine <id>` — force a stack (`aem`, `commerce-paas`, `commerce-saas`,
  `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`). Auto-detected
  when omitted.
- `--role <code>` — role adaptation (`ea`, `tl`, `de`, `qa`, `devops`,
  `security`, `pm`, `ba`, `migration`, `content`, `generic`). Persists to
  `.bmad/role.yaml`.
- `--interactive` / `--technical` — intake mode (persists to
  `.bmad/intake.yaml`).
- `--output <dir>` — override the report directory
  (default: `<project>/operations-reports`).
- `--yes-install` / `--no-install` — first-run dep-install control.
- `--create-branch` / `--source-branch <name>` — cut
  `dca/operations-<stack>-<timestamp>` before writing.
- `--preflight` / `--no-preflight` — LLM-mode advisory.
- `--include-decided` / `--decisions-path` / `--ignore-decision-expiry` /
  `--list-decisions` — decisions gate (`.bmad/decisions.yaml`).
- `--sla-path` / `--no-sla` / `--fail-on-overdue` — SLA gate
  (`.bmad/sla.yaml`).
- `--list-engines` — print the 8 registered engines and exit.

---

## Output shape

See `SKILL.md` → **Output contract** for the full schema. Summary:

- **Workbook** — `operations-<branch>-<timestamp>-agent-report.xlsx`
  with the 15-column contract, plus sheets: Run Info, Summary, Severity
  Breakdown, By Category, Recommendations, SLA Status, and (optional) Delta.
- **Markdown twin** — same rows, git-diffable.
- **`OPERATIONS-INDEX.md`** — always emitted; manifest of inputs → artifacts.
- **`RUNBOOK-<slug>.md`** — per-incident-symptom runbook.
- **`dashboard-<target>.{json,yml}`** — dashboard-as-code.
- **`alerts-<target>.yaml`** — alert rules.
- **`SLO-<service>.md`** — SLO/SLI definitions + error-budget policy.
- **`oncall-rotation.yaml`** — PagerDuty/Opsgenie-shaped rotation.
- **`PLAYBOOK-<slug>.md`** — incident-response playbook.
- **`POSTMORTEM-<slug>.md`** — blameless postmortem template.
- **`CHANGE-LOG.md`** — appended at project root with a one-line summary.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Observability auto-detect returns nothing | Project has no CI/monitoring config the agent recognizes. Pass `--observability <target>` explicitly (`datadog`, `newrelic`, `grafana`, `prometheus`, `elastic`, `cloudwatch`, `dynatrace`). Auto-detection precedence: Datadog → New Relic → Grafana → Prometheus → Elastic → CloudWatch → Dynatrace. |
| `--artifacts dashboard,alerts,slo` all fail with "service required" | Any of these three needs `--service <name>`. If you're authoring for a stack that has a single obvious service (e.g. `author-tier` for AEM, `checkout-api` for a Spring monorepo), pass it explicitly; the agent doesn't guess. |
| Runbook is generic — doesn't include stack-specific commands | Confirm `--engine` is set (or auto-detected) — without a stack, the agent falls back to stack-agnostic templates. Run `--list-engines` and pass `--engine <id>`. |
| Postmortem timeline is empty | Postmortem is a template scaffold — the timeline is filled by the incident participants during the retro. Pass `--incident-in <path>` to a plaintext log to bootstrap the timeline from real events. |
| `--format both` writes a warning and emits markdown only | Currently expected — the docx writer lands in a later phase. Use `--format markdown` or convert externally (`pandoc POSTMORTEM.md -o POSTMORTEM.docx`). |

---

## Cross-links

- **Docusaurus** — `docs/agents/operations/`,
  `docs/concepts/ops-authoring/`,
  `docs/reference/cli-flags/`,
  `docs/reference/prompts/operations/` (all upcoming under Phase 3.6).
- **Sibling agents**:
  - **Release** — bi-directional loop. The Release deploy plan cites the
    runbook + on-call rotation Ops authored; post-deploy comms triggers
    runbook activation.
  - **Audit** — audit's CRITICAL findings feed into Ops alert rules.
  - **Sonar-Scan** — a Quality Gate breach becomes an Ops alert.
  - **Impact Analysis** — impact-analyze the components behind the
    alerting SLIs.
  - **Test-Coverage** — postmortem authoring pulls coverage context
    for "did we have coverage on the failing path?"
  - **Architecture** — Ops can emit an observability-standardization
    ADR to codify the SLO framework at portfolio level.
- **Shared foundation** — `skills/shared/role/`,
  `skills/shared/interactive/`, `skills/shared/install/`,
  `skills/shared/decisions/`, `skills/shared/output/`.
