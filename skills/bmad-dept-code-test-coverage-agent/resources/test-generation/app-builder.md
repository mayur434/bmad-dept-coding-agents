# Adobe App Builder — Test Generation (LLM, target 100% coverage)

Generate Jest unit tests that drive every Runtime action `main(params)`, API Mesh `resolve()`, and event/webhook handler with the `@adobe/aio-sdk` and global `fetch` fully mocked, exercising every branch to 100% coverage.

## Framework & dependencies

App Builder projects are Node/CommonJS, so tests are plain Jest — no compile step. Coverage is Jest's built-in Istanbul; the scaffold from `aio app init` already wires it.

| Package | Version | Role in tests |
|---|---|---|
| `jest` | `^29.7.0` | runner, assertions, coverage (Istanbul) |
| `@adobe/aio-sdk` | `^6.0.0` | `Core.Logger` / `State` / `Files` / `Events` — always `jest.mock`ed |
| `@adobe/aio-lib-state` | `^4.0.0` | re-exported as `State`; mock through the aio-sdk mock, not directly |
| `@adobe/aio-lib-files` | `^4.0.0` | re-exported as `Files`; same |
| Node engine | `18 / 20 / 22` | global `fetch` is built-in — mock `global.fetch`, do **not** add a polyfill |

`node-fetch` (`^2.6`) only appears in older scaffolds that `require('node-fetch')`; there you `jest.mock('node-fetch')` instead of touching `global.fetch`. Prefer global `fetch`.

Build wiring is npm. `package.json`:

```json
{
  "scripts": {
    "test": "jest --config test/jest.config.js",
    "e2e": "jest --config e2e/jest.config.js"
  }
}
```

`aio app test` invokes the same `test` script. Enforce the target with a hard threshold so generated suites fail CI until complete — `test/jest.config.js`:

```js
module.exports = {
  testEnvironment: 'node',
  testRegex: '/test/.*\\.test\\.js$',
  collectCoverage: true,
  collectCoverageFrom: ['actions/**/*.js', 'src/**/*.js', 'lib/**/*.js', 'resolvers/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/web-src/'],
  coverageThreshold: {
    global: { branches: 100, functions: 100, lines: 100, statements: 100 }
  }
}
```

Run a single unit while iterating: `npx jest test/actions/order-webhook.test.js --coverage`.

## Where tests go & naming

All unit specs live under `test/`, mirroring the source tree; end-to-end specs live under `e2e/`. One spec file per source unit.

```
actions/order-webhook/index.js      →  test/actions/order-webhook.test.js
src/dx-excshell-1/actions/generic/index.js
                                    →  test/actions/generic.test.js
lib/utils.js                        →  test/lib/utils.test.js
resolvers/inventory.js              →  test/resolvers/inventory.test.js
```

Rules the LLM must follow:
- File name is `<unit>.test.js` (the `testRegex` above requires the `.test.js` suffix).
- Never co-locate specs next to `index.js` — the scaffold globs `test/` only.
- Mesh resolvers go under `test/resolvers/`; the resolver module is `require`d directly (it is not a Runtime action).

## Test anatomy

Every action spec starts with the same three mock installs: the aio-sdk factory mock, a fresh mock logger, and a `global.fetch` stub. `jest.mock('@adobe/aio-sdk', factory)` is hoisted above the `require` of the unit under test, so the action picks up the mocked SDK.

```js
// test/actions/generic.test.js
const { Core, State } = require('@adobe/aio-sdk')

// Hoisted: replaces the real SDK before the action is loaded.
jest.mock('@adobe/aio-sdk', () => ({
  Core: { Logger: jest.fn() },
  State: { init: jest.fn() },
  Files: { init: jest.fn() }
}))

const { main } = require('../../src/dx-excshell-1/actions/generic/index')

let logger, state

beforeEach(() => {
  jest.clearAllMocks()
  logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
  Core.Logger.mockReturnValue(logger)               // action calls Core.Logger('name', {...})
  state = { get: jest.fn().mockResolvedValue(undefined), put: jest.fn().mockResolvedValue(undefined) }
  State.init.mockResolvedValue(state)               // action calls `await State.init()`
  global.fetch = jest.fn()                           // per-test resolved/rejected value
})

afterEach(() => { jest.restoreAllMocks() })
```

The project's shared `lib/utils.js` is used **real** (not mocked) so redaction and validation branches are exercised through the action. Generate it (or expect it) in this hardened form — note the secret redaction that makes the never-log-secrets assertion meaningful:

```js
// lib/utils.js
const SECRET_RE = /(secret|token|password|api[-_]?key|authorization)/i

function stringParameters (params) {
  const headers = { ...(params.__ow_headers || {}) }
  if (headers.authorization) headers.authorization = '<hidden>'
  if (headers['x-adobe-signature']) headers['x-adobe-signature'] = '<hidden>'
  const safe = { ...params, __ow_headers: headers }
  for (const k of Object.keys(safe)) {
    if (k !== '__ow_headers' && SECRET_RE.test(k)) safe[k] = '<hidden>'
  }
  return JSON.stringify(safe)
}

function errorResponse (statusCode, message, logger) {
  if (logger && typeof logger.info === 'function') logger.info(`${statusCode}: ${message}`)
  return { error: { statusCode, body: { error: message } } }
}

function checkMissingRequestInputs (params, requiredParams = [], requiredHeaders = []) {
  let errorMessage = null
  const missingParams = requiredParams.filter((p) => params[p] === undefined || params[p] === '' || params[p] === null)
  if (missingParams.length > 0) errorMessage = `missing parameter(s) '${missingParams.join(',')}'`
  const missingHeaders = requiredHeaders.filter(
    (h) => !params.__ow_headers || params.__ow_headers[h.toLowerCase()] === undefined || params.__ow_headers[h.toLowerCase()] === ''
  )
  if (missingHeaders.length > 0) {
    const hMsg = `missing header(s) '${missingHeaders.join(',')}'`
    errorMessage = errorMessage ? `${errorMessage} and ${hMsg}` : hMsg
  }
  return errorMessage
}

module.exports = { stringParameters, errorResponse, checkMissingRequestInputs }
```

Note the success/error result shapes differ: success is `{ statusCode, body }`; a client/server error returned via `errorResponse` is `{ error: { statusCode, body: { error } } }`. Assert `res.statusCode` on success and `res.error.statusCode` on failure — mixing them is the #1 cause of false-green tests.

## Reaching 100%

Apply this checklist to **each exported unit** (`main`, each mesh `resolve`, each handler). Private helpers (`verifySignature`, local formatters) are never imported directly — they are covered through the public caller by choosing inputs that drive each of their branches. If a private branch is unreachable from any public path, it is dead code: report it rather than exporting the helper just to test it.

For every unit:
- **One test per exported function**, then one test per branch/condition inside it.
- **Runtime action `main(params)` — the five mandatory cases:**
  - `200` happy path: all required params/headers present, downstream mock resolves, assert `res.statusCode === 200` and the body shape.
  - `400` missing-input: drop each required param and each required header (separate tests) → assert `res.error.statusCode === 400` and the message names the missing key; assert the downstream (`fetch`/SDK) was **not** called.
  - `500` downstream error: make the collaborator fail two ways — `fetch` resolves `{ ok: false }` **and** `fetch` rejects — both land in the `catch` → `res.error.statusCode === 500`, `logger.error` called.
  - **auth (`require-adobe-auth`)**: enforcement is at the Runtime gateway, so in-unit you assert the action's own gate — missing/empty `Authorization` (or `x-adobe-signature` for signature-authed webhooks) → `400`/`401`, and the token is read from `__ow_headers.authorization` not `process.env`.
  - **never-log-secrets**: run the happy path, flatten every `logger.*` mock call's args, assert the string contains **neither** the secret value **nor** the raw signature/token.
- **Mesh resolver `resolve(root, args, context, info)`:** happy path returns mapped data; assert it calls `context.<Source>.Query.<field>` with the derived args; error path where the source proxy rejects; empty/`null` `root` field (e.g. missing `sku`).
- **Event/webhook handler:** valid signature → `200`; invalid signature → `401` (cover both mismatch modes: wrong length and same-length-wrong-content, so both branches of the constant-time compare are hit); idempotent replay → State reports the id already seen → `200` with no re-processing and no second downstream call.
- **Boundary + null/empty:** `params.LOG_LEVEL` set vs unset (the `|| 'info'` branch), `__ow_body` present vs absent, empty arrays/objects, `state.get` truthy vs falsy.
- **Security-negative:** injection-shaped params must not reach the downstream unvalidated; secrets must never appear in a log or an error body returned to the caller.

Read the coverage report; any red branch names the exact input you still owe a test.

## Mocking strategy

| Collaborator | Strategy | How |
|---|---|---|
| `@adobe/aio-sdk` (`Core.Logger`, `State`, `Files`, `Events`) | **Mock** — hoisted factory | `jest.mock('@adobe/aio-sdk', () => ({ Core: { Logger: jest.fn() }, State: { init: jest.fn() }, Files: { init: jest.fn() } }))`, then `Core.Logger.mockReturnValue(logger)` and `State.init.mockResolvedValue(state)` in `beforeEach` |
| `aio-lib-*` clients (`@adobe/aio-lib-ims`, `-events`, `-analytics`) initialized via `X.init()` | **Mock** the module; `init` resolves a stub client whose methods are `jest.fn()` | `jest.mock('@adobe/aio-lib-events'); Events.init.mockResolvedValue({ publishEvent: jest.fn().mockResolvedValue({}) })` |
| HTTP downstream (`fetch`) | **Mock** `global.fetch` per test | `global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockResolvedValue({...}) })`; error: `.mockResolvedValue({ ok: false, status: 502 })` or `.mockRejectedValue(new Error(...))` |
| `lib/utils.js` (validation, redaction, `errorResponse`) | **Real** | do not mock — its branches are part of coverage and its redaction backs the never-log test |
| `crypto` (HMAC signature) | **Real** | compute the expected signature in the test with the same secret so the valid-signature path is genuinely exercised |
| Mesh `context` and source proxies | **Hand-built plain object** | `const context = { Commerce: { Query: { products: jest.fn().mockResolvedValue({ data: {...} }) } } }` — no SDK involved |

Never mock the unit under test, and never mock `lib/utils.js` — mocking the validator makes the 400/redaction branches vanish from coverage while reporting green.

Mesh resolver mock shape:

```js
const { resolvers } = require('../../resolvers/inventory')
const resolve = resolvers.Commerce_ProductInterface.externalInventory.resolve

test('maps external inventory for a sku', async () => {
  const context = { ExternalCatalog: { Query: { getInventory: jest.fn().mockResolvedValue({ data: { qty: 7 } }) } } }
  const out = await resolve({ sku: 'SKU-1' }, {}, context, {})
  expect(out).toEqual({ qty: 7 })
  expect(context.ExternalCatalog.Query.getInventory).toHaveBeenCalledWith(
    expect.objectContaining({ args: { sku: 'SKU-1' } })
  )
})

test('returns null when root has no sku', async () => {
  const context = { ExternalCatalog: { Query: { getInventory: jest.fn() } } }
  const out = await resolve({}, {}, context, {})
  expect(out).toBeNull()
  expect(context.ExternalCatalog.Query.getInventory).not.toHaveBeenCalled()
})
```

## Worked example

A signature-authenticated webhook action (Adobe Commerce → App Builder) that validates the HMAC signature, guards against replays with `State`, forwards to an ERP over `fetch`, and never logs the secret. `require-adobe-auth` is `false` for this action (external callers cannot send an IMS token) — its auth gate is the signature, which the tests drive directly.

### Source — `actions/order-webhook/index.js`

```js
const { Core, State } = require('@adobe/aio-sdk')
const crypto = require('crypto')
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../../lib/utils')

// Private: constant-time HMAC-SHA256 check over the raw body. Covered via main().
function verifySignature (rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  const provided = Buffer.from(signature, 'utf8')
  const expectedBuf = Buffer.from(expected, 'utf8')
  return provided.length === expectedBuf.length && crypto.timingSafeEqual(provided, expectedBuf)
}

async function main (params) {
  const logger = Core.Logger('order-webhook', { level: params.LOG_LEVEL || 'info' })
  try {
    logger.info('processing order webhook')
    logger.debug(stringParameters(params)) // redacted view — never the secret/signature

    const errorMessage = checkMissingRequestInputs(
      params,
      ['orderId', 'WEBHOOK_SECRET', 'ERP_ENDPOINT'],
      ['x-adobe-signature']
    )
    if (errorMessage) {
      return errorResponse(400, errorMessage, logger)
    }

    const signature = params.__ow_headers['x-adobe-signature']
    const rawBody = params.__ow_body || JSON.stringify({ orderId: params.orderId })
    if (!verifySignature(rawBody, signature, params.WEBHOOK_SECRET)) {
      return errorResponse(401, 'invalid signature', logger)
    }

    const state = await State.init()
    const dedupeKey = `order-${params.orderId}`
    if (await state.get(dedupeKey)) {
      logger.info(`duplicate event ${params.orderId} ignored`)
      return { statusCode: 200, body: { status: 'duplicate', orderId: params.orderId } }
    }

    const res = await fetch(`${params.ERP_ENDPOINT}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody
    })
    if (!res.ok) {
      throw new Error(`ERP responded ${res.status}`)
    }
    const erp = await res.json()

    await state.put(dedupeKey, 'processed', { ttl: 86400 })

    logger.info('200: order forwarded')
    return { statusCode: 200, body: { status: 'processed', orderId: params.orderId, erp } }
  } catch (error) {
    logger.error(error)
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
```

### Generated test — `test/actions/order-webhook.test.js`

```js
const crypto = require('crypto')
const { Core, State } = require('@adobe/aio-sdk')

jest.mock('@adobe/aio-sdk', () => ({
  Core: { Logger: jest.fn() },
  State: { init: jest.fn() }
}))

const { main } = require('../../actions/order-webhook/index')

const SECRET = 'whsec_test'
const sign = (body) => crypto.createHmac('sha256', SECRET).update(body).digest('base64')

let logger, state

const baseParams = (overrides = {}) => {
  const orderId = overrides.orderId ?? 'A-1001'
  const rawBody = overrides.__ow_body ?? JSON.stringify({ orderId })
  return {
    orderId,
    WEBHOOK_SECRET: SECRET,
    ERP_ENDPOINT: 'https://erp.example.com',
    __ow_body: rawBody,
    __ow_headers: { 'x-adobe-signature': sign(rawBody) },
    ...overrides
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
  Core.Logger.mockReturnValue(logger)
  state = { get: jest.fn().mockResolvedValue(undefined), put: jest.fn().mockResolvedValue(undefined) }
  State.init.mockResolvedValue(state)
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ erpId: 'E-9' })
  })
})

describe('order-webhook main', () => {
  test('200 — valid signature, first delivery is forwarded and marked processed', async () => {
    const res = await main(baseParams())
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ status: 'processed', orderId: 'A-1001', erp: { erpId: 'E-9' } })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://erp.example.com/orders',
      expect.objectContaining({ method: 'POST' })
    )
    expect(state.put).toHaveBeenCalledWith('order-A-1001', 'processed', { ttl: 86400 })
  })

  test('200 — idempotent replay: already-seen event is not re-forwarded', async () => {
    state.get.mockResolvedValue('processed')
    const res = await main(baseParams())
    expect(res.statusCode).toBe(200)
    expect(res.body.status).toBe('duplicate')
    expect(global.fetch).not.toHaveBeenCalled()
    expect(state.put).not.toHaveBeenCalled()
  })

  test('400 — missing required param (orderId)', async () => {
    const params = baseParams()
    delete params.orderId
    const res = await main(params)
    expect(res.error.statusCode).toBe(400)
    expect(res.error.body.error).toContain('orderId')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('400 — missing signature header', async () => {
    const params = baseParams()
    params.__ow_headers = {}
    const res = await main(params)
    expect(res.error.statusCode).toBe(400)
    expect(res.error.body.error).toContain('x-adobe-signature')
  })

  test('401 — signature wrong length (garbage header)', async () => {
    const params = baseParams()
    params.__ow_headers = { 'x-adobe-signature': 'nope' }
    const res = await main(params)
    expect(res.error.statusCode).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('401 — signature right length but wrong content', async () => {
    const params = baseParams()
    params.__ow_headers = { 'x-adobe-signature': Buffer.alloc(32).toString('base64') } // 44 chars, wrong
    const res = await main(params)
    expect(res.error.statusCode).toBe(401)
  })

  test('500 — downstream ERP returns non-2xx', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 502, json: jest.fn() })
    const res = await main(baseParams())
    expect(res.error.statusCode).toBe(500)
    expect(logger.error).toHaveBeenCalled()
    expect(state.put).not.toHaveBeenCalled()
  })

  test('500 — fetch rejects (network error)', async () => {
    global.fetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const res = await main(baseParams())
    expect(res.error.statusCode).toBe(500)
  })

  test('boundary — LOG_LEVEL=debug is honored', async () => {
    await main(baseParams({ LOG_LEVEL: 'debug' }))
    expect(Core.Logger).toHaveBeenCalledWith('order-webhook', { level: 'debug' })
  })

  test('boundary — falls back to info when LOG_LEVEL unset', async () => {
    await main(baseParams())
    expect(Core.Logger).toHaveBeenCalledWith('order-webhook', { level: 'info' })
  })

  test('boundary — derives body from orderId when __ow_body absent', async () => {
    const params = baseParams()
    delete params.__ow_body
    const derived = JSON.stringify({ orderId: params.orderId })
    params.__ow_headers = { 'x-adobe-signature': sign(derived) }
    const res = await main(params)
    expect(res.statusCode).toBe(200)
  })

  test('security — never logs the webhook secret or raw signature', async () => {
    await main(baseParams())
    const logged = [...logger.info.mock.calls, ...logger.debug.mock.calls].flat().join(' ')
    expect(logged).not.toContain(SECRET)
    expect(logged).not.toContain(baseParams().__ow_headers['x-adobe-signature'])
  })
})
```

Branch accounting: `LOG_LEVEL ||` (both tests) · `checkMissingRequestInputs` truthy (two 400 tests) / falsy (happy) · `verifySignature` length-mismatch / same-length-wrong / valid · `__ow_body ||` present/absent · `state.get` truthy/falsy · `res.ok` false/true · `catch` (two 500 tests) → **100% statements, branches, functions, lines**, including the private `verifySignature` reached only through `main`.

## Pitfalls

- **Asserting `res.statusCode` on an error result.** Failures return `{ error: { statusCode, body: { error } } }`, so `res.statusCode` is `undefined` and the test silently passes. Use `res.error.statusCode` for 4xx/5xx and `res.statusCode` only for 200.
- **`jest.mock('@adobe/aio-sdk')` placed below the action `require`, or forgetting `Core.Logger.mockReturnValue`.** The factory is hoisted, but if `Core.Logger` returns the default `undefined`, the action's first `logger.info` throws `TypeError` and every test reports a spurious 500. Set the return value in `beforeEach`.
- **`State.init`/`Files.init` return a promise.** They are `async` — use `mockResolvedValue(state)`, not `mockReturnValue(state)`, or `await State.init()` yields the mock object literally and `state.get` is undefined.
- **Reusing the same `global.fetch` mock across tests without `jest.clearAllMocks()`.** Call counts and a prior `mockRejectedValue` leak into the next test, flipping a 200 case to 500. Clear in `beforeEach` and re-establish the default resolved value there.
- **Signature tests that never exercise the real HMAC.** Hardcoding a fake `x-adobe-signature` only ever hits the 401 branch; compute it with `crypto.createHmac` and the same secret so the valid-signature 200 path is genuinely covered. Cover both invalid modes (wrong length and same-length-wrong) — a single garbage string short-circuits before `timingSafeEqual` and leaves that branch red.
- **Reading secrets from `process.env` in the action, or a `stringParameters` that only hides `authorization`.** Deployed Runtime has no `process.env` for inputs (they arrive in `params`), and a naive redactor leaks top-level secret params like `WEBHOOK_SECRET` into `logger.debug`, breaking the never-log-secrets test. Read from `params` and redact by key pattern.