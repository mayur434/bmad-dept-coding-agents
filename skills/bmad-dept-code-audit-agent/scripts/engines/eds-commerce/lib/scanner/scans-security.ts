/**
 * EDS-Commerce Scanner — Security Scans
 * ========================================
 * Rules: EDSC-SEC-001 through EDSC-SEC-003
 */
import * as fs from "fs";
import * as path from "path";
import { EdsCommerceScannerContext } from "./context";

// ==================== EDSC-SEC-001: Exposed Commerce Admin Tokens ====================

export function scanExposedTokens(ctx: EdsCommerceScannerContext): void {
  const allJs = ctx.allJsFiles();
  const configFiles = ctx.configFiles();
  const filesToScan = [...allJs, ...configFiles];

  const tokenPatterns: Array<{ pattern: RegExp; type: string; desc: string }> = [
    {
      pattern: /Bearer\s+[A-Za-z0-9\-._~+/]{20,}/,
      type: "Hardcoded Bearer Token",
      desc: "Bearer token hardcoded in source — grants API access to anyone reading the code",
    },
    {
      pattern: /['"](?:integration|admin)[-_]?token['"]\s*[:=]\s*['"][^'"]+['"]/,
      type: "Admin/Integration Token",
      desc: "Commerce admin or integration token in client-side code",
    },
    {
      pattern: /['"]Authorization['"]\s*[:=]\s*['"]Bearer\s+/,
      type: "Hardcoded Auth Header",
      desc: "Authorization header with Bearer token hardcoded",
    },
    {
      pattern: /x-api-key['"]\s*[:=]\s*['"][^'"]{16,}['"]/,
      type: "Hardcoded API Key",
      desc: "API key hardcoded in source code — should come from config",
    },
    {
      pattern: /MAGENTO_ADMIN_TOKEN|COMMERCE_ADMIN_TOKEN|ADMIN_API_KEY/,
      type: "Admin Token Variable",
      desc: "Reference to admin token constant — ensure value comes from environment, not hardcoded",
    },
  ];

  for (const fp of filesToScan) {
    const mod = ctx.module(fp);
    const rel = ctx.rel(fp);

    // Skip node_modules and test files
    if (rel.includes("node_modules") || rel.includes("test") || rel.includes("mock")) continue;

    for (const { pattern, type, desc } of tokenPatterns) {
      for (const hit of ctx.grep(fp, pattern)) {
        ctx.add(
          "Security", mod, fp, hit.lineNum,
          type, desc,
          ctx.context(fp, hit.lineNum), "CRITICAL",
          "Remove token from source. Use storefront-scoped tokens for public access; route admin operations through secure backend middleware.",
          "Low", "Admin tokens grant full backend access — catastrophic if exposed"
        );
      }
    }
  }
}

// ==================== EDSC-SEC-002: Missing Cart Token Validation ====================

export function scanCartValidation(ctx: EdsCommerceScannerContext): void {
  const allJs = ctx.allJsFiles();

  for (const fp of allJs) {
    const mod = ctx.module(fp);
    const content = ctx.read(fp);
    if (!content) continue;

    // Cart ID from URL parameter (attackable)
    for (const hit of ctx.grep(fp, /URLSearchParams.*cart[Ii]d|getParam.*cart/)) {
      ctx.add(
        "Security", mod, fp, hit.lineNum,
        "Cart ID from URL Parameter",
        "Cart ID read from URL parameter — allows cart manipulation attacks",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Generate cart IDs server-side via createEmptyCart mutation. Never accept cart IDs from URLs.",
        "Low", "Attacker can manipulate other users' carts by guessing/stealing cart IDs"
      );
    }

    // Hardcoded cart ID in mutations
    for (const hit of ctx.grep(fp, /cartId:\s*['"][^'"]{10,}['"]/)) {
      ctx.add(
        "Security", mod, fp, hit.lineNum,
        "Hardcoded Cart ID",
        "Cart ID appears hardcoded in GraphQL mutation",
        ctx.context(fp, hit.lineNum), "HIGH",
        "Retrieve cart ID dynamically from createEmptyCart or customer session.",
        "Low", "Hardcoded cart IDs indicate broken cart flow"
      );
    }
  }
}

// ==================== EDSC-SEC-003: PCI Compliance — Payment Data Handling ====================

export function scanPciCompliance(ctx: EdsCommerceScannerContext): void {
  const allJs = ctx.allJsFiles();

  const pciPatterns: Array<{ pattern: RegExp; type: string; desc: string }> = [
    {
      pattern: /(?:card[_-]?number|cc[_-]?number|cvv|cvc|security[_-]?code)/,
      type: "Payment Data Reference",
      desc: "Reference to raw payment card data in JavaScript — PCI DSS violation",
    },
    {
      pattern: /<input.*type=['"]text['"].*(?:card|cc|cvv|expiry|cvc)/,
      type: "Custom Payment Input Field",
      desc: "Custom text input for payment data — must use hosted payment fields (Stripe, Braintree, etc.)",
    },
    {
      pattern: /getElementById.*(?:card-number|cc-number|cvv|expiry)/,
      type: "Reading Payment DOM Element",
      desc: "Reading payment field value from DOM — card data must never touch your JavaScript",
    },
    {
      pattern: /\.value.*(?:card|cc|payment).*\d/,
      type: "Payment Value Access",
      desc: "Accessing payment field .value — puts merchant in full PCI scope",
    },
  ];

  for (const fp of allJs) {
    const mod = ctx.module(fp);
    const rel = ctx.rel(fp);

    // Focus on checkout/payment blocks
    for (const { pattern, type, desc } of pciPatterns) {
      for (const hit of ctx.grep(fp, pattern)) {
        // Skip false positives: gift cards, comments
        if (hit.lineText.includes("//") || hit.lineText.includes("gift") || hit.lineText.includes("loyalty")) continue;

        ctx.add(
          "Security", mod, fp, hit.lineNum,
          type, desc,
          ctx.context(fp, hit.lineNum), "CRITICAL",
          "Use provider-hosted payment fields (Stripe Elements, Braintree Drop-in, PayPal SDK). Card data must never enter your JS.",
          "High", "PCI DSS violation — merchant becomes fully liable for card data breaches"
        );
      }
    }
  }
}
