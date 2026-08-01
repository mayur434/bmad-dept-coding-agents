/**
 * BMAD Test Coverage — Test Framework Auto-Detection
 * ====================================================
 * Reads `pom.xml`, `build.gradle(.kts)`, `package.json`, and `composer.json` to
 * determine which testing frameworks the target project actually depends on.
 * Multi-framework projects are common (e.g. JUnit + AEM Mocks, Jest +
 * @testing-library) so the return type is a *list* sorted by priority.
 *
 * Consumers use the highest-priority entry to shape LLM test-generation
 * instructions and Run-Info metadata. When nothing matches, callers fall back
 * to the engine's hardcoded default.
 *
 * Design principles:
 *   - Zero new deps: naive string / regex parsing. Malformed manifests silently
 *     yield an empty list — never throw.
 *   - Priority is intent-driven: primary test runner (jest, junit-jupiter,
 *     phpunit) > supplemental libraries (mockito, aem-mocks, mockery).
 */

import * as fs from "fs";
import * as path from "path";

export interface DetectedFramework {
  name: string;
  /** Version string as declared in the manifest, if extractable. */
  version?: string;
  /** Higher = more likely to be the primary test runner. */
  priority: number;
  /** Conventional test-source root for this framework. */
  testRoot: string;
  /** Fast-glob pattern matching this framework's test files. */
  filePattern: string;
}

// ---------------------------------------------------------------------------
// Framework metadata: priority + defaults.
// ---------------------------------------------------------------------------

const FW_META: Record<
  string,
  { priority: number; testRoot: string; filePattern: string }
> = {
  // Java — primary runners
  "junit-jupiter": { priority: 90, testRoot: "src/test/java", filePattern: "**/*Test.java" },
  junit: { priority: 80, testRoot: "src/test/java", filePattern: "**/*Test.java" },
  testng: { priority: 85, testRoot: "src/test/java", filePattern: "**/*Test.java" },
  // Java — supplemental
  mockito: { priority: 40, testRoot: "src/test/java", filePattern: "**/*Test.java" },
  "spring-test": { priority: 60, testRoot: "src/test/java", filePattern: "**/*Test.java" },
  "spring-boot-test": { priority: 70, testRoot: "src/test/java", filePattern: "**/*Test.java" },
  "aem-mocks": { priority: 55, testRoot: "src/test/java", filePattern: "**/*Test.java" },
  "sling-mocks": { priority: 55, testRoot: "src/test/java", filePattern: "**/*Test.java" },

  // JS — primary runners
  jest: { priority: 90, testRoot: "test", filePattern: "**/*.{test,spec}.{js,mjs,ts,tsx}" },
  vitest: { priority: 90, testRoot: "test", filePattern: "**/*.{test,spec}.{js,mjs,ts,tsx}" },
  mocha: { priority: 80, testRoot: "test", filePattern: "**/*.{test,spec}.{js,mjs,ts}" },
  // JS — supplemental
  "@testing-library/react": {
    priority: 50,
    testRoot: "test",
    filePattern: "**/*.{test,spec}.{js,jsx,tsx}",
  },

  // PHP — primary
  "phpunit/phpunit": { priority: 90, testRoot: "Test/Unit", filePattern: "**/*Test.php" },
  "magento/magento2-functional-testing-framework": {
    priority: 70,
    testRoot: "Test/Mftf",
    filePattern: "**/Test/*.xml",
  },
  "mockery/mockery": { priority: 40, testRoot: "Test/Unit", filePattern: "**/*Test.php" },
};

// ---------------------------------------------------------------------------
// Manifest parsing
// ---------------------------------------------------------------------------

function readSafe(fp: string): string {
  try {
    return fs.readFileSync(fp, "utf-8");
  } catch {
    return "";
  }
}

function parseJsonSafe<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Java (Maven pom.xml + Gradle build files). Extracts groupId:artifactId +
 * version. Matches both Maven `<dependency>` blocks and Gradle
 * `testImplementation "group:artifact:version"` lines.
 */
function detectJava(projectRoot: string): DetectedFramework[] {
  const results: DetectedFramework[] = [];
  const pom = readSafe(path.join(projectRoot, "pom.xml"));
  const gradleGroovy = readSafe(path.join(projectRoot, "build.gradle"));
  const gradleKts = readSafe(path.join(projectRoot, "build.gradle.kts"));
  const gradle = gradleGroovy + "\n" + gradleKts;

  const javaMap: Record<string, RegExp> = {
    "junit-jupiter": /junit-jupiter(?:-(?:api|engine|params))?/i,
    // JUnit 4 only (bare "junit" artifact); exclude any junit-jupiter neighbour.
    junit: /<artifactId>\s*junit\s*<\/artifactId>|["']junit:junit:/i,
    testng: /\btestng\b/i,
    mockito: /mockito-(?:core|junit-jupiter|inline)/i,
    "spring-boot-test": /spring-boot-(?:starter-)?test/i,
    "spring-test": /(?<!boot-)spring-test\b/i,
    "aem-mocks": /aem-mock(?:\.junit\d)?|io\.wcm\.testing\.aem-mock/i,
    "sling-mocks": /sling-mock|org\.apache\.sling\.testing\.sling-mock/i,
  };

  for (const [name, re] of Object.entries(javaMap)) {
    if (re.test(pom) || re.test(gradle)) {
      const version = extractJavaVersion(pom, gradle, name);
      results.push(build(name, version));
    }
  }
  return results;
}

function extractJavaVersion(pom: string, gradle: string, name: string): string | undefined {
  // Escape special chars in `name` FIRST, then substitute the hyphen for a
  // char-class so "junit-jupiter" also matches "junit_jupiter" or "junit.jupiter".
  const escaped = escapeRe(name).replace(/\\-/g, "[-._]?");
  const artifactRe = new RegExp(
    `<artifactId>[^<]*${escaped}[^<]*</artifactId>[\\s\\S]{0,300}?<version>([^<]+)</version>`,
    "i",
  );
  const m = pom.match(artifactRe);
  if (m) return m[1].trim();

  // Try Gradle string coordinates.
  const gradleRe = new RegExp(
    `["']([\\w.]+):[^:'"\\s]*${escapeRe(name)}[^:'"\\s]*:([^"'\\s]+)["']`,
    "i",
  );
  const g = gradle.match(gradleRe);
  if (g) return g[2].trim();

  return undefined;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Node (package.json). Reads `devDependencies` + `dependencies` +
 * `peerDependencies` for known framework identifiers.
 */
function detectJs(projectRoot: string): DetectedFramework[] {
  const raw = readSafe(path.join(projectRoot, "package.json"));
  const pkg = parseJsonSafe<{
    devDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  }>(raw);
  if (!pkg) return [];

  const merged: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  const jsNames = ["jest", "vitest", "mocha", "@testing-library/react"];
  const results: DetectedFramework[] = [];
  for (const name of jsNames) {
    if (merged[name]) {
      results.push(build(name, cleanVersion(merged[name])));
    }
  }
  return results;
}

/**
 * PHP (composer.json). Reads `require-dev` + `require` for phpunit / mockery /
 * MFTF.
 */
function detectPhp(projectRoot: string): DetectedFramework[] {
  const raw = readSafe(path.join(projectRoot, "composer.json"));
  const composer = parseJsonSafe<{
    require?: Record<string, string>;
    "require-dev"?: Record<string, string>;
  }>(raw);
  if (!composer) return [];

  const merged: Record<string, string> = {
    ...(composer.require ?? {}),
    ...(composer["require-dev"] ?? {}),
  };

  const phpNames = [
    "phpunit/phpunit",
    "magento/magento2-functional-testing-framework",
    "mockery/mockery",
  ];
  const results: DetectedFramework[] = [];
  for (const name of phpNames) {
    if (merged[name]) {
      results.push(build(name, cleanVersion(merged[name])));
    }
  }
  return results;
}

function cleanVersion(raw: string): string | undefined {
  if (!raw) return undefined;
  // Strip semver operators and comparators: ^1.2.3 → 1.2.3, ~5.9.0-M1 → 5.9.0-M1
  const m = raw.match(/[\d]+(?:\.[\dA-Za-z.-]+)*/);
  return m ? m[0] : raw;
}

function build(name: string, version?: string): DetectedFramework {
  const meta = FW_META[name] ?? {
    priority: 30,
    testRoot: "test",
    filePattern: "**/*.test.*",
  };
  return {
    name,
    version,
    priority: meta.priority,
    testRoot: meta.testRoot,
    filePattern: meta.filePattern,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const JAVA_STACKS = new Set(["aem", "sling", "spring"]);
const JS_STACKS = new Set(["app-builder", "commerce-saas", "eds", "eds-commerce"]);
const PHP_STACKS = new Set(["commerce", "commerce-paas"]);

/**
 * Detect testing frameworks in `projectRoot` for the given stack. Returns a
 * priority-sorted list (highest first); empty list means "nothing detected —
 * fall back to the engine default".
 */
export function detectFrameworks(
  projectRoot: string,
  stack: string,
): DetectedFramework[] {
  const s = (stack ?? "").toLowerCase();
  const all: DetectedFramework[] = [];

  // Java: pom.xml / build.gradle
  if (JAVA_STACKS.has(s) || fs.existsSync(path.join(projectRoot, "pom.xml"))) {
    all.push(...detectJava(projectRoot));
  }

  // JS: package.json (also relevant to some PHP-adjacent projects with dev tooling).
  if (
    JS_STACKS.has(s) ||
    fs.existsSync(path.join(projectRoot, "package.json"))
  ) {
    all.push(...detectJs(projectRoot));
  }

  // PHP: composer.json
  if (PHP_STACKS.has(s) || fs.existsSync(path.join(projectRoot, "composer.json"))) {
    all.push(...detectPhp(projectRoot));
  }

  // Dedup on name (Java + JS can both scan a mixed project); keep highest priority.
  const byName = new Map<string, DetectedFramework>();
  for (const f of all) {
    const prev = byName.get(f.name);
    if (!prev || f.priority > prev.priority) byName.set(f.name, f);
  }

  return Array.from(byName.values()).sort((a, b) => b.priority - a.priority);
}

/**
 * Render a Run-Info-friendly line:
 *   "junit-jupiter@5.9.0 (primary), aem-mocks@4.0.0"
 * Returns "" when the list is empty.
 */
export function renderRunInfoLine(frameworks: DetectedFramework[]): string {
  if (!frameworks || frameworks.length === 0) return "";
  return frameworks
    .map((f, i) => {
      const v = f.version ? `@${f.version}` : "";
      const primary = i === 0 ? " (primary)" : "";
      return `${f.name}${v}${primary}`;
    })
    .join(", ");
}
