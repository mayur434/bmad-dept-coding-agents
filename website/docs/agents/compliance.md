---
id: compliance
title: Compliance
sidebar_position: 11
description: Maps findings from every DCA agent to compliance frameworks (CWE, OWASP, CIS, PCI-DSS, HIPAA, GDPR, SOX, ISO 27001). Produces auditor-ready control-mapping reports, audit-trail exports, attestations, and remediation plans.
keywords:
  - compliance
  - governance
  - cwe
  - owasp
  - cis controls
  - pci
  - pci-dss
  - hipaa
  - gdpr
  - sox
  - iso27001
  - control mapping
  - audit trail
  - attestation
---

## Purpose

The **Governance & Compliance Specialist** (⚖️) is the **11th agent** in the DCA suite and closes **SDLC phase 8 (Governance / Compliance)** — the final SDLC-phase gap across the whole suite. Every other DCA agent scans, authors, or reviews code directly; Compliance does not. Its entire job is to take findings that OTHER agents already produced — cached at `<projectRoot>/.bmad/cache/` by `audit`, `sonar-scan`, `test-coverage`, `impact-analysis`, and `code-review` — and **map** them against eight compliance-framework control catalogs: CWE, OWASP Top 10, CIS Controls, PCI-DSS, HIPAA, GDPR, SOX, and ISO 27001.

From that mapping it produces five auditor-facing artifacts: a **control-mapping report** (the matrix — covered / gap / partial / N/A per control), an **audit-trail export**, an **auditor cover letter**, an **SLA-bound remediation plan**, and a sign-off **attestation**.

:::note Compliance assists, it does not certify
Every control-mapping, cover letter, and attestation it produces is an AI-assisted draft that accelerates the correlation work between scanner findings and framework controls. It is **not** a substitute for a QSA (PCI), a Privacy/Security Officer review (HIPAA), a DPO review (GDPR), or an external auditor (SOX, ISO 27001). **Human legal/compliance review is required before any of these artifacts goes to an auditor, a regulator, or a customer security questionnaire.** See the [Constraints / non-goals](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/SKILL.md#constraints--non-goals) section in the source SKILL for the full boundary.
:::

## When to use

- **Quarterly compliance review** — re-run the full sweep (`--framework all --artifacts all`) against fresh `audit`/`sonar-scan` findings to keep the control-mapping current and catch newly-introduced gaps before they age into an OVERDUE SLA.
- **Pre-audit prep** — an external auditor is scheduled; run `--artifacts control-mapping,audit-trail,cover-letter` for the in-scope framework(s) well before the audit date, so gaps have time to be remediated or formally risk-accepted.
- **New-framework adoption** — the business decides to go PCI-compliant (or add HIPAA/GDPR/SOX/ISO 27001 coverage); after confirming applicability, run `--framework pci --artifacts control-mapping` for the first-pass gap inventory, then iterate the remediation plan sprint over sprint.
- **Post-incident compliance-gap review** — after a security incident, check whether the root-cause finding also represents a compliance gap (`--framework cwe,owasp,pci` scoped to the affected service) — an incident that traces to a control gap needs that gap formally tracked, not just the code fix.
- **Executive compliance-posture reporting** — leadership wants a snapshot across frameworks; run `--framework all --artifacts cover-letter` (or the full report) as `pm`/`ea` role for a business-risk-framed summary instead of a code-level dump.

## What it produces

Every compliance run emits the standardized DCA outputs into `<project>/compliance-reports/` (override with `--output`):

| Artifact | Where | Notes |
|----------|-------|-------|
| `compliance-<branch>-<timestamp>-agent-report.xlsx` | `compliance-reports/` | Standardized 15-column Summary contract; one row per mapped control / audit-trail entry / cover-letter section / remediation item / attestation clause, keyed as `COMP-<n>`. |
| `compliance-<branch>-<timestamp>-agent-report.md` | `compliance-reports/` | Git-diffable Markdown twin. |
| `CONTROL-MAPPING-<framework>.md` | `compliance-reports/` | One per resolved framework — the findings-to-controls matrix. Every other artifact is derived from this one's rows. |
| `AUDIT-TRAIL.md` | `compliance-reports/` | Chronological export of `CHANGE-LOG.md` + findings-cache run history. |
| `COVER-LETTER.md` | `compliance-reports/` | Auditor-ready executive summary — scope, methodology, posture, disclaimer. |
| `REMEDIATION-PLAN.md` | `compliance-reports/` | Every gap, with an owner placeholder and an SLA deadline. |
| `ATTESTATION.md` | `compliance-reports/` | Sign-off/attestation document naming a signer, scope, and explicit limitations. |
| `COMPLIANCE-INDEX.md` | `compliance-reports/` | Manifest of inputs → authored artifacts. |
| One `CHANGE-LOG.md` entry | project root | e.g. `Compliance mapping: cwe,owasp; 38 finding(s) mapped, 27 control(s) covered, 8 control(s) gap; 42 report finding(s).` |
| Optional working branch | git | `dca/compliance-<framework>-<timestamp>` when `--create-branch` is passed. |

The report follows the [standardized outputs contract](../concepts/standardized-outputs): **Run Info** · **Summary** · **Severity Breakdown** · **By Category** · **Recommendations** · **SLA Status** (unless `--no-sla`) · optional **Delta** (against a prior compliance run of the same framework set). The 15-column Summary maps `id → COMP-<n>`, `severity → gap/covered/partial or inherited from the source finding`, and `category → {control-mapping, audit-trail, cover-letter, remediation, attestation}`.

## Modes

Two scope dimensions, selected independently by `--artifacts` and `--framework`:

| Mode | Trigger | What it does | Best for |
|------|---------|--------------|----------|
| **Full compliance report** (default) | `--artifacts all --framework all` (or role-default framework set when `--framework` is unspecified), or `"full compliance report"` / `"compliance audit"` in the prompt | Merges findings from every resolved source agent, dispatches every resolved framework mapper against the same merged set, and authors every resolvable artifact. | Quarterly review; pre-audit prep; executive posture reporting. |
| **Individual artifact / framework** | `--artifacts <subset>` and/or `--framework <subset>` | Authors exactly the requested artifact(s) for exactly the requested framework(s), using the same merged findings set. | Focused re-runs; a single framework's first-pass gap inventory; scripted CI paths. |

## Artifact catalog

`--artifacts` accepts a comma-separated list. `all` expands to every artifact. Missing → `all`.

| Artifact key | Written file(s) | Master template | Notes |
|---|---|---|---|
| `control-mapping` | `CONTROL-MAPPING-<framework>.md` (one per resolved framework) | [`templates/control-mapping.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/templates/control-mapping.md) | The core artifact — every other artifact is derived from this one's rows. |
| `audit-trail` | `AUDIT-TRAIL.md` | [`templates/audit-trail.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/templates/audit-trail.md) | Full history only when `--audit-trail` is also passed; otherwise a lighter current-run-only export. |
| `cover-letter` | `COVER-LETTER.md` | [`templates/cover-letter.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/templates/cover-letter.md) | Executive summary of scope, methodology, and posture, written for someone outside engineering. |
| `remediation-plan` | `REMEDIATION-PLAN.md` | [`templates/remediation-plan.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/templates/remediation-plan.md) | Every gap from the control-mapping, with owner placeholder + SLA deadline (when `--remediation-sla`). |
| `attestation` | `ATTESTATION.md` | [`templates/attestation.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/templates/attestation.md) | Requires `--attestation-signer` (see Missing required info in `SKILL.md`). |
| `all` | Every artifact above. | — | Default. |

## Framework catalog

`--framework` (alias `--engine`) accepts a comma-separated list of the 8 registered frameworks, or `all`. Missing → role default → `cwe,owasp` fallback.

| Framework key | Name | Typical applicable stacks | Master resource |
|---|---|---|---|
| `cwe` | Common Weakness Enumeration | All stacks — stack-agnostic weakness taxonomy; the foundation the other seven guides lean on. | [`resources/framework-mappings/cwe.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/cwe.md) |
| `owasp` | OWASP Top 10 | **Heavy**: Commerce PaaS/SaaS, AEM, EDS, EDS+Commerce — any HTTP-facing app layer. | [`resources/framework-mappings/owasp.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/owasp.md) |
| `cis` | CIS Controls | All stacks — general security-hygiene benchmarks span infra + code. | [`resources/framework-mappings/cis.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/cis.md) |
| `pci` | PCI-DSS | **Heavy**: Commerce PaaS, Commerce SaaS. **Light** elsewhere unless card data is demonstrably in scope. | [`resources/framework-mappings/pci.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/pci.md) |
| `hipaa` | HIPAA (Security Rule) | **Medium** only when PHI is confirmed in scope — never auto-inferred. | [`resources/framework-mappings/hipaa.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/hipaa.md) |
| `gdpr` | GDPR | **Medium-heavy**: AEM (forms/DAM), Commerce (customer data), EDS (analytics/consent) — any stack handling EU user data. | [`resources/framework-mappings/gdpr.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/gdpr.md) |
| `sox` | SOX (Section 302/404) | **Medium**: Commerce (order/revenue data), Spring (financial-services APIs) — any stack touching financial-reporting systems. | [`resources/framework-mappings/sox.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/sox.md) |
| `iso27001` | ISO/IEC 27001:2022 (Annex A) | All stacks — organizational + technical controls span the whole ISMS, not just code. | [`resources/framework-mappings/iso27001.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/iso27001.md) |

## Source-agent catalog

`--source-agent` selects which agents' findings caches to merge before mapping. Default `all`. A missing cache for any one agent is non-fatal — the run proceeds with whatever caches exist and logs an INFO note per missing source.

| Source agent | Contributes |
|---|---|
| `audit` | Code-level weaknesses and rule-pack violations — the richest source for **CWE** control-mapping. |
| `sonar-scan` | Vulnerabilities, security hotspots, Quality Gate ratings — the richest source for **OWASP** and **CIS** control-mapping. |
| `test-coverage` | Coverage gaps that are compliance-relevant — an untested payment-authorization path is both a quality gap AND a PCI control gap. |
| `impact-analysis` | Blast-radius of compliance-critical changes — informs which gaps are "urgent because widely depended-on" vs. "isolated." |
| `code-review` | Pre-merge compliance-relevant flags caught before they ever reached a full audit/scan pass. |
| `all` | Merges every source above. Default. |

## Trigger phrases

Paste any of these into the agent chat — the agent auto-detects framework, source agents, and role.

```text
compliance report
map our findings to CWE
OWASP mapping for our storefront
PCI compliance for our checkout
HIPAA check
GDPR mapping
SOX controls
ISO 27001 mapping
audit trail export
compliance attestation
remediation plan for compliance
which controls does this violate
are we PCI compliant
```

The full copy-paste catalog is in the [Compliance prompts reference](../reference/prompts/compliance).

## CLI usage (technical mode)

The canonical invocation:

```bash
npx ts-node .claude/skills/bmad-dept-code-compliance-agent/scripts/run.ts \
  --path . --framework owasp,pci --source-agent audit,sonar-scan
```

**One artifact per example** — copy-paste-friendly:

```bash
# Full compliance report, CWE + OWASP, role-driven default
npx ts-node .claude/skills/bmad-dept-code-compliance-agent/scripts/run.ts \
  --path . --framework cwe,owasp --artifacts all
```

```bash
# PCI-DSS control-mapping only
npx ts-node .claude/skills/bmad-dept-code-compliance-agent/scripts/run.ts \
  --path . --framework pci --source-agent audit,sonar-scan --artifacts control-mapping
```

```bash
# Audit trail export, last 90 days
npx ts-node .claude/skills/bmad-dept-code-compliance-agent/scripts/run.ts \
  --path . --artifacts audit-trail --audit-trail --source-max-age-hours 2160
```

```bash
# Remediation plan with SLA
npx ts-node .claude/skills/bmad-dept-code-compliance-agent/scripts/run.ts \
  --path . --artifacts remediation-plan --remediation-sla
```

```bash
# Attestation, signed
npx ts-node .claude/skills/bmad-dept-code-compliance-agent/scripts/run.ts \
  --path . --framework hipaa --artifacts attestation \
  --attestation-signer "Priya Nair, Privacy & Security Officer"
```

```bash
# Full sweep across all 8 frameworks
npx ts-node .claude/skills/bmad-dept-code-compliance-agent/scripts/run.ts \
  --path . --framework all --artifacts all
```

The Preflight advisory prints on every run — see [The Agents](../concepts/the-agents) for how STATIC / LLM / HYBRID is decided. Compliance does not re-scan the codebase, so the preflight fit here is mostly about whether the LLM can hold the merged findings set + resolved framework control catalogs + prior-run history in context at once for rich authoring (cover-letter prose, remediation narrative) — see [Auto-install](../concepts/auto-install) for the first-run dependency bootstrap.

## Flags reference

Every flag listed here is wired in `scripts/run.ts`.

### Compliance-specific

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--framework <csv\|all>` | csv/enum | role-driven, fallback `cwe,owasp` | Which compliance-framework control catalogs to map against. Values: `cwe`, `owasp`, `cis`, `pci`, `hipaa`, `gdpr`, `sox`, `iso27001`, `all`. **`--engine` is accepted as a synonym**, kept for dispatcher-flag consistency with the other DCA agents — Compliance's "engines" are per-framework, not per-tech-stack, so `--engine` here selects a framework, not a stack. |
| `--source-agent <csv\|all>` | csv | `all` | Which agents' findings-cache to pull from: `audit`, `sonar-scan`, `test-coverage`, `impact-analysis`, `code-review`, `all`. |
| `--source-max-age-hours <n>` | number | `168` | Reject cached findings older than this many hours (7 days). |
| `--audit-trail` | bool | false | Include `CHANGE-LOG.md` + findings-cache run history as part of the run. |
| `--attestation-signer <name>` | string | — | Free-text name/role for the attestation sign-off block (e.g. `"Jane Doe, CISO"`). Required when `attestation` is in the resolved artifact set. |
| `--artifacts <csv\|all>` | csv | `all` | Which artifacts to author. Values: `control-mapping`, `audit-trail`, `cover-letter`, `remediation-plan`, `attestation`, `all`. |
| `--remediation-sla` / `--no-remediation-sla` | bool | on | Attach SLA deadlines to remediation items. |
| `--format <markdown\|both>` | enum | `markdown` | Output format. `both` currently emits markdown only (docx planned) with a warning. |
| `--list-frameworks` | bool | false | Print the 8 registered frameworks and exit. Alias: `--list-engines`. |

### Standard (shared with every DCA agent)

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--path <dir>` | string | `.` | Project root — used to resolve the findings cache and as the output base. |
| `--output <dir>` | dir | `<project>/compliance-reports/` | Override the report directory. |
| `--role <code>` | enum | `.bmad/role.yaml` | Role adaptation: `ea` \| `tl` \| `de` \| `qa` \| `devops` \| `security` \| `pm` \| `ba` \| `migration` \| `content` \| `generic`. Wins for one run. |
| `--interactive` | bool | false | Force interactive intake (step-by-step questions). Persists to `.bmad/intake.yaml`. |
| `--technical` | bool | false | Force technical intake mode. |
| `--yes-install` | bool | false | First-run dependency install without confirmation. |
| `--no-install` | bool | false | Error out if deps are missing. |
| `--create-branch` | bool | false | Cut `dca/compliance-<framework>-<timestamp>` before writing outputs. |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. Cascade: `production → main → master → develop`. |
| `--preflight` | bool | false | Print the LLM / context-window advisory and exit. |
| `--no-preflight` | bool | false | Suppress the preflight advisory that otherwise prints on every run. |
| `--help` | bool | false | Show help. |

### Findings gate (Enterprise Phase 1)

Shared with every DCA agent. See [Findings Gate](../concepts/findings-gate) for the full mechanics — for Compliance, decisions apply to compliance-gap rows: **accepted** (the gap is formally risk-accepted by governance) / **deferred** (remediation scheduled, moves to the SLA sheet with a `next-review` date) / **wontfix** (the control is not applicable and that determination is documented — should always carry a `comments` rationale, since an auditor will ask why).

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--include-decided` | bool | false | Bypass the findings gate — show items already decided in `.bmad/decisions.yaml`. |
| `--decisions-path <path>` | string | `<projectRoot>/.bmad/decisions.yaml` | Override the decisions file. |
| `--ignore-decision-expiry` | bool | false | Treat expired decisions as still active for this run. |
| `--list-decisions` | bool | false | Print all decisions and exit. |

### SLA tracking (Enterprise Phase 1)

Shared with every DCA agent. See [SLA Tracking](../concepts/sla-tracking) — for Compliance, the SLA is a **remediation SLA**: how long a mapped compliance gap can stay `open` before it becomes `OVERDUE`, keyed by role + the gap's effective (framework-inherited) severity.

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--sla-path <path>` | string | `<projectRoot>/.bmad/sla.yaml` | Override the SLA file. |
| `--no-sla` | bool | false | Skip the SLA sheet and computation entirely. |
| `--fail-on-overdue` | bool | false | Exit code 6 if any surviving finding is OVERDUE per role SLA. Wire into CI to fail the release pipeline when a compliance gap has been sitting `open` past its SLA. |

## What's new (Phase 4)

Compliance is the **11th agent** in the DCA suite and closes SDLC phase 8 (Governance) — the **last of the original 8 SDLC phases**. It ships alongside **Code Review** (10th agent, phase 3 deeper) — together the two close the last remaining SDLC coverage gaps, completing full 8-phase coverage across the whole suite:

- **Requirements** (Phase 2) — authors BRD + user stories + AC upstream of any design.
- **Architecture** (Phase 2) — turns the "what" into the "how" via ADR + HLD + LLD + API + diagrams + STRIDE + data model.
- **Code Review** (Phase 4, 10th agent) — fast, diff-scoped pre-merge review.
- **Audit** + **Sonar Scan** + **Code Generation** + **Impact Analysis** + **Test Coverage** — gate quality on existing code, post-merge / scheduled.
- **Release** (Phase 3) — turns a merged change set into a shippable release.
- **Operations** (Phase 3) — post-deploy runbook + alerts wire-up.
- **Compliance** (this agent — Phase 4, 11th agent) — maps findings from every one of the above to 8 compliance frameworks; closes phase 8.

The natural fan-in to a Compliance run: **`audit + sonar-scan + test-coverage + impact-analysis + code-review → compliance`** (Compliance never runs cold — without at least one upstream cache, the report is a scaffold-only framework reference). The natural fan-out: **`compliance → release`** (a compliance sign-off gates a release).

## Example workflow

**Chat trigger — chained sweep:**

```text
audit my project
sonar scan my project
compliance report — OWASP + PCI, sourced from audit + sonar-scan
```

**Resolved CLI (final step):**

```bash
npx ts-node .claude/skills/bmad-dept-code-compliance-agent/scripts/run.ts \
  --path . --framework owasp,pci --source-agent audit,sonar-scan --artifacts all \
  --technical --no-preflight --yes-install
```

**Chained SDLC pass:**

```text
compliance → release — gate the release on zero OVERDUE compliance findings
```

**Outputs:**

```
compliance-reports/
├── compliance-main-20260809_120000-agent-report.xlsx
├── compliance-main-20260809_120000-agent-report.md
├── CONTROL-MAPPING-owasp.md        ← 18/22 controls covered
├── CONTROL-MAPPING-pci.md          ← 8/12 requirements covered, 3 gaps, 1 N/A
├── AUDIT-TRAIL.md                  ← run history + CHANGE-LOG export
├── COVER-LETTER.md                 ← executive summary + disclaimer
├── REMEDIATION-PLAN.md             ← 9 open gaps, SLA attached
├── ATTESTATION.md                  ← sign-off block (signer required)
└── COMPLIANCE-INDEX.md
CHANGE-LOG.md                       ← one new entry per run
```

## Cross-agent chaining hints per role

The Compliance agent adapts its **default framework set**, **artifact emphasis**, and **recommended follow-up** to the resolved [role](../concepts/role-adaptation):

| Role | Default framework(s) | Emphasis | Next agent |
|------|-----------------------|----------|-----------|
| `ea` | `all` (portfolio sweep) | Portfolio-level compliance posture across every framework and every team's findings — executive control-mapping summary, cross-team gap aggregation. | [Architecture](./architecture) — standardization ADR for the frameworks with the most cross-team gaps. |
| `tl` | Team-relevant subset (else `cwe,owasp`) | Team-level control-mapping for the frameworks that apply to their service; remediation-plan prioritized by what the team owns. | [Audit](./audit) — baseline the components behind the team's highest-priority remediation items. |
| `de` | `cwe,owasp` | Remediation-plan with SLA — Jira-ready remediation items (control ID, gap description, file:line, owner placeholder, SLA deadline). | [Code Generation](./code-generation) — scaffold the fix for the highest-severity gap. |
| `qa` | `cwe,owasp` | Control-mapping cross-referenced with test-coverage findings — are compliance-critical paths (payment, auth, PII handling) actually under test? | [Test Coverage](./test-coverage) — coverage of the files behind compliance-critical gaps. |
| `devops` | `cis` (+ team default) | Audit-trail automation focus — CI-integrated compliance-gate reporting; `--fail-on-overdue` wired into the pipeline. | [Release](./release) — gate the deploy on zero OVERDUE compliance findings. |
| `security` | `cwe,owasp` | **Primary role for this agent.** Deep control-mapping across CWE + OWASP; STRIDE cross-reference when Architecture threat-models are cached; PCI/HIPAA/GDPR added once applicability is confirmed. | [Sonar Scan](./sonar-scan) — deep vuln scan for the code paths behind the highest-severity gaps. |
| `pm` | Role default from team | Cover-letter + executive summary — business-risk framing of compliance gaps (revenue exposure, audit-timeline risk), not code-level detail. | [Requirements](./requirements) — reconcile compliance gaps against BRD acceptance criteria. |
| `ba` | Role default from team | Control-mapping cross-referenced with Requirements traceability — does the compliance-relevant control trace to a documented BRD requirement? | [Requirements](./requirements) — trace the compliance gap back to its BRD source. |
| `migration` | `sox` | Financial-controls continuity during migration — before/after compliance-posture comparison across the cutover; SOX Section 404 continuity emphasis. | [Release](./release) — cross-reference the cutover plan with SOX continuity gaps. |
| `content` | `gdpr` | PII-in-content compliance — GDPR mapping for DAM/forms/analytics; content-retention compliance notes. | [Code Generation](./code-generation) — scaffold the consent-capture component for the flagged form. |
| `generic` | `cwe,owasp` | Balanced default — every artifact resolvable, framework balanced across code-level (CWE) and web-risk (OWASP) coverage. | [Audit](./audit) — baseline the compliance posture against the code base. |

PCI, HIPAA, GDPR, and SOX are **never silently defaulted** for any role purely from role selection alone — framework applicability for regulated-data frameworks follows the confirm-don't-infer rule (see `SKILL.md` § Constraints / non-goals). The resolved role is exposed to child engines via `process.env.DCA_ROLE`, recorded on the **Run Info** sheet, and printed to stderr on every run.

## Per-framework and per-stack notes

The agent loads a per-framework authoring guide for every resolved framework at authoring time — see the [Compliance Mapping concept](../concepts/compliance-mapping) for the full 2-pack model (framework-mappings × stack-applicability).

**Per-framework guides:**

| Framework | Guide |
|-----------|-------|
| CWE | [`resources/framework-mappings/cwe.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/cwe.md) |
| OWASP Top 10 | [`resources/framework-mappings/owasp.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/owasp.md) |
| CIS Controls | [`resources/framework-mappings/cis.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/cis.md) |
| PCI-DSS | [`resources/framework-mappings/pci.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/pci.md) |
| HIPAA | [`resources/framework-mappings/hipaa.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/hipaa.md) |
| GDPR | [`resources/framework-mappings/gdpr.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/gdpr.md) |
| SOX | [`resources/framework-mappings/sox.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/sox.md) |
| ISO 27001 | [`resources/framework-mappings/iso27001.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/iso27001.md) |

**Per-stack applicability guides:**

| Stack | Engine ID | Guide |
|-------|-----------|-------|
| AEM (AEMaaCS + AMS) | `aem` | [`resources/stack-applicability/aem.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/stack-applicability/aem.md) |
| Adobe Commerce (PaaS) | `commerce-paas` / `commerce` | [`resources/stack-applicability/commerce-paas.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/stack-applicability/commerce-paas.md) |
| Adobe Commerce SaaS | `commerce-saas` | [`resources/stack-applicability/commerce-saas.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/stack-applicability/commerce-saas.md) |
| Sling / Shaft | `sling` | [`resources/stack-applicability/sling.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/stack-applicability/sling.md) |
| Spring Boot | `spring` | [`resources/stack-applicability/spring.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/stack-applicability/spring.md) |
| Adobe App Builder | `app-builder` | [`resources/stack-applicability/app-builder.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/stack-applicability/app-builder.md) |
| Edge Delivery Services | `eds` | [`resources/stack-applicability/eds.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/stack-applicability/eds.md) |
| EDS + Commerce | `eds-commerce` | [`resources/stack-applicability/eds-commerce.md`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/stack-applicability/eds-commerce.md) |

## See also

- [Compliance prompts catalog](../reference/prompts/compliance) — 90+ copy-paste prompts across frameworks, stacks, and roles.
- [Compliance Mapping concept](../concepts/compliance-mapping) — the 5-artifact model, the 8-framework catalog, the findings-source model, per-stack knowledge packs.
- [CLI Flags reference](../reference/cli-flags) — including the Enterprise Phase 1 flags shared across all agents.
- [Audit agent](./audit) · [Sonar Scan agent](./sonar-scan) · [Test Coverage agent](./test-coverage) · [Impact Analysis agent](./impact-analysis) · [Code Review agent](./code-review) — Compliance's PRIMARY data sources; it cannot mark anything `covered` without at least one of their findings caches.
- [Release agent](./release) — compliance sign-off (via the remediation plan's SLA status) gates a release.
- [Operations agent](./operations) — compliance-relevant alerts (an OVERDUE CRITICAL gap) feed Ops dashboards before they become an incident.
- [Findings gate](../concepts/findings-gate) — accept / defer / wontfix per compliance gap.
- [SLA tracking](../concepts/sla-tracking) — remediation SLA per role + framework severity; wire `--fail-on-overdue` into CI.
- [Standardized outputs contract](../concepts/standardized-outputs) — 15-column Summary + fixed sheet order.
- [Role adaptation](../concepts/role-adaptation) — how default framework set + emphasis + follow-up change per role.
