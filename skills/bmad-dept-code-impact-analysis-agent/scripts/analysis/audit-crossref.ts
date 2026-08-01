/**
 * Impact Analysis — Audit cross-reference
 * =========================================
 * Enriches tracer findings with data from the most recent audit run (cached at
 * `<projectRoot>/.bmad/cache/audit-*.json`).
 *
 * For every impacted file that also appears in the audit cache we:
 *   - annotate the finding with `auditFindings: <n>` + `worstAuditSeverity`,
 *   - prepend "⚠️" to the finding title when the file has a CRITICAL audit finding
 *     (so the Impacted Title column visibly flags high-risk hotspots),
 *   - append a short "[audit: N findings, worst=SEV]" note to `impact`.
 *
 * The module is a no-op (returns { enriched: 0, files: 0 }) when no cached
 * audit run is found or when the CLI flag `--no-audit-crossref` is set.
 */

import { consumeLatestFindings } from "../../../shared/findings";
import { SEVERITY_RANK, Finding, Severity, normalizeSeverity } from "../../../shared/core/types";

export interface CrossRefOptions {
  projectRoot: string;
  /** Ignore cache entries older than N hours (default 168 = 7 days). */
  maxAgeHours?: number;
}

export interface CrossRefResult {
  /** True when a matching audit cache was found and consumed. */
  hasCache: boolean;
  /** Absolute path to the cached run's report, if hasCache. */
  auditReport?: string;
  /** ISO timestamp of the cached audit run. */
  auditRunAt?: string;
  /** Count of impacted files also present in the audit cache. */
  files: number;
  /** Count of impacted files with a CRITICAL audit finding. */
  criticalFiles: number;
  /** Count of impact findings that were mutated. */
  enriched: number;
}

/**
 * Read latest cached audit run, then enrich `findings` in place. Returns a
 * summary suitable for logging + meta emission. Non-fatal on any failure.
 */
export function crossReferenceAudit(
  findings: Finding[],
  opts: CrossRefOptions,
): CrossRefResult {
  const empty: CrossRefResult = { hasCache: false, files: 0, criticalFiles: 0, enriched: 0 };

  let consumed;
  try {
    consumed = consumeLatestFindings({
      projectRoot: opts.projectRoot,
      fromAgent: "audit",
      maxAgeHours: opts.maxAgeHours ?? 168,
    });
  } catch (err) {
    process.stderr.write(
      `[impact-crossref] WARN: consumeLatestFindings failed: ${(err as Error).message}\n`,
    );
    return empty;
  }
  if (!consumed) return empty;

  const fileToFindings = consumed.fileToFindings;

  const impactedFileSet = new Set<string>();
  const criticalFileSet = new Set<string>();
  let enriched = 0;

  for (const f of findings) {
    if (!f.file) continue;
    const auditHits = fileToFindings[f.file];
    if (!auditHits || auditHits.length === 0) continue;

    impactedFileSet.add(f.file);
    const worst = worstSeverity(auditHits);
    if (worst === "CRITICAL") criticalFileSet.add(f.file);

    // Annotate via the free-form devComments field so downstream tooling can
    // parse it without changing the shared Finding schema.
    const tag = `auditFindings=${auditHits.length}; worstAuditSeverity=${worst}`;
    f.devComments = f.devComments ? `${f.devComments}; ${tag}` : tag;

    // Prepend a warning marker to the title so the Input Traceability sheet's
    // "Impacted Title" column visibly flags CRITICAL hotspots.
    if (worst === "CRITICAL" && !f.title.startsWith("⚠️")) {
      f.title = `⚠️ ${f.title}`;
    }

    const suffix = ` [audit: ${auditHits.length} finding(s), worst=${worst}]`;
    f.impact = (f.impact ?? "") + suffix;
    enriched += 1;
  }

  return {
    hasCache: true,
    auditReport: consumed.run.reportPath,
    auditRunAt: consumed.run.runAt,
    files: impactedFileSet.size,
    criticalFiles: criticalFileSet.size,
    enriched,
  };
}

function worstSeverity(findings: Finding[]): Severity {
  let worst: Severity = "INFO";
  for (const f of findings) {
    const sev = normalizeSeverity(f.severity);
    if (SEVERITY_RANK[sev] < SEVERITY_RANK[worst]) worst = sev;
  }
  return worst;
}
