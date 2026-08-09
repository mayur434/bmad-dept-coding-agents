---
id: compliance-mapping
title: Compliance Mapping
sidebar_position: 16
description: How BMAD DCA maps findings from every agent to compliance frameworks (CWE, OWASP, CIS, PCI-DSS, HIPAA, GDPR, SOX, ISO 27001) — control mapping, audit trails, attestations, and remediation with SLA.
keywords:
  - compliance mapping
  - governance
  - cwe
  - owasp
  - cis controls
  - pci-dss
  - hipaa
  - gdpr
  - sox
  - iso27001
  - audit trail
  - attestation
---

The **Compliance Mapping** concept underpins the [Compliance agent](../agents/compliance) — the 11th and final agent of the BMAD DCA suite, added in Phase 4 alongside Code Review to close the last remaining SDLC coverage gaps. This page explains why a compliance agent exists, the 5-artifact model, the 8-framework catalog, the unique findings-source model, per-stack/per-framework knowledge packs, role adaptation, the shared-responsibility nuance for Adobe-managed stacks, and the disclaimer that governs everything this agent produces.

## Why a compliance agent?

The first ten agents cover SDLC phases 1 (Requirements) through 6 (Ops/Monitoring), including phase 3's deep pre-merge review. That leaves phase 8 — **Governance / Compliance** — uncovered: turning scattered technical findings into a narrative an auditor, a regulator, or a customer security questionnaire can actually consume.

Compliance closes that gap. It is the **11th and final agent**, closing the last SDLC-phase gap in the suite. Its enterprise value is straightforward: ten other agents each produce their own pile of findings in their own report; Compliance turns those piles into a single auditor-ready compliance narrative, with a persistent audit trail and a formal sign-off — the difference between "here are 200 scanner findings" and "here's what those findings mean for your PCI posture, with a remediation plan and an SLA."

## The 5-artifact model

Compliance produces up to five distinct artifact types per run. Each is a row category in the standardized Summary sheet AND a written file in `compliance-reports/`:

| Artifact | Primary consumer | Typical role driving it | Master template |
|----------|-------------------|---------------------------|------------------|
| **Control mapping** | Auditor, security/compliance team | `security`, `tl` | `templates/control-mapping.md` |
| **Audit trail** | Auditor, `devops` (CI automation) | `devops` | `templates/audit-trail.md` |
| **Cover letter** | Executive, external auditor | `pm`, `ea` | `templates/cover-letter.md` |
| **Remediation plan** | Engineering team, `de` | `de`, `devops` | `templates/remediation-plan.md` |
| **Attestation** | External auditor, regulator, customer | `security`, `pm` | `templates/attestation.md` |

The **control mapping is the core artifact** — every other artifact is derived from its rows. Each row conforms to the 15-column Summary contract; see [Standardized Outputs](./standardized-outputs) for the full row-shape spec, and the [Compliance agent's flags reference](../agents/compliance#flags-reference) for the CLI surface.

## The 8-framework catalog

`--framework` (alias `--engine`) selects one or more of these control catalogs, or `all`:

| Framework | What it is |
|---|---|
| [`cwe`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/cwe.md) | Common Weakness Enumeration — a community-maintained code-level weakness taxonomy, not a regulatory framework. The **foundation framework**: almost every finding from `audit`/`sonar-scan` maps to a CWE ID first, and the other seven guides frequently derive their own mapping from it. |
| [`owasp`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/owasp.md) | OWASP Top 10 — the industry-consensus ranking of the ten most critical web-app security risk categories. Risk-*category*-shaped, not weakness-*id*-shaped; several CWEs collapse into one OWASP category. |
| [`cis`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/cis.md) | CIS Critical Security Controls — voluntary security-hygiene safeguards, as much about process and infrastructure as about code; some CIS safeguards are not code-observable at all. |
| [`pci`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/pci.md) | PCI-DSS — a payment-brand contractual requirement, not a law. Needs SAQ-type context (SAQ A / A-EP / D, etc.) to know which of the 12 requirements are even in scope. |
| [`hipaa`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/hipaa.md) | HIPAA (Security Rule) — US health-data privacy/security law. **Opt-in only**, never auto-inferred; the agent asks before treating a project as in-scope. |
| [`gdpr`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/gdpr.md) | GDPR — EU personal-data protection law. A weaker, more commonly-true default than HIPAA/PCI/SOX — runs without a scoping conversation, though the agent still notes the assumption. |
| [`sox`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/sox.md) | SOX (Section 302/404) — US financial-reporting internal-controls law for public companies. About internal control over financial reporting, not general security — a secure piece of code can still be a SOX gap. |
| [`iso27001`](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/resources/framework-mappings/iso27001.md) | ISO/IEC 27001:2022 (Annex A) — the international ISMS standard. Spans organizational controls (policies, roles, supplier relationships) that no codebase finding can ever satisfy on its own. |

## The findings-source model

Compliance is unique among the 11 agents: **it does not scan code itself.** It has no scanner, no AST parser, no rule pack of its own. Its entire input is `consumeLatestFindings()` reading OTHER agents' caches at `<projectRoot>/.bmad/cache/` — up to five source agents: `audit`, `sonar-scan`, `test-coverage`, `impact-analysis`, `code-review`.

Two flags control this:

- **`--source-agent <csv|all>`** — which agents' caches to merge before mapping (default `all`). Each source is read independently; a missing cache for one agent is non-fatal and logs an INFO note.
- **`--source-max-age-hours <n>`** — reject cached findings older than this many hours (default `168`, 7 days). Keeps the mapping grounded in current state, not a stale scan from months ago.

**Graceful degradation.** If none of the requested source agents have a cache hit, the run still completes — but the resulting `CONTROL-MAPPING-<framework>.md` is a **scaffold-only compliance framework reference**: every control is listed, none can be marked `covered` because there's nothing to map against. The agent says so plainly rather than silently producing a report that looks complete:

> "No cached findings from audit/sonar-scan/test-coverage — this report lists every framework control but can't tell you which ones are actually covered. Run `audit` and/or `sonar-scan` first, then re-run compliance."

## Per-stack + per-framework knowledge packs

Compliance loads **two complementary packs**, organized along orthogonal axes of the same compliance space:

| Pack | Organized by | Path | Purpose |
|------|--------------|------|---------|
| **Framework mappings** | Framework (cross-stack) | `resources/framework-mappings/<framework>.md` | What the framework requires, its control taxonomy, ruleId-to-control mapping patterns, per-stack applicability, evidence requirements, what DCA can/cannot auto-detect, a worked example, attestation-signer guidance. |
| **Stack applicability** | Stack (cross-framework) | `resources/stack-applicability/<stack>.md` | For one stack, which of the 8 frameworks are heavy/medium/light/none, and why — e.g. Commerce PaaS is heavy for PCI (first-party checkout code) while EDS is none for PCI (no server-side payment logic) but heavy for client-side GDPR/consent concerns. |

16 files total (8 framework-mapping guides + 8 stack-applicability guides). Ask "map to PCI" and the agent loads `framework-mappings/pci.md`; ask "compliance profile for our AEM estate" and it loads `stack-applicability/aem.md` — both views describe the same underlying control space from different entry points.

## Two modes

### Full compliance report (default)

**Trigger:** `--artifacts all --framework all` (or role-default framework set when `--framework` is unspecified), or "full compliance report" / "compliance audit" in the prompt.

**Worked example:**

```text
compliance report — CWE and OWASP mapping
```

Resolves to `--framework cwe,owasp --artifacts all` and merges findings from every resolved source agent, dispatches both framework mappers against the same merged set, and authors control-mapping + audit-trail + cover-letter + remediation-plan + attestation-scaffold alongside the workbook and `COMPLIANCE-INDEX.md`.

### Individual artifact / framework

**Trigger:** `--artifacts <subset>` and/or `--framework <subset>`.

**Worked example:**

```text
PCI compliance report for our checkout code
```

Resolves to `--framework pci --source-agent audit,sonar-scan --artifacts all`, producing `CONTROL-MAPPING-pci.md` — 12 PCI-DSS requirements assessed against merged findings, each row `covered` / `gap` / `partial` / `N/A` with evidence (ruleId + file:line) where a finding maps.

## Role-adaptation for compliance

Compliance uses the same [role-adaptation](./role-adaptation) mechanism as the other ten agents — adapting the **default framework set**, **artifact emphasis**, and **recommended follow-up**.

**`security` is the primary role for this agent** — default `cwe,owasp`, deep control-mapping, STRIDE cross-reference when Architecture threat-models are cached, and the role most likely to add PCI/HIPAA/GDPR once applicability is confirmed.

| Role | Default framework(s) | Emphasis |
|---|---|---|
| `ea` | `all` (portfolio sweep) | Portfolio-level compliance posture across every framework and every team's findings. |
| `tl` | Team-relevant subset (else `cwe,owasp`) | Team-level control-mapping; remediation-plan prioritized by what the team owns. |
| `de` | `cwe,owasp` | Remediation-plan with SLA — Jira-ready remediation items. |
| `qa` | `cwe,owasp` | Control-mapping cross-referenced with test-coverage findings on compliance-critical paths. |
| `devops` | `cis` (+ team default) | Audit-trail automation focus; `--fail-on-overdue` wired into the pipeline. |
| `security` | `cwe,owasp` | **Primary role.** Deep control-mapping; STRIDE cross-reference; PCI/HIPAA/GDPR once confirmed. |
| `pm` | Role default from team | Cover-letter + executive summary — business-risk framing. |
| `ba` | Role default from team | Control-mapping cross-referenced with Requirements traceability. |
| `migration` | `sox` | Financial-controls continuity during migration — before/after posture comparison. |
| `content` | `gdpr` | PII-in-content compliance — GDPR mapping for DAM/forms/analytics. |
| `generic` | `cwe,owasp` | Balanced default. |

Full role matrix (including recommended next-agent follow-up) on the [Compliance agent page](../agents/compliance#cross-agent-chaining-hints-per-role) and in the source [`SKILL.md` § Role-aware behavior](https://github.com/mayur434/bmad-dept-coding-agents/blob/main/skills/bmad-dept-code-compliance-agent/SKILL.md#role-aware-behavior).

## Shared-responsibility awareness

For Adobe-managed SaaS stacks — **Commerce SaaS**, **App Builder**, **EDS** — some controls are Adobe's responsibility, not the customer's. A Commerce SaaS merchant's compliance surface narrows to the integration layer (Drop-in components, Payment Services config, API credential rotation) because Adobe operates the underlying platform; an App Builder action's infrastructure-level CIS safeguards are Adobe-managed and outside code-scan scope, while the action's own auth annotations remain the customer's to fix.

This nuance is per-stack, not a blanket rule — Commerce PaaS (self-managed application layer) carries the full weight of the same controls a SaaS merchant would partially offload. See `resources/stack-applicability/<stack>.md` for the specific shared-responsibility notes on each of the three SaaS-flavored stacks; the guides recommend writing the boundary down explicitly in `.bmad/conventions.yaml` or the compliance cover letter to turn a recurring point of confusion into a one-time documented fact.

## Traceability + audit trail

Every compliance run is itself an audit-relevant event. The `audit-trail` artifact draws from two sources: `CHANGE-LOG.md` (the project-root running log every DCA agent appends to) and the findings-cache run history (`readAllRuns()` across `.bmad/cache/`). A decision to `accept`, `defer`, or mark `wontfix` on a compliance gap is exactly the kind of thing an auditor wants a timestamped record of — which is why those decisions surface in the audit-trail artifact when `--audit-trail` is passed, not just in `.bmad/decisions.yaml`.

In practice: every compliance run **IS** an audit-trail entry — the findings cache Compliance itself writes (`emitFindingsCache`, agent id `compliance`) becomes part of the very history the next audit-trail export will include.

## Output artifacts

Every compliance run writes into `<project>/compliance-reports/` (override with `--output`):

- `compliance-<branch>-<timestamp>-agent-report.xlsx` — the standardized workbook.
- `compliance-<branch>-<timestamp>-agent-report.md` — the Markdown twin.
- `CONTROL-MAPPING-<framework>.md` — one per resolved framework.
- `AUDIT-TRAIL.md`, `COVER-LETTER.md`, `REMEDIATION-PLAN.md`, `ATTESTATION.md` — per requested artifact.
- `COMPLIANCE-INDEX.md` — always emitted; manifest of inputs → artifacts.
- One `CHANGE-LOG.md` entry spliced into project root.

`--format both` is currently **stubbed** — it logs a warning on stderr and falls back to markdown. The docx writer lands in a later phase.

## Remediation-gate integration

The [Findings Gate](./findings-gate) applies to compliance-gap rows directly:

| Decision status | Effect on the compliance gap |
|-----------------|---------------------------------|
| `accepted` | The gap is formally **risk-accepted** by governance (e.g. a known PCI gap, leadership has signed off on the exposure, revisit at next assessment cycle). |
| `deferred` | Remediation is **scheduled** but not yet done — moves to the SLA sheet with a `next-review` date. |
| `wontfix` | The control is **not applicable** to this project/stack, and that determination is documented — should always carry a `comments` rationale, since an auditor will ask why. |

Combine this with the **remediation SLA per role + framework severity** (see [SLA Tracking](./sla-tracking)): how long a mapped gap can stay `open` before it's `OVERDUE`. Framework severity matters more than role here — **PCI CRITICAL gaps get the tightest SLA in the suite** (payment-data exposure is the highest-consequence category DCA maps), while **ISO 27001 LOW gaps** (often organizational/process controls requiring a policy change, not a code fix) get the longest. `--fail-on-overdue` exits with code 6 when any compliance finding has sat past its SLA — wire this into CI to fail the release pipeline.

## The disclaimer

**This agent assists with mapping. It does not constitute legal or compliance certification.**

The control-mapping, cover-letter, remediation-plan, and attestation are all **AI-assisted drafts**. They accelerate the tedious correlation work between scanner findings and framework controls; they do not replace a **QSA** (PCI), a **Privacy/Security Officer** sign-off (HIPAA), a **DPO** review (GDPR), or an **external auditor** (SOX, ISO 27001). Formal audits require qualified human reviewers — the per-framework guides in `resources/framework-mappings/` each carry attestation-signer guidance naming the right kind of human sign-off for that framework.

**Human legal/compliance review is required before any attestation or cover letter is submitted externally** — to an auditor, a regulator, a customer's security questionnaire, or a board. Every `cover-letter` and `attestation` artifact repeats this disclaimer in its own body, and the agent repeats it verbally after authoring either one.

## See also

- [Compliance agent](../agents/compliance) — the per-agent reference (flags, modes, CLI, per-framework/per-stack notes).
- [Compliance prompts catalog](../reference/prompts/compliance) — 90+ copy-paste prompts across frameworks, stacks, and roles.
- [Role adaptation](./role-adaptation) — how default framework set + emphasis + follow-up change per role.
- [Findings cache](./findings-cache) — how Compliance consumes other agents' output; the only agent whose primary input IS the findings cache rather than the codebase.
- [One-shot mode](./one-shot-mode) — full precedence rules for silent end-to-end execution.
- [Findings gate](./findings-gate) — accept / defer / wontfix per compliance gap.
- [SLA tracking](./sla-tracking) — remediation SLA per role + framework severity.
- [Audit agent](../agents/audit) · [Sonar Scan agent](../agents/sonar-scan) · [Test Coverage agent](../agents/test-coverage) · [Impact Analysis agent](../agents/impact-analysis) · [Code Review agent](../agents/code-review) — Compliance's source agents.
- [Release agent](../agents/release) — compliance sign-off gates a release.
