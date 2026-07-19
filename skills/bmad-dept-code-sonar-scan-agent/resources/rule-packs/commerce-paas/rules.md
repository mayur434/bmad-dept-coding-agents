# Sonar Rule Pack — Adobe Commerce PaaS (Magento 2)

Language: PHP. Applies to: Adobe Commerce PaaS (Magento 2) projects.
Severity mapping and rating model: see `../../shared/severity-and-rating-model.md`.

---

## Bug (Reliability)

### S2259 — Null / Object Not Found
**Severity:** HIGH | **ruleId:** `S2259`

`getById()`, `loadById()`, or `getExtensionAttributes()` can throw `NoSuchEntityException` or return null when the entity does not exist. Unchecked access causes fatal errors.

- ❌ Detect-Bad: `$product = $this->productRepository->getById($id); $sku = $product->getSku();` — no try/catch for `NoSuchEntityException`
- ✅ Detect-Good: `try { $product = $this->productRepository->getById($id); } catch (\Magento\Framework\Exception\NoSuchEntityException $e) { return null; }`
- **Remediation:** Wrap the repository call at the identified line in a try-catch for `NoSuchEntityException` and return a safe fallback.

### S1854 — Dead Code Assignment
**Severity:** LOW | **ruleId:** `S1854`

A variable is assigned a value that is never used before being overwritten or the function returns.

- **Remediation:** Remove the unused assignment at the identified line.

---

## Vulnerability (Security)

### S3649 — SQL Injection via Direct Query
**Severity:** CRITICAL | **ruleId:** `S3649`

User input concatenated directly into a raw SQL query or Magento DB adapter query. The Magento DB adapter's `query()` method accepts raw SQL.

- ❌ Detect-Bad: `$this->getConnection()->query("SELECT * FROM catalog_product_entity WHERE sku = '" . $sku . "'");`
- ✅ Detect-Good: `$this->getConnection()->fetchAll("SELECT * FROM catalog_product_entity WHERE sku = ?", [$sku]);`
- **Remediation:** Replace the concatenated query at line {line} with a parameterized form using `fetchAll()`, `fetchOne()`, or `quoteInto()`. Cite the specific SQL string and parameter.

### S2068 — Hardcoded Credentials / API Keys
**Severity:** CRITICAL | **ruleId:** `S2068`

Payment gateway API keys, third-party service secrets, or admin passwords stored as string literals in PHP source or committed `env.php`.

- ❌ Detect-Bad: `const API_KEY = 'sk_live_abc123xyz';` in a module class
- ✅ Detect-Good: Read from `$this->scopeConfig->getValue('payment/gateway/api_key', ScopeInterface::SCOPE_STORE);` which pulls from encrypted config.
- **Remediation:** Move the literal to Magento's encrypted config store via `bin/magento config:set --lock-env payment/gateway/api_key <value>` and read via `ScopeConfigInterface`. Rotate the credential.

### S5131 — XSS via Block Output
**Severity:** HIGH | **ruleId:** `S5131`

A Block `toHtml()` or ViewModel method outputs user-controlled data (request parameters or database values) without escaping.

- ❌ Detect-Bad: `echo $this->getData('user_name');` in a `.phtml` template
- ✅ Detect-Good: `echo $block->escapeHtml($this->getData('user_name'));`
- **Remediation:** Wrap the output at the identified line with `$block->escapeHtml()` (for HTML), `$block->escapeUrl()` (for URLs), or `$block->escapeJs()` (for JS contexts).

### S1313 — CSRF Missing on State-Changing Action
**Severity:** HIGH | **ruleId:** `S1313`

An Admin or Storefront controller `execute()` method that modifies data does not validate the form key or CSRF token.

- ❌ Detect-Bad: Admin controller `execute()` with no `$this->_formKeyValidator->validate($this->getRequest())` check
- ✅ Detect-Good: `if (!$this->_formKeyValidator->validate($this->getRequest())) { $this->messageManager->addError(...); return $this->_redirect('*/*/'); }`
- **Remediation:** Add form key validation at the top of `execute()` at the identified line before any state change.

---

## Security Hotspot

### S4507 — Object Manager Direct Usage
**Severity:** MEDIUM | **ruleId:** `S4507`

Direct use of `\Magento\Framework\App\ObjectManager::getInstance()` in business logic bypasses dependency injection, making the code untestable and hiding dependencies.

- **Review:** Confirm this is a factory/proxy/interceptor context where ObjectManager usage is legitimate. Otherwise, inject via constructor.

---

## Code Smell (Maintainability)

### S3776 — Cognitive Complexity
**Severity:** MEDIUM | **ruleId:** `S3776`

Plugin, Observer, or Model method with cognitive complexity exceeding 15. Common in payment gateway plugins and multi-step order processors.

- **Remediation:** State method name, file:line, current complexity. Extract nested validation or branching into private helper methods.

### S1192 — Duplicated String Literals
**Severity:** LOW | **ruleId:** `S1192`

Config path strings (e.g. `'catalog/frontend/flat_catalog_category'`), event names, or XML path segments repeated inline 5+ times.

- **Remediation:** Extract to a `const` in the module's `Config` class.

### S1066 — Collapsible If Statements
**Severity:** LOW | **ruleId:** `S1066`

Two consecutive `if` statements with the same body that can be collapsed.

- **Remediation:** Merge the conditions at the identified line pair.

---

## Duplication

### S1144 — Dead Private Methods
**Severity:** LOW | **ruleId:** `S1144`

Private PHP methods that are never called from the class (common after Plugin refactors).

- **Remediation:** Remove the dead method at the identified line.

---

## Complexity

### S138 — Methods with Too Many Lines
**Severity:** MEDIUM | **ruleId:** `S138`

PHP methods exceeding 80 lines — common in complex Product or Quote Repository implementations.

- **Remediation:** Extract sub-sections (data loading, validation, transformation, persistence) into private methods with descriptive names. Cite line ranges for each extracted block.
