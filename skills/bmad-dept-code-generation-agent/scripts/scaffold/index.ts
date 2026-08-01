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
import type { Role } from "../../../shared/role";

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
  /** Resolved role (from --role flag, .bmad/role.yaml, or generic fallback). */
  role?: Role;
  /** How the role was resolved (for the Run Info sheet). */
  roleSource?: "cli-flag" | "role-file" | "generic-fallback";
}

/**
 * Role → generation tweak plan.
 * Today these are advisories only — the deterministic scaffolders themselves are unchanged.
 * The AI-driven LLM/MCP path (SKILL.md) uses the same matrix to actually adapt output.
 */
function planRoleTweaks(roleCode: string, stack: string, type: string): string[] {
  switch (roleCode) {
    case "ea":
      return [
        "Enforce house naming conventions (package/component/artifact names).",
        `Add "Conventions applied" section to the Markdown report twin.`,
      ];
    case "tl":
      return ["Standard scaffold — no role-specific adjustments."];
    case "de":
      return [
        "Auto-emit a matching test stub via the test-coverage agent's per-stack framework pack.",
        "Include a Jira-ready CSV row per generated file in the report.",
      ];
    case "qa":
      return [
        "Emit test files only (delegate to test-coverage LLM path if no test scaffolder for this type).",
        "Attach a coverage checklist to the report.",
      ];
    case "devops":
      return [
        `Prefer IaC/pipeline/dispatcher scaffolds for ${stack}/${type}.`,
        `Add a "Deployment" section to the Markdown report twin.`,
      ];
    case "security":
      return [
        "Apply security-hardened defaults (input validation, ACL, XSS-safe HTL/HTML, CSRF, prepared statements).",
        `Add a "Security decisions" section explaining each hardening.`,
      ];
    case "pm":
    case "ba":
      return [`Role recorded (${roleCode}); generation not a primary tool for this role — using generic behavior.`];
    case "migration":
      return [
        "Prefer migration/patch artifacts (Commerce setup patches, module.xml, db_schema, di.xml overrides; AEM install hooks, content packages).",
        "Include a Migration guide section in the Markdown report twin.",
      ];
    case "content":
      return [
        "Prefer content-fragment / editable-template / dispatcher-config / EDS-block scaffolders where available.",
        "Note template usage in the report.",
      ];
    default:
      return [];
  }
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

  // ── Role adaptation (advisory only for the deterministic path) ──
  const roleCode = opts.role?.code ?? "generic";
  const tweaks = planRoleTweaks(roleCode, opts.stack, opts.type);
  if (roleCode !== "generic" && tweaks.length > 0) {
    console.log(`\n🎯 Role: ${opts.role?.name ?? roleCode} — planned adjustments:`);
    for (const t of tweaks) console.log(`   • ${t}`);
    console.log("   (deterministic scaffolders are unchanged; the AI/LLM path applies these tweaks — see SKILL.md).\n");
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
      extra: {
        Type: opts.type,
        Name: opts.name,
        Written: written.length,
        Skipped: skipped.length,
        Role: opts.role?.code ?? "generic",
        RoleName: opts.role?.name ?? "Generic",
        RoleSource: opts.roleSource ?? "generic-fallback",
        RoleFlavor: opts.role?.defaultOutputFlavor ?? "default",
        RoleTweaks: tweaks.length > 0 ? tweaks.join(" | ") : "(none)",
      },
    },
    findings,
    outputDir,
    filesChanged: written,
    changelogSummary: `Generated ${written.length} file(s) for ${opts.stack}/${opts.type} "${opts.name}".`,
  });

  console.log(`\n📊 Report:     ${res.xlsxPath}`);
  if (res.changelogPath) console.log(`📝 CHANGE-LOG: ${res.changelogPath}`);
}
