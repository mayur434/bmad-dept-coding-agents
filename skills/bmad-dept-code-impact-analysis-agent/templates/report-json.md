# Impact Analysis — Output Schema Reference

The impact tracer is **deterministic** — it runs as a TypeScript script and emits `Finding[]` directly to the
standardized report. There is no LLM-generated JSON bridge step. This document describes the `Finding` schema
the tracer produces so you can understand the report columns and help users interpret results.

---

## Finding Schema

Each row in the **Input Traceability** and **Summary** sheets maps to one `Finding`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | `"Bug BUG-42 impacts CartService.php"` or `"Requirement REQ-07: no direct code match"` |
| `description` | string | ✅ | Input item title + clipped description (≤ 240 chars) |
| `stack` | string | ✅ | Resolved engine id (`aem`, `spring`, `commerce-paas`, etc.) |
| `category` | string | ✅ | `"Bug fix impact"` or `"Requirement impact"` |
| `file` | string | matched only | Repo-relative path of the impacted source file |
| `severity` | Severity | ✅ | `CRITICAL` / `HIGH` / `MEDIUM` / `LOW` / `INFO` |
| `confidence` | number | ✅ | 0.0 – 1.0; driven by filename match + symbol count |
| `impact` | string | ✅ | Matched symbols + blast-radius summary, or manual-review note |
| `recommendation` | string | ✅ | Remediation guidance or scope instruction |
| `status` | string | unmatched | `"Needs manual review"` for items with no code match |
| `source` | string | ✅ | `"llm"` (tracer-generated; reuses the shared field) |
| `inputRef.id` | string | ✅ | Input item ID (`BUG-42`, `REQ-07`, row index for unnamed items) |
| `inputRef.type` | string | ✅ | `"bug"` or `"requirement"` |
| `inputRef.title` | string | ✅ | Original title from the Proofhub CSV or BRD |
| `inputRef.source` | string | ✅ | `"proofhub"` or `"brd"` |

### Severity logic

| Condition | Severity |
|-----------|----------|
| Filename matches a candidate symbol AND blast radius ≥ 5 AND input priority HIGH/CRITICAL | `CRITICAL` |
| Filename matches AND blast radius ≥ 3, OR high priority with content match | `HIGH` |
| Content match only (no filename match), moderate blast radius | `MEDIUM` |
| Weak content match, low priority | `LOW` |
| No source file matched any candidate symbol | `INFO` (status: "Needs manual review") |

---

## Annotated Example Output (3 findings)

```json
[
  {
    "title": "Bug BUG-23 impacts CartRepository.php",
    "description": "Checkout total not updating on coupon apply — CartRepository",
    "stack": "commerce-paas",
    "category": "Bug fix impact",
    "file": "app/code/Acme/Checkout/Model/CartRepository.php",
    "severity": "HIGH",
    "confidence": 0.82,
    "impact": "Symbols matched: CartRepository, CartService. Blast radius: 7 files reference this path.",
    "recommendation": "Review CartRepository::recalculate() and all callers; update unit tests for coupon edge cases.",
    "source": "llm",
    "inputRef": {
      "id": "BUG-23",
      "type": "bug",
      "title": "Checkout total not updating on coupon apply",
      "source": "proofhub"
    }
  },
  {
    "title": "Requirement REQ-05 impacts ProductIndexer.java",
    "description": "Add real-time inventory sync to PDP — ProductIndexer",
    "stack": "aem",
    "category": "Requirement impact",
    "file": "core/src/main/java/com/acme/indexer/ProductIndexer.java",
    "severity": "MEDIUM",
    "confidence": 0.61,
    "impact": "Symbols matched: ProductIndexer. Blast radius: 2 files reference this path.",
    "recommendation": "Extend ProductIndexer to consume the inventory events; wire into the Sling scheduler.",
    "source": "llm",
    "inputRef": {
      "id": "REQ-05",
      "type": "requirement",
      "title": "Add real-time inventory sync to PDP",
      "source": "brd"
    }
  },
  {
    "title": "Bug BUG-31: no direct code match",
    "description": "Intermittent 502 on CDN edge nodes under load",
    "stack": "commerce-paas",
    "category": "Bug fix impact",
    "severity": "INFO",
    "confidence": 0.2,
    "impact": "No source file matched the extracted symbols — assess manually (may be infra/config, not PHP).",
    "recommendation": "Manually scope this item; consider adding a module/label or file reference to improve tracing.",
    "status": "Needs manual review",
    "source": "llm",
    "inputRef": {
      "id": "BUG-31",
      "type": "bug",
      "title": "Intermittent 502 on CDN edge nodes under load",
      "source": "proofhub"
    }
  }
]
```

---

## Key report sheets

| Sheet | What it shows |
|-------|--------------|
| **Input Traceability** | One row per (input item → impacted file). Every input item appears — unmatched items show as INFO. |
| **Summary** | All findings ranked by severity, with Impact Analysis (matched symbols + blast radius) and Recommendation columns. |
| **Severity Breakdown** | Count of CRITICAL / HIGH / MEDIUM / LOW / INFO findings. |
| **By Category** | Findings grouped by "Bug fix impact" vs "Requirement impact". |
| **Recommendations** | Deduplicated remediation steps for all non-INFO findings. |
