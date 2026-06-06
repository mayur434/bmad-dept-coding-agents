/**
 * BMAD Token Budget — Tracker
 * ==============================
 * Tracks token consumption during a session and provides
 * budget display (earlier / consumed / remaining).
 */

import { loadConfig, TokenBudgetConfig } from "./config";

export type BudgetStatus = "ok" | "warning" | "critical";

export interface TokenSnapshot {
  /** Total budget allocated at session start */
  totalBudget: number;
  /** Tokens consumed so far in this session */
  consumed: number;
  /** Tokens remaining */
  remaining: number;
  /** Percentage remaining */
  remainingPercent: number;
  /** Budget health status */
  status: BudgetStatus;
}

export class TokenTracker {
  private config: TokenBudgetConfig;
  private _consumed: number = 0;
  private _startBudget: number;

  constructor(startBudget?: number) {
    this.config = loadConfig();
    this._startBudget = startBudget ?? this.config.totalBudget;
  }

  /** Record tokens used by an operation */
  record(tokens: number): void {
    this._consumed += tokens;
  }

  /** Get current budget snapshot */
  snapshot(): TokenSnapshot {
    const remaining = Math.max(0, this._startBudget - this._consumed);
    const remainingPercent = (remaining / this._startBudget) * 100;
    let status: BudgetStatus = "ok";
    if (remainingPercent <= this.config.criticalPercent) {
      status = "critical";
    } else if (remainingPercent <= this.config.warningPercent) {
      status = "warning";
    }
    return {
      totalBudget: this._startBudget,
      consumed: this._consumed,
      remaining,
      remainingPercent,
      status,
    };
  }

  /** Get consumed tokens */
  get consumed(): number {
    return this._consumed;
  }

  /** Get starting budget */
  get startBudget(): number {
    return this._startBudget;
  }
}
