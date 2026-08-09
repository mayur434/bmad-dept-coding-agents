# Pipeline authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a CI/CD pipeline for an AEM as a Cloud Service
(AEMaaCS) or AEM Managed Services (AMS) project. Combine with the
appropriate master template under `templates/pipeline-<target>.yml` (or
`.groovy`).

## Purpose

A pipeline for AEM should establish: repeatable content-package builds
with the correct partition (ui.apps / ui.content / ui.config), Cloud
Manager quality-gate compliance (customer.critical = 0), stage-first
promotion with a manual approval before production, and post-deploy
dispatcher invalidation. The pipeline never bypasses Cloud Manager for
production deploys — Cloud Manager is the only supported production
deploy path for AEMaaCS. <!-- verify: current AEMaaCS deploy contract -->

## Preferred pipeline target

**Cloud Manager first** for AEMaaCS. For AMS, Cloud Manager is optional
— many AMS customers use a Jenkins-based pipeline that the AMS
customer-success team provides. Use `templates/pipeline-cloudmanager.yml`
as the primary; use `templates/pipeline-jenkins.groovy` for AMS.

Rationale — Cloud Manager owns environment topology (Author / Publish /
Dispatcher / CDN), content-package deploy ordering, and the quality gate
that Adobe treats as the certification surface. Bypassing it forfeits
Adobe's operational SLA for AEMaaCS.

**GitHub Actions / GitLab CI as pre-CM validation.** A common pattern:
external CI runs `mvn install -Padobe-public` on PRs so quality issues
surface before Cloud Manager runs the full pipeline (which is slow —
each Cloud Manager run is measured in tens of minutes). The Cloud
Manager pipeline is still the production deploy authority.

## Typical pipeline stages for AEM

1. **Setup** — Java 11 (moving to Java 17), Maven cache.
   <!-- verify: current AEMaaCS runtime version -->
2. **Build** — `mvn -B clean install -Padobe-public` — produces the
   `ui.apps`, `ui.content`, `ui.config`, and `all` packages.
3. **Test** — JUnit + AEM Mocks (Sling Mocks + WCM Mocks) for Sling
   Models; integration tests via `aem-mocks-junit5` where present.
4. **Cloud Manager quality gate** — Cloud Manager runs SonarQube + secops
   + Cloud Manager custom rules; `customer.critical = 0` blocks;
   `customer.important <= 10` blocks with manual override.
5. **DCA sonar-scan gate** — pre-Cloud-Manager scan against DCA's
   `--engine aem` for LLM-driven quality signals Cloud Manager misses.
6. **DCA audit gate** — pre-release audit; `--fail-on-overdue` gates
   ship on SLA breaches.
7. **Deploy stage** — Cloud Manager promotes to stage; dispatcher flush;
   smoke test the stage publish tier.
8. **Manual approval** — Cloud Manager UI approval before prod.
9. **Deploy prod** — Cloud Manager promotes to prod; dispatcher flush.
10. **Post-deploy** — smoke test prod; distribute `ANNOUNCEMENT.md`.

## Stack-specific secrets / env-vars

- Cloud Manager env config (Program → Environments → Variables) —
  `ADOBE_IMS_ORG`, `ADOBE_IMS_CLIENT_ID`, `ADOBE_IMS_CLIENT_SECRET`
  (rotate per Adobe SLA).
- External CI secrets — `ADOBE_ARTIFACTORY_TOKEN` (for `adobe-public`
  Maven mirror), `CLOUD_MANAGER_API_TOKEN` (for `aio cloudmanager:*`
  commands from CI).
- Do NOT store secrets in `ui.config`; use Cloud Manager environment
  variables + OSGi `secret` config type.

## Stack-specific quality gates

- **Cloud Manager quality gate** — customer.critical = 0, customer.important
  <= 10, customer.info informational. Thresholds configured in Program
  Config. <!-- verify: current defaults -->
- **Custom code quality** — Cloud Manager runs sonar-cloud-based scans
  against a curated Adobe ruleset. To supplement, run the DCA sonar-scan
  agent against `--engine aem` for LLM-driven checks (Adobe-specific
  anti-patterns not in the sonar-cloud ruleset).
- **Test coverage** — Cloud Manager exposes JaCoCo results via the
  quality-gate; DCA test-coverage agent adds gap-analysis + AI test
  generation targeting AEM Mocks.
- **Content-package validation** — Cloud Manager enforces the
  ui.apps/ui.content/ui.config partition; a violation blocks promotion.

## Stack-specific rollout options

**Cloud Manager staged promotion is effectively the only rollout for
AEMaaCS.** Stage → Prod promotion is manual-approval gated. There is no
native canary at the AEM tier; canary-style rollout is achieved at the
CDN layer:

- **Percentage-based publish-tier split** — Cloud Manager CDN
  configuration can weight-split traffic between "canary publish" and
  "stable publish" tiers if you run two publish pools. Uncommon; needs
  Adobe support enablement.
- **Content-only canary** — deploy content to publish, control visibility
  via Adobe Target audience routing or via CDN worker rules.

For AMS, blue-green is possible with two identical Publish pools + a
dispatcher farm swap. Rolling deploy is the default across a Publish
farm.

## Stack-specific deploy commands

- **Cloud Manager** — deploy is Cloud-Manager-driven; no CLI deploy
  command inside CI. Trigger externally with
  `aio cloudmanager:pipeline:start <pipelineId>` if needed.
- **AMS Jenkins** — `mvn -Padobe-ams -Dams.env=prod deploy` (varies by
  AMS project template).
- **RDE** — `aio cloudmanager:rde:deploy --file all/target/aem-all-{{VERSION}}.zip`
  for pre-Stage validation.

## Stack-specific verify steps

- **Cloud Manager quality-gate** — automatic per stage promotion;
  blocks on customer.critical.
- **Publish tier health** — `curl -sf https://publish-<env>.example.com/system/health`
  (health-check servlet, if registered).
- **Dispatcher flush** — invalidate cache after publish:
  `curl -X POST -H "CQ-Action: Activate" -H "CQ-Handle: /content/example" ...`
- **Sling console** — `curl -sf https://author-<env>.example.com/system/console/status-httprequest`
  (auth required).

## Worked pipeline outlines

### 1. AEMaaCS greenfield — Cloud Manager only

- **Target:** `cloudmanager`
- **Stages:** validate → build → test → codeQuality → deployStage → smokeStage → promoteToProd → deployProd → smokeProd
- **Gates:** Cloud Manager quality-gate; DCA audit gate via a
  Cloud-Manager post-deploy event handler.

### 2. AEMaaCS brownfield with external validation — GH Actions + Cloud Manager

- **Target:** `github-actions` (for pre-CM validation) + `cloudmanager`
  (for the actual deploy).
- **Stages (GH Actions):** setup → build (mvn install) → test →
  DCA audit + sonar-scan gates → notify Cloud Manager pipeline.
- **Stages (Cloud Manager):** identical to greenfield.
- **Gates:** GH Actions blocks the Cloud Manager trigger on gate
  failure; Cloud Manager blocks prod on its own quality-gate.

### 3. AMS with Jenkins — customer-managed deploy

- **Target:** `jenkins`
- **Stages:** Setup → Build → Test → DCA gates → Deploy to AMS Publish
  farm (rolling, N at a time) → Dispatcher farm swap → Verify.

## Anti-patterns to avoid

1. **Bypassing Cloud Manager for AEMaaCS production deploys.** Forfeits
   Adobe operational SLA.
2. **Mixing mutable content into `ui.apps`.** Breaks Cloud Manager
   promotions — the immutable `/apps` partition must be code-only.
3. **Long-running work in publish-tier servlets.** Pins publisher
   threads; use Sling Jobs for offload.
4. **Long OSGi bundle startup.** Blocks Cloud Manager health checks;
   defer expensive initialization to a Sling Job or scheduled task.
5. **No dispatcher flush after publish.** Content updates invisible
   until cache expires; stakeholders think the deploy failed.

---

Generate the full pipeline using `templates/pipeline-cloudmanager.yml`
(or `templates/pipeline-jenkins.groovy` for AMS) as the master,
populating placeholders with AEM-appropriate content from the guide
above.
