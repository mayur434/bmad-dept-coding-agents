# Scanner ↔ LLM Rule Cross-Reference (Adobe Commerce)

This mapping ensures Tier 1 (Scanner) and Tier 2 (LLM) are in sync during Full Audit mode. It defines how the LLM should use scanner findings and which areas need LLM deepening.

---

## How This Works in Full Audit (Tier 1 + Tier 2)

```
┌─────────────────────────────────────────────────────────────────┐
│  Full Audit Pipeline                                             │
│                                                                  │
│  1. Scanner runs → produces findings per category                │
│  2. This crossref maps each scanner category → LLM rule(s)      │
│  3. LLM receives scanner findings + applies semantic analysis    │
│  4. LLM actions per category:                                    │
│     • DEEPEN  = Scanner found it, LLM adds context/root-cause   │
│     • VERIFY  = Scanner flagged, LLM checks for false positive   │
│     • EXPAND  = Scanner can't detect this, LLM detects fresh     │
│     • SKIP    = Scanner is comprehensive, LLM adds no value      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Category Mapping

### Code Quality Scans (Scanner 1–10)

| Scanner Category | Scanner Checks | LLM Rule(s) | LLM Action |
|-----------------|----------------|-------------|------------|
| Exception Handling | Generic catches, empty catches, excessive try-catch | COMM-EXC-001, COMM-EXC-002 | **DEEPEN** — Scanner finds pattern, LLM analyzes if catch is in critical path and whether partial state changes are masked |
| Security | SQL injection, superglobals, eval, unserialize, hardcoded creds, shell exec | COMM-SEC-001, COMM-SEC-002, COMM-SEC-003, COMM-SEC-004 | **DEEPEN** — Scanner finds surface patterns, LLM traces data flow source→sink and assesses exploitability |
| Database | Direct SQL outside ResourceModel, N+1 in loop, missing transactions | COMM-PERF-001, COMM-PERF-003 | **DEEPEN** — Scanner flags individual occurrences, LLM detects cross-file N+1 patterns and assesses transaction boundaries |
| Caching | Missing cache on providers, cache without tags | COMM-CACHE-001, COMM-CACHE-002 | **VERIFY** — Scanner flags heuristically (no `cache` keyword nearby), LLM checks if framework caching already applies |
| Code Structure | God class, fat constructor, multiple classes per file | COMM-METRICS-001, COMM-METRICS-002 | **DEEPEN** — Scanner counts lines/params, LLM identifies which responsibilities to extract and suggests decomposition |
| Performance | Unbounded collections, model load in loop, sync API calls, array_merge in loop | COMM-PERF-001, COMM-PERF-002, COMM-PERF-003, COMM-PERF-004 | **DEEPEN** — Scanner finds local patterns, LLM detects N+1 across multiple endpoints and cumulative impact |
| Deprecated | Mage::, ObjectManager, Registry, AbstractHelper | COMM-DEP-001, COMM-ARCH-001 | **VERIFY** — Scanner regex may catch comments or strings; LLM confirms actual code usage and checks migration path |
| Logging | var_dump, print_r, debug output, custom handlers | COMM-LOG-001, COMM-LOG-002 | **SKIP** — Scanner is comprehensive for this; LLM adds minimal value |
| File Storage | file_put_contents, fputcsv, mkdir, S3 ops | COMM-FS-001 | **VERIFY** — Scanner flags all file operations; LLM checks if cleanup mechanism exists elsewhere |
| Reusability | Duplicate class names across modules, repeated patterns | — | **EXPAND** — No specific LLM rule; LLM should detect shared logic opportunities that regex can't |

### Architecture Scans (Scanner 11–21)

| Scanner Category | Scanner Checks | LLM Rule(s) | LLM Action |
|-----------------|----------------|-------------|------------|
| Test Coverage | Modules with zero test directory | COMM-TEST-001 | **DEEPEN** — Scanner flags existence; LLM assesses risk based on what the untested code does (payment? pricing?) |
| Dependency Injection | ObjectManager::getInstance(), core preferences | COMM-ARCH-001, COMM-ARCH-003 | **DEEPEN** — Scanner finds pattern + preference XML; LLM verifies if preference maintains upstream contract and checks for version-safe overriding |
| Plugin Architecture | Plugin method naming, type reference | COMM-ARCH-002 | **DEEPEN** — Scanner checks syntax; LLM verifies the target method is actually interceptable (not final/private/static) |
| Cron Jobs | Schedule config, group assignment | COMM-CRON-001, COMM-DEPLOY-004 | **DEEPEN** — Scanner checks XML config; LLM analyzes if the PHP cron class has locks, batch limits, timeout handling |
| GraphQL | Resolver patterns | COMM-GQL-001, COMM-GQL-002 | **DEEPEN** — Scanner checks structure; LLM verifies cache identity correctness and DataLoader implementation |
| Queue Processing | Consumer config in XML | COMM-QUEUE-001, COMM-DEPLOY-006 | **DEEPEN** — Scanner checks XML limits; LLM analyzes error handling and dead-letter strategy in consumer code |
| Configuration | Config patterns, scope usage | COMM-CONFIG-001 | **DEEPEN** — Scanner checks basic patterns; LLM verifies scope consistency between system.xml and PHP code |
| Frontend Templates | PHP blocks in .phtml, block references | COMM-FRONT-001 | **DEEPEN** — Scanner counts PHP blocks; LLM identifies business logic that should be in ViewModel |
| XML Configuration | Valid references, schema compliance | COMM-XML-001 | **DEEPEN** — Scanner checks XML syntax; LLM verifies referenced classes/methods actually exist |
| WebAPI & ACL | ACL resource declarations, webapi.xml | COMM-SEC-003 | **DEEPEN** — Scanner checks presence; LLM verifies ACL hierarchy makes sense and resources aren't over-permissive |
| DB Schema | db_schema.xml structural checks | COMM-DBSCHEMA-001 | **DEEPEN** — Scanner checks syntax; LLM verifies indexes match query patterns and column types fit data |

### Infrastructure Scans (Scanner 22–27)

| Scanner Category | Scanner Checks | LLM Rule(s) | LLM Action |
|-----------------|----------------|-------------|------------|
| Infrastructure | Cloud config, env.yaml, services | COMM-INFRA-001 | **DEEPEN** — Scanner checks known patterns; LLM assesses configuration holistically for the deployment tier |
| Cloud Deployment | SCD strategy, build/deploy phases | COMM-INFRA-001 | **SKIP** — Scanner has specific Cloud-aware checks |
| PHP Deep Analysis | Type safety, null handling, strict_types | COMM-PHP-001 | **EXPAND** — Scanner does basic regex; LLM traces null propagation across methods and assesses PHP 8.x risks |
| Event Observers | Observer registration, scope | COMM-ARCH-005 | **DEEPEN** — Scanner checks XML; LLM analyzes if observer logic is too heavy for the event (e.g., save_after with API call) |
| Module Architecture | Module dependencies, sequence | COMM-ARCH-004 | **DEEPEN** — Scanner checks module.xml; LLM verifies actual `use` statements match declared dependencies |
| Code Metrics | Cyclomatic complexity, method count | COMM-METRICS-001, COMM-METRICS-002 | **SKIP** — Scanner provides exact numeric metrics |
| Case Sensitivity | Class/file name casing mismatches | COMM-DEPLOY-001 | **SKIP** — Scanner is deterministic and complete for this |

### Business Scans (Scanner 28–33)

| Scanner Category | Scanner Checks | LLM Rule(s) | LLM Action |
|-----------------|----------------|-------------|------------|
| Business Logic Identification | Location of business logic | COMM-BIZ-001 | **EXPAND** — Scanner flags heuristics; LLM is primary detector — can understand what is business logic vs. framework glue |
| Business Customization Review | Custom module patterns | — | **EXPAND** — LLM reviews customizations for correctness and upgrade safety |
| Critical Commerce Flows | Checkout/payment/inventory hooks | COMM-FLOW-001 | **EXPAND** — Scanner flags keywords; LLM is primary — analyzes error handling and failure modes in critical paths |
| MSI Inventory & Source Management | Legacy stock API usage | COMM-MSI-001 | **VERIFY** — Scanner flags legacy API; LLM checks if MSI is actually enabled (if disabled, legacy is correct) |
| Admin & Integration Security | Admin controllers, tokens | COMM-SEC-003 | **DEEPEN** — Scanner checks ACL; LLM analyzes admin action security holistically |
| Logical Flow & Cross-Module | Cross-module data flow | — | **EXPAND** — LLM-only capability; traces logic across module boundaries |

### Quality Scans (Scanner 34–42)

| Scanner Category | Scanner Checks | LLM Rule(s) | LLM Action |
|-----------------|----------------|-------------|------------|
| Coding Standards | PSR compliance, naming | COMM-STD-001, COMM-STD-002 | **SKIP** — Scanner + PHPCS handles this deterministically |
| Input Validation & XSS | Missing sanitization, unescaped output | COMM-SEC-004, COMM-INPUT-001 | **DEEPEN** — Scanner finds missing escaper calls; LLM traces if the data is actually user-controlled |
| Frontend Assets | JS/CSS issues | COMM-DEPLOY-007 | **SKIP** — Scanner checks are sufficient |
| Composer & Dependencies | Lock file, version constraints | COMM-COMPOSER-001, COMM-DEPLOY-008 | **VERIFY** — Scanner flags missing lock; LLM checks if constraints are appropriately bounded |
| Full Page Cache & Private Content | FPC compatibility, private content sections | COMM-PERF-002 | **DEEPEN** — Scanner finds violations; LLM analyzes if the page/block should actually be cacheable |
| Backward Compatibility | Interface changes, API breaks | COMM-COMPAT-001 | **EXPAND** — Scanner checks basic patterns; LLM is primary — understands semantic versioning implications |
| Configuration & Scope | system.xml scope, config reading | COMM-CONFIG-001 | **DEEPEN** — Scanner checks patterns; LLM verifies scope consistency end-to-end |
| Layout & UI Components | Layout XML patterns | COMM-LAYOUT-001 | **VERIFY** — Scanner flags remove="true"; LLM checks if the removed block breaks dependent blocks |
| XML Schema Validation | XSD compliance | COMM-XML-001 | **SKIP** — Scanner validates against XSD deterministically |

### Deployment Safety Scans (Scanner 43–56)

| Scanner Category | Scanner Checks | LLM Rule(s) | LLM Action |
|-----------------|----------------|-------------|------------|
| Redis Collision | Prefix/DB conflicts | COMM-DEPLOY-002 | **SKIP** — Scanner detects this deterministically |
| Payment Sandbox | Sandbox mode detection | COMM-DEPLOY-003 | **SKIP** — Scanner detects this deterministically |
| Cron Overlap | Lock mechanism check | COMM-DEPLOY-004, COMM-CRON-001 | **DEEPEN** — Scanner checks for lock keyword; LLM verifies the lock implementation is correct |
| Schema Whitelist Drift | db_schema vs whitelist sync | COMM-DEPLOY-005 | **SKIP** — Scanner compares files deterministically |
| Queue Consumer Limits | Max messages config | COMM-DEPLOY-006, COMM-QUEUE-001 | **SKIP** — Scanner checks XML config values |
| JS Minification | Breakage patterns | COMM-DEPLOY-007 | **SKIP** — Scanner checks patterns |
| Composer Lock | Missing/stale lock | COMM-DEPLOY-008, COMM-COMPOSER-001 | **SKIP** — Scanner checks file existence |
| SCD Mismatch | Locale/theme config | COMM-DEPLOY-009 | **SKIP** — Scanner compares config values |
| Module Sequence | module.xml order | COMM-DEPLOY-010 | **DEEPEN** — Scanner checks XML; LLM verifies actual dependency usage matches declared sequence |
| Hardcoded Env Values | Environment-specific strings | COMM-DEPLOY-011 | **VERIFY** — Scanner flags URLs/IPs; LLM confirms these are truly env-specific vs. legitimate constants |
| Admin Security Defaults | Insecure admin config | COMM-DEPLOY-012 | **SKIP** — Scanner checks config values |
| CSP Gaps | Content Security Policy | COMM-DEPLOY-013 | **VERIFY** — Scanner checks presence; LLM evaluates if policy is too permissive |
| Indexer Issues | Dependency chains | COMM-DEPLOY-014 | **DEEPEN** — Scanner checks config; LLM analyzes reindex cascade impact |
| File Permissions | chmod/chown patterns | COMM-DEPLOY-015 | **SKIP** — Scanner checks patterns |

### DB Analysis Scans (Scanner 41–50)

| Scanner Category | Scanner Checks | LLM Rule(s) | LLM Action |
|-----------------|----------------|-------------|------------|
| DB: Table Structure | Column counts, types | COMM-DBSCHEMA-001 | **SKIP** — Scanner analyzes SQL dump deterministically |
| DB: Index Analysis | Missing/duplicate indexes | COMM-DBSCHEMA-001 | **DEEPEN** — Scanner finds missing indexes; LLM correlates with query patterns in PHP code |
| DB: Column Analysis | Oversized/wrong types | COMM-DBSCHEMA-001 | **SKIP** — Scanner measures column attributes |
| DB: Foreign Keys | Missing/broken FKs | COMM-DBSCHEMA-001 | **SKIP** — Scanner detects from dump |
| DB: Naming Conventions | Table/column naming | — | **SKIP** — Scanner checks patterns |
| DB: Storage Engine | InnoDB vs MyISAM | — | **SKIP** — Scanner checks engine |
| DB: Charset & Collation | utf8 vs utf8mb4 | — | **SKIP** — Scanner checks metadata |
| DB: Adobe Commerce Schema | Magento-specific schema patterns | — | **SKIP** — Scanner has Magento schema knowledge |
| DB: Data Integrity | Orphan references | — | **SKIP** — Scanner queries dump |
| DB: Performance | Large tables, missing partition | — | **DEEPEN** — Scanner flags large tables; LLM suggests partitioning strategy based on access patterns |

---

## LLM Action Summary

| Action | Count | What LLM Does |
|--------|-------|---------------|
| **DEEPEN** | 26 | Scanner found the issue → LLM adds root-cause analysis, cross-file context, remediation priority |
| **VERIFY** | 8 | Scanner flagged → LLM confirms real positive vs false positive using contextual understanding |
| **EXPAND** | 7 | Scanner can't detect this → LLM is primary detector (business logic, cross-module flow, semantic issues) |
| **SKIP** | 19 | Scanner is comprehensive → LLM doesn't re-analyze (avoids noise duplication) |

---

## Full Audit Workflow Using This Crossref

```
Step 1: Run Scanner (Tier 1)
    → Produces findings grouped by category

Step 2: Load this crossref

Step 3: For each category with findings:
    IF action = SKIP → Keep scanner finding as-is
    IF action = DEEPEN → Feed scanner finding to LLM with rule context, get enriched analysis
    IF action = VERIFY → Feed scanner finding to LLM, ask "is this a true positive given the context?"
    IF action = EXPAND → Run LLM analysis on the file set, independent of scanner

Step 4: For categories with EXPAND action (even if scanner found nothing):
    → Run LLM rule against relevant files

Step 5: Merge results:
    - Scanner findings (severity, location, count)
    - LLM enrichments (root cause, cross-file context, remediation priority)
    - LLM unique findings (EXPAND categories)
    - Deduplicate (same file+line → merge into single finding with both perspectives)
```

---

## Rule ID Alignment

When both Scanner and LLM flag the same issue, use the LLM rule ID in the final report for consistency:

| Scanner Finding Type | Maps to LLM Rule ID |
|---------------------|---------------------|
| ObjectManager::getInstance() | COMM-ARCH-001 |
| Plugin on non-interceptable | COMM-ARCH-002 |
| N+1 / load in loop | COMM-PERF-001 |
| Unbounded collection | COMM-PERF-003 |
| Missing FPC compat | COMM-PERF-002 |
| SQL injection | COMM-SEC-002 |
| Missing ACL | COMM-SEC-003 |
| Unescaped output | COMM-SEC-004 |
| God class (lines) | COMM-METRICS-001 |
| Fat constructor (deps) | COMM-METRICS-002 |
| Zero test coverage | COMM-TEST-001 |
| Generic exception | COMM-EXC-001 |
| Missing cache | COMM-CACHE-001 |
| Deprecated API | COMM-DEP-001 |
| Debug output | COMM-LOG-001 |
| File writes | COMM-FS-001 |
| Cron without lock | COMM-CRON-001 |
| Queue without limits | COMM-QUEUE-001 |
| Invalid XML config | COMM-XML-001 |
| Cloud misconfig | COMM-INFRA-001 |
| Type safety | COMM-PHP-001 |
| Breaking interface | COMM-COMPAT-001 |
| Wrong config scope | COMM-CONFIG-001 |
| Layout anti-pattern | COMM-LAYOUT-001 |
| Legacy MSI usage | COMM-MSI-001 |
| Unsafe checkout hook | COMM-FLOW-001 |
| Logic in wrong layer | COMM-BIZ-001 |
| PHP in templates | COMM-FRONT-001 |
| Dependency issues | COMM-COMPOSER-001 |
| Schema issues | COMM-DBSCHEMA-001 |
| Missing validation | COMM-INPUT-001 |
