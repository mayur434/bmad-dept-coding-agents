# BMAD DEPT Code Agent — Prompt Reference

All supported prompts grouped by **Agent** and **Platform**. Only implemented features are listed.

Legend: ✅ Implemented | 🔲 Planned (not yet available)

> **Suite at a glance.** The module ships **4 agents** — Code Audit, Code Generation, Impact Analysis, and Test Coverage — across **8 stacks**: AEM (AEMaaCS + AEM AMS), Adobe Commerce PaaS, Adobe Commerce SaaS, Sling / Shaft (sling-12), Spring Boot, Adobe App Builder, EDS, and EDS + Commerce.
>
> The former standalone *scan-agent* is retired. Its deterministic Tier‑1 scan is now the **Code Audit agent's "Scan Only" action** (`scan`). Every agent run emits the standardized `<agent>-<branch>-<timestamp>-agent-report.xlsx` (plus a Markdown twin) and appends `CHANGE-LOG.md`. Add `--create-branch` to also cut a `dca/<agent>-<stack>-<timestamp>` working branch (from `production`/`main`/`master`/`develop`, or `--source-branch <name>`).

---

## 1. Code Audit Agent (`bmad-dept-code-audit-agent`)

Tier 1 is a deterministic TypeScript scanner (tree-sitter AST + regex, zero tokens); Tier 2 is LLM semantic analysis driven by the per-stack rule packs. `scan` = Tier 1 only, `deep audit` = Tier 2 only, `full audit` = both.

### Adobe Commerce (PaaS) ✅

| Action | Prompt |
|--------|--------|
| Quick scan | `scan my project` |
| Named scan | `scan my project and name it "Client Name"` |
| Module filter | `scan only the Checkout and Payment modules` |
| Namespace filter | `scan only the Custom namespace` |
| DB analysis | `scan my project with DB dump at /path/to/dump.sql` |
| BRD impact | `scan with BRD impact analysis using /path/to/requirements.docx` |
| Bug analysis | `scan with bug report from /path/to/bugs.xlsx` |
| Patch analysis | `analyze patch upgrade impact from 2.4.7-p7 to 2.4.7-p9` |
| Full scanner | `run full scanner: code + DB + BRD + patch analysis` |
| Deep audit (LLM) | `deep audit my project` |
| Full audit (both) | `full audit my project` |
| Combined multi-layer | `run full audit named "X" with DB at /path.sql, BRD at /path.docx, bugs at /path.xlsx, patch 2.4.7-p7 to 2.4.7-p9` |
| Ambiguous (asks mode) | `audit my project` / `run a code review` / `check my code` |

**Post-audit:**

| Action | Prompt |
|--------|--------|
| Summary | `summarize the audit findings` |
| Filter severity | `show me all CRITICAL severity items` |
| Top risks | `what are the top 10 highest-risk findings?` |
| Module breakdown | `which modules have the most issues?` |
| Fix plan | `create a fix plan for the critical items` |
| Effort estimate | `estimate effort to fix all HIGH and CRITICAL findings` |
| JSON export | `export findings as JSON` |
| Config | `show current audit config` |
| Thresholds | `update thresholds: god_class_lines=600, fat_constructor_deps=12` |

### AEM (AEMaaCS + AEM AMS) ✅

**Tier 1 — Scanner (Excel/MD/PDF report with 15 categories):**

| Action | Prompt |
|--------|--------|
| Quick scan | `scan my AEM project` |
| Named scan | `scan my AEM project and name it "Client Name"` |
| Specify path | `scan my AEM project at D:\path\to\project` |
| Explicit engine | `scan --engine aem --path /path/to/project` |
| Platform filter (Cloud only) | `scan my AEM Cloud Service project` |
| Platform filter (AMS only) | `scan my AEM AMS project` |
| Format: Excel (default) | `scan my AEM project --format excel` |
| Format: Markdown | `scan my AEM project --format md` |
| Format: PDF | `scan my AEM project --format pdf` |
| Format: All three | `scan my AEM project --format all` |

> The AEM engine internally resolves the platform (`aemcs` / `aemams` / `both`) and applies the matching rule pack; force it with `--platform aemcs|aemams|both`.

**Tier 2 — Deep Audit (LLM semantic analysis):**

| Action | Prompt |
|--------|--------|
| Deep audit | `deep audit my AEM project` |
| Deep audit (named) | `deep audit for my Wipro project` |
| LLM analysis only | `run LLM analysis on my AEM codebase` |

**Full Audit (Tier 1 + Tier 2):**

| Action | Prompt |
|--------|--------|
| Full audit | `full audit my AEM project` |
| Full audit (named) | `full audit my AEM project and name it "Client X"` |
| Complete audit | `complete audit of my AEMaaCS project` |
| Full audit + format | `full audit my AEM project --format all` |

**Output Formats:**

| Format | Flag | Description |
|--------|------|-------------|
| Excel (default) | `--format excel` | `.xlsx` with up to 16 sheets (Executive Summary + up to 15 category sheets, one per category with findings) |
| Markdown | `--format md` | `.md` with severity tables, tech stack, action plan |
| PDF | `--format pdf` | Styled `.pdf` with category breakdowns & recommendations |
| All three | `--format all` | Generates `.xlsx` + `.md` + `.pdf` in one run |

> The multi-sheet workbook above (up to 16 sheets) is the AEM engine's platform-specific report. Alongside it, **every** run also writes the standardized `audit-<branch>-<timestamp>-agent-report.xlsx` (Run Info · Summary · Severity Breakdown · By Category) plus a Markdown twin, and appends `CHANGE-LOG.md`. (AEM, Commerce, EDS, and EDS+Commerce are legacy engines, so they emit both the platform report **and** the standardized report.)

**AEM Scan Categories (15):**

| # | Category | What it checks |
|---|----------|----------------|
| 1 | Performance | Oak query traversals, Sling Model caching, bundle sizes |
| 2 | Code Quality | God classes, empty catches, dead code, naming |
| 3 | Security | XSS, path traversal, admin sessions, CSRF |
| 4 | SEO | Meta tags, structured data, canonical URLs |
| 5 | Accessibility | ARIA, alt text, color contrast, keyboard nav |
| 6 | Architecture | Circular deps, layer violations, coupling |
| 7 | Sling & OSGi | Resource resolver leaks, service refs, configs |
| 8 | Cloud Readiness | Mutable content, runmodes, Cloud SDK compat |
| 9 | Dispatcher | Cache rules, filters, rewrites, headers |
| 10 | HTL & Frontend | data-sly usage, clientlib patterns, inline JS |
| 11 | Test Coverage | Missing unit tests, integration test gaps |
| 12 | Maintainability | Complexity, duplication, documentation |
| 13 | Frontend Framework | SPA detection (React/Angular/Vue), bundle analysis |
| 14 | AMS Specific | Replication agents, workflow launchers, legacy APIs |
| 15 | Dependencies & Versions | Java/AEM/Node.js versions, EOL libraries, outdated deps |

**Post-audit:**

| Action | Prompt |
|--------|--------|
| Summary | `summarize the AEM audit findings` |
| Filter severity | `show all CRITICAL findings from the AEM audit` |
| Top risks | `what are the top 10 highest-risk AEM findings?` |
| Security focus | `show all security findings` |
| Performance focus | `show all performance findings` |
| Fix plan | `create a fix plan for the critical AEM issues` |
| Effort estimate | `estimate effort to fix all HIGH and CRITICAL findings` |
| Export as MD | `generate the report in markdown format` |
| Export as PDF | `generate the report as PDF` |
| Export all formats | `generate reports in all formats` |

### Adobe Commerce SaaS ✅

Catalog Service / Live Search / storefront drop-ins (JS tree-sitter AST + config).

| Action | Prompt |
|--------|--------|
| Quick scan | `scan my Commerce SaaS storefront` |
| Deep audit | `deep audit my Commerce SaaS project` |
| Explicit engine | `scan --engine commerce-saas --path /path/to/project` |

### Sling / Shaft (sling-12) ✅

Apache Sling / Felix / Oak middleware (pure Java tree-sitter AST).

| Action | Prompt |
|--------|--------|
| Quick scan | `scan my Sling project` / `scan my Shaft project` |
| Deep audit | `deep audit my sling-12 middleware` |
| Full audit | `full audit my Sling project` |
| Explicit engine | `scan --engine sling --path /path/to/project` |

### Spring Boot ✅

Spring Boot custom middleware (Java tree-sitter AST + config parse).

| Action | Prompt |
|--------|--------|
| Quick scan | `scan my Spring Boot project` |
| Deep audit | `deep audit my Spring Boot service` |
| Full audit | `full audit my Spring Boot app` |
| Explicit engine | `scan --engine spring --path /path/to/project` |

### Adobe App Builder ✅

I/O Runtime actions, API Mesh, eventing, UI extensibility (JS tree-sitter AST + config).

| Action | Prompt |
|--------|--------|
| Quick scan | `scan my App Builder project` |
| Deep audit | `deep audit my App Builder actions` |
| Explicit engine | `scan --engine app-builder --path /path/to/project` |

### EDS ✅

Edge Delivery Services (legacy regex scanner + JS AST pass).

| Action | Prompt |
|--------|--------|
| Quick scan | `scan my EDS site` |
| Deep audit | `deep audit this EDS project` |
| Full audit | `full audit my EDS project` |

### EDS + Commerce ✅

EDS + Commerce hybrid storefront (legacy regex scanner + EDS JS AST pass).

| Action | Prompt |
|--------|--------|
| Scan | `scan my EDS Commerce project` |
| Full audit | `full audit my EDS+Commerce site` |

> **List engines:** `what engines are available?` prints all 8 registered engines (`aem`, `commerce`, `commerce-saas`, `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`). With no `--engine`, the stack is auto-detected.

---

## 2. Code Generation Agent (`bmad-dept-code-generation-agent`)

Two paths: deterministic **scaffolders** (correct-by-construction, zero tokens) and an **LLM/MCP** path for custom logic. `list scaffolder types` prints every deterministic scaffolder per stack; `set up MCP for this project` provisions the AEM MCP servers (`.mcp.json`, `.bmad/mcp-registry.toml`, `.env`).

### AEMaaCS ✅ (MCP-powered)

| Action | Prompt |
|--------|--------|
| Component | `create a new AEM component called Hero Banner` |
| Proxy component | `create proxy of CIF Core component - Product Recommendation` |
| Sling Model | `generate a Sling Model for the Article component` |
| HTL template | `scaffold HTL template for the Card component` |
| OSGi service | `create an OSGi service for email notification` |
| OSGi config | `generate OSGi configuration for the SMTP service` |
| Content Fragment Model | `generate CF model for articles with title, body, author, date` |
| Experience Fragment | `create Experience Fragment template for global header` |
| Editable Template | `create an editable template for landing pages` |
| Dispatcher config | `generate Dispatcher config for my AEMaaCS project` |
| Cloud Manager pipeline | `create Cloud Manager pipeline configuration` |
| Unit tests | `generate unit tests for my Sling Model` |
| Workflow | `create an AEM workflow for content approval` |
| Servlet | `generate a Sling Servlet that returns JSON for product data` |
| Scheduler | `create a scheduled task that runs daily to clean temp nodes` |
| Deploy local | `create proxy of Teaser and deploy it on local` |
| Deploy cloud | `generate Hero Banner and deploy to cloud dev` |
| Scaffold only | `just scaffold the component, don't deploy` |

### AEM AMS ✅ (LLM skills path)

| Action | Prompt |
|--------|--------|
| Component | `create an AEM component for our AMS project` |
| Sling Model | `generate a Sling Model for the Navigation component` |
| OSGi service | `create an OSGi service for cache invalidation` |
| Dispatcher config | `generate Dispatcher config for AMS` |
| Unit tests | `generate unit tests for the SearchService` |
| Deploy local | `build and deploy to local AEM instance` |
| Deploy AMS | `deploy to AMS dev environment` |

### Adobe Commerce (PaaS) ✅

Deterministic scaffolders cover module, plugin, observer, GraphQL resolver, and controller; the LLM path covers the richer scopes below.

| Action | Prompt |
|--------|--------|
| Module scaffold | `create a new Commerce module Acme_CustomShipping` |
| Plugin | `create an after plugin on Magento\Catalog\Model\Product::getName` |
| Observer | `create an observer for checkout_submit_all_after event` |
| REST API | `create a REST API endpoint for custom entity CRUD` |
| GraphQL | `add a GraphQL resolver for querying custom entity by ID` |
| Admin grid | `generate admin UI grid listing for my custom entity` |
| Admin form | `create admin edit form for the custom entity` |
| Storefront block | `create a frontend block with ViewModel for product badges` |
| CLI command | `generate a console command to sync inventory` |
| Cron job | `create a cron job that runs every 15 minutes to clean expired quotes` |
| Message queue | `scaffold a message queue consumer for order export` |
| DB schema | `create db_schema.xml for a custom entity table` |
| EAV attribute | `add a custom product attribute 'delivery_estimate'` |
| Repository | `generate full CRUD repository for my custom entity` |
| Config | `add admin system configuration for API credentials` |
| Unit tests | `generate unit tests for the OrderExportService` |
| Deploy | `enable the module and run setup:upgrade` |

### Adobe Commerce SaaS ✅

Scaffolders: `catalog-query`, `storefront-block`.

| Action | Prompt |
|--------|--------|
| Catalog query | `create a Catalog Service query for product search` |
| Storefront block | `scaffold a storefront drop-in block for product cards` |

### Sling / Shaft ✅

Scaffolders: `osgi-service`, `sling-servlet`, `sling-filter`, `sling-model` (default package `com.acme.shaft`).

| Action | Prompt |
|--------|--------|
| OSGi service | `create a Sling OSGi service called OrderSync` |
| Sling servlet | `generate a Sling servlet for order status` |
| Sling filter | `create a Sling filter for request logging` |
| Sling Model | `generate a Sling Model for the Order resource` |

### Spring Boot ✅

Scaffolders: `rest-controller`, `service`, `jpa-repository` (default package `com.acme.app`).

| Action | Prompt |
|--------|--------|
| REST controller | `create a Spring REST controller for Orders` |
| Service | `generate a Spring service class for order processing` |
| JPA repository | `create a JPA repository for the Order entity` |

### Adobe App Builder ✅

Scaffolders: `action`, `mesh`, `event-handler`.

| Action | Prompt |
|--------|--------|
| Runtime action | `create an App Builder action called order-sync` |
| API Mesh | `scaffold an API Mesh configuration` |
| Event handler | `generate an event handler for commerce events` |

### EDS ✅

Scaffolder: `block`.

| Action | Prompt |
|--------|--------|
| Block | `create an EDS block called cards` |

### EDS + Commerce ✅

Scaffolder: `dropin-block`.

| Action | Prompt |
|--------|--------|
| Drop-in block | `create an EDS commerce drop-in block for product details` |

---

## 3. Impact Analysis Agent (`bmad-dept-code-impact-analysis-agent`)

### All Stacks ✅ (input-driven)

The impact agent is **input-driven**, not scanner-driven. Give it a Proofhub bug/task export (`--bugs`, CSV) and/or a BRD document (`--brd`; `.docx`, `.md`, or `.txt` — export Google Docs to one of these first). **At least one input is required.** It normalizes each bug/requirement, maps it onto impacted source files, computes a reverse-dependency **blast radius**, scores risk, and emits an **Input Traceability** report. Every input item appears in the output — items with no code match still produce an INFO "needs manual review" row. The stack is auto-detected (or force it with `--engine`).

| Action | Prompt |
|--------|--------|
| Impact from bugs | `trace the impact of these bugs: /path/to/bugs.csv` |
| Impact from BRD | `analyze the impact of this BRD: /path/to/requirements.docx` |
| Combined (bugs + BRD) | `trace impact from bugs /path/bugs.csv and BRD /path/spec.docx` |
| Named stack | `run impact analysis on my Spring Boot project using /path/bugs.csv` |
| Blast radius (intent phrase) | `what's the blast radius of the bugs in /path/bugs.csv?` |
| Upgrade risk (intent phrase) | `assess upgrade risk from the requirements in /path/spec.docx` |

> "Blast radius" and "upgrade risk" are natural-language intent phrases only — they still route through the single tracer and **require** a bug export or BRD. There is no standalone `--trace` or `--upgrade-risk` flag.

**Post-analysis:**

| Action | Prompt |
|--------|--------|
| Summary | `summarize the impacted files` |
| Filter severity | `show only the CRITICAL and HIGH impacted files` |
| Unmatched inputs | `which inputs had no code match?` |
| Traceability | `show the input-to-code traceability` |

---

## 4. Test Coverage Agent (`bmad-dept-code-test-coverage-agent`)

### All Stacks ✅

Tier 1 does deterministic gap analysis and can report **real** line/branch coverage by parsing JaCoCo, Istanbul, LCOV, or Clover reports — either an existing report (`--coverage-report`) or one produced on demand (`--run-coverage`, which shells out to Maven/Gradle JaCoCo, Jest/nyc, or PHPUnit). Tier 2 test generation is written by the LLM per the stack pack (not by the CLI). The stack is auto-detected (or `--engine`).

**Coverage Analysis (Tier 1):**

| Action | Prompt |
|--------|--------|
| Analyze coverage | `analyze test coverage` |
| Show gaps | `show untested code` |
| Module scope | `analyze test coverage for the Checkout module` |
| File scope | `what's the test coverage for src/Model/OrderProcessor.php` |
| Real coverage (run tool) | `run the coverage tool and report real line/branch coverage` |
| Real coverage (existing report) | `analyze coverage from my JaCoCo report at target/site/jacoco/jacoco.xml` |
| Test plan | `create test plan` |
| Priority gaps | `show highest-priority untested code` |

**Test Generation (Tier 2 — LLM):**

| Action | Prompt |
|--------|--------|
| Generate for module | `generate tests for the Checkout module` |
| Generate for file | `generate unit tests for src/Model/OrderProcessor.php` |
| Generate integration | `generate integration tests for the Payment API` |
| Generate for class | `create unit tests for the CartService class` |
| Specific framework | `generate PHPUnit tests for the OrderExport service` |
| Specific framework | `generate JUnit tests for the ArticleModel` |
| Specific framework | `generate Jest tests for the hero block` |

**Full (Tier 1 + Tier 2):**

| Action | Prompt |
|--------|--------|
| Full coverage | `full test coverage` |
| Full for module | `full test coverage for the Payment module` |
| Targeted fill | `find and fill test gaps in the Catalog module` |

**Post-analysis:**

| Action | Prompt |
|--------|--------|
| Coverage report | `show the test coverage report` |
| Progress | `how much test coverage did we gain?` |

---

## CLI-Backed Prompts (Commerce Audit Engine)

These prompts trigger the Commerce TypeScript scanner under the hood. The agent auto-resolves project path, engine, and flags — **you never need to type CLI commands**.

### Basic Scans

| Prompt | What It Does |
|--------|-------------|
| `scan my project` | Auto-detect platform, run full code audit |
| `scan my project and name it "Acme"` | Audit with named report title |
| `scan only the Checkout and Payment modules` | Filtered audit (specific modules only) |
| `scan only the Custom namespace` | Filtered audit (specific namespace) |

### With Data Inputs

| Prompt | What It Does |
|--------|-------------|
| `scan my project with DB dump at /path/to/dump.sql` | Code + database schema analysis |
| `scan with BRD impact analysis using /path/to/requirements.docx` | Code + BRD requirement mapping |
| `scan with bug report from /path/to/bugs.xlsx` | Code + bug cascade/severity analysis |
| `run full scanner with DB at /db.sql, BRD at /brd.docx, bugs at /bugs.xlsx` | All analysis layers combined |

### Targeted / Partial

| Prompt | What It Does |
|--------|-------------|
| `just run BRD analysis from /spec.docx, skip the code scan` | BRD-only (no code audit) |
| `analyze patch upgrade impact from 2.4.7-p7 to 2.4.7-p9` | Patch breaking-change analysis |
| `export scan results as JSON` | Machine-readable output (for CI pipelines) |

### Compound (multiple inputs in one prompt)

| Prompt | What It Does |
|--------|-------------|
| `full audit named "Client X" with DB at /db.sql and BRD at /spec.docx` | Named audit + DB + BRD |
| `scan Checkout module, include bugs from /bugs.xlsx, output JSON` | Module filter + bugs + JSON |
| `audit Payment namespace with database from /prod.sql` | Namespace filter + DB |

### When Agent Asks for Clarification

| If you say... | Agent will ask... |
|---------------|-------------------|
| "scan with database" (no path) | "Path to your DB dump file (.sql)?" |
| "run BRD analysis" (no path) | "Path to your BRD document?" |
| "scan with bugs" (no path) | "Path to your bug report (.xlsx)?" |
| "audit this" (ambiguous mode) | "Which mode? Scan Only / Deep Audit / Full?" |

### Utility

| Prompt | What It Does |
|--------|-------------|
| `what engines are available?` | Lists all 8 registered audit engines |
| `show current audit config` | Displays active configuration |

---

## Platform × Agent Support Matrix

| Platform / Stack | Code Audit | Code Generation | Impact Analysis | Test Coverage |
|------------------|:----------:|:---------------:|:---------------:|:-------------:|
| **Adobe Commerce (PaaS)** | ✅ | ✅ (scaffolders + LLM) | ✅ | ✅ |
| **Adobe Commerce SaaS** | ✅ | ✅ (scaffolders) | ✅ | ✅ |
| **AEMaaCS** † | ✅ | ✅ (MCP) | ✅ | ✅ |
| **AEM AMS** † | ✅ | ✅ (LLM) | ✅ | ✅ |
| **Sling / Shaft (sling-12)** | ✅ | ✅ (scaffolders) | ✅ | ✅ |
| **Spring Boot** | ✅ | ✅ (scaffolders) | ✅ | ✅ |
| **Adobe App Builder** | ✅ | ✅ (scaffolders) | ✅ | ✅ |
| **EDS** | ✅ | ✅ (scaffolders) | ✅ | ✅ |
| **EDS + Commerce** | ✅ | ✅ (scaffolders) | ✅ | ✅ |

> † AEMaaCS and AEM AMS are both served by the single `aem` engine (platform auto-resolved to `aemcs`/`aemams`/`both`).
>
> The standalone *scan-agent* column has been removed: deterministic scanning is the Code Audit agent's **Scan Only** action.
