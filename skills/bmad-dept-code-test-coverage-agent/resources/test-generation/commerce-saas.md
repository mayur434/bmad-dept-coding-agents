# Adobe Commerce SaaS — Test Generation (LLM, target 100% coverage)

Generate Jest tests that fully exercise the two unit types in a Commerce-as-a-Cloud-Service storefront: Catalog Service / Live Search GraphQL query modules (`fetch` mocked) and `@dropins/*` `decorate()` blocks (jsdom + mocked event bus), covering every branch, error path, and boundary — and asserting no privileged token ever leaks client-side.

## Framework & dependencies

Pure npm project (no Maven/Gradle/composer — SaaS storefront is ESM JS, config, and App Builder actions). The source is native ES modules (`@dropins/*` are ESM-only), so Jest runs under the VM-modules flag and mocks with `jest.unstable_mockModule`.

`package.json`:

```json
{
  "type": "module",
  "scripts": {
    "test": "NODE_OPTIONS=--experimental-vm-modules jest --coverage"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "@jest/globals": "^29.7.0"
  }
}
```

`jest.config.js` — enforce 100% so a missed branch fails CI:

```js
export default {
  testEnvironment: 'node',            // per-file override to jsdom for blocks (docblock, below)
  testMatch: ['**/test/**/*.test.js', '**/*.test.js'],
  collectCoverageFrom: ['blocks/**/*.js', 'catalog-service/**/*.js', 'scripts/**/*.js', '!**/*.test.js'],
  coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
};
```

Because sources are ESM, no `transform`/babel is required. If the target repo compiles JSX or uses non-standard syntax, add `babel-jest` + `@babel/preset-env`; otherwise leave the transform empty (transforming to CJS breaks `jest.unstable_mockModule`).

## Where tests go & naming

Two accepted layouts (the coverage engine treats both as "tested"):

```
project/
├── catalog-service/
│   ├── product-search.js
│   └── product-search.test.js        ← co-located: <source>.test.js
├── blocks/
│   └── product-teaser/
│       └── product-teaser.js
└── test/                              ← or a mirrored test/ tree
    └── blocks/
        └── product-teaser.test.js
```

- One test file per source module, named `<source>.test.js`.
- A block `blocks/foo/foo.js` maps to `blocks/foo/foo.test.js` or `test/blocks/foo.test.js`.
- Block tests must carry an `@jest-environment jsdom` docblock; query-module tests stay on the default `node` environment (faster, no DOM needed).

## Test anatomy

**Catalog Service / Live Search query module** (`node` env). Mock config and `fetch`; never hit the network:

```js
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock the config source BEFORE importing the unit under test (ESM hoisting does not apply here).
const getConfigValue = jest.fn();
jest.unstable_mockModule('../scripts/configs.js', () => ({ getConfigValue }));

const { searchProducts } = await import('./product-search.js');

const okResponse = (data, errors) => ({
  ok: true, status: 200,
  json: async () => (errors ? { errors } : { data }),
});

beforeEach(() => {
  jest.clearAllMocks();
  getConfigValue.mockImplementation(async (k) => ({
    'commerce-environment-id': 'env-123',
    'commerce-store-view-code': 'default',
    'commerce-website-code': 'base',
    'commerce-x-api-key': 'PUBLIC-key-abc',   // public key only — never a private/admin token
  }[k]));
  global.fetch = jest.fn();
});
```

**Drop-in block** (`jsdom` env). Mock the event bus and the query module; render into a real DOM node:

```js
/** @jest-environment jsdom */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const events = { on: jest.fn(), emit: jest.fn() };
jest.unstable_mockModule('@dropins/tools/event-bus.js', () => ({ events }));

const searchProducts = jest.fn();
jest.unstable_mockModule('../../catalog-service/product-search.js', () => ({ searchProducts }));

const { default: decorate } = await import('../../blocks/product-teaser/product-teaser.js');

let block;
beforeEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
  block = document.createElement('div');
  block.className = 'product-teaser';
  document.body.append(block);
});
```

## Reaching 100%

Apply this checklist to **each** source unit; every item that exists in the source becomes at least one test:

- **One test per exported function / default `decorate`.** Every `export` (named or default) is invoked by name.
- **A case per branch/condition.** Each `if/else`, ternary, `??`/`||`/`&&` short-circuit, optional chain (`json.errors?.length`), and default-parameter (`pageSize = 12`) gets both outcomes — with and without the default, error array present and absent.
- **Every thrown / error path.** For query modules: `!res.ok` (assert the thrown message/status), a non-empty GraphQL `errors[]` (assert the joined message), and any guard `throw` (empty input). For blocks: the `catch` branch (rejected query → error class applied, no unhandled rejection).
- **Boundary + null/empty inputs.** Empty string, whitespace-only, `undefined`, empty `items: []`, `total_count: 0`. Assert the mapper returns `{ total: 0, items: [] }` rather than throwing.
- **Success mapping.** Assert the exact transformed shape (field renames like `productView.sku → sku`), not just "truthy".
- **Header/contract assertions.** Assert the outgoing request carries all four required headers — `Magento-Environment-Id`, `Magento-Store-View-Code`, `Magento-Website-Code`, `x-api-key` — sourced from config, plus `Content-Type: application/json` and `method: POST`.
- **Security-negative cases (required for this stack).** Assert the request headers contain **no** `Authorization` / `Bearer` / integration/admin token, that `x-api-key` equals the **public** config value, and that block source reads only public config keys. This encodes CSAAS-SEC-001 / CSAAS-CFG-001 as a test.
- **Event wiring (blocks).** Assert `events.on` is called with the expected event name (e.g. `'cart/updated'`) and that invoking the captured handler re-renders.
- **Private/helper functions** (query builders, mappers, DOM factories not exported) are covered **through their public callers** — never imported directly. If a private branch is unreachable via any public entry point, it is dead code: flag it, don't test it in isolation.

## Mocking strategy

| Concern | Approach |
| --- | --- |
| Storefront config (`scripts/configs.js` / `getConfigValue`) | **Mock** via `jest.unstable_mockModule`. Returns deterministic public values; lets you assert headers derive from config, not literals. |
| Network (`fetch`) | **Mock** `global.fetch = jest.fn()`. Never real network. Build `{ ok, status, json }` fixtures per case (success, `errors[]`, `ok:false`). |
| `@dropins/tools/event-bus.js` | **Mock** — replace `events.on`/`events.emit` with `jest.fn()`. Capture the handler passed to `on` and invoke it to test subscription behavior. |
| `@dropins/storefront-*` components / provider render | **Mock** the component's exported render/initializer as `jest.fn()`; assert it was mounted with the expected container + props. Do not import the real drop-in (pulls in its runtime + peer deps). |
| The query module, when testing a block | **Mock** it so block tests stay unit-scoped; the query module has its own test. |
| DOM (`document`, block element, `dataset`, `replaceChildren`) | **Real** — supplied by `jsdom`. Assert on real rendered nodes. |
| Pure mappers / transform helpers | **Real** — the point of the test; run genuine logic. |

Order matters under ESM: every `jest.unstable_mockModule(...)` must run **before** the `await import(...)` of the unit under test.

## Worked example

### Source unit A — Catalog Service query module

`catalog-service/product-search.js`:

```js
import { getConfigValue } from '../scripts/configs.js';

const CATALOG_SERVICE_ENDPOINT = 'https://catalog-service.adobe.io/graphql';
const PRODUCT_SEARCH_QUERY = `query ProductSearch($phrase: String!, $pageSize: Int!) {
  productSearch(phrase: $phrase, page_size: $pageSize) {
    total_count
    items { productView { sku name } }
  }
}`;

export async function searchProducts(phrase, pageSize = 12) {
  if (!phrase || !phrase.trim()) throw new Error('search phrase is required');

  const headers = {
    'Content-Type': 'application/json',
    'Magento-Environment-Id': await getConfigValue('commerce-environment-id'),
    'Magento-Store-View-Code': await getConfigValue('commerce-store-view-code'),
    'Magento-Website-Code': await getConfigValue('commerce-website-code'),
    'x-api-key': await getConfigValue('commerce-x-api-key'),
  };

  const res = await fetch(CATALOG_SERVICE_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: PRODUCT_SEARCH_QUERY, variables: { phrase, pageSize } }),
  });
  if (!res.ok) throw new Error(`Catalog Service HTTP ${res.status}`);

  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));

  const search = json.data.productSearch;
  return {
    total: search.total_count,
    items: search.items.map((i) => ({ sku: i.productView.sku, name: i.productView.name })),
  };
}
```

### Generated test A — `catalog-service/product-search.test.js`

```js
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const getConfigValue = jest.fn();
jest.unstable_mockModule('../scripts/configs.js', () => ({ getConfigValue }));

const { searchProducts } = await import('./product-search.js');

const ENDPOINT = 'https://catalog-service.adobe.io/graphql';
const okJson = (data, errors) => ({ ok: true, status: 200, json: async () => (errors ? { errors } : { data }) });
const oneItem = { productView: { sku: 'SKU-1', name: 'Widget' } };

beforeEach(() => {
  jest.clearAllMocks();
  getConfigValue.mockImplementation(async (k) => ({
    'commerce-environment-id': 'env-123',
    'commerce-store-view-code': 'default',
    'commerce-website-code': 'base',
    'commerce-x-api-key': 'PUBLIC-key-abc',
  }[k]));
  global.fetch = jest.fn();
});

describe('searchProducts', () => {
  // --- guard / boundary: null, empty, whitespace phrase ---
  test.each([[undefined], [''], ['   ']])('throws on missing phrase (%p)', async (phrase) => {
    await expect(searchProducts(phrase)).rejects.toThrow('search phrase is required');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // --- required headers sourced from config + POST + endpoint + default pageSize ---
  test('sends required Catalog Service headers from config and default pageSize', async () => {
    global.fetch.mockResolvedValue(okJson({ productSearch: { total_count: 0, items: [] } }));

    await searchProducts('shoes');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Magento-Environment-Id': 'env-123',
      'Magento-Store-View-Code': 'default',
      'Magento-Website-Code': 'base',
      'x-api-key': 'PUBLIC-key-abc',
    });
    expect(JSON.parse(init.body).variables).toEqual({ phrase: 'shoes', pageSize: 12 });
  });

  // --- security-negative: no privileged credential ever leaves the client ---
  test('never sends a private/admin credential; x-api-key is the public key', async () => {
    global.fetch.mockResolvedValue(okJson({ productSearch: { total_count: 0, items: [] } }));

    await searchProducts('shoes');

    const { headers } = global.fetch.mock.calls[0][1];
    expect(headers).not.toHaveProperty('Authorization');
    expect(Object.keys(headers)).not.toContain('authorization');
    expect(JSON.stringify(headers)).not.toMatch(/Bearer|integration[-_]?token|admin[-_]?token/i);
    expect(headers['x-api-key']).toBe('PUBLIC-key-abc');
  });

  // --- explicit pageSize passthrough (non-default branch of the default param) ---
  test('passes an explicit pageSize through to variables', async () => {
    global.fetch.mockResolvedValue(okJson({ productSearch: { total_count: 0, items: [] } }));
    await searchProducts('bags', 48);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).variables.pageSize).toBe(48);
  });

  // --- success mapping (field rename productView.sku/name -> sku/name) ---
  test('maps a successful response to { total, items }', async () => {
    global.fetch.mockResolvedValue(okJson({ productSearch: { total_count: 1, items: [oneItem] } }));
    await expect(searchProducts('widget')).resolves.toEqual({
      total: 1,
      items: [{ sku: 'SKU-1', name: 'Widget' }],
    });
  });

  // --- boundary: empty result set maps without throwing ---
  test('maps an empty result set to total 0 and []', async () => {
    global.fetch.mockResolvedValue(okJson({ productSearch: { total_count: 0, items: [] } }));
    await expect(searchProducts('nothing')).resolves.toEqual({ total: 0, items: [] });
  });

  // --- error path: HTTP !ok ---
  test('throws on a non-ok HTTP response', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(searchProducts('widget')).rejects.toThrow('Catalog Service HTTP 503');
  });

  // --- error path: GraphQL errors[] present (optional-chain truthy branch) ---
  test('throws the joined message when GraphQL returns errors[]', async () => {
    global.fetch.mockResolvedValue(
      okJson(null, [{ message: 'field not found' }, { message: 'phrase too short' }]),
    );
    await expect(searchProducts('x')).rejects.toThrow('field not found; phrase too short');
  });
});
```

This covers: 3 guard boundaries, both param-default branches, all four required headers, the security-negative assertion, success mapping, empty-set boundary, `!res.ok`, and the `errors[]` optional-chain branch — every statement and branch in the module.

### Source unit B — drop-in block

`blocks/product-teaser/product-teaser.js`:

```js
import { events } from '@dropins/tools/event-bus.js';
import { searchProducts } from '../../catalog-service/product-search.js';

export default async function decorate(block) {
  block.classList.add('product-teaser');
  const phrase = block.dataset.phrase || 'sale';
  const list = document.createElement('ul');
  list.className = 'product-teaser__list';
  block.replaceChildren(list);

  const render = (items) => list.replaceChildren(...items.map((p) => {
    const li = document.createElement('li');
    li.textContent = p.name;
    li.dataset.sku = p.sku;
    return li;
  }));

  try {
    const { items } = await searchProducts(phrase);
    render(items);
  } catch {
    block.classList.add('product-teaser--error');
  }

  events.on('cart/updated', () => {
    searchProducts(phrase).then(({ items }) => render(items)).catch(() => {});
  }, { eager: true });
}
```

### Generated test B — `blocks/product-teaser/product-teaser.test.js`

```js
/** @jest-environment jsdom */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const events = { on: jest.fn(), emit: jest.fn() };
jest.unstable_mockModule('@dropins/tools/event-bus.js', () => ({ events }));

const searchProducts = jest.fn();
jest.unstable_mockModule('../../catalog-service/product-search.js', () => ({ searchProducts }));

const { default: decorate } = await import('./product-teaser.js');

let block;
beforeEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
  block = document.createElement('div');
  document.body.append(block);
});

describe('product-teaser decorate()', () => {
  // --- default-phrase branch (dataset.phrase absent) + success render ---
  test('renders items from the default phrase and subscribes to cart/updated', async () => {
    searchProducts.mockResolvedValue({ items: [{ sku: 'S1', name: 'Alpha' }, { sku: 'S2', name: 'Beta' }] });

    await decorate(block);

    expect(searchProducts).toHaveBeenCalledWith('sale');       // default branch
    expect(block.classList.contains('product-teaser')).toBe(true);
    const lis = block.querySelectorAll('.product-teaser__list li');
    expect([...lis].map((li) => li.textContent)).toEqual(['Alpha', 'Beta']);
    expect(lis[0].dataset.sku).toBe('S1');
    expect(block.classList.contains('product-teaser--error')).toBe(false);
    expect(events.on).toHaveBeenCalledWith('cart/updated', expect.any(Function), { eager: true });
  });

  // --- authored-phrase branch (dataset.phrase present) ---
  test('uses the authored data-phrase when set', async () => {
    block.dataset.phrase = 'clearance';
    searchProducts.mockResolvedValue({ items: [] });
    await decorate(block);
    expect(searchProducts).toHaveBeenCalledWith('clearance');
  });

  // --- error branch: rejected query sets the error class, still subscribes ---
  test('adds the error class when the query rejects', async () => {
    searchProducts.mockRejectedValue(new Error('Catalog Service HTTP 500'));
    await decorate(block);
    expect(block.classList.contains('product-teaser--error')).toBe(true);
    expect(block.querySelectorAll('li')).toHaveLength(0);
    expect(events.on).toHaveBeenCalledTimes(1);      // subscription happens even after failure
  });

  // --- captured handler re-renders on cart/updated (event wiring) ---
  test('re-renders when the cart/updated handler fires', async () => {
    searchProducts.mockResolvedValue({ items: [{ sku: 'S1', name: 'Alpha' }] });
    await decorate(block);

    searchProducts.mockResolvedValue({ items: [{ sku: 'S9', name: 'Refreshed' }] });
    const handler = events.on.mock.calls[0][1];
    await handler();                                  // invoke the subscribed callback
    await Promise.resolve();                           // let the .then() microtask flush

    expect([...block.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Refreshed']);
  });

  // --- handler swallows a rejected refresh (catch branch) — no unhandled rejection ---
  test('cart/updated handler ignores a failed refresh', async () => {
    searchProducts.mockResolvedValue({ items: [{ sku: 'S1', name: 'Alpha' }] });
    await decorate(block);
    searchProducts.mockRejectedValue(new Error('boom'));
    const handler = events.on.mock.calls[0][1];
    await expect(Promise.resolve(handler())).resolves.toBeUndefined();
  });
});
```

## Pitfalls

- **Mock before dynamic import.** `jest.unstable_mockModule('@dropins/tools/event-bus.js', …)` must run *before* `await import('./block.js')`. Reverse the order and you test the real module. Unlike `jest.mock`, `unstable_mockModule` is **not** hoisted.
- **Forgetting the VM-modules flag.** Without `NODE_OPTIONS=--experimental-vm-modules`, Jest can't load the ESM sources or `@jest/globals`' `jest.unstable_mockModule`, and you get `Cannot use import statement outside a module` or `unstable_mockModule is not a function`. Keep it in the `test` script.
- **Adding a CJS transform.** Configuring `babel-jest` to compile sources to CommonJS makes `jest.unstable_mockModule` a no-op (the specifier is already resolved), so your event-bus/config mocks silently don't apply. Only transform if the syntax genuinely requires it, and mock with `jest.mock` in that case instead.
- **Wrong test environment.** A block test without the `/** @jest-environment jsdom */` docblock runs on `node`, where `document` is undefined and `decorate` throws `ReferenceError`. Query-module tests, conversely, should stay on `node` — don't pay for jsdom you don't use.
- **Not flushing async render.** `decorate` awaits `searchProducts` and the `cart/updated` handler kicks off a detached `.then()`. Assert only after `await decorate(...)` and, for handler-triggered re-renders, `await Promise.resolve()` (or `await handler()`), or you'll assert on stale/empty DOM.
- **Asserting header presence instead of absence for security.** `toMatchObject` on the required headers passes even if an `Authorization`/`Bearer` header is *also* present. The security-negative case must assert the private-token headers are **absent** and that `x-api-key` equals the public config value — otherwise a leaked credential (CSAAS-SEC-001) sails through a green suite.
- **Real drop-in / provider imports.** Importing an actual `@dropins/storefront-*` component (instead of mocking its render export) drags its runtime and peer deps into jsdom, causing slow, flaky, network-touching tests. Mock the component boundary and assert it was mounted with the expected container.
