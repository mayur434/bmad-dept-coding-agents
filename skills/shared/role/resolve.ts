/**
 * DCA Shared — role resolution for run.ts wiring.
 *
 * Resolution order:
 *   1. --role flag  (per-run; does NOT write role file)
 *   2. .bmad/role.yaml
 *   3. generic fallback
 */

import { allRoles, generic, getRole, isValidRoleCode, Role } from "./role";
import { readRoleFile, roleFilePath } from "./persistence";
import * as fs from "fs";

export interface ResolveRoleOpts {
  projectRoot: string;
  cliFlag?: string;
  fallbackToGeneric?: boolean;
}

export interface ResolvedRole {
  role: Role;
  source: "cli-flag" | "role-file" | "generic-fallback";
  fileExists: boolean;
}

export function resolveRole(opts: ResolveRoleOpts): ResolvedRole {
  const fallbackToGeneric = opts.fallbackToGeneric !== false;
  const fileExists = fs.existsSync(roleFilePath(opts.projectRoot));

  if (opts.cliFlag !== undefined && opts.cliFlag !== "") {
    if (!isValidRoleCode(opts.cliFlag)) {
      const valid = allRoles()
        .map((r) => r.code)
        .join(", ");
      throw new Error(
        `--role: invalid role code "${opts.cliFlag}". Valid codes: ${valid}`,
      );
    }
    const role = getRole(opts.cliFlag)!;
    return { role, source: "cli-flag", fileExists };
  }

  if (fileExists) {
    const rf = readRoleFile(opts.projectRoot);
    if (rf) {
      const role = getRole(rf.role);
      if (role) {
        return { role, source: "role-file", fileExists: true };
      }
    }
  }

  if (!fallbackToGeneric) {
    throw new Error(
      `resolveRole: no role could be resolved (no --role flag, no .bmad/role.yaml at ${opts.projectRoot}), and fallbackToGeneric=false`,
    );
  }

  return { role: generic, source: "generic-fallback", fileExists };
}

/** Convenience — extract --role=<code> or --role <code> from an argv array. */
export function parseRoleFlag(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--role") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) return next;
      return undefined;
    }
    if (a.startsWith("--role=")) {
      return a.slice("--role=".length);
    }
  }
  return undefined;
}
