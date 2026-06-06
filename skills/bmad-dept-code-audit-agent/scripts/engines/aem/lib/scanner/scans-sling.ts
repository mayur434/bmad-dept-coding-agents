/**
 * AEM Scanner — Sling/OSGi Scans
 * ================================
 * Rules: AEMCS-SLING-001 through AEMCS-SLING-005
 */
import { AemScannerContext } from "./context";

// ==================== AEMCS-SLING-001: ResourceResolver Leak ====================

export function scanResolverLeak(ctx: AemScannerContext): void {
  for (const fp of ctx.javaFiles()) {
    const content = ctx.read(fp);
    if (!content.includes("getServiceResourceResolver") && !content.includes("getResourceResolver")) continue;

    // Get a resolver but check if it's closed properly
    const hits = ctx.grep(fp, /getServiceResourceResolver|getAdministrativeResourceResolver/);
    for (const hit of hits) {
      // If it's getAdministrativeResourceResolver, that's deprecated too
      if (hit.lineText.includes("getAdministrativeResourceResolver")) {
        ctx.add(
          "Sling/OSGi", ctx.module(fp), fp, hit.lineNum,
          "Deprecated Admin ResourceResolver",
          "getAdministrativeResourceResolver() is deprecated and removed in Cloud Service",
          ctx.context(fp, hit.lineNum), "CRITICAL",
          "Use getServiceResourceResolver(Map.of(\"sling.service.subservice\", \"<service-name>\")) with a service user mapping.",
          "Medium", "Admin resolver is disabled in Cloud Service for security"
        );
        continue;
      }

      // Check if try-with-resources or explicit close
      const contextCode = ctx.context(fp, hit.lineNum, 5);
      const hasTryWith = /try\s*\(/.test(contextCode);
      const hasClose = /\.close\(\)/.test(content);
      const hasAutoCloseable = /try\s*\([^)]*resolver/.test(content);

      if (!hasTryWith && !hasClose && !hasAutoCloseable) {
        ctx.add(
          "Sling/OSGi", ctx.module(fp), fp, hit.lineNum,
          "ResourceResolver Leak",
          "ResourceResolver opened but no close() or try-with-resources found — potential memory leak",
          ctx.context(fp, hit.lineNum), "HIGH",
          "Use try-with-resources: try (ResourceResolver resolver = resolverFactory.getServiceResourceResolver(...)) { }",
          "Low", "Leaked resolvers accumulate open sessions causing OOM"
        );
      }
    }
  }
}

// ==================== AEMCS-SLING-002: Deprecated @SlingServlet ====================

export function scanDeprecatedSlingServlet(ctx: AemScannerContext): void {
  for (const fp of ctx.javaFiles()) {
    const hits = ctx.grep(fp, /@SlingServlet/);
    for (const hit of hits) {
      ctx.add(
        "Sling/OSGi", ctx.module(fp), fp, hit.lineNum,
        "Deprecated @SlingServlet",
        "Legacy @SlingServlet annotation — replaced by OSGi DS annotations",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Replace with @Component(service=Servlet.class) + @SlingServletPaths or @SlingServletResourceTypes.",
        "Medium", "Legacy annotations may not work with latest Sling in Cloud Service"
      );
    }
  }
}

// ==================== AEMCS-SLING-003: JCR Session Leak ====================

export function scanJcrSessionLeak(ctx: AemScannerContext): void {
  for (const fp of ctx.javaFiles()) {
    const content = ctx.read(fp);
    if (!content.includes("session") && !content.includes("Session")) continue;

    // Direct JCR Session API usage
    const hits = ctx.grep(fp, /\.login\(\s*(new SimpleCredentials|null)?/);
    for (const hit of hits) {
      ctx.add(
        "Sling/OSGi", ctx.module(fp), fp, hit.lineNum,
        "Direct JCR Session Login",
        "Direct JCR repository.login() — prefer Sling ResourceResolver API",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Use ResourceResolverFactory.getServiceResourceResolver() and resolver.adaptTo(Session.class) if JCR API is needed.",
        "Medium", "Direct sessions bypass Sling access control and service user mappings"
      );
    }

    // Check for session.save() without try-finally
    const saveHits = ctx.grep(fp, /session\.save\(\)/);
    for (const saveHit of saveHits) {
      const ctxCode = ctx.context(fp, saveHit.lineNum, 10);
      if (!ctxCode.includes("finally") && !/try\s*\(/.test(ctxCode)) {
        ctx.add(
          "Sling/OSGi", ctx.module(fp), fp, saveHit.lineNum,
          "JCR Session Not Closed in Finally",
          "JCR session save without proper finally/try-with-resources — potential leak",
          ctx.context(fp, saveHit.lineNum), "HIGH",
          "Always close sessions in a finally block or use try-with-resources.",
          "Low", "Leaked sessions cause repository lock contention"
        );
      }
    }
  }
}

// ==================== AEMCS-SLING-004: Felix SCR Annotations ====================

export function scanFelixScr(ctx: AemScannerContext): void {
  for (const fp of ctx.javaFiles()) {
    const hits = ctx.grep(fp, /import\s+org\.apache\.felix\.scr\.annotations\./);
    for (const hit of hits) {
      ctx.add(
        "Sling/OSGi", ctx.module(fp), fp, hit.lineNum,
        "Felix SCR Annotations",
        "Legacy Felix SCR annotations — must use OSGi DS (Declarative Services) annotations",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Replace with org.osgi.service.component.annotations (@Component, @Reference, @Activate, etc.).",
        "Medium", "Felix SCR annotations are not supported in Cloud Service SDK"
      );
      break; // One finding per file is enough
    }
  }
}

// ==================== AEMCS-SLING-005: Sling Model Validation ====================

export function scanSlingModelValidation(ctx: AemScannerContext): void {
  for (const fp of ctx.javaFiles()) {
    const content = ctx.read(fp);
    if (!content.includes("@Model")) continue;

    // Check for adaptables
    const modelHit = ctx.grep(fp, /@Model\s*\(/);
    for (const hit of modelHit) {
      // Look for missing adaptables
      const lines: string[] = [];
      const allLines = content.split("\n");
      const start = hit.lineNum - 1;
      let depth = 0;
      for (let i = start; i < Math.min(start + 10, allLines.length); i++) {
        lines.push(allLines[i]);
        for (const ch of allLines[i]) {
          if (ch === "(") depth++;
          if (ch === ")") depth--;
        }
        if (depth === 0) break;
      }
      const annotation = lines.join("\n");

      // Check for missing defaultInjectionStrategy
      if (!annotation.includes("defaultInjectionStrategy")) {
        ctx.add(
          "Sling/OSGi", ctx.module(fp), fp, hit.lineNum,
          "Sling Model Missing InjectionStrategy",
          "Sling Model without defaultInjectionStrategy — defaults to REQUIRED which throws at runtime",
          ctx.context(fp, hit.lineNum), "LOW",
          "Add defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL or mark fields @Optional/@Required explicitly.",
          "Low", "Missing optional fields cause model adaptation failure"
        );
      }
    }
  }
}
