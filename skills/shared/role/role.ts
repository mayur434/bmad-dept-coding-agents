/**
 * DCA Shared — role catalog + types.
 *
 * The 10-role catalog used by every DCA agent to adapt its
 * mode default, output shape, and recommended follow-ups.
 */

export type RoleCode =
  | "ea"
  | "tl"
  | "de"
  | "qa"
  | "devops"
  | "security"
  | "pm"
  | "ba"
  | "migration"
  | "content";

export type AgentCode =
  | "audit"
  | "sonar-scan"
  | "generation"
  | "impact-analysis"
  | "test-coverage"
  | "requirements"
  | "architecture";

export type OutputFlavor =
  | "executive"
  | "technical"
  | "jira-csv"
  | "sarif"
  | "default";

export interface Role {
  code: RoleCode | "generic";
  name: string;
  shortLabel: string;
  promoted: boolean;
  description: string;
  priorityAgents: AgentCode[];
  defaultOutputFlavor: OutputFlavor;
}

const PROMOTED: readonly Role[] = [
  {
    code: "ea",
    name: "Enterprise Architect",
    shortLabel: "EA",
    promoted: true,
    description:
      "Owns cross-cutting architecture across Adobe/JVM estates; needs portfolio-level health, risk, and modernization signals over per-file detail.",
    priorityAgents: ["audit", "sonar-scan", "impact-analysis"],
    defaultOutputFlavor: "executive",
  },
  {
    code: "tl",
    name: "Tech Lead / Solution Architect",
    shortLabel: "TL",
    promoted: true,
    description:
      "Leads a delivery team on a specific solution; needs component-level design review, generation scaffolds, and impact blast-radius for changes.",
    priorityAgents: ["audit", "generation", "impact-analysis"],
    defaultOutputFlavor: "technical",
  },
  {
    code: "de",
    name: "Senior Delivery Engineer",
    shortLabel: "DE",
    promoted: true,
    description:
      "Ships stories on a sprint cadence; needs generated scaffolds, test coverage gaps, and audit findings shaped as Jira-ready tickets.",
    priorityAgents: ["generation", "test-coverage", "audit"],
    defaultOutputFlavor: "jira-csv",
  },
  {
    code: "qa",
    name: "QA / SDET",
    shortLabel: "QA",
    promoted: true,
    description:
      "Owns test strategy and coverage; needs coverage gaps, impact-driven regression scope, and audit findings that map to test surfaces.",
    priorityAgents: ["test-coverage", "impact-analysis", "audit"],
    defaultOutputFlavor: "technical",
  },
  {
    code: "devops",
    name: "DevOps / SRE",
    shortLabel: "DevOps",
    promoted: true,
    description:
      "Runs pipelines and production; needs SARIF-shaped scan output that plugs into CI gates and generated infra/pipeline scaffolds.",
    priorityAgents: ["sonar-scan", "generation", "audit"],
    defaultOutputFlavor: "sarif",
  },
  {
    code: "security",
    name: "Security Engineer",
    shortLabel: "Sec",
    promoted: true,
    description:
      "Owns AppSec posture across the estate; needs deep sonar-scan and audit output focused on vulnerability classes and remediation guidance.",
    priorityAgents: ["sonar-scan", "audit"],
    defaultOutputFlavor: "technical",
  },
];

const ADDITIONAL: readonly Role[] = [
  {
    code: "pm",
    name: "Product Manager / PMO",
    shortLabel: "PM",
    promoted: false,
    description:
      "Owns roadmap and delivery risk; needs executive-shape audit and impact output framed as scope, effort, and portfolio risk.",
    priorityAgents: ["audit", "impact-analysis"],
    defaultOutputFlavor: "executive",
  },
  {
    code: "ba",
    name: "Business Analyst",
    shortLabel: "BA",
    promoted: false,
    description:
      "Bridges business intent and system behavior; needs impact-analysis output that reads as feature/flow-level change summaries.",
    priorityAgents: ["impact-analysis"],
    defaultOutputFlavor: "executive",
  },
  {
    code: "migration",
    name: "Migration/Upgrade Lead",
    shortLabel: "Migration",
    promoted: false,
    description:
      "Drives platform upgrades and re-platforming; needs audit baselines, impact of upgrade paths, and coverage of legacy surfaces.",
    priorityAgents: ["audit", "impact-analysis", "test-coverage"],
    defaultOutputFlavor: "technical",
  },
  {
    code: "content",
    name: "Content/CMS Engineer",
    shortLabel: "Content",
    promoted: false,
    description:
      "Builds and maintains AEM/EDS content surfaces; needs component/block generation scaffolds and audit findings scoped to content code.",
    priorityAgents: ["generation", "audit"],
    defaultOutputFlavor: "technical",
  },
];

export const ROLES: readonly Role[] = [...PROMOTED, ...ADDITIONAL];

export const generic: Role = {
  code: "generic",
  name: "Generic",
  shortLabel: "Generic",
  promoted: false,
  description:
    "No role selected — used as fallback when .bmad/role.yaml is absent and no --role flag was passed in a headless run.",
  priorityAgents: [],
  defaultOutputFlavor: "default",
};

export function promotedRoles(): Role[] {
  return [...PROMOTED];
}

export function additionalRoles(): Role[] {
  return [...ADDITIONAL];
}

export function allRoles(): Role[] {
  return [...ROLES];
}

export function getRole(code: string | undefined): Role | null {
  if (!code) return null;
  const target = code.toLowerCase();
  return ROLES.find((r) => r.code === target) ?? null;
}

export function isValidRoleCode(s: string): boolean {
  if (!s) return false;
  const target = s.toLowerCase();
  return ROLES.some((r) => r.code === target);
}
