# Sonar Scan Narrative Report Template

Optional markdown narrative produced alongside the JSON findings. Use this
template when the user asks for a written summary of the scan in addition to
the Excel report.

---

# Sonar Scan Report — {{PROJECT_NAME}}

**Stack:** {{STACK_LABEL}}  
**Scanned:** {{TIMESTAMP}}  
**Engineer:** _{{ENGINEER_NAME}}_

---

## Quality Gate: {{QUALITY_GATE}}

| Dimension | Rating | Driver |
|-----------|--------|--------|
| Reliability (Bugs) | {{RELIABILITY_RATING}} | {{RELIABILITY_DRIVER}} |
| Security (Vulns + Hotspots) | {{SECURITY_RATING}} | {{SECURITY_DRIVER}} |
| Maintainability (Smells + Duplication + Complexity) | {{MAINTAINABILITY_RATING}} | {{MAINTAINABILITY_DRIVER}} |

> **Rating scale:** A = no issues, B = LOW, C = MEDIUM, D = HIGH, E = CRITICAL.  
> **Gate:** PASS only when all three ratings are A.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | {{CRITICAL_COUNT}} |
| HIGH | {{HIGH_COUNT}} |
| MEDIUM | {{MEDIUM_COUNT}} |
| LOW | {{LOW_COUNT}} |
| INFO | {{INFO_COUNT}} |
| **Total** | **{{TOTAL_COUNT}}** |

---

## Vulnerabilities & Security Hotspots

_This section lists all Vulnerability and Security Hotspot findings. For the full color-coded table with one-click remediation guidance, see the **Vulnerabilities** sheet of the Excel report._

{{#each VULNERABILITY_FINDINGS}}
### {{severity}} — {{title}}

- **Rule:** `{{ruleId}}`  
- **Location:** `{{codeRef}}`  
- **Description:** {{description}}
- **Recommended Fix:** {{recommendation}}
- **Effort:** {{effort}}

{{/each}}

---

## Bugs

{{#each BUG_FINDINGS}}
### {{severity}} — {{title}}

- **Rule:** `{{ruleId}}`  
- **Location:** `{{codeRef}}`  
- **Fix:** {{recommendation}}

{{/each}}

---

## Code Smells, Duplications & Complexity

{{#each MAINTAINABILITY_FINDINGS}}
- **{{severity}}** `{{ruleId}}` — {{title}} (`{{codeRef}}`)  
  _{{recommendation}}_

{{/each}}

---

## Next Steps

1. Fix all CRITICAL and HIGH Vulnerabilities first (see Vulnerabilities sheet for exact code changes).
2. Address CRITICAL and HIGH Bugs to improve Reliability rating.
3. Tackle MEDIUM Code Smells and Complexity issues to bring Maintainability to A.
4. Re-run the sonar scan after fixes to verify the Quality Gate passes.
