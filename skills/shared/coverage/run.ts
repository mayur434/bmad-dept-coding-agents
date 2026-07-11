/**
 * DCA Shared — Coverage runner (opt-in)
 * ======================================
 * Executes the project's real coverage tool per stack. Best-effort + gated behind
 * --run-coverage: it shells out to a real build (Maven/Gradle/Jest/nyc/PHPUnit),
 * which needs that toolchain present. On success the report is left where
 * discoverReport() finds it.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export interface RunResult { ran: boolean; command?: string; message: string; }

const JAVA = new Set(["aem", "aemcs", "aemams", "sling", "spring"]);
const JS = new Set(["app-builder", "eds", "eds-commerce", "commerce-saas"]);
const PHP = new Set(["commerce", "commerce-paas"]);

function has(root: string, rel: string): boolean { return fs.existsSync(path.join(root, rel)); }
function readPkg(root: string): any { try { return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")); } catch { return {}; } }

/** Pick + run the coverage command for the stack. Returns whether it ran. */
export function runCoverage(projectRoot: string, stack: string, timeoutMs = 600_000): RunResult {
  const cmd = commandFor(projectRoot, stack);
  if (!cmd) return { ran: false, message: `No coverage command for stack '${stack}' (or build files missing).` };
  try {
    execSync(cmd, { cwd: projectRoot, timeout: timeoutMs, stdio: "ignore" });
    return { ran: true, command: cmd, message: `Ran: ${cmd}` };
  } catch (e: any) {
    // Tests may "fail" yet still emit a coverage report — treat as ran-with-warnings.
    return { ran: true, command: cmd, message: `Ran with non-zero exit (report may still exist): ${cmd}` };
  }
}

function commandFor(root: string, stack: string): string | null {
  if (JAVA.has(stack)) {
    if (has(root, "pom.xml")) return "mvn -q -DskipITs test org.jacoco:jacoco-maven-plugin:report";
    if (has(root, "build.gradle") || has(root, "build.gradle.kts")) return "./gradlew test jacocoTestReport --console=plain";
    return null;
  }
  if (JS.has(stack)) {
    const pkg = readPkg(root);
    const dev = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (dev.jest || (pkg.scripts && /jest/.test(JSON.stringify(pkg.scripts))))
      return "npx jest --coverage --coverageReporters=json-summary --coverageReporters=lcov --passWithNoTests";
    if (dev.nyc || dev.c8) return "npx nyc --reporter=lcov --reporter=json-summary npm test";
    if (pkg.scripts && pkg.scripts.test) return "npm test -- --coverage";
    return null;
  }
  if (PHP.has(stack)) {
    if (has(root, "vendor/bin/phpunit")) return "vendor/bin/phpunit --coverage-clover clover.xml";
    return "phpunit --coverage-clover clover.xml";
  }
  return null;
}
