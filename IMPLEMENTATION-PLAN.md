# DCA Agents — Implementation Plan (Company Tech-Stack Coverage)

> Goal: extend the 5 in-scope BMAD "dca" agents (Audit, Sonar Scan, Code Generation, Impact Analysis, Test Coverage) to **100% coverage** of the company's tech stack,
> with **standardized outputs** (CHANGE-LOG.md + `<agent>-<branch>-<timestamp>-agent-report.xlsx` +
> an optional standard branch (`--create-branch`) cut from the production/shared branch), identical per
> stack across every project.
>
> Grounded in an on-disk audit of the module (not the README). Status legend: ✅ real · ⚙️ partial ·
> 🩹 scaffold/not wired · ❌ absent.
>
> The 5 agents are: **Audit**, **Sonar Scan**, **Generation**, **Impact Analysis**, **Test Coverage**.
> The original deterministic scan-agent was retired and its Tier-1 scan absorbed into the Audit agent's
> **Scan Only** action; a NEW LLM-driven **Sonar Scan** agent was later added (5th agent) — the two are
> distinct.

---

## 1. Reality check — the kickoff baseline (since delivered)

The module is **entirely TypeScript** (no Python; run via `npx ts-node`). Runtime deps: `exceljs`,
`fast-glob`, `mammoth` (.docx), `web-tree-sitter` + `tree-sitter-wasms` (AST, WASM — no native build),
plus `pdfkit` for the AEM legacy PDF report. The table below is the **kickoff baseline** that motivated
this build, alongside the **delivered** state.

| Agent | At kickoff (baseline) | Now (delivered) |
|-------|-----------------------|-----------------|
| **Audit** | Only genuinely production-grade agent. **AEM** and **Commerce** engines were real; **EDS / EDS+Commerce** had scanner code but no `main()` (Tier-1 no-op); **App Builder** was Tier-2 rules only, not in registry; **Sling/Shaft & Spring Boot absent.** Java scanning was regex-only. | **8 engines registered** (`aem, commerce, commerce-saas, sling, spring, app-builder, eds, eds-commerce`), all emitting the standardized report. New engines (`sling, spring, app-builder, commerce-saas`) built natively on the shared tree-sitter AST harness; legacy engines (`aem, commerce, eds, eds-commerce`) keep their platform report **and** add an AST precision pass. EDS/eds-commerce `main()` added. **Scan Only** is an Audit action (menu `SC`). |
| **Generation** | **LLM-only.** Rich knowledge packs but the TS generator was an explicit **stub** ("Not yet implemented") — no deterministic output, no report/changelog. | **Deterministic scaffolder** (`scripts/scaffold/`) with **24 types across all 8 stacks** (incl. `commerce-saas`) + the LLM/MCP path with zero-config MCP auto-provisioning (`--setup`). Every scaffold emits the standardized report + CHANGE-LOG. |
| **Impact Analysis** | **~Entirely scaffold.** `run.ts` printed "TODO"; every `create()` threw; **zero input ingestion** — no Proofhub, no BRD reader. | **Input-driven**: `--bugs` (Proofhub CSV) + `--brd` (.docx via mammoth / .md/.txt) → generic tracer (`scripts/analysis/tracer.ts`) → reverse-dependency blast radius → standardized report with a unique **Input Traceability** sheet. 8 stack profiles. |
| **Test Coverage** | Tier-1 was a **filename-existence ratio** (no JaCoCo/PHPUnit-cov/nyc); `generateTests()` returned `[]`; **no report file written.** | Tier-1 gap analysis for all **8 engines** + **real line/branch coverage** (JaCoCo/Istanbul/Clover/LCOV, opt-in via `--coverage-report`/`--run-coverage`). Tier-2 test generation is **LLM-driven by design** (per-stack packs under `resources/test-generation/`). Emits the standardized report. |
| **Reports** | **Three duplicate ExcelJS generators**, divergent sheets, three naming schemes, none matching the required naming. **No `CHANGE-LOG.md` writer, no branch step.** `skills/shared/` held only an orphaned `token-budget/`. | **One shared `StandardExcelReport`** (`skills/shared/report/`, 15-col Summary contract) + a git-diffable **Markdown twin** + a `CHANGE-LOG.md` writer + an optional `dca/<agent>-<stack>-<ts>` **branch cut** — all in `skills/shared/`, called by all 5 agents via `emitStandardOutputs`. Legacy AEM/Commerce/EDS engines additionally keep their own platform-specific Excel (so a legacy run writes **two** xlsx). |

**Consequence:** at kickoff this was much closer to a *build* than an *extend* — only Audit-for-AEM and
Audit-for-Commerce were load-bearing. **That build is now delivered:** all 5 agents cover all 8 engine
stacks with the standardized outputs.

---

## 2. Canonical tech-stack matrix + locked decisions

**In scope (all rows must reach 100%):**

| # | Stack | Runtime |
|---|-------|---------|
| 1 | AEMaaCS | Java / Sling / OSGi |
| 2 | AEM AMS | Java / Sling / OSGi (6.5, uber-jar) |
| 3 | Adobe Commerce **PaaS** (Magento 2) | PHP |
| 4 | Adobe Commerce **SaaS** (ACCS / drop-ins / Catalog / Live Search) | JS + services |
| 5 | App Builder — **API Mesh** | Node.js |
| 6 | App Builder — **Middleware / business logic (BFF)** | Node.js |
| 7 | App Builder — **Eventing (I/O Events)** | Node.js |
| 8 | App Builder — **Apps** (AEMaaCS + Commerce UI extensibility) | Node / React |
| 9 | **Sling-12 / Shaft** custom middleware | Java / Apache Sling (= AEM family) |
| 10 | **Spring Boot** custom middleware | Java (17/21, Jakarta) |
| 11 | **Adobe EDS** + EDS×Commerce (PaaS/SaaS) storefront | JS blocks/drop-ins |

> **These 11 in-scope variants are delivered through 8 engine stacks** (canonical engine IDs, used by
> `--engine` and `module.yaml`): `aem`, `commerce`, `commerce-saas`, `sling`, `spring`, `app-builder`,
> `eds`, `eds-commerce`. `aem` serves both **AEMaaCS and AEM AMS** (auto-detected, or `--platform
> aemcs|aemams|both`); the four **App Builder** variants are all served by the single `app-builder`
> engine; rows 3/4 map to `commerce`/`commerce-saas`; row 11 maps to `eds`/`eds-commerce`. (Both the
> engine ID and the on-disk directory now use the hyphenated form `eds-commerce`.)

**Locked (2026-07-09):** ① Tooling stays **TypeScript** (extend, no Python rewrite). ② Deep per-stack LLM
context lives in **each agent's own `resources/`** (self-contained; accepted duplication). ③ **EDS is in
scope & critical.** ④ Commerce = **both PaaS and SaaS**.

> **Shaft = Apache Sling/Felix/Oak/JCR** (same family as AEM). AEM patterns transfer directly; only Shaft's
> domain modules (SAM API-management + MDM + connectors) are net-new. Full Shaft KB already extracted from the PPT.

---

## 3. Coverage matrix (stack × agent) — delivered

All cells are ✅ delivered. The 11 in-scope variants below are served by the 8 engine stacks named in §2.

| Stack | Audit | Generation | Impact | Test Coverage |
|-------|-------|-----------|--------|---------------|
| AEMaaCS | ✅ regex + Java AST | ✅ scaffolders + LLM/MCP | ✅ `aem` profile | ✅ gap + real JaCoCo |
| AEM AMS | ✅ `aem` engine, AMS mode (`--platform aemams`) | ✅ `aem` + `ams` pack | ✅ `aem` profile (AEMaaCS+AMS) | ✅ gap + real JaCoCo |
| Commerce PaaS | ✅ regex + PHP AST | ✅ 5 scaffolders | ✅ `commerce-paas` profile | ✅ 7 frameworks + real Clover |
| Commerce SaaS | ✅ `commerce-saas` engine (JS AST) | ✅ 2 scaffolders (catalog-query, storefront-block) | ✅ `commerce-saas` profile | ✅ Jest (real Istanbul) |
| App Builder — API Mesh | ✅ `app-builder` engine | ✅ `mesh` scaffolder | ✅ `app-builder` profile | ✅ Jest |
| App Builder — Middleware | ✅ JS AST + config rules | ✅ `action` scaffolder | ✅ | ✅ Jest |
| App Builder — Eventing | ✅ APPB-EVT rules | ✅ `event-handler` scaffolder | ✅ | ✅ Jest |
| App Builder — Apps (UIX) | ✅ UI-extensibility rule packs | ✅ LLM/MCP path | ✅ | ✅ |
| Sling-12 / Shaft | ✅ pure Java AST | ✅ 4 scaffolders | ✅ `sling` profile | ✅ Sling Mocks pack |
| Spring Boot | ✅ Java AST + config | ✅ 3 scaffolders | ✅ `spring` profile | ✅ Spring Test pack |
| EDS / EDS+Commerce | ✅ regex + JS AST (`eds`, `eds-commerce`) | ✅ `block`, `dropin-block` | ✅ `eds` / `eds-commerce` profiles | ✅ Jest + jsdom packs |

> **Sonar Scan** ✅ delivered for every stack row above — see §7 Phase 8 for details. Omitted from the matrix to keep the table narrow.

---

## 4. Standard outputs spec (identical per stack, every project)

### A. `CHANGE-LOG.md` (shared writer — `skills/shared/git/changelog.ts`)
Keep-a-Changelog flavored: a `# CHANGE-LOG` header plus a `<!-- dca:entries -->` marker; each run splices one
entry **right after the marker (newest first)**. Entry header:
`## <YYYYMMDD_HHMMSS> — `<agent>` — <stack|engine> — <project>` then bullets: **Branch** (branch `x` from `y`),
**Summary**, **Findings** (`N total (CRITICAL n, HIGH n, …)`), **Report** (the xlsx filename), **Files changed**,
**Details**. Defaults to `<projectRoot>/CHANGE-LOG.md`.

### B. `<agent>-<branch>-<timestamp>-agent-report.xlsx`
One **shared** ExcelJS generator (`skills/shared/report/standard-report.ts`, `StandardExcelReport`). `branch`
is the sanitized current git branch (`/`→`-`, else `nobranch`); `timestamp` is local `YYYYMMDD_HHMMSS`.
**Fixed sheet order:**

1. **Run Info** — agent, engine, stack, project, source branch, working branch, timestamp, tool versions, severity counts.
2. **Summary** *(the contract sheet — 15 columns, order is part of the contract; do not reorder without a version bump)*:
   | ID | Title | Description | Tech Stack | Category / Module | Code Reference | Severity | Confidence | Rule ID | Recommendation / Fix | Impact Analysis | Effort | Dev Comments | Owner | Status |
3. **Severity Breakdown**.
4. **By Category**.
5. **Recommendations** *(only when recommendations are supplied)*.
6. **Input Traceability** *(only when a finding carries `inputRef` — i.e. the Impact agent; absent for a pure audit)*. One row per Proofhub bug / BRD requirement → impacted file → blast radius.

A git-diffable **Markdown twin** (`<agent>-<branch>-<timestamp>-agent-report.md`, reduced 9-column Summary) is
written alongside the xlsx by default. All three outputs are emitted through the single entry point
`skills/shared/output/emit.ts::emitStandardOutputs`.

> Required columns (Title, Description, Code Reference, Severity, Recommendation/Fix, Impact Analysis, Dev
> Comments, Status) are a guaranteed subset of the 15-column contract; the same contract yields an identical
> file shape everywhere. (Legacy AEM/Commerce/EDS engines additionally keep their own platform-specific
> multi-sheet Excel alongside the standardized report.)

### C. Standard branch (opt-in)
When `--create-branch` is passed, `maybeCutStandardBranch` cuts a standard working branch
`dca/<agent>-<stack>-<YYYYMMDD_HHMMSS>` from the first existing of `production → main → master → develop`
(or a single `--source-branch <name>`), so the run's report + CHANGE-LOG land on a fresh branch. All git ops
are best-effort / non-fatal and degrade gracefully outside a repo.

---

## 5. Per-agent knowledge context (honoring "per-agent `resources/`")

Per your choice, each agent keeps its own `resources/<stack>/` pack. To prevent 4× drift, each stack was
**authored canonically once, then tailored per agent** (audit=rule anatomy+severity; generation=templates/snippets;
impact=dependency-edge taxonomy; test=framework mapping+coverage targets). Depth target per stack (detect
signals · good/bad code · severity · remediation · gen template · impact-edge · test-framework):

- **AEMaaCS** — Sling Models/HTL/OSGi R7, CF Models+GraphQL, editable templates, dispatcher, Cloud Manager gates, RDE, Oak indexes, service users/repoinit, AEM-Mocks/JUnit5.
- **AEM AMS** — 6.5 uber-jar/`javax.*`, classic dispatcher, replication agents, workflows, install hooks, Jenkins CI, Cloud-migration signals.
- **Commerce PaaS** — modules/DI/plugins/observers, webapi/GraphQL, db_schema/patches, MQ, cron locking, ECE-Tools/`.magento.env.yaml`, Redis/Varnish, security, PHPUnit/MFTF.
- **Commerce SaaS** — drop-ins, Catalog/Live Search, API Mesh integration, storefront events, Adobe Commerce APIs.
- **App Builder** — Mesh (sources/handlers/transforms, auth/depth), Middleware/BFF (action anatomy, state/files SDK, secrets, Jest), Eventing (provider/registration, webhook signature, idempotency/DLQ), Apps (`@adobe/uix-guest`, Commerce `backend-ui/1`, AEM CF/Universal Editor, React Spectrum, ExcShell).
- **Sling-12 / Shaft** — OSGi DS/config, Sling resource/servlet/**filter** chain (XSS→Audit→Authorization), feature-model/starter, JCR, SAM (Query-to-API/channels/throttling/partner), MDM (file/folder CRUD/ACL/CSV pre-post/triggers), connectors, Sling-Mocks. *(KB extracted from PPT; confirm versions/build.)*
- **Spring Boot** — auto-config/stereotypes, Spring Data JPA, `application.yml` profiles, actuator, Spring Security, validation, Kafka/RabbitMQ, `@WebMvcTest`/`@DataJpaTest`/MockMvc/Testcontainers, Maven **and** Gradle.
- **EDS / EDS×Commerce** — blocks, drop-ins, Core Web Vitals, storefront-events, PaaS/SaaS backends.

> Note the engine-key ↔ resource-dir naming: the generation agent's `aem` engine draws on `resources/aemcs`
> + `resources/ams`; `commerce-paas` → `resources/commerce`; `sling` → `resources/sling-shaft`; `spring` →
> `resources/spring-boot`. The audit agent splits AEM rules into `rule-packs/aemcs/` and `rule-packs/aemams/`.

---

## 6. Shared infrastructure (delivered — prerequisite for standard outputs)

- ✅ **`skills/shared/report/`** — one `StandardExcelReport` + Markdown twin + styles (the 15-col Summary contract). Legacy AEM/Commerce/EDS reports are **preserved alongside** the standardized one (breadth), not deleted.
- ✅ **`skills/shared/git/`** — helpers: report filename (`<agent>-<branch>-<timestamp>`), `YYYYMMDD_HHMMSS` timestamp, `CHANGE-LOG.md` writer, standard-branch creator (`dca/<agent>-<stack>-<ts>` from production/shared).
- ✅ **Shared output/report/git layer as the single integration seam** — rather than one unified `BaseEngine`, every agent keeps its own registry (audit `engines/registry.ts`, impact `scripts/engines/profiles.ts`, test-coverage `engines/registry.ts`, generation `GENERATORS` map) but funnels all outputs through `emitStandardOutputs`. The EDS `main()` no-op was fixed as part of adopting the contract.
- ✅ **Wired into all five agents** — impact & test-coverage (which emitted nothing before) now emit the full standard output set, as do audit, generation, and sonar-scan.

---

## 7. Phased roadmap

| Phase | Work |
|-------|------|
| **0 — Decisions & spec** | ✅ **DONE** — decisions locked (TS-extend · per-agent resources · EDS in-scope · Commerce PaaS+SaaS · foundation-first · true-AST-now). Summary schema + naming finalized. |
| **1 — Shared infra** | ✅ **DONE & VERIFIED** — `skills/shared/{core,report,git,output,ast}` built; StandardExcelReport (15-col contract), CHANGE-LOG writer, `<agent>-<branch>-<timestamp>` naming, standard-branch cutter, tree-sitter AST. Wired into **impact + test-coverage** (both emitted nothing before). Verified: typecheck clean, AST smoke, output-pipeline smoke, both agents run end-to-end. Audit + generation adopt the shared report during **their** phases (3 & 6). |
| **2 — Per-stack knowledge** | ✅ **DONE** — `resources/<stack>/` packs authored across agents: App Builder (mesh/middleware/eventing/apps + UI-extensibility), Spring Boot, Sling/Shaft (filled from the PPT KB), Commerce SaaS, plus the AEMaaCS/AMS/Commerce packs. Audit rule-packs exist for all stacks (`aemcs, aemams, commerce, commerce-saas, eds, eds-commerce, sling-shaft, spring-boot, app-builder`). |
| **3 — Audit → full stack** | ✅ **DONE & VERIFIED** — **Sling/Shaft**, **Spring Boot**, **App Builder**, **Commerce SaaS** all built on the standardized report. Shared AST rule libraries: **`skills/shared/java/`** (Java harness + 9 generic rules; backs Sling + Spring incl. nested-YAML config) and **`skills/shared/js/`** (JS/TS harness + 3 generic rules; backs App Builder — JS AST + app.config.yaml/.env/mesh config). All registered + auto-detected; Tier-2 packs authored/cross-referenced; SKILL.md updated. **Legacy engines unified** — AEM, Commerce, EDS, eds_commerce all now emit the standardized `audit-<branch>-<timestamp>-agent-report.xlsx` + CHANGE-LOG via `fromLegacyFindingsMap` (legacy rich reports preserved alongside); EDS/eds_commerce `main()` added (their Tier-1 previously never ran). **So all 8 audit engines produce the identical report shape.** **App Builder eventing** (APPB-EVT-001/002) + Confidence on all findings. **Commerce SaaS engine** — `engines/commerce-saas/` (JS AST + JSON/config scan: CSAAS-SEC-001 private-cred-in-storefront, CSAAS-CFG-001 config-secret, CSAAS-CFG-002 hardcoded endpoint/env-id, CSAAS-SEC-003 Data-Connection webhook signature) + `rule-packs/commerce-saas/`, registered + auto-detected via SaaS markers. **AUDIT COMPLETE across all 8 engine stacks.** Depth enhancement still open: XML-config AST scanning (di.xml/.content.xml/Spring XML). |
| **✅ 45/45 COMPLETE** | **All 5 agents cover all in-scope stacks** (5 agents × 9 tech-stack variants = 45 coverage cells), delivered via the **8 engine stacks** (`aem` serves AEMaaCS + AMS), incl. Commerce SaaS across audit/sonar-scan/generation/impact/test-coverage. Deliverable: `DCA-Agent-Coverage.xlsx`. |
| **Legacy engines → AST (precision)** | ✅ **DONE** — **PHP AST harness** `skills/shared/php/` (7 generic rules: secret, SQLi-via-`.`-concat, eval, cmd-injection, weak-hash, XSS-echo-superglobal, unserialize) — verified to ignore comments/log-strings that regex false-positives on. **Commerce engine AST-augmented** (`engines/commerce/ast-scan.ts` + `ObjectManager` rule): runs after the regex scan, **supersedes regex duplicates** at the same file:line, ruleIds flow to the report. **AEM engine AST-augmented** (`engines/aem/ast-scan.ts`: generic Java rules + admin-resolver + resolver-leak; stats recomputed post-merge). **EDS engine AST-augmented** (`engines/eds/ast-scan.ts`: generic JS rules + DOM-XSS from URL). **eds_commerce AST-augmented** too (reuses `engines/eds/ast-scan.ts` with stackId). **All 4 legacy engines now run an AST precision pass.** **Regex retirement decision:** the regex security scans also cover **XML + phtml + pattern variants** the AST rules don't, so the **runtime supersede is the correct, safe retirement** (AST wins at overlapping file:line; regex kept for breadth). |
| **Standard branch (output C) — uniform** | ✅ `maybeCutStandardBranch` (`skills/shared/output`) wired into **all 5 dispatchers** (audit at dispatcher level covering every engine + flag-strip to avoid double-cut; sonar-scan/test-coverage/generation/impact directly). `--create-branch [--source-branch <name>]` cuts `dca/<agent>-<stack>-<timestamp>` from production/shared (candidates: production→main→master→develop) so the run's report + CHANGE-LOG land on a fresh branch. Verified on a git fixture. **Completes the 3 standard outputs contract across every agent.** |
| **Conversational mode-advisor** | ✅ `skills/shared/preflight/` — detects the current LLM/model (env), sizes the project vs the context window, and recommends **Static (Tier-1) / LLM (Tier-2) / Hybrid**. Wired into all 5 `run.ts` (`--preflight` advisory-only, `--no-preflight` skip; prints on every run). Conversational "Preflight" section added to all 5 SKILL.md. |
| **4 — Impact Analysis** | ✅ **DONE & VERIFIED** — input subsystem (`scripts/inputs/`: Proofhub CSV via `--bugs` with keyword-auto-detected columns + BRD via `--brd`, `.docx` through mammoth and any other extension as `.md`/`.txt`) → generic tracer (`scripts/analysis/tracer.ts`: symbol extraction → file scoring → reverse-dependency blast radius → risk scoring) → standardized report with the unique **Input Traceability** sheet. **8 stack profiles** covering all stacks (`scripts/engines/profiles.ts`; `aem` = AEMaaCS+AMS), auto-detect + `--engine`. At least one of `--bugs`/`--brd` is required. SKILL.md rewritten. Verified on Spring (blast radius correct) + Commerce/PHP. Heuristic (identifier/reverse-ref), not type-resolved data-flow — evidence listed per finding. |
| **5 — Test Coverage** | ✅ **DONE** (Tier-2 generation is LLM-driven by design) — gap-analysis engines for all **8 stacks** (registered + auto-detected, standardized report). **LLM test-generation packs authored for all 8 stack-frameworks** (`resources/test-generation/{aem,sling,spring,commerce-paas,commerce-saas,app-builder,eds,eds-commerce}.md`) — framework+deps, test location/naming, setup/mock boilerplate, worked example, and a **"Reaching 100%" checklist**. SKILL.md "Generate" mode drives the LLM from these packs (static finds gaps → LLM writes tests to 100%); `engine.generateTests()` is intentionally a stub returning `[]`. **Real coverage integration DONE** — `skills/shared/coverage/` parses **JaCoCo XML, Istanbul json (summary+final), Clover XML, LCOV** (all 4 verified) + report discovery + an opt-in runner (`--run-coverage`: mvn/gradle-jacoco, jest/nyc, phpunit-clover). With `--coverage-report`/`--run-coverage`/auto-discovered report, `Coverage %` becomes real line coverage and gaps become files <100% with exact line/branch numbers; otherwise falls back to the filename estimate (labeled `Coverage source`). |
| **6 — Generation** | ✅ **DONE** — deterministic **scaffolder** (`scripts/scaffold/`, the `GENERATORS` map is the source of truth) covering **all 8 stacks with 24 types**: `aem` (sling-model, osgi-service, sling-servlet, component, workflow-process), `sling` (osgi-service, sling-servlet, sling-filter, sling-model), `spring` (rest-controller, service, jpa-repository), `commerce-paas` (module, plugin, observer, graphql-resolver, controller — **php -l clean**), `commerce-saas` (catalog-query, storefront-block), `app-builder` (action, mesh, event-handler w/ signature-verify+idempotency), `eds` (block), `eds-commerce` (dropin-block). Wired into `run.ts --scaffold`; generates real idiomatic files + emits the standardized generation report + CHANGE-LOG; supports `--dry-run`/`--force`/`--list-types`. **Zero-config MCP auto-provisioning** (`--setup`: `.mcp.json`, `.bmad/mcp-registry.toml`, `.env`, `.gitignore`) + AEM structure `--detect`. LLM/MCP Tier-2 path preserved for complex generation, with `--list-templates`. |
| **7 — Shaft finalize & harden** | 🟡 **IN PROGRESS** — extend Shaft rule/gen/test packs from the PPT KB across all agents; end-to-end verify identical A/B/C outputs per stack on real projects. Registry-refresh sub-items are ~~closed~~: ~~`module-help.csv` "List Engines" row updated~~, ~~audit `customize.toml` "42+ categories" wording fixed~~; the `module.yaml` agent-level description and remaining SKILL.md front-matter carry-over should be spot-checked. |
| **8 — Sonar Scan agent** | ✅ **DONE** — 5th agent added: LLM-driven Sonar-style analysis across all 8 stacks. Emits standardized report + dedicated **Vulnerabilities** sheet + **Quality Gate** (pass/fail) + **Reliability / Security / Maintainability** ratings (A–E). Uses shared foundation (report/git/preflight). CLI: 2-step (LLM scan → `--ingest sonar-findings.json`). Registered in `module.yaml` + `module-help.csv`. |

---

## 8. Decisions — now resolved

1. **Java analysis depth** — ✅ **RESOLVED: true AST now.** `web-tree-sitter` (WASM, no native build) via shared harnesses `skills/shared/{java,js,php}`. New engines are AST-native; legacy engines add an AST precision pass that supersedes regex duplicates. Regex kept for breadth (XML/phtml/pattern variants AST rules don't cover).
2. **Proofhub export + BRD source** — ✅ **RESOLVED.** `--bugs` = Proofhub CSV (custom RFC-4180 parser, headers keyword-auto-detected: id/title/description/module/priority/status). `--brd` = `.docx` via mammoth (raw text) or any other extension read as UTF-8 text (`.md`/`.txt`). Google Docs must be exported to `.docx`/`.txt` first (Docs API OAuth out of scope). *Residual:* a `ColumnMap` override exists in code but is not wired to a CLI flag.
3. **Branch/git policy** — ✅ **RESOLVED.** Opt-in `--create-branch` cuts `dca/<agent>-<stack>-<YYYYMMDD_HHMMSS>` from the first existing of `production → main → master → develop` (or a single `--source-branch <name>`); non-fatal outside a repo.
4. **Registry unification** — ✅ **RESOLVED (pragmatically).** No single `BaseEngine`; instead every agent funnels through the shared output/report/git layer (`emitStandardOutputs`) while keeping its own registry.
5. **Generation execution model** — ✅ **RESOLVED: both.** Deterministic scaffolder (Tier-1, 24 types / 8 stacks) **and** LLM/MCP (Tier-2) with zero-config MCP auto-provisioning (`--setup`).
6. **Sling/Shaft specifics** — ✅ **Delivered as the `sling` engine** (pure Java AST, `rule-packs/sling-shaft`, `resources/sling-shaft`). *Residual (Phase 7):* confirm exact Sling/Felix/Oak versions + build system + whether SAM & MDM are separate bundles.
7. **Report columns per stack** — ✅ **RESOLVED.** The 15-column Summary contract (§4.B) is frozen; order is part of the contract. Same shape every stack, every project.

---

## 9. Remaining inputs / residuals
1. **Proofhub** — a real exported sample to tune the column-keyword mapping (the parser auto-detects headers today; the `ColumnMap` override is not yet CLI-exposed).
2. **BRD** — confirm that exporting Google Docs to `.docx`/`.txt` first is acceptable (direct Docs API access is out of scope).
3. **Branch policy** — confirm the real production/shared branch name if it isn't one of `production/main/master/develop` (else pass `--source-branch`).
4. **Sling/Shaft** — versions + build system + SAM/MDM bundle layout (or a sample repo) to finalize Phase 7.
5. **Registry refresh** — sign-off to update `module-help.csv` / `module.yaml` agent description / `customize.toml` / SKILL.md so their prose matches the delivered 5-agent, 8-stack reality.
