---
title: Code Generation
sidebar_position: 3
description: Copy-paste prompts for the Code Generation agent — 24 deterministic scaffolders + 5 AEM IaC scaffolders + LLM/MCP prompts.
---

# Code Generation — prompt catalog

Copy-paste prompts for the **Code Generation agent** (`bmad-dept-code-generation-agent`). Two paths: **deterministic scaffolders** (correct-by-construction, zero tokens) and an **LLM / MCP** path for custom logic and IaC.

Source: extracted from [`PROMPTS.md`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/PROMPTS.md) §3. Related: [Generation agent](../../agents/code-generation) · [CLI Flags](../cli-flags).

---

## 1. AEM (5 scaffolders: sling-model · osgi-service · sling-servlet · component · workflow-process)

```text
generate a Sling Model for the Article component
generate a Sling Model for the Navigation component in package com.acme.core.models
create an OSGi service for email notification
create an OSGi service for cache invalidation
generate a Sling Servlet that returns JSON for product data
create a Sling Servlet bound to path /bin/mysite/status
create a new AEM component called Hero Banner
create an AEM component for our AMS project
generate an AEM workflow-process for content approval
create a workflow process step that validates images
```

```text
create a new AEM component called Hero Banner --dry-run
generate a Sling Model for Article --force
generate an AEM component Hero --setup
```

```text
create an AEM component and deploy to local
create proxy of Teaser and deploy it on local
generate Hero Banner and deploy to cloud dev
just scaffold the component, don't deploy
create proxy of CIF Core component - Product Recommendation
```

### AEM IaC scaffolders (LLM / MCP path)

```text
create a Content Fragment Model for articles: title, body, author, date
create an Experience Fragment template for global header
create an editable template for landing pages
generate Dispatcher config for my AEMaaCS project
create a Cloud Manager pipeline configuration
scaffold HTL template for the Card component
create a scheduled task that runs daily to clean temp nodes
generate OSGi configuration for the SMTP service
```

---

## 2. Sling / Shaft (4 scaffolders: osgi-service · sling-servlet · sling-filter · sling-model)

```text
create a Sling OSGi service called OrderSync
generate a Sling servlet for order status at /bin/orders/status
create a Sling filter for request logging (priority -700)
generate a Sling Model for the Order resource
scaffold a Sling filter that adds CORS headers on the /api path
create a Sling servlet returning JSON for /bin/shaft/health
```

---

## 3. Spring Boot (3 scaffolders: rest-controller · service · jpa-repository)

```text
create a Spring REST controller for Orders
create a REST controller under /api/v1/orders with GET/POST/PUT/DELETE
generate a Spring service class for order processing
create a Spring service OrderProcessor with @Transactional
create a JPA repository for the Order entity
generate a JPA repository with a custom @Query for pending orders
generate a REST controller, service, and JPA repo for the Product entity in one shot
```

---

## 4. Adobe Commerce PaaS (5 scaffolders: module · plugin · observer · graphql-resolver · controller)

```text
create a new Commerce module Acme_CustomShipping
create an after plugin on Magento\Catalog\Model\Product::getName
create a before plugin on Magento\Sales\Model\Order::place
create an around plugin on Magento\Quote\Model\Quote::collectTotals
create an observer for checkout_submit_all_after event
create an observer for sales_order_place_after in the frontend area
add a GraphQL resolver for querying custom entity by ID
create a storefront controller at /acme/custom/index
create an admin controller at /admin/acme/entity/edit
```

```text
create a new Commerce module Acme_Foo --dry-run
create a Commerce plugin --force
```

### Commerce PaaS LLM/MCP prompts

```text
create a REST API endpoint for custom entity CRUD
generate admin UI grid listing for my custom entity
create admin edit form for the custom entity
create a frontend block with ViewModel for product badges
generate a console command to sync inventory
create a cron job that runs every 15 minutes to clean expired quotes
scaffold a message queue consumer for order export
create db_schema.xml for a custom entity table
add a custom product attribute 'delivery_estimate'
generate full CRUD repository for my custom entity
add admin system configuration for API credentials
enable the module and run setup:upgrade
```

---

## 5. Adobe Commerce SaaS (2 scaffolders: catalog-query · storefront-block)

```text
create a Catalog Service query for product search
create a Catalog Service query for products by category with filters
scaffold a storefront drop-in block for product cards
scaffold a storefront block for the PDP price tile
```

---

## 6. Adobe App Builder (3 scaffolders: action · mesh · event-handler)

```text
create an App Builder action called order-sync
create an App Builder action called invoice-webhook with sequences
scaffold an API Mesh configuration
scaffold an API Mesh handler that stitches Commerce + CRM
generate an event handler for commerce events
generate an event handler for observer commerce.order.created
```

---

## 7. EDS (1 scaffolder: block)

```text
create an EDS block called cards
create an EDS block called hero with lazy-load styles
scaffold an EDS block called quotes with a decorate() function
```

---

## 8. EDS + Commerce (1 scaffolder: dropin-block)

```text
create an EDS commerce drop-in block for product details
create a drop-in block called cart-preview
scaffold a drop-in block wired to the Commerce Cart API
```

---

## `--setup` — MCP provisioning

```text
set up MCP for this project
provision the AEM MCP servers (.mcp.json, .bmad/mcp-registry.toml, .env)
generate an AEM component Hero --setup
scaffold a Commerce module Acme_Foo --setup
add MCP config for App Builder to this project
```

---

## `--dry-run` / `--force` prompts

```text
scaffold in dry-run mode so I can review before writing
create a new AEM component called Hero Banner --dry-run
generate a Sling Model for Article --force
create a Commerce plugin --force
force overwrite existing files if they conflict
```

---

## `--list-types` / `--list-templates` — discovery

```text
list scaffolder types
list scaffolder templates
list scaffolder types for the AEM engine
list scaffolder types for Commerce PaaS
list scaffolder types for Sling
list all engines
```

---

## `--secure` / hardened generation

```text
generate a Spring REST controller for Orders with method security
create a Commerce controller with CSRF + form-key validation
create an App Builder action with require-adobe-auth and signature verification
generate a Sling servlet with authentication and role check
scaffold a Content Fragment Model with strict validation constraints
```
