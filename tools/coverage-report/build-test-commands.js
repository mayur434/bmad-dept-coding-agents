/* DCA test-command matrix. Run with NODE_PATH=<skills/shared/node_modules>. */
const ExcelJS = require("exceljs");
const OUT = process.argv[2] || "DCA-Test-Commands.xlsx";

const NAVY = "FF1F4E79", NAVY2 = "FF2E75B6", INK = "FF203040", WHITE = "FFFFFFFF", ZEBRA = "FFF2F7FB", SECT = "FFD6E4F0", MONO = "FF1B3A5B";
const thin = { style: "thin", color: { argb: "FFD9D9D9" } };
const BORDER = { top: thin, bottom: thin, left: thin, right: thin };

// per-stack: engine id per agent, a representative generation type, detection markers
const STACKS = [
  { name: "AEMaaCS", audit: "aem", tc: "aem", impact: "aem", gen: "aem", genType: "component",
    markers: "ui.apps/ + core/ + pom.xml (aem-sdk-api); ui.config/ ⇒ Cloud" },
  { name: "AEM AMS", audit: "aem", tc: "aem", impact: "aem", gen: "aem", genType: "sling-model",
    auditExtra: " --platform aemams", markers: "pom.xml (uber-jar) + core/ + config.author|publish/ runmode folders" },
  { name: "Adobe Commerce PaaS", audit: "commerce", tc: "commerce", impact: "commerce-paas", gen: "commerce-paas", genType: "plugin",
    markers: "composer.json (magento/*) + app/code/" },
  { name: "Adobe Commerce SaaS", audit: "commerce-saas", tc: "commerce-saas", impact: "commerce-saas", gen: "commerce-saas", genType: "catalog-query",
    markers: "@adobe/magento-storefront-events-sdk OR Magento-Environment-Id; NO app/code" },
  { name: "Adobe App Builder", audit: "app-builder", tc: "app-builder", impact: "app-builder", gen: "app-builder", genType: "action",
    markers: "app.config.yaml OR .aio OR @adobe/aio-sdk in package.json" },
  { name: "Sling-12 / Shaft", audit: "sling", tc: "sling", impact: "sling", gen: "sling", genType: "osgi-service",
    markers: "pom.xml/bnd with org.apache.sling|felix (NO AEM markers); or mdm/ sam/" },
  { name: "Spring Boot", audit: "spring", tc: "spring", impact: "spring", gen: "spring", genType: "rest-controller",
    markers: "spring-boot-starter / org.springframework.boot in pom.xml|build.gradle; or @SpringBootApplication" },
  { name: "Adobe EDS", audit: "eds", tc: "eds", impact: "eds", gen: "eds", genType: "block",
    markers: "blocks/ + helix-query.yaml + fstab.yaml" },
  { name: "EDS + Commerce", audit: "eds-commerce", tc: "eds-commerce", impact: "eds-commerce", gen: "eds-commerce", genType: "dropin-block",
    markers: "blocks/ + blocks/commerce-*/ + scripts/commerce.js (or @dropins/*)" },
];

const CWD = {
  Audit: "skills/bmad-dept-code-audit-agent/scripts",
  "Test Coverage": "skills/bmad-dept-code-test-coverage-agent/scripts",
  Generation: "skills/bmad-dept-code-generation-agent/scripts",
  Impact: "skills/bmad-dept-code-impact-analysis-agent/scripts",
};

// generation types available per stack (for the Notes column)
const GEN_TYPES = {
  aem: "sling-model, osgi-service, sling-servlet, component, workflow-process",
  sling: "osgi-service, sling-servlet, sling-filter, sling-model",
  spring: "rest-controller, service, jpa-repository",
  "commerce-paas": "module, plugin, observer, graphql-resolver, controller",
  "commerce-saas": "catalog-query, storefront-block",
  "app-builder": "action, mesh, event-handler",
  eds: "block",
  "eds-commerce": "dropin-block",
};

function rowsFor(agent) {
  return STACKS.map((s) => {
    if (agent === "Audit")
      return { agent, stack: s.name, engine: s.audit,
        cmd: `npx ts-node run.ts --engine ${s.audit} --path <PROJECT>${s.auditExtra || ""}`,
        prompt: `audit my ${s.name} project at <PROJECT>`,
        expected: `Standardized report + CHANGE-LOG in <PROJECT>/audit-reports/. Tip: --preflight for the LLM/Static advisor only.` };
    if (agent === "Test Coverage")
      return { agent, stack: s.name, engine: s.tc,
        cmd: `npx ts-node run.ts --mode analyze --engine ${s.tc} --path <PROJECT>`,
        prompt: `analyze test coverage for my ${s.name} project at <PROJECT>`,
        expected: `Coverage-gap report (untested files + priority). Modes: analyze | generate | full.` };
    if (agent === "Generation")
      return { agent, stack: s.name, engine: s.gen,
        cmd: `npx ts-node run.ts --scaffold --engine ${s.gen} --type ${s.genType} --name Sample --path <OUT>`,
        prompt: `generate a ${s.genType} for my ${s.name} project`,
        expected: `Real files + generation report. --dry-run to preview. Types: ${GEN_TYPES[s.gen]}` };
    return { agent, stack: s.name, engine: s.impact,
      cmd: `npx ts-node run.ts --engine ${s.impact} --path <PROJECT> --bugs proofhub-export.csv`,
      prompt: `analyze impact of proofhub-export.csv on my ${s.name} project at <PROJECT>`,
      expected: `Impact report w/ Input Traceability + blast radius. --brd <doc.docx> also/instead of --bugs.` };
  });
}

const wb = new ExcelJS.Workbook();
wb.creator = "BMAD DCA";

function title(ws, cols, t, sub) {
  ws.mergeCells(1, 1, 1, cols); const c = ws.getCell(1, 1);
  c.value = t; c.font = { name: "Calibri", bold: true, size: 17, color: { argb: NAVY } };
  ws.getRow(1).height = 24;
  ws.mergeCells(2, 1, 2, cols); const s = ws.getCell(2, 1);
  s.value = sub; s.font = { name: "Calibri", italic: true, size: 10, color: { argb: NAVY2 } };
}
function header(ws, row, hs) {
  const r = ws.getRow(row); r.height = 22;
  hs.forEach((h, i) => { const c = ws.getCell(row, i + 1); c.value = h;
    c.font = { name: "Calibri", bold: true, size: 10.5, color: { argb: WHITE } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; c.border = BORDER; });
}
function cell(ws, r, ci, v, o = {}) {
  const c = ws.getCell(r, ci); c.value = v;
  c.font = o.mono ? { name: "Consolas", size: 9.5, color: { argb: MONO } } : { name: "Calibri", size: 10, bold: !!o.bold, color: { argb: o.color || INK } };
  c.alignment = { vertical: "top", horizontal: o.center ? "center" : "left", wrapText: true }; c.border = BORDER;
  if (o.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
}
function section(ws, row, cols, t) {
  ws.mergeCells(row, 1, row, cols); const c = ws.getCell(row, 1);
  c.value = t; c.font = { name: "Calibri", bold: true, size: 12, color: { argb: NAVY } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECT } }; ws.getRow(row).height = 19;
}

// ── Sheet 1: Test Commands ──
(function () {
  const ws = wb.addWorksheet("Test Commands", { views: [{ state: "frozen", ySplit: 3, showGridLines: false }], properties: { tabColor: { argb: NAVY } } });
  ws.columns = [{ width: 14 }, { width: 20 }, { width: 14 }, { width: 60 }, { width: 40 }, { width: 46 }];
  title(ws, 6, "DCA — Agent × Tech-Stack Test Commands", "Run each from its agent scripts dir (see Setup). Replace <PROJECT>/<OUT>. Omit --engine to auto-detect.");
  header(ws, 3, ["Agent", "Tech Stack", "--engine", "Command  (cd to 'Run from' in Setup, then:)", "LLM prompt (Copilot/Claude/Cursor)", "Expected / notes"]);
  let r = 4;
  for (const agent of ["Audit", "Test Coverage", "Generation", "Impact"]) {
    for (const row of rowsFor(agent)) {
      ws.getRow(r).height = 42;
      cell(ws, r, 1, row.agent, { bold: true, fill: ZEBRA });
      cell(ws, r, 2, row.stack, { bold: true });
      cell(ws, r, 3, row.engine, { center: true, mono: true });
      cell(ws, r, 4, row.cmd, { mono: true });
      cell(ws, r, 5, `"${row.prompt}"`);
      cell(ws, r, 6, row.expected);
      r++;
    }
  }
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 6 } };
})();

// ── Sheet 2: Setup & Fixtures ──
(function () {
  const ws = wb.addWorksheet("Setup & Fixtures", { views: [{ showGridLines: false }], properties: { tabColor: { argb: NAVY2 } } });
  ws.columns = [{ width: 26 }, { width: 100 }];
  title(ws, 2, "Setup & Fixtures", "One-time prerequisites, run-from directories, and how to make a detectable test project per stack.");
  let r = 4;
  section(ws, r++, 2, "Prerequisites (once)");
  const pre = [
    ["Node on PATH", 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"   # Node is keg-only on this machine'],
    ["Install deps (per agent)", "cd skills/<agent>/scripts && npm install     # first time only"],
    ["Auto-detect", "Omit --engine and the dispatcher detects the stack from the markers below."],
    ["Preflight advisor", "Every run prints an LLM-vs-Static recommendation. --no-preflight skips it; --preflight shows advisory only, no scan."],
    ["Outputs", "Standardized <agent>-<branch>-<timestamp>-agent-report.xlsx + .md + CHANGE-LOG.md in <PROJECT>/<agent>-reports/ (or --output <dir>)."],
  ];
  for (const [k, v] of pre) { ws.getRow(r).height = 26; cell(ws, r, 1, k, { bold: true }); cell(ws, r, 2, v, { mono: true }); r++; }
  r++;
  section(ws, r++, 2, "Run from (cwd) per agent");
  for (const [a, d] of Object.entries(CWD)) { cell(ws, r, 1, a, { bold: true }); cell(ws, r, 2, d, { mono: true }); ws.getRow(r).height = 18; r++; }
  r++;
  section(ws, r++, 2, "Make a detectable test project (marker files per stack)");
  header(ws, r++, ["Tech Stack", "Create these markers so the agent detects it"]);
  for (const s of STACKS) { ws.getRow(r).height = 30; cell(ws, r, 1, s.name, { bold: true, fill: ZEBRA }); cell(ws, r, 2, s.markers, { mono: true }); r++; }
  r++;
  section(ws, r++, 2, "Impact-analysis inputs");
  cell(ws, r, 1, "Proofhub bugs", { bold: true }); cell(ws, r++, 2, "--bugs export.csv  (columns auto-detected: Task ID/Title/Description/Priority/Labels). Run log prints the resolved mapping.", { mono: true });
  cell(ws, r, 1, "BRD document", { bold: true }); cell(ws, r++, 2, "--brd requirements.docx | .md | .txt  (Google Docs → export to .docx first). Can combine with --bugs.", { mono: true });
})();

wb.xlsx.writeFile(OUT).then(() => console.log("WROTE " + require("path").resolve(OUT)));
