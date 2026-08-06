---
title: Writing Rule Packs
sidebar_position: 3
description: How to write rule packs — the per-stack `.md` files that carry Tier 2 LLM knowledge and cross-reference Tier 1 deterministic scanners.
---

# Writing Rule Packs

Rule packs are the per-stack knowledge base every DCA agent reads. They serve two audiences: the **LLM** (Tier 2 — reasons over source code against the rules) and the **deterministic scanner** (Tier 1 — TypeScript at `scripts/engines/<stack>/`) which references the same rule IDs. Both must stay in sync.

:::note Scope
This page covers rule-pack authoring — the shared vocabulary, structure, and cross-referencing pattern. For a wholly new stack, see [Adding a New Engine](./adding-a-new-engine) first. For a new agent, see [Authoring a New Skill](./authoring-a-new-skill).
:::

---

## 1. Where rule packs live

For the **Audit** and **Sonar Scan** agents:

```
skills/<agent>/resources/rule-packs/<stack>/
├── rules.md          ← Single-file pack (small stacks)
├── security.md       ← Split by category for larger stacks
├── performance.md
└── _category_.json   ← Docusaurus sidebar entry (if published)
```

Rule-pack directory names **match the engine ID** — see [`resources/rule-packs/README.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/README.md) for the authoritative mapping. AEM is the one exception: `aem/` contains two sub-packs (`aemcs/` + `aemams/`) selected by `--platform`.

For the **Impact Analysis** agent, per-stack rules live in [`scripts/engines/profiles.ts`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-impact-analysis-agent/scripts/engines/profiles.ts) as symbol grammar + reverse-dep patterns rather than a `.md` pack.

For the **Test Coverage** agent, per-stack test-generation packs live at `resources/test-generation/<stack>.md`.

---

## 2. Anatomy of a rule pack

Each `rules.md` opens with a short **stack identity** paragraph — what stack this is, what runtime, what the Tier-1 coverage is:

```markdown
# Spring Boot Rules

> **Stack identity:** Spring Boot custom middleware
> (Java 17/21, Jakarta EE, Maven **or** Gradle). Auto-configuration,
> `@RestController`/`@Service`/`@Repository`, Spring Data JPA, Spring Security,
> Actuator, and Spring Cloud Stream (Kafka/RabbitMQ) are the surface.
>
> **Tier-1 coverage:** rules tagged `[scanner: <ID>]` are detected deterministically
> by the tree-sitter AST + config engine at `scripts/engines/spring/`. Untagged
> rules are **Tier-2 (LLM) only** — verify by reading the security config,
> data access, and Actuator/observability wiring.
```

Then rules grouped by category:

```markdown
## Security Configuration Rules

### SPRING-SEC-004: CSRF protection must not be disabled for browser/stateful flows `[scanner: SPRING-SEC-004]`

- **Severity**: High
- **Description**: `http.csrf().disable()` removes CSRF protection. It is only
  acceptable for stateless token-authenticated APIs with no cookie session.

#### Detect — Bad Pattern
- `http.csrf().disable()` on a filter chain that also uses form login / session cookies

#### Detect — Good Pattern
- CSRF left enabled for browser flows; disabled only on clearly stateless JWT/API chains

#### Remediation
Keep CSRF for stateful flows; scope any disable to stateless API chains via `securityMatcher`.
```

Reference implementations to skim before authoring:

- [`resources/rule-packs/spring/rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/spring/rules.md) — Spring Boot (medium pack, clean scanner cross-references).
- [`resources/rule-packs/aem/aemcs/rules.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/aem/aemcs/rules.md) — AEM AaCS (largest pack, ~96 rules; good example of category splitting).
- [`resources/rule-packs/commerce-paas/`](https://github.com/mayur434/bmad-dept-code-agent/tree/main/skills/bmad-dept-code-audit-agent/resources/rule-packs/commerce-paas) — Commerce PaaS (multi-file pack).

---

## 3. Required fields per rule

Every rule ships the same minimum fields.

### Rule ID

Format: `<STACK-PREFIX>-<CATEGORY>-<NNN>`. Stack prefix is uppercase and matches the engine ID; category is 3-4 uppercase letters; number is zero-padded to 3 digits within its category.

| Stack | Prefix | Example |
|-------|--------|---------|
| AEM | `AEM` | `AEM-SEC-001`, `AEM-PERF-012` |
| Commerce PaaS | `COMMERCE` or `PAAS` | `COMMERCE-SEC-004` |
| Commerce SaaS | `CSAAS` | `CSAAS-SEC-001` |
| Sling / Shaft | `SLING` | `SLING-SEC-003` |
| Spring Boot | `SPRING` | `SPRING-SEC-004` |
| App Builder | `APPB` (variant-suffixed) | `APPB-EVT-001`, `APPB-MESH-002` |
| EDS | `EDS` | `EDS-PERF-005` |
| EDS + Commerce | `EDSCOM` | `EDSCOM-CFG-001` |

Category codes reused across packs: `SEC` (Security), `PERF` (Performance), `ARCH` (Architecture), `CFG` (Configuration), `QUAL` (Code Quality), `A11Y` (Accessibility), `SEO`, `DISP` (Dispatcher), `DEP` (Dependencies).

### Severity band

From the shared [Scoring Model](../reference/scoring-model) — one of `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`. The band is authoritative even when the rule pack also carries a numeric score. Consult the audit agent's own `resources/shared/severity-model.md` for the canonical definitions:

- **Critical (9–10)** — production failure, data loss, security breach, compliance violation.
- **High (7–8)** — significantly degrades performance / reliability / maintainability.
- **Medium (4–6)** — code-quality issue with moderate risk; plan to fix in 1–2 sprints.
- **Low (1–3)** — style violations, minor inefficiencies.
- **Info** — informational / best-practice suggestion.

### Detection method

Say how the rule is detected — AST, regex, LLM inference, or heuristic. If it's Tier-1, add the `[scanner: <RULE-ID>]` tag to the heading (see §4).

### Good/bad code examples

Two short code fences under `#### Detect — Bad Pattern` and `#### Detect — Good Pattern`. Keep them minimal — one function, one config block, one line if that's enough. The AI reads these as-is when reasoning about your code.

### Remediation guidance

One or two paragraphs (or a short numbered list) that a developer could act on. Include the API / config / package to reach for, not just "don't do X". Where useful, add a `#### Remediation` code fence with the corrected snippet.

### Confidence guidance (optional)

For rules that are prone to false positives, add a `#### Confidence Notes` section describing the contextual factors that raise or lower confidence (test code vs production, presence of an explicit override comment, systemic vs one-off). See `resources/shared/confidence-scoring.md` for the shared confidence model — Definite / High / Medium / Low / Speculative, computed from a base match score plus corroboration bonus and ambiguity/context penalties, clamped to `[0, 1]`.

---

## 4. Tier 1 vs Tier 2 — how the tag works

Every rule is either:

- **Tier 1 (deterministic).** The scanner at `scripts/engines/<stack>/scanner.ts` (or `lib/scanner/scans-*.ts`) matches the pattern in TypeScript and emits a `Finding` carrying the rule ID. The rule heading MUST be tagged `[scanner: <RULE-ID>]`.
- **Tier 2 (LLM only).** No `[scanner: ...]` tag. The LLM reads the rule pack and reasons over source code by hand. Use Tier 2 for rules that need multi-file context or subjective judgment (architecture, cross-file coupling, business-logic soundness).

**Rule ID matching is load-bearing.** Both tiers must use the exact same rule ID in the exact same case. The rule ID that lands in the report's **Rule ID** column comes from whichever tier fired; downstream consumers (Impact Analysis, chain-all, the [findings cache](../concepts/findings-cache)) key off that ID.

If you promote a rule from Tier 2 to Tier 1 (add scanner coverage later), just add the `[scanner: <RULE-ID>]` tag to the heading — no other rule-pack edit needed.

---

## 5. Writing a deterministic (Tier 1) rule

The scanner lives at `skills/<agent>/scripts/engines/<stack>/scanner.ts` (or under `lib/scanner/scans-*.ts` for larger sets). Emit a `Finding` — the shape from `shared/core/types`:

```typescript
import { Finding } from "../../../../shared/core/types";

const finding: Finding = {
  id: "SPRING-SEC-004",        // matches rule pack heading
  title: "CSRF disabled on stateful chain",
  description: "http.csrf().disable() removes CSRF protection…",
  severity: "HIGH",
  confidence: 0.9,              // Definite — the pattern is unambiguous
  ruleId: "SPRING-SEC-004",
  category: "Security",
  techStack: "spring",
  codeReference: `${filePath}:${line}`,
  recommendation: "Keep CSRF for stateful flows…",
  // impactAnalysis, effort, devComments, owner, status: optional
};
```

Use the **shared AST harnesses** where possible — `skills/shared/{java,js,php}/` ship generic rule modules (secret leaks, SQL injection via string concat, weak hashes, `eval`, `unserialize`, etc.) that Sling / Spring / App Builder / Commerce all reuse. Add stack-specific rules on top.

**Confidence.** Set `confidence` from the shared confidence model (`resources/shared/confidence-scoring.md`). Findings below the configured minimum threshold (default 0.6) are filtered out of the report unless the user opts in.

**Legacy engines and AST supersede.** For AEM / Commerce / EDS / eds-commerce, an AST precision pass in `ast-scan.ts` runs after the legacy regex scan. The AST pass **supersedes** the regex hit at the same `file:line` — so if you add a new AST rule that covers a regex pattern, both can coexist and the AST one wins.

---

## 6. Writing an LLM (Tier 2) rule

Tier 2 rules live entirely in the rule-pack markdown. Author them so an LLM can:

1. **Locate the surface.** State which file types or config sections to open first — the LLM won't grep blindly. Example: "Read every `applicationContext.xml` and `@Configuration` class." or "Open every `di.xml` and every class annotated with `@Interceptor`."
2. **Apply a checklist.** Prefer a short natural-language checklist over prose — the LLM reads it as gates.
3. **Cite evidence.** Ask the LLM to include a `filePath:line` reference in the finding. All standardized-output findings carry a **Code Reference** column; empty values look sloppy in reports.

Example Tier-2 rule (compact):

```markdown
### AEM-ARCH-003: Business logic in HTL templates

- **Severity**: Medium
- **Description**: HTL templates should be presentation-only.
  Logic (loops beyond simple iteration, arithmetic, conditionals
  beyond null-check) belongs in a Sling Model or Use-Object.

#### Read
- Every `.html` under `ui.apps/src/main/content/jcr_root/apps/`
- Every corresponding `.java` Sling Model, if present

#### Checklist
- [ ] Are there `data-sly-test` expressions with more than a null-check?
- [ ] Are there arithmetic or string operations in `${…}` expressions?
- [ ] Are there nested `data-sly-list` blocks with logic inside?

#### Remediation
Move logic into a `@Model`-annotated adapter and expose typed getters.
```

---

## 7. Cross-referencing across agents

Rules can be referenced from multiple agents when useful:

- **Audit ↔ Sonar Scan.** A Sonar rule can cross-reference the Audit rule it derives from — same rule ID, same severity, same fix. Sonar's per-stack rule packs (in the Sonar agent's `resources/rule-packs/<stack>/`) frequently point back to their Audit counterparts.
- **Audit → Impact.** An Audit rule that flags a high-blast-radius pattern (a widely-consumed utility, a public API) becomes an Impact profile hint. See `scripts/engines/profiles.ts` in the Impact agent.
- **Audit → Test Coverage.** Rules that flag under-tested surfaces (uncovered branches, mock defaults, missing test files) can be lifted verbatim into `resources/test-generation/<stack>.md`.

Keep IDs identical when the same rule surfaces in multiple agents. The [findings cache](../concepts/findings-cache) uses rule IDs to correlate cross-agent findings.

---

## 8. Naming conventions summary

| Item | Convention | Example |
|------|-----------|---------|
| Rule-pack directory | matches engine ID | `resources/rule-packs/spring/` |
| Rule ID prefix | uppercase stack prefix | `SPRING-`, `AEM-`, `CSAAS-` |
| Rule ID | `<PREFIX>-<CATEGORY>-<NNN>` | `SPRING-SEC-004` |
| Scanner tag | `[scanner: <RULE-ID>]` in the heading | `### SPRING-SEC-004: … [scanner: SPRING-SEC-004]` |
| Severity | one of the 5 shared bands | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO` |
| Confidence | 0.0–1.0 in the scanner emission | `confidence: 0.9` |

---

## 9. Testing rule packs

Two complementary paths:

- **Deterministic (Tier 1).** Unit tests under `scripts/engines/<stack>/__tests__/` per rule — bad-pattern fixture asserts the finding fires, good-pattern fixture asserts silence. Add one test per rule you add to `scanner.ts`.
- **Smoke (audit / sonar).** Run the agent against a real fixture project of the stack and inspect the standardized `.xlsx` and `.md` — every rule ID you added should appear in the **Rule ID** column of at least one row.

For Sonar Scan specifically, remember it is two-step (LLM produces `sonar-findings.json`, then `run.ts --ingest` builds the report). The rule-pack markdown drives Step 1; Step 2 just deterministically composes the workbook from the JSON, so ingest smoke covers report shape, not rule correctness.

---

## 10. Filing rule contributions

Rule additions ship as ordinary pull requests against [`github.com/mayur434/bmad-dept-code-agent`](https://github.com/mayur434/bmad-dept-code-agent). Include:

- The rule-pack `.md` change (new rule or edited rule).
- The scanner code if the rule is Tier 1 (`scripts/engines/<stack>/scanner.ts` or `lib/scanner/scans-*.ts`).
- Unit tests for Tier-1 rules.
- Fixture updates if you touched a smoke-test fixture.
- A `CHANGE-LOG.md` entry noting the added rule ID(s).
- Any Docusaurus reference-page updates — usually [`website/docs/reference/rule-packs/<stack>.md`](https://github.com/mayur434/bmad-dept-code-agent/tree/main/website/docs/reference/rule-packs) to bump the rule-count line and category table.

For larger rule-pack expansions (a new category, a whole new sub-pack), open a design issue first so we can align on ID naming and scanner strategy.

---

## 11. Related pages

- [Adding a New Engine](./adding-a-new-engine) — the engine your rule pack lives under.
- [Authoring a New Skill](./authoring-a-new-skill) — for a whole new agent.
- [Scoring Model](../reference/scoring-model) — canonical severity / confidence / rating vocabulary.
- [Standardized Outputs Contract](../concepts/standardized-outputs) — where rule IDs surface in the report.
- [Rule Packs Reference](../reference/rule-packs/aem) — the per-stack rule catalog Docusaurus pages consumers read.
