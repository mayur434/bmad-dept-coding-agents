/**
 * EDS-Commerce Scanner Context — extends EDS context with Commerce-specific file discovery
 */
import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { EdsScannerContext } from "../../../eds/lib/scanner/context";

export class EdsCommerceScannerContext extends EdsScannerContext {
  constructor(root: string) {
    super(root);
  }

  // ─── Commerce-specific file helpers ────────────────────────────────

  /** JS files in blocks that appear Commerce-related */
  commerceBlockFiles(): string[] {
    const allBlocks = this.blockJsFiles();
    return allBlocks.filter((fp) => {
      const name = path.basename(path.dirname(fp));
      return /commerce|product|cart|checkout|payment|catalog|wishlist|account|order|search|mini-cart/.test(name);
    });
  }

  /** scripts/commerce.js or similar Commerce initialization */
  commerceScriptFile(): string | null {
    const candidates = [
      path.join(this.root, "scripts", "commerce.js"),
      path.join(this.root, "scripts", "commerce.ts"),
    ];
    for (const fp of candidates) {
      if (fs.existsSync(fp)) return fp;
    }
    return null;
  }

  /** Detect dropin imports in file content */
  hasDropinImport(fp: string): boolean {
    const content = this.read(fp);
    return /@dropins\/storefront/.test(content);
  }

  /** Get all JSON/env files for token scanning */
  configFiles(): string[] {
    const patterns = [
      path.join(this.root, "**/*.json").replace(/\\/g, "/"),
      path.join(this.root, "**/*.env*").replace(/\\/g, "/"),
    ];
    return fg.sync(patterns, { ignore: ["**/node_modules/**", "**/.git/**"] });
  }
}
