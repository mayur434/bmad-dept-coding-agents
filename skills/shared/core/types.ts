/**
 * DCA Shared — Unified Engine Contract & Finding Model
 * =====================================================
 * A single normalized data model shared by all five agents (audit, generation,
 * impact-analysis, test-coverage, sonar-scan) so that every agent can emit the SAME
 * standardized outputs (CHANGE-LOG.md + `<agent>-<branch>-<timestamp>-agent-report.xlsx`).
 *
 * Engines produce `Finding[]`; the shared report/output layer consumes it.
 * A `Finding` is deliberately a superset: only `title` + `severity` are required,
 * everything else is optional so audit / impact / coverage / generation findings
 * all fit the same table.
 */

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

/** Rank used for sorting (lower = more severe). */
export const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

/** The five agents in the DCA suite. Used for report/branch/changelog naming. */
export type AgentName = "audit" | "generation" | "impact" | "test-coverage" | "sonar-scan" | "requirements" | "architecture" | "release" | "operations";

/** Where a finding came from — a deterministic scanner or the LLM tier. */
export type FindingSource = "scanner" | "llm" | "hybrid";

/** Optional traceability back to an impact-analysis input item (Proofhub bug / BRD requirement). */
export interface InputRef {
  /** e.g. BUG-1234 or REQ-07 */
  id?: string;
  type?: "bug" | "brd" | "requirement" | "other";
  title?: string;
  /** Source document / export the item came from. */
  source?: string;
}

/**
 * The normalized finding. One row of the standardized Summary sheet.
 * `title` and `severity` are the only required fields.
 */
export interface Finding {
  /** Stable identifier. Auto-generated from (ruleId|category)+index when absent. */
  id?: string;
  /** Short one-line title. */
  title: string;
  /** Full description of the issue / change / gap. */
  description?: string;
  /** Tech-stack id (e.g. aemcs, aemams, commerce-paas, app-builder-mesh, sling-shaft, spring-boot, eds). */
  stack?: string;
  /** Category / module / component grouping. */
  category?: string;
  /** File path (relative to project root when possible). */
  file?: string;
  /** 1-based line number. */
  line?: number;
  /**
   * Human code reference. Computed as `file:line` when absent.
   * This is the required "Code Reference" column.
   */
  codeRef?: string;
  /** Code snippet / context. */
  code?: string;
  severity: Severity;
  /** 0.0–1.0 or a label; rendered as-is. */
  confidence?: number | string;
  /** Rule identifier (e.g. AEMCS-SEC-014). */
  ruleId?: string;
  /** Recommendation / fix. */
  recommendation?: string;
  /** Impact analysis text (blast radius / consequence). */
  impact?: string;
  /** Effort estimate (e.g. S/M/L or hours). */
  effort?: string;
  /** Dev comments — left blank by tooling for the developer to fill. */
  devComments?: string;
  /** Workflow status. Defaults to "Open". */
  status?: string;
  /** Owner / assignee. */
  owner?: string;
  /** Provenance. */
  source?: FindingSource;
  /** Reference URLs / doc links. */
  references?: string[];
  /** Traceability for the impact agent. */
  inputRef?: InputRef;
}

/** Recommendation table row (carried through to the Recommendations sheet). */
export interface RecommendationRow {
  area: string;
  recommendation: string;
  expectedImpact: string;
  effort: string;
  priority: string;
  details: string;
}

/** Run metadata captured in the Run Info sheet + CHANGE-LOG entry. */
export interface RunMeta {
  agent: AgentName;
  /** Engine / stack id that produced the findings. */
  engine?: string;
  /** Human stack label. */
  stack?: string;
  projectName: string;
  projectRoot: string;
  /** Branch the standard working branch was cut from (production/shared). */
  sourceBranch?: string;
  /** Current working branch — feeds the report file name. */
  workingBranch?: string;
  /** Compact timestamp: YYYYMMDD_HHMMSS. */
  timestamp?: string;
  /** Tool / dependency versions for reproducibility. */
  toolVersions?: Record<string, string>;
  /** Free-form extra key/values surfaced in Run Info. */
  extra?: Record<string, string | number>;
}

/** Severity counts + total. */
export interface FindingCounts {
  bySeverity: Record<Severity, number>;
  total: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function computeCounts(findings: Finding[]): FindingCounts {
  const bySeverity: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  for (const f of findings) {
    const sev = normalizeSeverity(f.severity);
    bySeverity[sev] += 1;
  }
  return { bySeverity, total: findings.length };
}

/** Coerce any string to a valid Severity (defaults to INFO). */
export function normalizeSeverity(value: unknown): Severity {
  const v = String(value ?? "").toUpperCase().trim();
  return (SEVERITIES as string[]).includes(v) ? (v as Severity) : "INFO";
}

/** Sort findings most-severe first, then by category, then by file. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const s = SEVERITY_RANK[normalizeSeverity(a.severity)] - SEVERITY_RANK[normalizeSeverity(b.severity)];
    if (s !== 0) return s;
    const c = (a.category ?? "").localeCompare(b.category ?? "");
    if (c !== 0) return c;
    return (a.file ?? "").localeCompare(b.file ?? "");
  });
}

/**
 * Fill deterministic defaults on a finding: id, codeRef, status, severity.
 * Idempotent — safe to call more than once.
 */
export function normalizeFinding(f: Finding, index = 0): Required<Pick<Finding, "id" | "severity" | "status" | "codeRef">> & Finding {
  const severity = normalizeSeverity(f.severity);
  const codeRef =
    f.codeRef ??
    (f.file ? (f.line != null ? `${f.file}:${f.line}` : f.file) : "—");
  const idBase = f.ruleId ?? f.category ?? f.stack ?? "F";
  const id = f.id ?? `${slug(idBase)}-${String(index + 1).padStart(4, "0")}`;
  return {
    ...f,
    id,
    severity,
    codeRef,
    status: f.status ?? "Open",
    devComments: f.devComments ?? "",
  };
}

/** Group findings by category (stable order: severity-weighted). */
export function groupByCategory(findings: Finding[]): Record<string, Finding[]> {
  const map: Record<string, Finding[]> = {};
  for (const f of findings) {
    const key = f.category ?? "General";
    (map[key] ??= []).push(f);
  }
  return map;
}

function slug(s: string): string {
  return s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase() || "F";
}

// ─── Legacy adapter ───────────────────────────────────────────────────────────
// The audit agent's engines emit the older AuditFinding shape
// (module/type/justification/…). This bridges them into the normalized model
// so AEM/Commerce/EDS engines can adopt the standardized report without a rewrite.

export interface LegacyAuditFinding {
  module: string;
  file: string;
  line: number;
  type: string;
  description: string;
  code: string;
  severity: string;
  recommendation: string;
  effort: string;
  impact: string;
  confidence: string;
  justification: string;
}

export function fromLegacyAuditFinding(
  category: string,
  f: LegacyAuditFinding,
  stack?: string,
): Finding {
  return {
    title: f.type || category,
    description: f.description,
    stack,
    category: category || f.module,
    file: f.file,
    line: f.line,
    code: f.code,
    severity: normalizeSeverity(f.severity),
    confidence: f.confidence,
    ruleId: (f as { ruleId?: string }).ruleId,
    recommendation: f.recommendation,
    impact: f.impact || f.justification,
    effort: f.effort,
    source: "scanner",
  };
}

/** Flatten a legacy FindingsMap (category -> AuditFinding[]) into Finding[]. */
export function fromLegacyFindingsMap(
  map: Record<string, LegacyAuditFinding[]>,
  stack?: string,
): Finding[] {
  const out: Finding[] = [];
  for (const [category, items] of Object.entries(map)) {
    for (const item of items) out.push(fromLegacyAuditFinding(category, item, stack));
  }
  return out;
}
