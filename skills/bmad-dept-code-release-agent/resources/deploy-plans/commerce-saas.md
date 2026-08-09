# Deploy-plan authoring guide — Adobe Commerce SaaS

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a deploy plan for an Adobe Commerce SaaS
project (Catalog Service, Live Search, Payment Services, storefront
drop-ins). Combine with `templates/deploy-plan.md` as the master
skeleton.

## Purpose framing

A Commerce SaaS deploy plan is a coordination doc: Adobe manages the
backend rollout, and the customer team ships the drop-in bundle
version pins, API Mesh resolver updates, and storefront-events
consumers. The plan states which drop-in versions land in which
environment, how the schema propagation is verified, and how the
storefront falls back if a drop-in fails to render.

## Pre-deploy checklist for Commerce SaaS

- **Drop-in bundle version pinned** in `package.json` /
  `import-map.json` matching the Catalog Service schema version
  running in the target environment. <!-- verify: version matrix -->
- **Catalog Service schema** propagation verified on Stage (schema
  version endpoint returns the expected value).
- **Live Search index** rebuild triggered on Stage; query latency in
  baseline.
- **Storefront-events consumer** readiness — Adobe Real-Time CDP /
  Analytics receivers acknowledge current event schema version.
- **API Mesh resolver** deploy previewed (`aio api-mesh get --stage`);
  no unintended source removal.
- **IMS client credentials** validated in target environment; refresh
  token TTL not expiring during deploy window.
- **Payment Services** sandbox transaction green in Stage.
- **Consent-mode config** verified — cookie categories map to the
  drop-in analytics receiver.

## Deploy phases for Commerce SaaS — rollout-specific

Commerce SaaS has no in-place canary — Adobe manages backend rollout.
The customer-team rollout is effectively drop-in-version-pinning or
feature-flag. Phase against the resolved `--rollout`:

- **`canary` (via version pin cohorts).** Pin the new drop-in
  version to a cohort of pages (blog first, then PDP, then PLP, then
  checkout) via the sheet-driven metadata that governs which
  drop-in version each block loads. Phases: cohort-1 → cohort-2 →
  cohort-3 → full.
- **`blue-green` (via API Mesh workspace swap).** Two mesh
  workspaces; deploy resolvers to the idle workspace, warm, then swap
  workspace binding.
- **`rolling`.** Default for a straightforward drop-in bump; single
  phase with per-block verification.
- **`feature-flag` (via storefront flag).** Ship the new drop-in
  version behind a runtime flag; flip via config sheet or
  environment variable. Preferred when the drop-in change is
  behavioural (not just visual).
- **`bigbang`.** Reserved for hotfixes where the previous drop-in
  version is broken; ship-and-monitor.

## Verification per Commerce SaaS

- **Drop-in bundle version served** — inspect the loaded module
  version in the browser console; matches the pinned version.
- **Catalog Service API round-trip** (products query) < 400ms p95.
- **Live Search suggest** < 200ms p95; result relevance sampling
  passes.
- **Payment Services** sandbox transaction end-to-end < 4s.
- **Storefront-events emission** — a synthetic add-to-cart produces
  the expected event with the current schema version in the receiver.
- **API Mesh resolver** end-to-end query < 500ms p95.
- **Cart drop-in TTI** ≤ 3s p75 on the checkout page.
- **Consent-mode** toggles gate analytics beacons correctly on
  reject-all and accept-all cases.

## Rollback triggers for Commerce SaaS

- **Drop-in fails to render** on any supported browser (Chrome, Safari,
  Firefox, Edge — last two majors).
- **Catalog Service error rate > 1%** — schema mismatch or auth
  regression.
- **Live Search 5xx > 1%** — index rebuild incomplete.
- **Payment Services sandbox fails** — auth-token or hash-key
  regression.
- **Storefront-events consumer error rate > 5%** — schema-version
  mismatch downstream.
- **API Mesh resolver error rate > 2%** or timeout rate > 5%.
- **Cart abandonment spike > 20% vs baseline** — drop-in cart logic
  regression.
- **Manual call** from release manager or on-call.

## Communication plan for Commerce SaaS

**Pre-deploy** (T-24h): announce in `#commerce-saas-releases` — drop-in
version bump, cohort schedule, API Mesh change scope.

**During deploy**: post at each cohort promotion (blog → PDP → PLP
→ checkout); flag any browser-specific regression immediately.

**Post-deploy** (T+2h): all-clear with cart TTI, Catalog latency, and
storefront-events success rate snapshot. Announcement distributed to
merchandising + analytics teams.

## Stakeholder RACI for Commerce SaaS

| Role | Responsibility |
|---|---|
| Release manager | Owns cohort schedule + go/no-go at each cohort. |
| Tech lead | Owns drop-in pin + API Mesh resolvers. |
| DevOps / SRE | Executes deploy; monitors Mesh + drop-in load metrics. |
| QA | Runs cross-browser smoke + cart end-to-end. |
| Analytics | Verifies storefront-events schema + consent-mode gating. |
| Payment ops | Verifies Payment Services sandbox + PCI compliance. |
| On-call | Primary responder for cart / checkout regressions. |

## 2 worked deploy-plan examples for Commerce SaaS

**v2.5.0 — Drop-in bump to @dropins/storefront-cart@1.5.0, canary
cohorts, Prod.**
Pre-deploy: schema v3.2 confirmed in Prod; Payment Services sandbox
green; consent-mode receivers updated.
- Phase 1 (cohort-1, blog + support pages): pin new version, verify
  TTI + no console errors, 24h soak.
- Phase 2 (cohort-2, PDP): pin, verify add-to-cart events, 8h soak.
- Phase 3 (cohort-3, PLP + search): pin, verify Live Search
  round-trip.
- Phase 4 (checkout): pin, run synthetic order end-to-end, monitor
  cart-conversion for 4h.
- Rollback: revert pin in config sheet; CDN cache flush.

**v2.5.1 — API Mesh resolver update, blue-green (workspace swap),
Prod.**
Pre-deploy: mesh definition validated; IMS client TTLs clear.
- Phase 1: deploy resolvers to idle workspace; smoke via `curl`
  probes.
- Phase 2: warm resolver cache with representative queries.
- Phase 3: swap workspace binding via `aio api-mesh update`.
- Phase 4: monitor 10 min; drain old workspace after 24h.
- Rollback: swap binding back to previous workspace.

## Anti-patterns to avoid for Commerce SaaS

- **Bumping the drop-in version ahead of Catalog Service schema
  propagation** — drop-in queries fail on unknown fields.
- **Skipping storefront-events consumer alignment** — analytics /
  CDP downstream drops events silently.
- **Swapping API Mesh workspaces without a warm-up** — first
  requests hit cold resolver cache and time out.
- **Rolling out to all cohorts simultaneously** — a bad drop-in
  version affects checkout before any early-cohort signal surfaces.
- **Skipping consent-mode verification** — analytics beacons fire on
  reject-all, triggering privacy incidents.

---

Generate the full deploy plan using `templates/deploy-plan.md` as the
master, populating placeholders with stack-appropriate content from
the guide above.
