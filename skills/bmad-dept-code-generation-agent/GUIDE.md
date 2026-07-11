# BMAD Code Generation Agent — Setup Guide

Code generation across all supported stacks — AEM (AEMaaCS + AMS), Sling/Shaft, Spring Boot, Adobe Commerce (PaaS + SaaS), Adobe App Builder, and Edge Delivery Services (incl. EDS + Commerce). Two paths: deterministic scaffolders (zero AI tokens) and an LLM path with zero-config AEM MCP integration.

> This is one of the **four** DCA agents (audit, generation, impact-analysis, test-coverage). Static scanning is not a separate agent — it lives as the audit agent's "Scan Only" action.

---

## Prerequisites

- Node.js 20.12+ (runs the TypeScript scaffolders via `npx ts-node`, and the local AEM MCP servers)
- BMAD installed on your project
- **AEM stacks only:** access to an AEM instance (local SDK or Cloud) for live MCP context — not required for the deterministic scaffolders or the non-AEM stacks

## Installation

### Step 1: Install BMAD with this module

```bash
cd /path/to/your/project

npx bmad-method install \
  --directory . \
  --modules core,bmm \
  --custom-source /path/to/bmad-dept-code-agent/skills \
  --tools claude-code \
  --yes
```

This module requires `core` and recommends `bmm`.

After install: `.claude/skills/bmad-dept-code-generation-agent/`

### Step 2: MCP (Automatic — No Action Required, AEM stacks)

MCP is **auto-provisioned** on first use (AEM stacks only — other stacks generate without it). When the agent activates for the first time, it:
1. Creates/merges `.mcp.json` with all AEM servers (Adobe remote + community local)
2. Installs `.bmad/mcp-registry.toml` with capability mappings
3. Creates `.env` with local SDK defaults (if missing)
4. Appends `.env` and `.bmad/` to `.gitignore`

**You do nothing.** Just start using the agent.

#### Authentication (happens naturally)

| Mode | What happens |
|------|-------------|
| **Remote (Adobe Cloud)** | Your IDE prompts Adobe ID sign-in on first MCP tool call. Complete OAuth once. |
| **Local (AEM SDK)** | Works immediately with `.env` defaults (`admin/admin` on `localhost:4502`). |

Both modes work simultaneously — remote for cloud, local for development.

#### Manual setup (optional, for CI/scripting)

If you need to pre-provision without agent activation:
```bash
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts --setup
```

### Step 3: Set environment variables

Create `.env` in your project root (add to `.gitignore`):

```bash
AEM_HOST=http://localhost:4502
AEM_USER=admin
AEM_PASSWORD=admin
AEM_INSTANCES_CONFIG=~/aem-instances.yaml
```

For AEMaaCS (OAuth S2S):
```bash
AEM_HOST=https://author-p12345-e67890.adobeaemcloud.com
AEM_CLIENT_ID=your-client-id
AEM_CLIENT_SECRET=your-client-secret
```

## Usage

The agent has two generation paths:

- **Tier 1 — deterministic scaffolders** (`scripts/run.ts`, zero AI tokens): correct-by-construction files from a fixed catalog of types per stack.
- **Tier 2 — LLM + MCP** (driven by `SKILL.md` + `resources/<stack>/` packs): custom/business logic beyond the scaffolders, with live AEM context via MCP.

Both paths emit the same [standard outputs](#standard-outputs).

### Deterministic Scaffolders (Tier 1 — no AI tokens)

Run from the project root. List every scaffolder type across all **8 stacks** (24 types total):

```bash
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts --list-types
```

Scaffold an artifact:

```bash
npx ts-node .claude/skills/bmad-dept-code-generation-agent/scripts/run.ts \
  --scaffold --engine sling --type osgi-service --name OrderSync \
  --package com.acme.shaft.order --path .
```

`--engine` accepts one of: `aem`, `sling`, `spring`, `commerce-paas`, `commerce-saas`, `app-builder`, `eds`, `eds-commerce`. Useful flags: `--dry-run` (print files without writing), `--force` (overwrite existing), `--output <dir>` (report location), `--preflight` (LLM/mode advisory then exit), `--no-preflight`, `--create-branch` / `--source-branch <name>` (cut a standard git branch first). Standalone actions: `--list-types`, `--list-templates`, `--setup` (MCP provisioning), `--detect` (AEM module-structure detection).

### Via AI Agent (Tier 2 — LLM + MCP)

#### AEM Prompts

Ask your agent:
- "create a hero-banner component"
- "generate a Sling Model for the carousel"
- "scaffold an OSGi service for content sync"
- "create a Content Fragment Model for articles"
- "generate dispatcher config for my project"
- "create unit tests for my Teaser model"

The agent will:
1. Query MCP servers for live instance context (components, templates, configs)
2. Detect project conventions (package names, patterns, naming)
3. Generate all required files across the correct project layers
4. Produce unit tests for generated Java code

#### Adobe Commerce Prompts

Ask your agent:
- "create a new Commerce module Acme_CustomShipping"
- "create an after plugin on Magento\Catalog\Model\Product::getName"
- "create an observer for checkout_submit_all_after event"
- "create a REST API endpoint for custom entity CRUD"
- "add a GraphQL resolver for querying custom entity by ID"
- "generate admin UI grid listing for my custom entity"
- "create admin edit form for the custom entity"
- "create a frontend block with ViewModel for product badges"
- "generate a console command to sync inventory"
- "create a cron job that runs every 15 minutes"
- "scaffold a message queue consumer for order export"
- "create db_schema.xml for a custom entity table"
- "generate full CRUD repository for my custom entity"
- "add admin system configuration for API credentials"
- "generate unit tests for the OrderExportService"

The agent will:
1. Detect Commerce platform (composer.json, app/code/, etc/module.xml)
2. Scan existing modules for namespace, DI config, patterns
3. Generate all required files following PSR-12 + Magento coding standards
4. Apply security rules (XSS, CSRF, ACL, input validation)
5. Produce unit tests for generated service classes

### What Gets Generated

#### AEM

| Request | Files Created |
|---------|--------------|
| Component | Sling Model + HTL + Dialog XML + .content.xml + Test |
| OSGi Service | Interface + Impl + Config file + Test |
| Content Fragment Model | Model XML with field definitions |
| Experience Fragment | XF structure + variations + template |
| Editable Template | Template def + policies + allowed components |
| Dispatcher Config | vhost + filters + cache + rewrites |
| Cloud Manager Pipeline | Pipeline YAML + env vars template |

#### Adobe Commerce

| Request | Files Created |
|---------|--------------|
| Module scaffold | registration.php + module.xml + composer.json |
| Plugin | Plugin class + di.xml entry |
| Observer | Observer class + events.xml subscription |
| REST API | Interface + impl + webapi.xml + acl.xml |
| GraphQL | schema.graphqls + resolver + data provider |
| Admin Grid | listing.xml + controller + data provider + layout + menu |
| Admin Form | form.xml + edit/save/delete controllers + data provider |
| Storefront Block | Block + ViewModel + .phtml template + layout XML |
| Console Command | Command class + di.xml registration |
| Cron Job | Cron class (with locking) + crontab.xml |
| Message Queue | Consumer + publisher + communication/topology XML |
| DB Schema | db_schema.xml + db_schema_whitelist.json |
| Repository (CRUD) | Interface + model + resource model + collection + repo |
| System Config | system.xml + config.xml + Config helper + ACL |
| Unit Tests | PHPUnit test class + mocks + fixtures |

## Standard Outputs

Every generation run (Tier 1 or Tier 2, unless `--dry-run`) also emits the shared DCA outputs, alongside the generated source files:

- **Excel report** — `generation-<branch>-<timestamp>-agent-report.xlsx` under `<project>/generation-reports/` (override with `--output`). Uses the standardized workbook (15-column Summary sheet); generated files appear as INFO-severity rows with status `Generated` or `Skipped (exists)`.
- **Markdown twin** — `generation-<branch>-<timestamp>-agent-report.md` next to the Excel report.
- **`CHANGE-LOG.md`** — appended at the project root with a one-line summary of the files generated.
- **Optional standard branch** — with `--create-branch`, a `dca/generation-<stack>-<timestamp>` branch is cut from `production`/`main`/`master`/`develop` (or `--source-branch <name>`) before writing.

## MCP Server Details

### How It Works (Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│  Your AEM Project (after module install + setup)                 │
│                                                                   │
│  .mcp.json (auto-generated / merged)                             │
│  ├── AEM-Content              → Adobe Cloud (OAuth)              │
│  ├── AEM-Content-Readonly     → Adobe Cloud (OAuth)             │
│  ├── AEM-CloudManager         → Adobe Cloud (OAuth)             │
│  ├── AEM-Experience-Governance → Adobe Cloud (OAuth)            │
│  ├── AEM-Local                → localhost:4502 (basic auth)      │
│  └── AEM-Local-Dev            → localhost:4502 (basic auth)      │
│                                                                   │
│  .bmad/mcp-registry.toml (auto-generated)                        │
│  └── Maps capabilities → servers with priority                   │
│                                                                   │
│  Developer: "create a hero-banner component"                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ LLM (Claude / Copilot / Cursor)                          │   │
│  │  1. Loads SKILL.md → knows generation workflow           │   │
│  │  2. Reads .mcp.json → discovers all AEM MCP tools        │   │
│  │  3. Resolves capability (registry priority)               │   │
│  │  4. Calls MCP tool → gets live context                    │   │
│  │  5. Uses patterns.md → generates code                     │   │
│  │  6. Writes files → correct project locations              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### LLM Tool Compatibility

| Tool | MCP Config | Notes |
|------|-----------|-------|
| Claude Code | `.mcp.json` | Fully supported (remote + local) |
| GitHub Copilot (Agent Mode) | `.vscode/mcp.json` | Copy `.mcp.json` content here |
| Cursor | `.cursor/mcp.json` or Cursor Settings UI | Supports remote URL directly |
| Windsurf | `.windsurf/mcp.json` | Copy `.mcp.json` content here |

### Pre-Configured Providers

#### Adobe Official (Remote — requires AEMaaCS license)

| Server | Endpoint | What it does |
|--------|----------|-------------|
| AEM Content | `/content` | CRUD pages, content fragments, asset import |
| AEM Content (Read-Only) | `/content-readonly` | Read-only pages, CF search |
| AEM Cloud Manager | `/cloudmanager` | Programs, environments, pipelines |
| Experience Governance | `/experience-governance` | Brand rules, compliance |

Base URL: `https://mcp.adobeaemcloud.com/adobe/mcp/`  
Auth: OAuth via Adobe ID (browser sign-in prompt)  
Docs: [Adobe Experience League](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/mcp-support/using-mcp-with-aem-as-a-cloud-service)

#### Community (Local — for AEM SDK development)

| Server | npm Package | What it does |
|--------|-------------|-------------|
| AEM MCP Server | `aem-mcp-server` | Components, pages, templates, assets, workflows |
| AEM Dev MCP | `aem-dev-mcp-server` | OSGi bundles, configs, health, Groovy scripts |

Auth: Basic auth via `.env`  
Runs via `npx` (auto-installs on first use)

### Adding a Custom MCP Server

If your org has a proprietary AEM MCP server, add it **without editing module source**:

1. Add to `.mcp.json`:
```json
{
  "mcpServers": {
    "MY-AEM": {
      "command": "node",
      "args": ["./tools/my-mcp/index.js"],
      "env": { "AEM_HOST": "${AEM_HOST}" }
    }
  }
}
```

2. Add to `.bmad/mcp-registry.toml`:
```toml
[[providers]]
name = "My Org AEM Tools"
mode = "custom"
mcp_server_key = "MY-AEM"
capabilities = ["component-discovery", "template-discovery"]
priority = 1
```

Setting `priority = 1` makes your server preferred over both Adobe and community defaults.

## Without MCP (Offline/Fallback)

MCP applies to the AEM stacks only. The deterministic scaffolders (Tier 1) and the non-AEM stacks (Sling, Spring, Commerce PaaS/SaaS, App Builder, EDS, EDS + Commerce) never require MCP. Even on AEM, the agent works without any MCP servers — it falls back to scanning project source files. You lose live instance context and post-deploy validation, but code generation still works using standard archetype patterns.
