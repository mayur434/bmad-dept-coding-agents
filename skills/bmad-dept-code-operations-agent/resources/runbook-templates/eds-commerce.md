# Runbook authoring guide — EDS + Commerce (hybrid)

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a runbook for an EDS + Commerce hybrid
project — Edge Delivery Services front end + Adobe Commerce SaaS
backend (drop-ins, Catalog Service, Payment Services, Storefront Events).
Combine with `templates/runbook.md` as the master skeleton.

## Purpose framing

An EDS+Commerce runbook is written for a hybrid storefront on-call.
The vocabulary combines **EDS edge** (helix-live, LCP, blocks) and
**Commerce drop-ins** (`@dropins/storefront-*`, Catalog Service,
Payment Services). Runbooks focus on: drop-in TTI, cart-total latency,
drop-in bundle version pinned per env, storefront-events schema drift,
Catalog Service query behavior observed edge-side. **Both** the edge
side (git revert + push) **and** the drop-in side (version pin +
redeploy) are safety nets.

## Common incident symptoms for EDS+Commerce

- Drop-in TTI > 3s (edge-side render-block, drop-in bundle load slow)
- Cart-total latency > 2s (Catalog Service p95, drop-in hydration)
- Cart-total mismatch (drop-in schema drift vs backend)
- Payment Services edge round-trip > 3s (IMS token, vendor)
- Drop-in bundle version drift preview vs live (env mismatch)
- Storefront-events schema drift (drop-in emits fields backend rejects)
- Live Search block returning 0 results (index missing, search query broken)
- Catalog Service query p95 spike (bad query from a new block)
- IMS token expiry mid-session (checkout stalls at auth step)
- LCP p75 > 2.5s with drop-in-heavy pages (bundle load blocking)

## Quick-diagnosis commands (per common symptom)

- **Drop-in TTI:** helix RUM dashboard → LCP + TTI by URL;
  Chrome DevTools → Performance → drop-in bundle load timing.
- **Cart-total latency:** DevTools Network → `GET /cart` timing;
  drop-in state via `window.__DROPINS__.cart.state`.
- **Cart-total mismatch:** compare drop-in cart total vs backend
  `POST /rest/V1/carts/mine/estimate-shipping-methods` result;
  drop-in vs Catalog Service schema version.
- **Payment Services roundtrip:** Adobe Commerce status page;
  DevTools Network → `POST /payments/*` timing.
- **Drop-in version drift:** `git diff env/prod/package.json env/stage/package.json`;
  `cat blocks/commerce-cart/config.json` for pinned version.
- **Storefront-events drift:** helix RUM `storefront-events` category;
  check Adobe Commerce event schema doc.
- **Live Search 0 results:** `curl -sf https://commerce-graphql.adobe.io/graphql -d '{...}'`;
  drop-in query for hard-coded facet that no longer exists.
- **Catalog Service query p95:** Adobe status; sample query via
  `curl -sf https://catalog-service.adobe.io/graphql -d '{...}'`.

## Likely causes (per common symptom)

- All EDS causes (see `runbook-templates/eds.md`) — head.html regression,
  block-load JS exception, edge cache regression, etc.
- All Commerce SaaS causes (see `runbook-templates/commerce-saas.md`) —
  drop-in bundle version, Catalog Service latency, IMS token, etc.
- **Cart-total mismatch:** drop-in bundle version incompatible with
  Catalog Service schema after a backend rollout; tax/shipping rules
  changed; currency conversion drift.
- **Storefront-events drift:** drop-in emits a new field that the
  storefront-events schema does not yet accept; drop-in downgrade left
  a stale event shape.
- **Live Search 0 results:** index not yet published for the new catalog;
  drop-in query hard-coded a facet that was removed from the index.

## Mitigation steps (per common symptom)

- **Drop-in TTI:** `git revert` last EDS commit (if head.html regression);
  OR pin drop-in bundle version to last-known-good in `package.json` and
  push.
- **Cart-total mismatch:** revert drop-in bundle version pin →
  `npm i -E @dropins/storefront-cart@<lastGood>` → push. If backend
  schema-side, escalate Adobe.
- **Storefront-events drift:** disable the emit temporarily via
  feature flag in the block; open ticket with Adobe to fix schema.
- **Live Search 0 results:** revert drop-in block change; if backend,
  wait for index publication + monitor.
- **Payment Services roundtrip:** if Adobe status confirms — no local
  action; disable that payment method + enable fallback; escalate.

## Rollback triggers for EDS+Commerce

Cross-reference `rollback-plans/eds-commerce.md` from the Release agent:

- Drop-in TTI > 4s for 15 min.
- Cart-total mismatch > 1%.
- Payment Services roundtrip > 5s or error > 5%.
- Drop-in bundle load failure > 5%.
- Live Search 0-results rate > 5% (new spike).
- LCP p75 > 3s for 15 min.
- Manual call from storefront-ops.

## Escalation matrix for EDS+Commerce

- **L1** — storefront on-call (drop-in issues), edge-ops SRE (EDS-side).
- **L2** — hybrid tech lead (owns the drop-in + EDS boundary),
  Commerce SaaS platform lead.
- **L3** — Engineering manager.
- **Vendor** — Adobe helix (EDS side), Adobe Commerce SaaS support
  (drop-ins / Catalog Service / Payment Services / storefront-events).

## Verification steps for EDS+Commerce

- Drop-in TTI ≤ 2s (RUM 15-min window).
- Cart-total match rate = 100% (synthetic).
- Cart-total latency ≤ 1s p95.
- Payment Services roundtrip ≤ 2s p95; error ≤ 0.5%.
- Drop-in bundle load success ≥ 99.5%.
- Live Search returning expected result counts.
- LCP p75 ≤ 2.5s.
- Storefront-events emit rate at baseline; no schema-drift errors in the backend.

## Comms templates for EDS+Commerce

**Channels:** `#storefront-deploys`, `#storefront-oncall`,
`#edge-deploys`, `#customer-status`, `#adobe-commerce-status`,
`#adobe-io-status`.

**Stakeholders:** storefront on-call, edge-ops SRE, hybrid tech lead,
Commerce SaaS platform lead, payments SRE (for Payment Services issues),
customer support lead, Adobe support liaison.

## 2 worked runbook examples for EDS+Commerce

### Example 1 — "Cart-total mismatch after drop-in v1.4.2 rollout"

- **Symptom:** Cart-total shown to user differs from backend response by ≥ $1 on 3.2% of sessions after drop-in v1.4.2 rolled to live.
- **Quick diagnosis:**
  1. DevTools on failing session — read `window.__DROPINS__.cart.state.grandTotal`.
  2. Compare against backend `POST /rest/V1/carts/mine` `grand_total`.
  3. Recent drop-in changelog — did v1.4.2 change tax / shipping calc?
  4. Check Catalog Service schema version pin.
  5. Check storefront-events schema in Adobe Commerce backend for schema-drift errors.
- **Mitigation:** `npm i -E @dropins/storefront-cart@<lastGoodVersion>` →
  commit → push to EDS live branch → instant edge deploy; verify at 5 min via RUM sample.
- **Rollback trigger:** mismatch rate > 1% at 15 min.
- **Escalation:** L1 storefront on-call → L2 hybrid tech lead + Adobe
  Commerce SaaS support if schema-side.

### Example 2 — "Drop-in TTI 3.5s on PDP after helix-live deploy"

- **Symptom:** PDP drop-in TTI 3.5s (baseline 1.6s) after commit `def456` to head.html.
- **Quick diagnosis:**
  1. helix RUM dashboard → TTI by URL.
  2. Chrome DevTools → Performance → drop-in bundle load timing.
  3. `git log -p head.html | head -30` — new render-blocking script?
  4. Drop-in bundle URL — is CDN edge miss?
  5. Catalog Service query p95 — is backend contributing?
- **Mitigation:** `git revert def456 && git push origin main`;
  wait 2 min for edge deploy; verify TTI within 15 min RUM window.
- **Rollback trigger:** TTI > 3s at 30 min post-revert.
- **Escalation:** L1 edge-ops → L2 hybrid tech lead if drop-in tuning is
  needed as forward fix.

## Anti-patterns for EDS+Commerce

- **Runbook conflates EDS and Commerce mitigations** — they run in
  different deploy loops (git-push for EDS, `npm publish` for drop-in);
  keep them distinct.
- **No drop-in version pin diff** — a top-3 root cause in hybrid stacks.
- **Missing storefront-events schema check** — silent divergences cause
  slow bleed of missing analytics.
- **Diagnosis uses only helix RUM** — Adobe Commerce SaaS backend
  events (storefront-events, Catalog Service) also drive the observed symptom.
- **Verification uses only PDP synthetic** — hybrid failures often surface
  at cart / checkout, not PDP.

---

Generate the full runbook using `templates/runbook.md` as the master,
populating placeholders with stack-appropriate content from the guide above.
