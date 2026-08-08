/**
 * DCA Shared — SLA smoke test.
 *
 * Runnable:
 *   npx ts-node skills/shared/sla/smoke.ts /tmp/sla-smoke
 *
 * Exits 0 with "OK" on success, non-zero on any assertion failure.
 * WARN lines on the "malformed sla.yaml" case are expected — they are the
 * code under test proving the non-fatal posture.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import type { Finding } from "../core/types";
import type { CachedRun } from "../findings/cache";
import {
  DEFAULT_SLAS,
  parseSLADuration,
  readSLAsFile,
  resolveSLA,
  slaFilePath,
  summarizeSLA,
  trackSLAsForFindings,
  writeSLAsFile,
} from "./index";

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    process.exit(1);
  }
}
function eq<T>(actual: T, expected: T, msg: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    process.stderr.write(`FAIL: ${msg}\n  actual:   ${a}\n  expected: ${b}\n`);
    process.exit(1);
  }
}
function rmrf(p: string): void {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function freshRoot(base: string, name: string): string {
  const root = path.join(base, name);
  rmrf(root);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

/** Write a cached run for the tracker to consume. Mirrors findings/cache.ts. */
function writeCache(
  projectRoot: string,
  run: CachedRun,
): void {
  const dir = path.join(projectRoot, ".bmad", "cache");
  fs.mkdirSync(dir, { recursive: true });
  const suffix = crypto
    .createHash("sha256")
    .update(run.reportPath)
    .digest("hex")
    .slice(0, 8);
  const target = path.join(dir, `${run.agent}-${suffix}.json`);
  fs.writeFileSync(target, JSON.stringify(run, null, 2), "utf8");
}

function main(): void {
  const base = process.argv[2] || "/tmp/sla-smoke";
  rmrf(base);
  fs.mkdirSync(base, { recursive: true });

  // ─── 1. parseSLADuration ────────────────────────────────────────────────
  eq(parseSLADuration("24h").hours, 24, "parse: 24h -> 24");
  eq(parseSLADuration("5d").hours, 120, "parse: 5d -> 120");
  eq(parseSLADuration("2w").hours, 336, "parse: 2w -> 336");
  eq(parseSLADuration("1 week").hours, 168, "parse: '1 week' -> 168");
  eq(parseSLADuration("30 days").hours, 720, "parse: '30 days' -> 720");
  eq(parseSLADuration("48hrs").hours, 48, "parse: 48hrs -> 48");
  try {
    parseSLADuration("bogus");
    assert(false, "parse: should throw on bogus");
  } catch {
    /* ok */
  }

  // ─── 2. resolveSLA default ─────────────────────────────────────────────
  {
    const d = resolveSLA({ role: "security", severity: "CRITICAL" });
    eq(d.hours, DEFAULT_SLAS.security.CRITICAL.hours, "resolve: default sec CRITICAL");
    eq(d.hours, 24, "resolve: default sec CRITICAL == 24h");
  }
  {
    const d = resolveSLA({ role: "ea", severity: "MEDIUM" });
    eq(d.hours, DEFAULT_SLAS.ea.MEDIUM.hours, "resolve: default ea MEDIUM");
  }

  // ─── 3. per-role override wins over default ────────────────────────────
  {
    const root = freshRoot(base, "override-role");
    writeSLAsFile(root, {
      version: 1,
      overrides: [
        {
          role: "security",
          slas: {
            CRITICAL: { hours: 12, humanized: "12h" },
          },
        },
      ],
    });
    const back = readSLAsFile(root);
    assert(back, "override-role: read back");
    const d = resolveSLA({
      role: "security",
      severity: "CRITICAL",
      projectRoot: root,
    });
    eq(d.hours, 12, "override-role: sec CRITICAL -> 12h");
    // Missing severity falls back to default.
    const h = resolveSLA({
      role: "security",
      severity: "HIGH",
      projectRoot: root,
    });
    eq(h.hours, DEFAULT_SLAS.security.HIGH.hours, "override-role: sec HIGH falls back");
  }

  // ─── 4. per-agent override wins over per-role override ─────────────────
  {
    const root = freshRoot(base, "override-agent");
    writeSLAsFile(root, {
      version: 1,
      overrides: [
        {
          role: "security",
          slas: {
            CRITICAL: { hours: 12, humanized: "12h" },
          },
        },
      ],
      perAgentOverrides: {
        "sonar-scan": {
          CRITICAL: { hours: 6, humanized: "6h" },
          HIGH: { hours: 24, humanized: "24h" },
          MEDIUM: { hours: 72, humanized: "3d" },
          LOW: { hours: 168, humanized: "1w" },
          INFO: { hours: 720, humanized: "30d" },
        },
      },
    });
    const d = resolveSLA({
      role: "security",
      severity: "CRITICAL",
      agent: "sonar-scan",
      projectRoot: root,
    });
    eq(d.hours, 6, "override-agent: sonar-scan CRITICAL -> 6h");
    // Different agent falls to per-role override.
    const d2 = resolveSLA({
      role: "security",
      severity: "CRITICAL",
      agent: "audit",
      projectRoot: root,
    });
    eq(d2.hours, 12, "override-agent: audit sec CRITICAL -> 12h (role override)");
  }

  // ─── 5. trackSLAsForFindings — ok when age < sla ───────────────────────
  {
    const root = freshRoot(base, "track-ok");
    const now = new Date("2026-08-08T12:00:00Z");
    const fiveHoursAgo = new Date(now.getTime() - 5 * 3_600_000).toISOString();
    // Seed a prior cache entry with the same finding.
    const finding: Finding = {
      title: "SQL injection",
      severity: "CRITICAL",
      ruleId: "SEC-001",
      file: "src/a.ts",
      line: 42,
    };
    writeCache(root, {
      agent: "audit",
      stack: "aemcs",
      runAt: fiveHoursAgo,
      branch: "main",
      timestamp: "20260808_070000",
      reportPath: "reports/audit-1.xlsx",
      findings: [finding],
    });
    const items = trackSLAsForFindings({
      findings: [finding],
      role: "security",
      agent: "audit",
      projectRoot: root,
      now,
    });
    eq(items.length, 1, "track-ok: one item");
    const item = items[0]!;
    eq(item.slaHours, 24, "track-ok: sla=24h");
    eq(Math.round(item.ageHours), 5, "track-ok: age~5h");
    eq(item.status, "ok", "track-ok: status=ok");
    eq(item.firstSeenAt, fiveHoursAgo, "track-ok: firstSeenAt from cache");
  }

  // ─── 6. trackSLAsForFindings — overdue when age > sla ──────────────────
  {
    const root = freshRoot(base, "track-overdue");
    const now = new Date("2026-08-08T12:00:00Z");
    const thirtyHoursAgo = new Date(now.getTime() - 30 * 3_600_000).toISOString();
    const finding: Finding = {
      title: "SQL injection",
      severity: "CRITICAL",
      ruleId: "SEC-001",
      file: "src/a.ts",
      line: 42,
    };
    writeCache(root, {
      agent: "audit",
      stack: "aemcs",
      runAt: thirtyHoursAgo,
      branch: "main",
      timestamp: "20260807_060000",
      reportPath: "reports/audit-old.xlsx",
      findings: [finding],
    });
    const items = trackSLAsForFindings({
      findings: [finding],
      role: "security",
      agent: "audit",
      projectRoot: root,
      now,
    });
    eq(items[0]!.status, "overdue", "track-overdue: status=overdue");
    assert(items[0]!.ageHours >= 30, "track-overdue: age >= 30h");
  }

  // ─── 7. trackSLAsForFindings — due-soon at >= 80% SLA ──────────────────
  {
    const root = freshRoot(base, "track-due-soon");
    const now = new Date("2026-08-08T12:00:00Z");
    // SLA=24h → 80% = 19.2h. Use 20h.
    const twentyAgo = new Date(now.getTime() - 20 * 3_600_000).toISOString();
    const finding: Finding = {
      title: "x",
      severity: "CRITICAL",
      ruleId: "SEC-DS",
      file: "src/b.ts",
      line: 1,
    };
    writeCache(root, {
      agent: "audit",
      stack: "aemcs",
      runAt: twentyAgo,
      branch: "main",
      timestamp: "20260807_160000",
      reportPath: "reports/audit-ds.xlsx",
      findings: [finding],
    });
    const items = trackSLAsForFindings({
      findings: [finding],
      role: "security",
      agent: "audit",
      projectRoot: root,
      now,
    });
    eq(items[0]!.status, "due-soon", "track-due-soon: status=due-soon");
  }

  // ─── 8. summarizeSLA counts correctly ──────────────────────────────────
  {
    const root = freshRoot(base, "summarize");
    const now = new Date("2026-08-08T12:00:00Z");
    const mk = (
      hoursAgo: number,
      ruleId: string,
      file: string,
    ): Finding => ({
      title: ruleId,
      severity: "CRITICAL",
      ruleId,
      file,
      line: 1,
    });
    const fOk = mk(1, "R-OK", "a.ts");
    const fDS = mk(20, "R-DS", "b.ts");
    const fOD = mk(48, "R-OD", "c.ts");
    // Seed cache with each finding at appropriate age.
    for (const [f, h] of [
      [fOk, 1],
      [fDS, 20],
      [fOD, 48],
    ] as [Finding, number][]) {
      writeCache(root, {
        agent: "audit",
        stack: "aemcs",
        runAt: new Date(now.getTime() - h * 3_600_000).toISOString(),
        branch: "main",
        timestamp: `bucket-${h}`,
        reportPath: `reports/${f.ruleId}.xlsx`,
        findings: [f],
      });
    }
    const items = trackSLAsForFindings({
      findings: [fOk, fDS, fOD],
      role: "security",
      agent: "audit",
      projectRoot: root,
      now,
    });
    const s = summarizeSLA(items);
    eq(s.total, 3, "summarize: total=3");
    eq(s.ok, 1, "summarize: ok=1");
    eq(s.dueSoon, 1, "summarize: dueSoon=1");
    eq(s.overdue, 1, "summarize: overdue=1");
    assert(s.worstOverdueHours > 20, "summarize: worstOverdueHours > 20");
  }

  // ─── 9. Finding not in cache → firstSeenAt = now, status = ok ──────────
  {
    const root = freshRoot(base, "new-finding");
    const now = new Date("2026-08-08T12:00:00Z");
    const f: Finding = {
      title: "brand new",
      severity: "CRITICAL",
      ruleId: "R-NEW",
      file: "src/new.ts",
      line: 1,
    };
    const items = trackSLAsForFindings({
      findings: [f],
      role: "security",
      agent: "audit",
      projectRoot: root,
      now,
    });
    eq(items[0]!.status, "ok", "new-finding: status=ok (age 0)");
    eq(items[0]!.firstSeenAt, now.toISOString(), "new-finding: firstSeenAt=now");
  }

  // ─── 10. malformed sla.yaml → null + WARN, resolver falls back ─────────
  {
    const root = freshRoot(base, "malformed");
    fs.mkdirSync(path.join(root, ".bmad"), { recursive: true });
    fs.writeFileSync(
      slaFilePath(root),
      "this is not: [ valid: yaml\n  garbage: {{{\n",
    );
    const back = readSLAsFile(root);
    eq(back, null, "malformed: returns null");
    const d = resolveSLA({
      role: "security",
      severity: "CRITICAL",
      projectRoot: root,
    });
    eq(d.hours, DEFAULT_SLAS.security.CRITICAL.hours, "malformed: resolver defaults");
  }

  // ─── 11. sla.yaml roundtrip (write, read, still equal) ─────────────────
  {
    const root = freshRoot(base, "roundtrip");
    writeSLAsFile(root, {
      version: 1,
      overrides: [
        {
          role: "security",
          description: "tighter for pci scope",
          slas: {
            CRITICAL: { hours: 12, humanized: "12h" },
            HIGH: { hours: 48, humanized: "48h" },
          },
        },
        {
          role: "devops",
          slas: {
            CRITICAL: { hours: 24, humanized: "24h" },
          },
        },
      ],
      perAgentOverrides: {
        "sonar-scan": {
          CRITICAL: { hours: 24, humanized: "24h" },
          HIGH: { hours: 72, humanized: "72h" },
          MEDIUM: { hours: 168, humanized: "1w" },
          LOW: { hours: 336, humanized: "2w" },
          INFO: { hours: 720, humanized: "30d" },
        },
      },
    });
    const back = readSLAsFile(root);
    assert(back, "roundtrip: read back");
    eq(back!.version, 1, "roundtrip: version");
    eq(back!.overrides!.length, 2, "roundtrip: 2 overrides");
    eq(back!.overrides![0]!.role, "security", "roundtrip: first role");
    eq(back!.overrides![0]!.slas.CRITICAL!.hours, 12, "roundtrip: sec CRITICAL 12h");
    eq(
      back!.perAgentOverrides!["sonar-scan"]!.CRITICAL.hours,
      24,
      "roundtrip: per-agent sonar-scan CRITICAL",
    );
  }

  process.stdout.write("OK\n");
}

main();
