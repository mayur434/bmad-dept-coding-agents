# BMAD DEPT Code Agent — Architecture Module

Architecture Design Specialist for enterprise Adobe and custom-middleware
projects. Turns a natural-language design question (or an existing HLD /
OpenAPI) into ADRs, HLD/LLD, API contracts (OpenAPI 3.1 / GraphQL SDL),
C4 + sequence diagrams (Mermaid / PlantUML), STRIDE threat models, and
stack-appropriate data models — plus the standardized DCA workbook so
downstream agents (Impact Analysis, Generation, Test Coverage, Audit)
can chain off the same finding rows.

---

## What it is

Unlike Audit / Sonar / Test-Coverage (which analyze code that already
exists), and unlike Requirements (which formalizes product intent),
Architecture **produces the technical specification** the rest of the
suite implements against. Two orthogonal modes:

- **Author** — from `--design-question "…"` or `--adr "…"`, generate the
  full pack of design artifacts against the target stack template.
- **Parse & enrich** — from `--design-in ./legacy-HLD.md` (`.yaml` /
  `.json` also supported for OpenAPI) or `--openapi-in ./api.yaml`,
  extract existing decisions / endpoints / components and fill gaps
  against the stack template (missing NFRs, missing security schemes,
  missing sequence flows, missing STRIDE analysis).

Both modes emit the DCA workbook + Markdown twin + `DESIGN-INDEX.md` +
one file per artifact under `<project>/architecture-reports/`.

---

## When to use

1. **New feature design.** A tech lead has a rough design question and
   needs an ADR, HLD, LLD, and an OpenAPI contract before the first
   sprint commits.
2. **ADR-driven decision-making.** A team is debating "Kafka vs SQS",
   "MVC vs WebFlux", "Cloud Manager vs GitHub Actions". Feed the
   question in, get a MADR-format ADR with real alternatives, decision
   drivers grounded in the stack, and consequences.
3. **Contract-first API design.** Product wants an API surface before
   any code is written — author the OpenAPI + C4 + sequence pack, then
   hand it to Generation to scaffold controllers.
4. **Existing-system documentation.** A brownfield system has no design
   docs; feed a summary of the observed behavior as `--design-question`
   and produce the "as-built" HLD/LLD/data-model for audit / handoff.
5. **Security review.** Security engineer needs a STRIDE threat model
   for a payment flow — author `--artifacts threat-model,sequence` with
   `--role security`, get a per-component threat table + attack trees +
   residual-risk scoring.

---

## Install

See the Docusaurus **Getting Started → Install** page for the canonical
one-time setup (BMAD install, shared foundation, per-agent `npm install`).
The Architecture agent shares dependencies with Requirements and Test
Coverage (`exceljs`, `fast-glob`, `mammoth`) — the shared
`bootstrap.sh architecture` command auto-installs on first invocation.

Direct-CLI usage without the full BMAD install:

```bash
cd /path/to/bmad-dept-coding-agents/skills/shared && npm install
cd ../bmad-dept-code-architecture-agent/scripts && npm install
npx ts-node run.ts --path /path/to/project --design-question "..."
```

---

## Quick start

### 1. Author an ADR for a technology choice

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --adr "Kafka vs SQS for order events" \
  --artifacts adr \
  --format markdown
```

Output (stderr summary + written files):

```
🏛️  BMAD Architecture Agent
   Path:      /path/to/project
   Engine:    Spring Boot
   ADR:       Kafka vs SQS for order events
   Artifacts: adr
   API style: rest
   Diagrams:  mermaid
   Format:    markdown

📊 Report:      architecture-reports/architecture-main-20260808_120000-agent-report.xlsx
📄 Markdown:    architecture-reports/architecture-main-20260808_120000-agent-report.md
📝 CHANGE-LOG:  CHANGE-LOG.md
🏛️  Design idx:  architecture-reports/DESIGN-INDEX.md
📚 Artifacts:   1 file(s)
```

### 2. Design an API — OpenAPI + C4 + sequence pack

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --design-question "the promotions service API" \
  --artifacts openapi,c4,sequence \
  --api-style rest \
  --diagrams mermaid
```

Emits `openapi.yaml`, `c4-context.mermaid`, `c4-container.mermaid`,
`c4-component.mermaid`, and one `sequence-<flow>.mermaid` per major flow,
plus the standardized workbook and `DESIGN-INDEX.md`.

### 3. STRIDE threat model for a payment flow

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --role security \
  --design-question "our checkout with STRIDE" \
  --artifacts threat-model,sequence
```

Emits `threat-model.md` (per-component threat table, attack trees,
residual-risk scoring) alongside the sequence diagrams the model reasons
over.

### 4. Parse an existing HLD and enrich

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --design-in ./legacy-hld.md \
  --artifacts hld
```

Emits `HLD.md` side-by-side with the source (never mutates the input), the
standard workbook (with a **Delta** sheet showing pre-existing vs. added
rows), and a `DESIGN-INDEX.md` linking them.

### 5. Chain: architecture → requirements → generation → coverage

```bash
# Step 1 — author the design pack
npx ts-node .claude/skills/bmad-dept-code-architecture-agent/scripts/run.ts \
  --path . --design-question "..." --artifacts all --create-branch

# Step 2 — align the BRD to the new HLD (bidirectional loop)
npx ts-node .claude/skills/bmad-dept-code-requirements-agent/scripts/run.ts \
  --path . --brd-in architecture-reports/HLD.md

# Step 3 — scaffold code from the OpenAPI + LLD
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --path . --type controller

# Step 4 — contract tests from the OpenAPI, integration tests from the sequences
npx ts-node .claude/skills/bmad-dept-code-test-coverage-agent/scripts/run.ts \
  --path . --mode full
```

---

## CLI reference

### Architecture-specific flags

| Flag | Description |
|------|-------------|
| `--design-question <text>` | Natural-language design intent — primary input for author mode. |
| `--adr <text>` | Inline ADR title/topic — author a single ADR. |
| `--design-in <path>` | Existing HLD/LLD/design (`.md` / `.yaml` / `.json`) — primary input for parse mode. |
| `--openapi-in <path>` | Existing OpenAPI YAML/JSON to review or extend. |
| `--artifacts <csv>` | Which artifacts to author. Values: `adr`, `hld`, `lld`, `openapi`, `graphql`, `c4`, `sequence`, `threat-model`, `data-model`, `all`. Default: role-driven selection. |
| `--api-style <rest\|graphql\|both>` | API contract style. Default: `rest`. |
| `--diagrams <mermaid\|plantuml>` | Diagram format. Default: `mermaid`. |
| `--format <markdown\|both>` | Output format. Default: `markdown`. `both` currently emits markdown only (docx planned) with a warning. |

### Standard flags (shared with the other 6 DCA agents)

See the Docusaurus **Reference → CLI Flags** page for the full canonical
table. In short:

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
  (default: `<project>/architecture-reports`).
- `--yes-install` / `--no-install` — first-run dep-install control.
- `--create-branch` / `--source-branch <name>` — cut
  `dca/architecture-<stack>-<timestamp>` before writing.
- `--preflight` / `--no-preflight` — LLM-mode advisory.
- `--include-decided` / `--decisions-path` / `--ignore-decision-expiry` /
  `--list-decisions` — decisions gate (`.bmad/decisions.yaml`).
- `--sla-path` / `--no-sla` / `--fail-on-overdue` — SLA gate
  (`.bmad/sla.yaml`).
- `--list-engines` — print the 8 registered engines and exit.

---

## Output shape

See `SKILL.md` → **Output contract** for the full schema. Summary:

- **Workbook** — `architecture-<branch>-<timestamp>-agent-report.xlsx`
  with the 15-column contract, plus sheets: Run Info, Summary, Severity
  Breakdown, By Category, Recommendations, SLA Status, and (parse mode
  only) Delta.
- **Markdown twin** — same rows, git-diffable.
- **`DESIGN-INDEX.md`** — always emitted; manifest of inputs → artifacts.
- **`ADR-<n>.md`** — one file per decision, MADR 3.0 format, rendered
  from `templates/ADR.md`.
- **`HLD.md`** — high-level design, rendered from `templates/HLD.md`.
- **`LLD.md`** — low-level design, rendered from `templates/LLD.md`.
- **`openapi.yaml`** / **`schema.graphql`** — API contract.
- **`c4-*.mermaid`** / **`sequence-*.mermaid`** — diagrams (or `.puml`
  with `--diagrams plantuml`).
- **`threat-model.md`** — STRIDE model, rendered from
  `templates/threat-model-stride.md`.
- **`data-model.md`** — ER diagram + schema DDL (stack default).
- **`CHANGE-LOG.md`** — appended at project root with a one-line summary.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `--openapi-in ./x.yaml` parse fails with a YAML error | Confirm the file validates with `swagger-cli validate ./x.yaml` (or the OpenAPI 3.1 Editor). Common causes: tabs where spaces are required, `$ref` targets that resolve to nothing, `securitySchemes` outside `components`. Fix upstream and retry. |
| Wrong stack auto-detected | Pass `--engine <id>` explicitly. The dispatcher probes for repo signals (e.g. `ui.apps/` → AEM, `app.config.yaml` → App Builder, `pom.xml` + `spring-boot-starter` → Spring). Override when the project mixes conventions. |
| `--format both` writes a warning and emits markdown only | Currently expected — the docx writer lands in a later phase. Use `--format markdown` or convert the emitted `.md` externally (`pandoc HLD.md -o HLD.docx`). |
| C4 or sequence diagrams don't render in the Mermaid preview | Mermaid's C4 diagrams (`C4Context`, `C4Container`, `C4Component`) require Mermaid `>=10.x`. If your renderer is older (e.g. some GitHub UI states, older VS Code Mermaid extensions), switch to `--diagrams plantuml` or upgrade your Mermaid extension. Sequence diagrams (`sequenceDiagram`) work on Mermaid `>=8.x`. |
| `[dca-role] Generic (source: generic-fallback)` on every run | `.bmad/role.yaml` is missing. Answer the role handshake once (see SKILL.md → Role check on activation) and it persists. |

---

## Cross-links

- **Docusaurus** — `docs/agents/architecture/`,
  `docs/concepts/architecture-authoring/`,
  `docs/reference/cli-flags/`,
  `docs/reference/prompts/architecture/` (all upcoming under Phase 2.5).
- **Sibling agents**:
  - **Requirements** — Architecture is the natural next step after
    Requirements. Feed the BRD via `--design-in
    requirements-reports/BRD.md` to align design to product intent.
  - **Impact Analysis** — feed the emitted HLD via `--brd
    architecture-reports/HLD.md` to trace impacted code before
    scaffolding.
  - **Generation** — scaffold code from the OpenAPI + LLD via
    `--type <component>` matched to LLD component names.
  - **Test Coverage** — contract tests from the OpenAPI, integration
    tests from the sequence flows.
  - **Audit / Sonar Scan** — baseline quality + vulnerabilities on the
    components the STRIDE model flagged.
- **Shared foundation** — `skills/shared/role/`,
  `skills/shared/interactive/`, `skills/shared/install/`,
  `skills/shared/decisions/`, `skills/shared/output/`.
