/**
 * DCA Shared — Factor extractors
 * ===============================
 * Lightweight, best-effort extractors that turn a file path into a
 * `FileFactors` record. Each extractor is optional; unset extractors leave
 * their factor undefined and the scorer ignores them.
 *
 * The default extractors here are shell / filesystem based (git, grep, fs)
 * and take a non-fatal posture — any failure returns `0` / `false` rather
 * than throwing.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

import type { FactorKey } from "./factors";
import type { FileFactors } from "./scorer";

export interface FactorExtractors {
  complexity?: (filePath: string) => number;
  revenue_path?: (filePath: string) => boolean | number;
  plugin?: (filePath: string) => boolean;
  observer?: (filePath: string) => boolean;
  api_annotated?: (filePath: string) => boolean;
  churn?: (filePath: string) => Promise<number> | number;
  fan_in?: (filePath: string) => Promise<number> | number;
  security_touch?: (filePath: string) => boolean;
  test_gap?: (filePath: string) => boolean;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Extract factors for a batch of files using the supplied extractors.
 * Any extractor that throws or returns garbage contributes nothing.
 */
export async function extractFactorsFor(
  files: string[],
  extractors: FactorExtractors,
): Promise<FileFactors[]> {
  const out: FileFactors[] = [];
  for (const fp of files ?? []) {
    const factors: Partial<Record<FactorKey, number | boolean>> = {};
    for (const [rawKey, fn] of Object.entries(extractors)) {
      if (typeof fn !== "function") continue;
      const key = rawKey as FactorKey;
      try {
        const v = await (fn as (fp: string) => unknown)(fp);
        if (typeof v === "number" && Number.isFinite(v)) factors[key] = v;
        else if (typeof v === "boolean") factors[key] = v;
      } catch {
        // Non-fatal — skip this factor for this file.
      }
    }
    out.push({ filePath: fp, factors });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Default extractors
// ---------------------------------------------------------------------------

const REVENUE_PATH_RE: Record<string, RegExp> = {
  commerce: /Checkout|Cart|Payment|Order|Quote|Shipping|Tax|GiftCard|Reward|CustomerBalance/i,
  "commerce-saas": /checkout|cart|payment|order|shipping|tax/i,
  aem: /commerce|checkout|cart|hero|storefront/i,
  "eds-commerce": /checkout|cart|payment|order|shipping|tax/i,
};

const PLUGIN_RE = /\/Plugin\/|Interceptor/;
const OBSERVER_RE = /\/Observer\/|EventHandler/;

const SECURITY_KEYWORDS_RE =
  /\b(auth|authn|authz|password|passwd|secret|credential|token|jwt|sha256|md5|hmac|crypto|encrypt|decrypt|sanitiz|escape|xss|csrf|sqli|prepare\s*Statement|role_check|permission)\b/i;

function readSafe(fp: string): string {
  try {
    return fs.readFileSync(fp, "utf-8");
  } catch {
    return "";
  }
}

function estimateComplexity(content: string): number {
  const branches =
    (content.match(/\bif\b|\belse\b|\bswitch\b|\bcase\b|\bcatch\b|\?\s*:/g) || []).length;
  return Math.min(branches + 1, 50);
}

/**
 * Default extractor set. `stackId` shapes the revenue-path regex and the
 * API-annotation heuristic. Absent extractors are intentional: only wire in
 * ones that make sense for the stack.
 */
export function defaultExtractors(stackId: string): FactorExtractors {
  const stack = (stackId ?? "").toLowerCase();
  const revenueRe = REVENUE_PATH_RE[stack];

  return {
    complexity: (fp) => estimateComplexity(readSafe(fp)),

    revenue_path: revenueRe ? (fp) => revenueRe.test(fp) : undefined,

    plugin:
      stack === "commerce" || stack === "commerce-paas"
        ? (fp) => PLUGIN_RE.test(fp)
        : undefined,

    observer:
      stack === "commerce" || stack === "commerce-paas"
        ? (fp) => OBSERVER_RE.test(fp)
        : undefined,

    api_annotated: (fp) => {
      const c = readSafe(fp);
      if (!c) return false;
      // Common signals across stacks
      return (
        /@api\b/.test(c) ||
        /@RestController\b/.test(c) ||
        /@Api\b/.test(c) ||
        /@SlingServlet\b/.test(c) ||
        /@Component\b/.test(c) && /service\s*=/i.test(c) ||
        /\/Api\//.test(fp) ||
        /webapi\.xml$/.test(fp)
      );
    },

    churn: (fp) => {
      try {
        const cwd = process.cwd();
        const rel = path.isAbsolute(fp) ? path.relative(cwd, fp) : fp;
        const out = execSync(
          `git log --since=90.days --format=%h -- "${rel.replace(/"/g, '\\"')}"`,
          {
            cwd,
            encoding: "utf-8",
            timeout: 5000,
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
        return out.split("\n").filter(Boolean).length;
      } catch {
        return 0;
      }
    },

    fan_in: (fp) => {
      // grep -rF filename — cheap approximation.
      try {
        const cwd = process.cwd();
        const symbol = path.basename(fp).replace(/\.[^.]+$/, "");
        if (!symbol || symbol.length < 3) return 0;
        const out = execSync(
          `grep -rF --include='*' "${symbol}" . 2>/dev/null | wc -l`,
          {
            cwd,
            encoding: "utf-8",
            timeout: 5000,
            stdio: ["pipe", "pipe", "pipe"],
            shell: "/bin/sh",
          },
        );
        return Math.max(0, parseInt(out.trim(), 10) - 1); // subtract self ref
      } catch {
        return 0;
      }
    },

    security_touch: (fp) => {
      if (/\/(auth|security|crypto|login)\//i.test(fp)) return true;
      const c = readSafe(fp);
      if (!c) return false;
      return SECURITY_KEYWORDS_RE.test(c);
    },

    test_gap: (fp) => {
      const dir = path.dirname(fp);
      const base = path.basename(fp).replace(/\.[^.]+$/, "");
      const ext = path.extname(fp);
      const candidates = [
        // JS/TS sibling
        path.join(dir, `${base}.test${ext}`),
        path.join(dir, `${base}.spec${ext}`),
        // PHP Test/ variants
        path.join(dir, "Test", "Unit", `${base}Test.php`),
        path.join(dir, "..", "Test", "Unit", `${base}Test.php`),
        // Java sibling
        path.join(dir, `${base}Test.java`),
      ];
      for (const c of candidates) {
        try {
          if (fs.existsSync(c)) return false;
        } catch {
          /* ignore */
        }
      }
      return true;
    },
  };
}
