/**
 * DCA Generation — scaffold orchestrator
 * =======================================
 * Runs a generator, writes files, and emits the standardized generation report
 * + CHANGE-LOG (listing generated files) via the shared foundation.
 */

import * as fs from "fs";
import * as path from "path";
import { emitStandardOutputs } from "../../../shared/output";
import { Finding } from "../../../shared/core/types";
import { GENERATORS, listTypes } from "./generators";

export { GENERATORS, listTypes } from "./generators";

export interface ScaffoldOptions {
  stack: string; // sling | spring | app-builder
  type: string;
  name: string;
  pkg?: string;
  projectRoot: string;
  outputDir?: string;
  dryRun?: boolean;
  force?: boolean;
}

/** Accept the other agents' engine IDs (aemcs/aemams → aem; commerce → commerce-paas). */
const STACK_ALIASES: Record<string, string> = { aemcs: "aem", aemams: "aem", commerce: "commerce-paas" };

export async function scaffold(opts: ScaffoldOptions): Promise<void> {
  opts.stack = STACK_ALIASES[opts.stack] ?? opts.stack;
  const gens = GENERATORS[opts.stack];
  if (!gens) {
    console.error(`❌ Unknown stack: ${opts.stack}. Available: ${Object.keys(GENERATORS).join(", ")}`);
    process.exit(1);
  }
  const gen = gens[opts.type];
  if (!gen) {
    console.error(`❌ Unknown type '${opts.type}' for ${opts.stack}. Available: ${listTypes(opts.stack).join(", ")}`);
    process.exit(1);
  }

  const files = gen({ name: opts.name, pkg: opts.pkg });
  const written: string[] = [];
  const skipped: string[] = [];

  for (const f of files) {
    const abs = path.join(opts.projectRoot, f.path);
    if (fs.existsSync(abs) && !opts.force) {
      skipped.push(f.path);
      console.log(`  ~ skipped (exists): ${f.path}`);
      continue;
    }
    if (!opts.dryRun) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, f.content, "utf8");
    }
    written.push(f.path);
    console.log(`${opts.dryRun ? "  [dry-run] " : "  + "}${f.path}`);
  }

  if (opts.dryRun) {
    console.log(`\n(dry-run) ${written.length} file(s) would be generated.`);
    return;
  }

  const findings: Finding[] = files.map((f) => ({
    title: `Generated ${opts.stack}/${opts.type}: ${f.path.split("/").pop()}`,
    description: `Scaffolded ${opts.type} for "${opts.name}".`,
    stack: opts.stack,
    category: opts.type,
    file: f.path,
    severity: "INFO",
    recommendation: "Review the generated code, wire dependencies, and add tests.",
    impact: "New artifact added to the codebase.",
    status: written.includes(f.path) ? "Generated" : "Skipped (exists)",
    source: "scanner",
  }));

  const outputDir = opts.outputDir ?? path.join(opts.projectRoot, "generation-reports");
  const res = await emitStandardOutputs({
    agent: "generation",
    meta: {
      agent: "generation",
      engine: opts.stack,
      stack: opts.stack,
      projectName: path.basename(opts.projectRoot),
      projectRoot: opts.projectRoot,
      extra: { Type: opts.type, Name: opts.name, Written: written.length, Skipped: skipped.length },
    },
    findings,
    outputDir,
    filesChanged: written,
    changelogSummary: `Generated ${written.length} file(s) for ${opts.stack}/${opts.type} "${opts.name}".`,
  });

  console.log(`\n📊 Report:     ${res.xlsxPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG: ${res.changelogPath}`);
}
