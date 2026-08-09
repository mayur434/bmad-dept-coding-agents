# Pipeline authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a CI/CD pipeline for an Apache Sling / Shaft
(sling-12) project. Combine with the appropriate master template under
`templates/`.

## Purpose

A pipeline for a Sling / Shaft project should establish: OSGi bundle
build and dependency-order install, Feature Model composition for
reproducible target install sets, health-check verification post-deploy,
and (where JCR is present) content-package deploy with the same
ui.apps/ui.content/ui.config discipline AEM uses. Sling instances are
often small clusters that can hot-swap most bundles; Feature-Model
changes need a restart.

## Preferred pipeline target

**GitHub Actions or GitLab CI** with **Jenkins** as an alternative for
older Sling installations that already have Jenkins infrastructure. No
managed Adobe pipeline equivalent (Cloud Manager is AEM-only).

Rationale — Sling / Shaft is self-hosted middleware. The pipeline needs
to build OSGi bundles, run OSGi-mocks tests, package a Feature Model,
and deploy via one of: `sling` CLI upload, Composum REST endpoint,
POSTing to `/system/console/bundles/<symbolic-name>` (WebConsole), or a
custom deploy hook.

## Typical pipeline stages for Sling

1. **Setup** — Java 17 (or 11 for legacy sling-12 installations),
   Maven cache.
2. **Build** — `mvn -B clean install` — produces the OSGi bundles
   (`bundle/` module) and the Feature Model (`feature/` module).
3. **Test** — JUnit + Sling Mocks (`org.apache.sling.testing.sling-mock`
   + `org.apache.sling.testing.osgi-mock`).
4. **Feature Model compose** — `mvn -pl feature slingfeature:aggregate`
   produces the composite feature.
5. **DCA sonar-scan gate** — `--engine sling` for LLM-driven checks
   (bundle boundary anti-patterns, resource-resolver misuse).
6. **DCA audit gate** — pre-release audit.
7. **Deploy stage** — POST the bundle to `/system/console/bundles`
   (WebConsole), or use `sling` CLI, or upload via a custom
   Composum/CQ Package Manager endpoint.
8. **Health check** — hit `/system/console/healthcheck?tags=deploy` and
   assert PASS.
9. **Manual approval** — CI holds before prod.
10. **Deploy prod** — same as stage, against prod URL.
11. **Post-deploy** — health check + smoke test.

## Stack-specific secrets / env-vars

- `SLING_ADMIN_USER` / `SLING_ADMIN_PASSWORD` — for WebConsole /
  Composum uploads. Rotate per org SLA.
- `SLING_DEPLOY_URL_STAGE` / `SLING_DEPLOY_URL_PROD` — instance URLs.
- Do NOT commit secrets in Feature Model files (`feature.json`); use
  OSGi config secrets or externalized environment variables.

## Stack-specific quality gates

- **PMD / Checkstyle** — Apache Sling POMs typically include
  `maven-pmd-plugin` + `maven-checkstyle-plugin` with the Sling
  ruleset; fail on new violations.
- **Sling Mocks coverage** — 80%+ line coverage on Sling Models,
  90%+ on servlets.
- **OSGi bundle validation** — `bnd-baseline-maven-plugin` catches
  breaking API changes without a version bump.
- **DCA sonar-scan for sling** — bundle-boundary anti-patterns,
  service-user misuse, missing `try-with-resources` on
  `ResourceResolver`.

## Stack-specific rollout options

- **Rolling deploy across the Sling cluster** — deploy bundles to
  instance 1 → verify → instance 2 → verify → ...
- **Blue-green** — two identical clusters; DNS/load-balancer cutover
  after the idle side is warmed up. Rare (Sling is often stateful in
  JCR).
- **Feature-Model swap** — replace the composite feature with a new one
  and restart; only viable during a maintenance window.
- **Hot bundle install** — most bundles hot-swap via WebConsole;
  Feature-Model changes and OSGi startup-time bundles need restart.

## Stack-specific deploy commands

- **WebConsole POST** —
  `curl -u $SLING_ADMIN_USER:$SLING_ADMIN_PASSWORD -F
  action=install -F bundlefile=@bundle/target/mybundle-{{VERSION}}.jar
  $SLING_DEPLOY_URL/system/console/bundles`
- **Sling CLI** — `sling application install --url $SLING_DEPLOY_URL
  bundle/target/mybundle-{{VERSION}}.jar`
- **Feature Model deploy** — `sling feature-model install
  feature/target/aggregated-feature.json` (restart required).
- **Package Manager (if JCR present)** — same as AEM:
  POST to `/crx/packmgr/service.jsp` with the content package.

## Stack-specific verify steps

- **Health check** — `curl -sf -u $SLING_ADMIN_USER:$SLING_ADMIN_PASSWORD
  "$SLING_DEPLOY_URL/system/console/healthcheck?tags=deploy&format=JSON"`
  and assert every check `status: OK`.
- **Bundle state** — `curl -sf -u ... "$SLING_DEPLOY_URL/system/console/bundles.json"`
  and assert every custom bundle in state `Active`.
- **Smoke test** — hit a known Sling servlet or Sling Model
  exporter (`.model.json`) and verify expected shape.

## Worked pipeline outlines

### 1. Sling-12 middleware — GH Actions

- **Target:** `github-actions`
- **Stages:** setup → build → test → Feature-Model compose → DCA
  sonar-scan → DCA audit gate → deploy stage (WebConsole upload) →
  health-check → manual approval → deploy prod → health-check.

### 2. Shaft with legacy Jenkins — Jenkinsfile

- **Target:** `jenkins`
- **Stages:** identical to above; deploy step uses the Shaft-specific
  deploy script the org already has (custom, per project).

### 3. Sling with JCR content packages — GitLab CI

- **Target:** `gitlab-ci`
- **Stages:** build (bundles + content package) → test → Feature-Model
  compose → DCA gates → deploy bundles via WebConsole → deploy content
  package via CRX Package Manager → health-check → approve → prod deploy.

## Anti-patterns to avoid

1. **Deploying Feature-Model changes without restart.** Bundle
   dependencies resolve incorrectly; runtime NPEs.
2. **Skipping `bnd-baseline`.** Ship breaking API changes without a
   version bump; downstream bundles wire against the wrong version.
3. **Uploading bundles with `Bundle-SymbolicName` version drift.**
   OSGi installs a second copy instead of upgrading; state leaks.
4. **Long-running work in synchronous servlets.** Pins request threads;
   use Sling Jobs.
5. **Ignoring `/system/console/healthcheck` results.** Deploy reports
   success, but half the bundles are `Installed` (not `Active`);
   discovered by users.

---

Generate the full pipeline using the appropriate `templates/pipeline-<target>.yml`
(or `templates/pipeline-jenkins.groovy` for Jenkins) as the master,
populating placeholders with Sling-appropriate content from the guide
above.
