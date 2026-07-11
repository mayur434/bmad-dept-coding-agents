/**
 * BMAD Token Budget — Display Formatter
 * ========================================
 * Produces conversational, user-friendly strings for token budget info.
 * Designed for chat UIs — no ASCII art, no tables, no jargon.
 */

import { TokenSnapshot, BudgetStatus } from "./tracker";
import { SavingsComparison } from "./savings";

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// ─── Budget one-liner (for inline display) ────────────────────────────────

export function budgetOneLiner(snapshot: TokenSnapshot): string {
  if (snapshot.status === "critical") {
    return `⚠️ Budget almost used up — ${formatTokens(snapshot.remaining)} tokens left of ${formatTokens(snapshot.totalBudget)}.`;
  }
  if (snapshot.status === "warning") {
    return `⚡ Budget running low — ${formatTokens(snapshot.remaining)} tokens remaining.`;
  }
  return `You have ${formatTokens(snapshot.remaining)} tokens remaining (of ${formatTokens(snapshot.totalBudget)}).`;
}

// ─── Option descriptions with token hints ─────────────────────────────────

export interface ModeOption {
  id: string;
  title: string;
  description: string;
  tokenHint: string;
}

export function modeOptions(comparison: SavingsComparison): ModeOption[] {
  const options: ModeOption[] = [];

  for (const p of comparison.projections) {
    if (p.mode === "static") {
      options.push({
        id: "static",
        title: "Quick review",
        description: "I'll check your code against best practices and give you a report in seconds.",
        tokenHint: `Barely uses any tokens (~${formatTokens(p.projectedTokens)})`,
      });
    } else if (p.mode === "llm-optimized") {
      options.push({
        id: "llm-optimized",
        title: "Deep review",
        description: "I'll reason through your architecture and logic to find subtle issues.",
        tokenHint: `Uses ~${formatTokens(p.projectedTokens)} tokens`,
      });
    } else if (p.mode === "llm") {
      options.push({
        id: "llm",
        title: "Everything",
        description: "Quick review first, then I'll dig deeper into what I find.",
        tokenHint: `Uses ~${formatTokens(p.projectedTokens)} tokens`,
      });
    }
  }

  return options;
}

// ─── Console display (minimal, conversational) ────────────────────────────

export function displayBudget(snapshot: TokenSnapshot): void {
  console.log(`\n${budgetOneLiner(snapshot)}\n`);
}

export function displaySavings(comparison: SavingsComparison): void {
  const opts = modeOptions(comparison);
  for (const opt of opts) {
    console.log(`  ${opt.title} — ${opt.description} (${opt.tokenHint})`);
  }
  console.log("");
}

export function displayPreExecution(snapshot: TokenSnapshot, comparison: SavingsComparison): void {
  displayBudget(snapshot);
  displaySavings(comparison);
}
