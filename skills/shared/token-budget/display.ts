/**
 * BMAD Token Budget — Display Formatter
 * ========================================
 * Renders token budget info and savings projections to the console
 * in a clear, structured format.
 */

import { TokenSnapshot, BudgetStatus } from "./tracker";
import { SavingsComparison, ModeProjection } from "./savings";

// ─── ANSI Colors ──────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";

function statusColor(status: BudgetStatus): string {
  switch (status) {
    case "ok": return GREEN;
    case "warning": return YELLOW;
    case "critical": return RED;
  }
}

function statusIcon(status: BudgetStatus): string {
  switch (status) {
    case "ok": return "●";
    case "warning": return "◐";
    case "critical": return "○";
  }
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// ─── Budget Display ───────────────────────────────────────────────────────

export function displayBudget(snapshot: TokenSnapshot): void {
  const color = statusColor(snapshot.status);
  const icon = statusIcon(snapshot.status);

  console.log("");
  console.log(`${BOLD}┌─────────────────────────────────────────────────────────┐${RESET}`);
  console.log(`${BOLD}│  ${CYAN}BMAD Token Budget${RESET}${BOLD}                                        │${RESET}`);
  console.log(`${BOLD}├─────────────────────────────────────────────────────────┤${RESET}`);
  console.log(`${BOLD}│${RESET}  Budget (start)  : ${WHITE}${formatTokens(snapshot.totalBudget)} tokens${RESET}                       ${BOLD}│${RESET}`);
  console.log(`${BOLD}│${RESET}  Consumed        : ${YELLOW}${formatTokens(snapshot.consumed)} tokens${RESET}                        ${BOLD}│${RESET}`);
  console.log(`${BOLD}│${RESET}  Remaining       : ${color}${formatTokens(snapshot.remaining)} tokens${RESET} ${color}${icon} ${snapshot.remainingPercent.toFixed(1)}%${RESET}          ${BOLD}│${RESET}`);
  console.log(`${BOLD}└─────────────────────────────────────────────────────────┘${RESET}`);

  if (snapshot.status === "critical") {
    console.log(`  ${RED}⚠ CRITICAL: Token budget nearly exhausted. Prefer static scanner mode.${RESET}`);
  } else if (snapshot.status === "warning") {
    console.log(`  ${YELLOW}⚡ WARNING: Budget running low. Consider static scanner to conserve tokens.${RESET}`);
  }
  console.log("");
}

// ─── Savings Projection Display ───────────────────────────────────────────

export function displaySavings(comparison: SavingsComparison): void {
  console.log(`${BOLD}┌─────────────────────────────────────────────────────────┐${RESET}`);
  console.log(`${BOLD}│  ${CYAN}Token Savings Projection${RESET}${BOLD} — ${WHITE}${comparison.agent}${RESET}${BOLD}${" ".repeat(Math.max(0, 20 - comparison.agent.length))}│${RESET}`);
  console.log(`${BOLD}├───────────────────────┬──────────────┬──────────────────┤${RESET}`);
  console.log(`${BOLD}│${RESET} ${DIM}Mode${RESET}                  ${BOLD}│${RESET} ${DIM}Tokens${RESET}       ${BOLD}│${RESET} ${DIM}Savings vs LLM${RESET}   ${BOLD}│${RESET}`);
  console.log(`${BOLD}├───────────────────────┼──────────────┼──────────────────┤${RESET}`);

  for (const p of comparison.projections) {
    const modeLabel = p.label.padEnd(21);
    const tokens = formatTokens(p.projectedTokens).padEnd(12);
    const savings = p.savingsVsLlm > 0
      ? `${GREEN}-${formatTokens(p.savingsVsLlm)} (${p.savingsPercent}%)${RESET}`.padEnd(26)
      : `${DIM}baseline${RESET}`.padEnd(26);
    console.log(`${BOLD}│${RESET} ${modeLabel} ${BOLD}│${RESET} ${tokens} ${BOLD}│${RESET} ${savings} ${BOLD}│${RESET}`);
  }

  console.log(`${BOLD}└───────────────────────┴──────────────┴──────────────────┘${RESET}`);
  console.log(`  ${GREEN}💡${RESET} ${comparison.recommendation}`);
  console.log("");
}

// ─── Combined: show budget + savings before execution ─────────────────────

export function displayPreExecution(snapshot: TokenSnapshot, comparison: SavingsComparison): void {
  displayBudget(snapshot);
  displaySavings(comparison);
}
