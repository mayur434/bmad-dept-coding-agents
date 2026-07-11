# Adobe Edge Delivery Services (EDS / Helix / Franklin) — Test Generation (LLM, target 100% coverage)

Generate Jest + jsdom tests that drive every block `decorate()` and every exported helper to full statement/branch/function/line coverage, proving DOM output, class/attribute mutations, and that no URL/DOM input reaches `innerHTML`.

## Framework & dependencies

EDS projects are no-build, plain ES modules (`blocks/`, `scripts/`) — there is no Maven/Gradle/composer. Wire tests with **npm** and Jest. Blocks are native ESM that `import` framework helpers from `scripts/aem.js`, so add a Babel transform (ESM→CJS) so Jest can load them and so `jest.mock()` factory hoisting works.

`package.json` (devDependencies + scripts):
```json
{
  "type": "module",
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "babel-jest": "^29.7.0",
    "@babel/core": "^7.24.0",
    "@babel/preset-env": "^7.24.0"
  }
}
```

`babel.config.cjs` (CJS name so Babel loads it even under `"type":"module"`):
```js
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
```

`jest.config.cjs`:
```js
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/test'],
  testMatch: ['**/test/**/*.{test,spec}.{js,mjs}'],
  collectCoverageFrom: ['blocks/**/*.js', 'scripts/**/*.js'],
  coverageThreshold: { global: { statements: 100, branches: 100, functions: 100, lines: 100 } },
};
```

Node 18+. Run `npm ci && npm test`. The repo's coverage engine (`--engine eds`) discovers source as `blocks/**/*.js` + `scripts/**/*.js` and tests as `test/**/*.{test,spec}.{js,mjs}`.

> Native-ESM alternative (no Babel): run `NODE_OPTIONS=--experimental-vm-modules jest`, drop the transform, and replace `jest.mock` with `jest.unstable_mockModule('../scripts/aem.js', factory)` **before** a dynamic `const decorate = (await import('../blocks/x/x.js')).default`. The Babel path below is simpler and is what the worked example uses.

## Where tests go & naming

- All tests live in the project-root **`test/`** directory (flat is fine; sub-folders allowed by the glob).
- One test file per source module, named by the **source basename**: `<name>.test.js` (also accepted: `.spec.js`, `.test.mjs`, `.spec.mjs`).
  - `blocks/promo-cards/promo-cards.js` → `test/promo-cards.test.js`
  - `scripts/scripts.js` → `test/scripts.test.js`
- The basename **must** equal the source basename with `.(test|spec).(js|mjs)` stripped — the coverage engine maps `path.basename(source, '.js')` to `path.basename(test).replace(/\.(test|spec)\.(js|mjs)$/, '')`. `promo-cards.tests.js` or `promoCards.test.js` will be reported as *untested* even if it exercises the file.

## Test anatomy

`test/promo-cards.test.js` — required imports, module mock, DOM builder, and per-test reset:
```js
/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock the framework module the block imports. The specifier is resolved
// relative to THIS file; it must resolve to the same scripts/aem.js the block
// imports (blocks/*/*.js uses '../../scripts/aem.js'; test/ uses '../scripts/aem.js').
jest.mock('../scripts/aem.js', () => ({
  createOptimizedPicture: jest.fn((src, alt = '') => {
    const pic = document.createElement('picture');
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    pic.append(img);
    return pic;
  }),
  getMetadata: jest.fn(() => ''),
}));

import { createOptimizedPicture, getMetadata } from '../scripts/aem.js';
import decorate, { sanitizeParam, buildCard } from '../blocks/promo-cards/promo-cards.js';

// Build the authored block DOM exactly as EDS delivers it: block > row(div) > cell(div).
function buildBlock(...rowsHTML) {
  document.body.innerHTML = `<div class="promo-cards block">${rowsHTML.join('')}</div>`;
  return document.querySelector('.promo-cards');
}

beforeEach(() => {
  jest.clearAllMocks();
  getMetadata.mockReturnValue('');            // reset framework stub state
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');   // reset location.search between tests
});
```

Notes: jsdom is selected by the `@jest-environment jsdom` docblock (or globally via `testEnvironment`). Never mock `document`/`window` — use the real jsdom DOM and only stub the framework and network.

## Reaching 100%

Apply this checklist to **every** source unit (each exported helper and the default `decorate`):

- **One test per public export.** Every named `export function` gets at least one direct unit test; the `default export decorate(block)` gets DOM-in/DOM-out tests.
- **A case per branch/condition.** Cover both sides of every `if`, ternary, `switch`, and — because Istanbul counts them — every `||` / `&&` / `?.` short-circuit. A `a || b || c` fallback needs three tests (a truthy; a falsy+b truthy; a and b falsy).
- **`decorate` per authored-row variation.** Build the block DOM for each shape the source reads: full/normal row, link-only row, image row (asserts `createOptimizedPicture` call + resulting `<picture>`), text-only row, **plus empty block (zero rows)** and **malformed rows** (missing cell, empty cell, extra cells). Assert resulting markup, `classList`, and attributes, and that `block` was cleared/rebuilt.
- **Every error/throw path.** If a helper throws or a `try/catch`/`.catch()` handles a rejected `fetch`, assert both the happy path and the caught path (`await expect(...).rejects` or the fallback DOM).
- **Boundary + null/empty inputs.** Empty string, missing param, oversized input (assert truncation/slice limits), `0`/`NaN`, whitespace-only, and rows with `undefined` cells.
- **Security-negative (required for EDS).** Any value sourced from `window.location`, URL query params, `getMetadata`, or authored text that lands in the DOM must be asserted to be inserted as **text** (`textContent`/`createElement`/`createTextNode`), never `innerHTML`. Feed an XSS payload (`<img src=x onerror=alert(1)>`, `"><script>`) and assert **no live node/attribute** was created: `heading.querySelector('img')` is `null`, `heading.innerHTML` contains no `onerror`, and `document.querySelector('script,[onerror]')` is `null`.
- **Private (non-exported) helpers** are not imported or spied on directly — they are covered through the exported function or `decorate` that calls them. To make a stubborn internal branch reachable, choose block DOM / params that steer `decorate` down it, not white-box hacks.

## Mocking strategy

- **Mock `scripts/aem.js` (lib-franklin) — always.** Stub `createOptimizedPicture` (return a real `<picture>` element so `.append()` works and you can assert on it) and `getMetadata` (jest.fn you set per test). Stub any others the block imports the same way: `decorateIcons`, `toClassName`/`toCamelCase`, `readBlockConfig`, `fetchPlaceholders`, `loadCSS`, `loadFragment`. The real `createOptimizedPicture` reads `window.location` and builds `<source>` sets — mocking it keeps tests deterministic.
- **Use the real jsdom DOM.** Do not mock `document`, `Element`, `URLSearchParams`, or `URL` — the whole point is to assert on genuine DOM output.
- **Mock the network.** For blocks that `fetch`, set `global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => (...), text: async () => '...' })`; add a rejected/`ok:false` case for the error branch.
- **Set location via history, not assignment.** `window.location` can't be reassigned in jsdom; use `window.history.replaceState({}, '', '?category=shoes')` to control `location.search`, and reset it in `beforeEach`.
- **Polyfill missing browser APIs** used on the eager path: `window.IntersectionObserver`, `matchMedia`, `scrollTo` — assign jest.fn stubs in setup or `decorate` throws `ReferenceError` under jsdom.
- **eds-commerce blocks:** additionally mock `@dropins/tools/event-bus.js` (the `events` bus) and the configured GraphQL client; never let a test hit a live storefront endpoint. Do **not** mock the module under test.

## Worked example

**Source** — `blocks/promo-cards/promo-cards.js` (default `decorate` + two exported pure helpers; reads a URL param and authored rows; sanitizes before DOM insert):
```js
import { createOptimizedPicture, getMetadata } from '../../scripts/aem.js';

// Reduce a raw URL search string to a safe plain-text token — never HTML.
export function sanitizeParam(search, key) {
  const value = new URLSearchParams(search).get(key);
  if (!value) return '';
  return value.replace(/[^\w\s-]/g, '').trim().slice(0, 64);
}

// Turn one authored row (image cell | body cell) into a card <li>, or null if malformed.
export function buildCard(row) {
  const [imageCell, bodyCell] = row.children;
  if (!imageCell || !bodyCell) return null;
  const li = document.createElement('li');
  const img = imageCell.querySelector('img');
  if (img) {
    li.append(createOptimizedPicture(img.src, img.alt || '', false, [{ width: '400' }]));
  }
  const body = document.createElement('div');
  body.className = 'promo-cards-body';
  body.append(...bodyCell.childNodes);
  li.append(body);
  return li;
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const card = buildCard(row);
    if (card) ul.append(card);
  });

  const category = sanitizeParam(window.location.search, 'category');
  const heading = document.createElement('h2');
  heading.className = 'promo-cards-title';
  // Safe by construction: textContent, never innerHTML — location input is never HTML.
  heading.textContent = category || getMetadata('promo-title') || 'Featured';

  block.textContent = '';
  block.append(heading, ul);
  block.classList.add('promo-cards--decorated');
}
```

**Generated test** — `test/promo-cards.test.js` (achieves the full checklist: every export, every branch incl. both `||` operands, empty/malformed rows, boundary/truncation, and the security-negative case):
```js
/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

jest.mock('../scripts/aem.js', () => ({
  createOptimizedPicture: jest.fn((src, alt = '') => {
    const pic = document.createElement('picture');
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    pic.append(img);
    return pic;
  }),
  getMetadata: jest.fn(() => ''),
}));

import { createOptimizedPicture, getMetadata } from '../scripts/aem.js';
import decorate, { sanitizeParam, buildCard } from '../blocks/promo-cards/promo-cards.js';

const cardRow = (src = '/a.png', alt = 'A', text = 'Hi') =>
  `<div><div><img src="${src}" alt="${alt}"></div><div><p>${text}</p></div></div>`;

function buildBlock(...rowsHTML) {
  document.body.innerHTML = `<div class="promo-cards block">${rowsHTML.join('')}</div>`;
  return document.querySelector('.promo-cards');
}

beforeEach(() => {
  jest.clearAllMocks();
  getMetadata.mockReturnValue('');
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

describe('sanitizeParam', () => {
  test('returns the clean token for allowed characters', () => {
    expect(sanitizeParam('?category=Running Shoes-1', 'category')).toBe('Running Shoes-1');
  });

  test('strips HTML/special characters, leaving safe text', () => {
    const out = sanitizeParam('?category=<img src=x onerror=alert(1)>', 'category');
    expect(out).not.toMatch(/[<>=()]/);
    expect(out).not.toContain('onerror=');
  });

  test('returns empty string when the key is absent (null branch)', () => {
    expect(sanitizeParam('?other=1', 'category')).toBe('');
  });

  test('truncates to 64 characters (boundary)', () => {
    const out = sanitizeParam(`?category=${'a'.repeat(200)}`, 'category');
    expect(out).toHaveLength(64);
  });
});

describe('buildCard', () => {
  test('builds a card with an optimized picture and body from a full row', () => {
    const row = buildBlock(cardRow('/hero.png', 'Hero', 'Buy')).children[0];
    const li = buildCard(row);
    expect(li.tagName).toBe('LI');
    expect(li.querySelector('picture')).not.toBeNull();
    expect(li.querySelector('.promo-cards-body').textContent).toBe('Buy');
    expect(createOptimizedPicture).toHaveBeenCalledWith(
      expect.stringContaining('/hero.png'), 'Hero', false, [{ width: '400' }],
    );
  });

  test('returns null for a row with no cells (left operand of ||)', () => {
    const row = buildBlock('<div></div>').children[0];
    expect(buildCard(row)).toBeNull();
  });

  test('returns null for a row missing the body cell (right operand of ||)', () => {
    const row = buildBlock('<div><div><img src="/a.png"></div></div>').children[0];
    expect(buildCard(row)).toBeNull();
  });

  test('builds a card without a picture when the image cell has no img', () => {
    const row = buildBlock('<div><div></div><div><p>Text only</p></div></div>').children[0];
    const li = buildCard(row);
    expect(li.querySelector('picture')).toBeNull();
    expect(createOptimizedPicture).not.toHaveBeenCalled();
    expect(li.querySelector('.promo-cards-body').textContent).toBe('Text only');
  });
});

describe('decorate', () => {
  test('renders valid rows, skips malformed rows, clears + rebuilds block, adds class', () => {
    const block = buildBlock(cardRow(), '<div></div>', cardRow('/b.png', 'B', 'Two'));
    decorate(block);

    expect(block.classList.contains('promo-cards--decorated')).toBe(true);
    expect(block.querySelectorAll('ul > li')).toHaveLength(2); // malformed row dropped
    expect(block.querySelector('h2.promo-cards-title')).not.toBeNull();
    // block was cleared and rebuilt to exactly [h2, ul]
    expect([...block.children].map((c) => c.tagName)).toEqual(['H2', 'UL']);
  });

  test('handles an empty block (zero rows) with an empty list', () => {
    const block = buildBlock();
    decorate(block);
    expect(block.querySelectorAll('li')).toHaveLength(0);
    expect(block.querySelector('h2').textContent).toBe('Featured');
  });

  test('uses the sanitized URL category param and skips the metadata fallback', () => {
    window.history.replaceState({}, '', '?category=shoes');
    const block = buildBlock(cardRow());
    decorate(block);
    expect(block.querySelector('h2').textContent).toBe('shoes');
    expect(getMetadata).not.toHaveBeenCalled(); // || short-circuits
  });

  test('falls back to getMetadata when no category param', () => {
    getMetadata.mockReturnValue('Sale');
    const block = buildBlock(cardRow());
    decorate(block);
    expect(block.querySelector('h2').textContent).toBe('Sale');
  });

  test('falls back to the default title when param and metadata are empty', () => {
    const block = buildBlock(cardRow());
    decorate(block);
    expect(block.querySelector('h2').textContent).toBe('Featured');
  });

  test('security: XSS in the URL param is inserted as text, not live DOM', () => {
    window.history.replaceState({}, '', '?category=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
    const block = buildBlock(cardRow());
    decorate(block);
    const heading = block.querySelector('h2');
    expect(heading.querySelector('img')).toBeNull();
    expect(heading.innerHTML).not.toContain('onerror');
    expect(document.querySelector('img[onerror], script')).toBeNull();
  });
});
```

Every statement, function, and branch (both operands of each `||`, the `if (img)` split, the malformed-row skip, and all three title fallbacks) is exercised — `jest --coverage` reports 100/100/100/100 for `promo-cards.js`.

## Pitfalls

1. **Filename mismatch = "untested".** The coverage engine matches tests to source by basename. `test/promo-cards.test.js` is required; `promo-cards.tests.js`, `promoCards.spec.js`, or a file outside `test/` will run but be scored as a gap. Keep the basename identical to the source `.js`.
2. **ESM load failure.** EDS blocks are native ESM. Without the `babel-jest` transform (or `NODE_OPTIONS=--experimental-vm-modules`), Jest throws `Cannot use import statement outside a module`. And `jest.mock` is only hoisted above `import` by the Babel transform — under native ESM you must switch to `jest.unstable_mockModule` + a dynamic `await import()` of the block.
3. **Mock path must resolve to the same module.** `jest.mock('../scripts/aem.js', …)` from `test/` and the block's `import '../../scripts/aem.js'` from `blocks/x/` must resolve to one absolute file — otherwise the real framework loads (or resolution fails). If `scripts/aem.js` isn't present in the test project, add `{ virtual: true }` to the mock.
4. **jsdom has no browser runtime.** `IntersectionObserver`, `matchMedia`, `fetch`, `scrollTo`, and image `naturalWidth`/layout are `undefined`. A `decorate` that uses them on the eager path throws `ReferenceError` unless you polyfill/stub them in setup. This is why `createOptimizedPicture` (which reads `window.location` and image dims) is always mocked.
5. **Don't reassign `window.location`.** `window.location = …` throws `Not implemented: navigation` in jsdom. Drive `location.search` with `window.history.replaceState({}, '', '?k=v')` and reset it in `beforeEach`, or param state leaks between tests and the security test passes spuriously.
6. **`decorate` mutates `block` in place and moves nodes.** `block.append(...cell.childNodes)` relocates the authored nodes (assert on the destination, not the source cell), and `block.textContent = ''` wipes the input. Rebuild the block DOM fresh in each test (`document.body.innerHTML = ''` + `buildBlock`); reusing one fixture across two `decorate` calls double-decorates and corrupts row parsing.