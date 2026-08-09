# Runbook authoring guide — Adobe Commerce SaaS

This guide tells the LLM authoring pass **what stack-specific content
to embed** when generating a runbook for an Adobe Commerce SaaS
project — Catalog Service, Live Search, Payment Services, Storefront
Events, drop-in-based storefront. Combine with `templates/runbook.md`
as the master skeleton.

## Purpose framing

A Commerce SaaS runbook is written for a storefront on-call and a
platform-integration engineer at 3 AM. The stack is **SaaS-backed** —
the on-call cannot restart the backend, cannot upgrade Catalog Service
version out-of-band, and cannot patch Payment Services. Runbooks focus
on: **drop-in bundle behavior**, **API Mesh resolver behavior**,
**edge-side rendering (EDS + drop-ins)**, and **triage against Adobe
Commerce status**. Escalation to Adobe Commerce support is a first-class
mitigation.

## Common incident symptoms for Commerce SaaS

- Drop-in bundle load failure (`@dropins/storefront-cart` failed to hydrate)
- Catalog Service query latency > 800ms (Adobe backend degradation, query complexity)
- Storefront-events emit rate dropped > 50% (edge worker regression)
- Payment Services round-trip > 3s (Adobe payments backend, IMS token issue)
- API Mesh resolver 5xx > 1% (custom resolver bug, upstream vendor timeout)
- IMS token cache miss storm (IMS rotation, cache eviction)
- Drop-in version drift between env (package.json pinned vs deployed)
- Live Search query error rate > 2% (index missing, query syntax invalid)
- Cart total mismatch (drop-in <-> backend schema drift)
- Session hydration failure (localStorage regression, drop-in state mismatch)

## Quick-diagnosis commands (per common symptom)

- **Drop-in load failure:** browser DevTools console (`window.__DROPINS__.state`);
  network tab → assert bundle URL 200; check drop-in registry version pin.
- **Catalog Service latency:** Adobe Commerce status page; test query via
  `curl -sf https://catalog-service.adobe.io/graphql -d '{...}'`; check
  query complexity (nested facets).
- **Storefront-events lag:** helix-admin metrics; check edge worker deploy
  status (git-based); RUM sample rate.
- **Payment Services roundtrip:** Adobe status page; sample synthetic
  `POST /payments/{id}/confirm`; IMS token freshness via `aio auth:list`.
- **API Mesh 5xx:** `aio api-mesh describe --envId <id>`; check mesh
  resolver logs via `aio api-mesh log-list`; check upstream service status.
- **IMS token cache miss:** IMS metrics; check `Adobe-IMS-Token` header
  freshness in edge worker logs.
- **Drop-in version drift:** `git diff env/prod/package.json env/stage/package.json`;
  compare `@dropins/*` semver pins.

## Likely causes (per common symptom)

- **Drop-in load failure:** bundle URL 404 (CDN edge miss); drop-in version
  incompatible with Catalog Service schema; localStorage state corruption.
- **Catalog Service latency:** Adobe backend degradation; query complexity
  exceeded limits; missing index on custom attribute.
- **Storefront-events lag:** edge worker deploy pending; RUM sample rate
  throttled; browser adblock intercepting beacon.
- **Payment Services roundtrip:** IMS token expired mid-request; vendor
  network hop degraded; new payment method not provisioned in the target env.
- **API Mesh 5xx:** custom resolver bug (JS exception); upstream vendor
  timeout not caught; mesh cache miss under load.

## Mitigation steps (per common symptom)

- **Drop-in load failure:** revert drop-in bundle version pin
  (`npm i -E @dropins/storefront-cart@<lastGood>`) → redeploy via git push
  to EDS live branch; instant edge rollback for content-only fix.
- **Catalog Service latency:** if Adobe status page confirms — no local
  mitigation; disable heavy queries (facet-heavy PLPs) via feature flag
  until backend recovers; escalate to Adobe.
- **Storefront-events lag:** if edge worker deploy pending — accelerate
  merge/verify; if RUM throttling — check helix-admin sample-rate config.
- **Payment Services roundtrip:** if IMS-related — refresh cached tokens
  (`aio auth:login` in the deploy env); if vendor-side, disable that
  payment method + enable fallback.
- **API Mesh 5xx:** roll back mesh config
  (`aio api-mesh update -f <last-good.json>`); disable failing resolver;
  clear mesh cache.

## Rollback triggers for Commerce SaaS

Cross-reference `rollback-plans/commerce-saas.md` from the Release agent:

- Drop-in bundle load failure rate > 5% (drop-in version pin caught bad build).
- Cart-total mismatch > 1% (drop-in <-> backend schema drift).
- Payment Services roundtrip p95 > 5s.
- API Mesh 5xx > 2%.
- IMS token failure rate > 5%.
- Manual call from storefront-ops or platform-integration lead.

## Escalation matrix for Commerce SaaS

- **L1** — storefront on-call, platform-integration engineer.
- **L2** — Commerce SaaS tech lead (drop-in / API Mesh owner), EDS lead.
- **L3** — Engineering manager.
- **Vendor** — Adobe Commerce SaaS support (Catalog Service / Live Search
  / Payment Services / Storefront Events); Adobe IMS support (auth flow).

## Verification steps for Commerce SaaS

- Drop-in load success ≥ 99.5% (RUM synthetic).
- Catalog Service p95 ≤ 400ms; error rate ≤ 0.5%.
- Storefront-events emit rate at baseline.
- Payment Services round-trip p95 ≤ 2s; error rate ≤ 0.5%.
- API Mesh resolver 5xx ≤ 0.5%; p95 ≤ 500ms.
- Cart-total match rate = 100% (synthetic).
- Live Search query error rate ≤ 0.5%.

## Comms templates for Commerce SaaS

**Channels:** `#storefront-deploys`, `#storefront-oncall`,
`#adobe-commerce-status` (Adobe-side comms), `#customer-status`.

**Stakeholders:** storefront on-call, platform-integration lead,
EDS lead, Adobe Commerce support liaison, customer support.

## 2 worked runbook examples for Commerce SaaS

### Example 1 — "Drop-in bundle load failure rate 12%"

- **Symptom:** RUM shows `@dropins/storefront-cart` failing to hydrate on 12% of sessions after v3.2 deploy.
- **Quick diagnosis:**
  1. DevTools console on failing sessions — check the exception.
  2. Network tab → bundle URL — is it 404 / 500?
  3. `git log -p package.json | head` — drop-in version pin change last 24h?
  4. Catalog Service schema version — mismatch with drop-in schema?
  5. Storefront-events beacon — is it firing (may explain silent failures)?
- **Mitigation:** `npm i -E @dropins/storefront-cart@<lastGoodVersion>`;
  commit + push to EDS live branch; instant edge deploy; verify at 5 min via RUM.
- **Rollback trigger:** load failure rate > 5% after 15 min.
- **Escalation:** L1 platform-integration → L2 EDS lead if edge deploy blocked.

### Example 2 — "Catalog Service p95 latency > 800ms"

- **Symptom:** Catalog Service query p95 spiked from 180ms baseline to 850ms; error rate 0.8%.
- **Quick diagnosis:**
  1. Adobe Commerce status page.
  2. Sample query — `curl -sf https://catalog-service.adobe.io/graphql -d '{...}'`.
  3. Query complexity — did a recent PLP change introduce nested facets?
  4. IMS token freshness — some 5xx may be auth cascading.
  5. Storefront cache hit ratio — is CDN masking the backend spike?
- **Mitigation:** if Adobe confirms outage — no local action; disable heavy
  PLPs via feature flag; announce degraded browse in `#customer-status`;
  escalate to Adobe P1.
- **Rollback trigger:** p95 > 1s at 10 min.
- **Escalation:** L1 platform-integration → L2 tech lead → Adobe Commerce support.

## Anti-patterns for Commerce SaaS

- **Runbook says "restart the backend"** — SaaS-backed; no restart control.
- **Diagnosis relies on file-system logs** — no server-side logs to tail.
- **No Adobe status-page check as step 1** — 30%+ of Commerce SaaS
  incidents originate Adobe-side.
- **Missing drop-in version pin diff** — version drift is a top-3 root cause.
- **Verification uses backend synthetic only** — the surface is the
  browser (RUM); verify there.

---

Generate the full runbook using `templates/runbook.md` as the master,
populating placeholders with stack-appropriate content from the guide above.
