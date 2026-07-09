/**
 * DCA Shared — top-level barrel.
 * =============================
 * One import surface for the shared foundation used by all four DCA agents:
 *
 *   import {
 *     Finding, RunMeta,            // core contract
 *     StandardExcelReport,         // report
 *     emitStandardOutputs,         // one-call standardized outputs
 *     ensureStandardBranch,        // standard branch from production/shared
 *   } from "../../shared";
 */
export * from "./core";
export * from "./report";
export * from "./git";
export * from "./output";
