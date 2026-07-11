# EDS + Commerce (drop-ins) — Test Generation (LLM, target 100% coverage)

Generate Jest + jsdom unit tests for EDS Commerce blocks by mocking `@dropins/*`, `scripts/configs.js`, and `fetch`, then driving `decorate(block)` and its exported helpers through every branch until statements/branches/functions/lines all hit 100%.

## Framework & dependencies

Storefront blocks are plain ES modules — there is no Maven/Gradle/composer. Test wiring is **npm + Jest + jsdom + Babel** (Babel transforms ESM `import` so `jest.mock()` hoisting and default-export interop work).

```jsonc
// package.json (devDependencies + scripts)
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "babel-jest": "^29.7.0",
    "@babel/core": "^7.24.0",
    "@babel/preset-env": "^7.24.0",
    "@testing-library/jest-dom": "^6.4.0"
  }
}
```

```js
// babel.config.cjs — transform ESM to CJS for the current Node (20)
module.exports = { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] };
```

```js
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEach: undefined,
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  transform: { '^.+\\.js$': 'babel-jest' },
  // aem.js/scripts.js are vendored framework — exclude, don't test them
  collectCoverageFrom: ['blocks/**/*.js', '!blocks/**/*.css'],
  coverageThreshold: {
    global: { branches: 100, functions: 100, lines: 100, statements: 100 },
  },
};
```

Run with `npm run test:coverage`; the `coverageThreshold` block fails CI if any block source drops below 100%.

## Where tests go & naming

Tests live under a top-level **`test/`** directory that mirrors the block path. One test file per source module, named `<module>.test.js`.

```
blocks/commerce-product-details/commerce-product-details.js   ← source
test/
  setup.js                                                    ← global jsdom setup
  __mocks__/dropins/…                                         ← optional shared @dropins stubs
  blocks/
    commerce-product-details/
      commerce-product-details.test.js                        ← test (mirrors source path)
```

Conventions: file suffix `*.test.js`; one top-level `describe('<source path>')` per file; nested `describe('<exportName>')` per exported unit; `it('...')` names state the branch under test (e.g. `it('rejects a sku with injection characters')`).

## Test anatomy

Required imports + the mock/setup boilerplate for this stack. Everything the block imports (`@dropins/*`, `scripts/configs.js`, `fetch`) is mocked; the DOM is real (jsdom).

```js
// test/setup.js — loaded via setupFilesAfterEnv
import '@testing-library/jest-dom'; // adds toHaveClass / toHaveTextContent matchers

beforeEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/'); // reset location.search between tests
  global.fetch = jest.fn();                 // every test opts into a fetch response
});

afterEach(() => jest.clearAllMocks());
```

```js
// top of every *.test.js
/** @jest-environment jsdom */
import { events } from '@dropins/tools/event-bus.js';
import provider from '@dropins/storefront-pdp/render.js';
import { getConfigValue } from '../../../scripts/configs.js';
import decorate, { getSkuParam, fetchProduct } from
  '../../../blocks/commerce-product-details/commerce-product-details.js';

// --- shared drop-in event bus: stateful stub, on()/emit() round-trip ---
jest.mock('@dropins/tools/event-bus.js', () => {
  const mockHandlers = new Map(); // `mock`-prefixed → allowed inside jest.mock factory
  return {
    events: {
      on: jest.fn((name, cb) => { mockHandlers.set(name, cb); return { off: jest.fn() }; }),
      emit: jest.fn((name, payload) => mockHandlers.get(name)?.(payload)),
    },
  };
});

// --- drop-in render provider: provider.render(Component, props)(element) ---
jest.mock('@dropins/storefront-pdp/render.js', () => ({
  __esModule: true,
  default: {
    render: jest.fn(() => async (el) => {
      const c = document.createElement('div');
      c.className = 'dropin-pdp'; // proxy for the real drop-in container mounting
      el.appendChild(c);
    }),
  },
}));
jest.mock('@dropins/storefront-pdp/containers/ProductDetails.js',
  () => ({ __esModule: true, default: 'ProductDetailsContainer' }));

// --- boilerplate config: never returns real secrets ---
jest.mock('../../../scripts/configs.js', () => ({ getConfigValue: jest.fn() }));

const okJson = (data) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data }) });
```

## Reaching 100%

Apply this checklist to **each exported unit** (every `export function`, every `export const`, and the `default` `decorate`). Module-local (non-exported) helpers are **not** targeted directly — they are covered transitively through the exported caller that reaches them; if a private helper has an unreachable branch, add a case to the public caller that forces it.

For every exported unit:

1. **One test per public unit** — at minimum a happy-path `it` for each named export and for `default decorate`.
2. **A case per branch/condition** — every `if/else`, ternary, `?.`, `??`, `&&`/`||` short-circuit, `switch` arm, and early `return` gets one test that takes it. `decorate`'s three exits (no sku → fetch error → null product → success) are four separate tests.
3. **Every thrown / error path** — `fetch` rejecting, `res.ok === false`, GraphQL `json.errors`, and the block's `try/catch` fallback DOM each get a test asserting the caught-error behavior (rendered message, no drop-in mount).
4. **Boundary + null/empty inputs** — missing `sku` param, empty string, max-length sku (64 chars) vs over-length (65), empty GraphQL `items: []`, `cart/updated` payload with `undefined` quantity. Assert the null/empty result, not a throw, unless a throw is intended.
5. **Security-negative cases (mandatory for this stack)** — (a) param validation: a `sku`/`category` containing injection chars (`"><script>`, `../`, GraphQL `"`) is rejected and never reaches `fetch` or the DOM; (b) **assert no admin/private token is sent client-side** — inspect `fetch.mock.calls[i][1].headers` and assert it carries only the public storefront credentials (`Magento-Environment-Id`, `Magento-Store-Code`) and contains **no** `Authorization`, bearer, or `admin`/integration-token header.
6. **Drop-in contract** — assert the container mounts (provider render invoked with the right container + props; mounted node present in `block`), and that a `cart/updated` `events.emit` updates the UI via the subscribed handler.

Verify by running `jest --coverage`; treat any red cell in the per-file table as a missing case from the list above.

## Mocking strategy

| Dependency | Mock or real | How |
|---|---|---|
| `@dropins/tools/event-bus.js` | **Mock** (stateful) | `on()` stores the handler, `emit()` invokes it — lets tests drive `cart/updated` and assert the UI reaction. |
| `@dropins/storefront-*/render.js` + `/containers/*` | **Mock** | Provider returns an async mounter that appends a sentinel node; assert it was called with the real container + props. Do not load the real drop-in (it pulls network/config). |
| `scripts/configs.js` (`getConfigValue`) | **Mock** | `mockResolvedValue` per key (endpoint, environment-id, store-code) — keeps secrets out of tests and lets you assert what the block requested. |
| `fetch` (GraphQL) | **Mock** | `global.fetch = jest.fn()`; return `{ ok, status, json }` shapes per case (success / not-ok / GraphQL errors / empty items). |
| DOM (`block`, `document`, `URLSearchParams`, `window.location`) | **Real (jsdom)** | Build `block` with `document.createElement('div')`; set params via `window.history.replaceState({}, '', '/p?sku=ABC')`. |
| The block's own pure helpers (`getSkuParam`, `fetchProduct`) | **Real** | Test directly; only their `fetch`/`config` edges are mocked. Never mock the unit under test. |

Shared `@dropins` stubs can be centralized in `test/__mocks__/dropins/…` and auto-applied via `moduleNameMapper`, but per-file `jest.mock()` (above) keeps each test self-contained and is preferred for generation.

## Worked example

**Source** — `blocks/commerce-product-details/commerce-product-details.js`:

```js
import { events } from '@dropins/tools/event-bus.js';
import provider from '@dropins/storefront-pdp/render.js';
import ProductDetails from '@dropins/storefront-pdp/containers/ProductDetails.js';
import { getConfigValue } from '../../scripts/configs.js';

const PARAM_RE = /^[A-Za-z0-9._-]{1,64}$/; // sku AND category ids validate against this
const PRODUCT_QUERY = 'query($sku:String!){products(filter:{sku:{eq:$sku}}){items{sku name}}}';

export function getSkuParam(search = window.location.search) {
  const sku = new URLSearchParams(search).get('sku');
  return sku && PARAM_RE.test(sku) ? sku : null;
}

export async function fetchProduct(sku, { endpoint, environmentId, storeCode }) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Magento-Environment-Id': environmentId, // public storefront credentials only
      'Magento-Store-Code': storeCode,
    },
    body: JSON.stringify({ query: PRODUCT_QUERY, variables: { sku } }),
  });
  if (!res.ok) throw new Error(`Catalog request failed: ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data?.products?.items?.[0] ?? null;
}

export default async function decorate(block) {
  block.classList.add('commerce-product-details');
  const sku = getSkuParam();
  if (!sku) { block.textContent = 'Product not found'; return; }

  const [endpoint, environmentId, storeCode] = await Promise.all([
    getConfigValue('commerce-endpoint'),
    getConfigValue('commerce-environment-id'),
    getConfigValue('commerce-store-code'),
  ]);

  let product;
  try {
    product = await fetchProduct(sku, { endpoint, environmentId, storeCode });
  } catch {
    block.textContent = 'Unable to load product';
    return;
  }
  if (!product) { block.textContent = 'Product not found'; return; }

  await provider.render(ProductDetails, { sku, product })(block);

  const badge = document.createElement('span');
  badge.className = 'cart-count';
  badge.textContent = '0';
  block.appendChild(badge);
  events.on('cart/updated', (data) => {
    badge.textContent = String(data?.totalQuantity ?? 0);
  }, { eager: true });
}
```

**Generated test** — `test/blocks/commerce-product-details/commerce-product-details.test.js` (achieves the full checklist; header/mocks from **Test anatomy** apply):

```js
/** @jest-environment jsdom */
import { events } from '@dropins/tools/event-bus.js';
import provider from '@dropins/storefront-pdp/render.js';
import { getConfigValue } from '../../../scripts/configs.js';
import decorate, { getSkuParam, fetchProduct } from
  '../../../blocks/commerce-product-details/commerce-product-details.js';

jest.mock('@dropins/tools/event-bus.js', () => {
  const mockHandlers = new Map();
  return {
    events: {
      on: jest.fn((name, cb) => { mockHandlers.set(name, cb); return { off: jest.fn() }; }),
      emit: jest.fn((name, payload) => mockHandlers.get(name)?.(payload)),
    },
  };
});
jest.mock('@dropins/storefront-pdp/render.js', () => ({
  __esModule: true,
  default: { render: jest.fn(() => async (el) => {
    const c = document.createElement('div'); c.className = 'dropin-pdp'; el.appendChild(c);
  }) },
}));
jest.mock('@dropins/storefront-pdp/containers/ProductDetails.js',
  () => ({ __esModule: true, default: 'ProductDetailsContainer' }));
jest.mock('../../../scripts/configs.js', () => ({ getConfigValue: jest.fn() }));

const setSearch = (s) => window.history.replaceState({}, '', `/p${s}`);
const configFor = (map) => getConfigValue.mockImplementation((k) => Promise.resolve(map[k]));

describe('blocks/commerce-product-details', () => {
  // ---------- getSkuParam: branches + boundary + security-negative ----------
  describe('getSkuParam', () => {
    it('returns a valid sku', () => expect(getSkuParam('?sku=ABC-123')).toBe('ABC-123'));
    it('returns null when sku is missing', () => expect(getSkuParam('?q=shoes')).toBeNull());
    it('returns null on an empty sku', () => expect(getSkuParam('?sku=')).toBeNull());
    it('accepts the 64-char boundary', () =>
      expect(getSkuParam(`?sku=${'a'.repeat(64)}`)).toBe('a'.repeat(64)));
    it('rejects over the 64-char boundary', () =>
      expect(getSkuParam(`?sku=${'a'.repeat(65)}`)).toBeNull());
    it('rejects an injection payload (security-negative)', () =>
      expect(getSkuParam('?sku=%22%3E%3Cscript%3E')).toBeNull()); // "><script>
    it('reads window.location.search by default', () => {
      setSearch('?sku=DEFAULT'); expect(getSkuParam()).toBe('DEFAULT');
    });
  });

  // ---------- fetchProduct: success + every error path + no admin token ----------
  describe('fetchProduct', () => {
    const cfg = { endpoint: 'https://catalog.example/graphql', environmentId: 'env-pub', storeCode: 'main' };

    it('returns the first product item on success', async () => {
      fetch.mockResolvedValue({ ok: true, status: 200,
        json: () => Promise.resolve({ data: { products: { items: [{ sku: 'X', name: 'Widget' }] } } }) });
      await expect(fetchProduct('X', cfg)).resolves.toEqual({ sku: 'X', name: 'Widget' });
    });
    it('returns null when items are empty', async () => {
      fetch.mockResolvedValue({ ok: true, status: 200,
        json: () => Promise.resolve({ data: { products: { items: [] } } }) });
      await expect(fetchProduct('X', cfg)).resolves.toBeNull();
    });
    it('throws on a non-ok HTTP status', async () => {
      fetch.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) });
      await expect(fetchProduct('X', cfg)).rejects.toThrow('Catalog request failed: 503');
    });
    it('throws on a GraphQL errors payload', async () => {
      fetch.mockResolvedValue({ ok: true, status: 200,
        json: () => Promise.resolve({ errors: [{ message: 'Unknown sku' }] }) });
      await expect(fetchProduct('X', cfg)).rejects.toThrow('Unknown sku');
    });
    it('sends only public storefront credentials, never an admin token (security-negative)', async () => {
      fetch.mockResolvedValue({ ok: true, status: 200,
        json: () => Promise.resolve({ data: { products: { items: [{ sku: 'X' }] } } }) });
      await fetchProduct('X', cfg);
      const { headers } = fetch.mock.calls[0][1];
      expect(headers['Magento-Environment-Id']).toBe('env-pub');
      expect(headers['Magento-Store-Code']).toBe('main');
      const keys = Object.keys(headers).map((k) => k.toLowerCase());
      expect(keys).not.toContain('authorization');
      expect(keys.some((k) => k.includes('admin') || k.includes('token'))).toBe(false);
    });
  });

  // ---------- decorate: 4 exits + drop-in mount + event-driven UI ----------
  describe('decorate', () => {
    const goodCfg = {
      'commerce-endpoint': 'https://catalog.example/graphql',
      'commerce-environment-id': 'env-pub',
      'commerce-store-code': 'main',
    };
    let block;
    beforeEach(() => { block = document.createElement('div'); document.body.appendChild(block); });

    it('renders "Product not found" and never fetches when sku is absent', async () => {
      setSearch('');
      await decorate(block);
      expect(block).toHaveClass('commerce-product-details');
      expect(block).toHaveTextContent('Product not found');
      expect(fetch).not.toHaveBeenCalled();
      expect(provider.render).not.toHaveBeenCalled();
    });

    it('shows a fallback when the catalog request fails', async () => {
      setSearch('?sku=ABC'); configFor(goodCfg);
      fetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) });
      await decorate(block);
      expect(block).toHaveTextContent('Unable to load product');
      expect(provider.render).not.toHaveBeenCalled();
    });

    it('renders "Product not found" when the product is null', async () => {
      setSearch('?sku=ABC'); configFor(goodCfg);
      fetch.mockResolvedValue({ ok: true, status: 200,
        json: () => Promise.resolve({ data: { products: { items: [] } } }) });
      await decorate(block);
      expect(block).toHaveTextContent('Product not found');
    });

    it('mounts the drop-in and updates the cart badge on cart/updated', async () => {
      setSearch('?sku=ABC'); configFor(goodCfg);
      fetch.mockResolvedValue({ ok: true, status: 200,
        json: () => Promise.resolve({ data: { products: { items: [{ sku: 'ABC', name: 'Widget' }] } } }) });

      await decorate(block);

      // drop-in container mounted with the right container + props
      expect(provider.render).toHaveBeenCalledWith('ProductDetailsContainer',
        { sku: 'ABC', product: { sku: 'ABC', name: 'Widget' } });
      expect(block.querySelector('.dropin-pdp')).not.toBeNull();

      // event bus subscribed and UI reacts
      const badge = block.querySelector('.cart-count');
      expect(badge).toHaveTextContent('0');
      events.emit('cart/updated', { totalQuantity: 3 });
      expect(badge).toHaveTextContent('3');
      events.emit('cart/updated', {}); // undefined quantity → nullish fallback branch
      expect(badge).toHaveTextContent('0');
    });
  });
});
```

## Pitfalls

1. **`jest.mock` factory scope.** Referencing an outer variable inside the `jest.mock('@dropins/...', () => …)` factory throws `ReferenceError: … out-of-scope`. Only names prefixed with `mock` (e.g. `mockHandlers`) are allowed — declare the handler map *inside* the factory.
2. **Default vs named export interop.** Drop-in `render.js` is consumed as a **default** import (`import provider from …`); its mock must set `__esModule: true` and a `default` key, or Babel interop yields `provider === undefined` and `provider.render` throws. Named-export modules (`event-bus.js` → `{ events }`) must return the named key.
3. **`decorate` is async — always `await` it.** Its drop-in mount and `Promise.all(getConfigValue…)` resolve on later microtasks. Asserting the mounted node or cart badge before `await decorate(block)` returns gives false failures; never assert synchronously after the call.
4. **jsdom `window.location` is read-only.** You cannot assign `window.location.search = …`. Use `window.history.replaceState({}, '', '/p?sku=ABC')` (reset in `beforeEach`) to control the params `getSkuParam()` reads; a leaked search string cross-contaminates later tests.
5. **The event bus is stateful across a test.** Because the mock stores one handler per event name, a second `decorate` on a fresh block overwrites the first handler — assert on the block you just decorated, and rely on `jest.clearAllMocks()` in `afterEach`. Also note the real bus's `{ eager: true }` **replays the last emit on subscribe**; if you assert eager replay, `emit` *before* calling `decorate` and have the mock invoke the handler immediately on `on()`.
6. **Coverage passes but the security case is missing.** 100% line coverage does not prove the no-admin-token and param-validation assertions ran — those are behavioral, not line-driven. Always include the header-inspection test and the injection-payload rejection test explicitly; a block can be fully "covered" while still leaking a token in a header the happy-path test never inspects.