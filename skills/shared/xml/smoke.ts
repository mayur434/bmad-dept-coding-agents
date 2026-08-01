/**
 * XML smoke test — verifies the XML harness loads (or fails cleanly with the
 * documented stub error) and that the generic + Adobe/JVM rule suites fire on
 * synthesized bad XML. Run: `npx ts-node skills/shared/xml/smoke.ts`.
 */

import {
  loadXmlParser,
  parseXml,
  isXmlAstAvailable,
  xmlAstUnavailableReason,
  GENERIC_XML_RULES,
  ADOBE_XML_RULES,
} from "./index";

const BAD_GENERIC_XML = `<?xml version="1.0"?>
<config>
  <property name="password" value="Hunter2LongEnough"/>
  <value>TODO: fill in real API endpoint</value>
  <link href="/redirect?next={{unsafeParam}}">click</link>
</config>
<!DOCTYPE foo SYSTEM "http://evil.example.com/foo.dtd">
`;

const BAD_DI_XML = `<?xml version="1.0"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <preference for="Vendor\\Foo\\Api\\ThingInterface" type="Vendor\\Foo\\Model\\ThingA"/>
  <preference for="Vendor\\Foo\\Model\\ThingA" type="Vendor\\Foo\\Api\\ThingInterface"/>
</config>
`;

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error("  FAIL:", msg);
    process.exit(1);
  } else {
    console.log("  ok  :", msg);
  }
}

async function main(): Promise<void> {
  console.log("[1] parser load");
  const astAvailable = await isXmlAstAvailable();
  if (astAvailable) {
    const parser = await loadXmlParser();
    assert(parser != null, "loadXmlParser() returned a parser");
    const tree = await parseXml('<foo bar="baz">text</foo>');
    assert(tree != null && tree.rootNode != null, "parseXml() returned a tree with a root node");
    assert(tree.rootNode.text.includes("<foo"), "root node text contains the source");
  } else {
    console.log(
      "  info: XML WASM grammar not shipped — running in stub mode. Reason:",
      xmlAstUnavailableReason(),
    );
    try {
      await loadXmlParser();
      assert(false, "loadXmlParser() should have thrown in stub mode");
    } catch (err) {
      assert(
        String(err).includes("XML tree-sitter WASM not found"),
        "loadXmlParser() throws the documented stub error",
      );
    }
  }

  console.log("[2] generic rules over synthesized bad XML");
  const genericFindings = GENERIC_XML_RULES.flatMap((r) => r(BAD_GENERIC_XML, "test.xml", null));
  const ids = new Set(genericFindings.map((f) => f.ruleId));
  console.log("  fired:", [...ids].sort().join(", ") || "(none)");
  assert(ids.has("XML-SEC-001"), "XML-SEC-001 fires on hardcoded password attribute");
  assert(ids.has("XML-SEC-002"), "XML-SEC-002 fires on unescaped {{...}} in href");
  assert(ids.has("XML-CFG-001"), "XML-CFG-001 fires on TODO inside <value>");
  assert(ids.has("XML-CFG-002"), "XML-CFG-002 fires on external DTD reference");

  console.log("[3] adobe/jvm rules — di.xml circular preference");
  const adobeFindings = ADOBE_XML_RULES.flatMap((r) => r(BAD_DI_XML, "app/code/Vendor/Foo/etc/di.xml", null));
  const adobeIds = new Set(adobeFindings.map((f) => f.ruleId));
  console.log("  fired:", [...adobeIds].sort().join(", ") || "(none)");
  assert(adobeIds.has("COMMERCE-XML-001"), "COMMERCE-XML-001 fires on circular <preference>");

  console.log("XML smoke test passed");
}

main().catch((err) => {
  console.error("XML smoke test error:", err);
  process.exit(1);
});
