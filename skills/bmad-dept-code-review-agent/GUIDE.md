# BMAD DEPT Code Agent — Code Review Module

Pre-Merge Code Review Specialist (📝) for enterprise Adobe and
custom-middleware projects. Reads a PR or diff the way a senior teammate
reads it before clicking "Approve": style-guide compliance, breaking
changes, dependency risk, design-pattern violations, and a role-adapted
pre-merge checklist — output as inline review comments ready to paste
into GitHub, GitLab, or any other review surface, plus the standardized
DCA workbook so downstream chains (Audit, Impact Analysis, Release) can
baseline the pre-merge posture.

---

## What it is

The **10th agent** in the BMAD DEPT Code Agent suite (after audit,
generation, impact-analysis, sonar-scan, test-coverage, requirements,
architecture, release, operations). Where **Audit** runs an exhaustive,
scheduled, post-merge deep scan against a full rule pack, **Code Review**
is fast and diff-scoped — it reviews *only what changed*, *before it
merges*, and produces content shaped for the review UI you actually use.

Two artifact-scope modes, both selected by `--artifacts`:

- **Full review (`--artifacts all`, default).** Every artifact — review
  comments + style-check + breaking-changes + dependency-review +
  design-patterns + checklist.
- **Individual artifact.** Narrow to one: `--artifacts review`,
  `--artifacts style-check`, `--artifacts breaking-changes`,
  `--artifacts dependency-review`, `--artifacts design-patterns`,
  `--artifacts checklist`.

All modes emit the DCA workbook + Markdown twin + `CODE-REVIEW-INDEX.md`
+ one file per requested artifact under `<project>/code-review-reports/`.

---

## When to use

1. **Opening a PR for review.** You've pushed a branch and want a
   first-pass review before assigning human reviewers — catch the
   obvious stuff (style, an accidental breaking change, an unpinned
   dependency) before anyone else looks at it.
2. **Self-review before requesting reviewers.** Run `--diff` against
   your own uncommitted or staged changes before opening the PR at all
   — fix what the agent flags, then open a cleaner PR.
3. **Reviewing a teammate's PR.** Point `--pr <base>..<head>` at their
   branch to get a structured first pass — inline comments you can paste
   straight into the review, plus a checklist to work through together.
4. **Dependency-bump review.** A PR is "just" a `package.json`/
   `composer.json`/`pom.xml` version bump — run
   `--artifacts dependency-review` to get the license + known-CVE +
   transitive-impact read before approving what looks like a trivial change.
5. **Pre-release final-diff sanity check.** Before cutting a release,
   diff the release branch against the last tag
   (`--from-ref v2.3.0 --to-ref release/2.4.0`) and run a `deep` review
   to catch anything that slipped past individual PR reviews.

---

## Install

See the Docusaurus **Getting Started → Install** page for the canonical
one-time setup (BMAD install, shared foundation, per-agent `npm install`).
The Code Review agent shares dependencies with Requirements, Architecture,
Release, Operations, and Test Coverage (`exceljs`, `fast-glob`) — the
shared `bootstrap.sh code-review` command auto-installs on first
invocation.

Direct-CLI usage without the full BMAD install:

```bash
cd /path/to/bmad-dept-coding-agents/skills/shared && npm install
cd ../bmad-dept-code-review-agent/scripts && npm install
npx ts-node run.ts --path /path/to/project --diff
```

---

## Quick start

### 1. Review a PR/diff range

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --engine spring \
  --pr main..feature/checkout-v2 \
  --artifacts all
```

Output (stderr summary + written files):

```
📝  BMAD Code Review Agent
   Path:          /path/to/project
   Engine:        Spring Boot
   Diff scope:    main .. feature/checkout-v2
   Review depth:  standard
   Comment fmt:   inline-markdown
   Artifacts:     review, style-check, breaking-changes, dependency-review, design-patterns, checklist

📊 Report:       code-review-reports/code-review-main-20260809_120000-agent-report.xlsx
📄 Markdown:     code-review-reports/code-review-main-20260809_120000-agent-report.md
📝 CHANGE-LOG:   CHANGE-LOG.md
📝 Review index: code-review-reports/CODE-REVIEW-INDEX.md
📚 Artifacts:    6 file(s)
```

### 2. Review your own uncommitted changes before opening a PR

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --engine aem \
  --diff \
  --artifacts review,checklist
```

Emits `REVIEW-COMMENTS.md` and `PR-CHECKLIST.md` scoped to exactly what's
currently uncommitted — fix what's flagged before you push.

### 3. Deep review with a fail-on-severity CI gate

```bash
npx ts-node run.ts \
  --path /path/to/project \
  --pr main..HEAD \
  --review-depth deep \
  --comment-format github \
  --fail-on-severity high
```

Runs cross-file semantic reasoning (does this change interact badly with
code outside the diff), authors GitHub-suggestion-ready comments, and
exits with code `7` if anything at or above `HIGH` severity is found —
wire this into a CI check to block merge on unresolved high-severity
review findings.

---

## CLI reference

### Code-Review-specific flags

| Flag | Description |
|------|-------------|
| `--pr <a>..<b>` | Diff range to review (`git diff --name-only a..b`). A single ref is diffed against the first existing main/master/develop/production branch. Mutually exclusive with `--diff` and `--from-ref`/`--to-ref`. |
| `--diff` | Review uncommitted working-tree changes (`git diff HEAD`). Mutually exclusive with `--pr` and `--from-ref`/`--to-ref`. |
| `--from-ref <ref>` / `--to-ref <ref>` | Explicit diff range — pair together as an alternative to `--pr`. |
| `--style-guide <path>` | Optional path to a custom style-guide doc, enforced alongside the built-in per-stack guide. |
| `--review-depth <quick\|standard\|deep>` | How much the review reasons about code outside the diff. Default is role-driven: `de` → `quick`, `tl`/`security` → `deep`, everyone else → `standard`. |
| `--comment-format <github\|gitlab\|inline-markdown>` | Shape of the review-comment artifact. Default: `inline-markdown`. |
| `--fail-on-severity <critical\|high\|medium\|low>` | Exit code 7 if any finding at/above this severity exists. Distinct from `--fail-on-overdue` (SLA-based, exit code 6). |
| `--artifacts <csv>` | `review`, `style-check`, `breaking-changes`, `dependency-review`, `design-patterns`, `checklist`, `all`. Default: `all`. |
| `--format <markdown\|both>` | Output format. Default: `markdown`. `both` currently emits markdown only (docx planned) with a warning. |

### Standard flags (shared with the other 9 DCA agents)

See the Docusaurus **Reference → CLI Flags** page for the canonical table.
In short:

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
  (default: `<project>/code-review-reports`).
- `--yes-install` / `--no-install` — first-run dep-install control.
- `--create-branch` / `--source-branch <name>` — cut
  `dca/code-review-<stack>-<timestamp>` before writing.
- `--preflight` / `--no-preflight` — LLM-mode advisory.
- `--include-decided` / `--decisions-path` / `--ignore-decision-expiry` /
  `--list-decisions` — decisions gate (`.bmad/decisions.yaml`).
- `--sla-path` / `--no-sla` / `--fail-on-overdue` — SLA gate
  (`.bmad/sla.yaml`).
- `--list-engines` — print the 8 registered engines and exit.

---

## Output shape

See `SKILL.md` → **Output contract** for the full schema. Summary:

- **Workbook** — `code-review-<branch>-<timestamp>-agent-report.xlsx`
  with the 15-column contract, plus sheets: Run Info, Summary, Severity
  Breakdown, By Category, Recommendations, SLA Status, and (optional) Delta.
- **Markdown twin** — same rows, git-diffable.
- **`CODE-REVIEW-INDEX.md`** — always emitted; manifest of inputs → artifacts.
- **`REVIEW-COMMENTS.md`** (or `.json` for github/gitlab format) — inline
  PR review comments.
- **`STYLE-CHECKLIST.md`** — style-guide compliance report.
- **`BREAKING-CHANGES.md`** — breaking-change detector output.
- **`DEPENDENCY-REVIEW.md`** — dependency-change risk assessment.
- **`DESIGN-PATTERNS.md`** — design-pattern violation report.
- **`PR-CHECKLIST.md`** — role-adapted pre-merge checklist.
- **`CHANGE-LOG.md`** — appended at project root with a one-line summary.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No diff found — `--pr`/`--diff` both empty and the working tree is clean | The agent has nothing to review. Pass `--pr <base>..<head>` for a specific range, `--diff` to review uncommitted changes, or `--from-ref`/`--to-ref` for an explicit range. In one-shot mode the agent asks once with a default suggestion of `--pr main..HEAD`. |
| Style-guide path not found (`--style-guide <path>`) | The agent surfaces an INFO finding and falls back to the built-in per-stack guide rather than failing the run. Double-check the path is relative to `--path` (project root), not to your shell's cwd. |
| Comment format doesn't match your platform | `--comment-format` defaults to `inline-markdown` (tool-agnostic). Pass `github` or `gitlab` explicitly to get platform-native suggestion-block syntax — the agent does not auto-detect which forge you're on. |
| Review-depth too slow | Switch from `deep` to `standard` or `quick`. `deep` reasons about code outside the diff and is bounded by the preflight's context-window advisory — on a large repo it can take noticeably longer than `standard`. |
| `--fail-on-severity` blocking CI unexpectedly | Check the Severity Breakdown sheet — a finding you consider low-risk may have been categorized `HIGH` (e.g. a dependency bump with a known-CVE hit defaults to the CVE's own severity). Either fix the finding, lower the threshold, or record a decision (`accepted`/`deferred`/`wontfix`) in `.bmad/decisions.yaml` and rerun with `--include-decided` omitted so it's suppressed. |

---

## Cross-links

- **Docusaurus** — `docs/agents/code-review/`,
  `docs/concepts/pre-merge-review/`,
  `docs/reference/cli-flags/`,
  `docs/reference/prompts/code-review/` (all upcoming under a later phase).
- **Sibling agents**:
  - **Audit** — post-merge deep scan; Code Review's fast pre-merge pass
    complements rather than replaces Audit's exhaustive rule packs.
  - **Test-Coverage** — the checklist's test-coverage item hands off
    directly to a `test-coverage` run scoped to the changed files.
  - **Architecture** — checks the diff against the ADR log for drift
    (primary for the `ea` role).
  - **Requirements** — the checklist cross-references cached BRD/AC
    output when available (primary for the `ba` role).
  - **Impact Analysis** — traces the blast radius of a flagged breaking
    change.
  - **Release** — the deploy plan can gate on unresolved dependency-review
    flags.
- **Shared foundation** — `skills/shared/role/`,
  `skills/shared/interactive/`, `skills/shared/install/`,
  `skills/shared/decisions/`, `skills/shared/output/`.
