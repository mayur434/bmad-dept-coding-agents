# Sonar Scan — Findings JSON Template

This is the bridge contract between the LLM scan step (Step 1) and the
deterministic ingest step (Step 2). The field names map directly to the
shared `Finding` interface in `skills/shared/core/types.ts`.

Write the findings to `<output>/sonar-findings.json` using this structure.

---

```json
{
  "meta": {
    "project": "{{PROJECT_NAME}}",
    "engine": "{{ENGINE_ID}}",
    "stack": "{{STACK_LABEL}}",
    "timestamp": "{{TIMESTAMP}}"
  },
  "findings": [
    {
      "title": "{{SHORT_ONE_LINE_TITLE}}",
      "description": "{{FULL_DESCRIPTION_OF_THE_ISSUE}}",
      "stack": "{{ENGINE_ID}}",
      "category": "{{CATEGORY}}",
      "file": "{{FILE_PATH_RELATIVE_TO_PROJECT_ROOT}}",
      "line": {{LINE_NUMBER}},
      "codeRef": "{{FILE_PATH}}:{{LINE_NUMBER}}",
      "code": "{{OFFENDING_CODE_SNIPPET_OPTIONAL}}",
      "severity": "{{SEVERITY}}",
      "confidence": {{CONFIDENCE_0_TO_1}},
      "ruleId": "{{SONAR_RSPEC_KEY}}",
      "recommendation": "{{CONCRETE_ACTIONABLE_FIX_WITH_SPECIFIC_CODE_CHANGE}}",
      "impact": "{{BLAST_RADIUS_OR_CONSEQUENCE}}",
      "effort": "{{S_M_OR_L}}",
      "status": "Open"
    }
  ]
}
```

---

## Field reference

| Field | Required | Allowed values / notes |
|-------|----------|------------------------|
| `title` | **Yes** | Short one-line title (< 80 chars) |
| `description` | No | Full description of why this is an issue |
| `stack` | No | Engine id (e.g. `"aem"`, `"spring"`) |
| `category` | **Yes** | Exactly one of: `"Bug"`, `"Vulnerability"`, `"Security Hotspot"`, `"Code Smell"`, `"Duplication"`, `"Complexity"` |
| `file` | Req for Bug/Vuln | File path relative to project root (e.g. `"src/main/java/Foo.java"`) |
| `line` | Req for Bug/Vuln | Integer line number (1-based) |
| `codeRef` | Req for Bug/Vuln | `"<file>:<line>"` — computed automatically if `file` + `line` are provided |
| `code` | No | The offending code snippet (1–3 lines) |
| `severity` | **Yes** | `"CRITICAL"`, `"HIGH"`, `"MEDIUM"`, `"LOW"`, `"INFO"` |
| `confidence` | No | Float 0.0–1.0 reflecting certainty of the finding |
| `ruleId` | Req for Bug/Vuln | SonarSource RSPEC key (e.g. `"S3649"`, `"S2068"`, `"S3776"`) |
| `recommendation` | **Yes** | Concrete, directly-applicable fix — must cite specific line and code change (see authoring rules in `resources/shared/severity-and-rating-model.md`) |
| `impact` | No | Consequence if not fixed (blast radius, data at risk, etc.) |
| `effort` | No | `"S"` (< 1h), `"M"` (1–4h), `"L"` (> 4h) |
| `status` | No | Default `"Open"` |

---

## Minimal example (one finding per category)

```json
{
  "meta": {
    "project": "my-spring-service",
    "engine": "spring",
    "stack": "Spring Boot",
    "timestamp": "20260119_143022"
  },
  "findings": [
    {
      "title": "SQL Injection in UserRepository.findByFilter()",
      "description": "The username parameter is concatenated directly into a raw JDBC query on line 42, allowing an attacker to inject arbitrary SQL.",
      "stack": "spring",
      "category": "Vulnerability",
      "file": "src/main/java/com/example/UserRepository.java",
      "line": 42,
      "codeRef": "src/main/java/com/example/UserRepository.java:42",
      "code": "String q = \"SELECT * FROM users WHERE username = '\" + username + \"'\";",
      "severity": "CRITICAL",
      "confidence": 0.95,
      "ruleId": "S3649",
      "recommendation": "Replace line 42 with a PreparedStatement: `PreparedStatement stmt = conn.prepareStatement(\"SELECT * FROM users WHERE username = ?\"); stmt.setString(1, username);` — remove the concatenated query string entirely.",
      "impact": "Allows unauthenticated data extraction or modification of the users table.",
      "effort": "S",
      "status": "Open"
    },
    {
      "title": "Optional.get() without isPresent() in OrderService",
      "description": "findById() returns Optional.empty() when the order does not exist. Calling .get() without checking causes NoSuchElementException at runtime.",
      "stack": "spring",
      "category": "Bug",
      "file": "src/main/java/com/example/OrderService.java",
      "line": 87,
      "codeRef": "src/main/java/com/example/OrderService.java:87",
      "severity": "HIGH",
      "confidence": 0.9,
      "ruleId": "S2259",
      "recommendation": "Line 87: replace `orderRepo.findById(id).get()` with `orderRepo.findById(id).orElseThrow(() -> new OrderNotFoundException(\"Order not found: \" + id))`.",
      "effort": "S",
      "status": "Open"
    },
    {
      "title": "processOrder() has cognitive complexity 22",
      "description": "The processOrder() method has a cognitive complexity of 22, exceeding the threshold of 15. Nested if/for/switch chains make it difficult to test and maintain.",
      "stack": "spring",
      "category": "Complexity",
      "file": "src/main/java/com/example/OrderProcessor.java",
      "line": 55,
      "codeRef": "src/main/java/com/example/OrderProcessor.java:55",
      "severity": "MEDIUM",
      "confidence": 1.0,
      "ruleId": "S3776",
      "recommendation": "Extract lines 68–82 (discount logic) into `private BigDecimal applyDiscount(Order order)` and lines 84–96 (item validation) into `private void validateItems(List<Item> items)`. This reduces processOrder() complexity to approximately 8.",
      "effort": "M",
      "status": "Open"
    }
  ]
}
```
