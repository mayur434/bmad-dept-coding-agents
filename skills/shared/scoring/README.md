# DCA Shared — Scoring Model

One unified scoring vocabulary shared by every DCA agent (audit, generation,
impact-analysis, test-coverage, sonar-scan). Consumers should link to this
file from their SKILL.md rather than restating the thresholds themselves.

---

## 1. Severity

The canonical severity ladder is defined in `../core/types` and consists of
five values:

| Severity   | Meaning (short)                                                    |
|------------|--------------------------------------------------------------------|
| `CRITICAL` | Production failure, data loss, security breach, compliance breach. |
| `HIGH`     | Significantly degrades performance / reliability / maintainability.|
| `MEDIUM`   | Code-quality issue with moderate risk; plan to fix in 1–2 sprints. |
| `LOW`      | Style violation, minor inefficiency, low production risk.          |
| `INFO`     | Informational / best-practice suggestion.                          |

### 1.1 Score bands

A 0..100 numeric score maps into a severity band as follows:

| Score      | Severity   |
|------------|------------|
| 90 – 100   | `CRITICAL` |
| 70 – 89    | `HIGH`     |
| 40 – 69    | `MEDIUM`   |
| 10 – 39    | `LOW`      |
| 0 – 9      | `INFO`     |

`bandFromScore(n)` performs this mapping (clamped, NaN-safe).
`scoreFromBand(sev)` returns a representative score in the middle of the
band, useful when priority pipelines need to compose severities into a
priority number.

### 1.2 Helpers

- `mergeSeverity(a, b)` — returns the more severe of two values.
- `worstSeverity(findings)` — worst severity across a batch (empty → `INFO`).
- `severityCounts(findings)` — count-by-band aggregation.

---

## 2. Confidence

Every finding should carry a confidence label describing how sure the
detector is that the finding is a true positive.

Three-level scale:

| Label    | Meaning                                                          |
|----------|------------------------------------------------------------------|
| `high`   | Detector saw the exact pattern; false positives unlikely.        |
| `medium` | Pattern present but context could change interpretation.         |
| `low`    | Weak signal; needs human review before acting.                   |

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

If a finding already has a `confidence` value it is kept. Otherwise the
helper computes one from `inputs`, or falls back to `'medium'` when inputs
are missing. The finding is copied (non-mutating).

### 2.3 Legacy adapter — `labelFromNumericConfidence(v)`

Audit findings today emit a float 0..1. Use this adapter to normalise into
the label scale: `≥ 0.75 → high`, `≥ 0.5 → medium`, `< 0.5 → low`.

---

## 3. Ratings (A–E)

SonarQube-style quality ratings, computed from the worst severity in a
category group.

| Rating | Worst severity in the group |
|--------|-----------------------------|
| `A`    | INFO only (or no findings)  |
| `B`    | at least one LOW            |
| `C`    | at least one MEDIUM         |
| `D`    | at least one HIGH           |
| `E`    | at least one CRITICAL       |

Three ratings are computed on disjoint category groups:

| Rating          | Findings in these categories               |
|-----------------|--------------------------------------------|
| Reliability     | `Bug`                                      |
| Security        | `Vulnerability`, `Security Hotspot`        |
| Maintainability | `Code Smell`, `Duplication`, `Complexity`  |

### 3.1 Quality Gate

`computeRatingBundle(findings)` returns all three ratings plus a Quality
Gate verdict:

```
PASS  ←  Reliability=A AND Security=A AND Maintainability=A
FAIL  ←  otherwise
```

---

## 4. Non-fatal posture

Every helper in this module is non-throwing. Malformed inputs collapse to
the safest value (usually `INFO` / `medium` / `A`) so downstream engines
never crash on a bad finding.
