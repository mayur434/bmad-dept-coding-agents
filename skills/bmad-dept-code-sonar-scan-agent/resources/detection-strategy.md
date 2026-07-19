# Sonar Scan — Stack Auto-Detection Strategy

## Detection order

Stacks are evaluated in the order below. The first match wins.

| Priority | Stack (engine id) | Detection markers |
|----------|-------------------|-------------------|
| 1 | `commerce-paas` | `composer.json` + (`app/code/` OR `app/etc/env.php`) |
| 2 | `commerce-saas` | `package.json` containing `@adobe/magento-storefront-event`, `Magento-Environment-Id`, `catalog-service.adobe.io`, or `live-search` (and NOT `app/code/` with `composer.json`) |
| 3 | `app-builder` | `app.config.yaml` OR `app.config.yml` OR `.aio` file OR `package.json` containing `@adobe/aio-sdk`, `@adobe/aio-lib-`, or `@adobe/uix-guest` |
| 4 | `spring` | `pom.xml` containing `spring-boot-starter` or `org.springframework.boot`, OR any `src/**/*.java` containing `@SpringBootApplication` |
| 5 | `sling` | `pom.xml` containing `org.apache.sling`, `org.apache.felix`, or `jackrabbit` AND NOT `ui.apps/` or `ui.content/` AND NOT pom.xml containing `com.adobe.aem` or `aem-sdk-api` |
| 6 | `aem` | `ui.apps/` OR `ui.content/` OR `pom.xml` containing `com.adobe.aem`, `aem-sdk-api`, `uber-jar`, or `granite` |
| 7 | `eds-commerce` | `blocks/` + (`scripts/commerce.js` OR `commerce/` dir OR `package.json` containing `@dropins/` or `commerce-`) |
| 8 | `eds` | `blocks/` + (`helix-query.yaml` OR `fstab.yaml`) |

## Per-stack real SonarQube analyzer mapping

This table documents which real Sonar analyzer would handle each stack in a server-based setup. The LLM uses the equivalent rule packs instead.

| Stack | Real Sonar Analyzer | Language(s) |
|-------|---------------------|-------------|
| `aem` | SonarJava | Java |
| `commerce-paas` | SonarPHP | PHP |
| `commerce-saas` | SonarJS | JavaScript |
| `sling` | SonarJava | Java |
| `spring` | SonarJava | Java |
| `app-builder` | SonarJS | JavaScript / Node.js |
| `eds` | SonarJS | JavaScript |
| `eds-commerce` | SonarJS | JavaScript |

## Source roots per stack

Use these globs when reading project files during the LLM scan:

| Stack | Primary source globs |
|-------|---------------------|
| `aem` | `core/**/*.java`, `bundle/**/*.java`, `**/src/main/java/**/*.java`, `ui.frontend/src/**/*.{js,ts}` |
| `commerce-paas` | `app/code/**/*.php`, `app/code/**/*.xml`, `**/*.php` |
| `commerce-saas` | `blocks/**/*.js`, `src/**/*.{js,mjs}`, `scripts/**/*.js` |
| `sling` | `**/src/main/java/**/*.java`, `core/**/*.java`, `bundle/**/*.java` |
| `spring` | `src/main/java/**/*.java`, `**/src/main/java/**/*.java` |
| `app-builder` | `actions/**/*.{js,mjs}`, `src/**/*.{js,mjs}`, `web-src/**/*.{js,jsx}` |
| `eds` | `blocks/**/*.{js,css}`, `scripts/**/*.js` |
| `eds-commerce` | `blocks/**/*.{js,css}`, `scripts/**/*.js`, `commerce/**/*.js` |

Always ignore: `**/node_modules/**`, `**/target/**`, `**/build/**`, `**/vendor/**`, `**/dist/**`, `**/*.test.{js,ts}`, `**/*.spec.{js,ts}`.
