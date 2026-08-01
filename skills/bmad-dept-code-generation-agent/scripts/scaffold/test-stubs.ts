/**
 * DCA Generation — matching test-stub emission.
 * ==============================================
 * For each of the 24 scaffolder `<stack>/<type>` pairs, provide a `testStub`
 * function that returns a stub test file body — patterned on the test-coverage
 * agent's per-stack packs
 * (skills/bmad-dept-code-test-coverage-agent/resources/test-generation/*.md).
 *
 * The stubs are minimal: one no-op `@Test`/`test(...)` per unit so the file
 * compiles and shows up in the runner. Filling in real coverage is the
 * test-coverage agent's job; here we only guarantee a file exists.
 *
 * Path pattern per stack:
 *   Java (aem/sling/spring)          → src/test/java/<pkgPath>/<Name>Test.java
 *   JS (app-builder/eds/eds-commerce/commerce-saas) → <adjacent>/<name>.test.js
 *   PHP (commerce-paas)              → app/code/V/M/Test/Unit/<...>/<Name>Test.php
 */

import { pascal, camel, kebab, pkgPath, slingPkg, springPkg, aemPkg, vendorModule } from "./generators-util";

export interface StubOpts {
  name: string;
  pkg?: string;
}

export interface TestStub {
  path: string;
  content: string;
}

export type StubFn = (o: StubOpts) => TestStub | null;

// ── Java (JUnit 5 + Sling/OSGi Mocks or Spring Test) ────────────────────────

function juJunit5Header(pkg: string, C: string, extraImports: string[] = []): string {
  const imports = [
    "import static org.junit.jupiter.api.Assertions.*;",
    "import org.junit.jupiter.api.Test;",
    ...extraImports,
  ].join("\n");
  return `package ${pkg};\n\n${imports}\n\nclass ${C}Test {\n`;
}

function slingContextTest(pkg: string, C: string): string {
  return (
    juJunit5Header(pkg, C, [
      "import org.apache.sling.testing.mock.sling.junit5.SlingContext;",
      "import org.apache.sling.testing.mock.sling.junit5.SlingContextExtension;",
      "import org.junit.jupiter.api.extension.ExtendWith;",
    ]).replace(`class ${C}Test {\n`, `@ExtendWith(SlingContextExtension.class)\nclass ${C}Test {\n\n    private final SlingContext context = new SlingContext();\n`) +
    `\n    @Test\n    void placeholder_replaceWithBranchCoverage() {\n        // TODO(test-coverage): assert branches for ${C}. See test-coverage agent's sling.md pack.\n        assertNotNull(context);\n    }\n}\n`
  );
}

function osgiContextTest(pkg: string, C: string, hasImpl: boolean): string {
  const suffix = hasImpl ? "Impl" : "";
  return (
    juJunit5Header(pkg, C, [
      "import org.apache.sling.testing.mock.osgi.junit5.OsgiContext;",
      "import org.apache.sling.testing.mock.osgi.junit5.OsgiContextExtension;",
      "import org.junit.jupiter.api.extension.ExtendWith;",
    ]).replace(`class ${C}Test {\n`, `@ExtendWith(OsgiContextExtension.class)\nclass ${C}${suffix}Test {\n\n    private final OsgiContext context = new OsgiContext();\n`) +
    `\n    @Test\n    void placeholder_replaceWithBranchCoverage() {\n        // TODO(test-coverage): activate ${C}${suffix} via context.registerInjectActivateService(...)\n        // and assert each branch. See test-coverage agent's sling.md pack.\n        assertNotNull(context);\n    }\n}\n`
  );
}

function springMvcTest(pkg: string, C: string): string {
  return (
    juJunit5Header(pkg + ".web", C, [
      "import org.springframework.beans.factory.annotation.Autowired;",
      "import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;",
      "import org.springframework.test.web.servlet.MockMvc;",
    ]).replace(`class ${C}Test {\n`, `@WebMvcTest(${C}Controller.class)\nclass ${C}ControllerTest {\n\n    @Autowired private MockMvc mvc;\n`) +
    `\n    @Test\n    void placeholder_replaceWithMockMvcAssertions() throws Exception {\n        // TODO(test-coverage): mvc.perform(...) with @Valid boundary cases; see test-coverage spring.md pack.\n        assertNotNull(mvc);\n    }\n}\n`
  );
}

function plainServiceTest(pkg: string, C: string): string {
  return (
    juJunit5Header(pkg + ".service", C) +
    `\n    @Test\n    void placeholder_replaceWithBranchCoverage() {\n        // TODO(test-coverage): instantiate ${C}Service, assert business branches.\n        ${C}Service sut = new ${C}Service();\n        assertNotNull(sut);\n    }\n}\n`
  );
}

function jpaRepositoryTest(pkg: string, C: string): string {
  return (
    juJunit5Header(pkg + ".repository", C, [
      "import org.springframework.beans.factory.annotation.Autowired;",
      "import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;",
      `import ${pkg}.domain.${C};`,
    ]).replace(`class ${C}Test {\n`, `@DataJpaTest\nclass ${C}RepositoryTest {\n\n    @Autowired private ${C}Repository repository;\n`) +
    `\n    @Test\n    void placeholder_saveAndFind() {\n        // TODO(test-coverage): assert derived queries. See test-coverage spring.md pack.\n        assertNotNull(repository);\n    }\n}\n`
  );
}

function workflowProcessTest(pkg: string, C: string): string {
  return (
    juJunit5Header(pkg + ".workflows", C) +
    `\n    @Test\n    void placeholder_executeWorkflowStep() {\n        // TODO(test-coverage): mock WorkItem/WorkflowSession/MetaDataMap; drive execute().\n        assertNotNull(new ${C}Process());\n    }\n}\n`
  );
}

// ── JS (Jest / node's built-in test runner) ─────────────────────────────────

function appBuilderActionTest(k: string): string {
  return `const { main } = require('../actions/${k}/index.js')

jest.mock('@adobe/aio-sdk', () => ({
  Core: { Logger: () => ({ info: jest.fn(), error: jest.fn() }) }
}))

describe('${k} action', () => {
  test.todo('happy path returns 200')
  test.todo('missing required input returns 400')
  test.todo('caught exception returns 500 without leaking secrets')
  // TODO(test-coverage): flesh out per test-coverage agent's app-builder.md pack.
})
`;
}

function appBuilderEventHandlerTest(k: string): string {
  return `const { main } = require('../actions/${k}-events/index.js')

jest.mock('@adobe/aio-sdk', () => ({
  Core: { Logger: () => ({ info: jest.fn(), error: jest.fn() }) }
}))

describe('${k} event handler', () => {
  test.todo('rejects request with missing signature (401)')
  test.todo('rejects request with wrong signature (401)')
  test.todo('accepts valid signature and dedupes on retry')
  // TODO(test-coverage): use crypto to forge/valid signatures per app-builder.md pack.
})
`;
}

function appBuilderMeshTest(_k: string): string {
  return `// mesh.json is declarative; validate via schema or e2e — no unit test needed.
// TODO(test-coverage): add a schema-lint check to CI (see test-coverage app-builder.md).
`;
}

function edsBlockTest(k: string): string {
  return `import decorate from '../blocks/${k}/${k}.js';

describe('${k} block', () => {
  test.todo('adds the block class to root');
  test.todo('renders authored rows into markup');
  test.todo('sanitizes URLs/text pulled from authored content');
  // TODO(test-coverage): follow test-coverage eds.md pack (Jest + JSDOM).
});
`;
}

function edsCommerceDropinTest(k: string): string {
  return `import decorate from '../blocks/commerce-${k}/commerce-${k}.js';

jest.mock('@dropins/tools/event-bus.js', () => ({ events: { on: jest.fn(), emit: jest.fn() } }));

describe('commerce-${k} drop-in block', () => {
  test.todo('mounts the drop-in container');
  test.todo('wires event bus subscriptions');
  test.todo('never hardcodes API keys');
  // TODO(test-coverage): eds-commerce.md pack — mock @dropins/* and assert events.
});
`;
}

function saasCatalogQueryTest(k: string, C: string): string {
  return `import { ${C} } from '../src/commerce/${k}.js';

describe('${C} catalog query', () => {
  test.todo('sends x-api-key + Magento-Environment-Id headers');
  test.todo('throws on non-2xx response');
  test.todo('throws on GraphQL errors[] payload');
  // TODO(test-coverage): commerce-saas.md pack — mock fetch and assert request shape.
});
`;
}

function saasStorefrontBlockTest(k: string): string {
  return `import decorate from '../blocks/${k}/${k}.js';

describe('${k} storefront block', () => {
  test.todo('reads SaaS config (envId, storeViewCode, apiKey)');
  test.todo('renders results from Catalog Service query');
  test.todo('does not expose admin tokens client-side');
  // TODO(test-coverage): commerce-saas.md pack — Jest + mocked fetch.
});
`;
}

// ── PHP (PHPUnit + ObjectManager helper) ───────────────────────────────────

function phpUnitHeader(ns: string, C: string, kindDir: string): string {
  const testNs = ns.replace(/\\+/g, "\\") + `\\Test\\Unit\\${kindDir}`;
  const srcNs = ns.replace(/\\+/g, "\\") + `\\${kindDir}`;
  return `<?php
declare(strict_types=1);

namespace ${testNs};

use Magento\\Framework\\TestFramework\\Unit\\Helper\\ObjectManager;
use PHPUnit\\Framework\\TestCase;
use ${srcNs}\\${C};

class ${C}Test extends TestCase
{
    private ObjectManager $objectManager;

    protected function setUp(): void
    {
        $this->objectManager = new ObjectManager($this);
    }

    // TODO(test-coverage): follow commerce-paas.md pack — assert each branch,
    // security-negative paths (auth guards, escaper usage), and observer
    // side-effects with mocks built via $this->createMock(...).
    public function testPlaceholder(): void
    {
        $this->assertTrue(true);
    }
}
`;
}

// ── Stub registry ───────────────────────────────────────────────────────────

interface StubEntry {
  fn: StubFn;
}

export const STUBS: Record<string, Record<string, StubEntry>> = {
  sling: {
    "osgi-service": {
      fn: (o) => {
        const C = pascal(o.name), pkg = slingPkg(o);
        return {
          path: `core/src/test/java/${pkgPath(pkg)}/impl/${C}ServiceImplTest.java`,
          content: osgiContextTest(`${pkg}.impl`, C, true),
        };
      },
    },
    "sling-servlet": {
      fn: (o) => {
        const C = pascal(o.name), pkg = slingPkg(o);
        return {
          path: `core/src/test/java/${pkgPath(pkg)}/servlets/${C}ServletTest.java`,
          content: slingContextTest(`${pkg}.servlets`, C + "Servlet"),
        };
      },
    },
    "sling-filter": {
      fn: (o) => {
        const C = pascal(o.name), pkg = slingPkg(o);
        return {
          path: `core/src/test/java/${pkgPath(pkg)}/filters/${C}FilterTest.java`,
          content: slingContextTest(`${pkg}.filters`, C + "Filter"),
        };
      },
    },
    "sling-model": {
      fn: (o) => {
        const C = pascal(o.name), pkg = slingPkg(o);
        return {
          path: `core/src/test/java/${pkgPath(pkg)}/models/${C}ModelTest.java`,
          content: slingContextTest(`${pkg}.models`, C + "Model"),
        };
      },
    },
  },

  aem: {
    "osgi-service": {
      fn: (o) => {
        const C = pascal(o.name), pkg = aemPkg(o);
        return {
          path: `core/src/test/java/${pkgPath(pkg)}/impl/${C}ServiceImplTest.java`,
          content: osgiContextTest(`${pkg}.impl`, C, true),
        };
      },
    },
    "sling-servlet": {
      fn: (o) => {
        const C = pascal(o.name), pkg = aemPkg(o);
        return {
          path: `core/src/test/java/${pkgPath(pkg)}/servlets/${C}ServletTest.java`,
          content: slingContextTest(`${pkg}.servlets`, C + "Servlet"),
        };
      },
    },
    "sling-model": {
      fn: (o) => {
        const C = pascal(o.name), pkg = aemPkg(o);
        return {
          path: `core/src/test/java/${pkgPath(pkg)}/models/${C}ModelTest.java`,
          content: slingContextTest(`${pkg}.models`, C + "Model"),
        };
      },
    },
    "component": {
      // AEM component tests exercise the backing model, not the HTL directly.
      fn: (o) => {
        const C = pascal(o.name), pkg = aemPkg(o);
        return {
          path: `core/src/test/java/${pkgPath(pkg)}/models/${C}ModelTest.java`,
          content: slingContextTest(`${pkg}.models`, C + "Model"),
        };
      },
    },
    "workflow-process": {
      fn: (o) => {
        const C = pascal(o.name), pkg = aemPkg(o);
        return {
          path: `core/src/test/java/${pkgPath(pkg)}/workflows/${C}ProcessTest.java`,
          content: workflowProcessTest(pkg, C),
        };
      },
    },
  },

  spring: {
    "rest-controller": {
      fn: (o) => {
        const C = pascal(o.name), pkg = springPkg(o);
        return {
          path: `src/test/java/${pkgPath(pkg)}/web/${C}ControllerTest.java`,
          content: springMvcTest(pkg, C),
        };
      },
    },
    "service": {
      fn: (o) => {
        const C = pascal(o.name), pkg = springPkg(o);
        return {
          path: `src/test/java/${pkgPath(pkg)}/service/${C}ServiceTest.java`,
          content: plainServiceTest(pkg, C),
        };
      },
    },
    "jpa-repository": {
      fn: (o) => {
        const C = pascal(o.name), pkg = springPkg(o);
        return {
          path: `src/test/java/${pkgPath(pkg)}/repository/${C}RepositoryTest.java`,
          content: jpaRepositoryTest(pkg, C),
        };
      },
    },
  },

  "app-builder": {
    "action": {
      fn: (o) => ({
        path: `test/${kebab(o.name)}.test.js`,
        content: appBuilderActionTest(kebab(o.name)),
      }),
    },
    "event-handler": {
      fn: (o) => ({
        path: `test/${kebab(o.name)}-events.test.js`,
        content: appBuilderEventHandlerTest(kebab(o.name)),
      }),
    },
    "mesh": {
      fn: (o) => ({
        path: `test/${kebab(o.name)}-mesh.test.js`,
        content: appBuilderMeshTest(kebab(o.name)),
      }),
    },
  },

  eds: {
    "block": {
      fn: (o) => ({
        path: `test/blocks/${kebab(o.name)}.test.js`,
        content: edsBlockTest(kebab(o.name)),
      }),
    },
  },

  "eds-commerce": {
    "dropin-block": {
      fn: (o) => ({
        path: `test/blocks/commerce-${kebab(o.name)}.test.js`,
        content: edsCommerceDropinTest(kebab(o.name)),
      }),
    },
  },

  "commerce-saas": {
    "catalog-query": {
      fn: (o) => ({
        path: `test/commerce/${kebab(o.name)}.test.js`,
        content: saasCatalogQueryTest(kebab(o.name), camel(o.name)),
      }),
    },
    "storefront-block": {
      fn: (o) => ({
        path: `test/blocks/${kebab(o.name)}.test.js`,
        content: saasStorefrontBlockTest(kebab(o.name)),
      }),
    },
  },

  "commerce-paas": {
    "module": {
      fn: (o) => {
        const { v, m, dir } = vendorModule(o);
        return {
          path: `${dir}/Test/Unit/RegistrationTest.php`,
          content: `<?php
declare(strict_types=1);

namespace ${v}\\${m}\\Test\\Unit;

use PHPUnit\\Framework\\TestCase;

class RegistrationTest extends TestCase
{
    // TODO(test-coverage): assert module.xml + registration.php are wired.
    public function testPlaceholder(): void { $this->assertTrue(true); }
}
`,
        };
      },
    },
    "plugin": {
      fn: (o) => {
        const { v, m, dir } = vendorModule(o); const C = pascal(o.name);
        return {
          path: `${dir}/Test/Unit/Plugin/${C}PluginTest.php`,
          content: phpUnitHeader(`${v}\\${m}`, `${C}Plugin`, "Plugin"),
        };
      },
    },
    "observer": {
      fn: (o) => {
        const { v, m, dir } = vendorModule(o); const C = pascal(o.name);
        return {
          path: `${dir}/Test/Unit/Observer/${C}ObserverTest.php`,
          content: phpUnitHeader(`${v}\\${m}`, `${C}Observer`, "Observer"),
        };
      },
    },
    "graphql-resolver": {
      fn: (o) => {
        const { v, m, dir } = vendorModule(o); const C = pascal(o.name);
        return {
          path: `${dir}/Test/Unit/Model/Resolver/${C}ResolverTest.php`,
          content: phpUnitHeader(`${v}\\${m}`, `${C}Resolver`, "Model\\Resolver"),
        };
      },
    },
    "controller": {
      fn: (o) => {
        const { v, m, dir } = vendorModule(o); const C = pascal(o.name);
        return {
          path: `${dir}/Test/Unit/Controller/Index/${C}Test.php`,
          content: phpUnitHeader(`${v}\\${m}`, `${C}`, "Controller\\Index"),
        };
      },
    },
  },
};

/** Return a stub for `<stack>/<type>`, or null when none is registered. */
export function testStub(stack: string, type: string, o: StubOpts): TestStub | null {
  const entry = STUBS[stack]?.[type];
  return entry ? entry.fn(o) : null;
}
