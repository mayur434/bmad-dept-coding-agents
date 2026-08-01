#!/usr/bin/env ts-node
/**
 * BMAD Code Generation Agent — Dispatcher
 * =========================================
 * Entry point for the code generation engine.
 * Includes MCP setup automation for zero-config consumer experience.
 */

import * as fs from "fs";
import * as path from "path";
import { scaffold, GENERATORS, listTypes } from "./scaffold";
import { runPreflight, renderPreflight } from "../../shared/preflight";
import { maybeCutStandardBranch } from "../../shared/output";
import { resolveRole, parseRoleFlag } from "../../shared/role";

const SKILL_ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(SKILL_ROOT, "assets");

function setupMcp(projectRoot: string): void {
  const mcpSource = path.join(ASSETS_DIR, "sample.mcp.json");
  const registrySource = path.join(ASSETS_DIR, "mcp-registry.toml");

  // ── .mcp.json (project root) ──
  const mcpTarget = path.join(projectRoot, ".mcp.json");
  if (fs.existsSync(mcpTarget)) {
    const existing = JSON.parse(fs.readFileSync(mcpTarget, "utf-8"));
    const ours = JSON.parse(fs.readFileSync(mcpSource, "utf-8"));

    const mergedServers = existing.mcpServers ?? {};
    for (const [key, val] of Object.entries(ours.mcpServers)) {
      if (key.startsWith("_comment")) continue;
      if (!(key in mergedServers)) {
        mergedServers[key] = val;
        console.log(`  + Added MCP server: ${key}`);
      } else {
        console.log(`  ~ Skipped (already exists): ${key}`);
      }
    }

    existing.mcpServers = mergedServers;
    fs.writeFileSync(mcpTarget, JSON.stringify(existing, null, 2));
    console.log(`  ✓ Merged into ${mcpTarget}`);
  } else {
    const data = JSON.parse(fs.readFileSync(mcpSource, "utf-8"));
    data.mcpServers = Object.fromEntries(
      Object.entries(data.mcpServers).filter(([k]) => !k.startsWith("_comment"))
    );
    fs.writeFileSync(mcpTarget, JSON.stringify(data, null, 2));
    console.log(`  ✓ Created ${mcpTarget}`);
  }

  // ── .bmad/mcp-registry.toml ──
  const bmadDir = path.join(projectRoot, ".bmad");
  if (!fs.existsSync(bmadDir)) fs.mkdirSync(bmadDir, { recursive: true });
  const registryTarget = path.join(bmadDir, "mcp-registry.toml");
  fs.copyFileSync(registrySource, registryTarget);
  console.log(`  ✓ Installed ${registryTarget}`);

  // ── .env template (if missing) ──
  const envTarget = path.join(projectRoot, ".env");
  if (!fs.existsSync(envTarget)) {
    fs.writeFileSync(
      envTarget,
      [
        "# AEM MCP — Local SDK connection",
        "AEM_HOST=http://localhost:4502",
        "AEM_USER=admin",
        "AEM_PASSWORD=admin",
        "AEM_INSTANCES_CONFIG=~/aem-instances.yaml",
        "",
      ].join("\n")
    );
    console.log(`  ✓ Created ${envTarget} (local SDK defaults)`);
  } else {
    console.log("  ~ .env already exists, skipped");
  }

  // ── .gitignore additions ──
  const gitignore = path.join(projectRoot, ".gitignore");
  const entriesNeeded = [".env", ".bmad/"];
  if (fs.existsSync(gitignore)) {
    const content = fs.readFileSync(gitignore, "utf-8");
    const added = entriesNeeded.filter((e) => !content.includes(e));
    if (added.length > 0) {
      fs.appendFileSync(
        gitignore,
        "\n# BMAD MCP config (local secrets)\n" + added.join("\n") + "\n"
      );
      console.log(`  ✓ Added to .gitignore: ${added.join(", ")}`);
    }
  }

  console.log();
  console.log("  MCP setup complete.");
  console.log(
    "  → Remote (Adobe Cloud): Sign in with Adobe ID when prompted by your IDE"
  );
  console.log(
    "  → Local (AEM SDK): Ensure local instance is running on localhost:4502"
  );
}

function detectProject(projectRoot: string): void {
  const checks: Record<string, string> = {
    "core/": "Java source (Sling Models, OSGi Services)",
    "ui.apps/": "Component definitions (HTL, dialogs)",
    "ui.content/": "Content (templates, policies, pages)",
    "ui.frontend/": "Frontend build (CSS/JS)",
    "ui.config/": "OSGi configurations (AEMaaCS)",
    "dispatcher/": "Dispatcher configs",
    "all/": "All-in-one package",
  };

  console.log("AEM Project Detection:");
  let found = 0;
  for (const [folder, desc] of Object.entries(checks)) {
    const fullPath = path.join(projectRoot, folder);
    if (fs.existsSync(fullPath)) {
      console.log(`  ✓ ${folder.padEnd(15)} ${desc}`);
      found++;
    } else {
      console.log(`  ✗ ${folder.padEnd(15)} (not found)`);
    }
  }

  // Platform detection
  const hasUiConfig = fs.existsSync(path.join(projectRoot, "ui.config/"));
  const hasRunmodeFolders = fs.existsSync(
    path.join(projectRoot, "ui.apps/src/main/content/jcr_root/apps")
  );

  if (hasUiConfig) {
    console.log("\n  Platform: AEMaaCS (ui.config/ detected)");
  } else if (hasRunmodeFolders) {
    console.log("\n  Platform: AEM AMS (runmode config folders detected)");
  }

  if (found === 0) {
    console.log(
      "\n  ⚠ No AEM project structure detected. Is this the right directory?"
    );
  } else {
    console.log(`\n  Found ${found}/${Object.keys(checks).length} AEM modules.`);
  }
}

function listTemplates(): void {
  const templatesDir = path.join(SKILL_ROOT, "templates");
  console.log("Available generation templates:");
  if (fs.existsSync(templatesDir)) {
    const files = fs
      .readdirSync(templatesDir)
      .filter((f) => f.endsWith(".md"))
      .sort();
    for (const f of files) {
      console.log(`  • ${path.parse(f).name}`);
    }
  } else {
    console.log("  (none found)");
  }
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

function listScaffoldTypes(): void {
  console.log("Deterministic scaffolders (npx ts-node run.ts --scaffold --engine <stack> --type <type> --name <Name>):");
  for (const stack of Object.keys(GENERATORS)) {
    console.log(`  ${stack}:`);
    for (const t of listTypes(stack)) console.log(`    • ${t}`);
  }
}

// ── CLI ──
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const projectRoot = path.resolve(flag(args, "--path") ?? ".");

  // ── Role resolution (--role flag > .bmad/role.yaml > generic fallback) ──
  // Accepts both `--role=ea` and `--role ea` via the shared helper.
  const roleFlag = parseRoleFlag(args);
  let resolvedRole;
  try {
    resolvedRole = resolveRole({
      projectRoot,
      cliFlag: roleFlag,
      fallbackToGeneric: true,
    });
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }
  process.env.DCA_ROLE = resolvedRole.role.code;
  process.env.DCA_ROLE_NAME = resolvedRole.role.name;
  process.env.DCA_ROLE_FLAVOR = resolvedRole.role.defaultOutputFlavor;
  process.env.DCA_ROLE_SOURCE = resolvedRole.source;
  process.stderr.write(
    `[dca-role] ${resolvedRole.role.name} (source: ${resolvedRole.source})\n`,
  );

  if (args.includes("--setup")) {
    console.log("⚡ BMAD Code Generation Agent — MCP Setup");
    console.log(`   Project: ${projectRoot}\n`);
    setupMcp(projectRoot);
    return;
  }
  if (args.includes("--detect")) { detectProject(projectRoot); return; }
  if (args.includes("--list-templates")) { listTemplates(); return; }
  if (args.includes("--list-types")) { listScaffoldTypes(); return; }

  if (args.includes("--scaffold")) {
    const stack = flag(args, "--engine");
    const type = flag(args, "--type");
    const name = flag(args, "--name");
    if (!stack || !type || !name) {
      console.error("❌ --scaffold requires --engine <stack> --type <type> --name <Name>");
      listScaffoldTypes();
      process.exit(1);
    }
    console.log(`⚡ Scaffolding ${stack}/${type} "${name}" into ${projectRoot}\n`);
    if (!args.includes("--no-preflight")) {
      console.log(renderPreflight(runPreflight(projectRoot), { agent: "generation", stack }) + "\n");
      if (args.includes("--preflight")) return;
    }
    // Standard branch (output C): cut dca/generation-<stack>-<ts> from production/shared.
    maybeCutStandardBranch(args, { agent: "generation", stack, projectRoot });
    await scaffold({
      stack, type, name,
      pkg: flag(args, "--package"),
      projectRoot,
      outputDir: flag(args, "--output"),
      dryRun: args.includes("--dry-run"),
      force: args.includes("--force"),
      role: resolvedRole.role,
      roleSource: resolvedRole.source,
    });
    return;
  }

  console.log("⚡ BMAD Code Generation Agent");
  console.log(`   Path: ${projectRoot}`);
  console.log("\nUsage:");
  console.log("  --setup                       Install MCP config for LLM/MCP generation");
  console.log("  --detect                      Detect project structure");
  console.log("  --list-types                  List deterministic scaffolders");
  console.log("  --list-templates              List available generation templates");
  console.log("  --scaffold --engine <stack> --type <type> --name <Name> [flags]");
  console.log("\nFlags (scaffold):");
  console.log("  --path <dir>                  Project root (default: cwd)");
  console.log("  --engine <stack>              Target stack: aem | sling | spring | commerce-paas | commerce-saas | app-builder | eds | eds-commerce");
  console.log("  --type <type>                 Scaffolder type (see --list-types)");
  console.log("  --name <Name>                 Artifact name");
  console.log("  --package <pkg>               Java/PHP package (when applicable)");
  console.log("  --output <dir>                Override output directory");
  console.log("  --dry-run                     Print planned files, write nothing");
  console.log("  --force                       Overwrite existing files");
  console.log("  --preflight                   Print preflight only, then exit");
  console.log("  --no-preflight                Skip the preflight advisory");
  console.log("  --create-branch               Cut dca/generation-<stack>-<timestamp> before writing");
  console.log("  --source-branch <name>        Base branch for --create-branch (default: production/main/master/develop)");
  console.log("  --role <code>                 Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content");
  console.log("                                (persisted at <project>/.bmad/role.yaml; --role wins for one run)");
  console.log("\nFor complex/custom generation, use the LLM path (SKILL.md + resource packs).");
}

main().catch((err) => {
  console.error(`❌ Fatal error: ${err.message}`);
  process.exit(1);
});
