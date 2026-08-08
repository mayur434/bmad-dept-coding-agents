/**
 * DCA Shared — SLA report helper.
 * ================================
 * Turns `FindingSLA[]` into a report-ready sheet spec: columns + rows +
 * status-driven row styling. Emitter-agnostic — this module returns plain
 * data; a downstream `populate(wb)` helper (mirroring the audit legacy
 * merge pattern in `skills/shared/output/emit.ts`) applies it.
 *
 * See the SKILL wire-up (Phase 1.4) for the ExcelJS `populate(wb)` glue that
 * consumes this shape.
 */

import type { FindingSLA, SLAStatus } from "./schema";

export interface SheetRowStyle {
  /** ARGB hex without leading `#`, e.g. 'FFEAF7EA' (ExcelJS fill format). */
  fillArgb?: string;
  /** Font color ARGB hex. */
  fontArgb?: string;
  bold?: boolean;
}

export interface SLASheetRow {
  values: (string | number)[];
  style: SheetRowStyle;
}

export interface SLASheetSpec {
  sheetName: "SLA Status";
  columns: string[];
  rows: SLASheetRow[];
}

export const SLA_COLUMNS = [
  "Rule ID",
  "File",
  "Line",
  "Severity",
  "Role",
  "First Seen",
  "Age (h)",
  "SLA (h)",
  "Due At",
  "Status",
  "Days Overdue",
] as const;

// Status → row style. Kept flat & obvious; downstream renderers can override.
const STATUS_STYLE: Record<SLAStatus, SheetRowStyle> = {
  ok: { fillArgb: "FFEAF7EA", fontArgb: "FF1E5C1E" },        // soft green
  "due-soon": { fillArgb: "FFFFF4CC", fontArgb: "FF7A5A00" }, // amber
  overdue: { fillArgb: "FFFBE5E5", fontArgb: "FF8B0000", bold: true }, // red
  unknown: { fillArgb: "FFF2F2F2", fontArgb: "FF555555" },    // grey
};

export function buildSLASheet(items: FindingSLA[]): SLASheetSpec {
  const rows: SLASheetRow[] = items.map((it) => {
    const daysOverdue =
      it.status === "overdue"
        ? round1((it.ageHours - it.slaHours) / 24)
        : 0;
    return {
      values: [
        it.finding.ruleId,
        it.finding.file,
        it.finding.line ?? "",
        it.finding.severity,
        it.role,
        it.firstSeenAt,
        round1(it.ageHours),
        round1(it.slaHours),
        it.dueAt,
        it.status,
        daysOverdue,
      ],
      style: STATUS_STYLE[it.status],
    };
  });
  return {
    sheetName: "SLA Status",
    columns: [...SLA_COLUMNS],
    rows,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
