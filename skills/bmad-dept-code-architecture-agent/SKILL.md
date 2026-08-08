---
name: bmad-dept-code-architecture-agent
description: "Architecture Design Specialist — the 7th agent of the BMAD DEPT Code Agent suite (audit, generation, impact-analysis, sonar-scan, test-coverage, requirements, architecture). Authors ADRs (MADR 3.0), HLD/LLD, API contracts (OpenAPI 3.1 / GraphQL SDL), C4 + sequence diagrams (Mermaid / PlantUML), STRIDE threat models, and data models from a natural-language design question. Parses and enriches existing designs (`.md`, `.yaml`, `.json`). Grounded in per-stack Adobe/JVM idioms across all 8 supported stacks."
keywords: ["architecture", "adr", "design", "hld", "lld", "openapi", "graphql", "api contract", "threat model", "stride", "c4", "sequence diagram", "data model", "system design", "aem", "commerce", "eds", "sling", "spring", "app-builder", "eds-commerce", "commerce-saas"]
---

# BMAD DEPT Code Agent — Architecture Skill

## Purpose

The **Architecture** agent — the 7th agent in the BMAD DEPT Code Agent suite
(audit, generation, impact-analysis, sonar-scan, test-coverage, requirements,
architecture). It is the **design-authoring specialist** that produces the
architecture artifacts feeding the rest of the SDLC across **8 stacks**:

- **AEM** — AEM as a Cloud Service (AEMaaCS) + AEM AMS
- **Adobe Commerce (PaaS)** — Magento 2
- **Adobe Commerce SaaS** — Catalog Service / Live Search / storefront drop-ins
- **Apache Sling / Shaft** (sling-12)
- **Spring Boot** custom middleware
- **Adobe App Builder** — I/O Runtime, API Mesh, Commerce UI Extensibility, AEM UI Extensibility
- **Edge Delivery Services (EDS)**
- **EDS + Commerce** hybrid

Where the Requirements agent turns product intent into a BRD, and Generation
scaffolds code from stories, **Architecture closes the design phase**: it
turns a design question into an approved decision (ADR), a shape (HLD/LLD),
a contract (OpenAPI / GraphQL SDL), a behavior model (C4 + sequence
diagrams), a security posture (STRIDE), and a data model — all rendered in
the same standardized DCA report shape so downstream agents can chain.

Unlike Audit / Sonar / Test-Coverage (which analyze existing code),
Architecture *produces* the specification code will implement. Unlike
Requirements (which formalizes product intent), Architecture formalizes
**technical** intent — the "how" behind the "what". It is the seventh agent
and it closes SDLC **phase 2 (Design)**.

### Two modes

**Author (default).** From a natural-language `--design-question` (or
`--adr` for a specific decision title, or the interactive prompter) the
agent emits:

- One or more `ADR-<n>.md` files (MADR 3.0 format) via `templates/ADR.md` +
  the stack-specific guide at `resources/adr-templates/<stack>.md`.
- `HLD.md` — high-level design via `templates/HLD.md` +
  `resources/hld-templates/<stack>.md`.
- `LLD.md` — low-level design via `templates/LLD.md` +
  `resources/lld-templates/<stack>.md`.
- `openapi.yaml` and/or `schema.graphql` — API contract per `--api-style`.
- `c4-context.mermaid`, `c4-container.mermaid`, `c4-component.mermaid` — C4
  L1/L2/L3 diagrams. PlantUML with `--diagrams plantuml`.
- `sequence-*.mermaid` — one per major flow.
- `threat-model.md` — STRIDE threat model via `templates/threat-model-stride.md` +
  `resources/threat-models/<stack>.md`.
- `data-model.md` — ER diagram + schema DDL per stack default.
- The standard DCA workbook with the 15-column Summary contract (see
  **Output contract** below).

**Parse & enrich.** From an existing design (`--design-in ./legacy-HLD.md`,
`--openapi-in ./api.yaml`, or both) the agent:

- Parses the input (markdown natively; OpenAPI/GraphQL via `js-yaml` /
  string parsing).
- Extracts existing decisions, contracts, components, endpoints, and
  diagrams as findings.
- Fills gaps against the stack template (missing NFRs on the HLD, missing
  security schemes on the OpenAPI, missing sequence flows for named
  endpoints, missing STRIDE analysis on newly-added components).
- Re-emits the enriched artifacts side-by-side with the sources.

Both modes are **stack-aware**: an ADR authored against `aem` reasons about
Sling models, dispatcher farms, and Cloud Manager pipelines; against
`commerce-paas` it reasons about plugin vs preference vs observer, di.xml,
and RabbitMQ topology; against `eds` it reasons about block hierarchy,
`scripts.js` phases, and Core Web Vitals budgets.

> **Architecture is a design-authoring specialist, not a design executor.**
> It does not run a PoC, execute migrations, or validate the design against
> live systems — that's what Generation, Audit, and Test-Coverage do
> downstream. See **Constraints / non-goals** below.

## Activation

This skill activates when the user asks to:

- Author an ADR / write an ADR / draft a design decision
- Write / author an HLD / high-level design
- Write / author an LLD / low-level design / component design
- Design the API / write an API contract / OpenAPI for X / GraphQL schema for X
- Threat-model this / STRIDE this / security review the design
- Draw a C4 diagram / context diagram / container diagram / component diagram
- Draw a sequence diagram for X
- Design a data model / ER diagram / schema for X
- System design for X / how should we architect X
- Should we use X or Y? (implicit ADR question shape)
- Parse this HLD / normalize this design doc / enrich this design

Menu codes (see `assets/module-help.csv`):

| Code | Action |
|------|--------|
| `AR` | Author design artifacts from a design question (auto-detect stack). |
| `AB` | Parse & enrich an existing design doc (`--design-in <path>` / `--openapi-in <path>`). |
| `AH` | Author against the AEM stack (`--engine aem`). |
| `AC` | Author against Adobe Commerce (PaaS / Magento 2) (`--engine commerce-paas`). |
| `AZ` | Author against Adobe Commerce SaaS (`--engine commerce-saas`). |
| `AJ` | Author against Sling / Shaft (`--engine sling`). |
| `AQ` | Author against Spring Boot (`--engine spring`). |
| `AK` | Author against Adobe App Builder (`--engine app-builder`). |
| `AX` | Author against Edge Delivery Services (`--engine eds`). |
| `AY` | Author against EDS + Commerce hybrid (`--engine eds-commerce`). |
| `AL` | List engines / stacks supported by the architecture agent (`--list-engines`). |

## Prompt → Action Resolution

When a user triggers the Architecture agent, map their prompt to a `run.ts`
invocation. All flags below are already wired in `scripts/run.ts` (see the
CLI reference at the bottom of this file — no invented flags).

| User says… | Resolves to |
|---|---|
| "should we use Kafka or SQS for order events?" | `--design-question "Kafka vs SQS for order events?" --artifacts adr` |
| "author ADR: Kafka vs SQS for order events" | `--adr "Kafka vs SQS for order events" --artifacts adr` |
| "design the API for our new promotions service" | `--design-question "the promotions service API" --artifacts openapi,c4,sequence` |
| "OpenAPI for the loyalty endpoints" | `--design-question "loyalty endpoints" --artifacts openapi --api-style rest` |
| "GraphQL schema for the storefront" | `--design-question "storefront GraphQL surface" --artifacts graphql --api-style graphql` |
| "REST + GraphQL for the promotions service" | `--artifacts openapi,graphql --api-style both` |
| "threat model our checkout flow" | `--design-question "checkout flow threat model" --artifacts threat-model` |
| "STRIDE the payment integration" | `--design-question "payment integration STRIDE" --artifacts threat-model,sequence` |
| "C4 context diagram for our current AEM estate" | `--artifacts c4 --engine aem --diagrams mermaid` |
| "sequence diagram for the checkout happy path" | `--design-question "checkout happy path" --artifacts sequence` |
| "data model for the new loyalty program" | `--design-question "loyalty program" --artifacts data-model` |
| "review this OpenAPI at ./api.yaml and add missing security schemes" | `--openapi-in ./api.yaml --artifacts openapi` |
| "parse ./legacy-hld.md and enrich with missing NFRs" | `--design-in ./legacy-hld.md --artifacts hld` |
| "author full design pack for the promotions service" | `--design-question "promotions service" --artifacts all` |
| "design as security" | `--role security --artifacts threat-model,sequence` |
| "PlantUML diagrams please" | `--diagrams plantuml` |
| "docx output" | `--format both` (docx is planned; falls back to markdown with a warning — see § Modes) |
| "list architecture stacks" | `--list-engines` |
| "cut a working branch" | Append `--create-branch` |
| "on the release branch" | Append `--create-branch --source-branch release` |
| "no install prompt" | Append `--yes-install` |

### Compound resolution

Combine flags when the prompt names multiple inputs:

- "author full design pack for the checkout redesign as tl, PlantUML, cut a branch"
  → `--role tl --design-question "the checkout redesign" --artifacts all --diagrams plantuml --create-branch`
- "OpenAPI + threat model for the promotions API, security role"
  → `--role security --design-question "promotions API" --artifacts openapi,threat-model,sequence`
- "parse ./api.yaml, enrich, emit PlantUML"
  → `--openapi-in ./api.yaml --artifacts openapi,c4,sequence --diagrams plantuml`

### Missing required info — ask (do not guess)

The agent needs at least ONE input source. If the prompt has none of
`--design-question`, `--adr`, `--design-in`, or `--openapi-in`:

> "I need something to design against — either paste a short design question
> (e.g. 'Kafka vs SQS for order events?'), an ADR title, or point me at an
> existing design (`.md` / `.yaml` / `.json`) to enrich."

Everything else has a sensible default: `--artifacts` follows the role-driven
default (see § Role-aware behavior), `--api-style rest`, `--diagrams mermaid`,
`--format markdown`, `--engine` auto-detect, `--role` from `.bmad/role.yaml`
or `generic`, output at `<project>/architecture-reports/`.

## Intake mode (interactive vs technical)

> **For fast, enterprise-grade execution, prefer One-shot mode (see below).**
> Intake mode is for exploratory / first-time users.

> **CRITICAL:** The very first response to any activation must be the
> intake-mode question — unless `.bmad/intake.yaml` exists with a saved
> preference. Do NOT skip this. Do NOT show a CLI command as the first
> response.

When a user triggers this agent — via a natural-language prompt or a menu
entry — do NOT show or run a raw CLI command as the first response. Ask
which drive style they prefer:

> "Should I drive this **interactively** (I ask you step-by-step questions
> and run everything for you) or **technically** (I show you the CLI command
> with each flag explained, and you decide whether to run it or have me run
> it)?"

Save the answer to `.bmad/intake.yaml` (adjacent to `.bmad/role.yaml`) with
keys `mode: interactive|technical` and `set_at: <ISO-8601>`. On subsequent
runs, read the file silently and skip the prompt unless the user asks to
switch.

To change intake mode later, the user says **"switch intake to interactive"**
or **"switch intake to technical"** — overwrite `.bmad/intake.yaml`.

**Sequencing note.** The `Preflight`, `Pre-flight: Auto-install
Dependencies`, and per-stack authoring sections below must NOT run before
the intake picker resolves. Order for a fresh activation:

1. Resolve intake mode (ask, or read `.bmad/intake.yaml`).
2. If technical → show the command + flag explanations, then run it (with
   the user's OK) or hand off.
3. If interactive → collect the intake questions below, then run silently.
4. Preflight + bootstrap run just before dispatch, once inputs are collected.

### Interactive mode (recommended for first-timers)

Ask one question per turn, in this order. Skip any question the user has
already answered in their initial prompt.

1. "What's the project path? (defaults to current working directory)"
2. "Which stack? (auto-detect / `aem` / `commerce-paas` / `commerce-saas` /
   `sling` / `spring` / `app-builder` / `eds` / `eds-commerce`)"
3. "**Author** a new design from a design question, or **parse & enrich** an
   existing design?"
4. If author → "Paste a short design question or ADR title (e.g. 'Kafka vs
   SQS for order events')."
5. If parse → "Path to the existing design (`.md` / `.yaml` / `.json`)? If
   you have an OpenAPI to enrich, use `--openapi-in` instead."
6. "Which artifacts? (comma-separated:
   `adr,hld,lld,openapi,graphql,c4,sequence,threat-model,data-model,all` —
   default follows your role)"
7. "API style? (`rest` / `graphql` / `both`)"
8. "Diagram format? (`mermaid` / `plantuml`)"
9. "Output format? (`markdown` / `both` — docx planned for a later phase, currently emits markdown only)"
10. "Cut a working branch from production? (Y/n)"
11. "Ready to run? (Y/n)"

Once every required input is collected, run the command internally (do NOT
show it unless the user asks) and stream results conversationally:

> "Designing the promotions service against Commerce PaaS… 1 ADR, 1 HLD, 1
> OpenAPI, 2 C4 diagrams, 3 sequence diagrams, 1 STRIDE model, 1 data
> model. Report saved to
> `architecture-reports/architecture-main-20260808_120000-agent-report.xlsx`,
> design index at `architecture-reports/DESIGN-INDEX.md`. Want me to hand
> the OpenAPI to Generation for controller scaffolds?"

### Technical mode (for users who want CLI transparency)

Show the fully-formed command in a `bash` code block with one flag per line:

```bash
npx ts-node .claude/skills/bmad-dept-code-architecture-agent/scripts/run.ts \
  --path /path/to/project \
  --engine commerce-paas \
  --design-question "the promotions service API" \
  --artifacts openapi,c4,sequence,threat-model \
  --api-style rest \
  --diagrams mermaid \
  --format markdown \
  --create-branch
```

Below the block, add a bulleted list explaining each flag in plain English:

- `--path` — the project root; used for stack auto-detection when
  `--engine` is omitted, and as the base for the output directory.
- `--engine commerce-paas` — force the Adobe Commerce (PaaS) authoring
  templates; without this the dispatcher probes the tree for stack signals.
- `--design-question "…"` — the natural-language design intent the LLM
  authors against.
- `--artifacts …` — the design artifacts to produce (see the artifact
  catalog in § Artifact catalog).
- `--api-style rest` — REST/OpenAPI 3.1; use `graphql` for SDL, `both` to
  emit both.
- `--diagrams mermaid` — Mermaid source for C4 + sequence diagrams; use
  `plantuml` when your renderer prefers it.
- `--format markdown` — output format (docx planned for a later phase;
  passing `both` writes markdown only for now with a warning).
- `--create-branch` — cut a working `dca/architecture-<stack>-<timestamp>`
  branch (from `production`/`main`/`master`/`develop`) before writing outputs.

Then ask: **"Want me to run this now, or will you copy-paste it?"**

- If **run for me** → execute silently and stream results (same as interactive mode).
- If **I'll run it** → acknowledge, and remind them: "Report will land in
  `<project>/architecture-reports/`. Come back with 'summarize the ADR' or
  'hand the OpenAPI to Generation' when you're done."

## One-shot mode

The **preferred enterprise path.** When the user's initial prompt fully
specifies what to run, do NOT ask any clarifying questions — execute
end-to-end, stream results, done. Use defaults from `.bmad/role.yaml`,
`.bmad/intake.yaml`, `.bmad/conventions.yaml`, and reasonable stack
auto-detection to fill missing inputs.

### When to enter one-shot mode

Trigger phrases (any of):

- "author design end-to-end", "no questions, just do it", "one-shot",
  "author ADR and go", "auto"
- OR any prompt that specifies: (a) the operation (author / parse), (b) the
  project path (default: cwd), (c) the primary input (`--design-question` /
  `--adr` text or `--design-in` / `--openapi-in` path)

You DO NOT need every field explicitly — role + intake + conventions cover
the rest silently.

### Precedence for missing inputs

1. **Explicit in the user's prompt** (highest — always wins)
2. **`--flag` on run.ts** (headless / CI)
3. **`.bmad/role.yaml`** (role-driven default artifact set + output flavor)
4. **`.bmad/intake.yaml`** (interactive vs technical — one-shot forces technical + skip)
5. **`.bmad/conventions.yaml`** (project conventions: naming, packaging, house rules)
6. **Auto-detected** (stack from repo signatures)
7. **Sensible defaults** (`--api-style rest`, `--diagrams mermaid`,
   `--format markdown`, output at `architecture-reports/`)

### What one-shot DOES silence

- The intake picker ("Interactive or Technical?") — one-shot forces technical.
- The **mode picker** ("Author or Parse & Enrich?") — resolved from prompt:
  `--design-in` or `--openapi-in` present ⇒ parse; `--design-question` or
  `--adr` present ⇒ author; both present ⇒ parse-and-enrich-with-extra-context.
- The **artifact picker** — one-shot uses the role default from the matrix
  in § Role-aware behavior (or `--artifacts` if the user was explicit).
- The role picker (if `.bmad/role.yaml` absent) — one-shot uses `generic`
  silently (log to stderr: "one-shot: no role file, defaulting to generic").
- The api-style / diagram-format / output-dir confirmations — one-shot uses
  defaults or explicit flags.
- The confirmation prompts around `--create-branch`, `--yes-install` —
  one-shot assumes yes for install, no for branch cut unless the prompt
  says otherwise.

### What one-shot DOES ask about (only when truly critical)

- **No design input at all.** If none of `--design-question`, `--adr`,
  `--design-in`, `--openapi-in` are present, the agent has nothing to
  design against. Ask ONCE:

  > "I need something to design against — paste a short design question,
  > an ADR title, or point me at an existing design (`.md` / `.yaml` /
  > `.json`)."

  Everything else stays silent.

### One-shot prompt examples for the Architecture agent

Each example shows what the user pastes and what the AI silently resolves.

> **User:** "author ADR: Kafka vs SQS for order events"
> **AI silently resolves:** path=cwd, engine=auto-detect (probably `spring`
> or `commerce-paas`), mode=`author`, role=(from `.bmad/role.yaml` or
> `generic`), artifacts=`adr` (single-decision ADR is enough — no HLD
> unless the role default asks), format=markdown, output-dir=`architecture-reports/`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --adr "Kafka vs SQS for order events" --artifacts adr --technical --no-preflight --yes-install`
> **AI reports:** "ADR-042 authored: **Kafka vs SQS for order events**.
> Decision: Kafka (rationale: exactly-once semantics required, existing
> Zookeeper). Consequences (positive/negative): …. Report:
> `architecture-main-…-agent-report.xlsx`. Want me to hand the ADR to
> Impact Analysis to trace who touches order events?"

> **User:** "design the promotions API — OpenAPI + C4 + sequence"
> **AI silently resolves:** artifacts=`openapi,c4,sequence`, api-style=rest,
> diagrams=mermaid, engine=auto-detect.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --design-question "the promotions API" --artifacts openapi,c4,sequence --technical --no-preflight --yes-install`
> **AI reports:** "1 OpenAPI (12 endpoints, 8 schemas, Bearer JWT +
> OAuth2), 3 C4 diagrams (Context + Container + Component), 4 sequence
> diagrams (create-promotion, apply-promotion, list-eligible,
> expire-promotion). All saved to `architecture-reports/`."

> **User:** "threat-model our checkout with STRIDE"
> **AI silently resolves:** artifacts=`threat-model,sequence` (STRIDE needs
> a sequence flow to reason over), role=(if `security` in
> `.bmad/role.yaml`, elevate; else `generic`).
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --design-question "our checkout" --artifacts threat-model,sequence --technical --no-preflight --yes-install`
> **AI reports:** "STRIDE model authored: 3 trust boundaries, 12 assets, 24
> threats scored, top-3 residual risks called out. Sequence diagrams
> attached. Want me to sonar-scan the checkout code path for matching
> vulnerabilities?"

> **User:** "parse ./legacy-hld.md and enrich with missing NFRs"
> **AI silently resolves:** mode=parse-and-enrich, `--design-in
> ./legacy-hld.md`, artifacts=`hld` (matches input type), engine=auto-detect.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --design-in ./legacy-hld.md --artifacts hld --technical --no-preflight --yes-install`
> **AI reports:** "Parsed HLD (14 sections): 4 NFR gaps filled
> (availability SLO, DR-RPO/RTO, observability, PII data classification), 2
> integration points added, 1 risk row added. Enriched: `HLD.md`. Delta
> sheet in the workbook shows what was added."

> **User:** "review this OpenAPI at ./api.yaml and add missing security schemes"
> **AI silently resolves:** `--openapi-in ./api.yaml`, artifacts=`openapi`,
> api-style=rest.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --openapi-in ./api.yaml --artifacts openapi --technical --no-preflight --yes-install`
> **AI reports:** "Parsed OpenAPI (18 endpoints). Added Bearer JWT +
> OAuth2 client-credentials to `components.securitySchemes`, applied
> `security:` globally, tagged 4 endpoints as `public` (no security).
> Enriched: `openapi.yaml`."

> **User:** "data model for the new loyalty program (Postgres schema)"
> **AI silently resolves:** artifacts=`data-model`, engine hints Postgres
> (Spring default; overrides per-stack default).
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --design-question "the new loyalty program (Postgres schema)" --artifacts data-model --technical --no-preflight --yes-install`
> **AI reports:** "ER model authored (7 entities, 12 relationships),
> Postgres DDL for schema + indexes + FKs, seed migration file skeleton."

> **User:** "chain: architecture → requirements → generation for the loyalty program"
> **AI silently resolves:** three-step chain — (1) architecture author (ADR
> + HLD + OpenAPI), (2) requirements parse the HLD as product intent, (3)
> generation scaffold code from the OpenAPI + top-priority stories.
> **AI runs:** the three commands in sequence.
> **AI reports:** end-to-end summary linking ADR IDs to REQ IDs to
> scaffolded files.

### After one-shot execution

Always:

- Print a one-line summary (ADR / API / diagram / model counts, DESIGN-INDEX
  path, report path).
- Print the recommended follow-up from the role matrix (e.g. TL role after
  architecture → "generate scaffolds from the OpenAPI").
- Do NOT ask "want me to run the follow-up?" — the user will ask if they do.

Never:

- Ask what mode they wanted after the fact.
- Ask if they want to save preferences.
- Explain what you did (unless they ask).

### CLI equivalent for one-shot (technical mode)

Every one-shot prompt has a direct CLI equivalent using all Phase 1 flags:

```bash
npx ts-node .claude/skills/bmad-dept-code-architecture-agent/scripts/run.ts \
  --path . \
  --role <code> \
  --engine <stack> \
  --design-question "..." \
  --artifacts adr,hld,openapi,c4,sequence,threat-model,data-model \
  --api-style rest \
  --diagrams mermaid \
  --format markdown \
  --technical \
  --yes-install \
  --no-preflight \
  --sla-path .bmad/sla.yaml \
  --decisions-path .bmad/decisions.yaml
```

Swap `--design-question "..."` for `--adr "..."` (single ADR),
`--design-in ./legacy-HLD.md` (parse a design), or `--openapi-in ./api.yaml`
(review an existing contract). Add `--fail-on-overdue` for CI gates,
`--include-decided` to bypass decisions, `--create-branch` for a working
branch.

## Role-aware behavior

The Architecture agent adapts its **default artifact set**, **output
flavor**, and **recommended follow-up** to the role of the person driving
the run. Role selection is a **shared** concept across the 7-agent DCA
suite and is persisted per-project at `<projectRoot>/.bmad/role.yaml` (see
`skills/shared/role/ROLES.md`).

### Role check on activation

**Before running any mode**, the AI agent MUST perform the role handshake
(same shape as the Requirements agent):

1. Check for `<projectRoot>/.bmad/role.yaml`.
2. If ABSENT, ask the user — verbatim:

   > "Which role best matches how you'll use this plugin? Pick one from the
   > 10 codes below (or say 'generic' to skip):"

   Then list the **6 promoted roles** first:

   - `ea` — Enterprise Architect: portfolio-level HLD + strategic ADRs.
   - `tl` — Tech Lead / Solution Architect: solution HLD + LLD + component + sequence.
   - `de` — Senior Delivery Engineer: dev-focused LLD + API contracts.
   - `qa` — QA / SDET: testability-oriented sequence diagrams + contract tests.
   - `devops` — DevOps / SRE: deployment topology diagrams + infrastructure ADRs.
   - `security` — Security Engineer: STRIDE per component + security ADRs.

   Then the **4 additional roles**:

   - `pm` — Product Manager / PMO: capability-flavored HLD + trade-off ADRs.
   - `ba` — Business Analyst: data model + entity-relationship diagrams.
   - `migration` — Migration/Upgrade Lead: before/after HLDs + migration ADR.
   - `content` — Content/CMS Engineer: content-model design + taxonomy.

   Then the fallback: `generic` — balanced default.

3. Persist the choice using the shared `writeRoleFile(projectRoot, role,
   "interactive")` helper.
4. If PRESENT, read it silently and use the `role:` field — do NOT re-prompt.
5. **Per-run override**: `"as <role>"` prefix or `--role=<code>` on
   `run.ts`. Does not write `.bmad/role.yaml`.
6. **Permanent change**: `"switch role to <code>"` overwrites `.bmad/role.yaml`.

### Role → Architecture behavior matrix

The `roleDefaultArtifacts(role)` in `scripts/run.ts` codifies the artifact
defaults. This table adds the emphasis and follow-up per role.

| Role | Default artifact set | Emphasis | Recommended follow-up |
|---|---|---|---|
| `ea` | `adr, hld, c4, threat-model` | **Portfolio-level HLD** + **C4 Context + Container**. **Strategic ADRs** (build-vs-buy, platform strategy, product-line consolidation). Threat model is portfolio-level (data classification, cross-domain data flow). | "impact-analyze the top-3 integration boundaries" |
| `tl` | `adr, hld, lld, openapi, c4, sequence` | **Solution-level HLD** + **LLD** + **component diagrams** + **sequence diagrams**. **Team-level ADRs** (framework choice, integration approach, library selection). Full-stack API contracts. | "generate code scaffolds from the OpenAPI + top-5 sequence flows" |
| `de` | `lld, openapi, sequence` | **Dev-focused** — API contracts (OpenAPI 3.1 / GraphQL SDL), component-level LLD (class diagrams, method signatures, retry/error handling), one sequence per endpoint. | "generate the controller + service skeleton from the OpenAPI" |
| `qa` | `sequence, data-model` | **Testability** — sequence diagrams show test-injection points (mocks, stubs, contract-test boundaries). Data model calls out invariants that become negative-path tests. Contract tests generated from OpenAPI. | "test-coverage the components in the sequence diagram" |
| `devops` | `c4, sequence` | **Deployment topology** — C4 Container diagrams with deployment boundaries called out (pod / VM / lambda / CF worker). Runbook-linked sequence diagrams (deploy sequence, rollback sequence, incident-response sequence). Infrastructure ADRs (Kubernetes vs OCP, observability stack: OTEL vs Datadog vs New Relic). | "audit the impacted files for missing observability" |
| `security` | `threat-model, sequence` | **STRIDE threat model per component** + sequence diagrams that show trust boundaries and data flows crossing them. Security-scoped ADRs (auth flow, secrets handling, key rotation, data-classification, PCI scope). | "sonar-scan the impacted files for vulns matching the threat model" |
| `pm` | `adr, hld` | **HLD focused on capabilities + business outcomes** (not implementation detail). ADRs framed as decision trade-offs with cost/risk/timeline. No LLD, no diagrams beyond C4 Context. | "impact-analyze the top-3 capabilities against the estate" |
| `ba` | `hld, data-model` | **Data model + ER diagrams** (entities, attributes, cardinality, business rules). HLD focused on process flow + data lineage. | "map the data model to source-system tables" |
| `migration` | `adr, hld, data-model` | **Before/after HLDs** side by side, **migration-strategy ADR** (big-bang / strangler-fig / branch-by-abstraction / coexistence), coexistence architecture diagrams, source→target data-model mapping. | "impact + coverage delta between old and new" |
| `content` | `hld, data-model` | **Content-model design** — AEM CF models / EDS block hierarchy / Commerce catalog attributes. Taxonomy diagrams. HLD focused on authoring workflow + publish pipeline. | "generate the content-fragment / block scaffold" |
| `generic` | `adr, hld, c4` | Balanced default — a small pack covering decision + shape + context. | "impact-analyze the design we just authored" |

**Output flavors — what they mean.** The `executive` flavor is a
Markdown-first deliverable: business context, top-N decisions and
consequences, no rule-IDs — the XLSX is supplementary. The `technical`
flavor is the current default: standard XLSX + Markdown twin + full
artifact set. The `jira-csv` flavor emits a companion CSV where each row is
an ADR / component / endpoint as an importable Jira issue. The `sarif`
flavor is not meaningful for Architecture and falls back to `technical`.

### Cross-agent chaining hints per role

| Role | Next agent to invoke | Why |
|---|---|---|
| `ea` | `impact-analysis` | Trace integration boundaries from the new HLD across the estate. |
| `tl` | `generation` | Scaffold code from the OpenAPI + LLD. |
| `de` | `generation` | Scaffold the controller/service skeleton from the OpenAPI. |
| `qa` | `test-coverage` | Contract tests from the OpenAPI; sequence-driven integration tests. |
| `devops` | `audit` | Audit the impacted files for missing observability + runbook alignment. |
| `security` | `sonar-scan` | Vuln scan for the components + flows the STRIDE model flagged. |
| `pm` | `impact-analysis` | Impact of top-N capabilities before scoping. |
| `ba` | `requirements` | Turn the data model into BR/FR/AC so it can be delivered. |
| `migration` | `impact-analysis` + `test-coverage` | Cross-version impact + coverage delta on the migration surface. |
| `content` | `generation` | Emit content-fragment / block scaffold from the content model. |
| `generic` | `impact-analysis` | Trace impact of the design before committing to scope. |

The resolved role is exposed to child engines via `process.env.DCA_ROLE`
(and `DCA_ROLE_NAME` / `DCA_ROLE_FLAVOR` / `DCA_ROLE_SOURCE`), recorded on
the Run-Info sheet of the standardized report, and a one-line
`[dca-role] <Name> (source: <cli-flag|role-file|generic-fallback>)` is
printed to stderr on every run.

## Pre-flight: Auto-install Dependencies

Before ANY command execution, run the shared bootstrap. It installs the
`shared/` foundation (if missing) + this agent's `scripts/` deps in the
correct order, with a one-line confirmation prompt. First-time cost is
~80MB / ~30–60s; subsequent runs are silent no-ops.

**POSIX (macOS, Linux, WSL):**

```bash
bash .claude/skills/shared/bootstrap.sh architecture
```

**Windows (or when sh is unavailable):**

```bash
node .claude/skills/shared/bootstrap.js architecture
```

**Headless / CI mode (skip prompt):**

```bash
bash .claude/skills/shared/bootstrap.sh architecture --yes    # install without asking
bash .claude/skills/shared/bootstrap.sh architecture --no     # error if deps missing
```

**Behavior:**

- Both `node_modules` present → silent no-op (exit 0)
- Either missing → confirmation prompt, then install if approved
- User declines → exit 3
- Install failure → exit 4

**Instructions to the AI:** Do NOT skip this step. The bootstrap script
handles the confirmation — you do NOT need to ask separately. `run.ts` also
accepts `--yes-install` / `--no-install` and forwards them to bootstrap.

> **Note.** The `InstallAgentName` enum in `skills/shared/install/preflight.ts`
> may not yet include a dedicated `"architecture"` entry; if so, `run.ts`
> piggybacks on the requirements/test-coverage entry (identical shared deps:
> exceljs, fast-glob, mammoth). Invisible to the user; the bootstrap prompt
> still names the architecture agent. <!-- verify: enum entry -->

## Preflight — report the user's LLM & recommend a mode

The moment this command is triggered from an AI assistant, run the preflight
and tell the user — in one line — **which LLM they're on** and **whether the
target project fits their context window**:

```bash
npx ts-node scripts/run.ts --path {project} [--engine {engine}] --preflight
```

It prints the detected **model + context window**, the **project size**
(files/LOC/tokens), the **fit** (% of the window), and a **recommendation**
— **STATIC** (deterministic scaffold only) when the project is large,
**LLM** (rich authoring) when it comfortably fits, or **HYBRID**. Surface
it like:

*"You're on `<model>` (~`<ctx>` context). This project is ~`<pct>%` of your window → I recommend **<mode>**. Proceed?"*

**Rule of thumb for Architecture:** the LLM does most of the design work
here — this is not a scan agent. The preflight tells you whether the target
codebase + any `--design-in` / `--openapi-in` inputs fit comfortably so the
LLM can reference existing code idioms when authoring. If the fit is tight,
the agent falls back to template-driven authoring without repo-aware
idioms.

## Modes

The Architecture agent has two orthogonal modes, selected by which input
the user supplies:

### Mode: Author (default)

**Trigger:** `--design-question "…"` or `--adr "…"` on the CLI, or
"design / author ADR / design the API …" in the prompt.

**Steps:**

1. Resolve stack (from `--engine`, else auto-detect from repo signals).
2. Load `resources/adr-templates/<stack>.md`,
   `resources/hld-templates/<stack>.md`,
   `resources/lld-templates/<stack>.md`, and
   `resources/threat-models/<stack>.md` (whichever the resolved artifact
   set needs).
3. Load the master templates under `templates/` for the artifacts the run
   is producing.
4. Feed the design question + stack guides to the LLM authoring pass.
5. Emit the artifact files + the standard workbook + `DESIGN-INDEX.md`
   (see § Written files).
6. Report the artifact counts and next-agent handoff.

### Mode: Parse & enrich

**Trigger:** `--design-in <path>` or `--openapi-in <path>` on the CLI, or
"parse this HLD …" / "review this OpenAPI …" in the prompt.

**Steps:**

1. Resolve stack (from `--engine`, else auto-detect).
2. Parse the input:
   - `.md` — read as-is; segment sections via heading structure.
   - `.yaml` / `.json` — OpenAPI or GraphQL introspection; parse endpoints,
     schemas, security schemes.
3. Extract existing decisions / endpoints / components / diagrams as
   findings.
4. For each gap against the stack template, generate the missing content
   and mark it as **added** (goes onto the Delta sheet).
5. Emit an enriched artifact side-by-side with the source (never mutates
   the input).
6. Report the delta: how many decisions were pre-existing vs. added, how
   many endpoints gained security schemes, which NFRs were missing.

Both modes can be combined — `--design-in ./legacy-hld.md
--design-question "additional context: we're moving to Kubernetes"` treats
the design question as extra intent layered on top of the parsed HLD.

## Artifact catalog

`--artifacts` accepts a comma-separated list. `all` expands to every
artifact. Missing → the role-driven default is used (see § Role-aware
behavior).

| Artifact key | Written file(s) | Master template | Per-stack guide | Notes |
|---|---|---|---|---|
| `adr` | `ADR-<n>.md` (one per decision) | `templates/ADR.md` | `resources/adr-templates/<stack>.md` | MADR 3.0. Status = Proposed by default; advances via the decisions gate. |
| `hld` | `HLD.md` | `templates/HLD.md` | `resources/hld-templates/<stack>.md` (Phase 2.5b) | C4 L1 context + L2 container embedded. |
| `lld` | `LLD.md` | `templates/LLD.md` | `resources/lld-templates/<stack>.md` (Phase 2.5c) | C4 L3 component + class/module diagrams + sequence flows. |
| `openapi` | `openapi.yaml` | `templates/openapi-scaffold.yaml` | (stack default: paths and schemas per stack idioms) | OpenAPI 3.1. Enabled by `--api-style rest` (default) or `both`. |
| `graphql` | `schema.graphql` | (inline in engine) | (stack default) | SDL. Enabled by `--api-style graphql` or `both`. |
| `c4` | `c4-context.mermaid`, `c4-container.mermaid`, `c4-component.mermaid` | (inline in engine) | (stack default) | Mermaid (`--diagrams mermaid`, default) or PlantUML (`--diagrams plantuml`). |
| `sequence` | `sequence-<flow>.mermaid` (one per flow) | (inline in engine) | (stack default) | Same Mermaid/PlantUML options. |
| `threat-model` | `threat-model.md` | `templates/threat-model-stride.md` | `resources/threat-models/<stack>.md` (Phase 2.5c) | STRIDE per component + attack trees. |
| `data-model` | `data-model.md` (ER diagram + DDL) | (inline in engine) | (stack default: Postgres / MySQL / DynamoDB per stack) | ER diagram + schema DDL. Stack default: Spring→Postgres, Commerce PaaS→MySQL, App Builder→State SDK, AEM→JCR/CF models. |
| `all` | Every artifact resolvable given other flags. | — | — | Uses stack defaults for anything not disambiguated by `--api-style` / `--diagrams`. |

`--format both` is accepted but currently emits markdown only (docx writer
is planned; a warning is printed on stderr).

## Per-stack authoring instructions

For each of the 8 stacks the Architecture agent loads three-to-four
per-stack resource files at authoring time. Keep the tone stack-native — an
AEM HLD reads like an AEM HLD, not a generic doc with the word "AEM"
sprinkled in.

### AEM (AEMaaCS / AMS) — engine `aem`

- **ADR guide:** `resources/adr-templates/aem.md`
- **HLD guide:** `resources/hld-templates/aem.md` (Phase 2.5b)
- **LLD guide:** `resources/lld-templates/aem.md` (Phase 2.5c)
- **Threat-model guide:** `resources/threat-models/aem.md` (Phase 2.5c)
- **Emphasis:** Sling/OSGi component decomposition (Sling Model + HTL +
  dialog), editable-template + policy alignment, dispatcher topology
  (farms, filters, cache rules, invalidation agents), AEM CF/EF reuse,
  Cloud Manager pipeline shape (or AMS Jenkins), OSGi run-mode
  configuration precedence, publisher/dispatcher/CDN tiering.
- **API-contract note:** AEM services often surface as Sling servlets or
  Sling Model exporters; when authoring OpenAPI, target the servlet path
  (`/bin/*` or `/content/dam/...`) + `.model.json` selectors, and document
  authentication via `com.adobe.granite.auth.ims` for AEMaaCS.
- **Data-model note:** JCR node types + CF models over relational schemas.
- **Diagram note:** C4 Container diagram should call out Author, Publish,
  Dispatcher, CDN as separate deployment nodes.

### Adobe Commerce (PaaS / Magento 2) — engine `commerce-paas` (alias `commerce`)

- **ADR guide:** `resources/adr-templates/commerce-paas.md`
- **HLD guide:** `resources/hld-templates/commerce-paas.md` (Phase 2.5b)
- **LLD guide:** `resources/lld-templates/commerce-paas.md` (Phase 2.5c)
- **Threat-model guide:** `resources/threat-models/commerce-paas.md` (Phase 2.5c)
- **Emphasis:** di.xml preferences vs plugins vs observers (upgrade-cost
  ADR), plugin architecture (before/after/around), cache-tag strategy for
  full-page cache invalidation, message-queue topology (RabbitMQ
  publishers/consumers), db schema patch strategy, multi-store / customer-
  group scoping, admin RBAC + 2FA.
- **API-contract note:** OpenAPI targets the Magento REST endpoints
  (`/rest/V1/*`); GraphQL SDL targets the schema.graphqls surface.
- **Data-model note:** MySQL/MariaDB EAV vs flat tables — call out attribute
  scope, indexer implications.
- **Diagram note:** Container diagram should include RabbitMQ, Redis,
  Elasticsearch/OpenSearch (or Live Search), Varnish/FPC, Adminhtml
  separation.

### Adobe Commerce SaaS — engine `commerce-saas`

- **ADR guide:** `resources/adr-templates/commerce-saas.md`
- **HLD guide:** `resources/hld-templates/commerce-saas.md` (Phase 2.5b)
- **LLD guide:** `resources/lld-templates/commerce-saas.md` (Phase 2.5c)
- **Threat-model guide:** `resources/threat-models/commerce-saas.md` (Phase 2.5c)
- **Emphasis:** drop-in composition (`@dropins/storefront-*`) vs custom
  block, Catalog Service vs Live Search for facets, storefront-events SDK
  wiring for marketing/analytics, API Mesh vs direct Catalog Service call,
  PIM integration approach.
- **API-contract note:** no `app/code` — API contracts consume
  Catalog/Live-Search/Payment-Services GraphQL; OpenAPI here typically
  describes middleware built on API Mesh.
- **Data-model note:** Catalog Service owns product data; local models are
  view-side (drop-in state + Storefront Events schema).
- **Diagram note:** Container diagram is edge-heavy — EDS/CDN, Catalog
  Service, Live Search, Payment Services, drop-ins as clients.

### Apache Sling / Shaft (sling-12) — engine `sling`

- **ADR guide:** `resources/adr-templates/sling.md`
- **HLD guide:** `resources/hld-templates/sling.md` (Phase 2.5b)
- **LLD guide:** `resources/lld-templates/sling.md` (Phase 2.5c)
- **Threat-model guide:** `resources/threat-models/sling.md` (Phase 2.5c)
- **Emphasis:** bundle boundary split, Feature Model vs Sling Starter
  composition, JCR vs external DB, MDM (master-data-management) approach,
  resource-resolver + service-user configuration, throttling / rate
  limiting on public endpoints, health-check topology.
- **API-contract note:** Sling servlets + Sling Model exporters — OpenAPI
  targets the resource-resolver-mapped paths.
- **Data-model note:** JCR node types; if an external DB is present,
  document the sync/write-through pattern.
- **Diagram note:** Feature Model dependency graph in the LLD.

### Spring Boot — engine `spring`

- **ADR guide:** `resources/adr-templates/spring.md`
- **HLD guide:** `resources/hld-templates/spring.md` (Phase 2.5b)
- **LLD guide:** `resources/lld-templates/spring.md` (Phase 2.5c)
- **Threat-model guide:** `resources/threat-models/spring.md` (Phase 2.5c)
- **Emphasis:** bean topology (component scan boundary, primary vs
  qualifier), Spring Cloud integration (config server, service registry,
  circuit breaker), MVC vs WebFlux, JPA vs jOOQ vs JDBC, Spring Security
  posture (resource-server vs gateway offload), Actuator + Micrometer
  vs OTEL SDK direct.
- **API-contract note:** OpenAPI generated from controllers
  (springdoc-openapi) or authored contract-first (openapi-generator).
- **Data-model note:** Postgres default; call out schema migration tool
  (Flyway / Liquibase) as an ADR when both are candidates.
- **Diagram note:** Container diagram should show pods + sidecars +
  external DB/broker + secrets store.

### Adobe App Builder — engine `app-builder`

- **ADR guide:** `resources/adr-templates/app-builder.md`
- **HLD guide:** `resources/hld-templates/app-builder.md` (Phase 2.5b)
- **LLD guide:** `resources/lld-templates/app-builder.md` (Phase 2.5c)
- **Threat-model guide:** `resources/threat-models/app-builder.md` (Phase 2.5c)
- **Emphasis:** API Mesh resolver composition vs middleware direct, I/O
  Events provider/consumer wiring vs webhooks, action design (single-action
  vs sequence vs stateful), state backend (Files SDK vs State SDK vs
  external Cosmos), UI Extension pattern (App Registry, uix-guest).
- **API-contract note:** API Mesh handlers surface GraphQL; standalone I/O
  Runtime actions surface REST — usually author both.
- **Data-model note:** State SDK (short-lived) + external persistent store;
  call out region + retention.
- **Diagram note:** Sequence diagrams should highlight event flow
  (provider → I/O Events → consumer action) and IMS token exchange.

### Edge Delivery Services (EDS) — engine `eds`

- **ADR guide:** `resources/adr-templates/eds.md`
- **HLD guide:** `resources/hld-templates/eds.md` (Phase 2.5b)
- **LLD guide:** `resources/lld-templates/eds.md` (Phase 2.5c)
- **Threat-model guide:** `resources/threat-models/eds.md` (Phase 2.5c)
- **Emphasis:** block hierarchy discovery (`blocks/<block>/<block>.js`),
  `scripts.js` phases (load-eager / load-lazy / load-delayed), auto-block
  extraction strategy, LCP-critical asset pattern, consent-mode + Adobe
  Launch integration, RUM/CrUX telemetry wiring, storefront-events adoption
  for marketing tags.
- **API-contract note:** EDS is edge-cached; API contracts here describe
  the external content APIs the blocks fetch from, not the CMS itself.
- **Data-model note:** the sheet-driven / helix-query content model;
  taxonomy comes from Google Docs / SharePoint index.
- **Diagram note:** Container diagram is single-tier (edge worker + author-
  side Google Docs / SharePoint + external content sources).

### EDS + Commerce — engine `eds-commerce`

- **ADR guide:** `resources/adr-templates/eds-commerce.md`
- **HLD guide:** `resources/hld-templates/eds-commerce.md` (Phase 2.5b)
- **LLD guide:** `resources/lld-templates/eds-commerce.md` (Phase 2.5c)
- **Threat-model guide:** `resources/threat-models/eds-commerce.md` (Phase 2.5c)
- **Emphasis:** all EDS emphasis + drop-in wiring pattern, cart state
  persistence (localStorage vs commerce backend), auth token exchange
  (IMS → Commerce), Storefront Events SDK propagation, product-picker
  approach (Live Search vs Catalog Service), consent-mode + PII redaction
  for Commerce SaaS events.
- **API-contract note:** documents the drop-in-consumed GraphQL surface +
  any middleware layer (usually API Mesh).
- **Data-model note:** cart is client-side + persisted server-side; call
  out the sync contract.
- **Diagram note:** Container diagram is edge + Adobe Commerce SaaS +
  Payment Services + IMS.

## Output contract

The Architecture agent emits the standardized DCA outputs into
`<project>/architecture-reports/` (override with `--output`), via the
shared `emitStandardOutputs` (agent id `architecture`). The 15-column
Summary contract is preserved so downstream agents (Impact Analysis,
Generation, Test Coverage, Audit, Sonar Scan) can chain off the same row
shape.

### Sheets

| Sheet | Contents |
|---|---|
| **Run Info** | Model, context window, stack, role + source, project name / root, design-question excerpt, `--design-in` / `--openapi-in` paths, artifact set, api style, diagram format, ADR/API/diagram/model counts. |
| **Summary** | The 15-column contract, one row per ADR / HLD-section / LLD-section / API endpoint / diagram / threat / data-entity. |
| **Severity Breakdown** | Counts per severity bucket (`decision` / `risk` / `constraint` / `principle`). |
| **By Category** | Counts per artifact category (`adr` / `hld` / `lld` / `api` / `c4` / `sequence` / `threat` / `data-model`). |
| **Recommendations** | Roll-up of the `recommendation` column, sorted by severity. |
| **SLA Status** (Phase 1) | Only when `--no-sla` is NOT set. See § SLA tracking. |
| **Delta** (parse mode) | Pre-existing vs. added — for each source section, what came from the parsed input vs. what the LLM added. Empty in author mode. |

### 15-column Summary contract

Each finding row carries:

| Column | Value |
|---|---|
| `id` | `ARCH-<n>` (monotonic per run) |
| `title` | Artifact title — ADR title / HLD section / endpoint / diagram / threat / entity |
| `description` | Full text (context+decision for ADR; component summary for HLD/LLD; endpoint summary for API; flow summary for diagrams; threat + impact for STRIDE; entity + attributes for data-model) |
| `tech-stack` | `aem` \| `commerce-paas` \| `commerce-saas` \| `sling` \| `spring` \| `app-builder` \| `eds` \| `eds-commerce` |
| `category` | `adr` \| `hld` \| `lld` \| `api` \| `c4` \| `sequence` \| `threat` \| `data-model` |
| `code-reference` | File path of the emitted artifact (`ADR-042.md` / `HLD.md#3.2-container` / `openapi.yaml#/paths/~1promotions/post` / `sequence-checkout.mermaid`) |
| `severity` | `decision` \| `risk` \| `constraint` \| `principle` (mapped from Phase-1 severity vocabulary: `decision`≈HIGH, `risk`≈CRITICAL when residual-risk is HIGH else HIGH, `constraint`≈MEDIUM, `principle`≈LOW) |
| `confidence` | `high` (from parsed source / explicit answer) \| `medium` (LLM-authored, template-aligned) \| `low` (inferred / assumed — needs review) |
| `ruleId` | `ARCH-<stack>-<type>` (e.g. `ARCH-aem-adr-dispatcher`, `ARCH-commerce-paas-api-openapi`, `ARCH-spring-threat-tampering`) |
| `recommendation` | Authoring next-step: for ADRs, the reviewer to loop in; for open questions, the answer needed; for STRIDE, the mitigation to design |
| `impact` | Impact statement (per-role phrasing: business impact for pm; integration impact for ea; testable impact for de/qa; blast radius for security) |
| `effort` | T-shirt: `S` \| `M` \| `L` \| `XL` (per stack; see LLD template) |
| `comments` | Free text — reviewer notes, open questions, blocking dependencies |
| `owner` | Empty at authoring time; the TL/EA fills it in during the review pass |
| `status` | `draft` (default) \| `reviewed` \| `approved` — advances via the decisions gate on subsequent runs |

### Written files

- `ADR-<n>.md` — one file per ADR, rendered from `templates/ADR.md`.
- `HLD.md` — rendered from `templates/HLD.md`.
- `LLD.md` — rendered from `templates/LLD.md`.
- `openapi.yaml` — rendered from `templates/openapi-scaffold.yaml`.
- `schema.graphql` — SDL, when `--api-style graphql` or `both`.
- `c4-context.mermaid`, `c4-container.mermaid`, `c4-component.mermaid` —
  C4 L1/L2/L3 diagrams.
- `sequence-<flow>.mermaid` — one file per named flow.
- `threat-model.md` — rendered from `templates/threat-model-stride.md`.
- `data-model.md` — ER diagram + schema DDL (stack default).
- `DESIGN-INDEX.md` — always emitted; a manifest of inputs → artifacts.
- `architecture-<branch>-<timestamp>-agent-report.xlsx` — the standardized workbook.
- `architecture-<branch>-<timestamp>-agent-report.md` — Markdown twin.
- `CHANGE-LOG.md` — appended at the project root with a one-line run
  summary (e.g. `Architecture design: 3 ADR(s), 1 API(s), 5 diagram(s), 1 model(s); 24 finding(s).`).
- Optional standard git branch `dca/architecture-<stack>-<timestamp>` — cut
  from `production`/`main`/`master`/`develop` (or `--source-branch <name>`)
  when `--create-branch` is passed.

## Findings gate (Phase 1)

The Architecture agent participates in the shared **decisions gate**
(`.bmad/decisions.yaml`) exactly the way the other six agents do. For this
agent, decisions apply to specific design **decisions** — mark an ADR as
**accepted** (Status=Approved, freeze), **deferred** (needs more info,
moves to SLA sheet), or **wontfix** (rejected alternative, suppressed from
Summary but retained in the ADR file itself).

**How it applies here:**

- On author-mode reruns, if an ADR was marked `wontfix` for the current
  release (`release: r2026.09`), the agent suppresses it from the Summary
  sheet — the ADR file itself remains in `architecture-reports/`, it just
  stops surfacing as an open item.
- `deferred` decisions move to the SLA sheet with a `next-review` date, not
  the Summary.
- `accepted` decisions are frozen at the current confidence — future reruns
  won't re-author them (they still appear in the Summary but with
  Status=Approved).

**Flags:**

- `--include-decided` — show findings even when a decision exists.
- `--decisions-path <path>` — override the decisions file location.
- `--ignore-decision-expiry` — keep suppressing findings even when the
  decision has expired.
- `--list-decisions` — print every decision in `.bmad/decisions.yaml` and exit.

See `skills/shared/decisions/` and the Docusaurus concept page for the full
YAML shape.

## SLA tracking (Phase 1)

The Architecture agent participates in the shared **SLA gate**
(`.bmad/sla.yaml`). For this agent, SLA is interpreted as
**design-approval SLA**: how long an ADR can sit in `Proposed` (or a
finding in `draft`) per role before it becomes OVERDUE.

**Default SLAs** (customize in `.bmad/sla.yaml`):

| Role | `decision` (HIGH) | `risk` (CRITICAL/HIGH) | `constraint` (MEDIUM) | `principle` (LOW) |
|---|---|---|---|---|
| `ea` | 5 days | 3 days | 10 days | ∞ |
| `tl` | 3 days | 2 days | 7 days | ∞ |
| `de` | 2 days | 2 days | 5 days | ∞ |
| `security` | 3 days | 1 day | 5 days | ∞ |
| `devops` | 3 days | 2 days | 7 days | ∞ |
| `pm` | 5 days | 3 days | 10 days | ∞ |
| (other) | 5 days | 3 days | 10 days | ∞ |

**Flags:**

- `--sla-path <path>` — override the SLA file location.
- `--no-sla` — skip SLA computation + sheet.
- `--fail-on-overdue` — exit code 6 if any finding is OVERDUE per role
  SLA. Wire this into CI to fail the pipeline when an ADR has sat in
  Proposed too long.

The SLA sheet on the workbook shows each finding's age, its SLA threshold
given its severity + owner-role, and its state (`fresh` / `nearing` /
`overdue`).

## Cross-agent chaining hints

Architecture is the **design entry point** of the DCA workflow — where
Requirements formalizes the "what", Architecture formalizes the "how".
Recommended fan-out:

```
Requirements (author BRD from description)
    ↓
Architecture (--design-question or --design-in on the BRD)
    → produce ADRs + HLD + LLD + OpenAPI + C4 + sequences + STRIDE + data model
    ↓
Impact Analysis (--brd or --design-in)
    → trace impacted code across the estate
    ↓
Generation (--type <matches component in LLD>)
    → scaffold code from OpenAPI + approved LLD
    ↓
Test Coverage (--mode full)
    → contract tests from OpenAPI; integration tests from sequence flows
    ↓
Audit + Sonar Scan
    → baseline quality + vulnerabilities on the scaffolded surface
```

Concrete one-liners the AI agent should offer as follow-ups after an
Architecture run:

- **Architecture → Requirements (bidirectional loop)** — "align the BRD to
  the new HLD" → re-runs requirements parse-mode on the enriched HLD so
  BR/FR/NFR rows pick up the design-side NFR additions.
- **Architecture → Generation** — "scaffold code from the OpenAPI + LLD"
  → runs `generation --type <matches LLD components>`.
- **Architecture → Impact Analysis** — "impact-analyze the ADR before we
  commit" → uses the ADR's affected-components list to trace blast radius.
- **Architecture → Audit** — "audit the impacted files against the LLD"
  → runs `audit` on the components named in the LLD, so drift is visible.
- **Architecture → Sonar Scan** — "sonar-scan the components in the STRIDE
  model" → baseline vulns on the exact components the threat model flagged.

## Constraints / non-goals

**This agent authors designs. It does not:**

- **Execute or validate the design against live systems.** No PoC
  generation (that's Generation), no runtime probing (that's Audit / Sonar
  Scan), no infrastructure provisioning. Architecture emits the artifacts;
  the operator runs / validates.
- **Enforce an approval workflow beyond `status` markers.** The `status`
  column on each Summary row (`draft` / `reviewed` / `approved`) and the
  ADR file's Status field are markers, not gates. The **decisions gate**
  and **SLA gate** provide the closest thing to workflow. The actual
  review handshake happens in your ADR tooling of choice (GitHub PR
  labels, Backstage TechDocs, ADR-Manager, Confluence).
- **Do STRIDE from source code.** STRIDE needs a component list and data
  flow. The agent extracts these from a supplied HLD (`--design-in`) or
  the components it just authored — it does not reverse-engineer them from
  arbitrary code. If you point it at a codebase without a design, it emits
  an INFO finding pointing to `requirements` or `audit` as prerequisite.
- **Author against unsupported stacks.** Architecture is Adobe/JVM-focused
  (the same 8 stacks as the rest of the DCA suite). If you point it at a
  Ruby-on-Rails or Django repo, `--engine` auto-detection returns
  `generic` and the agent falls back to stack-agnostic templates.
- **Guarantee ADR alternatives are exhaustive.** ADRs surface 3–5
  alternatives per decision (the ones the stack guide and LLM combine on);
  it will not consider every possible library / product on the market.
  Add missing candidates with `--design-question "compare X vs Y vs Z"`.
- **Handle multi-input parse in one run.** Currently one of
  `--design-in` / `--openapi-in` per invocation. Chain runs manually when
  you need to merge multiple source designs.

**What the agent does authoritatively:**

- Turn a design question into a MADR-format ADR with a stack-native
  decision-drivers section, real alternatives, and consequences.
- Author HLD/LLD skeletons aligned to the stack template (dispatcher
  topology for AEM; RabbitMQ + FPC for Commerce; block hierarchy for EDS).
- Emit OpenAPI 3.1 / GraphQL SDL that includes security schemes, error
  models, and a `/health` example.
- Emit C4 L1/L2/L3 diagrams and sequence diagrams in Mermaid (default) or
  PlantUML.
- Emit a STRIDE threat model with a per-component threat table and
  residual-risk scoring.
- Emit a stack-appropriate data model (ER diagram + DDL, or JCR node
  types, or CF models, or Storefront Events schema).
- Adapt the artifact set and output shape to the resolved role.
- Participate in the shared decisions + SLA gates so ADRs can be frozen
  for a release and overdue Proposed ADRs can gate CI.

## Commands Reference

| Trigger | Action |
|---------|--------|
| `author ADR` / `write ADR` / `draft design decision` | Author mode; prompt for the design question if missing |
| `should we use X or Y?` | Author mode with `--adr "X vs Y"` |
| `write HLD` / `author HLD` | Author mode with `--artifacts hld` |
| `write LLD` / `author LLD` | Author mode with `--artifacts lld` |
| `design the API for X` | Author mode with `--artifacts openapi,c4,sequence` |
| `OpenAPI for X` | Author mode with `--artifacts openapi --api-style rest` |
| `GraphQL schema for X` | Author mode with `--artifacts graphql --api-style graphql` |
| `C4 context/container/component diagram` | Author mode with `--artifacts c4` |
| `sequence diagram for X` | Author mode with `--artifacts sequence` |
| `threat model X` / `STRIDE X` | Author mode with `--artifacts threat-model,sequence` |
| `data model for X` | Author mode with `--artifacts data-model` |
| `parse ./hld.md` / `enrich this HLD` | Parse mode with the given `--design-in` |
| `review this OpenAPI at ./api.yaml` | Parse mode with the given `--openapi-in` |
| `design as <role>` | Author mode with `--role <role>` (per-run override) |
| `list architecture stacks` | `--list-engines` |
| `switch role to <code>` | Rewrite `.bmad/role.yaml` |
| `switch intake to interactive` / `technical` | Rewrite `.bmad/intake.yaml` |

## CLI Options

| Flag | Description |
|------|-------------|
| `--path <dir>` | Project root (default: `.`) |
| `--engine <engine>` | `aem` \| `commerce-paas` (alias `commerce`) \| `commerce-saas` \| `sling` \| `spring` \| `app-builder` \| `eds` \| `eds-commerce` (auto-detect if omitted) |
| `--output <dir>` | Output directory (default `<project>/architecture-reports`) |
| `--interactive` | Interactive intake mode (prompts step-by-step) |
| `--technical` | Technical intake mode (silent error on missing required inputs) |
| `--list-engines` | List available engines |
| `--role <code>` | Role adaptation — persisted at `<project>/.bmad/role.yaml`; `--role` wins for a single run |
| `--design-question <text>` | One-shot natural-language design question |
| `--design-in <path>` | Parse an existing HLD/LLD (`.md` / `.yaml` / `.json`) and enrich it |
| `--adr <text>` | Inline ADR title/topic when authoring a single ADR |
| `--openapi-in <path>` | Existing OpenAPI YAML/JSON to review or extend |
| `--artifacts <csv>` | Which artifacts to author (comma-separated). Values: `adr`, `hld`, `lld`, `openapi`, `graphql`, `c4`, `sequence`, `threat-model`, `data-model`, `all`. Default: role-driven selection. |
| `--api-style <rest\|graphql\|both>` | API-contract style. Default: `rest`. |
| `--format <markdown\|both>` | Output format. Default: `markdown`. `both` currently writes markdown only (docx planned) with a warning. |
| `--diagrams <mermaid\|plantuml>` | Diagram format. Default: `mermaid`. |
| `--create-branch` | Cut standard branch `dca/architecture-<stack>-<timestamp>` before writing outputs |
| `--source-branch <name>` | Source branch for `--create-branch` (default candidates: production, main, master, develop) |
| `--preflight` | Print the model/context + STATIC/LLM/HYBRID advisory and exit |
| `--no-preflight` | Suppress the preflight advisory that otherwise prints on every run |
| `--yes-install` | Install missing dependencies without confirmation |
| `--no-install` | Error out if dependencies missing (do not install) |
| `--include-decided` | Show findings even when a decision exists in `.bmad/decisions.yaml` |
| `--decisions-path <path>` | Override decisions file location |
| `--ignore-decision-expiry` | Keep suppressing findings even when the decision has expired |
| `--list-decisions` | Print every decision in `.bmad/decisions.yaml` and exit |
| `--sla-path <path>` | Override SLA file location |
| `--no-sla` | Skip SLA computation + sheet |
| `--fail-on-overdue` | Exit code 6 if any finding is OVERDUE per role SLA |
| `--help` | Print usage and exit |
