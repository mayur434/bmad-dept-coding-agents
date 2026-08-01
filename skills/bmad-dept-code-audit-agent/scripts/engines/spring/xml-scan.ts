/**
 * Spring Boot — XML config scan
 * ==============================
 * Runs the shared generic + Adobe XML rules (which include the SPRING-XML-*
 * subset) over legacy Spring XML configuration: `applicationContext*.xml`,
 * `spring-*.xml`, `web.xml`, `security.xml`. Modern Spring Boot projects use
 * annotation-based config and this pass returns 0 findings for them —
 * intentional: XML config is legacy and rare, but when present it's often the
 * highest-risk surface.
 */

import * as fs from "fs";
import fg from "fast-glob";
import path from "path";
import type { Finding } from "../../../../shared/core/types";
import {
  GENERIC_XML_RULES,
  ADOBE_XML_RULES,
  isXmlAstAvailable,
  parseXml,
} from "../../../../shared/xml";

const SPRING_XML_GLOBS = [
  "**/applicationContext*.xml",
  "**/spring-*.xml",
  "**/spring/*.xml",
  "**/spring/**/*.xml",
  "**/WEB-INF/web.xml",
  "**/WEB-INF/security.xml",
  "**/WEB-INF/*.xml",
];

const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/target/**",
  "**/build/**",
  "**/dist/**",
];

export async function scanSpringXml(projectRoot: string): Promise<Finding[]> {
  const files = fg.sync(
    SPRING_XML_GLOBS.map((g) => path.join(projectRoot, g).replace(/\\/g, "/")),
    { ignore: DEFAULT_IGNORE, dot: true, onlyFiles: true },
  );

  const hasAst = await isXmlAstAvailable();
  const findings: Finding[] = [];
  let scanned = 0;
  const rules = [...GENERIC_XML_RULES, ...ADOBE_XML_RULES];

  for (const abs of files) {
    let source = "";
    try {
      source = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const rel = path.relative(projectRoot, abs).replace(/\\/g, "/");
    let tree = null;
    if (hasAst) {
      try {
        tree = await parseXml(source, abs);
      } catch {
        tree = null;
      }
    }
    for (const rule of rules) {
      try {
        const got = rule(source, rel, tree);
        for (const f of got) {
          f.stack ??= "spring-boot";
          findings.push(f);
        }
      } catch {
        /* skip broken rule */
      }
    }
    scanned++;
  }

  process.stderr.write(
    `[audit-xml] scanned ${scanned} XML files in ${projectRoot} — ${findings.length} findings\n`,
  );
  return findings;
}
