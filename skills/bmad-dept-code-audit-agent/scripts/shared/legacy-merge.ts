/**
 * Audit — legacy platform-specific report merging
 * ================================================
 * Unifies engine output to a SINGLE xlsx per run. The standardized report
 * (Run Info / Summary / Severity Breakdown / By Category / Recommendations /
 * Input Traceability) is emitted first via `emitStandardOutputs`; this helper
 * then loads the resulting workbook, invokes a `populate` callback that adds
 * the platform-specific rich sheets AFTER the standardized ones, and writes
 * the workbook back to the same path.
 *
 * Zero new npm deps — uses the ExcelJS already pulled in by the shared report
 * layer, and doesn't touch `skills/shared/*`.
 */

import * as fs from "fs";
import ExcelJS from "exceljs";

/** Callback that receives an already-loaded ExcelJS workbook. */
export type PopulateFn = (wb: ExcelJS.Workbook) => void | Promise<void>;

/**
 * Load `xlsxPath`, invoke `populate(wb)` (which should call `wb.addWorksheet`
 * for each platform-specific sheet), then re-save. Non-fatal: logs a WARN on
 * failure and leaves the standardized xlsx untouched.
 */
export async function appendLegacySheets(
  xlsxPath: string,
  populate: PopulateFn,
): Promise<void> {
  if (!fs.existsSync(xlsxPath)) {
    process.stderr.write(
      `[audit-legacy-merge] WARN: xlsx not found for merging: ${xlsxPath}\n`,
    );
    return;
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const before = wb.worksheets.length;
  try {
    await populate(wb);
  } catch (err) {
    process.stderr.write(
      `[audit-legacy-merge] WARN: populate failed (${(err as Error).message}); ` +
        `standardized workbook kept as-is.\n`,
    );
    return;
  }
  const added = wb.worksheets.length - before;
  await wb.xlsx.writeFile(xlsxPath);
  process.stderr.write(
    `[audit-legacy-merge] appended ${added} platform-specific sheet(s) to ${xlsxPath}\n`,
  );
}
