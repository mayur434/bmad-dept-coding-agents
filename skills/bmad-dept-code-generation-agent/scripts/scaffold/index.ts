/**
 * DCA Generation — scaffold orchestrator
 * =======================================
 * Runs a generator, writes files, emits the standardized generation report +
 * CHANGE-LOG, and records the run in the shared findings cache
 * (`.bmad/cache/generation-*.json`). When `--secure` is on, applies per-type
 * hardening and appends a "Security decisions" section to the Markdown twin.
 */

import * as fs from "fs";
import * as path from "path";
import { emitStandardOutputs } from "../../../shared/output";
import { emitFindingsCache } from "../../../shared/findings";
import { Finding } from "../../../shared/core/types";
import { GENERATORS, listTypes, GenFile } from "./generators";
import { pascal } from "./generators-util";
import { loadConventions, validateName, resolvePackage } from "./conventions";
import { testStub } from "./test-stubs";
import { applyHardening } from "./hardenings";
import type { Role } from "../../../shared/role";

export { GENERATORS, listTypes } from "./generators";

export interface ScaffoldOptions {
  stack: string; // sling | spring | app-builder | aem | commerce-* | eds*
  type: string;
  name: string;
  pkg?: string;
  project?: string;
  projectRoot: string;
  outputDir?: string;
  dryRun?: boolean;
  force?: boolean;
  /** Skip emission of a matching test stub (default: emit). */
  noTestStub?: boolean;
  /** Skip conventions.validateName check (default: enforce when file present). */
  forceName?: boolean;
  /** Override path to conventions.yaml. */
  conventionsPath?: string;
  /** Apply per-type security hardening. */
  secure?: boolean;
  /** Resolved role (from --role flag, .bmad/role.yaml, or generic fallback). */
  role?: Role;
  /** How the role was resolved (for the Run Info sheet). */
  roleSource?: "cli-flag" | "role-file" | "generic-fallback";
}

/**
 * Role → generation tweak plan.
 * Today these are advisories only for the deterministic scaffolders (except
 * `security`, which now flips `--secure` on when passed without the flag).
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
    console.error(`Unknown stack: ${opts.stack}. Available: ${Object.keys(GENERATORS).join(", ")}`);
    process.exit(1);
  }
  const gen = gens[opts.type];
  if (!gen) {
    console.error(`Unknown type '${opts.type}' for ${opts.stack}. Available: ${listTypes(opts.stack).join(", ")}`);
    process.exit(1);
  }

  // ── House conventions: validate + resolve default package if requested ──
  const conv = loadConventions(opts.projectRoot, opts.conventionsPath);
  if (conv.loadedFrom) {
    console.log(`[generation] conventions loaded: ${conv.loadedFrom}`);
  }
  if (!opts.forceName) {
    const res = validateName(pascal(opts.name), opts.stack, "class", conv);
    if (!res.ok) {
      console.error(`Conventions error: ${res.reason}`);
      if (res.suggestion) console.error(`Try: --name ${res.suggestion}`);
      console.error("(pass --force-name to bypass; edit .bmad/conventions.yaml to change the rules.)");
      process.exit(2);
    }
    // Also validate the resolved package.
    const effectivePkg = opts.pkg ?? resolvePackage(opts.name, opts.stack, conv);
    if (effectivePkg) {
      const pkgRes = validateName(effectivePkg, opts.stack, "package", conv);
      if (!pkgRes.ok) {
        console.error(`Conventions error (package): ${pkgRes.reason}`);
        console.error("(pass --force-name to bypass; edit .bmad/conventions.yaml to change the rules.)");
        process.exit(2);
      }
    }
  }
  // Auto-fill pkg from conventions when caller didn't override.
  if (!opts.pkg) {
    const derived = resolvePackage(opts.name, opts.stack, conv);
    if (derived) {
      console.log(`[generation] using package from conventions: ${derived}`);
      opts.pkg = derived;
    }
  }

  // ── Role adaptation (advisory only for the deterministic path) ──
  const roleCode = opts.role?.code ?? "generic";
  const tweaks = planRoleTweaks(roleCode, opts.stack, opts.type);
  if (roleCode !== "generic" && tweaks.length > 0) {
    console.log(`\nRole: ${opts.role?.name ?? roleCode} — planned adjustments:`);
    for (const t of tweaks) console.log(`   - ${t}`);
    console.log("   (deterministic scaffolders are unchanged; the AI/LLM path applies these tweaks — see SKILL.md).\n");
  }
  // Security role → default --secure on unless caller explicitly opted out.
  if (roleCode === "security" && opts.secure === undefined) {
    console.log("[generation] Security role detected — enabling --secure by default.");
    opts.secure = true;
  }

  // ── Produce files (source + optional hardening pass) ──
  let files: GenFile[] = gen({ name: opts.name, pkg: opts.pkg, project: opts.project });
  let securityDecisions: string[] = [];
  if (opts.secure) {
    const h = applyHardening(opts.stack, opts.type, files);
    files = h.files;
    securityDecisions = h.decisions;
    for (const d of securityDecisions) {
      console.log(`[generation-secure] ${d}`);
    }
  }

  // ── Test stub (unless opted out or none exists for this pair) ──
  const stub = opts.noTestStub ? null : testStub(opts.stack, opts.type, { name: opts.name, pkg: opts.pkg });

  const written: string[] = [];
  const skipped: string[] = [];
  const testsWritten: string[] = [];
  const testsSkipped: string[] = [];

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

  if (stub) {
    const abs = path.join(opts.projectRoot, stub.path);
    if (fs.existsSync(abs)) {
      testsSkipped.push(stub.path);
      console.log(`  ~ skipped test stub (exists): ${stub.path}`);
    } else {
      if (!opts.dryRun) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, stub.content, "utf8");
      }
      testsWritten.push(stub.path);
      console.log(`${opts.dryRun ? "  [dry-run] " : "  + "}${stub.path}   (test stub)`);
    }
  }

  console.log(`[generation] wrote ${written.length} source files + ${testsWritten.length} test stubs`);

  if (opts.dryRun) {
    console.log(`\n(dry-run) ${written.length + testsWritten.length} file(s) would be generated.`);
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
  const filesForChangelog = [...written, ...testsWritten];
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
        TestStubsWritten: testsWritten.length,
        TestStubsSkipped: testsSkipped.length,
        Secure: opts.secure ? "yes" : "no",
        ConventionsFile: conv.loadedFrom ?? "(defaults)",
        Role: opts.role?.code ?? "generic",
        RoleName: opts.role?.name ?? "Generic",
        RoleSource: opts.roleSource ?? "generic-fallback",
        RoleFlavor: opts.role?.defaultOutputFlavor ?? "default",
        RoleTweaks: tweaks.length > 0 ? tweaks.join(" | ") : "(none)",
      },
    },
    findings,
    outputDir,
    filesChanged: filesForChangelog,
    changelogSummary: `Generated ${written.length} source + ${testsWritten.length} test stub(s) for ${opts.stack}/${opts.type} "${opts.name}"${opts.secure ? " [secure]" : ""}.`,
  });

  console.log(`\nReport:     ${res.xlsxPath}`);
  if (res.changelogPath) console.log(`CHANGE-LOG: ${res.changelogPath}`);

  // ── Append Security decisions section to the Markdown twin ──
  if (opts.secure && securityDecisions.length > 0 && res.mdPath && fs.existsSync(res.mdPath)) {
    try {
      const md = fs.readFileSync(res.mdPath, "utf8");
      const section = renderSecurityDecisionsSection(securityDecisions);
      fs.writeFileSync(res.mdPath, md + section, "utf8");
    } catch (err) {
      process.stderr.write(
        `[generation-secure] WARN: could not append Security decisions to ${res.mdPath}: ${(err as Error).message}\n`,
      );
    }
  }

  // ── Findings cache emission (chaining for downstream agents) ──
  emitFindingsCache({
    projectRoot: opts.projectRoot,
    agent: "generation",
    stack: opts.stack,
    branch: res.meta.workingBranch ?? "nobranch",
    timestamp: res.meta.timestamp ?? "",
    reportPath: res.xlsxPath,
    findings: [],
    meta: {
      generatedFiles: filesForChangelog.join(","),
      secure: opts.secure ? "yes" : "no",
      type: opts.type,
      name: opts.name,
    },
  });
}

function renderSecurityDecisionsSection(decisions: string[]): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("");
  lines.push("## Security decisions");
  lines.push("");
  lines.push("Applied by `--secure` hardening pass:");
  lines.push("");
  for (const d of decisions) lines.push(`- ${d}`);
  lines.push("");
  return lines.join("\n");
}
