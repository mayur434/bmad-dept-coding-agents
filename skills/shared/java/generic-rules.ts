/**
 * DCA Shared — Generic Java rules
 * ================================
 * Stack-agnostic Java security & quality rules over the tree-sitter AST, reused by
 * every Java engine (Sling/Shaft, Spring Boot, AEM). Rule ids are prefixed
 * JAVA-* (quality) / GEN-SEC-* … but engines relabel via the `ruleId` here so a
 * stack can present them under its own scheme if desired. Kept generic on purpose.
 */

import { JavaRule, descend, stripQuotes, firstStringLiteral } from "./scanner";

const SECRET_NAME =
  /(pass(word|wd)?|secret|api[_-]?key|access[_-]?key(id)?|private[_-]?key|client[_-]?secret|credential|auth[_-]?token|bearer|pwd)/i;
const PLACEHOLDER =
  /^(|\$\{.*\}|\{\{.*\}\}|changeme|change_me|your[_-].*|example.*|placeholder|xxx+|todo|n\/?a|null|true|false|\d{1,3}|[a-z]{1,3})$/i;
const SQL_METHODS = new Set([
  "executeQuery", "execute", "executeUpdate", "executeLargeUpdate",
  "prepareStatement", "prepareCall", "createStatement",
  "createQuery", "createNativeQuery", "createSQLQuery", "addBatch",
]);
const SQL_KEYWORDS = /\b(SELECT|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|WHERE|FROM\s+|DROP\s+|UNION\s+)/i;
const WEAK_HASH = ["MD5", "MD2", "SHA1", "SHA-1", "SHA0"];
const WEAK_CIPHER = /(^|[^A-Za-z])(DES|DESede|RC4|RC2|Blowfish)([^A-Za-z]|$)|\/ECB\//;
const TOKENISH = /(token|otp|nonce|salt|secret|session|apikey|api_key)/i;

export const ruleHardcodedSecret: JavaRule = (ctx, add) => {
  for (const vd of descend(ctx.root, "variable_declarator")) {
    const name = vd.childForFieldName("name")?.text ?? "";
    const value = vd.childForFieldName("value");
    if (!SECRET_NAME.test(name) || !value || value.type !== "string_literal") continue;
    if (PLACEHOLDER.test(stripQuotes(value.text).trim())) continue;
    add(value, {
      ruleId: "GEN-SEC-001", title: "Hardcoded credential / secret", category: "Security", severity: "CRITICAL",
      description: `Secret-like field \`${name}\` is assigned a hardcoded string literal.`,
      recommendation: "Move to configuration / environment / a secret store; never commit secrets.",
      impact: ctx.isConnector
        ? "Connector credential leak — exposes the external system to anyone with repo/bundle access, across all environments."
        : "Credential exposed in source and compiled artifact across all environments.",
      effort: "M",
    });
  }
  for (const ae of descend(ctx.root, "assignment_expression")) {
    const left = ae.childForFieldName("left")?.text ?? "";
    const right = ae.childForFieldName("right");
    const leaf = left.split(".").pop() ?? left;
    if (!SECRET_NAME.test(leaf) || !right || right.type !== "string_literal") continue;
    if (PLACEHOLDER.test(stripQuotes(right.text).trim())) continue;
    add(right, {
      ruleId: "GEN-SEC-001", title: "Hardcoded credential / secret", category: "Security", severity: "CRITICAL",
      description: `Secret-like target \`${left}\` is assigned a hardcoded string literal.`,
      recommendation: "Move to configuration / secret store.",
      impact: "Credential exposed in source and compiled artifact.", effort: "M",
    });
  }
};

export const ruleSqlInjection: JavaRule = (ctx, add) => {
  for (const mi of descend(ctx.root, "method_invocation")) {
    const name = mi.childForFieldName("name")?.text ?? "";
    if (!SQL_METHODS.has(name)) continue;
    const args = mi.childForFieldName("arguments");
    if (!args) continue;
    const hasConcat = descend(args, "binary_expression").some((b) => b.text.includes("+"));
    if (hasConcat && SQL_KEYWORDS.test(args.text)) {
      add(mi, {
        ruleId: "GEN-SEC-002", title: "SQL injection via string concatenation", category: "Security", severity: "CRITICAL",
        description: `\`${name}(...)\` is called with a SQL string built by concatenation.`,
        recommendation: "Use parameterized queries / PreparedStatement placeholders (?) or named JPA parameters.",
        impact: "Attacker-controlled input can alter the query — data exfiltration, tampering, or auth bypass.", effort: "M",
      });
    }
  }
};

export const ruleWeakCrypto: JavaRule = (ctx, add) => {
  for (const mi of descend(ctx.root, "method_invocation")) {
    if (mi.childForFieldName("name")?.text !== "getInstance") continue;
    const argText = mi.childForFieldName("arguments")?.text ?? "";
    const literal = firstStringLiteral(mi);
    const algo = literal ? stripQuotes(literal).toUpperCase() : argText.toUpperCase();
    if (WEAK_HASH.some((h) => algo.startsWith(h)) || WEAK_CIPHER.test(algo)) {
      add(mi, {
        ruleId: "GEN-SEC-005", title: "Weak cryptographic algorithm", category: "Security", severity: "HIGH",
        description: `Weak algorithm requested via getInstance(${literal ?? argText}).`,
        recommendation: "Use SHA-256+ for hashing and AES/GCM for encryption; avoid MD5/SHA-1/DES/ECB.",
        impact: "Broken hashes/ciphers allow forgery, collision, or decryption of protected data.", effort: "M",
      });
    }
  }
};

export const ruleInsecureRandom: JavaRule = (ctx, add) => {
  for (let i = 0; i < ctx.lines.length; i++) {
    if (/\bnew\s+Random\s*\(/.test(ctx.lines[i]) && TOKENISH.test(ctx.lines[i])) {
      add(i + 1, {
        ruleId: "GEN-SEC-006", title: "Insecure Random used for a security value", category: "Security", severity: "MEDIUM",
        description: "java.util.Random is predictable and unsuitable for tokens/OTP/salts.",
        recommendation: "Use java.security.SecureRandom for any security-sensitive value.",
        impact: "Predictable tokens/OTPs can be guessed, enabling impersonation.", effort: "S",
      });
    }
  }
};

export const ruleDisabledTls: JavaRule = (ctx, add) => {
  const patterns: Array<[RegExp, string]> = [
    [/ALLOW_ALL_HOSTNAME_VERIFIER|NoopHostnameVerifier|setHostnameVerifier\s*\(\s*\([^)]*\)\s*->\s*true/, "hostname verification disabled"],
    [/TrustAllStrategy|TrustSelfSignedStrategy|new\s+X509TrustManager|checkServerTrusted\s*\([^)]*\)\s*\{\s*\}/, "certificate validation disabled"],
  ];
  for (let i = 0; i < ctx.lines.length; i++) {
    for (const [re, what] of patterns) {
      if (re.test(ctx.lines[i])) {
        add(i + 1, {
          ruleId: "GEN-SEC-004", title: "TLS trust/hostname verification disabled", category: "Security", severity: "HIGH",
          description: `Insecure TLS: ${what}.`,
          recommendation: "Never disable certificate or hostname validation; trust the system truststore.",
          impact: "Man-in-the-middle attacks on outbound integration traffic.", effort: "M",
        });
      }
    }
  }
};

export const ruleEmptyCatch: JavaRule = (ctx, add) => {
  for (const cc of descend(ctx.root, "catch_clause")) {
    const block = cc.namedChildren.find((c) => c.type === "block");
    if (block && block.namedChildCount === 0) {
      add(cc, {
        ruleId: "JAVA-QUAL-001", title: "Empty catch block swallows exceptions", category: "Reliability", severity: "MEDIUM",
        description: "An exception is caught and silently ignored.",
        recommendation: "Log with context or handle/rethrow; never swallow silently.",
        impact: "Failures disappear, making incidents undiagnosable.", effort: "S",
      });
    }
  }
};

export const ruleBroadCatch: JavaRule = (ctx, add) => {
  const broad = new Set(["Throwable", "Exception", "RuntimeException"]);
  for (const cc of descend(ctx.root, "catch_clause")) {
    const hit = descend(cc, "type_identifier").map((t) => t.text).find((t) => broad.has(t));
    if (hit) {
      add(cc, {
        ruleId: "JAVA-QUAL-002", title: `Overly broad catch (${hit})`, category: "Maintainability", severity: "LOW",
        description: `Catching \`${hit}\` hides unrelated failures.`,
        recommendation: "Catch the narrowest applicable exception type(s).",
        impact: "Masks bugs and can catch Errors that should propagate.", effort: "S",
      });
    }
  }
};

export const rulePrintStackTrace: JavaRule = (ctx, add) => {
  for (const mi of descend(ctx.root, "method_invocation")) {
    if (mi.childForFieldName("name")?.text === "printStackTrace") {
      add(mi, {
        ruleId: "JAVA-QUAL-003", title: "printStackTrace() instead of logging", category: "Maintainability", severity: "LOW",
        description: "Stack traces printed to stderr bypass the logging pipeline.",
        recommendation: "Use the SLF4J logger with appropriate level and context.",
        impact: "Errors are lost outside log aggregation.", effort: "S",
      });
    }
  }
};

export const ruleSystemOut: JavaRule = (ctx, add) => {
  for (let i = 0; i < ctx.lines.length; i++) {
    if (/System\.(out|err)\.(print|println|printf)/.test(ctx.lines[i])) {
      add(i + 1, {
        ruleId: "JAVA-QUAL-004", title: "System.out/err used instead of logger", category: "Maintainability", severity: "LOW",
        description: "Console output bypasses structured logging.",
        recommendation: "Use SLF4J (LoggerFactory.getLogger).",
        impact: "Not captured by log configuration/aggregation.", effort: "S",
      });
    }
  }
};

/** All generic Java rules, in reporting order. */
export const GENERIC_JAVA_RULES: JavaRule[] = [
  ruleHardcodedSecret,
  ruleSqlInjection,
  ruleWeakCrypto,
  ruleInsecureRandom,
  ruleDisabledTls,
  ruleEmptyCatch,
  ruleBroadCatch,
  rulePrintStackTrace,
  ruleSystemOut,
];
