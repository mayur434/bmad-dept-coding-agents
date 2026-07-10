/**
 * Adobe Commerce SaaS (Commerce-as-a-Cloud-Service) detection
 * ============================================================
 * Commerce SaaS = Catalog Service / Live Search / Product Recommendations / Data
 * Connection consumed by an EDS/drop-in storefront + App Builder, NOT a Magento
 * PaaS app/code tree. Distinguished from PaaS (no app/code) and from plain
 * eds-commerce by the SaaS service markers (Magento-Environment-Id, catalog
 * service endpoints, storefront-events SDK).
 */

import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";

function read(p: string): string { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } }
function exists(p: string): boolean { return fs.existsSync(p); }

const SAAS_MARKERS =
  /Magento-Environment-Id|Magento-Store-View-Code|Magento-Website-Code|catalog-service\.adobe\.io|commerce\.adobe\.io|@adobe\/magento-storefront-event|live-search|catalogServiceEndpoint|AC_ENVIRONMENT_ID|x-api-key.*commerce/i;

export function detectCommerceSaas(root: string): boolean {
  // PaaS has app/code — that's the commerce-paas engine, not SaaS.
  if (exists(path.join(root, "app/code")) && exists(path.join(root, "composer.json"))) return false;

  const pkg = read(path.join(root, "package.json"));
  if (/@adobe\/magento-storefront-event(s-sdk|-collector)|@adobe\/commerce-events/i.test(pkg)) return true;

  for (const f of ["commerce.env.json", "config.json", "configs.json", ".env"]) {
    if (SAAS_MARKERS.test(read(path.join(root, f)))) return true;
  }

  // sample a few JS/JSON files for SaaS service markers
  const files = fg.sync(path.join(root, "**/*.{js,mjs,json}").replace(/\\/g, "/"), {
    ignore: ["**/node_modules/**", "**/dist/**"], deep: 4,
  }).slice(0, 60);
  for (const f of files) if (SAAS_MARKERS.test(read(f))) return true;
  return false;
}
