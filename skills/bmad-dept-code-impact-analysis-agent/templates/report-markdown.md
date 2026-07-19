# Impact Analysis — Optional Narrative Template

The primary output is the standardized Excel report (`impact-<branch>-<timestamp>-agent-report.xlsx`) and its
auto-generated Markdown twin, both emitted by the shared output layer. This template is for producing an
**optional executive narrative** when the user explicitly asks for a written summary alongside the report.

Use it after the tracer has run and the report exists.

---

# Impact Analysis — {{PROJECT_NAME}}

**Stack:** {{STACK_LABEL}}
**Inputs:** {{INPUT_SUMMARY}}
**Analyzed:** {{TIMESTAMP}}

---

## Executive Summary

> {{ONE_PARAGRAPH_SUMMARY}}
> e.g. "The 12 Proofhub bugs touch 34 files across the Checkout and Catalog modules. 3 findings are CRITICAL
> (high blast radius in CartService and ProductRepository). 6 items had no direct code match and need manual scoping."

---

## Risk Overview

| Severity | Count | Key areas |
|----------|-------|-----------|
| CRITICAL | {{CRITICAL_COUNT}} | {{CRITICAL_MODULES}} |
| HIGH | {{HIGH_COUNT}} | {{HIGH_MODULES}} |
| MEDIUM | {{MEDIUM_COUNT}} | {{MEDIUM_MODULES}} |
| LOW | {{LOW_COUNT}} | — |
| INFO (no match) | {{INFO_COUNT}} | Needs manual review |
| **Total findings** | **{{TOTAL_COUNT}}** | |

---

## Top Impact Items

_List the CRITICAL and HIGH findings with their blast-radius summary._

{{#each TOP_FINDINGS}}
### {{severity}} — {{title}}

- **Input:** {{inputRef.type}} `{{inputRef.id}}` — {{inputRef.title}} _(from {{inputRef.source}})_
- **File:** `{{file}}`
- **Blast radius:** {{blast_radius_note}}
- **Recommendation:** {{recommendation}}

{{/each}}

---

## Items Needing Manual Review

_These input items produced no code match — they may be infra, content, or new-feature items with no existing file._

| Input ID | Title | Source |
|----------|-------|--------|
{{#each UNMATCHED_ITEMS}}
| {{id}} | {{title}} | {{source}} |
{{/each}}

---

## Next Steps

1. Fix CRITICAL items first — these have the highest blast radius and will affect the most downstream code.
2. Review INFO items manually — add module/label hints to the Proofhub export or BRD to improve tracing on re-run.
3. Re-run with `--create-branch` to work on a clean branch: `npx ts-node run.ts --bugs bugs.csv --path . --create-branch`
4. Use the **Input Traceability** sheet in the Excel report for a complete (input item → file) mapping.
