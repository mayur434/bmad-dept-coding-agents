/**
 * DCA Shared — Cross-agent chain runner.
 * =======================================
 * Runs a fixed sequence of DCA agents (audit → sonar-scan → test-coverage →
 * impact-analysis) in-process by spawning each agent's run.ts with `npx
 * ts-node`. After every stage the shared findings cache is inspected via
 * `readLatestRun` to grab the report path + finding counts for the roll-up.
 *
 * Zero deps beyond Node core (child_process, path, fs). Non-fatal by default:
 * a stage failure records status=failed and continues unless
 * `stopOnFail: true`.
 *
 * NOTE: children may already append their own CHANGE-LOG entries. The
 * roll-up appends one additional summary entry — the duplication is
 * intentional (one line describes the chain run itself).
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { readLatestRun, CachedRunAgent } from "../findings/cache";
import { currentBranch } from "../git/git";
import { writeRollup } from "./rollup";

export type StageId =
  | "audit"
  | "sonar-scan"
  | "test-coverage"
  | "impact-analysis";

const DEFAULT_STAGES: StageId[] = [
  "audit",
  "sonar-scan",
  "test-coverage",
  "impact-analysis",
];

/** Map StageId → agent directory suffix (skills/bmad-dept-code-<suffix>-agent). */
const AGENT_DIR: Record<StageId, string> = {
  audit: "audit",
  "sonar-scan": "sonar-scan",
  "test-coverage": "test-coverage",
  "impact-analysis": "impact-analysis",
};

/** Map StageId → findings-cache agent key. */
const CACHE_AGENT: Record<StageId, CachedRunAgent> = {
  audit: "audit",
  "sonar-scan": "sonar-scan",
  "test-coverage": "test-coverage",
  "impact-analysis": "impact-analysis",
};

export interface ChainOpts {
  projectRoot: string;
  stages?: StageId[];
  role?: string;
  yesInstall?: boolean;
  noInstall?: boolean;
  stopOnFail?: boolean;
  /** Per-stage timeout. Default 30 minutes. */
  stageTimeoutMs?: number;
}

export interface StageResult {
  stage: StageId;
  status: "ok" | "failed" | "skipped";
  exitCode: number;
  reportPath?: string;
  findingsCount?: number;
  durationMs: number;
  stderrTail: string;
}

export interface ChainResult {
  runId: string;
  timestamp: string;
  branch: string;
  role: string;
  stages: StageResult[];
  rollupPath: string;
}

/** Walk up from a starting directory until a folder named "skills" is found. */
function findSkillsRoot(start: string): string {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (path.basename(dir) === "skills") return dir;
    dir = path.dirname(dir);
  }
  throw new Error(
    `[dca-chain-all] unable to locate the "skills/" root from ${start}`,
  );
}

function resolveAgentRunTs(stage: StageId): string {
  const skillsRoot = findSkillsRoot(__dirname);
  const suffix = AGENT_DIR[stage];
  const runTs = path.join(
    skillsRoot,
    `bmad-dept-code-${suffix}-agent`,
    "scripts",
    "run.ts",
  );
  if (!fs.existsSync(runTs)) {
    throw new Error(`[dca-chain-all] agent run.ts not found: ${runTs}`);
  }
  return runTs;
}

function timestampId(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function tail(buf: string, bytes = 1024): string {
  if (buf.length <= bytes) return buf;
  return buf.slice(buf.length - bytes);
}

interface SpawnResult {
  exitCode: number;
  stderr: string;
  timedOut: boolean;
}

function spawnStage(
  runTs: string,
  argv: string[],
  timeoutMs: number,
  stderrLogPath: string,
  label: string,
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["ts-node", runTs, ...argv], {
      stdio: ["ignore", "inherit", "pipe"],
      env: process.env,
    });
    let stderr = "";
    let killedByTimeout = false;
    const timer = setTimeout(() => {
      killedByTimeout = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* noop */
      }
    }, timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => {
      const s = chunk.toString("utf8");
      stderr += s;
      // Forward to parent stderr so the user sees progress live.
      process.stderr.write(s);
    });

    child.on("error", (err: Error) => {
      stderr += `\n[dca-chain-all] spawn error for ${label}: ${err.message}\n`;
    });

    child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer);
      try {
        fs.mkdirSync(path.dirname(stderrLogPath), { recursive: true });
        fs.writeFileSync(stderrLogPath, stderr, "utf8");
      } catch (err) {
        process.stderr.write(
          `[dca-chain-all] WARN: unable to write stderr log ${stderrLogPath}: ${(err as Error).message}\n`,
        );
      }
      const exitCode =
        code ?? (signal ? 130 : killedByTimeout ? 124 : 1);
      resolve({ exitCode, stderr, timedOut: killedByTimeout });
    });
  });
}

/** Build the argv passed to a child stage's run.ts. */
function stageArgv(
  stage: StageId,
  opts: ChainOpts,
  projectRoot: string,
): string[] {
  const argv: string[] = ["--path", projectRoot, "--technical"];
  if (opts.role) argv.push("--role", opts.role);
  // The parent chain already ran auto-install once; children should skip it.
  argv.push("--no-install");
  if (stage === "impact-analysis") {
    // Default to a diff-based impact when no explicit inputs are provided.
    argv.push("--diff");
  }
  return argv;
}

export async function runChain(opts: ChainOpts): Promise<ChainResult> {
  const projectRoot = path.resolve(opts.projectRoot);
  const stages: StageId[] = opts.stages && opts.stages.length > 0
    ? opts.stages
    : DEFAULT_STAGES.slice();
  const timeoutMs = opts.stageTimeoutMs ?? 30 * 60 * 1000;
  const stopOnFail = opts.stopOnFail === true;

  const now = new Date();
  const runId = `dca-chainall-${timestampId(now)}`;
  const timestamp = now.toISOString();
  const branch = currentBranch(projectRoot) ?? "nobranch";
  const role = opts.role ?? process.env.DCA_ROLE ?? "generic";

  const stderrDir = path.join(projectRoot, ".bmad", "orchestrator", runId);

  const results: StageResult[] = [];
  let stopped = false;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (stopped) {
      results.push({
        stage,
        status: "skipped",
        exitCode: 0,
        durationMs: 0,
        stderrTail: "",
      });
      continue;
    }

    process.stderr.write(
      `[dca-chain-all] stage ${i + 1}/${stages.length}: ${stage}…\n`,
    );

    let runTs: string;
    try {
      runTs = resolveAgentRunTs(stage);
    } catch (err) {
      const msg = (err as Error).message;
      process.stderr.write(`${msg}\n`);
      results.push({
        stage,
        status: "failed",
        exitCode: 127,
        durationMs: 0,
        stderrTail: msg,
      });
      if (stopOnFail) stopped = true;
      continue;
    }

    const argv = stageArgv(stage, opts, projectRoot);
    const stderrLog = path.join(stderrDir, `${stage}.stderr.log`);
    const startedAt = Date.now();
    const spawned = await spawnStage(runTs, argv, timeoutMs, stderrLog, stage);
    const durationMs = Date.now() - startedAt;

    // Look up the most recent cached run for this stage to grab metadata.
    let reportPath: string | undefined;
    let findingsCount: number | undefined;
    try {
      const cached = readLatestRun(projectRoot, CACHE_AGENT[stage]);
      if (cached) {
        reportPath = cached.reportPath;
        findingsCount = cached.findings.length;
      }
    } catch (err) {
      process.stderr.write(
        `[dca-chain-all] WARN: cache read failed for ${stage}: ${(err as Error).message}\n`,
      );
    }

    const status: StageResult["status"] =
      spawned.exitCode === 0 ? "ok" : "failed";
    results.push({
      stage,
      status,
      exitCode: spawned.exitCode,
      reportPath,
      findingsCount,
      durationMs,
      stderrTail: tail(spawned.stderr),
    });

    if (status === "failed" && stopOnFail) stopped = true;
  }

  const partial: ChainResult = {
    runId,
    timestamp,
    branch,
    role,
    stages: results,
    rollupPath: "",
  };

  let rollupPath = "";
  try {
    rollupPath = writeRollup(partial, projectRoot);
  } catch (err) {
    process.stderr.write(
      `[dca-chain-all] WARN: rollup write failed: ${(err as Error).message}\n`,
    );
  }

  return { ...partial, rollupPath };
}
