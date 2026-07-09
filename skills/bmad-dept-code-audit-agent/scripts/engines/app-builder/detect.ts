/**
 * Adobe App Builder detection
 * ============================
 * Detects an Adobe App Builder / I/O Runtime project (actions, API Mesh, I/O
 * Events, UI-extensibility apps).
 */

import * as fs from "fs";
import * as path from "path";

function read(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function exists(p: string): boolean {
  return fs.existsSync(p);
}

export function detectAppBuilder(root: string): boolean {
  if (exists(path.join(root, "app.config.yaml")) || exists(path.join(root, "app.config.yml"))) return true;
  if (exists(path.join(root, ".aio"))) return true;
  const pkg = read(path.join(root, "package.json"));
  if (/@adobe\/aio-sdk|@adobe\/aio-lib-|@adobe\/generator-app|@adobe\/aio-cli|@adobe\/uix-guest/.test(pkg)) return true;
  // API Mesh only
  if (exists(path.join(root, "mesh.json")) || exists(path.join(root, ".mesh.json"))) return true;
  return false;
}
