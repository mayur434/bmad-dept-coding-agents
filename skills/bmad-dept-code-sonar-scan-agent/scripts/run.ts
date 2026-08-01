#!/usr/bin/env ts-node
/**
 * BMAD Sonar Scan Agent — Dispatcher
 * ====================================
 * Two-step flow:
 *   Step 1 (LLM, via SKILL.md): writes sonar-findings.json
 *   Step 2 (this script, --ingest): JSON → Finding[] → ratings → standardized xlsx
 *
 * Usage:
 *   npx ts-node run.ts --ingest sonar-findings.json --path /project
 *   npx ts-node run.ts --ingest sonar-findings.json --path /project --engine spring
 *   npx ts-node run.ts --ingest sonar-findings.json --path /project --role security
 *   npx ts-node run.ts --path /project --preflight
 *   npx ts-node run.ts --list-engines
 */

import { resolve, join, basename } from "path";
import { existsSync } from "fs";
import { PROFILES, profileById, detectProfile } from "./engines/profiles";
import { ingest } from "./sonar/ingest";
import { runPreflight, renderPreflight } from "../../shared/preflight";
import { resolveRole, parseRoleFlag } from "../../shared/role";

interface Args {
  path: string;
  engine: string | null;
  ingestJson: string | null;
  output: string | null;
  role: string | undefined;
  listEngines: boolean;
  preflight: boolean;
  noPreflight: boolean;
  createBranch: boolean;
  sourceBranch: string | null;
}

function parseArgs(): Args {
  const a: Args = {
    path: ".",
    engine: null,
    ingestJson: null,
    output: null,
    role: undefined,
    listEngines: false,
    preflight: false,
    noPreflight: false,
    createBranch: false,
    sourceBranch: null,
  };
  const argv = process.argv.slice(2);
  // --role=<code> and --role <code> are both handled by the shared helper.
  a.role = parseRoleFlag(argv);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    // Swallow --role tokens (already captured by parseRoleFlag) so the
    // switch below doesn't misinterpret them.
    if (arg === "--role" && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      i++;
      continue;
    }
    if (arg.startsWith("--role=")) {
      continue;
    }
    switch (arg) {
      case "--path": a.path = argv[++i]; break;
      case "--engine": a.engine = argv[++i]; break;
      case "--ingest": a.ingestJson = argv[++i]; break;
      case "--output": a.output = argv[++i]; break;
      case "--list-engines": a.listEngines = true; break;
      case "--preflight": a.preflight = true; break;
      case "--no-preflight": a.noPreflight = true; break;
      case "--create-branch": a.createBranch = true; break;
      case "--source-branch": a.sourceBranch = argv[++i]; break;
      case "--help":
        console.log(`BMAD Sonar Scan Agent

Usage:
  npx ts-node run.ts --ingest <findings.json> --path <dir> [options]
  npx ts-node run.ts --path <dir> --preflight

Options:
  --ingest <json>        Path to sonar-findings.json (from the LLM scan step)
  --path <dir>           Project root (default: .)
  --engine <id>          Force a stack (auto-detected from findings JSON if omitted)
  --output <dir>         Report output dir (default: <path>/sonar-reports)
  --role <code>          Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content
                         Persisted at <path>/.bmad/role.yaml (see shared/role/ROLES.md).
                         Per-run flag wins over the file; if omitted, .bmad/role.yaml
                         is read; if that is absent, falls back to 'generic'.
                         On --ingest, this OVERRIDES the 'role' field recorded inside
                         sonar-findings.json (a WARN is logged when they differ).
                         Without --ingest (scan step), the role is only recorded/logged;
                         the LLM records the acting role in sonar-findings.json.
  --create-branch        Cut standard branch dca/sonar-scan-<stack>-<timestamp>
                         (takes effect only with --ingest)
  --source-branch <name> Source branch for --create-branch
  --preflight            Print LLM/context advisory and exit
  --no-preflight         Suppress the preflight advisory
  --list-engines         List available rule packs (one per stack)
  --help                 Show this help`);
        process.exit(0);
    }
  }
  return a;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.listEngines) {
    console.log("Available sonar-scan rule packs:\n");
    for (const p of PROFILES) {
      console.log(`  ${p.id.padEnd(16)} ${p.name.padEnd(36)} [${p.language}]`);
    }
    console.log("  (aliases: aemcs, aemams → aem; commerce → commerce-paas)");
    return;
  }

  const projectPath = resolve(args.path);
  if (!existsSync(projectPath)) {
    console.error(`❌ Project path not found: ${projectPath}`);
    process.exit(1);
  }

  // ── Role resolution (metadata for the report + downstream chaining) ──
  // Order: --role flag  >  <projectRoot>/.bmad/role.yaml  >  generic fallback.
  // In the scan step (no --ingest) the role is only recorded/logged; the LLM
  // records the acting role into sonar-findings.json at Step 1.
  // In the ingest step the resolved role wins over the JSON's role field
  // (see ingest.ts for the WARN on mismatch).
  let resolvedRoleCode = "generic";
  try {
    const resolved = resolveRole({
      projectRoot: projectPath,
      cliFlag: args.role,
      fallbackToGeneric: true,
    });
    resolvedRoleCode = resolved.role.code;
    process.env.DCA_ROLE = resolved.role.code;
    process.env.DCA_ROLE_NAME = resolved.role.name;
    process.env.DCA_ROLE_FLAVOR = resolved.role.defaultOutputFlavor;
    process.env.DCA_ROLE_SOURCE = resolved.source;
    process.stderr.write(
      `[dca-role] ${resolved.role.name} (source: ${resolved.source})\n`,
    );
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }

  // Preflight (advisory only — prints but does not block)
  if (!args.noPreflight) {
    console.log("\n" + renderPreflight(runPreflight(projectPath), { agent: "sonar-scan" }));
    if (args.preflight) return;
  }

  if (!args.ingestJson) {
    console.error("❌ --ingest <findings.json> is required for Step 2.");
    console.error("   Run the LLM scan step first (via BMAD skill workflow) to produce sonar-findings.json.");
    process.exit(1);
  }

  // Resolve stack profile
  const profile = args.engine
    ? profileById(args.engine)
    : detectProfile(projectPath);

  if (!profile) {
    console.error(`❌ Could not resolve a stack profile. Use --engine <id> (see --list-engines).`);
    process.exit(1);
  }

  const outputDir = args.output ?? join(projectPath, "sonar-reports");

  await ingest({
    jsonPath: resolve(args.ingestJson),
    projectRoot: projectPath,
    profile,
    outputDir,
    argv: process.argv,
    role: resolvedRoleCode,
    roleFromCli: args.role !== undefined && args.role !== "",
  });
}

main().catch((err) => {
  console.error("❌ Fatal error:", (err as Error).message);
  process.exit(1);
});
