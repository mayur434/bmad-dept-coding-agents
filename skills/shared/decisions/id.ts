/**
 * DCA Shared — deterministic decision id derivation.
 *
 * `dec-<sha256:8>` over `ruleId|file|line`. Deterministic so re-triaging the
 * same finding produces the same id — enables upsertDecision to overwrite the
 * prior row instead of duplicating it.
 */

import * as crypto from "crypto";

export function decisionIdFor(finding: {
  ruleId: string;
  file?: string;
  line?: number;
}): string {
  const src = [
    finding.ruleId,
    finding.file ?? "",
    finding.line !== undefined ? String(finding.line) : "",
  ].join("|");
  const hash = crypto.createHash("sha256").update(src).digest("hex").slice(0, 8);
  return `dec-${hash}`;
}
