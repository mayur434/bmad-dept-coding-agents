# AEM UI Extensibility — Code Generation Patterns

## Overview

AEM UI Extensibility allows developers to build JavaScript extensions using Adobe App Builder that can be embedded in AEM applications running under Adobe Experience Cloud unified shell. Extensions enable customization of AEM Content Fragments Console, Content Fragments Editor, Universal Editor, AEM Experience Hub, and AEM Assets View.

All generated code must:
- Use Adobe App Builder framework with `@adobe/uix-guest` SDK
- Implement proper extension registration via `register()` from `@adobe/uix-guest`
- Follow React Spectrum design system for UI components
- Use `@adobe/exc-app` for Experience Cloud Shell integration
- Declare correct extension points in `app.config.yaml`
- Handle guest connection lifecycle properly
- Never store tokens client-side beyond the current session

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│  Adobe Experience Cloud Unified Shell                             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  AEM Host Application (CF Console / CF Editor / UE)         │  │
│  │  Defines extension points for 3rd-party customization       │  │
│  └─────────────┬───────────────────────────────────────────────┘  │
│                │ Two-way communication protocol                    │
│                ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  UI Extension (App Builder App)                             │  │
│  │  JavaScript app embedded in iFrame                          │  │
│  │  Renders additional visual blocks & invokes actions         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Extension Manager                                          │  │
│  │  Discover, enable/disable extensions per environment        │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Extensible AEM Services

| Service | Extension Point | Description |
|---------|----------------|-------------|
| AEM Content Fragments Console | `aem/cf-console-admin/1` | Action bar, header menu, grid columns |
| AEM Content Fragments Editor | `aem/cf-editor/1` | Header menu, rich text toolbar, field customization |
| Universal Editor | `aem/universal-editor/1` | Header menu, rail panels, custom fields |
| AEM Experience Hub | `aem/experience-hub/1` | Dashboard widgets, navigation items |
| AEM Assets View | `aem/assets-view/1` | Action bar, detail panel, asset actions |

---

## Project Structure (AEM UI Extension)

```
aem-ui-extension/
├── app.config.yaml                       → Master config with AEM extension point
├── package.json                          → Dependencies
├── .aio                                  → CLI config
├── .env                                  → Environment variables
├── src/
│   └── aem-cf-console-admin-1/           → Extension for CF Console
│       ├── ext.config.yaml               → Extension-specific config
│       ├── actions/                       → Backend serverless actions
│       │   └── generate-content/
│       │       └── index.js              → Action to generate AI content
│       └── web-src/
│           ├── src/
│           │   ├── index.js              → Entry point
│           │   ├── App.js                → Router
│           │   ├── components/
│           │   │   ├── ExtensionRegistration.js  → Registration
│           │   │   ├── ActionBarButton.js        → Custom action bar
│           │   │   ├── HeaderMenuButton.js       → Header menu item
│           │   │   └── CustomModal.js            → Modal dialog
│           │   └── utils.js
│           └── index.html
├── test/
└── .github/
    └── workflows/
```

---

## Extension Point Registration

### `app.config.yaml`

```yaml
extensions:
  aem/cf-console-admin/1:
    $include: src/aem-cf-console-admin-1/ext.config.yaml
```

### `ext.config.yaml`

```yaml
operations:
  view:
    - type: web
      impl: index.html
actions:
  generate-content:
    function: actions/generate-content/index.js
    web: 'yes'
    runtime: nodejs:18
    inputs:
      LOG_LEVEL: debug
      AEM_HOST: $AEM_HOST
    annotations:
      require-adobe-auth: true
      final: true
web-src: web-src/
```

---

## Content Fragments Console Extension Patterns

### Extension Registration (`ExtensionRegistration.js`)

```jsx
import { register } from '@adobe/uix-guest';

function ExtensionRegistration() {
  init().catch(console.error);
  return <></>;
}

const extensionId = 'my-aem-cf-extension';

async function init() {
  const guestConnection = await register({
    id: extensionId,
    methods: {
      // Action Bar extension
      actionBar: {
        getButtons() {
          return [
            {
              id: 'generate-content-btn',
              label: 'Generate Content',
              icon: 'PublishCheck',
              onClick: () => {
                // Open modal or trigger action
                const modal = guestConnection.host.modal;
                modal.showUrl({
                  title: 'Generate Content',
                  url: '/index.html#/generate-content-modal',
                  width: '600px',
                  height: '400px'
                });
              }
            }
          ];
        }
      },
      // Header Menu extension
      headerMenu: {
        getButtons() {
          return [
            {
              id: 'bulk-export-btn',
              label: 'Bulk Export',
              icon: 'Export',
              onClick: () => {
                console.log('Bulk export triggered');
              }
            }
          ];
        }
      }
    }
  });
}

export default ExtensionRegistration;
```

### Action Bar Button with Modal

```jsx
import React, { useEffect, useState } from 'react';
import { attach } from '@adobe/uix-guest';
import {
  Provider,
  defaultTheme,
  View,
  Heading,
  Button,
  TextArea,
  ProgressCircle,
  Flex
} from '@adobe/react-spectrum';

const extensionId = 'my-aem-cf-extension';

function GenerateContentModal() {
  const [connection, setConnection] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    const init = async () => {
      const conn = await attach({ id: extensionId });
      setConnection(conn);
    };
    init();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Get auth token from connection
      const token = connection?.sharedContext?.get('token');
      const aemHost = connection?.sharedContext?.get('aemHost');

      // Call backend action
      const response = await fetch('/api/v1/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, aemHost })
      });
      const data = await response.json();
      setResult(data.content);
    } catch (error) {
      console.error('Generation failed:', error);
    }
    setGenerating(false);
  };

  const handleClose = () => {
    connection?.host?.modal?.close();
  };

  return (
    <Provider theme={defaultTheme}>
      <View padding="size-200">
        <Heading level={2}>Generate Content with AI</Heading>
        <Flex direction="column" gap="size-200">
          <TextArea
            label="Prompt"
            value={prompt}
            onChange={setPrompt}
            width="100%"
          />
          <Flex gap="size-100">
            <Button variant="cta" onPress={handleGenerate} isDisabled={generating}>
              {generating ? <ProgressCircle size="S" isIndeterminate /> : 'Generate'}
            </Button>
            <Button variant="secondary" onPress={handleClose}>
              Close
            </Button>
          </Flex>
          {result && (
            <TextArea label="Generated Content" value={result} isReadOnly width="100%" />
          )}
        </Flex>
      </View>
    </Provider>
  );
}

export default GenerateContentModal;
```

---

## Content Fragments Editor Extension Patterns

### Rich Text Editor Toolbar Extension

```jsx
import { register } from '@adobe/uix-guest';

async function init() {
  const guestConnection = await register({
    id: 'my-rte-extension',
    methods: {
      rte: {
        getCustomButtons() {
          return [
            {
              id: 'insert-variable',
              tooltip: 'Insert Variable',
              icon: 'Code',
              onClick: (state) => {
                // Return modified RTE content
                return {
                  content: state.content + '{{variable_name}}'
                };
              }
            }
          ];
        }
      },
      headerMenu: {
        getButtons() {
          return [
            {
              id: 'validate-content',
              label: 'Validate',
              icon: 'CheckmarkCircle'
            }
          ];
        }
      }
    }
  });
}
```

---

## Universal Editor Extension Patterns

### Rail Panel Extension

```jsx
import { register } from '@adobe/uix-guest';

async function init() {
  const guestConnection = await register({
    id: 'my-ue-extension',
    methods: {
      rightPanel: {
        getPanels() {
          return [
            {
              id: 'seo-panel',
              title: 'SEO Analysis',
              icon: 'Search',
              url: '/index.html#/seo-panel'
            }
          ];
        }
      },
      headerMenu: {
        getButtons() {
          return [
            {
              id: 'publish-preview',
              label: 'Preview & Publish',
              icon: 'PublishCheck'
            }
          ];
        }
      }
    }
  });
}
```

### Custom Field Extension

```jsx
import React, { useEffect, useState } from 'react';
import { attach } from '@adobe/uix-guest';
import { Provider, defaultTheme, View, ComboBox, Item } from '@adobe/react-spectrum';

function CustomFieldExtension() {
  const [connection, setConnection] = useState(null);
  const [value, setValue] = useState('');
  const [options, setOptions] = useState([]);

  useEffect(() => {
    const init = async () => {
      const conn = await attach({ id: 'my-ue-extension' });
      setConnection(conn);

      // Get field value from host
      const fieldValue = await conn.host.field.getValue();
      setValue(fieldValue);

      // Load dynamic options
      const response = await fetch('/api/v1/get-options');
      const data = await response.json();
      setOptions(data.options);
    };
    init();
  }, []);

  const handleChange = async (selected) => {
    setValue(selected);
    // Update field value in host application
    await connection?.host?.field?.setValue(selected);
  };

  return (
    <Provider theme={defaultTheme}>
      <View padding="size-100">
        <ComboBox
          label="Select Category"
          selectedKey={value}
          onSelectionChange={handleChange}
        >
          {options.map(opt => (
            <Item key={opt.id}>{opt.label}</Item>
          ))}
        </ComboBox>
      </View>
    </Provider>
  );
}

export default CustomFieldExtension;
```

---

## AEM Experience Hub Extension Patterns

### Dashboard Widget

```jsx
import { register } from '@adobe/uix-guest';

async function init() {
  const guestConnection = await register({
    id: 'my-experience-hub-extension',
    methods: {
      dashboard: {
        getWidgets() {
          return [
            {
              id: 'content-health-widget',
              title: 'Content Health Score',
              size: 'medium',
              url: '/index.html#/content-health-widget'
            }
          ];
        }
      },
      navigation: {
        getItems() {
          return [
            {
              id: 'custom-reports',
              title: 'Custom Reports',
              icon: 'GraphBarVertical',
              url: '/index.html#/custom-reports'
            }
          ];
        }
      }
    }
  });
}
```

---

## Backend Action Pattern (AEM Integration)

```javascript
const { Core } = require('@adobe/aio-sdk');
const fetch = require('node-fetch');
const { errorResponse, checkMissingRequestInputs } = require('../utils');

async function main(params) {
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' });

  try {
    const requiredParams = ['aemHost', 'fragmentPath'];
    const requiredHeaders = ['Authorization'];
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders);
    if (errorMessage) {
      return errorResponse(400, errorMessage, logger);
    }

    const token = params.__ow_headers['authorization'];
    const { aemHost, fragmentPath } = params;

    // Fetch Content Fragment from AEM
    const cfResponse = await fetch(
      `${aemHost}/api/assets${fragmentPath}.json`,
      {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!cfResponse.ok) {
      return errorResponse(cfResponse.status, 'Failed to fetch content fragment', logger);
    }

    const cfData = await cfResponse.json();

    return {
      statusCode: 200,
      body: cfData
    };
  } catch (error) {
    logger.error(error);
    return errorResponse(500, 'server error', logger);
  }
}

exports.main = main;
```

---

## Platform Detection Rules

| Signal in project | Indicates |
|-------------------|-----------|
| `aem/cf-console-admin/1` in `app.config.yaml` | CF Console extension |
| `aem/cf-editor/1` in `app.config.yaml` | CF Editor extension |
| `aem/universal-editor/1` in `app.config.yaml` | Universal Editor extension |
| `aem/experience-hub/1` in `app.config.yaml` | Experience Hub extension |
| `aem/assets-view/1` in `app.config.yaml` | Assets View extension |
| `@adobe/uix-guest` in `package.json` | AEM UI extensibility project |
| `register()` from `@adobe/uix-guest` | Extension registration pattern |

---

## Local Development & Preview

```bash
# Start local development server
aio app dev

# Preview extension in AEM environment
# Navigate to AEM instance and append:
# ?ext=https://localhost:9080

# Deploy to workspace
aio app deploy

# Manage extensions via Extension Manager
# https://experience.adobe.com/#/aem/extension-manager
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why | Correct Approach |
|-------------|-----|-----------------|
| Not using `register()` on init | Extension won't connect to host | Always call `register()` immediately |
| Missing `extensionId` match | Guest connection fails | Ensure ID matches in `register()` and `attach()` |
| Blocking host UI thread | Degrades AEM performance | Use async operations, lazy loading |
| Ignoring modal size limits | UI overflow/clipping | Respect host-defined modal dimensions |
| Direct DOM manipulation of host | Breaks security isolation | Use provided APIs only (`host.modal`, `host.field`) |
| Not handling connection errors | Silent failures | Wrap `attach()`/`register()` in try-catch |
| Polling host for changes | Performance degradation | Use event-based communication protocol |
| ES Module syntax in actions | Not supported by Runtime | Use CommonJS (`require`/`exports`) |

---

## Documentation References

- UI Extensibility: https://developer.adobe.com/uix/docs/
- CF Console Extensions: https://developer.adobe.com/uix/docs/services/aem-cf-console-admin/
- CF Editor Extensions: https://developer.adobe.com/uix/docs/services/aem-cf-editor/
- Universal Editor Extensions: https://developer.adobe.com/uix/docs/services/aem-universal-editor/
- Extension Manager: https://developer.adobe.com/uix/docs/extension-manager/
- App Builder Extensions: https://developer.adobe.com/app-builder/docs/guides/app_builder_guides/extensions/extensions
