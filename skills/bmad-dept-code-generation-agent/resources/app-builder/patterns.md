# Adobe App Builder / API Mesh — Code Generation Patterns

## Overview

Adobe App Builder code generation uses **LLM skills** + **MCP integration** via the Adobe Commerce App Builder MCP server. Generates production-ready serverless applications on Adobe I/O Runtime with React Spectrum UIs.

All generated code must:
- Follow JAMStack architecture (JavaScript, APIs, Markup)
- Use CommonJS syntax (ES Modules NOT supported by App Builder)
- Implement `require-adobe-auth` annotation for security
- Use Adobe I/O SDK libraries (`@adobe/aio-sdk`)
- Follow React Spectrum design system for UI components
- Never hardcode credentials — use `.env` and `app.config.yaml` inputs
- Include proper error handling with `@adobe/aio-lib-core-errors`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  BMAD Code Generation Agent (Adobe App Builder)             │
│                                                             │
│  ┌─────────────────┐  ┌──────────────────────────────────┐ │
│  │  MCP Server     │  │  LLM Skills                      │ │
│  │  (Commerce      │  │  (this file)                     │ │
│  │  App Builder)   │  │                                  │ │
│  │                 │  │  • Patterns & Architecture       │ │
│  │  • aio-app-dev  │  │  • Action templates              │ │
│  │  • aio-app-     │  │  • UI patterns (React Spectrum)  │ │
│  │    deploy       │  │  • Extension point patterns      │ │
│  │  • aio-login    │  │  • API Mesh configs              │ │
│  │  • aio-         │  │  • Security & auth               │ │
│  │    configure    │  │  • Testing patterns              │ │
│  └─────────────────┘  └──────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Generation Engine                                    │   │
│  │  Combines MCP + skills + scanned context → output     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure (App Builder)

```
my-app-builder-app/
├── app.config.yaml              → Master configuration (imports ext.config.yaml)
├── package.json                 → Project metadata and dependencies
├── .aio                         → CLI config (API services, org info)
├── .env                         → Environment variables (credentials, Runtime auth)
├── README.md                    → Project documentation
├── console.json                 → Developer Console workspace credentials
├── lib/                         → Shared utility actions across extensions
├── src/
│   └── dx-excshell-1/           → Experience Cloud Shell extension
│       ├── ext.config.yaml      → Extension-specific config
│       ├── actions/             → Serverless actions (Adobe I/O Runtime)
│       │   ├── generic/
│       │   │   └── index.js     → Generic action handler
│       │   └── <api-name>/
│       │       └── index.js     → API-specific action
│       └── web-src/             → Frontend SPA (React Spectrum)
│           ├── src/
│           │   ├── index.js     → App entry point
│           │   ├── App.js       → Main App component
│           │   └── components/  → React Spectrum components
│           └── index.html       → HTML shell
├── test/                        → Unit tests (Jest)
├── e2e/                         → End-to-end tests
└── .github/
    └── workflows/               → CI/CD GitHub Actions
        ├── deploy_prod.yml
        └── deploy_stage.yml
```

---

## Action Patterns

### Generic Serverless Action

```javascript
const { Core } = require('@adobe/aio-sdk');
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils');

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' });

  try {
    // 'info' is the default level if not set
    logger.info('Calling the main action');

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params));

    // check for missing request input parameters and headers
    const requiredParams = [];
    const requiredHeaders = ['Authorization'];
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders);
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger);
    }

    const response = {
      statusCode: 200,
      body: {
        message: 'Action executed successfully'
      }
    };

    logger.info(`${response.statusCode}: successful request`);
    return response;
  } catch (error) {
    // log any server errors
    logger.error(error);
    // return with 500
    return errorResponse(500, 'server error', logger);
  }
}

exports.main = main;
```

### Adobe API Integration Action

```javascript
const { Core, Analytics } = require('@adobe/aio-sdk');
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils');

async function main(params) {
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' });

  try {
    logger.info('Calling Adobe API action');
    logger.debug(stringParameters(params));

    const requiredParams = ['apiKey', 'companyId'];
    const requiredHeaders = ['Authorization', 'x-gw-ims-org-id'];
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders);
    if (errorMessage) {
      return errorResponse(400, errorMessage, logger);
    }

    // extract relevant parameters
    const { apiKey, companyId } = params;
    const token = params.__ow_headers['authorization'].replace('Bearer ', '');
    const orgId = params.__ow_headers['x-gw-ims-org-id'];

    // initialize the SDK client
    const analyticsClient = await Analytics.init(companyId, apiKey, token);

    // perform API call
    const result = await analyticsClient.getCollections({ limit: 5, page: 0 });

    return {
      statusCode: 200,
      body: result
    };
  } catch (error) {
    logger.error(error);
    return errorResponse(500, 'server error', logger);
  }
}

exports.main = main;
```

### I/O Events Publisher Action

```javascript
const { Core, Events } = require('@adobe/aio-sdk');
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils');

async function main(params) {
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' });

  try {
    logger.info('Publishing custom event');
    logger.debug(stringParameters(params));

    const requiredParams = ['apiKey', 'providerId', 'eventCode'];
    const requiredHeaders = ['Authorization', 'x-gw-ims-org-id'];
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders);
    if (errorMessage) {
      return errorResponse(400, errorMessage, logger);
    }

    const orgId = params.__ow_headers['x-gw-ims-org-id'];
    const token = params.__ow_headers['authorization'].replace('Bearer ', '');
    const { apiKey, providerId, eventCode } = params;

    // initialize Events SDK
    const eventsClient = await Events.init(orgId, apiKey, token);

    // publish event
    const event = {
      provider_id: providerId,
      event_code: eventCode,
      payload: params.payload || {}
    };
    const result = await eventsClient.publishEvent(event);

    return {
      statusCode: 200,
      body: { published: true, event: result }
    };
  } catch (error) {
    logger.error(error);
    return errorResponse(500, 'server error', logger);
  }
}

exports.main = main;
```

### Shared Utilities (`lib/utils.js`)

```javascript
/**
 * Returns a log-safe string of parameters (hides secrets)
 */
function stringParameters(params) {
  const hiddenKeys = ['authorization', 'Authorization', '__ow_headers'];
  const filtered = Object.keys(params)
    .filter(key => !hiddenKeys.includes(key))
    .reduce((obj, key) => {
      obj[key] = params[key];
      return obj;
    }, {});
  return JSON.stringify(filtered);
}

/**
 * Returns an error response object
 */
function errorResponse(statusCode, message, logger) {
  if (logger) logger.info(`${statusCode}: ${message}`);
  return {
    error: {
      statusCode,
      body: { error: message }
    }
  };
}

/**
 * Checks for missing parameters and headers
 */
function checkMissingRequestInputs(params, requiredParams = [], requiredHeaders = []) {
  let errorMessage = null;
  const missingParams = requiredParams.filter(p => !params[p]);
  if (missingParams.length > 0) {
    errorMessage = `missing parameter(s) '${missingParams.join(',')}'`;
  }

  const missingHeaders = requiredHeaders.filter(h =>
    !params.__ow_headers || !params.__ow_headers[h.toLowerCase()]
  );
  if (missingHeaders.length > 0) {
    const headerMsg = `missing header(s) '${missingHeaders.join(',')}'`;
    errorMessage = errorMessage ? `${errorMessage} and ${headerMsg}` : headerMsg;
  }

  return errorMessage;
}

module.exports = { stringParameters, errorResponse, checkMissingRequestInputs };
```

---

## Configuration Patterns

### `app.config.yaml` (Master Config)

```yaml
application:
  hostname: <custom-hostname>   # optional
  runtimeManifest:
    packages:
      my-app:
        license: Apache-2.0
        actions:
          generic:
            function: src/dx-excshell-1/actions/generic/index.js
            web: 'yes'
            runtime: nodejs:18
            inputs:
              LOG_LEVEL: debug
            annotations:
              require-adobe-auth: true
              final: true
extensions:
  dx/excshell/1:
    $include: src/dx-excshell-1/ext.config.yaml
```

### `ext.config.yaml` (Extension-Specific)

```yaml
operations:
  view:
    - type: web
      impl: index.html
actions:
  generic:
    function: actions/generic/index.js
    web: 'yes'
    runtime: nodejs:18
    inputs:
      LOG_LEVEL: debug
      SERVICE_API_KEY: $SERVICE_API_KEY
    annotations:
      require-adobe-auth: true
      final: true
web-src: web-src/
```

### `.env` Template

```bash
# Adobe I/O Runtime credentials
AIO_runtime_auth=<runtime-auth-key>
AIO_runtime_namespace=<runtime-namespace>

# Adobe IMS
SERVICE_API_KEY=<your-api-key>

# Logging
LOG_LEVEL=debug
```

---

## API Mesh Patterns

### Basic Mesh Configuration

```json
{
  "meshConfig": {
    "sources": [
      {
        "name": "Commerce",
        "handler": {
          "graphql": {
            "endpoint": "https://<commerce-instance>/graphql"
          }
        }
      },
      {
        "name": "ThirdPartyAPI",
        "handler": {
          "openapi": {
            "source": "https://api.example.com/openapi.json"
          }
        }
      }
    ]
  }
}
```

### Mesh with Multiple Sources and Transforms

```json
{
  "meshConfig": {
    "sources": [
      {
        "name": "CommerceGraphQL",
        "handler": {
          "graphql": {
            "endpoint": "https://<commerce-instance>/graphql",
            "operationHeaders": {
              "Authorization": "Bearer {context.headers['x-auth-token']}"
            }
          }
        },
        "transforms": [
          {
            "prefix": {
              "value": "Commerce_",
              "includeRootOperations": true
            }
          }
        ]
      },
      {
        "name": "LiveSearch",
        "handler": {
          "graphql": {
            "endpoint": "https://<commerce-instance>/search/graphql",
            "operationHeaders": {
              "Magento-Store-Code": "{context.headers['store']}"
            }
          }
        }
      },
      {
        "name": "ExternalCatalog",
        "handler": {
          "openapi": {
            "source": "https://catalog-api.example.com/v1/openapi.json",
            "operationHeaders": {
              "x-api-key": "{env.CATALOG_API_KEY}"
            }
          }
        }
      }
    ],
    "additionalResolvers": [
      {
        "targetTypeName": "Commerce_ProductInterface",
        "targetFieldName": "externalInventory",
        "sourceName": "ExternalCatalog",
        "sourceTypeName": "Query",
        "sourceFieldName": "getInventory",
        "requiredSelectionSet": "{ sku }",
        "sourceArgs": {
          "sku": "{root.sku}"
        }
      }
    ]
  }
}
```

### Mesh with Hooks (Request/Response Transformation)

```json
{
  "meshConfig": {
    "sources": [
      {
        "name": "Commerce",
        "handler": {
          "graphql": {
            "endpoint": "https://<commerce-instance>/graphql"
          }
        }
      }
    ],
    "responseConfig": {
      "headers": {
        "Cache-Control": "max-age=300, s-maxage=600"
      }
    },
    "plugins": [
      {
        "httpDetailsExtensions": true
      }
    ]
  }
}
```

### API Mesh CLI Commands

```bash
# Create a new mesh
aio api-mesh create mesh-config.json

# Update existing mesh
aio api-mesh update mesh-config.json

# Get mesh details
aio api-mesh get

# Delete mesh
aio api-mesh delete

# Describe mesh schema
aio api-mesh describe
```

---

## Frontend Patterns (React Spectrum)

### Main App Component

```jsx
import React from 'react';
import { Provider, defaultTheme, Grid, View } from '@adobe/react-spectrum';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import SideBar from './components/SideBar';
import MainView from './components/MainView';

function App(props) {
  return (
    <Router>
      <Provider theme={defaultTheme} colorScheme="light">
        <Grid
          areas={['sidebar content']}
          columns={['256px', '3fr']}
          rows={['auto']}
          height="100vh"
          gap="size-100"
        >
          <View gridArea="sidebar" padding="size-200">
            <SideBar />
          </View>
          <View gridArea="content" padding="size-200">
            <Routes>
              <Route path="/" element={<MainView />} />
            </Routes>
          </View>
        </Grid>
      </Provider>
    </Router>
  );
}

export default App;
```

### Action Invocation from Frontend

```jsx
import React, { useState } from 'react';
import { Button, ProgressCircle, Text } from '@adobe/react-spectrum';
import actions from '../config.json';
import actionWebInvoke from '../utils';

function ActionInvoker({ ims }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const invokeAction = async () => {
    setLoading(true);
    try {
      const headers = {
        Authorization: `Bearer ${ims.token}`,
        'x-gw-ims-org-id': ims.org
      };
      const response = await actionWebInvoke(
        actions['generic'],
        headers,
        {}
      );
      setResult(response);
    } catch (e) {
      console.error(e);
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <>
      <Button variant="cta" onPress={invokeAction}>
        Invoke Action
      </Button>
      {loading && <ProgressCircle aria-label="Loading…" isIndeterminate />}
      {result && <Text>{JSON.stringify(result)}</Text>}
    </>
  );
}

export default ActionInvoker;
```

---

## Testing Patterns

### Action Unit Test (Jest)

```javascript
const { main } = require('../../src/dx-excshell-1/actions/generic/index');

describe('generic action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 when missing Authorization header', async () => {
    const params = { __ow_headers: {} };
    const result = await main(params);
    expect(result.error.statusCode).toBe(400);
    expect(result.error.body.error).toContain('missing header');
  });

  test('returns 200 with valid request', async () => {
    const params = {
      __ow_headers: {
        authorization: 'Bearer test-token',
        'x-gw-ims-org-id': 'test-org@AdobeOrg'
      }
    };
    const result = await main(params);
    expect(result.statusCode).toBe(200);
  });
});
```

---

## CI/CD Patterns (GitHub Actions)

### Deploy to Production

```yaml
name: Deploy to Production
on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - uses: adobe/aio-cli-setup-action@1
        with:
          os: ubuntu
          version: 10.x.x
      - uses: adobe/aio-apps-action@3
        with:
          os: ubuntu
          command: deploy
        env:
          AIO_RUNTIME_AUTH: ${{ secrets.AIO_RUNTIME_AUTH_PROD }}
          AIO_RUNTIME_NAMESPACE: ${{ secrets.AIO_RUNTIME_NAMESPACE_PROD }}
          SERVICE_API_KEY: ${{ secrets.SERVICE_API_KEY }}
```

---

## Platform Detection Rules

| Signal in project | Platform |
|-------------------|----------|
| `app.config.yaml` present | App Builder |
| `ext.config.yaml` in `src/` subdirectory | App Builder Extension |
| `.aio` file present | App Builder |
| `@adobe/aio-sdk` in `package.json` | App Builder |
| `meshConfig` in JSON files | API Mesh |
| `aio api-mesh` references | API Mesh |
| `dx/excshell/1` in config | Experience Cloud Shell extension |
| `dx/asset-compute/worker/1` in config | Asset Compute Worker |
| `commerce/backend-ui/1` in config | Commerce Admin UI extension |

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why | Correct Approach |
|-------------|-----|-----------------|
| ES Module syntax (`import/export`) | Not supported by App Builder Runtime | Use CommonJS (`require/module.exports`) |
| Hardcoded credentials in action code | Security vulnerability | Use `.env` + `app.config.yaml` inputs |
| Relying on `process.env` in actions | Not available in deployed Runtime | Access via action `params` from config inputs |
| Missing `require-adobe-auth` annotation | Allows unauthenticated invocation | Always set to `true` for production |
| Direct file system access in actions | Serverless is stateless | Use `@adobe/aio-lib-files` SDK |
| Large action payloads (>1MB) | Runtime payload limits | Use Files SDK for large data |
| Synchronous blocking in actions | 60-second timeout | Use async/await, chain sequences |
| Skipping input validation | OWASP injection risks | Validate all params before processing |
