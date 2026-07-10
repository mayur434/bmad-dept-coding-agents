# Adobe App Builder / API Mesh — Audit Rules

> **Tier-1 scanner (new):** a deterministic tree-sitter JS/TS + config engine now exists at
> `scripts/engines/app-builder/` (auto-detected via `app.config.yaml` / `.aio` / `@adobe/aio-sdk`). It emits
> the standardized report and deterministically covers: **JS-SEC-001** (hardcoded secret), **JS-SEC-002**
> (eval / new Function), **JS-SEC-003** (command injection); **APPB-SEC-001** (`require-adobe-auth: false`),
> **APPB-SEC-002** (secret literal in `app.config.yaml`), **APPB-SEC-004** (logging `__ow_headers`/secret
> params), **APPB-SEC-005** (`.env` not gitignored); **APPB-MESH-001** (hardcoded auth in a mesh source),
> **APPB-MESH-002** (mesh with no depth/rate limiting); **APPB-EVT-001** (I/O Events/webhook consumer without
> HMAC signature verification), **APPB-EVT-002** (event handler with no idempotency/dedupe guard). The rules
> below are the **Tier-2 (semantic)** layer — apply them on top of the scanner output, especially for
> middleware/BFF business logic and UI-extensibility apps (see the `*-ui-extensibility-rules.md` packs).

---

## Architecture Rules

---

### APPB-ARCH-001: ES Module Syntax in Actions

- **Severity**: Critical
- **Description**: App Builder Runtime does NOT support ES Module syntax (`import`/`export`). Actions using ES modules will fail to deploy or execute. CommonJS (`require`/`module.exports`) is required.

#### Detect — Files to Scan
```
src/**/actions/**/*.js
actions/**/*.js
lib/**/*.js
```

#### Detect — Bad Pattern
```regex
^import\s+.*\s+from\s+['"]
^export\s+(default\s+)?
^export\s+\{
```

#### Detect — Good Pattern
- `const { Core } = require('@adobe/aio-sdk');`
- `module.exports = { main };`
- `exports.main = main;`

#### Bad Example
```javascript
import { Core } from '@adobe/aio-sdk';
import fetch from 'node-fetch';

export default async function main(params) {
  // This will FAIL on Adobe I/O Runtime
}
```

#### Good Example
```javascript
const { Core } = require('@adobe/aio-sdk');
const fetch = require('node-fetch');

async function main(params) {
  // CommonJS works on Adobe I/O Runtime
}

exports.main = main;
```

---

### APPB-ARCH-002: Direct process.env Access in Actions

- **Severity**: High
- **Description**: Action code must not rely on `process.env` for configuration values. In deployed Runtime, environment variables from `.env` are NOT available via `process.env`. Values must be declared as inputs in `ext.config.yaml`/`app.config.yaml` and accessed via the `params` argument.

#### Detect — Files to Scan
```
src/**/actions/**/*.js
actions/**/*.js
```

#### Detect — Bad Pattern
```regex
process\.env\.\w+
process\.env\[['"]
```

#### Detect — Good Pattern
- Access via `params.MY_CONFIG_VALUE`
- Declared as `inputs:` in `ext.config.yaml`
- `const { MY_KEY } = params;`

#### Bad Example
```javascript
async function main(params) {
  const apiKey = process.env.SERVICE_API_KEY; // undefined in deployed Runtime
  const host = process.env.AEM_HOST;
}
```

#### Good Example
```javascript
// ext.config.yaml declares: inputs: { SERVICE_API_KEY: $SERVICE_API_KEY }
async function main(params) {
  const { SERVICE_API_KEY, AEM_HOST } = params;
}
```

---

### APPB-ARCH-003: Hardcoded Credentials in Source

- **Severity**: Critical
- **Description**: Credentials, API keys, tokens, or secrets must never be hardcoded in action source code. Use `.env` file (excluded from version control) and reference via `$VARIABLE` in config.

#### Detect — Files to Scan
```
src/**/*.js
actions/**/*.js
lib/**/*.js
web-src/**/*.js
!node_modules/**
```

#### Detect — Bad Pattern
```regex
(api[_-]?key|apikey|secret|token|password|auth)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{16,}['"]
Bearer\s+[A-Za-z0-9._-]{20,}
```

#### Detect — Good Pattern
- `const token = params.__ow_headers['authorization'];`
- `SERVICE_API_KEY: $SERVICE_API_KEY` in config
- `.env` file with credentials (in `.gitignore`)

---

## Security Rules

---

### APPB-SEC-001: Missing require-adobe-auth Annotation

- **Severity**: Critical
- **Description**: All production actions must have `require-adobe-auth: true` annotation to enforce that a valid Adobe IMS token is required for invocation. Without this, actions are publicly accessible.

#### Detect — Files to Scan
```
app.config.yaml
src/**/ext.config.yaml
```

#### Detect — Bad Pattern
```regex
require-adobe-auth:\s*false
```

Also flag actions that are missing the annotation entirely (no `require-adobe-auth` under `annotations:`).

#### Detect — Good Pattern
```yaml
annotations:
  require-adobe-auth: true
  final: true
```

#### Bad Example
```yaml
actions:
  my-action:
    function: actions/my-action/index.js
    web: 'yes'
    runtime: nodejs:18
    annotations:
      require-adobe-auth: false  # INSECURE: publicly accessible
```

#### Good Example
```yaml
actions:
  my-action:
    function: actions/my-action/index.js
    web: 'yes'
    runtime: nodejs:18
    annotations:
      require-adobe-auth: true
      final: true
```

---

### APPB-SEC-002: Missing Input Validation

- **Severity**: High
- **Description**: All action inputs (params) must be validated before use. Missing validation can lead to injection attacks, unexpected errors, or data corruption.

#### Detect — Files to Scan
```
src/**/actions/**/*.js
actions/**/*.js
```

#### Detect — Bad Pattern
Actions that use `params` directly without calling `checkMissingRequestInputs` or equivalent validation:
```regex
async function main\(params\)\s*\{(?![\s\S]*checkMissing|[\s\S]*requiredParams|[\s\S]*validate)
```

#### Detect — Good Pattern
```javascript
const requiredParams = ['apiKey'];
const requiredHeaders = ['Authorization'];
const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders);
if (errorMessage) {
  return errorResponse(400, errorMessage, logger);
}
```

---

### APPB-SEC-003: Logging Sensitive Data

- **Severity**: High
- **Description**: Action logs must not contain tokens, credentials, or PII. Logger should filter sensitive headers and parameters before output.

#### Detect — Files to Scan
```
src/**/actions/**/*.js
actions/**/*.js
```

#### Detect — Bad Pattern
```regex
logger\.(info|debug|warn|error)\(.*params\)
logger\.(info|debug|warn|error)\(.*JSON\.stringify\(params\)\)
console\.log\(.*token
console\.log\(.*auth
```

#### Detect — Good Pattern
```javascript
logger.debug(stringParameters(params)); // stringParameters filters sensitive keys
```

---

## API Mesh Rules

---

### APPB-MESH-001: Missing Authentication in Mesh Sources

- **Severity**: High
- **Description**: API Mesh source endpoints that require authentication must use operation headers with context references or environment variables — never inline credentials.

#### Detect — Files to Scan
```
**/mesh*.json
**/api-mesh*.json
```

#### Detect — Bad Pattern
```regex
"Authorization":\s*"Bearer\s+[A-Za-z0-9._-]{20,}"
"x-api-key":\s*"[A-Za-z0-9]{10,}"
```

#### Detect — Good Pattern
```json
"operationHeaders": {
  "Authorization": "Bearer {context.headers['x-auth-token']}",
  "x-api-key": "{env.CATALOG_API_KEY}"
}
```

---

### APPB-MESH-002: Unrestricted GraphQL Depth

- **Severity**: Medium
- **Description**: API Mesh configurations should limit query depth to prevent denial-of-service via deeply nested queries when exposing GraphQL endpoints.

#### Detect — Files to Scan
```
**/mesh*.json
**/api-mesh*.json
```

#### Detect — Bad Pattern
Mesh config files that expose multiple GraphQL sources without `depthLimit` plugin.

#### Detect — Good Pattern
```json
{
  "plugins": [
    {
      "depthLimit": {
        "max": 10
      }
    }
  ]
}
```

---

## Performance Rules

---

### APPB-PERF-001: Action Payload Size Exceeds Limits

- **Severity**: Medium
- **Description**: Adobe I/O Runtime has a 1MB payload limit for action invocations. Actions processing large datasets must use the Files SDK (`@adobe/aio-lib-files`) instead of returning large response bodies.

#### Detect — Files to Scan
```
src/**/actions/**/*.js
actions/**/*.js
```

#### Detect — Bad Pattern
Actions that aggregate large datasets in memory and return them directly:
```regex
body:\s*\{[\s\S]*\.map\([\s\S]*\)[\s\S]*\}
JSON\.stringify\(.*allResults
```

#### Detect — Good Pattern
```javascript
const files = require('@adobe/aio-lib-files');
const fileClient = await files.init();
await fileClient.write('output/results.json', JSON.stringify(largeData));
return { statusCode: 200, body: { fileUrl: await fileClient.generatePresignURL('output/results.json') } };
```

---

### APPB-PERF-002: Missing Timeout Handling

- **Severity**: Medium
- **Description**: Adobe I/O Runtime actions have a 60-second default timeout. Long-running operations must implement timeout handling or be split into sequences/async patterns.

#### Detect — Files to Scan
```
src/**/actions/**/*.js
actions/**/*.js
```

#### Detect — Bad Pattern
Actions with multiple sequential API calls without timeout/abort handling:
```regex
await\s+fetch\([\s\S]*await\s+fetch\([\s\S]*await\s+fetch\(
```

#### Detect — Good Pattern
- Use `AbortController` with timeout
- Split into action sequences
- Use async activation pattern for long-running work

---

## Configuration Rules

---

### APPB-CONF-001: Credentials Committed to Version Control

- **Severity**: Critical
- **Description**: The `.env` file and `console.json` contain secrets and must NEVER be committed. Verify `.gitignore` includes them.

#### Detect — Files to Scan
```
.gitignore
```

#### Detect — Bad Pattern
`.gitignore` missing entries for `.env` or `console.json`.

#### Detect — Good Pattern
```
.env
console.json
.aio
```

---

### APPB-CONF-002: Missing Runtime Version Specification

- **Severity**: Low
- **Description**: Actions should explicitly declare `runtime: nodejs:18` (or latest supported). Missing runtime version may default to an older Node.js version.

#### Detect — Files to Scan
```
app.config.yaml
src/**/ext.config.yaml
```

#### Detect — Bad Pattern
```regex
function:.*\.js\n\s+web:.*\n(?!.*runtime:)
```

#### Detect — Good Pattern
```yaml
actions:
  my-action:
    function: actions/my-action/index.js
    web: 'yes'
    runtime: nodejs:18
```
