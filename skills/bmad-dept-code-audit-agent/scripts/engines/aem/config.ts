/**
 * AEM as a Cloud Service — Platform Report Configuration
 * ========================================================
 * Domain classification, rollout waves, deployment cautions,
 * and curated recommendations specific to AEMaaCS projects.
 */

import { PlatformReportConfig, RecommendationRow } from "../../shared/report-excel";

// ─── Domain Classifier ────────────────────────────────────────────────────

function classifyDomain(moduleName: string): string {
  const m = (moduleName || "").toLowerCase();
  if (["core", "bundle", "service", "impl"].some((x) => m.includes(x)))
    return "Core / Services";
  if (["ui.apps", "component", "sling"].some((x) => m.includes(x)))
    return "Components / UI";
  if (["ui.content", "content", "template"].some((x) => m.includes(x)))
    return "Content / Templates";
  if (["ui.config", "config", "osgi"].some((x) => m.includes(x)))
    return "Configuration / OSGi";
  if (["dispatcher", "cache", "filter"].some((x) => m.includes(x)))
    return "Dispatcher / CDN";
  if (["ui.frontend", "clientlib", "frontend"].some((x) => m.includes(x)))
    return "Frontend / Clientlibs";
  if (["workflow", "launcher"].some((x) => m.includes(x)))
    return "Workflows";
  if (["test", "it.tests", "ui.tests"].some((x) => m.includes(x)))
    return "Testing";
  return "Core / Shared / Other";
}

// ─── Rollout Waves ────────────────────────────────────────────────────────

function rolloutWave(domain: string, crit: number, high: number, med: number): string {
  if (crit > 0 && ["Configuration / OSGi", "Dispatcher / CDN"].includes(domain))
    return "Wave 0 - Critical / Config";
  if (crit > 0) return "Wave 1 - Critical Stabilization";
  if (high > 0 && ["Core / Services", "Components / UI"].includes(domain))
    return "Wave 2 - Service / Component Hardening";
  if (high > 0) return "Wave 3 - Technical Risk Reduction";
  if (med > 0) return "Wave 4 - Maintainability / Performance";
  return "Wave 5 - Low Risk Cleanup";
}

// ─── Deployment Caution ───────────────────────────────────────────────────

function deploymentCaution(domain: string, crit: number, high: number): string {
  const cautions: Record<string, string> = {
    "Core / Services": "Run full JUnit + integration test suite. Validate OSGi bundle activation in Cloud Manager logs.",
    "Components / UI": "Test dialog authoring, HTL rendering, responsive breakpoints, and dispatcher cache invalidation.",
    "Content / Templates": "Validate editable templates, initial content, policies, and content fragment models.",
    "Configuration / OSGi": "Verify config targets correct runmode. Test on RDE or dev before stage/prod.",
    "Dispatcher / CDN": "Validate cache rules, filters, and rewrites. Test with dispatcher SDK locally first.",
    "Frontend / Clientlibs": "Check clientlib categories, dependencies, minification, and cache busting.",
    "Workflows": "Test workflow models in author, verify launcher configurations, check payload handling.",
  };
  if (cautions[domain]) return cautions[domain];
  if (crit || high) return "Deploy to RDE/dev first, validate in Cloud Manager pipeline logs, check error.log post-deployment.";
  return "Can be batched with similar low-risk changes. Validate via Cloud Manager dev pipeline.";
}

// ─── Recommendations ──────────────────────────────────────────────────────

const recommendations: RecommendationRow[] = [
  { area: "Security", recommendation: "Replace all admin session usage with service users", expectedImpact: "Eliminate privilege escalation risk", effort: "Medium", priority: "P0", details: "Use getServiceResourceResolver() with mapped service users. Define minimal ACLs via repo-init." },
  { area: "Security", recommendation: "Add XSS context to all HTL expressions in URL attributes", expectedImpact: "Prevent javascript: injection", effort: "Low", priority: "P0", details: "Use @context='uri' for href/src/action. Remove all @context='unsafe'." },
  { area: "Performance", recommendation: "Fix resource resolver leaks in services", expectedImpact: "Prevent memory exhaustion in production", effort: "Low", priority: "P0", details: "Use try-with-resources or finally blocks to close resolvers. Never store in instance fields." },
  { area: "Performance", recommendation: "Add caching to Sling Models where appropriate", expectedImpact: "30-50% response time improvement", effort: "Low", priority: "P1", details: "Use @Model(cache=true) or implement manual caching for expensive computations." },
  { area: "Cloud Readiness", recommendation: "Remove filesystem writes — use cloud-native alternatives", expectedImpact: "Required for AEMaaCS deployment", effort: "Medium", priority: "P0", details: "Use Asset API, JCR, or external storage (Azure Blob/S3) instead of File I/O." },
  { area: "Cloud Readiness", recommendation: "Remove install hooks from content packages", expectedImpact: "Required for AEMaaCS deployment", effort: "Low", priority: "P0", details: "Replace with repo-init scripts, OSGi bundle activators, or Sling Content Distribution." },
  { area: "Architecture", recommendation: "Separate mutable and immutable content packages", expectedImpact: "Clean deployment pipeline", effort: "Medium", priority: "P1", details: "ui.apps = immutable (code), ui.content = mutable (initial content only). Never mix." },
  { area: "Architecture", recommendation: "Replace /libs overlays with proxy components", expectedImpact: "Survive AEM upgrades without breakage", effort: "Medium", priority: "P1", details: "Use sling:resourceSuperType instead of copying /libs components to /apps." },
  { area: "Quality", recommendation: "Add Oak index definitions for custom queries", expectedImpact: "Prevent traversal warnings and timeouts", effort: "Medium", priority: "P1", details: "Define lucene or property indexes for all QueryBuilder/JCR-SQL2 queries." },
  { area: "Quality", recommendation: "Migrate deprecated Felix SCR annotations to OSGi DS", expectedImpact: "Future-proof OSGi components", effort: "Low", priority: "P2", details: "Replace @Component/@Service/@Property (Felix) with @Component/@Activate (OSGi R7)." },
  { area: "Dispatcher", recommendation: "Implement deny-by-default dispatcher filters", expectedImpact: "Block access to admin endpoints", effort: "Low", priority: "P0", details: "Start with deny all, selectively allow /content, /etc.clientlibs, required /bin paths." },
  { area: "Testing", recommendation: "Add AEM Mocks for all Sling Models and Servlets", expectedImpact: "Catch regressions before deployment", effort: "Medium", priority: "P1", details: "Use io.wcm.testing.mock.aem for unit tests; SlingContext for integration tests." },
];

// ─── Export Config ────────────────────────────────────────────────────────

export const aemReportConfig: PlatformReportConfig = {
  platformName: "AEM as a Cloud Service",
  platformId: "aem",
  classifyDomain,
  rolloutWave,
  deploymentCaution,
  recommendations,
  brdCategories: ["New Requirement Analysis", "Feature Enhancement Analysis"],
};
