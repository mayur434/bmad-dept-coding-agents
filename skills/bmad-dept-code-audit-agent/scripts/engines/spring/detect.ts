/**
 * Spring Boot detection (Maven + Gradle)
 * =======================================
 */

import * as fs from "fs";
import * as path from "path";

function read(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

export function detectSpringBoot(root: string): boolean {
  const pom = read(path.join(root, "pom.xml"));
  const gradle = read(path.join(root, "build.gradle")) + read(path.join(root, "build.gradle.kts"));
  const build = pom + "\n" + gradle;

  if (/spring-boot-starter|spring-boot-maven-plugin|spring-boot-gradle-plugin|org\.springframework\.boot|io\.spring\.dependency-management/i.test(build)) {
    return true;
  }
  // Fallback: @SpringBootApplication somewhere in sources.
  return javaHas(root, /@SpringBootApplication\b/);
}

function javaHas(root: string, re: RegExp): boolean {
  const src = path.join(root, "src");
  if (!fs.existsSync(src)) return false;
  let budget = 80;
  const walk = (dir: string): boolean => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const e of entries) {
      if (budget-- <= 0) return false;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "target" || e.name === "build" || e.name === "node_modules") continue;
        if (walk(full)) return true;
      } else if (e.name.endsWith(".java") && re.test(read(full))) {
        return true;
      }
    }
    return false;
  };
  return walk(src);
}
