# Acceptance-criteria authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **how to shape acceptance criteria**
for user stories on an AEM (AEMaaCS or AMS) BRD. Combine with
`templates/ac-checklist.md` as the master per-story skeleton. Priority tags
map MoSCoW → the 15-column Summary contract (`MUST` / `SHOULD` / `COULD` /
`WONT`).

## Given / When / Then structure (AEM idioms)

- **Given** typically fixes the *state of Author-tier content* (a page exists
  under `/content/{{project}}/en/...` with policy `X`), the *state of the
  publish tier* (page is published, dispatcher cache is warm/cold), OR the
  *state of an OSGi config* (a run-mode-specific `sling:OsgiConfig` is set).
- **When** covers *author actions* (edit dialog, activate, unpublish), or
  *dispatcher requests* (`GET /content/x.html`, `.model.json`, selector).
- **Then** targets *observable behavior on the publish tier* (rendered HTML,
  headers, `Cache-Control`), the *Author preview*, or a *replication/JCR
  side effect* (audit-log node, replication queue empty).

## Types of AC for AEM

### Functional AC
- Given the hero component dialog is open on `/content/{{project}}/en/home`,
  when the author sets `title` + `primaryCta`, then Preview renders both
  fields per the active editable-template policy.
- Given a content author activates a page, when the replication agent fires,
  then the dispatcher cache is invalidated for the page path AND its
  registered `/statfileslevel` scope within 30s.
- Given a `.model.json` request to `/content/{{project}}/en/articles/list`,
  when the Sling Model exporter runs, then the JSON contains up to 20 items
  with `title`, `path`, `image`, `publishDate` and no draft-state content.
- Given the Cloud Manager production pipeline runs, when the code-quality
  step executes, then `customer.critical` = 0 and `customer.important` <= 10.
- Given a locale-switch page is activated on Author, when the invalidation
  agent fires, then dispatcher cache for both locale trees purges within 30s.
- Given a Content Fragment of model `Article` is created, when a page with
  the article-teaser component renders on publish, then the teaser reflects
  the fragment fields within one dispatcher TTL window.

### Non-functional AC
- Dispatcher cache hit-ratio >= 90% on the publish tier measured over any
  rolling 24h window (source: CDN log 200-from-cache / total).
- Author-tier p95 request latency <= 800ms for `wcm/core/content/*` during
  editorial peak. <!-- verify: p95 target for AMS vs AEMaaCS -->
- Publish-tier p95 for `.html` rendering <= 400ms (dispatcher HIT excluded).
- Replication end-to-end (activate -> dispatcher purge) <= 30s.
- Core Web Vitals on the templated landing page: LCP <= 2.5s, INP <= 200ms,
  CLS <= 0.1 at p75 (RUM, 28-day trailing).

### Edge-case AC
- Given the Publish tier is degraded, when the dispatcher receives a request
  for a cached page, then a stale-while-revalidate response is served and
  the incident is logged in the CDN access log.
- Given a rolling restart of Author is in progress during a content
  migration, when a migration script POSTs to `/content.json`, then it
  retries with exponential backoff and no page is left in a partial state.
- Given a component dialog is opened on a page with a legacy `sling:resourceType`,
  when the dialog renders, then it falls back to the base component dialog
  without a JS error in the console.
- Given a Content Fragment references a deleted asset, when a page renders,
  then a placeholder image is emitted (never a broken `<img>`).

### Security AC (STRIDE-inspired)
- Given an unauthenticated request hits `/system/console/*` on publish,
  when the dispatcher processes it, then the response is 404 (deny at
  dispatcher `filter` rules).
- Given HTL renders an attribute value from user content, when the value
  contains `"` or `<`, then HTL applies the correct context escaping
  (`context='attribute'` / `context='html'`) and no XSS payload executes.
- Given a POST to a custom Sling servlet without a valid CSRF token, when
  Sling processes the request, then the response is 403.
- Given an author without the `content-authors` group opens
  `/content/{{project}}/private/*`, when ACLs evaluate, then the author gets
  a 403 and the attempt is written to the AEM access log.
- Given a dispatcher rule allows a new selector, when a request adds a
  suffix `.infinity.json`, then it is still denied (defense-in-depth).
- Given a code-quality scan runs, when it inspects `pom.xml`, then no
  bundle with a known CVE (`Component with Known Vulnerability` rule)
  is present.

### Performance AC (measurable)
- `curl -o /dev/null -sw '%{time_total}' https://<publish>/content/{{project}}/en/home.html`
  <= 0.4s at p95 over 100 warm-cache requests.
- Sling Model `render()` p95 <= 200ms per component measured via New Relic
  transaction traces on publish. <!-- verify: NR agent SLA per tier -->
- Cloud Manager PageSpeed step reports Lighthouse Performance >= 85 on the
  landing template.
- Replication queue depth on Author <= 10 for 99% of any 5-minute window.

### Testability guidance
- Unit: **JUnit 5 + `io.wcm.testing.mock.aem` (AEM Mocks)** for Sling Models
  and servlets; **Sling Mocks** for resource-resolver + adapter scenarios.
- Integration: **AEM Cloud SDK** local instance + **HTTPunit / Sling Testing
  Clients** for `.model.json` and page render assertions.
- E2E: **Cypress or Playwright** against an ephemeral AEMaaCS RDE.
- Accessibility: **axe-core** in Cloud Manager or CI; WCAG 2.2 AA.
- Performance: **Cloud Manager PageSpeed** + external RUM (CrUX / SpeedCurve).
- Reference `test-generation/aem.md` for the DCA Test Coverage agent shapes.

## Negative AC (what MUST NOT happen)
- Unauthenticated user MUST NOT reach `/system/console/*`, `/crx/*`, or
  `/bin/*` on the publish tier.
- Author-only paths (`/content/{{project}}/private/**`) MUST NOT be cacheable
  by the dispatcher (`cache` deny rule).
- A component MUST NOT reference a Sling Model that instantiates a
  service-user session without an explicit `Subservice` mapping.
- Custom Java MUST NOT be installed via `ui.content` — install-hook order
  will corrupt bundle activation.
- HTL MUST NOT include `context='unsafe'` without a code-review sign-off
  finding recorded in `.bmad/decisions.yaml`.

## Testability check per AC
For each AC the LLM authors, verify it satisfies:
- [ ] Testable — a specific framework/tool + assertion can verify it.
- [ ] Measurable — has a concrete pass/fail signal.
- [ ] Unambiguous — no interpretation gaps.
- [ ] Independent — doesn't depend on another AC being true first.
- [ ] Small — verifiable in one test case.

## Common AC anti-patterns for AEM
- "The page should load quickly" -> "LCP <= 2.5s at p75 (Web Vitals RUM,
  28-day trailing)".
- "Dispatcher should be efficient" -> "Cache hit-ratio >= 90% over any
  rolling 24h window (CDN log)".
- "The dialog should work" -> "Given the dialog opens on a page of template
  X, When the author fills all required fields, Then Preview renders each
  field per policy Y".
- "Publish should be fast" -> "Replication activate -> dispatcher purge
  <= 30s p95 (measured on Author replication queue drain time)".
