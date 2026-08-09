# BMAD DEPT Code Agent — Release Module

Release & Deployment Specialist for enterprise Adobe and custom-middleware
projects. Turns a set of merged changes into a shippable release: a CI/CD
pipeline definition, release notes from commit history, a phased deploy
plan, a rollback playbook, an env-diff between two environments, and a
multi-channel stakeholder announcement — plus the standardized DCA
workbook so downstream chains (Audit, Sonar-Scan, Operations) can baseline
the release.

---

## What it is

The 8th agent in the BMAD DEPT Code Agent suite (after audit, generation,
impact-analysis, sonar-scan, test-coverage, requirements, architecture).
Where Architecture formalizes the **how to build**, Release formalizes the
**how to ship** — the pipeline that runs the build, the notes that
describe what changed, the plan that phases the rollout, and the
playbook that recovers when the deploy goes wrong.

Two artifact-scope modes, both selected by `--artifacts`:

- **Full release (`--artifacts all`, default).** Every artifact
  resolvable given other flags — pipeline + release notes + deploy plan
  + rollback plan + env-diff + announcement.
- **Individual artifact.** Narrow to one: `--artifacts pipeline`,
  `--artifacts release-notes`, `--artifacts deploy-plan`, etc.

Both modes emit the DCA workbook + Markdown twin + `RELEASE-INDEX.md` +
one file per requested artifact under `<project>/release-reports/`.

---

## When to use

1. **Pre-release documentation kickoff.** A release candidate is cut and
   the release manager needs the full pack — pipeline reference, release
   notes, deploy plan, rollback plan, env-diff, announcement — before
   the go/no-go meeting.
2. **Generating a pipeline for a new project.** A greenfield service has
   no CI/CD yet — author the platform-appropriate pipeline (Cloud
   Manager for AEM, GitHub Actions for Spring, etc.) with the DCA
   quality gates already wired in.
3. **Release announcement authoring.** Product wants a stakeholder-ready
   email + Slack + Confluence bundle — author `--artifacts announcement`
   with `--release-version <ver>` and copy-paste per channel.
4. **Rollback drill prep.** Before a risky release, generate the
   rollback playbook and walk through the numbered steps as a table-top
   exercise. Every trigger and step has a named owner.
5. **Env-config drift audit.** Suspect stage and prod have drifted?
   Run `--artifacts env-diff --env stage --to-env prod` to surface
   config-file / env-var / feature-flag / secret / infrastructure
   deltas with per-category risk assessment.

---

## Install

See the Docusaurus **Getting Started → Install** page for the canonical
one-time setup (BMAD install, shared foundation, per-agent `npm install`).
The Release agent shares dependencies with Requirements, Architecture,
and Test Coverage (`exceljs`, `fast-glob`, `mammoth`) — the shared
`bootstrap.sh release` command auto-installs on first invocation.

Direct-CLI usage without the full BMAD install:

```bash
cd /path/to/bmad-dept-coding-agents/skills/shared && npm install
cd ../bmad-dept-code-release-agent/scripts && npm install
npx ts-node run.ts --path /path/to/project --release-version 2.5.0
```

---

## Quick start

### 1. Full release pack

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --release-version 2.5.0 \
  --from-ref v2.4.0 \
  --to-ref HEAD \
  --artifacts all
```

Output (stderr summary + written files):

```
🚀  BMAD Release Agent
   Path:      /path/to/project
   Engine:    AEM
   Version:   2.5.0
   Refs:      v2.4.0 → HEAD
   Pipeline:  cloudmanager (auto-detected)
   Rollout:   canary (role: devops)
   Artifacts: pipeline, release-notes, deploy-plan, rollback-plan, env-diff, announcement

📊 Report:      release-reports/release-main-20260808_120000-agent-report.xlsx
📄 Markdown:    release-reports/release-main-20260808_120000-agent-report.md
📝 CHANGE-LOG:  CHANGE-LOG.md
🚀 Release idx: release-reports/RELEASE-INDEX.md
📚 Artifacts:   6 file(s)
```

### 2. Release notes only

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --from-ref v2.4.0 \
  --to-ref HEAD \
  --artifacts release-notes \
  --commit-format conventional
```

Emits `RELEASE_NOTES.md` grouped by Conventional Commit type (`feat`,
`fix`, `perf`, `refactor`, …) plus the standardized workbook and
`RELEASE-INDEX.md`.

### 3. Cloud Manager pipeline for an AEM project

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --engine aem \
  --pipeline cloudmanager \
  --rollout canary \
  --artifacts pipeline
```

Emits `pipeline.yml` with Cloud Manager stage/prod pipelines, custom
event handlers for validate/build/deploy, and canary-style staged
promotion (Stage quality-gate → Prod quality-gate → Prod deploy).

---

## CLI reference

### Release-specific flags

| Flag | Description |
|------|-------------|
| `--pipeline <target>` | CI/CD platform. Values: `cloudmanager`, `github-actions`, `gitlab-ci`, `circleci`, `jenkins`, `azure-devops`. Default: auto-detect from project CI files (`.github/workflows/`, `.gitlab-ci.yml`, `.circleci/config.yml`, `Jenkinsfile`, `azure-pipelines.yml`, else Cloud Manager for AEM `pom.xml`). |
| `--from-ref <ref>` | Start of release scope (git ref) — for release notes + env-diff. |
| `--to-ref <ref>` | End of release scope. Default: `HEAD`. |
| `--env <name>` | Source environment for env-diff (e.g. `stage`). |
| `--to-env <name>` | Target environment for env-diff (e.g. `prod`). |
| `--rollout <strategy>` | Deploy strategy. Values: `canary`, `blue-green`, `rolling`, `feature-flag`, `bigbang`. Default: role-driven (DevOps→canary, migration→blue-green, else rolling). |
| `--release-version <tag>` | Semantic version for the release (e.g. `2.5.0`). |
| `--artifacts <csv>` | Which artifacts to author (comma-separated). Values: `pipeline`, `release-notes`, `deploy-plan`, `rollback-plan`, `env-diff`, `announcement`, `all`. Default: `all`. |
| `--commit-format <style>` | Release-notes commit style. Values: `conventional`, `keep-a-changelog`, `narrative`. Default: `conventional`. |
| `--format <markdown\|both>` | Output format. Default: `markdown`. `both` currently emits markdown only (docx planned) with a warning. |

### Standard flags (shared with the other 7 DCA agents)

See the Docusaurus **Reference → CLI Flags** page for the full canonical
table. In short:

- `--path <dir>` — project root (default: cwd).
- `--engine <id>` — force a stack (`aem`, `commerce-paas`, `commerce-saas`,
  `sling`, `spring`, `app-builder`, `eds`, `eds-commerce`). Auto-detected
  when omitted.
- `--role <code>` — role adaptation (`ea`, `tl`, `de`, `qa`, `devops`,
  `security`, `pm`, `ba`, `migration`, `content`, `generic`). Persists to
  `.bmad/role.yaml`.
- `--interactive` / `--technical` — intake mode (persists to
  `.bmad/intake.yaml`).
- `--output <dir>` — override the report directory
  (default: `<project>/release-reports`).
- `--yes-install` / `--no-install` — first-run dep-install control.
- `--create-branch` / `--source-branch <name>` — cut
  `dca/release-<stack>-<timestamp>` before writing.
- `--preflight` / `--no-preflight` — LLM-mode advisory.
- `--include-decided` / `--decisions-path` / `--ignore-decision-expiry` /
  `--list-decisions` — decisions gate (`.bmad/decisions.yaml`).
- `--sla-path` / `--no-sla` / `--fail-on-overdue` — SLA gate
  (`.bmad/sla.yaml`).
- `--list-engines` — print the 8 registered engines and exit.

---

## Output shape

See `SKILL.md` → **Output contract** for the full schema. Summary:

- **Workbook** — `release-<branch>-<timestamp>-agent-report.xlsx` with
  the 15-column contract, plus sheets: Run Info, Summary, Severity
  Breakdown, By Category, Recommendations, SLA Status, and (optional)
  Delta.
- **Markdown twin** — same rows, git-diffable.
- **`RELEASE-INDEX.md`** — always emitted; manifest of inputs → artifacts.
- **`pipeline.yml`** (or `pipeline.groovy` for Jenkins) — CI/CD workflow.
- **`RELEASE_NOTES.md`** — commit-history-grouped release notes.
- **`DEPLOY_PLAN.md`** — phased deploy plan against the resolved rollout.
- **`ROLLBACK_PLAN.md`** — rollback playbook.
- **`ENV_DIFF.md`** — env-config diff report.
- **`ANNOUNCEMENT.md`** — multi-channel stakeholder announcement.
- **`CHANGE-LOG.md`** — appended at project root with a one-line summary.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `--from-ref` omitted and no git tags exist | The agent asks once for a ref range in one-shot mode; in headless / CI mode, pass `--from-ref <ref>` or `--from-ref v0.0.0` (empty range → empty notes). If your repo doesn't tag releases, use commit SHAs. |
| Pipeline auto-detect ambiguous | Multiple CI files present (e.g. both `.github/workflows/` and `Jenkinsfile`). The agent picks the first match in source order; pass `--pipeline <target>` to force the one you want. |
| Release notes empty | The commit range is empty (`--from-ref` and `--to-ref` resolve to the same SHA), or `--commit-format conventional` was passed against a repo whose commits don't follow Conventional Commits (falls back to `narrative` grouping with a warning). Try `--commit-format narrative` for free-form commit messages. |
| `--artifacts env-diff` produces an empty diff | The agent needs comparable env-config files. Point `--env` and `--to-env` at env names that match your project's config layout (e.g. `application-stage.yaml` vs `application-prod.yaml`, or Cloud Manager env config files, or Helm values files). If your envs are runtime-injected only, env-diff can't statically compare them. |
| `--format both` writes a warning and emits markdown only | Currently expected — the docx writer lands in a later phase. Use `--format markdown` or convert the emitted `.md` externally (`pandoc RELEASE_NOTES.md -o RELEASE_NOTES.docx`). |

---

## Cross-links

- **Docusaurus** — `docs/agents/release/`,
  `docs/concepts/release-authoring/`,
  `docs/reference/cli-flags/`,
  `docs/reference/prompts/release/` (all upcoming under Phase 3.3).
- **Sibling agents**:
  - **Architecture** — Release consumes the ADR/HLD/LLD produced by
    Architecture. Reference the ADR IDs in the deploy plan.
  - **Audit** — wire `audit --fail-on-overdue` into the pipeline
    the release agent authored so unresolved audit findings block ship.
  - **Sonar-Scan** — wire the Sonar-Scan Quality Gate into the
    pipeline so HIGH-severity vulnerabilities block ship.
  - **Test-Coverage** — wire the coverage gate into the pipeline
    so drops below the floor block ship.
  - **Impact Analysis** — trace release scope blast radius before the
    go/no-go meeting.
  - **Operations** (Phase 3.4) — hands the deploy plan to Operations to
    emit the post-deploy runbook + alerts.
- **Shared foundation** — `skills/shared/role/`,
  `skills/shared/interactive/`, `skills/shared/install/`,
  `skills/shared/decisions/`, `skills/shared/output/`.
