/**
 * BMAD Token Budget — Savings Projection
 * =========================================
 * Compares static-scanner vs LLM vs optimized-LLM paths and presents
 * token savings to the user before they commit to a mode.
 */

import { loadConfig, TokenBudgetConfig } from "./config";

export interface ModeProjection {
  mode: "static" | "llm" | "llm-optimized";
  label: string;
  projectedTokens: number;
  projectedCostUsd: number;
  savingsVsLlm: number;
  savingsPercent: number;
}

export interface SavingsComparison {
  agent: string;
  projections: ModeProjection[];
  recommendation: string;
}

export function projectSavings(agentKey: string): SavingsComparison {
  const config = loadConfig();
  const staticTokens = config.staticBaselines[agentKey] ?? 0;
  const llmTokens = config.llmBaselines[agentKey] ?? 0;
  const optimizedTokens = Math.round(llmTokens * config.optimizedMultiplier);

  const costFor = (tokens: number) =>
    (tokens / 1000) * ((config.costPer1kInput + config.costPer1kOutput) / 2);

  const projections: ModeProjection[] = [];

  // Static scanner path (if available for this agent)
  if (staticTokens > 0) {
    projections.push({
      mode: "static",
      label: "Fast & Free — built-in rules, zero AI tokens",
      projectedTokens: staticTokens,
      projectedCostUsd: costFor(staticTokens),
      savingsVsLlm: llmTokens - staticTokens,
      savingsPercent: Math.round(((llmTokens - staticTokens) / llmTokens) * 100),
    });
  }

  // LLM-optimized path
  projections.push({
    mode: "llm-optimized",
    label: "Smart — AI-assisted with optimized prompts",
    projectedTokens: optimizedTokens,
    projectedCostUsd: costFor(optimizedTokens),
    savingsVsLlm: llmTokens - optimizedTokens,
    savingsPercent: Math.round(((llmTokens - optimizedTokens) / llmTokens) * 100),
  });

  // Full LLM path
  projections.push({
    mode: "llm",
    label: "Deep — full AI analysis (most thorough)",
    projectedTokens: llmTokens,
    projectedCostUsd: costFor(llmTokens),
    savingsVsLlm: 0,
    savingsPercent: 0,
  });

  // Build recommendation
  let recommendation: string;
  if (staticTokens > 0) {
    recommendation =
      `Choosing "Fast & Free" saves ~${llmTokens - staticTokens} tokens (${Math.round(((llmTokens - staticTokens) / llmTokens) * 100)}% less). ` +
      `Great for quick checks. Pick "Smart" or "Deep" when you need AI insights.`;
  } else {
    recommendation =
      `"Smart" mode saves ~${llmTokens - optimizedTokens} tokens (${Math.round(((llmTokens - optimizedTokens) / llmTokens) * 100)}% less) vs "Deep". Use "Deep" only when maximum detail is needed.`;
  }

  return { agent: agentKey, projections, recommendation };
}
