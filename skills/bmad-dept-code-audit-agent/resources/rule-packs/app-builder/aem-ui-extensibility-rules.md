# AEM UI Extensibility — Audit Rules

---

## Architecture Rules

---

### AEM-UIX-ARCH-001: Missing Extension Point Declaration

- **Severity**: Critical
- **Description**: AEM UI extensions must declare the correct extension point in `app.config.yaml`. Valid AEM extension points are: `aem/cf-console-admin/1`, `aem/cf-editor/1`, `aem/universal-editor/1`, `aem/experience-hub/1`, `aem/assets-view/1`. Missing or invalid declarations prevent the extension from loading.

#### Detect — Files to Scan
```
app.config.yaml
```

#### Detect — Bad Pattern
```regex
extensions:\s*\n\s+(?!aem/)
```

Also flag if using `dx/excshell/1` when the project intent is AEM UI extension.

#### Detect — Good Pattern
```yaml
extensions:
  aem/cf-console-admin/1:
    $include: src/aem-cf-console-admin-1/ext.config.yaml
```

---

### AEM-UIX-ARCH-002: Missing register() Call on Init

- **Severity**: Critical
- **Description**: The extension must call `register()` from `@adobe/uix-guest` immediately on initialization. This establishes the two-way communication channel between the extension and the AEM host application. Without it, the extension is invisible to AEM.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*Registration*.js
src/**/web-src/src/**/*Registration*.jsx
src/**/web-src/src/index.js
```

#### Detect — Bad Pattern
Registration component files that don't import or call `register`:
```regex
(?![\s\S]*import\s*\{\s*register\s*\}\s*from\s*['"]@adobe/uix-guest['"])
```

#### Detect — Good Pattern
```javascript
import { register } from '@adobe/uix-guest';

async function init() {
  await register({
    id: extensionId,
    methods: { /* ... */ }
  });
}
```

---

### AEM-UIX-ARCH-003: Mismatched Extension IDs Between register and attach

- **Severity**: High
- **Description**: The `id` used in `register()` (ExtensionRegistration) must exactly match the `id` used in `attach()` (modal/panel pages). A mismatch causes the guest connection to fail silently.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*.js
src/**/web-src/src/**/*.jsx
```

#### Detect — Bad Pattern
Different string literals in `register({ id: 'foo' })` and `attach({ id: 'bar' })`.

#### Detect — Good Pattern
```javascript
// constants.js
export const extensionId = 'my-aem-extension';

// ExtensionRegistration.js
import { extensionId } from './constants';
await register({ id: extensionId, ... });

// ModalPage.js
import { extensionId } from './constants';
const conn = await attach({ id: extensionId });
```

---

### AEM-UIX-ARCH-004: Direct DOM Manipulation of Host

- **Severity**: High
- **Description**: Extensions run in iFrames and must NEVER attempt to access or manipulate the host application's DOM. This violates the security isolation model and will fail due to cross-origin restrictions.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*.js
src/**/web-src/src/**/*.jsx
```

#### Detect — Bad Pattern
```regex
parent\.document
window\.parent\.document
top\.document
document\.querySelector\(['"]#aem-
window\.top\.
parent\.postMessage\((?!.*uix)
```

#### Detect — Good Pattern
- Use `guestConnection.host.modal` API for modals
- Use `guestConnection.host.field` API for field updates
- Use registered methods for all host communication

---

## Security Rules

---

### AEM-UIX-SEC-001: Token Exposure in Client-Side Code

- **Severity**: Critical
- **Description**: IMS/auth tokens obtained from the guest connection's shared context must not be logged, stored in state that persists, or exposed in URLs. They must only be used transiently for API calls.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*.js
src/**/web-src/src/**/*.jsx
```

#### Detect — Bad Pattern
```regex
console\.log\(.*token
console\.log\(.*imsToken
localStorage\.setItem\(.*token
window\.location.*token=
new URL\(.*token
```

#### Detect — Good Pattern
```javascript
// Token used transiently for single API call
const token = await conn.sharedContext.get('token');
const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

### AEM-UIX-SEC-002: Backend Action Without Auth Validation

- **Severity**: High
- **Description**: Backend actions called by AEM UI extensions must validate the Authorization header. Actions marked `require-adobe-auth: true` get framework-level validation, but custom actions handling their own auth must explicitly verify tokens.

#### Detect — Files to Scan
```
src/**/actions/**/*.js
actions/**/*.js
```

#### Detect — Bad Pattern
Actions without `require-adobe-auth: true` AND without manual token validation:
```regex
async function main\(params\)\s*\{(?![\s\S]*(require-adobe-auth|authorization|Authorization|checkMissing))
```

#### Detect — Good Pattern
```javascript
// Option 1: Use annotation (preferred)
// In ext.config.yaml: annotations: { require-adobe-auth: true }

// Option 2: Manual validation
const authHeader = params.__ow_headers['authorization'];
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return errorResponse(401, 'Unauthorized', logger);
}
```

---

### AEM-UIX-SEC-003: Unsanitized User Input in Modal URLs

- **Severity**: High
- **Description**: When using `modal.showUrl()`, the URL must not contain unsanitized user input. URL injection can lead to loading malicious content within the AEM Admin context.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*.js
src/**/web-src/src/**/*.jsx
```

#### Detect — Bad Pattern
```regex
modal\.showUrl\(\{[\s\S]*url:\s*`[^`]*\$\{(?!extensionId|EXTENSION_URL)
modal\.showUrl\(\{[\s\S]*url:\s*[^'"][^,}]*\+
```

#### Detect — Good Pattern
```javascript
// Use static URLs with extension's own routes
modal.showUrl({
  title: 'My Modal',
  url: '/index.html#/my-modal-page'
});
```

---

## Extension Point Rules

---

### AEM-UIX-EXT-001: Action Bar Buttons Missing Icon

- **Severity**: Low
- **Description**: Action bar buttons in CF Console extensions should include an `icon` property for consistent visual appearance with native AEM actions.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*Registration*.js
src/**/web-src/src/**/*Registration*.jsx
```

#### Detect — Bad Pattern
```regex
getButtons\(\)\s*\{[\s\S]*?return\s*\[[\s\S]*?\{(?![\s\S]*icon)[\s\S]*?\}
```

#### Detect — Good Pattern
```javascript
{
  id: 'my-button',
  label: 'My Action',
  icon: 'PublishCheck',  // Spectrum Workflow icon name
  onClick: () => { /* ... */ }
}
```

---

### AEM-UIX-EXT-002: Panel Extension Missing Size Declaration

- **Severity**: Low
- **Description**: Right panel/rail extensions in Universal Editor should declare explicit dimensions (width) to ensure consistent layout within the editor interface.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*Registration*.js
src/**/web-src/src/**/*Registration*.jsx
```

#### Detect — Bad Pattern
Panel registration without size hints in the panel declaration.

#### Detect — Good Pattern
```javascript
{
  id: 'seo-panel',
  title: 'SEO Analysis',
  icon: 'Search',
  url: '/index.html#/seo-panel',
  width: '300px'
}
```

---

### AEM-UIX-EXT-003: RTE Extension Modifying Content Without Sanitization

- **Severity**: High
- **Description**: Rich Text Editor toolbar extensions that modify content must sanitize the output. Injecting raw HTML from external sources or user input can introduce XSS vulnerabilities in Content Fragments.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*.js
src/**/web-src/src/**/*.jsx
```

#### Detect — Bad Pattern
```regex
onClick:\s*\(state\)\s*=>\s*\{[\s\S]*content:\s*state\.content\s*\+\s*(?!['"`])
innerHTML
dangerouslySetInnerHTML
```

#### Detect — Good Pattern
```javascript
onClick: (state) => {
  // Only insert safe, controlled content
  return {
    content: state.content + '<span class="variable">{{variable_name}}</span>'
  };
}
```

---

## Performance Rules

---

### AEM-UIX-PERF-001: Extension Blocks Host Initialization

- **Severity**: High
- **Description**: Extensions must not perform heavy synchronous operations during `register()` initialization. Blocking initialization degrades AEM page load performance for all users, even if the extension isn't visible.

#### Detect — Files to Scan
```
src/**/web-src/src/**/*Registration*.js
src/**/web-src/src/**/*Registration*.jsx
```

#### Detect — Bad Pattern
```regex
register\(\{[\s\S]*methods:\s*\{[\s\S]*await\s+fetch\(
register\(\{[\s\S]*methods:\s*\{[\s\S]*await\s+.*API
```

Heavy async operations inside `getButtons()` or `getItems()` method bodies.

#### Detect — Good Pattern
```javascript
// Registration methods return static data immediately
actionBar: {
  getButtons() {
    return [
      { id: 'btn', label: 'My Button', icon: 'Star' }
    ];
  }
}
// Heavy operations happen AFTER user interaction (onClick, modal open)
```

---

### AEM-UIX-PERF-002: Missing Lazy Loading for Modal Content

- **Severity**: Medium
- **Description**: Modal and panel content should use React lazy loading (`React.lazy` + `Suspense`). Loading all extension UI code eagerly slows down the initial extension registration.

#### Detect — Files to Scan
```
src/**/web-src/src/App.js
src/**/web-src/src/App.jsx
```

#### Detect — Bad Pattern
```regex
import\s+\w+\s+from\s+['"]\./components/(?!ExtensionRegistration)
```

#### Detect — Good Pattern
```javascript
const GenerateContentModal = React.lazy(() => import('./components/GenerateContentModal'));
const SEOPanel = React.lazy(() => import('./components/SEOPanel'));
```

---

## Configuration Rules

---

### AEM-UIX-CONF-001: Extension Not Discoverable by Extension Manager

- **Severity**: Medium
- **Description**: For AEM UI extensions to appear in the Extension Manager, they must be properly deployed and published via Adobe Developer Console. Verify that the extension uses the correct extension point name and is deployed to the correct workspace.

#### Detect — Files to Scan
```
app.config.yaml
src/**/ext.config.yaml
```

#### Detect — Bad Pattern
- Using non-standard extension point names
- Missing `operations.view` declaration

#### Detect — Good Pattern
```yaml
operations:
  view:
    - type: web
      impl: index.html
```

---

### AEM-UIX-CONF-002: AEM Host Not Configurable via Environment

- **Severity**: Medium
- **Description**: The AEM host URL used in backend actions must come from environment configuration (`$AEM_HOST` in config inputs), not be hardcoded. Extensions must work across Author, Publish, and different AEM environments.

#### Detect — Files to Scan
```
src/**/actions/**/*.js
actions/**/*.js
src/**/ext.config.yaml
```

#### Detect — Bad Pattern
```regex
https?://author-p\d+-e\d+\.adobeaemcloud\.com
https?://publish-p\d+-e\d+\.adobeaemcloud\.com
https?://.*\.adobeaemcloud\.com(?!.*\{)
```

#### Detect — Good Pattern
```yaml
# ext.config.yaml
inputs:
  AEM_HOST: $AEM_HOST
```
```javascript
// action code
const { AEM_HOST } = params;
const response = await fetch(`${AEM_HOST}/api/assets/...`);
```
