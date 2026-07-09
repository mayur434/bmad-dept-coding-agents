# DCA Agents — Implementation Plan (Company Tech-Stack Coverage)

> Goal: extend the 4 in-scope BMAD "dca" agents to **100% coverage** of the company's tech stack,
> with **standardized outputs** (CHANGE-LOG.md + `<agent>-<branch>-<timestamp>-agent-report.xlsx` +
> a standard branch cut from the production/shared branch), identical per stack across every project.
>
> Grounded in an on-disk audit of the module (not the README). Status legend: ✅ real · ⚙️ partial ·
> 🩹 scaffold/not wired · ❌ absent.

---

## 1. Reality check — what actually exists on disk (README oversells)

The module is **100% TypeScript** (2413 `.ts`, **0 Python**; run via `npx ts-node`). Deps: `exceljs`,
`pdfkit` (AEM), `mammoth` (.docx), `fast-glob`. Actual maturity:

| Agent | Truth on disk |
|-------|---------------|
| **Audit** | Only genuinely production-grade agent. **AEM** engine (aemcs 96 + aemams 48 LLM rules, Cloud/AMS auto-detect) and **Commerce** engine (56 scan fns + SQL-dump/BRD/bug/patch) are real. **EDS / EDS+Commerce** have real scanner code but the engine class has **no `main()`** and is never instantiated → Tier-1 silently **no-ops**. **App Builder** = Tier-2 rules only, no scanner, not in registry. **Sling/Shaft & Spring Boot = absent.** Java scanning is regex/text heuristics, AEM-coupled (needs `pom.xml` + `ui.apps/core`). |
| **Generation** | **LLM-only by design.** Rich knowledge packs (AEMaaCS/AMS/Commerce/App-Builder) but the TS generator is an explicit **stub** ("Not yet implemented") → no deterministic output, no report/changelog. |
| **Impact Analysis** | **~Entirely scaffold.** `run.ts` prints "TODO"; every engine `create()` throws; **zero input ingestion** — no Proofhub, no BRD/.docx, no Google-Doc reader anywhere. `exceljs` declared but unused. |
| **Test Coverage** | Tier-1 is a **filename-existence ratio** (no JaCoCo/PHPUnit-cov/nyc). `generateTests()` returns `[]` on every engine. **No report file ever written.** |
| **Reports** | **Three duplicate ExcelJS generators** (`audit/scripts/shared/report-excel.ts` used only by EDS; `engines/aem/lib/report.ts`; `engines/commerce/lib/report.ts`), each with its own `styles.ts`, divergent sheets, **three** naming schemes. **None** match the required naming. **No `CHANGE-LOG.md` writer anywhere. No branch-creation step.** `skills/shared/` holds only an orphaned `token-budget/` nothing imports. |

**Consequence:** this is much closer to a *build* than an *extend*. Only Audit-for-AEM and Audit-for-Commerce are load-bearing today.

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

**Locked (2026-07-09):** ① Tooling stays **TypeScript** (extend, no Python rewrite). ② Deep per-stack LLM
context lives in **each agent's own `resources/`** (self-contained; accepted duplication). ③ **EDS is in
scope & critical.** ④ Commerce = **both PaaS and SaaS**.

> **Shaft = Apache Sling/Felix/Oak/JCR** (same family as AEM). AEM patterns transfer directly; only Shaft's
> domain modules (SAM API-management + MDM + connectors) are net-new. Full Shaft KB already extracted from the PPT.

---

## 3. Gap matrix (stack × agent)

| Stack | Audit | Generation | Impact | Test Coverage |
|-------|-------|-----------|--------|---------------|
| AEMaaCS | ✅ (regex, not AST) | ⚙️ LLM-rich, no generator | 🩹 detects, `create()` throws | ⚙️ filename-match only |
| AEM AMS | ✅ (aem engine, AMS mode) | ⚙️ LLM-rich (deepest pack) | ❌ conflated w/ single aem engine | ⚙️ no AMS/Cloud split |
| Commerce PaaS | ✅ generic (no PaaS mode) | ⚙️ LLM-rich, no generator | 🩹 detects, throws | ⚙️ strong scan, no report, no cov% |
| Commerce SaaS | ❌ | ❌ | ❌ | ❌ |
| App Builder — API Mesh | ⚙️ 2 rules, no Tier-1, not in registry | ⚙️ LLM, not in registry | ❌ | ❌ |
| App Builder — Middleware | ⚙️ 12 generic rules | ⚙️ LLM-moderate | ❌ | ❌ |
| App Builder — Eventing | ❌ | ⚙️ mentioned only | ❌ | ❌ |
| App Builder — Apps (UIX) | ⚙️ 27 rules, no Tier-1 | ⚙️ LLM-rich | ❌ | ❌ |
| Sling-12 / Shaft | ❌ (only inside aem engine) | ❌ | ❌ | ❌ |
| Spring Boot | ❌ | ❌ | ❌ | ❌ |
| EDS / EDS+Commerce | 🩹 scanner exists, not wired | ⚙️ (via gen) | ❌ | ⚙️ eds engine partial |

---

## 4. Standard outputs spec (identical per stack, every project)

### A. `CHANGE-LOG.md` (new shared writer — nothing exists today)
Keep-a-Changelog style; each agent run appends one dated entry:
`## [<agent>] <stack> — <branch> — <YYYY-MM-DD HH:MM:SS>` then **Summary**, **Findings/Gaps** (counts by
severity), **Files created/modified** (path list), **Details** (bulleted changes), **Report**: link to the xlsx.

### B. `<agent-name>-<branch-name>-<timestamp>-agent-report.xlsx`
One **shared** ExcelJS generator (`skills/shared/report/`) replacing the 3 duplicates. `branch-name` from
`git rev-parse --abbrev-ref HEAD` (`/`→`-`); timestamp `YYYYMMDD_HHMMSS`. **Deterministic sheet set** per stack:

1. **Run Info** — agent, engine, stack, project, source branch, working branch, timestamp, tool versions, severity counts.
2. **Summary** *(primary sheet — the required columns, byte-identical per stack across projects)*:
   | ID | Title | Description | Tech Stack | Category / Module | Code Reference (file:line) | Severity | Confidence | Rule ID | Recommendation / Fix | Impact Analysis | Effort | Dev Comments | Owner | Status |
3. **Severity Breakdown** (pivot/chart).
4. **Per-category detail** sheets (stack-specific, fixed order).
5. **Recommendations / Fix Plan**.
6. **(Impact agent only)** Input Traceability — one row per Proofhub bug / BRD requirement → impacted symbols/files → blast radius.

> Required columns (Title, Description, Code Reference, Severity, Recommendation/Fix, Impact Analysis, Dev
> Comments, Status) are a guaranteed subset; extras add richness. Column set is fixed **per stack** so the
> same stack yields an identical file shape everywhere.

### C. Standard branch
Before writing changes, the agent cuts a standard working branch from the **production/shared** branch
(default assumption: `main`) named e.g. `dca/<agent>-<stack>-<YYYYMMDD_HHMMSS>` — *exact source branch &
naming convention pending your confirmation.* Shared git helper (no release agent exists to host this).

---

## 5. Per-agent knowledge context (honoring "per-agent `resources/`")

Per your choice, each agent keeps its own `resources/<stack>/` pack. To prevent 4× drift, I'll **author each
stack canonically once, then tailor per agent** (audit=rule anatomy+severity; generation=templates/snippets;
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

---

## 6. Shared infrastructure work (prerequisite for standard outputs)

- **`skills/shared/report/`** — one ExcelJS generator + markdown + styles (promoted from the audit `shared`), delete the 3 duplicates.
- **`skills/shared/git/`** — helpers: filename (`<agent>-<branch>-<timestamp>`), timestamp formatter, `CHANGE-LOG.md` writer, standard-branch creator (branch from production/shared).
- **Unified `BaseEngine` + registry contract** — collapse the 4 divergent registry/base shapes so shared helpers have one integration seam; fixes the EDS `main()` no-op as the reference contract.
- Wire the shared report+changelog+branch into **all four** agents (impact & test-coverage emit nothing today).

---

## 7. Phased roadmap

| Phase | Work |
|-------|------|
| **0 — Decisions & spec** | ✅ **DONE** — decisions locked (TS-extend · per-agent resources · EDS in-scope · Commerce PaaS+SaaS · foundation-first · true-AST-now). Summary schema + naming finalized. |
| **1 — Shared infra** | ✅ **DONE & VERIFIED** — `skills/shared/{core,report,git,output,ast}` built; StandardExcelReport (15-col contract), CHANGE-LOG writer, `<agent>-<branch>-<timestamp>` naming, standard-branch cutter, tree-sitter AST. Wired into **impact + test-coverage** (both emitted nothing before). Verified: typecheck clean, AST smoke, output-pipeline smoke, both agents run end-to-end. Audit + generation adopt the shared report during **their** phases (3 & 6) — engines must move to the unified contract first (audit has 3 legacy generators; generation's is a stub). |
| **2 — Per-stack knowledge** | Author/deepen `resources/<stack>/` across agents: new App Builder (mesh/middleware/eventing/apps), Spring Boot, Sling-generic; **Shaft** filled from PPT KB; Commerce SaaS. |
| **3 — Audit → full stack** | 🟡 **IN PROGRESS** — ✅ **Sling/Shaft**, ✅ **Spring Boot**, ✅ **App Builder** DONE & VERIFIED (all on the standardized report). Shared AST rule libraries built: **`skills/shared/java/`** (Java harness + 9 generic rules; backs Sling `engines/sling/` 13 rules + Spring `engines/spring/` 10 rules incl. nested-YAML config) and **`skills/shared/js/`** (JS/TS harness + 3 generic rules; backs App Builder `engines/app-builder/` 9 rules — JS AST + app.config.yaml/.env/mesh config). All registered + auto-detected; Tier-2 packs authored/cross-referenced; SKILL.md updated. ✅ **Legacy engines unified** — AEM, Commerce, EDS, eds_commerce all now emit the standardized `audit-<branch>-<timestamp>-agent-report.xlsx` + CHANGE-LOG via `fromLegacyFindingsMap` (legacy rich reports preserved alongside); EDS/eds_commerce `main()` added (their Tier-1 previously never ran). **So all 7 audit engines produce the identical report shape.** **Remaining for audit:** a dedicated Commerce **SaaS** (ACCS/drop-ins) engine + a PaaS-vs-SaaS detection split. |
| **4 — Impact Analysis** | Build input subsystem: **Proofhub reader** + **BRD reader** (.docx via mammoth / Google Docs API) + LLM prose→code-symbol extraction; per-stack dependency tracing + blast-radius scoring + traceability report. |
| **5 — Test Coverage** | 🟡 **IN PROGRESS** — ✅ gap-analysis engines added for **Sling/Shaft** (JUnit+Sling-Mocks), **Spring Boot** (Spring Test/MockMvc), **App Builder** (Jest), registered + auto-detected, emitting the standardized report (verified). **Remaining:** real coverage % (JaCoCo/PHPUnit-clover/nyc) vs filename ratio; `generateTests()` scaffolding per framework + Tier-2 patterns for new stacks; test-coverage SKILL.md/patterns.md. |
| **6 — Generation** | 🟡 **IN PROGRESS** — ✅ deterministic **scaffolder** built (`scripts/scaffold/`): Sling/Shaft (osgi-service, sling-servlet, sling-filter, sling-model), Spring Boot (rest-controller+DTO, service, jpa-repository+entity), App Builder (action+test). Wired into `run.ts --scaffold`; generates real idiomatic files (javac-valid modulo external deps) + emits the standardized generation report + CHANGE-LOG; supports `--dry-run`/`--force`. LLM/MCP path preserved for complex generation. **Remaining:** Tier-2 resource packs for Sling/Shaft + Spring Boot; generation SKILL.md update; optional branch cut. |
| **7 — Shaft finalize & harden** | Full Shaft rule/gen/test packs from PPT across all agents; end-to-end verify identical A/B/C outputs per stack on real projects; update `module.yaml`/`module-help.csv`/`marketplace.json`. |

---

## 8. Open decisions (with my proposed defaults)

1. **Java analysis depth** — default: match the existing **regex/heuristic** approach (like the AEM engine) for consistency now; offer a later AST upgrade (tree-sitter-java / JVM linters) for Spring/Sling deep graphs. *Confirm or ask for AST now.*
2. **Proofhub export format** (CSV/JSON/REST?) and **BRD source** (Google Docs API vs exported `.docx`) — **need real sample files + field mapping** (bug-id/module/description → code symbols). Blocks Phase 4.
3. **Branch/git policy** — exact **production/shared source branch** name + standard branch **naming convention**. Blocks the Phase 1 branch helper. Default assumed: source `main`, new `dca/<agent>-<stack>-<timestamp>`.
4. **Registry unification now?** — default **yes** (prerequisite refactor; blast radius across all agents but enables shared outputs).
5. **Generation execution model** — keep **LLM-only** (current) or build the deterministic scaffolder the stub promises. Affects deterministic CHANGE-LOG/report for gen.
6. **Sling/Shaft specifics** — exact Sling/Felix/Oak versions + "sling-12" mapping, build system (bnd/feature-model/content-package), repo layout, whether SAM & MDM are separate bundles.
7. **Report columns per stack** — confirm the §4.B schema; name any stack-specific mandatory extras.

---

## 9. What I need from you to unblock the build
1. **Proofhub** — a real exported bug list (sample file) + which fields matter.
2. **BRD** — a sample Google Doc / Word BRD + whether Google Docs API access is available.
3. **Branch policy** — production/shared source branch name + naming convention.
4. **Sling/Shaft** — versions + build system + repo/module layout (or a sample repo).
5. Priority/sequencing preference (foundation-first vs a specific stack end-to-end first).
