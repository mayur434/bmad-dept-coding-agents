# Adobe Commerce UI Extensibility — Audit Rules

---

## Architecture Rules

---

### COMM-UIX-ARCH-001: Deprecated Application Config Type

- **Severity**: High
- **Description**: The Admin UI SDK requires the `extensions` configuration type with `commerce/backend-ui/1` extension point. Using the legacy `application` type is deprecated and will not work with the Admin UI SDK.

#### Detect — Files to Scan
```
app.config.yaml
```

#### Detect — Bad Pattern
```regex
^application:
```

Also flag if `commerce/backend-ui/1` is missing from `extensions:` block.

#### Detect — Good Pattern
```yaml
extensions:
  commerce/backend-ui/1:
    $include: src/commerce-backend-ui-1/ext.config.yaml
```

#### Bad Example
```yaml
application:
  runtimeManifest:
    packages:
      my-commerce-ext:
        actions:
          registration:
            function: actions/registration/index.js
```

#### Good Example
```yaml
extensions:
  commerce/backend-ui/1:
    $include: src/commerce-backend-ui-1/ext.config.yaml
```

---

### COMM-UIX-ARCH-002: Missing Extension Registration Component

- **Severity**: High
- **Description**: Commerce Admin UI extensions must include an `ExtensionRegistration` component that calls `register()` from `@adobe/uix-guest`. Without this, the extension cannot communicate with the Commerce Admin host.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*.js
src/**/web-src/src/**/*.jsx
```

#### Detect — Bad Pattern
No file containing `register({` from `@adobe/uix-guest` in the web-src directory.

#### Detect — Good Pattern
```javascript
import { register } from '@adobe/uix-guest';
// ...
await register({
  id: extensionId,
  methods: { /* extension point methods */ }
});
```

---

### COMM-UIX-ARCH-003: Mismatched Extension ID

- **Severity**: High
- **Description**: The `extensionId` used in `register()` must match the ID used in `attach()` calls within iFrame pages. A mismatch causes guest connection failures.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*.js
src/**/web-src/src/**/*.jsx
```

#### Detect — Bad Pattern
Different literal strings used in `register({ id: ... })` vs `attach({ id: ... })` across files.

#### Detect — Good Pattern
- Use a shared constant: `const extensionId = 'my-extension';`
- Reference the same constant in both `register()` and `attach()`

---

## Security Rules

---

### COMM-UIX-SEC-001: IMS Token Stored in Client State

- **Severity**: Critical
- **Description**: IMS tokens obtained from `sharedContext` must never be stored in `localStorage`, `sessionStorage`, cookies, or component state that persists beyond the current operation. Tokens should be retrieved fresh from `sharedContext` for each operation.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*.js
src/**/web-src/src/**/*.jsx
```

#### Detect — Bad Pattern
```regex
localStorage\.setItem\(.*token
sessionStorage\.setItem\(.*token
document\.cookie.*token
```

#### Detect — Good Pattern
```javascript
// Get token fresh for each API call
const token = await conn.sharedContext.get('imsToken');
```

---

### COMM-UIX-SEC-002: Hardcoded Commerce Base URL

- **Severity**: Medium
- **Description**: The Commerce base URL must not be hardcoded. It should be retrieved from `sharedContext.commerceBaseUrl` to ensure the extension works across all environments (dev, staging, production).

#### Detect — Files to Scan
```
src/**/web-src/src/**/*.js
src/**/web-src/src/**/*.jsx
```

#### Detect — Bad Pattern
```regex
https?://[a-z0-9.-]+\.(magento|commerce|adobe)\.(cloud|com|io)
fetch\(['"]https?://[^'"]+/rest/
fetch\(['"]https?://[^'"]+/graphql
```

#### Detect — Good Pattern
```javascript
const commerceBaseUrl = await conn.sharedContext.get('commerceBaseUrl');
const response = await fetch(`${commerceBaseUrl}/rest/V1/orders`, { ... });
```

---

### COMM-UIX-SEC-003: Missing Authorization in Backend Calls

- **Severity**: High
- **Description**: All API calls from the extension UI to Commerce REST/GraphQL APIs must include the IMS token in the Authorization header. Missing auth headers will result in unauthorized access errors.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*.js
src/**/web-src/src/**/*.jsx
```

#### Detect — Bad Pattern
```regex
fetch\([^)]*\)\s*;
fetch\([^,]+,\s*\{(?![\s\S]*Authorization)[\s\S]*?\}\)
```

#### Detect — Good Pattern
```javascript
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${imsToken}`,
    'Content-Type': 'application/json'
  }
});
```

---

## Extension Point Rules

---

### COMM-UIX-EXT-001: Mass Action Missing selectedIds Handling

- **Severity**: Medium
- **Description**: Mass action extensions must retrieve and validate `selectedIds` from `sharedContext`. Without this, the extension cannot know which entities the user selected.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*MassAction*.js
src/**/web-src/src/**/*MassAction*.jsx
src/**/web-src/src/**/*mass-action*.js
```

#### Detect — Bad Pattern
Mass action component files that don't call `conn.sharedContext.get('selectedIds')`.

#### Detect — Good Pattern
```javascript
const ids = await conn.sharedContext.get('selectedIds');
if (!ids || ids.length === 0) {
  // Handle empty selection
  return;
}
```

---

### COMM-UIX-EXT-002: Registration Action Returns Invalid Schema

- **Severity**: High
- **Description**: The registration runtime action must return a JSON response with the correct schema containing `registration` object with valid extension point arrays (`menus`, `pages`, `productMassActions`, etc.).

#### Detect — Files to Scan
```
src/**/actions/registration/index.js
actions/registration/index.js
```

#### Detect — Bad Pattern
Registration action that returns incorrect structure or missing `registration` wrapper:
```regex
body:\s*JSON\.stringify\(\{(?![\s\S]*registration)
```

#### Detect — Good Pattern
```javascript
return {
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    registration: {
      menus: [...],
      pages: [...],
      productMassActions: [...]
    }
  })
};
```

---

### COMM-UIX-EXT-003: Menu Item Missing Required Fields

- **Severity**: Medium
- **Description**: Menu extension point items must include `id`, `title`, and `parent` (referencing a valid Commerce Admin menu parent ID). Missing fields cause silent registration failures.

#### Detect — Files to Scan
```
src/**/actions/registration/index.js
src/**/web-src/src/**/ExtensionRegistration*.js
```

#### Detect — Bad Pattern
Menu items missing `parent` field:
```regex
menus:\s*\[[\s\S]*?\{(?![\s\S]*parent)[\s\S]*?\}
```

#### Detect — Good Pattern
```javascript
{
  id: 'my-menu-item',
  title: 'My Extension',
  parent: 'Magento_Backend::content',
  sortOrder: 100
}
```

---

## Performance Rules

---

### COMM-UIX-PERF-001: Large iFrame Without Lazy Loading

- **Severity**: Medium
- **Description**: Extension UI components rendered in iFrames should use code splitting and lazy loading to avoid slowing down Commerce Admin page load. All extension routes should be lazily imported.

#### Detect — Files to Scan
```
src/**/web-src/src/App.js
src/**/web-src/src/App.jsx
```

#### Detect — Bad Pattern
```regex
import\s+\w+\s+from\s+['"]\./components/(?!ExtensionRegistration)
```

Multiple synchronous imports of page components instead of lazy loading.

#### Detect — Good Pattern
```javascript
const CustomMenuPage = React.lazy(() => import('./components/CustomMenuPage'));
const MassAction = React.lazy(() => import('./components/MassAction'));
```

---

### COMM-UIX-PERF-002: Missing Error Boundary

- **Severity**: Medium
- **Description**: Extension UI components must be wrapped in React error boundaries. An unhandled error in an extension iFrame can cause the entire Admin panel section to fail.

#### Detect — Files to Scan
```
src/**/web-src/src/App.js
src/**/web-src/src/App.jsx
```

#### Detect — Bad Pattern
Routes rendered without an `ErrorBoundary` wrapper.

#### Detect — Good Pattern
```jsx
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary fallback={<div>Extension error</div>}>
  <Routes>
    <Route path="/" element={<ExtensionRegistration />} />
    <Route path="/custom-page" element={<CustomPage />} />
  </Routes>
</ErrorBoundary>
```

---

## Configuration Rules

---

### COMM-UIX-CONF-001: Registration Action Missing from Config

- **Severity**: High
- **Description**: The `ext.config.yaml` must declare a `registration` action that the Admin UI SDK calls to discover extension points. Without it, no extension points are registered.

#### Detect — Files to Scan
```
src/**/ext.config.yaml
```

#### Detect — Bad Pattern
`ext.config.yaml` without a `registration` action defined.

#### Detect — Good Pattern
```yaml
actions:
  registration:
    function: actions/registration/index.js
    web: 'yes'
    runtime: nodejs:18
    annotations:
      require-adobe-auth: false
      final: true
```

---

### COMM-UIX-CONF-002: Registration Action Has require-adobe-auth True

- **Severity**: Medium
- **Description**: The registration runtime action should have `require-adobe-auth: false` because it needs to be callable by the Commerce Admin UI SDK framework for extension discovery. Authentication is handled at a higher level by IMS.

#### Detect — Files to Scan
```
src/**/ext.config.yaml
app.config.yaml
```

#### Detect — Bad Pattern
```yaml
registration:
  # ...
  annotations:
    require-adobe-auth: true  # Blocks SDK from reading registration
```

#### Detect — Good Pattern
```yaml
registration:
  function: actions/registration/index.js
  web: 'yes'
  runtime: nodejs:18
  annotations:
    require-adobe-auth: false
    final: true
```
