---
title: Scoring Model
sidebar_position: 3
description: The unified severity / confidence / rating vocabulary shared by every DCA agent, plus the 6-factor priority model and Quality Gate logic.
---

# Scoring Model

Every DCA agent (audit, sonar-scan, impact-analysis, test-coverage, generation) emits findings that use the same scoring vocabulary. This page is the canonical reference; the shared module lives at [`skills/shared/scoring/`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/shared/scoring/README.md) and the priority model at [`skills/shared/priority/`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/shared/priority/factors.ts).

Related pages: [Rule Packs](rule-packs/aem) · [Audit](../agents/audit) · [Sonar Scan](../agents/sonar-scan).

---

## 1. Severity

The canonical severity ladder is defined in `shared/core/types` and consists of five values.

| Severity   | Meaning (short) |
|------------|-----------------|
| `CRITICAL` | Production failure, data loss, security breach, compliance breach. |
| `HIGH`     | Significantly degrades performance / reliability / maintainability. |
| `MEDIUM`   | Code-quality issue with moderate risk; plan to fix in 1–2 sprints. |
| `LOW`      | Style violation, minor inefficiency, low production risk. |
| `INFO`     | Informational / best-practice suggestion. |

### 1.1 Score bands

A 0..100 numeric score maps into a severity band as follows.

| Score | Severity |
|-------|----------|
| 90 – 100 | `CRITICAL` |
| 70 – 89 | `HIGH` |
| 40 – 69 | `MEDIUM` |
| 10 – 39 | `LOW` |
| 0 – 9 | `INFO` |

`bandFromScore(n)` performs this mapping (clamped, NaN-safe). `scoreFromBand(sev)` returns a representative score in the middle of the band, useful when priority pipelines compose severities into a priority number.

### 1.2 Helpers

- `mergeSeverity(a, b)` — returns the more severe of two values.
- `worstSeverity(findings)` — worst severity across a batch (empty → `INFO`).
- `severityCounts(findings)` — count-by-band aggregation.

---

## 2. Confidence

Every finding carries a confidence label describing how sure the detector is that the finding is a true positive.

| Label | Meaning |
|-------|---------|
| `high` | Detector saw the exact pattern; false positives unlikely. |
| `medium` | Pattern present but context could change interpretation. |
| `low` | Weak signal; needs human review before acting. |

### 2.1 Decision tree — `computeConfidence(inputs)`

```
detectionMethod:
  ast          → refs ≥ 2  ⇒ high, else medium
  regex        → refs ≥ 3  ⇒ high, refs ≥ 1 ⇒ medium, else low
  llm-inference→ refs ≥ 2  ⇒ medium, else low            (never exceeds medium)
  heuristic    → low                                     (always)

Then:
  - non-AST result that is 'high' but NOT cross-file  ⇒ demote to medium
  - ruleMaturity ∈ {experimental, preview}            ⇒ cap at medium
```

Inputs:

```ts
interface ConfidenceInputs {
  detectionMethod: 'ast' | 'regex' | 'llm-inference' | 'heuristic';
  supportingRefs: number;
  ruleMaturity: 'stable' | 'experimental' | 'preview';
  isCrossFile: boolean;
}
```

### 2.2 Enforcement — `enforceConfidence(finding, inputs?)`

If a finding already has a `confidence` value it is kept. Otherwise the helper computes one from `inputs`, or falls back to `medium` when inputs are missing. The finding is copied (non-mutating).

### 2.3 Legacy adapter — `labelFromNumericConfidence(v)`

Audit findings today emit a float 0..1. Use this adapter to normalise into the label scale: `≥ 0.75 → high`, `≥ 0.5 → medium`, `< 0.5 → low`.

---

## 3. Sonar-style ratings (A–E) {#3-sonar-style-ratings-a-e}

SonarQube-style quality ratings, computed from the worst severity in a category group.

| Rating | Worst severity in the group |
|--------|-----------------------------|
| `A` | INFO only (or no findings) |
| `B` | at least one LOW |
| `C` | at least one MEDIUM |
| `D` | at least one HIGH |
| `E` | at least one CRITICAL |

Three ratings are computed on disjoint category groups:

| Rating | Findings in these categories |
|--------|------------------------------|
| Reliability | `Bug` |
| Security | `Vulnerability`, `Security Hotspot` |
| Maintainability | `Code Smell`, `Duplication`, `Complexity` |

### 3.1 Quality Gate

`computeRatingBundle(findings)` returns all three ratings plus a Quality Gate verdict:

```
PASS  ←  Reliability=A AND Security=A AND Maintainability=A
FAIL  ←  otherwise
```

The Sonar Scan agent emits the verdict on the standardized Excel's **Run Info** sheet plus a dedicated **Quality Gate** row-tint on the Summary. Any non-A rating fails the gate.

---

## 4. Non-fatal posture

Every helper in `skills/shared/scoring/` is non-throwing. Malformed inputs collapse to the safest value (usually `INFO` / `medium` / `A`) so downstream engines never crash on a bad finding.

---

## 5. Six-factor priority model

The unified factor set + per-stack weights derived from the Commerce (Magento 2) test-coverage engine's 6-factor priority model. A factor's "weight" is a 0..10 relative importance — missing factors simply don't contribute (so an engine that only supplies `complexity` still gets a normal 0-100 output).

### 5.1 Factor definitions

| Factor key | Description |
|------------|-------------|
| `complexity` | Cyclomatic complexity of the file — universal signal. |
| `revenue_path` | Commerce/AEM — checkout / order / hero-component flows. |
| `plugin` | Commerce — before/after/around interceptors. |
| `observer` | Commerce — event observers. |
| `api_annotated` | Java `@Api` / Commerce `@api` / Sling `@Servlet` — public surface. |
| `churn` | Git history — commits touching the file in the last 90 days. |
| `fan_in` | Universal — count of reverse-refs to symbols in this file. |
| `security_touch` | Universal — touches auth / crypto / input-validation code. |
| `test_gap` | Universal — no test file exists for this source file. |

### 5.2 Per-stack weights

Values are 0..10 (relative importance). Blank cells mean the factor is not consulted for that stack.

| Factor | commerce | commerce-saas | aem | sling | spring | app-builder | eds | eds-commerce |
|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `complexity` | 8 | 7 | 7 | 7 | 8 | 7 | 7 | 7 |
| `revenue_path` | 9 | 9 | 7 | — | — | — | — | 8 |
| `plugin` | 8 | — | — | — | — | — | — | — |
| `observer` | 6 | — | — | — | — | — | — | — |
| `api_annotated` | 6 | 7 | 7 | 8 | 8 | 7 | — | — |
| `churn` | 6 | 6 | 5 | 5 | 6 | 6 | 6 | 6 |
| `fan_in` | 6 | 6 | 6 | 6 | 7 | 5 | 6 | 6 |
| `security_touch` | 7 | 7 | 7 | 7 | 8 | 8 | 6 | 7 |
| `test_gap` | 5 | 5 | 5 | 5 | 6 | 6 | 5 | 5 |

Stack aliases (see `STACK_ALIASES` in `factors.ts`): `commerce-paas` → `commerce`, `magento` / `magento2` → `commerce`, `aemcs` / `aemaacs` / `aemams` → `aem`, `spring-boot` → `spring`, `app-builder-mesh` / `appbuilder` → `app-builder`, `sling-shaft` → `sling`.

Unknown stack IDs fall back to a **generic profile** consulting `complexity`, `churn`, `fan_in`, `security_touch`, `test_gap` only (all at 5-7).

### 5.3 Score → band mapping

The priority scorer normalises raw factor values into a 0..1 signal, multiplies by weight, sums, and rescales to a 0..100 score:

| Score | Priority band |
|-------|---------------|
| ≥ 75 | `critical` |
| 50 – 74 | `high` |
| 25 – 49 | `medium` |
| 0 – 24 | `low` |

Bands are consumed by the audit/sonar Excel reports to color-tint rows and by the impact-analysis agent to rank blast-radius entries.

---

## 6. Worked example — Quality Gate

Consider a Sonar Scan on an AEM project that returns:

- 2 × Bug (CRITICAL null-pointer dereference, HIGH resource leak)
- 1 × Vulnerability (CRITICAL SQL injection)
- 3 × Security Hotspot (MEDIUM debug endpoints)
- 8 × Code Smell (5 × MEDIUM cognitive complexity, 3 × LOW duplicated literals)
- 1 × Duplication (LOW unused method)
- 2 × Complexity (MEDIUM methods over 80 lines)

Compute per-category severity counts:

| Category group | Findings | Worst severity | Rating |
|----------------|----------|----------------|--------|
| Reliability (Bug) | 2 | CRITICAL | `E` |
| Security (Vulnerability + Security Hotspot) | 4 | CRITICAL | `E` |
| Maintainability (Code Smell + Duplication + Complexity) | 11 | MEDIUM | `C` |

**Quality Gate:** `FAIL` — the Reliability and Security ratings are `E` and Maintainability is `C`; a PASS requires all three to be `A`.

**Overall severity counts** (for the Summary sheet):

| Severity | Count |
|----------|:-----:|
| `CRITICAL` | 2 |
| `HIGH` | 1 |
| `MEDIUM` | 10 |
| `LOW` | 4 |
| `INFO` | 0 |

The **priority** column is computed per finding using the AEM weights above — a CRITICAL vulnerability on a `revenue_path` file with high `fan_in` scores near 90 (band = `critical`), while a MEDIUM cognitive-complexity smell on a low-`churn` utility scores near 30 (band = `medium`).
