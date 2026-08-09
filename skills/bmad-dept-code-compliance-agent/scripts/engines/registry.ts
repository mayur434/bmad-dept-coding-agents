/**
 * BMAD Compliance Agent — Framework Registry
 * ===========================================
 * Unlike every other DCA agent, Compliance's "engines" are per
 * COMPLIANCE-FRAMEWORK (cwe / owasp / cis / pci / hipaa / gdpr / sox /
 * iso27001), not per tech-stack. Each framework mapper receives the SAME
 * merged findings set (pulled from other agents' findings caches via
 * `consumeLatestFindings`) and maps those findings against its own control
 * catalog — so a run with N frameworks dispatches N mappers against one
 * shared input, rather than picking a single stack engine.
 *
 * Content (real control catalogs) lands in a later workstream — every
 * mapper here is a stub that returns a single INFO finding so the
 * dispatcher end-to-end wiring is exercised.
 */

import type { Finding } from "../../../shared/core/types";

// ---------------------------------------------------------------------------
// Public mapper contract every framework implements
// ---------------------------------------------------------------------------

export interface FrameworkMapperInput {
  projectRoot: string;
  /** Findings merged from all resolved --source-agent findings caches. */
  findings: Finding[];
  /** Which agents contributed to `findings` (for reporting). */
  sourceAgents: string[];
  /** Resolved --artifacts list. */
  artifacts: string[];
  /** Free-text name/role for the attestation sign-off block. */
  attestationSigner?: string;
  /** Whether to include CHANGE-LOG.md + findings-cache history export. */
  auditTrail: boolean;
  /** Whether to attach SLA deadlines to remediation items. */
  remediationSla: boolean;
  format: "markdown" | "both";
  role: string;
  outputDir: string;
}

export interface FrameworkMapperResult {
  /** Compliance findings = control-mapping rows (one per mapped control). */
  findings: Finding[];
  writtenFiles: string[];
  stats: {
    controlsCovered: number;
    controlsGap: number;
    findingsMapped: number;
  };
}

export interface FrameworkMapper {
  id: string;
  name: string;
  main: (input: FrameworkMapperInput) => Promise<FrameworkMapperResult>;
}

// ---------------------------------------------------------------------------
// Framework imports (Phase 4 stubs — a later workstream replaces bodies with
// real per-framework control catalogs + mapping logic).
// ---------------------------------------------------------------------------

import { main as cweMain } from "./cwe/mapper";
import { main as owaspMain } from "./owasp/mapper";
import { main as cisMain } from "./cis/mapper";
import { main as pciMain } from "./pci/mapper";
import { main as hipaaMain } from "./hipaa/mapper";
import { main as gdprMain } from "./gdpr/mapper";
import { main as soxMain } from "./sox/mapper";
import { main as iso27001Main } from "./iso27001/mapper";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const FRAMEWORKS = [
  "cwe",
  "owasp",
  "cis",
  "pci",
  "hipaa",
  "gdpr",
  "sox",
  "iso27001",
] as const;
export type FrameworkId = typeof FRAMEWORKS[number];

const REGISTRY: Record<FrameworkId, FrameworkMapper> = {
  cwe: { id: "cwe", name: "CWE (Common Weakness Enumeration)", main: cweMain },
  owasp: { id: "owasp", name: "OWASP Top 10", main: owaspMain },
  cis: { id: "cis", name: "CIS Controls", main: cisMain },
  pci: { id: "pci", name: "PCI-DSS", main: pciMain },
  hipaa: { id: "hipaa", name: "HIPAA", main: hipaaMain },
  gdpr: { id: "gdpr", name: "GDPR", main: gdprMain },
  sox: { id: "sox", name: "SOX", main: soxMain },
  iso27001: { id: "iso27001", name: "ISO 27001", main: iso27001Main },
};

// Aliases: caller IDs that resolve to a registered framework.
const FRAMEWORK_ALIASES: Record<string, string> = {
  "owasp-top-10": "owasp",
  "owasp-top10": "owasp",
  "cis-controls": "cis",
  "pci-dss": "pci",
  "iso-27001": "iso27001",
  "iso 27001": "iso27001",
};

/** Look up a single framework mapper by id (or alias). Null if unknown. */
export function getFrameworkMapper(id: string): FrameworkMapper | null {
  if (!id) return null;
  const key = id.trim().toLowerCase();
  const resolved = FRAMEWORK_ALIASES[key] ?? key;
  return REGISTRY[resolved as FrameworkId] ?? null;
}

/**
 * Resolve the --framework CSV into a validated list of framework ids.
 * Handles 'all', comma-splitting, aliasing, and de-duplication.
 * Falls back to `roleDefault` when `csv` is empty/undefined, and to
 * ['cwe', 'owasp'] when both `csv` and `roleDefault` are empty.
 */
export function resolveFrameworks(
  csv: string | undefined,
  roleDefault: string[],
): string[] {
  const raw = (csv ?? "").trim();
  if (!raw) {
    return roleDefault.length > 0 ? dedupe(roleDefault) : ["cwe", "owasp"];
  }
  const items = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (items.includes("all")) return [...FRAMEWORKS];

  const resolved: string[] = [];
  for (const item of items) {
    const mapper = getFrameworkMapper(item);
    if (mapper) {
      resolved.push(mapper.id);
    } else {
      console.error(`⚠️  Unknown framework: ${item} — skipping`);
    }
  }
  if (resolved.length === 0) {
    return roleDefault.length > 0 ? dedupe(roleDefault) : ["cwe", "owasp"];
  }
  return dedupe(resolved);
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}

export function listFrameworks(): void {
  console.log("Available compliance frameworks:");
  console.log("");
  for (const id of FRAMEWORKS) {
    console.log(`  ${id.padEnd(10)} ${REGISTRY[id].name}`);
  }
}
