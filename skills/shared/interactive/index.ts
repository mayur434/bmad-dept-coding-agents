/**
 * DCA Shared — interactive barrel.
 *
 *   import {
 *     askAll, confirmRun, Question,
 *     resolveIntake, ResolvedIntake, IntakeMode,
 *     readIntakeFile, writeIntakeFile, intakeFilePath,
 *   } from "../../shared/interactive";
 *
 * IMPORTANT: This barrel — and the module it re-exports — MUST stay
 * dependency-free (Node core only). Every agent's run.ts imports it BEFORE
 * node_modules exists on first run. Adding a third-party import here
 * re-creates the chicken-and-egg problem the helper was designed to solve.
 */
export * from "./prompter";
