---
id: test-coverage
title: Test Coverage
sidebar_position: 5
description: Copy-paste prompts for the Test Coverage agent — per-framework gap analysis, real coverage, LLM test generation, and mutation testing.
---

Copy-paste prompts for the **Test Coverage agent** (`bmad-dept-code-test-coverage-agent`). Tier 1 is deterministic gap analysis + real line/branch coverage (JaCoCo / Istanbul / LCOV / Clover). Tier 2 is LLM test generation to 100% per framework.

Source: extracted from [`PROMPTS.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/PROMPTS.md) §5. Related: [Test Coverage agent](../../agents/test-coverage) · [CLI Flags](../cli-flags).

---

## 1. Gap analysis only (all stacks)

```text
analyze test coverage
show untested code
show highest-priority untested code
what's the test coverage for src/Model/OrderProcessor.php
analyze test coverage for the Checkout module
create test plan
```

---

## 2. Real coverage — existing report

```text
analyze coverage from my JaCoCo report at target/site/jacoco/jacoco.xml
analyze coverage --coverage-report target/site/jacoco/jacoco.xml
analyze coverage --coverage-report coverage/coverage-final.json
analyze coverage --coverage-report clover.xml
analyze coverage --coverage-report lcov.info
analyze test coverage from the Istanbul JSON at ./coverage/coverage-final.json
```

---

## 3. Real coverage — `--run-coverage`

```text
run the coverage tool and report real line/branch coverage
analyze test coverage --run-coverage
analyze test coverage --run-coverage --engine spring
analyze test coverage --run-coverage --engine commerce-paas
analyze test coverage --run-coverage --engine eds
```

---

## 4. Test generation to 100% — per framework

### JUnit 5 + AEM Mocks / Sling Mocks (AEM)

```text
generate JUnit tests for the ArticleModel using AEM Mocks
write Sling Mocks tests for the resolver factory
generate unit tests for my Sling Model at 100% coverage
generate a JUnit 5 test class for HeroModel with WCMio context
```

### JUnit 5 + Sling Mocks (Sling / Shaft)

```text
generate Sling Mocks tests for the OrderSyncService
write JUnit tests for the OrderStatusServlet
generate integration tests for the Sling filter chain
```

### Spring Test / MockMvc / Testcontainers (Spring Boot)

```text
generate JUnit tests for the OrderService
generate MockMvc tests for OrdersController
generate Testcontainers-backed integration tests for the JPA repo
generate @DataJpaTest tests for the ProductRepository
generate @WebMvcTest for the auth filter chain
```

### PHPUnit / MFTF (Commerce PaaS)

```text
write PHPUnit tests for the ShipmentPlugin
generate PHPUnit tests for the OrderExport service
generate MFTF tests for the checkout flow
generate integration tests for the custom REST endpoint
generate api-functional tests for the WebAPI endpoint
```

### Jest + jsdom (App Builder / EDS / Commerce SaaS)

```text
generate Jest tests for the price-tile block
generate Jest tests for the hero block
generate Jest tests for the order-sync App Builder action
write jsdom-based tests for the storefront drop-in
generate Jest tests for the Catalog Service query wrapper
```

---

## 5. Full cycle (gap → generate → verify)

```text
full test coverage
full test coverage for the Payment module
find and fill test gaps in the Catalog module
generate tests for the Checkout module
generate unit tests for src/Model/OrderProcessor.php
generate integration tests for the Payment API
create unit tests for the CartService class
```

Chain the whole loop:

```text
run coverage gap analysis with --run-coverage, LLM-generate tests for every gap, re-run coverage, and report the delta
```

---

## 6. Mutation testing prompts

### Pitest (JVM — Spring / Sling / AEM)

```text
run Pitest mutation coverage on the Order module
generate Pitest configuration for the payments package with STRONGER mutators
report the mutation score by class
which mutants escaped — cluster them by mutator type
generate JUnit tests that kill the top-10 surviving mutants
```

### Stryker (JavaScript — EDS / Commerce SaaS / App Builder)

```text
run Stryker mutation testing on blocks/product-details
generate stryker.conf.json for the storefront project
report the mutation score per block
kill the surviving mutants in blocks/cart-preview by adding Jest cases
```

### Infection (PHP — Commerce PaaS)

```text
run Infection mutation testing on app/code/Acme
generate infection.json.dist for the Acme_Foo module
report the MSI (mutation score indicator) per class
propose PHPUnit cases that kill the surviving mutants in ShipmentPlugin
```

---

## 7. `--run-coverage` composed prompts

```text
analyze coverage with --run-coverage and --frameworks unit,integration
analyze coverage --run-coverage --strategy annotation
run coverage tool then compare against baseline branch
run coverage and fail if line % drops below 80
run --run-coverage in interactive mode so I can pick frameworks
```

---

## 8. Post-analysis follow-ups

```text
show the test coverage report
how much test coverage did we gain?
compare pre and post coverage %
which files are still below the 80% branch threshold?
which packages have the highest test-gap risk score?
generate a Jira-ready ticket per uncovered class
export the coverage delta as CSV
```
