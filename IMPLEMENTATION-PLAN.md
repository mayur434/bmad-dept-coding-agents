# Implementation Plan / Roadmap

> This file is a **pointer**. Delivered-feature reality and the phased roadmap now live on the Docusaurus site.

**Source of truth:** **[Roadmap →](https://mayur434.github.io/bmad-dept-code-agent/roadmap)** on [mayur434.github.io/bmad-dept-code-agent](https://mayur434.github.io/bmad-dept-code-agent).

Delivery status snapshot: all 45 coverage cells (5 agents × 9 in-scope tech-stack variants, served by 8 engine stacks) are ✅ complete. Open enhancements — Shaft KB finalize, XML-config AST scanning, Proofhub ColumnMap CLI flag, BRD source expansion — are tracked on the roadmap page.

For the standardized outputs contract, see [Concepts → Standardized Outputs](https://mayur434.github.io/bmad-dept-code-agent/concepts/standardized-outputs). For per-stack knowledge coverage, see [Concepts → The 8 Stacks](https://mayur434.github.io/bmad-dept-code-agent/concepts/the-8-stacks) and [Reference → Rule Packs](https://mayur434.github.io/bmad-dept-code-agent/reference/rule-packs/aem).

---

## Locked decisions (2026-07-09) — historical record

Preserved verbatim from the original plan for context on why the module looks the way it does today:

1. **Tooling stays TypeScript** (extend, no Python rewrite).
2. **Deep per-stack LLM context lives in each agent's own `resources/`** (self-contained; accepted duplication).
3. **EDS is in scope and critical.**
4. **Commerce = both PaaS and SaaS.**
5. **Shaft = Apache Sling/Felix/Oak/JCR** (same family as AEM; only SAM + MDM + connectors are net-new to the KB).
