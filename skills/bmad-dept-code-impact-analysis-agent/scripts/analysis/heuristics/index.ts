/**
 * Impact Analysis — Per-stack heuristic dispatcher
 * ==================================================
 * Wires each stack's file to its profile id and exposes a single entry point
 * for the tracer:
 *
 *   const refs = dispatchHeuristic(profileId, filePath, symbol, project);
 *
 * Returns [] for unknown profile ids so the tracer degrades gracefully.
 */

import { FileRef, HeuristicFn, ProjectContext } from "./types";
import { heuristicRefs as aem } from "./aem";
import { heuristicRefs as commercePaas } from "./commerce-paas";
import { heuristicRefs as commerceSaas } from "./commerce-saas";
import { heuristicRefs as sling } from "./sling";
import { heuristicRefs as spring } from "./spring";
import { heuristicRefs as appBuilder } from "./app-builder";
import { heuristicRefs as eds } from "./eds";
import { heuristicRefs as edsCommerce } from "./eds-commerce";

export * from "./types";

const REGISTRY: Record<string, HeuristicFn> = {
  "aem": aem,
  "commerce-paas": commercePaas,
  "commerce-saas": commerceSaas,
  "sling": sling,
  "spring": spring,
  "app-builder": appBuilder,
  "eds": eds,
  "eds-commerce": edsCommerce,
};

export function dispatchHeuristic(
  profileId: string,
  filePath: string,
  symbolName: string,
  project: ProjectContext,
): FileRef[] {
  const fn = REGISTRY[profileId];
  if (!fn) return [];
  try {
    return fn(filePath, symbolName, project);
  } catch (err) {
    process.stderr.write(
      `[impact-heuristic-${profileId}] WARN: heuristic failed for ${filePath}: ${(err as Error).message}\n`,
    );
    return [];
  }
}

export function heuristicsForStack(profileId: string): HeuristicFn | null {
  return REGISTRY[profileId] ?? null;
}
