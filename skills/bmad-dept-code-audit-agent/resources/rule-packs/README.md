# Rule-pack directory mapping

Rule-pack directory names are historical and do not always match the canonical engine ID used by `--engine`.
This mapping is authoritative:

| Rule-pack directory | Engine ID (`--engine`)          | Notes                                     |
|---------------------|---------------------------------|-------------------------------------------|
| aemcs               | aem                             | AEMaaCS mode                              |
| aemams              | aem                             | AEM AMS mode (`--platform aemams`)        |
| commerce            | commerce (alias: commerce-paas) | Adobe Commerce PaaS / Magento 2           |
| commerce-saas       | commerce-saas                   | Adobe Commerce SaaS                       |
| sling-shaft         | sling                           | Apache Sling / Shaft                      |
| spring-boot         | spring                          | Spring Boot                               |
| app-builder         | app-builder                     | Adobe App Builder                         |
| eds                 | eds                             | Edge Delivery Services                    |
| eds-commerce        | eds-commerce                    | EDS + Commerce hybrid                     |

Rule packs for the same engine (aemcs + aemams) are loaded together; the engine picks the appropriate subset by `--platform`.
