/**
 * Sonar Scan — --focus category filter
 * ======================================
 * Maps user-facing focus tokens to canonical Sonar category strings and
 * filters a Finding[] down to just the requested categories.
 *
 * Accepted tokens (case-insensitive, comma-separated):
 *   bugs | vulnerabilities | hotspots | smells | duplications | complexity
 */
import { Finding } from "../../../shared/core/types";

export type FocusToken =
  | "bugs"
  | "vulnerabilities"
  | "hotspots"
  | "smells"
  | "duplications"
  | "complexity";

export const ALL_FOCUS_TOKENS: FocusToken[] = [
  "bugs",
  "vulnerabilities",
  "hotspots",
  "smells",
  "duplications",
  "complexity",
];

/** token → the exact category strings the LLM writes into sonar-findings.json */
const TOKEN_TO_CATEGORIES: Record<FocusToken, string[]> = {
  bugs: ["Bug"],
  vulnerabilities: ["Vulnerability"],
  hotspots: ["Security Hotspot"],
  smells: ["Code Smell"],
  duplications: ["Duplication"],
  complexity: ["Complexity"],
};

export interface ParsedFocus {
  tokens: FocusToken[];
  /** Category strings we'll match against Finding.category (case-insensitive). */
  categories: string[];
  /** True when the flag was not passed → keep all 6 (current default). */
  all: boolean;
}

/**
 * Parse the raw --focus value. Empty / undefined → all categories.
 * Throws on unknown tokens so the CLI can surface a helpful error.
 */
export function parseFocus(raw: string | null | undefined): ParsedFocus {
  if (!raw || !raw.trim()) {
    return { tokens: [...ALL_FOCUS_TOKENS], categories: allCategories(), all: true };
  }
  const parts = raw.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  const tokens: FocusToken[] = [];
  const bad: string[] = [];
  for (const p of parts) {
    if ((ALL_FOCUS_TOKENS as string[]).includes(p)) {
      tokens.push(p as FocusToken);
    } else {
      bad.push(p);
    }
  }
  if (bad.length) {
    throw new Error(
      `--focus: unknown category token(s) [${bad.join(", ")}]. ` +
        `Accepted: ${ALL_FOCUS_TOKENS.join(" | ")}`,
    );
  }
  if (tokens.length === 0) {
    return { tokens: [...ALL_FOCUS_TOKENS], categories: allCategories(), all: true };
  }
  // Dedupe preserving order
  const uniq = Array.from(new Set(tokens));
  const cats = uniq.flatMap((t) => TOKEN_TO_CATEGORIES[t]);
  return {
    tokens: uniq,
    categories: Array.from(new Set(cats)),
    all: uniq.length === ALL_FOCUS_TOKENS.length,
  };
}

function allCategories(): string[] {
  return ALL_FOCUS_TOKENS.flatMap((t) => TOKEN_TO_CATEGORIES[t]);
}

/**
 * Filter findings by category. When focus.all === true this is a no-op copy.
 * Returns { kept, dropped } for CLI logging.
 */
export function applyFocus(findings: Finding[], focus: ParsedFocus): {
  kept: Finding[];
  dropped: number;
} {
  if (focus.all) return { kept: [...findings], dropped: 0 };
  const wanted = new Set(focus.categories.map((c) => c.toLowerCase()));
  const kept: Finding[] = [];
  let dropped = 0;
  for (const f of findings) {
    const c = String(f.category ?? "").trim().toLowerCase();
    if (wanted.has(c)) kept.push(f);
    else dropped++;
  }
  return { kept, dropped };
}
