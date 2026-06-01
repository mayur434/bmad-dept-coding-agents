# Adobe Commerce UI Extensibility — Code Generation Patterns

## Overview

Adobe Commerce Admin UI SDK enables App Builder developers to extend the Commerce Admin with custom menus, pages, mass actions, banners, and order view customizations. Uses the `commerce/backend-ui/1` extension point with React-based UI components rendered in iFrames.

All generated code must:
- Use the `commerce/backend-ui/1` extension point ID
- Implement proper IMS authentication via `sharedContext`
- Use `@adobe/uix-guest` for guest connection and context sharing
- Follow React Spectrum design system
- Register extension points via `ExtensionRegistration` component
- Use runtime actions for backend logic (registration action pattern)
- Never expose IMS tokens in client-side code or logs

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│  Adobe Commerce Admin                                             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  CommerceBackendUix Module (PHP)                            │  │
│  │  Allows out-of-process extensions to inject menus/pages     │  │
│  └─────────────┬───────────────────────────────────────────────┘  │
│                │                                                   │
│                ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  UIX React App (iFrame)                                     │  │
│  │  Renders custom Admin content                               │  │
│  └─────────────┬───────────────────────────────────────────────┘  │
│                │                                                   │
│                ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Adobe IMS Authentication                                   │  │
│  │  Secure communication between Commerce & App Builder app    │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Project Structure (Commerce UI Extension)

```
commerce-admin-ui-extension/
├── app.config.yaml                    → Master config with extension point
├── package.json                       → Dependencies (react, @adobe/uix-guest)
├── .aio                               → CLI config
├── .env                               → Environment variables
├── src/
│   └── commerce-backend-ui-1/
│       ├── ext.config.yaml            → Extension config
│       ├── actions/
│       │   └── registration/
│       │       └── index.js           → Registration runtime action
│       └── web-src/
│           ├── src/
│           │   ├── index.js           → Entry point
│           │   ├── App.js             → Router component
│           │   ├── components/
│           │   │   ├── ExtensionRegistration.js  → Extension point registration
│           │   │   ├── CustomMenu.js             → Custom menu page
│           │   │   ├── MassAction.js             → Mass action page
│           │   │   ├── OrderViewButton.js        → Order view extension
│           │   │   └── BannerNotification.js     → Banner notification
│           │   └── utils.js           → Shared utilities
│           └── index.html
├── test/                              → Unit tests
└── .github/
    └── workflows/                     → CI/CD
```

---

## Extension Point Registration

### `app.config.yaml`

```yaml
extensions:
  commerce/backend-ui/1:
    $include: src/commerce-backend-ui-1/ext.config.yaml
```

### `ext.config.yaml`

```yaml
operations:
  view:
    - type: web
      impl: index.html
actions:
  registration:
    function: actions/registration/index.js
    web: 'yes'
    runtime: nodejs:18
    inputs:
      LOG_LEVEL: debug
    annotations:
      require-adobe-auth: false
      final: true
web-src: web-src/
```

### Registration Runtime Action (`actions/registration/index.js`)

```javascript
async function main(params) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registration: {
        menus: [
          {
            id: 'custom-menu-example',
            title: 'My Custom Menu',
            parent: 'Magento_Backend::content',
            sortOrder: 100
          }
        ],
        pages: [
          {
            id: 'custom-page-example',
            title: 'My Custom Page',
            menuId: 'custom-menu-example'
          }
        ],
        productMassActions: [
          {
            id: 'product-mass-action-example',
            title: 'Export Selected Products',
            path: '#/product-mass-action'
          }
        ],
        orderMassActions: [
          {
            id: 'order-mass-action-example',
            title: 'Process Selected Orders',
            path: '#/order-mass-action'
          }
        ],
        orderViewButtons: [
          {
            id: 'order-view-button-example',
            title: 'Sync to ERP',
            path: '#/order-view-button'
          }
        ],
        bannerNotifications: [
          {
            id: 'banner-notification-example',
            title: 'System Update Available',
            content: 'A new version is available. Please update.',
            status: 'warning'
          }
        ]
      }
    })
  };
}

exports.main = main;
```

---

## Extension Registration Component

### `ExtensionRegistration.js`

```jsx
import { register } from '@adobe/uix-guest';

function ExtensionRegistration() {
  init().catch(console.error);
  return <></>;
}

const extensionId = 'my-commerce-extension';

async function init() {
  await register({
    id: extensionId,
    methods: {
      menu: {
        getItems() {
          return [
            {
              id: 'custom-menu',
              title: 'My Extension',
              parent: 'Magento_Backend::content',
              sortOrder: 100
            }
          ];
        }
      },
      page: {
        getTitle() {
          return 'My Extension Page';
        }
      },
      productMassAction: {
        getItems() {
          return [
            {
              id: 'export-products',
              title: 'Export Products',
              path: '#/export-products'
            }
          ];
        }
      },
      orderMassAction: {
        getItems() {
          return [
            {
              id: 'sync-orders',
              title: 'Sync Orders to ERP',
              path: '#/sync-orders'
            }
          ];
        }
      },
      orderViewButton: {
        getItems() {
          return [
            {
              id: 'view-in-erp',
              title: 'View in ERP',
              path: '#/view-in-erp'
            }
          ];
        }
      },
      bannerNotification: {
        getItems() {
          return [
            {
              id: 'update-notification',
              title: 'Extension Update',
              content: 'Version 2.0 available',
              status: 'info',
              dismissible: true
            }
          ];
        }
      }
    }
  });
}

export default ExtensionRegistration;
```

---

## Extension Point Patterns

### Custom Menu Page

```jsx
import React, { useEffect, useState } from 'react';
import { attach } from '@adobe/uix-guest';
import {
  Provider,
  defaultTheme,
  View,
  Heading,
  Content,
  TableView,
  TableHeader,
  TableBody,
  Column,
  Row,
  Cell
} from '@adobe/react-spectrum';

const extensionId = 'my-commerce-extension';

function CustomMenuPage() {
  const [connection, setConnection] = useState(null);
  const [imsToken, setImsToken] = useState('');
  const [imsOrgId, setImsOrgId] = useState('');

  useEffect(() => {
    const getConnection = async () => {
      const conn = await attach({ id: extensionId });
      setConnection(conn);

      const token = await conn.sharedContext.get('imsToken');
      const orgId = await conn.sharedContext.get('imsOrgId');
      setImsToken(token);
      setImsOrgId(orgId);
    };
    getConnection();
  }, []);

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View padding="size-200">
        <Heading level={1}>Custom Extension Page</Heading>
        <Content>
          {/* Your custom UI content */}
        </Content>
      </View>
    </Provider>
  );
}

export default CustomMenuPage;
```

### Mass Action Handler

```jsx
import React, { useEffect, useState } from 'react';
import { attach } from '@adobe/uix-guest';
import {
  Provider,
  defaultTheme,
  View,
  Heading,
  Well,
  Text,
  Button,
  ProgressCircle
} from '@adobe/react-spectrum';

const extensionId = 'my-commerce-extension';

function ProductMassAction() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [imsToken, setImsToken] = useState('');

  useEffect(() => {
    const init = async () => {
      const conn = await attach({ id: extensionId });

      const ids = await conn.sharedContext.get('selectedIds');
      const token = await conn.sharedContext.get('imsToken');
      setSelectedIds(ids || []);
      setImsToken(token);
    };
    init();
  }, []);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      // Call your backend action with selected IDs
      const response = await fetch('/api/v1/process-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${imsToken}`
        },
        body: JSON.stringify({ productIds: selectedIds })
      });
      const result = await response.json();
      console.log('Processed:', result);
    } catch (error) {
      console.error('Processing failed:', error);
    }
    setProcessing(false);
  };

  return (
    <Provider theme={defaultTheme}>
      <View padding="size-200">
        <Heading level={2}>Process Selected Products</Heading>
        <Well>
          <Text>Selected {selectedIds.length} product(s) for processing.</Text>
        </Well>
        <Button
          variant="cta"
          onPress={handleProcess}
          isDisabled={processing || selectedIds.length === 0}
        >
          {processing ? <ProgressCircle isIndeterminate size="S" /> : 'Process Products'}
        </Button>
      </View>
    </Provider>
  );
}

export default ProductMassAction;
```

### Order View Button Extension

```jsx
import React, { useEffect, useState } from 'react';
import { attach } from '@adobe/uix-guest';
import {
  Provider,
  defaultTheme,
  View,
  Heading,
  Content,
  Button,
  StatusLight
} from '@adobe/react-spectrum';

const extensionId = 'my-commerce-extension';

function OrderViewButton() {
  const [orderData, setOrderData] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');

  useEffect(() => {
    const init = async () => {
      const conn = await attach({ id: extensionId });
      const token = await conn.sharedContext.get('imsToken');
      const orgId = await conn.sharedContext.get('imsOrgId');
      // Fetch order details using token
    };
    init();
  }, []);

  const syncToERP = async () => {
    setSyncStatus('syncing');
    try {
      // Call backend action to sync order
      setSyncStatus('success');
    } catch (error) {
      setSyncStatus('error');
    }
  };

  return (
    <Provider theme={defaultTheme}>
      <View padding="size-200">
        <Heading level={2}>ERP Sync</Heading>
        <StatusLight variant={syncStatus === 'success' ? 'positive' : 'neutral'}>
          {syncStatus === 'success' ? 'Synced' : 'Not synced'}
        </StatusLight>
        <Button variant="primary" onPress={syncToERP}>
          Sync to ERP
        </Button>
      </View>
    </Provider>
  );
}

export default OrderViewButton;
```

---

## Shared Context Reference

### Mass Action Context

```javascript
const sharedContext = {
  selectedIds: [], // Array of selected entity IDs
  commerceBaseUrl: '', // Commerce instance base URL
  imsToken: '', // IMS token for authenticated user
  imsOrgId: '', // IMS organization ID
  clientId: '' // App Builder client ID
};
```

### Menu / Order View Context

```javascript
const sharedContext = {
  imsToken: '', // IMS token of logged-in Commerce user
  imsOrgId: '' // IMS organization ID
};
```

---

## Available Extension Points

| Extension Point | Description | Key Methods |
|----------------|-------------|-------------|
| `menu` | Add custom menu items to Commerce Admin navigation | `getItems()` |
| `page` | Add custom pages accessible from menus | `getTitle()` |
| `productMassAction` | Add mass actions to product grid | `getItems()` with `path` |
| `orderMassAction` | Add mass actions to order grid | `getItems()` with `path` |
| `customerMassAction` | Add mass actions to customer grid | `getItems()` with `path` |
| `orderViewButton` | Add buttons to order detail view | `getItems()` with `path` |
| `bannerNotification` | Display banners in Admin | `getItems()` with `status` |
| `product` | Extend product edit page | Product-specific methods |
| `customer` | Extend customer edit page | Customer-specific methods |

---

## Platform Detection Rules

| Signal in project | Indicates |
|-------------------|-----------|
| `commerce/backend-ui/1` in `app.config.yaml` | Commerce Admin UI Extension |
| `@adobe/uix-guest` in `package.json` | UI Extensibility project |
| `CommerceBackendUix` module in Commerce instance | Admin UI SDK installed |
| `ExtensionRegistration` component | UI extension registration |
| `attach()` from `@adobe/uix-guest` | Guest app using shared context |

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why | Correct Approach |
|-------------|-----|-----------------|
| Using `application` config type | Deprecated for Admin UI SDK | Use `extensions` with `commerce/backend-ui/1` |
| Hardcoding Commerce base URL | Breaks across environments | Get from `sharedContext.commerceBaseUrl` |
| Storing IMS tokens in localStorage | Security vulnerability | Use `sharedContext.get('imsToken')` per request |
| Missing `extensionId` in `attach()` | Connection fails | Always pass matching extension ID |
| Direct API calls without IMS auth | Unauthorized errors | Always include Bearer token from shared context |
| Large iFrame content without lazy loading | Poor Admin performance | Use code splitting and lazy loading |
| Skipping error boundaries | Crashes break entire Admin | Wrap extension UI in React error boundaries |

---

## Code Samples Reference

- GitHub: https://github.com/adobe/adobe-commerce-samples/tree/main/admin-ui-sdk
- Extension points docs: https://developer.adobe.com/commerce/extensibility/admin-ui-sdk/extension-points/
- App registration: https://developer.adobe.com/commerce/extensibility/admin-ui-sdk/app-registration
