# DCA Role Catalog

The BMAD DCA agent suite adapts its mode default, output flavor, and recommended
follow-ups to the role of the person driving the run. Ten roles are supported.
The first six are **promoted** — surfaced first in role pickers. The remaining
four are **additional** and show up under a secondary "More roles" affordance.

| Code | Name | Description | Priority agents | Default output | Promoted |
|---|---|---|---|---|---|
| `ea` | Enterprise Architect | Owns cross-cutting architecture across Adobe/JVM estates; needs portfolio-level health, risk, and modernization signals over per-file detail. | audit, sonar-scan, impact-analysis | executive | yes |
| `tl` | Tech Lead / Solution Architect | Leads a delivery team on a specific solution; needs component-level design review, generation scaffolds, and impact blast-radius for changes. | audit, generation, impact-analysis | technical | yes |
| `de` | Senior Delivery Engineer | Ships stories on a sprint cadence; needs generated scaffolds, test coverage gaps, and audit findings shaped as Jira-ready tickets. | generation, test-coverage, audit | jira-csv | yes |
| `qa` | QA / SDET | Owns test strategy and coverage; needs coverage gaps, impact-driven regression scope, and audit findings that map to test surfaces. | test-coverage, impact-analysis, audit | technical | yes |
| `devops` | DevOps / SRE | Runs pipelines and production; needs SARIF-shaped scan output that plugs into CI gates and generated infra/pipeline scaffolds. | sonar-scan, generation, audit | sarif | yes |
| `security` | Security Engineer | Owns AppSec posture across the estate; needs deep sonar-scan and audit output focused on vulnerability classes and remediation guidance. | sonar-scan, audit | technical | yes |
| `pm` | Product Manager / PMO | Owns roadmap and delivery risk; needs executive-shape audit and impact output framed as scope, effort, and portfolio risk. | audit, impact-analysis | executive | no |
| `ba` | Business Analyst | Bridges business intent and system behavior; needs impact-analysis output that reads as feature/flow-level change summaries. | impact-analysis | executive | no |
| `migration` | Migration/Upgrade Lead | Drives platform upgrades and re-platforming; needs audit baselines, impact of upgrade paths, and coverage of legacy surfaces. | audit, impact-analysis, test-coverage | technical | no |
| `content` | Content/CMS Engineer | Builds and maintains AEM/EDS content surfaces; needs component/block generation scaffolds and audit findings scoped to content code. | generation, audit | technical | no |

## How the role is captured

The role selection is persisted per-project at `<projectRoot>/.bmad/role.yaml`,
adjacent to `.mcp.json`. It is written the first time a DCA agent activates
and the user picks a role interactively, or when a run is invoked with
`--role=<code>`.

There are three ways a role reaches an agent, in resolution order:

1. **CLI flag** — `--role=<code>` passed to any agent's `run.ts`. Per-run only;
   it does **not** write `.bmad/role.yaml`.
2. **Role file** — `<projectRoot>/.bmad/role.yaml`, once written, is picked
   up automatically by every subsequent DCA run.
3. **Generic fallback** — if neither a flag nor a valid role file is present
   in a headless/non-interactive run, the agent falls back to a `generic`
   sentinel role (default output flavor, no priority-agent tilt).

## How to change it

- **From an agent chat**: say "switch role to `<code>`" — the agent will
  update `.bmad/role.yaml` for you.
- **By hand**: edit `.bmad/role.yaml` and change the `role:` line to any
  code from the table above. Delete the file to be re-prompted next run.
- **Per-run only**: pass `--role=<code>` to that single `run.ts` invocation.

## File format

```yaml
# BMAD DCA — role selection
# Set by the DCA agent suite on first activation; edit or delete to change.
role: ea                        # one of: ea, tl, de, qa, devops, security, pm, ba, migration, content
set_at: 2026-08-01T02:53:00Z    # ISO-8601 UTC
set_by: interactive             # interactive | --role-flag | config
notes: |
  Optional free-text notes about the role choice.
```
