---
id: chain-all
title: chain-all
sidebar_position: 1
description: Run Audit → Sonar Scan → Test Coverage → Impact Analysis in one command, with a Markdown roll-up that reconciles blockers across the four stages.
---

# chain-all — one command, four agents

The `--chain-all` mode runs the SDLC pass end-to-end in one invocation. It spawns each agent's `run.ts` in sequence, chains their outputs through the shared findings cache, and emits a single Markdown roll-up under `dca-chain-reports/` that reconciles blockers across the four stages.

## What runs, in what order

```
audit  →  sonar-scan  →  test-coverage  →  impact-analysis
```

- Each stage inherits the resolved role (`--role <code>`), the install/intake flags, and the project path.
- Each stage writes its own standardized `.xlsx` + `.md` + `CHANGE-LOG.md` entry into its usual report directory.
- After every stage, `readLatestRun` inspects the shared findings cache for that agent's report path + finding counts, and those numbers feed the roll-up.
- The chain is **non-fatal by default** — a failing stage records `status: failed` and the chain continues. Pass `--chain-stop-on-fail` to abort on the first failure.

## Command

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --chain-all --path . --role <code>
```

Any of the five agent dispatchers accept `--chain-all` — the entry point is not agent-specific. The command above uses `audit`'s `run.ts` because audit is the natural first stage.

## Sub-flags

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--chain-all` | bool | false | Enter chain mode. |
| `--chain-stages <csv>` | csv | `audit,sonar-scan,test-coverage,impact-analysis` | Run a subset of stages, in the given order. |
| `--chain-stop-on-fail` | bool | false | Abort on the first stage failure. Default is to record `failed` and continue. |
| `--role <code>` | enum | `.bmad/role.yaml` | Applied to every stage. |
| `--yes-install` / `--no-install` | bool | false | Forwarded to every stage's first-run bootstrap. |
| `--path <dir>` | dir | `cwd` | Applied to every stage. Required and must exist. |

## Outputs

- One agent report per stage (in each agent's normal report directory).
- One CHANGE-LOG entry per stage (see the [known limitation](#known-limitation) below).
- **One Markdown roll-up** at `<projectRoot>/dca-chain-reports/dca-chain-<branch>-<ts>-rollup.md`. The roll-up summarizes: stage status, exit codes, report paths, finding counts, duration, and a cross-agent insights block.

## Cross-agent insights — where the value lands

The roll-up isn't just four report links stapled together. It cross-references the four caches so it can surface things that no single agent can see:

- **Release blockers** = CRITICAL audit findings ∩ files with `<50%` real coverage ∩ files in the Impact Analysis set. Every file that satisfies all three is a hard-block on the release.
- **Sonar Quality Gate driver** — when the sonar Quality Gate is FAIL, the roll-up names the specific finding(s) that drove the FAIL.
- **Coverage-priority + audit-boost** — the Test Coverage stage runs with `--audit-max-age-hours 168` by default (7 days), so the coverage priority order automatically reflects the CRITICAL/HIGH audit surface from the same chain.
- **Input Traceability with audit cross-reference** — the Impact Analysis stage picks up the same fresh audit cache, so every impacted file's risk score is CRITICAL-aware.

## Example — role-specific chain

Run only the audit and sonar stages, as a security engineer, and stop on the first failure:

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --chain-all \
  --chain-stages audit,sonar-scan \
  --chain-stop-on-fail \
  --path . \
  --role security \
  --yes-install
```

The roll-up will contain only the two requested stages, and the sonar Quality Gate FAIL will bubble to the process exit code (via `sonar-scan`'s default CI-friendly exit-on-FAIL behaviour).

## Example — pre-release gate

Full four-stage pass on a Commerce project, using the default role:

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --chain-all --path /path/to/magento-project
```

Then in chat:

```text
open the roll-up
list the release blockers
which files are CRITICAL in audit AND have <50% coverage AND are in the impact set?
```

## Known limitation

Child stages still write their own individual `CHANGE-LOG.md` entries as they run — the roll-up appends **one additional summary entry** on top, so a `--chain-all` invocation produces five CHANGE-LOG entries per run (four stage entries + one roll-up entry). The duplication is intentional for now: the extra entry describes the chain run itself so it's discoverable by timestamp. Deduplication is on the [roadmap](../roadmap).

## See also

- [Audit](../agents/audit) · [Sonar Scan](../agents/sonar-scan) · [Test Coverage](../agents/test-coverage) · [Impact Analysis](../agents/impact-analysis)
- [Findings cache](../concepts/findings-cache) — the mechanism that lets each stage read the previous stage's output.
- [Per-role recipes](./per-role-recipes) — role-specific chained workflows.
- [CI Integration](./ci-integration) — running the chain in GitHub Actions / GitLab CI.
