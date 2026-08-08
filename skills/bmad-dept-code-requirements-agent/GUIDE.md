# BMAD DEPT Code Agent — Requirements Module

Requirements Authoring Specialist for enterprise Adobe and custom-middleware
projects. Turns a natural-language product description (or an existing BRD)
into a stack-native BRD, epics, user stories, and acceptance criteria, plus
the standardized DCA workbook so downstream agents (Impact Analysis,
Generation, Test Coverage) can chain off the same finding rows.

---

## What it is

Unlike the other five agents in the suite (which *analyze* code that already
exists), the Requirements agent **produces** the specification the rest of the
suite feeds off. Two orthogonal modes:

- **Author** — from `--product-description "…"`, generate a BRD, epics,
  stories, and AC against the target stack template.
- **Parse & enrich** — from `--brd-in ./legacy.docx` (`.md`/`.txt` also
  supported), extract existing epics/stories/AC and fill gaps against the
  stack template (missing NFRs, missing integration points, unwritten AC on
  stated stories).

Both modes emit the Epic → Story → AC traceability matrix as the standard
DCA workbook and the Markdown twin, plus `BRD.md`, `user-stories.md`, and
`acceptance-criteria.md`.

---

## When to use

1. **New feature discovery.** A PM has a rough product description and needs
   a stack-native BRD, sprint-sized stories, and testable AC — fast.
2. **Brownfield BRD refresh.** A legacy `.docx` BRD needs to be normalized,
   gap-filled (missing NFRs, missing AC), and re-emitted in a shape
   downstream DCA agents can consume.
3. **Story-splitting workshop.** An epic is too big for one sprint; feed it
   in as a product description with `--stories-count 20` and get a MoSCoW /
   INVEST-compliant breakdown.
4. **Discovery-phase stakeholder alignment.** Producer needs a single
   authoritative document with executive summary, RACI, KPIs, and risk table
   before the first sprint commits to scope.
5. **Retrospective requirement documentation.** An undocumented feature
   already shipped; feed a summary of the observed behavior as the product
   description and produce the "as-built" BRD for audit / handoff.

---

## Install

See the Docusaurus **Getting Started → Install** page for the canonical
one-time setup (BMAD install, shared foundation, per-agent `npm install`).
The Requirements agent shares dependencies with Test Coverage (`exceljs`,
`fast-glob`, `mammoth`) — the shared `bootstrap.sh requirements` command
auto-installs on first invocation.

Direct-CLI usage without the full BMAD install works the same as the other
agents:

```bash
cd /path/to/bmad-dept-coding-agents/skills/shared && npm install
cd ../bmad-dept-code-requirements-agent/scripts && npm install
npx ts-node run.ts --path /path/to/project --product-description "..."
```

---

## Quick start

### 1. Author a BRD for a new feature

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --product-description "a new checkout flow supporting Apple Pay + saved cards" \
  --stories-count 12 \
  --format markdown
```

Output (stderr summary + written files):

```
📋 BMAD Requirements Agent
   Path:   /path/to/project
   Engine: Adobe Commerce (PaaS / Magento 2)
   Stories target: 12
   Format: markdown

📊 Report:     requirements-reports/requirements-main-20260808_120000-agent-report.xlsx
📄 Markdown:   requirements-reports/requirements-main-20260808_120000-agent-report.md
📝 CHANGE-LOG: CHANGE-LOG.md
📋 BRD:        requirements-reports/BRD.md
```

### 2. Parse and enrich an existing BRD

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --brd-in ./legacy-brd.docx \
  --stories-count 15
```

Emits an enriched `BRD.md` side-by-side with the source (never mutates the
input), the standard workbook (with a **Delta** sheet showing pre-existing
vs. added rows), and the story/AC rollups.

### 3. Chain: BRD → impact analysis → scaffold → coverage

```bash
# Step 1 — author the BRD
npx ts-node .claude/skills/bmad-dept-code-requirements-agent/scripts/run.ts \
  --path . --product-description "..." --create-branch

# Step 2 — impact-analyze the emitted BRD
npx ts-node .claude/skills/bmad-dept-code-impact-analysis-agent/scripts/run.ts \
  --path . --brd requirements-reports/BRD.md

# Step 3 — scaffold code for the top-N stories
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --path . --type controller

# Step 4 — measure coverage against the AC
npx ts-node .claude/skills/bmad-dept-code-test-coverage-agent/scripts/run.ts \
  --path . --mode full
```

---

## CLI reference

### Requirements-specific flags

| Flag | Description |
|------|-------------|
| `--product-description <text>` | Natural-language product intent — primary input for author mode. |
| `--brd-in <path>` | Existing BRD (`.docx` / `.md` / `.txt`) — primary input for parse mode. |
| `--brd-out <path>` | Where to write the generated BRD. Default: `<output>/BRD.md`. |
| `--stories-count <n>` | Target user-story count. Default: `12`. LLM may drift ±2 based on natural boundaries. |
| `--format <docx\|markdown\|both>` | BRD output format. Default: `markdown`. `docx` planned for Phase 2.2 — currently logs a warning and falls back. |

### Standard flags (shared with the other 5 DCA agents)

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
  (default: `<project>/requirements-reports`).
- `--yes-install` / `--no-install` — first-run dep-install control.
- `--create-branch` / `--source-branch <name>` — cut
  `dca/requirements-<stack>-<timestamp>` before writing.
- `--preflight` / `--no-preflight` — LLM-mode advisory.
- `--include-decided` / `--decisions-path` / `--ignore-decision-expiry` /
  `--list-decisions` — decisions gate (`.bmad/decisions.yaml`).
- `--sla-path` / `--no-sla` / `--fail-on-overdue` — SLA gate
  (`.bmad/sla.yaml`).
- `--list-engines` — print the 8 registered engines and exit.

---

## Output shape

See `SKILL.md` → **Output contract** for the full schema. Summary:

- **Workbook** — `requirements-<branch>-<timestamp>-agent-report.xlsx` with
  the 15-column contract, plus sheets: Run Info, Summary, Severity
  Breakdown, By Category, Recommendations, SLA Status, Input Traceability,
  and (parse mode only) Delta.
- **Markdown twin** — same rows, git-diffable.
- **BRD.md** — the primary deliverable, rendered from `templates/BRD.md`
  with `{{PLACEHOLDERS}}` filled by the LLM authoring pass.
- **user-stories.md** — one section per story from `templates/user-story.md`.
- **acceptance-criteria.md** — one G/W/T block per AC from
  `templates/ac-checklist.md`.
- **CHANGE-LOG.md** — appended at project root with a one-line summary.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `--brd-in ./x.docx` parse fails with `mammoth` error | Confirm `mammoth` installed (`ls .claude/skills/shared/node_modules/mammoth`) and that the `.docx` opens cleanly in Word. As a workaround, convert to `.md` or `.txt` via `pandoc` and pass the converted file. |
| Story count too low or too high | Override with `--stories-count <n>`. Note the role default influences it too — `de` and `qa` tend toward smaller, more numerous stories; `pm` and `ea` toward fewer, bigger ones. Combine flags if needed. |
| Wrong stack auto-detected | Pass `--engine <id>` explicitly. The dispatcher probes for repo signals (e.g. `ui.apps/` → AEM, `app.config.yaml` → App Builder); override when the project mixes conventions. |
| `--format docx` writes a warning and falls back to markdown | Currently expected — the docx writer lands in Phase 2.2. Use `--format markdown` (the default) or convert the emitted `.md` externally (`pandoc BRD.md -o BRD.docx`). |
| `[dca-role] Generic (source: generic-fallback)` on every run | `.bmad/role.yaml` is missing. Answer the role handshake once (see SKILL.md → Role check on activation) and it persists. |

---

## Cross-links

- **Docusaurus** — `docs/agents/requirements/`, `docs/concepts/requirements-authoring/`
  (Phase 2.3), `docs/reference/cli-flags/`, `docs/reference/prompts/requirements/`
  (Phase 2.3).
- **Sibling agents**:
  - **Impact Analysis** — feed the emitted BRD via `--brd requirements-reports/BRD.md`
    to trace impacted code before scaffolding.
  - **Generation** — scaffold code for approved stories via `--type <component>`
    matched to story categories.
  - **Test Coverage** — write tests aligned to the AC via `--mode full` on the
    impacted files.
- **Shared foundation** — `skills/shared/role/`, `skills/shared/interactive/`,
  `skills/shared/install/`, `skills/shared/decisions/`, `skills/shared/output/`.
