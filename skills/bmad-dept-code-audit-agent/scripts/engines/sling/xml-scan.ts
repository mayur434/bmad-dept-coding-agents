/**
 * Sling / Shaft — XML config scan
 * ================================
 * Runs the shared generic + Adobe XML rules over Sling/Shaft config: bundle
 * `META-INF/*.xml`, OSGi feature bundle descriptors, MDM/SAM configuration.
 * `feature.json` files are JSON — deliberately excluded from this XML pass.
 * Returns normalized Finding[] tagged with `stack: 'sling-shaft'`.
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

const SLING_XML_GLOBS = [
  "**/META-INF/*.xml",
  "**/META-INF/**/*.xml",
  "**/src/main/resources/**/*.xml",
  "**/*.content.xml",
];

const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/target/**",
  "**/build/**",
  "**/dist/**",
];

export async function scanSlingXml(projectRoot: string): Promise<Finding[]> {
  const files = fg.sync(
    SLING_XML_GLOBS.map((g) => path.join(projectRoot, g).replace(/\\/g, "/")),
    { ignore: DEFAULT_IGNORE, dot: true, onlyFiles: true },
  );

  const hasAst = await isXmlAstAvailable();
  const findings: Finding[] = [];
  let scanned = 0;
  const rules = [...GENERIC_XML_RULES, ...ADOBE_XML_RULES];

  for (const abs of files) {
    if (!abs.toLowerCase().endsWith(".xml")) continue;
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
          f.stack ??= "sling-shaft";
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
