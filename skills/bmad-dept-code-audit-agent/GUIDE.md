# BMAD DEPT Code Agent — Audit Module

Two-tier code audit system for enterprise Adobe and custom-middleware projects.

---

## End-to-End Setup

### Prerequisites

- Node.js v20.12+
- npm (installs `exceljs`, `mammoth`, `fast-glob`, and the shared tree-sitter AST foundation)
- BMAD already initiated on your project

### Step 1: Install BMAD with this custom module

```bash
cd /path/to/your/project

npx bmad-method install \
  --directory . \
  --modules bmm \
  --custom-source ~/bmad-modules/bmad-dept-code-agent/skills \
  --tools claude-code \
  --yes
```

> Replace `~/bmad-modules/bmad-dept-code-agent` with the actual path to this repo.
> Or use a Git URL: `--custom-source https://github.com/mayur434/bmad-dept-code-agent.git`

After install, the skill lives at `.claude/skills/bmad-dept-code-audit-agent/`.

### Step 2: Install Node dependencies

The four agents share a common TypeScript foundation (`skills/shared/`), so install **that first**, then the audit agent's own scripts:

```bash
# 1. Shared foundation (exceljs, fast-glob, mammoth, tree-sitter-wasms, web-tree-sitter)
cd .claude/skills/shared && npm install

# 2. Audit agent scripts
cd ../bmad-dept-code-audit-agent/scripts && npm install
```

The audit scripts add `exceljs` (Excel reports), `mammoth` (BRD `.docx` parsing), `fast-glob` (file scanning), and `pdfkit` (PDF reports). The AST engines pull `web-tree-sitter` + `tree-sitter-wasms` from the shared foundation (WASM grammars — no native build step).

### Step 3: Run the audit

Ask your AI agent using natural language. The agent resolves your intent to the correct CLI flags automatically.

**Basic scans:**
- "scan my project"
- "scan my project and name it Acme"
- "scan only the Checkout and Payment modules" (Commerce/AEM `--module`)
- "scan only the Custom namespace" (Commerce `--namespace`)

**With data inputs (Commerce engine):**
- "scan my project with DB dump at /path/to/dump.sql"
- "scan with BRD impact analysis using /path/to/requirements.docx"
- "scan with bug report from /path/to/bugs.xlsx"

**Targeted analysis:**
- "just run BRD analysis from /path/to/brd.docx, skip the code scan"
- "analyze patch upgrade impact from 2.4.7-p7 to 2.4.7-p9" (configured in the Commerce `config.json`)

**Combined (all layers):**
- "run full scanner with DB at /db.sql, BRD at /spec.docx, bugs at /bugs.xlsx"

**Deep/Full audit:**
- "deep audit my project" (Tier 2 only — LLM semantic analysis)
- "full audit my project" (Tier 1 + Tier 2 combined)

**Utilities:**
- "export findings as JSON" (aem/commerce `--json`)
- "what engines are available?" (`--list-engines`)

The agent will:
1. Auto-detect the platform (or ask if ambiguous)
2. Build the correct CLI command with all extracted flags
3. Execute the scanner
4. Present results / point to the generated Excel report

> **"Scan Only"** — the former standalone scan-agent has been retired; its deterministic Tier-1 scan is now this agent's **Scan Only** action (menu code `SC`, `npx ts-node scripts/run.ts --path .`). There are exactly four agents in this module: audit, generation, impact-analysis, and test-coverage.

### Step 4: Find your report

Every run emits the **standardized workbook** through the shared output layer, into the configured `audit_output` directory (default `{project-root}/audit-reports`, or override with `--output`):

```
audit-reports/
  audit-<branch>-<timestamp>-agent-report.xlsx   # standardized report (primary deliverable)
  audit-<branch>-<timestamp>-agent-report.md     # git-diffable Markdown twin
```

- `<branch>` is your sanitized current git branch (or `nobranch`); `<timestamp>` is local `YYYYMMDD_HHMMSS`.
- A `CHANGE-LOG.md` entry is appended at the **project root** after every run (severity counts + report filename).
- The four **legacy engines** (`aem`, `commerce`, `eds`, `eds-commerce`) additionally write their own platform-specific multi-sheet Excel (e.g. AEM's `<project>-aem-audit-<ts>-<branch>.xlsx`), so a legacy run produces **two** `.xlsx` files.
- Pass `--create-branch` to cut an optional standard working branch `dca/audit-<stack>-<timestamp>` (from `production`/`main`/`master`/`develop`, or `--source-branch <name>`) before writing outputs.

---

## Direct CLI Usage (without BMAD install)

If you want to run the scanner standalone without the full BMAD setup:

```bash
# 1. Install the shared foundation first
cd /path/to/bmad-dept-code-agent/skills/shared && npm install

# 2. Install the audit agent's scripts
cd ../bmad-dept-code-audit-agent/scripts && npm install

# 3. Run an audit (auto-detects platform)
npx ts-node run.ts --path /path/to/your/project

# 4. Or specify the engine explicitly
npx ts-node run.ts --engine commerce --path /path/to/project --name "My Project"
```

---

## Architecture

```
Tier 1 (TypeScript/Node.js)      Tier 2 (LLM Skill)
┌─────────────────────┐        ┌─────────────────────────┐
│  Deterministic      │        │  Semantic Analysis      │
│  Static Analysis    │        │  (Rule Packs + AI)      │
│                     │        │                         │
│  • tree-sitter AST  │───────▶│  • Architectural flaws  │
│    + regex, 0 tokens│ feeds  │  • Cross-file data flow │
│  • Standardized     │ into   │  • Business logic bugs  │
│    Excel + CHANGELOG │        │  • Contextual issues    │
│  • Seconds to run   │        │                         │
└─────────────────────┘        └─────────────────────────┘
```

**Tier 1** is the deterministic scanner that `run.ts` executes (tree-sitter AST + regex, zero tokens). **Tier 2** is LLM semantic analysis driven by the Markdown rule packs (`resources/rule-packs/<stack>/rules.md` + `resources/shared/*.md`), followed by the host LLM through the BMAD skill workflow — it is not invoked by the CLI.

Within Tier 1 there are two engine families:
- **New engines** (`sling`, `spring`, `app-builder`, `commerce-saas`) are built natively on the shared tree-sitter harness and emit **only** the standardized report.
- **Legacy engines** (`aem`, `commerce`, `eds`, `eds-commerce`) run their original regex scanner (producing a platform-specific Excel), add a tree-sitter AST precision pass, **and** emit the standardized report.

---

## Available Engines

All eight engines are implemented and auto-detected (order in `registry.ts` is the detection iteration order; on a multi-match the dispatcher prefers `eds-commerce`, otherwise the first registered match). Force one with `--engine <id>`.

| Engine | Platform | Tier-1 analysis | Status |
|--------|----------|-----------------|--------|
| `commerce` | Adobe Commerce / Magento 2 (PHP) | legacy regex + PHP AST pass | ✅ Ready |
| `sling` | Apache Sling / Shaft, sling-12 (Java) | pure Java tree-sitter AST | ✅ Ready |
| `spring` | Spring Boot middleware (Java) | Java AST + regex + `application.properties/yml` | ✅ Ready |
| `app-builder` | Adobe App Builder / I/O Runtime (JS) | JS AST + config/regex | ✅ Ready |
| `commerce-saas` | Adobe Commerce SaaS (Catalog / Live Search / drop-ins) | JS AST + config | ✅ Ready |
| `aem` | AEM as a Cloud Service / AMS (Java) | legacy regex + Java AST pass | ✅ Ready |
| `eds` | Edge Delivery Services (JS) | legacy regex + JS AST pass | ✅ Ready |
| `eds-commerce` | EDS + Commerce Hybrid | legacy regex + reused EDS JS AST | ✅ Ready |

> Note: the `eds-commerce` engine's on-disk directory is `scripts/engines/eds_commerce/` (underscore), while its canonical id — used in `--engine`, `registry.ts`, and the menu — is `eds-commerce` (hyphen).

```bash
# List all engines
npx ts-node scripts/run.ts --list-engines
```

---

## Usage Modes

### Mode A: Tier 1 Only (Script)

Fast deterministic scan → standardized Excel report (`--db`/`--brd`/`--bugs`/`--no-code-audit` are Commerce-engine inputs).

| Prompt | What Happens |
|--------|-------------|
| "scan my project" | Code audit → Excel |
| "scan with DB dump at /path.sql" | Code + DB audit → Excel |
| "scan with BRD from /brd.docx" | Code + BRD impact → Excel |
| "scan with bug report /bugs.xlsx" | Code + Bug cascade → Excel |
| "run full scanner with DB, BRD, and bugs" | All layers → Excel |
| "just run BRD analysis, skip code scan" | BRD-only (`--no-code-audit`) → Excel |
| "scan only Checkout module" | Filtered code audit (`--module`) → Excel |
| "export JSON" | JSON output (`--json`, for CI pipes) |

### Mode B: Tier 2 Only (LLM Deep Analysis)

| Prompt | What Happens |
|--------|-------------|
| "deep audit my project" | AI semantic analysis using rule packs |
| "deep audit only the Payment module" | Focused AI analysis |

### Mode C: Full Audit (Tier 1 + Tier 2)

| Prompt | What Happens |
|--------|-------------|
| "full audit my project" | Scanner → Excel, then AI deep analysis on high-severity findings |
| "complete audit with scanner and deep analysis" | Same as above |

---

## Dispatcher Flags (all engines)

`run.ts` parses these before handing off to the engine:

```
  --path PATH            Project root (required unless --engine given)
  --engine ID            Force one of: commerce | sling | spring | app-builder
                         | commerce-saas | aem | eds | eds-commerce
  --format excel|md|pdf|all   Forwarded to the engine (honored by the AEM legacy report; default excel)
  --list-engines         Print the 8 registered engines and exit
  --preflight            Run the LLM/mode advisor, then exit without auditing
  --no-preflight         Skip the preflight advisory (prints on every path-ed run otherwise)
  --create-branch        Cut dca/audit-<stack>-<timestamp> before writing outputs
  --source-branch NAME   Source branch to cut from (else production, main, master, develop)
  -h / --help            Dispatcher help
```

---

## Commerce Engine — CLI Flags (Agent Reference)

The agent builds these commands from user prompts. You should never need to type these manually.

```
npx ts-node run.ts --engine commerce [FLAGS]

FLAGS (resolved from natural language):
  --path PATH          Project root (auto: workspace root)
  --name NAME          Report title (auto: folder name)
  --output DIR         Output dir (default: output/)
  --namespace NS       Module namespace (default: Custom)
  --module MOD         Filter modules (comma-separated)
  --db PATH            SQL dump for DB analysis
  --brd PATH           BRD document (repeatable)
  --bugs PATH          Bug report Excel (.xlsx)
  --no-code-audit      Skip code audit (for BRD-only / bugs-only)
  --config PATH        Custom config.json (patch-upgrade analysis is configured here)
  --json               JSON to stdout (for CI)
```

### Commerce Config File

Each engine has its own `config.json`. For commerce: `scripts/engines/commerce/config.json`

```json
{
    "project": {
        "path": "/path/to/project",
        "name": "Project Name"
    },
    "output": {
        "directory": "output"
    },
    "analysis": {
        "code_audit": "yes",
        "brd": ["/path/to/brd.docx"],
        "bug_report": "",
        "patch": {
            "enabled": true,
            "from_version": "2.4.7-p7",
            "to_version": "2.4.7-p9"
        }
    },
    "scanner": {
        "namespace": "Custom",
        "categories": [],
        "modules": []
    },
    "thresholds": {
        "god_class_lines": 500,
        "fat_constructor_deps": 10
    }
}
```

---

## Adding a New Engine

1. Create the engine directory:
   ```bash
   mkdir -p scripts/engines/myplatform/lib
   ```

2. Create `scripts/engines/myplatform/audit.ts` with a `main()` function:
   ```typescript
   export async function main(): Promise<void> {
     // Parse args (--path, --name, --output at minimum)
     // Run scan (prefer the shared tree-sitter harness in skills/shared/java|js|php)
     // Emit via the shared emitStandardOutputs()
   }
   ```

3. Register detection logic in `scripts/engines/registry.ts`:
   ```typescript
   register('myplatform', 'My Platform Description',
     (p: string) => fs.existsSync(path.join(p, 'some-marker-file')),
     'engines/myplatform/audit'
   );
   ```
   Registration order is the auto-detection iteration order.

4. Optionally add a Tier-2 rule pack: `resources/rule-packs/myplatform/rules.md`

---

## Directory Structure

```
bmad-dept-code-agent/                       # Module repository (code: dca, v3.0.0)
├── .claude-plugin/marketplace.json         # Plugin + version registry
├── skills/
│   ├── module.yaml                         # BMAD module declaration (code: dca)
│   ├── module-help.csv                     # Capability / menu registry
│   ├── shared/                             # Shared TypeScript foundation (@bmad/dca-shared)
│   │   ├── ast/  core/  git/  output/  report/  preflight/  coverage/  token-budget/
│   │   ├── java/  js/  php/                # Per-language AST rule libraries
│   │   └── index.ts, package.json, tsconfig.json
│   └── bmad-dept-code-audit-agent/         # The audit skill (this module)
│       ├── SKILL.md                        # Agent instructions (Tier 2 workflow)
│       ├── GUIDE.md                        # This file
│       ├── customize.toml                  # Skill config
│       ├── assets/                         # module.yaml / module-help.csv menu metadata
│       ├── resources/
│       │   ├── rule-packs/                 # Tier 2 rule packs (per stack)
│       │   │   ├── aemcs/rules.md
│       │   │   ├── aemams/rules.md
│       │   │   ├── commerce/rules.md
│       │   │   ├── commerce-saas/rules.md
│       │   │   ├── sling-shaft/rules.md
│       │   │   ├── spring-boot/rules.md
│       │   │   ├── app-builder/rules.md    # + aem-ui-extensibility, commerce-ui-extensibility
│       │   │   ├── eds/rules.md
│       │   │   └── eds-commerce/rules.md
│       │   └── shared/                     # Tier 2 analysis models
│       │       ├── confidence-scoring.md
│       │       ├── detection-strategy.md
│       │       ├── impact-analysis.md
│       │       ├── scanner-llm-crossref.md
│       │       └── severity-model.md
│       ├── templates/                      # Legacy Tier 2 doc templates
│       │   ├── report-json.md
│       │   └── report-markdown.md
│       └── scripts/                        # Tier 1 TypeScript engines
│           ├── run.ts                      # Unified dispatcher
│           ├── package.json                # Node dependencies
│           ├── tsconfig.json               # TypeScript config
│           ├── shared/                     # Engine-local helpers
│           │   ├── base.ts
│           │   ├── preflight.ts
│           │   ├── report-excel.ts
│           │   ├── report-markdown.ts
│           │   └── styles.ts
│           └── engines/
│               ├── registry.ts             # 8-engine registration & auto-detection
│               ├── aem/                     # ✅ legacy regex + Java AST pass
│               ├── commerce/                # ✅ legacy regex + PHP AST pass
│               ├── commerce-saas/           # ✅ JS AST + config
│               ├── sling/                   # ✅ pure Java AST
│               ├── spring/                  # ✅ Java AST + regex/config
│               ├── app-builder/             # ✅ JS AST + config
│               ├── eds/                     # ✅ legacy regex + JS AST pass
│               └── eds_commerce/            # ✅ reuses EDS JS AST (dir uses underscore)
```

When installed via BMAD into a project (`--tools claude-code`):
```
your-project/
├── .claude/
│   └── skills/
│       ├── shared/                         # Install deps here FIRST (npm install)
│       └── bmad-dept-code-audit-agent/
│           └── scripts/run.ts              # Tier 1 entry point
├── audit-reports/                          # Standardized reports (default audit_output)
│   ├── audit-<branch>-<timestamp>-agent-report.xlsx
│   └── audit-<branch>-<timestamp>-agent-report.md
└── CHANGE-LOG.md                           # Appended after every run
```

---

## Dependencies

```bash
cd skills/shared && npm install            # shared foundation first
cd ../bmad-dept-code-audit-agent/scripts && npm install
```

Shared foundation (`skills/shared/package.json`):
- `exceljs` — standardized Excel report generation
- `fast-glob` — high-performance file scanning
- `mammoth` — BRD `.docx` parsing
- `web-tree-sitter` + `tree-sitter-wasms` — WASM AST parsing (no native build)

Audit agent scripts (`scripts/package.json`):
- `exceljs`, `fast-glob`, `mammoth` — reporting / scanning / BRD parsing
- `pdfkit` (`@types/pdfkit`) — PDF report output
- `typescript`, `ts-node` — TypeScript compile / execution

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `No app/code directory found` | Ensure `--path` points to the Magento root (where `app/`, `composer.json` live) |
| `Could not auto-detect project type` | Pass the engine explicitly, e.g. `--engine commerce` |
| `Cannot find module 'exceljs'` | Run `cd scripts && npm install` |
| `Cannot find module 'web-tree-sitter'` / WASM grammar errors | Install the shared foundation first: `cd skills/shared && npm install` |
| Wrong engine auto-detected | Force it with `--engine <id>` (see the Available Engines table) |
