# Pipeline authoring guide — Adobe Commerce PaaS (Magento 2)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a CI/CD pipeline for an Adobe Commerce PaaS
(Magento 2, formerly Adobe Commerce On-Cloud or Magento Cloud) project.
Combine with the appropriate master template under `templates/`.

## Purpose

A pipeline for Adobe Commerce PaaS should establish: composer-based
dependency resolution, code-quality gates (PHPStan, PHPCS with the
Magento coding standard), unit + integration tests, database-migration
review, deployment via ECE-Tools (Magento Cloud) or the equivalent
self-managed deploy script, cache/index rebuild ordering, and post-deploy
smoke tests hitting cart + checkout flows. Maintenance mode is a
first-class citizen for schema-changing deploys.

## Preferred pipeline target

**GitHub Actions or GitLab CI** for external validation, with
**Magento Cloud's ECE-Tools** doing the actual deploy on managed
infrastructure. For self-managed Adobe Commerce PaaS, use
**GitLab CI / Jenkins** with your own deploy script.

Rationale — Magento Cloud is the managed variant; its Integration →
Staging → Production environment topology is git-branch-driven (push
to a Magento Cloud branch triggers a deploy). CI runs the quality gates
before the push; ECE-Tools runs the deploy on Magento Cloud
infrastructure.

## Typical pipeline stages for Commerce PaaS

1. **Setup** — PHP 8.2 or 8.3 (align with Magento 2.4.x support
   matrix), Composer 2, MySQL/MariaDB for tests, Elasticsearch/OpenSearch
   or Live Search stub. <!-- verify: current Magento 2.4.x PHP compatibility -->
2. **Composer install** — `composer install --no-dev --optimize-autoloader`
   for prod-shape build; `composer install` (with dev) for CI to run tests.
3. **Code quality** — `bin/magento dev:tests:run static` (Magento
   static-test suite: PHPStan level, PHPCS with `MEQP` and `Magento2`
   sniffs).
4. **Build** — `bin/magento setup:di:compile` (generated code),
   `bin/magento setup:static-content:deploy` (locales × areas × themes).
5. **Test** — `bin/magento dev:tests:run unit`; `bin/magento
   dev:tests:run integration`; MFTF for critical flows (checkout, cart).
6. **DCA sonar-scan gate** — `--engine commerce-paas` for LLM-driven
   checks (upgrade-cost anti-patterns, plugin vs preference vs observer).
7. **DCA audit gate** — pre-release audit; `--fail-on-overdue`.
8. **Package for deploy** — build the `deploy` git branch for Magento
   Cloud (with `vendor/` committed per ECE-Tools convention).
9. **Deploy stage (Integration → Staging on Magento Cloud)** — git push
   to `staging` branch; ECE-Tools runs `pre-deploy` → `deploy` →
   `post-deploy` hooks; `bin/magento setup:upgrade` runs during deploy;
   cache flush + reindex happen inside the deploy hooks.
10. **Manual approval** — CI holds before prod promotion.
11. **Deploy prod** — git push to `production` branch; ECE-Tools runs
    the same hook sequence.
12. **Post-deploy** — smoke tests (homepage, category, product,
    add-to-cart, checkout).

## Stack-specific secrets / env-vars

- `MAGENTO_CLOUD_TOKEN` — for `magento-cloud` CLI in CI.
- `COMPOSER_AUTH` — for private packages (Magento Marketplace,
  extension vendors); JSON with `http-basic` per host.
- `ADOBE_PUBLIC_KEY` / `ADOBE_PRIVATE_KEY` — for repo.magento.com.
- `.magento.env.yaml` — env-specific config (cache backends, session
  storage, cron, queue consumers).
- `app/etc/env.php` — env-specific; generated per environment by
  ECE-Tools; never committed for prod values.

## Stack-specific quality gates

- **Magento static tests** — `dev:tests:run static` (PHPStan level 3-5
  typical for legacy; level 8 for new code).
- **PHPCS with Magento2 + MEQP sniffs** — catches Magento coding-standard
  violations.
- **Deprecation checker** — `bin/magento dev:tests:run static-deprecation`
  fails on use of deprecated Magento APIs.
- **DCA sonar-scan for commerce-paas** — surfaces preference vs plugin
  vs observer misuse, upgrade-cost anti-patterns, cache-tag omissions.
- **MFTF regression** — headless-browser tests for cart + checkout.

## Stack-specific rollout options

- **Rolling deploy across the Magento fleet** — Magento Cloud handles
  this per Application yaml.
- **Blue-green** — swap two Magento Cloud projects (project-a vs
  project-b) via Fastly VCL or DNS cutover. Rare; expensive.
- **Canary** — Fastly weighted routing between old and new stack. Rare
  for Commerce PaaS.
- **Feature-flag** — Adobe Target integration; drop-in-level module
  enablement via `app/etc/config.php` merged in.
- **Maintenance mode wrap** — always for schema-changing deploys:
  `bin/magento maintenance:enable` before, `disable` after.

## Stack-specific deploy commands

- **Magento Cloud** — `git push magento staging` / `git push magento
  production` triggers ECE-Tools deploy.
- **Self-managed** — `composer install --no-dev --optimize-autoloader &&
  bin/magento setup:upgrade --keep-generated && bin/magento
  setup:di:compile && bin/magento setup:static-content:deploy en_US -f
  && bin/magento cache:flush && bin/magento indexer:reindex`.
- **Cache flush order** — config → block_html → full_page (or
  `cache:flush` clears all).
- **Queue consumer restart** — `bin/magento queue:consumers:list` +
  restart via supervisor / systemd after deploy.

## Stack-specific verify steps

- **Health endpoint** — `curl -sf https://<env>.example.com/health_check.php`.
- **Homepage** — `curl -sfo /dev/null -w "%{http_code}" https://<env>.example.com/`
  expects `200`.
- **Cart smoke** — MFTF `AddSimpleProductToCart` scenario against
  stage after deploy.
- **Checkout smoke** — MFTF `CheckoutAsGuest` scenario.
- **Log check** — `tail -F var/log/exception.log var/log/system.log`
  during post-deploy window; alert on new exceptions.

## Worked pipeline outlines

### 1. Magento Cloud — external CI + ECE-Tools deploy

- **Target:** `github-actions`
- **Stages:** setup → composer install → static tests (PHPStan + PHPCS)
  → build (di:compile + static-content:deploy) → unit + integration tests
  → MFTF critical flows → DCA sonar-scan → DCA audit gate → git push to
  `staging` (Magento Cloud auto-deploys) → smoke tests → manual approval
  → git push to `production` → smoke tests.

### 2. Self-managed Commerce PaaS — GitLab CI

- **Target:** `gitlab-ci`
- **Stages:** identical to above, but replace the git push with a
  direct SSH deploy: `ssh magento@<host> "cd /var/www && git pull && bin/magento
  maintenance:enable && composer install --no-dev && bin/magento
  setup:upgrade && bin/magento setup:di:compile && bin/magento
  setup:static-content:deploy en_US -f && bin/magento cache:flush &&
  bin/magento maintenance:disable"`.

### 3. Adobe Commerce PaaS with blue-green via Fastly

- **Target:** `github-actions`
- **Stages:** deploy to the idle Magento Cloud project (project-b);
  run smoke tests against project-b's stage → warm the CDN cache →
  flip Fastly VCL to route production traffic to project-b → drain
  project-a → post-deploy smoke.

## Anti-patterns to avoid

1. **Skipping `setup:upgrade` on deploy.** Silent schema drift; broken
   at next module install.
2. **Deploying without maintenance mode on schema changes.** Users hit
   errors mid-migration.
3. **Not clearing `full_page` cache after a config change.** Config
   change invisible; support tickets follow.
4. **Committing `app/etc/env.php` with prod secrets.** Secret leak.
5. **Reindexing synchronously during deploy on a large catalog.**
   Deploy timeout; use asynchronous reindex + queue consumer.

---

Generate the full pipeline using the appropriate `templates/pipeline-<target>.yml`
as the master, populating placeholders with Commerce-PaaS-appropriate
content from the guide above.
