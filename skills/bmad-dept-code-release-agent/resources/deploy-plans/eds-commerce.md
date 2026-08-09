# Deploy-plan authoring guide — EDS + Commerce hybrid

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a deploy plan for an EDS + Adobe Commerce
SaaS hybrid project (EDS blocks + storefront drop-ins + Catalog
Service / Live Search / Payment Services). Combine with
`templates/deploy-plan.md` as the master skeleton.

## Purpose framing

An EDS + Commerce deploy plan combines two release cadences: the EDS
git-merge cadence (fast, edge-scope) and the drop-in / Catalog Service
version alignment (Adobe-managed backend + customer-managed pins). The
plan must state the drop-in version pinned in this release, verify
schema compatibility with the target-environment Catalog Service, and
coordinate the storefront-events consumer schema, before merging the
EDS code that consumes those drop-ins.

## Pre-deploy checklist for EDS + Commerce

- **All EDS pre-deploy items** (see `deploy-plans/eds.md`) — preview
  URL, sheets, `head.html`, warm-up plan.
- **Drop-in bundle versions** synced across the release —
  `@dropins/storefront-cart`, `-checkout`, `-account`,
  `-product-details`, etc., versions listed with target Catalog
  Service schema compatibility. <!-- verify: version matrix -->
- **Catalog Service schema version** in target environment matches
  drop-in expected schema.
- **Live Search index** rebuild triggered on target env; query latency
  in baseline.
- **Storefront-events consumer** (Real-Time CDP / Analytics) schema
  version acknowledged.
- **Payment Services** sandbox transaction green in target env.
- **Consent-mode config** — cookie categories map to drop-in
  analytics receivers.
- **`import-map.json`** version pins reviewed; no unintended
  transitive bump.
- **IMS client credentials** for Commerce APIs validated in target
  env.

## Deploy phases for EDS + Commerce — rollout-specific

Combines EDS git-merge deploy with Commerce SaaS drop-in cohort
strategy. Phase against the resolved `--rollout`:

- **`canary` (via preview branch + drop-in cohort).** Route staff /
  geo cohort to preview branch with new drop-in versions; promote
  cohort-by-cohort (blog → PDP → PLP → checkout).
- **`blue-green` (via branch + workspace swap).** Deploy EDS code +
  drop-ins to `next` branch; deploy API Mesh to idle workspace; swap
  binding + merge branch.
- **`rolling`.** Single-merge deploy with per-block verification;
  drop-in pins updated across `import-map.json` atomically.
- **`feature-flag` (via sheet + import-map).** Ship new drop-in pin
  in a sheet-driven flag; flip per cohort by editing the sheet.
- **`bigbang`.** Merge + drop-in bump together; reserved for
  hotfixes; watch cart end-to-end tightly.

## Verification per EDS + Commerce

- **All EDS verification items** (LCP, CLS, block-load-success).
- **Drop-in bundle version served** — inspect module version at
  runtime matches pin.
- **Drop-in TTI ≤ 3s p75** on the checkout page.
- **Cart total call ≤ 400ms p95** to the Catalog Service.
- **Catalog Service round-trip** — products query < 400ms p95.
- **Live Search suggest** < 200ms p95; relevance sample passes.
- **Payment Services sandbox** transaction end-to-end < 4s.
- **Storefront-events emission** — synthetic add-to-cart produces
  the expected schema-version event downstream.
- **Cart-conversion RUM** stable within baseline over the first 4h.

## Rollback triggers for EDS + Commerce

- **All EDS triggers** (LCP > 4s, block-load-success < 95%).
- **Drop-in bundle fails to load** on any supported browser (last two
  majors: Chrome, Safari, Firefox, Edge).
- **Cart persistence errors > 2%** — drop-in cart-state regression.
- **Catalog Service error rate > 1%** — schema mismatch.
- **Payment Services error rate > 1%** — auth or hash-key
  regression.
- **Cart-conversion drops > 20%** vs baseline in the first 30 min at
  cohort promotion.
- **Storefront-events consumer error rate > 5%** — schema-version
  mismatch downstream.
- **Manual call** from release manager or on-call.

## Communication plan for EDS + Commerce

**Pre-deploy** (T-24h): announce in `#eds-commerce-releases` — EDS
merge, drop-in bumps, cohort schedule, storefront-events schema
alignment.

**During deploy**: post at each cohort promotion; per-block RUM +
Commerce API latency snapshot.

**Post-deploy** (T+4h): all-clear with LCP, cart TTI, cart-conversion,
Catalog latency snapshot. Announcement distributed to merchandising,
analytics, and content teams.

## Stakeholder RACI for EDS + Commerce

| Role | Responsibility |
|---|---|
| Release manager | Owns merge + cohort promotion + go/no-go per cohort. |
| Tech lead | Owns EDS block + drop-in pin change set. |
| DevOps / SRE | Runs warm-up crawl; monitors Mesh + drop-in load. |
| QA | Cross-browser smoke + cart end-to-end. |
| Merchandising | Signs off on storefront readiness + cohort schedule. |
| Analytics | Verifies storefront-events + consent-mode gating. |
| Payment ops | Verifies Payment Services sandbox + PCI compliance. |
| On-call | Primary responder for cart / checkout regressions. |

## 2 worked deploy-plan examples for EDS + Commerce

**v2.5.0 — Cart drop-in bump 1.5.0 + new PDP block, canary (cohort),
Prod.**
Pre-deploy: drop-in 1.5.0 schema-compat with Prod Catalog v3.2;
preview URL green; storefront-events schema v2 acknowledged.
- Phase 1 (blog cohort): merge to `next` branch, pin drop-in in
  import-map, route staff+geo cohort; 24h soak.
- Phase 2 (PDP cohort): merge to `main`; warm PDP edge cache; monitor
  cart TTI + storefront-events.
- Phase 3 (PLP cohort): sheet-flip to enable on PLP; 8h soak.
- Phase 4 (checkout cohort): sheet-flip; monitor cart-conversion
  tightly for 4h; synthetic order end-to-end.
- Rollback: revert import-map pin + `git revert` PDP block; edge
  purge.

**v2.5.1 — Payment Services hotfix + head.html analytics update,
bigbang, Prod.**
Pre-deploy: sandbox transaction green; consent-mode gating verified
on preview.
- Phase 1: merge to `main`; warm top-100 URLs; verify Payment
  Services + storefront-events + consent-mode.
- Rollback: revert commits; edge purge; drop-in unchanged.

## Anti-patterns to avoid for EDS + Commerce

- **Bumping drop-in versions ahead of Catalog Service schema
  propagation** — drop-in queries fail; cart breaks.
- **Merging EDS code that consumes a drop-in before the drop-in pin
  is live** — page renders without the drop-in; user-visible break.
- **Skipping storefront-events version-alignment** — analytics /
  CDP downstream drops events silently across environments.
- **Rolling out to checkout cohort first** — cart-conversion
  regression hits revenue before any early cohort surfaces it.
- **Ignoring the Payment Services sandbox check** — PCI-scored
  regression detected in production, not staging.

---

Generate the full deploy plan using `templates/deploy-plan.md` as the
master, populating placeholders with stack-appropriate content from
the guide above.
