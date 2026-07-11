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

## Preflight — report the user's LLM & recommend a mode (do this first, conversationally)

The moment this command is triggered from an AI assistant (GitHub Copilot, Claude, Cursor, or any LLM), run the
preflight and tell the user — in one line — **which LLM they're on** and **whether to lean on the Static engine
or the LLM**:

```bash
npx ts-node scripts/run.ts --path {project} --bugs {csv} --preflight
```

It prints the detected **model + context window**, the **project size** (files/LOC/tokens), the **fit** (% of the
window), and a **recommendation** — **STATIC** (Tier-1 deterministic tracer) when the project is large, **LLM**
(Tier-2 semantic) when it comfortably fits, or **HYBRID**. Surface it like:
*"You're on `<model>` (~`<ctx>` context). This project is ~`<pct>%` of your window → I recommend **<mode>**. Proceed?"*
then run the full command (the advisory also prints on every normal run unless `--no-preflight`).

**Rule of thumb:** run the Static (Tier-1) tracer to map bugs/requirements → code deterministically, then use the
LLM (Tier-2) to interpret the traceability + blast radius. Lean more on the LLM only when the project fits the window.

## Pre-flight: Auto-install Dependencies

```bash
cd {skill_path}/scripts && [ -d node_modules ] || npm install --silent
```

## Consent: Ask Analysis Mode

**Direct-intent triggers (skip the question, go straight):**
- "trace dependencies" / "what uses X" / "dependency chain" → run the tracer, present the traceability as-is
- "upgrade risk" / "what breaks if" / "blast radius" → run the tracer, then have the LLM interpret the blast radius

Both intents run the **same deterministic tracer** — these are natural-language intent phrases, not CLI flags, and
they differ only in how much the LLM interprets the result afterward. STATIC vs LLM/HYBRID is an advisory from
preflight, not a switch that changes tracer behaviour.

**Ambiguous triggers (ask which mode):**
- "impact analysis" / "analyze impact" / "check impact"

When the intent is ambiguous, ask using the interactive question picker. Use the `vscode_askQuestions` tool:

```
question: "What are you trying to understand?"
options:
  - label: "What's connected to this?"
    description: "I'll run the tracer and show you what touches what. Fast and light — deterministic, no AI inference."
    recommended: true
  - label: "What could break?"
    description: "I'll run the same tracer, then interpret the risk — how likely things are to break and what to watch out for. Uses more tokens."
```

**Important:** Always recommend "What's connected to this?" as default. It answers the connectivity question without needing AI inference.

Proceed with the user's chosen mode.

## Workflow

1. **Collect inputs** — a Proofhub CSV export (`--bugs`) and/or a BRD (`--brd`). At least one is required.
   - Proofhub columns are auto-detected by header keyword (Task/Bug ID, Title, Description, Module/Label,
     Priority, Status — the first header containing the keyword wins, so this is not a fixed schema); the run
     log prints the resolved mapping so a mismatched export is obvious. `.docx` BRDs are read as raw text (via
     mammoth); any other extension (`.md`/`.txt`) is read as UTF-8 text. BRDs are split into requirements by
     Markdown/numbered headings, REQ/FR/NFR/US/BR ids, or `Label:` lines (falling back to blank-line paragraphs
     when no heading is found). Google Docs → export to `.docx` or `.txt` first.
2. **Resolve the stack** — auto-detected, or `--engine <id>` (see `--list-engines`). Supported (8):
   `commerce-paas`, `commerce-saas`, `app-builder`, `spring`, `sling`, `aem` (AEMaaCS + AMS), `eds`, `eds-commerce`
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

`impact-<branch>-<timestamp>-agent-report.xlsx` (+ markdown twin) and an appended `CHANGE-LOG.md`, via the shared
standardized report (written to `--output` or the default `<project>/impact-reports`). Key sheet:
**Input Traceability** — one row per (input item → impacted file) with Input ID, Input Type (bug/requirement),
impacted title, code reference, severity, impact analysis (symbols matched + blast radius), and recommendation.
Plus Run Info, Summary, Severity Breakdown, By Category, and Recommendations sheets. Every input item appears —
items with no code match are flagged **"Needs manual review"** (INFO) so nothing is silently dropped.

Pass `--create-branch` (optionally with `--source-branch <name>`) to first cut the standard working branch
`dca/impact-<stack>-<timestamp>` from `production`/`main`/`master`/`develop` before the outputs are written.

> **Note on fidelity:** tracing is heuristic (symbol/identifier matching + reverse-reference), not full
> type-resolved data-flow — it favors recall and always lists its evidence (matched symbols) so a reviewer can
> confirm. Enrich Proofhub items with a module/label or a file/class name to sharpen matches.
