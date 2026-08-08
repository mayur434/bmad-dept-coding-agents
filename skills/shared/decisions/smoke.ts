/**
 * DCA Shared — decisions smoke test.
 *
 * Runnable:
 *   npx ts-node skills/shared/decisions/smoke.ts /tmp/decisions-smoke
 *
 * Exits 0 with "OK" on success, non-zero on any assertion failure.
 * Non-fatal WARN lines from the module are expected on the "malformed YAML"
 * case — they are the code under test proving the non-fatal posture works.
 */

import * as fs from "fs";
import * as path from "path";

import type { Finding } from "../core/types";
import {
  Decision,
  decisionsFilePath,
  filterFindingsByDecisions,
  readDecisionsFile,
  removeDecision,
  upsertDecision,
  writeDecisionsFile,
} from "./index";
import { decisionIdFor } from "./id";

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    process.exit(1);
  }
}

function eq<T>(actual: T, expected: T, msg: string): void {
  const a = canonical(actual);
  const b = canonical(expected);
  if (a !== b) {
    process.stderr.write(`FAIL: ${msg}\n  actual:   ${a}\n  expected: ${b}\n`);
    process.exit(1);
  }
}

function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const o = val as Record<string, unknown>;
      const keys = Object.keys(o).sort();
      const sorted: Record<string, unknown> = {};
      for (const k of keys) sorted[k] = o[k];
      return sorted;
    }
    return val;
  });
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

function main(): void {
  const base = process.argv[2] || "/tmp/decisions-smoke";
  rmrf(base);
  fs.mkdirSync(base, { recursive: true });

  // ─── 1. roundtrip ────────────────────────────────────────────────────────
  {
    const root = freshRoot(base, "roundtrip");
    const now = "2026-08-06T12:00:00Z";
    const dec: Decision = {
      id: "dec-abc12345",
      ruleId: "COMMERCE-SEC-001",
      file: "app/code/Vendor/Module/Model/Foo.php",
      line: 42,
      status: "accepted",
      rationale:
        "Legacy code from acquired product; risk accepted.\nRefactor JIRA-1234.",
      signedBy: "architect@company.com",
      signedAt: now,
      expiresAt: "2027-01-31T23:59:59Z",
      tags: ["q4-release", "tech-debt"],
    };
    writeDecisionsFile(root, {
      version: 1,
      decisions: [dec],
      lastModified: now,
    });
    const back = readDecisionsFile(root);
    assert(back, "roundtrip: readDecisionsFile returned null");
    eq(back!.version, 1, "roundtrip: version");
    eq(back!.lastModified, now, "roundtrip: lastModified");
    eq(back!.decisions.length, 1, "roundtrip: one decision");
    eq(back!.decisions[0], dec, "roundtrip: decision fields");
  }

  // ─── 2. upsert de-dupes on id ────────────────────────────────────────────
  {
    const root = freshRoot(base, "upsert");
    const dec: Decision = {
      id: "dec-upsert01",
      ruleId: "R-1",
      file: "src/a.ts",
      line: 10,
      status: "deferred",
      rationale: "first",
      signedBy: "me",
      signedAt: "2026-08-06T00:00:00Z",
    };
    upsertDecision(root, dec);
    upsertDecision(root, { ...dec, rationale: "second" });
    upsertDecision(root, { ...dec, rationale: "third" });
    const back = readDecisionsFile(root);
    assert(back, "upsert: file missing");
    eq(back!.decisions.length, 1, "upsert: single row");
    eq(back!.decisions[0]!.rationale, "third", "upsert: latest rationale wins");
  }

  // ─── 3. remove ───────────────────────────────────────────────────────────
  {
    const root = freshRoot(base, "remove");
    const dec: Decision = {
      id: "dec-remove01",
      ruleId: "R-2",
      file: "src/b.ts",
      status: "wontfix",
      rationale: "obsolete",
      signedBy: "me",
      signedAt: "2026-08-06T00:00:00Z",
    };
    upsertDecision(root, dec);
    const after = removeDecision(root, dec.id);
    assert(after, "remove: returned null");
    eq(after!.decisions.length, 0, "remove: empty after remove");
    const back = readDecisionsFile(root);
    assert(back, "remove: file missing after remove");
    eq(back!.decisions.length, 0, "remove: persisted empty");
  }

  // ─── 4. malformed YAML — non-fatal ───────────────────────────────────────
  {
    const root = freshRoot(base, "malformed");
    fs.mkdirSync(path.join(root, ".bmad"), { recursive: true });
    fs.writeFileSync(
      decisionsFilePath(root),
      "this is not: [ valid: yaml\n  garbage: {{{\n",
    );
    const back = readDecisionsFile(root);
    eq(back, null, "malformed: returns null");
  }

  // ─── 5. exact rule+file+line match ───────────────────────────────────────
  {
    const root = freshRoot(base, "exact");
    upsertDecision(root, {
      id: "dec-e1",
      ruleId: "SEC-001",
      file: "src/a.ts",
      line: 42,
      status: "accepted",
      rationale: "ok",
      signedBy: "me",
      signedAt: nowIso(),
    });
    const findings: Finding[] = [
      {
        title: "hit",
        severity: "HIGH",
        ruleId: "SEC-001",
        file: "src/a.ts",
        line: 42,
      },
      {
        title: "miss-line",
        severity: "HIGH",
        ruleId: "SEC-001",
        file: "src/a.ts",
        line: 43,
      },
    ];
    const res = filterFindingsByDecisions(findings, { projectRoot: root });
    eq(res.suppressed.length, 1, "exact: one suppressed");
    eq(res.kept.length, 1, "exact: one kept");
    eq(res.suppressed[0]!.finding.title, "hit", "exact: correct suppressed");
  }

  // ─── 6. file-wide match (decision omits line) ────────────────────────────
  {
    const root = freshRoot(base, "filewide");
    upsertDecision(root, {
      id: "dec-fw1",
      ruleId: "SEC-002",
      file: "src/x.ts",
      status: "deferred",
      rationale: "later",
      signedBy: "me",
      signedAt: nowIso(),
    });
    const findings: Finding[] = [
      { title: "a", severity: "HIGH", ruleId: "SEC-002", file: "src/x.ts", line: 1 },
      { title: "b", severity: "HIGH", ruleId: "SEC-002", file: "src/x.ts", line: 99 },
      { title: "c", severity: "HIGH", ruleId: "SEC-002", file: "src/y.ts", line: 1 },
    ];
    const res = filterFindingsByDecisions(findings, { projectRoot: root });
    eq(res.suppressed.length, 2, "filewide: two suppressed");
    eq(res.kept.length, 1, "filewide: one kept (different file)");
    eq(res.kept[0]!.title, "c", "filewide: correct kept");
  }

  // ─── 7. rule-wide match (decision omits file) ────────────────────────────
  {
    const root = freshRoot(base, "rulewide");
    // Write file directly with empty file field (rare rule-wide decision).
    const dec: Decision = {
      id: "dec-rw1",
      ruleId: "SEC-003",
      file: "",
      status: "wontfix",
      rationale: "policy exception",
      signedBy: "me",
      signedAt: nowIso(),
    };
    writeDecisionsFile(root, {
      version: 1,
      decisions: [dec],
      lastModified: nowIso(),
    });
    // Sanity: roundtrip must preserve empty file.
    const back = readDecisionsFile(root);
    assert(back, "rulewide: read null");
    eq(back!.decisions[0]!.file, "", "rulewide: empty file roundtrip");

    const findings: Finding[] = [
      { title: "a", severity: "HIGH", ruleId: "SEC-003", file: "src/one.ts", line: 1 },
      { title: "b", severity: "HIGH", ruleId: "SEC-003", file: "src/two.ts" },
      { title: "c", severity: "HIGH", ruleId: "OTHER", file: "src/one.ts", line: 1 },
    ];
    const res = filterFindingsByDecisions(findings, { projectRoot: root });
    eq(res.suppressed.length, 2, "rulewide: two suppressed");
    eq(res.kept.length, 1, "rulewide: one kept (different rule)");
    eq(res.kept[0]!.title, "c", "rulewide: correct kept");
  }

  // ─── 8. expired + ignoreExpired:true (default) → NOT suppress ───────────
  {
    const root = freshRoot(base, "expired-ignore");
    upsertDecision(root, {
      id: "dec-x1",
      ruleId: "SEC-004",
      file: "src/z.ts",
      line: 5,
      status: "accepted",
      rationale: "was ok",
      signedBy: "me",
      signedAt: "2020-01-01T00:00:00Z",
      expiresAt: "2021-01-01T00:00:00Z",
    });
    const findings: Finding[] = [
      { title: "a", severity: "HIGH", ruleId: "SEC-004", file: "src/z.ts", line: 5 },
    ];
    const res = filterFindingsByDecisions(findings, { projectRoot: root });
    eq(res.suppressed.length, 0, "expired-ignore: none suppressed");
    eq(res.kept.length, 1, "expired-ignore: one kept");
  }

  // ─── 9. expired + ignoreExpired:false → DOES suppress ───────────────────
  {
    const root = freshRoot(base, "expired-keep");
    upsertDecision(root, {
      id: "dec-x2",
      ruleId: "SEC-005",
      file: "src/z.ts",
      line: 5,
      status: "accepted",
      rationale: "was ok",
      signedBy: "me",
      signedAt: "2020-01-01T00:00:00Z",
      expiresAt: "2021-01-01T00:00:00Z",
    });
    const findings: Finding[] = [
      { title: "a", severity: "HIGH", ruleId: "SEC-005", file: "src/z.ts", line: 5 },
    ];
    const res = filterFindingsByDecisions(findings, {
      projectRoot: root,
      ignoreExpired: false,
    });
    eq(res.suppressed.length, 1, "expired-keep: one suppressed");
  }

  // ─── 10. status filter — 'fixed' does NOT suppress by default ───────────
  {
    const root = freshRoot(base, "status-filter");
    writeDecisionsFile(root, {
      version: 1,
      lastModified: nowIso(),
      decisions: [
        {
          id: "dec-s1",
          ruleId: "R-A",
          file: "a.ts",
          line: 1,
          status: "accepted",
          rationale: "yes",
          signedBy: "me",
          signedAt: nowIso(),
        },
        {
          id: "dec-s2",
          ruleId: "R-B",
          file: "b.ts",
          line: 1,
          status: "deferred",
          rationale: "later",
          signedBy: "me",
          signedAt: nowIso(),
        },
        {
          id: "dec-s3",
          ruleId: "R-C",
          file: "c.ts",
          line: 1,
          status: "fixed",
          rationale: "shipped",
          signedBy: "me",
          signedAt: nowIso(),
        },
      ],
    });
    const findings: Finding[] = [
      { title: "a", severity: "HIGH", ruleId: "R-A", file: "a.ts", line: 1 },
      { title: "b", severity: "HIGH", ruleId: "R-B", file: "b.ts", line: 1 },
      { title: "c", severity: "HIGH", ruleId: "R-C", file: "c.ts", line: 1 },
    ];
    const res = filterFindingsByDecisions(findings, { projectRoot: root });
    eq(res.suppressed.length, 2, "status-filter: two suppressed (accepted+deferred)");
    eq(res.kept.length, 1, "status-filter: one kept (fixed)");
    eq(res.kept[0]!.ruleId, "R-C", "status-filter: 'fixed' kept");
  }

  // ─── 11. decisionIdFor is deterministic ──────────────────────────────────
  {
    const a = decisionIdFor({ ruleId: "R", file: "f.ts", line: 3 });
    const b = decisionIdFor({ ruleId: "R", file: "f.ts", line: 3 });
    const c = decisionIdFor({ ruleId: "R", file: "f.ts", line: 4 });
    eq(a, b, "decisionIdFor: deterministic");
    assert(a !== c, "decisionIdFor: differs on line change");
    assert(/^dec-[0-9a-f]{8}$/.test(a), "decisionIdFor: format dec-<hex8>");
  }

  process.stdout.write("OK\n");
}

function nowIso(): string {
  return new Date().toISOString();
}

main();
