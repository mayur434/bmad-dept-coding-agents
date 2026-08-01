/**
 * Role foundation smoke — hand-rolled.
 * Usage: npx ts-node skills/shared/role/smoke.ts /tmp/role-smoke
 */

import * as fs from "fs";
import * as path from "path";

import {
  allRoles,
  additionalRoles,
  generic,
  getRole,
  isValidRoleCode,
  promotedRoles,
} from "./role";
import { readRoleFile, roleFilePath, writeRoleFile } from "./persistence";
import { parseRoleFlag, resolveRole } from "./resolve";

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    process.exit(1);
  }
}

function main(): void {
  const root = process.argv[2] ?? path.join(process.cwd(), ".smoke-role");

  if (fs.existsSync(path.join(root, ".bmad"))) {
    fs.rmSync(path.join(root, ".bmad"), { recursive: true, force: true });
  }
  fs.mkdirSync(root, { recursive: true });

  assert(promotedRoles().length === 6, "promotedRoles must be 6");
  assert(additionalRoles().length === 4, "additionalRoles must be 4");
  assert(allRoles().length === 10, "allRoles must be 10");

  assert(getRole("ea")?.code === "ea", "getRole ea");
  assert(getRole("EA")?.code === "ea", "getRole case-insensitive");
  assert(getRole("bogus") === null, "getRole unknown returns null");
  assert(isValidRoleCode("devops"), "isValidRoleCode devops");
  assert(!isValidRoleCode("nope"), "!isValidRoleCode nope");
  assert(generic.defaultOutputFlavor === "default", "generic default flavor");

  const before = resolveRole({ projectRoot: root });
  assert(before.source === "generic-fallback", "fallback when no file");
  assert(before.role.code === "generic", "fallback role is generic");
  assert(before.fileExists === false, "fileExists=false before write");

  writeRoleFile(root, "tl", "interactive", "smoke-test note\nsecond line");
  assert(fs.existsSync(roleFilePath(root)), "role.yaml exists after write");

  const rf = readRoleFile(root);
  assert(rf !== null, "readRoleFile returns non-null");
  assert(rf!.role === "tl", `role round-trip (got ${rf!.role})`);
  assert(rf!.setBy === "interactive", "setBy round-trip");
  assert(
    rf!.notes === "smoke-test note\nsecond line",
    `notes round-trip (got ${JSON.stringify(rf!.notes)})`,
  );
  assert(/T.*Z$/.test(rf!.setAt), "setAt looks ISO-8601 UTC");

  const after = resolveRole({ projectRoot: root });
  assert(after.source === "role-file", "resolved from role-file");
  assert(after.role.code === "tl", "resolved role is tl");

  const flagged = resolveRole({ projectRoot: root, cliFlag: "qa" });
  assert(flagged.source === "cli-flag", "cli-flag wins");
  assert(flagged.role.code === "qa", "cli-flag role is qa");

  let threw = false;
  try {
    resolveRole({ projectRoot: root, cliFlag: "bogus" });
  } catch {
    threw = true;
  }
  assert(threw, "invalid cli flag throws");

  assert(parseRoleFlag(["--role=de"]) === "de", "parseRoleFlag equals form");
  assert(
    parseRoleFlag(["--role", "de"]) === "de",
    "parseRoleFlag space form",
  );
  assert(
    parseRoleFlag(["--role", "--other"]) === undefined,
    "parseRoleFlag no value",
  );
  assert(parseRoleFlag(["--other"]) === undefined, "parseRoleFlag absent");

  fs.writeFileSync(roleFilePath(root), "not: valid\njunk\n", "utf8");
  const bad = readRoleFile(root);
  assert(bad === null, "malformed file → null");
  const fallback = resolveRole({ projectRoot: root });
  assert(
    fallback.source === "generic-fallback",
    "malformed → generic fallback",
  );

  process.stdout.write("OK\n");
}

main();
