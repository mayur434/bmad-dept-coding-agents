# Sonar Scan — Shared Severity & Rating Model

Referenced by all 8 rule packs. **Do not duplicate this content in individual rule packs** — link to this file instead.

---

## 1. SonarQube severity → DCA severity mapping

| SonarQube severity | DCA `severity` value | Meaning |
|--------------------|---------------------|---------|
| Blocker | `CRITICAL` | Application crash / data loss / critical security breach |
| Critical | `HIGH` | Major functional defect / high-impact vulnerability |
| Major | `MEDIUM` | Significant quality issue / medium-impact vulnerability |
| Minor | `LOW` | Low-impact issue / style / minor smell |
| Info | `INFO` | Informational / best-practice suggestion |

Always map to these 5 DCA values. Never use Sonar's own severity labels in the `severity` field of `sonar-findings.json`.

---

## 2. The 6 Sonar finding categories

Use these **exact strings** for the `category` field. They drive the By Category sheet and the Vulnerabilities sheet.

| Category | What it covers | Affects rating |
|----------|---------------|----------------|
| `Bug` | Code that is demonstrably wrong or will behave unexpectedly at runtime | Reliability |
| `Vulnerability` | Security weaknesses directly exploitable by an attacker | Security |
| `Security Hotspot` | Security-sensitive code requiring manual review (may or may not be exploitable) | Security |
| `Code Smell` | Maintainability issues — dead code, overly complex methods, inconsistent naming | Maintainability |
| `Duplication` | Repeated logic blocks that should be extracted (> ~10 duplicated lines) | Maintainability |
| `Complexity` | Methods/classes exceeding cognitive-complexity or cyclomatic-complexity thresholds | Maintainability |

---

## 3. Quality ratings (A–E)

Each rating is computed from the worst `severity` among findings in its category group.

| Rating | Worst severity in the group |
|--------|-----------------------------|
| A | No findings (or INFO only) |
| B | At least one LOW |
| C | At least one MEDIUM |
| D | At least one HIGH |
| E | At least one CRITICAL |

**Three ratings computed separately:**

- **Reliability** = worst severity among `Bug` findings
- **Security** = worst severity among `Vulnerability` + `Security Hotspot` findings
- **Maintainability** = worst severity among `Code Smell` + `Duplication` + `Complexity` findings

---

## 4. Quality Gate

The Quality Gate **PASSES** only when all three ratings are A.

```
PASS  ←  Reliability=A AND Security=A AND Maintainability=A
FAIL  ←  any rating is B, C, D, or E
```

The gate verdict and per-rating values are recorded in `RunMeta.extra` and appear on the Run Info sheet and the Recommendations sheet (one row per non-A rating citing the worst finding).

---

## 5. Authoring rules for `recommendation` (enforced)

The `recommendation` field is the primary deliverable for actionable findings. These rules apply to every Vulnerability and Bug. They are strongly encouraged for Code Smell and Complexity findings.

### Required content
- The **exact file and line** the fix applies to
- The **specific code change** needed (not a pattern description)
- For security issues: the **secure alternative** with a concrete code snippet

### Pass/Fail examples

**Vulnerability (SQL Injection):**
- ❌ FAIL: `"Use parameterized queries instead of string concatenation"`
- ✅ PASS: `"Line 42: replace \`query = \"SELECT * FROM users WHERE id='\" + userId + \"'\"\` with a PreparedStatement: \`PreparedStatement stmt = conn.prepareStatement(\"SELECT * FROM users WHERE id=?\"); stmt.setString(1, userId);\`"`

**Vulnerability (Hardcoded Credentials):**
- ❌ FAIL: `"Don't hardcode passwords in source code"`
- ✅ PASS: `"Line 17: remove the literal \`\"admin123\"\` and replace with \`System.getenv(\"DB_PASSWORD\")\`. Rotate the credential immediately. Add DB_PASSWORD to your secrets manager / .env file (gitignored)."`

**Bug (NPE):**
- ❌ FAIL: `"Check for null before dereferencing"`
- ✅ PASS: `"Line 89: \`result.getData().getItems()\` will throw NPE when \`getData()\` returns null (possible when the API returns an empty response). Add: \`if (result.getData() == null || result.getData().getItems() == null) return Collections.emptyList();\` before line 89."`

**Code Smell (Cognitive Complexity):**
- ❌ FAIL: `"Reduce the complexity of this method"`
- ✅ PASS: `"processOrder() in OrderService.java has cognitive complexity 24 (threshold: 15). Extract the \`if (discount > 0)\` block (lines 55–72) into a private \`applyDiscount(Order order)\` method and the \`for (Item item : items)\` block (lines 74–91) into \`validateItems(List<Item> items)\` to bring the main method's complexity to ~8."`

### Confidence field

Set `confidence` (0.0–1.0) honestly:
- `1.0` — you can see the exact vulnerable pattern with a direct code reference
- `0.8` — the pattern is clearly present but you haven't traced all call paths
- `0.6` — the code structure suggests the issue but context is incomplete (e.g. the variable could be validated elsewhere)
- `0.4` — the concern is real but you'd need additional context to confirm (mark as Security Hotspot rather than Vulnerability)
- Below `0.5` — prefer `Security Hotspot` over `Vulnerability` unless the evidence is unambiguous

For `codeRef`/`ruleId` mandatory fields on Vulnerability/Bug: if you cannot determine the file:line, set `confidence: 0.4` and use `Security Hotspot` as the category instead.
