/* DCA coverage PDF via pdfkit. Run with NODE_PATH=<audit-agent>/scripts/node_modules */
const PDFDocument = require("pdfkit");
const fs = require("fs");
const OUT = process.argv[2] || "DCA-Agent-Coverage.pdf";

const NAVY = "#1F4E79", NAVY2 = "#2E75B6", INK = "#203040";
const GREEN_F = "#C6EFCE", GREEN_T = "#1E6B2F";

const STACKS = ["AEMaaCS", "AEM AMS", "Adobe Commerce PaaS", "Adobe Commerce SaaS", "Adobe App Builder", "Sling-12 / Shaft", "Spring Boot", "Adobe EDS", "EDS + Commerce"];
const AGENTS = ["Audit", "Generation", "Impact", "Test Coverage"];
// all Done
const AGENT_INFO = [
  ["Audit", "Two-tier static scanners (tree-sitter AST) + LLM rule packs → one standardized report + CHANGE-LOG.", "A: yes   B: yes   C: opt-in (--create-branch)"],
  ["Generation", "Deterministic scaffolder (real files, php -l / javac valid) + LLM/MCP resource packs.", "A: yes   B: yes   C: not wired"],
  ["Impact Analysis", "Proofhub bug export / BRD -> traced to impacted code with reverse-dependency blast radius.", "A: yes   B: yes   C: not wired"],
  ["Test Coverage", "Per-stack coverage-gap analysis (source<->test matching, priority scoring) -> standardized report.", "A: yes   B: yes   C: not wired"],
];

const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
doc.pipe(fs.createWriteStream(OUT));
const W = doc.page.width - 72;

function title(t, sub) {
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(22).text(t, 36, 36);
  if (sub) doc.fillColor(NAVY2).font("Helvetica-Oblique").fontSize(10).text(sub);
  doc.moveDown(0.6);
}

// ── Page 1: matrix ──
title("BMAD DCA — AI Agent Coverage", "Multi-agent code intelligence for the Adobe / Java middleware stack  ·  2026-07-10  ·  branch feature/aem-ams-acs");

let y = 96;
const colStack = 210, colW = (W - colStack) / 4, rowH = 26;
// header
doc.rect(36, y, colStack, rowH).fill(NAVY);
doc.fillColor("#fff").font("Helvetica-Bold").fontSize(11).text("Tech stack", 44, y + 8, { width: colStack - 12 });
AGENTS.forEach((a, i) => {
  const x = 36 + colStack + i * colW;
  doc.rect(x, y, colW, rowH).fill(NAVY);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(10).text(a, x, y + 8, { width: colW, align: "center" });
});
y += rowH;
STACKS.forEach((s, r) => {
  doc.rect(36, y, colStack, rowH).fill(r % 2 ? "#F2F7FB" : "#fff").stroke("#D9D9D9");
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(s, 44, y + 8, { width: colStack - 12 });
  for (let i = 0; i < 4; i++) {
    const x = 36 + colStack + i * colW;
    doc.rect(x, y, colW, rowH).fill(GREEN_F).stroke("#D9D9D9");
    doc.fillColor(GREEN_T).font("Helvetica-Bold").fontSize(10).text("DONE", x, y + 8, { width: colW, align: "center" });
  }
  y += rowH;
});
y += 12;
doc.fillColor(GREEN_T).font("Helvetica-Bold").fontSize(12).text("36 of 36 stack x agent cells = DONE   (all 9 company tech stacks, all 4 agents)", 36, y);
y += 22;
doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(
  "• Audit: every stack emits one identical standardized report + CHANGE-LOG (incl. App Builder + Commerce-SaaS webhook signature checks).\n" +
  "• Generation: deterministic scaffolders for every stack (generated PHP passes php -l, Java is javac-valid) + LLM/MCP packs.\n" +
  "• Impact: a Proofhub bug export or a BRD is traced to impacted code with reverse-dependency blast radius (Input Traceability sheet).\n" +
  "• Test Coverage: coverage-gap analysis across every stack.", 36, y, { width: W, lineGap: 3 });

// ── Page 2: agents ──
doc.addPage();
title("Agents at a glance");
y = 96;
const c1 = 130, c2 = W - 130 - 190, c3 = 190;
doc.rect(36, y, c1, rowH).fill(NAVY); doc.rect(36 + c1, y, c2, rowH).fill(NAVY); doc.rect(36 + c1 + c2, y, c3, rowH).fill(NAVY);
doc.fillColor("#fff").font("Helvetica-Bold").fontSize(11);
doc.text("Agent", 44, y + 8, { width: c1 }); doc.text("What it does", 44 + c1, y + 8, { width: c2 }); doc.text("Standard outputs (A/B/C)", 44 + c1 + c2, y + 8, { width: c3 });
y += rowH;
AGENT_INFO.forEach(([name, purpose, outputs], r) => {
  const h = 64;
  doc.rect(36, y, c1, h).fill(r % 2 ? "#F2F7FB" : "#fff").stroke("#D9D9D9");
  doc.rect(36 + c1, y, c2, h).fill(r % 2 ? "#F2F7FB" : "#fff").stroke("#D9D9D9");
  doc.rect(36 + c1 + c2, y, c3, h).fill(r % 2 ? "#F2F7FB" : "#fff").stroke("#D9D9D9");
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(name, 44, y + 8, { width: c1 - 12 });
  doc.fillColor(GREEN_T).font("Helvetica-Bold").fontSize(9).text("9 of 9 stacks", 44, y + 30, { width: c1 - 12 });
  doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(purpose, 44 + c1, y + 8, { width: c2 - 12, lineGap: 2 });
  doc.fillColor(INK).font("Helvetica").fontSize(9).text(outputs, 44 + c1 + c2, y + 8, { width: c3 - 12, lineGap: 2 });
  y += h;
});
y += 16;
doc.fillColor(NAVY2).font("Helvetica-Oblique").fontSize(9).text(
  "Full per-stack engine/rule detail is in the companion workbook DCA-Agent-Coverage.xlsx (one sheet per agent). " +
  "Two documented depth caveats: Impact tracing is heuristic (identifier + reverse-reference, evidence listed per finding); " +
  "test-coverage % is file/class matching, not JaCoCo/nyc line-branch.", 36, y, { width: W, lineGap: 3 });

doc.end();
doc.on ? null : null;
