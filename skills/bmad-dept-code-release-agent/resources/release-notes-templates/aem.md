# Release-notes authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating release notes for an AEM as a Cloud Service
(AEMaaCS) or AEM Managed Services (AMS) project. Combine with
`templates/release-notes.md` as the master skeleton.

## Purpose framing

AEM release notes address two audiences at once — the Cloud Manager
release manager who runs the pipeline, and the editorial + business
stakeholder who wants to know what pages, components, and workflows now
behave differently. Notes should distinguish *code* changes (deployed
via `ui.apps`) from *content* changes (delivered via `ui.content`
packages or replication) and always call out anything that requires a
Cloud Manager pipeline re-run or a dispatcher invalidation. Internal
refactors that don't touch a component, template, or OSGi contract are
generally *not* release-noteworthy for stakeholders.

## Change categories for AEM

- **New components / templates** — new HTL components, editable
  templates, or `cq:Component` additions surfaced in the sidekick.
- **Dispatcher / CDN config changes** — `/farms/*`, `filters`, cache
  rules, `/statfileslevel`, or AEMaaCS CDN rules.
- **DAM / asset workflows** — new asset processing profiles, Dynamic
  Media presets, DAM Update Asset workflow changes.
- **Cloud Manager pipeline changes** — quality-gate threshold overrides,
  custom event handlers, new environments, RDE additions.
- **OSGi service / Sling Model contract changes** — new services,
  changed method signatures, changed `@ObjectClassDefinition` metadata,
  `resourceType` renames.
- **JCR content structure / migration** — node-type additions, ACL
  changes, editable-template renames, `/conf` restructuring.
- **Client-library changes** — new categories, dependency additions
  that affect page-render order or LCP.
- **AEM-uber / SDK version bump** — API deprecations, javax→jakarta
  moves, quickstart runtime upgrades. <!-- verify: current SDK cadence -->

## Commit-format conventions for AEM

- **Conventional Commits mapping:**
  - `feat(component|template|workflow): …` → **New features**
  - `fix(dispatcher|htl|sling-model): …` → **Fixes**
  - `perf(clientlib|dispatcher): …` → **Performance**
  - `refactor(osgi|sling): …` → **Refactoring**
  - `build(pom|content-package): …` → **CI / build changes**
  - `chore(cloud-manager|rde): …` → grouped under Refactoring or CI
- **Escalate as BREAKING when any commit touches:**
  - `resourceType` / `sling:resourceSuperType` rename
  - `cq:dialog` field removal (existing content de-authorable)
  - OSGi DS `@Component` interface signature or PID change
  - Dispatcher `/farms/*` cache-rule tightening (invalidation window widens)
  - `ui.apps` filter-scope reduction (unmapped nodes lost on install)
  - Editable-template policy removal
- **Skip in customer-facing notes:** `test:` for Sling/WCM Mock
  refactors, `ci:` for internal Cloud Manager custom-event-handler
  tuning, `chore(deps):` for transitive Maven bumps with no API impact.

## Breaking changes for AEM

1. **Dispatcher rule tightening.** Example: `/filter/0007` now denies
   `.selectorX.json`. *Mitigation:* update client fetches, re-warm cache.
2. **`sling:resourceSuperType` change on a shipped component.** Existing
   authored content loses dialog fields. *Mitigation:* JCR content
   migration script + editor communication.
3. **OSGi service interface change** (new required method on an exported
   API). Downstream bundles fail to activate. *Mitigation:* stage the
   change behind a `@ConsumerType` deprecation cycle.
4. **Editable-template policy removal.** Pages using the policy revert
   to defaults. *Mitigation:* migration groovy script + author sign-off.
5. **Content-package filter narrowing.** Nodes previously in-scope are
   dropped on install. *Mitigation:* explicit acl/node preservation
   snippet in the release notes.
6. **Cloud Manager quality-gate threshold override.** `customer.critical`
   raised for a temporary exception. *Mitigation:* time-boxed exception,
   ADR link, revert date named in the release notes.
7. **JCR node-type change on an authored resource.** *Mitigation:*
   `nodetypes.cnd` migration + content re-processing job.
8. **CDN cache-key change.** Fastly/AEMaaCS CDN key including a new
   header/query string. *Mitigation:* full purge post-deploy.

## Upgrade notes for AEM

Guidance on what upgrade notes should include:

- Whether the release requires a **Cloud Manager pipeline re-run**
  (any Cloud Manager custom event handler change forces this).
- **Content-package install order** — `ui.config` → `ui.apps` →
  `ui.content` (Cloud Manager enforces automatically; AMS ordering is
  manual).
- **Dispatcher flush** commands post-deploy (per farm, list the paths).
- **RDE preview** step recommended before Stage promotion when the
  release touches OSGi services.
- **AEMaaCS SDK version compatibility** — matching local SDK version
  needed to reproduce.
- **Java runtime** — call out Java 11 → 17 crossings.
  <!-- verify: current AEMaaCS runtime -->
- **`aio cloudmanager:*` secret rotation** — flag if the release
  requires a fresh IMS token.
- **Manual migration groovy** — link the script + who runs it.

## Known issues for AEM

Typical known-issues to disclose:

- Dispatcher cache-warmup gap in the first 10 minutes post-deploy on
  high-traffic pages.
- One-off `com.day.cq.replication` warning in `error.log` — benign but
  noisy.
- Editable-template preview slow on Chrome 12x due to a Granite UI bug
  that Adobe is tracking. <!-- verify: JIRA ref -->
- Client-library concatenation order regression under specific category
  cycles (workaround: force embed).
- Content Fragment GraphQL query cache stale for up to 60s post-publish.

## Contributor + PR/ticket linking conventions

- **Jira project keys:** typically `AEM-####`, `CQ-####`, or
  customer-specific (e.g. `LOYALTY-####`); surfaced via commit trailers
  `Jira: AEM-1234`.
- **PR links:** GitHub `owner/aem-project#456` or Bitbucket
  `PR-456` — Cloud Manager pipeline picks up either.
- **Cloud Manager execution IDs** — reference the execution ID for the
  build that produced the release (`Execution: 1234567`).
- **Author** attribution: use commit author, not committer (Cloud
  Manager sometimes rewrites committer).

## 3 worked release-notes examples for AEM

**v2.5.0 — Loyalty landing pages (2026-03-14).**
Ships the loyalty program landing pages + Sidekick block for editorial.
- **New:** `loyalty/hero`, `loyalty/tier-table` components; editable
  template `templates/loyalty-page`; Sidekick block `loyalty-cta`.
- **Fixed:** DAM Update Asset workflow no longer stalls on 4K MP4s
  (Jira AEM-1234).
- **Perf:** Client-library `loyalty-clientlib` split into critical /
  deferred — LCP -320ms on p75.
- **Upgrade:** Cloud Manager pipeline re-run required (new custom event
  handler for post-publish invalidation). Dispatcher flush
  `/content/loyalty`.
- **Known issue:** Content Fragment GraphQL cache stale up to 60s
  after publish (Adobe tracking).

**v2.5.1 — Dispatcher hotfix (2026-03-18).**
- **Fixed:** `/farms/publish` cache rule regression from v2.5.0 that
  cached authenticated responses (CVE-scored MEDIUM, Jira AEM-1240).
- **Breaking:** dispatcher rule `/filter/0007` now denies
  `?wcmmode=disabled`. *Mitigation:* Author preview via `.disabled`
  selector instead.
- **Upgrade:** dispatcher cache invalidate `/content` + `/etc`.

**v2.6.0 — Java 17 crossing (2026-04-02).**
- **Build:** Cloud Manager runtime moved from Java 11 to Java 17. All
  custom bundles recompiled.
- **Breaking:** Removed `com.example.LegacyReplicationHandler` (uses
  javax.\*). Consumers migrate to `com.example.ReplicationHandlerV2`
  (Jakarta imports).
- **Upgrade:** Full Cloud Manager pipeline re-run; RDE re-provision.
- **Known issue:** AEM Mocks 3.x compatibility with JUnit 5.10 requires
  a `<dependencyManagement>` pin.

## Anti-patterns to avoid for AEM

- **Silent dispatcher-rule tightening.** A rule change that widens cache
  invalidation must appear as breaking, or ops learns from the
  incident channel.
- **Listing every Sling Model as a feature.** Group internal-only Sling
  Models under a single "internal refactor" bullet.
- **Skipping the pipeline re-run flag.** Any Cloud Manager custom event
  handler change requires a re-run; missing it triggers a "why isn't
  my code live?" ticket the next morning.
- **Cloud Manager execution ID missing.** Ops teams cannot correlate
  quality-gate reports to the release without it.
- **Mixing content-package changes into a "code-only" release note.**
  Editorial cannot tell what will change on their pages.

---

Generate the full release notes using `templates/release-notes.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
