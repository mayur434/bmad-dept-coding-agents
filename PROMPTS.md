# BMAD DCA Prompt Catalog

Copy-paste prompt catalog for the **BMAD DEPT Code Agent** suite — 5 agents × 8 stacks, plus workflow, follow-up, troubleshooting, and Enterprise-Architect prompts.

**How to read this file.** Every code block below is a ready-to-paste message for the agent chat. Send the whole block or a single line — the agent parses natural language and resolves flags, paths, and engine automatically. Blocks are grouped so related prompts live together (single-line-per-fence is intentionally avoided so you can scan and pick).

---

## Suite at a Glance

**5 agents:**

| Agent | Skill code | What it does |
|-------|------------|--------------|
| Auditor | `bmad-dept-code-audit-agent` | Tier 1 tree-sitter scanner + Tier 2 LLM deep audit; 15-category standardized Excel + Markdown + CHANGE-LOG |
| Sonar Scanner | `bmad-dept-code-sonar-scan-agent` | LLM SonarQube-style scan → `sonar-findings.json` → deterministic ingest → standardized Excel with Vulnerabilities sheet + Quality Gate (A–E) |
| Generator | `bmad-dept-code-generation-agent` | 24 deterministic scaffolders + LLM/MCP path for complex generation |
| Impact Analyst | `bmad-dept-code-impact-analysis-agent` | Proofhub CSV and/or BRD (.docx/.md/.txt) → impacted files + blast-radius + risk score |
| Test Coverage | `bmad-dept-code-test-coverage-agent` | Tier 1 gap analysis + real coverage (JaCoCo/Istanbul/Clover/LCOV); Tier 2 LLM test generation to 100% |

**8 stacks:** `aem` (AEMaaCS + AMS), `commerce` / `commerce-paas`, `commerce-saas`, `sling` (sling-12 / Shaft), `spring`, `app-builder`, `eds`, `eds-commerce`.

Every run emits a standardized `<agent>-<branch>-<timestamp>-agent-report.xlsx` (Run Info · Summary · Severity Breakdown · By Category) plus a Markdown twin and a `CHANGE-LOG.md` append. Add `--create-branch` to also cut a `dca/<agent>-<stack>-<timestamp>` working branch (from `production` / `main` / `master` / `develop` — override with `--source-branch <name>`).

---

## Quick-Start Prompts

First-time users — paste any of these:

```text
audit my project
scan my project
full audit my project and name it "Acme"
deep audit my project
sonar scan my project
sonar scan my project and cut a branch
generate a Sling Model for the Article component
list scaffolder types
analyze test coverage
full test coverage for the Payment module
trace the impact of these bugs: ./bugs.csv
analyze the impact of this BRD: ./requirements.docx
what engines are available?
list rule packs
which agent should I use for Adobe Commerce SaaS?
```

---

## Cross-Cutting Flags

One prompt per flag — use these as templates for any agent:

```text
scan --engine aem --path /path/to/project
scan --engine spring --path .
scan --engine commerce-saas --path ./storefront
```

```text
full audit my project --create-branch
full audit my project --create-branch --source-branch production
sonar scan my Spring service on a new branch from main
generate a Commerce module Acme_Foo and cut a branch from develop
```

```text
audit my project --preflight
audit my project --no-preflight
sonar scan and skip the preflight step
```

```text
analyze test coverage --coverage-report target/site/jacoco/jacoco.xml
analyze test coverage --coverage-report coverage/coverage-final.json
analyze test coverage --coverage-report clover.xml
analyze test coverage --coverage-report lcov.info
```

```text
analyze test coverage --run-coverage
full test coverage --run-coverage --engine spring
run the coverage tool then report real line/branch %
```

```text
scan my Commerce project --db /path/to/dump.sql
full audit with DB dump at /var/backup/prod.sql
```

```text
generate a Sling Model for OrderResource --dry-run
generate a Commerce module Acme_Foo --force
generate an AEM component Hero --setup
list scaffolder types
list scaffolder templates for the AEM engine
list all engines
```

```text
sonar scan my project --format all
audit my AEM project --format excel
audit my AEM project --format md
audit my AEM project --format pdf
```

```text
trace impact --bugs ./proofhub-export.csv --path .
analyze impact --brd ./BRD.docx --engine spring
combined impact --bugs ./bugs.csv --brd ./BRD.docx
```

```text
scan my AEM Cloud Service project --platform aemcs
scan my AEM AMS project --platform aemams
scan my AEM project --platform both
```

```text
sonar scan my project (Step 1 — writes sonar-findings.json)
ingest sonar findings from ./sonar-reports/sonar-findings.json (Step 2)
ingest ./sonar-findings.json --create-branch
```

---

## 1. Code Audit Agent

Tier 1 = deterministic tree-sitter AST + regex (zero tokens). Tier 2 = LLM semantic analysis driven by per-stack rule packs. `scan` = Tier 1 only, `deep audit` = Tier 2 only, `full audit` = both.

### 1.1 AEM (AEMaaCS + AMS)

```text
scan my AEM project
scan my AEM project and name it "Client Name"
scan my AEM project at /Users/me/code/aem-project
scan --engine aem --path /path/to/project
scan my AEM Cloud Service project
scan my AEM AMS project
scan my AEM project --platform both
scan my AEM project --format all
```

```text
deep audit my AEM project
deep audit my AEM project and name it "Wipro"
run LLM analysis on my AEM codebase
full audit my AEM project
full audit my AEMaaCS project --format all
complete audit of my AEMaaCS project --create-branch
```

```text
audit only the core bundle at ui.apps/core
audit only /apps/mysite/components
scan the dispatcher config at dispatcher/src
focus on Sling Model caching and Oak query traversals
focus on HTL security (data-sly-use, XSS) and clientlib patterns
focus on cloud-readiness (mutable content, runmodes, Cloud SDK compat)
```

```text
summarize the AEM audit findings
show all CRITICAL findings from the AEM audit
what are the top 10 highest-risk AEM findings?
show all security findings
show all performance findings
show all cloud-readiness findings for AMS→AEMaaCS migration
create a fix plan for the critical AEM issues
estimate effort to fix all HIGH and CRITICAL findings
generate the report as PDF
```

### 1.2 Adobe Commerce (PaaS)

```text
scan my project
scan my project and name it "Acme"
scan only the Checkout and Payment modules
scan only the Custom namespace
scan --engine commerce --path /path/to/magento
scan --engine commerce-paas --path .
```

```text
scan my project with DB dump at /path/to/dump.sql
scan with BRD impact analysis using /path/to/requirements.docx
scan with bug report from /path/to/bugs.xlsx
analyze patch upgrade impact from 2.4.7-p7 to 2.4.7-p9
run full scanner: code + DB + BRD + patch analysis
```

```text
deep audit my project
full audit my project
run full audit named "X" with DB at /path.sql, BRD at /path.docx, bugs at /path.xlsx, patch 2.4.7-p7 to 2.4.7-p9
full audit --engine commerce-paas --create-branch --source-branch production
```

```text
summarize the audit findings
show me all CRITICAL severity items
what are the top 10 highest-risk findings?
which modules have the most issues?
create a fix plan for the critical items
estimate effort to fix all HIGH and CRITICAL findings
export findings as JSON
update thresholds: god_class_lines=600, fat_constructor_deps=12
```

### 1.3 Adobe Commerce SaaS

```text
scan my Commerce SaaS storefront
scan --engine commerce-saas --path ./storefront
scan only the drop-ins at src/dropins
scan Live Search integration and Catalog Service queries
deep audit my Commerce SaaS project
full audit my Commerce SaaS storefront
```

```text
focus on drop-in accessibility and Core Web Vitals
audit our GraphQL query shape for Catalog Service
which pages break under Live Search failures?
```

### 1.4 Sling / Shaft (sling-12)

```text
scan my Sling project
scan my Shaft project
scan --engine sling --path /path/to/shaft
deep audit my sling-12 middleware
full audit my Sling project
full audit my Shaft middleware --create-branch
```

```text
focus on Sling filter chain ordering and priority
focus on resource resolver leaks and admin session use
focus on OSGi service ranking, DS component lifecycle
focus on Oak query indexes and JCR traversals
audit only src/main/java/com/company/shaft/filters
```

### 1.5 Spring Boot

```text
scan my Spring Boot project
scan --engine spring --path .
deep audit my Spring Boot service
full audit my Spring Boot app
full audit my Spring app --create-branch --source-branch main
```

```text
focus on Spring Security (auth, CSRF, method security)
focus on JPA N+1 queries and lazy-loading traps
focus on actuator exposure and management endpoints
focus on @Async / thread-pool configuration
audit only the controllers under src/main/java/com/acme/api
audit only the persistence layer
```

### 1.6 Adobe App Builder

```text
scan my App Builder project
scan --engine app-builder --path ./actions
deep audit my App Builder actions
full audit my App Builder app
focus on IO Runtime action timeouts and cold starts
focus on API Mesh resolver perf and rate limits
focus on event registration and adobe-io-events best practices
audit only actions/checkout
```

### 1.7 EDS

```text
scan my EDS site
scan --engine eds --path ./
deep audit this EDS project
full audit my EDS project
focus on Core Web Vitals (LCP, CLS, INP) and lazy-loading
focus on block hydration and script placement
audit only blocks/hero and blocks/cards
```

### 1.8 EDS + Commerce

```text
scan my EDS Commerce project
scan --engine eds-commerce --path .
full audit my EDS+Commerce site
focus on drop-in overlay integration and pdp/plp hydration
focus on Catalog Service query fan-out from EDS
audit only blocks/product-details
```

---

## 2. Sonar Scan Agent

Two-step workflow. **Step 1** — LLM scan produces `sonar-findings.json`. **Step 2** — deterministic ingest computes ratings (Reliability / Security / Maintainability = A–E), evaluates Quality Gate (PASS = all three A; any non-A = FAIL), emits the standardized `.xlsx` + Vulnerabilities sheet + Markdown twin + `CHANGE-LOG.md`.

### 2.1 AEM

```text
sonar scan my AEM project
sonar scan my AEMaaCS project
sonar scan my AEM AMS code
sonar scan --engine aem --path /path/to/aem-project
sonar scan my AEM project focused on security vulnerabilities
sonar scan my AEM project with quality gate strict mode
sonar scan my AEM project and cut a branch from production
```

```text
ingest sonar findings from ./sonar-reports/sonar-findings.json
ingest sonar findings and create a new branch
ingest ./sonar-findings.json --engine aem --path .
```

### 2.2 Adobe Commerce PaaS

```text
sonar scan my Commerce project
sonar scan Magento
sonar scan --engine commerce-paas --path .
Magento quality gate — strict mode
sonar scan my PHP Commerce project focused on SQL injection and XSS
sonar scan Commerce PaaS on a new branch from staging
```

### 2.3 Adobe Commerce SaaS

```text
sonar scan my Commerce SaaS storefront
sonar scan my drop-ins
Live Search quality check
sonar scan --engine commerce-saas --path ./storefront
sonar scan the storefront JS focused on XSS and prototype pollution
```

### 2.4 Sling / Shaft

```text
sonar scan my Sling project
Shaft sonar scan
sling-12 quality scan
scan Shaft middleware
sonar scan --engine sling --path /path/to/shaft
sonar scan my Sling code focused on resource resolver leaks and admin sessions
```

### 2.5 Spring Boot

```text
sonar scan my Spring project
Spring Boot sonar
scan my Spring service
sonar scan --engine spring --path .
sonar scan my Spring service focused on Spring Security misuse
sonar scan Spring Boot with quality gate strict mode
```

### 2.6 Adobe App Builder

```text
sonar scan App Builder
IO Runtime quality scan
scan my aio project
check my App Builder app
sonar scan --engine app-builder --path .
sonar scan my App Builder actions focused on secrets and cold-start regressions
```

### 2.7 EDS

```text
sonar scan EDS
Franklin quality gate
scan my helix blocks
sonar scan --engine eds --path .
sonar scan my EDS site focused on prototype pollution and CSP violations
```

### 2.8 EDS + Commerce

```text
sonar scan EDS+Commerce
EDS commerce overlay scan
scan my EDS drop-in project
sonar scan --engine eds-commerce --path .
sonar scan my EDS+Commerce site focused on drop-in tenancy and CSP
```

### 2.9 Sonar follow-ups (any stack)

```text
explain this vulnerability: <ruleId or finding number>
produce a remediation plan for the top 10 vulnerabilities
generate a Reliability / Security / Maintainability trend line
list every Security Hotspot with a concrete recommended fix
show only the Blocker + Critical findings
which finding drove the Quality Gate to FAIL?
map every Vulnerability to CWE and OWASP Top 10
export the Vulnerabilities sheet as CSV
```

---

## 3. Code Generation Agent

Two paths: deterministic **scaffolders** (correct-by-construction, zero tokens) and an **LLM / MCP** path for custom logic. `list scaffolder types` prints every deterministic scaffolder per stack.

### 3.1 AEM (5 scaffolders: sling-model · osgi-service · sling-servlet · component · workflow-process)

```text
generate a Sling Model for the Article component
generate a Sling Model for the Navigation component in package com.acme.core.models
create an OSGi service for email notification
create an OSGi service for cache invalidation
generate a Sling Servlet that returns JSON for product data
create a Sling Servlet bound to path /bin/mysite/status
create a new AEM component called Hero Banner
create an AEM component for our AMS project
generate an AEM workflow-process for content approval
create a workflow process step that validates images
```

```text
create a new AEM component called Hero Banner --dry-run
generate a Sling Model for Article --force
generate an AEM component Hero --setup
```

```text
create an AEM component and deploy to local
create proxy of Teaser and deploy it on local
generate Hero Banner and deploy to cloud dev
just scaffold the component, don't deploy
create proxy of CIF Core component - Product Recommendation
```

```text
create a Content Fragment Model for articles: title, body, author, date
create an Experience Fragment template for global header
create an editable template for landing pages
generate Dispatcher config for my AEMaaCS project
create a Cloud Manager pipeline configuration
scaffold HTL template for the Card component
create a scheduled task that runs daily to clean temp nodes
generate OSGi configuration for the SMTP service
```

### 3.2 Sling / Shaft (4 scaffolders: osgi-service · sling-servlet · sling-filter · sling-model)

```text
create a Sling OSGi service called OrderSync
generate a Sling servlet for order status at /bin/orders/status
create a Sling filter for request logging (priority -700)
generate a Sling Model for the Order resource
scaffold a Sling filter that adds CORS headers on the /api path
create a Sling servlet returning JSON for /bin/shaft/health
```

### 3.3 Spring Boot (3 scaffolders: rest-controller · service · jpa-repository)

```text
create a Spring REST controller for Orders
create a REST controller under /api/v1/orders with GET/POST/PUT/DELETE
generate a Spring service class for order processing
create a Spring service OrderProcessor with @Transactional
create a JPA repository for the Order entity
generate a JPA repository with a custom @Query for pending orders
generate a REST controller, service, and JPA repo for the Product entity in one shot
```

### 3.4 Adobe Commerce PaaS (5 scaffolders: module · plugin · observer · graphql-resolver · controller)

```text
create a new Commerce module Acme_CustomShipping
create an after plugin on Magento\Catalog\Model\Product::getName
create a before plugin on Magento\Sales\Model\Order::place
create an around plugin on Magento\Quote\Model\Quote::collectTotals
create an observer for checkout_submit_all_after event
create an observer for sales_order_place_after in the frontend area
add a GraphQL resolver for querying custom entity by ID
create a storefront controller at /acme/custom/index
create an admin controller at /admin/acme/entity/edit
```

```text
create a new Commerce module Acme_Foo --dry-run
create a Commerce plugin --force
```

```text
create a REST API endpoint for custom entity CRUD
generate admin UI grid listing for my custom entity
create admin edit form for the custom entity
create a frontend block with ViewModel for product badges
generate a console command to sync inventory
create a cron job that runs every 15 minutes to clean expired quotes
scaffold a message queue consumer for order export
create db_schema.xml for a custom entity table
add a custom product attribute 'delivery_estimate'
generate full CRUD repository for my custom entity
add admin system configuration for API credentials
enable the module and run setup:upgrade
```

### 3.5 Adobe Commerce SaaS (2 scaffolders: catalog-query · storefront-block)

```text
create a Catalog Service query for product search
create a Catalog Service query for products by category with filters
scaffold a storefront drop-in block for product cards
scaffold a storefront block for the PDP price tile
```

### 3.6 Adobe App Builder (3 scaffolders: action · mesh · event-handler)

```text
create an App Builder action called order-sync
create an App Builder action called invoice-webhook with sequences
scaffold an API Mesh configuration
scaffold an API Mesh handler that stitches Commerce + CRM
generate an event handler for commerce events
generate an event handler for observer commerce.order.created
```

### 3.7 EDS (1 scaffolder: block)

```text
create an EDS block called cards
create an EDS block called hero with lazy-load styles
scaffold an EDS block called quotes with a decorate() function
```

### 3.8 EDS + Commerce (1 scaffolder: dropin-block)

```text
create an EDS commerce drop-in block for product details
create a drop-in block called cart-preview
scaffold a drop-in block wired to the Commerce Cart API
```

### 3.9 Generator — meta

```text
list scaffolder types
list scaffolder templates
list scaffolder types for the AEM engine
list scaffolder types for Commerce PaaS
list all engines
set up MCP for this project
provision the AEM MCP servers (.mcp.json, .bmad/mcp-registry.toml, .env)
scaffold in dry-run mode so I can review before writing
force overwrite existing files if they conflict
```

---

## 4. Impact Analysis Agent

**Input-driven** (not scanner-driven). Give it a Proofhub bug/task export (`--bugs`, CSV) and/or a BRD document (`--brd`; `.docx`, `.md`, or `.txt`). At least one input is required. Emits Input Traceability — every input item appears in the output; items with no code match show an INFO "needs manual review" row.

### 4.1 Proofhub CSV — all stacks

```text
trace the impact of these bugs: /path/to/bugs.csv
analyze impact of this bug export at ./proofhub-export.csv
what does fixing these bugs affect?
blast radius of the bugs in /path/bugs.csv
analyze impact --bugs ./proofhub-export.csv --path .
```

```text
trace impact of a single bug ID PH-1234 from ./bugs.csv
filter the bug export to CRITICAL and HIGH only, then trace impact
trace impact of bugs affecting the Checkout module only
per-module blast radius of the attached Proofhub export
```

### 4.2 BRD document — all stacks

```text
analyze the impact of this BRD: /path/to/requirements.docx
analyze impact --brd ./BRD.docx --engine spring --path .
what does building this BRD affect?
assess upgrade risk from the requirements in /path/spec.docx
analyze the impact of BRD.md (markdown fallback)
analyze the impact of spec.txt (plain-text fallback)
```

### 4.3 Combined (bugs + BRD)

```text
trace impact from bugs /path/bugs.csv and BRD /path/spec.docx
combined impact analysis of ./bugs.csv and ./requirements.docx
run impact analysis on my Spring Boot project using ./bugs.csv and ./BRD.docx
```

### 4.4 Per-stack invocation

```text
run impact analysis on my AEM project using ./bugs.csv
run impact analysis on my Commerce project using ./bugs.csv
run impact analysis on my Commerce SaaS storefront using ./BRD.docx
run impact analysis on my Sling/Shaft project using ./bugs.csv
run impact analysis on my Spring Boot service using ./BRD.docx
run impact analysis on my App Builder project using ./bugs.csv
run impact analysis on my EDS site using ./BRD.docx
run impact analysis on my EDS+Commerce project using ./bugs.csv and ./BRD.docx
```

### 4.5 Blast-radius / risk-score follow-ups

```text
summarize the impacted files
show only the CRITICAL and HIGH impacted files
which inputs had no code match?
show the input-to-code traceability
what's the reverse-dependency graph for src/Model/OrderProcessor.php?
which bugs cluster around the same files?
explain the risk score for the top 5 impacted files
which modules should we regress-test based on this impact set?
```

---

## 5. Test Coverage Agent

Tier 1 = deterministic gap analysis + real coverage (JaCoCo / Istanbul / LCOV / Clover). Tier 2 = LLM test generation to 100%.

### 5.1 Gap analysis only (all stacks)

```text
analyze test coverage
show untested code
show highest-priority untested code
what's the test coverage for src/Model/OrderProcessor.php
analyze test coverage for the Checkout module
create test plan
```

### 5.2 Real coverage — existing report

```text
analyze coverage from my JaCoCo report at target/site/jacoco/jacoco.xml
analyze coverage --coverage-report target/site/jacoco/jacoco.xml
analyze coverage --coverage-report coverage/coverage-final.json
analyze coverage --coverage-report clover.xml
analyze coverage --coverage-report lcov.info
analyze test coverage from the Istanbul JSON at ./coverage/coverage-final.json
```

### 5.3 Real coverage — run the tool (`--run-coverage`)

```text
run the coverage tool and report real line/branch coverage
analyze test coverage --run-coverage
analyze test coverage --run-coverage --engine spring
analyze test coverage --run-coverage --engine commerce-paas
analyze test coverage --run-coverage --engine eds
```

### 5.4 Test generation to 100% (per framework)

```text
generate tests for the Checkout module
generate unit tests for src/Model/OrderProcessor.php
generate integration tests for the Payment API
create unit tests for the CartService class
full test coverage
full test coverage for the Payment module
find and fill test gaps in the Catalog module
```

**AEM (JUnit 5 + AEM Mocks / Sling Mocks):**

```text
generate JUnit tests for the ArticleModel using AEM Mocks
write Sling Mocks tests for the resolver factory
generate unit tests for my Sling Model at 100% coverage
generate a JUnit 5 test class for HeroModel with WCMio context
```

**Sling / Shaft (JUnit 5 + Sling Mocks):**

```text
generate Sling Mocks tests for the OrderSyncService
write JUnit tests for the OrderStatusServlet
```

**Spring Boot (Spring Test / MockMvc / Testcontainers):**

```text
generate JUnit tests for the OrderService
generate MockMvc tests for OrdersController
generate Testcontainers-backed integration tests for the JPA repo
```

**Commerce PaaS (PHPUnit / MFTF):**

```text
write PHPUnit tests for the ShipmentPlugin
generate PHPUnit tests for the OrderExport service
generate MFTF tests for the checkout flow
generate integration tests for the custom REST endpoint
```

**App Builder / EDS / Commerce SaaS (Jest + jsdom):**

```text
generate Jest tests for the price-tile block
generate Jest tests for the hero block
generate Jest tests for the order-sync App Builder action
write jsdom-based tests for the storefront drop-in
```

### 5.5 Post-analysis

```text
show the test coverage report
how much test coverage did we gain?
compare pre and post coverage %
which files are still below the 80% branch threshold?
```

---

## 6. Multi-Agent Workflows (chained prompts)

Paste one block per workflow — the agent runs the steps in order.

**Audit → Sonar → Generate fixes:**

```text
audit my project, then sonar scan the same project, then generate deterministic fixes for the top 5 vulnerabilities
```

**Impact → Coverage → Generate tests:**

```text
impact-analyze this Proofhub export at ./bugs.csv, then run test coverage on the impacted files, then generate missing tests to close every gap
```

**Generate → Audit → Sonar:**

```text
generate an AEM component Hero Banner, then audit the delta, then sonar scan the delta and fail if the Quality Gate drops
```

**Upgrade diff:**

```text
run a full audit against branch production and save the baseline, then check out release/2.4.7-p9 and run the same audit, then diff the two reports and list the new HIGH+CRITICAL findings
```

**Coverage tightening loop:**

```text
run coverage gap analysis with --run-coverage, LLM-generate tests for every gap, re-run coverage, and report the delta
```

**BRD → Impact → Audit → Scaffold:**

```text
BRD-driven impact from ./BRD.docx, then audit the impacted modules, then scaffold the remediation stubs (interfaces + tests only)
```

**Vulnerability triage:**

```text
sonar scan my project, cluster vulnerabilities by ruleId, then produce a Jira-ready epic per cluster with one story per finding
```

**Adobe Commerce patch prep:**

```text
scan my Commerce project with patch analysis 2.4.7-p7 to 2.4.7-p9, then impact-analyze the resulting change set against ./proofhub-export.csv, then test-coverage the impacted files
```

**AEM cloud-readiness migration:**

```text
full audit my AEM AMS project --platform aemams, then sonar scan the same project, then generate a fix plan focused on AEMaaCS cloud-readiness gaps only
```

**Spring security hardening:**

```text
sonar scan my Spring Boot service focused on Spring Security, then generate JUnit + MockMvc tests that lock in the fixes
```

**Full pre-release gate:**

```text
run audit, sonar scan, test coverage, and impact analysis in that order on a new branch cut from production, then summarize as one release-readiness report
```

**Storefront drop-in refactor:**

```text
sonar scan my Commerce SaaS storefront focused on Core Web Vitals and drop-in tenancy, then scaffold replacement drop-in blocks for the three lowest-scoring pages
```

**EDS block audit + generate:**

```text
audit my EDS site focused on LCP/CLS/INP, then generate replacement blocks for the two worst-scoring blocks and add Jest tests for both
```

---

## 7. Follow-up Prompts (post-run)

Reuse these after any agent run:

```text
summarize CRITICAL findings
show me the top 10 highest-risk findings
create a fix plan for HIGH+CRITICAL
estimate effort in ideal-days
produce a stakeholder-ready email
generate an executive summary for leadership
output a Jira-ready ticket per finding
convert this report to a Confluence page
map findings to CWE
map findings to OWASP Top 10
produce a risk register CSV
export findings as JSON
open the report in Excel
show the report path
```

```text
what changed since the last run of this agent?
diff this report against the previous report
which findings are new vs carried over?
which findings did we resolve since last run?
group findings by module
group findings by owner (guess from git blame)
```

---

## 8. Troubleshooting Prompts

```text
why did preflight recommend LLM mode?
why did preflight recommend HYBRID mode?
why was this file skipped during the scan?
the tree-sitter WASM failed to load — how do I recover?
explain rule ID <RSPEC or DCA rule id>
the report came back empty — what should I check?
recover from a failed branch cut (dca/audit-... branch was never created)
the MCP server isn't connecting — walk me through the setup
the coverage tool timed out — what timeout knob controls it?
Node is v18 — will this agent still run?
which files does the impact agent consider "unmatched" and why?
why was my Proofhub CSV rejected — show the parse error
why is the Vulnerabilities sheet empty even though the scan found issues?
the ingest step can't find sonar-findings.json — where does it look?
```

```text
show the last CHANGE-LOG.md entry
tail the last 100 lines of the agent log
show me the run info from the last report
what engine did auto-detect pick, and why?
force --engine spring instead of the auto-detected engine
skip preflight and just run
```

---

## 9. Meta / Discovery Prompts

```text
list all engines
what engines are available?
list scaffolder types
list scaffolder types for AEM
list scaffolder types for Commerce PaaS
list scaffolder types for Sling
list scaffolder templates
list rule packs
list rule packs for Spring
list rule packs for AEM
list all agents in the DCA suite
```

```text
show the standardized-report schema
show the 15-column Summary contract
show the CHANGE-LOG format
which sheet lists Vulnerabilities?
which sheet lists Severity Breakdown?
show the Run Info sheet layout
```

```text
which agent has jurisdiction over Adobe Commerce SaaS?
which agent handles Proofhub bug exports?
which agent handles BRD documents?
which agent produces the Quality Gate?
which agent computes reverse-dependency blast radius?
which agent runs deterministic scaffolders vs LLM generation?
compare audit vs sonar-scan — when do I use which?
```

---

## 10. Enterprise Architect Prompts

```text
generate a coverage summary across all 8 stacks
identify Adobe platform upgrade risks across our estate
map findings to CIS controls
map findings to CWE
map findings to OWASP Top 10
map findings to NIST 800-53
produce a risk register CSV per severity
generate a governance report suitable for the CISO
roadmap the top 10 remediation items with owner and ETA
quantify tech debt by stack (ideal-days per stack)
produce Jira-ready epic + stories per stack
compare pre-release and post-release audit reports
generate a stakeholder-ready PDF summary
```

```text
which stacks are furthest below Quality Gate PASS?
which modules concentrate the most CRITICAL findings across all agents?
what percentage of our codebase is covered by tests, per stack?
what percentage of BRD line-items map to at least one code file?
what percentage of open bugs have zero code impact (candidates for triage)?
model the tech-debt burn-down if we fix HIGH+CRITICAL in the next 2 sprints
identify the smallest set of files to fix that resolves 80% of vulnerabilities
```

```text
run audit + sonar-scan across all 5 client projects and emit one consolidated Excel
compare Adobe Commerce PaaS vs SaaS findings for our shared modules
produce an Adobe Solution Partner readiness report from the last audit
generate a security posture snapshot for the quarterly review
```

---

## License

See `LICENSE` in the repository root.
