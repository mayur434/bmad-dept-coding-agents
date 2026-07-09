/**
 * Sling-12 / Shaft detection
 * ===========================
 * Detects a standalone Apache Sling / Shaft application (the company's custom
 * middleware) and, crucially, distinguishes it from AEM — which is the *same*
 * Sling/Felix/Oak family but ships different markers (ui.apps, aem-sdk, uber-jar).
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

/** True when the project looks like AEM rather than plain Sling/Shaft. */
export function looksLikeAem(root: string): boolean {
  if (exists(path.join(root, "ui.apps")) || exists(path.join(root, "ui.content"))) return true;
  const pom = read(path.join(root, "pom.xml"));
  return /com\.adobe\.aem|aem-sdk-api|uber-jar|cq-quickstart|granite/i.test(pom);
}

/** True when Apache Sling / Felix / Shaft markers are present. */
export function detectSling(root: string): boolean {
  if (looksLikeAem(root)) return false;

  const pom = read(path.join(root, "pom.xml"));
  const bnd = read(path.join(root, "bnd.bnd"));
  const hasFeatureModel =
    exists(path.join(root, "src", "main", "features")) ||
    exists(path.join(root, "launcher")) ||
    exists(path.join(root, "provisioning"));

  const slingInPom =
    /org\.apache\.sling|org\.apache\.felix|slingstart|sling-maven-plugin|feature-launcher|jackrabbit/i.test(pom);
  const slingInBnd = /org\.apache\.sling|org\.osgi\.service\.component/i.test(bnd);

  // Shaft-specific hints (from the SHAFT architecture): MDM / SAM / connector modules.
  const shaftHint = /shaft|mdm|sam-platform/i.test(pom) || exists(path.join(root, "mdm")) || exists(path.join(root, "sam"));

  if (slingInPom || slingInBnd || shaftHint) return true;

  // Fallback: OSGi/Sling imports in Java sources with no AEM shape.
  if (exists(path.join(root, "pom.xml")) || bnd || hasFeatureModel) {
    return javaHasSlingImports(root);
  }
  return false;
}

/** True if Shaft-specific markers are present (enables Shaft-flavored messaging). */
export function isShaft(root: string): boolean {
  const pom = read(path.join(root, "pom.xml"));
  return /shaft|\bmdm\b|sam-platform/i.test(pom) || exists(path.join(root, "mdm")) || exists(path.join(root, "sam"));
}

function javaHasSlingImports(root: string): boolean {
  const dirs = [path.join(root, "src"), path.join(root, "core"), path.join(root, "bundle")];
  let scanned = 0;
  for (const dir of dirs) {
    if (!exists(dir)) continue;
    const hit = walkForSling(dir, () => (scanned += 1) > 60);
    if (hit) return true;
    if (scanned > 60) break;
  }
  return false;
}

function walkForSling(dir: string, budgetHit: () => boolean): boolean {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (budgetHit()) return false;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "target" || e.name === "node_modules") continue;
      if (walkForSling(full, budgetHit)) return true;
    } else if (e.name.endsWith(".java")) {
      const src = read(full);
      if (/import\s+org\.apache\.sling|import\s+org\.osgi\.service\.component/.test(src)) return true;
    }
  }
  return false;
}
