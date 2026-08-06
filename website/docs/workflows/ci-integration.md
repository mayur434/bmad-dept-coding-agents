---
id: ci-integration
title: CI Integration
sidebar_position: 3
description: Wire DCA into GitHub Actions or GitLab CI — Sonar Quality Gate as a required check, delta gate via --since, CI-safe flag pattern.
---

# CI Integration

DCA agents are CLI-first — every dispatcher is a plain `ts-node` script that returns a real exit code. That makes them wireable as required checks with no adapter code.

## SARIF export — status

- **Planned.** A first-class SARIF exporter is on the [roadmap](../roadmap).
- **Current CI path.** Use the Sonar Scan agent's `--focus` filter and Quality Gate exit code — that's the deterministic CI gate today. Any DevOps role's report can also be post-processed into SARIF by the agent runner if your CI insists on it.

## The CI-safe invocation pattern

Four flags every CI job should pass:

| Flag | Purpose |
|------|---------|
| `--yes-install` | Skip the first-run install prompt (installs `shared/` + agent `scripts/` silently). |
| `--technical` | Force technical intake mode — missing required inputs error out instead of blocking on an interactive prompt. |
| `--role devops` | The DevOps role's defaults (Scan Only, SARIF-shaped output on Audit; CI-friendly exit code on Sonar). |
| `--no-fail=false` on Sonar | **The default** — exit `1` when the Quality Gate is FAIL so CI marks the job red. Pass `--no-fail` only if you have your own gate logic. |

Baseline command:

```bash
npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
  --ingest ./sonar-reports/sonar-findings.json \
  --path . \
  --yes-install --technical --role devops
```

Exit codes to expect:

| Code | Meaning |
|------|---------|
| `0` | Success. Sonar Quality Gate PASS (all three ratings A). |
| `1` | Sonar Quality Gate FAIL (or any other agent runtime error). |
| `2` | `--no-install` was passed and deps were missing. |
| `3` | User declined the first-run install prompt. |
| `4` | Bootstrap install failed. |

## Delta gate

Combine the Audit agent's `--since` flag with a required check to fail the build when a branch adds CRITICAL/HIGH findings vs a previous-release tag:

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --path . --role devops --yes-install --technical \
  --since release/2026.07
```

The **Delta** sheet appended to the workbook buckets new / fixed / persisting findings. Fail the CI job when the `new` bucket contains any CRITICAL or HIGH severity.

## GitHub Actions

```yaml
name: DCA Quality Gate

on:
  pull_request:
    branches: [main]

jobs:
  sonar-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # required for --since <ref>
      - uses: actions/setup-node@v4
        with:
          node-version: '20.12'
      - name: Install DCA deps (once)
        run: |
          cd .claude/skills/shared && npm ci
          cd ../bmad-dept-code-sonar-scan-agent/scripts && npm ci

      # Step 1 — LLM sonar scan (produces sonar-findings.json).
      # In a CI job you typically produce sonar-findings.json out-of-band —
      # either by shelling out to your LLM host or by committing a curated
      # baseline. This example assumes the file already exists in the repo.

      - name: Sonar Quality Gate (Step 2 ingest)
        run: |
          npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
            --ingest ./sonar-reports/sonar-findings.json \
            --path . --yes-install --technical --role devops \
            --focus vulnerabilities,hotspots

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: sonar-report
          path: sonar-reports/
```

## GitLab CI

```yaml
stages:
  - quality

dca-sonar:
  stage: quality
  image: node:20.12
  before_script:
    - cd .claude/skills/shared && npm ci
    - cd ../bmad-dept-code-sonar-scan-agent/scripts && npm ci
    - cd $CI_PROJECT_DIR
  script:
    - |
      npx ts-node .claude/skills/bmad-dept-code-sonar-scan-agent/scripts/run.ts \
        --ingest ./sonar-reports/sonar-findings.json \
        --path . --yes-install --technical --role devops \
        --focus vulnerabilities,hotspots
  artifacts:
    when: always
    paths:
      - sonar-reports/
    expire_in: 1 week
```

## Delta gate example (GitHub Actions)

```yaml
- name: Audit delta vs previous release
  run: |
    npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
      --path . --yes-install --technical --role devops \
      --since ${{ github.base_ref || 'main' }}
    # Post-process: fail the job when the Delta sheet has any new CRITICAL/HIGH.
```

## See also

- [Sonar Scan](../agents/sonar-scan) — `--no-fail`, `--focus`, `--auto-ingest`.
- [Audit](../agents/audit) — `--since` delta mode.
- [Auto-install](../concepts/auto-install) — first-run bootstrap in CI.
- [Roadmap](../roadmap) — SARIF exporter and typed exit codes.
