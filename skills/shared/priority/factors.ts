/**
 * DCA Shared — Priority Factor Model
 * ===================================
 * The unified factor set + per-stack weights derived from the Commerce
 * (Magento 2) test-coverage engine's 6-factor priority model.
 *
 * A factor's "weight" is a 0..10 relative importance. Weights are only
 * consulted when a factor is present in the profile; missing factors are
 * simply ignored. This lets each engine surface the factors that make sense
 * for its stack without forcing meaningless zeros elsewhere.
 */

export type FactorKey =
  | "complexity"       // file cyclomatic complexity — universal
  | "revenue_path"     // Commerce/AEM — checkout/order flow, hero component
  | "plugin"           // Commerce — before/after/around plugins
  | "observer"         // Commerce — event observers
  | "api_annotated"    // Java @Api / Commerce @api / Sling @Servlet — public surface
  | "churn"            // git history — commits touching file in last 90 days
  | "fan_in"           // universal — count of reverse-refs to symbols in this file
  | "security_touch"   // universal — touches auth/crypto/input-validation
  | "test_gap";        // universal — no test file exists for this source file

/** Alias export for callers that want the runtime list. */
export const ALL_FACTORS: readonly FactorKey[] = [
  "complexity",
  "revenue_path",
  "plugin",
  "observer",
  "api_annotated",
  "churn",
  "fan_in",
  "security_touch",
  "test_gap",
] as const;

export interface FactorWeights {
  [k: string]: number; // 0..10
}

export interface StackPriorityProfile {
  /** Engine / stack id (e.g. "commerce", "aem", "spring"). */
  stack: string;
  /** Only factors present here contribute to the score. */
  weights: Partial<Record<FactorKey, number>>;
  /** One-line human description of the profile. */
  description: string;
}

// ---------------------------------------------------------------------------
// Stack profiles
// ---------------------------------------------------------------------------
// Weights derived from the Commerce engine's 6-factor model (score bands):
//   complexity   4 (score ceiling)
//   revenue_path 4
//   plugin       4
//   observer     3
//   api          3
//   churn        3
//   fan_in       3
// Scaled to 0..10 for clarity; relative ordering preserved.

const COMMERCE_WEIGHTS: Partial<Record<FactorKey, number>> = {
  complexity: 8,
  revenue_path: 9,
  plugin: 8,
  observer: 6,
  api_annotated: 6,
  churn: 6,
  fan_in: 6,
  security_touch: 7,
  test_gap: 5,
};

const COMMERCE_SAAS_WEIGHTS: Partial<Record<FactorKey, number>> = {
  // SaaS storefront (PWA Studio / Storefront APIs) — no plugins / observers;
  // revenue-path & public API still dominate.
  complexity: 7,
  revenue_path: 9,
  api_annotated: 7,
  churn: 6,
  fan_in: 6,
  security_touch: 7,
  test_gap: 5,
};

const AEM_WEIGHTS: Partial<Record<FactorKey, number>> = {
  complexity: 7,
  revenue_path: 7,
  api_annotated: 7,
  churn: 5,
  fan_in: 6,
  security_touch: 7,
  test_gap: 5,
};

const SLING_WEIGHTS: Partial<Record<FactorKey, number>> = {
  complexity: 7,
  api_annotated: 8,
  churn: 5,
  fan_in: 6,
  security_touch: 7,
  test_gap: 5,
};

const SPRING_WEIGHTS: Partial<Record<FactorKey, number>> = {
  complexity: 8,
  api_annotated: 8,
  churn: 6,
  fan_in: 7,
  security_touch: 8,
  test_gap: 6,
};

const APP_BUILDER_WEIGHTS: Partial<Record<FactorKey, number>> = {
  // Adobe App Builder — serverless actions + IO events. No revenue path;
  // API + security still dominant.
  complexity: 7,
  api_annotated: 7,
  churn: 6,
  fan_in: 5,
  security_touch: 8,
  test_gap: 6,
};

const EDS_WEIGHTS: Partial<Record<FactorKey, number>> = {
  // Edge Delivery Services — blocks / vanilla JS. No public API notion;
  // complexity + churn + fan-in drive priority.
  complexity: 7,
  churn: 6,
  fan_in: 6,
  security_touch: 6,
  test_gap: 5,
};

const EDS_COMMERCE_WEIGHTS: Partial<Record<FactorKey, number>> = {
  // EDS storefront combined with Commerce APIs — revenue path is back.
  complexity: 7,
  revenue_path: 8,
  churn: 6,
  fan_in: 6,
  security_touch: 7,
  test_gap: 5,
};

export const STACK_PROFILES: readonly StackPriorityProfile[] = [
  {
    stack: "commerce",
    weights: COMMERCE_WEIGHTS,
    description:
      "Adobe Commerce / Magento 2 PaaS — full 6-factor model incl. plugins & observers.",
  },
  {
    stack: "commerce-saas",
    weights: COMMERCE_SAAS_WEIGHTS,
    description:
      "Adobe Commerce SaaS / PWA Studio — API + revenue path dominate; no PHP interceptors.",
  },
  {
    stack: "aem",
    weights: AEM_WEIGHTS,
    description:
      "AEM Sites (AEMaaCS / AEMAMS) — component complexity, storefront revenue paths, public API.",
  },
  {
    stack: "sling",
    weights: SLING_WEIGHTS,
    description:
      "Apache Sling — @Servlet / @Component public surface + complexity + churn.",
  },
  {
    stack: "spring",
    weights: SPRING_WEIGHTS,
    description:
      "Spring Boot — complexity + @RestController/@Service public API + fan-in + security.",
  },
  {
    stack: "app-builder",
    weights: APP_BUILDER_WEIGHTS,
    description:
      "Adobe App Builder — serverless actions and IO events. API + security surface.",
  },
  {
    stack: "eds",
    weights: EDS_WEIGHTS,
    description:
      "Edge Delivery Services — block/vanilla-JS storefront. Complexity + churn + fan-in.",
  },
  {
    stack: "eds-commerce",
    weights: EDS_COMMERCE_WEIGHTS,
    description:
      "EDS storefront wired to Commerce APIs — adds revenue-path weighting to EDS defaults.",
  },
] as const;

// ---------------------------------------------------------------------------
// Aliases (canonical → alias list). Order matters: canonical entries first.
// ---------------------------------------------------------------------------
const STACK_ALIASES: Record<string, string> = {
  "commerce-paas": "commerce",
  "adobe-commerce": "commerce",
  "magento": "commerce",
  "magento2": "commerce",
  "aemcs": "aem",
  "aemaacs": "aem",
  "aemams": "aem",
  "spring-boot": "spring",
  "app-builder-mesh": "app-builder",
  "appbuilder": "app-builder",
  "sling-shaft": "sling",
};

/**
 * Return the profile for a given stack id.
 *
 * Falls back to a minimal universal profile (complexity + churn + fan_in +
 * test_gap) when the stack is unknown, so callers never crash.
 */
export function getStackProfile(stackId: string): StackPriorityProfile {
  const key = (stackId ?? "").toLowerCase().trim();
  const canonical = STACK_ALIASES[key] ?? key;
  const found = STACK_PROFILES.find((p) => p.stack === canonical);
  if (found) return found;
  return {
    stack: canonical || "generic",
    weights: {
      complexity: 7,
      churn: 5,
      fan_in: 5,
      security_touch: 6,
      test_gap: 5,
    },
    description: `Generic fallback profile (unknown stack "${stackId}").`,
  };
}
