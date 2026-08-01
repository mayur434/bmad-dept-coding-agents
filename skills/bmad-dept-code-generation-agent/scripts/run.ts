#!/usr/bin/env ts-node
/**
 * BMAD Code Generation Agent — Dispatcher
 * =========================================
 * Entry point for the code generation engine.
 * Includes MCP setup automation for zero-config consumer experience.
 */

import * as fs from "fs";
import * as path from "path";
// Node-core-only + role/install (dep-free) imports are safe on first run.
// scaffold, shared/preflight, and shared/output transitively require
// third-party packages (mammoth, fast-glob, exceljs, etc.) and MUST be
// loaded lazily via require() below AFTER ensureDepsInstalled().
import { resolveRole, parseRoleFlag } from "../../shared/role";
import { ensureDepsInstalled } from "../../shared/install";
import { resolveIntake, askAll, confirmRun, Question } from "../../shared/interactive";

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
  // Lazy-require: needs node_modules (ensureDepsInstalled already ran).
  const { GENERATORS, listTypes } = require("./scaffold") as typeof import("./scaffold");
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

  const yesInstall = args.includes("--yes-install");
  const noInstall = args.includes("--no-install");
  if (yesInstall && noInstall) {
    console.error("❌ --yes-install and --no-install are mutually exclusive.");
    process.exit(1);
  }
  const interactiveFlag = args.includes("--interactive");
  const technicalFlag = args.includes("--technical");
  if (interactiveFlag && technicalFlag) {
    console.error("❌ --interactive and --technical are mutually exclusive.");
    process.exit(1);
  }

  // Print help without touching node_modules — allow --help before install.
  const helpOnly = args.includes("--help") || args.includes("-h");
  if (helpOnly && !args.includes("--scaffold") && !args.includes("--setup") && !args.includes("--detect") && !args.includes("--list-types") && !args.includes("--list-templates")) {
    printGenerationHelp();
    return;
  }

  // First-run dependency check. Runs BEFORE the heavy shared/* modules and
  // ./scaffold are require()'d below — they transitively need mammoth,
  // fast-glob, exceljs, etc.
  const bootstrap = await ensureDepsInstalled({
    agentName: "generation",
    yes: yesInstall,
    no: noInstall,
  });
  if (bootstrap.exitCode !== 0) process.exit(bootstrap.exitCode);

  // Lazy loads — safe now that node_modules is guaranteed present.
  const { scaffold } = require("./scaffold") as typeof import("./scaffold");
  const { runPreflight, renderPreflight } = require("../../shared/preflight") as typeof import("../../shared/preflight");
  const { maybeCutStandardBranch } = require("../../shared/output") as typeof import("../../shared/output");

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

  // ── Intake mode: --interactive prompts for missing inputs; --technical is
  // the current (silent-error) default. Persisted at <project>/.bmad/intake.yaml.
  const intake = resolveIntake({
    projectRoot,
    cliFlag: interactiveFlag ? "interactive" : technicalFlag ? "technical" : undefined,
  });
  process.stderr.write(`[dca-interactive] intake mode: ${intake.mode} (source: ${intake.source})\n`);

  if (intake.mode === "interactive" && !args.includes("--setup") && !args.includes("--detect") && !args.includes("--list-templates") && !args.includes("--list-types")) {
    const { GENERATORS, listTypes: listTypesFn } = require("./scaffold/generators") as typeof import("./scaffold/generators");
    const stackChoices = Object.keys(GENERATORS);
    const questions: Question[] = [
      { key: "path", prompt: "What's the project path?", default: process.cwd() },
      {
        key: "engine",
        prompt: "Which stack?",
        choices: stackChoices,
      },
      {
        key: "type",
        prompt: "What type of artifact?",
        choices: [],
        when: () => true,
      },
      { key: "name", prompt: "What name? (e.g. HeroBanner, OrderService)" },
      { key: "package", prompt: "Package/namespace override (Enter to use detected default)", optional: true },
      {
        key: "dry-run",
        prompt: "Dry run (preview only) or actually create files?",
        choices: ["y", "n"],
        default: "n",
      },
    ];
    // Type choices depend on the engine picked at runtime — patch the choices
    // list in place after the engine question is answered by using `when` to
    // reset choices on each iteration.
    const dynamicTypeQ = questions[2]!;
    dynamicTypeQ.when = (a) => {
      const engine = a.engine;
      dynamicTypeQ.choices = engine ? listTypesFn(engine) : [];
      return true;
    };
    const existing: Record<string, string | undefined> = {
      path: projectRoot !== process.cwd() ? projectRoot : undefined,
      engine: flag(args, "--engine"),
      type: flag(args, "--type"),
      name: flag(args, "--name"),
      package: flag(args, "--package"),
    };
    const answers = await askAll({ questions, existing });
    // Force scaffold dispatch below.
    if (!args.includes("--scaffold")) args.push("--scaffold");
    if (answers.engine && !flag(args, "--engine")) args.push("--engine", answers.engine);
    if (answers.type && !flag(args, "--type")) args.push("--type", answers.type);
    if (answers.name && !flag(args, "--name")) args.push("--name", answers.name);
    if (answers.package && !flag(args, "--package")) args.push("--package", answers.package);
    if (answers["dry-run"] === "y" && !args.includes("--dry-run")) args.push("--dry-run");

    const summaryCmd = [
      "npx ts-node run.ts",
      "--scaffold",
      "--path", projectRoot,
      "--engine", flag(args, "--engine") ?? "",
      "--type", flag(args, "--type") ?? "",
      "--name", flag(args, "--name") ?? "",
      flag(args, "--package") ? `--package ${flag(args, "--package")}` : "",
      answers["dry-run"] === "y" ? "--dry-run" : "",
    ].filter(Boolean).join(" ");
    const proceed = await confirmRun(summaryCmd);
    if (!proceed) {
      console.log("[dca-interactive] Copy the command above to run manually. Exiting.");
      return;
    }
  }

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
      console.error("   Tip: rerun with --interactive to be prompted step-by-step, or add 'mode: interactive' to .bmad/intake.yaml.");
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
      project: flag(args, "--project"),
      projectRoot,
      outputDir: flag(args, "--output"),
      dryRun: args.includes("--dry-run"),
      force: args.includes("--force"),
      noTestStub: args.includes("--no-test-stub"),
      forceName: args.includes("--force-name"),
      conventionsPath: flag(args, "--conventions"),
      secure: args.includes("--secure") ? true : undefined,
      role: resolvedRole.role,
      roleSource: resolvedRole.source,
    });
    return;
  }

  printGenerationHelp(projectRoot);
}

function printGenerationHelp(projectRoot?: string): void {
  console.log("⚡ BMAD Code Generation Agent");
  if (projectRoot) console.log(`   Path: ${projectRoot}`);
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
  console.log("  --project <slug>              Project slug for AEM IaC scaffolders (dispatcher/CFM/XF/pipeline)");
  console.log("  --output <dir>                Override output directory");
  console.log("  --dry-run                     Print planned files, write nothing");
  console.log("  --force                       Overwrite existing files");
  console.log("  --no-test-stub                Skip the matching test stub for this scaffold");
  console.log("  --force-name                  Skip .bmad/conventions.yaml name validation");
  console.log("  --conventions <path>          Override the .bmad/conventions.yaml path");
  console.log("  --secure                      Apply per-type security hardening (auth, escaping, CSRF, headers, redaction)");
  console.log("  --preflight                   Print preflight only, then exit");
  console.log("  --no-preflight                Skip the preflight advisory");
  console.log("  --create-branch               Cut dca/generation-<stack>-<timestamp> before writing");
  console.log("  --source-branch <name>        Base branch for --create-branch (default: production/main/master/develop)");
  console.log("  --role <code>                 Role adaptation: ea|tl|de|qa|devops|security|pm|ba|migration|content");
  console.log("                                (persisted at <project>/.bmad/role.yaml; --role wins for one run)");
  console.log("\nInstall control (first-run):");
  console.log("  --yes-install                 Install missing dependencies without confirmation.");
  console.log("  --no-install                  Error out if dependencies missing (do not install).");
  console.log("                                Default: prompt for confirmation on first run.");
  console.log("\nIntake mode:");
  console.log("  --interactive                 Prompt step-by-step for missing scaffold inputs; persist choice to .bmad/intake.yaml.");
  console.log("  --technical                   Force technical mode; missing required inputs error out (current default).");
  console.log("                                Without either flag the CLI reads <project>/.bmad/intake.yaml (mode: interactive|technical),");
  console.log("                                falling back to technical when the file is absent.");
  console.log("\nFor complex/custom generation, use the LLM path (SKILL.md + resource packs).");
}

main().catch((err) => {
  console.error(`❌ Fatal error: ${err.message}`);
  process.exit(1);
});
