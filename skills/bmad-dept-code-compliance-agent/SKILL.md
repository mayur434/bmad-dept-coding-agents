---
name: bmad-dept-code-compliance-agent
description: "Governance & Compliance Specialist (⚖️) — the 11th agent of the BMAD DEPT Code Agent suite. Maps findings from every DCA agent to compliance frameworks (CWE, OWASP Top 10, CIS Controls, PCI-DSS, HIPAA, GDPR, SOX, ISO 27001). Produces auditor-ready control-mapping reports, audit-trail exports, sign-off attestations, and remediation plans with SLA."
keywords: ["compliance", "governance", "cwe", "owasp", "cis controls", "pci", "pci-dss", "hipaa", "gdpr", "sox", "iso27001", "iso 27001", "control mapping", "audit trail", "attestation", "sign-off", "remediation plan", "auditor"]
---

# BMAD DEPT Code Agent — Compliance Skill

## Purpose

The **Governance & Compliance Specialist (⚖️)** is the **11th agent** in
the BMAD DEPT Code Agent suite (audit, generation, impact-analysis,
sonar-scan, test-coverage, requirements, architecture, release,
operations, code-review, **compliance**) and **closes SDLC phase 8
(Governance / Compliance)** — the last SDLC-phase gap in the suite.

Every other DCA agent scans, authors, or reviews code directly.
Compliance does not. Its entire job is to take the findings that OTHER
agents already produced — cached at `<projectRoot>/.bmad/cache/` by
`audit`, `sonar-scan`, `test-coverage`, `impact-analysis`, and
`code-review` — and **map** them against eight compliance-framework
control catalogs:

- **CWE** — Common Weakness Enumeration (code-level weakness taxonomy)
- **OWASP Top 10** — web-application security risk categories
- **CIS Controls** — general security-hygiene benchmarks
- **PCI-DSS** — payment-card data security
- **HIPAA** — health-data privacy/security (Security Rule)
- **GDPR** — EU personal-data protection
- **SOX** — financial-reporting internal controls (Section 302/404)
- **ISO 27001** — information-security management system (Annex A)

From that mapping it produces five auditor-facing artifacts:

- **Control-mapping report** — the matrix: which control is covered by
  which finding, which control is a gap, which is not applicable.
- **Audit-trail export** — chronological history from `CHANGE-LOG.md` +
  the findings-cache run history.
- **Auditor cover letter** — executive summary of scope, methodology,
  and posture, written for someone outside engineering.
- **Remediation plan** — every gap, with an owner placeholder and an
  SLA deadline.
- **Attestation** — a sign-off/attestation document naming a signer,
  scope, and explicit limitations.

> **Compliance is a mapping AID, not a certifying authority.** It
> accelerates the tedious part of compliance work — correlating
> hundreds of scanner findings against hundreds of framework controls —
> but it does not replace a QSA, a DPO, an external auditor, or your
> legal/compliance team. See **Constraints / non-goals** below; the
> same disclaimer repeats on the cover letter and attestation artifacts
> themselves.

### Two modes

**Full compliance report (default, `--artifacts all --framework all`).**
Every resolved framework mapped, every artifact authored.

**Individual artifact / framework.** Narrow to one artifact
(`--artifacts control-mapping`) and/or one or more frameworks
(`--framework pci`, `--framework cwe,owasp`).

## Activation

This skill activates when the user asks to:

- Produce a compliance report / run a compliance audit
- Map findings to CWE / map to OWASP / OWASP mapping
- PCI compliance / PCI-DSS check / HIPAA check / GDPR mapping
- SOX controls / ISO 27001 mapping / ISO27001 control mapping
- Export an audit trail / audit trail export
- Author a compliance attestation / sign-off document
- Build a remediation plan for compliance findings
- "which controls does this violate", "are we PCI compliant"

Trigger phrases: `compliance report`, `map to CWE`, `OWASP mapping`,
`PCI compliance`, `HIPAA check`, `GDPR mapping`, `SOX controls`,
`ISO 27001 mapping`, `audit trail export`, `compliance attestation`,
`remediation plan for compliance`.

Menu codes (see `skills/module-help.csv`):

| Code | Action |
|------|--------|
| `GO` | Full compliance report (`--artifacts all`, role-driven framework default). |
| `GM` | Control mapping (`--artifacts control-mapping`). |
| `GT` | Audit trail export (`--artifacts audit-trail`). |
| `GL` | Cover letter (`--artifacts cover-letter`). |
| `GR` | Remediation plan (`--artifacts remediation-plan`). |
| `GA` | Attestation (`--artifacts attestation`). |
| `GW` | Map to CWE (`--framework cwe`). |
| `GS` | Map to OWASP Top 10 (`--framework owasp`). |
| `GI` | Map to CIS Controls (`--framework cis`). |
| `GP` | Map to PCI-DSS (`--framework pci`). |
| `GH` | Map to HIPAA (`--framework hipaa`). |
| `GD` | Map to GDPR (`--framework gdpr`). |
| `GX` | Map to SOX (`--framework sox`). |
| `GZ` | Map to ISO 27001 (`--framework iso27001`). |
| `GF` | List available frameworks (`--list-frameworks`). |

## Prompt → Action Resolution

Map the user's prompt to a `run.ts` invocation. All flags below are
already wired in `scripts/run.ts` — do not invent flags; run `npx
ts-node run.ts --help` if in doubt.

| User says… | Resolves to |
|---|---|
| "compliance report" (no framework named) | `--artifacts all` (framework resolves from role default → `cwe,owasp` fallback — see § Role-aware behavior) |
| "map our findings to OWASP Top 10" | `--framework owasp` |
| "PCI compliance for our checkout" | `--framework pci --source-agent audit,sonar-scan` |
| "full compliance across all frameworks" | `--framework all --artifacts all` |
| "audit trail for the last quarter" | `--artifacts audit-trail --audit-trail --source-max-age-hours 2160` |
| "remediation plan with SLA" | `--artifacts remediation-plan --remediation-sla` |
| "auditor-ready report signed by our CISO" | `--attestation-signer "Jane Doe, CISO" --artifacts attestation` |
| "pull findings only from audit and sonar-scan" | `--source-agent audit,sonar-scan` |
| "map to CWE and OWASP" | `--framework cwe,owasp` |
| "list the frameworks you support" | `--list-frameworks` |

### Compound resolution

Combine flags when the prompt names multiple inputs:

- "PCI compliance report for checkout, signed by our security lead"
  → `--framework pci --artifacts all --attestation-signer "<name>, Security Lead"`
- "audit trail + remediation plan for the last 90 days"
  → `--artifacts audit-trail,remediation-plan --audit-trail --source-max-age-hours 2160`
- "compliance as security, CWE and OWASP only, from audit findings"
  → `--role security --framework cwe,owasp --source-agent audit`

### Missing required info — ask (do not guess)

- `--artifacts` includes `attestation` (explicitly or via `all`) but
  `--attestation-signer` is absent:

  > "Who's signing the attestation? Give me a name and role (e.g.
  > `Jane Doe, CISO`) — I'll drop it into the sign-off block."

- `--framework hipaa` or `--framework sox` requested but the project has
  no prior signal (`.bmad/conventions.yaml`, prior compliance run) that
  the framework applies:

  > "HIPAA applicability isn't something I can infer from code — does
  > this project handle PHI (protected health information)? I'll map
  > against HIPAA controls either way if you say yes, but I won't
  > silently assume it."

  (Same pattern for `--framework pci` when no payment-flow signal exists
  and for `--framework sox` when no financial-reporting signal exists —
  see § Constraints / non-goals.)

Everything else has a sensible default: `--framework` from role default
(fallback `cwe,owasp`), `--source-agent all`, `--source-max-age-hours
168` (7 days), `--artifacts all`, `--format markdown`, `--role` from
`.bmad/role.yaml` or `generic`, output at `<project>/compliance-reports/`.

## Intake mode (interactive vs technical)

> **For fast, enterprise-grade execution, prefer One-shot mode (see below).**
> Intake mode is for exploratory / first-time users.

> **CRITICAL:** The very first response to any activation must be the
> intake-mode question — unless `.bmad/intake.yaml` exists with a saved
> preference. Do NOT skip this. Do NOT show a CLI command as the first
> response.

When a user triggers this agent — via a natural-language prompt or a
menu entry — do NOT show or run a raw CLI command as the first
response. Ask which drive style they prefer:

> "Should I drive this **interactively** (I ask you step-by-step
> questions and run everything for you) or **technically** (I show you
> the CLI command with each flag explained, and you decide whether to
> run it or have me run it)?"

Save the answer to `.bmad/intake.yaml` (adjacent to `.bmad/role.yaml`)
with keys `mode: interactive|technical` and `set_at: <ISO-8601>`. On
subsequent runs, read the file silently and skip the prompt unless the
user asks to switch.

To change intake mode later, the user says **"switch intake to
interactive"** or **"switch intake to technical"** — overwrite
`.bmad/intake.yaml`.

**Sequencing note.** `Preflight`, `Pre-flight: Auto-install
Dependencies`, and framework dispatch below must NOT run before the
intake picker resolves. Order for a fresh activation:

1. Resolve intake mode (ask, or read `.bmad/intake.yaml`).
2. If technical → show the command + flag explanations, then run it
   (with the user's OK) or hand off.
3. If interactive → collect the intake questions below, then run silently.
4. Preflight + bootstrap run just before dispatch, once inputs are collected.

### Interactive mode (recommended for first-timers)

Ask one question per turn, in this order. Skip any question the user
has already answered in their initial prompt.

1. "What's the project path? (defaults to current working directory)"
2. "Which compliance framework(s)? (comma-separated: `cwe`, `owasp`,
   `cis`, `pci`, `hipaa`, `gdpr`, `sox`, `iso27001`, `all` — default:
   role-driven, falls back to `cwe,owasp`)"
3. "Which agents' cached findings should I map? (comma-separated:
   `audit`, `sonar-scan`, `test-coverage`, `impact-analysis`,
   `code-review`, `all` — default `all`)"
4. "How fresh do those findings need to be? (in hours — default `168`
   / 7 days)"
5. "Which artifacts? (comma-separated: `control-mapping`,
   `audit-trail`, `cover-letter`, `remediation-plan`, `attestation`,
   `all` — default `all`)"
6. If `audit-trail` in the set → "Include the full `CHANGE-LOG.md` +
   findings-cache run history? (Y/n)"
7. If `attestation` in the set → "Who's signing? (name + role, e.g.
   `Jane Doe, CISO`)"
8. "Attach SLA deadlines to remediation items? (Y/n — default Y)"
9. "Output format? (`markdown` / `both` — docx planned for a later
   phase, currently emits markdown only)"
10. "Cut a working branch from production? (Y/n)"
11. "Ready to run? (Y/n)"

Once every required input is collected, run the command internally (do
NOT show it unless the user asks) and stream results conversationally:

> "Mapping cached findings from `audit` + `sonar-scan` against CWE +
> OWASP Top 10 for `checkout-service`… 42 findings merged, 31 controls
> covered, 9 gaps, 2 accepted-risk. Authoring control-mapping,
> audit-trail, cover-letter, remediation-plan (SLA attached). Report at
> `compliance-reports/compliance-main-…-agent-report.xlsx`, index at
> `compliance-reports/COMPLIANCE-INDEX.md`. Want me to hand the
> remediation plan to the Release agent as a sign-off gate?"

### Technical mode (for users who want CLI transparency)

Show the fully-formed command in a `bash` code block with one flag per line:

```bash
npx ts-node .claude/skills/bmad-dept-code-compliance-agent/scripts/run.ts \
  --path /path/to/project \
  --framework cwe,owasp \
  --source-agent audit,sonar-scan \
  --source-max-age-hours 168 \
  --artifacts all \
  --remediation-sla \
  --format markdown \
  --create-branch
```

Below the block, add a bulleted list explaining each flag in plain English:

- `--path` — project root; where the findings cache and output
  directory are resolved from.
- `--framework cwe,owasp` — which compliance-framework control catalogs
  to map against. `--engine` is accepted as a synonym for consistency
  with every other DCA dispatcher's `--engine` flag.
- `--source-agent audit,sonar-scan` — which agents' cached findings to
  merge and map. Default `all` (all five).
- `--source-max-age-hours 168` — reject cached findings older than this
  many hours (default 7 days) — keeps the mapping grounded in current
  state, not a stale scan from months ago.
- `--artifacts all` — every artifact resolvable given other flags;
  narrow with a comma-separated subset (see § Artifact catalog).
- `--remediation-sla` — attach SLA deadlines to remediation items
  (on by default; `--no-remediation-sla` to skip).
- `--format markdown` — output format (docx planned; `both` still
  writes markdown only for now with a warning).
- `--create-branch` — cut a working `dca/compliance-<framework>-<timestamp>`
  branch (from `production`/`main`/`master`/`develop`) before writing.

Then ask: **"Want me to run this now, or will you copy-paste it?"**

- If **run for me** → execute silently and stream results (same as interactive mode).
- If **I'll run it** → acknowledge, and remind them: "Report will land
  in `<project>/compliance-reports/`. Come back with 'summarize the
  compliance posture' or 'attach the remediation plan to release' when
  you're done."

## One-shot mode

The **preferred enterprise path.** When the user's initial prompt fully
specifies what to run, do NOT ask any clarifying questions — execute
end-to-end, stream results, done. Use defaults from `.bmad/role.yaml`,
`.bmad/intake.yaml`, `.bmad/conventions.yaml`, and role-driven framework
defaults to fill missing inputs.

### When to enter one-shot mode

Trigger phrases (any of):

- "compliance end-to-end", "no questions, just do it", "one-shot", "auto"
- OR any prompt that specifies: (a) a framework or "all frameworks" or
  a named artifact, AND (b) the project path (default: cwd)

You DO NOT need every field explicitly — role + intake + conventions
cover the rest silently.

### Precedence for missing inputs

1. **Explicit in the user's prompt** (highest — always wins)
2. **`--flag` on run.ts** (headless / CI)
3. **`.bmad/role.yaml`** (role-driven default framework set + artifact emphasis)
4. **`.bmad/intake.yaml`** (interactive vs technical — one-shot forces technical + skip)
5. **`.bmad/conventions.yaml`** (project conventions: known PCI/HIPAA/SOX applicability, default signer, SLA overrides)
6. **Sensible defaults** (`--framework cwe,owasp`, `--source-agent all`,
   `--source-max-age-hours 168`, `--artifacts all`, `--format markdown`,
   `--remediation-sla` on, output at `compliance-reports/`)

### What one-shot DOES silence

- The intake picker ("Interactive or Technical?") — one-shot forces technical.
- The **framework picker** — one-shot uses the role default (see § Role-aware behavior).
- The **source-agent picker** — one-shot uses `all`.
- The role picker (if `.bmad/role.yaml` absent) — one-shot uses `generic`
  silently (log to stderr: "one-shot: no role file, defaulting to generic").
- Confirmations around `--create-branch`, `--yes-install` — one-shot
  assumes yes for install, no for branch cut unless the prompt says otherwise.

### What one-shot DOES ask about (only when truly critical)

- **Attestation with no signer.** If `--artifacts=attestation` (or `all`
  with attestation intent) is requested but `--attestation-signer` was
  omitted, ask ONCE:

  > "Who's signing the attestation? (name + role, e.g. `Jane Doe, CISO`)"

  This is the ONLY thing one-shot mode ever stops for. HIPAA/PCI/SOX
  applicability is not silently inferred either (see § Constraints /
  non-goals) but that confirmation is asked at framework-resolution
  time, not gated behind one-shot — it happens whether or not the run
  is one-shot, because applicability is a legal/business fact, not a
  UX convenience.

Everything else stays silent.

### One-shot prompt examples for the Compliance agent

Each example shows what the user pastes and what the AI silently resolves.

> **User:** "compliance report — CWE and OWASP mapping"
> **AI silently resolves:** path=cwd, framework=`cwe,owasp`, source-agent=`all`,
> artifacts=`all`, role=(from `.bmad/role.yaml` or `generic`), format=markdown.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --framework cwe,owasp --artifacts all --technical --no-preflight --yes-install`
> **AI reports:** "Compliance report authored: 38 findings mapped across CWE
> + OWASP, 27 controls covered, 8 gaps, 3 accepted-risk. Control-mapping,
> audit-trail, cover-letter, remediation-plan (SLA attached), attestation
> scaffold. Report at `compliance-reports/compliance-main-…-agent-report.xlsx`."

> **User:** "PCI compliance report for our checkout code"
> **AI silently resolves:** framework=`pci`, source-agent=`all`, artifacts=`all`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --framework pci --artifacts all --technical --no-preflight --yes-install`
> **AI reports:** "PCI-DSS control-mapping authored: 12 requirements
> assessed, 8 covered (payment-flow findings from audit/sonar-scan),
> 3 gaps (network segmentation evidence, key-rotation policy — human
> review required), 1 N/A. `CONTROL-MAPPING-pci.md` saved."

> **User:** "full compliance across all 8 frameworks"
> **AI silently resolves:** framework=`all`, artifacts=`all`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --framework all --artifacts all --technical --no-preflight --yes-install`
> **AI reports:** "Full compliance sweep: 8 frameworks mapped against
> 51 merged findings. Per-framework control-mapping files written for
> cwe, owasp, cis, pci, hipaa, gdpr, sox, iso27001 — HIPAA and SOX flagged
> N/A pending your applicability confirmation (see cover letter)."

> **User:** "audit trail export for the last 90 days"
> **AI silently resolves:** artifacts=`audit-trail`, audit-trail=true,
> source-max-age-hours=2160 (90 days).
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --artifacts audit-trail --audit-trail --source-max-age-hours 2160 --technical --no-preflight --yes-install`
> **AI reports:** "Audit trail exported: 14 cached runs across the DCA
> suite over 90 days, CHANGE-LOG.md present (23 entries). Saved to
> `compliance-reports/AUDIT-TRAIL.md`."

> **User:** "remediation plan with SLA, signed by our security lead"
> **AI silently resolves:** artifacts=`remediation-plan`, remediation-sla=true.
> Signer note: remediation-plan does not require a signer (attestation does)
> — the phrase is treated as role context, not `--attestation-signer`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --artifacts remediation-plan --remediation-sla --technical --no-preflight --yes-install`
> **AI reports:** "Remediation plan authored: 9 open gaps, SLA deadlines
> attached per role/severity (see § SLA tracking), owner column blank
> pending team assignment. Saved to `compliance-reports/REMEDIATION-PLAN.md`."

> **User:** "attestation document — HIPAA, signed by our compliance officer"
> **AI silently resolves:** framework=`hipaa`, artifacts=`attestation`.
> **AI ASKS (the one required question):** "Who's signing? (name + role,
> e.g. `Jane Doe, Privacy & Security Officer`)"
> **User:** "Priya Nair, Privacy & Security Officer"
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --framework hipaa --artifacts attestation --attestation-signer "Priya Nair, Privacy & Security Officer" --technical --no-preflight --yes-install`
> **AI reports:** "HIPAA attestation authored — scope + period, methodology
> + limitations (AI-assisted, sampling-based, NOT a substitute for a
> formal HIPAA Security Rule risk assessment), sign-off block for Priya
> Nair. Saved to `compliance-reports/ATTESTATION.md`. **Human legal/
> compliance review required before external submission.**"

### After one-shot execution

Always:

- Print a one-line summary (findings mapped / controls covered / gaps /
  accepted-risk counts, artifact file list, COMPLIANCE-INDEX path, report path).
- Print the recommended follow-up from the role matrix.
- Restate the disclaimer when an externally-facing artifact
  (`cover-letter`, `attestation`) was authored: "Human legal/compliance
  review is required before this goes to an auditor or regulator."
- Do NOT ask "want me to run the follow-up?" — the user will ask if they do.

Never:

- Ask what mode they wanted after the fact.
- Ask if they want to save preferences.
- Silently assume PCI/HIPAA/SOX applicability (see § Constraints / non-goals).

### CLI equivalent for one-shot (technical mode)

Every one-shot prompt has a direct CLI equivalent using all Phase 1 flags:

```bash
npx ts-node .claude/skills/bmad-dept-code-compliance-agent/scripts/run.ts \
  --path . \
  --role <code> \
  --framework <csv|all> \
  --source-agent <csv|all> \
  --source-max-age-hours 168 \
  --artifacts <csv|all> \
  --audit-trail \
  --attestation-signer "<name>, <role>" \
  --remediation-sla \
  --format markdown \
  --technical \
  --yes-install \
  --no-preflight \
  --sla-path .bmad/sla.yaml \
  --decisions-path .bmad/decisions.yaml
```

Add `--fail-on-overdue` for CI gates, `--include-decided` to bypass
decisions, `--create-branch` for a working branch, `--list-frameworks`
to enumerate frameworks and exit.

## Role-aware behavior

The Compliance agent adapts its **default framework set**, **artifact
emphasis**, and **recommended follow-up** to the role of the person
driving the run. Role selection is a **shared** concept across the
11-agent DCA suite and is persisted per-project at
`<projectRoot>/.bmad/role.yaml` (see `skills/shared/role/ROLES.md`).

### Role check on activation

**Before running any mode**, the AI agent MUST perform the role
handshake (same shape as every other DCA agent):

1. Check for `<projectRoot>/.bmad/role.yaml`.
2. If ABSENT, ask the user — verbatim:

   > "Which role best matches how you'll use this plugin? Pick one from
   > the codes below (or say 'generic' to skip):"

   Then list the **6 promoted roles** first: `ea`, `tl`, `de`, `qa`,
   `devops`, `security`. Then the **4 additional roles**: `pm`, `ba`,
   `migration`, `content`. Then the fallback: `generic`.

3. Persist the choice using the shared `writeRoleFile(projectRoot, role,
   "interactive")` helper.
4. If PRESENT, read it silently and use the `role:` field — do NOT re-prompt.
5. **Per-run override**: `"as <role>"` prefix or `--role=<code>` on
   `run.ts`. Does not write `.bmad/role.yaml`.
6. **Permanent change**: `"switch role to <code>"` overwrites `.bmad/role.yaml`.

### Role → Compliance behavior matrix

| Role | Default framework(s) | Emphasis | Recommended follow-up |
|---|---|---|---|
| `ea` | `all` (portfolio sweep) | **Portfolio-level compliance posture** across every framework and every team's findings — executive control-mapping summary, cross-team gap aggregation, standardization signal for which frameworks each service actually needs. | "architecture: emit a compliance-standardization ADR for the frameworks with the most cross-team gaps" |
| `tl` | Team-relevant subset (from `.bmad/conventions.yaml`, else `cwe,owasp`) | **Team-level control-mapping** for the frameworks that apply to their service; remediation-plan prioritized by what the team owns. | "audit the components behind the highest-priority remediation items" |
| `de` | `cwe,owasp` | **Remediation-plan with SLA** — Jira-ready remediation items (control ID, gap description, file:line, owner placeholder, SLA deadline). | "generation: scaffold the fix for the highest-severity gap" |
| `qa` | `cwe,owasp` | **Control-mapping cross-referenced with test-coverage findings** — are compliance-critical paths (payment, auth, PII handling) actually under test? | "test-coverage the files behind the compliance-critical gaps" |
| `devops` | `cis` (+ team default) | **Audit-trail automation focus** — CI-integrated compliance-gate reporting; `--fail-on-overdue` wired into the pipeline. | "release: gate the deploy on zero OVERDUE compliance findings" |
| `security` | `cwe,owasp` | **Primary role for this agent.** Deep control-mapping across CWE + OWASP; STRIDE cross-reference when Architecture threat-models are cached (`impact-analysis`/`architecture` findings caches); PCI/HIPAA/GDPR added when applicability is confirmed. | "sonar-scan the code paths behind the highest-severity gaps" |
| `pm` | Role default from team | **Cover-letter + executive summary** — business-risk framing of compliance gaps (revenue exposure, audit-timeline risk), not code-level detail. | "requirements: reconcile compliance gaps against BRD acceptance criteria" |
| `ba` | Role default from team | **Control-mapping cross-referenced with Requirements traceability** — does the compliance-relevant control trace to a documented BRD requirement? | "requirements: trace the compliance gap back to its BRD source" |
| `migration` | `sox` | **Financial-controls continuity during migration** — before/after compliance-posture comparison across the cutover; SOX Section 404 control-continuity emphasis. | "release: cross-reference the migration cutover plan with the SOX continuity gaps" |
| `content` | `gdpr` | **PII-in-content compliance** — GDPR mapping for DAM/forms/analytics; content-retention compliance notes. | "generation: scaffold the consent-capture component for the flagged form" |
| `generic` | `cwe,owasp` | Balanced default — every artifact resolvable, framework balanced across code-level (CWE) and web-risk (OWASP) coverage. | "audit the compliance posture against the code base" |

PCI, HIPAA, GDPR, and SOX are **never silently defaulted** for any role
purely from role selection alone — the matrix above lists the role's
*emphasis*, but framework applicability for regulated-data frameworks
still follows the confirm-don't-infer rule in § Constraints / non-goals.
`security` may add PCI/HIPAA/GDPR to its default set once applicability
is confirmed for the project (persisted to `.bmad/conventions.yaml`).

### Cross-agent chaining hints per role

| Role | Next agent to invoke | Why |
|---|---|---|
| `ea` | `architecture` | Standardization ADR for the frameworks with the most cross-team gaps. |
| `tl` | `audit` | Baseline the components behind the team's highest-priority remediation items. |
| `de` | `generation` | Scaffold the fix for the highest-severity gap. |
| `qa` | `test-coverage` | Coverage of the files behind compliance-critical gaps. |
| `devops` | `release` | Gate the deploy on zero OVERDUE compliance findings. |
| `security` | `sonar-scan` | Deep vuln scan for the code paths behind the highest-severity gaps. |
| `pm` | `requirements` | Reconcile compliance gaps against BRD acceptance criteria. |
| `ba` | `requirements` | Trace the compliance gap back to its BRD source. |
| `migration` | `release` | Cross-reference the cutover plan with SOX continuity gaps. |
| `content` | `generation` | Scaffold the consent-capture component for the flagged form. |
| `generic` | `audit` | Baseline the compliance posture against the code base. |

The resolved role is exposed to child engines via `process.env.DCA_ROLE`
(and `DCA_ROLE_NAME` / `DCA_ROLE_FLAVOR` / `DCA_ROLE_SOURCE`), recorded
on the Run-Info sheet of the standardized report, and a one-line
`[dca-role] <Name> (source: <cli-flag|role-file|generic-fallback>)` is
printed to stderr on every run.

## Pre-flight: Auto-install Dependencies

Before ANY command execution, run the shared bootstrap. It installs the
`shared/` foundation (if missing) + this agent's `scripts/` deps in the
correct order, with a one-line confirmation prompt. First-time cost is
~80MB / ~30–60s; subsequent runs are silent no-ops.

**POSIX (macOS, Linux, WSL):**

```bash
bash .claude/skills/shared/bootstrap.sh compliance
```

**Windows (or when sh is unavailable):**

```bash
node .claude/skills/shared/bootstrap.js compliance
```

**Headless / CI mode (skip prompt):**

```bash
bash .claude/skills/shared/bootstrap.sh compliance --yes    # install without asking
bash .claude/skills/shared/bootstrap.sh compliance --no     # error if deps missing
```

**Behavior:**

- Both `node_modules` present → silent no-op (exit 0)
- Either missing → confirmation prompt, then install if approved
- User declines → exit 3
- Install failure → exit 4

**Instructions to the AI:** Do NOT skip this step. The bootstrap script
handles the confirmation — you do NOT need to ask separately. `run.ts`
also accepts `--yes-install` / `--no-install` and forwards them to
bootstrap. The `compliance` agent has its own dedicated entry in the
`InstallAgentName` enum (`skills/shared/install/preflight.ts`) — it does
not piggyback on another agent's dependency set.

## Preflight — report the user's LLM & recommend a mode

The moment this command is triggered from an AI assistant, run the
preflight and tell the user — in one line — **which LLM they're on**
and **whether the target project fits their context window**:

```bash
npx ts-node scripts/run.ts --path {project} [--framework {frameworks}] --preflight
```

It prints the detected **model + context window**, the **project size**
(files/LOC/tokens), the **fit** (% of the window), and a
**recommendation** — **STATIC** (deterministic scaffold only) when the
project is large, **LLM** (rich authoring) when it comfortably fits, or
**HYBRID**. Surface it like:

*"You're on `<model>` (~`<ctx>` context). This project is ~`<pct>%` of
your window → I recommend **<mode>**. Proceed?"*

**Rule of thumb for Compliance.** Compliance does NOT re-scan the
codebase — its inputs are the (already-summarized) findings caches from
other agents, which are small relative to the project. The preflight
fit here is mostly about whether the LLM can hold the full merged
findings set + all resolved framework control catalogs + prior-run
history (for delta/audit-trail) in context at once for rich authoring
(cover-letter prose, remediation narrative). If the fit is tight, the
agent falls back to template-driven, table-only output without prose
narrative.

## Modes

The Compliance agent has two scope dimensions, selected independently
by `--artifacts` and `--framework`:

### Mode: Full compliance report (default)

**Trigger:** `--artifacts all --framework all` (or role-default
framework set when `--framework` is unspecified), or the prompt asks
for a "full compliance report" / "compliance audit".

**Steps:**

1. Resolve role (`.bmad/role.yaml`, `--role`, or `generic`).
2. Resolve framework(s) — explicit `--framework`/`--engine` wins; else
   role default; else `cwe,owasp` fallback (see `resolveFrameworks()`
   in `scripts/engines/registry.ts`).
3. Resolve source agents (`--source-agent`, default `all`).
4. Consume findings caches from each resolved source agent via
   `consumeLatestFindings` (`skills/shared/findings/consume.ts`),
   respecting `--source-max-age-hours`. Non-fatal per agent — a missing
   cache logs an INFO note, never a crash.
5. Merge all consumed findings into one set, tagged with
   `source-agent:<agent>` in `references`.
6. Dispatch each resolved framework's mapper (`scripts/engines/<fw>/mapper.ts`)
   against the SAME merged findings set.
7. Apply findings gate (`.bmad/decisions.yaml`) and SLA gate (`.bmad/sla.yaml`).
8. Author every resolved artifact from `templates/` + the per-framework
   guide in `resources/framework-mappings/<framework>.md`.
9. Emit the standard workbook + `COMPLIANCE-INDEX.md` + one file per
   artifact/framework combination (see § Output contract).
10. Report artifact + framework counts, and the role-driven follow-up.

### Mode: Individual artifact / framework

**Trigger:** `--artifacts <subset>` and/or `--framework <subset>` —
narrow to exactly what's requested. Steps are identical to the full
report, but only the requested framework mapper(s) run and only the
requested artifact file(s) are written.

## Artifact catalog

`--artifacts` accepts a comma-separated list. `all` expands to every
artifact. Missing → `all`.

| Artifact key | Written file(s) | Master template | Notes |
|---|---|---|---|
| `control-mapping` | `CONTROL-MAPPING-<framework>.md` (one per resolved framework) | `templates/control-mapping.md` + `resources/framework-mappings/<framework>.md` | The core artifact — findings-to-controls matrix. Every OTHER artifact is derived from this one's rows. |
| `audit-trail` | `AUDIT-TRAIL.md` | `templates/audit-trail.md` | Chronological export of `CHANGE-LOG.md` + findings-cache run history. Only populated with full history when `--audit-trail` is also passed; otherwise a lighter current-run-only export. |
| `cover-letter` | `COVER-LETTER.md` | `templates/cover-letter.md` | Auditor-ready executive cover letter — scope, methodology, posture summary, disclaimer. |
| `remediation-plan` | `REMEDIATION-PLAN.md` | `templates/remediation-plan.md` | Every gap from the control-mapping, with owner placeholder + SLA deadline (when `--remediation-sla`). |
| `attestation` | `ATTESTATION.md` | `templates/attestation.md` | Sign-off/attestation document. Requires `--attestation-signer` (see § Missing required info). |
| `all` | Every artifact above. | — | Default. |

## Framework catalog

`--framework` (alias `--engine`) accepts a comma-separated list of the
8 registered frameworks, or `all`. Missing → role default → `cwe,owasp`
fallback (`resolveFrameworks()` in `scripts/engines/registry.ts`).

| Framework key | Name | Typical applicable stacks | Master resource |
|---|---|---|---|
| `cwe` | Common Weakness Enumeration | All stacks — code-level weakness taxonomy is stack-agnostic. | `resources/framework-mappings/cwe.md` |
| `owasp` | OWASP Top 10 | All web-facing stacks, especially Commerce PaaS/SaaS, AEM, EDS, EDS+Commerce — anything with an HTTP-facing app layer. | `resources/framework-mappings/owasp.md` |
| `cis` | CIS Controls | All stacks — general security-hygiene benchmarks span infra + code (asset inventory, access control, logging, vuln management). | `resources/framework-mappings/cis.md` |
| `pci` | PCI-DSS | **Heavy**: Commerce PaaS, Commerce SaaS (payment flow / payment services). **Light** elsewhere unless card data is demonstrably in scope (e.g. DAM storing card images — rare, flag for human review). | `resources/framework-mappings/pci.md` |
| `hipaa` | HIPAA (Security Rule) | Only if the project handles PHI. **Requires explicit opt-in — never auto-inferred** (see § Constraints / non-goals). | `resources/framework-mappings/hipaa.md` |
| `gdpr` | GDPR | Any stack handling EU user data — commonly AEM (forms/DAM), Commerce (customer data), EDS (analytics/consent). | `resources/framework-mappings/gdpr.md` |
| `sox` | SOX (Section 302/404) | Any stack touching financial-reporting systems — commonly Commerce (order/revenue data), Spring (financial-services APIs). | `resources/framework-mappings/sox.md` |
| `iso27001` | ISO/IEC 27001:2022 (Annex A) | All stacks — organizational + technical controls span the whole ISMS, not just code. | `resources/framework-mappings/iso27001.md` |

## Source-agent catalog

`--source-agent` selects which agents' findings caches to merge before
mapping. Default `all`.

| Source agent | Contributes | Cache read via |
|---|---|---|
| `audit` | Code-level weaknesses and rule-pack violations (`COMM-SEC-*`, `AEMCS-SEC-*`, `SPRING-SEC-*`, etc.) — the richest source for **CWE** control-mapping. | `consumeLatestFindings({ fromAgent: "audit" })` |
| `sonar-scan` | Vulnerabilities, security hotspots, Quality Gate ratings — the richest source for **OWASP** and **CIS** control-mapping. | `consumeLatestFindings({ fromAgent: "sonar-scan" })` |
| `test-coverage` | Coverage gaps that are compliance-relevant — e.g. an untested payment-authorization path is both a quality gap AND a PCI control gap. | `consumeLatestFindings({ fromAgent: "test-coverage" })` |
| `impact-analysis` | Blast-radius of compliance-critical changes — informs which gaps are "urgent because widely depended-on" vs. "isolated." | `consumeLatestFindings({ fromAgent: "impact-analysis" })` |
| `code-review` | Pre-merge compliance-relevant flags caught before they ever reached a full audit/scan pass. | `consumeLatestFindings({ fromAgent: "code-review" })` |
| `all` | Merges every source above. Default. | — |

Each source agent's cache is read independently and merged — a missing
cache for one agent (e.g. no `test-coverage` run yet) is non-fatal;
the run proceeds with whatever caches exist and logs an INFO note per
missing source.

## Per-framework authoring instructions

Each of the 8 frameworks has a dedicated authoring guide at
`resources/framework-mappings/<framework>.md`. Load the guide for every
resolved framework before authoring that framework's
`CONTROL-MAPPING-<framework>.md`. Each guide covers: what the framework
requires, its control taxonomy, ruleId-to-control mapping patterns,
per-stack applicability, evidence requirements, what DCA can and cannot
auto-detect, a worked mapping example, and attestation-signer guidance.

- **`cwe.md`** — the foundation framework; almost every finding from
  `audit`/`sonar-scan` maps to a CWE ID first, and other frameworks'
  mappings are frequently *derived from* the CWE mapping (OWASP
  categories, PCI requirements, and CIS controls all cite CWE IDs in
  their own reference material). Load this guide even when the user
  didn't explicitly request `cwe` — it's the Rosetta Stone the other
  seven guides lean on.
- **`owasp.md`** — distinct because it's risk-*category*-shaped, not
  weakness-*id*-shaped; several CWEs collapse into one OWASP category
  (e.g. CWE-79, CWE-89, CWE-917 all land under A03:2021 Injection).
- **`cis.md`** — distinct because CIS Controls are as much about
  *process and infrastructure* (asset inventory, log retention,
  vulnerability-management cadence) as about code — some CIS safeguards
  cannot be satisfied by a code finding at all; the guide flags which
  ones are code-observable vs. infra/process-only.
- **`pci.md`** — distinct because PCI mapping needs **SAQ-type
  context** — which Self-Assessment Questionnaire tier applies (SAQ A /
  A-EP / D, etc.) changes which of the 12 requirements are even in
  scope; the guide asks for that context before treating a control as
  a gap rather than N/A.
- **`hipaa.md`** — distinct because HIPAA mapping needs **explicit
  PHI-handling confirmation** first — see § Constraints / non-goals.
  The guide never runs its control-mapping logic against inferred
  applicability; it expects the caller to have already confirmed PHI
  is in scope.
- **`gdpr.md`** — distinct because GDPR mapping needs **data-flow and
  retention context** that a code finding alone rarely carries (where
  does the personal data go, how long is it kept, is there a lawful
  basis documented) — the guide is explicit about which of its gap
  types are code-observable vs. which require a data-flow diagram or
  a Data Processing Agreement the agent cannot see.
- **`sox.md`** — distinct because SOX mapping is about **internal
  control over financial reporting**, not general security — a
  perfectly secure piece of code can still be a SOX gap if it lacks an
  audit trail or segregation-of-duties control on a financial-data
  mutation path; the guide flags this so control-mapping doesn't
  conflate "secure" with "SOX-compliant."
- **`iso27001.md`** — distinct because ISO 27001 Annex A spans
  organizational controls (policies, roles, supplier relationships)
  that no codebase finding can ever satisfy — the guide is explicit
  about the technical-controls subset DCA can actually help with vs.
  the majority that require a human-run ISMS.

## Output contract

The Compliance agent emits the standardized DCA outputs into
`<project>/compliance-reports/` (override with `--output`), via the
shared `emitStandardOutputs` (agent id `compliance`). The 15-column
Summary contract is preserved so downstream agents (Release,
Operations, and every upstream source agent) can chain off the same
row shape.

### Sheets

| Sheet | Contents |
|---|---|
| **Run Info** | Model, context window, resolved framework(s), role + source, project name / root, source agents requested vs. with cache hits, source max-age, artifact set, attestation signer (if any), audit-trail flag, remediation-SLA flag, format. |
| **Summary** | The 15-column contract, one row per mapped control / audit-trail entry / cover-letter section / remediation item / attestation clause. |
| **Severity Breakdown** | Counts per severity bucket — inherited from the source finding's severity for mapped/covered controls, or a compliance-assigned severity (`CRITICAL`/`HIGH`/`MEDIUM`/`LOW`/`INFO`) for gap rows with no source finding. |
| **By Category** | Counts per artifact category (`control-mapping` / `audit-trail` / `cover-letter` / `remediation` / `attestation`). |
| **Recommendations** | Roll-up of the `recommendation` column, sorted by severity — the remediation-plan's raw material. |
| **SLA Status** (Phase 1) | Only when `--no-sla` / `--no-remediation-sla` is NOT set. See § SLA tracking. |
| **Delta** (optional) | When authoring against a prior compliance run (same framework set), shows what changed vs. the prior control-mapping — newly covered, newly gapped, newly accepted-risk. |

### 15-column Summary contract

Each finding row carries:

| Column | Value |
|---|---|
| `id` | `COMP-<n>` (monotonic per run) |
| `title` | Control title, audit-trail entry title, cover-letter section title, remediation item title, or attestation clause title. |
| `description` | Full text — control description, audit-trail entry detail, cover-letter paragraph, remediation action, or attestation clause. |
| `tech-stack` | The stack of the underlying source finding (`aem` \| `commerce-paas` \| `commerce-saas` \| `sling` \| `spring` \| `app-builder` \| `eds` \| `eds-commerce`), or `compliance` for stack-agnostic rows (cover-letter, attestation, cross-stack audit-trail entries). |
| `category` | `control-mapping` \| `audit-trail` \| `cover-letter` \| `remediation` \| `attestation` |
| `code-reference` | File:line from the source finding when one is mapped; empty for pure-gap rows with no mapped finding. |
| `severity` | Inherited from the source finding's severity when a finding is mapped. For controls with no mapped finding: `gap` (uncovered, needs remediation), `covered` (a finding maps and the control is satisfied), or `partial` (some but not full coverage). |
| `confidence` | Per `skills/shared/scoring/README.md` — `high` / `medium` / `low`, propagated from the source finding's confidence, or `medium` for LLM-authored gap analysis without a source finding. |
| `ruleId` | `<framework>-<control-id>` (e.g. `cwe-798`, `owasp-a03`, `pci-req-6.2.4`, `iso27001-a.8.24`). |
| `recommendation` | Remediation next-step — for gaps: what to implement; for covered controls: what evidence to retain; for partial: what closes the remaining gap. |
| `impact` | Impact statement, per-role phrasing (business/audit-timeline risk for `pm`; blast radius for `security`; deploy-gate risk for `devops`). |
| `effort` | T-shirt: `S` \| `M` \| `L` \| `XL`. |
| `comments` | Free text — reviewer notes, open questions, blocking dependencies (e.g. "needs DPA confirmation from legal"). |
| `owner` | Empty at authoring time; filled during the review pass — the remediation-plan's owner column mirrors this. |
| `status` | `open` (default — gap, not yet actioned) \| `mapped` (a finding covers it, no action needed) \| `remediated` (fix shipped, pending re-verification) \| `accepted-risk` (formally accepted via the decisions gate) — advances via `.bmad/decisions.yaml` and re-runs. |

### Written files

- `CONTROL-MAPPING-<framework>.md` — one per resolved framework, rendered
  from `templates/control-mapping.md` + `resources/framework-mappings/<framework>.md`.
- `AUDIT-TRAIL.md` — rendered from `templates/audit-trail.md`.
- `COVER-LETTER.md` — rendered from `templates/cover-letter.md`.
- `REMEDIATION-PLAN.md` — rendered from `templates/remediation-plan.md`.
- `ATTESTATION.md` — rendered from `templates/attestation.md`.
- `COMPLIANCE-INDEX.md` — always emitted; manifest of inputs → artifacts
  (source agents requested/hit, frameworks resolved, artifacts requested,
  mapping stats, written-file list).
- `compliance-<branch>-<timestamp>-agent-report.xlsx` — the standardized workbook.
- `compliance-<branch>-<timestamp>-agent-report.md` — Markdown twin.
- `CHANGE-LOG.md` — appended at the project root with a one-line run
  summary (e.g. `Compliance: cwe,owasp; 38 finding(s) mapped, 27
  control(s) covered, 8 control(s) gap; 42 report finding(s).`).
- Optional standard git branch `dca/compliance-<framework>-<timestamp>`
  — cut from `production`/`main`/`master`/`develop` (or `--source-branch
  <name>`) when `--create-branch` is passed.

## Findings gate (Phase 1)

The Compliance agent participates in the shared **decisions gate**
(`.bmad/decisions.yaml`) exactly the way the other ten agents do. For
this agent, decisions apply to compliance-gap rows:

- `accepted` — the compliance gap is formally **risk-accepted** by
  governance (e.g. this PCI requirement is a known gap, leadership has
  signed off on the exposure, revisit at next assessment cycle).
- `deferred` — remediation is **scheduled** but not yet done (e.g.
  the GDPR retention-policy gap is on next quarter's roadmap) — moves
  to the SLA sheet with a `next-review` date.
- `wontfix` — the control is **not applicable** to this project/stack,
  and that determination has been documented (e.g. HIPAA Breach
  Notification Rule controls when the project was confirmed to never
  touch PHI). `wontfix` here should always carry a `comments` rationale
  — an auditor will ask why.

**Flags:**

- `--include-decided` — show findings even when a decision exists.
- `--decisions-path <path>` — override the decisions file location.
- `--ignore-decision-expiry` — keep suppressing findings even when the
  decision has expired.
- `--list-decisions` — print every decision in `.bmad/decisions.yaml` and exit.

See `skills/shared/decisions/` and the Docusaurus concept page for the
full YAML shape. **Note for Compliance specifically:** because
`accepted` / `deferred` / `wontfix` decisions on compliance gaps are
themselves audit-relevant events, they should also surface in the
`audit-trail` artifact when `--audit-trail` is passed — a decision to
accept a PCI gap is exactly the kind of thing an auditor wants a
timestamped record of.

## SLA tracking (Phase 1)

The Compliance agent participates in the shared **SLA gate**
(`.bmad/sla.yaml`). For this agent, SLA is interpreted as
**remediation SLA**: how long a mapped compliance gap can stay `open`
before it becomes OVERDUE, keyed by role + severity (`skills/shared/sla/defaults.ts`).

**Default SLAs** (customize in `.bmad/sla.yaml`; shown for the
`security` role, the agent's primary role):

| Role | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|
| `security` | 24h | 3d | 1w | 30d |
| `devops` | 2d | 5d | 2w | 30d |
| `qa` | 3d | 1w | 2w | 30d |
| `tl` | 2d | 1w | 2w | 30d |
| `ea` | 1w | 30d | 60d | 90d |
| `de` | 2d | 5d | 2w | 30d |
| `pm` / `ba` | 1w | 2w | 30d | 60d |
| `migration` | 24h | 3d | 1w | 2w |
| `content` | 3d | 1w | 2w | 30d |
| `generic` | 3d | 1w | 2w | 30d |

**Framework severity matters more than role for Compliance.** A gap's
effective severity is inherited from its mapped finding — but where no
finding maps (a pure gap row), the mapper assigns severity from the
framework's own risk weighting. In practice this means: **PCI CRITICAL
gaps get the tightest SLA in the suite** (payment-data exposure is the
highest-consequence category DCA maps), while **ISO 27001 LOW gaps
(organizational/process controls) get the longest SLA** — those often
require a policy change or a training rollout, not a code fix, and the
SLA should reflect that reality rather than pretend a code-fix SLA
applies to a training-rollout gap.

**Flags:**

- `--sla-path <path>` — override the SLA file location.
- `--no-sla` — skip SLA computation + sheet entirely.
- `--no-remediation-sla` — skip SLA deadlines specifically on the
  `remediation-plan` artifact for this run (behaves like `--no-sla`
  for the whole run today; the flag is kept separate because a future
  phase may let remediation-plan-only SLA suppression coexist with a
  populated SLA sheet elsewhere).
- `--fail-on-overdue` — exit code 6 if any finding is OVERDUE per role
  SLA. Wire this into CI to fail the release pipeline when a compliance
  gap has been sitting `open` past its framework-severity SLA.

The SLA sheet on the workbook shows each finding's age, its SLA
threshold given its severity + role, and its state (`ok` / `due-soon` /
`overdue`).

## Cross-agent chaining hints

Compliance is the **governance closure point** of the DCA workflow —
where every other agent scans, authors, or reviews, Compliance is the
one that says "here's what that means for an auditor." Recommended
fan-in / fan-out:

```
Audit + Sonar-Scan + Test-Coverage + Impact-Analysis + Code-Review
    ↓ (findings caches)
Compliance (--framework <fw> --artifacts all)   ← SDLC phase 8 closes here
    → control-mapping (per framework)
    → audit-trail
    → cover-letter
    → remediation-plan (SLA-bound)
    → attestation (signer required)
    ↓
Release (compliance sign-off gates a release)
Operations (compliance-relevant alerts feed dashboards)
```

Concrete one-liners the AI agent should offer as follow-ups after a
Compliance run:

- **Compliance ← Audit / Sonar-Scan / Test-Coverage / Impact-Analysis /
  Code-Review** — Compliance's PRIMARY data source. It never runs
  without at least one of these having run first (or the report is
  scaffold-only — see § Constraints / non-goals). Offer: "run `audit`
  and `sonar-scan` first so the control-mapping has real findings to map."
- **Compliance → Release** — "gate this release on the remediation
  plan's SLA status" — a release should not ship with an OVERDUE
  CRITICAL compliance gap; wire `--fail-on-overdue` into the Release
  agent's pre-ship checklist.
- **Compliance → Operations** — "feed the CRITICAL compliance gaps into
  an Ops alert" — an unresolved PCI/HIPAA gap approaching its SLA
  deadline is exactly the kind of thing an Ops dashboard should surface
  before it becomes an incident.
- **Compliance → Architecture** — "emit an ADR for the standardization
  gap" — when the same control shows up as a gap across multiple
  teams/stacks, that's an architecture-level standardization decision,
  not a per-team fix.
- **Compliance → Requirements** — "trace the compliance gap back to its
  BRD source" — useful for `ba`/`pm` roles closing the loop between a
  regulatory requirement and the feature that was supposed to satisfy it.

## Constraints / non-goals

**This agent maps findings to frameworks. It does not:**

- **Scan code itself.** Compliance has no scanner, no AST parser, no
  rule pack of its own. Its entire input is `consumeLatestFindings()`
  reading OTHER agents' caches at `<projectRoot>/.bmad/cache/`. If none
  of the requested `--source-agent` values have a cache hit, the run
  still completes — but the resulting `CONTROL-MAPPING-<framework>.md`
  is a **scaffold-only compliance framework reference**: every control
  is listed, none can be marked `covered` because there is nothing to
  map. The AI agent MUST say so plainly:

  > "No cached findings from audit/sonar-scan/test-coverage — this
  > report lists every framework control but can't tell you which ones
  > are actually covered. Run `audit` and/or `sonar-scan` first, then
  > re-run compliance."

- **Constitute legal compliance advice or certification.** The
  control-mapping, cover-letter, remediation-plan, and attestation are
  all **AI-assisted drafts**. They accelerate the correlation work; they
  do not replace a QSA (PCI), a Privacy/Security Officer sign-off
  (HIPAA), a DPO review (GDPR), or an external auditor (SOX, ISO
  27001). **Human legal/compliance review is REQUIRED before any
  attestation or cover letter is submitted externally** — to an
  auditor, a regulator, a customer's security questionnaire, or a
  board. Every `cover-letter` and `attestation` artifact repeats this
  disclaimer in its own body; the AI agent should repeat it verbally
  after authoring either one.

- **Auto-infer HIPAA / PCI / SOX applicability.** Whether a project
  handles PHI (HIPAA), processes payment-card data (PCI), or touches
  financial-reporting systems (SOX) is a **business/legal fact**, not
  something derivable from grepping the codebase. The agent will run
  the framework's control-mapping mechanics on request — but it asks
  once, explicitly, before treating a project as "in scope" for one of
  these three frameworks (see § Missing required info). A `wontfix`
  decision with a documented rationale is the correct way to record
  "confirmed not applicable" once that human confirmation happens.
  `owasp`, `cwe`, `cis`, `gdpr`, and `iso27001` do not carry this
  restriction — GDPR applies to any EU-user-data-handling project (a
  weaker, more commonly-true default), and the other three are
  general-purpose enough to run without a scoping conversation.

- **Take remediation action.** The `remediation-plan` artifact is a
  Markdown file with an `owner` column left blank. The Compliance agent
  never opens a Jira ticket, never assigns an engineer, never merges a
  fix. It hands the plan to a human (or to the `de`/`devops` role's
  next-agent chain, e.g. `generation`) to act on.

- **Replace the SLA / decisions gates with a compliance-specific
  engine.** Compliance reuses the exact same shared `skills/shared/sla`
  and `skills/shared/decisions` primitives every other DCA agent uses —
  there is no separate "compliance decisions" format. This keeps a
  `wontfix` decision on a PCI gap indistinguishable, mechanically, from
  a `wontfix` decision on an Audit finding — which is deliberate: one
  `.bmad/decisions.yaml` file is the single source of truth for every
  agent's suppressions.
