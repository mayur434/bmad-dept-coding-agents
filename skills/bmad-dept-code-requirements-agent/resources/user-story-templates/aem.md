# User-story authoring guide — AEM (AEMaaCS + AMS)

This guide tells the LLM authoring pass **how to shape user stories** for
an AEM (AEMaaCS or AMS) BRD. Combine with `templates/user-story.md` as the
master single-story skeleton.

## INVEST criteria (stack-specific interpretation)

- **Independent** — stories should not couple to dispatcher config changes
  or a specific Cloud Manager pipeline run. Cache-rule tweaks belong in
  their own story.
- **Negotiable** — leave room to swap Core Component v3 delegation for a
  proxy component, or a Sling Model exporter for an SPA endpoint, based on
  team preference.
- **Valuable** — value expressed to a Content Author, Consumer, or
  Dispatcher Admin — not to "the AEM developer" (that's implementation).
- **Estimable** — the team can size only when the editable template,
  policy owner, and Sling Model shape are agreed.
- **Small** — a single component + dialog + Sling Model + client-lib in
  one story is fine; adding a new template type as well is too big — split.
- **Testable** — every story is testable with JUnit + Sling Mocks (backend)
  and Hobbes.js or WebDriver (author-side smoke); accessibility with
  axe-core; visual regression via Cloud Manager's built-in checks.

## Stack-specific personas

- **Content author (editorial)** — TouchUI, Experience Fragments,
  content-fragment editor.
- **Template developer** — editable templates, policies, allowed components.
- **AEM developer** — HTL + Sling Model + `cq:dialog.xml` + client-libs.
- **Dispatcher / infrastructure admin** — dispatcher farm rules, CDN,
  invalidation agents.
- **DevOps / release manager** — Cloud Manager pipelines, quality gates.
- **End consumer** — the person visiting the published page.

## Story shape

`As a {{PERSONA}}, I want {{CAPABILITY}}, so that {{BENEFIT}}`

Realistic titles per persona:

- Content author — "author a hero component with two CTAs", "reuse the
  brand-header experience fragment across sites", "schedule an activation
  for the holiday promo page".
- Template developer — "add a policy allowing the video block on the
  landing template", "restrict the sidebar policy to the marketing
  section".
- AEM developer — "expose the article-list Sling Model as JSON at
  `.model.json`", "delegate rendering to the Core Component v3
  `Teaser`".
- Dispatcher admin — "invalidate `/content/brand/en/*` on locale-switch
  publish", "allow `.pagelist.json` selector through the dispatcher".
- End consumer — "see personalized hero images on the homepage", "read
  articles in my preferred language without a refresh".

## Story splitting patterns for AEM

- **Component vs template** — the component itself is one story; adding
  a policy on the editable template is a second story.
- **Sling Model vs HTL** — the backend Sling Model + JUnit test is one
  story; the HTL + client-lib + dialog is a second.
- **Content fragment model vs UI rendering** — split the CFM authoring
  surface from the component that reads it.
- **Author-tier vs publish-tier** — dialog + author preview in one story,
  dispatcher rules + publish rendering in another.
- **Content migration vs template rebuild** — migrating pages onto a new
  editable template is separate from building the template itself.
- **Locale rollout** — one story per locale when translation review is a
  bottleneck; one story across all locales when copy is source-only.
- **Core Component extension vs greenfield** — extending a Core Component
  via `sling:resourceSuperType` is one story; a bespoke component is
  another.

## Effort estimation guidance

- **S (~1 day)** — add a text field to an existing dialog + surface it in
  HTL; add a new client-lib category to an existing component.
- **M (~2-3 days)** — build a new component (HTL + Sling Model + dialog +
  client-lib + JUnit test) that fits an existing template.
- **L (~1 sprint)** — new editable template + 3-4 policies + 2 new
  components + dispatcher rules.
- **XL (>1 sprint, split)** — a new site (structure, templates,
  components, dispatcher farm, Cloud Manager pipeline).

**Estimation anti-patterns**
- Underestimating dispatcher cache-invalidation blast radius after a URL
  pattern change.
- Forgetting the Cloud Manager `customer.critical` quality-gate cost of a
  new HTL warning.
- Ignoring the round-trip cost of editable-template policy changes across
  environments.

## Ready-for-dev checklist

- [ ] Content fragment models defined + deployed to Author (if applicable).
- [ ] Editable template + policies identified; template owner named.
- [ ] Component `sling:resourceType` + resource-super-type chosen.
- [ ] Dialog fields listed with validators + i18n keys.
- [ ] Sling Model adaptables agreed (`Resource` vs `SlingHttpServletRequest`).
- [ ] Client-lib category defined; dependency graph reviewed.
- [ ] Dispatcher cache rules confirmed (`/statfileslevel`, invalidation).
- [ ] Cloud Manager pipeline path decided (production vs non-prod stage).
- [ ] i18n dictionary keys added.

## Example user stories for AEM

### STORY-001: Author a hero component with two CTAs

**As a** content author
**I want** a hero component with primary and secondary CTA fields
**So that** landing pages can drive one primary + one secondary action.

**Priority**: MUST | **Effort**: M | **Parent epic**: EPIC-1 Landing pages
**Dependencies**: brand color palette policy (STORY-004)
**AC** (Given/When/Then):
- Given the hero dialog is open, when I fill title + primary CTA + optional
  secondary CTA, then Preview renders both buttons per brand color policy.
- Given no secondary CTA is set, when the page renders, then only the
  primary CTA is emitted (no empty markup).
- Given the page renders on mobile, when the LCP element is the hero
  image, then a `<link rel="preload">` is emitted in `<head>`.

### STORY-002: Expose article-list Sling Model as JSON

**As an** AEM developer
**I want** the article-list Sling Model exported as `.model.json`
**So that** the SPA storefront can hydrate without a second AEM call.

**Priority**: SHOULD | **Effort**: M | **Parent epic**: EPIC-2 Headless
**Dependencies**: content-fragment model `Article` (STORY-006)
**AC**:
- Given a request to `/content/brand/en/articles/latest.model.json`, then
  the response contains up to 20 articles with title, url, teaser image,
  and publish date.
- Given the request is unauthenticated on Publish, then no draft-state
  content is returned.

### STORY-003: Invalidate locale-switch on publish

**As a** dispatcher admin
**I want** the dispatcher to invalidate `/content/brand/en/*` and
`/content/brand/de/*` on locale-switch publish
**So that** authors see the switch propagate within 30s.

**Priority**: MUST | **Effort**: S | **Parent epic**: EPIC-3 i18n
**AC**:
- Given a locale-switch page is activated, when the invalidation agent
  fires, then dispatcher cache for both locale trees is purged within 30s.

## Anti-patterns to avoid

- "As a developer, I want a Sling servlet at `/bin/servlets/xyz`" —
  implementation, not user value. Rephrase around the consumer or author.
- "As an author, I want a better dialog" — unmeasurable; specify which
  dialog and what "better" means.
- "As an admin, I want the dispatcher to be faster" — no target; add the
  hit-ratio or latency budget.
- "As a user, I want the site to look nicer" — no persona ownership, no
  testable outcome.
- Any story that bundles a new template + components + dispatcher rules
  + Cloud Manager pipeline changes into one — always split.

## Story-title formulation

Good:
- "Author a hero with primary + secondary CTA"
- "Expose article-list as `.model.json`"
- "Invalidate locale-switch on publish"

Bad:
- "Hero component" — no persona, no verb, no outcome.
- "Refactor the Sling Model" — implementation-only, no consumer value.
- "Fix dispatcher" — vague, unmeasurable.
