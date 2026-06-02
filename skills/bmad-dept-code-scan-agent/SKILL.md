---
name: bmad-dept-code-scan-agent
description: "Fast deterministic code scanner (part of BMAD DEPT Code Agent suite). Performs static analysis across multiple Adobe platforms and produces structured reports."
---

# BMAD DEPT Code Agent — Scan Skill

## Purpose

Dedicated scanning agent that performs fast, deterministic static analysis on project codebases. Produces structured reports (Excel/JSON) covering security, performance, coding standards, and platform-specific best practices.

## Activation

This skill activates when the user asks to:
- Scan project code
- Run static analysis
- Check code quality quickly
- Generate a scan report
- Find code violations

## Pre-flight: Auto-install Dependencies

```bash
cd {skill_path}/scripts && [ -d node_modules ] || npm install --silent
```

## Consent: Ask Scan Mode

**Direct-intent triggers (skip the question, go straight):**
- "quick scan" / "fast scan" / "scan for issues" → Scanner only
- "deep scan" / "scan with AI" → LLM-assisted scan

**Ambiguous triggers (ask which mode):**
- "scan my code" / "check code" / "run analysis"

When the intent is ambiguous, ask using the interactive question picker. Use the `vscode_askQuestions` tool:

```
question: "How thorough should the scan be?"
options:
  - label: "Quick scan"
    description: "Rule-based check against known patterns. Done in seconds (~1.2K tokens)."
    recommended: true
  - label: "Deep scan"
    description: "AI-assisted analysis for subtle issues rules can't catch. Uses ~18K tokens."
```

**Important:** Always recommend "Quick scan" as default. It covers the most common issues at near-zero cost.

Proceed with the user's chosen mode.

## Workflow

> TODO: Define scanning workflow, engine integration, and output format.

## Output

> TODO: Define report format and output location.
