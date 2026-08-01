/**
 * Commerce — XML config scan
 * ===========================
 * Runs the shared generic + Adobe XML rules over Adobe Commerce (Magento 2)
 * config: `etc/*.xml` (di.xml, webapi.xml, module.xml, events.xml, config.xml,
 * acl.xml, crontab.xml, indexer.xml). Returns normalized Finding[] tagged with
 * `stack: 'commerce-paas'`.
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

const COMMERCE_XML_GLOBS = [
  "**/etc/*.xml",
  "**/etc/**/*.xml",
  "**/app/code/**/etc/*.xml",
  "**/app/code/**/etc/**/*.xml",
];

const DEFAULT_IGNORE = [
  "**/vendor/**",
  "**/node_modules/**",
  "**/generated/**",
  "**/var/**",
  "**/pub/static/**",
];

export async function scanCommerceXml(projectRoot: string): Promise<Finding[]> {
  const files = fg.sync(
    COMMERCE_XML_GLOBS.map((g) => path.join(projectRoot, g).replace(/\\/g, "/")),
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
          f.stack ??= "commerce-paas";
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
