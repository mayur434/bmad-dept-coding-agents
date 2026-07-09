/**
 * DCA Shared — Generic JS/TS rules
 * =================================
 * Stack-agnostic Node/JS security rules over the tree-sitter AST, reused by
 * App Builder, EDS, and Commerce-SaaS engines. Ids JS-SEC-*; engines may rebrand
 * via idMap.
 */

import { JsRule, descend, calleeText, argsText, unquote } from "./scanner";

const SECRET_NAME =
  /(pass(word|wd)?|secret|api[_-]?key|access[_-]?key(id)?|private[_-]?key|client[_-]?secret|credential|auth[_-]?token|bearer|token|pwd)/i;
const PLACEHOLDER =
  /^(|\$\{.*\}|\{\{.*\}\}|<.*>|changeme|change_me|your[_-].*|example.*|placeholder|xxx+|todo|process\.env.*|null|undefined|true|false|\d{1,3}|[a-z]{1,3})$/i;
const CMD_FNS = /(^|\.)(exec|execSync|spawn|spawnSync|execFile|execFileSync)$/;

function isStringLike(node: import("web-tree-sitter").SyntaxNode | null): boolean {
  return !!node && (node.type === "string" || node.type === "template_string");
}

export const ruleHardcodedSecretJs: JsRule = (ctx, add) => {
  const emitSecret = (nameRaw: string, valueNode: import("web-tree-sitter").SyntaxNode) => {
    const name = nameRaw.split(".").pop() ?? nameRaw;
    if (!SECRET_NAME.test(name)) return;
    const val = unquote(valueNode.text);
    if (PLACEHOLDER.test(val.trim())) return;
    add(valueNode, {
      ruleId: "JS-SEC-001", title: "Hardcoded credential / secret", category: "Security", severity: "CRITICAL",
      description: `Secret-like \`${name}\` is assigned a hardcoded string literal.`,
      recommendation: "Read from process.env / the platform secret store; never inline secrets.",
      impact: "Credential committed to VCS and shipped in the deployed action/bundle.",
      effort: "M",
    });
  };

  for (const vd of descend(ctx.root, "variable_declarator")) {
    const nameNode = vd.childForFieldName("name");
    const value = vd.childForFieldName("value");
    if (nameNode && isStringLike(value)) emitSecret(nameNode.text, value!);
  }
  for (const pair of descend(ctx.root, "pair")) {
    const key = pair.childForFieldName("key");
    const value = pair.childForFieldName("value");
    if (key && isStringLike(value)) emitSecret(unquote(key.text), value!);
  }
  for (const ae of descend(ctx.root, "assignment_expression")) {
    const left = ae.childForFieldName("left");
    const right = ae.childForFieldName("right");
    if (left && isStringLike(right)) emitSecret(left.text, right!);
  }
};

export const ruleEval: JsRule = (ctx, add) => {
  for (const call of descend(ctx.root, "call_expression")) {
    if (calleeText(call) === "eval") {
      add(call, {
        ruleId: "JS-SEC-002", title: "Use of eval()", category: "Security", severity: "HIGH",
        description: "eval() executes arbitrary code and is a code-injection risk.",
        recommendation: "Remove eval(); parse data with JSON.parse or use a safe dispatch table.",
        impact: "Attacker-controlled input reaching eval() is remote code execution.",
        effort: "M",
      });
    }
  }
  for (const ne of descend(ctx.root, "new_expression")) {
    if (ne.childForFieldName("constructor")?.text === "Function") {
      add(ne, {
        ruleId: "JS-SEC-002", title: "Use of new Function()", category: "Security", severity: "HIGH",
        description: "new Function(...) compiles code from a string — an eval-equivalent.",
        recommendation: "Avoid dynamic code construction; use static functions.",
        impact: "Dynamic code from untrusted input is remote code execution.",
        effort: "M",
      });
    }
  }
};

export const ruleCommandInjection: JsRule = (ctx, add) => {
  for (const call of descend(ctx.root, "call_expression")) {
    const callee = calleeText(call);
    if (!CMD_FNS.test(callee)) continue;
    const args = call.childForFieldName("arguments");
    if (!args) continue;
    const dynamic =
      descend(args, "binary_expression").some((b) => b.text.includes("+")) ||
      descend(args, "template_string").some((t) => t.text.includes("${"));
    if (dynamic) {
      add(call, {
        ruleId: "JS-SEC-003", title: "Possible command injection", category: "Security", severity: "HIGH",
        description: `\`${callee}(...)\` runs a shell command built from dynamic input.`,
        recommendation: "Use execFile with an argument array and no shell; validate/allow-list inputs.",
        impact: "Attacker-controlled input can execute arbitrary OS commands.",
        effort: "M",
      });
    }
  }
};

export const GENERIC_JS_RULES: JsRule[] = [
  ruleHardcodedSecretJs,
  ruleEval,
  ruleCommandInjection,
];
