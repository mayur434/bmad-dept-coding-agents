/**
 * Findings cache smoke — hand-rolled.
 * Usage: npx ts-node skills/shared/findings/smoke.ts /tmp/findings-smoke
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import type { Finding } from "../core/types";
import {
  CachedRun,
  cacheDir,
  pruneOldRuns,
  readAllRuns,
  readLatestRun,
  writeCachedRun,
} from "./cache";
import { emitFindingsCache } from "./emit";
import { consumeLatestFindings } from "./consume";

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    process.exit(1);
  }
}

function sha8(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 8);
}

async function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function mkFinding(over: Partial<Finding> = {}): Finding {
  return {
    title: "Sample",
    severity: "MEDIUM",
    ...over,
  };
}

async function main(): Promise<void> {
  const root =
    process.argv[2] ?? path.join(process.cwd(), ".smoke-findings");

  // clean slate
  if (fs.existsSync(path.join(root, ".bmad"))) {
    fs.rmSync(path.join(root, ".bmad"), { recursive: true, force: true });
  }
  fs.mkdirSync(root, { recursive: true });

  // 1) cacheDir creates the directory
  const dir = cacheDir(root);
  assert(fs.existsSync(dir), "cacheDir creates the .bmad/cache directory");
  assert(dir.endsWith(path.join(".bmad", "cache")), "cacheDir path shape");

  // 2) writeCachedRun creates a hash-suffixed file
  const reportPath = "audit-reports/audit-nobranch-20260101_000000-agent-report.xlsx";
  const findings: Finding[] = [
    mkFinding({
      title: "SQL injection",
      severity: "CRITICAL",
      file: "src/db.ts",
      line: 42,
      category: "security",
    }),
    mkFinding({
      title: "N+1 query",
      severity: "HIGH",
      file: "src/repo.ts",
      line: 10,
      category: "performance",
    }),
    mkFinding({
      title: "Missing null check",
      severity: "MEDIUM",
      file: "src/db.ts",
      line: 99,
    }),
    mkFinding({
      title: "Dead code",
      severity: "LOW",
    }),
    mkFinding({
      title: "Another critical",
      severity: "CRITICAL",
      file: "src/api.ts",
    }),
  ];

  const run1: CachedRun = {
    agent: "audit",
    stack: "aemcs",
    runAt: new Date().toISOString(),
    branch: "main",
    timestamp: "20260101_000000",
    reportPath,
    findings,
    meta: { role: "ea", roleFlavor: "default", roleSource: "cli-flag" },
  };

  const written = writeCachedRun(root, run1);
  const expectedName = `audit-${sha8(reportPath)}.json`;
  assert(
    written.endsWith(expectedName),
    `filename should be ${expectedName}, got ${path.basename(written)}`,
  );
  assert(fs.existsSync(written), "written cache file exists");

  // 3) readLatestRun round-trips
  const round = readLatestRun(root, "audit");
  assert(round !== null, "readLatestRun returns non-null");
  assert(round!.agent === "audit", "agent round-trip");
  assert(round!.stack === "aemcs", "stack round-trip");
  assert(round!.branch === "main", "branch round-trip");
  assert(round!.reportPath === reportPath, "reportPath round-trip");
  assert(round!.findings.length === 5, "findings length round-trip");
  assert(round!.meta?.role === "ea", "meta.role round-trip");
  assert(
    round!.findings[0]!.title === "SQL injection",
    "first finding title round-trip",
  );

  // 4) Two runs of same agent → readLatestRun returns newest by runAt
  await sleepMs(20);
  const reportPath2 = "audit-reports/audit-main-20260102_000000-agent-report.xlsx";
  const run2: CachedRun = {
    ...run1,
    runAt: new Date().toISOString(),
    timestamp: "20260102_000000",
    reportPath: reportPath2,
    findings: [
      mkFinding({ title: "Newer finding", severity: "HIGH", file: "src/new.ts" }),
    ],
  };
  writeCachedRun(root, run2);

  const latest = readLatestRun(root, "audit");
  assert(latest !== null, "latest non-null after second write");
  assert(
    latest!.reportPath === reportPath2,
    `newest returned (got ${latest!.reportPath})`,
  );
  assert(latest!.findings.length === 1, "newest findings length");

  // 5) readAllRuns with agent filter
  writeCachedRun(root, {
    ...run1,
    agent: "sonar-scan",
    runAt: new Date().toISOString(),
    reportPath: "sonar-reports/sonar-main-20260101_000000-agent-report.xlsx",
    findings: [mkFinding({ title: "Sonar smell", severity: "LOW" })],
  });

  const allAudit = readAllRuns(root, { agent: "audit" });
  assert(allAudit.length === 2, `expected 2 audit runs, got ${allAudit.length}`);
  assert(allAudit.every((r) => r.agent === "audit"), "agent filter honored");
  assert(
    Date.parse(allAudit[0]!.runAt) >= Date.parse(allAudit[1]!.runAt),
    "sorted newest-first",
  );

  const allEverything = readAllRuns(root);
  assert(
    allEverything.length === 3,
    `expected 3 total runs, got ${allEverything.length}`,
  );

  // sinceISO filter
  const future = new Date(Date.now() + 60_000).toISOString();
  assert(
    readAllRuns(root, { sinceISO: future }).length === 0,
    "sinceISO in the future excludes everything",
  );

  // 6) pruneOldRuns keeps last N per agent
  // Write 6 more audit runs, then prune to 3
  for (let i = 0; i < 6; i++) {
    await sleepMs(5);
    writeCachedRun(root, {
      ...run1,
      runAt: new Date().toISOString(),
      reportPath: `audit-reports/prune-${i}.xlsx`,
      findings: [mkFinding({ title: `prune-${i}` })],
    });
  }
  // audit total should now be 2 + 6 = 8
  assert(
    readAllRuns(root, { agent: "audit" }).length === 8,
    "8 audit runs before prune",
  );

  const pruned = pruneOldRuns(root, { keepPerAgent: 3 });
  assert(pruned.removed === 5, `expected 5 removed, got ${pruned.removed}`);
  const kept = readAllRuns(root, { agent: "audit" });
  assert(kept.length === 3, `expected 3 audit runs after prune, got ${kept.length}`);
  // sonar-scan (1 entry) should be untouched
  assert(
    readAllRuns(root, { agent: "sonar-scan" }).length === 1,
    "sonar-scan run untouched by prune",
  );

  // 7) consumeLatestFindings groups by severity + file correctly
  //    Point the latest audit run at the rich findings set.
  await sleepMs(10);
  writeCachedRun(root, {
    ...run1,
    runAt: new Date().toISOString(),
    reportPath: "audit-reports/rich.xlsx",
    findings,
  });

  const consumed = consumeLatestFindings({
    projectRoot: root,
    fromAgent: "audit",
  });
  assert(consumed !== null, "consumeLatestFindings returns non-null");
  assert(consumed!.bySeverity.CRITICAL === 2, "2 CRITICAL findings counted");
  assert(consumed!.bySeverity.HIGH === 1, "1 HIGH counted");
  assert(consumed!.bySeverity.MEDIUM === 1, "1 MEDIUM counted");
  assert(consumed!.bySeverity.LOW === 1, "1 LOW counted");
  assert(
    consumed!.criticalFiles.length === 2,
    `expected 2 critical files, got ${consumed!.criticalFiles.length}`,
  );
  assert(
    consumed!.criticalFiles.includes("src/db.ts"),
    "src/db.ts in criticalFiles",
  );
  assert(
    consumed!.criticalFiles.includes("src/api.ts"),
    "src/api.ts in criticalFiles",
  );
  assert(
    consumed!.criticalFiles[0]! < consumed!.criticalFiles[1]!,
    "criticalFiles sorted alphabetically",
  );
  assert(
    consumed!.fileToFindings["src/db.ts"]!.length === 2,
    "src/db.ts groups 2 findings",
  );
  assert(
    consumed!.fileToFindings["<no-file>"]!.length === 1,
    "<no-file> bucket for missing file",
  );

  // maxAgeHours = 0 → treat everything as too old (age > 0)
  await sleepMs(5);
  const tooOld = consumeLatestFindings({
    projectRoot: root,
    fromAgent: "audit",
    maxAgeHours: 0,
  });
  assert(tooOld === null, "maxAgeHours=0 filters everything");

  // requireStack mismatch → null
  const wrongStack = consumeLatestFindings({
    projectRoot: root,
    fromAgent: "audit",
    requireStack: "spring-boot",
  });
  assert(wrongStack === null, "requireStack mismatch → null");

  const rightStack = consumeLatestFindings({
    projectRoot: root,
    fromAgent: "audit",
    requireStack: "aemcs",
  });
  assert(rightStack !== null, "requireStack match returns run");

  // 8) Malformed JSON file → returns null, doesn't crash
  const malformedPath = path.join(dir, "audit-badbeef1.json");
  fs.writeFileSync(malformedPath, "{ not: valid json", "utf8");
  // readAllRuns must not throw
  const stillOk = readAllRuns(root, { agent: "audit" });
  assert(
    stillOk.length === 4,
    `malformed file skipped; expected 4 audit runs, got ${stillOk.length}`,
  );
  // if the malformed file is the ONLY audit file, readLatestRun returns null
  const tmpRoot = path.join(root, "isolated-malformed");
  const tmpDir = cacheDir(tmpRoot);
  fs.writeFileSync(path.join(tmpDir, "audit-deadbeef.json"), "{{{ bad", "utf8");
  assert(
    readLatestRun(tmpRoot, "audit") === null,
    "malformed-only project → readLatestRun null",
  );

  // 9) emitFindingsCache — non-fatal wrapper
  const emitPath = emitFindingsCache({
    projectRoot: root,
    agent: "impact-analysis",
    stack: "aemcs",
    branch: "nobranch",
    timestamp: "20260103_120000",
    reportPath: "impact-reports/impact-nobranch-20260103_120000-agent-report.xlsx",
    findings: [mkFinding({ title: "impacted", severity: "HIGH" })],
    meta: { role: "de" },
  });
  assert(emitPath.length > 0, "emitFindingsCache returns a path on success");
  assert(fs.existsSync(emitPath), "emit produced a real file");

  const impactRun = readLatestRun(root, "impact-analysis");
  assert(impactRun !== null, "emit round-trip via readLatestRun");
  assert(impactRun!.branch === "nobranch", "nobranch branch stored verbatim");
  assert(impactRun!.meta?.role === "de", "emit meta round-trip");

  // Invalid projectRoot for emit: point at a non-writable spot -> should
  // return empty string, not throw. Use a path under a regular file.
  const blocker = path.join(root, "blocker-file");
  fs.writeFileSync(blocker, "x", "utf8");
  const failed = emitFindingsCache({
    projectRoot: path.join(blocker, "cannot-mkdir"),
    agent: "audit",
    stack: "aemcs",
    branch: "main",
    timestamp: "20260101_000000",
    reportPath: "x.xlsx",
    findings: [],
  });
  assert(failed === "", "emitFindingsCache returns '' on failure");

  process.stdout.write("OK\n");
}

main().catch((err) => {
  process.stderr.write(`FAIL: unexpected error: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
