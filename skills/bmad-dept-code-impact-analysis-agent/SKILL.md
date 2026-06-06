---
name: bmad-dept-code-impact-analysis-agent
description: "Code impact analysis agent (part of BMAD DEPT Code Agent suite). Evaluates blast radius of changes, traces dependency chains, and assesses risk for modifications, upgrades, and patches."
---

# BMAD DEPT Code Agent — Impact Analysis Skill

## Purpose

Evaluates the blast radius of code changes, traces dependency chains, and assesses risk for modifications, upgrades, and patches. Answers "what breaks if I change X?" with evidence-based analysis.

## Activation

This skill activates when the user asks to:
- Analyze impact of a change
- Check what's affected by a modification
- Evaluate blast radius
- Assess upgrade/patch risk
- Trace dependencies
- Check breaking changes

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
question: "What kind of impact analysis do you need?"
options:
  - label: "Trace dependencies"
    description: "Follow the call chain — see what's connected. Fast, rule-based (~1.4K tokens)."
    recommended: true
  - label: "Risk assessment"
    description: "AI evaluates blast radius, likelihood of breakage, and remediation effort. Uses ~22K tokens."
```

**Important:** Always recommend "Trace dependencies" as default. It answers "what's connected" without needing AI inference.

Proceed with the user's chosen mode.

## Workflow

> TODO: Define impact analysis workflow, dependency tracing, and risk scoring.

## Output

> TODO: Define impact report format (affected modules, risk score, remediation effort).
