/**
 * Impact Analysis — BRD document reader
 * ======================================
 * Reads a BRD into requirement InputItems. Supports Word (.docx via mammoth),
 * Markdown/plain text. Google Docs: export to .docx or .txt first (the Docs API
 * needs OAuth, out of scope for the CLI) — a .docx export is handled here.
 *
 * Requirements are split on headings / numbered sections / REQ-style ids; if none
 * are present, each blank-line-separated paragraph becomes one requirement.
 */

import * as fs from "fs";
import * as path from "path";
import * as mammoth from "mammoth";
import { InputItem } from "./types";

const HEADING =
  /^\s*(#{1,6}\s+.+|\d+(\.\d+)*[.)]\s+.+|(REQ|FR|NFR|US|BR)[-\s]?\d+[:.)\s].*|[A-Z][A-Za-z0-9 /&-]{2,60}:\s*.*)$/;

export async function readBrd(filePath: string): Promise<InputItem[]> {
  const ext = path.extname(filePath).toLowerCase();
  let text: string;
  if (ext === ".docx") {
    const res = await mammoth.extractRawText({ path: filePath });
    text = res.value;
  } else {
    text = fs.readFileSync(filePath, "utf8");
  }
  return splitRequirements(text, path.basename(filePath));
}

export function splitRequirements(text: string, source: string): InputItem[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const items: InputItem[] = [];
  let cur: { title: string; body: string[] } | null = null;
  let anyHeading = false;

  const flush = () => {
    if (cur && (cur.title.trim() || cur.body.join("").trim())) {
      items.push({
        id: `REQ-${String(items.length + 1).padStart(2, "0")}`,
        kind: "requirement",
        title: cleanTitle(cur.title),
        description: cur.body.join("\n").trim(),
        source,
      });
    }
    cur = null;
  };

  for (const line of lines) {
    if (HEADING.test(line) && line.trim().length <= 200) {
      anyHeading = true;
      flush();
      cur = { title: line, body: [] };
    } else if (cur) {
      cur.body.push(line);
    } else if (line.trim()) {
      // preamble before the first heading — start an item
      cur = { title: line, body: [] };
    }
  }
  flush();

  // No headings at all → fall back to paragraph splitting.
  if (!anyHeading) {
    const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return paras.map((p, i) => ({
      id: `REQ-${String(i + 1).padStart(2, "0")}`,
      kind: "requirement" as const,
      title: firstSentence(p),
      description: p,
      source,
    }));
  }
  return items;
}

function cleanTitle(s: string): string {
  return s.replace(/^#{1,6}\s+/, "").replace(/^\s*\d+(\.\d+)*[.)]\s+/, "").trim().slice(0, 160);
}
function firstSentence(p: string): string {
  const m = p.match(/^(.{0,120}?[.:!?])(\s|$)/);
  return (m ? m[1] : p.slice(0, 120)).trim();
}
