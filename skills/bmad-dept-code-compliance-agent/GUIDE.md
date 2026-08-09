# BMAD DEPT Code Agent — Compliance Module

Governance & Compliance Specialist (⚖️) for enterprise Adobe and
custom-middleware projects. Takes the findings every other DCA agent
already produced — audit's weakness catalog, sonar-scan's vulnerability
scan, test-coverage's gap analysis, impact-analysis's blast-radius map,
code-review's pre-merge flags — and maps them against eight compliance
frameworks (CWE, OWASP Top 10, CIS Controls, PCI-DSS, HIPAA, GDPR, SOX,
ISO 27001), producing an auditor-ready control-mapping report, an
audit-trail export, an executive cover letter, an SLA-bound remediation
plan, and a sign-off attestation.

> **This agent assists, it does not certify.** Every control-mapping,
> cover letter, and attestation it produces is an AI-assisted draft
> that accelerates the correlation work between scanner findings and
> framework controls. It is **not** a substitute for a QSA (PCI), a
> Privacy/Security Officer review (HIPAA), a DPO review (GDPR), or an
> external auditor (SOX, ISO 27001). **Human legal/compliance review is
> required before any of these artifacts goes to an auditor, a
> regulator, or a customer security questionnaire.**

---

## What it is

The **11th agent** in the BMAD DEPT Code Agent suite (after audit,
generation, impact-analysis, sonar-scan, test-coverage, requirements,
architecture, release, operations, code-review). It closes **SDLC
phase 8 (Governance / Compliance)** — the last SDLC-phase gap in the
suite. Unlike the other ten agents, Compliance does **not** scan code
itself: its entire input is the findings caches other agents already
wrote to `<projectRoot>/.bmad/cache/`.

Two scope dimensions, selected independently:

- **`--framework`** — which of the 8 control catalogs to map against
  (`cwe`, `owasp`, `cis`, `pci`, `hipaa`, `gdpr`, `sox`, `iso27001`, or
  `all`). Default: role-driven, falling back to `cwe,owasp`.
- **`--artifacts`** — which of the 5 output documents to author
  (`control-mapping`, `audit-trail`, `cover-letter`,
  `remediation-plan`, `attestation`, or `all`). Default: `all`.

All modes emit the DCA workbook + Markdown twin + `COMPLIANCE-INDEX.md`
+ one file per requested artifact/framework combination under
`<project>/compliance-reports/`.

---

## When to use

1. **Quarterly compliance review.** Every quarter, re-run the full
   compliance sweep (`--framework all --artifacts all`) against fresh
   `audit`/`sonar-scan` findings to keep the control-mapping current
   and catch newly-introduced gaps before they age into an OVERDUE SLA.
2. **Pre-audit prep.** An external auditor is scheduled — run
   `--artifacts control-mapping,audit-trail,cover-letter` for the
   in-scope framework(s) well before the audit date, so gaps have time
   to be remediated or formally risk-accepted, and the cover letter is
   ready as a starting point (after human legal/compliance review).
3. **New-framework adoption.** The business decides to go PCI-compliant
   (or add HIPAA, GDPR, SOX, ISO 27001 coverage) — after confirming
   applicability (see § Troubleshooting), run `--framework pci
   --artifacts control-mapping` to get the first-pass gap inventory,
   then iterate the remediation plan sprint over sprint.
4. **Post-incident compliance-gap review.** After a security incident,
   check whether the root-cause finding also represents a compliance
   gap (`--framework cwe,owasp,pci` scoped to the affected service) —
   an incident that traces to a control gap needs that gap formally
   tracked, not just the code fix.
5. **Executive compliance-posture reporting.** Leadership wants a
   snapshot of where the org stands across frameworks — run
   `--framework all --artifacts cover-letter` (or the full report) as
   `pm`/`ea` role for a business-risk-framed summary instead of a
   code-level dump.

---

## Install

See the Docusaurus **Getting Started → Install** page for the canonical
one-time setup (BMAD install, shared foundation, per-agent `npm
install`). The Compliance agent has its own dedicated dependency entry
(`exceljs`, `fast-glob`, `mammoth`) — the shared `bootstrap.sh
compliance` command auto-installs on first invocation.

Direct-CLI usage without the full BMAD install:

```bash
cd /path/to/bmad-dept-coding-agents/skills/shared && npm install
cd ../bmad-dept-code-compliance-agent/scripts && npm install
npx ts-node run.ts --path /path/to/project --framework cwe,owasp
```

---

## Quick start

### 1. CWE + OWASP control-mapping (the default pair)

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --framework cwe,owasp \
  --source-agent audit,sonar-scan \
  --artifacts all
```

Output (stderr summary + written files):

```
⚖️  BMAD Compliance Agent
   Path:          /path/to/project
   Frameworks:    cwe, owasp
   Source agents: audit, sonar-scan
   Artifacts:     control-mapping, audit-trail, cover-letter, remediation-plan, attestation
   Format:        markdown

   📥 Merged findings: 38 from [audit, sonar-scan]

📊 Report:      compliance-reports/compliance-main-20260809_120000-agent-report.xlsx
📄 Markdown:    compliance-reports/compliance-main-20260809_120000-agent-report.md
📝 CHANGE-LOG:  CHANGE-LOG.md
⚖️  Compliance index: compliance-reports/COMPLIANCE-INDEX.md
📚 Artifacts:   5 file(s)
```

### 2. PCI-DSS control-mapping for the checkout service

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --framework pci \
  --source-agent audit,sonar-scan \
  --artifacts control-mapping
```

Emits `CONTROL-MAPPING-pci.md` — the 12 PCI-DSS requirements assessed
against merged findings, each row `covered` / `gap` / `partial` / `N/A`
with evidence (ruleId + file:line) where a finding maps.

### 3. Attestation document, signed

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --framework hipaa \
  --artifacts attestation \
  --attestation-signer "Priya Nair, Privacy & Security Officer"
```

Emits `ATTESTATION.md` — scope + period, framework(s) attested,
methodology + limitations (AI-assisted, sampling-based, not a
substitute for a formal risk assessment), sign-off block for the named
signer, and the legal-review disclaimer.

---

## CLI reference

### Compliance-specific flags

| Flag | Description |
|------|-------------|
| `--framework <csv\|all>` | Compliance frameworks to map against: `cwe`, `owasp`, `cis`, `pci`, `hipaa`, `gdpr`, `sox`, `iso27001`, `all`. Default: role-driven, falling back to `cwe,owasp`. Alias: `--engine`. |
| `--source-agent <csv\|all>` | Which agents' findings-cache to pull from: `audit`, `sonar-scan`, `test-coverage`, `impact-analysis`, `code-review`, `all`. Default: `all`. |
| `--source-max-age-hours <n>` | How fresh the source findings must be, in hours. Default: `168` (7 days). |
| `--audit-trail` | Include `CHANGE-LOG.md` + findings-cache run history in the run. |
| `--attestation-signer <name>` | Free-text name/role for the attestation sign-off block (e.g. `"Jane Doe, CISO"`). Required when `attestation` is in the resolved artifact set. |
| `--artifacts <csv\|all>` | `control-mapping`, `audit-trail`, `cover-letter`, `remediation-plan`, `attestation`, `all`. Default: `all`. |
| `--remediation-sla` / `--no-remediation-sla` | Attach SLA deadlines to remediation items. Default: on. |
| `--format <markdown\|both>` | Output format. Default: `markdown`. `both` currently emits markdown only (docx planned) with a warning. |
| `--list-frameworks` | Print the 8 registered frameworks and exit. |

### Standard flags (shared with the other 10 DCA agents)

See the Docusaurus **Reference → CLI Flags** page for the canonical
table. In short:

- `--path <dir>` — project root (default: cwd).
- `--role <code>` — role adaptation (`ea`, `tl`, `de`, `qa`, `devops`,
  `security`, `pm`, `ba`, `migration`, `content`, `generic`). Persists
  to `.bmad/role.yaml`.
- `--interactive` / `--technical` — intake mode (persists to
  `.bmad/intake.yaml`).
- `--output <dir>` — override the report directory (default:
  `<project>/compliance-reports`).
- `--yes-install` / `--no-install` — first-run dep-install control.
- `--create-branch` / `--source-branch <name>` — cut
  `dca/compliance-<framework>-<timestamp>` before writing.
- `--preflight` / `--no-preflight` — LLM-mode advisory.
- `--include-decided` / `--decisions-path` / `--ignore-decision-expiry`
  / `--list-decisions` — decisions gate (`.bmad/decisions.yaml`).
- `--sla-path` / `--no-sla` / `--fail-on-overdue` — SLA gate
  (`.bmad/sla.yaml`).

---

## Output shape

See `SKILL.md` → **Output contract** for the full schema. Summary:

- **Workbook** — `compliance-<branch>-<timestamp>-agent-report.xlsx`
  with the 15-column contract, plus sheets: Run Info, Summary, Severity
  Breakdown, By Category, Recommendations, SLA Status, and (optional) Delta.
- **Markdown twin** — same rows, git-diffable.
- **`COMPLIANCE-INDEX.md`** — always emitted; manifest of inputs → artifacts.
- **`CONTROL-MAPPING-<framework>.md`** — one per resolved framework.
- **`AUDIT-TRAIL.md`**, **`COVER-LETTER.md`**, **`REMEDIATION-PLAN.md`**,
  **`ATTESTATION.md`** — per requested artifact.
- **`CHANGE-LOG.md`** — appended at project root with a one-line summary.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Control-mapping is all gaps, nothing `covered` | No cached findings — run `audit` and/or `sonar-scan` first. Compliance never scans code itself; it can only mark a control `covered` when a finding from another agent's cache actually maps to it. Check `--source-agent` and `--source-max-age-hours` (default 7 days — a stale scan from 3 weeks ago won't be picked up). |
| Wrong framework mapped / a needed framework is missing | `--framework` wasn't passed and the role default didn't match your intent. Pass it explicitly (`--framework pci,gdpr`) or run `--list-frameworks` to see all 8 valid values. Role defaults are a starting point, not a guess at your regulatory scope. |
| Attestation run fails / asks for a signer | `--attestation-signer "<name>, <role>"` is required whenever `attestation` is in the resolved `--artifacts` set. There's no default signer — a sign-off block with no named signer isn't a sign-off. |
| Not sure if HIPAA/PCI applies to this project | That's a human decision, not something DCA infers from code. GDPR, CWE, OWASP, CIS, and ISO 27001 run without a scoping conversation; HIPAA, PCI, and SOX applicability requires an explicit yes from you first (see `SKILL.md` → Constraints / non-goals). Once confirmed, record it as project convention so future runs don't re-ask. |
| Remediation SLA feels too aggressive or too lax | SLA defaults are role + framework-severity driven (`skills/shared/sla/defaults.ts`) — PCI CRITICAL gaps get the tightest window, ISO 27001 LOW (often process/policy) gaps get the longest. Override per-project in `.bmad/sla.yaml`, or pass `--no-remediation-sla` to drop SLA deadlines from the remediation plan entirely for this run. |

---

## Cross-links

- **Docusaurus** — `docs/agents/compliance/`,
  `docs/concepts/compliance-mapping/`,
  `docs/reference/cli-flags/`,
  `docs/reference/prompts/compliance/` (all upcoming, land after this
  content workstream).
- **Sibling agents**:
  - **Audit / Sonar-Scan / Test-Coverage / Impact-Analysis /
    Code-Review** — Compliance's PRIMARY data source; it consumes
    their findings caches and cannot mark anything `covered` without them.
  - **Release** — compliance sign-off (via the remediation plan's SLA
    status) gates a release; wire `--fail-on-overdue` into the deploy
    checklist.
  - **Operations** — compliance-relevant alerts (an OVERDUE CRITICAL
    gap) feed Ops dashboards before they become an incident.
  - **Architecture** — cross-team compliance gaps become
    standardization ADRs.
  - **Requirements** — compliance gaps trace back to BRD acceptance
    criteria for `ba`/`pm` roles.
- **Shared foundation** — `skills/shared/role/`,
  `skills/shared/interactive/`, `skills/shared/install/`,
  `skills/shared/decisions/`, `skills/shared/sla/`,
  `skills/shared/findings/`, `skills/shared/output/`.
