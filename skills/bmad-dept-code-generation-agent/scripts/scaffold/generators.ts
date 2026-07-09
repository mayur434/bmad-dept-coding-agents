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

export interface GenFile {
  /** path relative to the output root */
  path: string;
  content: string;
}

export interface GenOptions {
  name: string;
  /** Java package (Sling/Spring). Defaults per stack. */
  pkg?: string;
}

export type Generator = (o: GenOptions) => GenFile[];

// ── naming helpers ────────────────────────────────────────────────────────────
export function pascal(s: string): string {
  return (s.match(/[A-Za-z0-9]+/g) || []).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("") || "Sample";
}
export function camel(s: string): string {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}
export function kebab(s: string): string {
  return (s.match(/[A-Za-z0-9]+/g) || []).map((w) => w.toLowerCase()).join("-") || "sample";
}
function pkgPath(pkg: string): string {
  return pkg.replace(/\./g, "/");
}

// ── Sling / Shaft ─────────────────────────────────────────────────────────────
const slingPkg = (o: GenOptions) => o.pkg ?? "com.acme.shaft";

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
const springPkg = (o: GenOptions) => o.pkg ?? "com.acme.app";

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

export const GENERATORS: Record<string, Record<string, Generator>> = {
  sling: slingGenerators,
  spring: springGenerators,
  "app-builder": appBuilderGenerators,
};

export function listTypes(stack: string): string[] {
  return Object.keys(GENERATORS[stack] ?? {});
}
