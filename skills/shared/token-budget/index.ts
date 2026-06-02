/**
 * BMAD Token Budget — Public API
 * =================================
 * Single import for all agents:
 *
 *   import { TokenBudgetManager } from "../../shared/token-budget";
 *
 * Provides:
 *   - Budget tracking (start / consumed / remaining)
 *   - Savings projection (static vs LLM vs optimized)
 *   - Console display with color-coded status
 *   - Pre-execution summary for user decision
 */

export { loadConfig, TokenBudgetConfig } from "./config";
export { TokenTracker, TokenSnapshot, BudgetStatus } from "./tracker";
export { projectSavings, SavingsComparison, ModeProjection } from "./savings";
export { displayBudget, displaySavings, displayPreExecution, budgetOneLiner, modeOptions, ModeOption } from "./display";

import { TokenTracker } from "./tracker";
import { projectSavings } from "./savings";
import { displayPreExecution, displayBudget } from "./display";

/**
 * TokenBudgetManager — convenience facade used by agent dispatchers.
 *
 * Usage:
 *   const budget = new TokenBudgetManager("audit");
 *   budget.showPreExecution();            // displays budget + savings projection
 *   budget.record(tokensUsed);            // after operation completes
 *   budget.showPostExecution();           // displays updated budget
 */
export class TokenBudgetManager {
  private tracker: TokenTracker;
  private agentKey: string;

  constructor(agentKey: string, startBudget?: number) {
    this.agentKey = agentKey;
    this.tracker = new TokenTracker(startBudget);
  }

  /** Show token budget + savings projections before execution */
  showPreExecution(): void {
    const snapshot = this.tracker.snapshot();
    const savings = projectSavings(this.agentKey);
    displayPreExecution(snapshot, savings);
  }

  /** Record tokens consumed by the operation */
  record(tokens: number): void {
    this.tracker.record(tokens);
  }

  /** Show updated budget after execution */
  showPostExecution(): void {
    const snapshot = this.tracker.snapshot();
    displayBudget(snapshot);
  }

  /** Get current snapshot for programmatic use */
  snapshot() {
    return this.tracker.snapshot();
  }

  /** Get savings projection for this agent */
  savings() {
    return projectSavings(this.agentKey);
  }
}
