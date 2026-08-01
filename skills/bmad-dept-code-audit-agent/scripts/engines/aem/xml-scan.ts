/**
 * AEM — XML config scan
 * ======================
 * Runs the shared generic + Adobe XML rules over the AEM project's XML sources:
 * `.content.xml`, dispatcher farms/vhosts, package install hooks. Complements
 * the Java AST pass in `ast-scan.ts`. Returns normalized Finding[] tagged with
 * `stack: 'aem'` so the shared 15-column contract holds.
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

const AEM_XML_GLOBS = [
  "**/.content.xml",
  "**/META-INF/**/.content.xml",
  "**/dispatcher/**/*.{any,vhost,farm,vhosts,farms}",
  "**/dispatcher/**/farms/**",
  "**/dispatcher/**/vhosts/**",
  "**/META-INF/vault/**/*.xml",
  "**/META-INF/hooks/**/install-hook.xml",
];

const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/target/**",
  "**/build/**",
  "**/dist/**",
  "**/generated/**",
];

/**
 * Scan XML config files in an AEM project. Returns findings from all shared
 * generic + Adobe rules. Always returns a Finding[] (empty on failure).
 */
export async function scanAemXml(projectRoot: string): Promise<Finding[]> {
  const files = fg.sync(
    AEM_XML_GLOBS.map((g) => path.join(projectRoot, g).replace(/\\/g, "/")),
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
          f.stack ??= "aem";
          findings.push(f);
        }
      } catch {
        /* one bad rule must never abort the scan */
      }
    }
    scanned++;
  }

  process.stderr.write(
    `[audit-xml] scanned ${scanned} XML files in ${projectRoot} — ${findings.length} findings\n`,
  );
  return findings;
}
