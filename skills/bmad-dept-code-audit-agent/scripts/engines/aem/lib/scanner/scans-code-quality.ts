/**
 * Code Quality Scans for AEM Projects
 * Detects: printStackTrace, System.out, generic catches, WCMUsePojo,
 * deprecated APIs, coding standards, naming conventions, dead code
 */
import { ScanContext } from './types';

export function scanCodeQuality(ctx: ScanContext, java: string[], xml: string[], htl: string[]): void {
  for (const f of java) {
    const mod = ctx.module(f);
    const content = ctx.read(f);
    if (!content) continue;

    // printStackTrace usage
    for (const hit of ctx.grep(f, /\.printStackTrace\s*\(\)/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'Using printStackTrace() Instead of Logger',
        'printStackTrace() dumps to System.err which is NOT captured in AEM\'s error.log. When this code fails in production, you won\'t find the error in Splunk/ELK/Cloud Manager logs.',
        ctx.context(f, hit.lineNum), 'HIGH',
        'Replace with: LOG.error("Description of what failed", exception); — where LOG is a SLF4J Logger. This gives you log level control, timestamps, and searchable output.', 'Low',
        'Production errors become invisible — you can\'t diagnose issues without connecting directly to the server');
    }

    // System.out / System.err
    for (const hit of ctx.grep(f, /System\.(out|err)\.(print|println)\s*\(/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'System.out.println (Not Logged Properly)',
        'System.out goes to stdout, not AEM\'s logging system. You can\'t set log levels, filter, or search these messages in production log tools.',
        ctx.context(f, hit.lineNum), 'HIGH',
        'Replace with SLF4J logger: private static final Logger LOG = LoggerFactory.getLogger(YourClass.class); then use LOG.debug()/info()/error() as appropriate.', 'Low',
        'Debug output clutters server stdout with no way to turn it off; log management tools can\'t capture or alert on these messages');
    }

    // Generic catch blocks (skip test files — tests often catch broadly for assertion purposes)
    if (!f.includes('/test/') && !f.includes('Test.java') && !f.includes('IT.java')) {
      for (const hit of ctx.grep(f, /catch\s*\(\s*Exception\s+\w+\s*\)/)) {
        // Skip if this is a top-level servlet/service catch (intentional safety net with logging)
        const catchBlock = content.split('\n').slice(hit.lineNum - 1, hit.lineNum + 5).join('\n');
        const hasLogging = /LOG\.|log\.|logger\.|LOGGER\./i.test(catchBlock);
        if (!hasLogging) {
          ctx.add('Code Quality', mod, f, hit.lineNum,
            'Catching Generic Exception (Hides Real Errors)',
            'Catching the base Exception class hides what actually went wrong. A NullPointerException (bug) and an IOException (network issue) need different handling but both get swallowed the same way here.',
            ctx.context(f, hit.lineNum), 'MEDIUM',
            'Catch specific exceptions: catch (RepositoryException e) for JCR issues, catch (IOException e) for I/O. Add a final catch (Exception e) only as a last-resort safety net with LOG.error().', 'Low');
        }
      }
    }

    // Empty catch blocks
    for (const hit of ctx.grep(f, /catch\s*\([^)]+\)\s*\{\s*\}/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'Empty Catch Block (Error Silently Ignored)',
        'An exception is caught and completely ignored. If something goes wrong in this code, you\'ll never know — no error in logs, no alert, the page just silently breaks.',
        ctx.context(f, hit.lineNum), 'CRITICAL',
        'At minimum: LOG.error("Failed to [describe operation]", e); If you intentionally want to ignore, add a comment explaining why: // Expected when resource doesn\'t exist', 'Low',
        'Bugs become impossible to diagnose. Features fail silently and users report broken pages with no error trail to follow.');
    }

    // WCMUsePojo usage (deprecated pattern)
    for (const hit of ctx.grep(f, /extends\s+WCMUsePojo/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'WCMUsePojo (Deprecated — Use Sling Models)',
        'WCMUsePojo is the old way to write component logic. It\'s tightly coupled to the request, can\'t be unit tested easily, and is not supported in AEM as a Cloud Service.',
        ctx.context(f, hit.lineNum), 'HIGH',
        'Rewrite as a Sling Model: @Model(adaptables=Resource.class) with @ValueMapValue/@ChildResource injections. This gives you unit testability with AEM Mocks and is future-proof for Cloud.', 'High',
        'Cannot unit test without a full AEM instance running; blocks Cloud Service migration; new AEM features (Content Fragments, headless) don\'t support WCMUsePojo');
    }

    // @SlingServlet deprecated annotation
    for (const hit of ctx.grep(f, /@SlingServlet/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        '@SlingServlet Annotation (Deprecated Since AEM 6.3)',
        '@SlingServlet uses Felix SCR which is removed in newer AEM versions. This code won\'t compile against AEM as a Cloud Service SDK.',
        ctx.context(f, hit.lineNum), 'HIGH',
        'Replace with OSGi DS: @Component(service = Servlet.class, property = {"sling.servlet.resourceTypes=myapp/components/mycomp", "sling.servlet.methods=GET"})', 'Medium',
        'Blocks AEM Cloud Service migration; Felix SCR plugin is no longer maintained and will stop working in future AEM versions');
    }

    // @SlingFilter deprecated
    for (const hit of ctx.grep(f, /@SlingFilter/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'Deprecated @SlingFilter Annotation',
        '@SlingFilter is deprecated — use OSGi DS annotations',
        ctx.context(f, hit.lineNum), 'HIGH',
        'Replace with @Component(service=Filter.class) and proper OSGi DS annotations.', 'Medium');
    }

    // SCR annotations (Felix)
    for (const hit of ctx.grep(f, /import\s+org\.apache\.felix\.scr\.annotations\./)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'Felix SCR Annotations (Deprecated)',
        'Using Apache Felix SCR annotations — should use OSGi DS (R7) annotations',
        ctx.context(f, hit.lineNum), 'HIGH',
        'Migrate to org.osgi.service.component.annotations (OSGi DS R7). Use bnd-maven-plugin.', 'Medium',
        'Felix SCR plugin removed in AEMaaCS');
    }

    // God class detection
    const lineCount = content.split('\n').length;
    if (lineCount > ctx.thresholds.god_class_lines) {
      ctx.add('Code Quality', mod, f, 1,
        `God Class (${lineCount} lines)`,
        `File has ${lineCount} lines — exceeds threshold of ${ctx.thresholds.god_class_lines}. Likely has too many responsibilities.`,
        '', 'MEDIUM',
        'Refactor into smaller, focused classes following Single Responsibility Principle.', 'High',
        'Hard to maintain, test, and understand');
    }

    // Too many methods
    const methodMatches = content.match(/\b(public|private|protected)\s+\w+[\s<].*\([^)]*\)\s*(throws\s+[\w,\s]+)?\s*\{/g);
    if (methodMatches && methodMatches.length > ctx.thresholds.max_methods_per_class) {
      ctx.add('Code Quality', mod, f, 1,
        `Too Many Methods (${methodMatches.length})`,
        `Class has ${methodMatches.length} methods — exceeds threshold of ${ctx.thresholds.max_methods_per_class}`,
        '', 'LOW',
        'Consider splitting into focused classes with fewer responsibilities.', 'High');
    }

    // Unused imports (basic detection — skip wildcard, annotations, and common FP cases)
    const imports: { name: string; line: number }[] = [];
    for (const hit of ctx.grep(f, /^import\s+([\w.]+)\s*;/)) {
      const importPath = hit.match[1];
      const className = importPath.split('.').pop() || '';
      // Skip wildcard imports, annotations (often only used in annotations not caught by word boundary)
      if (className && className !== '*' && !importPath.includes('.annotation.')) {
        imports.push({ name: className, line: hit.lineNum });
      }
    }
    // Check usage — require at least 2 occurrences (import line + actual use)
    // Use word boundary but also check for usage in annotations and generics
    for (const imp of imports) {
      const nameRegex = new RegExp(`(?:@${imp.name}|<${imp.name}|\\b${imp.name}\\b)`, 'g');
      const occurrences = (content.match(nameRegex) || []).length;
      if (occurrences <= 1) { // Only the import statement itself
        ctx.add('Code Quality', mod, f, imp.line,
          'Unused Import',
          `Import '${imp.name}' appears unused in file`,
          '', 'LOW',
          'Remove unused imports to keep code clean. IDEs can auto-fix this (Ctrl+Shift+O in Eclipse, Ctrl+Alt+O in IntelliJ).', 'Low',
          undefined, 'Needs Review', 'May be a false positive if used only in Javadoc @link, generics type erasure, or reflection');
      }
    }

    // TODO/FIXME/HACK comments
    for (const hit of ctx.grep(f, /\/\/\s*(TODO|FIXME|HACK|XXX|TEMP)[:.]?\s*(.*)/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'Technical Debt Marker',
        `${hit.match[1]}: ${(hit.match[2] || '').substring(0, 100)}`,
        ctx.context(f, hit.lineNum), 'LOW',
        'Address TODO/FIXME comments or create backlog tickets to track them.', 'Low');
    }

    // Hardcoded paths (skip OSGi config classes, constants classes, and test fixtures)
    if (!f.includes('/test/') && !f.includes('Test.java') && !f.includes('Constants.java') && !f.includes('Config.java')) {
      for (const hit of ctx.grep(f, /"\/content\/[^"]+"|"\/etc\/[^"]+"|"\/apps\/[^"]+"/)) {
        // Skip if it's a constant definition meant to be configurable (has final static)
        const line = content.split('\n')[hit.lineNum - 1] || '';
        if (/static\s+final|final\s+static/.test(line) && /String\s+[A-Z_]+/.test(line)) continue;
        ctx.add('Code Quality', mod, f, hit.lineNum,
          'Hardcoded Content Path',
          'JCR path is hardcoded directly in logic. If this path differs between environments (dev/stage/prod) or changes during a content migration, this code breaks.',
          ctx.context(f, hit.lineNum), 'MEDIUM',
          'Externalize to an OSGi configuration property so it can be changed per environment without code changes. Use @Designate + @ObjectClassDefinition for type-safe config.', 'Medium',
          'Breaks across environments; hard to maintain during content restructuring',
          'Needs Review', 'False positive if the path is a well-known AEM system path that never changes (e.g., /content/dam root)');
      }
    }

    // Magic numbers
    for (const hit of ctx.grep(f, /\b(?:timeout|limit|max|size|count|capacity)\s*[=<>]+\s*\d{2,}/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'Magic Number',
        'Hardcoded numeric value — should be an OSGi configuration or constant',
        ctx.context(f, hit.lineNum), 'LOW',
        'Extract to named constant or OSGi configuration property.', 'Low');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SonarQube-Style Code Quality Patterns
    // ═══════════════════════════════════════════════════════════════════════════

    // Cognitive Complexity: deeply nested blocks (> max_nested_depth)
    let maxNesting = 0;
    let maxNestingLine = 0;
    let currentNesting = 0;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      currentNesting += opens - closes;
      if (currentNesting > maxNesting) {
        maxNesting = currentNesting;
        maxNestingLine = i + 1;
      }
    }
    if (maxNesting > (ctx.thresholds.max_nested_depth || 4) + 2) {
      ctx.add('Code Quality', mod, f, maxNestingLine,
        `High Cognitive Complexity (Nesting Depth: ${maxNesting})`,
        `Code nesting reaches ${maxNesting} levels deep. This makes the logic extremely hard to follow and indicates the method is doing too much. Each level of nesting multiplies the mental effort to understand the code.`,
        ctx.context(f, maxNestingLine), maxNesting > 8 ? 'HIGH' : 'MEDIUM',
        'Refactor deeply nested code: extract inner blocks into separate methods, use early returns (guard clauses), or apply the Strategy pattern. Target max nesting of 3-4 levels.',
        'High', 'Maintenance nightmare — every bug fix in this area risks introducing new bugs');
    }

    // Fat Constructor (too many dependencies injected)
    for (const hit of ctx.grep(f, /(?:public|protected)\s+\w+\s*\([^)]{100,}\)/)) {
      const params = hit.lineText.split(',');
      if (params.length > (ctx.thresholds.max_constructor_deps || 8)) {
        ctx.add('Code Quality', mod, f, hit.lineNum,
          `Fat Constructor (${params.length} dependencies)`,
          `Constructor injects ${params.length} dependencies — this class has too many responsibilities. A class with this many dependencies is nearly impossible to unit test properly.`,
          ctx.context(f, hit.lineNum), 'MEDIUM',
          'Split the class by responsibility. Group related dependencies into a separate service class. Apply the Single Responsibility Principle.', 'High',
          'Indicates the class is doing too much; hard to test and maintain');
      }
    }

    // Mutable static fields (thread-safety issue)
    for (const hit of ctx.grep(f, /static\s+(?!final\s)(?:private|protected|public)?\s*(?:List|Map|Set|Collection|Array|StringBuilder|StringBuffer|int|long|boolean|String)\s+\w+/)) {
      if (!hit.lineText.includes('final') && !hit.lineText.includes('Logger') && !hit.lineText.includes('LOG')) {
        ctx.add('Code Quality', mod, f, hit.lineNum,
          'Mutable Static Field (Thread-Safety Risk)',
          'Non-final static field can be modified by multiple threads simultaneously in OSGi. AEM services are singletons — shared mutable state causes race conditions, data corruption, and intermittent bugs that are extremely hard to reproduce.',
          ctx.context(f, hit.lineNum), 'HIGH',
          'Make the field final (immutable), use ThreadLocal, or move to an instance field injected via OSGi. For caches, use a concurrent data structure (ConcurrentHashMap).', 'Medium',
          'Race conditions in production — intermittent failures that are nearly impossible to debug');
      }
    }

    // String concatenation in loops
    for (const hit of ctx.grep(f, /(?:for|while)\s*\([^)]*\)\s*\{[^}]*\+=\s*"[^}]*\}/s)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'String Concatenation in Loop',
        'Using += for String inside a loop creates a new String object every iteration. For large datasets, this causes O(n²) memory allocation and GC pressure.',
        ctx.context(f, hit.lineNum), 'MEDIUM',
        'Use StringBuilder: StringBuilder sb = new StringBuilder(); for(...) { sb.append(...); } return sb.toString();', 'Low',
        'Performance degradation with large datasets; excessive GC activity');
    }

    // NullPointerException catch (indicates missing null checks)
    for (const hit of ctx.grep(f, /catch\s*\(\s*NullPointerException/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'Catching NullPointerException (Code Smell)',
        'Catching NPE instead of preventing it. This hides bugs — a NullPointerException means your code has a logic error that should be fixed, not caught.',
        ctx.context(f, hit.lineNum), 'HIGH',
        'Add null checks before the code that throws: if (resource != null) { ... }. Use Optional<> for APIs that may return null. Never catch NPE as a flow control mechanism.', 'Medium',
        'Masks actual bugs in the code; makes debugging extremely difficult');
    }

    // Thread.sleep in non-test code
    if (!f.includes('/test/') && !f.includes('Test.java')) {
      for (const hit of ctx.grep(f, /Thread\.sleep\s*\(/)) {
        ctx.add('Code Quality', mod, f, hit.lineNum,
          'Thread.sleep() in Production Code',
          'Thread.sleep() blocks the thread, wastes resources, and is never the right solution in a web application. In AEM, a sleeping thread holds an HTTP thread from the pool, potentially causing thread starvation.',
          ctx.context(f, hit.lineNum), 'HIGH',
          'Use Sling Jobs for delayed processing, Sling Scheduler for periodic tasks, or CompletableFuture for async operations. Never sleep on a request thread.', 'Medium',
          'Can cause thread pool exhaustion under load, leading to 503 errors');
      }
    }

    // Synchronized on this or class (coarse locking)
    for (const hit of ctx.grep(f, /synchronized\s*\(\s*(?:this|[A-Z]\w+\.class)\s*\)/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'Coarse-Grained Synchronization',
        'Synchronizing on "this" or the class object locks the entire instance/class for all threads. In an OSGi service (singleton), this creates a bottleneck where all requests queue up.',
        ctx.context(f, hit.lineNum), 'MEDIUM',
        'Use a dedicated private final Object lock = new Object(); or better, use java.util.concurrent classes (ConcurrentHashMap, AtomicReference, ReadWriteLock).', 'Medium',
        'Performance bottleneck under concurrent load');
    }

    // Returning null from public methods
    for (const hit of ctx.grep(f, /public\s+(?:String|Object|Resource|Page|Asset)\s+\w+\s*\([^)]*\)\s*\{/)) {
      // Check if method body contains "return null"
      const methodStart = hit.lineNum;
      const methodLines = lines.slice(methodStart - 1, Math.min(methodStart + 30, lines.length));
      const methodBody = methodLines.join('\n');
      if (methodBody.includes('return null;') && !methodBody.includes('Optional') && !methodBody.includes('@Nullable')) {
        ctx.add('Code Quality', mod, f, methodStart,
          'Public Method Returns null Without @Nullable',
          'Public method can return null without documenting it. Callers have no way to know they need null-checking, leading to unexpected NullPointerExceptions in production.',
          ctx.context(f, methodStart), 'LOW',
          'Return Optional<T> instead, or annotate with @Nullable. For collections, return empty collections (Collections.emptyList()) instead of null.', 'Medium',
          'NPE risk for all callers of this method');
      }
    }

    // Deprecated API usage detection (AEM-specific)
    const deprecatedApis = [
      { pattern: /import\s+com\.day\.cq\.commons\.jcr\.JcrUtil/, name: 'JcrUtil (com.day)', replacement: 'JcrUtils from org.apache.jackrabbit.commons' },
      { pattern: /import\s+com\.day\.cq\.wcm\.api\.WCMMode/, name: 'WCMMode in Java (use HTL context)', replacement: 'Handle via Sling Model / HTL data-sly-test' },
      { pattern: /PageManager\s+pm\s*=.*adaptTo\s*\(\s*PageManager\.class\s*\)/, name: 'Direct PageManager adapt (use injection)', replacement: '@Inject PageManager pageManager in Sling Model' },
      { pattern: /import\s+org\.apache\.sling\.commons\.scheduler\.Scheduler/, name: 'Sling Commons Scheduler (unreliable in Cloud)', replacement: 'Sling Jobs for guaranteed execution' },
    ];

    for (const api of deprecatedApis) {
      for (const hit of ctx.grep(f, api.pattern)) {
        ctx.add('Code Quality', mod, f, hit.lineNum,
          `Deprecated/Problematic API: ${api.name}`,
          `Using ${api.name} which is deprecated or has known issues in modern AEM versions.`,
          ctx.context(f, hit.lineNum), 'MEDIUM',
          `Replace with: ${api.replacement}`, 'Medium',
          'May break during AEM upgrade or Cloud migration');
      }
    }
  }

  // HTL code quality
  for (const f of htl) {
    const mod = ctx.module(f);
    const content = ctx.read(f);
    if (!content) continue;

    // Inline JavaScript in HTL (only flag scripts WITHOUT src — the regex already excludes src but double-check)
    for (const hit of ctx.grep(f, /<script[^>]*>/)) {
      // Skip external scripts (have src attribute) and HTL-generated JSON (type="application/json")
      if (hit.lineText.includes('src=') || hit.lineText.includes('type="application/json"') ||
          hit.lineText.includes('type="application/ld+json"')) continue;
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'Inline JavaScript in HTL',
        'Inline <script> block in an HTL template. This mixes logic with markup, can\'t be cached separately by the browser, and violates Content Security Policy (CSP) if enabled.',
        ctx.context(f, hit.lineNum), 'MEDIUM',
        'Move JavaScript to a client library (ui.frontend). Pass data from HTL to JS using data-attributes: <div data-config="${model.jsonConfig}"> then read in JS with element.dataset.config.', 'Medium');
    }

    // Inline CSS styles
    for (const hit of ctx.grep(f, /style\s*=\s*"/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'Inline CSS Style',
        'Inline styles reduce maintainability and cacheability',
        ctx.context(f, hit.lineNum), 'LOW',
        'Move styles to CSS client libraries.', 'Low');
    }

    // data-sly-use with Java class path (should use Sling Model)
    for (const hit of ctx.grep(f, /data-sly-use\.\w+\s*=\s*"[^"]*\.java"/)) {
      ctx.add('Code Quality', mod, f, hit.lineNum,
        'Direct Java Class Reference in HTL',
        'HTL using direct Java class reference instead of Sling Model',
        ctx.context(f, hit.lineNum), 'MEDIUM',
        'Use Sling Models with @Model annotation. Reference by resource type.', 'Medium');
    }
  }
}
