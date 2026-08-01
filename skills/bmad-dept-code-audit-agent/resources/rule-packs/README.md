# Rule-pack directory mapping

Rule-pack directory names are normalized to match the canonical engine ID used by `--engine`.
This mapping is authoritative:

| Engine ID (`--engine`) | Rule-pack directory                                     | Notes                                                  |
|------------------------|---------------------------------------------------------|--------------------------------------------------------|
| aem                    | `aem/aemcs/` (AEMaaCS) + `aem/aemams/` (AEM AMS)        | `--platform` picks the subset (`aemcs` or `aemams`)    |
| commerce-paas          | `commerce-paas/`                                        | alias: `commerce` — Adobe Commerce PaaS / Magento 2    |
| commerce-saas          | `commerce-saas/`                                        | Adobe Commerce SaaS                                    |
| sling                  | `sling/`                                                | Apache Sling / Shaft (was `sling-shaft/`)              |
| spring                 | `spring/`                                               | Spring Boot (was `spring-boot/`)                       |
| app-builder            | `app-builder/`                                          | Adobe App Builder                                      |
| eds                    | `eds/`                                                  | Edge Delivery Services                                 |
| eds-commerce           | `eds-commerce/`                                         | EDS + Commerce hybrid                                  |

Rule packs for the same engine (`aem/aemcs` + `aem/aemams`) are loaded together; the engine picks the appropriate subset by `--platform`.

## Change history

- 2026-08-01: normalized directory names to match engine IDs (`aemcs` + `aemams` → `aem/`, `sling-shaft` → `sling/`, `spring-boot` → `spring/`, `commerce` → `commerce-paas/`).
