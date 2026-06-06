/**
 * AEM Scanner — Security Scans
 * ==============================
 * Rules: AEMCS-SEC-001 through AEMCS-SEC-004
 */
import { AemScannerContext } from "./context";

// ==================== AEMCS-SEC-001: Hardcoded Credentials ====================

export function scanHardcodedCredentials(ctx: AemScannerContext): void {
  const allFiles = [...ctx.javaFiles(), ...ctx.osgiConfigFiles()];

  const credPatterns = [
    { pattern: /(?:password|passwd|secret|apiKey|api_key)\s*[=:]\s*["'][^"']{4,}["']/i, type: "Hardcoded Credential" },
    { pattern: /new\s+SimpleCredentials\s*\(\s*"[^"]+"\s*,\s*"[^"]+"/i, type: "JCR SimpleCredentials" },
    { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i, type: "Bearer Token" },
  ];

  for (const fp of allFiles) {
    for (const { pattern, type } of credPatterns) {
      const hits = ctx.grep(fp, pattern);
      for (const hit of hits) {
        // Skip test files
        if (fp.includes("/test/") || fp.includes("/tests/")) continue;
        // Skip comments
        if (hit.lineText.trimStart().startsWith("//") || hit.lineText.trimStart().startsWith("*")) continue;

        ctx.add(
          "Security", ctx.module(fp), fp, hit.lineNum,
          type,
          `Potential hardcoded credential found — use OSGi secrets or Cloud Manager env vars`,
          ctx.context(fp, hit.lineNum), "CRITICAL",
          "Use Cloud Manager environment variables with $[env:VAR_NAME] or OSGi secret configuration.",
          "Low", "Credentials in code are exposed in version control and deployable packages"
        );
      }
    }
  }
}

// ==================== AEMCS-SEC-002: Dispatcher Allow/Deny Rules ====================

export function scanDispatcherRules(ctx: AemScannerContext): void {
  const dispFiles = ctx.dispatcherFiles();

  for (const fp of dispFiles) {
    const content = ctx.read(fp);

    // Check for /0001 { /type "allow" /glob "*" } — overly permissive
    const hits = ctx.grep(fp, /\/type\s+"allow"\s+.*\/glob\s+"\*/);
    for (const hit of hits) {
      ctx.add(
        "Security", "dispatcher", fp, hit.lineNum,
        "Overly Permissive Dispatcher Rule",
        "Dispatcher rule allows all requests with glob \"*\" — should be deny-by-default",
        ctx.context(fp, hit.lineNum), "CRITICAL",
        "Use deny-by-default pattern: start with /0001 { /type \"deny\" /glob \"*\" } then selectively allow.",
        "Medium", "Permissive rules expose admin paths, internal selectors, and content endpoints"
      );
    }

    // Check for missing sensitive path blocks
    const sensitivePatterns = [
      { path: "/crx", label: "CRX/DE" },
      { path: "/system/console", label: "OSGi Console" },
      { path: "/bin/querybuilder", label: "Query Builder Servlet" },
    ];

    for (const { path: sensPath, label } of sensitivePatterns) {
      if (content.includes(sensPath) && content.includes('"deny"')) continue;
      // Only flag if file looks like a filter file
      if (fp.includes("filter") || fp.includes("rules")) {
        // Check if the sensitive path is blocked somewhere
        if (!content.includes(sensPath)) {
          ctx.add(
            "Security", "dispatcher", fp, 1,
            "Missing Dispatcher Deny Rule",
            `No explicit deny rule for ${label} (${sensPath}) in dispatcher filters`,
            "", "HIGH",
            `Add deny rule: { /type "deny" /url "${sensPath}*" } to block access to ${label}.`,
            "Low", `Exposed ${label} allows unauthorized access to admin functions`
          );
        }
      }
    }
  }
}

// ==================== AEMCS-SEC-003: XSS in HTL Templates ====================

export function scanHtlXss(ctx: AemScannerContext): void {
  for (const fp of ctx.htlFiles()) {
    // Check for unescaped output: ${ ... @ context='unsafe' } or ${ ... @ context='html' }
    const unsafeHits = ctx.grep(fp, /\$\{.*@\s*context\s*=\s*['"]unsafe['"]/);
    for (const hit of unsafeHits) {
      ctx.add(
        "Security", ctx.module(fp), fp, hit.lineNum,
        "HTL Unsafe Context",
        "HTL expression uses context='unsafe' — disables XSS protection entirely",
        ctx.context(fp, hit.lineNum), "CRITICAL",
        "Remove @context='unsafe'. Use appropriate context: 'html', 'text', 'attribute', 'uri', 'scriptString'.",
        "Low", "Unsafe context bypasses all XSS protection"
      );
    }

    // Check for data-sly-text="${...}" without proper context (it auto-escapes but check scriptString)
    // Main risk is in href/src attributes with user data
    const hrefHits = ctx.grep(fp, /(?:href|src|action)\s*=\s*"\$\{[^}]*(?!@\s*context\s*=\s*['"]uri)/);
    for (const hit of hrefHits) {
      if (hit.lineText.includes("@context")) continue; // already has context
      ctx.add(
        "Security", ctx.module(fp), fp, hit.lineNum,
        "HTL URI Without Context",
        "Dynamic href/src/action attribute without explicit @context='uri' — potential open redirect",
        ctx.context(fp, hit.lineNum), "MEDIUM",
        "Add @context='uri' to href/src attributes with dynamic values to prevent javascript: injection.",
        "Low", "Missing URI context allows javascript: pseudo-protocol injection"
      );
    }
  }
}

// ==================== AEMCS-SEC-004: Overly Permissive Service User ====================

export function scanServiceUserPermissions(ctx: AemScannerContext): void {
  const repoinitFiles = ctx.repoinitFiles();

  for (const fp of repoinitFiles) {
    const content = ctx.read(fp);

    // Check for broad ACL grants
    const broadHits = ctx.grep(fp, /set\s+ACL\s+.*allow.*jcr:all|set\s+ACL.*allow.*rep:write.*on\s+\//);
    for (const hit of broadHits) {
      ctx.add(
        "Security", ctx.module(fp), fp, hit.lineNum,
        "Overly Broad Service User ACL",
        "Service user granted jcr:all or rep:write on root — violates least-privilege",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Grant only required privileges (jcr:read, rep:write) on specific subtrees.",
        "Low", "Broad ACLs allow service account to modify any content"
      );
    }

    // Check for admin-like permissions on /content root
    const rootHits = ctx.grep(fp, /allow.*on\s+\/\s*$/);
    for (const hit of rootHits) {
      ctx.add(
        "Security", ctx.module(fp), fp, hit.lineNum,
        "Service User ACL on Root",
        "Service user has permissions on repository root (/) — should be scoped to specific paths",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Scope ACLs to specific subtrees: /content/<project>, /conf/<project>, /var/<project>.",
        "Low", "Root permissions are a privilege escalation risk"
      );
    }
  }
}
