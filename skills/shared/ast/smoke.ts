/**
 * AST smoke test — verifies the tree-sitter WASM layer parses real Java
 * (OSGi/Sling/Spring shape) and answers a query. Run: `npm run smoke:ast`.
 */

import { astParser } from "./parser";

const JAVA = `
package com.acme.core;

import org.osgi.service.component.annotations.Component;

@Component(service = GreetingService.class, immediate = true)
public class GreetingServiceImpl implements GreetingService {
    private String prefix = "Hello";
    public String greet(String name) {
        return prefix + ", " + name;
    }
}
`;

async function main(): Promise<void> {
  const tree = await astParser.parse(JAVA, "java");
  const classes = await astParser.query(
    "java",
    "(class_declaration name: (identifier) @class.name)",
    tree.rootNode,
  );
  const methods = await astParser.query(
    "java",
    "(method_declaration name: (identifier) @method.name)",
    tree.rootNode,
  );
  const annotations = await astParser.query(
    "java",
    "(annotation name: (identifier) @annotation.name)",
    tree.rootNode,
  );

  console.log("classes:    ", classes.map((c) => c.text));
  console.log("methods:    ", methods.map((m) => m.text));
  console.log("annotations:", annotations.map((a) => a.text));

  const ok =
    classes.map((c) => c.text).includes("GreetingServiceImpl") &&
    methods.map((m) => m.text).includes("greet") &&
    annotations.map((a) => a.text).includes("Component");

  if (!ok) {
    console.error("❌ AST smoke test FAILED — expected symbols not found");
    process.exit(1);
  }
  console.log("✅ AST smoke test passed (tree-sitter Java, true AST)");
}

main().catch((err) => {
  console.error("❌ AST smoke test error:", err);
  process.exit(1);
});
