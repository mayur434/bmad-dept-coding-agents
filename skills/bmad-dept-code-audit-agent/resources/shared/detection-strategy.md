# Detection Strategy

## Multi-Pass Analysis Approach

The audit uses a 4-pass strategy to ensure deep, context-aware analysis rather than surface-level pattern matching.

## Rule Anatomy

Every rule in a rule pack provides these sections for deep analysis:

| Section | Purpose |
|---------|---------|
| **Description** | What the rule checks and why it matters |
| **Severity** | Impact level (critical/high/medium/low) |
| **Detect — Files to Scan** | Glob patterns of files where this rule applies |
| **Detect — Bad Pattern** | Exact code patterns, regex, or structural signals indicating violation |
| **Detect — Good Pattern** | What compliant code looks like (to confirm violation by contrast) |
| **Bad Example** | Complete code snippet showing the violation in realistic context |
| **Good Example** | Complete code snippet showing the correct implementation |
| **False Positives** | Conditions where the pattern matches but is NOT a violation |
| **Related Rules** | Other rules to check when this one fires |
| **References** | Official documentation links for authoritative guidance |
| **Remediation** | Step-by-step fix instructions |

## File Targeting Strategy

Rather than scanning every file for every rule, rules declare which files they apply to:

```
files_to_scan: "core/**/*.java"           # Only Java files in core
files_to_scan: "ui.apps/**/**.xml"         # Only XML in ui.apps
files_to_scan: "blocks/**/*.{js,css}"      # JS/CSS in blocks folder
files_to_scan: "app/code/**/*.php"         # PHP in app/code
```

This ensures:
- Fast analysis (skip irrelevant files)
- Reduced false positives (rules only fire in relevant context)
- Clear audit scope per rule

## Confidence Boosting Techniques

### Corroboration
When one finding is detected, check for corroborating evidence:
- If resource resolver leak found → also check if there's a matching unit test (if yes, lower confidence slightly — devs may be aware)
- If N+1 query found → check if there's a collection join alternative nearby (unused = stronger signal)

### Context Awareness
- Ignore violations in test code (`*Test.java`, `*.spec.js`, `*.test.ts`) unless testing rules are loaded
- Weight violations in critical paths higher (checkout flow, auth, data persistence)
- Consider file modification recency (recently touched = higher priority to fix)

### Semantic Understanding
- Don't just match text patterns — understand the code's intent
- A `try-catch` that swallows exceptions is different from one that logs and rethrows
- A `document.querySelector` in a utility function passed the block element is fine vs one using global selectors

## Systemic Pattern Detection

When the same rule is violated 3+ times across different files/modules, escalate to an **architectural finding**:

| Individual Finding | Systemic Pattern |
|-------------------|------------------|
| Single N+1 query | "Codebase lacks data access layer pattern" |
| Single XSS | "Missing output encoding strategy" |
| Single hardcoded URL | "No environment configuration strategy" |

Systemic findings go in the Executive Summary and trigger architecture-level recommendations.

## Cross-File Tracing

For security and data-flow rules, trace across files:

1. **Source**: Where does untrusted data enter? (request params, user input, external API)
2. **Propagation**: How does it flow through the code? (assignments, function params, returns)
3. **Sink**: Where does it reach a sensitive operation? (SQL query, HTML output, file write)

If a complete source→sink path exists without sanitization, confidence is maximum (0.95+).

## Full Audit Mode: Scanner + LLM Sync Strategy

When running **Full Audit (Tier 1 + Tier 2)**, use the cross-reference mapping in `resources/shared/scanner-llm-crossref.md` to coordinate how the LLM processes scanner findings.

### LLM Actions per Scanner Finding

| Action | LLM Behavior |
|--------|-------------|
| **DEEPEN** | Scanner found the issue. LLM adds root-cause analysis, cross-file tracing, and remediation priority. Don't re-detect — enrich. |
| **VERIFY** | Scanner flagged it, but may be false positive. LLM uses contextual understanding to confirm or dismiss. |
| **EXPAND** | Scanner can't detect this category. LLM is the primary detector — run full semantic analysis independent of scanner. |
| **SKIP** | Scanner is comprehensive and deterministic. LLM does not re-analyze (avoids noise/duplication). |

### Deduplication Rules

When both tiers flag the same file + line:
1. Use the LLM rule ID (e.g., `COMM-ARCH-001`) as the canonical identifier
2. Merge scanner's exact location data with LLM's semantic context
3. Take the higher severity if they differ
4. Combine recommendations (scanner's quick fix + LLM's architectural suggestion)

### Priority of LLM Effort

In Full Audit mode, allocate LLM analysis time in this order:
1. **EXPAND** categories (only LLM can detect) — highest priority
2. **DEEPEN** on CRITICAL/HIGH scanner findings — add root-cause context
3. **VERIFY** flagged items — confirm or dismiss false positives
4. **DEEPEN** on MEDIUM scanner findings — if time/token budget allows
5. **SKIP** — never analyze these
