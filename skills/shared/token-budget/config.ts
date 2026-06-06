/**
 * BMAD Token Budget — Configuration Loader
 * ===========================================
 * Reads token budget thresholds and baselines from .env.
 * Falls back to sensible defaults so it works even without .env.
 */

import { resolve } from "path";
import { existsSync } from "fs";

// Attempt to load .env from the skills root
const envPath = resolve(__dirname, "../../.env");
if (existsSync(envPath)) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: envPath });
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

function envFloat(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseFloat(v) : fallback;
}

export interface TokenBudgetConfig {
  totalBudget: number;
  warningPercent: number;
  criticalPercent: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  staticBaselines: Record<string, number>;
  llmBaselines: Record<string, number>;
  optimizedMultiplier: number;
}

export function loadConfig(): TokenBudgetConfig {
  return {
    totalBudget: envInt("BMAD_TOKEN_BUDGET_TOTAL", 128000),
    warningPercent: envInt("BMAD_TOKEN_WARNING_PERCENT", 20),
    criticalPercent: envInt("BMAD_TOKEN_CRITICAL_PERCENT", 10),
    costPer1kInput: envFloat("BMAD_TOKEN_COST_PER_1K_INPUT", 0.003),
    costPer1kOutput: envFloat("BMAD_TOKEN_COST_PER_1K_OUTPUT", 0.015),
    staticBaselines: {
      scan: envInt("BMAD_STATIC_SCAN_TOKENS_AVG", 1200),
      audit: envInt("BMAD_STATIC_AUDIT_TOKENS_AVG", 1500),
      coverage: envInt("BMAD_STATIC_COVERAGE_TOKENS_AVG", 1800),
      impact: envInt("BMAD_STATIC_IMPACT_TOKENS_AVG", 1400),
      generation: 0, // generation always requires LLM
    },
    llmBaselines: {
      scan: envInt("BMAD_LLM_SCAN_TOKENS_AVG", 18000),
      audit: envInt("BMAD_LLM_AUDIT_TOKENS_AVG", 25000),
      coverage: envInt("BMAD_LLM_COVERAGE_TOKENS_AVG", 32000),
      impact: envInt("BMAD_LLM_IMPACT_TOKENS_AVG", 22000),
      generation: envInt("BMAD_LLM_GENERATION_TOKENS_AVG", 45000),
    },
    optimizedMultiplier: envFloat("BMAD_OPTIMIZED_PROMPT_MULTIPLIER", 0.6),
  };
}
