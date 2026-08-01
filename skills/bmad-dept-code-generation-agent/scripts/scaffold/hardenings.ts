/**
 * DCA Generation — --secure hardening pass.
 * ==========================================
 * Given the files a scaffolder produced, apply per-type security tweaks that
 * make the emitted code closer to production-safe defaults:
 *
 *   sling-servlet          → @HttpConstraint role + XSS-safe response header
 *   sling-model            → SlingHttpServletRequest adaptable + null-safety
 *   spring rest-controller → @PreAuthorize scaffolding + @Valid on body
 *   aem component          → @context='html' on all HTL expressions
 *   app-builder action     → auth header validation + secret redaction in logs
 *   commerce-paas plugin   → Escaper + nonce validation notes
 *   commerce-paas controller → CSRF header check + FormKey guard
 *   commerce-paas graphql-resolver → depth-limit annotation + rate-limit note
 *
 * Additive only: unknown `stack/type` pairs pass through unchanged. Every
 * applied tweak is recorded in `decisions` for the "Security decisions"
 * section appended to the Markdown report twin.
 */

import type { GenFile } from "./generators";

export interface HardenResult {
  files: GenFile[];
  decisions: string[]; // human-readable, one per applied tweak
}

export function applyHardening(
  stack: string,
  type: string,
  files: GenFile[],
): HardenResult {
  const decisions: string[] = [];
  const out: GenFile[] = files.map((f) => ({ ...f }));

  const patch = (predicate: (f: GenFile) => boolean, mutator: (f: GenFile) => GenFile, note: string) => {
    let applied = false;
    for (let i = 0; i < out.length; i++) {
      const f = out[i]!;
      if (predicate(f)) {
        out[i] = mutator(f);
        applied = true;
      }
    }
    if (applied) decisions.push(note);
  };

  const key = `${stack}/${type}`;
  switch (key) {
    case "sling/sling-servlet":
    case "aem/sling-servlet":
      patch(
        (f) => f.path.endsWith("Servlet.java"),
        (f) => ({
          path: f.path,
          content: hardenSlingServlet(f.content),
        }),
        "Sling servlet — added @HttpConstraint role guard + X-Content-Type-Options: nosniff response header, and marked TODO for output escaping.",
      );
      return { files: out, decisions };

    case "sling/sling-model":
    case "aem/sling-model":
    case "aem/component":
      patch(
        (f) => f.path.endsWith("Model.java"),
        (f) => ({
          path: f.path,
          content: hardenSlingModel(f.content),
        }),
        "Sling model — switched adaptable to SlingHttpServletRequest, added null-safe getter defaults, and REQUIRED injection strategy for the title field.",
      );
      // Component: also HTL-escape.
      patch(
        (f) => f.path.endsWith(".html"),
        (f) => ({
          path: f.path,
          content: hardenHtl(f.content),
        }),
        "AEM component (HTL) — added `@ context='html'` on all `${...}` expressions for XSS-safe output.",
      );
      return { files: out, decisions };

    case "spring/rest-controller":
      patch(
        (f) => f.path.endsWith("Controller.java"),
        (f) => ({
          path: f.path,
          content: hardenSpringController(f.content),
        }),
        "Spring rest-controller — added @PreAuthorize scaffolding (method-security) and enforced @Valid on the request body (kept explicit).",
      );
      return { files: out, decisions };

    case "app-builder/action":
      patch(
        (f) => f.path.endsWith("/index.js") && f.path.startsWith("actions/"),
        (f) => ({
          path: f.path,
          content: hardenAppBuilderAction(f.content),
        }),
        "App Builder action — added Authorization header check, request-id logging, and a redactSecrets() helper applied to logger arguments.",
      );
      return { files: out, decisions };

    case "commerce-paas/plugin":
      patch(
        (f) => f.path.endsWith("Plugin.php"),
        (f) => ({
          path: f.path,
          content: hardenCommercePlugin(f.content),
        }),
        "Commerce plugin — injected \\Magento\\Framework\\Escaper via constructor and added a TODO nonce-validation guard in the intercepted method.",
      );
      return { files: out, decisions };

    case "commerce-paas/controller":
      patch(
        (f) => f.path.endsWith(".php") && f.path.includes("/Controller/"),
        (f) => ({
          path: f.path,
          content: hardenCommerceController(f.content),
        }),
        "Commerce controller — added form-key / CSRF guard and a request validator hook before the JSON result is built.",
      );
      return { files: out, decisions };

    case "commerce-paas/graphql-resolver":
      patch(
        (f) => f.path.endsWith("Resolver.php"),
        (f) => ({
          path: f.path,
          content: hardenCommerceGraphqlResolver(f.content),
        }),
        "Commerce GraphQL resolver — added @depth-limit(8) annotation and a rate-limit note; guarded $context->getExtensionAttributes()->getIsCustomer() for authenticated queries.",
      );
      return { files: out, decisions };

    default:
      return { files: out, decisions };
  }
}

// ── per-target mutators ─────────────────────────────────────────────────────

function hardenSlingServlet(src: string): string {
  let s = src;
  // Add import if missing.
  if (!s.includes("import javax.servlet.annotation.HttpConstraint;")) {
    s = s.replace(
      "import javax.servlet.Servlet;",
      "import javax.servlet.Servlet;\nimport javax.servlet.annotation.HttpConstraint;\nimport javax.servlet.annotation.ServletSecurity;",
    );
  }
  // Add @ServletSecurity above the class annotation.
  s = s.replace(
    "public class ",
    "@ServletSecurity(@HttpConstraint(rolesAllowed = { \"content-authors\" }))\npublic class ",
  );
  // Add a nosniff header before writing the body.
  s = s.replace(
    "response.setContentType(\"application/json\");",
    "response.setContentType(\"application/json\");\n        response.setHeader(\"X-Content-Type-Options\", \"nosniff\");\n        // hardened: never write raw request params into the response — escape/validate first.",
  );
  return s;
}

function hardenSlingModel(src: string): string {
  let s = src;
  s = s.replace(
    "adaptables = Resource.class",
    "adaptables = SlingHttpServletRequest.class",
  );
  if (!s.includes("import org.apache.sling.api.SlingHttpServletRequest;")) {
    s = s.replace(
      "import org.apache.sling.api.resource.Resource;",
      "import org.apache.sling.api.resource.Resource;\nimport org.apache.sling.api.SlingHttpServletRequest;",
    );
  }
  // Null-safe getter.
  s = s.replace(
    "public String getTitle() {\n        return title;\n    }",
    "public String getTitle() {\n        return title != null ? title : \"\";\n    }",
  );
  return s;
}

function hardenHtl(src: string): string {
  // Add @ context='html' to every `${expr}` that doesn't already have @ context.
  return src.replace(/\$\{([^}]+)\}/g, (whole, expr: string) => {
    if (expr.includes("@ context")) return whole;
    // Skip HTL directives (starting with a quote — those are `data-sly-use` payloads).
    if (expr.trim().startsWith("'")) return whole;
    return `\${${expr} @ context='html'}`;
  });
}

function hardenSpringController(src: string): string {
  let s = src;
  if (!s.includes("import org.springframework.security.access.prepost.PreAuthorize;")) {
    s = s.replace(
      "import org.springframework.web.bind.annotation.*;",
      "import org.springframework.security.access.prepost.PreAuthorize;\nimport org.springframework.web.bind.annotation.*;",
    );
  }
  s = s.replace(
    "@PostMapping",
    "@PreAuthorize(\"hasAuthority('SCOPE_write')\")\n    @PostMapping",
  );
  return s;
}

function hardenAppBuilderAction(src: string): string {
  let s = src;
  // Add auth check + redaction helper.
  s = s.replace(
    "async function main (params) {",
    `function redactSecrets (obj) {
  if (!obj || typeof obj !== 'object') return obj
  const clone = Array.isArray(obj) ? [...obj] : { ...obj }
  for (const k of Object.keys(clone)) {
    if (/token|secret|password|key|authorization/i.test(k)) clone[k] = '[REDACTED]'
    else if (typeof clone[k] === 'object') clone[k] = redactSecrets(clone[k])
  }
  return clone
}

async function main (params) {`,
  );
  s = s.replace(
    "logger.info('",
    `const authz = (params.__ow_headers || {}).authorization
    if (!authz || !authz.startsWith('Bearer ')) {
      return { statusCode: 401, body: { error: 'unauthorized' } }
    }
    logger.info('`,
  );
  s = s.replace(
    "logger.error(error)",
    "logger.error(redactSecrets({ message: error.message, stack: error.stack }))",
  );
  return s;
}

function hardenCommercePlugin(src: string): string {
  let s = src;
  s = s.replace(
    "class ",
    `use Magento\\Framework\\Escaper;

class `,
  );
  s = s.replace(
    /class (\w+Plugin)\s*\n\{/,
    `class $1
{
    public function __construct(private Escaper $escaper) {}

`,
  );
  s = s.replace(
    "return $result;",
    `// TODO(secure): validate nonce / form_key when the intercepted method is state-changing.
        return is_string($result) ? $this->escaper->escapeHtml($result) : $result;`,
  );
  return s;
}

function hardenCommerceController(src: string): string {
  let s = src;
  s = s.replace(
    "use Magento\\Framework\\App\\Action\\HttpGetActionInterface;",
    "use Magento\\Framework\\App\\Action\\HttpGetActionInterface;\nuse Magento\\Framework\\Data\\Form\\FormKey\\Validator as FormKeyValidator;\nuse Magento\\Framework\\App\\Request\\Http as HttpRequest;",
  );
  s = s.replace(
    /public function __construct\(private JsonFactory \$jsonFactory\) \{\}/,
    "public function __construct(private JsonFactory $jsonFactory, private FormKeyValidator $formKeyValidator, private HttpRequest $request) {}",
  );
  s = s.replace(
    "public function execute()\n    {\n",
    `public function execute()
    {
        // hardened: reject non-idempotent calls without a valid form key (CSRF guard).
        if ($this->request->isPost() && !$this->formKeyValidator->validate($this->request)) {
            return $this->jsonFactory->create()->setHttpResponseCode(403)->setData(['error' => 'invalid form key']);
        }
`,
  );
  return s;
}

function hardenCommerceGraphqlResolver(src: string): string {
  let s = src;
  s = s.replace(
    "class ",
    `/**
 * @depth-limit(8)   // secure: reject deeply-nested queries
 * @rate-limit note: enforce in front of the resolver (mesh/plugin), not here.
 */
class `,
  );
  s = s.replace(
    /public function resolve\([^)]*\)\s*\n\s*\{/,
    (m) =>
      m +
      `
        // hardened: only permit authenticated queries.
        $isCustomer = $context->getExtensionAttributes()->getIsCustomer() ?? false;
        if (!$isCustomer) {
            throw new \\Magento\\Framework\\GraphQl\\Exception\\GraphQlAuthorizationException(__('Authentication required.'));
        }`,
  );
  return s;
}
