/**
 * DCA Generation — Deterministic scaffolders
 * ===========================================
 * Idiomatic, correct-by-construction code generators for the company's Java/Node
 * stacks. Each generator returns the files to write; the orchestrator (./index)
 * writes them and emits the standardized generation report + CHANGE-LOG.
 *
 * These complement the LLM/MCP generation path (SKILL.md + resource packs) for
 * common, repeatable artifacts.
 */

import * as fs from "fs";
import * as path from "path";
import { pascal, camel, kebab, pkgPath, slingPkg, springPkg, aemPkg, vendorModule } from "./generators-util";
export { pascal, camel, kebab } from "./generators-util";

export interface GenFile {
  /** path relative to the output root */
  path: string;
  content: string;
}

export interface GenOptions {
  name: string;
  /** Java package (Sling/Spring). Defaults per stack. */
  pkg?: string;
  /** Optional project slug for AEM IaC scaffolders (dispatcher/CFM/XF/…). */
  project?: string;
}

export type Generator = (o: GenOptions) => GenFile[];

const slingGenerators: Record<string, Generator> = {
  "osgi-service": (o) => {
    const C = pascal(o.name), pkg = slingPkg(o), dir = `core/src/main/java/${pkgPath(pkg)}`;
    return [
      { path: `${dir}/${C}Service.java`, content:
`package ${pkg};

/** Service contract for ${C}. */
public interface ${C}Service {
    String process(String input);
}
` },
      { path: `${dir}/impl/${C}ServiceImpl.java`, content:
`package ${pkg}.impl;

import ${pkg}.${C}Service;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Designate;
import org.osgi.service.metatype.annotations.AttributeDefinition;
import org.osgi.service.metatype.annotations.ObjectClassDefinition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component(service = ${C}Service.class, immediate = false)
@Designate(ocd = ${C}ServiceImpl.Config.class)
public class ${C}ServiceImpl implements ${C}Service {

    private static final Logger LOG = LoggerFactory.getLogger(${C}ServiceImpl.class);
    private boolean enabled;

    @ObjectClassDefinition(name = "${C} Service Configuration")
    public @interface Config {
        @AttributeDefinition(name = "Enabled") boolean enabled() default true;
    }

    @Activate
    protected void activate(Config config) {
        this.enabled = config.enabled();
        LOG.info("${C}ServiceImpl activated, enabled={}", enabled);
    }

    @Override
    public String process(String input) {
        if (!enabled || input == null) {
            return "";
        }
        return input.trim();
    }
}
` },
    ];
  },

  "sling-servlet": (o) => {
    const C = pascal(o.name), pkg = slingPkg(o), dir = `core/src/main/java/${pkgPath(pkg)}/servlets`;
    return [{ path: `${dir}/${C}Servlet.java`, content:
`package ${pkg}.servlets;

import java.io.IOException;
import javax.servlet.Servlet;
import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.api.SlingHttpServletResponse;
import org.apache.sling.api.servlets.SlingSafeMethodsServlet;
import org.osgi.service.component.annotations.Component;

@Component(service = Servlet.class, property = {
        "sling.servlet.resourceTypes=acme/components/${kebab(o.name)}",
        "sling.servlet.methods=GET",
        "sling.servlet.extensions=json"
})
public class ${C}Servlet extends SlingSafeMethodsServlet {

    @Override
    protected void doGet(SlingHttpServletRequest request, SlingHttpServletResponse response) throws IOException {
        response.setContentType("application/json");
        // TODO: implement — read request.getResource(), never trust unvalidated params
        response.getWriter().write("{\\"status\\":\\"ok\\"}");
    }
}
` }];
  },

  "sling-filter": (o) => {
    const C = pascal(o.name), pkg = slingPkg(o), dir = `core/src/main/java/${pkgPath(pkg)}/filters`;
    return [{ path: `${dir}/${C}Filter.java`, content:
`package ${pkg}.filters;

import java.io.IOException;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import org.osgi.framework.Constants;
import org.osgi.service.component.annotations.Component;
import org.apache.sling.engine.EngineConstants;

@Component(service = Filter.class, property = {
        EngineConstants.SLING_FILTER_SCOPE + "=" + EngineConstants.FILTER_SCOPE_REQUEST,
        // ordering: keep after XSS, before Authorization (tune ranking for the Shaft chain)
        Constants.SERVICE_RANKING + ":Integer=100"
})
public class ${C}Filter implements Filter {

    @Override public void init(FilterConfig filterConfig) { }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        // TODO: implement filter logic (audit / validation)
        chain.doFilter(request, response);
    }

    @Override public void destroy() { }
}
` }];
  },

  "sling-model": (o) => {
    const C = pascal(o.name), pkg = slingPkg(o), dir = `core/src/main/java/${pkgPath(pkg)}/models`;
    return [{ path: `${dir}/${C}Model.java`, content:
`package ${pkg}.models;

import org.apache.sling.api.resource.Resource;
import org.apache.sling.models.annotations.Model;
import org.apache.sling.models.annotations.DefaultInjectionStrategy;
import org.apache.sling.models.annotations.injectorspecific.ValueMapValue;

@Model(adaptables = Resource.class, defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL)
public class ${C}Model {

    @ValueMapValue
    private String title;

    public String getTitle() {
        return title;
    }
}
` }];
  },
};

// ── Spring Boot ───────────────────────────────────────────────────────────────

const springGenerators: Record<string, Generator> = {
  "rest-controller": (o) => {
    const C = pascal(o.name), pkg = springPkg(o), dir = `src/main/java/${pkgPath(pkg)}`;
    const route = kebab(o.name);
    return [
      { path: `${dir}/web/${C}Controller.java`, content:
`package ${pkg}.web;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/${route}")
public class ${C}Controller {

    @PostMapping
    public ResponseEntity<${C}Dto> create(@Valid @RequestBody ${C}Dto body) {
        // TODO: delegate to a @Service; never build SQL from body
        return ResponseEntity.ok(body);
    }
}
` },
      { path: `${dir}/web/${C}Dto.java`, content:
`package ${pkg}.web;

import jakarta.validation.constraints.NotBlank;

public class ${C}Dto {

    @NotBlank
    private String name;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
` },
    ];
  },

  "service": (o) => {
    const C = pascal(o.name), pkg = springPkg(o), dir = `src/main/java/${pkgPath(pkg)}/service`;
    return [{ path: `${dir}/${C}Service.java`, content:
`package ${pkg}.service;

import org.springframework.stereotype.Service;

@Service
public class ${C}Service {

    // Constructor injection preferred over field injection.
    public String handle(String input) {
        // TODO: business logic
        return input;
    }
}
` }];
  },

  "jpa-repository": (o) => {
    const C = pascal(o.name), pkg = springPkg(o), dir = `src/main/java/${pkgPath(pkg)}`;
    return [
      { path: `${dir}/domain/${C}.java`, content:
`package ${pkg}.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class ${C} {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
` },
      { path: `${dir}/repository/${C}Repository.java`, content:
`package ${pkg}.repository;

import ${pkg}.domain.${C};
import org.springframework.data.jpa.repository.JpaRepository;

public interface ${C}Repository extends JpaRepository<${C}, Long> {
    // Use derived queries or @Query with bound parameters — never string concatenation.
}
` },
    ];
  },
};

// ── Adobe App Builder ─────────────────────────────────────────────────────────
const appBuilderGenerators: Record<string, Generator> = {
  "action": (o) => {
    const k = kebab(o.name);
    return [
      { path: `actions/${k}/index.js`, content:
`const { Core } = require('@adobe/aio-sdk')

// Runtime action. Register with 'require-adobe-auth: true' in app.config.yaml.
async function main (params) {
  const logger = Core.Logger('${k}', { level: params.LOG_LEVEL || 'info' })
  try {
    // Never log params.__ow_headers or secrets.
    logger.info('${k} invoked')

    // TODO: validate required inputs
    // const { id } = params

    return {
      statusCode: 200,
      body: { ok: true }
    }
  } catch (error) {
    logger.error(error)
    return { statusCode: 500, body: { error: 'server error' } }
  }
}

exports.main = main
` },
      { path: `test/${k}.test.js`, content:
`const { main } = require('../actions/${k}/index.js')

jest.mock('@adobe/aio-sdk', () => ({
  Core: { Logger: () => ({ info: jest.fn(), error: jest.fn() }) }
}))

describe('${k} action', () => {
  test('returns 200 on happy path', async () => {
    const res = await main({})
    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
` },
    ];
  },
};

// ── AEM (AEMaaCS + AMS) ───────────────────────────────────────────────────────
const aemGenerators: Record<string, Generator> = {
  "sling-model": (o) => {
    const C = pascal(o.name), pkg = aemPkg(o), dir = `core/src/main/java/${pkgPath(pkg)}/models`;
    return [{ path: `${dir}/${C}Model.java`, content:
`package ${pkg}.models;

import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.models.annotations.Model;
import org.apache.sling.models.annotations.DefaultInjectionStrategy;
import org.apache.sling.models.annotations.injectorspecific.ValueMapValue;

@Model(adaptables = SlingHttpServletRequest.class, defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL)
public class ${C}Model {
    @ValueMapValue private String title;
    public String getTitle() { return title; }
}
` }];
  },
  "osgi-service": (o) => slingGenerators["osgi-service"]({ name: o.name, pkg: aemPkg(o) }),
  "sling-servlet": (o) => slingGenerators["sling-servlet"]({ name: o.name, pkg: aemPkg(o) }),
  "component": (o) => {
    const name = kebab(o.name), title = pascal(o.name).replace(/([a-z])([A-Z])/g, "$1 $2");
    const dir = `ui.apps/src/main/content/jcr_root/apps/acme/components/${name}`;
    return [
      { path: `${dir}/.content.xml`, content:
`<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0" xmlns:cq="http://www.day.com/jcr/cq/1.0"
    jcr:primaryType="cq:Component"
    jcr:title="${title}"
    componentGroup="Acme - Content"/>
` },
      { path: `${dir}/${name}.html`, content:
`<sly data-sly-use.model="\${'${aemPkg(o)}.models.${pascal(o.name)}Model'}">
    <div class="cmp-${name}">
        <h2>\${model.title}</h2>
    </div>
</sly>
` },
      { path: `${dir}/_cq_dialog/.content.xml`, content:
`<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0" xmlns:cq="http://www.day.com/jcr/cq/1.0"
    xmlns:sling="http://sling.apache.org/jcr/sling/1.0" xmlns:granite="http://www.adobe.com/jcr/granite/1.0"
    jcr:primaryType="nt:unstructured" jcr:title="${title}" sling:resourceType="cq/gui/components/authoring/dialog">
    <content jcr:primaryType="nt:unstructured" sling:resourceType="granite/ui/components/coral/foundation/container">
        <items jcr:primaryType="nt:unstructured">
            <title jcr:primaryType="nt:unstructured" sling:resourceType="granite/ui/components/coral/foundation/form/textfield"
                fieldLabel="Title" name="./title"/>
        </items>
    </content>
</jcr:root>
` },
    ];
  },
  "workflow-process": (o) => {
    const C = pascal(o.name), pkg = aemPkg(o), dir = `core/src/main/java/${pkgPath(pkg)}/workflows`;
    return [{ path: `${dir}/${C}Process.java`, content:
`package ${pkg}.workflows;

import com.adobe.granite.workflow.WorkflowSession;
import com.adobe.granite.workflow.exec.WorkItem;
import com.adobe.granite.workflow.exec.WorkflowProcess;
import com.adobe.granite.workflow.metadata.MetaDataMap;
import org.osgi.service.component.annotations.Component;

@Component(service = WorkflowProcess.class, property = { "process.label=${C} Process" })
public class ${C}Process implements WorkflowProcess {
    @Override
    public void execute(WorkItem workItem, WorkflowSession session, MetaDataMap args) {
        String payloadPath = workItem.getWorkflowData().getPayload().toString();
        // TODO: implement the workflow step
    }
}
` }];
  },
};

// ── Adobe Commerce PaaS (Magento 2, PHP) ──────────────────────────────────────
const commerceGenerators: Record<string, Generator> = {
  "module": (o) => {
    const { v, m, dir } = vendorModule(o);
    return [
      { path: `${dir}/registration.php`, content:
`<?php
use Magento\\Framework\\Component\\ComponentRegistrar;
ComponentRegistrar::register(ComponentRegistrar::MODULE, '${v}_${m}', __DIR__);
` },
      { path: `${dir}/etc/module.xml`, content:
`<?xml version="1.0"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="urn:magento:framework:Module/etc/module.xsd">
    <module name="${v}_${m}"/>
</config>
` },
      { path: `${dir}/composer.json`, content:
`{
  "name": "${v.toLowerCase()}/module-${m.toLowerCase()}",
  "type": "magento2-module",
  "autoload": { "files": ["registration.php"], "psr-4": { "${v}\\\\${m}\\\\": "" } }
}
` },
    ];
  },
  "plugin": (o) => {
    const { m, dir, ns } = vendorModule(o); const C = pascal(o.name);
    return [
      { path: `${dir}/Plugin/${C}Plugin.php`, content:
`<?php
declare(strict_types=1);
namespace ${ns}\\Plugin;

class ${C}Plugin
{
    // Rename around/before/after per the intercepted method.
    public function afterGetName(\\Magento\\Catalog\\Model\\Product $subject, $result)
    {
        return $result;
    }
}
` },
      { path: `${dir}/etc/di.xml`, content:
`<?xml version="1.0"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="urn:magento:framework:ObjectManager/etc/config.xsd">
    <type name="Magento\\Catalog\\Model\\Product">
        <plugin name="${m.toLowerCase()}_${kebab(o.name)}" type="${ns}\\Plugin\\${C}Plugin"/>
    </type>
</config>
` },
    ];
  },
  "observer": (o) => {
    const { dir, ns } = vendorModule(o); const C = pascal(o.name);
    return [
      { path: `${dir}/Observer/${C}Observer.php`, content:
`<?php
declare(strict_types=1);
namespace ${ns}\\Observer;

use Magento\\Framework\\Event\\Observer;
use Magento\\Framework\\Event\\ObserverInterface;

class ${C}Observer implements ObserverInterface
{
    public function execute(Observer $observer): void
    {
        // TODO: handle the event; $observer->getEvent()->getData(...)
    }
}
` },
      { path: `${dir}/etc/events.xml`, content:
`<?xml version="1.0"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="urn:magento:framework:Event/etc/events.xsd">
    <event name="catalog_product_save_after">
        <observer name="${kebab(o.name)}" instance="${ns}\\Observer\\${C}Observer"/>
    </event>
</config>
` },
    ];
  },
  "graphql-resolver": (o) => {
    const { dir, ns } = vendorModule(o); const C = pascal(o.name);
    return [
      { path: `${dir}/Model/Resolver/${C}Resolver.php`, content:
`<?php
declare(strict_types=1);
namespace ${ns}\\Model\\Resolver;

use Magento\\Framework\\GraphQl\\Config\\Element\\Field;
use Magento\\Framework\\GraphQl\\Query\\ResolverInterface;
use Magento\\Framework\\GraphQl\\Schema\\Type\\ResolveInfo;

class ${C}Resolver implements ResolverInterface
{
    public function resolve(Field $field, $context, ResolveInfo $info, ?array $value = null, ?array $args = null)
    {
        // TODO: return data for the ${camel(o.name)} query (use bound params in any DB access)
        return [];
    }
}
` },
      { path: `${dir}/etc/schema.graphqls`, content:
`type Query {
    ${camel(o.name)}(id: Int!): ${C}Output @resolver(class: "${ns}\\\\Model\\\\Resolver\\\\${C}Resolver")
}
type ${C}Output { id: Int name: String }
` },
    ];
  },
  "controller": (o) => {
    const { dir, ns } = vendorModule(o); const C = pascal(o.name);
    return [{ path: `${dir}/Controller/Index/${C}.php`, content:
`<?php
declare(strict_types=1);
namespace ${ns}\\Controller\\Index;

use Magento\\Framework\\App\\Action\\HttpGetActionInterface;
use Magento\\Framework\\Controller\\Result\\JsonFactory;

class ${C} implements HttpGetActionInterface
{
    public function __construct(private JsonFactory $jsonFactory) {}
    public function execute()
    {
        return $this->jsonFactory->create()->setData(['status' => 'ok']);
    }
}
` }];
  },
};

// ── Adobe App Builder — mesh + eventing (adds to the 'action' generator) ───────
const appBuilderExtra: Record<string, Generator> = {
  "mesh": (o) => {
    const k = kebab(o.name);
    return [{ path: `mesh.json`, content:
`{
  "meshConfig": {
    "sources": [
      {
        "name": "${k}",
        "handler": {
          "graphql": { "endpoint": "https://REPLACE/graphql" }
        }
      }
    ],
    "plugins": [
      { "rateLimit": { "config": [{ "type": "Query", "field": "*", "max": 100, "ttl": 60 }] } },
      { "depthLimit": { "maxDepth": 8 } }
    ]
  }
}
` }];
  },
  "event-handler": (o) => {
    const k = kebab(o.name);
    return [
      { path: `actions/${k}-events/index.js`, content:
`const { Core } = require('@adobe/aio-sdk')
const crypto = require('crypto')

// I/O Events / webhook consumer. Register the webhook with 'require-adobe-auth: false'
// and verify the signature yourself. Make handling idempotent.
async function main (params) {
  const logger = Core.Logger('${k}-events', { level: params.LOG_LEVEL || 'info' })
  try {
    if (!verifySignature(params)) {
      return { statusCode: 401, body: { error: 'invalid signature' } }
    }
    const event = params.data || params
    // TODO: idempotent handling (dedupe on event id); on failure return 5xx so the provider retries.
    logger.info('handled event')
    return { statusCode: 200, body: { received: true } }
  } catch (error) {
    logger.error(error)
    return { statusCode: 500, body: { error: 'server error' } }
  }
}

function verifySignature (params) {
  const sig = (params.__ow_headers || {})['x-adobe-signature']
  if (!sig || !params.EVENT_SIGNING_SECRET) return false
  const body = params.__ow_body || JSON.stringify(params.data || {})
  const expected = crypto.createHmac('sha256', params.EVENT_SIGNING_SECRET).update(body).digest('base64')
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

exports.main = main
` },
    ];
  },
};

// ── Adobe EDS ─────────────────────────────────────────────────────────────────
const edsGenerators: Record<string, Generator> = {
  "block": (o) => {
    const k = kebab(o.name);
    return [
      { path: `blocks/${k}/${k}.js`, content:
`export default function decorate(block) {
  // EDS block decoration. 'block' is the block root element.
  block.classList.add('${k}');
  // TODO: transform authored rows into markup; sanitize any URL/text you read.
}
` },
      { path: `blocks/${k}/${k}.css`, content:
`.${k} {
  /* block styles */
}
` },
    ];
  },
};

// ── EDS + Commerce (drop-in block) ────────────────────────────────────────────
const edsCommerceGenerators: Record<string, Generator> = {
  "dropin-block": (o) => {
    const k = kebab(o.name);
    return [
      { path: `blocks/commerce-${k}/commerce-${k}.js`, content:
`import { events } from '@dropins/tools/event-bus.js';

export default async function decorate(block) {
  block.classList.add('commerce-${k}');
  // TODO: mount the relevant Commerce drop-in / render container and wire events.
  // Never hardcode API keys — read from config; validate any query params.
}
` },
      { path: `blocks/commerce-${k}/commerce-${k}.css`, content:
`.commerce-${k} {
  /* drop-in block styles */
}
` },
    ];
  },
};

// ── Adobe Commerce SaaS (Catalog Service / Live Search / drop-ins) ────────────
const commerceSaasGenerators: Record<string, Generator> = {
  "catalog-query": (o) => {
    const k = kebab(o.name), C = camel(o.name);
    return [{ path: `src/commerce/${k}.js`, content:
`// Catalog Service query. Config (environmentId, apiKey, storeViewCode) comes from
// the storefront config — never hardcode the environment id or private keys here.
const CATALOG_SERVICE = 'https://catalog-service.adobe.io/graphql';

export async function ${C}(config, variables) {
  const res = await fetch(CATALOG_SERVICE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Magento-Environment-Id': config.environmentId,
      'Magento-Store-View-Code': config.storeViewCode,
      'Magento-Website-Code': config.websiteCode,
      'x-api-key': config.apiKey, // PUBLIC Catalog Service key only
    },
    body: JSON.stringify({
      query: \`query ${C}($phrase: String!) { productSearch(phrase: $phrase) { items { product { sku name } } } }\`,
      variables,
    }),
  });
  if (!res.ok) throw new Error('Catalog Service error ' + res.status);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}
` }];
  },
  "storefront-block": (o) => {
    const k = kebab(o.name);
    return [
      { path: `blocks/${k}/${k}.js`, content:
`import { events } from '@dropins/tools/event-bus.js';

export default async function decorate(block) {
  block.classList.add('${k}');
  // 1. read SaaS config (environmentId, storeViewCode, public apiKey) from storefront config
  // 2. query Catalog Service / Live Search (see src/commerce/*), sanitize any params (sku, q)
  // 3. render + subscribe to drop-in events; never expose private/admin tokens client-side
}
` },
      { path: `blocks/${k}/${k}.css`, content: `.${k} {\n  /* block styles */\n}\n` },
    ];
  },
};

// ── AEM IaC / pipeline scaffolders ────────────────────────────────────────────
// These read canonical patterns from
// `skills/bmad-dept-code-generation-agent/templates/*.md` — a single source of
// truth kept identical between the LLM path (SKILL.md) and the deterministic
// path here. We resolve the templates dir once and log which file was used.

const TEMPLATES_DIR = path.resolve(__dirname, "..", "..", "templates");

/** Read a template file; returns "" (with a stderr note) if the file's missing. */
function readTemplate(fileName: string): string {
  const full = path.join(TEMPLATES_DIR, fileName);
  if (!fs.existsSync(full)) {
    process.stderr.write(
      `[generation] WARN: template not found: ${full} — emitting minimal fallback.\n`,
    );
    return "";
  }
  process.stderr.write(`[generation] template used: ${full}\n`);
  return fs.readFileSync(full, "utf8");
}

/**
 * Extract every fenced block, in order, whose "info" tag equals `tag` exactly.
 * Pass "" to match untagged blocks (```\n…\n```). Handles CRLF line endings.
 */
function extractAllCodeBlocks(md: string, tag: string): string[] {
  const out: string[] = [];
  const re = /```([^\n\r]*)\r?\n([\s\S]*?)\r?\n```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const info = (m[1] ?? "").trim();
    if (info === tag) out.push(m[2]!);
  }
  return out;
}

/** Substitute {{project}} / {{PROJECT}} / {{PROJECT_TITLE}} tokens with a slug. */
function subst(body: string, project: string): string {
  const Title = pascal(project);
  return body
    .replace(/\{\{project\}\}/g, project)
    .replace(/\{\{PROJECT\}\}/g, project)
    .replace(/\{\{PROJECT_TITLE\}\}/g, Title)
    .replace(/\{\{TEMPLATE_TITLE\}\}/g, Title)
    .replace(/\{\{TEMPLATE_DESCRIPTION\}\}/g, `${Title} template`)
    .replace(/\{\{MODEL_TITLE\}\}/g, Title)
    .replace(/\{\{MODEL_DESCRIPTION\}\}/g, `${Title} model`)
    .replace(/\{\{XF_TITLE\}\}/g, Title)
    .replace(/\{\{ALLOWED_COMPONENTS\}\}/g, "core/wcm/components/text,core/wcm/components/image,core/wcm/components/title")
    .replace(/\{\{domain\}\}/g, `${project}.example.com`);
}

const iacGenerators: Record<string, Generator> = {
  "dispatcher-config": (o) => {
    const project = kebab(o.project ?? o.name);
    const md = readTemplate("dispatcher-config.md");
    const apacheBlocks = extractAllCodeBlocks(md, "apache");
    // Templates in dispatcher-config.md use ``` (no lang) for .farm/.any snippets.
    // The first untyped block is the folder-tree diagram; skip it.
    const untypedBlocks = extractAllCodeBlocks(md, "").slice(1);
    // apache blocks (in template order): vhost, rewrites, custom.vars
    const [vhost = "", rewrites = "", vars = ""] = apacheBlocks;
    // untyped after skipping tree: farm, filters, cache, clientheaders
    const farm = untypedBlocks[0] ?? "";
    const filters = untypedBlocks[1] ?? "";
    const cache = untypedBlocks[2] ?? "";
    const clientheaders = untypedBlocks[3] ?? "";
    return [
      { path: `dispatcher/src/conf.d/available_vhosts/${project}.vhost`, content: subst(vhost, project) + "\n" },
      { path: `dispatcher/src/conf.d/rewrites/${project}_rewrite.rules`, content: subst(rewrites, project) + "\n" },
      { path: `dispatcher/src/conf.d/variables/custom.vars`, content: subst(vars, project) + "\n" },
      { path: `dispatcher/src/conf.dispatcher.d/available_farms/${project}.farm`, content: subst(farm, project) + "\n" },
      { path: `dispatcher/src/conf.dispatcher.d/filters/${project}_filters.any`, content: subst(filters, project) + "\n" },
      { path: `dispatcher/src/conf.dispatcher.d/cache/${project}_cache.any`, content: subst(cache, project) + "\n" },
      { path: `dispatcher/src/conf.dispatcher.d/clientheaders/${project}_clientheaders.any`, content: subst(clientheaders, project) + "\n" },
    ];
  },

  "editable-template": (o) => {
    const project = kebab(o.project ?? "acme");
    const name = kebab(o.name);
    const md = readTemplate("editable-template.md");
    const xmlBlocks = extractAllCodeBlocks(md, "xml");
    const [typeXml = "", templateXml = "", policyXml = ""] = xmlBlocks;
    const base = `ui.content/src/main/content/jcr_root/conf/${project}/settings/wcm`;
    return [
      { path: `${base}/template-types/${name}-type/.content.xml`, content: subst(typeXml, project) },
      { path: `${base}/templates/${name}/.content.xml`, content: subst(templateXml, project) },
      { path: `${base}/policies/${project}/components/container/policy/.content.xml`, content: subst(policyXml, project) },
    ];
  },

  "cloud-manager-pipeline": (o) => {
    const name = kebab(o.name);
    const md = readTemplate("cloud-manager-pipeline.md");
    const yamlBlocks = extractAllCodeBlocks(md, "yaml");
    const untypedBlocks = extractAllCodeBlocks(md, "");
    const [fullStack = "", frontEnd = "", configOnly = ""] = yamlBlocks;
    const envVars = untypedBlocks[0] ?? "";
    return [
      { path: `.cloudmanager/${name}-fullstack.yaml`, content: subst(fullStack, name) + "\n" },
      { path: `.cloudmanager/${name}-frontend.yaml`, content: subst(frontEnd, name) + "\n" },
      { path: `.cloudmanager/${name}-config.yaml`, content: subst(configOnly, name) + "\n" },
      { path: `.cloudmanager/env-variables.yaml`, content: subst(envVars, name) + "\n" },
    ];
  },

  "content-fragment-model": (o) => {
    const project = kebab(o.project ?? "acme");
    const name = kebab(o.name);
    const md = readTemplate("content-fragment-model.md");
    const xmlBlocks = extractAllCodeBlocks(md, "xml");
    const modelXml = xmlBlocks[0] ?? "";
    return [
      {
        path: `ui.content/src/main/content/jcr_root/conf/${project}/settings/dam/cfm/models/${name}/.content.xml`,
        content: subst(modelXml, project),
      },
    ];
  },

  "experience-fragment": (o) => {
    const project = kebab(o.project ?? "acme");
    const name = kebab(o.name);
    const md = readTemplate("experience-fragment.md");
    const xmlBlocks = extractAllCodeBlocks(md, "xml");
    const [folderXml = "", webVariationXml = "", , xfTemplateXml = ""] = xmlBlocks;
    const base = `ui.content/src/main/content/jcr_root/content/experience-fragments/${project}`;
    return [
      { path: `${base}/.content.xml`, content: subst(folderXml, project) },
      { path: `${base}/${name}/master/.content.xml`, content: subst(webVariationXml, project) },
      {
        path: `ui.content/src/main/content/jcr_root/conf/${project}/settings/wcm/templates/xf-web-variation/.content.xml`,
        content: subst(xfTemplateXml, project),
      },
    ];
  },
};

// Merge IaC scaffolders into the AEM stack; expose them under `aem` per spec.
Object.assign(aemGenerators, iacGenerators);

export const GENERATORS: Record<string, Record<string, Generator>> = {
  aem: aemGenerators,
  sling: slingGenerators,
  spring: springGenerators,
  "commerce-paas": commerceGenerators,
  "commerce-saas": commerceSaasGenerators,
  "app-builder": { ...appBuilderGenerators, ...appBuilderExtra },
  eds: edsGenerators,
  "eds-commerce": edsCommerceGenerators,
};

export function listTypes(stack: string): string[] {
  return Object.keys(GENERATORS[stack] ?? {});
}
