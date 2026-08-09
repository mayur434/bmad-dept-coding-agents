# Release-notes authoring guide — Apache Sling / Shaft (sling-12)

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating release notes for an Apache Sling / Shaft
(sling-12) project. Combine with `templates/release-notes.md` as the
master skeleton.

## Purpose framing

Sling release notes address platform-integrators and OSGi-native
operators — people who care about bundle install order, feature-model
composition, and whether the JCR schema shifted. Notes should
distinguish *bundle* changes (deployed as OSGi artifacts) from
*content* changes (JCR node imports) and always call out anything that
requires a Sling restart, a JCR migration, or a feature-model
re-composition. Internal test bundle changes without a public-package
impact are usually not release-noteworthy.

## Change categories for Sling

- **OSGi bundle version bumps** — semantic version changes on
  Sling-hosted bundles, including exported-package semver moves.
- **Feature-model changes** — additions/removals in
  `src/main/features/*.json`; feature-composition ordering shifts.
- **JCR schema changes** — node-type CND additions, `sling:resourceType`
  renames, ACL restructuring under `/apps` or `/content`.
- **MDM contract changes** — for Shaft: master-data contract additions
  or field renames.
- **Java package renames** — exported-package renames trigger
  consumer-bundle recompilation.
- **Sling Model / servlet changes** — `@Model` additions, servlet
  `resourceTypes` / `paths` shifts, `SlingSafeMethodsServlet` new endpoints.
- **Sling health-check additions** — new `HealthCheck` services
  surfaced under `/system/console/healthcheck`.
- **Runtime / JVM changes** — Java version crossings, Sling starter version bumps.

## Commit-format conventions for Sling

- **Conventional Commits mapping:**
  - `feat(bundle|servlet|model): …` → **New features**
  - `fix(sling|jcr|resource): …` → **Fixes**
  - `perf(cache|resolver): …` → **Performance**
  - `refactor(osgi|feature): …` → **Refactoring**
  - `build(feature-model|bnd): …` → **CI / build changes**
  - `chore(deps):` → skip unless crossing OSGi API major
- **Escalate as BREAKING when any commit touches:**
  - `@Version` bump on an exported package (`@Export-Package`)
  - `@ProviderType` interface signature change
  - Removal of a bundle from a feature-model file
  - `sling:resourceSuperType` rename on a shipped resource
  - `nodetypes.cnd` change that alters constraints on existing nodes
  - Java package rename (import statements break downstream)
  - Feature-model composition-ordering change that changes install order
- **Skip in customer-facing notes:** `test:` sling-mock refactors,
  `chore(bnd):` metadata tuning that doesn't cross API, internal
  logging additions.

## Breaking changes for Sling

1. **Exported-package major version bump.** All consumers must
   recompile against the new API. *Mitigation:* dual-publish the old
   package for one release.
2. **`@ProviderType` interface change.** Third-party providers break.
   *Mitigation:* introduce V2 interface, `@Deprecated` V1.
3. **Bundle removal from a feature.** Runtime `NoClassDefFoundError`
   in dependent bundles. *Mitigation:* deprecation notice + migration
   guide.
4. **`sling:resourceSuperType` rename.** Existing resources orphaned
   from rendering. *Mitigation:* JCR migration script.
5. **JCR node-type constraint tightening.** Existing nodes fail
   validation. *Mitigation:* pre-migration audit + fixup script.
6. **Java package rename on API.** Consumer imports fail. *Mitigation:*
   `Import-Package` alias for one release.
7. **Feature-model composition reorder.** Install-time bundle
   dependency-resolution shifts. *Mitigation:* explicit ordering
   documented + tested on a fresh starter.
8. **Sling starter runtime bump.** OSGi framework version shift.
   *Mitigation:* smoke-test all bundles on new framework.

## Upgrade notes for Sling

Guidance on what upgrade notes should include:

- **Bundle install order** — dependencies first, consumers second;
  feature-model composition preserves this if authored correctly.
- **JCR migration script** — link the groovy or `SlingRepository` script;
  who runs it (pre-install vs post-install).
- **Feature-model re-composition** — `mvn -Pcompose` step + verify the
  resulting feature at `target/*.json`.
- **Sling starter version** compatibility statement (which starter
  version was used to test).
- **Health-check verification** — `curl -sf
  https://sling-<env>.example.com/system/console/healthcheck.tsv`
  post-install; expected OK count.
- **MDM schema apply** for Shaft — link the schema patch + apply order.
- **Restart requirement** — feature-model composition changes require
  full Sling restart; individual bundle installs can hot-swap.
- **Run-mode-specific OSGi config** — reload after run-mode change.

## Known issues for Sling

Typical known-issues to disclose:

- Sling health-check `default-startup` returns WARN for ~90s after cold
  boot while lazy-init caches warm.
- Feature-model composition with more than 40 bundles occasionally
  produces non-deterministic ordering — pin via explicit `start-order`.
- JCR observation listener leaks on rapid deploy/undeploy cycles
  (workaround: restart between cycles).
- `sling-mock` 3.x incompatible with JUnit 5.10 without dependency-management pin.
  <!-- verify: current sling-mock compatibility -->
- OSGi Config Admin PID collision warning benign but noisy on hot-swap.

## Contributor + PR/ticket linking conventions

- **Jira project keys:** `SLING-####` for upstream Apache Sling issues,
  `SHAFT-####` for Shaft-specific, or customer-specific keys.
- **PR links:** GitHub `apache/sling-<bundle>#456` for upstream, or
  customer repo PR refs.
- **Bundle coordinates:** always cite Maven coordinates
  `org.apache.sling:org.apache.sling.<artifact>:<version>` for changed
  bundles.
- **Feature-model artifact:** cite the feature-model file + version
  (`sling.feature.json:1.2.0`).
- **Author attribution:** commit author preferred; call out `apache-ci`
  synthetic authors separately.

## 3 worked release-notes examples for Sling

**v12.4.0 — Content-fragment servlet (2026-02-10).**
- **New:** `com.example.sling.cf.ContentFragmentServlet` under
  `resourceTypes=example/cf`; exposes GET on
  `/content/cf/{name}.json` with `SlingSafeMethodsServlet`.
- **Fixed:** Resource resolver leak in
  `example-resolver-provider` bundle on rapid map/unmap
  (Jira SHAFT-411).
- **Perf:** Sling Model cache hit-rate +18% via
  `@Model(adaptables = Resource.class, cache = true)`.
- **Upgrade:** feature-model recomposition (`mvn -Pcompose`); Sling
  restart required due to feature change.
- **Known issue:** cold-boot health-check WARN for ~90s.

**v12.4.1 — Bundle hotfix (2026-02-14).**
- **Fixed:** NPE in `com.example.sling.cf.ContentFragmentServlet` when
  resource has no `jcr:content` child (SHAFT-418).
- **Breaking:** `@Version("1.1")` bump on
  `com.example.sling.cf.api` exported package (added required method
  `getFragmentType()` on `ContentFragment` interface). All consumers
  recompile.
- **Upgrade:** dependent bundles rebuild + reinstall in order.

**v13.0.0 — Sling starter 13 (2026-03-20).**
- **Breaking:** Sling starter bumped 12.x → 13.x (OSGi R8 framework).
  All bundles re-tested; 3 bundles required `Bundle-RequiredExecutionEnvironment`
  bump to Java 17.
- **New:** MDM contract v2 for Shaft — `PersonContract` gains
  `preferredLanguage`; schema patch `mdm/patches/002-person-lang.sql`.
- **Upgrade:** starter reinstall (cannot upgrade in place); MDM schema
  apply BEFORE bundle install; JCR full backup before starter swap.
- **Known issue:** feature-model composition with 40+ bundles requires
  explicit `start-order` pinning.

## Anti-patterns to avoid for Sling

- **Silent exported-package version bump.** Consumers break at runtime
  because the release notes said "refactor".
- **Skipping the feature-model recomposition instruction.** Deploys
  succeed but the runtime carries the previous feature; behavior
  diverges silently.
- **Listing every internal Sling Model as a feature.** Group under
  "Internal Sling Model refactor" or omit.
- **Missing `nodetypes.cnd` compatibility note.** Existing nodes fail
  post-install validation.
- **No health-check verification step.** Ops cannot confirm the deploy
  is healthy without running it manually.

---

Generate the full release notes using `templates/release-notes.md` as
the master, populating placeholders with stack-appropriate content from
the guide above.
