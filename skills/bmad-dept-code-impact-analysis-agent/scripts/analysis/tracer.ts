/**
 * Impact Analysis — Generic code tracer
 * ======================================
 * Maps each ingested InputItem (bug / requirement) onto impacted code:
 *   1. extract candidate symbols from the item text (class names, paths, modules),
 *   2. score source files by filename + content matches,
 *   3. compute a reverse-dependency blast radius for each impacted file,
 *   4. emit risk-scored Findings carrying inputRef (→ Input Traceability sheet).
 * Works across all stacks via a StackProfile; every input item is represented in
 * the output (a no-match item yields an INFO "manual review" row).
 */

import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { Finding, Severity } from "../../../shared/core/types";
import { InputItem } from "../inputs/types";
import { StackProfile } from "../engines/profiles";

const SEV_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const STOP = new Set([
  "The", "This", "That", "These", "Those", "When", "Then", "Should", "Must", "Will", "With", "From",
  "For", "And", "But", "Not", "All", "Any", "Add", "New", "Use", "Set", "Get", "Fix", "Bug", "Issue",
  "Feature", "Requirement", "System", "Application", "Given", "While", "After", "Before", "Also", "Page",
  "User", "Users", "Support", "Enable", "Ensure", "Allow", "Update", "Change", "Create", "Remove", "Error",
]);

interface SourceFile { rel: string; base: string; content: string; }
interface Candidate { sym: string; weight: number; }

export interface TraceResult {
  findings: Finding[];
  sourceCount: number;
  itemCount: number;
  matchedItems: number;
}

const MAX_FILES = 5000;
const MAX_BYTES = 200_000;
const MAX_IMPACTED_PER_ITEM = 8;

export function traceImpact(projectPath: string, items: InputItem[], profile: StackProfile): TraceResult {
  const sources = loadSources(projectPath, profile);
  const findings: Finding[] = [];
  let matchedItems = 0;

  for (const item of items) {
    const cands = extractCandidates(item, profile);
    const scored = scoreFiles(sources, cands);
    const inputRef = { id: item.id, type: item.kind, title: item.title, source: item.source } as const;

    if (scored.length === 0) {
      findings.push({
        title: `${cap(item.kind)} ${item.id}: no direct code match`,
        description: item.title,
        stack: profile.id,
        category: item.kind === "bug" ? "Bug fix impact" : "Requirement impact",
        severity: "INFO",
        confidence: 0.2,
        impact: "No source file matched the extracted symbols — assess manually (may be new code, infra, or content).",
        recommendation: "Manually scope this item; consider adding module/label hints or file references to improve tracing.",
        status: "Needs manual review",
        source: "llm",
        inputRef,
      });
      continue;
    }

    matchedItems++;
    for (const s of scored.slice(0, MAX_IMPACTED_PER_ITEM)) {
      const blast = blastRadius(sources, s.file);
      const sev = severityFor(s.filenameMatch, blast, item.priority);
      findings.push({
        title: `${cap(item.kind)} ${item.id} impacts ${path.basename(s.file.rel)}`,
        description: item.title + (item.description ? ` — ${clip(item.description, 240)}` : ""),
        stack: profile.id,
        category: item.kind === "bug" ? "Bug fix impact" : "Requirement impact",
        file: s.file.rel,
        severity: sev,
        confidence: Math.min(0.97, 0.4 + 0.12 * s.matched.length + (s.filenameMatch ? 0.3 : 0)),
        impact:
          `${cap(item.kind)} ${item.id} ("${clip(item.title, 80)}") maps to ${s.file.rel} ` +
          `via ${s.matched.slice(0, 5).join(", ")}; ${blast} downstream reference(s) in the codebase` +
          `${blast >= 5 ? " (wide blast radius)" : ""}.`,
        recommendation:
          `Review ${s.file.rel}${blast > 0 ? ` and its ${blast} dependent(s)` : ""}; ` +
          `add/adjust regression coverage before merging the ${item.kind}.`,
        effort: blast >= 5 ? "L" : blast >= 2 ? "M" : "S",
        status: "Open",
        source: "hybrid",
        inputRef,
      });
    }
    if (scored.length > MAX_IMPACTED_PER_ITEM) {
      findings.push({
        title: `${cap(item.kind)} ${item.id}: ${scored.length - MAX_IMPACTED_PER_ITEM} more candidate file(s) not shown`,
        stack: profile.id, category: "Coverage note", severity: "INFO",
        impact: `Showing top ${MAX_IMPACTED_PER_ITEM} of ${scored.length} matched files by score.`,
        recommendation: "Narrow the item text or add a module hint to sharpen the match.",
        status: "Info", source: "llm", inputRef,
      });
    }
  }

  return { findings, sourceCount: sources.length, itemCount: items.length, matchedItems };
}

// ── source loading ────────────────────────────────────────────────────────────
function loadSources(projectPath: string, profile: StackProfile): SourceFile[] {
  const patterns = profile.sourceGlobs.map((g) => path.join(projectPath, g).replace(/\\/g, "/"));
  const files = Array.from(new Set(fg.sync(patterns, { ignore: profile.ignore, unique: true }))).slice(0, MAX_FILES);
  const out: SourceFile[] = [];
  for (const f of files) {
    let content = "";
    try {
      const stat = fs.statSync(f);
      if (stat.size > MAX_BYTES) continue;
      content = fs.readFileSync(f, "utf8");
    } catch { continue; }
    out.push({ rel: path.relative(projectPath, f).replace(/\\/g, "/"), base: path.basename(f).replace(/\.[^.]+$/, ""), content });
  }
  return out;
}

// ── candidate extraction ──────────────────────────────────────────────────────
function extractCandidates(item: InputItem, profile: StackProfile): Candidate[] {
  const text = `${item.title}\n${item.description}\n${item.module ?? ""}`;
  const map = new Map<string, number>(); // sym → weight (keep max)
  const add = (sym: string, w: number) => {
    const s = sym.trim();
    if (s.length < 3) return;
    const k = s.toLowerCase();
    map.set(k, Math.max(map.get(k) ?? 0, w));
    // also index the raw form for case-sensitive matching
    caseForms.set(k, s);
  };
  const caseForms = new Map<string, string>();

  // strong: CamelCase identifiers (internal capital)
  for (const m of text.matchAll(/\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+\b/g)) add(m[0], 3);
  // strong: quoted/backticked identifiers
  for (const m of text.matchAll(/[`'"]([A-Za-z_][\w./\\-]{2,})[`'"]/g)) add(m[1], 3);
  // strong: file paths / filenames with extension
  for (const m of text.matchAll(/\b[\w./\\-]+\.(java|js|mjs|ts|php|html|xml|css|jsx)\b/g)) add(m[0].split(/[\\/]/).pop()!.replace(/\.[^.]+$/, ""), 3);
  // strong: module pattern (commerce Vendor_Module / Vendor\Module)
  if (profile.modulePattern) for (const m of text.matchAll(profile.modulePattern)) add(m[0], 3);
  // medium: entity-suffix words
  const suffixRe = new RegExp(`\\b[A-Za-z][A-Za-z0-9]*(?:${profile.entitySuffixes.join("|")})\\b`, "g");
  if (profile.entitySuffixes.length) for (const m of text.matchAll(suffixRe)) add(m[0], 3);
  // medium: kebab/snake identifiers
  for (const m of text.matchAll(/\b[a-z][a-z0-9]+(?:[-_][a-z0-9]+)+\b/g)) add(m[0], 2);
  // weak: capitalized nouns (domain terms), minus stopwords
  for (const m of text.matchAll(/\b[A-Z][a-z]{3,}\b/g)) if (!STOP.has(m[0])) add(m[0], 1);
  // module hint from the item field
  if (item.module) add(item.module.replace(/[^A-Za-z0-9_]+/g, ""), 2);

  return Array.from(map.entries())
    .map(([k, weight]) => ({ sym: caseForms.get(k) ?? k, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 18);
}

// ── scoring ───────────────────────────────────────────────────────────────────
interface Scored { file: SourceFile; score: number; matched: string[]; filenameMatch: boolean; }

function scoreFiles(sources: SourceFile[], cands: Candidate[]): Scored[] {
  const res: Scored[] = [];
  const regexes = cands.map((c) => ({ c, re: wordRe(c.sym) }));
  for (const f of sources) {
    let score = 0;
    const matched: string[] = [];
    let filenameMatch = false;
    const baseLower = f.base.toLowerCase();
    for (const { c, re } of regexes) {
      const symLower = c.sym.toLowerCase();
      if (baseLower === symLower || baseLower.includes(symLower) && symLower.length >= 5) {
        score += c.weight * 3; matched.push(c.sym); filenameMatch = true;
      } else if (re.test(f.content)) {
        score += c.weight; matched.push(c.sym);
      }
    }
    if (score >= 3) res.push({ file: f, score, matched: Array.from(new Set(matched)), filenameMatch });
  }
  return res.sort((a, b) => b.score - a.score);
}

function blastRadius(sources: SourceFile[], target: SourceFile): number {
  const sym = target.base;
  if (sym.length < 4) return 0;
  const re = wordRe(sym);
  let n = 0;
  for (const f of sources) {
    if (f.rel === target.rel) continue;
    if (re.test(f.content)) n++;
    if (n > 200) break;
  }
  return n;
}

// ── severity ──────────────────────────────────────────────────────────────────
function severityFor(filenameMatch: boolean, blast: number, priority?: string): Severity {
  let idx = filenameMatch ? SEV_ORDER.indexOf("HIGH") : SEV_ORDER.indexOf("MEDIUM");
  if (blast >= 8) idx -= 1;
  else if (blast >= 3 && !filenameMatch) idx -= 1;
  if (priority && /crit|urgent|high|p0|p1|blocker|major/i.test(priority)) idx -= 1;
  idx = Math.max(0, Math.min(SEV_ORDER.length - 1, idx));
  return SEV_ORDER[idx];
}

// ── helpers ───────────────────────────────────────────────────────────────────
function wordRe(sym: string): RegExp {
  return new RegExp(`\\b${sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
}
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function clip(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
