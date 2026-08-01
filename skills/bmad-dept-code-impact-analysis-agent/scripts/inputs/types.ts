/**
 * Impact Analysis — Input model
 * ==============================
 * A normalized "change request" ingested from a Proofhub bug export or a BRD
 * document. The tracer maps each InputItem onto impacted code.
 */

export interface InputItem {
  /** Stable id (BUG-1234 / REQ-07 / row index). */
  id: string;
  kind: "bug" | "requirement" | "pr";
  title: string;
  description: string;
  /** Optional module/component/label hint that narrows the search. */
  module?: string;
  priority?: string;
  status?: string;
  /** Source document / export the item came from. */
  source: string;
}

/** Column mapping for a Proofhub CSV export (header keyword → field). Overridable. */
export interface ColumnMap {
  id?: string;
  title?: string;
  description?: string;
  module?: string;
  priority?: string;
  status?: string;
}
