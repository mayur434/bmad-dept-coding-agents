---
name: bmad-dept-code-impact-analysis-agent
description: "Code impact analysis agent (part of BMAD DEPT Code Agent suite). Evaluates blast radius of changes, traces dependency chains, and assesses risk for modifications, upgrades, and patches."
---

# BMAD DEPT Code Agent — Impact Analysis Skill

## Purpose

Takes a **Proofhub bug export (CSV)** and/or a **BRD document (Word/Markdown/text)** as input, traces each
bug/requirement onto the impacted code, computes the **blast radius** (reverse dependencies), scores risk, and
emits the standardized impact report — including an **Input Traceability** sheet mapping every input item to
the code it touches. Answers "what does fixing this bug / building this requirement affect?"

## Activation

This skill activates when the user asks to:
- Analyze the impact of a Proofhub bug list / bug export
- Analyze the impact of a BRD / requirements document
- Check what code is affected by a set of bugs/requirements
- Evaluate blast radius of planned changes
- Trace dependencies for a change set

## Pre-flight: Auto-install Dependencies

```bash
cd {skill_path}/scripts && [ -d node_modules ] || npm install --silent
```

## Consent: Ask Analysis Mode

**Direct-intent triggers (skip the question, go straight):**
- "trace dependencies" / "what uses X" / "dependency chain" → Static trace
- "upgrade risk" / "what breaks if" / "blast radius" → AI-assisted analysis

**Ambiguous triggers (ask which mode):**
- "impact analysis" / "analyze impact" / "check impact"

When the intent is ambiguous, ask using the interactive question picker. Use the `vscode_askQuestions` tool:

```
question: "What are you trying to understand?"
options:
  - label: "What's connected to this?"
    description: "I'll trace the dependency chain and show you what touches what. Fast and light (~1.4K tokens)."
    recommended: true
  - label: "What could break?"
    description: "I'll assess the risk — how likely things are to break and what to watch out for. Uses ~22K tokens."
```

**Important:** Always recommend "What's connected to this?" as default. It answers the connectivity question without needing AI inference.

Proceed with the user's chosen mode.

## Workflow

1. **Collect inputs** — a Proofhub CSV export (`--bugs`) and/or a BRD (`--brd`). At least one is required.
   - Proofhub columns are auto-detected by header keyword (Task ID / Title / Description / Priority / Labels);
     the run log prints the resolved mapping so a mismatched export is obvious. BRDs are split into
     requirements by headings / numbered sections. Google Docs → export to `.docx` or `.txt` first.
2. **Resolve the stack** — auto-detected, or `--engine <id>` (see `--list-engines`). Supported:
   `commerce-paas`, `app-builder`, `spring`, `sling`, `aem` (AEMaaCS + AMS), `eds`, `eds-commerce`
   (aliases: `aemcs`/`aemams` → `aem`, `commerce` → `commerce-paas`).
3. **Trace** — for each bug/requirement the engine extracts candidate symbols (class names, file/module names,
   paths), scores source files by filename + content match, then computes the **reverse-dependency blast
   radius** (who references each impacted file). Risk = match strength × blast radius × input priority.
4. **Emit** the standardized report + CHANGE-LOG.

```bash
cd {skill_path}/scripts
npx ts-node run.ts --path {project} --bugs proofhub-export.csv
npx ts-node run.ts --path {project} --brd requirements.docx --engine spring
npx ts-node run.ts --path {project} --bugs bugs.csv --brd brd.md
npx ts-node run.ts --list-engines
```

## Output

`impact-<branch>-<timestamp>-agent-report.xlsx` (+ markdown twin) and `CHANGE-LOG.md`, via the shared
standardized report. Key sheet: **Input Traceability** — one row per (input item → impacted file) with
Input ID, type (bug/requirement), impacted title, code reference, severity, impact analysis (symbols matched
+ blast radius), and recommendation. Plus Summary, Severity Breakdown, By Category, and Recommendations sheets.
Every input item appears — items with no code match are flagged **"Needs manual review"** (INFO) so nothing is
silently dropped.

> **Note on fidelity:** tracing is heuristic (symbol/identifier matching + reverse-reference), not full
> type-resolved data-flow — it favors recall and always lists its evidence (matched symbols) so a reviewer can
> confirm. Enrich Proofhub items with a module/label or a file/class name to sharpen matches.
