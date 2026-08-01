#!/usr/bin/env npx ts-node
/**
 * DCA Shared — orchestrator smoke test.
 * ======================================
 * Fabricates a throw-away project directory, runs the chain with only the
 * `audit` stage, and asserts the runner returned a StageResult and a
 * roll-up file on disk. Non-zero exit on any assertion failure.
 *
 * Usage: npx ts-node skills/shared/orchestrator/smoke.ts [projectRoot]
 * Default projectRoot: /tmp/chain-smoke
 */

import * as fs from "fs";
import * as path from "path";

import { runChain } from "./runner";

async function main(): Promise<void> {
  const projectRoot = path.resolve(process.argv[2] ?? "/tmp/chain-smoke");
  // Fresh slate.
  if (fs.existsSync(projectRoot)) fs.rmSync(projectRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, "package.json"),
    JSON.stringify({ name: "chain-smoke", version: "0.0.1" }, null, 2),
    "utf8",
  );

  console.log(`[smoke] projectRoot=${projectRoot}`);
  const result = await runChain({
    projectRoot,
    stages: ["audit"],
    noInstall: true,
    role: "ea",
    stageTimeoutMs: 5 * 60 * 1000,
  });

  const errors: string[] = [];
  if (result.stages.length !== 1) errors.push(`expected 1 stage, got ${result.stages.length}`);
  const s = result.stages[0];
  if (!s) errors.push("no StageResult returned");
  if (s && typeof s.exitCode !== "number") errors.push(`stage exitCode not numeric: ${s.exitCode}`);
  if (s && s.stderrTail === undefined) errors.push("stderrTail undefined");
  if (!result.rollupPath) errors.push("rollupPath empty");
  if (result.rollupPath && !fs.existsSync(result.rollupPath)) {
    errors.push(`rollupPath does not exist: ${result.rollupPath}`);
  }

  console.log(`[smoke] runId=${result.runId}`);
  console.log(`[smoke] stage=${s?.stage} status=${s?.status} exit=${s?.exitCode} durMs=${s?.durationMs}`);
  console.log(`[smoke] rollup=${result.rollupPath}`);

  if (errors.length > 0) {
    console.error("[smoke] FAILED");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("OK");
}

main().catch((err) => {
  console.error("[smoke] fatal:", (err as Error).stack ?? err);
  process.exit(1);
});
