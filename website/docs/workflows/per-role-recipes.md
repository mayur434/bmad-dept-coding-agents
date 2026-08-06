---
id: per-role-recipes
title: Per-role recipes
sidebar_position: 2
description: Realistic end-to-end workflows for each of the 10 roles — trigger phrases, resolved CLIs, expected outputs, and cross-agent next steps.
---

Every DCA agent adapts its default mode, output flavor, and cross-agent handoff to the resolved [role](../concepts/role-adaptation). The recipes below show how each role actually uses the plugin end-to-end — trigger phrase, resolved CLI, expected output, and the natural next step.

Set the role once per project (`.bmad/role.yaml`), or override per run with `--role <code>` on any dispatcher, or prefix a chat prompt with *"as `<role>`, …"*.

---

## Promoted roles (deep recipes)

### Enterprise Architect (`ea`)

**Scenario.** You just took over an Adobe Commerce portfolio of five projects and need a cross-cutting architecture read on one of them.

- Load [Audit](../agents/audit) in Deep Audit mode with architecture emphasis (skip low-severity code smells).
- Roll findings up to architecture-level risk via [Impact Analysis](../agents/impact-analysis).
- Output flavor is `executive` (Markdown-first, no rule-IDs) with the technical XLSX as supplementary.

**Chat:**

```text
as ea, deep audit my project and generate an architecture roadmap
```

**Resolved CLI (both steps chained):**

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --chain-all --chain-stages audit,impact-analysis \
  --role ea --path .
```

**Expected output:** executive Markdown summary + `impact-reports/impact-*-agent-report.xlsx` (with Input Traceability tuned to architecture-level risk). Follow up: *"generate architecture roadmap"*.

---

### Tech Lead / Solution Architect (`tl`)

**Scenario.** A colleague is about to open a large PR; you want to blast-radius the top-5 audit findings before assigning fixes.

- Full Deep Audit → Impact Analysis on the top-5.
- Standard technical XLSX per stage.

**Chat:**

```text
as tl, deep audit this project, then impact-analyze the top 5 findings
```

**Resolved CLI:**

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --chain-all --chain-stages audit,impact-analysis \
  --role tl --path .
```

Follow up: *"generate fix scaffolds for the top-3 impacted files"*.

---

### Senior Delivery Engineer (`de`)

**Scenario.** Mid-sprint. You want a fast Tier-1 audit → then scaffold fixes for the CRITICAL findings, with test stubs pre-populated.

- Scan Only (Tier 1), Jira-CSV output flavor, then [Code Generation](../agents/code-generation) for the fix scaffolds.
- Test stubs land automatically alongside the scaffolds.

**Chat:**

```text
as de, scan my project fast, then generate fix scaffolds for the CRITICAL findings on a new branch
```

**Resolved CLIs:**

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --role de --path . --technical

npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --scaffold --role de --engine <detected> --type <detected> --name <detected> \
  --create-branch --source-branch develop
```

Follow up: *"run coverage on the newly scaffolded tests"*.

---

### QA / SDET (`qa`)

**Scenario.** Coverage push before a release. Audit surfaces the surface area; Test Coverage measures + generates.

- Full Audit → Test Coverage (`--mode full`) with real coverage and mutation hints.
- Standard XLSX with the technical MD twin.

**Chat:**

```text
as qa, full audit my project, then full test coverage with real coverage from target/site/jacoco/jacoco.xml and emit mutation hints
```

**Resolved CLIs:**

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --role qa --path .

npx ts-node .claude/skills/bmad-dept-code-test-coverage-agent/scripts/run.ts \
  --mode full --role qa --path . \
  --coverage-report target/site/jacoco/jacoco.xml \
  --emit-mutation-hints
```

Follow up: *"list the top-20 uncovered files by priority"*.

---

### DevOps / SRE (`devops`)

**Scenario.** Wire the Quality Gate + coverage floor into CI. The Sonar Quality Gate exits non-zero on FAIL by default — that's what CI needs.

- Scan Only + Sonar (`--no-fail=false` — the default) + Test Coverage in `analyze` mode.
- SARIF export + coverage-gate PR-comment Markdown (post-processed).

**Chat:**

```text
as devops, sonar scan my project focused on security, exit non-zero on FAIL, and print a PR-ready coverage block
```

**Resolved CLIs (CI-safe pattern):**

```bash
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json \
  --focus vulnerabilities,hotspots \
  --role devops --yes-install --technical

npx ts-node .claude/skills/bmad-dept-code-test-coverage-agent/scripts/run.ts \
  --mode analyze --coverage-report target/site/jacoco/jacoco.xml \
  --role devops --yes-install --technical
```

Follow up: [Wire into CI](./ci-integration).

---

### Security Engineer (`security`)

**Scenario.** Pre-release security review. Sonar's Vulnerabilities sheet + a security-hardened audit.

- Sonar Scan `--focus vulnerabilities,hotspots` → Audit `--focus security` (LLM emphasis).
- Code Generation auto-enables `--secure` when the role is `security`.

**Chat:**

```text
as security, sonar scan my project focused on security vulnerabilities, then audit with security emphasis
```

**Resolved CLI:**

```bash
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json \
  --focus vulnerabilities,hotspots \
  --role security --path .
```

Follow up: *"map every Vulnerability to CWE and OWASP Top 10"*.

---

## Additional roles

### Product Manager / PMO (`pm`)

Scan Only + executive Markdown; top-10 findings only. Trigger: *"as pm, scan my project and summarize CRITICAL findings for the release note"*.

### Business Analyst (`ba`)

Scan Only + executive Markdown; then Impact Analysis with a BRD. Trigger: *"as ba, analyze impact of ./BRD.docx and map findings to BRD requirements"*.

### Migration / Upgrade Lead (`migration`)

Full Audit with patch-upgrade analysis (Commerce) or platform-upgrade rules (AEM) + Test Coverage delta. Trigger: *"as migration, full audit --platform aemams, then diff against a baseline audit on the AEMaaCS branch"*.

Chained CLI:

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --role migration --path . --engine aem --platform aemams \
  --since release/pre-upgrade
```

### Content / CMS Engineer (`content`)

Scan Only focused on AEM/EDS content rule packs + content-fragment scaffolds. Trigger: *"as content, scan my AEM project and scaffold a content-fragment-model called Article"*.

Chained CLI:

```bash
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --scaffold --engine aem --type content-fragment-model --name Article \
  --role content --path .
```

### Generic (`generic`)

Standard behavior across every agent, no role adaptation. Use when a team wants a uniform baseline without per-role tuning.

---

## See also

- [Role adaptation](../concepts/role-adaptation) — the `.bmad/role.yaml` schema, the full role × agent matrix, and the 5 output flavors.
- [chain-all workflow](./chain-all) — one command runs the whole SDLC pass.
- [CI Integration](./ci-integration) — DevOps-role invocation patterns.
