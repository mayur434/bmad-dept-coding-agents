/**
 * DCA Generation — shared naming / package helpers.
 * ==================================================
 * Extracted so both `generators.ts` (source scaffolders) and `test-stubs.ts`
 * (matching test emitters) resolve the same identifiers/paths for a given
 * `{name, pkg}` pair. Keep this file dep-free.
 */

export interface GenOptionsLike {
  name: string;
  pkg?: string;
}

export function pascal(s: string): string {
  return (s.match(/[A-Za-z0-9]+/g) || [])
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("") || "Sample";
}
export function camel(s: string): string {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}
export function kebab(s: string): string {
  return (s.match(/[A-Za-z0-9]+/g) || []).map((w) => w.toLowerCase()).join("-") || "sample";
}
export function pkgPath(pkg: string): string {
  return pkg.replace(/\./g, "/");
}

// Per-stack Java package defaults — must stay in sync with generators.ts.
export const slingPkg = (o: GenOptionsLike): string => o.pkg ?? "com.acme.shaft";
export const springPkg = (o: GenOptionsLike): string => o.pkg ?? "com.acme.app";
export const aemPkg = (o: GenOptionsLike): string => o.pkg ?? "com.acme.aem";

/** Commerce (PaaS) — derive Vendor_Module + PSR-4 namespace/dir from opts. */
export function vendorModule(o: GenOptionsLike): { v: string; m: string; dir: string; ns: string } {
  const raw = o.pkg && o.pkg.includes("_") ? o.pkg
    : o.name.includes("_") ? o.name
    : `Acme_${pascal(o.name)}`;
  const [vRaw, mRaw] = raw.split("_");
  const v = pascal(vRaw), m = pascal(mRaw || "Module");
  return { v, m, dir: `app/code/${v}/${m}`, ns: `${v}\\${m}` };
}
