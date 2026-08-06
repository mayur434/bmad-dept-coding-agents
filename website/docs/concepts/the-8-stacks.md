---
id: the-8-stacks
title: The 8 Stacks
sidebar_position: 2
description: Eight engine IDs, their aliases, the platforms they serve, and how auto-detection picks one.
---

Every agent registers the same 8 engines. The `--engine <id>` flag is identical everywhere; auto-detection iterates the registry in a fixed order and picks the first match (`eds-commerce` wins ties).

## The 8 engines

| Engine (`--engine`) | Platform served | Tier-1 analysis |
|---------------------|-----------------|-----------------|
| `commerce` | Adobe Commerce / Magento 2 (PHP) | Legacy regex scanner + PHP tree-sitter AST precision pass. |
| `commerce-saas` | Adobe Commerce SaaS (Catalog / Live Search / drop-ins) | JS tree-sitter AST + JSON/config scan. |
| `aem` | AEM as a Cloud Service **and** AEM AMS (Java) | Legacy regex scanner + Java tree-sitter AST precision pass. |
| `sling` | Apache Sling / Shaft, sling-12 (Java) | Pure Java tree-sitter AST. |
| `spring` | Spring Boot middleware (Java 17/21, Jakarta) | Java tree-sitter AST + regex + nested-YAML config parse. |
| `app-builder` | Adobe App Builder — Mesh, Middleware/BFF, Eventing, UIX Apps (Node.js / React) | JS tree-sitter AST + `app.config.yaml` / `.env` / mesh config. |
| `eds` | Edge Delivery Services (JS blocks, drop-ins) | Legacy regex scanner + JS tree-sitter AST precision pass. |
| `eds-commerce` | EDS + Commerce hybrid storefronts | Legacy regex scanner + reuses EDS JS AST pass with stack ID `eds-commerce`. |

## Aliases and platform variants

- **`commerce` = `commerce-paas`** — both IDs alias the same PHP engine (Magento 2 / Adobe Commerce PaaS). Use whichever reads better in your prompt.
- **`aem` serves both AEMaaCS and AEM AMS** — the same engine, with `--platform aemcs | aemams | both` to constrain rule packs. Auto-detected when unset; default when both signals are present is `both`.
- **`aemcs` and `aemams` as engine values** — some flags accept these as aliases for `aem`; combine with `--platform` for clarity.
- **App Builder variants** — the four App Builder shapes (API Mesh, Middleware/BFF, I/O Events / Eventing, UIX Apps) are all served by the single `app-builder` engine with variant-specific rule packs.

## Auto-detection order

The dispatcher iterates the registry in registration order and picks the first engine whose `detect()` returns true. On a multi-match, it prefers `eds-commerce` (so a project with both EDS signals *and* Commerce dropins is served by the hybrid engine, not plain `eds`).

Signals the auto-detector looks for:

| Signal | Engine picked |
|--------|---------------|
| `composer.json` mentions `magento/`, or `app/code/` exists | `commerce` |
| `ui.apps/`, `pom.xml` with AEM SDK | `aem` |
| `pom.xml` / `bnd` with `org.apache.sling` / `org.apache.felix` (Shaft/MDM/SAM markers), no AEM markers | `sling` |
| `spring-boot-starter*` / `org.springframework.boot` in `pom.xml` / `build.gradle`, or `@SpringBootApplication` | `spring` |
| Storefront Events SDK / `Magento-Environment-Id` / `catalog-service.adobe.io` (no `app/code`) | `commerce-saas` |
| `blocks/`, `helix-query.yaml`, `fstab.yaml` | `eds` |
| EDS signals + commerce dropins | `eds-commerce` (wins over `eds`) |
| `app.config.yaml`, `.aio`, `@adobe/aio-sdk` | `app-builder` |

## The 11 in-scope variants → 8 engines

The overall coverage matrix serves **11 tech-stack variants** through **8 engines**:

| # | Variant | Engine |
|---|---------|--------|
| 1 | AEMaaCS | `aem` (`--platform aemcs`) |
| 2 | AEM AMS | `aem` (`--platform aemams`) |
| 3 | Commerce PaaS (Magento 2) | `commerce` / `commerce-paas` |
| 4 | Commerce SaaS (ACCS / drop-ins / Catalog / Live Search) | `commerce-saas` |
| 5 | App Builder — API Mesh | `app-builder` |
| 6 | App Builder — Middleware / BFF | `app-builder` |
| 7 | App Builder — I/O Events (Eventing) | `app-builder` |
| 8 | App Builder — UIX Apps | `app-builder` |
| 9 | Sling-12 / Shaft | `sling` |
| 10 | Spring Boot | `spring` |
| 11 | EDS + EDS×Commerce | `eds` / `eds-commerce` |

## When to override auto-detection

Pass `--engine <id>` when:

- The project mixes signals from two families (e.g. a Spring Boot service that also embeds AEM libraries) and you want the analysis of a specific one.
- You're running from CI where the working directory may not have complete signal files.
- The repo is split — a single folder contains only a subset of the platform's canonical layout.
- Mid-migration, where the source tree partially matches both `commerce` and `commerce-saas`.

## `--platform` — AEM only

Only the `aem` engine honors `--platform`:

- `aemcs` — AEM as a Cloud Service rules only.
- `aemams` — AEM AMS (on-prem / managed services) rules only.
- `both` — apply both rule sets (default when auto-detected).

Use this when you're on a specific platform and don't want the noise of the other's rules.

## List the registered engines

Every dispatcher supports `--list-engines`:

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts --list-engines
```

## Per-stack rule packs

Each engine ships a per-stack rule pack under `skills/bmad-dept-code-<agent>-agent/resources/`. Summaries per stack live in the [rule packs reference](../reference/rule-packs/aem).

## Next

- [Standardized Outputs](standardized-outputs) — the shape every engine writes.
- [Role Adaptation](role-adaptation) — how output shape varies by user role.
- Individual [agent](../agents/audit) pages — each documents per-stack behavior in more detail.
