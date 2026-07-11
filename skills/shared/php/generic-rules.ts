/**
 * DCA Shared — Generic PHP rules (tree-sitter AST)
 * =================================================
 * Structural, high-precision PHP security rules — replacements for the regex
 * checks in the Commerce engine. Ids PHP-SEC-*; engines may rebrand via idMap.
 */

import type Parser from "web-tree-sitter";
import { PhpRule, descend, callName, argsNode, stripQuotes } from "./scanner";

const SECRET_NAME = /(pass(word|wd)?|secret|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|token|credential)/i;
const PLACEHOLDER = /^(|changeme|change_me|your[_-].*|example.*|placeholder|xxx+|todo|test|<.*>|\d{1,3})$/i;
const SQL_KEYWORDS = /\b(SELECT\b|INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|\bWHERE\b|\bFROM\s+\w|DROP\s+TABLE|UNION\s+SELECT)/i;
const SQL_METHODS = /^(query|exec|execute|prepare|multi_query|real_query|getResults|fetchAll|fetchOne|rawQuery)$/i;
const CMD_FNS = /^(exec|shell_exec|system|passthru|proc_open|popen|pcntl_exec)$/i;
const WEAK_HASH = /^(md5|sha1|crc32)$/i;
const SUPERGLOBAL = /^\$_(GET|POST|REQUEST|COOKIE|SERVER)\b/;
const ESCAPED = /htmlspecialchars|htmlentities|escapeHtml|escapeHtmlAttr|escaper|filter_var|intval|\(int\)/i;

function isStringLit(n: Parser.SyntaxNode | null): boolean {
  return !!n && (n.type === "string" || n.type === "encapsed_string");
}
function hasNonLiteralVar(node: Parser.SyntaxNode): boolean {
  return descend(node, "variable_name").length > 0 || descend(node, "subscript_expression").length > 0 || descend(node, "member_access_expression").length > 0;
}

export const ruleHardcodedSecret: PhpRule = (ctx, add) => {
  const emit = (name: string, valNode: Parser.SyntaxNode) => {
    const bare = name.replace(/^\$/, "");
    if (!SECRET_NAME.test(bare)) return;
    const val = stripQuotes(valNode.text);
    if (PLACEHOLDER.test(val.trim()) || val.includes("$")) return; // skip interpolated/placeholder
    add(valNode, {
      ruleId: "PHP-SEC-001", title: "Hardcoded credential / secret", category: "Security", severity: "CRITICAL",
      description: `Secret-like \`${bare}\` is assigned a hardcoded string literal.`,
      recommendation: "Move to deployment config (env.php / app config / a secret store); never commit secrets.",
      impact: "Credential exposed in source and every deployment.", effort: "M",
    });
  };
  for (const pd of descend(ctx.root, "property_declaration")) {
    const name = descend(pd, "variable_name")[0]?.text;
    const val = [...descend(pd, "encapsed_string"), ...descend(pd, "string")][0];
    if (name && val) emit(name, val);
  }
  for (const ae of descend(ctx.root, "assignment_expression")) {
    const left = ae.childForFieldName("left");
    const right = ae.childForFieldName("right");
    if (left && isStringLit(right)) emit(left.text, right!);
  }
};

export const ruleSqlInjection: PhpRule = (ctx, add) => {
  for (const be of descend(ctx.root, "binary_expression")) {
    if (!be.text.includes(".")) continue; // PHP string concat is "."
    const strs = [...descend(be, "encapsed_string"), ...descend(be, "string")];
    const hasSqlLiteral = strs.some((s) => SQL_KEYWORDS.test(s.text));
    if (hasSqlLiteral && hasNonLiteralVar(be)) {
      add(be, {
        ruleId: "PHP-SEC-002", title: "SQL injection via string concatenation", category: "Security", severity: "CRITICAL",
        description: "A SQL statement is built by concatenating a variable into a query string.",
        recommendation: "Use prepared statements / bound parameters (e.g. $connection->select()->where('id = ?', $id)).",
        impact: "Attacker-controlled input can alter the query — data exfiltration, tampering, auth bypass.", effort: "M",
      });
    }
  }
};

export const ruleEval: PhpRule = (ctx, add) => {
  for (const c of descend(ctx.root, "function_call_expression")) {
    if (callName(c).toLowerCase() === "eval") {
      add(c, {
        ruleId: "PHP-SEC-003", title: "Use of eval()", category: "Security", severity: "CRITICAL",
        description: "eval() executes arbitrary PHP from a string.",
        recommendation: "Remove eval(); use a safe dispatch/whitelist instead.",
        impact: "Any attacker-controlled input reaching eval() is remote code execution.", effort: "M",
      });
    }
  }
};

export const ruleCommandInjection: PhpRule = (ctx, add) => {
  for (const c of descend(ctx.root, "function_call_expression")) {
    if (!CMD_FNS.test(callName(c))) continue;
    const args = argsNode(c);
    if (args && hasNonLiteralVar(args)) {
      add(c, {
        ruleId: "PHP-SEC-004", title: "Possible command injection", category: "Security", severity: "HIGH",
        description: `\`${callName(c)}(...)\` runs an OS command built from dynamic input.`,
        recommendation: "Avoid shell calls; if unavoidable use escapeshellarg()/escapeshellcmd() and validate input.",
        impact: "Attacker-controlled input can execute arbitrary OS commands.", effort: "M",
      });
    }
  }
};

export const ruleWeakCrypto: PhpRule = (ctx, add) => {
  for (const c of descend(ctx.root, "function_call_expression")) {
    if (WEAK_HASH.test(callName(c))) {
      add(c, {
        ruleId: "PHP-SEC-005", title: "Weak hashing function", category: "Security", severity: "MEDIUM",
        description: `\`${callName(c)}()\` is cryptographically weak.`,
        recommendation: "Use password_hash()/password_verify() for passwords and hash('sha256', …) for digests.",
        impact: "Collisions / trivial reversal of protected values.", effort: "M",
      });
    }
  }
};

export const ruleXssEcho: PhpRule = (ctx, add) => {
  for (const e of descend(ctx.root, "echo_statement")) {
    const subs = descend(e, "subscript_expression").filter((s) => SUPERGLOBAL.test(s.text));
    if (subs.length && !ESCAPED.test(e.text)) {
      add(e, {
        ruleId: "PHP-SEC-006", title: "Reflected XSS — unescaped superglobal echoed", category: "Security", severity: "HIGH",
        description: "A request superglobal ($_GET/$_POST/…) is echoed without escaping.",
        recommendation: "Escape on output with the Magento Escaper / htmlspecialchars().",
        impact: "Reflected cross-site scripting.", effort: "S",
      });
    }
  }
};

export const ruleUnserialize: PhpRule = (ctx, add) => {
  for (const c of descend(ctx.root, "function_call_expression")) {
    if (callName(c).toLowerCase() !== "unserialize") continue;
    const args = argsNode(c);
    if (args && descend(args, "subscript_expression").some((s) => SUPERGLOBAL.test(s.text))) {
      add(c, {
        ruleId: "PHP-SEC-007", title: "unserialize() on user input", category: "Security", severity: "HIGH",
        description: "unserialize() on request data enables PHP object injection.",
        recommendation: "Use json_decode() for untrusted data, or unserialize() with allowed_classes=false.",
        impact: "Object-injection → possible RCE via gadget chains.", effort: "M",
      });
    }
  }
};

export const GENERIC_PHP_RULES: PhpRule[] = [
  ruleHardcodedSecret,
  ruleSqlInjection,
  ruleEval,
  ruleCommandInjection,
  ruleWeakCrypto,
  ruleXssEcho,
  ruleUnserialize,
];
