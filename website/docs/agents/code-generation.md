---
id: code-generation
title: Code Generation
sidebar_position: 3
description: 24 deterministic scaffolders + 5 AEM IaC templates across 8 stacks, plus an LLM/MCP path with zero-config MCP auto-provisioning for AEM.
keywords:
  - scaffolder
  - code generation
  - aem scaffold
  - commerce scaffold
  - mcp
---

## Purpose

The **Code Generation** agent has two paths. **Tier 1** ships **24 deterministic scaffolders** across the 8 stacks — plus **5 new AEM IaC templates** — that produce real, idiomatic files (correct-by-construction, zero LLM tokens). **Tier 2** is an LLM/MCP path for anything the scaffolders don't cover, with **zero-config MCP auto-provisioning** for AEM projects.

Every scaffold run emits the [standardized outputs contract](../concepts/standardized-outputs) — the created / skipped file list, a Markdown twin, and a `CHANGE-LOG.md` entry — alongside the source files it writes.

## When to use it

- **Bootstrapping a new module** — AEM component, Commerce module, Spring REST controller, App Builder action.
- **Standardizing team output** — every scaffolded artifact follows platform best practices out of the box.
- **Rapid prototype scaffolding** during an architecture-review workshop.
- **Zero-config MCP setup** — one command provisions `.mcp.json`, `.bmad/mcp-registry.toml`, `.env`, `.gitignore` for Adobe MCP for AEM.
- **LLM/MCP path** for complex generation that composes multiple scaffolders (a full Commerce module with plugin + observer + admin form).
- **Security-hardened variants** — the `--secure` flag layers per-type hardening (input validation, ACL, XSS-safe HTL/HTML, CSRF tokens, prepared statements) on top of 8 supported types.

## What it produces

| Artifact | Where | Notes |
|----------|-------|-------|
| Scaffolded source files | canonical project locations | Real, idiomatic files per platform conventions (e.g. `core/src/main/java/…`, `app/code/Vendor/Module/…`). |
| Matching **test stub** | canonical test tree | Emitted for every one of the 24 scaffolders (opt out with `--no-test-stub`). |
| `generation-<branch>-<timestamp>-agent-report.xlsx` | `generation-reports/` | Standardized workbook listing files created / files skipped. |
| `generation-<branch>-<timestamp>-agent-report.md` | `generation-reports/` | Markdown twin. |
| One `CHANGE-LOG.md` entry | project root | |
| Optional working branch | git | `dca/generation-<stack>-<timestamp>` when `--create-branch` is passed. |
| MCP config files (`--setup`) | project root | `.mcp.json`, `.bmad/mcp-registry.toml`, `.env`, `.gitignore`. |
| Findings cache | `.bmad/cache/generation-<hash>.json` | Consumed by downstream agents (e.g. Audit on the new code). |

## The 24 scaffolders + 5 AEM IaC templates

The live source of truth is the `GENERATORS` map in `scripts/scaffold/generators.ts`. Run `npx ts-node run.ts --list-types` to print the current list.

### Base scaffolders (24)

| Stack | Types | Count |
|-------|-------|:-----:|
| `aem` | `sling-model`, `osgi-service`, `sling-servlet`, `component` (HTL + dialog), `workflow-process` | 5 |
| `sling` | `osgi-service`, `sling-servlet`, `sling-filter`, `sling-model` | 4 |
| `spring` | `rest-controller` (+ DTO), `service`, `jpa-repository` (+ entity) | 3 |
| `commerce-paas` | `module`, `plugin`, `observer`, `graphql-resolver`, `controller` (**`php -l` clean**) | 5 |
| `commerce-saas` | `catalog-query`, `storefront-block` | 2 |
| `app-builder` | `action`, `mesh`, `event-handler` (webhook consumer w/ signature verify + idempotency) | 3 |
| `eds` | `block` | 1 |
| `eds-commerce` | `dropin-block` | 1 |

### New AEM IaC scaffolders (5)

Layered on top of the AEM stack — accessible via `--engine aem --type <one of>`:

| Type | What it emits | Notes |
|------|---------------|-------|
| `dispatcher-config` | `.farm` + `.any` dispatcher config templates. | Apache mod_dispatcher friendly. |
| `editable-template` | AEM Editable Template (`ui.content/…/conf/templates/…`) with policy nodes. | |
| `cloud-manager-pipeline` | Cloud Manager pipeline YAML + trigger config. | AEMaaCS Cloud Manager. |
| `content-fragment-model` | CF Model definition + supporting `.content.xml`. | Content Fragment authoring. |
| `experience-fragment` | Experience Fragment page under `ui.content/…/content/experience-fragments/{project}/`. | XF authoring. |

Complex Commerce PaaS artifacts (admin grids, admin forms, CLIs, crons, queues, db-schema, repositories, tests, EAV attributes, config) are addressable via the LLM/MCP path — see the [Code Generation prompts reference](../reference/prompts/code-generation).

## Trigger phrases

```text
list scaffolder types
create a new AEM component called Hero Banner
generate a Sling Model for the Article component
create a Spring REST controller for Orders
create a new Commerce module Acme_CustomShipping
create an after plugin on Magento\Catalog\Model\Product::getName
scaffold an API Mesh handler
create an EDS block called cards
generate a hardened Sling servlet named CheckoutServlet   # --secure on
scaffold a dispatcher-config for project acme
scaffold in dry-run mode so I can review before writing
force overwrite existing files if they conflict
set up MCP for this project
```

## CLI usage (technical mode)

```bash
# List every deterministic scaffolder currently registered
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts --list-types

# One-shot scaffold — AEM component
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --scaffold --engine aem --type component --name HeroBanner \
  --path /path/to/aem-project

# Dry-run (preview file list, write nothing)
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --scaffold --engine spring --type rest-controller \
  --name OrdersController --path . --dry-run

# Security-hardened Commerce plugin
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --scaffold --engine commerce-paas --type plugin \
  --name InventoryCheck --path . --secure

# Zero-config MCP auto-provisioning (writes at project root)
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts --setup
```

## Flags reference

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--scaffold` | bool | false | Enter the deterministic scaffolder path. Requires `--engine`, `--type`, `--name`. |
| `--engine <stack>` | enum | required with `--scaffold` | Target stack — same 8 engine IDs as elsewhere. |
| `--type <t>` | enum | required with `--scaffold` | Scaffolder type — see the tables above and `--list-types`. |
| `--name <str>` | string | required with `--scaffold` | Name of the artifact being scaffolded. |
| `--package <pkg>` | string | detected from project | Java package (Sling / Spring / AEM types). |
| `--path <dir>` | dir | `.` | Project root. |
| `--engine <stack>` | enum | auto | (Also on the LLM/MCP path.) |
| `--output <dir>` | dir | project-appropriate | Override the scaffold output directory. |
| `--dry-run` | bool | false | Print the planned file list, write nothing. |
| `--force` | bool | false | Overwrite existing files if they conflict. |
| `--secure` | bool | false | Apply per-type security hardening (auth, escaping, CSRF, security headers, secret redaction). Supported on 8 types. Security role auto-enables. |
| `--conventions <path>` | file | `.bmad/conventions.yaml` | Override the conventions file used for naming enforcement. |
| `--force-name` | bool | false | Bypass `.bmad/conventions.yaml` name validation. |
| `--no-test-stub` | bool | false | Skip the matching test stub for this scaffold. |
| `--setup` | bool | false | Auto-provision MCP config (`.mcp.json`, `.bmad/mcp-registry.toml`, `.env`, `.gitignore`) at the project root. |
| `--detect` | bool | false | Detect AEM project structure and print what the scaffolder would target. |
| `--list-types` | bool | false | List deterministic scaffolder types. |
| `--list-templates` | bool | false | List available LLM/MCP generation templates. |
| `--role <code>` | enum | `.bmad/role.yaml` | Role adaptation. The `security` role auto-enables `--secure`. |
| `--create-branch` | bool | false | Cut `dca/generation-<stack>-<timestamp>` before writing. |
| `--source-branch <name>` | string | auto | Base branch for `--create-branch`. |
| `--preflight` | bool | false | Print the preflight advisory and exit. |
| `--no-preflight` | bool | false | Suppress the preflight advisory. |
| `--yes-install` | bool | false | First-run dependency install without confirmation. |
| `--no-install` | bool | false | Error out if deps are missing (exit `2`). |
| `--interactive` | bool | false | Force interactive intake mode. |
| `--technical` | bool | false | Force technical intake mode. |
| `--help` | bool | false | Show help. |

## What's new in the maturity batch

- **Matching test-stub emission for all 24 scaffolders** — every scaffold now writes a companion test file at the canonical test location for its stack (JUnit + AEM/Sling Mocks, Spring Test, PHPUnit, Jest). Opt out with `--no-test-stub`.
- **`.bmad/conventions.yaml` enforcement** — the scaffolder validates the `--name` against project conventions (kebab/pascal case rules, package prefix, artifact-type naming). Errors are actionable and point at the offending token; bypass with `--force-name`, or edit `.bmad/conventions.yaml` to change the rules.
- **`--secure` hardening for 8 types** — per-type hardening pass that layers input validation, ACL enforcement, XSS-safe HTL/HTML, CSRF tokens, prepared statements, security headers, and secret redaction. The Markdown report twin includes a "Security decisions" section explaining each hardening. The `security` role auto-enables `--secure`.
- **Findings-cache emission** — every scaffold run writes `.bmad/cache/generation-<hash>.json` so downstream agents (Audit on the generated code, Test Coverage on the emitted test stubs) can pick it up.
- **5 new AEM IaC scaffolders** — `dispatcher-config`, `editable-template`, `cloud-manager-pipeline`, `content-fragment-model`, `experience-fragment`. Layered onto the AEM stack via the same `--engine aem --type <one of>` interface.

## Example workflow — AEM component, dry-run then commit

**Chat step 1 — dry-run:**

```text
create a new AEM component called Hero Banner --dry-run
```

Review the printed file list, then:

**Chat step 2 — commit on a new branch:**

```text
create a new AEM component called Hero Banner and cut a branch from develop
```

**Resolved CLIs:**

```bash
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --scaffold --engine aem --type component \
  --name HeroBanner --path /path/to/aem-project --dry-run

npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --scaffold --engine aem --type component \
  --name HeroBanner --path /path/to/aem-project \
  --create-branch --source-branch develop
```

## Cross-agent chaining hints

| Role | Next agent | Why |
|------|-----------|-----|
| `ea` | [Audit](./audit) | Audit the generated code against house conventions. |
| `tl` | [Audit](./audit) | Sanity-check the scaffold before opening the PR. |
| `de` | [Test Coverage](./test-coverage) | Fill in the emitted test stubs; measure real coverage. |
| `qa` | [Test Coverage](./test-coverage) (`generate` mode) | LLM completes the test-stub bodies to 100%. |
| `devops` | [Audit](./audit) | Verify the IaC scaffold (dispatcher-config, Cloud Manager pipeline) doesn't regress security. |
| `security` | [Sonar Scan](./sonar-scan) | Second-opinion Vulnerability pass on the hardened scaffold. |
| `content` | (stay in generation) | Iterate on content-fragment / editable-template outputs. |

## See also

- [Code Generation prompt catalog](../reference/prompts/code-generation) — copy-paste prompts, one per stack.
- [Standardized outputs contract](../concepts/standardized-outputs) — 15-column Summary + Markdown twin.
- [Interactive vs technical intake](../concepts/interactive-vs-technical) — `--interactive` / `--technical`, `.bmad/intake.yaml`.
- [Role adaptation](../concepts/role-adaptation) — how the `security` role auto-hardens.
