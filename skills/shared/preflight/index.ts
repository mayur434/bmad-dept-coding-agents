/**
 * DCA Shared — Preflight / Mode Advisor
 * ======================================
 * When a BMAD command is triggered from an AI assistant (Copilot / Claude / Cursor /
 * any LLM), this detects the current model, sizes the project against the model's
 * context window, and recommends whether to lean on the STATIC (Tier-1) engine, the
 * LLM (Tier-2) semantic pass, or a HYBRID of both. The CLI prints it; the SKILL.md
 * tells the host LLM to surface it conversationally.
 */

import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";

export interface ModelInfo {
  provider: string;   // Anthropic / OpenAI / GitHub Copilot / Google / Unknown
  model: string;      // resolved model id or "unknown"
  tool: string;       // Claude Code / Copilot / Cursor / VS Code / CLI
  contextTokens: number;
  detectedFrom: string;
}

export interface ProjectSize {
  files: number;
  loc: number;
  estTokens: number;
}

export type Mode = "static" | "hybrid" | "llm";

export interface Advice {
  mode: Mode;
  headline: string;
  reason: string;
  fitPct: number; // project tokens as % of context window
}

// ── model detection ───────────────────────────────────────────────────────────
const CTX: Array<[RegExp, number]> = [
  [/sonnet-4|claude-4|opus-4|\[1m\]|1m/i, 1_000_000],
  [/claude|anthropic/i, 200_000],
  [/gpt-4o|gpt-4\.1|gpt-4-turbo|o1|o3|gpt-5/i, 128_000],
  [/gpt-4(?![.\-]?o)/i, 8_192],
  [/gpt-3\.5/i, 16_385],
  [/gemini-1\.5|gemini-2/i, 1_000_000],
  [/gemini/i, 128_000],
  [/llama-3|mixtral|mistral/i, 32_000],
];

function ctxFor(model: string): number {
  for (const [re, n] of CTX) if (re.test(model)) return n;
  return 128_000;
}

export function detectModel(env: NodeJS.ProcessEnv = process.env): ModelInfo {
  const pick = (...keys: string[]) => {
    for (const k of keys) if (env[k]) return { v: env[k] as string, k };
    return null;
  };
  const anthropic = pick("ANTHROPIC_MODEL", "CLAUDE_MODEL", "ANTHROPIC_DEFAULT_MODEL");
  const openai = pick("OPENAI_MODEL", "OPENAI_API_MODEL", "AZURE_OPENAI_DEPLOYMENT");
  const copilot = pick("COPILOT_MODEL", "GITHUB_COPILOT_MODEL");
  const google = pick("GEMINI_MODEL", "GOOGLE_MODEL", "VERTEX_MODEL");
  const generic = pick("BMAD_MODEL", "LLM_MODEL", "AI_MODEL", "MODEL");

  const tool =
    env.CLAUDECODE || env.CLAUDE_CODE ? "Claude Code" :
    env.GITHUB_COPILOT || copilot ? "GitHub Copilot" :
    env.CURSOR_TRACE_ID || env.CURSOR ? "Cursor" :
    env.TERM_PROGRAM === "vscode" ? "VS Code" :
    "CLI / AI assistant";

  let provider = "Unknown", model = "unknown", from = "none";
  if (anthropic) { provider = "Anthropic"; model = anthropic.v; from = anthropic.k; }
  else if (openai) { provider = "OpenAI"; model = openai.v; from = openai.k; }
  else if (copilot) { provider = "GitHub Copilot"; model = copilot.v; from = copilot.k; }
  else if (google) { provider = "Google"; model = google.v; from = google.k; }
  else if (generic) { provider = "AI assistant"; model = generic.v; from = generic.k; }
  else if (tool === "Claude Code") { provider = "Anthropic"; model = "claude (Claude Code)"; from = "CLAUDECODE"; }
  else if (tool === "GitHub Copilot") { provider = "GitHub Copilot"; model = "copilot"; from = "GITHUB_COPILOT"; }

  return { provider, model, tool, contextTokens: ctxFor(model), detectedFrom: from };
}

// ── project sizing ────────────────────────────────────────────────────────────
const CODE_GLOB = "**/*.{java,js,mjs,cjs,jsx,ts,tsx,php,html,xml,css,json,yaml,yml,graphqls}";
const IGNORE = ["**/node_modules/**", "**/vendor/**", "**/target/**", "**/build/**", "**/dist/**", "**/.git/**"];

export function sizeProject(root: string): ProjectSize {
  const files = fg.sync(path.join(root, CODE_GLOB).replace(/\\/g, "/"), { ignore: IGNORE }).slice(0, 20000);
  let chars = 0, loc = 0, counted = 0;
  for (const f of files) {
    try {
      const st = fs.statSync(f);
      if (st.size > 1_000_000) { chars += 1_000_000; continue; }
      const c = fs.readFileSync(f, "utf8");
      chars += c.length;
      loc += c.split("\n").length;
      counted++;
    } catch { /* skip */ }
  }
  return { files: files.length, loc, estTokens: Math.round(chars / 4) };
}

// ── recommendation ────────────────────────────────────────────────────────────
export function recommend(size: ProjectSize, model: ModelInfo): Advice {
  const fitPct = Math.round((size.estTokens / model.contextTokens) * 100);
  if (fitPct >= 60) {
    return {
      mode: "static", fitPct,
      headline: "Use the STATIC engine (Tier-1) first",
      reason: `The project (~${fmt(size.estTokens)} tokens) is ${fitPct}% of the ${fmt(model.contextTokens)}-token window — too large to load fully. Run the deterministic scanner, then hand only the report/findings to the LLM for interpretation.`,
    };
  }
  if (fitPct <= 12) {
    return {
      mode: "llm", fitPct,
      headline: "LLM (Tier-2) semantic pass is viable — or HYBRID",
      reason: `Small footprint (~${fmt(size.estTokens)} tokens, ${fitPct}% of window). The LLM can reason over the code directly; still run the static engine first for deterministic, repeatable findings, then let the LLM deepen them.`,
    };
  }
  return {
    mode: "hybrid", fitPct,
    headline: "HYBRID — static scan, then LLM on the findings",
    reason: `Mid-sized (~${fmt(size.estTokens)} tokens, ${fitPct}% of window). Run the Tier-1 engine for full deterministic coverage, then use the LLM (Tier-2) on the generated report to add semantic depth without blowing the context budget.`,
  };
}

// ── render ────────────────────────────────────────────────────────────────────
export interface PreflightResult { model: ModelInfo; size: ProjectSize; advice: Advice; }

export function runPreflight(root: string): PreflightResult {
  const model = detectModel();
  const size = sizeProject(root);
  return { model, size, advice: recommend(size, model) };
}

export function renderPreflight(pf: PreflightResult, opts: { agent?: string; stack?: string } = {}): string {
  const { model, size, advice } = pf;
  const L: string[] = [];
  L.push("🤖 Preflight — LLM usage & mode recommendation");
  L.push("─".repeat(60));
  L.push(`   AI in use : ${model.provider} · ${model.model}  (${model.tool})`);
  L.push(`   Context   : ~${fmt(model.contextTokens)} tokens${model.detectedFrom !== "none" ? `  [from ${model.detectedFrom}]` : "  [assumed]"}`);
  L.push(`   Project   : ${size.files} files · ~${fmt(size.loc)} LOC · ~${fmt(size.estTokens)} tokens${opts.stack ? `  (${opts.stack})` : ""}`);
  L.push(`   Fit       : project ≈ ${advice.fitPct}% of the context window`);
  L.push("");
  L.push(`   ➜ Recommendation: ${advice.headline}`);
  L.push(`     ${wrap(advice.reason, 68, "     ")}`);
  L.push("─".repeat(60));
  return L.join("\n");
}

function fmt(n: number): string { return n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n); }
function wrap(s: string, width: number, indent: string): string {
  const words = s.split(" "); const lines: string[] = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) { lines.push(cur.trim()); cur = w; }
    else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.join("\n" + indent);
}
