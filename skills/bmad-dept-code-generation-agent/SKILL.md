---
name: bmad-dept-code-generation-agent
description: "AI-driven code generation agent (one of the 5 agents in the BMAD DEPT Code Agent suite — audit, generation, impact-analysis, sonar-scan, test-coverage). Generates production-ready code across 8 engine stacks — AEM (AEMaaCS via MCP + AEM AMS via LLM skills), Apache Sling/Shaft, Spring Boot, Adobe Commerce PaaS (Magento 2), Adobe Commerce SaaS, Adobe App Builder (API Mesh, Commerce Admin UI Extensibility, AEM UI Extensibility, Experience Cloud Shell, Asset Compute), Edge Delivery Services, and EDS+Commerce — via deterministic scaffolders and LLM/MCP generation, following platform best practices, security standards, and scalable architecture."
---

# BMAD DEPT Code Agent — Generation Skill

## Purpose

AI-driven code generation agent that produces production-ready code by combining:
1. **Live instance context** via AEM MCP servers (AEMaaCS only — components, templates, content structure)
2. **LLM Skills** — Built-in generation patterns for AEM AMS and Adobe Commerce (no MCP required)
3. **Project-level conventions** detected from the codebase (naming, packages, patterns)
4. **Adobe best practices** from built-in resource packs
5. **Security-first** — OWASP Top 10, Magento security checklist, input validation, ACL enforcement

Generates all layers of an AEM project: Sling Models, HTL templates, OSGi services, Content Fragment Models, Experience Fragments, Editable Templates, Dispatcher configs, CI/CD pipelines, Workflows, Servlets, Schedulers, and unit tests.

Generates all layers of an Adobe Commerce project: Modules, Plugins, Observers, API endpoints, GraphQL resolvers, Admin UI components, Storefront blocks/widgets, Console commands, Cron jobs, Message queues, Setup scripts, and integration tests.

### Platform Support:
- **AEMaaCS** — Full MCP integration (remote + local), Cloud Manager, SDK validation
- **AEM AMS** — LLM skills-based generation, project scanning, Maven + CI/CD deploy, no MCP
- **Sling-12 / Shaft** — LLM patterns (`resources/sling-shaft/`) + **deterministic scaffolder** (`--scaffold --engine sling`): OSGi services, Sling servlets, Sling filters, Sling Models. Java/Apache Sling, JDK 8+, no MCP
- **Spring Boot** — LLM patterns (`resources/spring-boot/`) + **deterministic scaffolder** (`--scaffold --engine spring`): REST controllers+DTOs, services, JPA repos+entities. Java 17/21 + Jakarta, Maven or Gradle, no MCP
- **Adobe Commerce** — LLM skills-based generation, module scaffolding, PHP best practices, Magento 2 architecture
- **Adobe App Builder** — Serverless platform on Adobe I/O Runtime encompassing all extensibility services:
  - Core App Builder — Headless actions, React Spectrum SPA, `aio` CLI, `app.config.yaml`
  - API Mesh — GraphQL gateway combining multiple sources (`aio api-mesh`)
  - Commerce Admin UI Extensibility — Admin UI SDK extensions (`commerce/backend-ui/1`), custom menus/pages/mass actions/banners via `@adobe/uix-guest`
  - AEM UI Extensibility — CF Console/Editor, Universal Editor, Experience Hub, Assets View extensions, action bar/header menu/panel customizations via `@adobe/uix-guest`
  - Experience Cloud Shell SPA (`dx/excshell/1`)
  - Asset Compute Workers (`dx/asset-compute/worker/1`)
  - MCP integration via Commerce App Builder MCP server
- **Adobe Commerce SaaS** — LLM patterns (`resources/commerce-saas/`) + **deterministic scaffolder** (`--scaffold --engine commerce-saas`): Catalog Service / Live Search queries, storefront drop-in blocks. JS, no MCP
- **Edge Delivery Services (EDS)** — LLM patterns (`resources/eds/`) + **deterministic scaffolder** (`--scaffold --engine eds`): blocks. JS, no MCP
- **EDS + Commerce** — LLM patterns (`resources/eds-commerce/`) + **deterministic scaffolder** (`--scaffold --engine eds-commerce`): drop-in storefront blocks. JS, no MCP

## MCP Integration (Zero-Config, Pre-Configured)

This module ships with **pre-configured MCP** for both remote (Adobe Cloud) and local (AEM SDK) servers. Consumers do not configure MCP — the development team maintains the registry.

### Auto-Provisioning

On first activation, if `.mcp.json` does not contain AEM server entries, the agent **automatically** runs:
```bash
npx ts-node {skill_path}/scripts/run.ts --setup --path {project_root}
```

This creates (without user intervention):
- `.mcp.json` — all MCP server entries (Adobe remote + community local); the merge is idempotent (existing server keys are preserved)
- `.bmad/mcp-registry.toml` — capability-to-server mapping
- `.env` — local SDK connection defaults (`AEM_HOST=localhost:4502`, `admin`/`admin`) if not already present
- `.gitignore` — appends `.env` and `.bmad/` so secrets and local config are not committed

**The consumer does nothing.** The agent self-provisions on first use.

### Pre-Configured Servers

#### Remote — Adobe Official (Cloud Instances)

| Server | URL | Capabilities |
|--------|-----|-------------|
| AEM Content | `https://mcp.adobeaemcloud.com/adobe/mcp/content` | component-discovery, template-discovery, site-structure, content-crud, asset-operations |
| AEM Content (Read-Only) | `https://mcp.adobeaemcloud.com/adobe/mcp/content-readonly` | component-discovery, template-discovery, site-structure |
| AEM Cloud Manager | `https://mcp.adobeaemcloud.com/adobe/mcp/cloudmanager` | pipeline-management |
| AEM Experience Governance | `https://mcp.adobeaemcloud.com/adobe/mcp/experience-governance` | brand-governance |

**Auth:** OAuth via Adobe ID — sign in when your IDE prompts.

#### Local — Community (AEM SDK on localhost)

| Server | Package | Capabilities |
|--------|---------|-------------|
| AEM MCP Server | `aem-mcp-server` (npx) | component-discovery, template-discovery, site-structure, content-crud, content-validation |
| AEM Dev MCP Server | `aem-dev-mcp-server` (npx) | osgi-config, osgi-bundles, health-check, content-validation |

**Auth:** Basic auth via `.env` (`AEM_USER`/`AEM_PASSWORD`).

### Capability Resolution

The agent uses capabilities, not specific tool names (per Adobe's guidance: *"Do not hardcode tool names in prompts"*).

```
Resolution order:
1. .bmad/mcp-registry.toml → explicit capability mapping
2. priority field → lower number wins (Adobe = 1, Community = 2)
3. prefer_mode → "auto" (remote first, local fallback)
4. If no MCP available → fallback to source scanning
```

| Capability | Used for | Fallback (no MCP) |
|------------|----------|-------------------|
| `component-discovery` | Avoid naming conflicts, detect patterns | Scan `ui.apps/.../components/` |
| `template-discovery` | Understand page structure | Scan `ui.content/.../templates/` |
| `site-structure` | Content hierarchy, i18n | Scan `ui.content/.../content/` |
| `content-crud` | Create/update pages, CFs | Cannot operate |
| `osgi-config` | Match existing config patterns | Scan `ui.config/.../osgiconfig/` |
| `osgi-bundles` | Verify dependencies | Read `core/pom.xml` |
| `content-validation` | Post-generation verification | Skip |
| `pipeline-management` | Cloud Manager pipelines | Skip |
| `brand-governance` | Content compliance | Skip |

### Adding a Custom MCP Server

Teams can add proprietary MCP servers without editing the module source. Add to `.bmad/mcp-registry.toml`:

```toml
[[providers]]
name = "My Org AEM Tools"
mode = "custom"
mcp_server_key = "MY-AEM"
capabilities = ["component-discovery", "template-discovery"]
priority = 1  # overrides Adobe + community
```

And add the matching entry to `.mcp.json`.

## Activation

This skill activates when the user asks to:
- Generate AEM components or modules
- Create a Sling Model
- Scaffold HTL templates
- Create an OSGi service/configuration
- Generate Content Fragment Models
- Create Experience Fragment templates
- Set up Dispatcher configs
- Generate unit tests for AEM code
- Create Cloud Manager pipeline configuration
- Generate Adobe Commerce module
- Create a Commerce plugin (before/after/around)
- Scaffold a Commerce observer
- Create REST/GraphQL API endpoint
- Generate Admin UI grid/form
- Create a storefront block or widget
- Scaffold a Commerce console command
- Generate a cron job
- Create a message queue consumer/publisher
- Set up Commerce DB schema (db_schema.xml)
- Generate Commerce integration/unit tests
- **Create an App Builder application or action**
- **Scaffold an App Builder extension (Experience Cloud Shell, Asset Compute)**
- **Generate API Mesh configuration**
- **Create a Commerce Admin UI extension (menu, page, mass action, order view button, banner)**
- **Scaffold Commerce UI extensibility app with Admin UI SDK**
- **Generate an AEM UI extension (CF Console, CF Editor, Universal Editor, Experience Hub, Assets View)**
- **Create AEM UI extension action bar button, header menu, or panel**
- **Generate I/O Runtime serverless actions**
- **Create I/O Events publisher/consumer action**
- **Generate a Sling/Shaft OSGi service, Sling servlet, request filter, or Sling Model**
- **Create a Spring Boot REST controller, service, or JPA repository/entity**

> All App Builder services (API Mesh, Commerce UI Extensibility, AEM UI Extensibility, Experience Cloud Shell, Asset Compute) use patterns from `resources/app-builder/`.
> **Sling/Shaft** uses `resources/sling-shaft/patterns.md`; **Spring Boot** uses `resources/spring-boot/patterns.md`.

### Deterministic scaffolder (fast path for common artifacts)

For standard, repeatable artifacts prefer the deterministic scaffolder — it generates real files and emits the
standardized outputs: a timestamped Excel report in `generation-reports/`
(`generation-<branch>-<timestamp>-agent-report.xlsx`) plus an appended `CHANGE-LOG.md`, and can optionally cut a
`dca/generation-<stack>-<timestamp>` working branch (`--create-branch`, from production/main/master/develop or
`--source-branch <name>`):

```bash
npx ts-node scripts/run.ts --list-types
npx ts-node scripts/run.ts --scaffold --engine sling  --type osgi-service    --name OrderSync --package com.acme.shaft.order --path .
npx ts-node scripts/run.ts --scaffold --engine spring --type rest-controller --name Order      --package com.acme.app        --path .
npx ts-node scripts/run.ts --scaffold --engine app-builder --type action     --name "order sync" --path . [--dry-run]
```

Types by stack (8 stacks, 24 scaffolder types — the live source of truth is the `GENERATORS` map in
`scripts/scaffold/generators.ts`):
- `aem` → sling-model, osgi-service, sling-servlet, component (HTL + dialog), workflow-process
- `sling` → osgi-service, sling-servlet, sling-filter, sling-model
- `spring` → rest-controller (+DTO), service, jpa-repository (+entity)
- `commerce-paas` → module, plugin, observer, graphql-resolver, controller
- `commerce-saas` → catalog-query, storefront-block
- `app-builder` → action, mesh, event-handler (webhook consumer w/ signature verify + idempotency)
- `eds` → block · `eds-commerce` → dropin-block

`npx ts-node run.ts --list-types` prints the live list. For custom/business logic beyond these, use the LLM
path with the resource packs. Note the `--engine` key is not always the resource-pack directory name:
`aem` → `resources/aemcs/` + `resources/ams/`, `commerce-paas` → `resources/commerce/`, `sling` →
`resources/sling-shaft/`, `spring` → `resources/spring-boot/`; `commerce-saas`, `app-builder`, `eds`, and
`eds-commerce` map directly to their like-named `resources/` packs.

## Intake mode (interactive vs technical)

> **For fast, enterprise-grade execution, prefer One-shot mode (see below).** Intake mode is for exploratory / first-time users.

> **CRITICAL:** The very first response to any activation must be the intake-mode question — unless `.bmad/intake.yaml` exists with a saved preference. Do NOT skip this. Do NOT show a CLI command as the first response.

When a user triggers this agent — via a natural-language prompt or a menu entry — do NOT show or run a raw CLI command (scaffolder or LLM/MCP dispatch) as the first response. Ask which drive style they prefer:

> "Should I drive this **interactively** (I ask you step-by-step questions and run everything for you) or **technically** (I show you the CLI command with each flag explained, and you decide whether to run it or have me run it)?"

Save the answer to `.bmad/intake.yaml` (adjacent to `.bmad/role.yaml`) with keys `mode: interactive|technical` and `set_at: <ISO-8601>`. On subsequent runs, read the file silently and skip the prompt unless the user asks to switch.

To change intake mode later, the user says **"switch intake to interactive"** or **"switch intake to technical"** — overwrite `.bmad/intake.yaml` with the new choice.

**Sequencing note.** The `Preflight`, `Pre-flight: Auto-install Dependencies`, `Pre-flight`, and `Step 0: Interactive Intake` sections below must NOT run before the intake picker resolves. When `intake.mode = interactive`, Step 0's per-scope intake questions become the ordered interactive script. When `intake.mode = technical`, the Step 0 questionnaire is skipped in favor of the fully-formed CLI command shown below. Order for a fresh activation:
1. Resolve intake mode (ask, or read `.bmad/intake.yaml`).
2. If technical → show the scaffolder command + flag explanations, then run it (with the user's OK) or hand off.
3. If interactive → collect the intake questions below, then run silently.
4. Preflight + bootstrap run just before dispatch, once inputs are collected.

### Interactive mode (recommended for first-timers)

Ask one question per turn, in this order. Skip any question the user has already answered in their initial prompt.

1. "What's the project path?"
2. "Which stack? (`aem` / `sling` / `spring` / `commerce-paas` / `commerce-saas` / `app-builder` / `eds` / `eds-commerce`)"
3. "What type of artifact? (list the scaffolder types for that stack — e.g. for `aem`: `sling-model` / `osgi-service` / `sling-servlet` / `component` / `workflow-process`)"
4. "What name? (e.g. `HeroBanner`, `OrderService`, `CheckoutController`)"
5. "Any package/namespace override? (defaults to the project's detected namespace)"
6. "Dry run (preview only) or actually create the files?"

Once every required input is collected, run the command internally (do NOT show it unless the user asks) and stream results conversationally:
> "Scaffolding your Sling Model…" → "Wrote 4 files (Model + interface + test stub + config)…" → "Report saved to `generation-reports/generation-main-20260801_120000-agent-report.xlsx`. Want me to open the generated Model?"

### Technical mode (for users who want CLI transparency)

Show the fully-formed command in a `bash` code block with one flag per line:

```bash
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --path /path/to/project \
  --scaffold --engine aem --type sling-model --name HeroBanner \
  --dry-run
```

Below the block, add a bulleted list explaining each flag in plain English:

- `--path` — the project root; used to detect conventions (base package, module layout) and to place generated files.
- `--scaffold --engine aem --type sling-model --name HeroBanner` — invoke the deterministic scaffolder for the AEM Sling-Model type named `HeroBanner`.
- `--dry-run` — preview which files would be created without touching disk; drop this flag to actually write the scaffold.

Then ask: **"Want me to run this now, or will you copy-paste it?"**

- If **run for me** → execute silently and stream results (same as interactive mode).
- If **I'll run it** → acknowledge, and remind them: "Report will land in `<project>/generation-reports/`. Come back with 'summarize what was generated' when you're done."

## One-shot mode

The **preferred enterprise path.** When the user's initial prompt fully specifies what to run, do NOT ask any clarifying questions — execute end-to-end, stream results, done. Use defaults from `.bmad/role.yaml`, `.bmad/intake.yaml`, `.bmad/conventions.yaml`, and reasonable stack auto-detection to fill missing inputs.

### When to enter one-shot mode

Trigger phrases (any of):
- "generate X end-to-end", "no questions, just do it", "one-shot", "just scaffold", "auto"
- OR any prompt that specifies: (a) the operation, (b) the project path (default: cwd), (c) the primary input (BRD/CSV/type/name/etc)

You DO NOT need every field explicitly — role + intake + conventions cover the rest silently.

### Precedence for missing inputs

1. **Explicit in the user's prompt** (highest — always wins)
2. **`--flag` on run.ts** (headless / CI)
3. **`.bmad/role.yaml`** (role-driven default: mode + output flavor + follow-up)
4. **`.bmad/intake.yaml`** (interactive vs technical preference — one-shot forces technical + skip)
5. **`.bmad/conventions.yaml`** (project conventions: naming, packages, house rules)
6. **Auto-detected** (stack from repo signatures, coverage report from standard paths)
7. **Sensible defaults** (see per-agent list below)

### What one-shot DOES silence

- The intake picker ("Interactive or Technical?") — one-shot forces technical.
- The mode picker ("Full / Scan Only / Deep?") — resolved from role default.
- The consent picker ("What's connected vs What could break?" for Impact; "gaps only / write tests / full" for Test Coverage) — resolved from role default.
- The role picker (if `.bmad/role.yaml` absent) — one-shot uses `generic` role silently (log to stderr: "one-shot: no role file, defaulting to generic").
- The confirmation prompts around `--create-branch`, `--yes-install`, etc. — one-shot assumes yes for install (auto-install), no for branch cut unless the user's prompt or CLI says otherwise.

### What one-shot DOES ask about (only when truly critical)

- **Generation specifically**: if the prompt says "generate X" but provides no `--type` AND no `--name` (or unambiguous equivalents in natural language) — ask ONCE for both. The scaffolder cannot proceed without them.

### One-shot prompt examples for the Code Generation agent

Each example shows what the user pastes and what the AI silently resolves.

> **User:** "generate an AEM component called HeroBanner"
> **AI silently resolves:** path=cwd, engine=`aem`, type=`component`, name=`HeroBanner`, package=(from `.bmad/conventions.yaml` or detected), role=(from `.bmad/role.yaml` or `generic`), test stub=on (unless `--no-test-stub`), output-dir=`generation-reports/`.
> **AI runs:** `npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts --path <cwd> --scaffold --engine aem --type component --name HeroBanner --technical --no-preflight --yes-install`
> **AI reports:** "Scaffolded 4 files under `ui.apps/…/components/heroBanner/`. Report: `generation-main-…-agent-report.xlsx`."

> **User:** "scaffold a Sling Model for the Article component with hardening"
> **AI silently resolves:** engine=`sling`, type=`sling-model`, name=`Article`, `--secure` for hardening (input validation, null checks, LOG.debug guards), package from conventions.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --scaffold --engine sling --type sling-model --name Article --secure --technical --no-preflight --yes-install`
> **AI reports:** files written + security hardening notes.

> **User:** "generate a Cloud Manager pipeline config"
> **AI silently resolves:** engine=`aem`, type=`cloud-manager-pipeline` (or nearest template match from `--list-types`), name defaults from project name.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --scaffold --engine aem --type cloud-manager-pipeline --technical --no-preflight --yes-install`
> **AI reports:** pipeline YAML + attached quality gates.

> **User:** "create a Commerce plugin on Magento\\Catalog\\Model\\Product::getName"
> **AI silently resolves:** engine=`commerce-paas`, type=`plugin`, name derived (`ProductGetNamePlugin`), target class + method captured as scaffold inputs.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --scaffold --engine commerce-paas --type plugin --name ProductGetNamePlugin --technical --no-preflight --yes-install`
> **AI reports:** plugin class + `di.xml` wiring + test stub.

> **User:** "generate a Spring REST controller called OrderController, secure=true"
> **AI silently resolves:** engine=`spring`, type=`rest-controller`, name=`OrderController`, `--secure` on (authorization, input validation).
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --scaffold --engine spring --type rest-controller --name OrderController --secure --technical --no-preflight --yes-install`
> **AI reports:** controller + service stub + secured endpoint notes.

> **User:** "dry-run: what would you generate for --type sling-servlet --name Ping?"
> **AI silently resolves:** `--dry-run` (preview only, no disk writes), engine=`sling`, type=`sling-servlet`, name=`Ping`.
> **AI runs:** `npx ts-node .../run.ts --path <cwd> --scaffold --engine sling --type sling-servlet --name Ping --dry-run --technical --no-preflight --yes-install`
> **AI reports:** file plan (paths + sizes) with zero disk changes.

### After one-shot execution

Always:
- Print a one-line summary (files written, target directory, report path).
- Print the recommended follow-up from the role matrix (e.g. QA role after generation → "test-coverage the new files").
- Do NOT ask "want me to run the follow-up?" — user will ask if they do.

Never:
- Ask what mode they wanted after the fact.
- Ask if they want to save preferences.
- Explain what you did (unless they ask).

### CLI equivalent for one-shot (technical mode)

Every one-shot prompt has a direct CLI equivalent using all Phase 1 flags:

```bash
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --path . \
  --scaffold --engine <stack> --type <type> --name <Name> \
  --technical \
  --yes-install \
  --no-preflight \
  --sla-path .bmad/sla.yaml \
  --decisions-path .bmad/decisions.yaml
```

Add `--fail-on-overdue` for CI gates, `--include-decided` to bypass decisions, `--dry-run` to preview, `--force` or `--force-name` to overwrite existing scaffolds.

## Role-aware behavior

The agent adapts its generation approach to the caller's role — one of ten codes (`ea`, `tl`, `de`, `qa`, `devops`, `security`, `pm`, `ba`, `migration`, `content`), or `generic` when no role is selected. Role changes *what* the agent scaffolds, *which conventions* it enforces, and *which follow-ups* it suggests. See `skills/shared/role/ROLES.md` for the full catalog.

### Role check on activation

Before executing any scaffold or generation, do this — silently, in this order:

1. **Check `<projectRoot>/.bmad/role.yaml`.**
2. **If ABSENT** — ask the user, in one message, to pick a role. Show the 6 promoted roles first, then the 4 additional, then `generic`:
   - Promoted: `ea` (Enterprise Architect), `tl` (Tech Lead / Solution Architect), `de` (Senior Delivery Engineer), `qa` (QA / SDET), `devops` (DevOps / SRE), `security` (Security Engineer)
   - Additional: `pm` (Product Manager / PMO), `ba` (Business Analyst), `migration` (Migration/Upgrade Lead), `content` (Content/CMS Engineer)
   - Or `generic` (no adaptation)

   Persist the answer via `writeRoleFile(projectRoot, <code>, "interactive")` from `skills/shared/role/persistence.ts` (equivalent hand-written YAML is also fine):
   ```yaml
   # BMAD DCA — role selection
   role: <code>
   set_at: <ISO-8601 timestamp>
   set_by: interactive
   ```
3. **If PRESENT** — read it silently. Do not re-prompt.
4. **Single-run override** — if the user says *"as <role>, generate ..."*, adopt the role for that run only. **Do NOT** overwrite `role.yaml`.
5. **Change permanently** — if the user says *"switch role to <code>"* (or equivalent), overwrite `role.yaml` with `set_by: interactive`.

The CLI dispatcher (`scripts/run.ts`) already implements this resolution when invoked directly: `--role <code>` (or `--role=<code>`) wins for one run; otherwise `.bmad/role.yaml`; otherwise `generic`. The resolved role is recorded in the Run Info sheet (`Role`, `RoleName`, `RoleSource`, `RoleFlavor`, `RoleTweaks`) of every generation report.

### Role → generation behavior matrix

When the user says "generate X", adapt as follows:

| Role | Default action | Output emphasis | Recommended follow-up |
|------|----------------|-----------------|-----------------------|
| `ea` | Scaffold with **house conventions enforced** — package structure, naming, artifact layout. Do NOT accept non-standard names; log every convention decision. | Standard emitted files + a **"Conventions applied"** section in the Markdown report twin. | *"audit the generated code"* |
| `tl` | Standard scaffold. Offer the LLM/MCP path if no deterministic scaffolder exists for the requested type. | Standard scaffold output (`technical` flavor). | *"audit the generated code"* |
| `de` | Scaffold + **auto-emit a matching test stub** using the test-coverage agent's per-stack framework packs. Produce a Jira-linkable description in the report. | Scaffold + test stub files + one **Jira-ready CSV row per generated file**. | *"run test coverage on the generated files"* |
| `qa` | Scaffold **test files only** — delegate to the test-coverage agent's LLM path via the shared test-generation packs; if a dedicated test scaffolder exists for the type, use it. | Test files only + a **coverage checklist**. | *"run test coverage"* |
| `devops` | Prefer **IaC / pipeline / dispatcher** scaffolds (Cloud Manager pipeline, dispatcher config templates) even for generic "generate X" prompts. | Scaffold + a **"Deployment"** section in the Markdown twin (`sarif` flavor for downstream CI gates). | *"audit dispatcher config"* |
| `security` | Scaffold with **security-hardened defaults** — input validation, ACL, XSS-safe HTL/HTML, CSRF tokens, prepared statements, safe defaults for OSGi/DI config. | Scaffold + a **"Security decisions"** section explaining each hardening. | *"audit --focus security"* or *"sonar scan"* |
| `pm` | Generation is not a primary PM tool — proceed with `generic` behavior; note the role in the report. | Standard (`executive` flavor). | (none) |
| `ba` | Same as PM. | Standard (`executive` flavor). | (none) |
| `migration` | Scaffold **migration / patch artifacts** — Commerce: setup patches, `module.xml`, `db_schema` patches, `di.xml` overrides; AEM: install hooks, content packages. | Scaffold + a **"Migration guide"** section in the Markdown twin. | *"impact-analyze the migration"* |
| `content` | Prefer **content-fragment / editable-template / dispatcher-config / EDS-block** scaffolders (templates under `templates/`). | Content scaffold + template usage note. | *"audit content models"* |
| `generic` | Current behavior — no adaptation. | Standard (`default` flavor). | *"list types"* |

**Output flavors** (match the audit agent's definitions):
- `executive` — leadership-facing summary, low detail
- `technical` — engineer-facing, full detail
- `jira-csv` — one Jira-ready row per artifact, importable
- `sarif` — SARIF-shaped output for CI gates
- `default` — the standard report bundle

### What "role-adapted scaffolding" means today vs later

Today, the role is an **advisory input** that modifies the AI's *approach* — which template to reach for, which naming conventions to enforce, which hardening decisions to apply, which follow-up to suggest. The **deterministic scaffolders themselves are unchanged** in this pass; when you invoke `run.ts --scaffold --role <code>`, the dispatcher logs the planned tweaks and records the role in the report metadata, but the emitted files are the same as `generic`.

For the LLM/MCP path, the role drives real behavioral change — you (the AI agent following this skill) apply the matrix above when producing the code. If a role's tweak is beyond the current deterministic scaffolder's ability (for example, the `security` role wants a hardened Commerce plugin with input validation, ACL checks, and prepared statements), **extend the scaffolder's output with an additional patch after generation** — write the extra files, and note the additions in the report so the delta is visible.

## Preflight — report the user's LLM & recommend a mode (do this first, conversationally)

The moment this command is triggered from an AI assistant (GitHub Copilot, Claude, Cursor, or any LLM), run the
preflight and tell the user — in one line — **which LLM they're on** and **whether to use the deterministic
scaffolder or the LLM/MCP path**:

```bash
npx ts-node scripts/run.ts --scaffold --engine {stack} --type {type} --name {Name} --path {project} --preflight
```

It prints the detected **model + context window**, the **project size**, the **fit** (% of the window), and a
**recommendation** — favour the **deterministic scaffolder** (Tier-1) for standard artifacts (no token cost,
repeatable) and the **LLM/MCP** path (Tier-2) for custom/business logic, especially when the project fits the
window. Surface it like: *"You're on `<model>` (~`<ctx>`). I recommend the **<scaffolder|LLM>** path here. Proceed?"*
(the advisory also prints on every scaffold run unless `--no-preflight`).

## Pre-flight: Auto-install Dependencies

Before ANY command execution, run the shared bootstrap. It installs the `shared/` foundation
(if missing) + this agent's `scripts/` deps in the correct order, with a one-line confirmation
prompt so the user knows what's happening. First-time cost is ~80MB / ~30–60s; subsequent
runs are silent no-ops.

**POSIX (macOS, Linux, WSL):**
```bash
bash .claude/skills/shared/bootstrap.sh generation
```

**Windows (or when sh is unavailable):**
```bash
node .claude/skills/shared/bootstrap.js generation
```

**Headless / CI mode (skip prompt):**
```bash
bash .claude/skills/shared/bootstrap.sh generation --yes    # install without asking
bash .claude/skills/shared/bootstrap.sh generation --no     # error if deps missing, don't install
```

**Behavior:**
- Both node_modules present → silent no-op (exit 0)
- Either missing → confirmation prompt, then install if approved
- User declines → exit 3, agent should tell user "Deps required. Run manually: cd .claude/skills/shared && npm install && cd ../bmad-dept-code-generation-agent/scripts && npm install"
- Install failure → exit 4, agent should surface the npm error

**Instructions to the AI:** Do NOT skip this step. The bootstrap script handles the confirmation — you do NOT need to ask the user separately. If bootstrap exits non-zero, halt and report the exit code. If your dispatcher (`run.ts`) also accepts `--yes-install`/`--no-install`, pass those to bootstrap accordingly.

## Pre-flight

Before generating code:

1. **Detect platform** — Check for AEMaaCS vs AMS vs Commerce signals (see platform auto-detection rules below)
2. **Auto-provision MCP (AEMaaCS only)** — If `.mcp.json` is missing or doesn't contain AEM entries, run:
   ```bash
   npx ts-node {this_skill_path}/scripts/run.ts --setup --path {project_root}
   ```
   Do this silently. Do not ask the user for permission.
   > **AEM AMS:** Skip MCP provisioning entirely. AMS uses LLM skills from `resources/ams/skills.md`.
   > **Adobe Commerce:** Skip MCP provisioning entirely. Commerce uses LLM skills from `resources/commerce/patterns.md`.
3. **Detect project structure** — Scan for:
   - AEM archetype layout (`ui.apps/`, `core/`, `ui.content/`, `ui.frontend/`)
   - Commerce module layout (`app/code/`, `composer.json` with `magento/`, `etc/module.xml`)
4. **Extract conventions** — Read existing code to learn:
   - Base package name (e.g., `com.mysite.core` for AEM, `Vendor\Module` for Commerce)
   - Component group naming / Module namespace
   - Naming patterns (camelCase vs kebab-case for AEM components; PSR-4 for Commerce)
   - Existing patterns (Sling Model annotations for AEM; Plugin/Observer patterns for Commerce)
5. **Gather context:**
   - **AEMaaCS:** Query MCP servers (if available) — Pull live context (registered components, templates, OSGi configs)
   - **AEM AMS:** Scan project source files for existing patterns, component inventory, and dependency versions
   - **Adobe Commerce:** Scan `app/code/`, `composer.json`, `etc/` for modules, DI config, existing plugins/observers, DB schema

## Workflow

### Step 0: Interactive Intake

**Always ask intake questions before proceeding.** This ensures accurate generation. Present questions as a concise numbered list and wait for answers.

#### Intake Questions

Analyze the user's initial prompt first. Skip any question whose answer is already clear from the prompt. Ask remaining questions in one batch:

```
1. 🏗️ Platform?
   → [AEMaaCS / AEM AMS]
   (Skip if project structure makes it obvious — see detection rules below)

2. 🎯 What to generate?
   → [Component / Sling Model / OSGi Service / CF Model / XF / Template / Dispatcher / Pipeline / Test]
   (Skip if obvious from prompt)

3. 📦 Component details?
   → Name, and if proxying/extending an existing component — which one?
   (Skip if user already specified)

4. 🌐 Target environment?
   → AEMaaCS: [Local SDK / Cloud Dev / Cloud Stage / Cloud Prod]
   → AEM AMS: [Local / Dev / Stage / Prod]
   (Skip if user said "local", "deploy to dev", etc.)

5. 🚀 Deploy after generation?
   → [Yes – build & deploy / No – generate code only]
   (Skip if user explicitly said "deploy" or "just create")

6. ✅ Validate on instance after deploy?
   → [Yes – verify on instance / No – skip validation]
   (Only ask if deploy = yes)
```

#### Platform auto-detection rules:

| Signal in project | Platform |
|-------------------|----------|
| `pom.xml`/`bnd` with `org.apache.sling`/`org.apache.felix` (or `mdm`/`sam` dirs), **no** AEM markers | Sling-12 / Shaft |
| `spring-boot-starter`/`org.springframework.boot` in `pom.xml`/`build.gradle`, or `@SpringBootApplication` | Spring Boot |
| `ui.config/` exists | AEMaaCS |
| `.cloudmanager/` or `dispatcher/src/` (SDK structure) | AEMaaCS |
| `config.author/`, `config.publish/`, `config.dev/` runmode folders under `/apps` | AEM AMS |
| `dispatcher/src/conf/httpd.conf` (classic Apache) | AEM AMS |
| Replication agent configs present | AEM AMS |
| `composer.json` with `magento/` packages | Adobe Commerce |
| `app/code/` directory exists | Adobe Commerce |
| `etc/module.xml` or `registration.php` in module | Adobe Commerce |
| `bin/magento` exists at project root | Adobe Commerce |
| `app.config.yaml` with `extensions:` block | Adobe App Builder |
| `.aio` file present | Adobe App Builder |
| `@adobe/aio-sdk` in `package.json` | Adobe App Builder |
| `commerce/backend-ui/1` in `app.config.yaml` | Commerce Admin UI Extension |
| `@adobe/uix-guest` in `package.json` | UI Extensibility (Commerce or AEM) |
| `aem/cf-console-admin/1` in config | AEM CF Console UI Extension |
| `aem/cf-editor/1` in config | AEM CF Editor UI Extension |
| `aem/universal-editor/1` in config | AEM Universal Editor Extension |
| `aem/experience-hub/1` in config | AEM Experience Hub Extension |
| `aem/assets-view/1` in config | AEM Assets View Extension |
| `meshConfig` in JSON files | API Mesh |
| `dx/excshell/1` in config | Experience Cloud Shell SPA |
| `dx/asset-compute/worker/1` in config | Asset Compute Worker |
| Cannot determine | **Ask Q1** |

#### Smart skipping rules:

| If user said... | Skip questions | Auto-fill |
|----------------|---------------|-----------|
| "create proxy of X" | Q2, Q3 (partial) | type=component, extends=X |
| "deploy on local" | Q4 | env=local |
| "generate CF model for articles" | Q2, Q3 | type=cf-model, name=articles |
| "just scaffold, don't deploy" | Q5, Q6 | deploy=no |
| Project has `ui.config/` | Q1 | platform=aemcs |

#### Example interaction:

> **User:** "Create proxy of CIF Core component - Product Recommendation, and deploy it on local"
>
> **Agent asks only what's missing:**
> ```
> Got it — proxying CIF Product Recommendation component, deploying to local SDK.
>
> A few questions:
> 1. Component name for your proxy? (e.g., `product-recommendation-custom`)
> 2. Any dialog customizations needed beyond the base CIF component?
> 3. Validate on local instance after deploy? [Yes/No]
> ```

### Step 1: Resolve MCP Mode

Based on intake answers, select the MCP mode. **Do not ask again — this is derived from Step 0.**

#### AEMaaCS:

| Intake answer (Q4) | MCP Mode | Providers used |
|--------------------|----------|----------------|
| Local SDK | `local` | AEM-Local, AEM-Local-Dev |
| Cloud Dev/Stage/Prod | `remote` | AEM-Content, AEM-CloudManager |
| Not answered (skipped) | `local` | Default for development |

#### AEM AMS:

| Intake answer (Q4) | Mode | Intelligence source |
|--------------------|------|---------------------|
| Any (Local/Dev/Stage/Prod) | `llm-skills` | `resources/ams/skills.md` + project scanning |

> **IMPORTANT:** AEM AMS does NOT use MCP. No remote Adobe MCP, no community MCP.
> All generation intelligence comes from built-in LLM skills (`resources/ams/skills.md`) and static project scanning.
> Custom MCP via Scripts Engine will be available in a future release.

#### How this affects behavior:

- **AEMaaCS + `local`** → Use `AEM-Local` / `AEM-Local-Dev`. Validate against localhost SDK.
- **AEMaaCS + `remote`** → Use `AEM-Content` / `AEM-CloudManager`. Validate against cloud.
- **AEM AMS** → Use LLM skills only. Scan project source. Validate via Maven build + post-deploy curl commands. No live MCP queries.

### Step 2: Gather Project Context

```
Project Structure Detection:
├── core/                    → Java source (Sling Models, OSGi Services)
│   └── src/main/java/{base.package}/
├── ui.apps/                 → Component definitions (.content.xml, HTL, clientlibs)
│   └── src/main/content/jcr_root/apps/{project}/components/
├── ui.content/              → Content (templates, policies, pages)
│   └── src/main/content/jcr_root/conf/{project}/
├── ui.frontend/             → Frontend build (CSS/JS)
├── dispatcher/              → Dispatcher configs
│   └── src/conf.d/ & src/conf.dispatcher.d/
└── ui.tests/                → Integration tests
```

### Step 3: Gather Instance Context

**AEMaaCS (via MCP):**

Use the resolved MCP mode from Step 1. Query using **capabilities**, not hardcoded tool names:

| Capability | Purpose |
|------------|---------|
| `component-discovery` | List existing components to avoid naming conflicts |
| `template-discovery` | Understand available page templates |
| `osgi-config` | See existing OSGi config patterns |
| `site-structure` | Understand content hierarchy |

If MCP is unavailable for a capability, use the fallback (scan source files).

**AEM AMS (via project scanning):**

No MCP available. Scan project source to gather equivalent context:

| What to scan | Where to look | Purpose |
|-------------|---------------|---------|
| Existing components | `ui.apps/.../apps/{project}/components/` | Avoid naming conflicts |
| Templates | `ui.content/.../conf/{project}/settings/wcm/templates/` | Understand page structure |
| OSGi configs | `ui.apps/.../apps/{project}/config*/` | Match existing patterns |
| Content structure | `ui.content/.../content/{project}/` | Understand hierarchy |
| Dependencies | `core/pom.xml`, `all/pom.xml` | AEM version, uber-jar version |
| Runmodes used | `config.*` folder names | Know available environments |

### Step 4: Generate Code

Produce all files for the requested artifact:
- **AEMaaCS:** Follow patterns in `resources/aemcs/patterns.md`
- **AEM AMS:** Follow patterns in `resources/ams/skills.md` (comprehensive LLM skills reference)

### Step 5: Generate Unit Tests

For every Sling Model or OSGi service generated, also produce:
- JUnit 5 test class using AEM Mocks (`io.wcm.testing.mock.aem`)
- Mock resource setup matching the component's `.content.xml`
- Assertions for all exposed methods

### Step 6: Deploy (if requested in intake)

If the user answered "Yes" to deploy in Step 0:

**AEMaaCS:**
- **Local SDK:** `mvn clean install -PautoInstallSinglePackage`
- **Cloud:** Provide Cloud Manager deployment guidance or trigger via MCP

**AEM AMS:**
- **Local/Dev:** `mvn clean install -PautoInstallSinglePackage -Daem.host={ams-host} -Daem.port=443 -Dsling.scheme=https`
- **Stage/Prod:** Provide CI/CD deployment guidance (Jenkins/GitLab pipeline)

### Step 7: Validate (if requested in intake)

If the user answered "Yes" to validation:

**AEMaaCS (via MCP):**
- Use `osgi-bundles` capability → verify bundle is Active
- Use `component-discovery` capability → verify component appears in registry
- Use `content-validation` capability → verify content structures

**AEM AMS (via curl commands):**
- Provide bundle verification command (`/system/console/bundles.json`)
- Provide component check command (`/system/console/components.json`)
- Provide OSGi config verification command
- See `resources/ams/skills.md` → Validation Strategy section

Report results to user.

---

## Generation Scopes

### Platform-Specific Differences

| Scope | AEMaaCS | AEM AMS |
|-------|---------|---------|
| OSGi Config location | `ui.config/.../osgiconfig/config/` | `/apps/{project}/config.{runmode}/` |
| Dispatcher structure | SDK (immutable, `${DOCROOT}`) | Classic (httpd.conf, dispatcher.any) |
| Pipeline/Deploy | Cloud Manager YAML | Jenkins/GitLab CI + Maven profiles |
| Java annotations | `javax.*` (moving to `jakarta.*`) | `javax.*` only |
| Replication | Sling Distribution (auto) | Replication agents (manual) |
| Resource patterns file | `resources/aemcs/patterns.md` | `resources/ams/skills.md` |

**Select the correct resource patterns based on platform detected in Step 0.**

### 1. Sling Models (Java)

**Output location:** `core/src/main/java/{base.package}/models/`

Generate with:
- `@Model` annotation with correct `adaptables`, `adapters`, `defaultInjectionStrategy`
- `@ValueMapValue`, `@ChildResource`, `@Self`, `@OSGiService` injectors
- Getter methods (not public fields)
- `@PostConstruct` for initialization logic
- Interface-based pattern when project uses it

### 2. HTL/Sightly Templates

**Output location:** `ui.apps/src/main/content/jcr_root/apps/{project}/components/{component}/`

Generate:
- `{component}.html` — Main HTL template
- `_cq_dialog/.content.xml` — Touch UI dialog
- `_cq_editConfig/.content.xml` — Edit configuration (when needed)
- `.content.xml` — Component node definition (jcr:title, componentGroup, sling:resourceSuperType)

### 3. OSGi Services/Components (Java)

**Output location:** `core/src/main/java/{base.package}/services/`

Generate:
- Service interface + implementation (separate files)
- `@Component` with appropriate `service`, `immediate`, `configurationPolicy`
- `@Designate` with `@ObjectClassDefinition` for configurable services
- OSGi config file:
  - **AEMaaCS:** `ui.config/src/main/content/jcr_root/apps/{project}/osgiconfig/config/`
  - **AEM AMS:** `ui.apps/src/main/content/jcr_root/apps/{project}/config/` (with runmode variants)

### 4. Content Fragment Models

**Output location:** `ui.content/src/main/content/jcr_root/conf/{project}/settings/dam/cfm/models/`

Generate:
- Model definition (`.content.xml` with field definitions)
- Field types: text, multi-line, number, boolean, date, enumeration, content-reference, fragment-reference, JSON

### 5. Experience Fragments

**Output location:** `ui.content/src/main/content/jcr_root/content/experience-fragments/{project}/`

Generate:
- XF folder structure
- Variation templates (web, email, social)
- Associated editable template policies

### 6. Editable Templates

**Output location:** `ui.content/src/main/content/jcr_root/conf/{project}/settings/wcm/templates/`

Generate:
- Template definition (structure, initial, policies)
- Allowed components policy
- Layout container configuration
- Template type reference

### 7. Dispatcher Configs

**Output location:** `dispatcher/src/`

Generate based on platform:

**AEMaaCS (SDK structure):**
- `conf.d/rewrites/` — Rewrite rules
- `conf.d/variables/` — Custom variables
- `conf.dispatcher.d/filters/` — Request filters
- `conf.dispatcher.d/cache/` — Cache rules
- Uses `${DOCROOT}`, `enableTTL`, immutable patterns

**AEM AMS (Classic structure):**
- `conf/httpd.conf` — Apache config with VirtualHosts
- `conf.dispatcher.d/dispatcher.any` — Dispatcher farm config
- `conf.dispatcher.d/filters/` — Filter rules
- `conf.dispatcher.d/cache/` — Cache rules with explicit docroot
- Uses absolute paths, `mod_expires`, classic farm syntax

### 8. Cloud Manager Pipeline Configs (AEMaaCS ONLY)

**Output location:** Project root or `.cloudmanager/`

Generate:
- Pipeline YAML configuration
- Environment variables template
- Build step customization

> **AEM AMS:** This scope is not available. For AMS CI/CD, use Scope 10 (CI/CD Pipelines) instead.

### 9. Unit Tests (JUnit/AEM Mocks)

**Output location:** `core/src/test/java/{base.package}/models/` (or `/services/`)

Generate:
- JUnit 5 test class
- `@ExtendWith(AemContextExtension.class)` setup
- `AemContext` with resource type registration
- Mock content tree (JSON or inline)
- Test methods for each public method on the model/service

### 10. CI/CD Pipelines (AEM AMS ONLY)

**Output location:** Project root (`Jenkinsfile`, `.gitlab-ci.yml`)

Generate based on user's CI/CD platform:
- **Jenkins:** `Jenkinsfile` with build/test/deploy stages, environment parameters, Maven deploy commands
- **GitLab CI:** `.gitlab-ci.yml` with build/test/deploy-dev/deploy-stage/deploy-prod stages
- **Azure DevOps:** `azure-pipelines.yml` with equivalent stages
- All include: bundle verification, dispatcher flush, post-deploy health check

> See `resources/ams/skills.md` → Skill 12 for templates.

### 11. Replication Agents (AEM AMS ONLY)

**Output location:** Content package or OSGi config

Generate:
- Forward replication agent (author → publish)
- Reverse replication agent (publish → author)
- Dispatcher flush agent
- All with environment-specific transport URIs

> See `resources/ams/skills.md` → Skill 5 for templates.

### 12. Workflows (AEM AMS ONLY)

**Output location:** `core/src/main/java/{base.package}/workflows/`

Generate:
- Custom workflow process step (Java)
- Workflow launcher configuration
- Workflow model (if applicable)

> See `resources/ams/skills.md` → Skill 6 for templates.

### 13. Servlets & Filters

**Output location:** `core/src/main/java/{base.package}/servlets/` or `.../filters/`

Generate:
- Sling Servlet (by resource type or by path)
- Sling Filter (with scope and path pattern)

> See `resources/ams/skills.md` → Skill 7 for templates.

### 14. Schedulers & Event Handlers

**Output location:** `core/src/main/java/{base.package}/schedulers/` or `.../listeners/`

Generate:
- Sling Scheduler (cron-based, configurable)
- Sling Event Handler (resource/page change listeners)

> See `resources/ams/skills.md` → Skill 8 for templates.

---

## Adobe Commerce Workflow

When platform is detected as Adobe Commerce, follow this workflow instead of the AEM workflow above.

### Step 1: Resolve Generation Mode

Adobe Commerce does NOT use MCP. All intelligence comes from:
- **LLM Skills** → `resources/commerce/patterns.md` (generation patterns + templates)
- **Security Rules** → `resources/commerce/security.md` (mandatory compliance)
- **Project Scanning** → Static analysis of `app/code/`, `composer.json`, `etc/`

### Step 2: Gather Commerce Project Context

Scan the project to detect:

| What to scan | Where to look | Purpose |
|-------------|---------------|---------|
| Existing modules | `app/code/{Vendor}/` | Detect vendor namespace, existing modules |
| DI configuration | `etc/di.xml`, `etc/*/di.xml` | Existing plugins, preferences, types |
| Events | `etc/events.xml`, `etc/*/events.xml` | Existing observer subscriptions |
| DB schema | `etc/db_schema.xml` | Existing tables, avoid conflicts |
| Web APIs | `etc/webapi.xml` | Existing endpoints, URL patterns |
| ACL | `etc/acl.xml` | Existing access control resources |
| Composer deps | `composer.json` | PHP version, Magento version, dependencies |
| Admin routes | `etc/adminhtml/routes.xml` | Existing admin routes |
| Frontend routes | `etc/frontend/routes.xml` | Existing storefront routes |
| System config | `etc/adminhtml/system.xml` | Existing configuration sections |

### Step 3: Interactive Intake (Commerce)

Ask only what's missing from the user's prompt:

```
1. What to generate?
   → [Module / Plugin / Observer / API / GraphQL / Admin Grid / Admin Form / Block / CLI Command / Cron / Queue / DB Schema / Tests / EAV Attribute / Config]
   (Skip if obvious from prompt)

2. Module namespace?
   → {Vendor}\{Module} (e.g., Acme\CustomShipping)
   (Auto-detect from existing app/code/ if possible)

3. Target entity/class?
   → For plugins: which class/method to intercept
   → For observers: which event to listen to
   → For APIs: endpoint path + HTTP method
   (Skip if specified in prompt)

4. Scope (area)?
   → [global / frontend / adminhtml / webapi_rest / webapi_soap / crontab]
   (Default: global unless context suggests otherwise)

5. Deploy after generation?
   → [Yes – run setup:upgrade + di:compile / No – generate code only]
```

### Step 4: Generate Code

Follow the patterns in `resources/commerce/patterns.md` for the requested scope.
Apply all rules from `resources/commerce/security.md`.

**Every generated file MUST:**
- Use `declare(strict_types=1)` at the top
- Follow PSR-12 coding standards
- Use constructor dependency injection (never ObjectManager)
- Include proper PHP type declarations (param types, return types)
- Pass `vendor/bin/phpcs --standard=Magento2` without errors

### Step 5: Generate Tests

For every service class, repository, or complex logic generated:
- Unit test in `Test/Unit/` with mocked dependencies
- Integration test skeleton in `Test/Integration/` (if requested)

Follow test patterns in `resources/commerce/patterns.md` → Skill 17.

### Step 6: Deploy (if requested)

```bash
bin/magento module:enable {Vendor}_{Module}
bin/magento setup:upgrade
bin/magento setup:di:compile
bin/magento cache:flush
```

### Step 7: Validate

| Check | Command |
|-------|---------|
| Module status | `bin/magento module:status {Vendor}_{Module}` |
| DI compilation | `bin/magento setup:di:compile` (exit 0) |
| DB schema | `bin/magento setup:db:status` |
| Coding standards | `vendor/bin/phpcs --standard=Magento2 app/code/{Vendor}/{Module}` |
| Unit tests | `vendor/bin/phpunit app/code/{Vendor}/{Module}/Test/Unit` |

---

## Commerce Generation Scopes

All Commerce scopes reference `resources/commerce/patterns.md` for detailed templates and rules.

### C1. Module Scaffolding
Generate: `registration.php`, `etc/module.xml`, `composer.json`
→ See patterns.md → Skill 1

### C2. Plugin (Interceptor)
Generate: Plugin class + `di.xml` registration
→ See patterns.md → Skill 2

### C3. Observer
Generate: Observer class + `events.xml` subscription
→ See patterns.md → Skill 3

### C4. REST/SOAP API
Generate: Service interface + implementation + `webapi.xml` + `acl.xml`
→ See patterns.md → Skill 4

### C5. GraphQL Resolver
Generate: `schema.graphqls` + resolver class + data provider
→ See patterns.md → Skill 5

### C6. Admin UI Grid
Generate: UI component listing XML + data provider + controller + layout + menu + ACL
→ See patterns.md → Skill 6

### C7. Admin UI Form
Generate: UI component form XML + edit/save/delete controllers + data provider
→ See patterns.md → Skill 7

### C8. Storefront Block + Template
Generate: Block (thin) + ViewModel + .phtml template + layout XML
→ See patterns.md → Skill 8

### C9. Console Command (CLI)
Generate: Command class + `di.xml` registration
→ See patterns.md → Skill 9

### C10. Cron Job
Generate: Cron class (with locking) + `crontab.xml`
→ See patterns.md → Skill 10

### C11. Message Queue
Generate: Consumer + publisher + `communication.xml` + topology + consumer/publisher XML
→ See patterns.md → Skill 11

### C12. Declarative DB Schema
Generate: `db_schema.xml` + whitelist JSON
→ See patterns.md → Skill 12

### C13. Data Patch
Generate: Data patch class in `Setup/Patch/Data/`
→ See patterns.md → Skill 13

### C14. System Configuration
Generate: `system.xml` + `config.xml` + Config helper class + ACL
→ See patterns.md → Skill 14

### C15. Repository Pattern (CRUD)
Generate: Interface + model + resource model + collection + repository + DI preferences
→ See patterns.md → Skill 15

### C16. Frontend JavaScript
Generate: RequireJS module + `requirejs-config.js` + KO template (if needed)
→ See patterns.md → Skill 16

### C17. Unit & Integration Tests
Generate: PHPUnit tests + fixtures
→ See patterns.md → Skill 17

### C18. EAV Attribute
Generate: Data patch creating product/customer/category EAV attribute
→ See patterns.md → Skill 18

---

## Error Handling

- **AEMaaCS:** If MCP servers are not configured → proceed with project-level context only (no live instance data)
- **AEM AMS:** No MCP expected — always uses LLM skills + project scanning
- **Adobe Commerce:** No MCP expected — always uses LLM skills (`resources/commerce/patterns.md`) + project scanning
- If project structure is non-standard → ask user to confirm paths
- If naming conflict detected (via MCP or source scan) → warn and suggest alternative name
- If base package can't be detected → ask user

## Configuration

The skill reads from environment (`.env`):

| Variable | Purpose | Default |
|----------|---------|---------|
| `AEM_HOST` | AEM instance URL | `http://localhost:4502` |
| `AEM_USER` | AEM username | `admin` |
| `AEM_PASSWORD` | AEM password | `admin` |
| `AEM_INSTANCES_CONFIG` | Path to aem-instances.yaml | `~/aem-instances.yaml` |
